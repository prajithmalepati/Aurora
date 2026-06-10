"""Golden parity tests for /api/watch endpoints."""
import tempfile
from pathlib import Path

import pytest
from tests.conftest import check_golden, check_golden_status


def test_watch_list(client):
    """GET /api/watch — returns seeded watched folder."""
    resp = client.get("/api/watch")
    data = check_golden_status("watch_list", resp, 200)
    assert len(data["data"]) == 1
    assert data["data"][0]["id"] == 1
    assert data["data"][0]["folder_path"] == "/music/rock"
    assert data["data"][0]["is_active"] is True


def test_watch_add_folder(client):
    """POST /api/watch — add a real folder on disk."""
    # Create a temp directory that exists on the filesystem
    tmpdir = tempfile.mkdtemp(prefix="aurora_watch_test_")
    resp = client.post("/api/watch", json={"path": tmpdir})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["is_active"] is True
    # The path is resolved to absolute, so it should contain our tmpdir
    assert tmpdir in data["data"]["folder_path"] or Path(tmpdir).resolve() == Path(data["data"]["folder_path"])
    assert data["message"] == "ok"
    watch_id = data["data"]["id"]
    # Clean up: remove the folder from watch list
    client.delete(f"/api/watch/{watch_id}")


def test_watch_add_nonexistent_404(client):
    """POST /api/watch — nonexistent path returns 404."""
    resp = client.post("/api/watch", json={"path": "/nonexistent/path/xyz"})
    assert resp.status_code == 404
    detail = resp.json()["detail"]
    assert "not exist" in detail.lower() or "not a directory" in detail.lower()


def test_watch_delete_happy(client):
    """DELETE /api/watch/{id} — remove an existing watched folder."""
    # First add a folder to delete
    tmpdir = tempfile.mkdtemp(prefix="aurora_watch_del_")
    add_resp = client.post("/api/watch", json={"path": tmpdir})
    watch_id = add_resp.json()["data"]["id"]

    resp = client.delete(f"/api/watch/{watch_id}")
    data = check_golden_status("watch_delete_happy", resp, 200)
    assert data["data"]["id"] == watch_id
    assert data["message"] == "ok"

    # Verify it's gone
    list_resp = client.get("/api/watch")
    ids = [f["id"] for f in list_resp.json()["data"]]
    assert watch_id not in ids


def test_watch_delete_404(client):
    """DELETE /api/watch/99999 — nonexistent folder returns 404."""
    resp = client.delete("/api/watch/99999")
    assert resp.status_code == 404
    detail = resp.json()["detail"]
    assert "not found" in detail.lower()


def test_watch_scan_existing(client):
    """POST /api/watch/1/scan — trigger scan on seeded folder (watcher may or may not be initialized)."""
    resp = client.post("/api/watch/1/scan")
    # Watcher is initialized by lifespan in TestClient, but the seeded path
    # /music/rock likely doesn't exist — scan will import 0 songs.
    # If watcher is not initialized, we get 503.
    if resp.status_code == 503:
        # Watcher not initialized in this TestClient session — that's fine
        record_bug = getattr(pytest, "record_bug", None)
        from tests.conftest import record_bug
        record_bug("/api/watch/1/scan", "Watcher not initialized in TestClient — got 503")
        assert "not initialized" in resp.json()["detail"].lower()
    else:
        data = check_golden_status("watch_scan_existing", resp, 200)
        # Scan of /music/rock (nonexistent) should find 0 files
        assert data["data"]["imported"] == 0
