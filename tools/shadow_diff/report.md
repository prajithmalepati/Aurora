# Shadow-Diff Parity Report (N41)

**Date:** 2026-07-05 16:40 UTC
**Total endpoints tested:** 53
**PASS:** 48 | **DIFF:** 0 | **WHITELISTED:** 5 | **ERROR:** 0

✅ **All endpoints match (within documented exceptions).**

---

## WHITELISTED (documented exceptions) (5)

### `GET /api/songs/1/stream (multi-range)`
- **Whitelist rule:** W4
- Note: W4: multi-range → Python read failed (non-RFC body), asserted W4

### `POST /api/filter (AND only)`
- **Whitelist rule:** W9
- Python status: 400
- Rust status: 400
- Note: W9: filter error wording differs (both 400 with non-empty detail)

### `GET /api/tags/9999 (405 expected)`
- **Whitelist rule:** W10
- Python status: 405
- Rust status: 405
- Note: W10: 405 body shape differs (Python detail vs Rust null)

### `POST /api/filter (bare &)`
- **Whitelist rule:** W9
- Python status: 400
- Rust status: 400
- Note: W9: filter error wording differs (both 400 with non-empty detail)

### `GET /api/tags/9999 (W10 body shape)`
- **Whitelist rule:** W10
- Python status: 405
- Rust status: 405
- Note: W10: 405 body shape differs (Python detail vs Rust null)

## PASS (48)

### `GET /api/health`
- Python status: 200
- Rust status: 200

### `GET /api/songs`
- Python status: 200
- Rust status: 200

### `GET /api/songs/1`
- Python status: 200
- Rust status: 200

### `GET /api/tags`
- Python status: 200
- Rust status: 200

### `GET /api/playlists`
- Python status: 200
- Rust status: 200

### `GET /api/playlists/1`
- Python status: 200
- Rust status: 200

### `GET /api/folders`
- Python status: 200
- Rust status: 200

### `GET /api/albums`
- Python status: 200
- Rust status: 200

### `GET /api/albums/Machine Head`
- Python status: 404
- Rust status: 404

### `GET /api/addons`
- Python status: 200
- Rust status: 200

### `GET /api/watch`
- Python status: 200
- Rust status: 200

### `GET /api/songs/1/stream (full)`
- Python status: 200
- Rust status: 200

### `GET /api/songs/1/stream (bytes=0-99)`
- Python status: 206
- Rust status: 206

### `GET /api/songs/1/stream (unsat)`
- Python status: 416
- Rust status: 416

### `GET /api/album-art/abc123def456.jpg`
- Python status: 404
- Rust status: 404

### `GET /api/songs/1/bleed-thumb`
- Python status: 404
- Rust status: 404

### `POST /api/filter (rock)`
- Python status: 200
- Rust status: 200

### `POST /api/filter (slow AND chill)`
- Python status: 200
- Rust status: 200

### `POST /api/filter (rock OR anime)`
- Python status: 200
- Rust status: 200

### `POST /api/filter (NOT rock)`
- Python status: 200
- Rust status: 200

### `POST /api/filter ("fast")`
- Python status: 200
- Rust status: 200

### `POST /api/filter (id:1)`
- Python status: 200
- Rust status: 200

### `POST /api/filter (51 atoms)`
- Python status: 400
- Rust status: 400

### `GET /api/playlists/1/export (m3u8)`
- Python status: 200
- Rust status: 200

### `GET /api/playlists/1/export (json)`
- Python status: 200
- Rust status: 200

### `GET /api/folders/songs?path=/music/rock`
- Python status: 200
- Rust status: 200

### `GET /api/addons/1/search?q=sunset`
- Python status: 404
- Rust status: 404

### `GET /api/songs/9999 (404)`
- Python status: 404
- Rust status: 404

### `GET /api/playlists/9999 (404)`
- Python status: 404
- Rust status: 404

### `GET /api/addons/9999/search (404)`
- Python status: 404
- Rust status: 404

### `POST /api/tags (create shadowtest)`
- Python status: 201
- Rust status: 201

### `DELETE /api/tags/{new_tag_id}`
- Python status: 200
- Rust status: 200

### `POST /api/playlists (create)`
- Python status: 201
- Rust status: 201

### `POST /api/playlists/{new_playlist_id}/songs (add song 1)`
- Python status: 200
- Rust status: 200

### `POST /api/playlists/{new_playlist_id}/songs (add song 2)`
- Python status: 200
- Rust status: 200

### `POST /api/playlists/{new_playlist_id}/songs (add song 3)`
- Python status: 200
- Rust status: 200

### `DELETE /api/playlists/{new_playlist_id}/songs/2`
- Python status: 200
- Rust status: 200

### `PUT /api/playlists/{new_playlist_id}/songs/reorder`
- Python status: 200
- Rust status: 200

### `PATCH /api/playlists/{new_playlist_id}/songs/1/timing`
- Python status: 200
- Rust status: 200

### `POST /api/playlists/import`
- Python status: 200
- Rust status: 200

### `PATCH /api/addons/1 (toggle off)`
- Python status: 404
- Rust status: 404

### `PATCH /api/addons/1 (toggle on)`
- Python status: 404
- Rust status: 404

### `DELETE /api/playlists/{new_playlist_id}`
- Python status: 200
- Rust status: 200

### `GET /api/songs (post-mutation)`
- Python status: 200
- Rust status: 200

### `GET /api/tags (post-mutation)`
- Python status: 200
- Rust status: 200

### `GET /api/playlists (post-mutation)`
- Python status: 200
- Rust status: 200

### `GET /api/playlists/1 (post-mutation)`
- Python status: 200
- Rust status: 200

### `GET /api/addons (post-mutation)`
- Python status: 200
- Rust status: 200

---

## Whitelist Rules Applied

| Rule | Description |
|------|-------------|
| W1 | Volatile timestamps normalized to `<TIMESTAMP>` |
| W2 | 422 validation body format (Pydantic vs Rust) — status-only check |
| W3 | §2B analysis values (dominant_color, peaks, bleed) — NULL-parity + shape only |
| W4 | Multi-range stream: Rust 416 vs Python 206 (N39 T3) |
| W5 | Re-encoded image bytes differ — compare metadata only |
| W6 | Read-time backfill mutation (NULL→non-NULL color on GET) |
| W7 | JSON key ordering (serde alphabetical vs FastAPI insertion order) |
| W8 | Float formatting (`1.0` vs `1`) — numeric epsilon comparison |
| W9 | Filter error-message wording — both 400, different detail strings |
| W10 | 4xx error-body shape — status parity, body shape differs |

## Out of Scope (deferred)

- **F5 — scanner bitrate divergence** (Python mutagen vs Rust): Real (127-vs-140 mp3, 96-vs-162 flac) but only observable if scan runs separately on each copy. After A1 seeding fix, both read the same stored values — vanishes from shadow-diff. Logged to STRATEGIC_PLAN deferred ledger as future scan-parity item.
