"""Playlists router."""
import json
import sqlite3
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File

from datetime import datetime, timezone

from app.database import get_db
from app.models import PlaylistCreate, PlaylistUpdate, PlaylistResponse, SongResponse, PlaylistSongAdd, PlaylistReorder, PlaylistSongTiming

# Playlist cover images are saved into the Vite public folder so they're
# served at /playlist-images/<id>.<ext> by the dev server (no CORS issues).
_PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
IMAGES_DIR = _PROJECT_ROOT / "frontend" / "public" / "playlist-images"

router = APIRouter(tags=["playlists"])


def _get_utc_now() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.put("/playlists/{playlist_id}/image")
async def upload_playlist_image(playlist_id: int, file: UploadFile = File(...)):
    """Upload a cover image for a playlist. Saved to frontend/public/playlist-images/."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist not found")
    conn.close()

    # Derive extension from MIME type
    mime = file.content_type or "image/jpeg"
    ext = {"image/png": "png", "image/gif": "gif", "image/webp": "webp"}.get(mime, "jpg")

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Remove any existing image files for this playlist
    for old in IMAGES_DIR.glob(f"{playlist_id}.*"):
        old.unlink()

    filename = f"{playlist_id}.{ext}"
    with open(IMAGES_DIR / filename, "wb") as f:
        f.write(await file.read())

    image_url = f"/playlist-images/{filename}"

    conn = get_db()
    conn.execute(
        "UPDATE playlists SET image_url = ?, updated_at = ? WHERE id = ?",
        (image_url, _get_utc_now(), playlist_id),
    )
    conn.commit()
    conn.close()

    return {"image_url": image_url}


@router.delete("/playlists/{playlist_id}/image", status_code=200)
def delete_playlist_image(playlist_id: int):
    """Remove the cover image for a playlist."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, image_url FROM playlists WHERE id = ?", (playlist_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if row["image_url"]:
        filename = row["image_url"].split("/")[-1]
        file_path = IMAGES_DIR / filename
        if file_path.exists():
            file_path.unlink()

    conn = get_db()
    conn.execute(
        "UPDATE playlists SET image_url = NULL, updated_at = ? WHERE id = ?",
        (_get_utc_now(), playlist_id),
    )
    conn.commit()
    conn.close()

    return {"message": "Image removed"}


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
            p.image_url,
            p.crossfade_enabled,
            p.crossfade_duration_s,
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
            image_url=row["image_url"],
            crossfade_enabled=row["crossfade_enabled"],
            crossfade_duration_s=row["crossfade_duration_s"],
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
    
    # Verify song_ids matches exactly the current songs (as a set comparison)
    if set(reorder.song_ids) != set(current_song_ids):
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
            SET position = ?
            WHERE playlist_id = ? AND song_id = ?
            """,
            (new_position, playlist_id, song_id),
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
            s.file_path,
            s.file_format,
            s.album_art_path,
            s.source,
            s.waveform_peaks,
            s.dominant_color,
            s.dominant_color_2,
            s.replaygain_track_gain,
            s.replaygain_track_peak,
            s.replaygain_album_gain,
            s.replaygain_album_peak,
            s.artists,
            s.featured_artists,
            GROUP_CONCAT(t.name) as tags,
            ps.start_time_ms,
            ps.end_time_ms,
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
        raw_peaks = song_row["waveform_peaks"] if "waveform_peaks" in song_row.keys() else None

        songs.append(
            SongResponse(
                id=song_row["id"],
                title=song_row["title"],
                artist=song_row["artist"],
                album=song_row["album"],
                artists=json.loads(song_row["artists"]) if song_row.get("artists") else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row.get("featured_artists") else None,
                duration=song_row["duration"],
                file_path=song_row["file_path"],
                file_format=song_row["file_format"] if "file_format" in song_row.keys() else None,
                album_art_path=(song_row["album_art_path"] or None) if "album_art_path" in song_row.keys() else None,
                source=song_row["source"],
                tags=tags,
                playlists=[],
                created_at="",
                updated_at="",
                start_time_ms=song_row["start_time_ms"],
                end_time_ms=song_row["end_time_ms"],
                position=song_row["position"],
                waveform_peaks=json.loads(raw_peaks) if raw_peaks else None,
                dominant_color=song_row["dominant_color"] if "dominant_color" in song_row.keys() else None,
                dominant_color_2=song_row["dominant_color_2"] if "dominant_color_2" in song_row.keys() else None,
                replaygain_track_gain=song_row["replaygain_track_gain"] if "replaygain_track_gain" in song_row.keys() else None,
                replaygain_track_peak=song_row["replaygain_track_peak"] if "replaygain_track_peak" in song_row.keys() else None,
                replaygain_album_gain=song_row["replaygain_album_gain"] if "replaygain_album_gain" in song_row.keys() else None,
                replaygain_album_peak=song_row["replaygain_album_peak"] if "replaygain_album_peak" in song_row.keys() else None,
            )
        )

    # Fetch playlist metadata
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, name, color, emoji, image_url, crossfade_enabled, crossfade_duration_s, created_at, updated_at
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
            "image_url": row["image_url"],
            "crossfade_enabled": row["crossfade_enabled"],
            "crossfade_duration_s": row["crossfade_duration_s"],
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
            s.file_path,
            s.file_format,
            s.album_art_path,
            s.source,
            s.waveform_peaks,
            s.dominant_color,
            s.dominant_color_2,
            s.replaygain_track_gain,
            s.replaygain_track_peak,
            s.replaygain_album_gain,
            s.replaygain_album_peak,
            s.artists,
            s.featured_artists,
            GROUP_CONCAT(t.name) as tags,
            ps.start_time_ms,
            ps.end_time_ms,
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
        raw_peaks = song_row["waveform_peaks"] if "waveform_peaks" in song_row.keys() else None

        songs.append(
            SongResponse(
                id=song_row["id"],
                title=song_row["title"],
                artist=song_row["artist"],
                album=song_row["album"],
                artists=json.loads(song_row["artists"]) if song_row.get("artists") else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row.get("featured_artists") else None,
                duration=song_row["duration"],
                file_path=song_row["file_path"],
                file_format=song_row["file_format"] if "file_format" in song_row.keys() else None,
                album_art_path=(song_row["album_art_path"] or None) if "album_art_path" in song_row.keys() else None,
                source=song_row["source"],
                tags=tags,
                playlists=[],
                created_at="",
                updated_at="",
                start_time_ms=song_row["start_time_ms"],
                end_time_ms=song_row["end_time_ms"],
                position=song_row["position"],
                waveform_peaks=json.loads(raw_peaks) if raw_peaks else None,
                dominant_color=song_row["dominant_color"] if "dominant_color" in song_row.keys() else None,
                dominant_color_2=song_row["dominant_color_2"] if "dominant_color_2" in song_row.keys() else None,
                replaygain_track_gain=song_row["replaygain_track_gain"] if "replaygain_track_gain" in song_row.keys() else None,
                replaygain_track_peak=song_row["replaygain_track_peak"] if "replaygain_track_peak" in song_row.keys() else None,
                replaygain_album_gain=song_row["replaygain_album_gain"] if "replaygain_album_gain" in song_row.keys() else None,
                replaygain_album_peak=song_row["replaygain_album_peak"] if "replaygain_album_peak" in song_row.keys() else None,
            )
        )

    # Fetch playlist metadata
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, name, color, emoji, image_url, crossfade_enabled, crossfade_duration_s, created_at, updated_at
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
            "image_url": row["image_url"],
            "crossfade_enabled": row["crossfade_enabled"],
            "crossfade_duration_s": row["crossfade_duration_s"],
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
        SELECT id, name, color, emoji, image_url, crossfade_enabled, crossfade_duration_s, created_at, updated_at
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
            s.file_path,
            s.file_format,
            s.album_art_path,
            s.source,
            s.waveform_peaks,
            s.dominant_color,
            s.dominant_color_2,
            s.replaygain_track_gain,
            s.replaygain_track_peak,
            s.replaygain_album_gain,
            s.replaygain_album_peak,
            s.artists,
            s.featured_artists,
            GROUP_CONCAT(t.name) as tags,
            ps.start_time_ms,
            ps.end_time_ms,
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
        raw_peaks = song_row["waveform_peaks"] if "waveform_peaks" in song_row.keys() else None

        songs.append(
            SongResponse(
                id=song_row["id"],
                title=song_row["title"],
                artist=song_row["artist"],
                album=song_row["album"],
                artists=json.loads(song_row["artists"]) if song_row.get("artists") else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row.get("featured_artists") else None,
                duration=song_row["duration"],
                file_path=song_row["file_path"],
                file_format=song_row["file_format"] if "file_format" in song_row.keys() else None,
                album_art_path=(song_row["album_art_path"] or None) if "album_art_path" in song_row.keys() else None,
                source=song_row["source"],
                tags=tags,
                playlists=[],
                created_at="",
                updated_at="",
                start_time_ms=song_row["start_time_ms"],
                end_time_ms=song_row["end_time_ms"],
                position=song_row["position"],
                waveform_peaks=json.loads(raw_peaks) if raw_peaks else None,
                dominant_color=song_row["dominant_color"] if "dominant_color" in song_row.keys() else None,
                dominant_color_2=song_row["dominant_color_2"] if "dominant_color_2" in song_row.keys() else None,
                replaygain_track_gain=song_row["replaygain_track_gain"] if "replaygain_track_gain" in song_row.keys() else None,
                replaygain_track_peak=song_row["replaygain_track_peak"] if "replaygain_track_peak" in song_row.keys() else None,
                replaygain_album_gain=song_row["replaygain_album_gain"] if "replaygain_album_gain" in song_row.keys() else None,
                replaygain_album_peak=song_row["replaygain_album_peak"] if "replaygain_album_peak" in song_row.keys() else None,
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
            "image_url": row["image_url"],
            "crossfade_enabled": row["crossfade_enabled"],
            "crossfade_duration_s": row["crossfade_duration_s"],
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
        params.append(playlist.emoji if playlist.emoji else None)

    if "crossfade_enabled" in playlist.model_fields_set:
        updates.append("crossfade_enabled = ?")
        params.append(playlist.crossfade_enabled)

    if "crossfade_duration_s" in playlist.model_fields_set:
        updates.append("crossfade_duration_s = ?")
        params.append(playlist.crossfade_duration_s)

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
            p.image_url,
            p.crossfade_enabled,
            p.crossfade_duration_s,
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
        image_url=row["image_url"],
        crossfade_enabled=row["crossfade_enabled"],
        crossfade_duration_s=row["crossfade_duration_s"],
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
        INSERT INTO playlist_songs (playlist_id, song_id, position, added_at, start_time_ms, end_time_ms)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (playlist_id, song_add.song_id, new_position, now, song_add.start_time_ms, song_add.end_time_ms),
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
            s.file_path,
            s.file_format,
            s.album_art_path,
            s.source,
            s.waveform_peaks,
            s.dominant_color,
            s.dominant_color_2,
            s.replaygain_track_gain,
            s.replaygain_track_peak,
            s.replaygain_album_gain,
            s.replaygain_album_peak,
            s.artists,
            s.featured_artists,
            GROUP_CONCAT(t.name) as tags,
            ps.start_time_ms,
            ps.end_time_ms,
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
        raw_peaks = song_row["waveform_peaks"] if "waveform_peaks" in song_row.keys() else None

        songs.append(
            SongResponse(
                id=song_row["id"],
                title=song_row["title"],
                artist=song_row["artist"],
                album=song_row["album"],
                artists=json.loads(song_row["artists"]) if song_row.get("artists") else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row.get("featured_artists") else None,
                duration=song_row["duration"],
                file_path=song_row["file_path"],
                file_format=song_row["file_format"] if "file_format" in song_row.keys() else None,
                album_art_path=(song_row["album_art_path"] or None) if "album_art_path" in song_row.keys() else None,
                source=song_row["source"],
                tags=tags,
                playlists=[],
                created_at="",
                updated_at="",
                start_time_ms=song_row["start_time_ms"],
                end_time_ms=song_row["end_time_ms"],
                position=song_row["position"],
                waveform_peaks=json.loads(raw_peaks) if raw_peaks else None,
                dominant_color=song_row["dominant_color"] if "dominant_color" in song_row.keys() else None,
                dominant_color_2=song_row["dominant_color_2"] if "dominant_color_2" in song_row.keys() else None,
                replaygain_track_gain=song_row["replaygain_track_gain"] if "replaygain_track_gain" in song_row.keys() else None,
                replaygain_track_peak=song_row["replaygain_track_peak"] if "replaygain_track_peak" in song_row.keys() else None,
                replaygain_album_gain=song_row["replaygain_album_gain"] if "replaygain_album_gain" in song_row.keys() else None,
                replaygain_album_peak=song_row["replaygain_album_peak"] if "replaygain_album_peak" in song_row.keys() else None,
            )
        )

    # Fetch playlist metadata
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, name, color, emoji, image_url, crossfade_enabled, crossfade_duration_s, created_at, updated_at
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
            "image_url": row["image_url"],
            "crossfade_enabled": row["crossfade_enabled"],
            "crossfade_duration_s": row["crossfade_duration_s"],
            "song_count": song_count,
            "songs": songs,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        },
        "message": "ok",
    }

@router.patch("/playlists/{playlist_id}/songs/{song_id}/timing", status_code=200)
def update_song_timing(playlist_id: int, song_id: int, timing: PlaylistSongTiming):
    """Set start/end trim times for a song in a playlist. 0 = not set (full song)."""
    if timing.start_time_ms > 0 and timing.end_time_ms > 0:
        if timing.start_time_ms >= timing.end_time_ms:
            raise HTTPException(status_code=422, detail="start_time_ms must be less than end_time_ms")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
        (playlist_id, song_id),
    )
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Song not in playlist")

    end_ms = timing.end_time_ms
    if end_ms > 0:
        cursor.execute("SELECT duration FROM songs WHERE id = ?", (song_id,))
        song_row = cursor.fetchone()
        if song_row and song_row["duration"] and end_ms > song_row["duration"] * 1000:
            end_ms = song_row["duration"] * 1000

    cursor.execute(
        "UPDATE playlist_songs SET start_time_ms = ?, end_time_ms = ? WHERE playlist_id = ? AND song_id = ?",
        (timing.start_time_ms, end_ms, playlist_id, song_id),
    )
    conn.commit()
    conn.close()

    return {"start_time_ms": timing.start_time_ms, "end_time_ms": end_ms, "message": "ok"}
