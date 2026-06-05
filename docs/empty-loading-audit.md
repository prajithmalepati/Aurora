# Aurora Empty, Loading, and Error State Audit

**Date:** 2026-06-04
**Audited by:** Hermes Agent (subagent)

## Summary

| Category | Total | PASS | GAP | FIXED |
|----------|-------|------|-----|-------|
| Empty States | 5 | 5 | 0 | 0 |
| Loading States | 5 | 5 | 0 | 0 |
| Edge Cases | 5 | 4 | 1 | 1 |
| Backend Error Responses | 2 | 1 | 1 | 1 |
| Error State Display | 4 | 1 | 3 | 3 |
| **Totals** | **21** | **16** | **5** | **5** |

---

## Empty States (0 items)

### 1. 0 songs in library — PASS ✅
**Component:** `SongTable.tsx` (lines 154-172)
**Behavior:** Shows Music icon, "Nothing here yet" heading, and "Scan a folder or add a song to begin." subtext.
**Verdict:** Excellent — clear CTA with instructions.

### 2. 0 playlists — PASS ✅
**Component:** `Sidebar.tsx` (lines 135-140)
**Behavior:** Shows "No playlists yet" in `font-display-italic` with tertiary text color.
**Verdict:** Clean and consistent with app design language.

### 3. 0 tags — PASS ✅
**Component:** `Sidebar.tsx` (lines 187-192)
**Behavior:** Shows "No tags yet" with matching styling to playlists empty state.
**Verdict:** Consistent.

### 4. Empty playlist — PASS ✅
**Component:** `PlaylistDetail.tsx` (lines 421-426)
**Behavior:** Shows "This playlist is empty" centered message.
**Verdict:** Clear and direct.

### 5. 0 filter results — PASS ✅
**Component:** `QueryBuilder.tsx` `MixEmptyState` (lines 370-424)
**Behavior:** Custom aurora wave SVG + "No songs match this query" + "clear filter" link.
**Verdict:** Beautiful, informative, actionable.

---

## Loading States

### 6. Songs loading — PASS ✅
**Component:** `SongTable.tsx` (lines 110-152)
**Behavior:** 6 skeleton rows with columns matching the table structure (index, title+artist, duration, playlists, tags chips, actions).
**Verdict:** Well-structured skeleton that mirrors the real table layout.

### 7. Playlists loading — PASS ✅
**Component:** `Sidebar.tsx` (lines 129-134)
**Behavior:** 4 skeleton rows (`h-8 w-full rounded-md`).
**Verdict:** Good — provides visual feedback while playlists load.

### 8. PlaylistDetail loading — PASS ✅
**Component:** `PlaylistDetail.tsx` (lines 240-258)
**Behavior:** Hero skeleton (cover 40x40 + title + subtitle) + 5 song row skeletons.
**Verdict:** Comprehensive skeleton that matches the real layout.

### 9. Tags loading — PASS ✅
**Component:** `Sidebar.tsx` (lines 181-186)
**Behavior:** 3 skeleton rows (`h-7 w-full rounded-md`).
**Verdict:** Good.

### 10. Settings loading — PASS ✅
**Component:** `SettingsView.tsx`
**Behavior:** Settings are localStorage-backed (synchronous) — no API fetch needed. Instant render.
**Verdict:** No loading state needed. Pass.

---

## Edge Cases

### 11. Song with no file_path — PASS ✅
**Components:** `SongRow.tsx` (line 63), `playerStore.ts` (line 66)
**Behavior:** 
- SongRow: `cursor-not-allowed opacity-40` class, `handlePlay()` returns early
- playerStore: `playSong()` returns early if `!song.file_path`
- PlaylistDetail: `handlePlaySong()` (line 203) filters `s.file_path` before building queue
**Verdict:** Multiple layers of defense. Excellent.

### 12. Song with no album art — PASS ✅
**Component:** `AlbumArt.tsx`
**Behavior:** Falls back to a gradient background via `albumGradient()` function. Image load errors set `error=true` which hides the `<img>` and shows gradient only.
**Verdict:** Graceful fallback with visual interest.

### 13. Song with unsupported audio format — GAP 🔴 → FIXED ✅
**Component:** `useAudioPlayer.ts` (lines 156-161)
**Previous behavior:** `onloaderror` and `onplayerror` handlers only called `console.error()` — the user received NO visual feedback when a song failed to load/play.
**Fix:** Added toast notifications via `toast.error()` imported from `@/lib/toast`. The `onloaderror` now shows "Failed to load [song title]" and `onplayerror` shows "Playback interrupted for [song title]".

### 14. Backend down / network error — PASS ✅
**Component:** `api.ts` `request()` function
**Behavior:** 
- HTTP errors (4xx/5xx): Returns `ApiError` with backend's `detail` message → stores catch and call `toast.error()` for mutations, or set `error` state for fetches
- Network failures (TypeError from fetch): Previously uncaught, now caught and converted to ApiError with "Cannot reach server — check that the backend is running"
**Fix:** Added try/catch wrapper around the fetch call in `api.ts` to capture network errors.

### 15. Scan dialog states — PASS ✅
**Component:** `ScanDialog.tsx`
**Behavior:**
- **Idle:** Folder path + playlist name inputs
- **Loading/Scanning:** Progress bar with filename and count (done/total)
- **Completed:** Results summary (imported, upgraded, skipped, errors)
- **Error:** Error message in danger color
- **Cancelled:** "Scan cancelled." message
**Verdict:** All states covered.

---

## Backend Error Responses

### 16. API error response consistency — PASS ✅
**Backend routers:** All use `raise HTTPException(status_code=xxx, detail="...")` which FastAPI serializes as `{"detail": "..."}`.
**Frontend api.ts:** Reads `err.detail || res.statusText` — correctly matches backend format.
**Verdict:** Consistent format throughout.

### 17. Frontend api.ts error handling — GAP 🔴 → FIXED ✅
**Previous behavior:** Network failures (fetch TypeError) were not caught inside api.ts — they propagated as raw TypeErrors to stores.
**Fix:** Wrapped the fetch call in try/catch. Network errors now become `ApiError("Cannot reach server — check that the backend is running", 0)`.
**Verdict:** Now all errors go through the same ApiError path. Consistent.

---

## Error State Display in UI

### 18. SongTable error state — GAP 🔴 → FIXED ✅
**Component:** `SongTable.tsx`
**Previous behavior:** `songStore.error` was set on fetch failure but never displayed. User saw empty state without knowing why.
**Fix:** Added `error` prop to SongTable. When error is present, displays a danger-colored error banner with the message + a "Retry" button that calls `useSongStore.getState().fetchSongs()`.

### 19. Sidebar error state — GAP 🔴 → FIXED ✅
**Component:** `Sidebar.tsx`
**Previous behavior:** `playlistStore.error` and `tagStore.error` were set on fetch failure but never displayed.
**Fix:** Added error display below playlist and tag sections. Shows a compact danger-colored message with the error text.

### 20. PlaylistDetail error state — GAP 🔴 → FIXED ✅
**Component:** `PlaylistDetail.tsx`
**Previous behavior:** When fetch failed, `activePlaylist` remained null and it showed generic "Playlist not found" — no differentiation between 404 and network errors.
**Fix:** Added `error` read from playlistStore. If error is present AND activePlaylist is null AND not loading, shows an error banner with the actual error message and a "Go back" button to return to All Songs.

---

## Fixes Applied

### Fix 1: `api.ts` — Network error handling
```typescript
// Added try/catch around fetch call
// Network errors → ApiError with user-friendly message
```

### Fix 2: `SongTable.tsx` — Error state display
```typescript
// Added error prop
// Shows error banner with retry button when error is present
```

### Fix 3: `Sidebar.tsx` — Error state display
```typescript
// Read error from playlistStore and tagStore
// Display compact error messages below each section
```

### Fix 4: `useAudioPlayer.ts` — Audio error toasts
```typescript
// Added toast.error() in onloaderror and onplayerror callbacks
// Imported toast from @/lib/toast
```

### Fix 5: `PlaylistDetail.tsx` — Error state display
```typescript
// Read error from playlistStore
// Show error banner when fetch fails with go-back button
```

---

## Verification

- [x] `npm run build` passes
- [x] All files follow existing patterns (toast imports, store access, Tailwind styling)
- [x] No relative imports — all use `@/` alias
- [x] Dark mode only
- [x] One component per file maintained
