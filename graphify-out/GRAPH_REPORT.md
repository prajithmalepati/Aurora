# Graph Report - Aurora  (2026-05-23)

## Corpus Check
- 66 files · ~112,307 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 390 nodes · 563 edges · 18 communities detected
- Extraction: 69% EXTRACTED · 31% INFERRED · 0% AMBIGUOUS · INFERRED: 174 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]

## God Nodes (most connected - your core abstractions)
1. `get_db()` - 27 edges
2. `SongResponse` - 23 edges
3. `PlaylistResponse` - 17 edges
4. `Filter Engine (filter_engine.py)` - 14 edges
5. `PlaylistCreate` - 13 edges
6. `PlaylistUpdate` - 13 edges
7. `PlaylistSongAdd` - 13 edges
8. `PlaylistReorder` - 13 edges
9. `error()` - 12 edges
10. `TagResponse` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Northern Lights Over OLED Black Design System` --semantically_similar_to--> `OLED Void as Ground Plane`  [INFERRED] [semantically similar]
  HANDOFF.md → docs/design-system.md
- `get_db()` --calls--> `health_check()`  [INFERRED]
  backend\app\database.py → backend\app\main.py
- `get_db()` --calls--> `filter_endpoint()`  [INFERRED]
  backend\app\database.py → backend\app\routers\filter.py
- `get_db()` --calls--> `upload_playlist_image()`  [INFERRED]
  backend\app\database.py → backend\app\routers\playlists.py
- `get_db()` --calls--> `delete_playlist_image()`  [INFERRED]
  backend\app\database.py → backend\app\routers\playlists.py

## Hyperedges (group relationships)
- **Boolean Filter Evaluation Pipeline** — fe_parse_query, fe_build_tag_set, fe_evaluate_song, fe_filter_songs [EXTRACTED 1.00]
- **Song-Tag-Playlist Many-to-Many Relationships** — dm_songs_table, dm_tags_table, dm_playlists_table, dm_playlist_songs_table, dm_song_tags_table [EXTRACTED 1.00]
- **Frontend Data Layer (Types + API + Stores)** — ta_types_index, ta_api_client, sm_song_store, sm_playlist_store, sm_filter_store [EXTRACTED 0.90]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (44): Session 15 Completeness Audit, Dead Affordances (EditDialog + addToPlaylist), MediaSession API Missing, Missing File Handling Gap, No Bulk Operations Gap, No M3U Export Gap, No Sort Capability Gap, Priority Gap List (17 Items) (+36 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (37): BaseModel, get_db(), Get a database connection with row_factory set to sqlite3.Row., FilterRequest, PlaylistDetailResponse, Pydantic schemas for request/response validation., ScanRequest, SongCreate (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (37): POST /api/filter Endpoint, Playlists CRUD Endpoints, Songs CRUD Endpoints, Tags CRUD Endpoints, AddSongDialog Component, PlaylistDetail Component, QueryBuilder Component, QueryInput Component (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (13): handleSubmit(), handleSubmit(), ErrorBoundary, handleDelete(), handleRemoveSong(), handleReorder(), handleSaveEdit(), handleScan() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (28): PlaylistCreate, PlaylistReorder, PlaylistResponse, PlaylistSongAdd, PlaylistUpdate, SongResponse, add_song_to_playlist(), create_playlist() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (26): CORS Configuration, POST /api/scan Endpoint, API Client (src/lib/api.ts), Aurora Project, Boolean Filtering System, FastAPI Backend, React Frontend, Aurora Session 4 Handoff (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (23): _detect_m4a_format(), extract_album_art(), extract_metadata(), _first_or_none(), format_tier(), import_scanned_songs(), File scanner for audio files using mutagen., Return quality rank for a file_format string. Higher = better quality. (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (23): OLED Black Theme (Session 3), Atmosphere Fixed Content Quiet (Principle 5), Aurora Gradient Definition, Fraunces Variable Font Loading, Aurora Gradient as Meaning (Principle 2), Historical Design Decisions (Resolved), Muted at Rest Bright on Hover (Principle 3), OLED Void as Ground Plane (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.19
Nodes (11): build_tag_set(), evaluate_song(), filter_songs(), parse_query(), Filter engine for boolean tag queries., Parse a user query string into a boolean expression.          Handles quoted s, Build a complete tag set for a song from CSV strings.          Combines explic, Evaluate whether a song's tag set satisfies the boolean expression.          U (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (8): _backfill_album_art(), init_db(), SQLite database connection and initialization., Extract and store album art for any songs missing it. Runs once per song., Initialize the database — create tables if they don't exist., health_check(), FastAPI application factory., startup()

### Community 12 - "Community 12"
Cohesion: 0.5
Nodes (3): AlbumArt(), albumGradient(), hashString()

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (1): ApiError

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (2): hashString(), playlistThumbnail()

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (1): Aurora backend entry point.

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (2): Canonical Focus Ring (.aurora-focus), C2: Focus Ring Canonical Treatment

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (2): Disabled State Three-Tier System, C3: Disabled Opacity Three-Tier System

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (1): Supported Audio Extensions

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (1): Frontend Project Structure

## Knowledge Gaps
- **78 isolated node(s):** `Aurora backend entry point.`, `SQLite database connection and initialization.`, `Get a database connection with row_factory set to sqlite3.Row.`, `Initialize the database — create tables if they don't exist.`, `Extract and store album art for any songs missing it. Runs once per song.` (+73 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 14`** (5 nodes): `ApiError`, `.constructor()`, `request()`, `uploadRequest()`, `api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (3 nodes): `playlistImage.ts`, `hashString()`, `playlistThumbnail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `run.py`, `Aurora backend entry point.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `Canonical Focus Ring (.aurora-focus)`, `C2: Focus Ring Canonical Treatment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `Disabled State Three-Tier System`, `C3: Disabled Opacity Three-Tier System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `Supported Audio Extensions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `Frontend Project Structure`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_db()` connect `Community 1` to `Community 8`, `Community 9`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `playerStore (Zustand)` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Filter Engine (filter_engine.py)` connect `Community 2` to `Community 5`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `get_db()` (e.g. with `health_check()` and `filter_endpoint()`) actually correct?**
  _`get_db()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `SongResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`SongResponse` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `PlaylistResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`PlaylistResponse` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Aurora backend entry point.`, `SQLite database connection and initialization.`, `Get a database connection with row_factory set to sqlite3.Row.` to the rest of the system?**
  _78 weakly-connected nodes found - possible documentation gaps or missing edges._