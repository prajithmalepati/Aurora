# Aurora — Project Structure
## Document 5 of 6 | 

---

## Folder Layout

```
aurora/
├── backend/
│   ├── app/
│   │   ├── __init__.py                 # empty
│   │   ├── main.py                     # FastAPI app, CORS, startup, include routers
│   │   ├── database.py                 # SQLite connection, init tables, get_db()
│   │   ├── models.py                   # ALL Pydantic schemas (request + response)
│   │   ├── routers/
│   │   │   ├── __init__.py             # empty
│   │   │   ├── songs.py                # /api/songs endpoints
│   │   │   ├── tags.py                 # /api/tags + /api/songs/{id}/tags endpoints
│   │   │   ├── playlists.py            # /api/playlists endpoints
│   │   │   ├── filter.py               # /api/filter endpoint
│   │   │   └── scanner.py              # /api/scan endpoint
│   │   └── services/
│   │       ├── __init__.py             # empty
│   │       ├── filter_engine.py        # Boolean query parser + evaluator
│   │       └── file_scanner.py         # Folder scan + metadata extraction
│   ├── requirements.txt
│   ├── aurora.db                       # SQLite database (auto-created, gitignored)
│   └── run.py                          # Entry point: uvicorn runner
├── frontend/
│   ├── (Vite + React app — created later in Phase 7)
│   └── ...
├── docs/
│   ├── 01-data-model.md
│   ├── 02-api-contract.md
│   ├── 03-filter-engine.md
│   ├── 04-file-scanner.md
│   ├── 05-project-structure.md
│   └── 06-implementation-plan.md
├── .gitignore
└── README.md
```

---

## Key File Templates

### `backend/run.py`

```python
"""Aurora backend entry point."""
import os
import sys
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("AURORA_PORT", "8000"))
    is_frozen = getattr(sys, "frozen", False)
    host = os.environ.get("AURORA_HOST", "127.0.0.1")
    uvicorn.run("app.main:app", host=host, port=port, reload=not is_frozen)
```

Run from the `backend/` directory: `python run.py`
Default host is `127.0.0.1` (loopback). For LAN/mobile access: `AURORA_HOST=0.0.0.0 python run.py`

---

### `backend/requirements.txt`

```
fastapi==0.115.12
uvicorn[standard]==0.34.2
boolean.py==5.0
mutagen==1.47.0
```

**Do not add anything else for v1.** No SQLAlchemy, no Alembic, no extra middleware. Keep it minimal.

Install: `pip install -r requirements.txt`

---

### `backend/app/main.py`

```python
"""FastAPI application factory."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import songs, tags, playlists, filter, scanner

app = FastAPI(title="Aurora", version="0.1.0")

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(songs.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(playlists.router, prefix="/api")
app.include_router(filter.router, prefix="/api")
app.include_router(scanner.router, prefix="/api")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/health")
def health_check():
    from app.database import get_db
    db = get_db()
    song_count = db.execute("SELECT COUNT(*) FROM songs").fetchone()[0]
    tag_count = db.execute("SELECT COUNT(*) FROM tags").fetchone()[0]
    playlist_count = db.execute("SELECT COUNT(*) FROM playlists").fetchone()[0]
    return {
        "status": "ok",
        "database": "connected",
        "song_count": song_count,
        "tag_count": tag_count,
        "playlist_count": playlist_count,
    }
```

---

### `backend/app/database.py`

```python
"""SQLite database connection and initialization."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "aurora.db"

INIT_SQL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS songs ( ... );
-- (full SQL from 01-data-model.md)
"""
# ^^^  init SQL from 01-data-model.md here


def get_db() -> sqlite3.Connection:
    """Get a database connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize the database — create tables if they don't exist."""
    conn = get_db()
    conn.executescript(INIT_SQL)
    conn.close()
```

**`row_factory = sqlite3.Row`** — This makes query results accessible by column name (`row["title"]`) instead of index (`row[0]`). Essential for readable code.

**Database connections are short-lived.** Each request creates its own connection via `get_db()`. No connection pooling needed for single-user SQLite.

---

### `backend/app/models.py`

All Pydantic models in one file. This keeps things simple and avoids circular imports.

```python
"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field
from typing import Optional


# ---- Songs ----

class SongCreate(BaseModel):
    title: str = Field(..., min_length=1)
    artist: str = Field(..., min_length=1)
    album: Optional[str] = None
    duration: Optional[int] = None
    file_path: Optional[str] = None


class SongUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    artist: Optional[str] = Field(None, min_length=1)
    album: Optional[str] = None
    duration: Optional[int] = None


class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    album: Optional[str]
    duration: Optional[int]
    file_path: Optional[str]
    source: str
    tags: list[str]
    playlists: list[str]
    created_at: str
    updated_at: str


# ---- Tags ----

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1)


class TagResponse(BaseModel):
    id: int
    name: str
    song_count: int
    created_at: str


class TagAssign(BaseModel):
    tag_names: list[str] = Field(..., min_length=1)


# ---- Playlists ----

class PlaylistCreate(BaseModel):
    name: str = Field(..., min_length=1)
    color: Optional[str] = None
    emoji: Optional[str] = None


class PlaylistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    color: Optional[str] = None
    emoji: Optional[str] = None


class PlaylistSongAdd(BaseModel):
    song_id: int


class PlaylistReorder(BaseModel):
    song_ids: list[int]


class PlaylistResponse(BaseModel):
    id: int
    name: str
    color: Optional[str]
    emoji: Optional[str]
    song_count: int
    created_at: str
    updated_at: str


class PlaylistDetailResponse(PlaylistResponse):
    songs: list[SongResponse]


# ---- Filter ----

class FilterRequest(BaseModel):
    query: str = Field(..., min_length=1)


# ---- Scanner ----

class ScanRequest(BaseModel):
    folder_path: str = Field(..., min_length=1)
    playlist_name: Optional[str] = None
```

---

### `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
*.egg-info/
dist/
build/

# Database
*.db
*.db-journal
*.db-wal
*.db-shm

# IDE
.vscode/
.idea/
*.swp
*.swo
.cursor/

# OS
.DS_Store
Thumbs.db

# Node (frontend)
node_modules/
dist/
.env
.env.local

# Logs
*.log
```

---

### `README.md`

```markdown
# Aurora 🌌

A personal music library app with custom tagging and boolean filtering.

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python run.py
```

Backend runs at http://localhost:8000
API docs at http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173
```

---

## Router Pattern

Every router follows this pattern:

```python
"""Songs router."""
from fastapi import APIRouter, HTTPException
from app.database import get_db
from app.models import SongCreate, SongResponse

router = APIRouter(tags=["songs"])


@router.post("/songs", status_code=201)
def create_song(song: SongCreate):
    db = get_db()
    try:
        # ... implementation
        db.commit()
        return {"data": result, "message": "Song created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()
```

**Key patterns:**
- `get_db()` at the start of every endpoint
- `db.commit()` after writes
- `db.rollback()` on errors
- `db.close()` in finally block (or use a context manager)
- Return `{"data": ..., "message": ...}` for consistency
- Raise `HTTPException` with appropriate status codes
