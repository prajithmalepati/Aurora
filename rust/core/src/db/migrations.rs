//! Schema + migration ladder — ported 1:1 from backend/app/database.py.
//!
//! INIT_SQL creates all tables with ALL columns (the final state).
//! MIGRATIONS is the forward-only ladder stamped via PRAGMA user_version.
//! A fresh DB (user_version=0) runs all migrations, catching "duplicate column"
//! errors from columns already created by INIT_SQL — matching Python behavior exactly.

use anyhow::Result;
use rusqlite::Connection;

/// Current schema version — derived from the migration ladder length.
/// Matches Python's `CURRENT_VERSION = len(MIGRATIONS)`.
pub const CURRENT_VERSION: i64 = MIGRATIONS.len() as i64;

/// INIT_SQL — creates all tables and indexes.
/// Must match backend/app/database.py INIT_SQL exactly.
pub const INIT_SQL: &str = r#"
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
    fail_count      INTEGER DEFAULT 0,
    last_fail_at    TEXT
);

CREATE TABLE IF NOT EXISTS aurora_ext (
    song_id         INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    play_count      INTEGER NOT NULL DEFAULT 0,
    last_played_at  TEXT,
    UNIQUE(song_id)
);
"#;

/// A single migration step: (version, list of SQL statements).
/// Matches Python MIGRATIONS exactly.
struct Migration {
    version: i64,
    stmts: &'static [&'static str],
}

/// The migration ladder — must match backend/app/database.py MIGRATIONS exactly.
const MIGRATIONS: &[Migration] = &[
    // Version 1: base schema columns (added by ALTER for pre-existing DBs)
    Migration {
        version: 1,
        stmts: &[
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
        ],
    },
    // Version 2: composite index for title+artist lookups
    Migration {
        version: 2,
        stmts: &["CREATE INDEX IF NOT EXISTS idx_songs_title_artist ON songs(title, artist)"],
    },
    // Version 3: playlist dominant colors for cover bleed
    Migration {
        version: 3,
        stmts: &[
            "ALTER TABLE playlists ADD COLUMN dominant_color TEXT",
            "ALTER TABLE playlists ADD COLUMN dominant_color_2 TEXT",
        ],
    },
    // Version 4: addon proxy — addons table + song stream/artwork columns
    Migration {
        version: 4,
        stmts: &[
            "CREATE TABLE IF NOT EXISTS addons (
                id              TEXT PRIMARY KEY,
                base_url        TEXT NOT NULL UNIQUE,
                name            TEXT,
                version         TEXT,
                manifest_json   TEXT NOT NULL,
                enabled         INTEGER DEFAULT 1,
                added_at        TEXT,
                last_ok_at      TEXT,
                fail_count      INTEGER DEFAULT 0,
                last_fail_at    TEXT
            )",
            "ALTER TABLE songs ADD COLUMN stream_url TEXT",
            "ALTER TABLE songs ADD COLUMN stream_url_expires_at TEXT",
            "ALTER TABLE songs ADD COLUMN artwork_url TEXT",
        ],
    },
    // Version 5: heal last_fail_at for pre-existing v4 DBs that were
    // created before the column was added to the v4 migration group.
    Migration {
        version: 5,
        stmts: &[
            "ALTER TABLE addons ADD COLUMN last_fail_at TEXT",
        ],
    },
];

/// Run the PRAGMA user_version migration ladder.
/// Matches Python `_run_migrations()` exactly.
pub fn run_migrations(conn: &Connection) -> Result<()> {
    let current: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

    if current == 0 {
        // Either a fresh database or one created before versioning existed.
        // INIT_SQL already created all columns, so just stamp version 1.
        // If any column already exists (pre-existing DB), the ADD COLUMN
        // in the migration will fail — that's expected and safe to ignore
        // (duplicate column error).
        for m in MIGRATIONS {
            for stmt in m.stmts {
                match conn.execute_batch(stmt) {
                    Ok(_) => {}
                    Err(e) => {
                        let msg = e.to_string();
                         if !msg.contains("duplicate column") && !msg.contains("no such table") {
                             return Err(e.into());
                         }
                    }
                }
            }
            conn.pragma_update(None, "user_version", m.version)?;
        }
        return Ok(());
    }

    if current > CURRENT_VERSION {
        anyhow::bail!(
            "Database is at schema version {current}, but this code only \
             understands up to version {CURRENT_VERSION}. \
             Upgrade Aurora before using this database."
        );
    }

    // Apply forward migrations for existing versioned databases
    for m in MIGRATIONS {
        if m.version <= current {
            continue;
        }
        for stmt in m.stmts {
            match conn.execute_batch(stmt) {
                Ok(_) => {}
                Err(e) => {
                    let msg = e.to_string();
                    if !msg.contains("duplicate column") && !msg.contains("no such table") {
                        return Err(e.into());
                    }
                }
            }
        }
        conn.pragma_update(None, "user_version", m.version)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test: fresh DB creates all tables and reaches CURRENT_VERSION.
    #[test]
    fn test_fresh_db_migration() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(INIT_SQL).unwrap();
        run_migrations(&conn).unwrap();

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, CURRENT_VERSION);
    }

    /// Test: opening an already-current DB is a no-op (no destructive ALTERs).
    #[test]
    fn test_current_db_noop() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.db");

        // First open: create + migrate
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(INIT_SQL).unwrap();
        run_migrations(&conn).unwrap();
        conn.close().unwrap();

        // Second open: should be a no-op
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(INIT_SQL).unwrap();
        run_migrations(&conn).unwrap();

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, CURRENT_VERSION);

        // Verify all tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(tables.contains(&"songs".to_string()));
        assert!(tables.contains(&"playlists".to_string()));
        assert!(tables.contains(&"tags".to_string()));
        assert!(tables.contains(&"playlist_songs".to_string()));
        assert!(tables.contains(&"song_tags".to_string()));
        assert!(tables.contains(&"watched_folders".to_string()));
        assert!(tables.contains(&"addons".to_string()));
    }

    /// Test: old v4 DB (addons table without last_fail_at) is healed by v5.
    #[test]
    fn test_old_v4_db_healed_by_v5() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Create v4 addons table WITHOUT last_fail_at + insert a row
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS addons (
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
            INSERT INTO addons (id, base_url, name, version, manifest_json)
            VALUES ('test-addon', 'https://example.com', 'Test', '1.0', '{\"id\":\"test-addon\"}');
            PRAGMA user_version = 4;
            "
        ).unwrap();

        // Verify last_fail_at does NOT exist
        let err = conn.query_row("SELECT last_fail_at FROM addons", [], |_| Ok(()));
        assert!(err.is_err());
        assert!(err.unwrap_err().to_string().contains("no such column"));

        // Run migrations — must heal to v5
        run_migrations(&conn).unwrap();

        // Verify last_fail_at exists now
        conn.query_row("SELECT last_fail_at FROM addons", [], |_| Ok(())).unwrap();

        // Verify user_version reaches CURRENT_VERSION (5)
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, CURRENT_VERSION);

        // Verify data survived
        let id: String = conn
            .query_row("SELECT id FROM addons", [], |row| row.get(0))
            .unwrap();
        assert_eq!(id, "test-addon");
    }

    /// Test: a v5 DB skips v5 migration (idempotent).
    #[test]
    fn test_v5_db_skips_v5() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Create v4 DB, heal to v5
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS addons (
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
            INSERT INTO addons (id, base_url, name, version, manifest_json)
            VALUES ('test-addon', 'https://example.com', 'Test', '1.0', '{}');
            PRAGMA user_version = 4;
            "
        ).unwrap();

        run_migrations(&conn).unwrap();

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, CURRENT_VERSION);

        // Second run: no-op
        run_migrations(&conn).unwrap();
        let version2: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version2, CURRENT_VERSION);
    }

    /// Test: version beyond CURRENT_VERSION is rejected.
    #[test]
    fn test_future_version_rejected() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.pragma_update(None, "user_version", 99).unwrap();
        drop(conn);

        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(INIT_SQL).unwrap();
        let result = run_migrations(&conn);
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("schema version 99")
        );
    }

    /// Test: fresh DB has aurora_ext table with correct schema.
    #[test]
    fn test_fresh_db_ext_table() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(INIT_SQL).unwrap();
        run_migrations(&conn).unwrap();

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 5);

        // aurora_ext table must exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='aurora_ext'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(tables.len(), 1, "aurora_ext table must exist");

        // Insert a song and verify ext row works
        conn.execute_batch(
            "INSERT INTO songs (title, artist, created_at, updated_at)
             VALUES ('Test', 'Artist', '2025-01-01', '2025-01-01')",
        )
        .unwrap();
        conn.execute_batch(
            "INSERT INTO aurora_ext (song_id, play_count, last_played_at)
             VALUES (1, 5, '2025-06-01T12:00:00Z')",
        )
        .unwrap();
        let (pc, lpa): (i64, Option<String>) = conn
            .query_row(
                "SELECT play_count, last_played_at FROM aurora_ext WHERE song_id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(pc, 5);
        assert!(lpa.is_some());

        // songs and playlists tables must NOT have ext columns
        let err = conn.query_row("SELECT play_count FROM songs WHERE id = 1", [], |_| Ok(()));
        assert!(err.is_err(), "songs table must not have play_count column");

        let err = conn.query_row("SELECT type FROM playlists", [], |_| Ok(()));
        assert!(err.is_err(), "playlists table must not have type column");
    }

    /// Test: v5 DB stays at v5 after migrations (no v6 upgrade).
    #[test]
    fn test_v5_db_stays_v5() {
        let tmp = tempfile::tempdir().unwrap();
        let db_path = tmp.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Create a v5 schema (same as INIT_SQL — no ext columns)
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;

            CREATE TABLE songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT,
                duration INTEGER,
                file_path TEXT UNIQUE,
                source TEXT NOT NULL DEFAULT 'manual',
                external_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                file_format TEXT,
                album_art_path TEXT,
                waveform_peaks TEXT,
                dominant_color TEXT,
                dominant_color_2 TEXT,
                bleed_thumb BLOB,
                bleed_region_x INTEGER,
                bleed_region_y INTEGER,
                bleed_region_w INTEGER,
                bleed_region_h INTEGER,
                file_mtime REAL,
                replaygain_track_gain REAL,
                replaygain_track_peak REAL,
                replaygain_album_gain REAL,
                replaygain_album_peak REAL,
                bitrate INTEGER,
                sample_rate INTEGER,
                bit_depth INTEGER,
                file_size INTEGER,
                artists TEXT,
                featured_artists TEXT,
                stream_url TEXT,
                stream_url_expires_at TEXT,
                artwork_url TEXT
            );

            CREATE TABLE playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                emoji TEXT,
                image_url TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                crossfade_enabled INTEGER DEFAULT NULL,
                crossfade_duration_s INTEGER DEFAULT NULL,
                dominant_color TEXT,
                dominant_color_2 TEXT
            );

            CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
            CREATE TABLE playlist_songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
                position INTEGER NOT NULL DEFAULT 0,
                added_at TEXT NOT NULL,
                start_time_ms INTEGER NOT NULL DEFAULT 0,
                end_time_ms INTEGER NOT NULL DEFAULT 0,
                UNIQUE(playlist_id, song_id)
            );
            CREATE TABLE song_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, UNIQUE(song_id, tag_id));
            CREATE TABLE addons (
                id TEXT PRIMARY KEY, base_url TEXT NOT NULL UNIQUE, name TEXT,
                version TEXT, manifest_json TEXT NOT NULL, enabled INTEGER DEFAULT 1,
                added_at TEXT, last_ok_at TEXT, fail_count INTEGER DEFAULT 0, last_fail_at TEXT
            );

            INSERT INTO songs (title, artist, created_at, updated_at, file_path)
             VALUES ('MySong', 'MyArtist', '2025-06-01', '2025-06-01', '/music/song.mp3');
            INSERT INTO playlists (name, created_at, updated_at)
             VALUES ('MyPlaylist', '2025-06-01', '2025-06-01');
            PRAGMA user_version = 5;",
        )
        .unwrap();

        // Verify pre-conditions: play_count column doesn't exist on songs
        let err = conn.query_row("SELECT play_count FROM songs", [], |_| Ok(()));
        assert!(err.is_err());

        // Run migrations — must stay at v5 (no v6 migration)
        run_migrations(&conn).unwrap();

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 5);

        // Verify existing song data survived
        let (title, artist): (String, String) = conn
            .query_row("SELECT title, artist FROM songs WHERE id = 1", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        assert_eq!(title, "MySong");
        assert_eq!(artist, "MyArtist");

        // Existing playlist data survived
        let pl_name: String = conn
            .query_row("SELECT name FROM playlists WHERE id = 1", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(pl_name, "MyPlaylist");

        // Songs table must NOT have play_count column (dual-track: ext table instead)
        let err = conn.query_row("SELECT play_count FROM songs WHERE id = 1", [], |_| Ok(()));
        assert!(err.is_err(), "v5 songs table must not have play_count column");
    }
}
