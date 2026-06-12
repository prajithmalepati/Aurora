"""Golden parity tests for /api/songs and /api/album-art endpoints.

Covers all endpoints: list, get, create, update, delete, stream, bleed-thumb,
and album-art serving — with happy paths and key error cases.
"""
import pytest
from tests.conftest import check_golden, check_golden_status, record_bug, _seed_database


@pytest.fixture(scope="module", autouse=True)
def _reset_db():
    """Re-seed DB before this module's tests execute (not at import time)."""
    _seed_database()


# ── GET /api/songs (list) ────────────────────────────────────────────────────

def test_songs_list(client):
    """GET /api/songs — returns all 3 seeded songs sorted by title (default)."""
    resp = client.get("/api/songs")
    data = check_golden_status("songs_list", resp, 200)
    assert data["meta"]["total"] == 3
    assert len(data["data"]) == 3


def test_songs_list_search(client):
    """GET /api/songs?search=Deep — returns only Highway Star."""
    resp = client.get("/api/songs", params={"search": "Deep"})
    data = check_golden_status("songs_list_search", resp, 200)
    assert data["meta"]["total"] == 1
    assert data["data"][0]["title"] == "Highway Star"


def test_songs_list_sort_artist_desc(client):
    """GET /api/songs?sort=artist&order=desc — sorted by artist descending."""
    resp = client.get("/api/songs", params={"sort": "artist", "order": "desc"})
    data = check_golden_status("songs_list_sort_artist_desc", resp, 200)
    assert data["meta"]["total"] == 3
    # TK from Ling Tosite Sigure > LoFi Girl > Deep Purple (descending alpha)
    artists = [s["artist"] for s in data["data"]]
    assert artists[0] == "TK from Ling Tosite Sigure"


def test_songs_list_limit_offset(client):
    """GET /api/songs?limit=1&offset=1 — pagination returns second song only."""
    resp = client.get("/api/songs", params={"limit": 1, "offset": 1})
    data = check_golden_status("songs_list_limit_offset", resp, 200)
    assert data["meta"]["total"] == 3
    assert len(data["data"]) == 1


# ── GET /api/songs/{id} ──────────────────────────────────────────────────────

def test_songs_get_1(client):
    """GET /api/songs/1 — Highway Star with waveform_peaks and rich metadata."""
    resp = client.get("/api/songs/1")
    data = check_golden_status("songs_get_1", resp, 200)
    assert data["data"]["title"] == "Highway Star"
    assert data["data"]["waveform_peaks"] is not None


def test_songs_get_2(client):
    """GET /api/songs/2 — Chill Vibes (minimal manual entry, no file_path)."""
    resp = client.get("/api/songs/2")
    data = check_golden_status("songs_get_2", resp, 200)
    assert data["data"]["title"] == "Chill Vibes"
    assert data["data"]["file_path"] is None
    assert data["data"]["album"] is None


def test_songs_get_3(client):
    """GET /api/songs/3 — Unravel with featured_artists and anime tags."""
    resp = client.get("/api/songs/3")
    data = check_golden_status("songs_get_3", resp, 200)
    assert data["data"]["title"] == "Unravel"
    assert data["data"]["tags"] == ["anime", "opening"]


def test_songs_get_404(client):
    """GET /api/songs/999 — returns 404 for nonexistent song."""
    resp = client.get("/api/songs/999")
    check_golden_status("songs_get_404", resp, 404)


# ── POST /api/songs (create) ─────────────────────────────────────────────────

def test_songs_create_happy(client):
    """POST /api/songs — creates a new song and returns full song data.

    Timestamps are current (datetime.now()), so golden comparison would fail
    across runs. We use raw assertions and strip timestamps for golden.
    """
    resp = client.post("/api/songs", json={
        "title": "Golden Test Song",
        "artist": "Test Artist",
        "album": "Test Album",
        "duration": 200,
        "file_path": "/tmp/golden_test.mp3",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["data"]["title"] == "Golden Test Song"
    assert data["data"]["artist"] == "Test Artist"
    assert data["data"]["source"] == "manual"
    assert data["data"]["id"] is not None
    # Strip runtime timestamps for deterministic golden comparison
    stripped = dict(data)
    stripped["data"] = {k: v for k, v in data["data"].items()
                        if k not in ("created_at", "updated_at")}
    check_golden("songs_create_happy", stripped)


def test_songs_create_422_empty_title(client):
    """POST /api/songs with empty title — returns 422 (Pydantic min_length=1
    catches empty string before the endpoint's 400 check)."""
    resp = client.post("/api/songs", json={
        "title": "",
        "artist": "x",
    })
    check_golden_status("songs_create_422_empty_title", resp, 422)


def test_songs_create_409_duplicate(client):
    """POST /api/songs with existing file_path — returns 409 conflict."""
    resp = client.post("/api/songs", json={
        "title": "Duplicate File",
        "artist": "Test",
        "file_path": "/tmp/golden_test.mp3",  # same as songs_create_happy
    })
    check_golden_status("songs_create_409_duplicate", resp, 409)


# ── PUT /api/songs/{id} (update) ─────────────────────────────────────────────

def test_songs_update_happy(client):
    """PUT /api/songs/4 — updates the title of the song created above.

    Timestamps are current (datetime.now()), so golden comparison would fail
    across runs. We use raw assertions and strip timestamps for golden.
    """
    resp = client.put("/api/songs/4", json={"title": "Updated Golden Song"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["title"] == "Updated Golden Song"
    # Artist should remain unchanged
    assert data["data"]["artist"] == "Test Artist"
    # Strip runtime timestamps for deterministic golden comparison
    stripped = dict(data)
    stripped["data"] = {k: v for k, v in data["data"].items()
                        if k not in ("created_at", "updated_at")}
    check_golden("songs_update_happy", stripped)


def test_songs_update_422_empty_artist(client):
    """PUT /api/songs/4 with empty artist — returns 422 (Pydantic min_length=1
    catches empty string before the endpoint's 400 check)."""
    resp = client.put("/api/songs/4", json={"artist": ""})
    check_golden_status("songs_update_422_empty_artist", resp, 422)


def test_songs_update_404(client):
    """PUT /api/songs/999 — returns 404 for nonexistent song."""
    resp = client.put("/api/songs/999", json={"title": "No Such Song"})
    check_golden_status("songs_update_404", resp, 404)


# ── DELETE /api/songs/{id} ───────────────────────────────────────────────────

def test_songs_delete_happy(client):
    """DELETE /api/songs/4 — deletes the song created earlier."""
    resp = client.delete("/api/songs/4")
    data = check_golden_status("songs_delete_happy", resp, 200)
    assert data["data"] is None
    assert "deleted" in data["message"].lower()


def test_songs_delete_404(client):
    """DELETE /api/songs/4 again — returns 404 (already deleted)."""
    resp = client.delete("/api/songs/4")
    check_golden_status("songs_delete_404", resp, 404)


# ── GET /api/songs/{id}/stream ───────────────────────────────────────────────

def test_songs_stream_404_no_file(client):
    """GET /api/songs/2/stream — returns 404 (song 2 has file_path=None)."""
    resp = client.get("/api/songs/2/stream")
    check_golden_status("songs_stream_404_no_file", resp, 404)


def test_songs_stream_404_not_found(client):
    """GET /api/songs/999/stream — returns 404 (nonexistent song)."""
    resp = client.get("/api/songs/999/stream")
    check_golden_status("songs_stream_404_not_found", resp, 404)


# ── GET /api/songs/{id}/bleed-thumb ──────────────────────────────────────────

def test_songs_bleed_thumb_404(client):
    """GET /api/songs/1/bleed-thumb — returns 404 (no bleed_thumb in seed data)."""
    resp = client.get("/api/songs/1/bleed-thumb")
    check_golden_status("songs_bleed_thumb_404", resp, 404)


# ── GET /api/album-art/{filename} ────────────────────────────────────────────

def test_album_art_404(client):
    """GET /api/album-art/nonexistent.jpg — returns 404 (no such art file)."""
    resp = client.get("/api/album-art/nonexistent.jpg")
    check_golden_status("album_art_404", resp, 404)
