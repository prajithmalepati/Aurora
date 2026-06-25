"""Mock addon server for testing the addon proxy.

Implements the EclipseMusic/BeatBoss-compatible protocol:
- GET /manifest.json
- GET /search?q=&limit=
- GET /stream/{id}
- GET /lyrics?artist=&title=

Runs as a standalone FastAPI app on a random port.
"""
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Query
from typing import Optional

app = FastAPI(title="Mock Music Addon")

# ── Fake catalog ─────────────────────────────────────────────────────────

TRACKS = [
    {
        "id": "mock_track_001",
        "title": "CC Sunset",
        "artist": "OpenAudio",
        "album": "Free Sounds Vol. 1",
        "duration": 195,
        "artworkURL": "https://example.com/art/sunset.jpg",
        "format": "mp3",
    },
    {
        "id": "mock_track_002",
        "title": "Morning Dew",
        "artist": "OpenAudio",
        "album": "Free Sounds Vol. 1",
        "duration": 240,
        "artworkURL": "https://example.com/art/dew.jpg",
        "format": "flac",
    },
    {
        "id": "mock_track_003",
        "title": "Electric Dreams",
        "artist": "SynthWave CC",
        "album": "Neon Nights",
        "duration": 310,
        "artworkURL": "https://example.com/art/neon.jpg",
        "format": "mp3",
    },
]

STREAM_URLS = {
    "mock_track_001": "https://cdn.example.com/mock_track_001.mp3",
    "mock_track_002": "https://cdn.example.com/mock_track_002.flac",
    "mock_track_003": "https://cdn.example.com/mock_track_003.mp3",
}


# ── Manifest ─────────────────────────────────────────────────────────────

@app.get("/manifest.json")
def manifest():
    return {
        "id": "org.mock.musicsource",
        "name": "Mock Music Addon",
        "version": "1.0.0",
        "description": "A mock addon for testing Aurora's addon proxy",
        "contentType": "music",
        "resources": ["search", "stream", "lyrics"],
        "types": ["track", "album"],
        "aurora": {
            "rate_limit_rpm": 120,
            "stream_ttl_seconds": 3600,
        },
    }


# ── Search ───────────────────────────────────────────────────────────────

@app.get("/search")
def search(q: str = Query(...), limit: int = Query(20, ge=1)):
    q_lower = q.lower()
    results = [t for t in TRACKS if q_lower in t["title"].lower() or q_lower in t["artist"].lower()]
    return {"tracks": results[:limit]}


# ── Stream ───────────────────────────────────────────────────────────────

@app.get("/stream/{track_id}")
def stream(track_id: str):
    url = STREAM_URLS.get(track_id)
    if not url:
        return {"error": "Track not found"}, 404
    expires_at = int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp())
    return {
        "url": url,
        "format": "mp3",
        "quality": "320kbps",
        "expiresAt": expires_at,
    }


# ── Lyrics ───────────────────────────────────────────────────────────────

@app.get("/lyrics")
def lyrics(artist: str = Query(...), title: str = Query(...)):
    # Simple mock lyrics
    return {
        "lyrics": f"[00:05.00] {title}\n[00:10.00] by {artist}\n[00:15.00] This is a mock lyric line\n[00:20.00] For testing purposes only"
    }
