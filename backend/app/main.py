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