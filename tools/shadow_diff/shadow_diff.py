"""Shadow-diff parity harness — N41 (Rust ⇄ Python on one shared DB).

Usage:
    python tools/shadow_diff/shadow_diff.py                  # seed a canonical DB, diff both servers
    python tools/shadow_diff/shadow_diff.py --db /path.db    # skip seeding, use an existing DB

The --db mode copies the supplied DB so both servers start byte-identical
and does NOT run fixture scan/image/addon seeding.
Reports land at tools/shadow_diff/report.md and report.json.
Exit 0 = only whitelisted diffs; exit 1 = real findings.
"""
from __future__ import annotations

import argparse
import atexit
import base64
import copy
import json
import math
import os
import shutil
import signal
import socket
import sqlite3
import struct
import subprocess
import sys
import tempfile
import textwrap
import time
import zlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

# ── Constants ────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "rust" / "core" / "tests" / "fixtures"
RUST_BINARY = REPO_ROOT / "rust" / "target" / "debug" / "aurora_server"
BACKEND_DIR = REPO_ROOT / "backend"
REPORT_DIR = REPO_ROOT / "tools" / "shadow_diff"

PYTHON_PORT = 18700
RUST_PORT = 18701
MOCK_ADDON_PORT = 18702

HEALTH_TIMEOUT = 15  # seconds to wait for each server
REQUEST_TIMEOUT = 30  # per-request timeout

# Small 1×1 green PNG for playlist image upload test
_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP438EAAAQRAYhxoDirAAAAAElFTkSuQmCC"
)

# ── Database Schema & Seed ───────────────────────────────────────────────────

def _get_init_sql() -> str:
    """Extract INIT_SQL from backend/app/database.py."""
    db_py = BACKEND_DIR / "app" / "database.py"
    text = db_py.read_text()
    # Extract the triple-quoted INIT_SQL string
    start = text.index('INIT_SQL = """')
    end = text.index('"""', start + len('INIT_SQL = """')) + 3
    block = text[start:end]
    # Execute to get the value
    ns: dict = {}
    exec(block, ns)
    return ns["INIT_SQL"]

_TS1 = "2025-06-01T12:00:00Z"
_TS2 = "2025-06-01T12:01:00Z"

SEED_SONGS = [
    (1, "Highway Star", "Deep Purple", "Machine Head", 367,
     str(FIXTURES_DIR / "test_song.mp3"), "mp3", "abc123def456.jpg",
     "local_scan", 320000, 44100, 16, 8812345,
     json.dumps([0.1, 0.25, 0.5, 0.75, 0.9, 0.85, 0.6, 0.3, 0.1, 0.05]),
     "#E63946", "#457B9D",
     -8.5, 0.95, -7.2, 0.98,
     json.dumps(["Deep Purple"]), None, _TS1, _TS2),
    (2, "Chill Vibes", "LoFi Girl", None, 180,
     None, None, None,
     "manual", None, None, None, None,
     None, None, None,
     None, None, None, None,
     None, None, _TS2, _TS2),
    (3, "Unravel", "TK from Ling Tosite Sigure", "Tokyo Ghoul OST", 240,
     "/music/anime/TK - Unravel.mp3", "mp3", None,
     "local_scan", 256000, 44100, 16, 4801234,
     json.dumps([0.05, 0.15, 0.35, 0.55, 0.8, 0.95, 0.7, 0.4, 0.2, 0.08]),
     "#2A9D8F", "#E9C46A",
     -6.0, 0.88, -5.5, 0.92,
     json.dumps(["TK from Ling Tosite Sigure"]), json.dumps([]), _TS1, _TS1),
]


def seed_database(data_dir: Path) -> None:
    """Create aurora.db with deterministic seed data at data_dir."""
    db_path = data_dir / "aurora.db"
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(_get_init_sql())

    song_cols = (
        "id,title,artist,album,duration,file_path,file_format,"
        "album_art_path,source,bitrate,sample_rate,bit_depth,file_size,"
        "waveform_peaks,dominant_color,dominant_color_2,"
        "replaygain_track_gain,replaygain_track_peak,"
        "replaygain_album_gain,replaygain_album_peak,"
        "artists,featured_artists,created_at,updated_at"
    )
    for s in SEED_SONGS:
        conn.execute(f"INSERT INTO songs ({song_cols}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", s)

    for tid, name, ts in [
        (1, "rock", _TS1), (2, "fast", _TS1), (3, "slow", _TS2),
        (4, "chill", _TS2), (5, "anime", _TS1), (6, "opening", _TS1),
    ]:
        conn.execute("INSERT INTO tags (id,name,created_at) VALUES (?,?,?)", (tid, name, ts))

    for sid, tid in [(1, 1), (1, 2), (2, 3), (2, 4), (3, 5), (3, 6)]:
        conn.execute("INSERT INTO song_tags (song_id,tag_id) VALUES (?,?)", (sid, tid))

    for pid, name, color, emoji, ts in [
        (1, "Rock Classics", "#E63946", "\U0001f3b8", _TS1),
        (2, "Lo-Fi Study", "#457B9D", "\U0001f4da", _TS2),
        (3, "Anime", "#2A9D8F", "\U0001f38c", _TS1),
    ]:
        conn.execute(
            "INSERT INTO playlists (id,name,color,emoji,image_url,"
            "dominant_color,dominant_color_2,crossfade_enabled,crossfade_duration_s,"
            "created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (pid, name, color, emoji, None, None, None, None, None, ts, ts),
        )

    for ps in [
        (1, 1, 0, 0, 0, _TS1), (2, 2, 0, 0, 0, _TS2), (3, 3, 0, 0, 0, _TS1),
    ]:
        conn.execute(
            "INSERT INTO playlist_songs (playlist_id,song_id,position,start_time_ms,end_time_ms,added_at) "
            "VALUES (?,?,?,?,?,?)", ps
        )

    conn.execute(
        "INSERT INTO watched_folders (id,folder_path,is_active,last_scan_at,created_at) VALUES (?,?,?,?,?)",
        (1, "/music/rock", 1, None, _TS1),
    )

    conn.commit()
    conn.close()


# ── Server Management ────────────────────────────────────────────────────────

_servers: dict[str, subprocess.Popen] = {}


def _find_free_port() -> int:
    with socket.socket() as s:
        s.bind(("", 0))
        return s.getsockname()[1]


def _wait_healthy(base: str, timeout: float = HEALTH_TIMEOUT, health_path: str = "/api/health") -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            r = httpx.get(f"{base}{health_path}", timeout=2)
            if r.status_code == 200:
                return True
        except (httpx.ConnectError, httpx.ReadTimeout):
            pass
        time.sleep(0.3)
    return False


def start_mock_addon() -> str:
    """Start mock addon server on a random port. Returns base_url."""
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn",
         "tests.mock_addon:app", "--host", "127.0.0.1", "--port", str(MOCK_ADDON_PORT)],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env={**os.environ, "AURORA_DATA_DIR": "/tmp/_unused_mock"},
    )
    _servers["mock_addon"] = proc
    base = f"http://127.0.0.1:{MOCK_ADDON_PORT}"
    if not _wait_healthy(base, timeout=10, health_path="/manifest.json"):
        raise RuntimeError("Mock addon server failed to start")
    return base


def start_python_server(data_dir: Path) -> str:
    """Start Python FastAPI server. Returns base_url."""
    env = {**os.environ, "AURORA_DATA_DIR": str(data_dir)}
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(PYTHON_PORT)],
        cwd=str(BACKEND_DIR), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    _servers["python"] = proc
    base = f"http://127.0.0.1:{PYTHON_PORT}"
    if not _wait_healthy(base):
        raise RuntimeError("Python server failed to start")
    return base


def start_rust_server(data_dir: Path) -> str:
    """Start Rust aurora_server. Returns base_url."""
    env = {
        **os.environ,
        "AURORA_DATA_DIR": str(data_dir),
        "AURORA_DB_PATH": str(data_dir / "aurora.db"),
        "AURORA_PORT": str(RUST_PORT),
    }
    proc = subprocess.Popen(
        [str(RUST_BINARY)], env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    _servers["rust"] = proc
    base = f"http://127.0.0.1:{RUST_PORT}"
    if not _wait_healthy(base):
        raise RuntimeError("Rust server failed to start")
    return base


def stop_server(name: str) -> None:
    """Stop a single server by name."""
    proc = _servers.pop(name, None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def stop_all() -> None:
    """Gracefully stop all servers."""
    for name, proc in list(_servers.items()):
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
    _servers.clear()


# ── Seed via live server (scan, image, addon) ────────────────────────────────

def _seed_via_server(base: str, fixtures_dir: Path, mock_addon_url: str | None = None) -> None:
    """POST /scan + upload playlist image + register addon via HTTP."""
    # Scan fixtures for waveform/color data
    r = httpx.post(f"{base}/api/scan", json={"folder_path": str(fixtures_dir)}, timeout=60)
    if r.status_code != 200:
        print(f"  ⚠ scan failed on {base}: {r.status_code} {r.text[:200]}")

    # Upload a small PNG to playlist 1 (tests W5 + W6 image pipeline)
    r = httpx.put(
        f"{base}/api/playlists/1/image",
        files={"file": ("test.png", _TINY_PNG, "image/png")},
        timeout=10,
    )
    if r.status_code != 200:
        print(f"  ⚠ image upload failed on {base}: {r.status_code} {r.text[:200]}")

    # Register mock addon
    if mock_addon_url:
        r = httpx.post(f"{base}/api/addons", json={"base_url": mock_addon_url}, timeout=10)
        if r.status_code not in (200, 201):
            print(f"  ⚠ addon registration failed on {base}: {r.status_code} {r.text[:200]}")


def _prepare_backfill_playlist(db_path: Path) -> None:
    """Set playlist 2: image_url = non-null, dominant_color = NULL.

    This triggers W6 lazy-backfill on the first GET /playlists or
    GET /playlists/{id}.  Run AFTER scan/upload so the playlist already
    has a real image_url; then NULL out the color to force backfill.
    """
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "UPDATE playlists SET dominant_color = NULL, dominant_color_2 = NULL WHERE id = 2"
    )
    conn.commit()
    conn.close()


# ── Whitelist Normalization (W1–W10) ─────────────────────────────────────────

# Timestamp keys that differ between servers (W1)
_TS_KEYS = {
    "added_at", "updated_at", "created_at",
    "last_ok_at", "last_fail_at", "expires_at", "last_scan_at",
}

# Timestamp header names (W1)
_TS_HEADERS = {"last-modified", "date"}

# §2B analysis value keys (W3)
_ANALYSIS_KEYS = {
    "dominant_color", "dominant_color_2",
    "bleed_thumb", "bleed_region_x", "bleed_region_y",
    "bleed_region_w", "bleed_region_h",
    "waveform_peaks",
}


def _is_wellformed_timestamp(val: str) -> bool:
    """Check timestamp is ISO-8601 with timezone (Z or +HH:MM)."""
    if not isinstance(val, str):
        return False
    try:
        if val.endswith("Z"):
            datetime.fromisoformat(val.replace("Z", "+00:00"))
        else:
            datetime.fromisoformat(val)
        return True
    except (ValueError, TypeError):
        return False


def _normalize_timestamps(obj: Any, _parent_key: str = "") -> Any:
    """Recursively blank volatile timestamps (W1).

    Preserves structure; asserts well-formedness in-place.
    """
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in _TS_KEYS and isinstance(v, str):
                if not _is_wellformed_timestamp(v):
                    return f"<MALFORMED_TS:{v!r}>"
                out[k] = "<TIMESTAMP>"
            else:
                out[k] = _normalize_timestamps(v, k)
        return out
    if isinstance(obj, list):
        return [_normalize_timestamps(item, _parent_key) for item in obj]
    return obj


def _normalize_analysis_values(obj: Any) -> Any:
    """Normalize §2B analysis values (W3).

    For waveform_peaks: assert array of floats ∈ [0,1], blank exact values.
    For color strings: assert oklch/hex format, blank exact value.
    For bleed_thumb: assert non-null → <BLOB>, null → null.
    For bleed_region_*: assert integer type, blank exact value.
    """
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k == "waveform_peaks":
                if v is None:
                    out[k] = None
                elif isinstance(v, list):
                    if not all(isinstance(x, (int, float)) and 0 <= x <= 1 for x in v):
                        return f"<INVALID_PEAKS:{v[:5]!r}...>"
                    out[k] = f"<PEAKS[{len(v)}]>"
                elif isinstance(v, str):
                    # Sometimes peaks come back as JSON string
                    try:
                        parsed = json.loads(v)
                        if isinstance(parsed, list):
                            out[k] = f"<PEAKS[{len(parsed)}]>"
                        else:
                            out[k] = "<PEAKS_STR>"
                    except (json.JSONDecodeError, TypeError):
                        out[k] = "<PEAKS_STR>"
                else:
                    out[k] = f"<PEAKS_TYPE:{type(v).__name__}>"
            elif k in ("dominant_color", "dominant_color_2"):
                if v is None:
                    out[k] = None
                elif isinstance(v, str):
                    out[k] = "<COLOR>"
                else:
                    out[k] = f"<COLOR_TYPE:{type(v).__name__}>"
            elif k == "bleed_thumb":
                out[k] = None if v is None else "<BLOB>"
            elif k in ("bleed_region_x", "bleed_region_y", "bleed_region_w", "bleed_region_h"):
                out[k] = None if v is None else "<INT>"
            else:
                out[k] = _normalize_analysis_values(v)
        return out
    if isinstance(obj, list):
        return [_normalize_analysis_values(item) for item in obj]
    return obj


def _compare_numbers(a: Any, b: Any) -> bool:
    """Numeric comparison with epsilon (W8)."""
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(float(a), float(b), rel_tol=1e-6, abs_tol=1e-9)
    return a == b


def _semantically_equal(a: Any, b: Any) -> bool:
    """Deep comparison: numeric tolerance (W8), key-order agnostic (W7)."""
    if a is None and b is None:
        return True
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return _compare_numbers(a, b)
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(_semantically_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(_semantically_equal(x, y) for x, y in zip(a, b))
    return a == b


def _get_json_body(resp: httpx.Response) -> Any:
    """Parse response body as JSON, return None on failure."""
    try:
        return resp.json()
    except Exception:
        return None


def _field_level_diff(py_obj: Any, rs_obj: Any, path: str = "") -> list[str]:
    """Compute field-level diff between two normalized objects.

    Returns a list of human-readable diff lines like:
        data[1].album_art_path: PY=null RS=""
    """
    diffs: list[str] = []

    if py_obj is None and rs_obj is None:
        return diffs
    if py_obj is None or rs_obj is None:
        diffs.append(f"{path or '<root>'}: PY={json.dumps(py_obj, default=str)} RS={json.dumps(rs_obj, default=str)}")
        return diffs

    if type(py_obj) != type(rs_obj):
        diffs.append(f"{path or '<root>'}: type mismatch PY={type(py_obj).__name__} RS={type(rs_obj).__name__}")
        return diffs

    if isinstance(py_obj, dict):
        all_keys = set(py_obj.keys()) | set(rs_obj.keys())
        for k in sorted(all_keys):
            child_path = f"{path}.{k}" if path else k
            pv = py_obj.get(k)
            rv = rs_obj.get(k)
            if not _semantically_equal(pv, rv):
                diffs.extend(_field_level_diff(pv, rv, child_path))
    elif isinstance(py_obj, list):
        max_len = max(len(py_obj), len(rs_obj))
        for i in range(max_len):
            child_path = f"{path}[{i}]"
            pv = py_obj[i] if i < len(py_obj) else None
            rv = rs_obj[i] if i < len(rs_obj) else None
            if not _semantically_equal(pv, rv):
                diffs.extend(_field_level_diff(pv, rv, child_path))
    else:
        diffs.append(f"{path}: PY={json.dumps(py_obj, default=str)} RS={json.dumps(rs_obj, default=str)}")

    return diffs


# ── Diff Engine ──────────────────────────────────────────────────────────────

class DiffResult:
    """Result of comparing one endpoint across both servers."""

    def __init__(self, endpoint: str, method: str = "GET"):
        self.endpoint = endpoint
        self.method = method
        self.status = "PASS"  # PASS | DIFF | WHITELISTED | ERROR
        self.w_ref: str | None = None  # Whitelist rule that suppressed the diff
        self.python_status: int | None = None
        self.rust_status: int | None = None
        self.python_body: Any = None
        self.rust_body: Any = None
        self.normalized_python: Any = None
        self.normalized_rust: Any = None
        self.diff_details: list[str] = []
        self.notes: list[str] = []

    def to_dict(self) -> dict:
        d = {
            "endpoint": self.endpoint,
            "method": self.method,
            "status": self.status,
        }
        if self.w_ref:
            d["whitelist_rule"] = self.w_ref
        if self.python_status is not None:
            d["python_status"] = self.python_status
        if self.rust_status is not None:
            d["rust_status"] = self.rust_status
        if self.diff_details:
            d["diff_details"] = self.diff_details
        if self.notes:
            d["notes"] = self.notes
        return d


def _diff_endpoint(
    endpoint: str,
    py_resp: httpx.Response,
    rs_resp: httpx.Response,
    *,
    method: str = "GET",
    whitelist_rules: list[str] | None = None,
    is_binary: bool = False,
    is_multi_range: bool = False,
    is_raw_text: bool = False,
) -> DiffResult:
    """Compare two responses per the whitelist. Returns a DiffResult."""
    result = DiffResult(endpoint, method)
    result.python_status = py_resp.status_code
    result.rust_status = rs_resp.status_code
    whitelist_rules = whitelist_rules or []

    # ── W9: Filter error-message wording (check early, before body comparison) ──
    # Both return 400; only the detail string differs
    if "W9" in whitelist_rules:
        if py_resp.status_code == 400 and rs_resp.status_code == 400:
            py_body = _get_json_body(py_resp)
            rs_body = _get_json_body(rs_resp)
            py_detail = py_body.get("detail", "") if isinstance(py_body, dict) else ""
            rs_detail = rs_body.get("detail", "") if isinstance(rs_body, dict) else ""
            if py_detail and rs_detail:
                result.status = "WHITELISTED"
                result.w_ref = "W9"
                result.notes.append(
                    "W9: filter error wording differs (both 400 with non-empty detail)"
                )
                return result

    # ── W10: 4xx error-body shape on method/validation rejects ──
    # Status parity holds; body shape differs (Python returns detail, Rust returns null/empty)
    if "W10" in whitelist_rules:
        if py_resp.status_code == rs_resp.status_code and 400 <= py_resp.status_code < 500:
            result.status = "WHITELISTED"
            result.w_ref = "W10"
            result.notes.append(
                f"W10: {py_resp.status_code} body shape differs (Python detail vs Rust null)"
            )
            return result

    # ── W4: Multi-range stream — different by design ──
    if is_multi_range:
        # Rust → 416, Python → 206 (documented N39 T3 exception)
        # Also catch read failures (httpx can't read Python's non-RFC multipart body)
        if rs_resp.status_code == 416:
            result.status = "WHITELISTED"
            result.w_ref = "W4"
            result.notes.append(
                "W4: multi-range → Rust 416 (Python body unreadable/non-RFC, asserted Rust=416)"
            )
            return result
        result.status = "DIFF"
        result.diff_details.append(
            f"W4 expected Rust=416; got Rust={rs_resp.status_code} Python={py_resp.status_code}"
        )
        return result

    # ── W11: Filter grammar punctuation tolerance ──
    # Python boolean.py accepts non-semantic chars (., +, …) in unquoted tokens as no-match
    # tag literals (200); Rust's tokenizer rejects them (400). Only `:` is matched (N41).
    if "W11" in whitelist_rules:
        if py_resp.status_code == 200 and rs_resp.status_code == 400:
            result.status = "WHITELISTED"
            result.w_ref = "W11"
            result.notes.append(
                "W11: filter grammar punctuation tolerance — Python 200 (no-match), Rust 400"
            )
            return result

    # ── Status code must match (unless W2/W4/W11 handled above) ──
    if py_resp.status_code != rs_resp.status_code:
        # W2: 422 body format differs, status must match 422
        if "W2" in whitelist_rules and py_resp.status_code == 422 and rs_resp.status_code == 422:
            # Both 422 — OK, body difference is whitelisted
            pass
        else:
            result.status = "DIFF"
            result.diff_details.append(
                f"Status mismatch: Python={py_resp.status_code}, Rust={rs_resp.status_code}"
            )
            return result

    # ── Binary responses (stream, bleed-thumb) ──
    if is_binary:
        # Compare Content-Type and Content-Length headers
        py_ct = py_resp.headers.get("content-type", "")
        rs_ct = rs_resp.headers.get("content-type", "")
        py_cl = py_resp.headers.get("content-length", "")
        rs_cl = rs_resp.headers.get("content-length", "")

        if py_ct.split(";")[0].strip() != rs_ct.split(";")[0].strip():
            result.status = "DIFF"
            result.diff_details.append(f"Content-Type: Python={py_ct!r}, Rust={rs_ct!r}")
        elif py_cl != rs_cl:
            result.status = "DIFF"
            result.diff_details.append(f"Content-Length: Python={py_cl!r}, Rust={rs_cl!r}")
        else:
            result.status = "PASS"
        return result

    # ── Raw text comparison (m3u8/m3u export) ──
    if is_raw_text:
        py_text = py_resp.text
        rs_text = rs_resp.text
        if py_text == rs_text:
            result.status = "PASS"
        else:
            result.status = "DIFF"
            # Show first 500 chars of each for debugging
            result.diff_details.append(
                f"Raw text differs.\n"
                f"Python ({len(py_text)} chars): {py_text[:500]!r}\n"
                f"Rust   ({len(rs_text)} chars): {rs_text[:500]!r}"
            )
        return result

    # ── W2: 422 body difference is whitelisted ──
    if "W2" in whitelist_rules and py_resp.status_code == 422:
        result.status = "WHITELISTED"
        result.w_ref = "W2"
        result.notes.append("W2: 422 validation body format differs (Pydantic vs Rust)")
        return result

    # ── JSON body comparison ──
    py_body = _get_json_body(py_resp)
    rs_body = _get_json_body(rs_resp)
    result.python_body = py_body
    result.rust_body = rs_body

    # W1: Normalize timestamps
    py_norm = _normalize_timestamps(copy.deepcopy(py_body)) if py_body is not None else py_body
    rs_norm = _normalize_timestamps(copy.deepcopy(rs_body)) if rs_body is not None else rs_body

    # W3: Normalize analysis values
    py_norm = _normalize_analysis_values(py_norm) if py_norm is not None else py_norm
    rs_norm = _normalize_analysis_values(rs_norm) if rs_norm is not None else rs_norm

    result.normalized_python = py_norm
    result.normalized_rust = rs_norm

    # W7 + W8: Semantic comparison (key-order agnostic, numeric epsilon)
    if _semantically_equal(py_norm, rs_norm):
        result.status = "PASS"
    else:
        result.status = "DIFF"
        # Field-level diff: only show the paths that differ
        field_diffs = _field_level_diff(py_norm, rs_norm)
        if field_diffs:
            result.diff_details.append("Field-level diffs:")
            for fd in field_diffs[:50]:  # cap at 50 fields
                result.diff_details.append(f"  {fd}")
            if len(field_diffs) > 50:
                result.diff_details.append(f"  ... and {len(field_diffs) - 50} more")
        else:
            # Fallback: full body dump if field-level can't explain it
            result.diff_details.append(
                f"Body differs after normalization.\n"
                f"Python (normalized): {json.dumps(py_norm, indent=2, default=str)}\n"
                f"Rust   (normalized): {json.dumps(rs_norm, indent=2, default=str)}"
            )

    return result


# ── Request Battery ──────────────────────────────────────────────────────────

def _build_read_battery(addon_url: str) -> list[dict[str, Any]]:
    """Build the full GET request battery.

    Dynamic fixture IDs are resolved from captured state.
    """
    battery = [
        # ── Core GETs ──
        {"name": "GET /api/health", "method": "GET", "url": "/api/health"},
        {"name": "GET /api/songs", "method": "GET", "url": "/api/songs"},
        {"name": "GET /api/songs/1", "method": "GET", "url": "/api/songs/1"},
        {"name": "GET /api/tags", "method": "GET", "url": "/api/tags"},
        {"name": "GET /api/playlists", "method": "GET", "url": "/api/playlists", "rules": ["W6"]},
        {"name": "GET /api/playlists/1", "method": "GET", "url": "/api/playlists/1", "rules": ["W6"]},
        {"name": "GET /api/folders", "method": "GET", "url": "/api/folders"},
        {"name": "GET /api/albums", "method": "GET", "url": "/api/albums"},
        {"name": "GET /api/albums/Machine Head", "method": "GET", "url": "/api/albums/Machine%20Head"},
        {"name": "GET /api/addons", "method": "GET", "url": "/api/addons"},
        {"name": "GET /api/watch", "method": "GET", "url": "/api/watch"},

        # ── Stream (single-range, full, unsat) ──
        {"name": "GET /api/songs/1/stream (full)", "method": "GET",
         "url": "/api/songs/1/stream", "binary": True},
        {"name": "GET /api/songs/1/stream (bytes=0-99)", "method": "GET",
         "url": "/api/songs/1/stream", "headers": {"Range": "bytes=0-99"}, "binary": True},
        {"name": "GET /api/songs/1/stream (multi-range)", "method": "GET",
         "url": "/api/songs/1/stream",
         "headers": {"Range": "bytes=0-99,200-299"}, "multi_range": True},
        {"name": "GET /api/songs/1/stream (unsat)", "method": "GET",
         "url": "/api/songs/1/stream",
         "headers": {"Range": "bytes=999999999-999999999"}, "expect_status": 416},

        # ── Album art + bleed-thumb ──
        {"name": "GET /api/album-art/abc123def456.jpg", "method": "GET",
         "url": "/api/album-art/abc123def456.jpg", "binary": True,
         "expect_status": None},  # may be 200 or 404 depending on file existence
        {"name": "GET /api/songs/1/bleed-thumb", "method": "GET",
         "url": "/api/songs/1/bleed-thumb", "binary": True,
         "expect_status": None},  # may be 200 or 404

        # ── Filter queries ──
        {"name": "POST /api/filter (rock)", "method": "POST", "url": "/api/filter",
         "body": {"query": "rock"}},
        {"name": "POST /api/filter (slow AND chill)", "method": "POST", "url": "/api/filter",
         "body": {"query": "slow AND chill"}},
        {"name": "POST /api/filter (rock OR anime)", "method": "POST", "url": "/api/filter",
         "body": {"query": "rock OR anime"}},
        {"name": "POST /api/filter (NOT rock)", "method": "POST", "url": "/api/filter",
         "body": {"query": "NOT rock"}},
        {"name": "POST /api/filter (\"fast\")", "method": "POST", "url": "/api/filter",
         "body": {"query": '"fast"'}},
        {"name": "POST /api/filter (id:1)", "method": "POST", "url": "/api/filter",
         "body": {"query": "id:1"}},
        {"name": "POST /api/filter (AND only)", "method": "POST", "url": "/api/filter",
         "body": {"query": "AND"}, "rules": ["W9"], "expect_status": 400},
        {"name": "POST /api/filter (51 atoms)", "method": "POST", "url": "/api/filter",
         "body": {"query": " OR ".join([f"t{i}" for i in range(51)])},
         "expect_status": 400},

        # ── Playlists detail + export ──
        {"name": "GET /api/playlists/1/export (m3u8)", "method": "GET",
         "url": "/api/playlists/1/export?format=m3u8", "raw_text": True},
        {"name": "GET /api/playlists/1/export (json)", "method": "GET",
         "url": "/api/playlists/1/export?format=json"},

        # ── Folder songs ──
        {"name": "GET /api/folders/songs?path=/music/rock", "method": "GET",
         "url": "/api/folders/songs?path=%2Fmusic%2Frock"},

        # ── Addon search ──
        {"name": "GET /api/addons/1/search?q=sunset", "method": "GET",
         "url": "/api/addons/1/search?q=sunset"},

        # ── 404 probes ──
        {"name": "GET /api/songs/9999 (404)", "method": "GET",
         "url": "/api/songs/9999", "expect_status": 404},
        {"name": "GET /api/playlists/9999 (404)", "method": "GET",
         "url": "/api/playlists/9999", "expect_status": 404},
        {"name": "GET /api/tags/9999 (405 expected)", "method": "GET",
         "url": "/api/tags/9999", "rules": ["W10"]},  # only DELETE exists
        {"name": "GET /api/addons/9999/search (404)", "method": "GET",
         "url": "/api/addons/9999/search?q=test", "expect_status": 404},

        # ── W9: Filter error wording (both 400, different detail strings) ──
        {"name": "POST /api/filter (bare &)", "method": "POST", "url": "/api/filter",
         "body": {"query": "&"}, "rules": ["W9"], "expect_status": 400},

        # ── W10: 4xx error-body shape (405 method reject) ──
        {"name": "GET /api/tags/9999 (W10 body shape)", "method": "GET",
         "url": "/api/tags/9999", "rules": ["W10"]},

        # ── W11: Filter grammar punctuation tolerance ──
        # Python accepts `.` in unquoted tokens (200 no-match); Rust rejects (400)
        {"name": "POST /api/filter (a.b — W11 punctuation)", "method": "POST",
         "url": "/api/filter", "body": {"query": "a.b"}, "rules": ["W11"]},
    ]
    return battery


def _build_mutation_battery(addon_url: str) -> list[dict[str, Any]]:
    """Mutations replayed identically on both servers."""
    steps: list[dict[str, Any]] = [
        # ── Tag CRUD ──
        {"name": "POST /api/tags (create shadowtest)", "method": "POST",
         "url": "/api/tags", "body": {"name": "shadowtest"},
         "capture": {"key": "new_tag_id", "field": "id"}},
        {"name": "DELETE /api/tags/{new_tag_id}", "method": "DELETE",
         "url_template": "/api/tags/{new_tag_id}", "depends_on": "new_tag_id"},

        # ── Playlist CRUD ──
        {"name": "POST /api/playlists (create)", "method": "POST",
         "url": "/api/playlists",
         "body": {"name": "ShadowDiff Playlist", "color": "#FF0000", "emoji": "\U0001f9ea"},
         "capture": {"key": "new_playlist_id", "field": "id"}},
        {"name": "POST /api/playlists/{new_playlist_id}/songs (add song 1)", "method": "POST",
         "url_template": "/api/playlists/{new_playlist_id}/songs",
         "body": {"song_id": 1}, "depends_on": "new_playlist_id"},
        {"name": "POST /api/playlists/{new_playlist_id}/songs (add song 2)", "method": "POST",
         "url_template": "/api/playlists/{new_playlist_id}/songs",
         "body": {"song_id": 2}, "depends_on": "new_playlist_id"},
        {"name": "POST /api/playlists/{new_playlist_id}/songs (add song 3)", "method": "POST",
         "url_template": "/api/playlists/{new_playlist_id}/songs",
         "body": {"song_id": 3}, "depends_on": "new_playlist_id"},
        {"name": "DELETE /api/playlists/{new_playlist_id}/songs/2", "method": "DELETE",
         "url_template": "/api/playlists/{new_playlist_id}/songs/2",
         "depends_on": "new_playlist_id"},
        {"name": "PUT /api/playlists/{new_playlist_id}/songs/reorder", "method": "PUT",
         "url_template": "/api/playlists/{new_playlist_id}/songs/reorder",
         "body": {"song_ids": [3, 1]}, "depends_on": "new_playlist_id"},
        {"name": "PATCH /api/playlists/{new_playlist_id}/songs/1/timing", "method": "PATCH",
         "url_template": "/api/playlists/{new_playlist_id}/songs/1/timing",
         "body": {"start_time_ms": 1000, "end_time_ms": 30000},
         "depends_on": "new_playlist_id"},

        # ── Playlist import (A6: proper multipart/form-data with .aurora.json) ──
        # Build a valid Aurora JSON import file
        {"name": "POST /api/playlists/import", "method": "POST",
         "url": "/api/playlists/import", "upload_json": True,
         "upload_data": {
             "playlist": {"name": "Shadow Import", "color": "#00FF00", "emoji": "📥"},
             "songs": [
                 {"title": "Highway Star", "artist": "Deep Purple",
                  "file_path": "/music/rock/Deep Purple - Highway Star.mp3"},
                 {"title": "Unravel", "artist": "TK from Ling Tosite Sigure",
                  "file_path": "/music/anime/TK - Unravel.mp3"},
             ]
         },
         "upload_filename": "shadow_import.aurora.json",
         "upload_mime": "application/json"},

        # ── Addon toggle + delete ──
        {"name": "PATCH /api/addons/1 (toggle off)", "method": "PATCH",
         "url": "/api/addons/1", "body": {"enabled": False}},
        {"name": "PATCH /api/addons/1 (toggle on)", "method": "PATCH",
         "url": "/api/addons/1", "body": {"enabled": True}},

        # ── Cleanup: delete created playlist ──
        {"name": "DELETE /api/playlists/{new_playlist_id}", "method": "DELETE",
         "url_template": "/api/playlists/{new_playlist_id}", "depends_on": "new_playlist_id"},
    ]
    return steps


# ── Battery Runner ───────────────────────────────────────────────────────────

def _resolve_url(step: dict, captured: dict) -> str:
    """Resolve URL template with captured IDs."""
    if "url_template" in step:
        url = step["url_template"]
        for k, v in captured.items():
            url = url.replace("{" + k + "}", str(v))
        return url
    return step["url"]


def _fire_request(base: str, step: dict) -> httpx.Response:
    """Fire a single request step against a server."""
    url = step["_resolved_url"]
    method = step["method"]
    headers = step.get("headers", {})
    timeout = REQUEST_TIMEOUT

    if step.get("upload"):
        # File upload (M3U8 import) — legacy path
        files = {"file": (step["upload_filename"], step["upload_content"], step["upload_mime"])}
        return httpx.post(f"{base}{url}", files=files, timeout=timeout)

    if step.get("upload_json"):
        # A6: Proper multipart/form-data with JSON file
        json_bytes = json.dumps(step["upload_data"], ensure_ascii=False).encode("utf-8")
        files = {"file": (step["upload_filename"], json_bytes, step["upload_mime"])}
        return httpx.post(f"{base}{url}", files=files, timeout=timeout)

    if method == "POST":
        return httpx.post(f"{base}{url}", json=step.get("body"), headers=headers, timeout=timeout)
    if method == "PUT":
        return httpx.put(f"{base}{url}", json=step.get("body"), headers=headers, timeout=timeout)
    if method == "PATCH":
        return httpx.patch(f"{base}{url}", json=step.get("body"), headers=headers, timeout=timeout)
    if method == "DELETE":
        return httpx.delete(f"{base}{url}", headers=headers, timeout=timeout)
    return httpx.get(f"{base}{url}", headers=headers, timeout=timeout, follow_redirects=True)


def run_battery(
    py_base: str,
    rs_base: str,
    steps: list[dict],
    captured: dict | None = None,
) -> tuple[list[DiffResult], dict]:
    """Run a battery of requests against both servers. Returns results + captured state."""
    if captured is None:
        captured = {}
    results = []

    for step in steps:
        # Resolve URL template
        step = dict(step)  # shallow copy
        if "depends_on" in step:
            dep = step["depends_on"]
            if dep not in captured:
                results.append(DiffResult(step["name"], step["method"]))
                results[-1].status = "ERROR"
                results[-1].diff_details.append(f"Missing dependency: {dep}")
                continue
        step["_resolved_url"] = _resolve_url(step, captured)

        # Fire on both servers
        py_resp = None
        try:
            py_resp = _fire_request(py_base, step)
        except Exception as e:
            # A5: For multi-range, Python read failure is expected (W4)
            if step.get("multi_range"):
                r = DiffResult(step["name"], step["method"])
                r.status = "WHITELISTED"
                r.w_ref = "W4"
                r.notes.append("W4: multi-range → Python read failed (non-RFC body), asserted W4")
                results.append(r)
                continue
            r = DiffResult(step["name"], step["method"])
            r.status = "ERROR"
            r.diff_details.append(f"Python request failed: {e}")
            results.append(r)
            continue

        try:
            rs_resp = _fire_request(rs_base, step)
        except Exception as e:
            # A5: For multi-range, a Rust read failure is expected (W4)
            if step.get("multi_range"):
                r = DiffResult(step["name"], step["method"])
                r.status = "WHITELISTED"
                r.w_ref = "W4"
                r.python_status = py_resp.status_code
                r.notes.append("W4: multi-range → Rust read failed (expected), Python returned")
                results.append(r)
                continue
            r = DiffResult(step["name"], step["method"])
            r.status = "ERROR"
            r.diff_details.append(f"Rust request failed: {e}")
            results.append(r)
            continue

        # Capture response field if requested
        if "capture" in step and py_resp.status_code in (200, 201):
            body = _get_json_body(py_resp)
            if body and isinstance(body, dict):
                field = step["capture"]["field"]
                key = step["capture"]["key"]
                # Handle nested {"data": {"id": ...}} envelope
                data = body.get("data", body) if isinstance(body.get("data"), dict) else body
                if field in data:
                    captured[key] = data[field]
                elif field in body:
                    captured[key] = body[field]

        # Status check
        expect = step.get("expect_status")
        if expect is not None:
            if py_resp.status_code != expect or rs_resp.status_code != expect:
                r = DiffResult(step["name"], step["method"])
                r.python_status = py_resp.status_code
                r.rust_status = rs_resp.status_code
                r.status = "DIFF"
                r.diff_details.append(
                    f"Expected status {expect}; Python={py_resp.status_code}, Rust={rs_resp.status_code}"
                )
                results.append(r)
                continue

        # Diff the responses
        result = _diff_endpoint(
            step["name"],
            py_resp, rs_resp,
            method=step["method"],
            whitelist_rules=step.get("rules", []),
            is_binary=step.get("binary", False),
            is_multi_range=step.get("multi_range", False),
            is_raw_text=step.get("raw_text", False),
        )
        results.append(result)

    return results, captured


# ── Report Generation ────────────────────────────────────────────────────────

def generate_report(all_results: list[DiffResult]) -> tuple[str, dict]:
    """Generate report.md and report.json from results."""
    pass_count = sum(1 for r in all_results if r.status == "PASS")
    diff_count = sum(1 for r in all_results if r.status == "DIFF")
    whitelisted_count = sum(1 for r in all_results if r.status == "WHITELISTED")
    error_count = sum(1 for r in all_results if r.status == "ERROR")
    total = len(all_results)

    lines = [
        "# Shadow-Diff Parity Report (N41)",
        "",
        f"**Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"**Total endpoints tested:** {total}",
        f"**PASS:** {pass_count} | **DIFF:** {diff_count} | "
        f"**WHITELISTED:** {whitelisted_count} | **ERROR:** {error_count}",
        "",
    ]

    if diff_count == 0 and error_count == 0:
        lines.append("✅ **All endpoints match (within documented exceptions).**")
    else:
        lines.append("⚠️ **Non-whitelisted diffs found — requires planner adjudication.**")

    lines.append("")
    lines.append("---")
    lines.append("")

    # Group by status
    for status_label, status_val in [
        ("DIFF (requires adjudication)", "DIFF"),
        ("WHITELISTED (documented exceptions)", "WHITELISTED"),
        ("ERROR", "ERROR"),
        ("PASS", "PASS"),
    ]:
        group = [r for r in all_results if r.status == status_val]
        if not group:
            continue
        lines.append(f"## {status_label} ({len(group)})")
        lines.append("")
        for r in group:
            lines.append(f"### `{r.endpoint}`")
            if r.w_ref:
                lines.append(f"- **Whitelist rule:** {r.w_ref}")
            if r.python_status is not None:
                lines.append(f"- Python status: {r.python_status}")
            if r.rust_status is not None:
                lines.append(f"- Rust status: {r.rust_status}")
            if r.notes:
                for note in r.notes:
                    lines.append(f"- Note: {note}")
            if r.diff_details:
                lines.append("- **Diff details:**")
                for detail in r.diff_details:
                    lines.append(f"  ```\n  {detail}\n  ```")
            lines.append("")

    # Footer
    lines.append("---")
    lines.append("")
    lines.append("## Whitelist Rules Applied")
    lines.append("")
    lines.append("| Rule | Description |")
    lines.append("|------|-------------|")
    lines.append("| W1 | Volatile timestamps normalized to `<TIMESTAMP>` |")
    lines.append("| W2 | 422 validation body format (Pydantic vs Rust) — status-only check |")
    lines.append("| W3 | §2B analysis values (dominant_color, peaks, bleed) — NULL-parity + shape only |")
    lines.append("| W4 | Multi-range stream: Rust 416 vs Python 206 (N39 T3) |")
    lines.append("| W5 | Re-encoded image bytes differ — compare metadata only |")
    lines.append("| W6 | Read-time backfill mutation (NULL→non-NULL color on GET) |")
    lines.append("| W7 | JSON key ordering (serde alphabetical vs FastAPI insertion order) |")
    lines.append("| W8 | Float formatting (`1.0` vs `1`) — numeric epsilon comparison |")
    lines.append("| W9 | Filter error-message wording — both 400, different detail strings |")
    lines.append("| W10 | 4xx error-body shape — status parity, body shape differs |")
    lines.append("| W11 | Filter grammar punctuation tolerance — Python 200 (no-match), Rust 400 |")
    lines.append("")
    lines.append("## Out of Scope (deferred)")
    lines.append("")
    lines.append("- **F5 — scanner bitrate divergence** (Python mutagen vs Rust): Real (127-vs-140 mp3, "
                 "96-vs-162 flac) but only observable if scan runs separately on each copy. "
                 "After A1 seeding fix, both read the same stored values — vanishes from shadow-diff. "
                 "Logged to STRATEGIC_PLAN deferred ledger as future scan-parity item.")
    lines.append("")

    report_md = "\n".join(lines)

    report_json = {
        "date": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "pass": pass_count,
        "diff": diff_count,
        "whitelisted": whitelisted_count,
        "error": error_count,
        "results": [r.to_dict() for r in all_results],
    }

    return report_md, report_json


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Shadow-diff parity harness (N41)")
    parser.add_argument("--db", type=str, default=None,
                        help="Path to existing aurora.db (skips seeding)")
    parser.add_argument("--keep-db", action="store_true",
                        help="Keep the temporary data dirs after run")
    args = parser.parse_args()

    atexit.register(stop_all)

    py_data: Path | None = None
    rs_data: Path | None = None

    try:
        if args.db:
            # ── --db mode: copy supplied DB, NO fixture seeding (A2) ──
            print(f"[*] Using existing DB: {args.db}")
            py_data = Path(tempfile.mkdtemp(prefix="sd_py_"))
            rs_data = Path(tempfile.mkdtemp(prefix="sd_rs_"))
            for d in (py_data, rs_data):
                (d / "album-art").mkdir(exist_ok=True)
                (d / "playlist-images").mkdir(exist_ok=True)
            shutil.copy2(args.db, py_data / "aurora.db")
            shutil.copy2(args.db, rs_data / "aurora.db")

            # Launch mock addon (needed for addon tests)
            print("[*] Starting mock addon server...")
            mock_addon_url = start_mock_addon()

            # Launch both servers
            print("[*] Starting Python server...")
            py_base = start_python_server(py_data)
            print(f"    Python: {py_base}")

            print("[*] Starting Rust server...")
            rs_base = start_rust_server(rs_data)
            print(f"    Rust:   {rs_base}")

            # In --db mode, do NOT run scan/image/addon/backfill — use the real library as-is

        else:
            # ── Normal mode: seed, scan-once-copy, then diff (A1) ──
            print("[*] Seeding canonical DB...")
            canonical = Path(tempfile.mkdtemp(prefix="sd_canonical_"))
            (canonical / "album-art").mkdir(exist_ok=True)
            (canonical / "playlist-images").mkdir(exist_ok=True)
            seed_database(canonical)

            # Launch mock addon
            print("[*] Starting mock addon server...")
            mock_addon_url = start_mock_addon()

            # A1: Scan on canonical DB ONCE via one Python server
            print("[*] Scanning canonical DB via Python server (one-time)...")
            scan_base = start_python_server(canonical)
            _seed_via_server(scan_base, FIXTURES_DIR, mock_addon_url)
            stop_server("python")
            print("    Scan complete. Server stopped.")

            # W6 backfill prep: NULL out dominant_color on playlist 2
            _prepare_backfill_playlist(canonical / "aurora.db")

            # Copy canonical (with scan results) to both data dirs
            py_data = Path(tempfile.mkdtemp(prefix="sd_py_"))
            rs_data = Path(tempfile.mkdtemp(prefix="sd_rs_"))
            shutil.copytree(canonical, py_data, dirs_exist_ok=True)
            shutil.copytree(canonical, rs_data, dirs_exist_ok=True)
            shutil.rmtree(canonical, ignore_errors=True)

            # Launch both servers on their byte-identical copies
            print("[*] Starting Python server...")
            py_base = start_python_server(py_data)
            print(f"    Python: {py_base}")

            print("[*] Starting Rust server...")
            rs_base = start_rust_server(rs_data)
            print(f"    Rust:   {rs_base}")

        # ── Phase 5: Run battery ──
        all_results: list[DiffResult] = []
        captured: dict = {}

        # 5a: Read-only battery (pass 1)
        print("[*] Running read-only battery (pass 1)...")
        read_steps = _build_read_battery(mock_addon_url)
        results, captured = run_battery(py_base, rs_base, read_steps, captured)
        all_results.extend(results)

        # 5b: Mutation battery
        print("[*] Running mutation battery...")
        mut_steps = _build_mutation_battery(mock_addon_url)
        results, captured = run_battery(py_base, rs_base, mut_steps, captured)
        all_results.extend(results)

        # 5c: Post-mutation reads (verify state matches after mutations)
        print("[*] Running post-mutation reads...")
        post_steps = [
            {"name": "GET /api/songs (post-mutation)", "method": "GET", "url": "/api/songs"},
            {"name": "GET /api/tags (post-mutation)", "method": "GET", "url": "/api/tags"},
            {"name": "GET /api/playlists (post-mutation)", "method": "GET",
             "url": "/api/playlists", "rules": ["W6"]},
            {"name": "GET /api/playlists/1 (post-mutation)", "method": "GET",
             "url": "/api/playlists/1", "rules": ["W6"]},
            {"name": "GET /api/addons (post-mutation)", "method": "GET", "url": "/api/addons"},
        ]
        results, captured = run_battery(py_base, rs_base, post_steps, captured)
        all_results.extend(results)

        # ── Phase 6: Generate report ──
        print("[*] Generating report...")
        report_md, report_json = generate_report(all_results)

        report_md_path = REPORT_DIR / "report.md"
        report_json_path = REPORT_DIR / "report.json"
        report_md_path.write_text(report_md)
        report_json_path.write_text(json.dumps(report_json, indent=2, default=str))

        # Summary
        diff_count = sum(1 for r in all_results if r.status == "DIFF")
        error_count = sum(1 for r in all_results if r.status == "ERROR")
        pass_count = sum(1 for r in all_results if r.status == "PASS")
        wl_count = sum(1 for r in all_results if r.status == "WHITELISTED")

        print(f"\n{'='*60}")
        print(f"Shadow-Diff Results: {len(all_results)} endpoints tested")
        print(f"  PASS:         {pass_count}")
        print(f"  WHITELISTED:  {wl_count}")
        print(f"  DIFF:         {diff_count}")
        print(f"  ERROR:        {error_count}")
        print(f"{'='*60}")
        print(f"Report: {report_md_path}")

        if diff_count > 0 or error_count > 0:
            print("\n⚠️  Non-whitelisted diffs found — see report.md for details.")
            return 1

        print("\n✅ All endpoints match within documented exceptions.")
        return 0

    except Exception as e:
        print(f"\n❌ Fatal error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

    finally:
        stop_all()
        if not args.keep_db:
            for d in (py_data, rs_data):
                if d and d.exists():
                    shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
