"""Golden parity tests for /api/scan endpoints."""
import os
import tempfile
import wave

import pytest


def test_scan_empty_path_422(client):
    """POST /api/scan with empty folder_path returns 422 (Pydantic rejects min_length=1)."""
    resp = client.post("/api/scan", json={"folder_path": ""})
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    # Pydantic returns an array of error objects
    errors = detail if isinstance(detail, list) else [detail]
    error_msgs = " ".join(str(e.get("msg", "")) for e in errors if isinstance(e, dict))
    assert "empty" in error_msgs.lower() or "string" in error_msgs.lower() or "length" in error_msgs.lower() or "folder_path" in str(detail).lower()


def test_scan_nonexistent_404(client):
    """POST /api/scan with nonexistent folder_path returns 404."""
    resp = client.post("/api/scan", json={"folder_path": "/nonexistent/path/xyz"})
    assert resp.status_code == 404
    detail = resp.json()["detail"]
    assert "not exist" in detail.lower() or "not a directory" in detail.lower()


def test_scan_valid_folder(client):
    """POST /api/scan with a temp folder containing a minimal WAV file — imports successfully."""
    # Create a unique temp directory with a minimal WAV file
    tmp = tempfile.mkdtemp(prefix="aurora_scan_test_")
    wav_path = os.path.join(tmp, "test.wav")
    with wave.open(wav_path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(44100)
        f.writeframes(b"\x00" * 44100 * 2)  # 1 second of silence

    try:
        resp = client.post("/api/scan", json={"folder_path": tmp})
        assert resp.status_code == 200
        data = resp.json()
        # Should have imported 1 new song
        assert data["data"]["imported"] >= 1
        assert "Scan complete" in data["message"]
        # Verify the imported song appears in songs list
        songs_resp = client.get("/api/songs")
        songs = songs_resp.json()["data"]
        # Find our test.wav in the songs
        test_song = None
        for s in songs:
            if s.get("file_path") and wav_path in s["file_path"]:
                test_song = s
                break
        assert test_song is not None, "Imported song not found in songs list"
        assert test_song["source"] == "local_scan"
    finally:
        # Clean up: remove the temp file
        if os.path.exists(wav_path):
            os.unlink(wav_path)
        if os.path.exists(tmp):
            os.rmdir(tmp)


def test_scan_stream_empty_422(client):
    """POST /api/scan/stream with empty folder_path returns 422 (Pydantic rejects min_length=1)."""
    resp = client.post("/api/scan/stream", json={"folder_path": ""})
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    # Pydantic returns an array of error objects
    errors = detail if isinstance(detail, list) else [detail]
    error_msgs = " ".join(str(e.get("msg", "")) for e in errors if isinstance(e, dict))
    assert "empty" in error_msgs.lower() or "string" in error_msgs.lower() or "length" in error_msgs.lower() or "folder_path" in str(detail).lower()


def test_scan_stream_nonexistent_404(client):
    """POST /api/scan/stream with nonexistent folder_path returns 404."""
    resp = client.post("/api/scan/stream", json={"folder_path": "/nonexistent/path/xyz"})
    assert resp.status_code == 404
    detail = resp.json()["detail"]
    assert "not exist" in detail.lower() or "not a directory" in detail.lower()


def test_scan_stream_content_type(client):
    """POST /api/scan/stream with valid folder returns SSE content-type."""
    # Create a valid temp folder (even empty) for streaming
    tmp = tempfile.mkdtemp(prefix="aurora_scan_stream_")
    try:
        resp = client.post("/api/scan/stream", json={"folder_path": tmp})
        # The streaming endpoint may return 200 with text/event-stream
        # or start streaming and we only check headers
        assert resp.status_code == 200
        assert resp.headers.get("content-type", "").startswith("text/event-stream")
    finally:
        if os.path.exists(tmp):
            os.rmdir(tmp)
