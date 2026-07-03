"""Test that a tableless aurora.db doesn't crash the app on startup.

Previously, if aurora.db EXISTS but has no tables (crashed first boot,
interrupted copy), the image_url UPDATE in _migrate_to_data_dir ran
before init_db() created tables → OperationalError: no such table:
playlists → lifespan aborts → every subsequent boot fails the same way.

Fix: the image_url UPDATE was moved to _migrate_image_urls(), called
in lifespan AFTER init_db().
"""
import sqlite3
from unittest.mock import patch

import pytest


@pytest.fixture
def tableless_db(tmp_path):
    """Create a tableless aurora.db in a temp DATA_DIR."""
    db_path = tmp_path / "aurora.db"
    db_path.touch()
    album_art = tmp_path / "album-art"
    playlist_images = tmp_path / "playlist-images"
    album_art.mkdir()
    playlist_images.mkdir()
    return tmp_path, db_path, album_art, playlist_images


def test_tableless_db_survives_full_startup(tableless_db):
    """A tableless aurora.db must survive full startup (migrate → init_db → migrate_urls)."""
    tmp_path, db_path, album_art, playlist_images = tableless_db

    from app.main import _migrate_to_data_dir, _migrate_image_urls

    with patch("app.main.DB_PATH", db_path), \
         patch("app.main.DATA_DIR", tmp_path), \
         patch("app.main.ALBUM_ART_DIR", album_art), \
         patch("app.main.PLAYLIST_IMAGES_DIR", playlist_images):
        # _migrate_to_data_dir must not crash (no tables yet)
        _migrate_to_data_dir()

        # init_db creates tables
        from app.database import init_db
        with patch("app.database.DB_PATH", db_path), \
             patch("app.paths.DB_PATH", db_path):
            init_db()

        # _migrate_image_urls runs safely (tables exist now)
        _migrate_image_urls()

        # Verify tables exist
        conn = sqlite3.connect(str(db_path))
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        conn.close()
        table_names = {t[0] for t in tables}
        assert "playlists" in table_names
        assert "songs" in table_names
