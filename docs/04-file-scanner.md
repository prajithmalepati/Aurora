# Aurora — File Scanner Specification
## Document 4 of 6 | 

---

## Purpose

Scan a local folder for audio files, extract metadata (title, artist, album, duration) using the `mutagen` library, and import them as songs into the Aurora database.

---

## Library

**`mutagen`** — The standard Python library for reading audio metadata.

```
pip install mutagen
```

- Zero dependencies outside Python stdlib
- Supports: MP3, FLAC, M4A/AAC, OGG Vorbis, OGG Opus, WAV, WMA, AIFF, and more
- Reads ID3v1, ID3v2, Vorbis Comments, MP4 metadata, APEv2 tags

---

## Supported File Extensions

```python
AUDIO_EXTENSIONS = {
    ".mp3", ".flac", ".m4a", ".ogg", ".opus",
    ".wav", ".wma", ".aac", ".aiff", ".ape",
    ".wv",  # WavPack
}
```

---

## Metadata Extraction

Use `mutagen.File()` which auto-detects the format:

```python
import mutagen
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
from pathlib import Path


def extract_metadata(file_path: str) -> dict | None:
    """
    Extract metadata from an audio file.
    Returns dict with title, artist, album, duration or None on failure.
    """
    path = Path(file_path)
    
    try:
        audio = mutagen.File(file_path, easy=True)
        
        if audio is None:
            return None
        
        # Duration in seconds (float → round to int)
        duration = int(audio.info.length) if audio.info and audio.info.length else None
        
        # Extract tags — mutagen returns lists for multi-value fields
        title = _first_or_none(audio.get("title"))
        artist = _first_or_none(audio.get("artist"))
        album = _first_or_none(audio.get("album"))
        
        # Fallbacks
        if not title:
            title = path.stem  # filename without extension
        if not artist:
            artist = "Unknown Artist"
        
        return {
            "title": title.strip(),
            "artist": artist.strip(),
            "album": album.strip() if album else None,
            "duration": duration,
            "file_path": str(path.resolve()),  # absolute path
        }
        
    except Exception as e:
        return None


def _first_or_none(value) -> str | None:
    """Mutagen returns tag values as lists. Get first item or None."""
    if value and isinstance(value, list) and len(value) > 0:
        return str(value[0])
    if value and isinstance(value, str):
        return value
    return None
```

**Why `easy=True`?** — Mutagen's "easy" mode normalizes tag keys across formats. `audio.get("title")` works for MP3 (ID3 TIT2), FLAC (Vorbis TITLE), M4A (©nam), etc. Without easy mode, you'd need format-specific key names.

**Edge case with MP3 files:** Some MP3 files have ID3 tags but `mutagen.File(path, easy=True)` returns an MP3 object without EasyID3 interface. In that case, fall back:

```python
try:
    audio = mutagen.File(file_path, easy=True)
    if audio is None:
        return None
except Exception:
    # Some files need explicit MP3 handling
    try:
        audio = MP3(file_path, ID3=EasyID3)
    except Exception:
        return None
```

---

## Folder Scanning

```python
from pathlib import Path


def scan_folder(folder_path: str) -> list[dict]:
    """
    Recursively scan a folder for audio files.
    Returns list of metadata dicts for each valid audio file found.
    """
    root = Path(folder_path)
    
    if not root.exists():
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    if not root.is_dir():
        raise NotADirectoryError(f"Not a directory: {folder_path}")
    
    results = []
    errors = []
    
    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in AUDIO_EXTENSIONS:
            continue
        
        metadata = extract_metadata(str(file_path))
        
        if metadata:
            results.append(metadata)
        else:
            errors.append({
                "file": str(file_path),
                "error": "Could not read metadata"
            })
    
    return results, errors
```

---

## Import Flow

The complete flow for `POST /api/scan`:

```python
def import_scanned_songs(
    db_connection,
    folder_path: str,
    playlist_name: str | None = None,
) -> dict:
    """
    Scan folder, import new songs, optionally add to playlist.
    Returns summary of what was imported.
    """
    # 1. Scan the folder
    found_songs, scan_errors = scan_folder(folder_path)
    
    scanned_count = len(found_songs) + len(scan_errors)
    imported = []
    skipped = 0
    
    now = datetime.now(timezone.utc).isoformat()
    
    # 2. Import each song
    for metadata in found_songs:
        # Check for duplicate by file_path
        existing = db_connection.execute(
            "SELECT id FROM songs WHERE file_path = ?",
            (metadata["file_path"],)
        ).fetchone()
        
        if existing:
            skipped += 1
            continue
        
        # Insert song
        cursor = db_connection.execute(
            """INSERT INTO songs (title, artist, album, duration, file_path, source, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'local_scan', ?, ?)""",
            (metadata["title"], metadata["artist"], metadata["album"],
             metadata["duration"], metadata["file_path"], now, now)
        )
        
        song_id = cursor.lastrowid
        imported.append({
            "id": song_id,
            **metadata
        })
    
    # 3. Optionally add to playlist
    if playlist_name and imported:
        # Create playlist if it doesn't exist
        existing_playlist = db_connection.execute(
            "SELECT id FROM playlists WHERE name = ?",
            (playlist_name,)
        ).fetchone()
        
        if existing_playlist:
            playlist_id = existing_playlist["id"]
        else:
            cursor = db_connection.execute(
                """INSERT INTO playlists (name, created_at, updated_at)
                   VALUES (?, ?, ?)""",
                (playlist_name, now, now)
            )
            playlist_id = cursor.lastrowid
        
        # Get current max position
        max_pos = db_connection.execute(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_songs WHERE playlist_id = ?",
            (playlist_id,)
        ).fetchone()[0]
        
        # Add each imported song to the playlist
        for i, song in enumerate(imported):
            db_connection.execute(
                """INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position, added_at)
                   VALUES (?, ?, ?, ?)""",
                (playlist_id, song["id"], max_pos + 1 + i, now)
            )
    
    db_connection.commit()
    
    return {
        "scanned": scanned_count,
        "imported": len(imported),
        "skipped": skipped,
        "errors": scan_errors,
        "songs": imported,
    }
```

---

## Windows Path Handling

The user is on Windows. File paths will look like:

```
C:\Users\rockz\Music\Rock\Deep Purple - Highway Star.mp3
```

Python's `pathlib.Path` handles this correctly on Windows. Store the path as-is (with backslashes) in the database. `Path.resolve()` gives the absolute path.

**Important:** When comparing paths for duplicate detection, always use the resolved absolute path. Two different relative paths could point to the same file.

---

## File Location

```
backend/app/services/file_scanner.py
```

Exports two main functions:
- `scan_folder(folder_path) -> (list[dict], list[dict])` — scan only, no DB writes
- `import_scanned_songs(db_connection, folder_path, playlist_name) -> dict` — scan + import
