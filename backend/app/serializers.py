"""Canonical song serializers.

Every endpoint that returns song data should use these functions
instead of constructing dicts or SongResponse objects by hand.
"""
import json
import sqlite3


def _safe_json_loads(raw):
    """Safely parse JSON, returning None on any failure."""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def parse_tags(tags_str: str | None) -> list[str]:
    """Parse a comma-separated tag string into a deduplicated, ordered list."""
    if not tags_str:
        return []
    return list(dict.fromkeys(t.strip() for t in tags_str.split(",") if t.strip()))


def parse_playlist_refs(playlists_str: str | None) -> list[dict]:
    """Parse a GROUP_CONCAT playlist string (id:name,...) into [{id, name}]."""
    if not playlists_str:
        return []
    result = []
    seen: set[int] = set()
    for item in playlists_str.split(","):
        if ":" in item:
            id_part, name_part = item.split(":", 1)
            try:
                pid = int(id_part)
            except ValueError:
                continue
            if pid not in seen:
                seen.add(pid)
                result.append({"id": pid, "name": name_part.strip()})
    return result


def song_row_to_dict(row: sqlite3.Row, *, include_peaks: bool = True) -> dict:
    """Convert a song database row to a response dict.

    Works with both SONG_SELECT_QUERY (has playlists aggregation, created_at,
    updated_at) and PLAYLIST_SONG_SELECT_QUERY (has start_time_ms,
    end_time_ms, position, no playlist aggregation).

    Columns that may or may not be present in the row are handled gracefully.
    """
    raw_art = row["album_art_path"] if "album_art_path" in row.keys() else None
    raw_artists = row["artists"] if "artists" in row.keys() else None
    raw_featured = row["featured_artists"] if "featured_artists" in row.keys() else None

    result = {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "artists": _safe_json_loads(raw_artists),
        "featured_artists": _safe_json_loads(raw_featured),
        "duration": row["duration"],
        "file_path": row["file_path"],
        "file_format": row["file_format"] if "file_format" in row.keys() else None,
        "album_art_path": raw_art if raw_art else None,
        "source": row["source"],
        "tags": parse_tags(row["tags"]),
        "playlists": parse_playlist_refs(
            row["playlists"] if "playlists" in row.keys() else None
        ),
        "created_at": row["created_at"] if "created_at" in row.keys() else "",
        "updated_at": row["updated_at"] if "updated_at" in row.keys() else "",
        "start_time_ms": row["start_time_ms"] if "start_time_ms" in row.keys() else 0,
        "end_time_ms": row["end_time_ms"] if "end_time_ms" in row.keys() else 0,
        "position": row["position"] if "position" in row.keys() else None,
        "bitrate": row["bitrate"] if "bitrate" in row.keys() else None,
        "sample_rate": row["sample_rate"] if "sample_rate" in row.keys() else None,
        "bit_depth": row["bit_depth"] if "bit_depth" in row.keys() else None,
        "file_size": row["file_size"] if "file_size" in row.keys() else None,
        "dominant_color": row["dominant_color"] if "dominant_color" in row.keys() else None,
        "dominant_color_2": row["dominant_color_2"] if "dominant_color_2" in row.keys() else None,
        "replaygain_track_gain": row["replaygain_track_gain"] if "replaygain_track_gain" in row.keys() else None,
        "replaygain_track_peak": row["replaygain_track_peak"] if "replaygain_track_peak" in row.keys() else None,
        "replaygain_album_gain": row["replaygain_album_gain"] if "replaygain_album_gain" in row.keys() else None,
        "replaygain_album_peak": row["replaygain_album_peak"] if "replaygain_album_peak" in row.keys() else None,
        "stream_url": row["stream_url"] if "stream_url" in row.keys() else None,
        "stream_url_expires_at": row["stream_url_expires_at"] if "stream_url_expires_at" in row.keys() else None,
        "artwork_url": row["artwork_url"] if "artwork_url" in row.keys() else None,
    }

    if include_peaks:
        raw_peaks = row["waveform_peaks"] if "waveform_peaks" in row.keys() else None
        result["waveform_peaks"] = _safe_json_loads(raw_peaks)

    return result


def strip_peaks(d: dict) -> dict:
    """Remove waveform_peaks from a song dict (for list/filter payloads)."""
    d.pop("waveform_peaks", None)
    return d
