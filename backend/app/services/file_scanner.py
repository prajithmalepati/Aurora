"""File scanner for audio files using mutagen."""
import hashlib
import json
import sqlite3
import threading
import mutagen
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Callable

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


FORMAT_TIER: dict[str, int] = {
    "flac":     6,
    "wav":      5,
    "m4a_alac": 4,
    "ogg":      3,
    "opus":     3,
    "m4a_aac":  2,
    "m4a":      2,  # undetected M4A treated as AAC
    "mp3":      1,
    "aac":      1,
    "wma":      1,
    "aiff":     1,
    "ape":      1,
    "wv":       1,
}


def format_tier(fmt: str) -> int:
    """Return quality rank for a file_format string. Higher = better quality."""
    return FORMAT_TIER.get(fmt.lower() if fmt else "", 0)


def _detect_m4a_format(file_path: str) -> str:
    """
    Distinguish ALAC from AAC inside an .m4a container by reading MP4Info.codec.
    Returns 'm4a_alac' or 'm4a_aac'. Falls back to 'm4a_aac' if undetectable.
    Note: codec detection requires a second mutagen.File() call (non-easy mode).
    """
    try:
        audio = mutagen.File(file_path)
        if audio is not None and hasattr(audio, "info") and hasattr(audio.info, "codec"):
            if audio.info.codec and "alac" in audio.info.codec.lower():
                return "m4a_alac"
    except Exception:
        pass
    return "m4a_aac"


def extract_peaks(file_path: str, num_bins: int = 1000) -> list[float] | None:
    """
    Decode audio to mono 22050Hz and compute max-amplitude per bin.
    Returns list of num_bins floats in [0, 1], or None on failure.

    Pre-validates with mutagen before passing to miniaudio.
    miniaudio is a C-extension: malformed headers can cause crashes (not Python exceptions),
    which would kill the FastAPI process. mutagen is pure Python and safe to probe first.
    """
    try:
        probe = mutagen.File(file_path)
        if probe is None:
            return None
    except Exception:
        return None

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


def extract_dominant_colors(art_data: bytes) -> tuple[str | None, str | None]:
    """
    Pillow MedianCut quantize → top 2 contrast-safe OKLCH colors.
    Returns (dominant_color, dominant_color_2) as oklch() CSS strings, or (None, None).

    Uses Pillow's native C-optimized quantize() — 100x faster than scikit-learn KMeans
    and mathematically designed for exactly this task.
    """
    try:
        from io import BytesIO
        from PIL import Image
        from app.services.color_utils import rgb_to_oklch, clamp_oklch_for_display

        img = Image.open(BytesIO(art_data)).convert("RGB").resize((64, 64), Image.LANCZOS)

        # MedianCut partitions color space into 2 regions, picks centroid of each.
        quantized = img.quantize(colors=2, method=Image.Quantize.MEDIANCUT)
        palette   = quantized.getpalette()  # flat list [R,G,B, R,G,B, ...]

        if not palette or len(palette) < 3:
            return None, None

        colors: list[str] = []
        num_colors = min(2, len(palette) // 3)

        for i in range(num_colors):
            r, g, b = palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]
            L, C, H = rgb_to_oklch(r, g, b)
            colors.append(clamp_oklch_for_display(L, C, H))

        # If only 1 color, duplicate it for the second slot
        if len(colors) == 1:
            colors.append(colors[0])

        return colors[0], colors[1]
    except Exception:
        return None, None


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

    ext = path.suffix.lstrip(".").lower()
    file_format = _detect_m4a_format(file_path) if ext == "m4a" else ext

    # Extract waveform peaks
    waveform_peaks = extract_peaks(str(path))

    # Extract dominant colors + bleed region from album art
    dominant_color: str | None = None
    dominant_color_2: str | None = None
    bleed_thumb: bytes | None = None
    bleed_region_x = bleed_region_y = bleed_region_w = bleed_region_h = 0
    try:
        art_data = _get_art_bytes(audio)
        if art_data:
            dominant_color, dominant_color_2 = extract_dominant_colors(art_data)
            from app.services.color_utils import extract_bright_region
            bleed_thumb, bleed_region_x, bleed_region_y, bleed_region_w, bleed_region_h = \
                extract_bright_region(art_data)
    except Exception:
        pass

    file_mtime: float | None = None
    try:
        file_mtime = path.stat().st_mtime
    except OSError:
        pass

    return {
        "title": title.strip(),
        "artist": artist.strip(),
        "album": album.strip() if album else None,
        "duration": duration,
        "file_path": str(path.resolve()),  # absolute path
        "file_format": file_format,
        "file_mtime": file_mtime,
        "waveform_peaks": waveform_peaks,
        "dominant_color": dominant_color,
        "dominant_color_2": dominant_color_2,
        "bleed_thumb": bleed_thumb,
        "bleed_region_x": bleed_region_x,
        "bleed_region_y": bleed_region_y,
        "bleed_region_w": bleed_region_w,
        "bleed_region_h": bleed_region_h,
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


def _replace_song(
    db: sqlite3.Connection,
    old_id: int,
    metadata: dict,
    album_art_path: str | None,
    now: str,
) -> int:
    """
    Atomically replace an existing song row with a higher-quality version.
    Migrates song_tags and playlist_songs to the new row, then deletes the old row.
    Uses a SQLite SAVEPOINT so a failure rolls back only this operation, not the
    entire import batch.
    Returns the new song_id.
    """
    db.execute("SAVEPOINT replace_song")
    try:
        cursor = db.execute(
            """INSERT INTO songs
                   (title, artist, album, duration, file_path, file_format,
                    album_art_path, source, waveform_peaks, dominant_color,
                    dominant_color_2, bleed_thumb, bleed_region_x, bleed_region_y,
                    bleed_region_w, bleed_region_h, file_mtime, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'local_scan', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (metadata["title"], metadata["artist"], metadata["album"],
             metadata["duration"], metadata["file_path"], metadata.get("file_format"),
             album_art_path,
             json.dumps(metadata.get("waveform_peaks")) if metadata.get("waveform_peaks") else None,
             metadata.get("dominant_color"),
             metadata.get("dominant_color_2"),
             metadata.get("bleed_thumb"),
             metadata.get("bleed_region_x", 0),
             metadata.get("bleed_region_y", 0),
             metadata.get("bleed_region_w", 0),
             metadata.get("bleed_region_h", 0),
             metadata.get("file_mtime"),
             now, now),
        )
        new_id = cursor.lastrowid

        # Migrate tags
        old_tags = db.execute(
            "SELECT tag_id FROM song_tags WHERE song_id = ?", (old_id,)
        ).fetchall()
        for row in old_tags:
            db.execute(
                "INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)",
                (new_id, row[0]),
            )

        # Migrate playlist memberships (preserves position ordering)
        db.execute(
            "UPDATE playlist_songs SET song_id = ? WHERE song_id = ?",
            (new_id, old_id),
        )

        # Delete old song — CASCADE removes its remaining song_tags rows
        db.execute("DELETE FROM songs WHERE id = ?", (old_id,))

        db.execute("RELEASE SAVEPOINT replace_song")
        return new_id
    except Exception:
        db.execute("ROLLBACK TO SAVEPOINT replace_song")
        raise


def import_scanned_songs(
    db_connection: sqlite3.Connection,
    folder_path: str,
    playlist_name: str | None = None,
    cancel_event: threading.Event | None = None,
    progress_cb: Callable | None = None,
) -> dict:
    """
    Scan folder, import new songs, optionally add to playlist.
    Format-aware dedup: if (title, artist) already exists at lower quality,
    the existing song is replaced and its tags/playlists are migrated.
    Supports cancel_event (threading.Event) and progress_cb(dict) for SSE streaming.
    Returns a detailed summary dict.
    """
    # 1. Quick file enumeration for total count
    root = Path(folder_path)
    all_audio_files = [
        f for f in root.rglob("*")
        if f.is_file() and f.suffix.lower() in AUDIO_EXTENSIONS
    ]
    total_files = len(all_audio_files)

    if progress_cb:
        progress_cb({"type": "total", "total": total_files})

    imported: list[dict] = []
    replaced: list[dict] = []
    skipped_exact = 0       # exact file_path match, mtime unchanged
    skipped_same_fmt = 0    # (title, artist) match, same tier, different path
    skipped_lower_fmt = 0   # (title, artist) match, lower quality incoming
    art_extracted = 0
    scan_errors: list[dict] = []
    done = 0

    now = datetime.now(timezone.utc).isoformat()

    # 2. Process each file
    for file_path in all_audio_files:
        if cancel_event and cancel_event.is_set():
            break

        if progress_cb:
            progress_cb({"type": "progress", "done": done, "total": total_files, "current": file_path.name})

        metadata = extract_metadata(str(file_path))
        done += 1

        if not metadata:
            scan_errors.append({"file": str(file_path), "error": "Could not read metadata"})
            continue

        incoming_path = metadata["file_path"]
        incoming_fmt = metadata.get("file_format") or ""
        incoming_mtime = metadata.get("file_mtime")

        # Rule 1: exact file_path match
        exact = db_connection.execute(
            "SELECT id, file_mtime FROM songs WHERE file_path = ?",
            (incoming_path,)
        ).fetchone()
        if exact:
            stored_mtime = exact[1]
            # If mtime unchanged → true duplicate, skip
            if stored_mtime is not None and incoming_mtime is not None and abs(incoming_mtime - stored_mtime) < 1.0:
                skipped_exact += 1
                continue
            # mtime changed → update in place (preserves tags + playlist memberships)
            try:
                art_path_update = None
                try:
                    art_fname = extract_album_art(incoming_path, ALBUM_ART_DIR)
                    if art_fname:
                        art_path_update = art_fname
                        art_extracted += 1
                except Exception:
                    pass
                db_connection.execute(
                    """UPDATE songs SET
                       title=?, artist=?, album=?, duration=?, file_format=?,
                       album_art_path=COALESCE(?, album_art_path),
                       waveform_peaks=?, dominant_color=?, dominant_color_2=?,
                       bleed_thumb=?, bleed_region_x=?, bleed_region_y=?,
                       bleed_region_w=?, bleed_region_h=?, file_mtime=?, updated_at=?
                       WHERE id=?""",
                    (metadata["title"], metadata["artist"], metadata["album"],
                     metadata["duration"], incoming_fmt, art_path_update,
                     json.dumps(metadata.get("waveform_peaks")) if metadata.get("waveform_peaks") else None,
                     metadata.get("dominant_color"), metadata.get("dominant_color_2"),
                     metadata.get("bleed_thumb"),
                     metadata.get("bleed_region_x", 0), metadata.get("bleed_region_y", 0),
                     metadata.get("bleed_region_w", 0), metadata.get("bleed_region_h", 0),
                     incoming_mtime, now, exact[0]),
                )
                imported.append({"id": exact[0], **metadata})
            except Exception as exc:
                scan_errors.append({"file": incoming_path, "error": f"Update failed: {exc}"})
            continue  # done with this file, don't fall through

        # Rule 2–5: check for (title, artist) match
        title_artist_match = db_connection.execute(
            "SELECT id, file_path, file_format FROM songs WHERE title = ? AND artist = ?",
            (metadata["title"], metadata["artist"])
        ).fetchone()

        if title_artist_match:
            existing_id = title_artist_match[0]
            existing_path = title_artist_match[1]
            existing_fmt = title_artist_match[2] or ""

            incoming_tier = format_tier(incoming_fmt)
            existing_tier = format_tier(existing_fmt)

            if incoming_tier > existing_tier:
                # Incoming is HIGHER quality → replace
                album_art_path = None
                try:
                    filename = extract_album_art(incoming_path, ALBUM_ART_DIR)
                    if filename:
                        album_art_path = filename
                        art_extracted += 1
                except Exception:
                    pass

                try:
                    new_id = _replace_song(db_connection, existing_id, metadata, album_art_path, now)
                    replaced.append({
                        "id": new_id,
                        "replaced_path": existing_path,
                        **metadata,
                    })
                except Exception as exc:
                    scan_errors.append({
                        "file": incoming_path,
                        "error": f"Replace failed (kept existing): {exc}",
                    })
            elif incoming_tier == existing_tier:
                skipped_same_fmt += 1
            else:
                skipped_lower_fmt += 1
            continue

        # No (title, artist) match → fresh import
        album_art_path = None
        try:
            filename = extract_album_art(incoming_path, ALBUM_ART_DIR)
            if filename:
                album_art_path = filename
                art_extracted += 1
        except Exception:
            pass

        cursor = db_connection.execute(
            """INSERT INTO songs
                   (title, artist, album, duration, file_path, file_format,
                    album_art_path, source, waveform_peaks, dominant_color,
                    dominant_color_2, bleed_thumb, bleed_region_x, bleed_region_y,
                    bleed_region_w, bleed_region_h, file_mtime, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'local_scan', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (metadata["title"], metadata["artist"], metadata["album"],
             metadata["duration"], incoming_path, incoming_fmt,
             album_art_path,
             json.dumps(metadata.get("waveform_peaks")) if metadata.get("waveform_peaks") else None,
             metadata.get("dominant_color"),
             metadata.get("dominant_color_2"),
             metadata.get("bleed_thumb"),
             metadata.get("bleed_region_x", 0),
             metadata.get("bleed_region_y", 0),
             metadata.get("bleed_region_w", 0),
             metadata.get("bleed_region_h", 0),
             metadata.get("file_mtime"),
             now, now),
        )
        song_id = cursor.lastrowid
        imported.append({"id": song_id, **metadata})

    # 3. Optionally add newly imported songs to a playlist
    if playlist_name and imported:
        existing_playlist = db_connection.execute(
            "SELECT id FROM playlists WHERE name = ?",
            (playlist_name,)
        ).fetchone()

        if existing_playlist:
            playlist_id = existing_playlist[0]
        else:
            cursor = db_connection.execute(
                "INSERT INTO playlists (name, created_at, updated_at) VALUES (?, ?, ?)",
                (playlist_name, now, now),
            )
            playlist_id = cursor.lastrowid

        max_pos = db_connection.execute(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_songs WHERE playlist_id = ?",
            (playlist_id,)
        ).fetchone()[0]

        for i, song in enumerate(imported):
            db_connection.execute(
                "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES (?, ?, ?, ?)",
                (playlist_id, song["id"], max_pos + 1 + i, now),
            )

    db_connection.commit()

    skipped_total = skipped_exact + skipped_same_fmt + skipped_lower_fmt

    result = {
        "scanned": done,
        "imported": len(imported),
        "replaced": len(replaced),
        "skipped": skipped_total,
        "skipped_exact": skipped_exact,
        "skipped_same_format": skipped_same_fmt,
        "skipped_lower_quality": skipped_lower_fmt,
        "errors": scan_errors,
        "songs": imported,
        "replaced_songs": replaced,
        "art_extracted": art_extracted,
    }

    if progress_cb:
        progress_cb({"type": "done", **result})

    return result