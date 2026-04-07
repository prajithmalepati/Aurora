"""Playlists router."""
import sqlite3
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from app.database import get_db
from app.models import PlaylistCreate, PlaylistUpdate, PlaylistResponse, SongResponse, PlaylistSongAdd, PlaylistReorder

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


@router.put("/playlists/{playlist_id}/songs/reorder")
def reorder_playlist_songs(playlist_id: int, reorder: PlaylistReorder):
    """Reorder songs in a playlist based on the provided song_ids array."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify playlist exists
    cursor.execute(
        "SELECT id FROM playlists WHERE id = ?",
        (playlist_id,),
    )
    playlist_row = cursor.fetchone()
    
    if not playlist_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Get current songs in the playlist
    cursor.execute(
        "SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position",
        (playlist_id,),
    )
    current_rows = cursor.fetchall()
    current_song_ids = [row["song_id"] for row in current_rows]
    
    # Verify song_ids matches exactly the current songs
    if [s for s in reorder.song_ids] != current_song_ids:
        conn.close()
        raise HTTPException(
            status_code=400, 
            detail="song_ids doesn't match the actual songs in the playlist"
        )
    
    now = _get_utc_now()
    
    # Update position for each song based on its index in the array
    for new_position, song_id in enumerate(reorder.song_ids):
        cursor.execute(
            """
            UPDATE playlist_songs
            SET position = ?, updated_at = ?
            WHERE playlist_id = ? AND song_id = ?
            """,
            (new_position, now, playlist_id, song_id),
        )
    
    conn.commit()
    conn.close()
    
    # Fetch and return the full playlist with songs in new order
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
                position=song_row["position"],
            )
        )
    
    # Fetch playlist metadata
    conn = get_db()
    cursor = conn.cursor()
    
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


@router.delete("/playlists/{playlist_id}/songs/{song_id}", status_code=200)
def delete_song_from_playlist(playlist_id: int, song_id: int):
    """Remove a song from a playlist and recompact positions."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify playlist exists
    cursor.execute(
        "SELECT id FROM playlists WHERE id = ?",
        (playlist_id,),
    )
    playlist_row = cursor.fetchone()
    
    if not playlist_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Verify song exists
    cursor.execute(
        "SELECT id FROM songs WHERE id = ?",
        (song_id,),
    )
    song_row = cursor.fetchone()
    
    if not song_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Verify song is in the playlist
    cursor.execute(
        "SELECT id, position FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
        (playlist_id, song_id),
    )
    existing = cursor.fetchone()
    
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Song not in playlist")
    
    # Get the position of the song being deleted
    deleted_position = existing["position"]
    
    # Delete the playlist_songs row
    cursor.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
        (playlist_id, song_id),
    )
    conn.commit()
    
    # Recompack positions: decrement position for all songs after the deleted one
    cursor.execute(
        """
        UPDATE playlist_songs
        SET position = position - 1
        WHERE playlist_id = ? AND position > ?
        """,
        (playlist_id, deleted_position),
    )
    conn.commit()
    conn.close()
    
    # Fetch and return the full playlist with songs
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
                position=song_row["position"],
            )
        )
    
    # Fetch playlist metadata
    conn = get_db()
    cursor = conn.cursor()
    
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
                position=song_row["position"],
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


@router.put("/playlists/{playlist_id}")
def update_playlist(playlist_id: int, playlist: PlaylistUpdate):
    """Update playlist metadata. Only update fields that are not None."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if playlist exists
    cursor.execute(
        "SELECT id, name FROM playlists WHERE id = ?",
        (playlist_id,),
    )
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Check name uniqueness if name is being changed
    if playlist.name is not None and playlist.name.strip() != row["name"]:
        new_name = playlist.name.strip()
        cursor.execute(
            "SELECT id FROM playlists WHERE name = ? AND id != ?",
            (new_name, playlist_id),
        )
        existing = cursor.fetchone()
        if existing:
            conn.close()
            raise HTTPException(status_code=409, detail="playlist with this name already exists")
    
    now = _get_utc_now()
    
    # Build update query dynamically based on provided fields
    updates = []
    params = []
    
    if playlist.name is not None:
        updates.append("name = ?")
        params.append(playlist.name.strip())
    
    if playlist.color is not None:
        updates.append("color = ?")
        params.append(playlist.color)
    
    if playlist.emoji is not None:
        updates.append("emoji = ?")
        params.append(playlist.emoji)
    
    updates.append("updated_at = ?")
    params.append(now)
    
    params.append(playlist_id)
    
    query = f"UPDATE playlists SET {', '.join(updates)} WHERE id = ?"
    
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    # Fetch updated playlist with song_count
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        """
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
        WHERE p.id = ?
        GROUP BY p.id
        """,
        (playlist_id,),
    )
    row = cursor.fetchone()
    conn.close()
    
    return PlaylistResponse(
        id=row["id"],
        name=row["name"],
        color=row["color"],
        emoji=row["emoji"],
        song_count=row["song_count"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.delete("/playlists/{playlist_id}", status_code=200)
def delete_playlist(playlist_id: int):
    """Delete a playlist. Songs are NOT deleted. Returns success message."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if playlist exists
    cursor.execute(
        "SELECT id FROM playlists WHERE id = ?",
        (playlist_id,),
    )
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Delete the playlist (cascading handles playlist_songs)
    cursor.execute(
        "DELETE FROM playlists WHERE id = ?",
        (playlist_id,),
    )
    conn.commit()
    conn.close()
    
    return {"message": "Playlist deleted successfully"}


@router.post("/playlists/{playlist_id}/songs", status_code=200)
def add_song_to_playlist(playlist_id: int, song_add: PlaylistSongAdd):
    """Add a song to a playlist at the end (position = max position + 1)."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify playlist exists
    cursor.execute(
        "SELECT id FROM playlists WHERE id = ?",
        (playlist_id,),
    )
    playlist_row = cursor.fetchone()
    
    if not playlist_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Verify song exists
    cursor.execute(
        "SELECT id FROM songs WHERE id = ?",
        (song_add.song_id,),
    )
    song_row = cursor.fetchone()
    
    if not song_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Check song not already in playlist
    cursor.execute(
        "SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
        (playlist_id, song_add.song_id),
    )
    existing = cursor.fetchone()
    
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="Song already in playlist")
    
    # Get current max position
    cursor.execute(
        "SELECT COALESCE(MAX(position), -1) as max_pos FROM playlist_songs WHERE playlist_id = ?",
        (playlist_id,),
    )
    max_pos_row = cursor.fetchone()
    max_pos = max_pos_row["max_pos"]
    
    # Insert at position = current max position + 1
    new_position = max_pos + 1
    now = _get_utc_now()
    
    cursor.execute(
        """
        INSERT INTO playlist_songs (playlist_id, song_id, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (playlist_id, song_add.song_id, new_position, now, now),
    )
    conn.commit()
    conn.close()
    
    # Fetch and return the full playlist with songs (reuse the same query from GET /playlists/{id})
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
                position=song_row["position"],
            )
        )
    
    # Fetch playlist metadata
    conn = get_db()
    cursor = conn.cursor()
    
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