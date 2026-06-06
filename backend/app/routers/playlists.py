"""Playlists router."""
import json
import re
import sqlite3
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Form
from fastapi.responses import Response

from datetime import datetime, timezone

from app.database import get_db_ctx, PLAYLIST_SONG_SELECT_QUERY
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

    with get_db_ctx() as conn:
        filepath = None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM playlists WHERE id = ?", (playlist_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Playlist not found")

            # Derive extension from MIME type
            mime = file.content_type or "image/jpeg"
            ext = {"image/png": "png", "image/gif": "gif", "image/webp": "webp"}.get(mime, "jpg")

            IMAGES_DIR.mkdir(parents=True, exist_ok=True)

            # Remove any existing image files for this playlist
            for old in IMAGES_DIR.glob(f"{playlist_id}.*"):
                old.unlink()

            filename = f"{playlist_id}.{ext}"
            filepath = IMAGES_DIR / filename
            with open(filepath, "wb") as f:
                f.write(await file.read())

            image_url = f"/playlist-images/{filename}"

            conn.execute(
                "UPDATE playlists SET image_url = ?, updated_at = ? WHERE id = ?",
                (image_url, _get_utc_now(), playlist_id),
            )
            conn.commit()
        except Exception:
            # Clean up the written file on any DB failure
            try:
                if filepath is not None and filepath.exists():
                    filepath.unlink()
            except Exception:
                pass
            raise

    return {"data": {"image_url": image_url}, "message": "ok"}


@router.delete("/playlists/{playlist_id}/image", status_code=200)
def delete_playlist_image(playlist_id: int):
    """Remove the cover image for a playlist."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, image_url FROM playlists WHERE id = ?", (playlist_id,))
        row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if row["image_url"]:
        filename = row["image_url"].split("/")[-1]
        file_path = IMAGES_DIR / filename
        if file_path.exists():
            file_path.unlink()

    with get_db_ctx() as conn:
        conn.execute(
            "UPDATE playlists SET image_url = NULL, updated_at = ? WHERE id = ?",
            (_get_utc_now(), playlist_id),
        )
        conn.commit()

    return {"data": None, "message": "Image removed"}


@router.post("/playlists", status_code=201)
def create_playlist(playlist: PlaylistCreate):
    """Create a new playlist."""
    name = playlist.name.strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="name is empty")
    
    with get_db_ctx() as conn:
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
            raise HTTPException(status_code=409, detail="playlist with this name already exists")

    return {"data": {
        "id": playlist_id,
        "name": name,
        "color": playlist.color,
        "emoji": playlist.emoji,
        "song_count": 0,
        "created_at": now,
        "updated_at": now,
    }, "message": "Playlist created successfully"}


@router.get("/playlists")
def list_playlists():
    """List all playlists with song_count using LEFT JOIN on playlist_songs, ordered by name."""
    with get_db_ctx() as conn:
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
        "meta": {"total": len(data)},
        "message": "ok",
    }


@router.put("/playlists/{playlist_id}/songs/reorder")
def reorder_playlist_songs(playlist_id: int, reorder: PlaylistReorder):
    """Reorder songs in a playlist based on the provided song_ids array."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Verify playlist exists
        cursor.execute(
            "SELECT id FROM playlists WHERE id = ?",
            (playlist_id,),
        )
        playlist_row = cursor.fetchone()
        
        if not playlist_row:
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

    # Fetch and return the full playlist with songs in new order
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        query = PLAYLIST_SONG_SELECT_QUERY + " WHERE ps.playlist_id = ? GROUP BY s.id ORDER BY ps.position ASC"

        cursor.execute(query, (playlist_id,))
        song_rows = cursor.fetchall()

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
                artists=json.loads(song_row["artists"]) if song_row["artists"] else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row["featured_artists"] else None,
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
    with get_db_ctx() as conn:
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
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Verify playlist exists
        cursor.execute(
            "SELECT id FROM playlists WHERE id = ?",
            (playlist_id,),
        )
        playlist_row = cursor.fetchone()
        
        if not playlist_row:
            raise HTTPException(status_code=404, detail="Playlist not found")
        
        # Verify song exists
        cursor.execute(
            "SELECT id FROM songs WHERE id = ?",
            (song_id,),
        )
        song_row = cursor.fetchone()
        
        if not song_row:
            raise HTTPException(status_code=404, detail="Song not found")
        
        # Verify song is in the playlist
        cursor.execute(
            "SELECT id, position FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
            (playlist_id, song_id),
        )
        existing = cursor.fetchone()
        
        if not existing:
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

    # Fetch and return the full playlist with songs
    with get_db_ctx() as conn:
        cursor = conn.cursor()

        query = PLAYLIST_SONG_SELECT_QUERY + " WHERE ps.playlist_id = ? GROUP BY s.id ORDER BY ps.position ASC"

        cursor.execute(query, (playlist_id,))
        song_rows = cursor.fetchall()

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
                artists=json.loads(song_row["artists"]) if song_row["artists"] else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row["featured_artists"] else None,
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
    with get_db_ctx() as conn:
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
    with get_db_ctx() as conn:
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

    if not row:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Fetch songs with tags ordered by position
    with get_db_ctx() as conn:
        cursor = conn.cursor()

        query = PLAYLIST_SONG_SELECT_QUERY + " WHERE ps.playlist_id = ? GROUP BY s.id ORDER BY ps.position ASC"

        cursor.execute(query, (playlist_id,))
        song_rows = cursor.fetchall()

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
                artists=json.loads(song_row["artists"]) if song_row["artists"] else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row["featured_artists"] else None,
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
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Check if playlist exists
        cursor.execute(
            "SELECT id, name FROM playlists WHERE id = ?",
            (playlist_id,),
        )
        row = cursor.fetchone()
        
        if not row:
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

    # Fetch updated playlist with song_count
    with get_db_ctx() as conn:
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

    return {"data": {
        "id": row["id"],
        "name": row["name"],
        "color": row["color"],
        "emoji": row["emoji"],
        "image_url": row["image_url"],
        "crossfade_enabled": row["crossfade_enabled"],
        "crossfade_duration_s": row["crossfade_duration_s"],
        "song_count": row["song_count"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }, "message": "ok"}


@router.delete("/playlists/{playlist_id}", status_code=200)
def delete_playlist(playlist_id: int):
    """Delete a playlist. Songs are NOT deleted. Returns success message."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Check if playlist exists
        cursor.execute(
            "SELECT id FROM playlists WHERE id = ?",
            (playlist_id,),
        )
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Playlist not found")
        
        # Delete the playlist (cascading handles playlist_songs)
        cursor.execute(
            "DELETE FROM playlists WHERE id = ?",
            (playlist_id,),
        )
        conn.commit()
    
    return {"data": None, "message": "Playlist deleted successfully"}


@router.post("/playlists/{playlist_id}/songs", status_code=200)
def add_song_to_playlist(playlist_id: int, song_add: PlaylistSongAdd):
    """Add a song to a playlist at the end (position = max position + 1)."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Verify playlist exists
        cursor.execute(
            "SELECT id FROM playlists WHERE id = ?",
            (playlist_id,),
        )
        playlist_row = cursor.fetchone()
        
        if not playlist_row:
            raise HTTPException(status_code=404, detail="Playlist not found")
        
        # Verify song exists
        cursor.execute(
            "SELECT id FROM songs WHERE id = ?",
            (song_add.song_id,),
        )
        song_row = cursor.fetchone()
        
        if not song_row:
            raise HTTPException(status_code=404, detail="Song not found")
        
        # Check song not already in playlist
        cursor.execute(
            "SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
            (playlist_id, song_add.song_id),
        )
        existing = cursor.fetchone()
        
        if existing:
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

    # Fetch and return the full playlist with songs (reuse the same query from GET /playlists/{id})
    with get_db_ctx() as conn:
        cursor = conn.cursor()

        query = PLAYLIST_SONG_SELECT_QUERY + " WHERE ps.playlist_id = ? GROUP BY s.id ORDER BY ps.position ASC"

        cursor.execute(query, (playlist_id,))
        song_rows = cursor.fetchall()

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
                artists=json.loads(song_row["artists"]) if song_row["artists"] else None,
                featured_artists=json.loads(song_row["featured_artists"]) if song_row["featured_artists"] else None,
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
    with get_db_ctx() as conn:
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

    with get_db_ctx() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
            (playlist_id, song_id),
        )
        if not cursor.fetchone():
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

    return {"data": {"start_time_ms": timing.start_time_ms, "end_time_ms": end_ms}, "message": "ok"}


# ── Playlist Export ──

def _get_playlist_songs_for_export(playlist_id: int):
    """Fetch playlist metadata + songs ordered by position. Returns (playlist_row, songs_list)."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, name, color, emoji, image_url, crossfade_enabled, crossfade_duration_s, created_at, updated_at
            FROM playlists WHERE id = ?
            """,
            (playlist_id,),
        )
        row = cursor.fetchone()

    if not row:
        return None, None

    with get_db_ctx() as conn:
        cursor = conn.cursor()
        query = PLAYLIST_SONG_SELECT_QUERY + " WHERE ps.playlist_id = ? GROUP BY s.id ORDER BY ps.position ASC"
        cursor.execute(query, (playlist_id,))
        song_rows = cursor.fetchall()

    songs = []
    for sr in song_rows:
        tags_str = sr["tags"]
        tags = tags_str.split(",") if tags_str else []
        raw_peaks = sr["waveform_peaks"] if "waveform_peaks" in sr.keys() else None
        songs.append(SongResponse(
            id=sr["id"],
            title=sr["title"],
            artist=sr["artist"],
            album=sr["album"],
            artists=json.loads(sr["artists"]) if sr["artists"] else None,
            featured_artists=json.loads(sr["featured_artists"]) if sr["featured_artists"] else None,
            duration=sr["duration"],
            file_path=sr["file_path"],
            file_format=sr["file_format"] if "file_format" in sr.keys() else None,
            album_art_path=(sr["album_art_path"] or None) if "album_art_path" in sr.keys() else None,
            source=sr["source"],
            tags=tags,
            playlists=[],
            created_at="",
            updated_at="",
            start_time_ms=sr["start_time_ms"],
            end_time_ms=sr["end_time_ms"],
            position=sr["position"],
            waveform_peaks=json.loads(raw_peaks) if raw_peaks else None,
            dominant_color=sr["dominant_color"] if "dominant_color" in sr.keys() else None,
            dominant_color_2=sr["dominant_color_2"] if "dominant_color_2" in sr.keys() else None,
            replaygain_track_gain=sr["replaygain_track_gain"] if "replaygain_track_gain" in sr.keys() else None,
            replaygain_track_peak=sr["replaygain_track_peak"] if "replaygain_track_peak" in sr.keys() else None,
            replaygain_album_gain=sr["replaygain_album_gain"] if "replaygain_album_gain" in sr.keys() else None,
            replaygain_album_peak=sr["replaygain_album_peak"] if "replaygain_album_peak" in sr.keys() else None,
        ))

    return row, songs


@router.get("/playlists/{playlist_id}/export")
def export_playlist(playlist_id: int, format: str = Query("m3u8", regex="^(m3u|m3u8|json)$")):
    """Export a playlist in M3U, M3U8 (UTF-8), or Aurora JSON format."""
    row, songs = _get_playlist_songs_for_export(playlist_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    playlist_name = row["name"]

    if format == "json":
        # Aurora-specific JSON export
        export_data = {
            "aurora_version": "1.0",
            "playlist": {
                "name": playlist_name,
                "color": row["color"],
                "emoji": row["emoji"],
                "crossfade_enabled": row["crossfade_enabled"],
                "crossfade_duration_s": row["crossfade_duration_s"],
            },
            "songs": [
                {
                    "title": s.title,
                    "artist": s.artist,
                    "album": s.album,
                    "duration": s.duration,
                    "file_path": s.file_path,
                    "file_format": s.file_format,
                    "tags": s.tags,
                    "start_time_ms": s.start_time_ms,
                    "end_time_ms": s.end_time_ms,
                }
                for s in songs
            ],
        }
        json_bytes = json.dumps(export_data, ensure_ascii=False, indent=2).encode("utf-8")
        safe_name = re.sub(r'[\\/*?:"<>|]', "_", playlist_name)
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.aurora.json"',
            },
        )

    # M3U / M3U8 export
    lines = ["#EXTM3U"]
    if format == "m3u8":
        # M3U8 explicitly declares UTF-8 (though we always emit UTF-8)
        lines[0] = "#EXTM3U"
    for s in songs:
        duration_sec = s.duration if s.duration else -1
        artist_title = f"{s.artist} - {s.title}" if s.artist else s.title
        lines.append(f"#EXTINF:{duration_sec},{artist_title}")
        # Use forward slashes for cross-platform compatibility
        file_path = (s.file_path or "").replace("\\", "/")
        lines.append(file_path)

    content = "\n".join(lines) + "\n"
    content_bytes = content.encode("utf-8")

    safe_name = re.sub(r'[\\/*?:"<>|]', "_", playlist_name)
    ext = "m3u8" if format == "m3u8" else "m3u"

    return Response(
        content=content_bytes,
        media_type="audio/x-mpegurl" if format == "m3u" else "application/vnd.apple.mpegurl",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.{ext}"',
        },
    )


# ── Playlist Import ──

def _parse_m3u(content: str) -> list[dict]:
    """Parse M3U/M3U8 content and return a list of {duration, artist, title, file_path} dicts."""
    entries = []
    lines = content.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith("#EXTM3U"):
            i += 1
            continue
        if line.startswith("#EXTINF:"):
            # Parse #EXTINF:<duration>,<title>
            header = line
            i += 1
            # Collect any continued lines
            file_path = ""
            while i < len(lines):
                next_line = lines[i].strip()
                if next_line.startswith("#") and not next_line.startswith("#EXTINF:"):
                    # Metadata comment, skip
                    i += 1
                    continue
                elif next_line.startswith("#EXTINF:"):
                    # Another track starts before we got a path — skip this orphaned header
                    break
                elif next_line:
                    file_path = next_line
                    i += 1
                    break
                else:
                    i += 1
                    continue

            if not file_path:
                continue
            # Parse #EXTINF
            inf_match = re.match(r'^#EXTINF:\s*(-?\d+)\s*,\s*(.*)', header)
            if inf_match:
                duration = int(inf_match.group(1))
                title_part = inf_match.group(2).strip()
                # Try to split "Artist - Title"
                if " - " in title_part:
                    artist, title = title_part.split(" - ", 1)
                else:
                    artist = ""
                    title = title_part
                entries.append({
                    "duration": duration if duration >= 0 else None,
                    "artist": artist.strip(),
                    "title": title.strip(),
                    "file_path": file_path.strip(),
                })
        elif line.startswith("#"):
            i += 1
            continue
        else:
            # Plain file path without EXTINF
            entries.append({
                "duration": None,
                "artist": "",
                "title": "",
                "file_path": line.strip(),
            })
            i += 1

    return entries


@router.post("/playlists/import")
async def import_playlist(
    file: UploadFile = File(...),
    playlist_name: str = Form(None),
):
    """Import a playlist from an M3U/M3U8 or Aurora JSON file.

    Returns: {playlist_id, name, matched_count, unmatched_paths}
    """
    content_bytes = await file.read()
    filename = file.filename or ""

    # Determine format from extension or content
    is_json = filename.lower().endswith(".json") or (
        content_bytes.strip().startswith(b"{")
    )

    entries = []
    color = None
    emoji = None
    crossfade_enabled = None
    crossfade_duration_s = None

    if is_json:
        try:
            data = json.loads(content_bytes.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise HTTPException(status_code=400, detail="Invalid JSON file")

        pl_data = data.get("playlist", {})
        if not playlist_name:
            playlist_name = pl_data.get("name", "Imported Playlist")
        color = pl_data.get("color")
        emoji = pl_data.get("emoji")
        crossfade_enabled = pl_data.get("crossfade_enabled")
        crossfade_duration_s = pl_data.get("crossfade_duration_s")

        for s in data.get("songs", []):
            entries.append({
                "duration": s.get("duration"),
                "artist": s.get("artist", ""),
                "title": s.get("title", ""),
                "file_path": s.get("file_path", ""),
            })
    else:
        # M3U/M3U8
        try:
            content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                content = content_bytes.decode("latin-1")
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Cannot decode file as UTF-8 or Latin-1")

        entries = _parse_m3u(content)
        if not playlist_name:
            # Derive name from filename
            base = Path(filename).stem or "Imported Playlist"
            playlist_name = base

    if not entries:
        raise HTTPException(status_code=400, detail="No tracks found in file")

    # Build a lookup of file_path -> song_id from the library
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, file_path FROM songs WHERE file_path IS NOT NULL AND file_path != ''")
        db_rows = cursor.fetchall()

    # Normalize paths for matching
    def norm(p: str) -> str:
        return p.replace("\\", "/").strip()

    path_to_id = {}
    for dr in db_rows:
        fp = norm(dr["file_path"])
        if fp:
            path_to_id[fp] = dr["id"]

    matched_ids = []
    unmatched_paths = []

    for entry in entries:
        fp = norm(entry["file_path"])
        if fp in path_to_id:
            matched_ids.append(path_to_id[fp])
        else:
            # Try matching by filename only
            filename_only = Path(fp).name
            matched = False
            for db_fp, db_id in path_to_id.items():
                if Path(db_fp).name == filename_only:
                    matched_ids.append(db_id)
                    matched = True
                    break
            if not matched:
                unmatched_paths.append(entry["file_path"])

    if not matched_ids:
        raise HTTPException(
            status_code=404,
            detail=f"No songs matched from the library. {len(unmatched_paths)} file(s) not found.",
        )

    # Remove duplicate song IDs while preserving order
    seen = set()
    unique_ids = []
    for sid in matched_ids:
        if sid not in seen:
            seen.add(sid)
            unique_ids.append(sid)

    # Create playlist
    now = _get_utc_now()
    with get_db_ctx() as conn:
        cursor = conn.cursor()

        # Check for name collision
        cursor.execute("SELECT id FROM playlists WHERE name = ?", (playlist_name,))
        existing = cursor.fetchone()
        if existing:
            base = playlist_name
            suffix = 1
            while True:
                playlist_name = f"{base} ({suffix})"
                cursor.execute("SELECT id FROM playlists WHERE name = ?", (playlist_name,))
                if not cursor.fetchone():
                    break
                suffix += 1

        try:
            cursor.execute(
                """INSERT INTO playlists (name, color, emoji, crossfade_enabled, crossfade_duration_s, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (playlist_name, color, emoji, crossfade_enabled, crossfade_duration_s, now, now),
            )
            conn.commit()
            new_playlist_id = cursor.lastrowid

            # Add songs
            for pos, sid in enumerate(unique_ids):
                cursor.execute(
                    """INSERT INTO playlist_songs (playlist_id, song_id, position, added_at, start_time_ms, end_time_ms)
                       VALUES (?, ?, ?, ?, 0, 0)""",
                    (new_playlist_id, sid, pos, now),
                )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Failed to create playlist")

    return {
        "data": {
            "playlist_id": new_playlist_id,
            "name": playlist_name,
            "matched_count": len(unique_ids),
            "unmatched_paths": unmatched_paths,
        },
        "message": "ok",
    }
