# Graph Report - .  (2026-04-28)

## Corpus Check
- 89 files · ~67,567 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 460 nodes · 709 edges · 43 communities detected
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 174 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UX Gaps & Audit Findings|UX Gaps & Audit Findings]]
- [[_COMMUNITY_Pydantic Data Models|Pydantic Data Models]]
- [[_COMMUNITY_API Endpoints & UI Dialogs|API Endpoints & UI Dialogs]]
- [[_COMMUNITY_Form Handlers & Dialogs|Form Handlers & Dialogs]]
- [[_COMMUNITY_FastAPI Router Modules|FastAPI Router Modules]]
- [[_COMMUNITY_Project Architecture Overview|Project Architecture Overview]]
- [[_COMMUNITY_File Scanner Service|File Scanner Service]]
- [[_COMMUNITY_Backend Entry & Config|Backend Entry & Config]]
- [[_COMMUNITY_Boolean Filter Engine|Boolean Filter Engine]]
- [[_COMMUNITY_Database & App Bootstrap|Database & App Bootstrap]]
- [[_COMMUNITY_Scanner API Router|Scanner API Router]]
- [[_COMMUNITY_React Error Boundary|React Error Boundary]]
- [[_COMMUNITY_Dropdown Menu UI|Dropdown Menu UI]]
- [[_COMMUNITY_Popover UI Component|Popover UI Component]]
- [[_COMMUNITY_Album Art & Gradient|Album Art & Gradient]]
- [[_COMMUNITY_Table UI Component|Table UI Component]]
- [[_COMMUNITY_API Client Core|API Client Core]]
- [[_COMMUNITY_App Entry & Root|App Entry & Root]]
- [[_COMMUNITY_Alert Dialog UI|Alert Dialog UI]]
- [[_COMMUNITY_Command Menu UI|Command Menu UI]]
- [[_COMMUNITY_Filter Store Logic|Filter Store Logic]]
- [[_COMMUNITY_Query Input Component|Query Input Component]]
- [[_COMMUNITY_Sidebar Navigation|Sidebar Navigation]]
- [[_COMMUNITY_Edit Song Dialog|Edit Song Dialog]]
- [[_COMMUNITY_Alert UI Component|Alert UI Component]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]

## God Nodes (most connected - your core abstractions)
1. `get_db()` - 28 edges
2. `SongResponse` - 24 edges
3. `PlaylistResponse` - 18 edges
4. `PlaylistCreate` - 14 edges
5. `PlaylistUpdate` - 14 edges
6. `PlaylistSongAdd` - 14 edges
7. `PlaylistReorder` - 14 edges
8. `Filter Engine (filter_engine.py)` - 14 edges
9. `error()` - 13 edges
10. `TagResponse` - 10 edges

## Surprising Connections (you probably didn't know these)
- `OLED Void as Ground Plane` --semantically_similar_to--> `Northern Lights Over OLED Black Design System`  [INFERRED] [semantically similar]
  docs/design-system.md → HANDOFF.md
- `health_check()` --calls--> `get_db()`  [INFERRED]
  D:\AI\projects2\Aurora\backend\app\main.py → D:\AI\projects2\Aurora\backend\app\database.py
- `filter_endpoint()` --calls--> `get_db()`  [INFERRED]
  D:\AI\projects2\Aurora\backend\app\routers\filter.py → D:\AI\projects2\Aurora\backend\app\database.py
- `scan_folder()` --calls--> `get_db()`  [INFERRED]
  D:\AI\projects2\Aurora\backend\app\routers\scanner.py → D:\AI\projects2\Aurora\backend\app\database.py
- `_backfill_album_art()` --calls--> `extract_album_art()`  [INFERRED]
  D:\AI\projects2\Aurora\backend\app\database.py → D:\AI\projects2\Aurora\backend\app\services\file_scanner.py

## Hyperedges (group relationships)
- **Boolean Filter Evaluation Pipeline** — fe_parse_query, fe_build_tag_set, fe_evaluate_song, fe_filter_songs [EXTRACTED 1.00]
- **Song-Tag-Playlist Many-to-Many Relationships** — dm_songs_table, dm_tags_table, dm_playlists_table, dm_playlist_songs_table, dm_song_tags_table [EXTRACTED 1.00]
- **Frontend Data Layer (Types + API + Stores)** — ta_types_index, ta_api_client, sm_song_store, sm_playlist_store, sm_filter_store [EXTRACTED 0.90]

## Communities

### Community 0 - "UX Gaps & Audit Findings"
Cohesion: 0.05
Nodes (44): Session 15 Completeness Audit, Dead Affordances (EditDialog + addToPlaylist), MediaSession API Missing, Missing File Handling Gap, No Bulk Operations Gap, No M3U Export Gap, No Sort Capability Gap, Priority Gap List (17 Items) (+36 more)

### Community 1 - "Pydantic Data Models"
Cohesion: 0.19
Nodes (37): BaseModel, FilterRequest, PlaylistCreate, PlaylistDetailResponse, PlaylistReorder, PlaylistResponse, PlaylistSongAdd, PlaylistUpdate (+29 more)

### Community 2 - "API Endpoints & UI Dialogs"
Cohesion: 0.09
Nodes (37): POST /api/filter Endpoint, Playlists CRUD Endpoints, Songs CRUD Endpoints, Tags CRUD Endpoints, AddSongDialog Component, PlaylistDetail Component, QueryBuilder Component, QueryInput Component (+29 more)

### Community 3 - "Form Handlers & Dialogs"
Cohesion: 0.1
Nodes (21): handleSubmit(), handlePresetClick(), handleSubmit(), handleDelete(), handleEdit(), handlePlay(), handlePlaySong(), handleRemoveSong() (+13 more)

### Community 4 - "FastAPI Router Modules"
Cohesion: 0.16
Nodes (28): get_db(), Get a database connection with row_factory set to sqlite3.Row., add_song_to_playlist(), create_playlist(), delete_playlist(), delete_playlist_image(), delete_song_from_playlist(), get_playlist() (+20 more)

### Community 5 - "Project Architecture Overview"
Cohesion: 0.06
Nodes (33): API Client (src/lib/api.ts), Aurora Project, Boolean Filtering System, React Frontend, Aurora Session 4 Handoff, OLED Black Theme (Session 3), Atmosphere Fixed Content Quiet (Principle 5), Aurora Gradient Definition (+25 more)

### Community 6 - "File Scanner Service"
Cohesion: 0.19
Nodes (17): _detect_m4a_format(), extract_album_art(), extract_metadata(), _first_or_none(), format_tier(), import_scanned_songs(), File scanner for audio files using mutagen., Return quality rank for a file_format string. Higher = better quality. (+9 more)

### Community 7 - "Backend Entry & Config"
Cohesion: 0.13
Nodes (18): CORS Configuration, POST /api/scan Endpoint, FastAPI Backend, extract_metadata Function, File Scanner (file_scanner.py), scan_folder Function, Album Art Extraction & Display, Backend Complete State (+10 more)

### Community 8 - "Boolean Filter Engine"
Cohesion: 0.2
Nodes (11): build_tag_set(), evaluate_song(), filter_songs(), parse_query(), Filter engine for boolean tag queries., Parse a user query string into a boolean expression.          Handles quoted s, Build a complete tag set for a song from CSV strings.          Combines explic, Evaluate whether a song's tag set satisfies the boolean expression.          U (+3 more)

### Community 9 - "Database & App Bootstrap"
Cohesion: 0.24
Nodes (8): _backfill_album_art(), init_db(), SQLite database connection and initialization., Extract and store album art for any songs missing it. Runs once per song., Initialize the database — create tables if they don't exist., health_check(), FastAPI application factory., startup()

### Community 10 - "Scanner API Router"
Cohesion: 0.32
Nodes (6): Request body for POST /scan., Response body for POST /scan., Scan a folder for music files and import them into the database., scan_folder(), ScanRequest, ScanResponse

### Community 11 - "React Error Boundary"
Cohesion: 0.29
Nodes (1): ErrorBoundary

### Community 12 - "Dropdown Menu UI"
Cohesion: 0.48
Nodes (5): cn(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuPortal(), DropdownMenuTrigger()

### Community 13 - "Popover UI Component"
Cohesion: 0.48
Nodes (5): cn(), Popover(), PopoverDescription(), PopoverTitle(), PopoverTrigger()

### Community 14 - "Album Art & Gradient"
Cohesion: 0.38
Nodes (3): AlbumArt(), albumGradient(), hashString()

### Community 15 - "Table UI Component"
Cohesion: 0.53
Nodes (4): cn(), Table(), TableBody(), TableHeader()

### Community 16 - "API Client Core"
Cohesion: 0.47
Nodes (3): ApiError, request(), uploadRequest()

### Community 17 - "App Entry & Root"
Cohesion: 0.4
Nodes (1): App()

### Community 18 - "Alert Dialog UI"
Cohesion: 0.6
Nodes (3): AlertDialogPortal(), AlertDialogTrigger(), cn()

### Community 19 - "Command Menu UI"
Cohesion: 0.6
Nodes (3): cn(), CommandGroup(), CommandItem()

### Community 20 - "Filter Store Logic"
Cohesion: 0.6
Nodes (3): filterResultToSong(), friendlyFilterError(), shuffleArray()

### Community 21 - "Query Input Component"
Cohesion: 0.67
Nodes (2): handleKeyDown(), validateQuery()

### Community 22 - "Sidebar Navigation"
Cohesion: 0.67
Nodes (2): handleTagClick(), isActive()

### Community 23 - "Edit Song Dialog"
Cohesion: 0.67
Nodes (2): handleAddToPlaylist(), handleSubmit()

### Community 24 - "Alert UI Component"
Cohesion: 0.67
Nodes (2): Alert(), cn()

### Community 25 - "Community 25"
Cohesion: 0.83
Nodes (2): hashString(), playlistThumbnail()

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (2): cn(), formatDuration()

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (1): Aurora backend entry point.

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (1): handlePlaySong()

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (1): handleFileChange()

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (1): TableHeader()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (1): TagChip()

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (1): cn()

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (1): Equalizer()

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (1): cn()

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (1): Skeleton()

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (1): cn()

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (1): ToastClickDismiss()

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (1): useAudioPlayer()

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (2): Disabled State Three-Tier System, C3: Disabled Opacity Three-Tier System

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (2): Canonical Focus Ring (.aurora-focus), C2: Focus Ring Canonical Treatment

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (1): Supported Audio Extensions

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (1): Frontend Project Structure

## Knowledge Gaps
- **71 isolated node(s):** `Get a database connection with row_factory set to sqlite3.Row.`, `Initialize the database — create tables if they don't exist.`, `Extract and store album art for any songs missing it. Runs once per song.`, `Request body for POST /scan.`, `Response body for POST /scan.` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `React Error Boundary`** (7 nodes): `ErrorBoundary.tsx`, `ErrorBoundary`, `.componentDidCatch()`, `.constructor()`, `.getDerivedStateFromError()`, `.render()`, `ErrorBoundary.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Entry & Root`** (5 nodes): `App()`, `App.tsx`, `main.tsx`, `App.tsx`, `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Query Input Component`** (4 nodes): `QueryInput.tsx`, `QueryInput.tsx`, `handleKeyDown()`, `validateQuery()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar Navigation`** (4 nodes): `Sidebar.tsx`, `Sidebar.tsx`, `handleTagClick()`, `isActive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Edit Song Dialog`** (4 nodes): `EditSongDialog.tsx`, `handleAddToPlaylist()`, `handleSubmit()`, `EditSongDialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Alert UI Component`** (4 nodes): `Alert()`, `cn()`, `alert.tsx`, `alert.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (4 nodes): `playlistImage.ts`, `playlistImage.ts`, `hashString()`, `playlistThumbnail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (4 nodes): `utils.ts`, `utils.ts`, `cn()`, `formatDuration()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (3 nodes): `run.py`, `run.py`, `Aurora backend entry point.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (3 nodes): `QueryBuilder.tsx`, `QueryBuilder.tsx`, `handlePlaySong()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (3 nodes): `PlaylistImagePicker.tsx`, `PlaylistImagePicker.tsx`, `handleFileChange()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (3 nodes): `SongTable.tsx`, `SongTable.tsx`, `TableHeader()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (3 nodes): `TagChip.tsx`, `TagChip.tsx`, `TagChip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (3 nodes): `dialog.tsx`, `cn()`, `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (3 nodes): `Equalizer.tsx`, `Equalizer()`, `Equalizer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (3 nodes): `input-group.tsx`, `input-group.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (3 nodes): `skeleton.tsx`, `skeleton.tsx`, `Skeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (3 nodes): `textarea.tsx`, `textarea.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (3 nodes): `ToastClickDismiss.tsx`, `ToastClickDismiss.tsx`, `ToastClickDismiss()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (3 nodes): `useAudioPlayer.ts`, `useAudioPlayer.ts`, `useAudioPlayer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `Disabled State Three-Tier System`, `C3: Disabled Opacity Three-Tier System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `Canonical Focus Ring (.aurora-focus)`, `C2: Focus Ring Canonical Treatment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `Supported Audio Extensions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `Frontend Project Structure`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_db()` connect `FastAPI Router Modules` to `Boolean Filter Engine`, `Database & App Bootstrap`, `Scanner API Router`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `React Frontend` connect `Project Architecture Overview` to `UX Gaps & Audit Findings`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `get_db()` (e.g. with `health_check()` and `filter_endpoint()`) actually correct?**
  _`get_db()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `SongResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`SongResponse` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `PlaylistResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`PlaylistResponse` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `PlaylistCreate` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`PlaylistCreate` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Get a database connection with row_factory set to sqlite3.Row.`, `Initialize the database — create tables if they don't exist.`, `Extract and store album art for any songs missing it. Runs once per song.` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._