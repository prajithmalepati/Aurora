"""Tags router."""
import sqlite3
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from app.database import get_db_ctx, SONG_SELECT_QUERY
from app.models import TagCreate, TagResponse, TagAssign
from app.routers.songs import song_row_to_dict
from app.cache import tag_cache, song_cache

router = APIRouter(tags=["tags"])


def _get_utc_now() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.post("/tags", status_code=201)
def create_tag(tag: TagCreate):
    """Create a new tag."""
    # Lowercase and trim the name
    name = tag.name.lower().strip()
    
    # Return 400 if empty after trimming
    if not name:
        raise HTTPException(status_code=400, detail="name is empty after trimming")
    
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        now = _get_utc_now()
        
        try:
            cursor.execute(
                """
                INSERT INTO tags (name, created_at)
                VALUES (?, ?)
                """,
                (name, now),
            )
            conn.commit()
            tag_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="tag with this name already exists")
        
        # Invalidate tag cache
        tag_cache.invalidate("tags:list")

    # Return the created tag with song_count = 0
    return {"data": {
        "id": tag_id,
        "name": name,
        "song_count": 0,
        "created_at": now,
    }, "message": "Tag created successfully"}


@router.get("/tags")
def list_tags():
    """List all tags with song_count using LEFT JOIN on song_tags, ordered alphabetically."""
    # Check cache
    cache_key = "tags:list"
    cached = tag_cache.get(cache_key)
    if cached is not None:
        return cached

    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        query = """
            SELECT 
                t.id,
                t.name,
                COUNT(st.tag_id) as song_count,
                t.created_at
            FROM tags t
            LEFT JOIN song_tags st ON t.id = st.tag_id
            GROUP BY t.id
            ORDER BY t.name ASC
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
    
    data = [
        TagResponse(
            id=row["id"],
            name=row["name"],
            song_count=row["song_count"],
            created_at=row["created_at"],
        )
        for row in rows
    ]
    
    result = {"data": data, "meta": {"total": len(data)}, "message": "ok"}

    tag_cache.set(cache_key, result)
    return result


@router.delete("/tags/{tag_id}", response_model=dict[str, str])
def delete_tag(tag_id: int):
    """Delete a tag by ID. Returns 404 if tag doesn't exist."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Check if tag exists
        cursor.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="tag not found")
        
        # Delete the tag (cascading removes song_tags rows)
        cursor.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
        conn.commit()

    # Invalidate tag + song caches
    tag_cache.invalidate("tags:list")
    song_cache.invalidate_prefix("songs:")

    return {"data": None, "message": "Tag deleted successfully"}


@router.post("/songs/{song_id}/tags")
def assign_tags_to_song(song_id: int, tag_assign: TagAssign):
    """Add tags to a song. Creates tags and song_tags links as needed."""
    # Validate tag_names is not empty
    if not tag_assign.tag_names:
        raise HTTPException(status_code=400, detail="tag_names is empty")
    
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Check if song exists
        cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Song not found")
        
        # Process each tag name
        for tag_name in tag_assign.tag_names:
            # Lowercase and trim
            name = tag_name.lower().strip()
            
            # Skip empty names
            if not name:
                continue
            
            # Create tag if it doesn't exist (INSERT OR IGNORE)
            cursor.execute(
                """
                INSERT OR IGNORE INTO tags (name, created_at)
                VALUES (?, ?)
                """,
                (name, _get_utc_now()),
            )
            
            # Get the tag ID
            cursor.execute("SELECT id FROM tags WHERE name = ?", (name,))
            tag_row = cursor.fetchone()
            if not tag_row:
                continue
            tag_id = tag_row["id"]
            
            # Create song_tags link if it doesn't exist (INSERT OR IGNORE)
            cursor.execute(
                """
                INSERT OR IGNORE INTO song_tags (song_id, tag_id)
                VALUES (?, ?)
                """,
                (song_id, tag_id),
            )
        
        conn.commit()

        # Invalidate song + tag caches
        song_cache.invalidate_prefix("songs:")
        tag_cache.invalidate("tags:list")

        # Fetch the updated song with joined query
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"

        cursor.execute(query, (song_id,))
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")

    return {"data": song_row_to_dict(row), "message": "ok"}


@router.delete("/songs/{song_id}/tags/{tag_id}")
def remove_tag_from_song(song_id: int, tag_id: int):
    """Remove a tag from a song. Returns 404 if song, tag, or song_tags link not found."""
    with get_db_ctx() as conn:
        cursor = conn.cursor()
        
        # Check if song exists
        cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Song not found")
        
        # Check if tag exists
        cursor.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Tag not found")
        
        # Check if song_tags link exists and delete it
        cursor.execute(
            "SELECT id FROM song_tags WHERE song_id = ? AND tag_id = ?",
            (song_id, tag_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Song-tag link not found")
        
        cursor.execute(
            "DELETE FROM song_tags WHERE song_id = ? AND tag_id = ?",
            (song_id, tag_id)
        )
        conn.commit()

        # Invalidate song + tag caches
        song_cache.invalidate_prefix("songs:")
        tag_cache.invalidate("tags:list")

        # Fetch the updated song with joined query
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"
        
        cursor.execute(query, (song_id,))
        row = cursor.fetchone()
    
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")

    return {"data": song_row_to_dict(row), "message": "ok"}
