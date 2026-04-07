"""Songs router."""
import sqlite3
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone

from app.database import get_db
from app.models import SongCreate, SongResponse, SongUpdate

router = APIRouter(tags=["songs"])


def _get_utc_now() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def song_row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a database row (from joined query) to a response dict.
    
    Handles parsing of comma-separated tags and playlists strings into lists.
    """
    tags_str = row["tags"] if row["tags"] else ""
    playlists_str = row["playlists"] if row["playlists"] else ""
    
    tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []
    playlists = [p.strip() for p in playlists_str.split(",") if p.strip()] if playlists_str else []
    
    return {
        "id": row["id"],
        "title": row["title"],
        "artist": row["artist"],
        "album": row["album"],
        "duration": row["duration"],
        "file_path": row["file_path"],
        "source": row["source"],
        "tags": tags,
        "playlists": playlists,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.get("/songs")
def list_songs(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
):
    """List all songs with optional search, limit, and offset."""
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Build the query with LEFT JOINs for tags and playlists
    query = """
        SELECT 
            s.id,
            s.title,
            s.artist,
            s.album,
            s.duration,
            s.file_path,
            s.source,
            GROUP_CONCAT(t.name) as tags,
            GROUP_CONCAT(p.name) as playlists,
            s.created_at,
            s.updated_at
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
    """
    
    params = []
    where_clauses = []
    
    if search:
        where_clauses.append("(s.title LIKE ? OR s.artist LIKE ?)")
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern])
    
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
    
    query += " GROUP BY s.id ORDER BY s.title ASC"
    
    if limit is not None and limit > 0:
        query += " LIMIT ?"
        params.append(limit)
    
    if offset is not None and offset >= 0:
        query += " OFFSET ?"
        params.append(offset)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Get total count for pagination
    count_query = """
        SELECT COUNT(*) as total
        FROM songs s
    """
    count_params = []
    where_clauses = []
    
    if search:
        where_clauses.append("(s.title LIKE ? OR s.artist LIKE ?)")
        search_pattern = f"%{search}%"
        count_params.extend([search_pattern, search_pattern])
    
    if where_clauses:
        count_query += " WHERE " + " AND ".join(where_clauses)
    
    cursor.execute(count_query, count_params)
    total = cursor.fetchone()["total"]
    
    conn.close()
    
    data = [song_row_to_dict(row) for row in rows]
    
    return {
        "data": data,
        "total": total,
        "message": "ok",
    }


@router.get("/songs/{song_id}")
def get_song(song_id: int):
    """Get a song by ID."""
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Build the query with LEFT JOINs for tags and playlists
    query = """
        SELECT 
            s.id,
            s.title,
            s.artist,
            s.album,
            s.duration,
            s.file_path,
            s.source,
            GROUP_CONCAT(t.name) as tags,
            GROUP_CONCAT(p.name) as playlists,
            s.created_at,
            s.updated_at
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
        WHERE s.id = ?
        GROUP BY s.id
    """
    
    cursor.execute(query, (song_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")
    
    return song_row_to_dict(row)


@router.post("/songs", status_code=201, response_model=SongResponse)
def create_song(song: SongCreate):
    """Create a new song."""
    # Validate title and artist are non-empty (Pydantic already enforces min_length=1)
    if not song.title or not song.artist:
        raise HTTPException(status_code=400, detail="title and artist must be non-empty")

    conn = get_db()
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
        conn.close()
        raise HTTPException(status_code=409, detail="file_path already exists")

    # Return the created song with empty tags and playlists
    conn.close()
    return SongResponse(
        id=song_id,
        title=song.title,
        artist=song.artist,
        album=song.album,
        duration=song.duration,
        file_path=song.file_path,
        source="manual",
        tags=[],
        playlists=[],
        created_at=now,
        updated_at=now,
    )


@router.put("/songs/{song_id}", response_model=SongResponse)
def update_song(song_id: int, song_update: SongUpdate):
    """Update a song by ID."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if song exists
    cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Validate title and artist are non-empty if provided
    if song_update.title is not None and not song_update.title:
        conn.close()
        raise HTTPException(status_code=400, detail="title must be non-empty")
    if song_update.artist is not None and not song_update.artist:
        conn.close()
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
    
    # Fetch the updated song with joined query
    query = """
        SELECT 
            s.id,
            s.title,
            s.artist,
            s.album,
            s.duration,
            s.file_path,
            s.source,
            GROUP_CONCAT(t.name) as tags,
            GROUP_CONCAT(p.name) as playlists,
            s.created_at,
            s.updated_at
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
        WHERE s.id = ?
        GROUP BY s.id
    """
    
    cursor.execute(query, (song_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")
    
    return song_row_to_dict(row)
