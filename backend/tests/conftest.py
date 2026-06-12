"""Golden parity test suite — conftest.

Sets up a reproducible test environment:
- Temp directory for AURORA_DATA_DIR (isolated from real user data)
- Seeded SQLite DB with deterministic test data  
- FastAPI TestClient (no server needed)
- Caches disabled for deterministic responses
- Fixed timestamps throughout

Architecture note: We set AURORA_DATA_DIR *before* any app module import,
then seed the DB at the standard path (aurora.db). The app's lifespan
init_db() creates tables with IF NOT EXISTS, so our seeded data survives.
"""
import json
import os
import shutil
import sqlite3
import tempfile
from pathlib import Path

import atexit
import pytest
from fastapi.testclient import TestClient

# ── Set up isolated data directory BEFORE any app imports ──────────────────
_TEST_DATA_DIR = Path(tempfile.mkdtemp(prefix="aurora_test_"))
os.environ["AURORA_DATA_DIR"] = str(_TEST_DATA_DIR)

# Clean up temp directory on process exit
atexit.register(shutil.rmtree, str(_TEST_DATA_DIR), ignore_errors=True)

# Create directory structure that _migrate_to_data_dir expects
_TEST_DATA_DIR.mkdir(parents=True, exist_ok=True)
(_TEST_DATA_DIR / "album-art").mkdir(exist_ok=True)
(_TEST_DATA_DIR / "playlist-images").mkdir(exist_ok=True)

# ── Fixed timestamps for deterministic output ──────────────────────────────
TS_CREATE = "2025-06-01T12:00:00Z"
TS_CREATE_2 = "2025-06-01T12:01:00Z"
TS_UPDATE = "2025-06-01T12:30:00Z"

# ── Seed data ───────────────────────────────────────────────────────────────

SEED_SONGS = [
    {
        "id": 1,
        "title": "Highway Star",
        "artist": "Deep Purple",
        "album": "Machine Head",
        "duration": 367,
        "file_path": "/music/rock/Deep Purple - Highway Star.mp3",
        "file_format": "mp3",
        "album_art_path": "abc123def456.jpg",
        "source": "local_scan",
        "bitrate": 320000,
        "sample_rate": 44100,
        "bit_depth": 16,
        "file_size": 8812345,
        "waveform_peaks": json.dumps([0.1, 0.25, 0.5, 0.75, 0.9, 0.85, 0.6, 0.3, 0.1, 0.05]),
        "dominant_color": "#E63946",
        "dominant_color_2": "#457B9D",
        "replaygain_track_gain": -8.5,
        "replaygain_track_peak": 0.95,
        "replaygain_album_gain": -7.2,
        "replaygain_album_peak": 0.98,
        "artists": json.dumps(["Deep Purple"]),
        "featured_artists": None,
        "created_at": TS_CREATE,
        "updated_at": TS_UPDATE,
    },
    {
        "id": 2,
        "title": "Chill Vibes",
        "artist": "LoFi Girl",
        "album": None,
        "duration": 180,
        "file_path": None,
        "file_format": None,
        "album_art_path": None,
        "source": "manual",
        "bitrate": None,
        "sample_rate": None,
        "bit_depth": None,
        "file_size": None,
        "waveform_peaks": None,
        "dominant_color": None,
        "dominant_color_2": None,
        "replaygain_track_gain": None,
        "replaygain_track_peak": None,
        "replaygain_album_gain": None,
        "replaygain_album_peak": None,
        "artists": None,
        "featured_artists": None,
        "created_at": TS_CREATE_2,
        "updated_at": TS_CREATE_2,
    },
    {
        "id": 3,
        "title": "Unravel",
        "artist": "TK from Ling Tosite Sigure",
        "album": "Tokyo Ghoul OST",
        "duration": 240,
        "file_path": "/music/anime/TK - Unravel.mp3",
        "file_format": "mp3",
        "album_art_path": None,
        "source": "local_scan",
        "bitrate": 256000,
        "sample_rate": 44100,
        "bit_depth": 16,
        "file_size": 4801234,
        "waveform_peaks": json.dumps([0.05, 0.15, 0.35, 0.55, 0.8, 0.95, 0.7, 0.4, 0.2, 0.08]),
        "dominant_color": "#2A9D8F",
        "dominant_color_2": "#E9C46A",
        "replaygain_track_gain": -6.0,
        "replaygain_track_peak": 0.88,
        "replaygain_album_gain": -5.5,
        "replaygain_album_peak": 0.92,
        "artists": json.dumps(["TK from Ling Tosite Sigure"]),
        "featured_artists": json.dumps([]),
        "created_at": TS_CREATE,
        "updated_at": TS_CREATE,
    },
]

SEED_TAGS = [
    {"id": 1, "name": "rock", "created_at": TS_CREATE},
    {"id": 2, "name": "fast", "created_at": TS_CREATE},
    {"id": 3, "name": "slow", "created_at": TS_CREATE_2},
    {"id": 4, "name": "chill", "created_at": TS_CREATE_2},
    {"id": 5, "name": "anime", "created_at": TS_CREATE},
    {"id": 6, "name": "opening", "created_at": TS_CREATE},
]

SEED_SONG_TAGS = {
    1: [1, 2],     # Highway Star: rock, fast
    2: [3, 4],     # Chill Vibes: slow, chill
    3: [5, 6],     # Unravel: anime, opening
}

SEED_PLAYLISTS = [
    {
        "id": 1, "name": "Rock Classics", "color": "#E63946", "emoji": "🎸",
        "image_url": None, "crossfade_enabled": None, "crossfade_duration_s": None,
        "created_at": TS_CREATE, "updated_at": TS_CREATE,
    },
    {
        "id": 2, "name": "Lo-Fi Study", "color": "#457B9D", "emoji": "📚",
        "image_url": None, "crossfade_enabled": 1, "crossfade_duration_s": 8,
        "created_at": TS_CREATE_2, "updated_at": TS_CREATE_2,
    },
    {
        "id": 3, "name": "Anime", "color": "#2A9D8F", "emoji": "🎌",
        "image_url": None, "crossfade_enabled": None, "crossfade_duration_s": None,
        "created_at": TS_CREATE, "updated_at": TS_CREATE,
    },
]

SEED_PLAYLIST_SONGS = [
    (1, 1, 0, 0, 0, TS_CREATE),
    (2, 2, 0, 0, 0, TS_CREATE_2),
    (3, 3, 0, 0, 0, TS_CREATE),
]

SEED_WATCHED_FOLDERS = [
    {"id": 1, "folder_path": "/music/rock", "is_active": 1,
     "last_scan_at": None, "created_at": TS_CREATE},
]


def seed_database() -> None:
    """Seed the standard aurora.db with deterministic test data.

    Called BEFORE app import. The app's lifespan init_db() creates tables
    with IF NOT EXISTS, so pre-seeded data survives.
    """
    db_path = _TEST_DATA_DIR / "aurora.db"
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    # Replicate INIT_SQL to create all tables
    from app.database import INIT_SQL
    conn.executescript(INIT_SQL)

    # Run migrations to stamp user_version
    from app.database import MIGRATIONS
    for version, stmts in MIGRATIONS:
        for stmt in stmts:
            try:
                conn.execute(stmt)
            except sqlite3.OperationalError:
                pass
        conn.execute(f"PRAGMA user_version = {version}")

    # ── Insert data ──────────────────────────────────────────────────────
    cols = (
        "id, title, artist, album, duration, file_path, file_format, "
        "album_art_path, source, bitrate, sample_rate, bit_depth, file_size, "
        "waveform_peaks, dominant_color, dominant_color_2, "
        "replaygain_track_gain, replaygain_track_peak, "
        "replaygain_album_gain, replaygain_album_peak, "
        "artists, featured_artists, created_at, updated_at"
    )
    for s in SEED_SONGS:
        conn.execute(
            f"INSERT INTO songs ({cols}) VALUES ("
            "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?"
            ")",
            (
                s["id"], s["title"], s["artist"], s["album"], s["duration"],
                s["file_path"], s["file_format"], s["album_art_path"],
                s["source"], s["bitrate"], s["sample_rate"], s["bit_depth"],
                s["file_size"], s["waveform_peaks"], s["dominant_color"],
                s["dominant_color_2"], s["replaygain_track_gain"],
                s["replaygain_track_peak"], s["replaygain_album_gain"],
                s["replaygain_album_peak"], s["artists"], s["featured_artists"],
                s["created_at"], s["updated_at"],
            ),
        )

    for t in SEED_TAGS:
        conn.execute(
            "INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)",
            (t["id"], t["name"], t["created_at"]),
        )

    for song_id, tag_ids in SEED_SONG_TAGS.items():
        for tag_id in tag_ids:
            conn.execute(
                "INSERT INTO song_tags (song_id, tag_id) VALUES (?, ?)",
                (song_id, tag_id),
            )

    for p in SEED_PLAYLISTS:
        conn.execute(
            "INSERT INTO playlists (id, name, color, emoji, image_url, "
            "crossfade_enabled, crossfade_duration_s, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (
                p["id"], p["name"], p["color"], p["emoji"], p["image_url"],
                p["crossfade_enabled"], p["crossfade_duration_s"],
                p["created_at"], p["updated_at"],
            ),
        )

    for ps in SEED_PLAYLIST_SONGS:
        conn.execute(
            "INSERT INTO playlist_songs "
            "(playlist_id, song_id, position, start_time_ms, end_time_ms, added_at) "
            "VALUES (?,?,?,?,?,?)",
            ps,
        )

    for wf in SEED_WATCHED_FOLDERS:
        conn.execute(
            "INSERT INTO watched_folders (id, folder_path, is_active, last_scan_at, created_at) "
            "VALUES (?,?,?,?,?)",
            (wf["id"], wf["folder_path"], wf["is_active"],
             wf["last_scan_at"], wf["created_at"]),
        )

    conn.commit()
    conn.close()


# ── Seed before any app import ──────────────────────────────────────────────
seed_database()

# ── Now import app (lifespan init_db will see our seeded tables) ────────────
from app.main import app


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_caches():
    """Clear all TTL caches before each test for deterministic results."""
    from app.cache import song_cache, tag_cache, folder_cache, playlist_cache
    for c in (song_cache, tag_cache, folder_cache, playlist_cache):
        c.invalidate()
    yield


def _seed_database() -> None:
    """Re-seed the database (for tests that need a known fresh state)."""
    db_path = _TEST_DATA_DIR / "aurora.db"
    if db_path.exists():
        db_path.unlink()
    seed_database()


@pytest.fixture
def client():
    """FastAPI TestClient — uses the seeded DB at module scope."""
    with TestClient(app) as tc:
        yield tc


# ── Golden fixture helpers ──────────────────────────────────────────────────

GOLDEN_DIR = Path(__file__).parent / "golden"


def golden_path(name: str) -> Path:
    """Return path to a golden fixture file."""
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    return GOLDEN_DIR / f"{name}.json"


def load_golden(name: str) -> dict | None:
    """Load a golden fixture from disk."""
    path = golden_path(name)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def save_golden(name: str, data: dict) -> None:
    """Save a golden fixture to disk."""
    path = golden_path(name)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True))


def check_golden(name: str, actual: dict) -> None:
    """Compare actual response against golden fixture.

    If the golden file doesn't exist, save it (first-run recording).
    If it exists, assert exact match.
    """
    saved = load_golden(name)
    if saved is None:
        save_golden(name, actual)
        return

    assert actual == saved, (
        f"Golden fixture mismatch for '{name}'.\n"
        f"---- Expected ----\n{json.dumps(saved, indent=2, sort_keys=True)}\n"
        f"---- Actual   ----\n{json.dumps(actual, indent=2, sort_keys=True)}"
    )


def check_golden_status(name: str, response, expected_status: int = 200) -> dict:
    """Assert status code and check golden fixture. Returns parsed JSON."""
    assert response.status_code == expected_status, (
        f"Expected {expected_status}, got {response.status_code}: {response.text}"
    )
    data = response.json()
    check_golden(name, data)
    return data


# ── Session log helpers ────────────────────────────────────────────────────

SESSION_BUGS = []


def record_bug(endpoint: str, description: str) -> None:
    """Record a backend bug found during testing (do not fix — test-only)."""
    SESSION_BUGS.append({"endpoint": endpoint, "description": description})
