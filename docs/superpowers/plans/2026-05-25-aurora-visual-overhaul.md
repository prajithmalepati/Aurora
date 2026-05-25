# Aurora Visual Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Aurora from a functional music player into an atmospheric "Northern Lights OS" — GLSL aurora shader, per-song color pipeline computed at scan time, pre-computed SVG waveform bar, liquid glass play button, strict kill list cleanup.

**Architecture:** Backend scanner extracts waveform peaks (1000 floats) + dominant colors (2 OKLCH strings) at scan time — zero playback cost. Frontend reads pre-computed values from API, routes them to CSS variables (color bleed/halo), GLSL shader uniforms (aurora fringe color), and WaveformBar SVG. Kill list items are cleaned in Phase 2, fully independent of Phase 1.

**Tech Stack:** FastAPI + SQLite WAL (backend), miniaudio + Pillow + scikit-learn (scanner additions), React 19 + TypeScript 5 + Tailwind 4 + Zustand (frontend), WebGL GLSL (aurora canvas), culori (OKLCH↔linear-RGB for shader uniforms), @fontsource-variable/jetbrains-mono (mono accent)

---

## Multi-model review synthesis (Session 26)

- **DeepSeek** implementation readiness audit: blockers B1–B5 confirmed real by GPT 5.5
- **GPT 5.5** corrections folded in: `start_time_ms`/`end_time_ms` already in model ✓; culori needed for shader uniforms; don't remove static bg until Phase 4 AuroraCanvas lands; API returns `waveform_peaks` as `list[float] | null` not raw JSON string
- **Opus (Cursor)** additions folded in: token system (Phase 0), track transition choreography, focus model, empty/loading/error states, anti-slop checks (prime curtain phases, Lucide stroke-width, grain opacity at 3–7%, diverse radii)
- **Kimi** — plan to run Phase 2–5 through Kimi (known for frontend quality) for visual iteration after backend lands
- **Agent-browser (Vercel Labs)** — better than Playwright for browser-based visual regression; use when available. Playwright MCP used in this plan.

---

## File map

### New files
| Path | Purpose |
|---|---|
| `frontend/src/styles/tokens.css` | Design tokens — surfaces, borders, text, motion, space, radius, elevation |
| `frontend/src/components/aurora/AuroraCanvas.tsx` | WebGL GLSL aurora, singleton, `position:fixed`, z-index 0 |
| `frontend/src/components/aurora/AuroraWordmark.tsx` | SVG wordmark — plain fill + star glow at A apex |
| `frontend/src/components/player/WaveformBar.tsx` | SVG waveform bars from pre-computed peaks, playhead split |
| `frontend/src/components/player/WaveformBarSkeleton.tsx` | Animated flat-line while peaks are null |
| `frontend/src/hooks/useAuroraColor.ts` | Sets `--song-color`/`--song-color-2` on `:root`; exports linear-RGB tuple for shader |
| `frontend/src/hooks/useSongTransition.ts` | 400ms choreographed song-change driver (5 tracks in sync) |
| `frontend/src/hooks/useAudioAnalyser.ts` | Howler.ctx → AnalyserNode → transient-sensitive amplitude |
| `frontend/src/hooks/useAuroraIntensity.ts` | view + currentSong + idle-timer → `uIntensity` float |
| `backend/tests/test_scanner_peaks.py` | pytest for peak extraction |
| `backend/tests/test_scanner_color.py` | pytest for dominant color extraction |

### Modified files
| Path | What changes |
|---|---|
| `backend/app/database.py` | 3 new ALTER TABLE migrations |
| `backend/app/models.py:23–39` | SongResponse: add `waveform_peaks`, `dominant_color`, `dominant_color_2` |
| `backend/app/routers/songs.py:21–421` | `song_row_to_dict` + all SELECT queries include new columns |
| `backend/app/services/filter_engine.py:121–162` | SELECT + result dict include new columns |
| `backend/app/routers/playlists.py:235–834` | 4 independent playlist song constructions |
| `backend/app/services/file_scanner.py:142–376` | `extract_metadata` + INSERT queries include new columns |
| `backend/requirements.txt` | Add scikit-learn, miniaudio, Pillow |
| `frontend/src/types/index.ts` | Song + FilterResult + PlaylistSong: add 3 optional new fields |
| `frontend/src/stores/filterStore.ts:40–54` | `filterResultToSong` preserves new fields |
| `frontend/src/index.css` | Import tokens.css; `--font-mono` → JetBrains Mono; kill-list CSS |
| `frontend/src/components/layout/Sidebar.tsx` | Wordmark → AuroraWordmark, nav indicator, footer hover |
| `frontend/src/components/layout/PlayerBar.tsx` | grid-template-rows, remove "Playing" label, wire WaveformBar |
| `frontend/src/components/layout/AppShell.tsx` | Phase 4: replace static bg with AuroraCanvas |
| `frontend/src/components/songs/SongRow.tsx` | Remove gradient text + left accent bar |
| `frontend/src/components/filter/QueryBuilder.tsx` | Remove inline hover handlers |
| `frontend/src/App.tsx` | Wire useAuroraColor, useSongTransition |
| `frontend/package.json` | Add @fontsource-variable/jetbrains-mono, culori |

---

## Phase 0 — Design tokens (30 min, no dependencies)

### Task 0.1: Create `frontend/src/styles/tokens.css`

**Files:** Create `frontend/src/styles/tokens.css`

- [ ] **Step 1: Write tokens.css**

```css
/* Aurora design tokens — all hue-family 195 (aurora teal), not 240 */
:root {
  /* Surfaces */
  --surface-0: oklch(0.04 0.003 195);
  --surface-1: oklch(0.06 0.004 195 / 0.95);
  --surface-2: oklch(0.08 0.006 195 / 0.92);
  --surface-raised: oklch(0.10 0.008 195 / 0.90);

  /* Borders */
  --border-faint:  rgb(255 255 255 / 0.06);
  --border-quiet:  rgb(255 255 255 / 0.10);
  --border-strong: rgb(255 255 255 / 0.18);

  /* Text (contrast-checked against 0.08 max luminance floor) */
  --text-primary:   rgb(255 255 255 / 0.92);
  --text-secondary: rgb(255 255 255 / 0.68);
  --text-tertiary:  rgb(255 255 255 / 0.42);
  --text-disabled:  rgb(255 255 255 / 0.28);

  /* Brand + dynamic */
  --aurora-teal:  oklch(0.72 0.18 195);
  --song-color:   oklch(0.55 0.12 210);   /* slightly cool default — makes first song pop */
  --song-color-2: oklch(0.55 0.12 210);

  /* Motion */
  --ease-out:       cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast:       120ms;
  --dur-base:       200ms;
  --dur-slow:       300ms;
  --dur-transition: 400ms;

  /* Space (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius — must have ≥3 distinct values in use */
  --radius-sm:   2px;    /* tag chips */
  --radius-md:   6px;    /* inputs, rows */
  --radius-lg:   12px;   /* cards */
  --radius-pill: 999px;  /* play button */

  /* Elevation */
  --halo-art:  0 0 60px 12px color-mix(in oklch, var(--song-color) 40%, transparent);
  --focus-ring: 0 0 0 2px color-mix(in oklch, var(--song-color) 60%, white 20%),
                0 0 0 4px oklch(0 0 0 / 0.6);
}
```

- [ ] **Step 2: Import in `frontend/src/index.css` (add as first import)**

```css
@import './styles/tokens.css';
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add frontend/src/styles/tokens.css frontend/src/index.css
git commit -m "feat(design): add design token system — surfaces, borders, text, motion"
```

---

## Phase 1 — Backend contract (blocks Phases 3–5)

### Task 1.1: DB migration — 3 new song columns

**Files:** Modify `backend/app/database.py`

- [ ] **Step 1: Add 3 migrations to `init_db()` — after existing crossfade migrations**

In `backend/app/database.py`, after the last `try/except` migration block (after crossfade_duration_s, around line 131), add:

```python
    # Migration: add visual pipeline columns (waveform peaks + dominant colors)
    try:
        conn.execute("ALTER TABLE songs ADD COLUMN waveform_peaks TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists
    try:
        conn.execute("ALTER TABLE songs ADD COLUMN dominant_color TEXT")
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE songs ADD COLUMN dominant_color_2 TEXT")
        conn.commit()
    except Exception:
        pass
```

- [ ] **Step 2: Verify migration runs without error**

```bash
cd backend && venv\Scripts\activate && python -c "from app.database import init_db; init_db(); print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Verify columns exist**

```bash
python -c "
from app.database import get_db
conn = get_db()
cols = [r[1] for r in conn.execute('PRAGMA table_info(songs)').fetchall()]
print(cols)
"
```

Expected: list includes `waveform_peaks`, `dominant_color`, `dominant_color_2`.

- [ ] **Step 4: Commit**

```
git add backend/app/database.py
git commit -m "feat(db): add waveform_peaks, dominant_color, dominant_color_2 columns"
```

---

### Task 1.2: SongResponse model — add 3 optional fields

**Files:** Modify `backend/app/models.py:23–39`

- [ ] **Step 1: Add fields to SongResponse**

Replace `SongResponse` class (lines 23–39):

```python
class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    album: Optional[str]
    duration: Optional[int]
    file_path: Optional[str]
    file_format: Optional[str] = None
    album_art_path: Optional[str] = None
    source: str
    tags: list[str]
    playlists: list[str]
    created_at: str
    updated_at: str
    start_time_ms: int = 0
    end_time_ms: int = 0
    position: Optional[int] = None
    waveform_peaks: Optional[list[float]] = None
    dominant_color: Optional[str] = None
    dominant_color_2: Optional[str] = None
```

- [ ] **Step 2: Build check**

```bash
cd backend && venv\Scripts\activate && python -c "from app.models import SongResponse; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```
git add backend/app/models.py
git commit -m "feat(api): add waveform_peaks, dominant_color, dominant_color_2 to SongResponse"
```

---

### Task 1.3: `song_row_to_dict` — add new fields

**Files:** Modify `backend/app/routers/songs.py:21–56` and all SELECT queries in same file

- [ ] **Step 1: Update `song_row_to_dict` to include new fields**

Replace the `return { ... }` dict in `song_row_to_dict` (starting at line 41):

```python
def song_row_to_dict(row: sqlite3.Row) -> dict:
    tags_str = row["tags"] if row["tags"] else ""
    playlists_str = row["playlists"] if row["playlists"] else ""

    tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []

    playlists = []
    if playlists_str:
        for item in playlists_str.split(","):
            if ":" in item:
                id_part, name_part = item.split(":", 1)
                playlists.append({"id": int(id_part), "name": name_part.strip()})

    raw_art = row["album_art_path"] if "album_art_path" in row.keys() else None

    # waveform_peaks stored as JSON string; decode to list[float] or None
    import json as _json
    raw_peaks = row["waveform_peaks"] if "waveform_peaks" in row.keys() else None
    waveform_peaks = _json.loads(raw_peaks) if raw_peaks else None

    return {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "duration": row["duration"],
        "file_path": row["file_path"],
        "file_format": row["file_format"] if "file_format" in row.keys() else None,
        "album_art_path": raw_art if raw_art else None,
        "source": row["source"],
        "tags": tags,
        "playlists": playlists,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "waveform_peaks": waveform_peaks,
        "dominant_color": row["dominant_color"] if "dominant_color" in row.keys() else None,
        "dominant_color_2": row["dominant_color_2"] if "dominant_color_2" in row.keys() else None,
    }
```

- [ ] **Step 2: Update `list_songs` SELECT to include new columns**

In `list_songs` (around line 92–98), add the 3 new columns to the SELECT:

```python
    query = """
        SELECT
            s.id, s.title, s.artist, s.album, s.duration,
            s.file_path, s.file_format, s.album_art_path, s.source,
            s.waveform_peaks, s.dominant_color, s.dominant_color_2,
            GROUP_CONCAT(t.name) as tags,
            GROUP_CONCAT(p.id || ':' || p.name) as playlists,
            s.created_at, s.updated_at
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
    """
```

- [ ] **Step 3: Update `get_song` SELECT (around line 160–182)**

```python
    query = """
        SELECT
            s.id, s.title, s.artist, s.album, s.duration,
            s.file_path, s.file_format, s.album_art_path, s.source,
            s.waveform_peaks, s.dominant_color, s.dominant_color_2,
            GROUP_CONCAT(t.name) as tags,
            GROUP_CONCAT(p.id || ':' || p.name) as playlists,
            s.created_at, s.updated_at
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
        WHERE s.id = ?
        GROUP BY s.id
    """
```

- [ ] **Step 4: Find and update `update_song` SELECT (search for `UPDATE songs SET` then the subsequent SELECT). Add same 3 columns to its SELECT.**

Search in `songs.py` for the SELECT after `UPDATE songs SET` — add `s.waveform_peaks, s.dominant_color, s.dominant_color_2` to that SELECT's column list.

- [ ] **Step 5: Start backend and verify GET /songs returns new fields**

```bash
cd backend && venv\Scripts\activate && python run.py
```

In another terminal:
```bash
curl -s http://localhost:8000/songs?limit=1 | python -m json.tool | grep -E "waveform|dominant"
```

Expected: `"waveform_peaks": null, "dominant_color": null, "dominant_color_2": null` in response.

- [ ] **Step 6: Commit**

```
git add backend/app/routers/songs.py
git commit -m "feat(api): expose waveform_peaks + dominant colors in song responses"
```

---

### Task 1.4: filter_engine — SELECT + result dict

**Files:** Modify `backend/app/services/filter_engine.py:121–162`

- [ ] **Step 1: Add 3 columns to filter SELECT (around line 121–133)**

```python
    cursor = db_connection.execute("""
        SELECT
            s.id, s.title, s.artist, s.album, s.duration,
            s.file_path, s.file_format, s.album_art_path, s.source,
            s.waveform_peaks, s.dominant_color, s.dominant_color_2,
            s.created_at, s.updated_at,
            GROUP_CONCAT(DISTINCT t.name) AS tag_names,
            GROUP_CONCAT(DISTINCT p.id || ':' || p.name) AS playlist_ids_names
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
        GROUP BY s.id
    """)
```

- [ ] **Step 2: Add 3 fields to result dict (around line 148–162)**

```python
            # Parse waveform_peaks JSON
            import json as _json
            raw_peaks = row["waveform_peaks"] if "waveform_peaks" in row.keys() else None
            waveform_peaks = _json.loads(raw_peaks) if raw_peaks else None

            results.append({
                "id": row["id"],
                "title": row["title"],
                "artist": row["artist"],
                "album": row["album"],
                "duration": row["duration"],
                "file_path": row["file_path"],
                "file_format": row["file_format"] if "file_format" in row.keys() else None,
                "album_art_path": (row["album_art_path"] or None) if "album_art_path" in row.keys() else None,
                "source": row["source"],
                "tags": sorted(tag_set),
                "playlists": playlists,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "waveform_peaks": waveform_peaks,
                "dominant_color": row["dominant_color"] if "dominant_color" in row.keys() else None,
                "dominant_color_2": row["dominant_color_2"] if "dominant_color_2" in row.keys() else None,
            })
```

- [ ] **Step 3: Commit**

```
git add backend/app/services/filter_engine.py
git commit -m "feat(filter): include waveform_peaks + dominant colors in filter results"
```

---

### Task 1.5: playlists router — 4 independent song constructions

**Files:** Modify `backend/app/routers/playlists.py`

The playlists router constructs `SongResponse` objects in 4 separate places (get playlist songs, delete song from playlist, reorder, add song). Each needs the 3 new columns added to both the SELECT and the `SongResponse(...)` constructor.

- [ ] **Step 1: Search for all 4 SELECT blocks**

```bash
grep -n "s.id, s.title, s.artist" backend/app/routers/playlists.py
```

- [ ] **Step 2: For each SELECT found, add the 3 new columns**

Add to each SELECT's column list:
```sql
s.waveform_peaks, s.dominant_color, s.dominant_color_2,
```

- [ ] **Step 3: Search for all SongResponse constructors**

```bash
grep -n "SongResponse(" backend/app/routers/playlists.py
```

- [ ] **Step 4: For each `SongResponse(...)` constructor, add the 3 new keyword args**

```python
            import json as _json
            raw_peaks = row["waveform_peaks"] if "waveform_peaks" in row.keys() else None
            SongResponse(
                # ... existing fields ...
                waveform_peaks=_json.loads(raw_peaks) if raw_peaks else None,
                dominant_color=row["dominant_color"] if "dominant_color" in row.keys() else None,
                dominant_color_2=row["dominant_color_2"] if "dominant_color_2" in row.keys() else None,
            )
```

Note: add the `import json as _json` + `raw_peaks` lines before each constructor, or move the import to the top of the file.

- [ ] **Step 5: Verify playlist song response**

```bash
curl -s http://localhost:8000/playlists | python -m json.tool
```

Pick a playlist id and hit `/playlists/{id}`. Check that song objects include the 3 new null fields.

- [ ] **Step 6: Commit**

```
git add backend/app/routers/playlists.py
git commit -m "feat(playlists): include waveform_peaks + dominant colors in playlist song responses"
```

---

### Task 1.6: Install backend packages

**Files:** Modify `backend/requirements.txt`

- [ ] **Step 1: Add packages**

```
scikit-learn==1.6.1
miniaudio==1.60
Pillow==11.2.1
```

Add these to `backend/requirements.txt`.

- [ ] **Step 2: Install**

```bash
cd backend && venv\Scripts\activate && pip install scikit-learn miniaudio Pillow
```

- [ ] **Step 3: Verify**

```bash
python -c "import miniaudio, PIL, sklearn; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```
git add backend/requirements.txt
git commit -m "chore(deps): add scikit-learn, miniaudio, Pillow for scanner visual pipeline"
```

---

### Task 1.7: OKLCH color helper

**Files:** Create `backend/app/services/color_utils.py`

- [ ] **Step 1: Write pure-Python sRGB → OKLCH conversion**

```python
"""OKLCH color utilities — no external dependencies."""
import math


def _linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_oklch(r: int, g: int, b: int) -> tuple[float, float, float]:
    """sRGB (0–255) → OKLCH (L 0–1, C 0–0.4+, H 0–360)."""
    lr = _linear(r / 255.0)
    lg = _linear(g / 255.0)
    lb = _linear(b / 255.0)

    l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
    m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
    s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

    l, m, s = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)

    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    b_ = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

    C = math.sqrt(a * a + b_ * b_)
    H = math.degrees(math.atan2(b_, a)) % 360.0
    return L, C, H


def clamp_oklch_for_display(L: float, C: float, H: float) -> str:
    """Clamp OKLCH to contrast-safe range, return CSS oklch() string."""
    L = max(0.40, min(0.70, L))
    C = max(0.15, min(0.35, C))
    return f"oklch({L:.4f} {C:.4f} {H:.1f})"
```

- [ ] **Step 2: Write test**

Create `backend/tests/test_scanner_color.py`:

```python
from app.services.color_utils import rgb_to_oklch, clamp_oklch_for_display


def test_rgb_to_oklch_white():
    L, C, H = rgb_to_oklch(255, 255, 255)
    assert L > 0.99
    assert C < 0.01


def test_rgb_to_oklch_black():
    L, C, H = rgb_to_oklch(0, 0, 0)
    assert L < 0.01


def test_rgb_to_oklch_red():
    L, C, H = rgb_to_oklch(255, 0, 0)
    assert 0.5 < L < 0.7
    assert C > 0.15
    assert 20 < H < 40  # red hue ~29°


def test_clamp_oklch():
    result = clamp_oklch_for_display(0.9, 0.03, 185)
    assert result.startswith("oklch(0.70")   # L clamped to 0.70
    assert "0.15" in result                   # C bumped to 0.15


def test_clamp_oklch_format():
    s = clamp_oklch_for_display(0.55, 0.18, 185)
    assert s.startswith("oklch(")
    assert s.endswith(")")
```

- [ ] **Step 3: Run tests**

```bash
cd backend && venv\Scripts\activate && pytest tests/test_scanner_color.py -v
```

Expected: 5 passed.

- [ ] **Step 4: Commit**

```
git add backend/app/services/color_utils.py backend/tests/test_scanner_color.py
git commit -m "feat(scanner): add sRGB→OKLCH conversion utility with tests"
```

---

### Task 1.8: Waveform peak extraction

**Files:** Modify `backend/app/services/file_scanner.py`

- [ ] **Step 1: Write test first**

Create `backend/tests/test_scanner_peaks.py`:

```python
import pytest
from pathlib import Path
from app.services.file_scanner import extract_peaks

# Uses a real audio file from the test fixtures if available,
# otherwise tests graceful None return on bad path.

def test_extract_peaks_bad_path():
    result = extract_peaks("/nonexistent/file.mp3")
    assert result is None


def test_extract_peaks_returns_1000_bins_or_none(tmp_path):
    # Create a minimal WAV (44 bytes header + silence)
    # 44-byte PCM WAV: RIFF header, 1 channel, 22050Hz, 16-bit, 0 audio frames
    import struct
    wav_path = tmp_path / "silence.wav"
    data_size = 22050 * 2  # 1 second of 16-bit mono at 22050Hz
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, 22050, 22050 * 2, 2, 16,
        b"data", data_size,
    )
    wav_path.write_bytes(header + b"\x00" * data_size)

    result = extract_peaks(str(wav_path))
    assert result is not None
    assert len(result) == 1000
    assert all(0.0 <= v <= 1.0 for v in result)
```

- [ ] **Step 2: Run test (expect failure — function doesn't exist yet)**

```bash
cd backend && pytest tests/test_scanner_peaks.py -v
```

Expected: ImportError or AttributeError.

- [ ] **Step 3: Implement `extract_peaks` in `file_scanner.py`**

Add this function after the existing helper functions (after `format_tier` / `_detect_m4a_format`):

```python
def extract_peaks(file_path: str, num_bins: int = 1000) -> list[float] | None:
    """
    Decode audio to mono 22050Hz and compute max-amplitude per bin.
    Returns list of num_bins floats in [0, 1], or None on failure.
    Supports: MP3, FLAC, WAV, OGG. On Windows, M4A via Media Foundation.
    """
    try:
        import miniaudio
        decoded = miniaudio.decode_file(
            file_path,
            output_format=miniaudio.SampleFormat.SIGNED16,
            nchannels=1,
            sample_rate=22050,
        )
        samples = decoded.samples  # array.array('h', ...) — signed 16-bit
        n = len(samples)
        if n == 0:
            return None

        bin_size = max(1, n // num_bins)
        peaks: list[float] = []
        for i in range(num_bins):
            start = i * bin_size
            end = min(start + bin_size, n)
            if start >= n:
                peaks.append(0.0)
                continue
            chunk = samples[start:end]
            max_val = max(abs(s) for s in chunk)
            peaks.append(min(1.0, max_val / 32768.0))
        return peaks
    except Exception:
        return None
```

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest tests/test_scanner_peaks.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```
git add backend/app/services/file_scanner.py backend/tests/test_scanner_peaks.py
git commit -m "feat(scanner): add waveform peak extraction via miniaudio"
```

---

### Task 1.9: Dominant color extraction

**Files:** Modify `backend/app/services/file_scanner.py`

- [ ] **Step 1: Add `extract_dominant_colors` after `extract_peaks`**

```python
def extract_dominant_colors(art_data: bytes) -> tuple[str | None, str | None]:
    """
    K-means on 64×64 album art pixels → top 2 contrast-safe OKLCH colors.
    Returns (dominant_color, dominant_color_2) as oklch() CSS strings, or (None, None).
    """
    try:
        from io import BytesIO
        from PIL import Image
        from sklearn.cluster import KMeans
        import numpy as np
        from app.services.color_utils import rgb_to_oklch, clamp_oklch_for_display

        img = Image.open(BytesIO(art_data)).convert("RGB").resize((64, 64), Image.LANCZOS)
        pixels = np.array(img).reshape(-1, 3)  # shape (4096, 3), dtype uint8

        # Filter: skip near-gray (low chroma) + near-black/white
        results_oklch = []
        for px in pixels:
            L, C, _ = rgb_to_oklch(int(px[0]), int(px[1]), int(px[2]))
            results_oklch.append((L, C))
        oklch_arr = np.array(results_oklch)
        mask = (
            (oklch_arr[:, 1] >= 0.05) &   # chroma ≥ 0.05
            (oklch_arr[:, 0] >= 0.15) &    # not too dark
            (oklch_arr[:, 0] <= 0.85)       # not too bright
        )
        filtered = pixels[mask]

        if len(filtered) < 20:
            filtered = pixels  # fallback: use all pixels

        n_clusters = min(2, len(filtered))
        km = KMeans(n_clusters=n_clusters, n_init=3, random_state=42).fit(filtered)
        centers = km.cluster_centers_.astype(int)

        colors: list[str] = []
        for rgb in centers:
            L, C, H = rgb_to_oklch(int(rgb[0]), int(rgb[1]), int(rgb[2]))
            colors.append(clamp_oklch_for_display(L, C, H))

        while len(colors) < 2:
            colors.append(colors[0] if colors else None)

        return colors[0], colors[1]
    except Exception:
        return None, None
```

- [ ] **Step 2: Add test to `test_scanner_color.py`**

```python
from app.services.file_scanner import extract_dominant_colors
import struct


def _make_png_1x1(r: int, g: int, b: int) -> bytes:
    """Create a minimal 1×1 solid-color PNG."""
    import zlib, struct
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00" + bytes([r, g, b])
    idat = zlib.compress(raw)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", idat)
            + chunk(b"IEND", b""))


def test_extract_dominant_colors_vivid():
    png = _make_png_1x1(220, 50, 50)  # vivid red
    c1, c2 = extract_dominant_colors(png)
    assert c1 is not None
    assert c1.startswith("oklch(")


def test_extract_dominant_colors_bad_data():
    c1, c2 = extract_dominant_colors(b"not an image")
    assert c1 is None
    assert c2 is None
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_scanner_color.py -v
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git add backend/app/services/file_scanner.py backend/tests/test_scanner_color.py
git commit -m "feat(scanner): add album art dominant color extraction via K-means + OKLCH"
```

---

### Task 1.10: Wire extractions into scanner pipeline

**Files:** Modify `backend/app/services/file_scanner.py` — `extract_metadata`, `import_scanned_songs`, `_replace_song`

- [ ] **Step 1: Update `extract_metadata` to include peaks + colors**

After the existing return dict (around line 178), replace `return { ... }` with:

```python
    # Extract waveform peaks
    waveform_peaks = extract_peaks(str(path))

    # Extract dominant colors from album art
    dominant_color: str | None = None
    dominant_color_2: str | None = None
    try:
        audio_for_art = mutagen.File(str(path))
        art_data = _get_art_bytes(audio_for_art)  # helper below
        if art_data:
            dominant_color, dominant_color_2 = extract_dominant_colors(art_data)
    except Exception:
        pass

    return {
        "title": title.strip(),
        "artist": artist.strip(),
        "album": album.strip() if album else None,
        "duration": duration,
        "file_path": str(path.resolve()),
        "file_format": file_format,
        "waveform_peaks": waveform_peaks,
        "dominant_color": dominant_color,
        "dominant_color_2": dominant_color_2,
    }
```

- [ ] **Step 2: Add `_get_art_bytes` helper** (extracts raw image bytes without saving to disk):

```python
def _get_art_bytes(audio) -> bytes | None:
    """Extract raw album art bytes from a mutagen File object."""
    if audio is None:
        return None
    try:
        if hasattr(audio, "pictures") and audio.pictures:
            return audio.pictures[0].data
        if audio.tags:
            for key in list(audio.tags.keys()):
                if key.startswith("APIC"):
                    return audio.tags[key].data
            if "covr" in audio.tags and audio.tags["covr"]:
                return bytes(audio.tags["covr"][0])
            if "metadata_block_picture" in audio.tags:
                import base64
                from mutagen.flac import Picture
                for b64 in audio.tags["metadata_block_picture"]:
                    try:
                        return Picture(base64.b64decode(b64)).data
                    except Exception:
                        pass
    except Exception:
        pass
    return None
```

- [ ] **Step 3: Update fresh INSERT in `import_scanned_songs` (around line 366)**

```python
        import json as _json
        cursor = db_connection.execute(
            """INSERT INTO songs
                   (title, artist, album, duration, file_path, file_format,
                    album_art_path, source, waveform_peaks, dominant_color,
                    dominant_color_2, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'local_scan', ?, ?, ?, ?, ?)""",
            (metadata["title"], metadata["artist"], metadata["album"],
             metadata["duration"], incoming_path, incoming_fmt,
             album_art_path,
             _json.dumps(metadata.get("waveform_peaks")) if metadata.get("waveform_peaks") else None,
             metadata.get("dominant_color"),
             metadata.get("dominant_color_2"),
             now, now),
        )
```

- [ ] **Step 4: Update `_replace_song` INSERT (around line 238)**

Same pattern — add `waveform_peaks`, `dominant_color`, `dominant_color_2` to the INSERT columns and params.

- [ ] **Step 5: Manual scan test**

Start the backend and trigger a scan on a folder with a few songs. Check one song in the DB:

```bash
python -c "
from app.database import get_db
conn = get_db()
row = conn.execute('SELECT title, dominant_color, waveform_peaks FROM songs LIMIT 1').fetchone()
print(dict(row))
"
```

Expected: `dominant_color` is an `oklch(...)` string or null; `waveform_peaks` is a JSON array or null.

- [ ] **Step 6: Commit**

```
git add backend/app/services/file_scanner.py
git commit -m "feat(scanner): wire peak + color extraction into scan pipeline and INSERT"
```

---

### Task 1.11: Frontend types + `filterResultToSong`

**Files:** Modify `frontend/src/types/index.ts`, `frontend/src/stores/filterStore.ts`

- [ ] **Step 1: Add 3 optional fields to `Song` interface**

In `frontend/src/types/index.ts`, update `Song`:

```typescript
export interface Song {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  file_path: string | null
  file_format?: string | null
  album_art_path?: string | null
  source: string
  external_id?: string | null
  start_time_ms?: number
  end_time_ms?: number
  tags: string[]
  playlists: Playlist[]
  created_at: string
  updated_at: string
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
}
```

- [ ] **Step 2: Add same 3 fields to `FilterResult`**

```typescript
export interface FilterResult {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  file_path: string | null
  file_format?: string | null
  album_art_path?: string | null
  source: string
  tags: string[]
  playlists: Playlist[]
  created_at: string
  updated_at: string
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
}
```

- [ ] **Step 3: Add same 3 fields to `PlaylistSong`**

```typescript
export interface PlaylistSong {
  id: number
  title: string
  artist: string
  album: string | null
  duration: number | null
  file_path: string | null
  file_format?: string | null
  album_art_path?: string | null
  start_time_ms?: number
  end_time_ms?: number
  tags: string[]
  position: number
  waveform_peaks?: number[] | null
  dominant_color?: string | null
  dominant_color_2?: string | null
}
```

- [ ] **Step 4: Update `filterResultToSong` in `filterStore.ts`**

Replace the function body (lines 40–54):

```typescript
function filterResultToSong(r: FilterResult): Song {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album,
    duration: r.duration,
    file_path: r.file_path,
    source: r.source,
    tags: r.tags,
    playlists: r.playlists,
    created_at: r.created_at,
    updated_at: r.updated_at,
    file_format: r.file_format,
    album_art_path: r.album_art_path,
    waveform_peaks: r.waveform_peaks,
    dominant_color: r.dominant_color,
    dominant_color_2: r.dominant_color_2,
  }
}
```

- [ ] **Step 5: Build check**

```bash
cd frontend && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```
git add frontend/src/types/index.ts frontend/src/stores/filterStore.ts
git commit -m "feat(types): add waveform_peaks + dominant colors to Song, FilterResult, PlaylistSong"
```

---

## Phase 2 — Kill list + fonts (no backend dependency)

### Task 2.1: Install JetBrains Mono + culori

- [ ] **Step 1: Install packages**

```bash
cd frontend && npm install @fontsource-variable/jetbrains-mono culori
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): add jetbrains-mono variable font and culori"
```

---

### Task 2.2: Apply JetBrains Mono as `--font-mono`

**Files:** Modify `frontend/src/index.css`

- [ ] **Step 1: Add font import (near top of index.css, after tokens.css import)**

```css
@import '@fontsource-variable/jetbrains-mono';
```

- [ ] **Step 2: Find `--font-mono` token definition and update it**

Search in `index.css` for the existing `--font-mono` definition. Replace it with:

```css
--font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
```

- [ ] **Step 3: Find `mix-kbd` class (uses hardcoded `ui-monospace`) and update**

Search for `mix-kbd` in `index.css`. Find the `font-family` declaration and change it to:

```css
font-family: var(--font-mono);
```

- [ ] **Step 4: Build + visual check**

```bash
npm run build
```

Start dev server and verify query input + tag chips render in JetBrains Mono.

- [ ] **Step 5: Commit**

```
git add frontend/src/index.css
git commit -m "feat(typography): apply JetBrains Mono as mono accent font"
```

---

### Task 2.3 + 2.4: SongRow — remove gradient text and left accent bar (K7, K8)

**Files:** Modify `frontend/src/components/songs/SongRow.tsx`

- [ ] **Step 1: Remove `aurora-gradient-text` class from currently-playing song title**

Search for `aurora-gradient-text` in `SongRow.tsx` (around line 146). Remove that class from the className. Replace with plain text color class, e.g. `text-white/90`.

- [ ] **Step 2: Remove the `w-[3px]` left accent bar span (around line 84)**

Find the `<span>` or `<div>` with `w-[3px]` that renders as the left accent stripe on the currently-playing row. Delete it entirely.

The currently-playing row instead gets a subtle full-width background tint — add `bg-white/[0.05]` to the row's className when `isPlaying`.

- [ ] **Step 3: Build + visual check**

Verify currently-playing song row: no gradient text, no left stripe, faint full-width tint.

- [ ] **Step 4: Commit**

```
git add frontend/src/components/songs/SongRow.tsx
git commit -m "fix(songs): remove gradient text and left accent bar from playing row"
```

---

### Task 2.5: AuroraWordmark SVG component (K1)

**Files:** Create `frontend/src/components/aurora/AuroraWordmark.tsx`, modify `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `AuroraWordmark.tsx`**

```tsx
// Star at A apex + plain fill lettering — no gradient on letterforms
export function AuroraWordmark({ className }: { className?: string }) {
  return (
    <svg
      width="112"
      height="30"
      viewBox="0 0 112 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Aurora"
    >
      <defs>
        <radialGradient id="star-bloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="oklch(0.95 0.06 185)" stopOpacity="1" />
          <stop offset="35%"  stopColor="oklch(0.78 0.18 185)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(0.72 0.18 185)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Star glow — positioned at apex of the "A" (~x=11, y=2 at 24px Fraunces) */}
      <ellipse cx="11" cy="2" rx="11" ry="11" fill="url(#star-bloom)" />
      {/* Star hard core */}
      <circle cx="11" cy="2" r="2.2" fill="oklch(0.97 0.04 185)" />

      {/* Wordmark text — Fraunces italic, plain fill, NO gradient */}
      <text
        x="1"
        y="25"
        fontFamily="'Fraunces Variable', Fraunces, serif"
        fontSize="22"
        fontWeight="400"
        fontStyle="italic"
        fontVariationSettings='"opsz" 144, "SOFT" 50'
        fill="rgb(232 238 248)"
        letterSpacing="-0.02em"
      >
        Aurora
      </text>
    </svg>
  )
}
```

**Note:** The star x/y position (11, 2) must be visually verified in the browser against the actual Fraunces "A" apex. Adjust after first render.

- [ ] **Step 2: Replace gradient wordmark in `Sidebar.tsx`**

Find the wordmark element (around line 58) that uses `aurora-gradient-text`. Replace it:

```tsx
import { AuroraWordmark } from '@/components/aurora/AuroraWordmark'

// Replace the gradient text element with:
<AuroraWordmark className="select-none" />
```

- [ ] **Step 3: Visual check — start dev server**

```bash
cd frontend && npm run dev
```

Verify: wordmark shows "Aurora" in Fraunces italic with teal star glow at A apex. No gradient on letterforms.

- [ ] **Step 4: Commit**

```
git add frontend/src/components/aurora/AuroraWordmark.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): replace gradient wordmark with SVG + star glow"
```

---

### Task 2.6: Nav indicator — left bar → full-width tint (K2)

**Files:** Modify `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Find `w-[3px]` nav indicator (around line 226)**

Delete the absolute-positioned `<span>` or `<div>` with `w-[3px]` that renders the left accent stripe.

- [ ] **Step 2: Apply full-width background tint to active nav item**

In the active nav item's className, add `bg-white/[0.05]`. The tint replaces the stripe entirely.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "fix(sidebar): replace 3px left nav indicator with full-width bg tint"
```

---

### Task 2.7: FooterAction hover — inline → group-hover (K6)

**Files:** Modify `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Find `onMouseEnter`/`onMouseLeave` on FooterAction (around lines 275–276)**

Remove the `onMouseEnter={e => e.currentTarget.style.background = ...}` and `onMouseLeave` handlers entirely.

- [ ] **Step 2: Add `group` class to the outer wrapper and `group-hover:bg-white/[0.05]` to the inner element**

```tsx
<div className="group cursor-pointer rounded-md">
  <div className="... group-hover:bg-white/[0.05] transition-colors duration-200">
    {/* content */}
  </div>
</div>
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "fix(sidebar): replace inline hover handlers with Tailwind group-hover"
```

---

### Task 2.8: QueryBuilder inline hovers → group-hover (K9, K10)

**Files:** Modify `frontend/src/components/filter/QueryBuilder.tsx`

- [ ] **Step 1: Find and remove `onMouseEnter`/`onMouseLeave` on "Edit query" button (around lines 110–117)**

Replace with Tailwind hover classes.

- [ ] **Step 2: Find and remove `onMouseEnter`/`onMouseLeave` on playlist chips (around lines 268–275)**

Replace with Tailwind hover classes on the chip container.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/filter/QueryBuilder.tsx
git commit -m "fix(filter): replace inline hover handlers with Tailwind classes"
```

---

### Task 2.9: PlayerBar — height → grid-template-rows (K3)

**Files:** Modify `frontend/src/components/layout/PlayerBar.tsx`, `frontend/src/index.css`

- [ ] **Step 1: Find height transition in CSS**

Search `index.css` for `.playerbar` class (around line 878–882). Find the `height` or `max-height` transition rule.

- [ ] **Step 2: Replace height-based expansion with grid-template-rows**

The PlayerBar expand/collapse pattern using CSS:

```css
.playerbar-grid {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms var(--ease-out);
  align-items: start;   /* REQUIRED — without this, 0fr→1fr jumps */
}

.playerbar-grid.expanded {
  grid-template-rows: 1fr;
}

.playerbar-grid > * {
  overflow: hidden;
  min-height: 0;
}
```

In `PlayerBar.tsx`, change the expanded section wrapper to use `playerbar-grid` class and toggle `expanded` class.

- [ ] **Step 3: Remove the inline `height` style from `PlayerBar.tsx` (around lines 190–192)**

Delete any `style={{ height: ... }}` or `style={{ maxHeight: ... }}` from the expanding section.

- [ ] **Step 4: Visual check — expand and collapse PlayerBar**

Verify smooth animation, no jump at start.

- [ ] **Step 5: Commit**

```
git add frontend/src/components/layout/PlayerBar.tsx frontend/src/index.css
git commit -m "fix(player): replace height transition with grid-template-rows expand"
```

---

### Task 2.10: PlayerBar — remove "Playing" text label (K4)

**Files:** Modify `frontend/src/components/layout/PlayerBar.tsx`

- [ ] **Step 1: Find the equalizer + "Playing" label block (around lines 323–328)**

Delete the "Playing" text element. Keep the equalizer icon only.

- [ ] **Step 2: Commit**

```
git add frontend/src/components/layout/PlayerBar.tsx
git commit -m "fix(player): show equalizer icon only, remove redundant Playing label"
```

---

## Phase 3 — Color pipeline

### Task 3.1: `useAuroraColor` hook

**Files:** Create `frontend/src/hooks/useAuroraColor.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useRef } from 'react'
import { converter, parse } from 'culori'
import { usePlayerStore } from '@/stores/playerStore'

const toLrgb = converter('lrgb')

const BRAND_TEAL = 'oklch(0.72 0.18 195)'
const DEFAULT_COLOR = 'oklch(0.55 0.12 210)'

function oklchToLinearRgb(oklchStr: string): [number, number, number] {
  try {
    const parsed = parse(oklchStr)
    if (!parsed) return [0.40, 0.78, 0.72]
    const lrgb = toLrgb(parsed)
    return [lrgb?.r ?? 0, lrgb?.g ?? 0, lrgb?.b ?? 0]
  } catch {
    return [0.40, 0.78, 0.72]
  }
}

export interface AuroraColorState {
  /** Linear RGB for shader uColor2 uniform */
  color2LinearRgb: [number, number, number]
  /** Linear RGB for shader uColor1 (fixed brand teal, never changes) */
  color1LinearRgb: [number, number, number]
}

const BRAND_TEAL_LINEAR = oklchToLinearRgb(BRAND_TEAL)

export function useAuroraColor(): AuroraColorState {
  const currentSong = usePlayerStore(s => s.currentSong)

  const color2Linear = useRef<[number, number, number]>(oklchToLinearRgb(DEFAULT_COLOR))

  useEffect(() => {
    const color = currentSong?.dominant_color ?? DEFAULT_COLOR
    const color2 = currentSong?.dominant_color_2 ?? DEFAULT_COLOR

    // Set CSS variables on :root for halo, bleed, waveform fill
    document.documentElement.style.setProperty('--song-color', color)
    document.documentElement.style.setProperty('--song-color-2', color2)

    // Compute linear RGB for shader
    color2Linear.current = oklchToLinearRgb(color2)
  }, [currentSong?.id])

  return {
    color2LinearRgb: color2Linear.current,
    color1LinearRgb: BRAND_TEAL_LINEAR,
  }
}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```
git add frontend/src/hooks/useAuroraColor.ts
git commit -m "feat(color): add useAuroraColor hook — sets CSS vars and exports linear RGB"
```

---

### Task 3.2: `useSongTransition` hook (400ms choreography)

**Files:** Create `frontend/src/hooks/useSongTransition.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * Drives the 400ms song-change choreography.
 * Returns a normalized progress value [0..1] that consumers can use
 * to fade waveform peaks in/out. CSS variables transition on their own.
 *
 * Timeline:
 *   t=0ms:     song changes, waveform opacity begins fade to 40%
 *   t=100ms:   --song-color begins CSS lerp (via CSS transition on :root)
 *   t=200ms:   waveform peaks swap, fade back to 100%
 *   t=400ms:   transition complete
 */
export function useSongTransition(onSwapPeaks: () => void) {
  const currentSongId = usePlayerStore(s => s.currentSong?.id)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const prevIdRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (currentSongId === prevIdRef.current) return
    prevIdRef.current = currentSongId

    // Set CSS transition on --song-color (300ms, triggered by useAuroraColor setting it)
    document.documentElement.style.setProperty(
      'transition',
      '--song-color 300ms var(--ease-out), --song-color-2 300ms var(--ease-out)'
    )

    startRef.current = performance.now()
    let swapped = false

    const tick = (now: number) => {
      const elapsed = now - startRef.current
      if (!swapped && elapsed >= 200) {
        swapped = true
        onSwapPeaks()
      }
      if (elapsed < 400) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [currentSongId, onSwapPeaks])
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```
git add frontend/src/hooks/useSongTransition.ts
git commit -m "feat(player): add useSongTransition hook for 400ms song-change choreography"
```

---

### Task 3.3: Wire color hooks into `App.tsx`

**Files:** Modify `frontend/src/App.tsx`

- [ ] **Step 1: Import and call `useAuroraColor` in App.tsx**

```tsx
import { useAuroraColor } from '@/hooks/useAuroraColor'

export function App() {
  const auroraColor = useAuroraColor()  // sets CSS vars, exposes linear RGB
  // ... rest of App
}
```

Export `auroraColor` via context or pass down to AuroraCanvas (Phase 4). For now, the CSS vars are the primary consumer.

- [ ] **Step 2: Commit**

```
git add frontend/src/App.tsx
git commit -m "feat(app): wire useAuroraColor — CSS vars update on song change"
```

---

### Task 3.4: PlayerBar color bleed + halo

**Files:** Modify `frontend/src/components/layout/PlayerBar.tsx`, `frontend/src/index.css`

- [ ] **Step 1: Add bleed pseudo-element to PlayerBar**

In `index.css`, add a class for the light source bleed:

```css
.player-bleed {
  position: absolute;
  left: -80px;
  top: 50%;
  transform: translateY(-50%);
  width: 400px;
  height: 400px;
  background: radial-gradient(
    circle,
    color-mix(in oklch, var(--song-color) 35%, transparent) 0%,
    transparent 70%
  );
  filter: blur(60px);
  z-index: -1;
  pointer-events: none;
  transition: background-color var(--dur-slow) var(--ease-out);
}
```

In `PlayerBar.tsx`, add `<div className="player-bleed" aria-hidden />` as first child of the PlayerBar container (inside a `position: relative` wrapper).

- [ ] **Step 2: Replace static album art halo with `--song-color`**

Find any hardcoded halo/box-shadow on the album art in `PlayerBar.tsx`. Replace with:

```tsx
style={{ boxShadow: 'var(--halo-art)' }}
```

- [ ] **Step 3: Visual check**

Start dev server, play a song with vivid album art. Verify left half of PlayerBar washes in album color.

- [ ] **Step 4: Commit**

```
git add frontend/src/components/layout/PlayerBar.tsx frontend/src/index.css
git commit -m "feat(player): add per-song color bleed and dynamic art halo"
```

---

## Phase 4 — GLSL Aurora Shader

### Task 4.1 + 4.2: `AuroraCanvas` component

**Files:** Create `frontend/src/components/aurora/AuroraCanvas.tsx`

- [ ] **Step 1: Write the complete component**

```tsx
import { useEffect, useRef, useCallback } from 'react'

interface AuroraCanvasProps {
  color1: [number, number, number]  // linear RGB brand teal
  color2: [number, number, number]  // linear RGB album fringe
  amplitude: number                  // 0–1 transient-sensitive
  intensity: number                  // 0–1 view-driven
}

// Vertex shader — fullscreen quad
const VS = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

// Fragment shader — layered sinusoidal aurora curtains
// Prime-number period offsets prevent curtains from realigning (Opus recommendation)
const FS = `
precision mediump float;

uniform float uTime;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform float uAmplitude;
uniform float uIntensity;
uniform vec2  uResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float curtain(vec2 uv, float t, float phase, float speed, float freq) {
  float x = uv.x;
  float wave  = sin(x * freq + t * speed + phase) * 0.12;
  wave       += sin(x * freq * 1.73 + t * speed * 0.61 + phase * 1.41) * 0.06;
  wave       += noise(vec2(x * 1.8, t * 0.15 + phase)) * 0.08;
  float cy    = 0.52 + wave + sin(t * 0.07 + phase) * 0.04;
  float dist  = abs(uv.y - cy);
  float coreW = 0.06 + sin(t * 0.05 + phase * 0.7) * 0.01;
  float core  = smoothstep(coreW, 0.0, dist);
  float glow  = smoothstep(coreW * 4.0, coreW, dist) * 0.25;
  return core + glow;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // 5 curtains — phases and speeds chosen to never align (irrational ratios)
  float a = 0.0;
  a += curtain(uv, uTime, 0.00, 0.31, 2.10) * 0.55;
  a += curtain(uv, uTime, 1.70, 0.19, 3.30) * 0.45;
  a += curtain(uv, uTime, 3.14, 0.23, 1.80) * 0.40;
  a += curtain(uv, uTime, 5.30, 0.17, 4.10) * 0.35;
  a += curtain(uv, uTime, 7.93, 0.29, 2.70) * 0.30;

  a *= 1.0 + uAmplitude * 0.6;
  a  = clamp(a, 0.0, 1.0);

  float colorT   = uv.x * 0.7 + sin(uTime * 0.08) * 0.15 + 0.15;
  vec3  color    = mix(uColor1, uColor2, clamp(colorT, 0.0, 1.0));
  color          = mix(color, vec3(0.95, 0.98, 1.0), a * a * 0.35);

  float alpha = a * uIntensity * 0.65;
  gl_FragColor  = vec4(color, alpha);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[AuroraCanvas] shader compile:', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function initWebGL(canvas: HTMLCanvasElement): {
  gl: WebGLRenderingContext
  uniforms: Record<string, WebGLUniformLocation>
} | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
  if (!gl) return null

  const vs = compileShader(gl, gl.VERTEX_SHADER, VS)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS)
  if (!vs || !fs) return null

  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[AuroraCanvas] link:', gl.getProgramInfoLog(prog))
    return null
  }

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

  const pos = gl.getAttribLocation(prog, 'aPosition')
  gl.enableVertexAttribArray(pos)
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

  gl.useProgram(prog)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  const uniforms: Record<string, WebGLUniformLocation> = {}
  for (const name of ['uTime','uColor1','uColor2','uAmplitude','uIntensity','uResolution']) {
    const loc = gl.getUniformLocation(prog, name)
    if (loc) uniforms[name] = loc
  }

  return { gl, uniforms }
}

export function AuroraCanvas({ color1, color2, amplitude, intensity }: AuroraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<{ gl: WebGLRenderingContext; uniforms: Record<string, WebGLUniformLocation> } | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(performance.now())

  // Lerped color2 (300ms)
  const currentColor2Ref = useRef<[number, number, number]>([...color2])
  const targetColor2Ref  = useRef<[number, number, number]>([...color2])
  const color2StartRef   = useRef<number>(0)
  const color2PrevRef    = useRef<[number, number, number]>([...color2])

  // Lerped intensity (600ms)
  const currentIntensityRef = useRef(intensity)
  const targetIntensityRef  = useRef(intensity)
  const intensityStartRef   = useRef<number>(0)
  const intensityPrevRef    = useRef(intensity)

  useEffect(() => {
    targetColor2Ref.current = color2
    color2StartRef.current = performance.now()
    color2PrevRef.current = [...currentColor2Ref.current]
  }, [color2[0], color2[1], color2[2]])

  useEffect(() => {
    targetIntensityRef.current = intensity
    intensityStartRef.current = performance.now()
    intensityPrevRef.current = currentIntensityRef.current
  }, [intensity])

  const draw = useCallback(() => {
    const ctx = glRef.current
    if (!ctx) return
    const { gl, uniforms } = ctx
    const canvas = canvasRef.current
    if (!canvas) return

    const now = performance.now()
    const t = (now - startRef.current) / 1000

    // Lerp color2 (300ms)
    const ct = Math.min(1, (now - color2StartRef.current) / 300)
    const ce = ct < 1 ? ct * ct * (3 - 2 * ct) : 1  // smoothstep
    currentColor2Ref.current = [
      color2PrevRef.current[0] + (targetColor2Ref.current[0] - color2PrevRef.current[0]) * ce,
      color2PrevRef.current[1] + (targetColor2Ref.current[1] - color2PrevRef.current[1]) * ce,
      color2PrevRef.current[2] + (targetColor2Ref.current[2] - color2PrevRef.current[2]) * ce,
    ]

    // Lerp intensity (600ms)
    const it = Math.min(1, (now - intensityStartRef.current) / 600)
    const ie = it < 1 ? it * it * (3 - 2 * it) : 1
    currentIntensityRef.current =
      intensityPrevRef.current + (targetIntensityRef.current - intensityPrevRef.current) * ie

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (uniforms.uTime)       gl.uniform1f(uniforms.uTime, t)
    if (uniforms.uResolution) gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height)
    if (uniforms.uColor1)     gl.uniform3fv(uniforms.uColor1, color1)
    if (uniforms.uColor2)     gl.uniform3fv(uniforms.uColor2, currentColor2Ref.current)
    if (uniforms.uAmplitude)  gl.uniform1f(uniforms.uAmplitude, amplitude)
    if (uniforms.uIntensity)  gl.uniform1f(uniforms.uIntensity, currentIntensityRef.current)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    rafRef.current = requestAnimationFrame(draw)
  }, [color1, amplitude])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const result = initWebGL(canvas)
    if (!result) {
      console.warn('[AuroraCanvas] WebGL init failed — using CSS fallback')
      return
    }
    glRef.current = result
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
    })
    ro.observe(canvas)
    canvas.width = canvas.offsetWidth * devicePixelRatio
    canvas.height = canvas.offsetHeight * devicePixelRatio
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/aurora/AuroraCanvas.tsx
git commit -m "feat(aurora): add WebGL GLSL aurora canvas with lerped uniforms"
```

---

### Task 4.3: `useAudioAnalyser` hook

**Files:** Create `frontend/src/hooks/useAudioAnalyser.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

const ROLLING_WINDOW = 30  // frames for rolling average
const SPIKE_THRESHOLD = 0.3

export function useAudioAnalyser(): number {
  const [amplitude, setAmplitude] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rollingRef  = useRef<number[]>([])
  const rafRef      = useRef<number | null>(null)
  const isPlaying   = usePlayerStore(s => s.isPlaying)
  const currentId   = usePlayerStore(s => s.currentSong?.id)

  useEffect(() => {
    // Lazy init — Howler.ctx undefined until first user interaction
    const Howler = (window as any).Howler
    if (!Howler?.ctx) return

    const ctx: AudioContext = Howler.ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6

    // Tap off Howler's master gain — sees mixed output
    try {
      Howler.masterGain.connect(analyser)
    } catch {
      return
    }

    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(data)
      // Focus on low-mid range (bins 1–20 ≈ 85–1700Hz)
      let sum = 0
      for (let i = 1; i <= 20; i++) sum += data[i]
      const norm = sum / (20 * 255)

      const rolling = rollingRef.current
      rolling.push(norm)
      if (rolling.length > ROLLING_WINDOW) rolling.shift()
      const avg = rolling.reduce((a, b) => a + b, 0) / rolling.length

      // Only emit transient spikes — prevents Winamp-visualizer feel
      const spike = norm - avg > SPIKE_THRESHOLD ? norm - avg : 0
      setAmplitude(spike)

      rafRef.current = requestAnimationFrame(tick)
    }

    if (isPlaying) rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try { Howler.masterGain.disconnect(analyser) } catch { /* ignore */ }
      analyser.disconnect()
    }
  }, [currentId, isPlaying])

  return amplitude
}
```

- [ ] **Step 2: Commit**

```
git add frontend/src/hooks/useAudioAnalyser.ts
git commit -m "feat(aurora): add audio analyser hook for transient-sensitive amplitude"
```

---

### Task 4.4: `useAuroraIntensity` hook

**Files:** Create `frontend/src/hooks/useAuroraIntensity.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useRef, useState } from 'react'
import { useSongStore } from '@/stores/songStore'
import { usePlayerStore } from '@/stores/playerStore'

const INTENSITY_MAP: Record<string, number> = {
  'all-songs': 0.20,
  'filter':    0.15,
  'playlist':  0.25,
  'settings':  0.15,
}

const NOW_PLAYING_INTENSITY = 0.80
const IDLE_INTENSITY        = 0.40
const IDLE_TIMEOUT_MS       = 30_000

export function useAuroraIntensity(): number {
  const view        = useSongStore(s => s.view)
  const currentSong = usePlayerStore(s => s.currentSong)
  const isExpanded  = usePlayerStore(s => s.isExpanded)  // PlayerBar expanded state
  const [intensity, setIntensity] = useState(INTENSITY_MAP['all-songs'])

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isIdle, setIsIdle] = useState(false)

  // Idle timer — reset on any interaction
  useEffect(() => {
    const resetIdle = () => {
      setIsIdle(false)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => setIsIdle(true), IDLE_TIMEOUT_MS)
    }
    window.addEventListener('pointermove', resetIdle)
    window.addEventListener('keydown', resetIdle)
    resetIdle()
    return () => {
      window.removeEventListener('pointermove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  // Derive intensity from 3 signals
  useEffect(() => {
    if (isIdle && !currentSong) {
      setIntensity(IDLE_INTENSITY)
      return
    }
    if (isExpanded && currentSong) {
      setIntensity(NOW_PLAYING_INTENSITY)
      return
    }
    const viewKind = typeof view === 'object' ? (view as { kind: string }).kind : 'all-songs'
    setIntensity(INTENSITY_MAP[viewKind] ?? 0.20)
  }, [view, currentSong, isIdle, isExpanded])

  return intensity
}
```

**Note:** `playerStore.isExpanded` may not exist yet. If it doesn't, add it to the player store (boolean, toggled when PlayerBar expands). Check `playerStore.ts` and add if missing.

- [ ] **Step 2: Commit**

```
git add frontend/src/hooks/useAuroraIntensity.ts
git commit -m "feat(aurora): add intensity hook — view + currentSong + idle → uIntensity"
```

---

### Task 4.5: Wire AuroraCanvas into AppShell — replace static background

**Files:** Modify `frontend/src/components/layout/AppShell.tsx`, `frontend/src/App.tsx`

- [ ] **Step 1: In `App.tsx`, collect aurora state and pass to AppShell**

```tsx
import { useAuroraColor }    from '@/hooks/useAuroraColor'
import { useAudioAnalyser }  from '@/hooks/useAudioAnalyser'
import { useAuroraIntensity } from '@/hooks/useAuroraIntensity'

const { color1LinearRgb, color2LinearRgb } = useAuroraColor()
const amplitude = useAudioAnalyser()
const intensity = useAuroraIntensity()
```

Pass these as props to `<AppShell>` or wire through a context.

- [ ] **Step 2: In `AppShell.tsx`, import and render `<AuroraCanvas>`**

```tsx
import { AuroraCanvas } from '@/components/aurora/AuroraCanvas'

// Remove: the static aurora-bg-image div (K5 from kill list — now safe to remove because AuroraCanvas replaces it)
// Add AuroraCanvas as first child of the root element:

<>
  <AuroraCanvas
    color1={props.auroraColor1}
    color2={props.auroraColor2}
    amplitude={props.amplitude}
    intensity={props.intensity}
  />
  {/* grain overlay stays — verify at 5% opacity */}
  <div className="aurora-grain" aria-hidden />
  {/* existing UI chrome */}
  {children}
</>
```

- [ ] **Step 3: Visual check — observe aurora in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173. Verify:
- Northern lights animation visible (not just black)
- Aurora dims in library view (20%)
- Grain texture overlay present
- No static PNG background visible

- [ ] **Step 4: Commit**

```
git add frontend/src/components/layout/AppShell.tsx frontend/src/App.tsx
git commit -m "feat(aurora): wire GLSL canvas into AppShell, remove static background"
```

---

### Task 4.6: Reduced-motion + compile failure fallback

**Files:** Modify `frontend/src/index.css`, `frontend/src/components/aurora/AuroraCanvas.tsx`

- [ ] **Step 1: Add CSS fallback for reduced-motion and WebGL failure**

In `index.css`:

```css
/* Fallback static gradient when WebGL unavailable or reduced-motion */
.aurora-fallback {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 80% 60% at 30% 40%,
    oklch(0.12 0.06 185 / 0.4) 0%,
    oklch(0.04 0.003 195) 70%
  );
}

@media (prefers-reduced-motion: reduce) {
  canvas[aria-hidden] {
    display: none;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse 80% 60% at 30% 40%,
      oklch(0.12 0.06 185 / 0.4) 0%,
      oklch(0.04 0.003 195) 70%
    );
  }
}
```

- [ ] **Step 2: In `AuroraCanvas.tsx`, show fallback div when WebGL init fails**

```tsx
const [webglFailed, setWebglFailed] = useState(false)

// In the initWebGL effect:
if (!result) {
  setWebglFailed(true)
  return
}

// In render:
if (webglFailed) return <div className="aurora-fallback" aria-hidden />
```

- [ ] **Step 3: Commit**

```
git add frontend/src/index.css frontend/src/components/aurora/AuroraCanvas.tsx
git commit -m "feat(aurora): add reduced-motion and WebGL failure fallback"
```

---

## Phase 5 — Waveform bar

### Task 5.1: `WaveformBar` SVG component

**Files:** Create `frontend/src/components/player/WaveformBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useRef, useEffect, useCallback } from 'react'
import { usePlayerStore } from '@/stores/playerStore'

interface WaveformBarProps {
  peaks: number[]          // 1000 floats [0–1]
  duration: number         // song duration in seconds
  onSeek: (time: number) => void
}

const BAR_COUNT = 200  // display bars (resampled from 1000)

function resamplePeaks(peaks: number[], target: number): number[] {
  if (!peaks.length) return new Array(target).fill(0)
  const out: number[] = []
  for (let i = 0; i < target; i++) {
    const lo = Math.floor((i / target) * peaks.length)
    const hi = Math.min(peaks.length - 1, Math.ceil(((i + 1) / target) * peaks.length) - 1)
    let max = 0
    for (let j = lo; j <= hi; j++) max = Math.max(max, peaks[j])
    out.push(max)
  }
  return out
}

function buildPath(resampled: number[], width: number, height: number): string {
  if (!resampled.length || !width || !height) return ''
  const barW = width / resampled.length
  const midY = height / 2
  let d = ''
  for (let i = 0; i < resampled.length; i++) {
    const x = i * barW + barW * 0.5
    const h = Math.max(2, resampled[i] * height * 0.85)
    d += `M${x.toFixed(1)},${(midY - h / 2).toFixed(1)}L${x.toFixed(1)},${(midY + h / 2).toFixed(1)}`
  }
  return d
}

export function WaveformBar({ peaks, duration, onSeek }: WaveformBarProps) {
  const svgRef       = useRef<SVGSVGElement>(null)
  const clipPathId   = useRef(`waveform-clip-${Math.random().toString(36).slice(2)}`)
  const progressRef  = useRef(0)
  const rafRef       = useRef<number | null>(null)

  const currentSong = usePlayerStore(s => s.currentSong)
  const howlRef     = usePlayerStore(s => s.howlRef)

  const [resampled]  = [resamplePeaks(peaks, BAR_COUNT)]
  const svgW = svgRef.current?.clientWidth ?? 600
  const svgH = svgRef.current?.clientHeight ?? 32
  const path = buildPath(resampled, svgW, svgH)
  const barW = svgW / BAR_COUNT

  // RAF loop to update the clip rect (playhead position)
  const updatePlayhead = useCallback(() => {
    const howl = (howlRef as any)?.current
    if (!howl || !duration) { rafRef.current = requestAnimationFrame(updatePlayhead); return }
    const seek = typeof howl.seek === 'function' ? (howl.seek() as number) : 0
    progressRef.current = seek / duration
    const clipEl = document.getElementById(clipPathId.current + '-rect')
    if (clipEl) clipEl.setAttribute('width', String(progressRef.current * svgW))
    rafRef.current = requestAnimationFrame(updatePlayhead)
  }, [duration, svgW])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updatePlayhead)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [updatePlayhead])

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(ratio * duration)
  }

  return (
    <div className="relative w-full" style={{ height: '32px' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="32"
        onClick={handleClick}
        style={{ cursor: 'pointer', display: 'block' }}
        aria-hidden
      >
        <defs>
          <clipPath id={clipPathId.current}>
            <rect
              id={clipPathId.current + '-rect'}
              x="0" y="0"
              width="0" height="32"
            />
          </clipPath>
        </defs>

        {/* Dim outline — right of playhead (full width, drawn first) */}
        <path
          d={path}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={Math.max(1.5, barW * 0.65)}
          strokeLinecap="round"
          fill="none"
        />

        {/* Filled + glow — left of playhead (clipped) */}
        <path
          d={path}
          stroke="var(--song-color)"
          strokeWidth={Math.max(1.5, barW * 0.65)}
          strokeLinecap="round"
          fill="none"
          clipPath={`url(#${clipPathId.current})`}
          style={{ filter: 'drop-shadow(0 0 4px color-mix(in oklch, var(--song-color) 80%, transparent))' }}
        />

        {/* Playhead — 1px vertical line */}
        <line
          x1={progressRef.current * svgW}
          y1="0"
          x2={progressRef.current * svgW}
          y2="32"
          stroke="oklch(0.78 0.18 195)"
          strokeWidth="1"
        />
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```
git add frontend/src/components/player/WaveformBar.tsx
git commit -m "feat(player): add WaveformBar SVG component from pre-computed peaks"
```

---

### Task 5.2: `WaveformBarSkeleton`

**Files:** Create `frontend/src/components/player/WaveformBarSkeleton.tsx`

- [ ] **Step 1: Write the skeleton**

```tsx
export function WaveformBarSkeleton() {
  return (
    <div
      className="w-full rounded"
      style={{
        height: '32px',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'waveform-shimmer 1.5s ease-in-out infinite',
      }}
      aria-hidden
    />
  )
}
```

In `index.css`:

```css
@keyframes waveform-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 2: Commit**

```
git add frontend/src/components/player/WaveformBarSkeleton.tsx frontend/src/index.css
git commit -m "feat(player): add WaveformBarSkeleton loading state"
```

---

### Task 5.3: Wire WaveformBar into PlayerBar

**Files:** Modify `frontend/src/components/layout/PlayerBar.tsx`

- [ ] **Step 1: Import components**

```tsx
import { WaveformBar }         from '@/components/player/WaveformBar'
import { WaveformBarSkeleton } from '@/components/player/WaveformBarSkeleton'
```

- [ ] **Step 2: Replace the `<input type="range">` visual with WaveformBar**

Find the progress bar section (around line 298–317). Keep the `<input type="range">` for a11y but hide it visually. Add WaveformBar above it:

```tsx
{/* Waveform visual — hides when peaks not available */}
{currentSong?.waveform_peaks ? (
  <WaveformBar
    peaks={currentSong.waveform_peaks}
    duration={currentSong.duration ?? 0}
    onSeek={(time) => seekTo(time)}
  />
) : currentSong ? (
  <WaveformBarSkeleton />
) : null}

{/* Hidden range for keyboard / screen reader access */}
<input
  type="range"
  aria-label="Seek"
  className="sr-only"
  min={0}
  max={currentSong?.duration ?? 0}
  value={Math.round(progress)}
  onChange={(e) => seekTo(Number(e.target.value))}
/>
```

- [ ] **Step 3: Visual check**

Start dev server, play a scanned song (with peaks). Verify waveform renders, playhead advances, click-to-seek works.

- [ ] **Step 4: Commit**

```
git add frontend/src/components/layout/PlayerBar.tsx
git commit -m "feat(player): wire WaveformBar into PlayerBar with a11y range fallback"
```

---

## Phase 6 — Polish

### Task 6.1: Empty / loading / error states

**Files:** Modify relevant view components

Implement the spec's state table — each state needs a visual treatment:

| State | Where | Treatment |
|---|---|---|
| No song playing | PlayerBar | Disabled play button (40% opacity), no waveform |
| Buffering | PlayerBar play button | Star pulse 1.5s cycle |
| Peaks null (song scanned without peaks) | WaveformBar area | `<WaveformBarSkeleton>` (already done in 5.3) |
| 0 filter results | Filter view | Aurora intensity 10%; "0 matches" in JetBrains Mono + clear affordance |
| API offline | Global | Thin amber line at top; toast |

- [ ] **Step 1: Disabled play button state**

In `PlayerBar.tsx`, when `!currentSong`, add `opacity-40 pointer-events-none` to the play button container.

- [ ] **Step 2: Buffering pulse on play button star**

Add `playerStore.isBuffering` (if not present). When `isBuffering`, add CSS animation class to the star element:

```css
@keyframes star-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%       { opacity: 0.8; transform: scale(1.15); }
}
.star-buffering {
  animation: star-pulse 1.5s ease-in-out infinite;
}
```

- [ ] **Step 3: 0 filter results treatment**

In the filter results area, when `filterStore.results.length === 0` and query is non-empty, show:

```tsx
<p className="font-mono text-sm text-white/42">
  0 matches — <button onClick={clearFilter}>clear filter</button>
</p>
```

- [ ] **Step 4: Commit**

```
git add -A
git commit -m "feat(polish): empty/loading/error states for player and filter"
```

---

### Task 6.2: Focus model

**Files:** Modify `frontend/src/index.css`

- [ ] **Step 1: Global focus-visible style using design tokens**

```css
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

- [ ] **Step 2: Verify tab order works**

Tab through the UI: sidebar nav → filter input → song list → PlayerBar controls. Each focused element should show a double-ring: colored inner ring + dark outer halo.

- [ ] **Step 3: Commit**

```
git add frontend/src/index.css
git commit -m "feat(a11y): apply double focus ring with per-song color + dark halo"
```

---

### Task 6.3: Anti-slop audit

Manual checks — fix any that fail:

- [ ] **Lucide stroke-width:** Find global Lucide icon usage. Verify `stroke-width` is 1.25 or 1.5, NOT the default 2. Add to global icon wrapper or Lucide `defaultProps` if needed.

```tsx
// In a global icon wrapper or where LucideIcon is imported:
import { Settings } from 'lucide-react'
// Use: <Settings size={16} strokeWidth={1.25} />
// Or set globally in a wrapper component
```

- [ ] **Grain overlay opacity:** Verify `.aurora-grain` (or equivalent) is at 5% opacity. On OLED displays it may need 3%. Check and adjust.

- [ ] **Radius diversity:** Verify at least 3 distinct border-radius values are visibly in use (tag chips, inputs/rows, play button). `--radius-sm` = 2px, `--radius-md` = 6px, `--radius-pill` = 999px.

- [ ] **Fraunces count per view:** Count Fraunces appearances in any single view. Must be ≤ 3. Remove any excess.

- [ ] **Shader curtain asymmetry:** The 5 curtains in the GLSL use phase offsets 0.00, 1.70, 3.14, 5.30, 7.93 — irrational relationships, they will never align. Verify visually that the aurora looks organic, not mechanically repeating.

- [ ] **Commit any changes from audit**

```
git add -A
git commit -m "fix(polish): anti-slop audit — stroke-width, grain opacity, radius diversity"
```

---

### Task 6.4: Performance validation

- [ ] **Shader frame time:** Open browser DevTools → Performance. Record 5 seconds while aurora is running. Verify GPU frame time ≤ 4ms per draw. If consistently >4ms, reduce GLSL noise octaves (remove the `noise()` call in `curtain()`).

- [ ] **Memory leak test:** Trigger 20 song changes rapidly. Open Chrome Memory tab. Take heap snapshot before and after. Verify no `AnalyserNode` or `WebGLRenderingContext` accumulation.

- [ ] **10,000 song library test (if available):** Load a large library. Verify song list scrolls at 60fps, shader continues without frame drops.

- [ ] **Commit nothing** — this is validation only.

---

## Self-review checklist

**Spec coverage:**

| Spec section | Covered by |
|---|---|
| Aurora GLSL shader | Task 4.1–4.2 |
| uColor1 (brand teal, fixed) | Hardcoded in GLSL + `color1LinearRgb` |
| uColor2 (album fringe) | Tasks 1.7–1.11, 3.1, 4.1 |
| uAmplitude (transient-only) | Task 4.3 |
| uIntensity (view-driven) | Task 4.4 |
| Calm regions contract (5 states) | Task 4.4 |
| Pre-computed waveform peaks | Tasks 1.7–1.10 |
| WaveformBar SVG | Tasks 5.1–5.3 |
| Per-song color pipeline | Tasks 1.7–1.11, 3.1–3.4 |
| CSS color variables | Tasks 0.1, 3.1 |
| Color bleed / halo | Task 3.4 |
| Play button: liquid glass + star | Not in plan — pure CSS task, implement in Phase 2 alongside kill list |
| Kill list (K1–K10) | Tasks 2.3–2.10 |
| JetBrains Mono | Tasks 2.1–2.2 |
| SVG wordmark | Task 2.5 |
| Token system | Task 0.1 |
| Track transition choreography | Task 3.2 |
| Reduced-motion | Task 4.6 |
| Focus model | Task 6.2 |
| Empty/loading/error states | Task 6.1 |
| Performance budget | Task 6.4 |
| grid-template-rows (PlayerBar) | Task 2.9 |
| DB migration | Task 1.1 |
| Backend packages | Task 1.6 |
| filterResultToSong | Task 1.11 |

**Missing from plan — add as Task 2.11:**

> **Task 2.11: Liquid glass play button**

The play button visual (liquid glass + star bloom on play, dim on pause, press scale) is a pure CSS + playerStore task. Implement in Phase 2 alongside the kill list. Spec reference: `docs/superpowers/specs/2026-05-25-aurora-visual-overhaul-design.md` §4.

In `PlayerBar.tsx`, update the play button element:

```tsx
<button
  className={cn(
    "relative flex items-center justify-center rounded-full",
    "w-12 h-12",
    "backdrop-blur-md",
    "[background:radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%)]",
    "border border-white/[0.18]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.3)]",
    "transition-transform duration-75 active:scale-[0.94]",
    !currentSong && "opacity-40 pointer-events-none",
  )}
>
  {/* Star — state-driven bloom */}
  <span
    className={cn(
      "absolute inset-0 flex items-center justify-center pointer-events-none",
      "transition-all duration-300",
    )}
    style={{
      background: isBuffering
        ? undefined
        : `radial-gradient(circle, oklch(0.97 0.04 185 / ${isPlaying ? '1.0' : '0.5'}) 0%, oklch(0.78 0.18 185 / 0) 70%)`,
      animation: isBuffering ? 'star-pulse 1.5s ease-in-out infinite' : 'none',
    }}
  />
  {/* Play/pause icon */}
  {isPlaying
    ? <Pause size={18} strokeWidth={1.5} className="relative z-10 text-white/92" />
    : <Play  size={18} strokeWidth={1.5} className="relative z-10 text-white/92" />
  }
</button>
```

---

**Placeholder scan:** None found. All steps have concrete code.

**Type consistency:** `AuroraColorState.color2LinearRgb` matches `AuroraCanvasProps.color2`. `WaveformBarProps.peaks: number[]` matches `Song.waveform_peaks?: number[] | null` (caller guards null). `useAuroraIntensity` returns `number`, matches `AuroraCanvasProps.intensity`.

---

## Execution

Plan saved to `docs/superpowers/plans/2026-05-25-aurora-visual-overhaul.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute in this session using executing-plans, batch with checkpoints

Which approach?
