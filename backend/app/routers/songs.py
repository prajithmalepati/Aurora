"""Songs router."""
import sqlite3

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from app.database import get_db
from app.models import SongCreate, SongResponse

router = APIRouter(tags=["songs"])


def _get_utc_now() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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