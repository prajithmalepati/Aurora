"""Playlists router."""
import sqlite3
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from app.database import get_db
from app.models import PlaylistCreate, PlaylistResponse, SongResponse

router = APIRouter(tags=["playlists"])


def _get_utc_now() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.post("/playlists", status_code=201)
def create_playlist(playlist: PlaylistCreate):
    """Create a new playlist."""
    name = playlist.name.strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="name is empty")
    
    conn = get_db()
    cursor = conn.cursor()
    now = _get_utc_now()
    
    try:
        cursor.execute(
            """
            INSERT INTO playlists (name, color, emoji, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, playlist.color, playlist.emoji, now, now),
        )
        conn.commit()
        playlist_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="playlist with this name already exists")
    
    conn.close()
    return PlaylistResponse(
        id=playlist_id,
        name=name,
        color=playlist.color,
        emoji=playlist.emoji,
        song_count=0,
        created_at=now,
        updated_at=now,
    )


@router.get("/playlists")
def list_playlists():
    """List all playlists with song_count using LEFT JOIN on playlist_songs, ordered by name."""
    conn = get_db()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            p.id,
            p.name,
            p.color,
            p.emoji,
            COUNT(ps.song_id) as song_count,
            p.created_at,
            p.updated_at
        FROM playlists p
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
        GROUP BY p.id
        ORDER BY p.name ASC
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    
    data = [
        PlaylistResponse(
            id=row["id"],
            name=row["name"],
            color=row["color"],
            emoji=row["emoji"],
            song_count=row["song_count"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]
    
    return {
        "data": data,
        "total": len(data),
        "message": "ok",
    }


@router.get("/playlists/{playlist_id}")
def get_playlist(playlist_id: int):
    """Get playlist with its songs ordered by position, each song includes tags."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Fetch playlist metadata
    cursor.execute(
        """
        SELECT id, name, color, emoji, created_at, updated_at
        FROM playlists
        WHERE id = ?
        """,
        (playlist_id,),
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Fetch songs with tags ordered by position
    conn = get_db()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            s.id,
            s.title,
            s.artist,
            s.album,
            s.duration,
            s.source,
            GROUP_CONCAT(t.name) as tags,
            ps.position
        FROM songs s
        JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        WHERE ps.playlist_id = ?
        GROUP BY s.id
        ORDER BY ps.position ASC
    """
    
    cursor.execute(query, (playlist_id,))
    song_rows = cursor.fetchall()
    conn.close()
    
    # Build songs list with tags parsed from GROUP_CONCAT
    songs = []
    for song_row in song_rows:
        tags_str = song_row["tags"]
        tags = tags_str.split(",") if tags_str else []
        
        songs.append(
            SongResponse(
                id=song_row["id"],
                title=song_row["title"],
                artist=song_row["artist"],
                album=song_row["album"],
                duration=song_row["duration"],
                file_path=None,
                source=song_row["source"],
                tags=tags,
                playlists=[],
                created_at="",
                updated_at="",
            )
        )
    
    # Calculate song_count
    song_count = len(songs)
    
    return {
        "data": {
            "id": row["id"],
            "name": row["name"],
            "color": row["color"],
            "emoji": row["emoji"],
            "song_count": song_count,
            "songs": songs,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        },
        "message": "ok",
    }
