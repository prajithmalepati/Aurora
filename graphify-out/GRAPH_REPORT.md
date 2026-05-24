# Graph Report - D:/AI/projects2/Aurora  (2026-05-23)

## Corpus Check
- 97 files · ~112,297 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 550 nodes · 841 edges · 52 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 179 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Aurora Aesthetic Audit (2026-05-05), PlayerBar.tsx â€” Persistent Bottom Player Bar|Aurora Aesthetic Audit (2026-05-05), PlayerBar.tsx â€” Persistent Bottom Player Bar]]
- [[_COMMUNITY_Filter Engine (filter_engine.py), Session 15 Completeness Audit|Filter Engine (filter_engine.py), Session 15 Completeness Audit]]
- [[_COMMUNITY_get_db(), SongResponse|get_db(), SongResponse]]
- [[_COMMUNITY_error(), success()|error(), success()]]
- [[_COMMUNITY_file_scanner.py, file_scanner.py|file_scanner.py, file_scanner.py]]
- [[_COMMUNITY_filter_songs(), filter_engine.py|filter_songs(), filter_engine.py]]
- [[_COMMUNITY_Design System Principles, Northern Lights Over OLED Black Design System|Design System Principles, Northern Lights Over OLED Black Design System]]
- [[_COMMUNITY_init_db(), _backfill_album_art()|init_db(), _backfill_album_art()]]
- [[_COMMUNITY_File Scanner (file_scanner.py), Backend Project Structure|File Scanner (file_scanner.py), Backend Project Structure]]
- [[_COMMUNITY_songs.py, songs.py|songs.py, songs.py]]
- [[_COMMUNITY_Aurora Color Palette (CSS Tokens), shadcnui Theme Override|Aurora Color Palette (CSS Tokens), shadcn/ui Theme Override]]
- [[_COMMUNITY_dropdown-menu.tsx, dropdown-menu.tsx|dropdown-menu.tsx, dropdown-menu.tsx]]
- [[_COMMUNITY_popover.tsx, popover.tsx|popover.tsx, popover.tsx]]
- [[_COMMUNITY_albumGradient(), AlbumArt()|albumGradient(), AlbumArt()]]
- [[_COMMUNITY_table.tsx, table.tsx|table.tsx, table.tsx]]
- [[_COMMUNITY_ApiError, api.ts|ApiError, api.ts]]
- [[_COMMUNITY_Fraunces Variable Font Loading, index.html Entry Point|Fraunces Variable Font Loading, index.html Entry Point]]
- [[_COMMUNITY_alert-dialog.tsx, alert-dialog.tsx|alert-dialog.tsx, alert-dialog.tsx]]
- [[_COMMUNITY_command.tsx, command.tsx|command.tsx, command.tsx]]
- [[_COMMUNITY_filterStore.ts, filterStore.ts|filterStore.ts, filterStore.ts]]
- [[_COMMUNITY_App(), App.tsx|App(), App.tsx]]
- [[_COMMUNITY_QueryInput.tsx, QueryInput.tsx|QueryInput.tsx, QueryInput.tsx]]
- [[_COMMUNITY_EditSongDialog.tsx, handleAddToPlaylist()|EditSongDialog.tsx, handleAddToPlaylist()]]
- [[_COMMUNITY_Alert(), cn()|Alert(), cn()]]
- [[_COMMUNITY_hashString(), playlistThumbnail()|hashString(), playlistThumbnail()]]
- [[_COMMUNITY_utils.ts, utils.ts|utils.ts, utils.ts]]
- [[_COMMUNITY_Sidebar.tsx, Sidebar.tsx|Sidebar.tsx, Sidebar.tsx]]
- [[_COMMUNITY_Aurora backend entry point., run.py|Aurora backend entry point., run.py]]
- [[_COMMUNITY_handlePlaySong(), QueryBuilder.tsx|handlePlaySong(), QueryBuilder.tsx]]
- [[_COMMUNITY_handleFileChange(), PlaylistImagePicker.tsx|handleFileChange(), PlaylistImagePicker.tsx]]
- [[_COMMUNITY_TableHeader(), SongTable.tsx|TableHeader(), SongTable.tsx]]
- [[_COMMUNITY_TagChip(), TagChip.tsx|TagChip(), TagChip.tsx]]
- [[_COMMUNITY_cn(), dialog.tsx|cn(), dialog.tsx]]
- [[_COMMUNITY_Equalizer(), Equalizer.tsx|Equalizer(), Equalizer.tsx]]
- [[_COMMUNITY_cn(), input-group.tsx|cn(), input-group.tsx]]
- [[_COMMUNITY_Skeleton(), skeleton.tsx|Skeleton(), skeleton.tsx]]
- [[_COMMUNITY_cn(), textarea.tsx|cn(), textarea.tsx]]
- [[_COMMUNITY_ToastClickDismiss(), ToastClickDismiss.tsx|ToastClickDismiss(), ToastClickDismiss.tsx]]
- [[_COMMUNITY_useAudioPlayer(), useAudioPlayer.ts|useAudioPlayer(), useAudioPlayer.ts]]
- [[_COMMUNITY_FastAPI 0.115.12, Uvicorn 0.34.2|FastAPI 0.115.12, Uvicorn 0.34.2]]
- [[_COMMUNITY_@ Path Alias, Vite Configuration|@/ Path Alias, Vite Configuration]]
- [[_COMMUNITY_Disabled State Three-Tier System, C3 Disabled Opacity Three-Tier System|Disabled State Three-Tier System, C3: Disabled Opacity Three-Tier System]]
- [[_COMMUNITY_Canonical Focus Ring (.aurora-focus), C2 Focus Ring Canonical Treatment|Canonical Focus Ring (.aurora-focus), C2: Focus Ring Canonical Treatment]]
- [[_COMMUNITY_Supported Audio Extensions|Supported Audio Extensions]]
- [[_COMMUNITY_Frontend Project Structure|Frontend Project Structure]]
- [[_COMMUNITY_Store Design Principles|Store Design Principles]]
- [[_COMMUNITY_Aurora Session 4 Handoff|Aurora Session 4 Handoff]]
- [[_COMMUNITY_PlayerBar Bugs (Session 4)|PlayerBar Bugs (Session 4)]]
- [[_COMMUNITY_Future Features (Electron, Crossfade, Lyrics)|Future Features (Electron, Crossfade, Lyrics)]]
- [[_COMMUNITY_Aurora Known Gaps and Bugs|Aurora Known Gaps and Bugs]]
- [[_COMMUNITY_Aurora Quick Start (Backend + Frontend)|Aurora Quick Start (Backend + Frontend)]]
- [[_COMMUNITY_Frontend Vite + React Template README|Frontend Vite + React Template README]]

## God Nodes (most connected - your core abstractions)
1. `get_db()` - 28 edges
2. `SongResponse` - 24 edges
3. `PlaylistResponse` - 18 edges
4. `Aurora Aesthetic Audit (2026-05-05)` - 15 edges
5. `PlaylistCreate` - 14 edges
6. `PlaylistUpdate` - 14 edges
7. `PlaylistSongAdd` - 14 edges
8. `PlaylistReorder` - 14 edges
9. `error()` - 13 edges
10. `Filter Engine (filter_engine.py)` - 13 edges

## Surprising Connections (you probably didn't know these)
- `playlistStore (Playlists, Playlist Songs)` --conceptually_related_to--> `PlaylistDetail.tsx â€” Playlist Hero + Song List`  [INFERRED]
  CLAUDE.md → frontend/src/components/playlists/PlaylistDetail.tsx
- `useAudioPlayer Hook (Two-Effect Architecture)` --references--> `PlayerBar.tsx â€” Persistent Bottom Player Bar`  [INFERRED]
  CLAUDE.md → frontend/src/components/layout/PlayerBar.tsx
- `OLED Void as Ground Plane` --semantically_similar_to--> `Northern Lights Over OLED Black Design System`  [INFERRED] [semantically similar]
  docs/design-system.md → HANDOFF.md
- `songStore (Songs, View Routing, CRUD)` --conceptually_related_to--> `SongRow.tsx â€” Song Table Row Component`  [INFERRED]
  CLAUDE.md → frontend/src/components/songs/SongRow.tsx
- `filterStore (Filter Query, Results, Jam)` --conceptually_related_to--> `QueryBuilder.tsx â€” Boolean Filter + Mix Page`  [INFERRED]
  CLAUDE.md → frontend/src/components/filter/QueryBuilder.tsx

## Hyperedges (group relationships)
- **Song-Tag-Playlist Many-to-Many Relationships** — dm_songs_table, dm_tags_table, dm_playlists_table, dm_playlist_songs_table, dm_song_tags_table [EXTRACTED 1.00]
- **Boolean Filter Evaluation Pipeline** — fe_parse_query, fe_build_tag_set, fe_evaluate_song, fe_filter_songs [EXTRACTED 1.00]
- **Frontend Data Layer (Types + API + Stores)** — ta_types_index, ta_api_client, sm_song_store, sm_playlist_store, sm_filter_store [EXTRACTED 0.90]
- **Design Documentation Chain (Exploration â†’ Spec â†’ Audit â†’ Quick Wins)** — btn_exploration, btn_build_spec, play_button_color, aesthetic_audit, quick_wins_spec [INFERRED 0.90]
- **Health Audit Pipeline (Spec â†’ Phase 1 Plan â†’ Phase 2 Plan â†’ HEALTH.md)** — audit_design_spec, audit_phase1_plan, audit_phase2_plan, health_md_overview [EXTRACTED 1.00]
- **AlbumArt Glow System (albumGradient + AlbumArt + PlayerBar + PlaylistDetail)** — albumgradient_ts, albumart_tsx, playerbar_tsx, playlistdetail_tsx [EXTRACTED 1.00]
- **Button Token System (index.css + button.tsx + --aurora-slate)** — index_css_tokens, button_tsx, aurora_slate_token, button_primary_variant [EXTRACTED 1.00]
- **P1 Fix Targets (G-2 + I-01 via albumGradient + button.tsx)** — health_g2, health_i01, albumgradient_ts, button_tsx [EXTRACTED 1.00]
- **Parallel Audit Agent Dispatch (4 Domain Agents)** — audit_phase1_agent1, audit_phase1_agent2, audit_phase1_agent3, audit_phase1_agent4 [EXTRACTED 1.00]

## Communities

### Community 0 - "Aurora Aesthetic Audit (2026-05-05), PlayerBar.tsx â€” Persistent Bottom Player Bar"
Cohesion: 0.03
Nodes (102): Aurora Aesthetic Audit (2026-05-05), Â§5.2 AlbumArt Bleed Invisibility (HIGH), Â§5.3 AlbumArt Visual Mass Imbalance (HIGH), Â§5.5 All Songs View Findings (HIGH/MEDIUM), Â§5.8 Dialog Italic Register Misapplication (MEDIUM), Â§5.7 Mix Page Button-Tier Rationalisation (HIGH), Â§5.10 Motion â€” Missing Song-Change Moment (MEDIUM), Â§5.1 PlayerBar Idle State Finding (LOW) (+94 more)

### Community 1 - "Filter Engine (filter_engine.py), Session 15 Completeness Audit"
Cohesion: 0.04
Nodes (71): POST /api/filter Endpoint, Playlists CRUD Endpoints, Songs CRUD Endpoints, Tags CRUD Endpoints, Session 15 Completeness Audit, Dead Affordances (EditDialog + addToPlaylist), MediaSession API Missing, Missing File Handling Gap (+63 more)

### Community 2 - "get_db(), SongResponse"
Cohesion: 0.12
Nodes (56): BaseModel, get_db(), Get a database connection with row_factory set to sqlite3.Row., FilterRequest, PlaylistCreate, PlaylistDetailResponse, PlaylistReorder, PlaylistResponse (+48 more)

### Community 3 - "error(), success()"
Cohesion: 0.08
Nodes (22): handleSubmit(), handlePresetClick(), handleSubmit(), ErrorBoundary, handleDelete(), handleEdit(), handlePlay(), handlePlaySong() (+14 more)

### Community 4 - "file_scanner.py, file_scanner.py"
Cohesion: 0.12
Nodes (23): _detect_m4a_format(), extract_album_art(), extract_metadata(), _first_or_none(), format_tier(), import_scanned_songs(), File scanner for audio files using mutagen., Return quality rank for a file_format string. Higher = better quality. (+15 more)

### Community 5 - "filter_songs(), filter_engine.py"
Cohesion: 0.2
Nodes (11): build_tag_set(), evaluate_song(), filter_songs(), parse_query(), Filter engine for boolean tag queries., Parse a user query string into a boolean expression.          Handles quoted s, Build a complete tag set for a song from CSV strings.          Combines explic, Evaluate whether a song's tag set satisfies the boolean expression.          U (+3 more)

### Community 6 - "Design System Principles, Northern Lights Over OLED Black Design System"
Cohesion: 0.15
Nodes (13): OLED Black Theme (Session 3), Atmosphere Fixed Content Quiet (Principle 5), Aurora Gradient Definition, Aurora Gradient as Meaning (Principle 2), Historical Design Decisions (Resolved), Muted at Rest Bright on Hover (Principle 3), OLED Void as Ground Plane, Design System Principles (+5 more)

### Community 7 - "init_db(), _backfill_album_art()"
Cohesion: 0.24
Nodes (8): _backfill_album_art(), init_db(), SQLite database connection and initialization., Extract and store album art for any songs missing it. Runs once per song., Initialize the database — create tables if they don't exist., health_check(), FastAPI application factory., startup()

### Community 8 - "File Scanner (file_scanner.py), Backend Project Structure"
Cohesion: 0.18
Nodes (12): CORS Configuration, POST /api/scan Endpoint, extract_metadata Function, File Scanner (file_scanner.py), scan_folder Function, Backend Implementation Phases, Backend Project Structure, database.py Module (+4 more)

### Community 9 - "songs.py, songs.py"
Cohesion: 0.42
Nodes (9): create_song(), delete_song(), get_song(), _get_utc_now(), list_songs(), serve_album_art(), song_row_to_dict(), stream_song() (+1 more)

### Community 10 - "Aurora Color Palette (CSS Tokens), shadcn/ui Theme Override"
Cohesion: 0.22
Nodes (9): Shadcn-Aurora Token Bridge Table, Token Naming Migration v1 to v2, shadcn/ui Setup, C1: Two Teal Token Rename, C4: Text Token Canonical Names, C5: Dead Token Deletion, C6: Shadcn Light Theme Delete + Bridge Table, Aurora Color Palette (CSS Tokens) (+1 more)

### Community 11 - "dropdown-menu.tsx, dropdown-menu.tsx"
Cohesion: 0.48
Nodes (5): cn(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuPortal(), DropdownMenuTrigger()

### Community 12 - "popover.tsx, popover.tsx"
Cohesion: 0.48
Nodes (5): cn(), Popover(), PopoverDescription(), PopoverTitle(), PopoverTrigger()

### Community 13 - "albumGradient(), AlbumArt()"
Cohesion: 0.38
Nodes (3): AlbumArt(), albumGradient(), hashString()

### Community 14 - "table.tsx, table.tsx"
Cohesion: 0.53
Nodes (4): cn(), Table(), TableBody(), TableHeader()

### Community 15 - "ApiError, api.ts"
Cohesion: 0.47
Nodes (3): ApiError, request(), uploadRequest()

### Community 16 - "Fraunces Variable Font Loading, index.html Entry Point"
Cohesion: 0.33
Nodes (6): Fraunces Variable Font Loading, index.html Entry Point, Dark Class on html Element, C9: Fraunces Self-Hosting Decision, Dark Mode Only Rule, Typography System (Outfit + Geist)

### Community 17 - "alert-dialog.tsx, alert-dialog.tsx"
Cohesion: 0.6
Nodes (3): AlertDialogPortal(), AlertDialogTrigger(), cn()

### Community 18 - "command.tsx, command.tsx"
Cohesion: 0.6
Nodes (3): cn(), CommandGroup(), CommandItem()

### Community 19 - "filterStore.ts, filterStore.ts"
Cohesion: 0.6
Nodes (3): filterResultToSong(), friendlyFilterError(), shuffleArray()

### Community 20 - "App(), App.tsx"
Cohesion: 0.4
Nodes (1): App()

### Community 21 - "QueryInput.tsx, QueryInput.tsx"
Cohesion: 0.67
Nodes (2): handleKeyDown(), validateQuery()

### Community 22 - "EditSongDialog.tsx, handleAddToPlaylist()"
Cohesion: 0.67
Nodes (2): handleAddToPlaylist(), handleSubmit()

### Community 23 - "Alert(), cn()"
Cohesion: 0.67
Nodes (2): Alert(), cn()

### Community 24 - "hashString(), playlistThumbnail()"
Cohesion: 0.83
Nodes (2): hashString(), playlistThumbnail()

### Community 25 - "utils.ts, utils.ts"
Cohesion: 0.67
Nodes (2): cn(), formatDuration()

### Community 26 - "Sidebar.tsx, Sidebar.tsx"
Cohesion: 0.67
Nodes (2): handleTagClick(), isActive()

### Community 27 - "Aurora backend entry point., run.py"
Cohesion: 0.67
Nodes (1): Aurora backend entry point.

### Community 28 - "handlePlaySong(), QueryBuilder.tsx"
Cohesion: 0.67
Nodes (1): handlePlaySong()

### Community 29 - "handleFileChange(), PlaylistImagePicker.tsx"
Cohesion: 0.67
Nodes (1): handleFileChange()

### Community 30 - "TableHeader(), SongTable.tsx"
Cohesion: 0.67
Nodes (1): TableHeader()

### Community 31 - "TagChip(), TagChip.tsx"
Cohesion: 0.67
Nodes (1): TagChip()

### Community 32 - "cn(), dialog.tsx"
Cohesion: 0.67
Nodes (1): cn()

### Community 33 - "Equalizer(), Equalizer.tsx"
Cohesion: 0.67
Nodes (1): Equalizer()

### Community 34 - "cn(), input-group.tsx"
Cohesion: 0.67
Nodes (1): cn()

### Community 35 - "Skeleton(), skeleton.tsx"
Cohesion: 0.67
Nodes (1): Skeleton()

### Community 36 - "cn(), textarea.tsx"
Cohesion: 0.67
Nodes (1): cn()

### Community 37 - "ToastClickDismiss(), ToastClickDismiss.tsx"
Cohesion: 0.67
Nodes (1): ToastClickDismiss()

### Community 38 - "useAudioPlayer(), useAudioPlayer.ts"
Cohesion: 0.67
Nodes (1): useAudioPlayer()

### Community 39 - "FastAPI 0.115.12, Uvicorn 0.34.2"
Cohesion: 1.0
Nodes (2): FastAPI 0.115.12, Uvicorn 0.34.2

### Community 40 - "@/ Path Alias, Vite Configuration"
Cohesion: 1.0
Nodes (2): @/ Path Alias, Vite Configuration

### Community 41 - "Disabled State Three-Tier System, C3: Disabled Opacity Three-Tier System"
Cohesion: 1.0
Nodes (2): Disabled State Three-Tier System, C3: Disabled Opacity Three-Tier System

### Community 42 - "Canonical Focus Ring (.aurora-focus), C2: Focus Ring Canonical Treatment"
Cohesion: 1.0
Nodes (2): Canonical Focus Ring (.aurora-focus), C2: Focus Ring Canonical Treatment

### Community 81 - "Supported Audio Extensions"
Cohesion: 1.0
Nodes (1): Supported Audio Extensions

### Community 82 - "Frontend Project Structure"
Cohesion: 1.0
Nodes (1): Frontend Project Structure

### Community 83 - "Store Design Principles"
Cohesion: 1.0
Nodes (1): Store Design Principles

### Community 84 - "Aurora Session 4 Handoff"
Cohesion: 1.0
Nodes (1): Aurora Session 4 Handoff

### Community 85 - "PlayerBar Bugs (Session 4)"
Cohesion: 1.0
Nodes (1): PlayerBar Bugs (Session 4)

### Community 86 - "Future Features (Electron, Crossfade, Lyrics)"
Cohesion: 1.0
Nodes (1): Future Features (Electron, Crossfade, Lyrics)

### Community 87 - "Aurora Known Gaps and Bugs"
Cohesion: 1.0
Nodes (1): Aurora Known Gaps and Bugs

### Community 88 - "Aurora Quick Start (Backend + Frontend)"
Cohesion: 1.0
Nodes (1): Aurora Quick Start (Backend + Frontend)

### Community 89 - "Frontend Vite + React Template README"
Cohesion: 1.0
Nodes (1): Frontend Vite + React Template README

## Knowledge Gaps
- **110 isolated node(s):** `Get a database connection with row_factory set to sqlite3.Row.`, `Initialize the database — create tables if they don't exist.`, `Extract and store album art for any songs missing it. Runs once per song.`, `Request body for POST /scan.`, `Response body for POST /scan.` (+105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App(), App.tsx`** (5 nodes): `App()`, `App.tsx`, `main.tsx`, `App.tsx`, `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `QueryInput.tsx, QueryInput.tsx`** (4 nodes): `QueryInput.tsx`, `QueryInput.tsx`, `handleKeyDown()`, `validateQuery()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `EditSongDialog.tsx, handleAddToPlaylist()`** (4 nodes): `EditSongDialog.tsx`, `handleAddToPlaylist()`, `handleSubmit()`, `EditSongDialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Alert(), cn()`** (4 nodes): `Alert()`, `cn()`, `alert.tsx`, `alert.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `hashString(), playlistThumbnail()`** (4 nodes): `playlistImage.ts`, `playlistImage.ts`, `hashString()`, `playlistThumbnail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `utils.ts, utils.ts`** (4 nodes): `utils.ts`, `utils.ts`, `cn()`, `formatDuration()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar.tsx, Sidebar.tsx`** (4 nodes): `Sidebar.tsx`, `Sidebar.tsx`, `handleTagClick()`, `isActive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Aurora backend entry point., run.py`** (3 nodes): `run.py`, `run.py`, `Aurora backend entry point.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `handlePlaySong(), QueryBuilder.tsx`** (3 nodes): `QueryBuilder.tsx`, `QueryBuilder.tsx`, `handlePlaySong()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `handleFileChange(), PlaylistImagePicker.tsx`** (3 nodes): `PlaylistImagePicker.tsx`, `PlaylistImagePicker.tsx`, `handleFileChange()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TableHeader(), SongTable.tsx`** (3 nodes): `SongTable.tsx`, `SongTable.tsx`, `TableHeader()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TagChip(), TagChip.tsx`** (3 nodes): `TagChip.tsx`, `TagChip.tsx`, `TagChip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cn(), dialog.tsx`** (3 nodes): `dialog.tsx`, `cn()`, `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Equalizer(), Equalizer.tsx`** (3 nodes): `Equalizer.tsx`, `Equalizer()`, `Equalizer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cn(), input-group.tsx`** (3 nodes): `input-group.tsx`, `input-group.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Skeleton(), skeleton.tsx`** (3 nodes): `skeleton.tsx`, `skeleton.tsx`, `Skeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `cn(), textarea.tsx`** (3 nodes): `textarea.tsx`, `textarea.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ToastClickDismiss(), ToastClickDismiss.tsx`** (3 nodes): `ToastClickDismiss.tsx`, `ToastClickDismiss.tsx`, `ToastClickDismiss()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `useAudioPlayer(), useAudioPlayer.ts`** (3 nodes): `useAudioPlayer.ts`, `useAudioPlayer.ts`, `useAudioPlayer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `FastAPI 0.115.12, Uvicorn 0.34.2`** (2 nodes): `FastAPI 0.115.12`, `Uvicorn 0.34.2`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `@/ Path Alias, Vite Configuration`** (2 nodes): `@/ Path Alias`, `Vite Configuration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Disabled State Three-Tier System, C3: Disabled Opacity Three-Tier System`** (2 nodes): `Disabled State Three-Tier System`, `C3: Disabled Opacity Three-Tier System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Canonical Focus Ring (.aurora-focus), C2: Focus Ring Canonical Treatment`** (2 nodes): `Canonical Focus Ring (.aurora-focus)`, `C2: Focus Ring Canonical Treatment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supported Audio Extensions`** (1 nodes): `Supported Audio Extensions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Project Structure`** (1 nodes): `Frontend Project Structure`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Store Design Principles`** (1 nodes): `Store Design Principles`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Aurora Session 4 Handoff`** (1 nodes): `Aurora Session 4 Handoff`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PlayerBar Bugs (Session 4)`** (1 nodes): `PlayerBar Bugs (Session 4)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Future Features (Electron, Crossfade, Lyrics)`** (1 nodes): `Future Features (Electron, Crossfade, Lyrics)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Aurora Known Gaps and Bugs`** (1 nodes): `Aurora Known Gaps and Bugs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Aurora Quick Start (Backend + Frontend)`** (1 nodes): `Aurora Quick Start (Backend + Frontend)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Vite + React Template README`** (1 nodes): `Frontend Vite + React Template README`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_db()` connect `get_db(), SongResponse` to `songs.py, songs.py`, `file_scanner.py, file_scanner.py`, `filter_songs(), filter_engine.py`, `init_db(), _backfill_album_art()`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `scan_folder()` connect `file_scanner.py, file_scanner.py` to `get_db(), SongResponse`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `get_db()` (e.g. with `health_check()` and `filter_endpoint()`) actually correct?**
  _`get_db()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `SongResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`SongResponse` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `PlaylistResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`PlaylistResponse` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Get a database connection with row_factory set to sqlite3.Row.`, `Initialize the database — create tables if they don't exist.`, `Extract and store album art for any songs missing it. Runs once per song.` to the rest of the system?**
  _110 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Aurora Aesthetic Audit (2026-05-05), PlayerBar.tsx â€” Persistent Bottom Player Bar` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._