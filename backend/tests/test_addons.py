"""Tests for the addon proxy system (T3 + T4 + T5 + F1-F4).

Tests against a mock addon server implementing the EclipseMusic/BeatBoss protocol.
Covers: CRUD, search/stream/lyrics proxy, SSRF rejection, save-as-song, tag filtering,
redirect SSRF (F1), DNS rebinding (F2), response size cap (F3), circuit breaker (F4).
"""
import asyncio
import inspect
import json
import socket
import threading
import time

import httpcore
import pytest
import uvicorn
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta

from tests.conftest import _seed_database, TS_CREATE

# ── Mock addon server fixture ────────────────────────────────────────────

def _free_port() -> int:
    """Find a free TCP port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


MOCK_PORT = _free_port()
MOCK_BASE_URL = f"http://localhost:{MOCK_PORT}"


@pytest.fixture(scope="module")
def mock_addon_server():
    """Start the mock addon server on a random port for the test module."""
    from tests.mock_addon import app as mock_app

    config = uvicorn.Config(mock_app, host="127.0.0.1", port=MOCK_PORT, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    # Wait for server to be ready
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", MOCK_PORT), timeout=0.5):
                break
        except OSError:
            time.sleep(0.1)
    else:
        raise RuntimeError("Mock addon server failed to start")

    yield MOCK_BASE_URL

    server.should_exit = True


# ── Reset DB for this module ─────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def _reset_db():
    _seed_database()


@pytest.fixture(scope="module")
def client(mock_addon_server):
    """FastAPI TestClient with mock addon available."""
    with TestClient(app) as tc:
        yield tc


# Import app after DB seed
from app.main import app
from app.routers.addons import (
    addon_search_cache,
    addon_stream_cache,
    addon_lyrics_cache,
    _rate_limiters,
    _check_circuit,
    _SSRFNetworkBackend,
    _safe_get,
    _get_client,
    _MAX_BODY_PROXY,
)


import app.routers.addons as _addons_module


@pytest.fixture(autouse=True)
def _clear_addon_state():
    """Clear addon caches, rate limiters, and HTTP client between tests."""
    addon_search_cache.invalidate()
    addon_stream_cache.invalidate()
    addon_lyrics_cache.invalidate()
    _rate_limiters.clear()
    _addons_module._client = None  # reset cached httpx client
    yield


# ── CRUD Tests ───────────────────────────────────────────────────────────

def test_addon_crud_flow(client, mock_addon_server):
    """Full CRUD lifecycle: add → list → toggle → delete."""
    base_url = mock_addon_server

    resp = client.post("/api/addons", json={"base_url": base_url})
    assert resp.status_code == 200
    data = resp.json()["data"]
    addon_id = data["id"]
    assert addon_id == "org.mock.musicsource"
    assert data["name"] == "Mock Music Addon"
    assert data["version"] == "1.0.0"
    assert data["enabled"] is True
    assert data["fail_count"] == 0

    resp = client.get("/api/addons")
    assert resp.status_code == 200
    addons = resp.json()["data"]
    assert len(addons) == 1
    assert addons[0]["id"] == addon_id

    resp = client.patch(f"/api/addons/{addon_id}", json={"enabled": False})
    assert resp.status_code == 200

    resp = client.get("/api/addons")
    assert resp.json()["data"][0]["enabled"] is False

    resp = client.patch(f"/api/addons/{addon_id}", json={"enabled": True})
    assert resp.status_code == 200

    resp = client.delete(f"/api/addons/{addon_id}")
    assert resp.status_code == 200

    resp = client.get("/api/addons")
    assert len(resp.json()["data"]) == 0


def test_addon_duplicate_rejected(client, mock_addon_server):
    """Adding the same addon twice returns 409."""
    base_url = mock_addon_server

    resp1 = client.post("/api/addons", json={"base_url": base_url})
    assert resp1.status_code == 200

    resp2 = client.post("/api/addons", json={"base_url": base_url})
    assert resp2.status_code == 409
    assert "already registered" in resp2.json()["detail"]

    addon_id = resp1.json()["data"]["id"]
    client.delete(f"/api/addons/{addon_id}")


def test_addon_bad_manifest(client):
    """Fetching an invalid manifest URL returns 502."""
    resp = client.post("/api/addons", json={"base_url": "http://localhost:1"})
    assert resp.status_code == 502


# ── Proxy Tests ──────────────────────────────────────────────────────────

def test_addon_search(client, mock_addon_server):
    """Search returns normalized results in Aurora envelope."""
    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    resp = client.get(f"/api/addons/{addon_id}/search", params={"q": "sunset"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "ok"
    assert data["meta"]["addon_id"] == addon_id
    assert len(data["data"]["tracks"]) == 1
    assert data["data"]["tracks"][0]["title"] == "CC Sunset"

    client.delete(f"/api/addons/{addon_id}")


def test_addon_search_no_results(client, mock_addon_server):
    """Search with no matches returns empty tracks array."""
    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    resp = client.get(f"/api/addons/{addon_id}/search", params={"q": "nonexistent"})
    assert resp.status_code == 200
    assert resp.json()["data"]["tracks"] == []

    client.delete(f"/api/addons/{addon_id}")


def test_addon_stream(client, mock_addon_server):
    """Stream resolves a track ID to a playable URL."""
    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    resp = client.get(f"/api/addons/{addon_id}/stream/mock_track_001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["url"] == "https://cdn.example.com/mock_track_001.mp3"
    assert data["data"]["format"] == "mp3"
    assert "expiresAt" in data["data"]

    client.delete(f"/api/addons/{addon_id}")


def test_addon_lyrics(client, mock_addon_server):
    """Lyrics returns LRC-formatted text."""
    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    resp = client.get(
        f"/api/addons/{addon_id}/lyrics",
        params={"artist": "OpenAudio", "title": "CC Sunset"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "[00:05.00]" in data["data"]["lyrics"]
    assert "CC Sunset" in data["data"]["lyrics"]

    client.delete(f"/api/addons/{addon_id}")


# ── SSRF Tests ───────────────────────────────────────────────────────────

def test_ssrf_rejects_private_ip(client):
    """SSRF blocks requests to private/reserved IPs."""
    resp = client.post("/api/addons", json={"base_url": "https://10.0.0.1"})
    assert resp.status_code == 400
    assert "private" in resp.json()["detail"].lower() or "resolves" in resp.json()["detail"].lower()

    resp = client.post("/api/addons", json={"base_url": "https://192.168.1.1"})
    assert resp.status_code == 400

    resp = client.post("/api/addons", json={"base_url": "https://169.254.169.254"})
    assert resp.status_code == 400


def test_ssrf_rejects_unsupported_scheme(client):
    """SSRF blocks non-http/https schemes."""
    resp = client.post("/api/addons", json={"base_url": "ftp://example.com"})
    assert resp.status_code == 400
    assert "scheme" in resp.json()["detail"].lower()


def test_ssrf_allows_localhost_http(client):
    """SSRF allows http://localhost (dev mode)."""
    resp = client.post("/api/addons", json={"base_url": "http://localhost:1"})
    assert resp.status_code == 502  # connection refused, not SSRF rejection


# ── F1: Redirect SSRF Tests ────────────────────────────────────────────────

def test_f1_no_auto_follow():
    """F1: httpx does NOT auto-follow redirects (follow_redirects=False)."""
    async def check():
        c = await _get_client()
        return c.follow_redirects

    result = asyncio.run(check())
    assert result is False, "httpx client should have follow_redirects=False"


def test_f1_safe_get_validates_each_hop(mock_addon_server):
    """F1: _safe_get validates each redirect hop before following.

    The mock addon's /redirect-to-private returns 302 → http://169.254.169.254/.
    _safe_get should block this at the redirect target validation.
    """
    async def test():
        client = await _get_client()
        url = f"{mock_addon_server}/redirect-to-private"
        with pytest.raises(Exception) as exc_info:
            await _safe_get(client, url)
        detail = str(exc_info.value)
        assert (
            "private" in detail.lower()
            or "ssrf" in detail.lower()
            or "169.254" in detail
            or "http is only allowed" in detail.lower()
        ), f"Expected SSRF rejection, got: {detail}"

    asyncio.run(test())


# ── F2: DNS Rebinding Tests ────────────────────────────────────────────────

def test_f2_ssrf_network_backend_blocks_private_ip():
    """F2: The _SSRFNetworkBackend validates the resolved IP at connect time.

    Unit test: calling connect_tcp with a private IP should raise ConnectError
    without reaching the inner backend.
    """
    class FakeBackend(httpcore.AsyncNetworkBackend):
        """Fake backend that records connect attempts."""
        def __init__(self):
            self.connect_attempts = []

        async def connect_tcp(self, host, port, **kwargs):
            self.connect_attempts.append((host, port))
            return "fake_stream"

        async def connect_unix_socket(self, path, **kwargs):
            return "fake_stream"

        async def sleep(self, seconds):
            pass

    fake = FakeBackend()
    ssrf_backend = _SSRFNetworkBackend(fake)

    # Test 1: localhost should pass through (bypasses DNS)
    async def test_localhost():
        stream = await ssrf_backend.connect_tcp("localhost", 8080)
        assert stream == "fake_stream"
        assert fake.connect_attempts == [("localhost", 8080)]

    asyncio.run(test_localhost())

    # Test 2: a private IP should be blocked
    async def test_private_ip():
        fake.connect_attempts.clear()
        with pytest.raises(httpcore.ConnectError, match="SSRF blocked"):
            await ssrf_backend.connect_tcp("127.0.0.2", 8080)
        assert len(fake.connect_attempts) == 0

    asyncio.run(test_private_ip())

    # Test 3: 10.x.x.x should be blocked
    async def test_private_10():
        fake.connect_attempts.clear()
        with pytest.raises(httpcore.ConnectError, match="SSRF blocked"):
            await ssrf_backend.connect_tcp("10.0.0.1", 8080)
        assert len(fake.connect_attempts) == 0

    asyncio.run(test_private_10())


# ── F3: Response Size Cap Tests ─────────────────────────────────────────────

def test_f3_size_cap_enforced_on_streaming_read():
    """F3: The size cap is enforced during streaming read, not just Content-Length.

    Verifies _safe_get uses aiter_bytes and checks body size incrementally.
    """
    src = inspect.getsource(_safe_get)
    assert "aiter_bytes" in src, "_safe_get should stream body chunks"
    assert "max_body_bytes" in src, "_safe_get should check body size against cap"


def test_f3_content_length_pre_check():
    """F3: Content-Length is pre-checked before reading the body."""
    src = inspect.getsource(_safe_get)
    assert "content-length" in src, "_safe_get should pre-check Content-Length header"


# ── F4: Circuit Breaker Tests ───────────────────────────────────────────────

def test_f4_circuit_breaker_keys_off_last_failure():
    """F4: Circuit breaker measures cooldown from last failure, not last success."""
    # Below threshold → circuit closed
    assert _check_circuit("test_addon", 2, None) is False

    # At threshold, no last_fail_at → circuit open (never succeeded)
    assert _check_circuit("test_addon", 3, None) is True

    # At threshold, recent failure → circuit open
    recent_fail = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert _check_circuit("test_addon", 3, recent_fail) is True

    # At threshold, old failure (> cooldown) → circuit half-open
    old_fail = (datetime.now(timezone.utc) - timedelta(minutes=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert _check_circuit("test_addon", 3, old_fail) is False

    # Below threshold always passes regardless of last_fail_at
    assert _check_circuit("test_addon", 0, None) is False
    assert _check_circuit("test_addon", 1, recent_fail) is False


def test_f4_circuit_breaker_never_succeeded_case(client, mock_addon_server):
    """F4: An addon that never succeeded stays open until cooldown from last failure."""
    from app.database import get_db_ctx

    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    # Simulate 3 failures with recent last_fail_at, last_ok_at = NULL
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_db_ctx() as conn:
        conn.execute(
            "UPDATE addons SET fail_count = 3, last_fail_at = ?, last_ok_at = NULL WHERE id = ?",
            (now, addon_id),
        )
        conn.commit()

    # Circuit should be open
    resp = client.get(f"/api/addons/{addon_id}/search", params={"q": "test"})
    assert resp.status_code == 503
    assert "circuit breaker" in resp.json()["detail"].lower()

    # Set last_fail_at to old (cooldown elapsed)
    old_fail = (datetime.now(timezone.utc) - timedelta(minutes=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_db_ctx() as conn:
        conn.execute(
            "UPDATE addons SET last_fail_at = ? WHERE id = ?",
            (old_fail, addon_id),
        )
        conn.commit()

    # Circuit half-open — request should go through and succeed
    resp = client.get(f"/api/addons/{addon_id}/search", params={"q": "sunset"})
    assert resp.status_code == 200

    # Verify circuit reset after success
    with get_db_ctx() as conn:
        row = conn.execute("SELECT fail_count, last_ok_at FROM addons WHERE id = ?", (addon_id,)).fetchone()
        assert row["fail_count"] == 0
        assert row["last_ok_at"] is not None

    client.delete(f"/api/addons/{addon_id}")


# ── Disabled/Circuit Breaker Tests ───────────────────────────────────────

def test_disabled_addon_returns_403(client, mock_addon_server):
    """Requests to a disabled addon return 403."""
    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    client.patch(f"/api/addons/{addon_id}", json={"enabled": False})

    resp = client.get(f"/api/addons/{addon_id}/search", params={"q": "test"})
    assert resp.status_code == 403

    client.patch(f"/api/addons/{addon_id}", json={"enabled": True})
    client.delete(f"/api/addons/{addon_id}")


def test_nonexistent_addon_returns_404(client):
    """Requests to a nonexistent addon return 404."""
    resp = client.get("/api/addons/nonexistent/search", params={"q": "test"})
    assert resp.status_code == 404


# ── Save-as-Song + Tag Filtering (T4) ────────────────────────────────────

def test_save_addon_track_and_filter(client, mock_addon_server):
    """Save an addon track, then verify it's taggable and filterable."""
    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    resp = client.post(f"/api/addons/{addon_id}/save", json={
        "title": "CC Sunset",
        "artist": "OpenAudio",
        "album": "Free Sounds Vol. 1",
        "duration": 195,
        "external_id": "mock_track_001",
        "artwork_url": "https://example.com/art/sunset.jpg",
    })
    assert resp.status_code == 200
    song = resp.json()["data"]
    assert song["title"] == "CC Sunset"
    assert song["source"] == f"addon:{addon_id}"
    assert song["stream_url"] is not None
    assert song["file_path"] is None

    song_id = song["id"]

    resp = client.post(f"/api/songs/{song_id}/tags", json={"tag_names": ["streaming", "chill"]})
    assert resp.status_code == 200

    resp = client.get(f"/api/songs/{song_id}")
    assert resp.status_code == 200
    song_data = resp.json()["data"]
    assert "streaming" in song_data["tags"]
    assert "chill" in song_data["tags"]

    all_songs = client.get("/api/songs").json()["data"]
    addon_songs = [s for s in all_songs if s["source"] == f"addon:{addon_id}"]
    assert len(addon_songs) == 1
    assert addon_songs[0]["title"] == "CC Sunset"

    resp = client.post(f"/api/addons/{addon_id}/save", json={
        "title": "CC Sunset",
        "artist": "OpenAudio",
        "external_id": "mock_track_001",
    })
    assert resp.status_code == 409

    client.delete(f"/api/addons/{addon_id}")


# ── Stream Resolution (T4) ───────────────────────────────────────────────

def test_resolve_stream_local_file(client):
    """Resolve a local song returns type=local."""
    resp = client.get("/api/songs/1/resolve")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "local"


def test_resolve_stream_fresh_url(client, mock_addon_server):
    """Resolve an addon song with fresh stream URL returns type=stream."""
    resp = client.post("/api/addons", json={"base_url": mock_addon_server})
    addon_id = resp.json()["data"]["id"]

    resp = client.post(f"/api/addons/{addon_id}/save", json={
        "title": "Morning Dew",
        "artist": "OpenAudio",
        "external_id": "mock_track_002",
        "stream_url": "https://cdn.example.com/mock_track_002.flac",
    })
    song_id = resp.json()["data"]["id"]

    resp = client.get(f"/api/songs/{song_id}/resolve")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "stream"
    assert "cdn.example.com" in data["url"]

    client.delete(f"/api/addons/{addon_id}")
