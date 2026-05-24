# Custom Playback Times Per Playlist

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Backend (schema + API) + Frontend (player + UI)

---

## Overview

Allow per-song start/end trim points scoped to a playlist. A song played from a playlist with trim times auto-seeks to `start_time_ms` and stops (advancing queue) at `end_time_ms`. Playing the same song outside a playlist context plays the full file.

---

## Backend

### Schema

Additive migration — no breaking changes:

```sql
ALTER TABLE playlist_songs ADD COLUMN start_time_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE playlist_songs ADD COLUMN end_time_ms   INTEGER NOT NULL DEFAULT 0;
```

`0` = not set. Player treats `0` as full song (no trim).

### API Changes

**New endpoint:**
```
PATCH /playlists/{playlist_id}/songs/{song_id}/timing
Body:  { "start_time_ms": int, "end_time_ms": int }
Response: 200 updated playlist_song row | 422 validation error
```

Validation rules (enforced in backend):
- Both values ≥ 0
- If both non-zero: `start_time_ms < end_time_ms`
- `end_time_ms` ≤ song duration (clamped server-side if song duration is known; skipped if duration is null)

**Modified endpoints:**
- `GET /playlists/{id}` — include `start_time_ms` + `end_time_ms` in each song object in response
- `POST /playlists/{id}/songs` — accept optional `start_time_ms` / `end_time_ms` (default 0)

---

## Frontend

### Type Changes

`PlaylistSong` in `src/types/index.ts`:
```ts
start_time_ms: number  // 0 = not set
end_time_ms: number    // 0 = not set
```

`Song` in `src/types/index.ts` — add optional fields so `useAudioPlayer.ts` can read them from `currentSong`:
```ts
start_time_ms?: number  // present when song was queued from a playlist with trim set
end_time_ms?: number
```

When `playSong()` is called from `PlaylistDetail`, the spread `{ ...song, ... }` already carries these values at runtime. Adding them to `Song` makes it TypeScript-visible. When played from SongTable, both fields are `undefined` → treated as 0 → no trim.

### Player (`useAudioPlayer.ts`)

Two changes inside existing code paths — no new effects, no new deps arrays:

1. **Auto-seek on load** — inside existing `onload` callback:
   ```ts
   if (currentSong.start_time_ms > 0) {
     howlRef.current.seek(currentSong.start_time_ms / 1000)
   }
   ```

2. **End-time enforcement** — inside existing seek-poll interval (runs every 250ms):
   ```ts
   if (currentSong.end_time_ms > 0 && seek * 1000 >= currentSong.end_time_ms) {
     if (repeatMode === "one") {
       howlRef.current.seek(currentSong.start_time_ms / 1000)
     } else {
       next()
     }
   }
   ```

`playerStore` — no changes. Timing data rides on the `currentSong` object.

### UI — Trim Panel in `PlaylistDetail`

#### Trigger

`Scissors` icon (lucide-react) added to `PlaylistSongRow` action buttons. Visible on row hover alongside existing ChevronUp/Down/X. Clicking toggles the trim panel.

Only one trim panel open at a time. `openTrimId: number | null` state lifted to `PlaylistDetail`, passed down as prop.

#### Panel Layout

Renders as a `<tr colspan={5}>` immediately below the song row when open:

```
┌─────────────────────────────────────────────────────────┐
│  [━━━━|████████████████████████████|━━━━━]              │
│       ▲ 0:14                  3:42 ▲                    │
│       start                    end                      │
│                                                         │
│  [Mark In]  [Mark Out]              [Reset]  [✓ Save]   │
└─────────────────────────────────────────────────────────┘
```

**Range bar:** Two stacked `<input type="range">` elements (same pattern as existing audio sliders per project rules). Selected zone uses `--aurora-accent-interactive`. Excluded zones dimmed to surface color.

**Playback dot:** If `currentSong.id === song.id`, a dot tracks `playerStore.seek` position on the bar.

**Timestamp labels:** Below each handle. Click to edit inline (`<input type="text">` validated as `M:SS` format).

**Mark In button:** Reads `playerStore.seek` → snaps start handle to that position. Disabled if song is not the current player song (tooltip: "Play song first").

**Mark Out button:** Same for end handle.

**Reset:** Sets both to 0, calls `PATCH` immediately, closes panel.

**Save:** Calls `PATCH /playlists/{id}/songs/{song_id}/timing`. On success: toast.success, close panel, refresh playlist. On failure: toast.error, panel stays open.

**Panel styling:** Same glassmorphism surface + `aurora-rim` border + `aurora-fade-in` transition as existing dialogs/panels.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| `start_time_ms >= end_time_ms` (both non-zero) | Save button disabled, inline error shown |
| `end_time_ms > song duration` | Clamped to duration server-side |
| Song not currently in player | Mark In/Out disabled with tooltip |
| API failure on Save | toast.error, panel stays open |
| Song played from SongTable (not playlist) | No trim applied — timing is playlist-scoped |
| Two rows both want trim panel open | Opening one closes the other (shared `openTrimId`) |

---

## Out of Scope

- Trim on songs played outside a playlist context
- Waveform visualization
- Per-song trim without playlist association
