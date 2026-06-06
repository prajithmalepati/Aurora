"""Albums router."""
import sqlite3

from fastapi import APIRouter, HTTPException

from app.database import get_db_ctx, SONG_SELECT_QUERY
from app.routers.songs import song_row_to_dict

router = APIRouter(tags=["albums"])


@router.get("/albums")
def list_albums():
    """List all albums with aggregated metadata."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                COALESCE(album, 'Unknown Album') AS album_name,
                artist AS album_artist,
                COUNT(*) AS song_count,
                COALESCE(SUM(duration), 0) AS total_duration,
                album_art_path AS cover_art_path,
                dominant_color
            FROM songs
            GROUP BY COALESCE(album, 'Unknown Album'), artist
            ORDER BY album_name COLLATE NOCASE ASC
            """
        )
        rows = cursor.fetchall()

    data = []
    for row in rows:
        cover = row["cover_art_path"]
        data.append({
            "album_name": row["album_name"],
            "album_artist": row["album_artist"],
            "song_count": row["song_count"],
            "total_duration": row["total_duration"],
            "cover_art_path": cover if cover else None,
            "dominant_color": row["dominant_color"],
        })

    return {"data": data, "meta": {"total": len(data)}, "message": "ok"}


@router.get("/albums/{album_name}")
def get_album(album_name: str):
    """Get all songs in an album by name."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        query = (
            SONG_SELECT_QUERY
            + " WHERE COALESCE(s.album, 'Unknown Album') = ?"
            + " GROUP BY s.id ORDER BY s.title COLLATE NOCASE ASC"
        )
        cursor.execute(query, (album_name,))
        rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="Album not found")

    songs = [song_row_to_dict(row) for row in rows]

    return {
        "data": {
            "album_name": album_name,
            "songs": songs,
        },
        "message": "ok",
    }
