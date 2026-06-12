"""Songs router."""
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from datetime import datetime, timezone

from app.database import get_db, get_db_ctx, SONG_SELECT_QUERY, COUNT_SONG_QUERY
from app.models import SongCreate, SongResponse, SongUpdate
from app.cache import song_cache
from app.serializers import song_row_to_dict as _song_row_to_dict

router = APIRouter(tags=["songs"])

# Re-export for routers that import song_row_to_dict from here
song_row_to_dict = _song_row_to_dict


def _get_utc_now() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


ALLOWED_SORT_FIELDS = {"title", "artist", "album", "duration", "created_at"}
SORT_COL_MAP = {
    "title": "s.title COLLATE NOCASE",
    "artist": "s.artist COLLATE NOCASE",
    "album": "s.album COLLATE NOCASE",
    "duration": "s.duration",
    "created_at": "s.created_at",
}


@router.get("/songs")
def list_songs(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
    sort: str = Query("title"),
    order: str = Query("asc"),
):
    """List all songs with optional search, sort, limit, and offset."""
    if sort not in ALLOWED_SORT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort field. Allowed: {', '.join(sorted(ALLOWED_SORT_FIELDS))}",
        )
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="order must be 'asc' or 'desc'")

    order_str = "ASC" if order == "asc" else "DESC"
    sort_col = SORT_COL_MAP[sort]

    # Check cache for identical query (only cache non-search queries)
    cache_key = f"songs:{sort}:{order}:{limit}:{offset}"
    if not search:
        cached = song_cache.get(cache_key)
        if cached is not None:
            return cached

    with get_db_ctx() as conn:
        cursor = conn.cursor()

        query = SONG_SELECT_QUERY

        params = []
        where_clauses = []

        if search:
            where_clauses.append("(s.title LIKE ? OR s.artist LIKE ?)")
            search_pattern = f"%{search}%"
            params.extend([search_pattern, search_pattern])

        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)

        query += f" GROUP BY s.id ORDER BY {sort_col} {order_str}, s.id ASC"

        if limit is not None and limit > 0:
            query += " LIMIT ?"
            params.append(limit)

        if offset is not None and offset >= 0:
            query += " OFFSET ?"
            params.append(offset)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        count_query = COUNT_SONG_QUERY
        count_params = []
        count_where = []

        if search:
            count_where.append("(s.title LIKE ? OR s.artist LIKE ?)")
            search_pattern = f"%{search}%"
            count_params.extend([search_pattern, search_pattern])

        if count_where:
            count_query += " WHERE " + " AND ".join(count_where)

        cursor.execute(count_query, count_params)
        total = cursor.fetchone()["total"]

    data = [song_row_to_dict(row, include_peaks=False) for row in rows]

    result = {"data": data, "meta": {"total": total}, "message": "ok"}

    # Cache non-search results
    if not search:
        song_cache.set(cache_key, result)

    return result


@router.get("/songs/{song_id}")
def get_song(song_id: int):
    """Get a song by ID."""
    
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Build the query with LEFT JOINs for tags and playlists
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"

        cursor.execute(query, (song_id,))
        row = cursor.fetchone()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")

    return {"data": song_row_to_dict(row), "message": "ok"}


@router.get("/songs/{song_id}/stream")
def stream_song(song_id: int):
    """Stream a song's audio file to the browser."""
    
    # MIME type mapping
    mime_map = {
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
        ".wma": "audio/x-ms-wma",
        ".opus": "audio/opus",
    }
    
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Get the song by ID
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"

        cursor.execute(query, (song_id,))
        row = cursor.fetchone()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")
    
    file_path = row["file_path"]
    
    if file_path is None:
        raise HTTPException(status_code=404, detail="No audio file available")
    
    # Check if file exists on disk
    if not Path(file_path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")
    
    # Detect MIME type from file extension
    mime_type = mime_map.get(Path(file_path).suffix.lower(), "application/octet-stream")
    
    return FileResponse(str(file_path), media_type=mime_type)


@router.get("/songs/{song_id}/bleed-thumb")
def get_bleed_thumb(song_id: int):
    """Return the 64×64 PNG bleed thumbnail for a song's album art bright region."""
    from fastapi.responses import Response
    with get_db_ctx() as conn:
        row = conn.execute(
            "SELECT bleed_thumb FROM songs WHERE id = ?", (song_id,)
        ).fetchone()

    if not row or not row["bleed_thumb"]:
        raise HTTPException(status_code=404, detail="No bleed thumb available")

    return Response(
        content=bytes(row["bleed_thumb"]),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.delete("/songs/{song_id}")
def delete_song(song_id: int):
    """Delete a song by ID."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Check if song exists
        cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Song not found")
        
        # Delete the song (cascading deletes handle song_tags and playlist_songs)
        cursor.execute("DELETE FROM songs WHERE id = ?", (song_id,))
        conn.commit()

    # Invalidate song caches
    song_cache.invalidate_prefix("songs:")

    return {"data": None, "message": "Song deleted successfully"}


@router.post("/songs", status_code=201)
def create_song(song: SongCreate):
    """Create a new song."""
    # Validate title and artist are non-empty (Pydantic already enforces min_length=1)
    if not song.title or not song.artist:
        raise HTTPException(status_code=400, detail="title and artist must be non-empty")

    with get_db_ctx() as conn:
        cursor = conn.cursor()
        now = _get_utc_now()

        try:
            cursor.execute(
                """
                INSERT INTO songs (title, artist, album, duration, file_path, source, external_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'manual', NULL, ?, ?)
                """,
                (
                    song.title,
                    song.artist,
                    song.album,
                    song.duration,
                    song.file_path,
                    now,
                    now,
                ),
            )
            conn.commit()
            song_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="file_path already exists")

        # Invalidate song caches
        song_cache.invalidate_prefix("songs:")

    # Fetch and return the full song (consistent with GET /songs/{id})
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"
        cursor.execute(query, (song_id,))
        row = cursor.fetchone()

    return {"data": song_row_to_dict(row), "message": "Song created successfully"}


@router.get("/album-art/{filename}")
def serve_album_art(filename: str):
    """Serve an extracted album art image by its hash-based filename."""
    from app.services.file_scanner import ALBUM_ART_DIR
    # Strip any directory components to prevent path traversal
    safe_name = Path(filename).name
    art_path = ALBUM_ART_DIR / safe_name
    if not art_path.exists():
        raise HTTPException(status_code=404, detail="Album art not found")
    mime = "image/png" if safe_name.endswith(".png") else "image/jpeg"
    return FileResponse(str(art_path), media_type=mime)


@router.put("/songs/{song_id}")
def update_song(song_id: int, song_update: SongUpdate):
    """Update a song by ID."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Check if song exists
        cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Song not found")
        
        # Validate title and artist are non-empty if provided
        if song_update.title is not None and not song_update.title:
            raise HTTPException(status_code=400, detail="title must be non-empty")
        if song_update.artist is not None and not song_update.artist:
            raise HTTPException(status_code=400, detail="artist must be non-empty")
        
        now = _get_utc_now()
        
        # Build update query with only non-None fields
        update_fields = []
        params = []
        
        if song_update.title is not None:
            update_fields.append("title = ?")
            params.append(song_update.title)
        if song_update.artist is not None:
            update_fields.append("artist = ?")
            params.append(song_update.artist)
        if song_update.album is not None:
            update_fields.append("album = ?")
            params.append(song_update.album)
        if song_update.duration is not None:
            update_fields.append("duration = ?")
            params.append(song_update.duration)
        
        update_fields.append("updated_at = ?")
        params.append(now)
        
        params.append(song_id)
        
        cursor.execute(
            f"UPDATE songs SET {', '.join(update_fields)} WHERE id = ?",
            params
        )
        conn.commit()

        # Invalidate song caches (update can happen from any view)
        song_cache.invalidate_prefix("songs:")

        # Fetch the updated song with joined query
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"

        cursor.execute(query, (song_id,))
        row = cursor.fetchone()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")

    return {"data": song_row_to_dict(row), "message": "ok"}
