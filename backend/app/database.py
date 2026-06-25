"""SQLite database connection and initialization."""
import logging
import sqlite3
from pathlib import Path

from app.paths import DB_PATH

logger = logging.getLogger(__name__)

# ── Current schema (version 1) ──────────────────────────────────────────
# All columns that exist today are defined here. Fresh databases create
# at user_version = 1; existing databases are migrated forward by the
# version ladder in init_db().

INIT_SQL = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS songs (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    title                   TEXT    NOT NULL,
    artist                  TEXT    NOT NULL,
    album                   TEXT,
    duration                INTEGER,
    file_path               TEXT    UNIQUE,
    source                  TEXT    NOT NULL DEFAULT 'manual',
    external_id             TEXT,
    created_at              TEXT    NOT NULL,
    updated_at              TEXT    NOT NULL,
    file_format             TEXT,
    album_art_path          TEXT,
    waveform_peaks          TEXT,
    dominant_color          TEXT,
    dominant_color_2        TEXT,
    bleed_thumb             BLOB,
    bleed_region_x          INTEGER,
    bleed_region_y          INTEGER,
    bleed_region_w          INTEGER,
    bleed_region_h          INTEGER,
    file_mtime              REAL,
    replaygain_track_gain   REAL,
    replaygain_track_peak   REAL,
    replaygain_album_gain   REAL,
    replaygain_album_peak   REAL,
    bitrate                 INTEGER,
    sample_rate             INTEGER,
    bit_depth               INTEGER,
    file_size               INTEGER,
    artists                 TEXT,
    featured_artists        TEXT,
    stream_url              TEXT,
    stream_url_expires_at   TEXT,
    artwork_url             TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL UNIQUE,
    color               TEXT,
    emoji               TEXT,
    image_url           TEXT,
    created_at          TEXT    NOT NULL,
    updated_at          TEXT    NOT NULL,
    crossfade_enabled   INTEGER DEFAULT NULL,
    crossfade_duration_s INTEGER DEFAULT NULL,
    dominant_color      TEXT,
    dominant_color_2    TEXT
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
    start_time_ms INTEGER NOT NULL DEFAULT 0,
    end_time_ms   INTEGER NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_songs_title_artist      ON songs(title, artist);

CREATE TABLE IF NOT EXISTS watched_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_path TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1,
    last_scan_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addons (
    id              TEXT PRIMARY KEY,
    base_url        TEXT NOT NULL UNIQUE,
    name            TEXT,
    version         TEXT,
    manifest_json   TEXT NOT NULL,
    enabled         INTEGER DEFAULT 1,
    added_at        TEXT,
    last_ok_at      TEXT,
    fail_count      INTEGER DEFAULT 0
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


# ── Schema migrations ───────────────────────────────────────────────────
# Each tuple: (version_number, list of SQL statements)
# Migrations run in order. The ladder is append-only: never modify an
# existing version number. To add a new migration, append a (N+1, [...])
# entry and bump CURRENT_VERSION.
#
# Columns added here were already baked into INIT_SQL above, so fresh
# databases skip all migrations and go straight to CURRENT_VERSION.

MIGRATIONS = [
    # Version 1: base schema (INIT_SQL creates everything).
    # For databases created before versioning existed (user_version == 0),
    # this adds columns that were previously added by try/except blocks.
    (1, [
        "ALTER TABLE playlists ADD COLUMN image_url TEXT",
        "ALTER TABLE songs ADD COLUMN file_format TEXT",
        "ALTER TABLE songs ADD COLUMN album_art_path TEXT",
        "ALTER TABLE playlist_songs ADD COLUMN start_time_ms INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE playlist_songs ADD COLUMN end_time_ms INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE playlists ADD COLUMN crossfade_enabled INTEGER DEFAULT NULL",
        "ALTER TABLE playlists ADD COLUMN crossfade_duration_s INTEGER DEFAULT NULL",
        "ALTER TABLE songs ADD COLUMN waveform_peaks TEXT",
        "ALTER TABLE songs ADD COLUMN dominant_color TEXT",
        "ALTER TABLE songs ADD COLUMN dominant_color_2 TEXT",
        "ALTER TABLE songs ADD COLUMN bleed_thumb BLOB",
        "ALTER TABLE songs ADD COLUMN bleed_region_x INTEGER",
        "ALTER TABLE songs ADD COLUMN bleed_region_y INTEGER",
        "ALTER TABLE songs ADD COLUMN bleed_region_w INTEGER",
        "ALTER TABLE songs ADD COLUMN bleed_region_h INTEGER",
        "ALTER TABLE songs ADD COLUMN file_mtime REAL",
        "ALTER TABLE songs ADD COLUMN replaygain_track_gain REAL",
        "ALTER TABLE songs ADD COLUMN replaygain_track_peak REAL",
        "ALTER TABLE songs ADD COLUMN replaygain_album_gain REAL",
        "ALTER TABLE songs ADD COLUMN replaygain_album_peak REAL",
        "ALTER TABLE songs ADD COLUMN bitrate INTEGER",
        "ALTER TABLE songs ADD COLUMN sample_rate INTEGER",
        "ALTER TABLE songs ADD COLUMN bit_depth INTEGER",
        "ALTER TABLE songs ADD COLUMN file_size INTEGER",
        "ALTER TABLE songs ADD COLUMN artists TEXT",
        "ALTER TABLE songs ADD COLUMN featured_artists TEXT",
    ]),
    # (future migrations go here as (2, [...]), (3, [...]), etc.)
    # Version 2: composite index for title+artist lookups
    (2, [
        "CREATE INDEX IF NOT EXISTS idx_songs_title_artist ON songs(title, artist)",
    ]),
    # Version 3: playlist dominant colors for cover bleed
    (3, [
        "ALTER TABLE playlists ADD COLUMN dominant_color TEXT",
        "ALTER TABLE playlists ADD COLUMN dominant_color_2 TEXT",
    ]),
    # Version 4: addon proxy — addons table + song stream/artwork columns
    (4, [
        """CREATE TABLE IF NOT EXISTS addons (
            id              TEXT PRIMARY KEY,
            base_url        TEXT NOT NULL UNIQUE,
            name            TEXT,
            version         TEXT,
            manifest_json   TEXT NOT NULL,
            enabled         INTEGER DEFAULT 1,
            added_at        TEXT,
            last_ok_at      TEXT,
            fail_count      INTEGER DEFAULT 0
        )""",
        "ALTER TABLE songs ADD COLUMN stream_url TEXT",
        "ALTER TABLE songs ADD COLUMN stream_url_expires_at TEXT",
        "ALTER TABLE songs ADD COLUMN artwork_url TEXT",
    ]),
]

CURRENT_VERSION = len(MIGRATIONS)


def _run_migrations(conn: sqlite3.Connection) -> None:
    """Run the PRAGMA user_version migration ladder."""
    current = conn.execute("PRAGMA user_version").fetchone()[0]

    if current == 0:
        # Either a fresh database or one created before versioning existed.
        # INIT_SQL already created all columns, so just stamp version 1.
        # If any column already exists (pre-existing DB), the ADD COLUMN
        # in the migration will fail — that's expected and safe to ignore
        # via the inner loop below.
        for version, stmts in MIGRATIONS:
            for stmt in stmts:
                try:
                    conn.execute(stmt)
                except sqlite3.OperationalError as e:
                    if "duplicate column" not in str(e):
                        raise
            conn.execute(f"PRAGMA user_version = {version}")
        conn.commit()
        return

    if current > CURRENT_VERSION:
        raise RuntimeError(
            f"Database is at schema version {current}, but this code only "
            f"understands up to version {CURRENT_VERSION}. "
            f"Upgrade Aurora before using this database."
        )

    # Apply forward migrations for existing versioned databases
    for version, stmts in MIGRATIONS:
        if version <= current:
            continue
        for stmt in stmts:
            try:
                conn.execute(stmt)
            except sqlite3.OperationalError as e:
                if "duplicate column" not in str(e):
                    raise
        conn.execute(f"PRAGMA user_version = {version}")

    conn.commit()


def init_db():
    """Initialize the database — create tables and run migrations."""
    import os
    with get_db_ctx() as conn:
        conn.executescript(INIT_SQL)
        _run_migrations(conn)

        # ── Backfills (idempotent — only touch NULL rows) ───────────────
        # Backfill file_format from file_path extension
        rows = conn.execute(
            "SELECT id, file_path FROM songs WHERE file_format IS NULL AND file_path IS NOT NULL"
        ).fetchall()
        for row in rows:
            ext = os.path.splitext(row["file_path"])[1].lstrip(".").lower()
            if ext:
                conn.execute("UPDATE songs SET file_format = ? WHERE id = ?", (ext, row["id"]))
        if rows:
            conn.commit()

        # Backfill album art
        _backfill_album_art(conn)


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
        except Exception as e:
            logger.warning("Album art backfill failed for %s: %s", row["file_path"], e)
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
    s.stream_url, s.stream_url_expires_at, s.artwork_url,
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
    s.bitrate, s.sample_rate, s.bit_depth, s.file_size,
    s.waveform_peaks, s.dominant_color, s.dominant_color_2,
    s.replaygain_track_gain, s.replaygain_track_peak,
    s.replaygain_album_gain, s.replaygain_album_peak,
    s.artists, s.featured_artists,
    s.stream_url, s.stream_url_expires_at, s.artwork_url,
    GROUP_CONCAT(DISTINCT t.name) as tags,
    ps.start_time_ms, ps.end_time_ms, ps.position"""

PLAYLIST_SONG_SELECT_FROM = """
FROM songs s
JOIN playlist_songs ps ON s.id = ps.song_id
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id"""

PLAYLIST_SONG_SELECT_QUERY = f"SELECT{PLAYLIST_SONG_SELECT_COLUMNS}{PLAYLIST_SONG_SELECT_FROM}"
