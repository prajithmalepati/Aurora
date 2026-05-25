# Graph Report - Aurora  (2026-05-24)

## Corpus Check
- 66 files · ~117,002 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 444 nodes · 576 edges · 51 communities detected
- Extraction: 71% EXTRACTED · 29% INFERRED · 0% AMBIGUOUS · INFERRED: 165 edges (avg confidence: 0.61)
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
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]

## God Nodes (most connected - your core abstractions)
1. `get_db()` - 27 edges
2. `SongResponse` - 26 edges
3. `PlaylistResponse` - 17 edges
4. `Aurora Aesthetic Audit (2026-05-05)` - 15 edges
5. `PlaylistCreate` - 13 edges
6. `PlaylistUpdate` - 13 edges
7. `PlaylistSongAdd` - 13 edges
8. `PlaylistReorder` - 13 edges
9. `Filter Engine (filter_engine.py)` - 13 edges
10. `Quick Wins Build Spec (7 Fixes, 5 Commits)` - 12 edges

## Surprising Connections (you probably didn't know these)
- `filterStore (Filter Query, Results, Jam)` --conceptually_related_to--> `filter_engine.py â€” Boolean Filter Parser`  [INFERRED]
  CLAUDE.md → backend/app/services/filter_engine.py
- `playlistStore (Playlists, Playlist Songs)` --conceptually_related_to--> `PlaylistDetail.tsx â€” Playlist Hero + Song List`  [INFERRED]
  CLAUDE.md → frontend/src/components/playlists/PlaylistDetail.tsx
- `songStore (Songs, View Routing, CRUD)` --conceptually_related_to--> `SongRow.tsx â€” Song Table Row Component`  [INFERRED]
  CLAUDE.md → frontend/src/components/songs/SongRow.tsx
- `tagStore (Tags List, Tag Assignment)` --conceptually_related_to--> `TagEditor.tsx â€” Edit Tags Dialog Component`  [INFERRED]
  CLAUDE.md → frontend/src/components/tags/TagEditor.tsx
- `OLED Void as Ground Plane` --semantically_similar_to--> `Northern Lights Over OLED Black Design System`  [INFERRED] [semantically similar]
  docs/design-system.md → HANDOFF.md

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

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (64): POST /api/filter Endpoint, Playlists CRUD Endpoints, Songs CRUD Endpoints, Tags CRUD Endpoints, Session 15 Completeness Audit, Dead Affordances (EditDialog + addToPlaylist), MediaSession API Missing, Missing File Handling Gap (+56 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (42): BaseModel, FilterRequest, PlaylistCreate, PlaylistDetailResponse, PlaylistReorder, PlaylistResponse, PlaylistSongAdd, PlaylistUpdate (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (36): _backfill_album_art(), get_db(), init_db(), SQLite database connection and initialization., Extract and store album art for any songs missing it. Runs once per song., Get a database connection with row_factory set to sqlite3.Row., Initialize the database — create tables if they don't exist., filter_endpoint() (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (41): Aurora Aesthetic Audit (2026-05-05), Â§5.2 AlbumArt Bleed Invisibility (HIGH), Â§5.3 AlbumArt Visual Mass Imbalance (HIGH), Â§5.5 All Songs View Findings (HIGH/MEDIUM), Â§5.8 Dialog Italic Register Misapplication (MEDIUM), Â§5.7 Mix Page Button-Tier Rationalisation (HIGH), Â§5.10 Motion â€” Missing Song-Change Moment (MEDIUM), Â§5.1 PlayerBar Idle State Finding (LOW) (+33 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (28): Holistic Audit Design Spec (2026-05-23), Audit Domain Definitions (4 Domains), Agent 1 â€” Glow/Bleed Audit (Sonnet), Agent 2 â€” Animation Audit (Sonnet), Agent 3 â€” Visual Consistency Audit (Sonnet), Agent 4 â€” Workflow Practices Audit (Haiku), Holistic Audit Phase 1 Plan (4 Parallel Agents), Phase 2 Task 1 â€” G-2 Glow Lightness Floor Fix (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (6): handleSubmit(), handleSubmit(), ErrorBoundary, handleScan(), error(), success()

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (14): Aurora Architecture (Backend + Frontend), Aurora Project Overview, filterStore (Filter Query, Results, Jam), graphify Knowledge Graph Integration, playerStore (Current Song, Queue, Playback), playlistStore (Playlists, Playlist Songs), Aurora Development Rules, songStore (Songs, View Routing, CRUD) (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): OLED Black Theme (Session 3), Atmosphere Fixed Content Quiet (Principle 5), Aurora Gradient Definition, Aurora Gradient as Meaning (Principle 2), Historical Design Decisions (Resolved), Muted at Rest Bright on Hover (Principle 3), OLED Void as Ground Plane, Design System Principles (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (12): CORS Configuration, POST /api/scan Endpoint, extract_metadata Function, File Scanner (file_scanner.py), scan_folder Function, Backend Implementation Phases, Backend Project Structure, database.py Module (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (9): Shadcn-Aurora Token Bridge Table, Token Naming Migration v1 to v2, shadcn/ui Setup, C1: Two Teal Token Rename, C4: Text Token Canonical Names, C5: Dead Token Deletion, C6: Shadcn Light Theme Delete + Bridge Table, Aurora Color Palette (CSS Tokens) (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (6): Request body for POST /scan., Response body for POST /scan., Scan a folder for music files and import them into the database., scan_folder(), ScanRequest, ScanResponse

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (7): useAudioPlayer Hook, Howler html5:true Requirement, Rationale: Howler.js for Audio, Rationale: TypeScript for Type Safety, Rationale: Zustand over React Context, Frontend Tech Stack, Audio Stream URL Pattern

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (1): ApiError

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (4): background Property â€” AlbumGradient.background Radial CSS, glow Property â€” AlbumGradient.glow HSLA String, HUES Array (8 Cool-Family Hue Anchors), albumGradient.ts â€” Procedural Gradient Generator

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (2): hashString(), playlistThumbnail()

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (3): Fraunces Variable Font Loading, C9: Fraunces Self-Hosting Decision, Typography System (Outfit + Geist)

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): Aurora backend entry point.

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (2): AlbumArt.tsx â€” Album Art Display Component, file_scanner.py â€” Mutagen + Album Art Extraction

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (2): FastAPI 0.115.12, Uvicorn 0.34.2

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (2): @/ Path Alias, Vite Configuration

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (2): Canonical Focus Ring (.aurora-focus), C2: Focus Ring Canonical Treatment

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (2): Disabled State Three-Tier System, C3: Disabled Opacity Three-Tier System

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (2): Dual Audio Bug Root Cause (isPlaying effect dep), useAudioPlayer Hook (Two-Effect Architecture)

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (1): Sidebar.tsx â€” Nav + Tags + Playlists

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (1): button.tsx â€” Base Button Component (shadcn)

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (1): Button primary Variant (aurora-btn-loud-primary)

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (1): Button destructive Variant (aurora-danger)

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (1): File scanner for audio files using mutagen.

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (1): Extract embedded album art from an audio file and save to art_dir.     Returns

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (1): Mutagen returns tag values as lists. Get first item or None.

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (1): Return quality rank for a file_format string. Higher = better quality.

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (1): Distinguish ALAC from AAC inside an .m4a container by reading MP4Info.codec.

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (1): Extract metadata from an audio file.     Returns dict with title, artist, album

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (1): Recursively scan a folder for audio files.     Returns tuple of (list of metada

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (1): Atomically replace an existing song row with a higher-quality version.     Migr

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (1): Scan folder, import new songs, optionally add to playlist.     Format-aware ded

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (1): Filter engine for boolean tag queries.

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (1): Parse a user query string into a boolean expression.          Handles quoted s

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (1): Build a complete tag set for a song from CSV strings.          Combines explic

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (1): Evaluate whether a song's tag set satisfies the boolean expression.          U

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (1): Main entry point for the filter engine.          1. Parse the query     2. Lo

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (1): Supported Audio Extensions

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (1): Frontend Project Structure

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (1): Store Design Principles

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (1): Dark Mode Only Rule

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (1): Aurora Session 4 Handoff

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (1): PlayerBar Bugs (Session 4)

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (1): Future Features (Electron, Crossfade, Lyrics)

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (1): Aurora Known Gaps and Bugs

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (1): Aurora Quick Start (Backend + Frontend)

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (1): Frontend Vite + React Template README

## Knowledge Gaps
- **136 isolated node(s):** `Aurora backend entry point.`, `SQLite database connection and initialization.`, `Get a database connection with row_factory set to sqlite3.Row.`, `Initialize the database — create tables if they don't exist.`, `Extract and store album art for any songs missing it. Runs once per song.` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (5 nodes): `ApiError`, `.constructor()`, `request()`, `uploadRequest()`, `api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (3 nodes): `playlistImage.ts`, `hashString()`, `playlistThumbnail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `run.py`, `Aurora backend entry point.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `AlbumArt.tsx â€” Album Art Display Component`, `file_scanner.py â€” Mutagen + Album Art Extraction`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `FastAPI 0.115.12`, `Uvicorn 0.34.2`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `@/ Path Alias`, `Vite Configuration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `Canonical Focus Ring (.aurora-focus)`, `C2: Focus Ring Canonical Treatment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `Disabled State Three-Tier System`, `C3: Disabled Opacity Three-Tier System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `Dual Audio Bug Root Cause (isPlaying effect dep)`, `useAudioPlayer Hook (Two-Effect Architecture)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `Sidebar.tsx â€” Nav + Tags + Playlists`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `button.tsx â€” Base Button Component (shadcn)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `Button primary Variant (aurora-btn-loud-primary)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `Button destructive Variant (aurora-danger)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `File scanner for audio files using mutagen.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `Extract embedded album art from an audio file and save to art_dir.     Returns`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `Mutagen returns tag values as lists. Get first item or None.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `Return quality rank for a file_format string. Higher = better quality.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `Distinguish ALAC from AAC inside an .m4a container by reading MP4Info.codec.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `Extract metadata from an audio file.     Returns dict with title, artist, album`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `Recursively scan a folder for audio files.     Returns tuple of (list of metada`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `Atomically replace an existing song row with a higher-quality version.     Migr`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `Scan folder, import new songs, optionally add to playlist.     Format-aware ded`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `Filter engine for boolean tag queries.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `Parse a user query string into a boolean expression.          Handles quoted s`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `Build a complete tag set for a song from CSV strings.          Combines explic`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `Evaluate whether a song's tag set satisfies the boolean expression.          U`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `Main entry point for the filter engine.          1. Parse the query     2. Lo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `Supported Audio Extensions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `Frontend Project Structure`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `Store Design Principles`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `Dark Mode Only Rule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `Aurora Session 4 Handoff`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `PlayerBar Bugs (Session 4)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `Future Features (Electron, Crossfade, Lyrics)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `Aurora Known Gaps and Bugs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `Aurora Quick Start (Backend + Frontend)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `Frontend Vite + React Template README`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get_db()` connect `Community 2` to `Community 1`, `Community 10`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `playerStore (Zustand)` connect `Community 0` to `Community 11`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Filter Engine (filter_engine.py)` connect `Community 0` to `Community 8`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `get_db()` (e.g. with `health_check()` and `filter_endpoint()`) actually correct?**
  _`get_db()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `SongResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`SongResponse` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `PlaylistResponse` (e.g. with `Return current UTC timestamp in ISO format.` and `Upload a cover image for a playlist. Saved to frontend/public/playlist-images/.`) actually correct?**
  _`PlaylistResponse` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Aurora backend entry point.`, `SQLite database connection and initialization.`, `Get a database connection with row_factory set to sqlite3.Row.` to the rest of the system?**
  _136 weakly-connected nodes found - possible documentation gaps or missing edges._