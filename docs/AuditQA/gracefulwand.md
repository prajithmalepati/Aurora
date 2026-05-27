# Session 30 Plan — Aurora Bug Fixes + Motion Animation Upgrade

## Context

Session 29 fixed A1 (audio silence), A3 (waveform seek), and the duplicate-key / codec bugs.
Remaining: A2/A4/A5/A6 (bug fixes), B1/B2 (features), then Motion animation upgrade from DeepSeek's audit (motion v12 is already installed, zero usage).

Execute phases in order. Do not skip ahead.

---

## Phase A — Bug Fixes

### A2 — Eliminate App.tsx re-render cascade on song change

**Problem:** `useAuroraColor()` is called in App.tsx (line 34). It holds `color2Linear` state that updates on every song change → App root re-renders → all children re-render.

`AuroraColorBridge.tsx` exists (returns null, calls `useAuroraColor()`) but is **not mounted anywhere** — it was an aborted attempt.

**Fix:**
1. Remove `useAuroraColor()` call from `App.tsx` (line 34). Remove `color1LinearRgb`, `color2LinearRgb` vars. Remove import.
2. Move linear RGB computation **into `AuroraCanvas.tsx`**: subscribe to `playerStore.currentSong` directly, call `oklchToLinearRgb()` inside the canvas component to feed shader uniforms. Remove `auroraColor1` / `auroraColor2` props from `AppShell` and `AuroraCanvas`.
3. Mount `<AuroraColorBridge />` inside `App`'s return JSX (before `<AppShell>`) — this handles only the CSS var side effects (no state, returns null, never cascades).
4. Update `AppShell.tsx` interface to remove those two props.

**Result:** Song change re-renders only `AuroraColorBridge` (null render) + `AuroraCanvas` (leaf WebGL). App root stays still.

**Files:** `App.tsx`, `hooks/useAuroraColor.ts`, `components/aurora/AuroraCanvas.tsx`, `components/aurora/AuroraColorBridge.tsx`, `components/layout/AppShell.tsx`

---

### A4 — WebGL context loss 5-second CSS fallback

**Problem:** `onContextLost` handler exists (line 253) but relies entirely on `webglcontextrestored` event. If GPU never recovers (memory pressure, driver crash), canvas stays blank forever.

**Fix:** In `onContextLost`, set a 5s timeout. If `glRef.current` is still null when it fires, call `setWebglFailed(true)` to show CSS fallback.

```typescript
const onContextLost = (e: Event) => {
  e.preventDefault()
  if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  glRef.current = null
  fallbackTimer = window.setTimeout(() => {
    if (!glRef.current) setWebglFailed(true)
  }, 5000)
}
// cancel timer in onContextRestored and cleanup
```

**File:** `components/aurora/AuroraCanvas.tsx:253-269`

---

### A5 — Crossfade pause/resume guard

**Problem:** `useAudioPlayer.ts:202` calls `prevHowlRef.current?.play()` unconditionally when `isPlaying` toggles true. If fade is 95% done, this restarts a near-silent outgoing Howl.

**Fix:** Guard with volume check before resuming prevHowl:

```typescript
if (prevHowlRef.current && prevHowlRef.current.volume() > 0.05) {
  prevHowlRef.current.play()
}
```

`pause()` on prevHowl (line 204) stays — correct to pause fading-out audio when user pauses.

**File:** `hooks/useAudioPlayer.ts:202`

---

### A6 — AuroraCanvas reduced-motion dynamic listener

**Problem:** `AuroraCanvas.tsx:243` checks `prefers-reduced-motion` once at mount. If user enables it after mount, canvas keeps animating.

**Fix:** Add MQL change listener (same pattern as `WaveformBar.tsx`):

```typescript
const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
if (mql.matches) { setWebglFailed(true); return }

const onMotionChange = (e: MediaQueryListEvent) => {
  if (e.matches) {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  } else {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw)
  }
}
mql.addEventListener('change', onMotionChange)
// cleanup: mql.removeEventListener('change', onMotionChange)
```

**File:** `components/aurora/AuroraCanvas.tsx:240-270`

---

## Phase B — Features

### B1 — Unified AuroraPlayButton component

**Problem:** Play button is duplicated inline in 3 places with slightly different sizing. No shared component.

**Create:** `src/components/player/AuroraPlayButton.tsx`

Variants:
- `'player-desktop'` — w-11 h-11, 18px icons (current desktop)
- `'player-mobile'` — w-10 h-10, 16px icons (current mobile)
- `'row'` — existing aurora-play-btn style (hidden, hover-reveal in SongRow)

Props: `variant`, `isPlaying`, `isBuffering`, `disabled`, `onClick`

Star bloom span is shared across player variants. Row variant is the minimal circular button.

Replace inline play buttons in:
- `PlayerBar.tsx:151-183` (mobile) → `<AuroraPlayButton variant="player-mobile" />`
- `PlayerBar.tsx:280-312` (desktop) → `<AuroraPlayButton variant="player-desktop" />`
- `SongRow.tsx:109-118` → `<AuroraPlayButton variant="row" />`

**Files:** `components/player/AuroraPlayButton.tsx` (new), `components/layout/PlayerBar.tsx`, `components/songs/SongRow.tsx`

---

### B2 — Sort in PlaylistDetail

**Problem:** PlaylistDetail shows songs in server order only. No sort UI.

**Approach:** Local sort state in PlaylistDetail component (NOT via `songStore.sortSongs` — that re-fetches the main song list). Client-side sort of already-loaded playlist songs.

Add to PlaylistDetail:
```typescript
const [sortField, setSortField] = useState<'title'|'artist'|'album'|'duration'>('title')
const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc')

const sortedSongs = useMemo(() => {
  return [...filteredSongs].sort((a, b) => { /* by sortField/sortOrder */ })
}, [filteredSongs, sortField, sortOrder])
```

Add sort dropdown near the search input (line ~341-364 area). Same dropdown options as SongTable minus `created_at` (use playlist position instead — or include it as "Position" for original order).

Render `sortedSongs` instead of `filteredSongs` in tbody.

**File:** `components/playlists/PlaylistDetail.tsx`

---

## Phase C — Motion Animation Upgrade (DeepSeek Tier 0-1)

`motion` v12.38.0 is in `package.json` but **not imported anywhere**. These replace existing CSS `@keyframes` and improve animation quality with spring physics.

### C0 — Layout prop (20 min, highest ROI)

Add `layout` prop to 3 containers so all layout shifts animate via spring:

```tsx
// AppShell.tsx — main grid
<motion.div layout transition={{ type:"spring", stiffness:400, damping:33 }} className="...grid...">

// Sidebar.tsx — sidebar column  
<motion.div layout="position" className="...">

// PlayerBar desktop wrapper (line 208)
<motion.div layout className={cn("hidden sm:block playerbar-collapsible", ...)}>
```

---

### C1 — View transitions (1h)

Replace CSS `aurora-view-enter` / `aurora-fade-up` with `AnimatePresence` in `App.tsx:renderMainContent()`:

```tsx
import { AnimatePresence, motion } from "motion/react"

<AnimatePresence mode="wait">
  <motion.div
    key={view.kind === "playlist" ? `playlist-${view.playlistId}` : view.kind}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ type: "spring", stiffness: 280, damping: 30 }}
  >
    {content}
  </motion.div>
</AnimatePresence>
```

Remove `aurora-view-enter` and `aurora-fade-up` keyframe blocks from `index.css`.

---

### C2 — Song change transition (30 min)

Replace `<div key={currentSong.id} className="aurora-song-fade">` (both mobile line 73, desktop line 228) with `motion.div`. This properly handles the remount animation AND eliminates the confusing `key` usage on static elements:

```tsx
<motion.div
  key={currentSong.id}
  initial={{ opacity: 0, y: 8, scale: 0.97 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ type: "spring", stiffness: 260, damping: 26 }}
>
  <AlbumArt ... />
</motion.div>
```

Same for title `<span key={currentSong.id}>` → wrap parent div with motion. Remove `aurora-song-fade` keyframe from `index.css`.

---

### C3 — SongRow stagger (45 min)

Wrap `<SongRow>` in `motion.div` in `SongTable.tsx`:

```tsx
<motion.div
  key={song.id}
  initial={{ opacity: 0, y: 6 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.02, type: "spring", stiffness: 300, damping: 28 }}
>
  <SongRow song={song} ... />
</motion.div>
```

Remove `aurora-row-in` keyframe from `index.css`. Remove `--idx` CSS var trick.

---

### C4 — Nav active indicator layoutId (10 min)

In `Sidebar.tsx` NavItem, replace the static active background span with:

```tsx
{isActive && (
  <motion.span
    layoutId="nav-active"
    className="absolute inset-0 rounded-md pointer-events-none"
    style={{ background: "var(--aurora-surface)" }}
    transition={{ type: "spring", stiffness: 450, damping: 35 }}
  />
)}
```

Active indicator slides between nav items instead of jumping.

---

### C5 — PlayerBar expand spring (30 min)

Replace `grid-template-rows` CSS transition (line 208) with `motion.div` height spring:

```tsx
<motion.div
  animate={{ height: isIdle ? 52 : 80 }}
  transition={{ type: "spring", stiffness: 200, damping: 25 }}
  className="hidden sm:block overflow-hidden"
>
```

Remove `playerbar-collapsible` / `expanded` class + CSS transition.

---

## Import Convention

All Motion imports use `"motion/react"` (not `"framer-motion"`):
```typescript
import { motion, AnimatePresence } from "motion/react"
```

---

## Verification

After each phase:
- `cd frontend && npm run build` — no TS errors
- Hard-refresh browser, test affected feature
- Phase A: play/pause/skip, GPU tab switch, reduce-motion toggle in OS
- Phase B: PlaylistDetail sort dropdown, AuroraPlayButton renders in all 3 locations
- Phase C: View transitions smooth, song change animates, rows stagger in on filter

Process: Append JOURNAL entry + update HANDOFF.md after Phase B completes.

claude --resume 31c5cd95-aa3d-4d69-b6a4-2e89f19e0313
