"""Addons router — CRUD + proxy endpoints for music addon protocol."""
import ipaddress
import json
import logging
import re
import socket
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import get_db_ctx, SONG_SELECT_QUERY
from app.cache import TTLCache
from app.serializers import song_row_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["addons"])

# ── Caches ────────────────────────────────────────────────────────────────
addon_search_cache = TTLCache(default_ttl=300.0)   # 5 min
addon_stream_cache = TTLCache(default_ttl=3600.0)   # 1 hr (overridden per-addon)
addon_lyrics_cache = TTLCache(default_ttl=86400.0)  # 24 hr


# ── SSRF Defense ──────────────────────────────────────────────────────────

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _is_private_ip(ip_str: str) -> bool:
    """Check if an IP address is in a private/reserved range."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return True  # reject unparseable IPs


def _validate_url_for_ssrf(url: str) -> None:
    """Validate a URL against SSRF. Raises HTTPException(400) on rejection."""
    parsed = urlparse(url)

    # Scheme allowlist
    if parsed.scheme not in ("https", "http"):
        raise HTTPException(status_code=400, detail=f"Unsupported URL scheme: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="URL has no hostname")

    # HTTP only allowed for localhost dev
    _LOCALHOST_HOSTNAMES = {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme == "http" and hostname not in _LOCALHOST_HOSTNAMES:
        raise HTTPException(
            status_code=400,
            detail="HTTP is only allowed for localhost; use HTTPS for remote addons"
        )

    # Localhost hosts bypass DNS resolution
    if hostname in _LOCALHOST_HOSTNAMES:
        return

    # Resolve DNS and check resolved IPs for non-localhost hosts
    try:
        infos = socket.getaddrinfo(hostname, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail=f"Cannot resolve hostname: {hostname}")

    for family, _, _, _, sockaddr in infos:
        ip_str = str(sockaddr[0])
        if _is_private_ip(ip_str):
            raise HTTPException(
                status_code=400,
                detail=f"URL resolves to private/reserved IP: {ip_str}"
            )


def _validate_redirects(response: httpx.Response) -> None:
    """Re-validate SSRF on each redirect hop."""
    # httpx follows redirects by default; we check the final URL
    if response.url:
        _validate_url_for_ssrf(str(response.url))


# ── Rate Limiter (token bucket, per-addon) ────────────────────────────────

class _TokenBucket:
    """Simple in-memory token bucket rate limiter."""

    def __init__(self, rpm: int = 60):
        self.capacity = rpm
        self.tokens = float(rpm)
        self.fill_rate = rpm / 60.0  # tokens per second
        self.last_fill = time.monotonic()

    def consume(self) -> bool:
        """Try to consume one token. Returns True if allowed."""
        now = time.monotonic()
        elapsed = now - self.last_fill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.fill_rate)
        self.last_fill = now

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False


# Per-addon rate limiters (addon_id -> _TokenBucket)
_rate_limiters: dict[str, _TokenBucket] = {}


def _get_rate_limiter(addon_id: str, rpm: int = 60) -> _TokenBucket:
    """Get or create a rate limiter for an addon."""
    if addon_id not in _rate_limiters:
        _rate_limiters[addon_id] = _TokenBucket(rpm)
    return _rate_limiters[addon_id]


# ── Circuit Breaker ──────────────────────────────────────────────────────

_COOLDOWN_SECONDS = 300  # 5 min cooldown after 3 failures
_FAIL_THRESHOLD = 3


def _check_circuit(addon_id: str, fail_count: int, last_ok_at: Optional[str]) -> bool:
    """Returns True if the circuit is OPEN (request should be blocked)."""
    if fail_count < _FAIL_THRESHOLD:
        return False
    # Circuit is open — check if cooldown has elapsed
    if last_ok_at:
        try:
            last_ok = datetime.fromisoformat(last_ok_at.replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - last_ok).total_seconds()
            if elapsed >= _COOLDOWN_SECONDS:
                return False  # half-open: allow one trial
        except (ValueError, TypeError):
            pass
    return True


def _record_success(addon_id: str) -> None:
    """Reset fail count and update last_ok_at on success."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_db_ctx() as conn:
        conn.execute(
            "UPDATE addons SET fail_count = 0, last_ok_at = ? WHERE id = ?",
            (now, addon_id),
        )
        conn.commit()


def _record_failure(addon_id: str) -> None:
    """Increment fail count on failure."""
    with get_db_ctx() as conn:
        conn.execute(
            "UPDATE addons SET fail_count = fail_count + 1 WHERE id = ?",
            (addon_id,),
        )
        conn.commit()


# ── HTTP Client ──────────────────────────────────────────────────────────

_client: Optional[httpx.AsyncClient] = None


async def _get_client() -> httpx.AsyncClient:
    """Get or create the shared httpx async client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0),
            follow_redirects=True,
            max_redirects=3,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=5),
        )
    return _client


# ── Manifest Validation ─────────────────────────────────────────────────

def _validate_manifest(data: dict) -> dict:
    """Validate a manifest dict. Returns the parsed manifest or raises HTTPException(422)."""
    required = ["id", "name", "version", "resources", "types"]
    missing = [f for f in required if f not in data]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Manifest missing required fields: {', '.join(missing)}"
        )

    # Validate types
    valid_types = {"track", "album", "artist", "playlist"}
    invalid = [t for t in data["types"] if t not in valid_types]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid content types: {', '.join(invalid)}. Valid: {', '.join(sorted(valid_types))}"
        )

    return data


# ── Response Normalization ───────────────────────────────────────────────

def _normalize_search_response(raw: dict, addon_id: str) -> dict:
    """Normalize addon search response to Aurora envelope."""
    # The addon may return tracks/albums/artists/playlists at top level
    # or nested under "data". Normalize both.
    tracks = raw.get("tracks", [])
    albums = raw.get("albums", [])
    artists = raw.get("artists", [])
    playlists = raw.get("playlists", [])

    return {
        "data": {
            "tracks": tracks,
            "albums": albums,
            "artists": artists,
            "playlists": playlists,
        },
        "meta": {"addon_id": addon_id},
        "message": "ok",
    }


def _normalize_stream_response(raw: dict, addon_id: str) -> dict:
    """Normalize addon stream response to Aurora envelope."""
    return {
        "data": {
            "url": raw.get("url"),
            "format": raw.get("format"),
            "quality": raw.get("quality"),
            "expiresAt": raw.get("expiresAt"),
        },
        "meta": {"addon_id": addon_id},
        "message": "ok",
    }


def _normalize_lyrics_response(raw: dict, addon_id: str) -> dict:
    """Normalize addon lyrics response to Aurora envelope."""
    return {
        "data": {
            "lyrics": raw.get("lyrics", ""),
        },
        "meta": {"addon_id": addon_id, "format": "lrc"},
        "message": "ok",
    }


# ── Pydantic Models ─────────────────────────────────────────────────────

class AddonCreate(BaseModel):
    base_url: str = Field(..., min_length=1)


class AddonToggle(BaseModel):
    enabled: bool


# ── CRUD Endpoints ──────────────────────────────────────────────────────

@router.post("/addons")
async def add_addon(body: AddonCreate):
    """Add a new addon by URL. Fetches and validates the manifest."""
    base_url = body.base_url.rstrip("/")
    manifest_url = f"{base_url}/manifest.json"

    # SSRF validation
    _validate_url_for_ssrf(base_url)
    _validate_url_for_ssrf(manifest_url)

    # Check for duplicate
    with get_db_ctx() as conn:
        existing = conn.execute(
            "SELECT id FROM addons WHERE base_url = ?", (base_url,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Addon already registered")

    # Fetch manifest
    client = await _get_client()
    try:
        resp = await client.get(manifest_url)
        resp.raise_for_status()
        _validate_redirects(resp)
        manifest = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Addon manifest returned {e.response.status_code}"
        )
    except (httpx.RequestError, httpx.TimeoutException) as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach addon: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Invalid manifest JSON: {e}")

    # Validate manifest
    _validate_manifest(manifest)

    addon_id = manifest["id"]
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with get_db_ctx() as conn:
        conn.execute(
            """INSERT INTO addons (id, base_url, name, version, manifest_json, enabled, added_at, last_ok_at, fail_count)
               VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0)""",
            (addon_id, base_url, manifest.get("name"), manifest.get("version"), json.dumps(manifest), now, now),
        )
        conn.commit()

    return {
        "data": {
            "id": addon_id,
            "base_url": base_url,
            "name": manifest.get("name"),
            "version": manifest.get("version"),
            "enabled": True,
            "fail_count": 0,
            "last_ok_at": now,
        },
        "message": "ok",
    }


@router.get("/addons")
def list_addons():
    """List all registered addons with health info."""
    with get_db_ctx() as conn:
        rows = conn.execute(
            "SELECT id, base_url, name, version, enabled, fail_count, last_ok_at FROM addons ORDER BY added_at DESC"
        ).fetchall()

    addons = [
        {
            "id": r["id"],
            "base_url": r["base_url"],
            "name": r["name"],
            "version": r["version"],
            "enabled": bool(r["enabled"]),
            "fail_count": r["fail_count"],
            "last_ok_at": r["last_ok_at"],
        }
        for r in rows
    ]

    return {"data": addons, "message": "ok"}


@router.patch("/addons/{addon_id}")
def toggle_addon(addon_id: str, body: AddonToggle):
    """Enable or disable an addon."""
    with get_db_ctx() as conn:
        row = conn.execute("SELECT id FROM addons WHERE id = ?", (addon_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Addon not found")
        conn.execute(
            "UPDATE addons SET enabled = ? WHERE id = ?",
            (1 if body.enabled else 0, addon_id),
        )
        conn.commit()

    return {"message": "ok"}


@router.delete("/addons/{addon_id}")
def delete_addon(addon_id: str):
    """Remove an addon."""
    with get_db_ctx() as conn:
        row = conn.execute("SELECT id FROM addons WHERE id = ?", (addon_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Addon not found")
        conn.execute("DELETE FROM addons WHERE id = ?", (addon_id,))
        conn.commit()

    # Clean up caches and rate limiters
    addon_search_cache.invalidate_prefix(f"{addon_id}:")
    addon_stream_cache.invalidate_prefix(f"{addon_id}:")
    addon_lyrics_cache.invalidate_prefix(f"{addon_id}:")
    _rate_limiters.pop(addon_id, None)

    return {"message": "ok"}


# ── Proxy Endpoints ─────────────────────────────────────────────────────

def _get_addon_or_404(addon_id: str) -> dict:
    """Fetch addon row, check enabled + circuit breaker. Returns parsed manifest."""
    with get_db_ctx() as conn:
        row = conn.execute(
            "SELECT * FROM addons WHERE id = ?", (addon_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Addon not found")
    if not row["enabled"]:
        raise HTTPException(status_code=403, detail="Addon is disabled")
    if _check_circuit(addon_id, row["fail_count"], row["last_ok_at"]):
        raise HTTPException(
            status_code=503,
            detail=f"Addon circuit breaker open (fail_count={row['fail_count']}). Try again later."
        )

    return {
        "id": row["id"],
        "base_url": row["base_url"],
        "manifest": json.loads(row["manifest_json"]),
    }


def _get_addon_rpm(addon: dict) -> int:
    """Extract rate_limit_rpm from addon manifest aurora key."""
    aurora_cfg = addon.get("manifest", {}).get("aurora", {})
    return aurora_cfg.get("rate_limit_rpm", 60)


def _get_stream_ttl(addon: dict) -> int:
    """Extract stream_ttl_seconds from addon manifest aurora key."""
    aurora_cfg = addon.get("manifest", {}).get("aurora", {})
    return aurora_cfg.get("stream_ttl_seconds", 3600)


async def _proxy_request(addon: dict, path: str, params: Optional[dict] = None) -> dict:
    """Make a proxied request to an addon endpoint with SSRF + rate limit + circuit breaker."""
    addon_id = addon["id"]
    base_url = addon["base_url"]
    url = f"{base_url}{path}"

    # SSRF validation
    _validate_url_for_ssrf(url)

    # Rate limit
    rpm = _get_addon_rpm(addon)
    limiter = _get_rate_limiter(addon_id, rpm)
    if not limiter.consume():
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for addon {addon_id} ({rpm} rpm)"
        )

    # Make request
    client = await _get_client()
    try:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        _validate_redirects(resp)
        _record_success(addon_id)
        return resp.json()
    except httpx.HTTPStatusError as e:
        _record_failure(addon_id)
        raise HTTPException(
            status_code=502,
            detail=f"Addon returned {e.response.status_code}"
        )
    except (httpx.RequestError, httpx.TimeoutException) as e:
        _record_failure(addon_id)
        raise HTTPException(status_code=502, detail=f"Addon unreachable: {e}")


@router.get("/addons/{addon_id}/search")
async def addon_search(addon_id: str, q: str = Query(..., min_length=1), limit: int = Query(20, ge=1)):
    """Search an addon for tracks, albums, artists, playlists."""
    addon = _get_addon_or_404(addon_id)

    # Check cache
    cache_key = f"{addon_id}:{q}:{limit}"
    cached = addon_search_cache.get(cache_key)
    if cached is not None:
        return cached

    raw = await _proxy_request(addon, "/search", params={"q": q, "limit": limit})
    result = _normalize_search_response(raw, addon_id)

    addon_search_cache.set(cache_key, result)
    return result


@router.get("/addons/{addon_id}/stream/{external_id}")
async def addon_stream(addon_id: str, external_id: str):
    """Resolve a track ID to a playable stream URL."""
    addon = _get_addon_or_404(addon_id)

    # Check cache
    cache_key = f"{addon_id}:stream:{external_id}"
    cached = addon_stream_cache.get(cache_key)
    if cached is not None:
        return cached

    raw = await _proxy_request(addon, f"/stream/{external_id}")
    result = _normalize_stream_response(raw, addon_id)

    # Use addon's stream_ttl_seconds or the response's expiresAt
    ttl = _get_stream_ttl(addon)
    addon_stream_cache.set(cache_key, result, ttl=ttl)

    return result


@router.get("/addons/{addon_id}/lyrics")
async def addon_lyrics(addon_id: str, artist: str = Query(...), title: str = Query(...)):
    """Fetch lyrics for a track."""
    addon = _get_addon_or_404(addon_id)

    # Check cache
    cache_key = f"{addon_id}:lyrics:{artist}:{title}"
    cached = addon_lyrics_cache.get(cache_key)
    if cached is not None:
        return cached

    raw = await _proxy_request(addon, "/lyrics", params={"artist": artist, "title": title})
    result = _normalize_lyrics_response(raw, addon_id)

    addon_lyrics_cache.set(cache_key, result)
    return result


# ── Save-as-Song + Stream Resolution (T4) ────────────────────────────────

class AddonSaveTrack(BaseModel):
    """Save an addon search result as a local song."""
    title: str = Field(..., min_length=1)
    artist: str = Field(..., min_length=1)
    album: Optional[str] = None
    duration: Optional[int] = None
    external_id: str = Field(..., min_length=1)
    artwork_url: Optional[str] = None
    stream_url: Optional[str] = None


@router.post("/addons/{addon_id}/save")
async def save_addon_track(addon_id: str, body: AddonSaveTrack):
    """Save an addon track as a normal song in the library."""
    addon = _get_addon_or_404(addon_id)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Resolve stream URL if not provided
    stream_url = body.stream_url
    stream_url_expires_at = None

    if not stream_url:
        raw = await _proxy_request(addon, f"/stream/{body.external_id}")
        stream_url = raw.get("url")
        expires_at = raw.get("expiresAt")
        if expires_at:
            stream_url_expires_at = datetime.fromtimestamp(expires_at, tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
        else:
            ttl = _get_stream_ttl(addon)
            stream_url_expires_at = datetime.fromtimestamp(
                time.time() + ttl, tz=timezone.utc
            ).strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        # If stream URL was provided, set a default expiry
        ttl = _get_stream_ttl(addon)
        stream_url_expires_at = datetime.fromtimestamp(
            time.time() + ttl, tz=timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%SZ")

    if not stream_url:
        raise HTTPException(status_code=502, detail="Addon did not return a stream URL")

    source = f"addon:{addon_id}"

    with get_db_ctx() as conn:
        # Check for duplicate (same addon + external_id)
        existing = conn.execute(
            "SELECT id FROM songs WHERE source = ? AND external_id = ?",
            (source, body.external_id),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="Track already saved")

        cursor = conn.execute(
            """INSERT INTO songs (title, artist, album, duration, source, external_id,
               stream_url, stream_url_expires_at, artwork_url, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.title,
                body.artist,
                body.album,
                body.duration,
                source,
                body.external_id,
                stream_url,
                stream_url_expires_at,
                body.artwork_url,
                now,
                now,
            ),
        )
        conn.commit()
        song_id = cursor.lastrowid

    # Fetch the full song row to return in standard format
    with get_db_ctx() as conn:
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"
        row = conn.execute(query, (song_id,)).fetchone()

    return {"data": song_row_to_dict(row), "message": "ok"}


@router.get("/songs/{song_id}/resolve")
async def resolve_stream(song_id: int):
    """Resolve the playback URL for a song, following the resolution order:
    1. Local file (file_path present)
    2. Fresh stream URL (stream_url set, not expired)
    3. Re-resolve via addon /stream endpoint
    """
    with get_db_ctx() as conn:
        query = SONG_SELECT_QUERY + " WHERE s.id = ? GROUP BY s.id"
        row = conn.execute(query, (song_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Song not found")

    song = song_row_to_dict(row)

    # 1. Local file
    if song.get("file_path"):
        return {"data": {"type": "local", "url": song["file_path"]}, "message": "ok"}

    # 2. Fresh stream URL
    expires_at = song.get("stream_url_expires_at")
    if song.get("stream_url") and expires_at:
        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp > datetime.now(timezone.utc):
                return {
                    "data": {"type": "stream", "url": song["stream_url"], "expires_at": expires_at},
                    "message": "ok",
                }
        except (ValueError, TypeError):
            pass

    # 3. Re-resolve via addon
    source = song.get("source", "")
    if not source.startswith("addon:"):
        raise HTTPException(status_code=400, detail="Song has no stream URL and is not from an addon")

    addon_id = source.split(":", 1)[1]
    external_id = song.get("external_id")
    if not external_id:
        raise HTTPException(status_code=400, detail="Song has no external_id for re-resolution")

    addon = _get_addon_or_404(addon_id)
    raw = await _proxy_request(addon, f"/stream/{external_id}")

    stream_url = raw.get("url")
    if not stream_url:
        raise HTTPException(status_code=502, detail="Addon did not return a stream URL")

    # Update the song row with fresh stream URL
    ttl = _get_stream_ttl(addon)
    new_expires = datetime.fromtimestamp(time.time() + ttl, tz=timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    with get_db_ctx() as conn:
        conn.execute(
            "UPDATE songs SET stream_url = ?, stream_url_expires_at = ? WHERE id = ?",
            (stream_url, new_expires, song_id),
        )
        conn.commit()

    return {
        "data": {"type": "stream", "url": stream_url, "expires_at": new_expires, "re-resolved": True},
        "message": "ok",
    }
