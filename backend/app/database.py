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
CREATE INDEX IF NOT EXISTS idx_songs_album            ON songs(album);
CREATE INDEX IF NOT EXISTS idx_songs_created_at       ON songs(created_at);
CREATE INDEX IF NOT EXISTS idx_songs_source           ON songs(source);
CREATE INDEX IF NOT EXISTS idx_tags_name              ON tags(name);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song     ON playlist_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tags_song          ON song_tags(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tags_tag           ON song_tags(tag_id);

CREATE TABLE IF NOT EXISTS watched_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_path TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1,
    last_scan_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


def get_db() -> sqlite3.Connection:
    """Get a database connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")  # 5s wait before raising OperationalError
    return conn


from contextlib import contextmanager


@contextmanager
def get_db_ctx():
    """Context manager that yields a DB connection and closes it on exit."""
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize the database — create tables if they don't exist."""
    import os
    with get_db_ctx() as conn:
        conn.executescript(INIT_SQL)
        # Migration: add image_url column to existing databases
        try:
            conn.execute("ALTER TABLE playlists ADD COLUMN image_url TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists
        # Migration: add file_format column to songs table
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN file_format TEXT")
            conn.commit()
        except sqlite3.OperationalError:
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
        except sqlite3.OperationalError:
            pass  # Column already exists
        # Backfill album_art_path for songs that have a file but no art extracted yet
        _backfill_album_art(conn)
        # Migration: add trim columns to playlist_songs
        try:
            conn.execute("ALTER TABLE playlist_songs ADD COLUMN start_time_ms INTEGER NOT NULL DEFAULT 0")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE playlist_songs ADD COLUMN end_time_ms INTEGER NOT NULL DEFAULT 0")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        # Migration: add crossfade columns to playlists
        try:
            conn.execute("ALTER TABLE playlists ADD COLUMN crossfade_enabled INTEGER DEFAULT NULL")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE playlists ADD COLUMN crossfade_duration_s INTEGER DEFAULT NULL")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        # Migration: add visual pipeline columns (waveform peaks + dominant colors)
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN waveform_peaks TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN dominant_color TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN dominant_color_2 TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        # Migration: add image-region bleed columns
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN bleed_thumb BLOB")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        for col in ("bleed_region_x", "bleed_region_y", "bleed_region_w", "bleed_region_h"):
            try:
                conn.execute(f"ALTER TABLE songs ADD COLUMN {col} INTEGER")
                conn.commit()
            except sqlite3.OperationalError:
                pass
        # Migration: add file_mtime for re-scan detection of edited files
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN file_mtime REAL")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        # Migration: add ReplayGain columns
        for col in ("replaygain_track_gain", "replaygain_track_peak",
                    "replaygain_album_gain", "replaygain_album_peak"):
            try:
                conn.execute(f"ALTER TABLE songs ADD COLUMN {col} REAL")
                conn.commit()
            except sqlite3.OperationalError:
                pass
        # Migration: add audio quality metadata columns
        for col, col_type in [("bitrate", "INTEGER"), ("sample_rate", "INTEGER"),
                               ("bit_depth", "INTEGER"), ("file_size", "INTEGER")]:
            try:
                conn.execute(f"ALTER TABLE songs ADD COLUMN {col} {col_type}")
                conn.commit()
            except sqlite3.OperationalError:
                pass
        # Migration: add multi-artist columns
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN artists TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists
        try:
            conn.execute("ALTER TABLE songs ADD COLUMN featured_artists TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists


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


# ── Canonical song SELECT query ──────────────────────────────────────────
# Every endpoint that fetches a full song row (with tags + playlists) should
# use these constants instead of inlining the SQL.

SONG_SELECT_COLUMNS = """
    s.id, s.title, s.artist, s.album, s.duration,
    s.file_path, s.file_format, s.album_art_path, s.source,
    s.bitrate, s.sample_rate, s.bit_depth, s.file_size,
    s.waveform_peaks, s.dominant_color, s.dominant_color_2,
    s.replaygain_track_gain, s.replaygain_track_peak,
    s.replaygain_album_gain, s.replaygain_album_peak,
    s.artists, s.featured_artists,
    GROUP_CONCAT(DISTINCT t.name) as tags,
    GROUP_CONCAT(DISTINCT p.id || ':' || p.name) as playlists,
    s.created_at, s.updated_at"""

SONG_SELECT_FROM = """
FROM songs s
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id
LEFT JOIN playlist_songs ps ON s.id = ps.song_id
LEFT JOIN playlists p ON ps.playlist_id = p.id"""

SONG_SELECT_QUERY = f"SELECT{SONG_SELECT_COLUMNS}{SONG_SELECT_FROM}"

COUNT_SONG_QUERY = "SELECT COUNT(*) as total FROM songs s"

# Playlist variant: adds ps.start_time_ms/end_time_ms/position,
# uses JOIN (not LEFT JOIN) for playlist_songs, no playlist aggregation.
PLAYLIST_SONG_SELECT_COLUMNS = """
    s.id, s.title, s.artist, s.album, s.duration,
    s.file_path, s.file_format, s.album_art_path, s.source,
    s.waveform_peaks, s.dominant_color, s.dominant_color_2,
    s.replaygain_track_gain, s.replaygain_track_peak,
    s.replaygain_album_gain, s.replaygain_album_peak,
    s.artists, s.featured_artists,
    GROUP_CONCAT(t.name) as tags,
    ps.start_time_ms, ps.end_time_ms, ps.position"""

PLAYLIST_SONG_SELECT_FROM = """
FROM songs s
JOIN playlist_songs ps ON s.id = ps.song_id
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id"""

PLAYLIST_SONG_SELECT_QUERY = f"SELECT{PLAYLIST_SONG_SELECT_COLUMNS}{PLAYLIST_SONG_SELECT_FROM}"