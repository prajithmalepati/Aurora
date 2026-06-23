# Aurora — Data Model Specification
## Document 1 of 6

---

## Database: SQLite

**File location:** `backend/aurora.db`
**Important:** Every connection must run `PRAGMA foreign_keys = ON;` before any queries. SQLite does NOT enforce foreign keys by default.

---

## Tables

### 1. `songs`

The core entity. A song exists independently of playlists and tags.

```sql
CREATE TABLE songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    artist      TEXT    NOT NULL,
    album       TEXT,
    duration    INTEGER,                          -- seconds, nullable
    file_path   TEXT    UNIQUE,                   -- absolute path to local file, nullable
    source      TEXT    NOT NULL DEFAULT 'manual', -- 'manual' | 'local_scan' | 'spotify' | 'youtube'
    external_id TEXT,                              -- spotify URI, youtube ID, etc. nullable for now
    created_at  TEXT    NOT NULL,                  -- ISO 8601: '2026-04-07T12:00:00Z'
    updated_at  TEXT    NOT NULL                   -- ISO 8601
);
```

**Notes:**
- `file_path` is UNIQUE when not NULL — prevents duplicate imports from scanning
- `source` tracks HOW the song entered the system. 'manual' = user typed it in, 'local_scan' = imported via folder scan
- `external_id` is unused in v1 but exists so we never need to migrate the schema for Spotify/YouTube
- `duration` is in seconds (integer). Display formatting (mm:ss) is a frontend concern

**Indexes:**
```sql
CREATE INDEX idx_songs_title  ON songs(title);
CREATE INDEX idx_songs_artist ON songs(artist);
CREATE INDEX idx_songs_source ON songs(source);
```

---

### 2. `playlists`

A named collection of songs. The playlist name also functions as an implicit tag.

```sql
CREATE TABLE playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    color      TEXT,                               -- hex color like '#00C9A7', nullable
    emoji      TEXT,                               -- single emoji, nullable
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
);
```

**Notes:**
- `name` is UNIQUE — no two playlists can share a name
- `color` is for the UI sidebar dot/badge next to the playlist name
- When a playlist is created, its lowercased name becomes available as an implicit tag in the filter engine. This is NOT stored in the `tags` table — it's computed at query time

---

### 3. `tags`

A simple label. Tags are lowercase, trimmed, unique strings.

```sql
CREATE TABLE tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,             -- always stored lowercase + trimmed
    created_at TEXT    NOT NULL
);
```

**Notes:**
- Tag names allow spaces: "3am drive", "gym hype" are valid
- Tag names are always stored as `name.strip().lower()`
- Duplicate prevention: before INSERT, check if the lowercased/trimmed name already exists
- Tags are user-created only — no auto-generated tags (playlist names are implicit, not stored here)

**Indexes:**
```sql
CREATE INDEX idx_tags_name ON tags(name);
```

---

### 4. `playlist_songs`

Join table: which songs are in which playlists, with ordering.

```sql
CREATE TABLE playlist_songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     INTEGER NOT NULL REFERENCES songs(id)     ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    added_at    TEXT    NOT NULL,
    UNIQUE(playlist_id, song_id)
);
```

**Notes:**
- `UNIQUE(playlist_id, song_id)` — a song can only appear once per playlist
- The same song CAN appear in multiple playlists (that's the whole point)
- `position` is for ordering within a playlist. Starts at 0. Frontend can reorder.
- `ON DELETE CASCADE` — if a playlist is deleted, all its song associations are removed. If a song is deleted, it's removed from all playlists.

**Indexes:**
```sql
CREATE INDEX idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX idx_playlist_songs_song     ON playlist_songs(song_id);
```

---

### 5. `song_tags`

Join table: which tags are applied to which songs.

```sql
CREATE TABLE song_tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    UNIQUE(song_id, tag_id)
);
```

**Notes:**
- `UNIQUE(song_id, tag_id)` — a tag can only be applied to a song once
- `ON DELETE CASCADE` both ways — deleting a song removes its tag links, deleting a tag removes it from all songs

**Indexes:**
```sql
CREATE INDEX idx_song_tags_song ON song_tags(song_id);
CREATE INDEX idx_song_tags_tag  ON song_tags(tag_id);
```

---

## Complete Initialization Script

This is the exact SQL that `database.py` should run on first startup:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    artist      TEXT    NOT NULL,
    album       TEXT,
    duration    INTEGER,
    file_path   TEXT    UNIQUE,
    source      TEXT    NOT NULL DEFAULT 'manual',
    external_id TEXT,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    color      TEXT,
    emoji      TEXT,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     INTEGER NOT NULL REFERENCES songs(id)     ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    added_at    TEXT    NOT NULL,
    UNIQUE(playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS song_tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    UNIQUE(song_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_songs_title            ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_artist           ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_source           ON songs(source);
CREATE INDEX IF NOT EXISTS idx_tags_name              ON tags(name);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song     ON playlist_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tags_song          ON song_tags(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tags_tag           ON song_tags(tag_id);
```

**`PRAGMA journal_mode = WAL`** — Write-Ahead Logging mode gives better read performance. Safe for single-user.

---

## Entity Relationship Summary

```
songs ──< playlist_songs >── playlists
songs ──< song_tags >── tags
```

- A song has many tags (through song_tags)
- A song belongs to many playlists (through playlist_songs)
- A tag applies to many songs (through song_tags)
- A playlist contains many songs (through playlist_songs)
- Playlist names act as implicit tags in the filter engine (computed, not stored)

---

## How "Playlist Names as Tags" Works

This is a critical design point. When the filter engine evaluates a query like `rock AND slow`:

1. For each song, build a **complete tag set**:
   - All explicit tags from `song_tags` → `tags.name`
   - All playlist names from `playlist_songs` → `playlists.name` (lowercased)
2. Evaluate the boolean expression against this combined set

This means:
- If song "Highway Star" is in playlist "Rock" and has tag "fast", its tag set is `{"rock", "fast"}`
- Query `rock` matches. Query `fast AND rock` matches. Query `slow` does NOT match.
- Playlist names and tag names occupy the same namespace — avoid naming a tag the same as a playlist

**Collision handling:** If a tag and a playlist share the same name, it still works (they both resolve to the same string in the tag set). But the UI should warn the user if they try to create a tag that matches a playlist name.

---

## Date Format Convention

All `created_at`, `updated_at`, `added_at` fields use ISO 8601 format in UTC:

```
2026-04-07T15:30:00Z
```

In Python, generate with:
```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc).isoformat()
```
