# Offline Player Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 4 missing offline-player features (repeat, shuffle, sort, volume persistence) plus fix 2 bugs found during audit.

**Architecture:** All player state changes land in `playerStore.ts`. Sort state lives in `songStore.ts` so that post-mutation refetches preserve the current sort. The audio hook (`useAudioPlayer.ts`) handles repeat-one replay directly via Howl. `SongTable` reads sort state from store and renders dual sort controls.

**Tech Stack:** FastAPI + SQLite (backend), React 19 + Zustand + Howler.js + Tailwind + shadcn/ui + lucide-react (frontend), TypeScript 5

---

## File Map

| File | Changes |
|------|---------|
| `backend/app/routers/songs.py` | Add `sort` + `order` query params to `GET /songs` |
| `frontend/src/stores/songStore.ts` | Add `sortField`, `sortOrder`, `sortSongs` action; update `fetchSongs` to use sort state |
| `frontend/src/stores/playerStore.ts` | Add `repeatMode`, `isShuffled`, `originalQueue`; add `cycleRepeat`, `toggleShuffle`; update `next`, `playSong`, `previous`; add localStorage volume persistence |
| `frontend/src/hooks/useAudioPlayer.ts` | Update `onend` to handle repeat-one |
| `frontend/src/components/layout/PlayerBar.tsx` | Add Shuffle + Repeat buttons to desktop + mobile layouts |
| `frontend/src/components/songs/SongTable.tsx` | Add sort toolbar + sortable column headers |

---

## Task 1: Backend — sort params for GET /songs

**Files:**
- Modify: `backend/app/routers/songs.py`

- [ ] **Step 1: Add sort + order params and validation**

Replace the `list_songs` function signature and add allowlist + query injection. In `backend/app/routers/songs.py`, replace the existing `list_songs` function (lines 59–144) with:

```python
ALLOWED_SORT_FIELDS = {"title", "artist", "album", "duration", "created_at"}
SORT_COL_MAP = {
    "title": "s.title",
    "artist": "s.artist",
    "album": "s.album",
    "duration": "s.duration",
    "created_at": "s.created_at",
}

@router.get("/songs")
def list_songs(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1),
    offset: int = Query(0, ge=0),
    sort: str = Query("title"),
    order: str = Query("asc"),
):
    """List all songs with optional search, sort, limit, and offset."""
    if sort not in ALLOWED_SORT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort field. Allowed: {', '.join(sorted(ALLOWED_SORT_FIELDS))}",
        )
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="order must be 'asc' or 'desc'")

    order_str = "ASC" if order == "asc" else "DESC"
    sort_col = SORT_COL_MAP[sort]

    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT
            s.id, s.title, s.artist, s.album, s.duration,
            s.file_path, s.file_format, s.album_art_path, s.source,
            GROUP_CONCAT(t.name) as tags,
            GROUP_CONCAT(p.id || ':' || p.name) as playlists,
            s.created_at, s.updated_at
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
    """

    params = []
    where_clauses = []

    if search:
        where_clauses.append("(s.title LIKE ? OR s.artist LIKE ?)")
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern])

    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)

    query += f" GROUP BY s.id ORDER BY {sort_col} {order_str}"

    if limit is not None and limit > 0:
        query += " LIMIT ?"
        params.append(limit)

    if offset is not None and offset >= 0:
        query += " OFFSET ?"
        params.append(offset)

    cursor.execute(query, params)
    rows = cursor.fetchall()

    count_query = "SELECT COUNT(*) as total FROM songs s"
    count_params = []
    count_where = []

    if search:
        count_where.append("(s.title LIKE ? OR s.artist LIKE ?)")
        search_pattern = f"%{search}%"
        count_params.extend([search_pattern, search_pattern])

    if count_where:
        count_query += " WHERE " + " AND ".join(count_where)

    cursor.execute(count_query, count_params)
    total = cursor.fetchone()["total"]

    conn.close()

    data = [song_row_to_dict(row) for row in rows]

    return {"data": data, "total": total, "message": "ok"}
```

- [ ] **Step 2: Verify backend starts clean**

```
cd backend && venv\Scripts\activate && python run.py
```

Open `http://localhost:8000/docs` — confirm `GET /songs` now shows `sort` and `order` params. Test:
- `GET /api/songs?sort=artist&order=asc` → songs sorted A–Z by artist
- `GET /api/songs?sort=invalid` → 400 error

- [ ] **Step 3: Commit**

```
git add backend/app/routers/songs.py
git commit -m "feat(backend): add sort+order params to GET /songs"
```

---

## Task 2: songStore — sort state + fetchSongs update

**Files:**
- Modify: `frontend/src/stores/songStore.ts`

- [ ] **Step 1: Add sort fields to interface and state**

In `songStore.ts`, update the `SongState` interface to add:

```typescript
interface SongState {
  songs: Song[]
  loading: boolean
  error: string | null
  view: View
  sortField: string
  sortOrder: "asc" | "desc"

  fetchSongs: (search?: string) => Promise<void>
  sortSongs: (field: string, order: "asc" | "desc") => void
  // ... rest unchanged
```

- [ ] **Step 2: Update store implementation**

Replace `fetchSongs` and add `sortField`, `sortOrder`, `sortSongs` in the `create(...)` call:

```typescript
export const useSongStore = create<SongState>((set, get) => ({
  songs: [],
  loading: false,
  error: null,
  view: { kind: "filter" },
  sortField: "title",
  sortOrder: "asc",

  fetchSongs: async (search) => {
    set({ loading: true, error: null })
    try {
      const { sortField, sortOrder } = get()
      const params = new URLSearchParams({ limit: "500" })
      if (search) params.set("search", search)
      params.set("sort", sortField)
      params.set("order", sortOrder)
      const res = await api.get<ApiResponse<Song[]>>(`/songs?${params.toString()}`)
      set({ songs: res.data, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  sortSongs: (field, order) => {
    set({ sortField: field, sortOrder: order })
    get().fetchSongs()
  },

  // createSong, updateSong, deleteSong, assignTags, removeTag, removeTagByName, setView
  // — all unchanged; their internal get().fetchSongs() calls now pick up current sort
```

- [ ] **Step 3: Type-check**

```
cd frontend && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```
git add frontend/src/stores/songStore.ts
git commit -m "feat(store): add sort state + sortSongs action to songStore"
```

---

## Task 3: playerStore — volume persistence

**Files:**
- Modify: `frontend/src/stores/playerStore.ts`

- [ ] **Step 1: Add localStorage read on init + write in setVolume**

At the top of `playerStore.ts`, add the init helper before `create(...)`:

```typescript
function loadStoredVolume(): number {
  const stored = parseFloat(localStorage.getItem("aurora-volume") ?? "")
  return !isNaN(stored) && stored >= 0 && stored <= 1 ? stored : 0.7
}
```

In the `create(...)` initial state, change the volume fields:

```typescript
// was: volume: 0.7, preMuteVolume: 0.7,
const initVol = loadStoredVolume()

// ... in create((set, get) => ({
  volume: initVol,
  preMuteVolume: initVol > 0 ? initVol : 0.7,
```

Wait — Zustand's `create` doesn't support running code before the object literal. Move the `initVol` outside:

```typescript
const _initVol = loadStoredVolume()

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: _initVol,
  preMuteVolume: _initVol > 0 ? _initVol : 0.7,
  seek: 0,
  duration: 0,
  // ...
```

Update `setVolume` to write localStorage:

```typescript
  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v))
    localStorage.setItem("aurora-volume", String(clamped))
    if (clamped > 0) {
      set({ volume: clamped, preMuteVolume: clamped })
    } else {
      set({ volume: clamped })
    }
  },
```

- [ ] **Step 2: Type-check**

```
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Smoke test**

Start frontend (`npm run dev`). Move volume slider to 0.3. Refresh page. Volume should be at 0.3, not 0.7.

- [ ] **Step 4: Commit**

```
git add frontend/src/stores/playerStore.ts
git commit -m "feat(player): persist volume to localStorage across refreshes"
```

---

## Task 4: playerStore — repeat mode + previous() bug fix

**Files:**
- Modify: `frontend/src/stores/playerStore.ts`

This task also fixes a bug: `previous()` is a no-op when at queue start with seek < 3s. Should restart current song.

- [ ] **Step 1: Add repeatMode to interface**

In the `PlayerState` interface, add:

```typescript
interface PlayerState {
  // ... existing fields ...
  repeatMode: "none" | "all" | "one"

  // ... existing actions ...
  cycleRepeat: () => void
```

- [ ] **Step 2: Add repeatMode initial state + cycleRepeat action**

In the `create(...)` block, after `duration: 0,` add:

```typescript
  repeatMode: "none" as "none" | "all" | "one",
```

Add `cycleRepeat` action after `stop`:

```typescript
  cycleRepeat: () => {
    const { repeatMode } = get()
    const next: Record<string, "none" | "all" | "one"> = {
      none: "all",
      all: "one",
      one: "none",
    }
    set({ repeatMode: next[repeatMode] })
  },
```

- [ ] **Step 3: Update next() for repeat-all**

Replace the existing `next` action:

```typescript
  next: () => {
    const { queue, queueIndex, repeatMode } = get()
    // repeat-one is handled by useAudioPlayer onend — pressing Next still advances
    if (queueIndex < queue.length - 1) {
      const nextSong = queue[queueIndex + 1]
      set({
        currentSong: nextSong,
        queueIndex: queueIndex + 1,
        isPlaying: true,
        seek: 0,
        duration: nextSong.duration ?? 0,
      })
    } else if (repeatMode === "all") {
      const firstSong = queue[0]
      set({
        currentSong: firstSong,
        queueIndex: 0,
        isPlaying: true,
        seek: 0,
        duration: firstSong.duration ?? 0,
      })
    } else {
      // end of queue, no repeat — stop but keep currentSong visible
      set({ isPlaying: false })
    }
  },
```

- [ ] **Step 4: Fix previous() no-op bug at queue start**

Replace the existing `previous` action:

```typescript
  previous: () => {
    const { queue, queueIndex, seek } = get()
    if (seek > 3) {
      set({ seek: 0 })
      return
    }
    if (queueIndex > 0) {
      const prevSong = queue[queueIndex - 1]
      set({
        currentSong: prevSong,
        queueIndex: queueIndex - 1,
        isPlaying: true,
        seek: 0,
        duration: prevSong.duration ?? 0,
      })
    } else {
      // at queue start with seek <= 3s — restart current song
      set({ seek: 0 })
    }
  },
```

- [ ] **Step 5: Type-check**

```
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```
git add frontend/src/stores/playerStore.ts
git commit -m "feat(player): add repeat mode (none/all/one) + fix previous() no-op at queue start"
```

---

## Task 5: playerStore — shuffle

**Files:**
- Modify: `frontend/src/stores/playerStore.ts`

- [ ] **Step 1: Add shuffle fields to interface**

In `PlayerState` interface, add:

```typescript
  isShuffled: boolean
  originalQueue: Song[]

  toggleShuffle: () => void
```

- [ ] **Step 2: Add shuffle helper + initial state**

Before `export const usePlayerStore`, add:

```typescript
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

In `create(...)` initial state, add after `duration: 0,`:

```typescript
  isShuffled: false,
  originalQueue: [],
```

- [ ] **Step 3: Add toggleShuffle action**

After `cycleRepeat`, add:

```typescript
  toggleShuffle: () => {
    const { isShuffled, queue, currentSong, originalQueue } = get()
    if (!isShuffled) {
      const shuffled = shuffleArray(queue)
      const newIndex = shuffled.findIndex((s) => s.id === currentSong?.id)
      set({
        isShuffled: true,
        originalQueue: queue,
        queue: shuffled,
        queueIndex: newIndex >= 0 ? newIndex : 0,
      })
    } else {
      const restored = originalQueue
      const newIndex = restored.findIndex((s) => s.id === currentSong?.id)
      set({
        isShuffled: false,
        queue: restored,
        queueIndex: newIndex >= 0 ? newIndex : 0,
        originalQueue: [],
      })
    }
  },
```

- [ ] **Step 4: Reset shuffle in playSong()**

Update `playSong` to clear shuffle state on new queue:

```typescript
  playSong: (song, queue) => {
    if (!song.file_path) return
    const newQueue = queue?.filter((s) => s.file_path) ?? [song]
    const index = newQueue.findIndex((s) => s.id === song.id)
    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
      isPlaying: true,
      seek: 0,
      duration: song.duration ?? 0,
      isShuffled: false,
      originalQueue: [],
    })
  },
```

- [ ] **Step 5: Type-check**

```
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```
git add frontend/src/stores/playerStore.ts
git commit -m "feat(player): add shuffle toggle with queue restore"
```

---

## Task 6: useAudioPlayer — repeat-one onend handling

**Files:**
- Modify: `frontend/src/hooks/useAudioPlayer.ts`

- [ ] **Step 1: Update onend to check repeatMode**

In `useAudioPlayer.ts`, replace the `onend` callback inside the Howl constructor:

```typescript
      onend: () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        const { repeatMode } = usePlayerStore.getState()
        if (repeatMode === "one") {
          howl.seek(0)
          howl.play()
          updateSeek(0)
        } else {
          next()
        }
      },
```

(`howl` here refers to the local variable in the closure, not `howlRef.current`. `updateSeek` and `next` are already captured from the store at the top of the hook.)

- [ ] **Step 2: Type-check**

```
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add frontend/src/hooks/useAudioPlayer.ts
git commit -m "feat(audio): handle repeat-one in Howl onend callback"
```

---

## Task 7: PlayerBar — Shuffle + Repeat buttons

**Files:**
- Modify: `frontend/src/components/layout/PlayerBar.tsx`

- [ ] **Step 1: Update imports**

In `PlayerBar.tsx`, update the lucide import line:

```typescript
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1 } from "lucide-react"
```

- [ ] **Step 2: Add store subscriptions**

After the existing `const previous = ...` line, add:

```typescript
  const repeatMode = usePlayerStore((state) => state.repeatMode)
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat)
  const isShuffled = usePlayerStore((state) => state.isShuffled)
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle)
```

- [ ] **Step 3: Add repeat/shuffle button helpers**

After the `const art = useMemo(...)` block, add:

```typescript
  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat
  const repeatActive = repeatMode !== "none"
  const transportBtnClass = (active: boolean) =>
    `transition-colors duration-150 disabled:opacity-25 disabled:pointer-events-none ${
      active
        ? "text-[var(--aurora-accent-interactive)]"
        : "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)]"
    }`
```

- [ ] **Step 4: Update desktop controls row**

Find the desktop center controls `<div className="flex items-center gap-3">` (the one containing SkipBack/Play/SkipForward). Replace its contents:

```tsx
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleShuffle}
                  disabled={!hasSong}
                  className={transportBtnClass(isShuffled)}
                  aria-label={isShuffled ? "Shuffle on" : "Shuffle off"}
                >
                  <Shuffle className="h-[15px] w-[15px]" strokeWidth={2} />
                </button>

                <button
                  onClick={() => { if (seek > 3) seekTo(0); else previous() }}
                  disabled={!hasSong}
                  className={transportBtnClass(false)}
                  aria-label="Previous"
                >
                  <SkipBack className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                </button>

                <button
                  onClick={togglePlay}
                  disabled={!hasSong}
                  className="relative h-11 w-11 rounded-full flex items-center justify-center disabled:opacity-25 disabled:pointer-events-none aurora-btn-press aurora-play-btn"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-[18px] w-[18px] text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play className="h-[18px] w-[18px] ml-[2px] text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                  )}
                </button>

                <button
                  onClick={next}
                  disabled={!hasSong}
                  className={transportBtnClass(false)}
                  aria-label="Next"
                >
                  <SkipForward className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                </button>

                <button
                  onClick={cycleRepeat}
                  disabled={!hasSong}
                  className={transportBtnClass(repeatActive)}
                  aria-label={`Repeat: ${repeatMode}`}
                >
                  <RepeatIcon className="h-[15px] w-[15px]" strokeWidth={2} />
                </button>
              </div>
```

- [ ] **Step 5: Update mobile controls row**

Find the mobile `<div className="flex items-center justify-center gap-5">` (the controls row). Replace its contents:

```tsx
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleShuffle}
                disabled={!hasSong}
                className={transportBtnClass(isShuffled)}
                aria-label={isShuffled ? "Shuffle on" : "Shuffle off"}
              >
                <Shuffle className="h-3.5 w-3.5" strokeWidth={2} />
              </button>

              <button
                onClick={() => { if (seek > 3) seekTo(0); else previous() }}
                disabled={!hasSong}
                className={transportBtnClass(false)}
                aria-label="Previous"
              >
                <SkipBack className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              </button>

              <button
                onClick={togglePlay}
                disabled={!hasSong}
                className="relative h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-25 disabled:pointer-events-none aurora-btn-press aurora-play-btn"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                ) : (
                  <Play className="h-4 w-4 ml-[1px] text-[var(--aurora-slate)]" fill="currentColor" strokeWidth={0} />
                )}
              </button>

              <button
                onClick={next}
                disabled={!hasSong}
                className={transportBtnClass(false)}
                aria-label="Next"
              >
                <SkipForward className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              </button>

              <button
                onClick={cycleRepeat}
                disabled={!hasSong}
                className={transportBtnClass(repeatActive)}
                aria-label={`Repeat: ${repeatMode}`}
              >
                <RepeatIcon className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
```

- [ ] **Step 6: Type-check**

```
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 7: Visual check**

Start frontend (`npm run dev`). Verify:
- Desktop PlayerBar shows `[Shuffle] [Prev] [Play] [Next] [Repeat]` in center
- Shuffle button dims when off, turns accent color when clicked
- Repeat cycles: dim icon → accent Repeat icon → accent Repeat1 icon → dim
- Mobile layout shows same 5 buttons

- [ ] **Step 8: Commit**

```
git add frontend/src/components/layout/PlayerBar.tsx
git commit -m "feat(ui): add shuffle + repeat buttons to PlayerBar"
```

---

## Task 8: SongTable — sort toolbar + sortable column headers

**Files:**
- Modify: `frontend/src/components/songs/SongTable.tsx`

- [ ] **Step 1: Update imports**

Replace the top of `SongTable.tsx`:

```typescript
import { useState, useEffect } from "react"
import type { Song } from "@/types"
import { SongRow } from "./SongRow"
import { Skeleton } from "@/components/ui/skeleton"
import { Music, ChevronUp, ChevronDown } from "lucide-react"
import { useSongStore } from "@/stores/songStore"
```

- [ ] **Step 2: Update SongTableProps**

Keep `SongTableProps` as-is (no changes needed — sort state comes from store).

- [ ] **Step 3: Replace TableHeader with sortable version**

Replace the `HEADER_CLASS` const and `TableHeader` function with:

```typescript
const HEADER_CLASS =
  "px-4 py-3 text-left label-micro text-[10px] text-[var(--aurora-text-tertiary)] font-medium"

interface TableHeaderProps {
  sortField: string
  sortOrder: "asc" | "desc"
  onSort: (field: string) => void
}

function TableHeader({ sortField, sortOrder, onSort }: TableHeaderProps) {
  const SortArrow = sortOrder === "asc" ? ChevronUp : ChevronDown

  function SortableTh({
    field,
    label,
    className,
  }: {
    field: string
    label: string
    className?: string
  }) {
    const active = sortField === field
    return (
      <th
        className={`${HEADER_CLASS} cursor-pointer select-none hover:text-[var(--aurora-text-secondary)] ${active ? "text-[var(--aurora-text-secondary)]" : ""} ${className ?? ""}`}
        onClick={() => onSort(field)}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active && <SortArrow className="h-2.5 w-2.5" />}
        </span>
      </th>
    )
  }

  return (
    <thead>
      <tr>
        <th className={`${HEADER_CLASS} w-12 text-center`}>#</th>
        <SortableTh field="title" label="Title" />
        <SortableTh field="duration" label="Duration" className="w-28 hidden lg:table-cell" />
        <th className={`${HEADER_CLASS} w-40 hidden lg:table-cell`}>Playlists</th>
        <th className={`${HEADER_CLASS} max-w-[200px]`}>Tags</th>
        <th className={`${HEADER_CLASS} w-32 text-right`}>Actions</th>
      </tr>
    </thead>
  )
}
```

- [ ] **Step 4: Add sort state + handlers to SongTable**

Replace the `SongTable` function:

```typescript
export function SongTable({ songs, loading = false, onPlay, animKey }: SongTableProps) {
  const sortField = useSongStore((state) => state.sortField)
  const sortOrder = useSongStore((state) => state.sortOrder)
  const sortSongs = useSongStore((state) => state.sortSongs)

  function handleColumnSort(field: string) {
    if (field === sortField) {
      sortSongs(field, sortOrder === "asc" ? "desc" : "asc")
    } else {
      sortSongs(field, "asc")
    }
  }

  function handleDropdownChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [field, order] = e.target.value.split("-")
    sortSongs(field, order as "asc" | "desc")
  }

  const sortDropdownValue = `${sortField}-${sortOrder}`

  const toolbar = (
    <div className="flex items-center justify-end px-4 pb-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--aurora-text-tertiary)] uppercase tracking-wide">Sort</span>
        <select
          value={sortDropdownValue}
          onChange={handleDropdownChange}
          className="text-[11px] bg-transparent text-[var(--aurora-text-secondary)] border border-[var(--aurora-rim)] rounded px-2 py-1 focus:outline-none cursor-pointer hover:border-[var(--aurora-muted)]"
        >
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          <option value="artist-asc">Artist A–Z</option>
          <option value="artist-desc">Artist Z–A</option>
          <option value="album-asc">Album A–Z</option>
          <option value="album-desc">Album Z–A</option>
          <option value="duration-asc">Duration ↑</option>
          <option value="duration-desc">Duration ↓</option>
          <option value="created_at-desc">Newest first</option>
          <option value="created_at-asc">Oldest first</option>
        </select>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="w-full overflow-auto aurora-fade-in">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleColumnSort} />
          <tbody>
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <Skeleton className="h-3 w-10" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <Skeleton className="h-3 w-20" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="w-full aurora-fade-in">
        {toolbar}
        <table className="w-full border-separate border-spacing-0">
          <TableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleColumnSort} />
        </table>
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Music className="h-8 w-8 text-[var(--aurora-text-tertiary)] opacity-40" />
          <p className="font-display-italic text-[22px] text-[var(--aurora-text-tertiary)]">
            Nothing here yet
          </p>
          <p className="text-xs text-[var(--aurora-text-tertiary)]">
            Scan a folder or add a song to begin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto aurora-fade-in">
      {toolbar}
      <table className="w-full border-separate border-spacing-0">
        <TableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleColumnSort} />
        <tbody key={animKey}>
          {songs.map((song, index) => (
            <SongRow key={song.id} song={song} index={index} onPlay={onPlay} animIndex={index} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

```
cd frontend && npm run build
```

Expected: no errors.

- [ ] **Step 6: Visual check**

In browser, go to All Songs view. Verify:
- Sort dropdown appears top-right above table
- Changing dropdown re-fetches and re-orders list
- Clicking "Title" or "Duration" column header sorts by that field
- Clicking same header again toggles ASC/DESC (arrow indicator appears)
- Dropdown and column header stay in sync (both show current sort)
- After deleting/editing a song, list re-fetches in current sort order (not reset to title-ASC)

- [ ] **Step 7: Commit**

```
git add frontend/src/components/songs/SongTable.tsx
git commit -m "feat(ui): add sort dropdown + sortable column headers to SongTable"
```

---

## Final verification

- [ ] Play a song. Reach end of queue. Confirm playback stops with song still visible in PlayerBar (not blank).
- [ ] Enable repeat-all. Reach end of queue. Confirm wraps to first song.
- [ ] Enable repeat-one. Let song end. Confirm same song replays. Press Next — confirm advances.
- [ ] Enable shuffle. Verify queue order changes. Disable shuffle. Verify original order restored.
- [ ] Shuffle + repeat-all: queue wraps after last shuffled song.
- [ ] Set volume to 0.4. Refresh. Volume still 0.4.
- [ ] Set volume to 0. Refresh. Unmute. Volume restores to previous non-zero level.
- [ ] Sort by Artist. Delete a song. List stays sorted by Artist.
