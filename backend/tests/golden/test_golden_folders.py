"""Golden parity tests for /api/folders endpoints."""
from tests.conftest import check_golden, check_golden_status


def test_folders_tree(client):
    """GET /api/folders — returns folder tree built from songs' file_path directories."""
    resp = client.get("/api/folders")
    data = check_golden_status("folders_tree", resp, 200)
    # Should have 2 top-level folders: music/rock and music/anime
    folders = data["data"]["folders"]
    folder_names = {f["name"] for f in folders}
    assert "music" in folder_names or len(folders) >= 1
    # music folder should contain rock and anime subfolders
    assert data["meta"]["total_songs"] == 2  # Only songs with file_path set


def test_folders_songs_rock(client):
    """GET /api/folders/songs?path=/music/rock — returns Highway Star."""
    resp = client.get("/api/folders/songs?path=/music/rock")
    data = check_golden_status("folders_songs_rock", resp, 200)
    assert data["meta"]["total"] == 1
    assert data["meta"]["path"] == "/music/rock"
    assert data["data"][0]["title"] == "Highway Star"


def test_folders_songs_anime(client):
    """GET /api/folders/songs?path=/music/anime — returns Unravel."""
    resp = client.get("/api/folders/songs?path=/music/anime")
    data = check_golden_status("folders_songs_anime", resp, 200)
    assert data["meta"]["total"] == 1
    assert data["meta"]["path"] == "/music/anime"
    assert data["data"][0]["title"] == "Unravel"


def test_folders_songs_nonexistent(client):
    """GET /api/folders/songs?path=/nonexistent — returns empty list (not 404)."""
    resp = client.get("/api/folders/songs?path=/nonexistent")
    data = check_golden_status("folders_songs_nonexistent", resp, 200)
    assert data["meta"]["total"] == 0
    assert len(data["data"]) == 0
