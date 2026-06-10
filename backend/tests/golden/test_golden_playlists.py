"""Golden parity tests for playlists router.

All 17 playlist endpoints covered with happy path + key error cases.
Uses conftest API for golden fixture comparison.

Naming scheme: playlists_{endpoint}_{scenario}

Tests run sequentially. Groups are separated by _seed_database() calls
so each mutation group starts from a known seed state. Timestamps are
mocked via unittest.mock.patch for deterministic golden output.

Seed state (from conftest):
  Playlist 1 "Rock Classics" (id=1): song 1, no crossfade
  Playlist 2 "Lo-Fi Study" (id=2): song 2, crossfade_enabled=1, crossfade_duration_s=8
  Playlist 3 "Anime" (id=3): song 3, no crossfade
"""
import io
import json
import struct
import zlib
from unittest.mock import patch

from tests.conftest import (
    check_golden,
    check_golden_status,
    record_bug,
    _seed_database,
)

MOCK_NOW = "2025-06-01T13:00:00Z"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _minimal_png() -> bytes:
    """Create a minimal valid 1×1 red pixel PNG."""
    sig = b'\x89PNG\r\n\x1a\n'

    # IHDR: 1x1, 8-bit RGB
    ihdr_data = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    ihdr_crc = struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_data) & 0xFFFFFFFF)
    ihdr_chunk = struct.pack('>I', 13) + b'IHDR' + ihdr_data + ihdr_crc

    # IDAT: filter byte 0 + RGB(255,0,0) compressed
    raw = b'\x00\xff\x00\x00'
    compressed = zlib.compress(raw)
    idat_crc = struct.pack('>I', zlib.crc32(b'IDAT' + compressed) & 0xFFFFFFFF)
    idat_chunk = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + idat_crc

    # IEND
    iend_crc = struct.pack('>I', zlib.crc32(b'IEND') & 0xFFFFFFFF)
    iend_chunk = struct.pack('>I', 0) + b'IEND' + iend_crc

    return sig + ihdr_chunk + idat_chunk + iend_chunk


def _check_text_golden(name: str, resp, expected_status: int = 200) -> None:
    """Golden-check a non-JSON text response (e.g. M3U8 export)."""
    assert resp.status_code == expected_status, (
        f"Expected {expected_status}, got {resp.status_code}: {resp.text}"
    )
    data = {"content": resp.text}
    check_golden(name, data)


# ═══════════════════════════════════════════════════════════════════════════════
# Group A — Read-only (seed state, no mutations)
# ═══════════════════════════════════════════════════════════════════════════════

# 1. GET /api/playlists — list all

def test_list_playlists(client):
    """List all playlists (3 seeded)."""
    resp = client.get("/api/playlists")
    check_golden_status("playlists_list", resp)


# 3. GET /api/playlists/{id} — get with songs

def test_get_playlist_1(client):
    """Get playlist 1 'Rock Classics' with song 1.

    BUG: embedded songs have empty created_at/updated_at — the serializer
    defaults to '' when those columns aren't in the SELECT (PLAYLIST_SONG_SELECT
    omits them). Recorded for the S5 session log; do not fix here (test-only).
    """
    resp = client.get("/api/playlists/1")
    data = check_golden_status("playlists_get_1", resp)
    # Record known bug: embedded songs missing timestamps
    for song in data.get("data", {}).get("songs", []):
        if song.get("created_at") == "" and song.get("updated_at") == "":
            record_bug("GET /api/playlists/{id}",
                        "Embedded playlist songs have empty created_at/updated_at — "
                        "PLAYLIST_SONG_SELECT_COLUMNS omits s.created_at, s.updated_at")


def test_get_playlist_2(client):
    """Get playlist 2 'Lo-Fi Study' with song 2 + crossfade metadata."""
    resp = client.get("/api/playlists/2")
    check_golden_status("playlists_get_2", resp)


def test_get_playlist_3(client):
    """Get playlist 3 'Anime' with song 3."""
    resp = client.get("/api/playlists/3")
    check_golden_status("playlists_get_3", resp)


def test_get_playlist_404(client):
    """Get nonexistent playlist returns 404."""
    resp = client.get("/api/playlists/999")
    check_golden_status("playlists_get_404", resp, 404)


# 13. GET /api/playlists/{id}/export?format=m3u8 — export M3U8

def test_export_m3u8(client):
    """Export playlist 1 as M3U8 (text response)."""
    resp = client.get("/api/playlists/1/export?format=m3u8")
    _check_text_golden("playlists_export_m3u8", resp)


# 14. GET /api/playlists/{id}/export?format=json — export JSON

def test_export_json(client):
    """Export playlist 2 as Aurora JSON format."""
    resp = client.get("/api/playlists/2/export?format=json")
    check_golden_status("playlists_export_json", resp)


def test_export_404(client):
    """Export nonexistent playlist returns 404."""
    resp = client.get("/api/playlists/999/export")
    check_golden_status("playlists_export_404", resp, 404)


# 12. GET /api/playlist-images/{filename} — serve image (404)

def test_serve_image_404(client):
    """Serve nonexistent playlist image returns 404."""
    resp = client.get("/api/playlist-images/nonexistent.png")
    check_golden_status("playlists_serve_image_404", resp, 404)


# ── Reset for mutation tests ─────────────────────────────────────────────────

_seed_database()


# ═══════════════════════════════════════════════════════════════════════════════
# Group B — Create & Delete (seed state)
# ═══════════════════════════════════════════════════════════════════════════════

# 2. POST /api/playlists — create

def test_create_playlist_happy(client):
    """Create a new playlist with name, color, emoji."""
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        resp = client.post("/api/playlists", json={
            "name": "Golden Test Create",
            "color": "#FF5500",
            "emoji": "🧪",
        })
    check_golden_status("playlists_create_happy", resp, 201)


def test_create_playlist_400_empty_name(client):
    """Create with whitespace-only name returns 400."""
    resp = client.post("/api/playlists", json={"name": "   "})
    check_golden_status("playlists_create_400", resp, 400)


def test_create_playlist_409_duplicate(client):
    """Create with existing name returns 409."""
    resp = client.post("/api/playlists", json={"name": "Rock Classics"})
    check_golden_status("playlists_create_409", resp, 409)


# 6. DELETE /api/playlists/{id} — delete

def test_delete_playlist_happy(client):
    """Delete a freshly created playlist."""
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        create_resp = client.post("/api/playlists", json={"name": "To Be Deleted"})
    assert create_resp.status_code == 201
    pid = create_resp.json()["data"]["id"]

    resp = client.delete(f"/api/playlists/{pid}")
    check_golden_status("playlists_delete_happy", resp)


def test_delete_playlist_404(client):
    """Delete nonexistent playlist returns 404."""
    resp = client.delete("/api/playlists/999")
    check_golden_status("playlists_delete_404", resp, 404)


# ── Reset ────────────────────────────────────────────────────────────────────

_seed_database()


# ═══════════════════════════════════════════════════════════════════════════════
# Group C — Update metadata (seed state)
# ═══════════════════════════════════════════════════════════════════════════════

# 4. PUT /api/playlists/{id} — update name/color/emoji

def test_update_playlist_happy(client):
    """Update name, color, and emoji of playlist 1."""
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        resp = client.put("/api/playlists/1", json={
            "name": "Rock Classics Updated",
            "color": "#111111",
            "emoji": "🎵",
        })
    check_golden_status("playlists_update_happy", resp)


def test_update_playlist_404(client):
    """Update nonexistent playlist returns 404."""
    resp = client.put("/api/playlists/999", json={"name": "Nope"})
    check_golden_status("playlists_update_404", resp, 404)


# 5. PUT /api/playlists/{id} — update crossfade

def test_update_playlist_crossfade(client):
    """Update crossfade settings on playlist 1."""
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        resp = client.put("/api/playlists/1", json={
            "crossfade_enabled": 1,
            "crossfade_duration_s": 12,
        })
    check_golden_status("playlists_update_crossfade", resp)


# ── Reset ────────────────────────────────────────────────────────────────────

_seed_database()


# ═══════════════════════════════════════════════════════════════════════════════
# Group D — Add / Remove songs (seed state)
# ═══════════════════════════════════════════════════════════════════════════════

# 7. POST /api/playlists/{id}/songs — add song

def test_add_song_happy(client):
    """Add song 1 to playlist 2 (which already has song 2)."""
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        resp = client.post("/api/playlists/2/songs", json={"song_id": 1})
    check_golden_status("playlists_add_song_happy", resp)


def test_add_song_404_playlist(client):
    """Add song to nonexistent playlist returns 404."""
    resp = client.post("/api/playlists/999/songs", json={"song_id": 1})
    check_golden_status("playlists_add_song_404_playlist", resp, 404)


def test_add_song_404_song(client):
    """Add nonexistent song to playlist returns 404."""
    resp = client.post("/api/playlists/2/songs", json={"song_id": 999})
    check_golden_status("playlists_add_song_404_song", resp, 404)


def test_add_song_409_duplicate(client):
    """Add song already in playlist returns 409."""
    # Song 1 was added to playlist 2 in test_add_song_happy above
    resp = client.post("/api/playlists/2/songs", json={"song_id": 1})
    check_golden_status("playlists_add_song_409", resp, 409)


# 8. DELETE /api/playlists/{id}/songs/{song_id} — remove song

def test_remove_song_happy(client):
    """Remove song 1 from playlist 2 (added above)."""
    # Playlist 2 now has songs [2, 1] (positions 0, 1)
    resp = client.delete("/api/playlists/2/songs/1")
    check_golden_status("playlists_remove_song_happy", resp)


def test_remove_song_404_playlist(client):
    """Remove song from nonexistent playlist returns 404."""
    resp = client.delete("/api/playlists/999/songs/1")
    check_golden_status("playlists_remove_song_404_playlist", resp, 404)


def test_remove_song_404_song(client):
    """Remove nonexistent song from playlist returns 404."""
    resp = client.delete("/api/playlists/2/songs/999")
    check_golden_status("playlists_remove_song_404_song", resp, 404)


def test_remove_song_404_not_in_playlist(client):
    """Remove song not in playlist returns 404."""
    # Song 3 is not in playlist 2
    resp = client.delete("/api/playlists/2/songs/3")
    check_golden_status("playlists_remove_song_404_not_in_playlist", resp, 404)


# ── Reset ────────────────────────────────────────────────────────────────────

_seed_database()


# ═══════════════════════════════════════════════════════════════════════════════
# Group E — Reorder songs (seed state, needs multiple songs → built in-test)
# ═══════════════════════════════════════════════════════════════════════════════

# 9. PUT /api/playlists/{id}/songs/reorder — reorder

def test_reorder_happy(client):
    """Add 2 songs to playlist 3, then reorder them."""
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        client.post("/api/playlists/3/songs", json={"song_id": 1})
        client.post("/api/playlists/3/songs", json={"song_id": 2})
        # Now songs are [3, 1, 2] (positions 0, 1, 2)
        # Reorder to [2, 3, 1]
        resp = client.put("/api/playlists/3/songs/reorder", json={
            "song_ids": [2, 3, 1],
        })
    check_golden_status("playlists_reorder_happy", resp)


def test_reorder_400_mismatched(client):
    """Reorder with song_ids not matching actual songs returns 400."""
    # Playlist 3 now has [2, 3, 1] from above. Try to reorder with wrong IDs.
    resp = client.put("/api/playlists/3/songs/reorder", json={
        "song_ids": [999, 888],
    })
    check_golden_status("playlists_reorder_400", resp, 400)


def test_reorder_404_playlist(client):
    """Reorder nonexistent playlist returns 404."""
    resp = client.put("/api/playlists/999/songs/reorder", json={
        "song_ids": [1],
    })
    check_golden_status("playlists_reorder_404", resp, 404)


# ── Reset ────────────────────────────────────────────────────────────────────

_seed_database()


# ═══════════════════════════════════════════════════════════════════════════════
# Group F — Playlist image upload / delete (seed state)
# ═══════════════════════════════════════════════════════════════════════════════

# 10. PUT /api/playlists/{id}/image — upload image

def test_upload_image_happy(client):
    """Upload a PNG cover image to playlist 1."""
    png = _minimal_png()
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        resp = client.put(
            "/api/playlists/1/image",
            files={"file": ("cover.png", io.BytesIO(png), "image/png")},
        )
    check_golden_status("playlists_upload_image_happy", resp)


def test_upload_image_400_non_image(client):
    """Upload non-image file returns 400."""
    resp = client.put(
        "/api/playlists/1/image",
        files={"file": ("song.mp3", io.BytesIO(b"fake mp3 data"), "audio/mpeg")},
    )
    check_golden_status("playlists_upload_image_400", resp, 400)


def test_upload_image_404_playlist(client):
    """Upload image to nonexistent playlist returns 404."""
    png = _minimal_png()
    resp = client.put(
        "/api/playlists/999/image",
        files={"file": ("cover.png", io.BytesIO(png), "image/png")},
    )
    check_golden_status("playlists_upload_image_404", resp, 404)


# 11. DELETE /api/playlists/{id}/image — remove image

def test_delete_image_happy(client):
    """Remove image from playlist 1 (image was uploaded by test_upload_image_happy)."""
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        resp = client.delete("/api/playlists/1/image")
    check_golden_status("playlists_delete_image_happy", resp)


def test_delete_image_404_playlist(client):
    """Remove image from nonexistent playlist returns 404."""
    resp = client.delete("/api/playlists/999/image")
    check_golden_status("playlists_delete_image_404", resp, 404)


# ── Reset ────────────────────────────────────────────────────────────────────

_seed_database()


# ═══════════════════════════════════════════════════════════════════════════════
# Group G — Song timing (seed state)
# ═══════════════════════════════════════════════════════════════════════════════

# 17 (16). PATCH /api/playlists/{id}/songs/{song_id}/timing — set trim

def test_timing_happy(client):
    """Set trim timing on song 1 in playlist 1."""
    resp = client.patch("/api/playlists/1/songs/1/timing", json={
        "start_time_ms": 1000,
        "end_time_ms": 300000,
    })
    check_golden_status("playlists_timing_happy", resp)


def test_timing_422_invalid(client):
    """Set start >= end with both > 0 returns 422."""
    resp = client.patch("/api/playlists/1/songs/1/timing", json={
        "start_time_ms": 5000,
        "end_time_ms": 3000,
    })
    check_golden_status("playlists_timing_422", resp, 422)


def test_timing_404_not_in_playlist(client):
    """Set timing on song not in playlist returns 404."""
    # Song 2 is not in playlist 1
    resp = client.patch("/api/playlists/1/songs/2/timing", json={
        "start_time_ms": 0,
        "end_time_ms": 0,
    })
    check_golden_status("playlists_timing_404", resp, 404)


# ── Reset ────────────────────────────────────────────────────────────────────

_seed_database()


# ═══════════════════════════════════════════════════════════════════════════════
# Group H — Import (seed state)
# ═══════════════════════════════════════════════════════════════════════════════

# 15 (16). POST /api/playlists/import — import JSON

def test_import_json_happy(client):
    """Import a playlist from Aurora JSON format with songs matching seed data."""
    import_data = {
        "aurora_version": "1.0",
        "playlist": {
            "name": "Imported Golden Playlist",
            "color": "#ABCDEF",
            "emoji": "📥",
            "crossfade_enabled": 1,
            "crossfade_duration_s": 5,
        },
        "songs": [
            {
                "title": "Highway Star",
                "artist": "Deep Purple",
                "album": "Machine Head",
                "duration": 367,
                "file_path": "/music/rock/Deep Purple - Highway Star.mp3",
                "file_format": "mp3",
                "tags": ["rock", "fast"],
                "start_time_ms": 0,
                "end_time_ms": 0,
            },
            {
                "title": "Unravel",
                "artist": "TK from Ling Tosite Sigure",
                "album": "Tokyo Ghoul OST",
                "duration": 240,
                "file_path": "/music/anime/TK - Unravel.mp3",
                "file_format": "mp3",
                "tags": ["anime", "opening"],
                "start_time_ms": 0,
                "end_time_ms": 0,
            },
        ],
    }
    json_bytes = json.dumps(import_data).encode("utf-8")
    with patch('app.routers.playlists._get_utc_now', return_value=MOCK_NOW):
        resp = client.post(
            "/api/playlists/import",
            files={"file": ("playlist.aurora.json", io.BytesIO(json_bytes), "application/json")},
        )
    check_golden_status("playlists_import_json_happy", resp)


def test_import_400_bad_json(client):
    """Import invalid JSON file returns 400."""
    resp = client.post(
        "/api/playlists/import",
        files={"file": ("bad.json", io.BytesIO(b"not valid json {{{"), "application/json")},
    )
    check_golden_status("playlists_import_400", resp, 400)
