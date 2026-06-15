"""Tests for folder path normalization — Windows backslash paths must work."""
import sqlite3
from pathlib import Path
import os
import pytest


@pytest.fixture
def backslash_songs(client):
    """Insert songs with Windows backslash paths, clean up after test."""
    db_path = Path(os.environ["AURORA_DATA_DIR"]) / "aurora.db"
    conn = sqlite3.connect(str(db_path))
    # Use parameterized insert — single backslashes (real Windows paths)
    songs = [
        (100, "Backslash Song A", "Test", "C:\\Music\\Rock\\a.mp3",
         "mp3", "local_scan", 180, "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
        (101, "Backslash Song B", "Test", "C:\\Music\\Rock\\Live\\b.mp3",
         "mp3", "local_scan", 200, "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
    ]
    for s in songs:
        conn.execute(
            "INSERT INTO songs (id, title, artist, file_path, file_format, source, "
            "duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", s
        )
    conn.commit()
    conn.close()

    from app.cache import folder_cache
    folder_cache.invalidate()

    yield

    # Cleanup
    conn = sqlite3.connect(str(db_path))
    conn.execute("DELETE FROM songs WHERE id IN (100, 101)")
    conn.commit()
    conn.close()
    folder_cache.invalidate()


def test_folders_tree_backslash_paths(client, backslash_songs):
    """GET /api/folders — backslash file_paths produce a nested tree.

    Simulates Windows-stored paths (C:\\Music\\Rock\\a.mp3) and verifies
    the tree is built correctly with forward-slash normalized paths.
    """
    resp = client.get("/api/folders")
    assert resp.status_code == 200
    data = resp.json()
    folders = data["data"]["folders"]

    # Find the C: drive folder
    c_folders = [f for f in folders if f["name"] == "C:"]
    assert len(c_folders) == 1, f"Expected 'C:' folder, got: {[f['name'] for f in folders]}"

    # Navigate to Rock
    music = c_folders[0].get("subfolders", [])
    music_folders = [f for f in music if f["name"] == "Music"]
    assert len(music_folders) == 1
    rock_folders = [f for f in music_folders[0].get("subfolders", []) if f["name"] == "Rock"]
    assert len(rock_folders) == 1
    assert rock_folders[0]["song_count"] == 2  # includes Live subfolder

    # Test recursive — should return both songs
    resp = client.get("/api/folders/songs?path=/C:/Music/Rock&recursive=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["meta"]["total"] == 2
    titles = {s["title"] for s in data["data"]}
    assert titles == {"Backslash Song A", "Backslash Song B"}

    # Test non-recursive — should return only direct child (Song A)
    resp = client.get("/api/folders/songs?path=/C:/Music/Rock")
    assert resp.status_code == 200
    data = resp.json()
    assert data["meta"]["total"] == 1
    assert data["data"][0]["title"] == "Backslash Song A"


def test_folders_forward_slash_still_works(client):
    """Forward-slash paths (Linux) still work after the normalization change."""
    resp = client.get("/api/folders")
    assert resp.status_code == 200
    data = resp.json()
    # Seed data has at least 2 songs with file_paths
    assert data["meta"]["total_songs"] >= 2

    resp = client.get("/api/folders/songs?path=/music/rock")
    assert resp.status_code == 200
    data = resp.json()
    assert data["meta"]["total"] >= 1
    titles = {s["title"] for s in data["data"]}
    assert "Highway Star" in titles
