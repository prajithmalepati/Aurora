"""Golden parity tests for /api/albums endpoints."""
import pytest
from tests.conftest import check_golden, check_golden_status


def test_albums_list(client):
    """GET /api/albums — returns all albums with aggregated metadata."""
    resp = client.get("/api/albums")
    data = check_golden_status("albums_list", resp, 200)
    # Seed data has 3 songs: Machine Head (Highway Star), None (Chill Vibes), Tokyo Ghoul OST (Unravel)
    assert data["meta"]["total"] >= 2  # at least Machine Head and Tokyo Ghoul OST
    album_names = [a["album_name"] for a in data["data"]]
    assert "Machine Head" in album_names
    assert "Tokyo Ghoul OST" in album_names


def test_albums_get_machine_head(client):
    """GET /api/albums/Machine%20Head — returns album with its songs."""
    resp = client.get("/api/albums/Machine%20Head")
    data = check_golden_status("albums_get_machine_head", resp, 200)
    assert data["data"]["album_name"] == "Machine Head"
    songs = data["data"]["songs"]
    assert len(songs) == 1
    assert songs[0]["title"] == "Highway Star"


def test_albums_get_nonexistent(client):
    """GET /api/albums/nonexistent — returns 404."""
    resp = client.get("/api/albums/nonexistent")
    assert resp.status_code == 404
    detail = resp.json()["detail"]
    assert detail == "Album not found"
