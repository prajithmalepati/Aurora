"""FastAPI application factory."""
import logging
import os
import secrets
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.database import init_db
from app.paths import DATA_DIR, DB_PATH, ALBUM_ART_DIR, PLAYLIST_IMAGES_DIR
from app.routers import songs, tags, playlists, filter, scanner, folders, watcher, albums

logger = logging.getLogger(__name__)


def _migrate_to_data_dir() -> None:
    """One-time migration: move DB, album art, and playlist images into DATA_DIR."""
    # __file__ is backend/app/main.py → two parents up is backend/
    old_root = Path(__file__).parent.parent  # backend/

    # Ensure data directory tree exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ALBUM_ART_DIR.mkdir(parents=True, exist_ok=True)
    PLAYLIST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Database
    old_db = old_root / "aurora.db"
    if old_db.exists() and not DB_PATH.exists():
        shutil.move(str(old_db), str(DB_PATH))
        logger.info("Migrated aurora.db → %s", DB_PATH)

    # Album art
    old_art = old_root / "album-art"
    if old_art.is_dir():
        for f in old_art.iterdir():
            dest = ALBUM_ART_DIR / f.name
            if not dest.exists():
                shutil.move(str(f), str(dest))
        try:
            old_art.rmdir()
        except OSError:
            pass
        logger.info("Migrated album-art → %s", ALBUM_ART_DIR)

    # Playlist images (from Vite public folder)
    old_images = old_root.parent / "frontend" / "public" / "playlist-images"
    if old_images.is_dir():
        for f in old_images.iterdir():
            if f.is_file():
                dest = PLAYLIST_IMAGES_DIR / f.name
                if not dest.exists():
                    shutil.move(str(f), str(dest))
        try:
            old_images.rmdir()
        except OSError:
            pass
        logger.info("Migrated playlist-images → %s", PLAYLIST_IMAGES_DIR)

    # Update image_url paths in DB from /playlist-images/ to /api/playlist-images/
    if DB_PATH.exists():
        import sqlite3
        conn = sqlite3.connect(str(DB_PATH))
        try:
            conn.execute(
                "UPDATE playlists SET image_url = REPLACE(image_url, '/playlist-images/', '/api/playlist-images/')"
                " WHERE image_url LIKE '/playlist-images/%'"
            )
            conn.commit()
        finally:
            conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    _migrate_to_data_dir()
    init_db()
    # Start the background file watcher
    from app.services.file_watcher import FileWatcher, set_watcher
    fw = FileWatcher(interval=30)
    set_watcher(fw)
    app.state.watcher = fw
    fw.start()
    yield
    # Shutdown
    from app.services.file_watcher import get_watcher
    fw = get_watcher()
    if fw:
        fw.stop()


app = FastAPI(title="Aurora", version="0.1.0", lifespan=lifespan)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reject requests with untrusted Host headers (DNS rebinding defense)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])


# --- Sidecar auth token middleware ---
AURORA_TOKEN = os.environ.get("AURORA_TOKEN")

if AURORA_TOKEN:
    _TOKEN: str = AURORA_TOKEN  # narrow type for Pyright

    @app.middleware("http")
    async def token_auth(request: Request, call_next):
        """Reject requests lacking a valid auth token when AURORA_TOKEN is set."""
        # Health endpoint is exempt (Rust health gate polls pre-token)
        if request.url.path == "/api/health":
            return await call_next(request)
        # Check header first, then query param
        token = request.headers.get("X-Aurora-Token")
        if token is None:
            token = request.query_params.get("token")
        if token is None:
            return Response(status_code=401, content="Unauthorized")
        if not secrets.compare_digest(token, _TOKEN):
            return Response(status_code=401, content="Unauthorized")
        return await call_next(request)

    # Redact token from uvicorn access logs
    class _TokenRedactFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            if record.args and isinstance(record.args, tuple) and len(record.args) >= 3:
                # Uvicorn access log format: (method, path, status)
                # path may contain ?token=...
                args = list(record.args)
                if isinstance(args[1], str) and "token=" in args[1]:
                    import re
                    args[1] = re.sub(r"token=[^&\s]+", "token=REDACTED", args[1])
                    record.args = tuple(args)
            return True

    logging.getLogger("uvicorn.access").addFilter(_TokenRedactFilter())

# Include routers
app.include_router(songs.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(playlists.router, prefix="/api")
app.include_router(filter.router, prefix="/api")
app.include_router(scanner.router, prefix="/api")
app.include_router(folders.router, prefix="/api")
app.include_router(watcher.router, prefix="/api")
app.include_router(albums.router, prefix="/api")



@app.get("/api/health")
def health_check():
    from app.database import get_db_ctx
    with get_db_ctx() as db:
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
