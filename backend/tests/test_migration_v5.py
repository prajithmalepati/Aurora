"""Test v5 migration: heal last_fail_at for pre-existing v4 DBs.

N44 F1 regression: DBs stamped user_version=4 before last_fail_at was added
to the v4 migration group would never get the column, causing GET /api/addons
to 500. The v5 migration adds it unconditionally.
"""
import sqlite3
import tempfile
from pathlib import Path


def _create_old_v4_db(db_path: str) -> sqlite3.Connection:
    """Create a DB simulating a pre-existing v4 addons era — addons table
    but WITHOUT last_fail_at, stamped user_version=4."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("""
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
        )
    """)
    conn.execute("INSERT INTO addons (id, base_url, name, version, manifest_json) VALUES (?, ?, ?, ?, ?)",
                 ("test-addon", "https://example.com", "Test", "1.0", '{"id":"test-addon"}'))
    conn.execute("PRAGMA user_version = 4")
    conn.commit()
    return conn


def test_old_v4_db_healed_by_v5():
    """An old v4 DB (addons table without last_fail_at) must be healed
    by the v5 migration: column added, user_version bumped to 5, data intact."""
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "aurora.db"
        conn = _create_old_v4_db(str(db_path))

        # Verify last_fail_at does NOT exist yet
        with conn:
            try:
                conn.execute("SELECT last_fail_at FROM addons")
                assert False, "last_fail_at should not exist before v5 migration"
            except sqlite3.OperationalError as e:
                assert "no such column" in str(e)

        # Verify the addon row exists
        rows = conn.execute("SELECT id, base_url FROM addons").fetchall()
        assert len(rows) == 1
        assert rows[0][0] == "test-addon"
        conn.close()

        # Run the migration ladder on this v4 DB
        from app.database import _run_migrations
        conn = sqlite3.connect(str(db_path))
        _run_migrations(conn)

        # Verify: last_fail_at now exists
        conn.execute("SELECT last_fail_at FROM addons")

        # Verify: user_version is now 5
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        assert version == 5, f"Expected user_version=5, got {version}"

        # Verify: data survived
        rows = conn.execute("SELECT id, base_url FROM addons").fetchall()
        assert len(rows) == 1
        assert rows[0][0] == "test-addon"

        conn.close()


def test_fresh_db_still_reaches_v5():
    """A fresh DB (user_version=0) must still reach v5 after all migrations."""
    from unittest.mock import patch
    from app.database import init_db

    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "aurora.db"
        with patch("app.database.DB_PATH", db_path), \
             patch("app.paths.DB_PATH", db_path):
            init_db()

        conn = sqlite3.connect(str(db_path))
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        assert version == 5, f"Fresh DB should be at v5, got {version}"

        # Verify addons table has last_fail_at
        cols = [row[1] for row in conn.execute("PRAGMA table_info(addons)").fetchall()]
        assert "last_fail_at" in cols, "Fresh DB must have last_fail_at column"
        conn.close()


def test_a_v5_db_skips_v5_migration():
    """A DB already at v5 must be a no-op (idempotent)."""
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "aurora.db"
        conn = _create_old_v4_db(str(db_path))

        from app.database import _run_migrations
        # First run: v4→v5
        _run_migrations(conn)

        # Verify at v5
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        assert version == 5

        # Second run: should be a no-op
        _run_migrations(conn)
        version2 = conn.execute("PRAGMA user_version").fetchone()[0]
        assert version2 == 5

        conn.close()
