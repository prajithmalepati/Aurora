"""Playlists router."""
import sqlite3
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from app.database import get_db
from app.models import PlaylistCreate, PlaylistResponse

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