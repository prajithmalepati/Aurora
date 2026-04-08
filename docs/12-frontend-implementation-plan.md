# Aurora — Frontend Implementation Plan
## Document 12 of 12 | Master Task List for Building Aurora's Frontend

---

## How to Use This Document

Same workflow as the backend:

1. Work through phases in order
2. Give Qwen ONE task at a time via Cline
3. Paste the **context docs listed per task** into Cline (not the whole spec)
4. After Qwen completes a task, **open http://localhost:5173 and visually verify**
5. `git add . && git commit -m "Task X.Y: description"` after every task
6. If something breaks, bring it back to Claude for debugging
7. Do NOT let Qwen add features beyond what the task says

---

## Context Docs Quick Reference

| Doc | File | Content |
|-----|------|---------|
| 07 | `07-frontend-project-structure.md` | Tech stack, folder layout, setup commands, Cline rules |
| 08 | `08-frontend-types-api.md` | TypeScript interfaces, API client code |
| 09 | `09-frontend-state-management.md` | All 5 Zustand stores with full code |
| 10 | `10-frontend-components.md` | Every component's behavior, layout, props |
| 11 | `11-frontend-styling.md` | Colors, fonts, theme overrides, UI patterns |
| 02 | `02-api-contract.md` | Backend API endpoints (from backend docs) |
| 03 | `03-filter-engine.md` | Filter syntax reference (from backend docs) |

---

# PRE-PHASE: BACKEND ADDITION

## Task 0.1 — Add audio stream endpoint

**Context:** `02-api-contract.md`

**What to do:** Add `GET /api/songs/{id}/stream` to `backend/app/routers/songs.py`.

1. Look up song by ID → 404 if not found
2. Check `file_path` is not null and file exists on disk → 404 if not
3. Detect MIME type from file extension:
   - `.mp3` → `audio/mpeg`
   - `.flac` → `audio/flac`
   - `.m4a` → `audio/mp4`
   - `.ogg` → `audio/ogg`
   - `.wav` → `audio/wav`
   - `.aac` → `audio/aac`
   - `.opus` → `audio/opus`
4. Return `FileResponse(file_path, media_type=mime)`

```python
from fastapi.responses import FileResponse
from pathlib import Path

MIME_MAP = {
    ".mp3": "audio/mpeg", ".flac": "audio/flac", ".m4a": "audio/mp4",
    ".ogg": "audio/ogg", ".wav": "audio/wav", ".aac": "audio/aac",
    ".wma": "audio/x-ms-wma", ".opus": "audio/opus",
}

@router.get("/songs/{song_id}/stream")
def stream_song(song_id: int):
    db = get_db()
    try:
        row = db.execute("SELECT file_path FROM songs WHERE id = ?", (song_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Song not found")
        if not row["file_path"]:
            raise HTTPException(404, "No audio file available")
        file_path = Path(row["file_path"])
        if not file_path.exists():
            raise HTTPException(404, "Audio file not found on disk")
        mime = MIME_MAP.get(file_path.suffix.lower(), "application/octet-stream")
        return FileResponse(str(file_path), media_type=mime)
    finally:
        db.close()
```

**Test:** In Swagger, try `GET /api/songs/{id}/stream` with a song that has a file_path from a scan. Browser should download/play the file.

**Git commit:** `Task 0.1: Add audio stream endpoint`

---

# PHASE 1: PROJECT SCAFFOLDING

## Task 1.1 — Create and configure the React project

**Context:** `07-frontend-project-structure.md` (entire doc)

**What to do — this is a multi-step setup task. Do each step in order:**

1. **Scaffold Vite project:**
   ```bash
   cd D:\AI\projects2\Aurora
   npm create vite@latest frontend -- --template react-ts
   cd frontend
   npm install
   ```

2. **Install and configure Tailwind CSS v4:**
   ```bash
   npm install -D @tailwindcss/vite @types/node
   ```
   - Update `vite.config.ts` with the tailwind plugin and `@` path alias (exact code in doc 07)
   - Update `tsconfig.json` and `tsconfig.app.json` with path aliases (exact code in doc 07)
   - Replace `src/index.css` with just `@import "tailwindcss";`
   - Delete `src/App.css`

3. **Initialize shadcn/ui:**
   ```bash
   npx shadcn@latest init
   ```
   Choose Neutral base color. Use `--force` if React 19 peer dep issues.

4. **Install all shadcn components we'll need:**
   ```bash
   npx shadcn@latest add button dialog input table alert alert-dialog sonner skeleton slider dropdown-menu popover command
   ```

5. **Install remaining dependencies:**
   ```bash
   npm install zustand howler
   npm install -D @types/howler
   ```

6. **Quick test:** `npm run dev` → open http://localhost:5173 → should see something render with no errors.

**Git commit:** `Task 1.1: Scaffold React project with Tailwind, shadcn/ui, Zustand, Howler`

---

## Task 1.2 — Apply Aurora theme and create foundation files

**Context:** `07-frontend-project-structure.md` + `08-frontend-types-api.md` + `11-frontend-styling.md`

**What to do:**

1. **Theme `src/index.css`:**
   - Add Google Fonts import (Outfit + Geist) at the top
   - Override shadcn's CSS variables with Aurora's dark palette (all values in doc 11)
   - Add the `--aurora-*` custom properties (doc 11)
   - Set body font-family to Geist, background to `var(--aurora-bg-deep)`, color to `var(--aurora-text)`
   - Add custom scrollbar styles (doc 11)

2. **Create `src/types/index.ts`:** Copy all TypeScript interfaces exactly from doc 08.

3. **Create `src/lib/api.ts`:** Copy the API client exactly from doc 08.

4. **Create folder structure:**
   ```
   src/stores/        (empty for now)
   src/components/layout/
   src/components/songs/
   src/components/tags/
   src/components/playlists/
   src/components/filter/
   src/components/scanner/
   src/hooks/
   ```

5. **Quick test:** Update `App.tsx` to show `<h1 className="font-['Outfit'] text-2xl text-[var(--aurora-teal)] bg-[var(--aurora-bg-deep)] min-h-screen p-8">Aurora</h1>`. Should render teal text on dark background in the Outfit font.

**Git commit:** `Task 1.2: Apply Aurora theme, create types and API client`

---

# PHASE 2: STORES + APP SHELL

## Task 2.1 — Create all Zustand stores and the app layout

**Context:** `09-frontend-state-management.md` + `10-frontend-components.md` (AppShell + Sidebar sections)

**What to do:**

1. **Create all 5 stores** exactly as specified in doc 09:
   - `src/stores/songStore.ts`
   - `src/stores/playlistStore.ts`
   - `src/stores/tagStore.ts`
   - `src/stores/filterStore.ts`
   - `src/stores/playerStore.ts`

2. **Create `src/components/layout/AppShell.tsx`:**
   - CSS Grid: `grid grid-cols-[240px_1fr] grid-rows-[1fr_auto] h-screen`
   - Takes `sidebar`, `main`, `playerBar` as props (or children slots)

3. **Create `src/components/layout/Sidebar.tsx`:**
   - Shows "Aurora" logo text (Outfit, teal)
   - "All Songs" button
   - "Filter View" button
   - Placeholder playlist list (text "Playlists will appear here")
   - "+ New Playlist" button (non-functional for now)
   - "Scan Folder" button (non-functional for now)

4. **Create `src/components/layout/PlayerBar.tsx`:**
   - Placeholder: just shows "No song playing" in muted text
   - Correct styling: `var(--aurora-bg-surface)`, top border, full width

5. **Wire `App.tsx`:**
   - Add view state: `useState<View>({ kind: "all-songs" })`
   - On mount (`useEffect`): call `songStore.fetchSongs()`, `playlistStore.fetchPlaylists()`, `tagStore.fetchTags()`
   - Render `AppShell` with Sidebar, main area (placeholder per view), PlayerBar
   - Add `<Toaster position="bottom-right" theme="dark" />` from sonner
   - Pass view + setView to Sidebar

**Test:** Start backend (`python run.py`). Start frontend (`npm run dev`). Open browser:
- Should see the dark 3-panel layout
- Check Network tab: 3 API calls should succeed (songs, playlists, tags)
- Clicking "All Songs" vs "Filter View" in sidebar should change the main area text

**Git commit:** `Task 2.1: Create all stores and app shell layout`

---

# PHASE 3: SONG TABLE + CRUD

## Task 3.1 — Build the song table with full CRUD

**Context:** `08-frontend-types-api.md` + `09-frontend-state-management.md` (songStore) + `10-frontend-components.md` (SongTable, SongRow, AddSongDialog, EditSongDialog, delete confirmation sections) + `11-frontend-styling.md` (table row patterns)

**What to do — build all song UI components:**

1. **`src/lib/utils.ts`** — add `formatDuration(seconds)` helper (code in doc 10).

2. **`src/components/songs/SongTable.tsx`** — the main table:
   - shadcn `<Table>` with columns: #, Title/Artist, Duration, Playlists, Tags, Actions
   - Takes `songs` prop (Song[] array)
   - Empty state: "No songs found"
   - Loading state: Skeleton rows
   - Row hover effect

3. **`src/components/songs/SongRow.tsx`** — single table row:
   - Shows song data in each column
   - Tags as plain text for now (TagChip comes next phase)
   - Action buttons: edit (Pencil), delete (Trash2)
   - Click on row = nothing yet (wired to player later)

4. **`src/components/songs/AddSongDialog.tsx`:**
   - Fields: Title, Artist, Album, Duration
   - Submit → `songStore.createSong()`, toast on success, close dialog

5. **`src/components/songs/EditSongDialog.tsx`:**
   - Pre-filled with current song data
   - Submit → `songStore.updateSong()`, toast, close

6. **Delete confirmation:**
   - `<AlertDialog>` on delete button click
   - Confirm → `songStore.deleteSong()`, toast

7. **Search input above the table:**
   - `<Input>` in the all-songs view
   - Debounced (300ms setTimeout) → calls `songStore.fetchSongs(search)`

8. **Wire into App.tsx:** When `view.kind === "all-songs"`, render the search input + SongTable with `useSongStore(s => s.songs)`.

**Test with backend running:**
- See your entire scanned music library in the table
- Search filters songs
- Add a test song manually → appears in table
- Edit the test song → changes persist
- Delete the test song → disappears after confirmation

**Git commit:** `Task 3.1: Build song table with full CRUD, search, and dialogs`

---

# PHASE 4: TAGS

## Task 4.1 — Build tag chips and tag editor

**Context:** `08-frontend-types-api.md` + `09-frontend-state-management.md` (tagStore + songStore.assignTags/removeTag) + `10-frontend-components.md` (TagChip, TagList, TagEditor sections) + `02-api-contract.md` (tag endpoints)

**What to do:**

1. **`src/components/tags/TagChip.tsx`:**
   - Small pill: `var(--aurora-bg-hover)` background, `var(--aurora-teal)` text
   - Optional `onRemove` (shows X button)
   - Optional `onClick` (makes it clickable)

2. **`src/components/tags/TagList.tsx`:**
   - Renders row of TagChips from `tags: string[]` prop
   - `flex flex-wrap gap-1`

3. **Update SongRow** to use TagList for displaying tags.

4. **`src/components/tags/TagEditor.tsx`:**
   - Opens as `<Dialog>` when clicking tag icon on a SongRow
   - Shows song title
   - Current tags as removable TagChips
   - Text input to add tags (Enter or comma to submit)
   - Autocomplete dropdown using shadcn `<Popover>` + `<Command>`: shows matching tags from `tagStore.tags` as user types
   - Add → `songStore.assignTags(songId, [tagName])`, refetch tags
   - Remove → look up tag ID from `tagStore.tags` by name, then `songStore.removeTag(songId, tagId)`, refetch tags

5. **Add tag edit icon to SongRow action buttons** (Lucide `Tag` icon).

**Test:**
- Songs show their tags as teal chips
- Click tag icon → tag editor opens
- Add a new tag → it appears on the song
- Remove a tag → it disappears
- Autocomplete shows existing tags as you type

**Git commit:** `Task 4.1: Build tag chips, tag list, and tag editor with autocomplete`

---

# PHASE 5: PLAYLISTS

## Task 5.1 — Build the full playlist UI

**Context:** `08-frontend-types-api.md` + `09-frontend-state-management.md` (playlistStore) + `10-frontend-components.md` (Sidebar playlist list, PlaylistItem, CreatePlaylistDialog, PlaylistDetail, Add-to-Playlist dropdown sections) + `02-api-contract.md` (playlist endpoints)

**What to do — this is a big task, all playlist-related UI:**

1. **`src/components/playlists/PlaylistItem.tsx`:**
   - Colored dot + name + song count
   - Click → `setView({ kind: "playlist", playlistId: id })`
   - Active state styling

2. **Update `Sidebar.tsx`** to render real playlists from `usePlaylistStore(s => s.playlists)` using PlaylistItem components. Active state highlights the current playlist.

3. **`src/components/playlists/CreatePlaylistDialog.tsx`:**
   - Fields: name (required), color (hex text input), emoji
   - Submit → `playlistStore.createPlaylist()`, toast, close

4. **Wire "+ New Playlist" button** in Sidebar to open CreatePlaylistDialog.

5. **`src/components/playlists/PlaylistDetail.tsx`:**
   - Renders when `view.kind === "playlist"`
   - On mount: calls `playlistStore.fetchPlaylistDetail(playlistId)`
   - Header: playlist name (Outfit font), emoji, song count, edit + delete buttons
   - Delete → AlertDialog → `playlistStore.deletePlaylist()`, switch view to all-songs
   - Song list: reuse SongTable or build a simpler list. Shows position, title/artist, duration, tags, remove button, up/down reorder buttons.
   - Remove from playlist → `playlistStore.removeSongFromPlaylist()`
   - Reorder → swap song with neighbor in the current order, call `playlistStore.reorderSongs(playlistId, newSongIds)`

6. **Add-to-Playlist dropdown on SongRow** (all-songs and filter views):
   - `ListPlus` icon button → shadcn `<DropdownMenu>` listing all playlists
   - Click a playlist → `playlistStore.addSongToPlaylist(playlistId, songId)`, toast
   - Handle 409 (already in playlist) with error toast

**Test:**
- Sidebar shows real playlists with colored dots and counts
- Click playlist → detail view loads with its songs
- Create a new playlist → appears in sidebar
- Delete a playlist → removed, view switches
- Add a song to a playlist from the all-songs view → song appears in playlist
- Remove a song from playlist → disappears
- Reorder songs with up/down → positions change

**Git commit:** `Task 5.1: Build full playlist UI — sidebar, detail, create, add/remove, reorder`

---

# PHASE 6: BOOLEAN FILTER

## Task 6.1 — Build the query builder and filter UI

**Context:** `09-frontend-state-management.md` (filterStore) + `10-frontend-components.md` (QueryBuilder, QueryInput sections) + `03-filter-engine.md` (syntax reference table)

**What to do:**

1. **`src/components/filter/QueryInput.tsx`:**
   - Styled text input for filter queries
   - Larger/more prominent than normal inputs
   - Bound to `filterStore.query` via `setQuery`
   - Enter key → `filterStore.executeFilter()`
   - Teal focus ring
   - Placeholder: `Type a query like: slow AND (rock OR anime)`

2. **`src/components/filter/QueryBuilder.tsx`:**
   - Renders when `view.kind === "filter"`
   - Contains:
     - QueryInput at the top
     - Operator buttons row: AND, OR, NOT, (, ) — each calls `filterStore.appendToQuery("AND")` etc.
     - Tag chips row: all tags from `tagStore.tags` as clickable TagChips. Click → `appendToQuery(name)`. Tags with spaces get auto-quoted: `appendToQuery('"3am drive"')`
     - Playlist chips row: all playlist names from `playlistStore.playlists` as clickable chips (slightly different style, maybe using playlist color). Click → `appendToQuery(name.toLowerCase())`
     - "Search" button (primary) → `filterStore.executeFilter()`
     - "Clear" button (secondary) → `filterStore.clearResults()`
   - Below the builder: `<SongTable songs={filterStore.results} />`
   - Error display: if filter returns 400, show error in red text
   - Before first search: show helper text "Build a query above and click Search"
   - After search with no results: "No songs match this query"

**Test:**
- Switch to Filter View
- Type `slow` → click Search → see matching songs
- Use operator buttons + tag chips to build `slow AND rock` → Search → results
- Try `slow AND (rock OR anime)` → correct results
- Try invalid syntax like `AND AND` → error message
- Clear → everything resets

**Git commit:** `Task 6.1: Build query builder with click-to-build and text input`

---

# PHASE 7: AUDIO PLAYER

## Task 7.1 — Build the complete audio player

**Context:** `09-frontend-state-management.md` (playerStore) + `10-frontend-components.md` (PlayerBar + useAudioPlayer sections) + `11-frontend-styling.md` (player bar styling)

**What to do — this wires up the entire audio pipeline:**

1. **`src/hooks/useAudioPlayer.ts`:**
   - Howler.js wrapper hook (full pseudocode in doc 10)
   - Creates/destroys Howl instances when `currentSong` changes
   - `html5: true` (CRITICAL — must be set)
   - Syncs play/pause/volume from store to Howl
   - Updates seek position every second via interval
   - Calls `playerStore.next()` on song end
   - Sets duration on load
   - Exposes `seekTo(seconds)` function
   - Returns `{ seekTo }` for PlayerBar to use

2. **Build out `src/components/layout/PlayerBar.tsx`:**
   - Replace placeholder with real player UI
   - Left: song title + artist (or "No song playing")
   - Center: SkipBack, Play/Pause, SkipForward buttons wired to playerStore
   - Progress: shadcn `<Slider>` for seek. Value = `playerStore.seek`, max = `playerStore.duration`, onChange → `seekTo(value)`. Time display: `m:ss / m:ss`
   - Right: Volume icon + volume Slider
   - Disabled/dimmed state when no song loaded

3. **Mount `useAudioPlayer()` in `App.tsx`** — it needs to be always active. Pass `seekTo` down to PlayerBar (or make it available via context/ref).

4. **Wire song clicks in SongRow:**
   - Click a row → `playerStore.playSong(song, currentSongList)`
   - The `currentSongList` comes from whatever's currently displayed (all songs, filter results, or playlist songs)
   - Songs without `file_path` are visually dimmed and don't trigger play
   - Currently playing song gets a teal left border indicator

**Test (THE BIG ONE):**
- Click a song that has a file_path → audio starts playing
- Player bar shows song title, artist, progress bar moves
- Pause button works, Play resumes
- Seek slider — drag to new position → audio jumps
- Next → plays next song in list
- Previous → restarts song if >3 sec in, otherwise goes to previous
- Volume slider → audio volume changes
- Play a song from filter results → queue = filter results
- Play a song from playlist → queue = playlist songs
- Song ends → next song plays automatically

**Git commit:** `Task 7.1: Build complete audio player with Howler.js`

---

# PHASE 8: FILE SCANNER

## Task 8.1 — Build the scanner dialog

**Context:** `10-frontend-components.md` (ScanDialog section) + `02-api-contract.md` (scanner endpoint)

**What to do:**

1. **`src/components/scanner/ScanDialog.tsx`:**
   - Opens from "Scan Folder" button in Sidebar
   - Folder path input (placeholder: `C:\Users\rockz\Music\Rock`)
   - Playlist name input (optional, placeholder: "Auto-create playlist with this name")
   - Scan button → `api.post("/scan", { folder_path, playlist_name })`
   - Loading state: disable inputs, show "Scanning..."
   - Results: imported count, skipped count, errors list (expandable if any)
   - Done button → close dialog, `songStore.fetchSongs()` + `playlistStore.fetchPlaylists()`

2. **Wire the "Scan Folder" button in Sidebar** to open this dialog.

**Test:**
- Click Scan Folder → dialog opens
- Enter a real music folder path → click Scan
- Songs get imported → results show counts
- Click Done → new songs appear in the song table
- If playlist name was given → new playlist appears in sidebar

**Git commit:** `Task 8.1: Build file scanner dialog`

---

# PHASE 9: POLISH

## Task 9.1 — Polish pass: loading states, toasts, keyboard shortcuts, visual refinement

**Context:** `11-frontend-styling.md` (full doc) + `10-frontend-components.md` (for reference)

**What to do — final sweep across everything:**

1. **Loading states everywhere:**
   - SongTable: Skeleton rows while loading
   - Sidebar playlists: Skeleton items while loading
   - PlaylistDetail: Skeleton while loading
   - Filter results: loading spinner/text while filtering

2. **Toast notifications on all actions:**
   - Song created/updated/deleted → success toast
   - Tag added/removed → success toast
   - Playlist created/deleted → success toast
   - Song added to/removed from playlist → success toast
   - Scan complete → info toast with count
   - All errors → error toast

3. **Keyboard shortcuts (in App.tsx):**
   - Space → toggle play/pause (only when no input is focused: `document.activeElement?.tagName !== "INPUT"`)
   - Escape → handled by shadcn dialogs already

4. **Visual polish:**
   - Consistent hover effects on all interactive elements (buttons, rows, sidebar items)
   - `transition-colors duration-150` everywhere
   - Teal left border on active sidebar item
   - Currently-playing song highlighted in table
   - Scrollable: sidebar playlist list and song table scroll independently (`overflow-y-auto`)
   - Player bar seek slider: styled with teal track color if possible
   - All icons consistently sized
   - Empty states look clean and centered
   - No horizontal overflow anywhere

**Test — full end-to-end regression:**
Run through every single feature and verify it still works after polish changes. Checklist from doc 12 below.

**Git commit:** `Task 9.1: Polish — loading states, toasts, keyboard shortcuts, visual refinement`

---

## Final Verification Checklist (Manual — Not a Qwen Task)

Run through after Task 9.1:

1. ✅ App loads, shows all songs
2. ✅ Search filters songs
3. ✅ Add song → appears in table
4. ✅ Edit song → changes persist
5. ✅ Delete song → confirm dialog → disappears
6. ✅ Tag editor → add/remove tags with autocomplete
7. ✅ Sidebar shows playlists with real data
8. ✅ Click playlist → detail view with songs
9. ✅ Create playlist → appears in sidebar
10. ✅ Delete playlist → removed
11. ✅ Add song to playlist from all-songs view
12. ✅ Remove song from playlist detail view
13. ✅ Reorder songs in playlist
14. ✅ Filter View → type query → Search → results
15. ✅ Click-to-build: operator buttons and tag/playlist chips work
16. ✅ Clear filter → resets
17. ✅ Click song with file_path → audio plays
18. ✅ Play/Pause/Next/Previous all work
19. ✅ Seek slider works
20. ✅ Volume slider works
21. ✅ Song ends → next song auto-plays
22. ✅ Scan folder → songs imported
23. ✅ Scan with playlist name → playlist created
24. ✅ All success actions show toasts
25. ✅ All errors show toasts
26. ✅ Space bar pauses/resumes
27. ✅ No console errors

After this: `git add . && git commit -m "Aurora frontend v1 complete"`

---

## Summary

| Phase | Task | What's Built After |
|-------|------|--------------------|
| 0 | 0.1: Backend stream endpoint | Audio files servable via API |
| 1 | 1.1: Scaffold project | Vite + React + TS + Tailwind + shadcn + deps |
| 1 | 1.2: Theme + foundation files | Aurora dark theme, types, API client |
| 2 | 2.1: Stores + app shell | All 5 stores, sidebar + main + player layout |
| 3 | 3.1: Song table + CRUD | Full song management with search |
| 4 | 4.1: Tags | Tag chips, tag editor with autocomplete |
| 5 | 5.1: Playlists | Full playlist UI — sidebar, detail, CRUD, reorder |
| 6 | 6.1: Filter | Query builder with click + type modes |
| 7 | 7.1: Audio player | Howler.js playback, player bar, song queue |
| 8 | 8.1: Scanner | Folder scan dialog |
| 9 | 9.1: Polish | Loading states, toasts, keyboard, visual refinement |
| **Total** | **11 tasks** | **Aurora frontend v1 complete** |
