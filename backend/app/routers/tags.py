"""Tags router."""
import sqlite3
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from app.database import get_db
from app.models import TagCreate, TagResponse, TagAssign
from app.routers.songs import song_row_to_dict

router = APIRouter(tags=["tags"])


def _get_utc_now() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.post("/tags", status_code=201, response_model=TagResponse)
def create_tag(tag: TagCreate):
    """Create a new tag."""
    # Lowercase and trim the name
    name = tag.name.lower().strip()
    
    # Return 400 if empty after trimming
    if not name:
        raise HTTPException(status_code=400, detail="name is empty after trimming")
    
    conn = get_db()
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
        conn.close()
        raise HTTPException(status_code=409, detail="tag with this name already exists")
    
    # Return the created tag with song_count = 0
    conn.close()
    return TagResponse(
        id=tag_id,
        name=name,
        song_count=0,
        created_at=now,
    )


@router.get("/tags", response_model=list[TagResponse])
def list_tags():
    """List all tags with song_count using LEFT JOIN on song_tags, ordered alphabetically."""
    conn = get_db()
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
    conn.close()
    
    data = [
        TagResponse(
            id=row["id"],
            name=row["name"],
            song_count=row["song_count"],
            created_at=row["created_at"],
        )
        for row in rows
    ]
    
    return {
        "data": data,
        "total": len(data),
        "message": "ok",
    }


@router.delete("/tags/{tag_id}", response_model=dict[str, str])
def delete_tag(tag_id: int):
    """Delete a tag by ID. Returns 404 if tag doesn't exist."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if tag exists
    cursor.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="tag not found")
    
    # Delete the tag (cascading removes song_tags rows)
    cursor.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
    conn.commit()
    conn.close()
    
    return {"message": "Tag deleted successfully"}


@router.post("/songs/{song_id}/tags", response_model=dict)
def assign_tags_to_song(song_id: int, tag_assign: TagAssign):
    """Add tags to a song. Creates tags and song_tags links as needed."""
    # Validate tag_names is not empty
    if not tag_assign.tag_names:
        raise HTTPException(status_code=400, detail="tag_names is empty")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if song exists
    cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
    if not cursor.fetchone():
        conn.close()
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


@router.delete("/songs/{song_id}/tags/{tag_id}", response_model=dict)
def remove_tag_from_song(song_id: int, tag_id: int):
    """Remove a tag from a song. Returns 404 if song, tag, or song_tags link not found."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if song exists
    cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Check if tag exists
    cursor.execute("SELECT id FROM tags WHERE id = ?", (tag_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Check if song_tags link exists and delete it
    cursor.execute(
        "SELECT id FROM song_tags WHERE song_id = ? AND tag_id = ?",
        (song_id, tag_id)
    )
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Song-tag link not found")
    
    cursor.execute(
        "DELETE FROM song_tags WHERE song_id = ? AND tag_id = ?",
        (song_id, tag_id)
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
