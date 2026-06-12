"""Golden parity tests for /api/tags endpoints.

Covers tag CRUD and song-tag assignment/removal with happy paths and key error cases.
"""
import pytest
from tests.conftest import check_golden, check_golden_status, _seed_database


@pytest.fixture(scope="module", autouse=True)
def _reset_db():
    """Re-seed DB before this module's tests execute (not at import time)."""
    _seed_database()


# ── GET /api/tags (list) ─────────────────────────────────────────────────────

def test_tags_list(client):
    """GET /api/tags — returns all 6 seeded tags with song counts."""
    resp = client.get("/api/tags")
    data = check_golden_status("tags_list", resp, 200)
    assert data["meta"]["total"] == 6
    assert len(data["data"]) == 6
    # Tags should be sorted alphabetically by name
    names = [t["name"] for t in data["data"]]
    assert names == sorted(names)
    # Verify song counts for seeded links
    tag_map = {t["name"]: t["song_count"] for t in data["data"]}
    assert tag_map["rock"] == 1
    assert tag_map["fast"] == 1
    assert tag_map["anime"] == 1
    assert tag_map["opening"] == 1
    assert tag_map["slow"] == 1
    assert tag_map["chill"] == 1


# ── POST /api/tags (create) ──────────────────────────────────────────────────

def test_tags_create_happy(client):
    """POST /api/tags — creates a new tag and returns it with song_count=0.

    Timestamps are current (datetime.now()), so golden comparison would fail
    across runs. We use raw assertions and strip timestamps for golden.
    """
    resp = client.post("/api/tags", json={"name": "golden-test-tag"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["data"]["name"] == "golden-test-tag"
    assert data["data"]["song_count"] == 0
    assert data["data"]["id"] is not None
    # Strip runtime timestamps for deterministic golden comparison
    stripped = dict(data)
    stripped["data"] = {k: v for k, v in data["data"].items()
                        if k != "created_at"}
    check_golden("tags_create_happy", stripped)


def test_tags_create_422_empty(client):
    """POST /api/tags with empty name — returns 422 (Pydantic min_length=1
    catches empty string before the endpoint's 400 check)."""
    resp = client.post("/api/tags", json={"name": ""})
    check_golden_status("tags_create_422_empty", resp, 422)


def test_tags_create_409_duplicate(client):
    """POST /api/tags with existing name 'rock' — returns 409 conflict."""
    resp = client.post("/api/tags", json={"name": "rock"})
    check_golden_status("tags_create_409_duplicate", resp, 409)


# ── POST /api/songs/{song_id}/tags (assign tags to song) ─────────────────────

def test_tags_assign_happy(client):
    """POST /api/songs/1/tags — assigns new tags to Highway Star."""
    resp = client.post("/api/songs/1/tags", json={
        "tag_names": ["golden-alpha", "golden-beta"],
    })
    data = check_golden_status("tags_assign_happy", resp, 200)
    # Song 1 should now have its original tags + the new ones
    tags = data["data"]["tags"]
    assert "rock" in tags
    assert "fast" in tags
    assert "golden-alpha" in tags
    assert "golden-beta" in tags


def test_tags_assign_422_empty(client):
    """POST /api/songs/1/tags with empty tag_names — returns 422
    (Pydantic min_length=1 on list catches it before the endpoint's 400)."""
    resp = client.post("/api/songs/1/tags", json={"tag_names": []})
    check_golden_status("tags_assign_422_empty", resp, 422)


def test_tags_assign_404_song(client):
    """POST /api/songs/999/tags — returns 404 (nonexistent song)."""
    resp = client.post("/api/songs/999/tags", json={
        "tag_names": ["test"],
    })
    check_golden_status("tags_assign_404_song", resp, 404)


# ── DELETE /api/songs/{song_id}/tags/{tag_id} (remove tag from song) ─────────

def test_tags_remove_happy(client):
    """DELETE /api/songs/1/tags/1 — removes 'rock' tag (id=1) from song 1."""
    resp = client.delete("/api/songs/1/tags/1")
    data = check_golden_status("tags_remove_happy", resp, 200)
    # Song 1 should no longer have 'rock'
    tags = data["data"]["tags"]
    assert "rock" not in tags
    assert "fast" in tags


def test_tags_remove_404_song(client):
    """DELETE /api/songs/999/tags/1 — returns 404 (nonexistent song)."""
    resp = client.delete("/api/songs/999/tags/1")
    check_golden_status("tags_remove_404_song", resp, 404)


def test_tags_remove_404_tag(client):
    """DELETE /api/songs/1/tags/99999 — returns 404 (nonexistent tag)."""
    resp = client.delete("/api/songs/1/tags/99999")
    check_golden_status("tags_remove_404_tag", resp, 404)


def test_tags_remove_404_link(client):
    """DELETE /api/songs/2/tags/1 — returns 404 (tag 1 exists, song 2 exists,
    but tag 1 was only linked to song 1 and is not linked to song 2)."""
    resp = client.delete("/api/songs/2/tags/1")
    check_golden_status("tags_remove_404_link", resp, 404)


# ── DELETE /api/tags/{tag_id} ────────────────────────────────────────────────

def test_tags_delete_happy(client):
    """DELETE /api/tags/7 — deletes the 'golden-test-tag' created earlier.
    Tag was never linked to any song, so delete succeeds cleanly."""
    resp = client.delete("/api/tags/7")
    data = check_golden_status("tags_delete_happy", resp, 200)
    assert data["data"] is None
    assert "deleted" in data["message"].lower()


def test_tags_delete_404(client):
    """DELETE /api/tags/99999 — returns 404 (nonexistent tag)."""
    resp = client.delete("/api/tags/99999")
    check_golden_status("tags_delete_404", resp, 404)
