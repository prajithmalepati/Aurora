"""File scanner for audio files using mutagen."""
import hashlib
import sqlite3
import mutagen
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

# Extracted art is stored here; deduplicated by SHA-1 hash.
ALBUM_ART_DIR = Path(__file__).parent.parent.parent / "album-art"


AUDIO_EXTENSIONS = {
    ".mp3", ".flac", ".m4a", ".ogg", ".opus",
    ".wav", ".wma", ".aac", ".aiff", ".ape",
    ".wv",  # WavPack
}


def extract_album_art(file_path: str, art_dir: Path) -> str | None:
    """
    Extract embedded album art from an audio file and save to art_dir.
    Returns the saved filename (e.g. 'abc123.jpg') or None.
    Deduplicates by SHA-1: if the same image bytes already exist, reuses the file.
    Supports ID3/APIC (MP3), FLAC pictures, MP4/M4A covr, and OGG METADATA_BLOCK_PICTURE.
    """
    art_data: bytes | None = None
    art_mime = "image/jpeg"

    try:
        audio = mutagen.File(file_path)
        if audio is None:
            return None

        # FLAC — exposes .pictures list directly
        if hasattr(audio, "pictures") and audio.pictures:
            pic = audio.pictures[0]
            art_data = pic.data
            art_mime = pic.mime or "image/jpeg"

        elif audio.tags is not None:
            tags = audio.tags

            # ID3 APIC frames (MP3, WAV+ID3, AIFF)
            for key in list(tags.keys()):
                if key.startswith("APIC"):
                    apic = tags[key]
                    art_data = apic.data
                    art_mime = getattr(apic, "mime", "image/jpeg") or "image/jpeg"
                    break

            # MP4/M4A covr atom
            if art_data is None and "covr" in tags:
                covr = tags["covr"]
                if covr:
                    item = covr[0]
                    art_data = bytes(item)
                    # imageformat 13 = JPEG, 14 = PNG
                    fmt = getattr(item, "imageformat", 13)
                    art_mime = "image/png" if fmt == 14 else "image/jpeg"

            # OGG/Opus — base64-encoded FLAC Picture blocks in Vorbis comments
            if art_data is None and "metadata_block_picture" in tags:
                import base64
                from mutagen.flac import Picture
                for b64 in tags["metadata_block_picture"]:
                    try:
                        pic = Picture(base64.b64decode(b64))
                        art_data = pic.data
                        art_mime = pic.mime or "image/jpeg"
                        break
                    except Exception:
                        pass

    except Exception:
        return None

    if not art_data:
        return None

    ext = "png" if "png" in art_mime.lower() else "jpg"
    art_hash = hashlib.sha1(art_data).hexdigest()
    filename = f"{art_hash}.{ext}"
    dest = art_dir / filename

    if not dest.exists():
        art_dir.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(art_data)

    return filename


def _first_or_none(value: Any) -> str | None:
    """Mutagen returns tag values as lists. Get first item or None."""
    if value and isinstance(value, list) and len(value) > 0:
        return str(value[0])
    if value and isinstance(value, str):
        return value
    return None


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
    except Exception:
        # Some files need explicit MP3 handling
        try:
            audio = MP3(file_path, ID3=EasyID3)
        except Exception:
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
        "file_format": path.suffix.lstrip(".").lower(),
    }


def scan_folder(folder_path: str) -> tuple[list[dict], list[dict]]:
    """
    Recursively scan a folder for audio files.
    Returns tuple of (list of metadata dicts, list of errors).
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


def import_scanned_songs(
    db_connection: sqlite3.Connection,
    folder_path: str,
    playlist_name: str | None = None,
) -> dict:
    """
    Scan folder, import new songs, optionally add to playlist.
    Returns summary of what was imported.
    """
    import sqlite3
    
    # 1. Scan the folder
    found_songs, scan_errors = scan_folder(folder_path)
    
    scanned_count = len(found_songs) + len(scan_errors)
    imported = []
    skipped = 0
    art_extracted = 0

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

        # Extract album art (best-effort; never blocks the import)
        album_art_path = None
        try:
            filename = extract_album_art(metadata["file_path"], ALBUM_ART_DIR)
            if filename:
                album_art_path = filename
                art_extracted += 1
        except Exception:
            pass

        # Insert song
        cursor = db_connection.execute(
            """INSERT INTO songs (title, artist, album, duration, file_path, file_format, album_art_path, source, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'local_scan', ?, ?)""",
            (metadata["title"], metadata["artist"], metadata["album"],
             metadata["duration"], metadata["file_path"], metadata.get("file_format"),
             album_art_path, now, now)
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
        "art_extracted": art_extracted,
    }