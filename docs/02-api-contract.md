# Aurora — API Contract
## Document 2 of 6 | 

---

## Base URL

```
http://localhost:8000/api
```

All endpoints are prefixed with `/api`. The FastAPI app runs on port 8000.

## Response Format Convention

All responses follow this shape:

**Success (single item):**
```json
{
    "data": { ... },
    "message": "Song created successfully"
}
```

**Success (list):**
```json
{
    "data": [ ... ],
    "total": 42,
    "message": "ok"
}
```

**Error:**
```json
{
    "detail": "Song not found"
}
```

Use FastAPI's `HTTPException` for errors. Use Pydantic response models for success.

---

## SONGS

### `POST /api/songs` — Create a song

**Request body:**
```json
{
    "title": "Highway Star",
    "artist": "Deep Purple",
    "album": "Machine Head",
    "duration": 367,
    "file_path": null
}
```

| Field     | Type         | Required | Notes                              |
|-----------|--------------|----------|------------------------------------|
| title     | string       | YES      | Non-empty                          |
| artist    | string       | YES      | Non-empty                          |
| album     | string\|null | no       | Nullable                           |
| duration  | int\|null    | no       | Seconds. Nullable                  |
| file_path | string\|null | no       | Absolute path. Must be unique if provided |

**Response (201):**
```json
{
    "data": {
        "id": 1,
        "title": "Highway Star",
        "artist": "Deep Purple",
        "album": "Machine Head",
        "duration": 367,
        "file_path": null,
        "source": "manual",
        "external_id": null,
        "tags": [],
        "playlists": [],
        "created_at": "2026-04-07T15:30:00Z",
        "updated_at": "2026-04-07T15:30:00Z"
    },
    "message": "Song created successfully"
}
```

**Errors:**
- `400` — title or artist is empty
- `409` — file_path already exists in DB (duplicate)

---

### `GET /api/songs` — List all songs

**Query parameters:**
| Param  | Type   | Default | Notes                                  |
|--------|--------|---------|----------------------------------------|
| search | string | null    | Filter by title or artist (case-insensitive LIKE) |
| limit  | int    | 50      | Max results per page                   |
| offset | int    | 0       | Pagination offset                      |

**Response (200):**
```json
{
    "data": [
        {
            "id": 1,
            "title": "Highway Star",
            "artist": "Deep Purple",
            "album": "Machine Head",
            "duration": 367,
            "file_path": null,
            "source": "manual",
            "tags": ["fast", "hype"],
            "playlists": ["Rock"],
            "created_at": "2026-04-07T15:30:00Z",
            "updated_at": "2026-04-07T15:30:00Z"
        }
    ],
    "total": 1,
    "message": "ok"
}
```

**Notes:**
- `tags` is a list of tag name strings (from song_tags join)
- `playlists` is a list of playlist name strings (from playlist_songs join)
- The `search` param does: `WHERE title LIKE '%query%' OR artist LIKE '%query%'`

---

### `GET /api/songs/{id}` — Get a single song

**Response (200):** Same shape as a single item in the list above.

**Errors:**
- `404` — Song not found

---

### `PUT /api/songs/{id}` — Update a song

**Request body (all fields optional):**
```json
{
    "title": "Highway Star (Remastered)",
    "artist": "Deep Purple",
    "album": "Machine Head (Deluxe)",
    "duration": 370
}
```

Only provided fields are updated. `updated_at` is always refreshed.

**Response (200):** Returns the full updated song object.

**Errors:**
- `404` — Song not found
- `400` — title or artist set to empty string

---

### `DELETE /api/songs/{id}` — Delete a song

**Response (200):**
```json
{
    "message": "Song deleted successfully"
}
```

**Errors:**
- `404` — Song not found

**Side effects:** Cascading deletes remove all `playlist_songs` and `song_tags` rows for this song.

---

## TAGS

### `POST /api/tags` — Create a tag

**Request body:**
```json
{
    "name": "3am drive"
}
```

| Field | Type   | Required | Notes                                              |
|-------|--------|----------|----------------------------------------------------|
| name  | string | YES      | Will be lowercased and trimmed before storing       |

**Response (201):**
```json
{
    "data": {
        "id": 1,
        "name": "3am drive",
        "song_count": 0,
        "created_at": "2026-04-07T15:30:00Z"
    },
    "message": "Tag created successfully"
}
```

**Errors:**
- `400` — name is empty after trimming
- `409` — tag with this name already exists

---

### `GET /api/tags` — List all tags

**Response (200):**
```json
{
    "data": [
        {
            "id": 1,
            "name": "3am drive",
            "song_count": 12,
            "created_at": "2026-04-07T15:30:00Z"
        },
        {
            "id": 2,
            "name": "fast",
            "song_count": 45,
            "created_at": "2026-04-07T15:31:00Z"
        }
    ],
    "total": 2,
    "message": "ok"
}
```

**Notes:**
- `song_count` = number of songs that have this tag (COUNT from song_tags)
- Ordered alphabetically by name

---

### `DELETE /api/tags/{id}` — Delete a tag

**Response (200):**
```json
{
    "message": "Tag deleted successfully"
}
```

**Side effects:** Cascading delete removes all `song_tags` rows for this tag.

---

### `POST /api/songs/{song_id}/tags` — Add tags to a song

**Request body:**
```json
{
    "tag_names": ["fast", "hype", "gym"]
}
```

**Behavior:**
1. For each name in `tag_names`:
   - Lowercase + trim the name
   - If the tag doesn't exist in `tags` table, create it
   - If the `song_tags` link doesn't exist, create it
   - If the link already exists, skip silently (idempotent)
2. Return the updated song

This is an **additive** operation — it does not remove existing tags.

**Response (200):** Returns the full song object with updated tags list.

**Errors:**
- `404` — song not found
- `400` — tag_names is empty

---

### `DELETE /api/songs/{song_id}/tags/{tag_id}` — Remove a tag from a song

**Response (200):** Returns the full song object with updated tags list.

**Errors:**
- `404` — song not found, or tag not found, or tag was not on this song

---

## PLAYLISTS

### `POST /api/playlists` — Create a playlist

**Request body:**
```json
{
    "name": "Rock",
    "color": "#E63946",
    "emoji": "🎸"
}
```

| Field | Type         | Required | Notes                        |
|-------|--------------|----------|------------------------------|
| name  | string       | YES      | Unique. Non-empty            |
| color | string\|null | no       | Hex color code               |
| emoji | string\|null | no       | Single emoji character       |

**Response (201):**
```json
{
    "data": {
        "id": 1,
        "name": "Rock",
        "color": "#E63946",
        "emoji": "🎸",
        "song_count": 0,
        "created_at": "2026-04-07T15:30:00Z",
        "updated_at": "2026-04-07T15:30:00Z"
    },
    "message": "Playlist created successfully"
}
```

**Errors:**
- `400` — name is empty
- `409` — playlist with this name already exists

---

### `GET /api/playlists` — List all playlists

**Response (200):**
```json
{
    "data": [
        {
            "id": 1,
            "name": "Rock",
            "color": "#E63946",
            "emoji": "🎸",
            "song_count": 23,
            "created_at": "2026-04-07T15:30:00Z",
            "updated_at": "2026-04-07T15:30:00Z"
        }
    ],
    "total": 1,
    "message": "ok"
}
```

---

### `GET /api/playlists/{id}` — Get playlist with its songs

**Response (200):**
```json
{
    "data": {
        "id": 1,
        "name": "Rock",
        "color": "#E63946",
        "emoji": "🎸",
        "song_count": 2,
        "songs": [
            {
                "id": 1,
                "title": "Highway Star",
                "artist": "Deep Purple",
                "album": "Machine Head",
                "duration": 367,
                "tags": ["fast", "hype"],
                "position": 0
            },
            {
                "id": 5,
                "title": "Comfortably Numb",
                "artist": "Pink Floyd",
                "album": "The Wall",
                "duration": 382,
                "tags": ["slow", "emotional"],
                "position": 1
            }
        ],
        "created_at": "2026-04-07T15:30:00Z",
        "updated_at": "2026-04-07T15:30:00Z"
    },
    "message": "ok"
}
```

**Notes:**
- Songs are ordered by `position` ascending
- Each song includes its tags but NOT its other playlist memberships (keep it focused)

---

### `PUT /api/playlists/{id}` — Update a playlist

**Request body (all fields optional):**
```json
{
    "name": "Classic Rock",
    "color": "#FF6B35",
    "emoji": "🤘"
}
```

**Response (200):** Returns updated playlist object (without songs list, just metadata + song_count).

---

### `DELETE /api/playlists/{id}` — Delete a playlist

**Response (200):**
```json
{
    "message": "Playlist deleted successfully"
}
```

**Side effects:** Cascading delete removes all `playlist_songs` rows. Songs themselves are NOT deleted.

---

### `POST /api/playlists/{id}/songs` — Add a song to a playlist

**Request body:**
```json
{
    "song_id": 1
}
```

**Behavior:**
- Adds the song at the end (position = current max position + 1)
- If the song is already in the playlist, return `409`

**Response (200):** Returns the full playlist with songs.

**Errors:**
- `404` — playlist or song not found
- `409` — song already in playlist

---

### `DELETE /api/playlists/{id}/songs/{song_id}` — Remove a song from a playlist

**Response (200):** Returns the full playlist with songs.

**Behavior after removal:** Recalculate positions so they remain contiguous (0, 1, 2...).

**Errors:**
- `404` — playlist not found, song not found, or song not in playlist

---

### `PUT /api/playlists/{id}/songs/reorder` — Reorder songs in a playlist

**Request body:**
```json
{
    "song_ids": [5, 1, 3, 2]
}
```

The `song_ids` array contains all song IDs in the playlist in their new order. Position is assigned based on array index.

**Response (200):** Returns the full playlist with songs in new order.

**Errors:**
- `404` — playlist not found
- `400` — song_ids doesn't match the actual songs in the playlist

---

## FILTER ENGINE

### `POST /api/filter` — Run a boolean tag query

**Request body:**
```json
{
    "query": "slow AND (rock OR anime) AND NOT opening"
}
```

| Field | Type   | Required | Notes                                   |
|-------|--------|----------|-----------------------------------------|
| query | string | YES      | Boolean expression using tag/playlist names |

**Response (200):**
```json
{
    "data": [
        {
            "id": 3,
            "title": "Unravel (Acoustic)",
            "artist": "TK from Ling Tosite Sigure",
            "album": "Tokyo Ghoul OST",
            "duration": 240,
            "tags": ["slow", "emotional", "acoustic"],
            "playlists": ["Anime"],
            "source": "manual"
        }
    ],
    "total": 1,
    "query": "slow AND (rock OR anime) AND NOT opening",
    "message": "ok"
}
```

**Notes:**
- The response echoes back the query for display in the UI
- Results include both explicit tags and playlist names in the response
- Results are ordered by title ascending

**Errors:**
- `400` — query is empty or could not be parsed (invalid syntax)

**Supported syntax:**
- Tag names: `slow`, `fast`, `3am drive` (spaces allowed, case-insensitive)
- Operators: `AND`, `OR`, `NOT` (case-insensitive)
- Parentheses: `(`, `)` for grouping
- A single tag name is valid: `slow` returns all songs tagged "slow" or in a playlist named "slow"

---

## FILE SCANNER

### `POST /api/scan` — Scan a folder for music files

**Request body:**
```json
{
    "folder_path": "C:\\Users\\rockz\\Music\\Rock",
    "playlist_name": "Rock"
}
```

| Field         | Type         | Required | Notes                                        |
|---------------|--------------|----------|----------------------------------------------|
| folder_path   | string       | YES      | Absolute path to scan                        |
| playlist_name | string\|null | no       | If provided, add all found songs to this playlist |

**Behavior:**
1. Recursively scan `folder_path` for audio files (.mp3, .flac, .m4a, .ogg, .wav, .aac, .wma, .opus)
2. For each file, extract metadata using mutagen: title, artist, album, duration
3. If title is missing from metadata, use the filename (without extension)
4. If artist is missing from metadata, use "Unknown Artist"
5. Skip files whose `file_path` already exists in `songs` table (duplicate prevention)
6. Insert new songs with `source = 'local_scan'`
7. If `playlist_name` is provided, create the playlist if it doesn't exist, then add **every scanned song that maps to a DB row** to it — newly imported, replaced, and skipped duplicates alike. Re-scanning an already-imported folder therefore still creates/populates the playlist (membership insert is `INSERT OR IGNORE`, so it is idempotent).

**Response (200):**
```json
{
    "data": {
        "scanned": 47,
        "imported": 42,
        "skipped": 5,
        "errors": [
            {
                "file": "C:\\Users\\rockz\\Music\\Rock\\corrupted.mp3",
                "error": "Could not read metadata"
            }
        ],
        "songs": [
            {
                "id": 10,
                "title": "Highway Star",
                "artist": "Deep Purple",
                "album": "Machine Head",
                "duration": 367,
                "file_path": "C:\\Users\\rockz\\Music\\Rock\\Deep Purple - Highway Star.mp3"
            }
        ]
    },
    "message": "Scan complete: 42 songs imported, 5 skipped"
}
```

**Errors:**
- `400` — folder_path is empty
- `404` — folder_path does not exist or is not a directory

---

## CORS Configuration

The FastAPI app must allow CORS from the React dev server:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Health Check

### `GET /api/health`

**Response (200):**
```json
{
    "status": "ok",
    "database": "connected",
    "song_count": 42,
    "tag_count": 15,
    "playlist_count": 4
}
```

Use this to verify the backend is running and the database is accessible.
