# Aurora — Implementation Plan
## Document 6 of 6 | Master Task List for Building Aurora v1

---

## How to Use This Document

1. Work through phases in order (Phase 1 → 2 → 3 → ...)
2. Work through tasks within each phase in order
3. Give Qwen ONE task at a time via Cline
4. For each task, paste the relevant context doc(s) + the task description into Cline
5. After Qwen completes a task, review the output and test it
6. `git add . && git commit -m "Task X.Y: description"` after every task
7. If something is wrong, bring it back to Claude (me) for debugging help
8. Do NOT let Qwen add features, refactor code, or change architecture beyond what the task says

---

## What Context to Give Qwen per Task

| Phase | Context Docs to Paste into Cline |
|-------|----------------------------------|
| Phase 1 (Setup) | `05-project-structure.md` |
| Phase 2 (Songs) | `01-data-model.md` + `02-api-contract.md` (songs section) |
| Phase 3 (Tags) | `01-data-model.md` + `02-api-contract.md` (tags section) |
| Phase 4 (Playlists) | `01-data-model.md` + `02-api-contract.md` (playlists section) |
| Phase 5 (Filter) | `03-filter-engine.md` + `02-api-contract.md` (filter section) |
| Phase 6 (Scanner) | `04-file-scanner.md` + `02-api-contract.md` (scanner section) |
| Phase 7+ (Frontend) | Spec will be written when we get there |

Always also give Qwen access to the existing codebase files it needs to read/modify (Cline does this automatically if the project folder is open).

---

# PHASE 1: PROJECT SETUP

## Task 1.1 — Create the folder structure

**What to do:**
Create the entire backend folder structure with empty `__init__.py` files. Do NOT write any logic yet.

**Files to create:**
```
backend/
├── app/
│   ├── __init__.py           (empty)
│   ├── main.py               (empty, just a comment: # Aurora FastAPI app)
│   ├── database.py           (empty)
│   ├── models.py             (empty)
│   ├── routers/
│   │   ├── __init__.py       (empty)
│   │   ├── songs.py          (empty)
│   │   ├── tags.py           (empty)
│   │   ├── playlists.py      (empty)
│   │   ├── filter.py         (empty)
│   │   └── scanner.py        (empty)
│   └── services/
│       ├── __init__.py       (empty)
│       ├── filter_engine.py  (empty)
│       └── file_scanner.py   (empty)
├── requirements.txt          (contents from 05-project-structure.md)
└── run.py                    (contents from 05-project-structure.md)
```

Also create in the project root:
- `.gitignore` (contents from 05-project-structure.md)
- `README.md` (contents from 05-project-structure.md)

**Git commit:** `git init && git add . && git commit -m "Task 1.1: Create project folder structure"`

---

## Task 1.2 — Set up Python virtual environment

**What to do (manual — do this yourself, not Qwen):**
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Verify it works:
```bash
python -c "import fastapi; print(fastapi.__version__)"
python -c "import boolean; print('boolean.py OK')"
python -c "import mutagen; print(mutagen.version_string)"
```

No git commit needed — venv is gitignored.

---

## Task 1.3 — Implement `database.py`

**What to do:**
Write the full `database.py` with:
- `DB_PATH` pointing to `backend/aurora.db`
- `INIT_SQL` string containing the complete table creation SQL from `01-data-model.md`
- `get_db()` function that returns a connection with `row_factory = sqlite3.Row` and `PRAGMA foreign_keys = ON`
- `init_db()` function that runs `INIT_SQL` via `executescript()`

**Context to give Qwen:** `01-data-model.md` (complete init SQL section) + `05-project-structure.md` (database.py section)

**Test:** `python -c "from app.database import init_db; init_db(); print('DB created')"` (run from `backend/` dir)

**Git commit:** `Task 1.3: Implement database initialization`

---

## Task 1.4 — Implement `models.py`

**What to do:**
Write ALL Pydantic models from `05-project-structure.md`. Every request and response model. Copy them exactly.

**Context to give Qwen:** `05-project-structure.md` (models.py section) + `02-api-contract.md` (for reference)

**Git commit:** `Task 1.4: Add all Pydantic request/response models`

---

## Task 1.5 — Implement `main.py` with health check

**What to do:**
Write `main.py` with:
- FastAPI app creation
- CORS middleware
- Router includes (all routers — they'll be empty but importable)
- `startup` event that calls `init_db()`
- `GET /api/health` endpoint

Each empty router file needs at minimum:
```python
from fastapi import APIRouter
router = APIRouter()
```

So that the imports in main.py don't fail.

**Context to give Qwen:** `05-project-structure.md` (main.py section)

**Test:** 
```bash
cd backend
python run.py
# Then in another terminal:
curl http://localhost:8000/api/health
# Should return: {"status":"ok","database":"connected",...}
# Also check: http://localhost:8000/docs (Swagger UI)
```

**Git commit:** `Task 1.5: FastAPI app with health check and Swagger docs`

---

# PHASE 2: SONG CRUD

## Task 2.1 — `POST /api/songs` (create song)

**What to do:**
In `routers/songs.py`, implement the create song endpoint.

- Accept `SongCreate` body
- Insert into `songs` table with `source='manual'`, current timestamp for `created_at` and `updated_at`
- Handle duplicate `file_path` (catch IntegrityError → 409)
- Return the created song with empty `tags` and `playlists` lists

**Context to give Qwen:** `02-api-contract.md` (POST /api/songs section) + let it read existing `database.py` and `models.py`

**Test:**
```bash
curl -X POST http://localhost:8000/api/songs \
  -H "Content-Type: application/json" \
  -d '{"title":"Highway Star","artist":"Deep Purple","album":"Machine Head","duration":367}'
```

**Git commit:** `Task 2.1: POST /api/songs endpoint`

---

## Task 2.2 — `GET /api/songs` (list songs)

**What to do:**
Implement the list endpoint with:
- `search` query param (optional) — `WHERE title LIKE ? OR artist LIKE ?`
- `limit` query param (default 50)
- `offset` query param (default 0)
- For each song, fetch its tags and playlist names

**Important SQL pattern for fetching songs with their tags and playlists:**
```sql
SELECT
    s.*,
    GROUP_CONCAT(DISTINCT t.name) AS tag_names,
    GROUP_CONCAT(DISTINCT p.name) AS playlist_names
FROM songs s
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id
LEFT JOIN playlist_songs ps ON s.id = ps.song_id
LEFT JOIN playlists p ON ps.playlist_id = p.id
WHERE (? IS NULL OR s.title LIKE ? OR s.artist LIKE ?)
GROUP BY s.id
ORDER BY s.title
LIMIT ? OFFSET ?
```

Parse `tag_names` and `playlist_names` from comma-separated strings to Python lists. Handle NULL (no tags/playlists) → empty list.

**Also** add a helper function to convert a song row to a response dict, since this will be reused by GET /songs/{id}, PUT, etc:

```python
def song_row_to_dict(row) -> dict:
    """Convert a sqlite3.Row (from the joined query) to a response dict."""
    ...
```

Put this helper in `routers/songs.py` (or a shared utils module if preferred).

**Test:**
```bash
curl http://localhost:8000/api/songs
curl "http://localhost:8000/api/songs?search=highway"
```

**Git commit:** `Task 2.2: GET /api/songs with search and pagination`

---

## Task 2.3 — `GET /api/songs/{id}` (single song)

**What to do:**
Fetch one song by ID using the same joined query from 2.2, but with `WHERE s.id = ?`. Return 404 if not found.

**Test:**
```bash
curl http://localhost:8000/api/songs/1
curl http://localhost:8000/api/songs/9999  # should 404
```

**Git commit:** `Task 2.3: GET /api/songs/{id} endpoint`

---

## Task 2.4 — `PUT /api/songs/{id}` (update song)

**What to do:**
- Accept `SongUpdate` body (all fields optional)
- Only update fields that are provided (not None)
- Always update `updated_at`
- Return 404 if song not found
- Return the updated song (using the joined query)

**Build the UPDATE query dynamically** based on which fields are provided:
```python
fields = []
values = []
if song_update.title is not None:
    fields.append("title = ?")
    values.append(song_update.title)
# ... etc
fields.append("updated_at = ?")
values.append(now)
values.append(song_id)

query = f"UPDATE songs SET {', '.join(fields)} WHERE id = ?"
```

**Git commit:** `Task 2.4: PUT /api/songs/{id} endpoint`

---

## Task 2.5 — `DELETE /api/songs/{id}` (delete song)

**What to do:**
- Check song exists (404 if not)
- Delete from `songs` table (cascading deletes handle join tables)
- Return success message

**Git commit:** `Task 2.5: DELETE /api/songs/{id} endpoint`

---

## Task 2.6 — Test all song endpoints

**What to do (manual — do this yourself):**

Run through this complete test sequence:
```bash
# Create 3 songs
curl -X POST http://localhost:8000/api/songs -H "Content-Type: application/json" \
  -d '{"title":"Highway Star","artist":"Deep Purple","album":"Machine Head","duration":367}'

curl -X POST http://localhost:8000/api/songs -H "Content-Type: application/json" \
  -d '{"title":"Comfortably Numb","artist":"Pink Floyd","album":"The Wall","duration":382}'

curl -X POST http://localhost:8000/api/songs -H "Content-Type: application/json" \
  -d '{"title":"Unravel","artist":"TK from Ling Tosite Sigure","album":"Tokyo Ghoul OST","duration":240}'

# List all
curl http://localhost:8000/api/songs

# Search
curl "http://localhost:8000/api/songs?search=pink"

# Get one
curl http://localhost:8000/api/songs/1

# Update
curl -X PUT http://localhost:8000/api/songs/1 -H "Content-Type: application/json" \
  -d '{"title":"Highway Star (Remastered)"}'

# Delete
curl -X DELETE http://localhost:8000/api/songs/3

# Verify deletion
curl http://localhost:8000/api/songs
```

If anything fails, bring it to Claude for debugging.

**Git commit:** `Task 2.6: Song CRUD verified and working`

---

# PHASE 3: TAG SYSTEM

## Task 3.1 — `POST /api/tags` (create tag)

**What to do:**
In `routers/tags.py`:
- Accept `TagCreate` body
- Lowercase + trim the name
- Check for empty name after trimming → 400
- Check for duplicate → 409
- Insert into `tags` table
- Return with `song_count: 0`

**Git commit:** `Task 3.1: POST /api/tags endpoint`

---

## Task 3.2 — `GET /api/tags` (list tags)

**What to do:**
- Query all tags with their song counts:
```sql
SELECT t.id, t.name, t.created_at, COUNT(st.song_id) AS song_count
FROM tags t
LEFT JOIN song_tags st ON t.id = st.tag_id
GROUP BY t.id
ORDER BY t.name
```

**Git commit:** `Task 3.2: GET /api/tags endpoint`

---

## Task 3.3 — `DELETE /api/tags/{id}`

**What to do:**
- Check tag exists → 404
- Delete (cascading removes song_tags rows)
- Return success message

**Git commit:** `Task 3.3: DELETE /api/tags/{id} endpoint`

---

## Task 3.4 — `POST /api/songs/{song_id}/tags` (assign tags)

**What to do:**
In `routers/tags.py`:
- Accept `TagAssign` body (`tag_names` list)
- Verify song exists → 404
- For each tag name:
  - Lowercase + trim
  - Skip empty strings
  - Create tag in `tags` table if it doesn't exist (INSERT OR IGNORE, then SELECT id)
  - Create `song_tags` link if it doesn't exist (INSERT OR IGNORE)
- Return the full updated song object (reuse the joined query from songs router)

**Important:** This is additive. It does NOT remove existing tags from the song.

**To reuse the song query:** Either import the helper from `routers/songs.py`, or extract it to a shared utility. Extracting to `app/utils.py` is cleanest:

```python
# app/utils.py
def get_song_with_relations(db, song_id: int) -> dict | None:
    """Fetch a single song with its tags and playlist names."""
    ...
```

**Git commit:** `Task 3.4: POST /api/songs/{id}/tags endpoint`

---

## Task 3.5 — `DELETE /api/songs/{song_id}/tags/{tag_id}` (remove tag)

**What to do:**
- Verify song exists → 404
- Verify tag exists → 404
- Delete the `song_tags` row → 404 if it didn't exist
- Return updated song object

**Git commit:** `Task 3.5: DELETE /api/songs/{id}/tags/{tag_id} endpoint`

---

## Task 3.6 — Test tag system

**What to do (manual):**
```bash
# Create tags
curl -X POST http://localhost:8000/api/tags -H "Content-Type: application/json" -d '{"name":"fast"}'
curl -X POST http://localhost:8000/api/tags -H "Content-Type: application/json" -d '{"name":"slow"}'
curl -X POST http://localhost:8000/api/tags -H "Content-Type: application/json" -d '{"name":"hype"}'

# List tags
curl http://localhost:8000/api/tags

# Assign tags to a song (assuming song id 1 exists)
curl -X POST http://localhost:8000/api/songs/1/tags -H "Content-Type: application/json" \
  -d '{"tag_names":["fast","hype","gym"]}'
# Note: "gym" doesn't exist yet — it should be auto-created

# Verify song now has tags
curl http://localhost:8000/api/songs/1

# Remove a tag from song
curl -X DELETE http://localhost:8000/api/songs/1/tags/3

# Verify tag list updated
curl http://localhost:8000/api/tags

# Test duplicate tag name
curl -X POST http://localhost:8000/api/tags -H "Content-Type: application/json" -d '{"name":"FAST"}'
# Should 409 (fast already exists, case-insensitive)
```

**Git commit:** `Task 3.6: Tag system verified and working`

---

# PHASE 4: PLAYLIST SYSTEM

## Task 4.1 — `POST /api/playlists` (create playlist)

**What to do:**
In `routers/playlists.py`:
- Accept `PlaylistCreate` body
- Check for duplicate name → 409
- Insert with timestamps
- Return with `song_count: 0`

**Git commit:** `Task 4.1: POST /api/playlists endpoint`

---

## Task 4.2 — `GET /api/playlists` (list playlists)

**What to do:**
- Query all playlists with song counts:
```sql
SELECT p.*, COUNT(ps.song_id) AS song_count
FROM playlists p
LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
GROUP BY p.id
ORDER BY p.name
```

**Git commit:** `Task 4.2: GET /api/playlists endpoint`

---

## Task 4.3 — `GET /api/playlists/{id}` (playlist with songs)

**What to do:**
- Fetch playlist metadata
- Fetch songs in the playlist, ordered by position, with each song's tags:
```sql
SELECT
    s.id, s.title, s.artist, s.album, s.duration,
    ps.position,
    GROUP_CONCAT(DISTINCT t.name) AS tag_names
FROM playlist_songs ps
JOIN songs s ON ps.song_id = s.id
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id
WHERE ps.playlist_id = ?
GROUP BY s.id
ORDER BY ps.position
```

**Git commit:** `Task 4.3: GET /api/playlists/{id} with songs endpoint`

---

## Task 4.4 — `PUT /api/playlists/{id}` (update playlist)

**What to do:**
- Same dynamic update pattern as song update (Task 2.4)
- Only update provided fields
- Check for name uniqueness if name is being changed → 409
- Return updated playlist metadata (no songs list needed)

**Git commit:** `Task 4.4: PUT /api/playlists/{id} endpoint`

---

## Task 4.5 — `DELETE /api/playlists/{id}`

**What to do:**
- Check exists → 404
- Delete (cascading handles playlist_songs)
- Songs are NOT deleted

**Git commit:** `Task 4.5: DELETE /api/playlists/{id} endpoint`

---

## Task 4.6 — `POST /api/playlists/{id}/songs` (add song)

**What to do:**
- Accept `PlaylistSongAdd` body
- Verify playlist and song exist → 404
- Check song not already in playlist → 409
- Insert at position = current max + 1
- Return full playlist with songs

**Git commit:** `Task 4.6: POST /api/playlists/{id}/songs endpoint`

---

## Task 4.7 — `DELETE /api/playlists/{id}/songs/{song_id}` (remove song)

**What to do:**
- Delete the `playlist_songs` row
- Recompact positions: update remaining songs so positions are contiguous (0, 1, 2...)
```sql
-- After deleting the row, renumber:
UPDATE playlist_songs
SET position = (
    SELECT COUNT(*)
    FROM playlist_songs ps2
    WHERE ps2.playlist_id = playlist_songs.playlist_id
    AND ps2.position < playlist_songs.position
)
WHERE playlist_id = ?
```

Or simpler: fetch all remaining songs ordered by position, then update each with new sequential position.

**Git commit:** `Task 4.7: DELETE /api/playlists/{id}/songs/{song_id} with recompact`

---

## Task 4.8 — `PUT /api/playlists/{id}/songs/reorder`

**What to do:**
- Accept `PlaylistReorder` body (list of song_ids in new order)
- Verify the list contains exactly the songs currently in the playlist → 400 if mismatch
- Update position for each song based on its index in the array
- Return full playlist with songs in new order

**Git commit:** `Task 4.8: PUT /api/playlists/{id}/songs/reorder endpoint`

---

## Task 4.9 — Test playlist system

**What to do (manual):**
```bash
# Create playlists
curl -X POST http://localhost:8000/api/playlists -H "Content-Type: application/json" \
  -d '{"name":"Rock","color":"#E63946","emoji":"🎸"}'
curl -X POST http://localhost:8000/api/playlists -H "Content-Type: application/json" \
  -d '{"name":"Anime","color":"#457B9D","emoji":"🎌"}'

# Add songs to playlist (assuming songs with ids 1, 2 exist)
curl -X POST http://localhost:8000/api/playlists/1/songs -H "Content-Type: application/json" \
  -d '{"song_id":1}'
curl -X POST http://localhost:8000/api/playlists/1/songs -H "Content-Type: application/json" \
  -d '{"song_id":2}'

# Get playlist with songs
curl http://localhost:8000/api/playlists/1

# Reorder
curl -X PUT http://localhost:8000/api/playlists/1/songs/reorder -H "Content-Type: application/json" \
  -d '{"song_ids":[2,1]}'

# Remove song from playlist
curl -X DELETE http://localhost:8000/api/playlists/1/songs/2

# Verify song still exists (just removed from playlist, not deleted)
curl http://localhost:8000/api/songs/2

# Verify song's playlist list is updated
curl http://localhost:8000/api/songs/1
# Should show playlists: ["Rock"]
```

**Git commit:** `Task 4.9: Playlist system verified and working`

---

# PHASE 5: BOOLEAN FILTER ENGINE

## Task 5.1 — Implement `filter_engine.py`

**What to do:**
Write the complete filter engine in `services/filter_engine.py` following `03-filter-engine.md` exactly.

The module must export one function:
```python
def filter_songs(db: sqlite3.Connection, query_string: str) -> list[dict]:
```

Include:
- `parse_query()` — handles operator normalization, quoted tag names, placeholder mapping
- `build_tag_set()` — builds set from comma-separated strings
- `evaluate_song()` — uses boolean.py's subs() + simplify()
- `filter_songs()` — the main entry point

**Context to give Qwen:** `03-filter-engine.md` in its entirety

**Git commit:** `Task 5.1: Implement boolean filter engine`

---

## Task 5.2 — Implement `POST /api/filter` endpoint

**What to do:**
In `routers/filter.py`:
- Accept `FilterRequest` body
- Call `filter_songs()` from the service
- Catch `ValueError` (invalid syntax) → 400
- Return matching songs with the query echoed back

**Git commit:** `Task 5.2: POST /api/filter endpoint`

---

## Task 5.3 — Test the filter engine

**What to do (manual):**

First, set up test data:
```bash
# Create songs (if not already present from earlier testing)
# Song 1: Highway Star — Rock, tags: fast, hype
# Song 2: Comfortably Numb — Rock, tags: slow, emotional
# Song 3: Unravel — Anime, tags: slow, emotional, opening

# Create needed tags and assign them
curl -X POST http://localhost:8000/api/songs/1/tags -H "Content-Type: application/json" \
  -d '{"tag_names":["fast","hype"]}'
curl -X POST http://localhost:8000/api/songs/2/tags -H "Content-Type: application/json" \
  -d '{"tag_names":["slow","emotional"]}'
curl -X POST http://localhost:8000/api/songs/3/tags -H "Content-Type: application/json" \
  -d '{"tag_names":["slow","emotional","opening"]}'

# Ensure songs are in playlists
# Song 1 & 2 in Rock, Song 3 in Anime
```

Now test queries:
```bash
# Single tag
curl -X POST http://localhost:8000/api/filter -H "Content-Type: application/json" \
  -d '{"query":"slow"}'
# Expected: songs 2 and 3

# AND
curl -X POST http://localhost:8000/api/filter -H "Content-Type: application/json" \
  -d '{"query":"slow AND rock"}'
# Expected: song 2 only (Comfortably Numb is slow AND in Rock)

# OR
curl -X POST http://localhost:8000/api/filter -H "Content-Type: application/json" \
  -d '{"query":"rock OR anime"}'
# Expected: songs 1, 2, 3

# NOT
curl -X POST http://localhost:8000/api/filter -H "Content-Type: application/json" \
  -d '{"query":"slow AND NOT opening"}'
# Expected: song 2 only

# Parentheses
curl -X POST http://localhost:8000/api/filter -H "Content-Type: application/json" \
  -d '{"query":"emotional AND (rock OR anime)"}'
# Expected: songs 2 and 3

# No matches
curl -X POST http://localhost:8000/api/filter -H "Content-Type: application/json" \
  -d '{"query":"fast AND anime"}'
# Expected: empty array

# Invalid syntax
curl -X POST http://localhost:8000/api/filter -H "Content-Type: application/json" \
  -d '{"query":"AND AND AND"}'
# Expected: 400 error
```

**Git commit:** `Task 5.3: Filter engine verified and working`

---

# PHASE 6: FILE SCANNER

## Task 6.1 — Implement `file_scanner.py`

**What to do:**
Write the complete file scanner in `services/file_scanner.py` following `04-file-scanner.md` exactly.

The module must export:
- `AUDIO_EXTENSIONS` — set of supported extensions
- `extract_metadata(file_path) -> dict | None`
- `scan_folder(folder_path) -> tuple[list[dict], list[dict]]`
- `import_scanned_songs(db, folder_path, playlist_name) -> dict`

**Context to give Qwen:** `04-file-scanner.md` in its entirety

**Git commit:** `Task 6.1: Implement file scanner service`

---

## Task 6.2 — Implement `POST /api/scan` endpoint

**What to do:**
In `routers/scanner.py`:
- Accept `ScanRequest` body
- Validate folder exists and is a directory → 404
- Call `import_scanned_songs()` from the service
- Return the scan summary

**Git commit:** `Task 6.2: POST /api/scan endpoint`

---

## Task 6.3 — Test the file scanner

**What to do (manual):**

Point it at a real music folder on your machine:
```bash
curl -X POST http://localhost:8000/api/scan -H "Content-Type: application/json" \
  -d '{"folder_path":"C:\\Users\\rockz\\Music\\Rock","playlist_name":"Rock"}'
```

Verify:
- Songs were imported (check `curl http://localhost:8000/api/songs`)
- Playlist was created (check `curl http://localhost:8000/api/playlists`)
- Songs are in the playlist (check `curl http://localhost:8000/api/playlists/1`)
- Running the scan again imports 0 new songs (duplicate detection)

**Git commit:** `Task 6.3: File scanner verified and working`

---

# PHASE 7–12: FRONTEND (SPEC TO BE WRITTEN LATER)

The frontend phases will be specced out AFTER the backend is fully working and tested. This is intentional:

1. The backend is the foundation — get it right first
2. Frontend design decisions benefit from having a working API to test against
3. We'll write a separate frontend spec doc when we get here
4. The frontend will be built with Vite + React, following the aurora aesthetic from the handoff doc

**Rough phases (details TBD):**
- Phase 7: React project setup + dark theme + API client
- Phase 8: Song management UI (list, add, edit, delete, tag editor)
- Phase 9: Playlist UI (sidebar, create, detail view, add/remove songs)
- Phase 10: Query builder UI (operator buttons, tag chips, parentheses, results)
- Phase 11: File scanner UI (folder input, progress, results)
- Phase 12: Player bar (visual, local file playback if feasible)

---

# SUMMARY

| Phase | Tasks | What It Builds |
|-------|-------|----------------|
| 1 | 1.1–1.5 | Project skeleton, DB, models, health check |
| 2 | 2.1–2.6 | Complete song CRUD |
| 3 | 3.1–3.6 | Tag creation, assignment, removal |
| 4 | 4.1–4.9 | Playlist CRUD, song management, reordering |
| 5 | 5.1–5.3 | Boolean filter engine with parentheses |
| 6 | 6.1–6.3 | Local file scanning with metadata extraction |
| 7–12 | TBD | React frontend |

**Total backend tasks: 25**
**Estimated time:** 2–4 sessions of focused work with Qwen

After Phase 6, you'll have a fully functional backend you can test entirely via curl or the Swagger docs UI at http://localhost:8000/docs. That's your MVP backend.
