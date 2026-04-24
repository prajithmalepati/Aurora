# Aurora Product Completeness Audit — Session 15

**Date:** 2026-04-23
**Scope:** Read-only product gap analysis across data, API, and UI layers.
**Target user:** Music hoarder with a large local library organizing files they own by tags, playlists, and boolean filters.
**Method:** Walked `backend/app/models.py`, `database.py`, `services/`, `routers/`, and every component in `frontend/src/`. Gap = capability exists in data or API but unreachable in UI, OR capability is standard in the category but absent at all three layers.

---

## TL;DR — The Shape of the Gap

Aurora's backend and UI are cleanly built but the **surface area** a music hoarder needs is thin. The boolean filter (Mix), tag editor, playlist management, and format-aware scanner are all real. Almost everything else a user with thousands of files would reach for — sort, multi-select, queue visibility, right-click, song details, recently played, import/export, settings — is **not implemented at any layer**.

Three findings stand out:

1. **Two features are wired at the data/API layer but dead at the UI layer:** (a) `addSongToPlaylist` exists in the playlist store but no component ever calls it, so there is no path to add a song to a playlist from anywhere in the app except the scanner's auto-create option; (b) `EditSongDialog` is a fully implemented component but no component renders it — the "Edit song" pencil icon in [SongRow.tsx:241-247](frontend/src/components/songs/SongRow.tsx#L241-L247) has only `e.stopPropagation()` as its handler.
2. **The queue is invisible.** It exists in `playerStore.queue` but there is no UI to view, reorder, clear, or add to it.
3. **Derived views don't exist.** No "recently played," no "recently added," no "most played" — the data model has no `play_count` or `last_played_at` column, so even backfilling would require a scan.

---

## Layer 1 — Data Model

Schema from [backend/app/database.py](backend/app/database.py):

| Table | Columns of note |
|---|---|
| `songs` | `id, title, artist, album, duration, file_path (UNIQUE), source, external_id, file_format, album_art_path, created_at, updated_at` |
| `playlists` | `id, name (UNIQUE), color, emoji, image_url, created_at, updated_at` |
| `tags` | `id, name (UNIQUE), created_at` |
| `playlist_songs` | `playlist_id, song_id, position, added_at, UNIQUE(playlist_id, song_id)` |
| `song_tags` | `song_id, tag_id, UNIQUE(song_id, tag_id)` |

Indexes: `songs.title`, `songs.artist`, `songs.source`, `tags.name`, join columns on the two link tables.

**Missing columns that block standard features:**

- No `play_count`, no `last_played_at` → no "Most played," no "Recently played."
- No `rating` / `loved` → no starring or favorites beyond playlists.
- No `bitrate`, no `sample_rate`, no `bit_depth` (metadata captured by mutagen but discarded) → can't surface audio quality beyond the format tag.
- No `year`, no `genre`, no `track_number`, no `disc_number`, no `album_artist`, no `composer`, no `bpm` → no standard library facets; tags have to substitute for everything.
- No `file_size`, no `file_mtime` → can't detect files that moved or changed, can't show library size.
- No `lyrics` column.
- No `disabled_at` / `missing_at` / soft-delete flag → deleted songs are gone; no undo, no recycle bin.
- No per-playlist-song `start_time_ms` / `end_time_ms` (flagged in HANDOFF.md Next Steps but not present).

**Scanner behavior** ([file_scanner.py](backend/app/services/file_scanner.py)): format-aware dedup works correctly (FLAC replaces MP3, tags/playlists migrate via SAVEPOINT). But:
- No watch-folder / incremental rescan. Each scan walks the whole tree.
- No missing-file detection. If a scanned file is deleted on disk the song row stays and `/stream` returns 404 at play time.
- Errors list is returned but not surfaced in any persistent log.

---

## Layer 2 — API

Endpoints (grouped):

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Counts |
| GET | `/api/songs` | `?search=`, `?limit=`, `?offset=`. Hard-coded `ORDER BY title ASC`. |
| GET | `/api/songs/{id}` | |
| GET | `/api/songs/{id}/stream` | `FileResponse`, no `Range` header handled explicitly (FastAPI `FileResponse` does handle it, but there's no test). |
| POST | `/api/songs` | Manual create only |
| PUT | `/api/songs/{id}` | |
| DELETE | `/api/songs/{id}` | Hard delete |
| GET | `/api/album-art/{filename}` | Path-traversal-guarded |
| GET | `/api/tags` | Always `ORDER BY name ASC` |
| POST | `/api/tags` | |
| DELETE | `/api/tags/{id}` | |
| POST | `/api/songs/{id}/tags` | Bulk assign via `tag_names[]` |
| DELETE | `/api/songs/{id}/tags/{tag_id}` | |
| GET | `/api/playlists` | Always `ORDER BY name ASC` |
| POST/PUT/DELETE | `/api/playlists[/{id}]` | |
| PUT/DELETE | `/api/playlists/{id}/image` | |
| POST | `/api/playlists/{id}/songs` | Add one song |
| DELETE | `/api/playlists/{id}/songs/{song_id}` | |
| PUT | `/api/playlists/{id}/songs/reorder` | Takes full `song_ids[]` |
| POST | `/api/filter` | Body `{query}` |
| POST | `/api/scan` | Body `{folder_path, playlist_name?}` |

**API-level gaps:**

- **Search is partial.** `GET /songs?search=` searches only `title` and `artist` ([songs.py:97](backend/app/routers/songs.py#L97)). It does not search `album`, `file_path`, or tags.
- **No sort parameter on any list endpoint.** `ORDER BY` is hard-coded. A user with 10,000 songs cannot change the sort without editing SQL.
- **No batch endpoints.** Every tag assign/remove, playlist add/remove, delete is one-at-a-time. Tagging 50 songs with `chill` is 50 round-trips (bulk assign at least accepts an array of tag names for one song, but not an array of songs).
- **No "add multiple songs to playlist" endpoint.** `POST /playlists/{id}/songs` takes exactly one `song_id`.
- **No library stats endpoint** beyond `/health` (which counts three tables).
- **No playlist-song endpoint with filter/sort.** The playlist detail returns everything, sorted only by position.
- **Filter engine is case-sensitive** (known bug, flagged in HANDOFF.md and `features.json` f001). `rock` returns nothing, `Rock` works. Actually re-reading [filter_engine.py:24](backend/app/services/filter_engine.py#L24) shows `quoted_tags[placeholder] = match.group(1).strip().lower()` for quoted strings and [filter_engine.py:79](backend/app/services/filter_engine.py#L79) does `symbol_name.strip().lower()`, so the symbol side is already lowered. The tag set from `build_tag_set` is also lowered. The bug may in fact be already fixed by recent edits; still listed in features.json as pending — worth spot-checking manually.
- **CORS is wide open** for local dev ports; no auth anywhere. Not a gap for a personal app, just noting.

---

## Layer 3 — UI

Files walked: [App.tsx](frontend/src/App.tsx), [Sidebar.tsx](frontend/src/components/layout/Sidebar.tsx), [PlayerBar.tsx](frontend/src/components/layout/PlayerBar.tsx), [SongTable.tsx](frontend/src/components/songs/SongTable.tsx), [SongRow.tsx](frontend/src/components/songs/SongRow.tsx), [PlaylistDetail.tsx](frontend/src/components/playlists/PlaylistDetail.tsx), [QueryBuilder.tsx](frontend/src/components/filter/QueryBuilder.tsx), [TagEditor.tsx](frontend/src/components/tags/TagEditor.tsx), [ScanDialog.tsx](frontend/src/components/scanner/ScanDialog.tsx), [EditSongDialog.tsx](frontend/src/components/songs/EditSongDialog.tsx), all stores and the `useAudioPlayer` hook.

**Top-level structure:** three views — `all-songs`, `filter` (Mix), `playlist`. Sidebar lists playlists and tags. PlayerBar is fixed at bottom. No other views exist (no Queue, no Settings, no Now Playing, no Recently Played, no History, no Library Stats, no search across all entities).

The categorical audit below uses this classification: **DONE** = reaches the user and works; **PARTIAL** = half-built or present at only some layers; **MISSING** = not implemented.

---

### Sort
**MISSING** at the UI level. **MISSING** at the API level (no `sort`/`order` query param on any endpoint). Backend hard-codes `ORDER BY s.title ASC` in `GET /songs` ([songs.py:104](backend/app/routers/songs.py#L104)), `ORDER BY t.name ASC` for tags, `ORDER BY p.name ASC` for playlists, `ORDER BY ps.position ASC` inside a playlist, and filter results sort by `title` in Python ([filter_engine.py:165](backend/app/services/filter_engine.py#L165)).

The song table headers in [SongTable.tsx:16-29](frontend/src/components/songs/SongTable.tsx#L16-L29) are plain `<th>` labels with no click handlers, no sort arrows, no sort state. For a user with a four-digit library, the inability to sort by artist, album, duration, format, or recently-added is the single most striking gap.

### Search
**PARTIAL.**
- All Songs page has a global search input ([App.tsx:161-168](frontend/src/App.tsx#L161-L168)) that hits `GET /songs?search=` with a 300ms debounce. Only `title` and `artist` are queried server-side. Album, file path, and tags are not searchable this way.
- Playlist detail has a client-side search over `title` and `artist` only ([PlaylistDetail.tsx:64-73](frontend/src/components/playlists/PlaylistDetail.tsx#L64-L73)).
- Mix (QueryBuilder) is not a free-text search — it's a boolean tag expression evaluator.
- **No global search across songs/tags/playlists.** `/` focuses the Mix query bar only.
- **No autocomplete / no fuzzy search.** The `features.json` noted this as a known gap.
- **No search scoped to a single tag** — clicking a tag filters to it, but there is no additional in-results search field.

### Filter (beyond QueryBuilder)
**MINIMAL.**
- The boolean QueryBuilder is the only filtering mechanism. It is powerful but requires typing expressions.
- **No quick filters** (e.g., "only files missing tags," "only FLAC," "only from artist X").
- **No saved filters / named searches.** The user cannot name and persist "my workout mix" as a saved query — they must retype.
- **No filter chips with remove-individually UX** inside Mix. The query bar is one text blob.
- **Clear-all is there** ([QueryBuilder.tsx:154-159](frontend/src/components/filter/QueryBuilder.tsx#L154-L159)).
- **No negative filters** in the UI beyond `NOT` in text. E.g., no "show songs with 0 tags" one-click filter.

### Bulk operations
**MISSING** at every layer.
- `<tr>` rows in [SongRow.tsx](frontend/src/components/songs/SongRow.tsx) have no checkbox, no shift-click selection, no selection state in any store.
- No "selected" state anywhere. Search, Mix, Playlist detail are all single-select (the row click plays that song).
- No bulk tag, bulk add-to-playlist, bulk delete, bulk move.
- API also lacks bulk endpoints (see Layer 2).

For a hoarder who just scanned 500 new files and wants to tag all of them `soundtrack` — there is no path short of opening the tag editor on each row individually.

### Queue management
**MISSING** at the UI layer. **PARTIAL** in data.
- `playerStore.queue: Song[]` and `queueIndex: number` exist ([playerStore.ts:7-9](frontend/src/stores/playerStore.ts#L7-L9)) and are updated by `playSong`, `next`, `previous`.
- No UI component renders the queue. No "queue view," no "up next," no reorder.
- **No add-to-queue, no add-next, no clear queue, no shuffle queue.**
- `jamFilter` and `shuffleAndJamFilter` build the queue from filter results ([filterStore.ts:140-183](frontend/src/stores/filterStore.ts#L140-L183)) but once playing, the queue is a black box.
- Shuffle is pre-play only (via Shuffle-Jam). No mid-playback shuffle toggle.
- No repeat modes (repeat one, repeat all, no repeat).

### Playback affordances
**PARTIAL.**
- **Keyboard shortcuts:** Space, ArrowLeft, ArrowRight, M, /, Escape ([App.tsx:79-120](frontend/src/App.tsx#L79-L120)). No shortcut for volume up/down, no shortcut for shuffle/repeat (which don't exist anyway), no shortcut to open a playlist or jump to Mix.
- **Media keys / MediaSession API:** NOT IMPLEMENTED. A grep for `mediaSession` returns zero hits. Hardware play/pause buttons, OS media overlays, and lock-screen controls will not work.
- **Mini-player:** The PlayerBar is the only player surface. No Picture-in-Picture, no pop-out, no detached window.
- **Now Playing detail view:** NOT IMPLEMENTED. Clicking the song title in PlayerBar does nothing. There's no full-screen "now playing" screen.
- **Scrobble / play count:** NOT IMPLEMENTED. No `played_at` write on song start/end, no Last.fm/scrobble hook.
- **Wake Lock:** implemented ([App.tsx:56-76](frontend/src/App.tsx#L56-L76)).
- **Crossfade / gapless:** NOT IMPLEMENTED (flagged as Next Steps in HANDOFF.md).
- **Volume boost / ReplayGain / normalization:** NOT IMPLEMENTED.
- **Equalizer (audio, not visual):** NOT IMPLEMENTED. The `Equalizer` component is a visual indicator only.

### Context menus
**MISSING.** No `onContextMenu` handler anywhere in `frontend/src`. Right-click on a song, playlist, or tag does nothing but show the browser's default menu. For a library app, this is where most users expect: Play, Play Next, Add to Queue, Add to Playlist, Copy file path, Show in Folder, Edit Tags, Edit Song, Delete.

### Drag and drop
**MISSING.** Only a single `draggable={false}` hit on `<img>` in AlbumArt (to prevent image-drag UX glitches). There is no drag-and-drop for:
- Reordering playlists in the sidebar.
- Dragging songs into playlists.
- Reordering songs inside a playlist (up/down buttons exist in [PlaylistDetail.tsx:646-665](frontend/src/components/playlists/PlaylistDetail.tsx#L646-L665) but clicking 20 times to move a song from position 25 to position 5 is punishing).
- Dragging songs into the queue.
- Dragging a folder onto the app to trigger a scan.

### Song detail view
**MISSING.**
- No route, component, or modal for "show everything about this song." The user can see title, artist, tags, duration, format, and the playlists the song appears in (Playlists column in [SongRow.tsx:180-206](frontend/src/components/songs/SongRow.tsx#L180-L206)).
- **Not shown anywhere:** album, file path, file size, bitrate, created_at, updated_at, source ("manual" vs "local_scan"), external_id.
- **Edit song is wired to a dead button.** `EditSongDialog.tsx` exists and is fully implemented but no component renders `<EditSongDialog>`. The pencil icon in [SongRow.tsx:241-247](frontend/src/components/songs/SongRow.tsx#L241-L247) has only `e.stopPropagation()` as its onClick handler. **Clicking it does literally nothing.**
- **Add-to-playlist is also dead.** `playlistStore.addSongToPlaylist` is implemented and has a toast, but a grep across all components shows zero callers. There is no button, context menu item, or drag target to add a song to a playlist from the UI. Playlists are only populated by `ScanDialog` (auto-create with scanned songs) or by the route auto-adding on creation. **A user cannot add an existing song to an existing playlist.**

### Empty states
**PARTIAL.**
- All Songs empty: "Nothing here yet / Scan a folder or add a song" ([SongTable.tsx:75-91](frontend/src/components/songs/SongTable.tsx#L75-L91)).
- Mix empty (before search): "Build a query above" ([QueryBuilder.tsx:277-286](frontend/src/components/filter/QueryBuilder.tsx#L277-L286)).
- Mix empty (after search): aurora-wave SVG + "No songs match this query" ([QueryBuilder.tsx:339-383](frontend/src/components/filter/QueryBuilder.tsx#L339-L383)).
- Playlist empty: "This playlist is empty" ([PlaylistDetail.tsx:360-365](frontend/src/components/playlists/PlaylistDetail.tsx#L360-L365)).
- Playlist search no-match: "No songs match \"query\"" ([PlaylistDetail.tsx:366-371](frontend/src/components/playlists/PlaylistDetail.tsx#L366-L371)).
- Sidebar playlists empty: "No playlists yet" ([Sidebar.tsx:110-115](frontend/src/components/layout/Sidebar.tsx#L110-L115)).
- Sidebar tags empty: "No tags yet" ([Sidebar.tsx:148-153](frontend/src/components/layout/Sidebar.tsx#L148-L153)).

**What's missing:**
- First-run / onboarding state. On first launch, a brand-new user gets the All Songs "Nothing here yet" card. No guided setup, no CTA to scan.
- Empty playlist offers no "Add songs" action button — just a dead message. (Partly because the add-to-playlist affordance doesn't exist.)

### Error states
**PARTIAL.**
- `ErrorBoundary` wraps main content ([App.tsx:190](frontend/src/App.tsx#L190)).
- Toasts fire on most mutation errors.
- Filter syntax errors show friendly messages ([filterStore.ts:56-75](frontend/src/stores/filterStore.ts#L56-L75)).

**What's missing:**
- **Backend unreachable:** no banner, no "disconnected" state. The first failed `api.get` just flips a `loading: false` with `error: "TypeError: fetch failed"` into the store and silently stays empty. The user sees an empty All Songs view indistinguishable from a fresh install.
- **Missing file on disk:** `GET /songs/{id}/stream` returns 404 "Audio file not found on disk" ([songs.py:248-249](backend/app/routers/songs.py#L248-L249)). The frontend Howler error handler logs to console only — no user-visible toast, no "file missing" indicator on the song row, no way to relink or remove broken entries.
- **Corrupt metadata:** `scan_folder` collects errors into a list; `ScanDialog` displays them in the scan result, but there is no persistent "songs with scan errors" view.
- **Audio decode failure:** `onloaderror` / `onplayerror` in `useAudioPlayer.ts:70-75` only `console.error`. User has no idea why nothing is playing.
- **No retry affordance** for any failed operation.

### Undo / recovery
**MISSING.**
- Delete a playlist: gone. No "undo" toast, no trash folder, no recently-deleted view.
- Delete a song: the song row is removed, all its tag assignments and playlist memberships go with it via CASCADE. No recovery.
- Remove a song from a playlist: silently removes; no undo. Toast says "Song removed from playlist" but offers no action.
- Clear tags / bulk tag changes aren't possible anyway, so nothing to undo.
- Accidental playlist rename: no revision history.
- Sonner toasts have an action-button slot. Aurora never uses it.

### Settings
**NOT IMPLEMENTED.**
- No settings view, no preferences dialog, no `/settings` route.
- Library path is implicit (the folder the user typed in `ScanDialog`); no way to see, change, or list previously scanned folders.
- No way to trigger a rescan from the UI without retyping the folder path. No folder-watcher.
- No theme toggle (dark-only is a stated rule, but also no accent-color chooser, font-size slider, etc.).
- No audio settings — no default volume persistence, no crossfade toggle, no output device selection, no gapless toggle.
- No keyboard shortcut cheat sheet in the UI (shortcuts exist only in the HANDOFF docs).
- No "About" / version info surface.

### Recently played / most played / recently added
**NOT IMPLEMENTED AT ANY LAYER.**
- Data: no `play_count`, no `played_at` history table, no `last_played_at` column.
- API: no `GET /songs/recent`, no `/songs/top`, no `/history`.
- UI: no sidebar section, no derived view.
- `created_at` exists on every row, so "Recently added" is the one that could be built cheaply — but it's not exposed.

### Import / Export
**NOT IMPLEMENTED AT ANY LAYER.**
- No M3U/M3U8 export of playlists. This is the single most expected feature for a desktop music app, and it's nowhere.
- No M3U/M3U8 import.
- No JSON export of the library (songs + tags + playlists).
- No CSV export of the library.
- No database backup/restore UI (the `.bak` files in `backend/` are manual copies the user makes).
- No Spotify/Apple-Music playlist import.

---

## Other noteworthy gaps

Things that don't map cleanly to the categories above but are worth flagging:

- **Tag rename is impossible.** `POST /api/tags` creates; `DELETE /api/tags/{id}` deletes. There is no `PUT /api/tags/{id}`. If the user types `elecronic` instead of `electronic` on 100 songs, they must delete the tag (losing all associations) and re-tag every song.
- **Tag merge is impossible.** If the user accidentally created both `hip-hop` and `hiphop`, there's no way to merge them.
- **Orphan tag cleanup is manual.** Tags persist after their last song is removed. No "delete unused tags" action.
- **Playlist color is settable but barely used.** Only a 5px dot in SongRow's Playlists column and a whisper in the hero gradient.
- **No artist view / album view.** A music hoarder expects "click an artist name, see all their songs." Clicking the artist in SongRow does nothing — it's inside the row's `onClick` (play) handler.
- **No play-from-row-position continuation.** Playing song #5 in a playlist sets `queueIndex=4`, but if the user switches to All Songs and plays something else, the original queue context is lost — there is no "return to playlist" or breadcrumb.
- **Favorites / Loved / Starred:** Not implemented. The user can make a playlist called "Favorites" but there's no heart icon, no quick-toggle affordance on a row.
- **Replace file / relink:** If a file moves on disk, the only fix is to re-scan (which will import it as a duplicate) then delete the original row. No "this song's file is missing — relink to…" flow.
- **The "Add Song" manual form** ([AddSongDialog.tsx](frontend/src/components/songs/AddSongDialog.tsx)) accepts title/artist/album/duration but **not** `file_path`, despite `SongCreate` accepting it ([models.py:8-13](backend/app/models.py#L8-L13)). So manual entries are always metadata-only (unplayable).
- **Toast success on Scan is useful but not persistent.** A user who scanned 500 songs and dismissed the toast has no log to return to. The ScanDialog's errors list is only shown while the dialog is open.

---

## Suggested priority order (from a music hoarder's perspective)

These are ordered by "how badly does the app feel broken without this" for the stated user:

1. **Wire up the dead affordances.** Edit song button and add-to-playlist — the code exists. This is the lowest-effort highest-value fix.
2. **Column sort on the song table.** Title/Artist/Album/Duration/Date Added/Format. Needs API `sort` param + UI click handlers on `<th>`.
3. **Add-to-playlist from a row.** Either a context menu, a "+" icon, or drag-and-drop. Blocks organization of an existing library.
4. **Multi-select + bulk tag / bulk add-to-playlist.** After a 500-file scan, the user wants to tag all of them at once.
5. **Queue view.** At minimum, a side panel showing the current queue with next/previous context. Ideally reorder + clear.
6. **Missing-file handling.** Either a "broken" indicator on rows, or a "broken files" sidebar item, or a scan option to find them.
7. **Recently added / sort-by-created_at.** Free from existing data, high value.
8. **Tag rename + merge endpoints.**
9. **M3U export of a playlist.** One endpoint + one button.
10. **Now Playing detail view** (click song title in PlayerBar → full-screen art, metadata, tags, "more from this artist").
11. **MediaSession API integration** (media keys, OS overlays). ~20 lines of code, standard hook.
12. **Play count + last played.** Requires a schema migration and a "song started" write in `useAudioPlayer`.
13. **Saved filters.** Turn Mix queries into named, sidebar-accessible entries.
14. **Settings view** (rescan, library folders, audio prefs, shortcut help).
15. **Context menus** on rows, playlists, tags.
16. **Drag-and-drop** for playlist reorder and song-into-playlist.
17. **Undo toasts** for delete actions (the infra is in `sonner`).

Items 1–4 would transform Aurora from "looks polished, feels read-only for organizing" into "usable library manager." Items 5–9 close the rest of the basic-expectation gap. Items 10+ are where polish lives.
