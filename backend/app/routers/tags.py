"""Tags router."""
import sqlite3
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from app.database import get_db
from app.models import TagCreate, TagResponse

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