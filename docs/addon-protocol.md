# Aurora Addon Protocol v1.0

Aurora's addon system enables streaming music from online sources alongside the local library.
Adopts the **EclipseMusic/BeatBoss-compatible** protocol with Aurora-specific extensions.

## Design Principles

- **Protocol client only.** Aurora ships zero sources, zero scrapers, zero bundled addons.
- **Source-neutral.** All examples use hypothetical CC-licensed catalogs.
- **Hybrid library.** Addon tracks become normal songs — taggable, filterable, playlistable.
- **Security first.** All outbound requests pass SSRF validation (see §7).

---

## 1. Manifest

Served at `<base_url>/manifest.json`. Addons declare their capabilities via a standard manifest.

### Required Fields

| Field         | Type       | Description |
|---------------|------------|-------------|
| `id`          | `string`   | Reverse-domain identifier (e.g. `org.example.musicsource`) |
| `name`        | `string`   | Human-readable addon name |
| `version`     | `string`   | Semver version string |
| `resources`   | `string[]` | Supported endpoints. MVP: `"search"`, `"stream"`, `"lyrics"` |
| `types`       | `string[]` | Content types. Valid: `"track"`, `"album"`, `"artist"`, `"playlist"` |

### Optional Fields

| Field         | Type       | Description |
|---------------|------------|-------------|
| `description` | `string`   | Addon description |
| `icon`        | `string`   | URL to a square PNG/JPEG icon |
| `contentType` | `string`   | Primary content type: `"music"` (default), `"audiobook"`, `"podcast"` |

### Aurora Extension (`aurora` key)

Unknown top-level keys MUST be ignored by conforming players. Aurora uses the optional `aurora` key:

```json
{
  "aurora": {
    "min_app_version": "2.0.0",
    "capabilities": ["download", "waveform", "scrobble"],
    "rate_limit_rpm": 60,
    "stream_ttl_seconds": 3600
  }
}
```

| Field               | Type       | Default | Description |
|---------------------|------------|---------|-------------|
| `min_app_version`   | `string`   | —       | Minimum Aurora version required |
| `capabilities`      | `string[]` | `[]`    | Extra capabilities beyond search/stream/lyrics |
| `rate_limit_rpm`    | `int`      | `60`    | Max requests per minute Aurora should send |
| `stream_ttl_seconds`| `int`      | `3600`  | How long a resolved `stream_url` is valid |

### Example Manifest

```json
{
  "id": "org.cc.musiccatalog",
  "name": "CC Music Catalog",
  "version": "1.0.0",
  "description": "Creative Commons licensed music catalog",
  "icon": "https://example.com/icon.png",
  "contentType": "music",
  "resources": ["search", "stream", "lyrics"],
  "types": ["track", "album"],
  "aurora": {
    "rate_limit_rpm": 30,
    "stream_ttl_seconds": 1800
  }
}
```

---

## 2. Endpoints

All endpoints are relative to the addon's `base_url`.

### 2.1 Search — `GET /search?q={query}&limit={n}`

Search for tracks, albums, artists, or playlists matching the query string.

**Parameters:**

| Param   | Type   | Required | Description |
|---------|--------|----------|-------------|
| `q`     | `string` | Yes    | Search query |
| `limit` | `int`    | No     | Max results per type (default: addon-defined, typically 20) |

**Response (normalized to Aurora envelope):**

```json
{
  "data": {
    "tracks": [
      {
        "id": "track_101",
        "title": "Song Title",
        "artist": "Artist Name",
        "album": "Album Name",
        "duration": 240,
        "artworkURL": "https://example.com/art.jpg",
        "streamURL": null,
        "format": "mp3",
        "isrc": "USRC12345678"
      }
    ],
    "albums": [
      {
        "id": "album_201",
        "name": "Album Name",
        "artist": "Artist Name",
        "image": "https://example.com/album-art.jpg",
        "year": "2024",
        "trackCount": 12
      }
    ],
    "artists": [
      {
        "id": "artist_301",
        "name": "Artist Name",
        "image": "https://example.com/artist.jpg"
      }
    ],
    "playlists": [
      {
        "id": "pl_1",
        "title": "Playlist Name",
        "description": "...",
        "artworkURL": "https://example.com/pl.jpg",
        "creator": "User",
        "trackCount": 50
      }
    ]
  },
  "meta": {
    "addon_id": "org.cc.musiccatalog",
    "query": "search term"
  },
  "message": "ok"
}
```

**Fields per track object:**

| Field        | Type     | Required | Description |
|--------------|----------|----------|-------------|
| `id`         | `string` | Yes      | Addon-local track identifier |
| `title`      | `string` | Yes      | Track title |
| `artist`     | `string` | Yes      | Primary artist name |
| `album`      | `string` | No       | Album name |
| `duration`   | `int`    | No       | Duration in seconds |
| `artworkURL` | `string` | No       | Cover art URL. Aliases: `image`, `cover`, `albumCover` |
| `streamURL`  | `string` | No       | Direct stream URL (skips `/stream` call if set) |
| `format`     | `string` | No       | Audio format: `mp3`, `flac`, `aac`, `ogg` |
| `isrc`       | `string` | No       | International Standard Recording Code |

Unknown fields in track objects are preserved and passed through to the client.

---

### 2.2 Stream — `GET /stream/{id}`

Resolve a track ID to a playable audio URL.

**Path Parameters:**

| Param | Type     | Description |
|-------|----------|-------------|
| `id`  | `string` | Track identifier (from search results) |

**Response (normalized to Aurora envelope):**

```json
{
  "data": {
    "url": "https://cdn.example.com/track_101.mp3",
    "format": "mp3",
    "quality": "320kbps",
    "expiresAt": 1719500000
  },
  "meta": {
    "addon_id": "org.cc.musiccatalog"
  },
  "message": "ok"
}
```

**Fields:**

| Field      | Type     | Required | Description |
|------------|----------|----------|-------------|
| `url`      | `string` | Yes      | Direct HTTP/HTTPS audio URL |
| `format`   | `string` | No       | Audio format (`mp3`, `flac`, `aac`, `ogg`) |
| `quality`  | `string` | No       | Human-readable quality label |
| `expiresAt`| `int`    | No       | Unix timestamp when the URL expires. Aurora uses `aurora.stream_ttl_seconds` from manifest as fallback |

If a search result includes `streamURL`, the `/stream` call is skipped and the URL is used directly (still subject to TTL expiry).

---

### 2.3 Lyrics — `GET /lyrics?artist={}&title={}`

Fetch lyrics for a track.

**Parameters:**

| Param    | Type     | Required | Description |
|----------|----------|----------|-------------|
| `artist` | `string` | Yes      | Artist name |
| `title`  | `string` | Yes      | Track title |

**Response (normalized to Aurora envelope):**

```json
{
  "data": {
    "lyrics": "[00:10.00] Line one\n[00:15.00] Line two\n..."
  },
  "meta": {
    "addon_id": "org.cc.musiccatalog",
    "format": "lrc"
  },
  "message": "ok"
}
```

**Fields:**

| Field   | Type     | Required | Description |
|---------|----------|----------|-------------|
| `lyrics`| `string` | Yes      | Lyrics text. Preferably in LRC (timed) format. Plain text is acceptable |

---

## 3. Error Responses

Addons that fail to fulfill a request should return an appropriate HTTP status code.
Aurora normalizes all addon errors into its envelope:

```json
{
  "data": null,
  "message": "Addon returned 404: track not found"
}
```

Aurora maps addon HTTP status codes:
- `2xx` — Success (response parsed normally)
- `4xx` — Client error (bad request, not found). Aurora passes the error message through.
- `5xx` — Server error. Aurora increments the addon's `fail_count` and may trigger the circuit breaker.

---

## 4. Caching

Aurora caches addon responses per-addon with different TTLs:

| Resource | Cache TTL | Notes |
|----------|-----------|-------|
| Search   | 5 minutes | Keyed by `(addon_id, query, limit)` |
| Lyrics   | 24 hours  | Keyed by `(addon_id, artist, title)` |
| Stream   | Until `expiresAt` or `stream_ttl_seconds` | Keyed by `(addon_id, track_id)` |

Stale-while-offline: if the addon is unreachable, Aurora serves the last cached result with `meta.stale: true`.

---

## 5. Rate Limiting

Aurora enforces per-addon rate limiting based on the manifest's `aurora.rate_limit_rpm` (default: 60 rpm).
This is a token-bucket algorithm implemented in-house — no external dependency.

When the rate limit is exceeded, Aurora returns HTTP 429 with:
```json
{
  "data": null,
  "message": "Rate limit exceeded for addon org.cc.musiccatalog (60 rpm)"
}
```

---

## 6. Circuit Breaker

Aurora tracks addon health:

- **Success:** resets `fail_count` to 0, updates `last_ok_at`.
- **Failure:** increments `fail_count`.
- **Open circuit (3 consecutive failures):** addon enters a cooldown period. During cooldown, requests are served from cache (stale-while-offline) or return 503.
- **Half-open:** after cooldown expires, one trial request is allowed. Success closes the circuit; failure re-opens it.

Health is exposed via `GET /api/addons`:
```json
{
  "data": [
    {
      "id": "abc123",
      "base_url": "https://addon.example.com",
      "name": "CC Music Catalog",
      "version": "1.0.0",
      "enabled": true,
      "fail_count": 0,
      "last_ok_at": "2026-06-25T12:00:00Z"
    }
  ],
  "message": "ok"
}
```

---

## 7. SSRF Security Posture

Aurora validates all outbound addon requests to prevent Server-Side Request Forgery:

### DNS Resolution Validation
- Resolved IPs are checked against private/reserved ranges **before** any HTTP request is made:
  - `127.0.0.0/8` (loopback)
  - `10.0.0.0/8` (private)
  - `172.16.0.0/12` (private)
  - `192.168.0.0/16` (private)
  - `169.254.0.0/16` (link-local / cloud metadata)
  - `::1`, `fc00::/7`, `fe80::/10` (IPv6 loopback/private/link-local)
- DNS rebinding defense: resolved IPs are re-validated at fetch time.

### Scheme Validation
- Only `https://` is allowed by default.
- `http://` is allowed **only** for `localhost` / `127.0.0.1` in development mode.

### Request Safeguards
- **Timeouts:** 10s connect, 30s read for manifest/search/lyrics. 15s connect, 60s read for stream URLs.
- **Size caps:** Manifest max 64 KB. Search/stream/lyrics responses max 1 MB.
- **Redirect cap:** Maximum 3 redirects, each hop re-validated for SSRF.
- **No header/cookie forwarding:** Aurora never forwards internal headers or cookies to addons.

---

## 8. Aurora Envelope

All API responses follow the standard Aurora envelope:

```json
{
  "data": <payload>,
  "meta": { ... },
  "message": "ok"
}
```

Addons may return their own response shapes — Aurora normalizes them into this envelope before returning to the frontend. The `meta.addon_id` field identifies which addon provided the data.

---

## 9. Implementation Notes (Aurora-specific)

### Save-as-Song

When a user saves an addon track, Aurora creates a normal `songs` row:
- `source` = `"addon:<addon_id>"`
- `external_id` = the addon's track ID
- `stream_url` = resolved audio URL
- `stream_url_expires_at` = expiry timestamp (from `expiresAt` or manifest `stream_ttl_seconds`)
- `artwork_url` = track's artwork URL
- `file_path` = NULL (not a local file)

The saved song is indistinguishable from local songs in the API — it appears in `/api/songs`, can be tagged, filtered, and added to playlists.

### Playback Resolution Order

When playing a song, Aurora resolves the audio source in this order:

1. **Local file** — if `file_path` is set and the file exists on disk, play locally.
2. **Fresh stream URL** — if `stream_url` is set and `stream_url_expires_at` is in the future, use it directly.
3. **Re-resolve** — call the addon's `/stream/{external_id}` to get a fresh URL, update the `songs` row.

### Audio Transport

**Default: direct playback.** The Tauri webview plays the resolved `stream_url` directly via Howler.js.
A backend stream-proxy endpoint (`/api/addons/{id}/proxy?url=...`) is available as a fallback if CORS or Range headers block direct playback from the Tauri origin. This endpoint streams bytes with HTTP Range support.

Research note: most music addon CDNs serve standard HTTP with CORS headers compatible with browser playback. The proxy fallback exists for edge cases, not as the default path.

---

## 10. Deltas from EclipseMusic/BeatBoss Research

This protocol is based on research into the EclipseMusic and BeatBoss addon ecosystems. The following deviations were made for Aurora:

| Aspect | Research Finding | Aurora Decision | Rationale |
|--------|-----------------|-----------------|-----------|
| Response shape | Raw JSON objects | Aurora envelope `{data, meta, message}` | Consistent with existing Aurora API |
| `aurora` key | Not in Eclipse/BeatBoss | Added as optional extension | Aurora-specific config (TTL, rate limit, capabilities) |
| Manifest `icon` | Optional in both | Kept optional | Aurora doesn't render addon icons in MVP |
| Library sync | BeatBoss has `/libraries` CRUD | Deferred to v2.0 | N24 is proxy-only; library sync is a future feature |
| `contentType` | `"music"`, `"audiobook"`, `"podcast"` | Accepted but not filtered | MVP treats all as audio tracks |
| Stream `expiresAt` | BeatBoss uses Unix timestamp | Adopted with fallback to `stream_ttl_seconds` | Explicit expiry is better than blind TTL |
| Search limit | Varies by addon | Accepted as optional param | Sensible default per addon |
