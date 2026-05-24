# Offline Player Completeness — Design Spec

**Date:** 2026-05-23  
**Scope:** 4 gaps to close before packaging / online phase  
**Status:** Approved

---

## Context

Aurora is feature-complete for its custom tag/filter system. This spec closes the 4 missing standard offline music player features identified in the Session 21 audit, plus a bug-check pass on affected code paths.

---

## Gap 1 — Repeat Modes

### What
Add `repeatMode: 'none' | 'all' | 'one'` to `playerStore`.

### Behavior
- `'none'` — queue ends, playback stops (current behavior)
- `'all'` — when `next()` reaches end of queue, wrap to index 0
- `'one'` — `next()` replays the current song (same `queueIndex`)

### Implementation
- Add `repeatMode` field and `cycleRepeat()` action to `playerStore`
- Modify `next()` to branch on `repeatMode`
- PlayerBar: add repeat button (cycles `none → all → one → none`), visual state per mode (icon changes or dim/active/badge)

---

## Gap 2 — Shuffle

### What
Add `isShuffled: boolean`, `originalQueue: Song[]` to `playerStore`. Add `toggleShuffle()` action.

### Behavior
- **Enable:** deep-copy current `queue` into `originalQueue`, shuffle `queue` in place (reuse `shuffleArray` logic from `filterStore`), update `queueIndex` to new position of `currentSong`
- **Disable:** restore `queue` from `originalQueue`, update `queueIndex` to position of `currentSong` in restored order, clear `originalQueue`
- `playSong()` clears `originalQueue` and resets `isShuffled: false` (new queue = fresh state)

### Implementation
- Add fields + `toggleShuffle()` to `playerStore`
- PlayerBar: add shuffle button, dim when off / accent when on

---

## Gap 3 — Sort Options

### What
Sort the song library by: `title` (default) | `artist` | `album` | `duration` | `date_added`.  
Direction: ASC/DESC toggle for all fields.

### Backend
- Add `sort: str` and `order: str` (`asc` | `desc`) query params to `GET /songs`
- Allowlist: `['title', 'artist', 'album', 'duration', 'created_at']` — reject others with 400
- Default: `title ASC`

### Frontend — dual control
1. **Sort dropdown** in `SongTable` toolbar (above table, right-aligned). Shows current sort field + direction arrow. Options: Title, Artist, Album, Duration, Date Added.
2. **Clickable column headers** in `SongTable`. Click = sort by that column; click again = toggle ASC/DESC. Show arrow indicator on active column header.

Both controls are in sync — selecting one updates the other's visual state.

### State
Add `sortField` and `sortOrder` to `songStore` (or local state in `SongTable` — prefer local since sort is a view concern, not persisted). `fetchSongs()` receives sort params.

---

## Gap 4 — Volume Persistence

### What
Remember volume level across page refresh via `localStorage`.

### Implementation
- On `setVolume()`: `localStorage.setItem('aurora-volume', String(clamped))`
- On store init: read `localStorage.getItem('aurora-volume')`, parse as float, clamp to `[0,1]`, use as initial `volume` value (fallback `0.7`)
- `preMuteVolume` initializes from same value
- No persistence for `isPlaying`, `currentSong`, or seek position (those reset on refresh — intentional)

---

## Bug Check Scope

While touching `playerStore` and `PlayerBar`, audit:

1. **End-of-queue edge case** — `next()` when `repeatMode === 'none'` and at last track: verify `isPlaying` sets to `false`, `currentSong` stays (don't nullify — PlayerBar should show last song paused, not blank)
2. **Seek reset on song change** — verify `seek: 0` is set in `playSong()`, `next()`, `previous()` (prevent stale seek bar)
3. **Shuffle + repeat interaction** — `repeat-one` with shuffle enabled: `next()` should still replay current (repeat-one wins)
4. **Mute restore** — if volume is loaded from localStorage as 0, `preMuteVolume` must not also be 0 (would trap user in mute). Init: if stored volume is 0, set `preMuteVolume: 0.7`

---

## Out of Scope

- Queue visualization UI
- Crossfade
- Album / Artist browse views
- Keyboard shortcuts for repeat/shuffle (can add later)
