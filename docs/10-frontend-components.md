# Aurora — Frontend Components & Layout
## Document 10 of 12 | For: Qwen (Cline) + Human Review

---

## App Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────────┐  ┌─────────────────────────────────┐  │
│  │          │  │  QUERY BUILDER (filter view)     │  │
│  │          │  │  [AND] [OR] [NOT] [( )]          │  │
│  │ SIDEBAR  │  │  [tag chips...] [type here...]   │  │
│  │          │  ├─────────────────────────────────┤  │
│  │ Aurora   │  │  SONG TABLE / RESULTS            │  │
│  │          │  │  #  Title/Artist  Playlist  Tags  │  │
│  │ ⊕ Filter │  │  1  Highway Star  Rock     fast  │  │
│  │          │  │  2  Unravel       Anime    slow  │  │
│  │ Playlists│  │  3  ...                          │  │
│  │ • Rock   │  │                                  │  │
│  │ • Anime  │  │                                  │  │
│  │ • Others │  │                                  │  │
│  │          │  │                                  │  │
│  │ + Add    │  │                                  │  │
│  └──────────┘  └─────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ PLAYER BAR                                      ││
│  │ ▶ Highway Star - Deep Purple   ◄◄ ▶▶ ▶▶│      ││
│  │ ━━━━━━━━━━━━━━━━━━━━━●━━━━━━━  2:31/6:07      ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### AppShell (`src/components/layout/AppShell.tsx`)

CSS Grid layout, full viewport height:

```
grid grid-cols-[240px_1fr] grid-rows-[1fr_auto] h-screen bg-[var(--aurora-bg-deep)]
```

- Column 1 (240px): Sidebar
- Column 2 (1fr): Main content area
- Row 1 (1fr): Sidebar + Main (both scroll independently with `overflow-y-auto`)
- Row 2 (auto): Player bar (fixed height ~80px, spans full width with `col-span-2`)

### Navigation / Views

No React Router. A `useState` in `App.tsx` controls which view renders in the main area:

```typescript
type View =
  | { kind: "all-songs" }
  | { kind: "filter" }
  | { kind: "playlist"; playlistId: number }
```

| View | Triggered By | Main Area Shows |
|------|-------------|-----------------|
| `all-songs` | Default on load, or click "All Songs" | Search input + SongTable with all songs |
| `filter` | Click "Filter View" in sidebar | QueryBuilder + filtered results table |
| `playlist` | Click a playlist in sidebar | PlaylistDetail (header, songs, add/remove/reorder) |

---

## Component Specifications

### Sidebar (`src/components/layout/Sidebar.tsx`)

**Layout:** Fixed 240px width, full height, `var(--aurora-bg-surface)` background, right border `var(--aurora-border)`.

**Content from top to bottom:**
1. **Aurora logo:** Text "Aurora" in Outfit font, 24px, `var(--aurora-teal)` color. Top-left of sidebar.
2. **"All Songs" button:** Click → sets view to `all-songs`. Highlighted when active.
3. **"Filter View" button:** Click → sets view to `filter`. Shows a filter/search icon (Lucide `Search` or `Filter`). Highlighted when active.
4. **Divider:** Thin horizontal line, `var(--aurora-border)`.
5. **"Playlists" label:** Small section header in dim text.
6. **Playlist list:** Each playlist rendered as a `PlaylistItem`. Scrollable if many playlists.
7. **"+ New Playlist" button:** At bottom of playlist list. Opens `CreatePlaylistDialog`.
8. **"Scan Folder" button:** Below playlists. Opens `ScanDialog`.

**Active state:** Whichever item matches the current view gets `var(--aurora-bg-hover)` background and a 3px teal left border.

Props needed: `currentView`, `onViewChange` (or just use the view state directly).

---

### PlaylistItem (`src/components/playlists/PlaylistItem.tsx`)

A single sidebar entry for a playlist.

- **Layout:** Row with: colored dot (8px circle, `playlist.color` or default teal) + playlist name + song count in dim text
- **Click:** Sets view to `{ kind: "playlist", playlistId: playlist.id }`
- **Active state:** Highlighted when this playlist is the currently viewed one
- **Hover:** `var(--aurora-bg-hover)` background, smooth transition

---

### SongTable (`src/components/songs/SongTable.tsx`)

The main data display. Reused across all three views with different data sources.

**Props:**
```typescript
interface SongTableProps {
  songs: Song[] | PlaylistSong[] | FilterResult[]
  onPlaySong?: (song: Song, index: number) => void
  showPlaylistColumn?: boolean    // hide in playlist detail view
  showPositionControls?: boolean  // show up/down buttons in playlist view
  onReorder?: (songId: number, direction: "up" | "down") => void
  onRemoveFromPlaylist?: (songId: number) => void
}
```

**Columns:**
| # | Column | Content |
|---|--------|---------|
| 1 | # | Row index (1-based) |
| 2 | Title / Artist | Title in bold (`var(--aurora-text)`), artist below in dim text (`var(--aurora-text-dim)`). Stacked vertically. |
| 3 | Duration | Formatted as `m:ss` (e.g., 367 → "6:07"). If null, show "—" |
| 4 | Playlists | Playlist names as small colored text. Hidden in playlist detail view. |
| 5 | Tags | `TagList` component — row of small tag chips |
| 6 | Actions | Icon buttons: tag edit (Lucide `Tag`), song edit (Lucide `Pencil`), delete (Lucide `Trash2`), add-to-playlist (Lucide `ListPlus`). In playlist view: also up/down arrows and remove button. |

**Row click behavior:** Clicking anywhere on the row (except action buttons) calls `playerStore.playSong(song, allDisplayedSongs)`. Songs without `file_path` are visually dimmed and don't trigger playback.

**Styling:**
- `var(--aurora-bg)` background
- Row borders: `var(--aurora-border)` — thin bottom border
- Hover: `var(--aurora-bg-hover)` background, `transition-colors duration-150`
- Currently playing song: teal left border or subtle teal background tint

**Empty state:** Centered text "No songs found" in `var(--aurora-text-muted)`

**Loading state:** Shadcn `<Skeleton>` rows (3-5 rows of skeleton placeholders)

---

### SongRow (`src/components/songs/SongRow.tsx`)

Single row in SongTable. Separated for clarity since each row has a lot of interactive elements.

Takes one song + callback props. Renders the columns described above. Handles click vs button-click (use `e.stopPropagation()` on action buttons so they don't trigger row-level play).

---

### AddSongDialog (`src/components/songs/AddSongDialog.tsx`)

Shadcn `<Dialog>` for manually adding a song.

**Fields:**
- Title — `<Input>`, required
- Artist — `<Input>`, required
- Album — `<Input>`, optional
- Duration (seconds) — `<Input type="number">`, optional

**Submit:** Calls `songStore.createSong(data)`. On success: close dialog, `toast.success("Song added")`. On error: show error text in dialog.

**Trigger:** Button in sidebar or above the SongTable labeled "+ Add Song".

---

### EditSongDialog (`src/components/songs/EditSongDialog.tsx`)

Same layout as AddSongDialog but pre-filled with the song's current data.

Opens when clicking the edit icon on a SongRow. Receives the `Song` object as a prop.

**Submit:** Calls `songStore.updateSong(id, data)`. On success: close, `toast.success("Song updated")`.

---

### Delete Confirmation

When clicking delete icon on a SongRow, show a shadcn `<AlertDialog>`:
- Title: "Delete [song title]?"
- Description: "This will remove the song from all playlists and delete all its tags. This cannot be undone."
- Cancel button + destructive Delete button
- Calls `songStore.deleteSong(id)`, then `toast.success("Song deleted")`

This can be inline in SongRow or a separate small component.

---

### TagChip (`src/components/tags/TagChip.tsx`)

Small badge/pill displaying a tag name.

**Styling:** `var(--aurora-bg-hover)` background, `var(--aurora-teal)` text, small rounded-full, `px-2 py-0.5 text-xs`

**Props:**
- `name: string` — the tag name to display
- `onRemove?: () => void` — if provided, shows a tiny X button on the right
- `onClick?: () => void` — if provided, the chip is clickable (for query builder)

---

### TagList (`src/components/tags/TagList.tsx`)

Renders a horizontal row of TagChips from a `tags: string[]` prop. Uses `flex flex-wrap gap-1`.

---

### TagEditor (`src/components/tags/TagEditor.tsx`)

Shadcn `<Dialog>` for managing tags on a specific song.

**Opens when:** Clicking the tag icon on a SongRow.

**Layout:**
1. **Title:** "Edit tags — [song title]"
2. **Current tags:** List of TagChips with `onRemove` — clicking X removes the tag
3. **Add input:** Text input at bottom. User types a tag name and presses Enter to add. Comma also works as a separator (so typing "fast, gym" adds two tags).
4. **Autocomplete dropdown:** As user types, show a filtered list of existing tags from `tagStore.tags` that match the input. Use shadcn `<Popover>` + `<Command>` for this.

**Tag removal complication:** The `DELETE /api/songs/{song_id}/tags/{tag_id}` endpoint needs a `tag_id`, but the song's tags are just name strings. Solution: look up the tag by name in `tagStore.tags` to get the ID. If the tag isn't found (shouldn't happen), log an error.

**After adding/removing:** The tag list updates via store refetch. Also refetch `tagStore.fetchTags()` to update song_count values.

---

### CreatePlaylistDialog (`src/components/playlists/CreatePlaylistDialog.tsx`)

Shadcn `<Dialog>` for creating a new playlist.

**Fields:**
- Name — `<Input>`, required
- Color — `<Input>`, optional, placeholder "#00C9A7" (hex color). Plain text input for v1.
- Emoji — `<Input>`, optional, placeholder "🎸"

**Submit:** Calls `playlistStore.createPlaylist(data)`. On success: close, toast, new playlist appears in sidebar.

---

### PlaylistDetail (`src/components/playlists/PlaylistDetail.tsx`)

Renders when `view.kind === "playlist"`.

**Header area:**
- Playlist name in large Outfit font
- Emoji (if set) next to the name
- Song count in dim text: "23 songs"
- Edit button (opens edit dialog — reuse pattern from EditSongDialog) and Delete button (with AlertDialog confirmation)
- Colored accent bar or dot using `playlist.color`

**Song list:** A SongTable with `showPositionControls={true}`, `showPlaylistColumn={false}`, and `onRemoveFromPlaylist` callback.

**Reorder controls:** Up/down arrow buttons on each row. Clicking swaps the song with its neighbor and calls `playlistStore.reorderSongs(playlistId, newSongIds)`.

**Add song to this playlist:** A button or dropdown that opens a song picker (could be a Command/Combobox searching all songs) → calls `playlistStore.addSongToPlaylist()`.

**On mount:** Calls `playlistStore.fetchPlaylistDetail(playlistId)` to load the playlist's songs.

---

### Add-to-Playlist Dropdown (in SongRow)

A small dropdown on each song row in the all-songs and filter views. Uses shadcn `<DropdownMenu>`.

**Trigger:** `ListPlus` icon button.
**Content:** List of all playlists from `playlistStore.playlists`. Clicking one calls `playlistStore.addSongToPlaylist(playlistId, songId)`. Shows toast on success or error (409 = already in playlist).

---

### QueryBuilder (`src/components/filter/QueryBuilder.tsx`)

Renders when `view.kind === "filter"`.

**Layout (top to bottom):**

1. **Query display/input area:** A styled text input (`QueryInput`) showing the current query. The user can type directly here. Monospace-ish font. Green/teal border when focused. Pressing Enter executes the filter.

2. **Operator buttons:** Row of small buttons: `AND`, `OR`, `NOT`, `(`, `)`. Clicking appends the operator to the query via `filterStore.appendToQuery("AND")`.

3. **Available tags:** Row of clickable TagChips for all tags from `tagStore.tags`. Clicking appends the tag name to the query. Tags with spaces are auto-quoted: clicking "3am drive" appends `"3am drive"`.

4. **Available playlists as tags:** Row of clickable chips for all playlist names from `playlistStore.playlists`. Rendered in a slightly different style (maybe with the playlist's color). Clicking appends the lowercased playlist name.

5. **Action buttons:** "Search" (primary, teal) → calls `filterStore.executeFilter()`. "Clear" (secondary) → calls `filterStore.clearResults()`.

6. **Results area:** Below the builder, render `<SongTable songs={filterStore.results} />`. Shows "No matches found" if results are empty after a search. Shows nothing before the first search.

**Error display:** If the filter returns a 400 (bad syntax), show the error message in red text below the query input.

---

### QueryInput (`src/components/filter/QueryInput.tsx`)

A styled text input specifically for filter queries.

- Larger than a normal input — prominent in the UI
- Monospace or semi-monospace font so operators and parentheses align
- Value bound to `filterStore.query`
- On change → `filterStore.setQuery(value)`
- On Enter key → `filterStore.executeFilter()`
- Placeholder: `Type a query like: slow AND (rock OR anime)`
- Teal/green focus ring

---

### PlayerBar (`src/components/layout/PlayerBar.tsx`)

Fixed at bottom, full width, ~80px height.

**Styling:** `var(--aurora-bg-surface)` background, thin top border `var(--aurora-border)`.

**Layout (3 sections in a row):**

1. **Left — Song info (flex-1, min-w-0):**
   - Song title (bold, truncated with ellipsis)
   - Artist (dim text, below title, truncated)
   - If no song loaded: "No song playing" in `var(--aurora-text-muted)`

2. **Center — Controls (flex-shrink-0):**
   - Previous button (Lucide `SkipBack`) → `playerStore.previous()`
   - Play/Pause button (Lucide `Play` or `Pause`, larger than others) → `playerStore.togglePlay()`
   - Next button (Lucide `SkipForward`) → `playerStore.next()`
   - Below the buttons: seek slider (shadcn `<Slider>`) + time display
   - Slider: min=0, max=`duration`, value=`seek`. On change → call the audio hook's `seekTo()` function.
   - Time display: `currentTime / totalTime` formatted as `m:ss / m:ss`

3. **Right — Volume (w-32):**
   - Volume icon (Lucide `Volume2`, or `VolumeX` if muted)
   - Volume slider: min=0, max=1, step=0.01, value=`volume`. On change → `playerStore.setVolume(v)`

**Disabled state:** When no song is loaded, controls are visually dimmed and non-interactive.

---

### ScanDialog (`src/components/scanner/ScanDialog.tsx`)

Shadcn `<Dialog>` for scanning a local music folder.

**Opens from:** "Scan Folder" button in Sidebar.

**Fields:**
1. **Folder path input:** `<Input>` where user types/pastes the absolute path. Placeholder: `C:\Users\rockz\Music\Rock`
2. **Playlist name input (optional):** `<Input>` placeholder: "Auto-create playlist with this name"

**Scan button:** Calls `api.post<ApiResponse<ScanResult>>("/scan", { folder_path, playlist_name })`.

**Loading state:** Disable inputs + button, show "Scanning..." text.

**Results display (after scan completes):**
- "Imported: X songs"
- "Skipped: X (duplicates)"
- "Errors: X" — if errors, show expandable list of file paths + error messages
- A "Done" button that closes the dialog and calls `songStore.fetchSongs()` + `playlistStore.fetchPlaylists()` to refresh

---

### useAudioPlayer Hook (`src/hooks/useAudioPlayer.ts`)

Wraps Howler.js and syncs with `playerStore`. Mounted in `App.tsx` so it's always active.

**Behavior:**

```typescript
// Pseudocode — Qwen implements the real version
function useAudioPlayer() {
  const currentSong = usePlayerStore(s => s.currentSong)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const volume = usePlayerStore(s => s.volume)
  const seek = usePlayerStore(s => s.seek)
  const howlRef = useRef<Howl | null>(null)
  const intervalRef = useRef<number | null>(null)

  // When currentSong changes → create new Howl instance
  useEffect(() => {
    // Cleanup previous
    if (howlRef.current) {
      howlRef.current.unload()
      clearInterval(intervalRef.current!)
    }
    if (!currentSong?.file_path) return

    const howl = new Howl({
      src: [`http://localhost:8000/api/songs/${currentSong.id}/stream`],
      html5: true,      // CRITICAL: stream, don't download entire file
      volume: volume,
      onplay: () => {
        // Start interval to update seek position every second
        intervalRef.current = window.setInterval(() => {
          usePlayerStore.getState().updateSeek(howl.seek() as number)
        }, 1000)
      },
      onpause: () => clearInterval(intervalRef.current!),
      onend: () => {
        clearInterval(intervalRef.current!)
        usePlayerStore.getState().next()
      },
      onload: () => {
        usePlayerStore.getState().setDuration(howl.duration())
      },
    })
    howlRef.current = howl
    howl.play()

    return () => {
      howl.unload()
      clearInterval(intervalRef.current!)
    }
  }, [currentSong?.id])

  // Sync play/pause
  useEffect(() => {
    if (!howlRef.current) return
    if (isPlaying) howlRef.current.play()
    else howlRef.current.pause()
  }, [isPlaying])

  // Sync volume
  useEffect(() => {
    howlRef.current?.volume(volume)
  }, [volume])

  // Expose seekTo for the progress slider
  const seekTo = useCallback((seconds: number) => {
    howlRef.current?.seek(seconds)
    usePlayerStore.getState().setSeek(seconds)
  }, [])

  return { seekTo }
}
```

**Key notes for Qwen:**
- `html5: true` is REQUIRED — without it, Howler downloads the entire file before playing. Bad for large FLACs.
- One Howl instance per song — always destroy the old one before creating a new one.
- The seek interval must be cleared on pause, on end, and on cleanup.
- `seekTo` is passed down to PlayerBar for the progress slider's onChange handler.

---

## Utility: Duration Formatting

Used by SongTable and PlayerBar. Could live in `src/lib/utils.ts`:

```typescript
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
```
