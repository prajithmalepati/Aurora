"""SQLite database connection and initialization."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "aurora.db"

INIT_SQL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    artist      TEXT    NOT NULL,
    album       TEXT,
    duration    INTEGER,
    file_path   TEXT    UNIQUE,
    source      TEXT    NOT NULL DEFAULT 'manual',
    external_id TEXT,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    color      TEXT,
    emoji      TEXT,
    image_url  TEXT,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     INTEGER NOT NULL REFERENCES songs(id)     ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    added_at    TEXT    NOT NULL,
    UNIQUE(playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS song_tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    UNIQUE(song_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_songs_title            ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_artist           ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_source           ON songs(source);
CREATE INDEX IF NOT EXISTS idx_tags_name              ON tags(name);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song     ON playlist_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tags_song          ON song_tags(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tags_tag           ON song_tags(tag_id);
"""


def get_db() -> sqlite3.Connection:
    """Get a database connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize the database — create tables if they don't exist."""
    import os
    conn = get_db()
    conn.executescript(INIT_SQL)
    # Migration: add image_url column to existing databases
    try:
        conn.execute("ALTER TABLE playlists ADD COLUMN image_url TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists
    # Migration: add file_format column to songs table
    try:
        conn.execute("ALTER TABLE songs ADD COLUMN file_format TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists
    # Backfill file_format from file_path extension for existing rows
    rows = conn.execute(
        "SELECT id, file_path FROM songs WHERE file_format IS NULL AND file_path IS NOT NULL"
    ).fetchall()
    for row in rows:
        ext = os.path.splitext(row["file_path"])[1].lstrip(".").lower()
        if ext:
            conn.execute("UPDATE songs SET file_format = ? WHERE id = ?", (ext, row["id"]))
    if rows:
        conn.commit()
    # Migration: add album_art_path column to songs table
    try:
        conn.execute("ALTER TABLE songs ADD COLUMN album_art_path TEXT")
        conn.commit()
    except Exception:
        pass  # Column already exists
    # Backfill album_art_path for songs that have a file but no art extracted yet
    _backfill_album_art(conn)
    conn.close()


def _backfill_album_art(conn) -> None:
    """Extract and store album art for any songs missing it. Runs once per song."""
    from app.services.file_scanner import extract_album_art, ALBUM_ART_DIR
    rows = conn.execute(
        "SELECT id, file_path FROM songs WHERE album_art_path IS NULL AND file_path IS NOT NULL"
    ).fetchall()
    updated = 0
    for row in rows:
        try:
            filename = extract_album_art(row["file_path"], ALBUM_ART_DIR)
            # Store filename (or empty string as sentinel if no art found, to skip next startup)
            conn.execute(
                "UPDATE songs SET album_art_path = ? WHERE id = ?",
                (filename or "", row["id"]),
            )
            if filename:
                updated += 1
        except Exception:
            pass
    if rows:
        conn.commit()