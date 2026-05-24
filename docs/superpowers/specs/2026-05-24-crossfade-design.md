# Crossfade Between Songs

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Backend (playlist schema) + Frontend (settings store, settings view, audio player, playlist UI)

---

## Overview

True crossfade: next song begins playing (at volume 0) before the current song ends, both fade simultaneously over the crossfade window. Songs overlap — this is not a fade-out → fade-in gap.

Three-tier configuration:
1. **Global default** — 5s, enabled. Stored in localStorage via `settingsStore`.
2. **Global override** — user-adjustable toggle + 1–12s slider in new Settings view.
3. **Per-playlist override** — inherit / on / off + optional duration. Stored in DB.

Manual skip always uses a short 1s fade regardless of crossfade settings.

---

## Backend

### Schema

Additive migration — no breaking changes:

```sql
ALTER TABLE playlists ADD COLUMN crossfade_enabled INTEGER DEFAULT NULL;
ALTER TABLE playlists ADD COLUMN crossfade_duration_s INTEGER DEFAULT NULL;
```

`NULL` = inherit global setting. `0` = gapless (crossfade disabled). `1–12` = override duration in seconds.

### API Changes

**Modified endpoints (no new endpoints):**
- `GET /playlists` + `GET /playlists/{id}` — return `crossfade_enabled` + `crossfade_duration_s` in response
- `PATCH /playlists/{id}` — accept optional `crossfade_enabled` (int | null) + `crossfade_duration_s` (int | null)

---

## Frontend

### Settings Store (`src/stores/settingsStore.ts`)

New Zustand store, persists to localStorage:

```ts
{
  crossfadeEnabled: boolean    // default: true
  crossfadeDuration: number    // default: 5
}
```

Actions: `setCrossfadeEnabled(enabled: boolean)`, `setCrossfadeDuration(seconds: number)`.  
Reads localStorage on init, writes on every change.

### Settings View (`src/components/settings/SettingsView.tsx`)

New view. Accessed via gear icon at bottom of sidebar. Uses `songStore.view = { kind: "settings" }` — same pattern as existing views.

**Layout:**
```
⚙ Settings

Audio
──────────────────────────────────────
Crossfade
Blend songs smoothly as they transition        [toggle]

Duration                                        5s
  1s ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 12s

Manual skip fade                               1s (fixed)
──────────────────────────────────────
```

Components:
- Toggle: shadcn `Switch`
- Duration slider: plain `<input type="range" min={1} max={12}>` (consistent with existing audio sliders)
- Duration label updates live as slider moves
- Duration row hidden (opacity-0, pointer-events-none) when crossfade disabled

Styling: `label-micro` headings, `--aurora-surface` glassmorphism panel, `aurora-divider-h` separators — matches existing dialog/panel aesthetic.

### Sidebar

Gear icon (`Settings` from lucide-react) added to sidebar footer, below playlist list. Clicking sets view to settings. Active state matches existing sidebar item highlight pattern.

### Per-Playlist Override (PlaylistDetail hero)

Crossfade chip in hero header action row (alongside Edit/Delete):

```
[✦ Crossfade: 5s ▾]   ← shows resolved value when inheriting
[✦ Gapless ▾]          ← shows when explicitly disabled
```

Clicking opens a small popover:
- **Inherit global** / **On** / **Off** — radio group (3 options)
- Duration slider (1–12s) — visible only when "On" selected
- Save → `PATCH /playlists/{id}` with updated fields
- On success: toast.success, close popover, refresh playlist

### Player Store (`src/stores/playerStore.ts`)

Add one field:
```ts
queuePlaylistId: number | null   // ID of playlist the current queue came from; null = not from a playlist
```

Set in `playSong()` — callers pass an optional `playlistId` param. `PlaylistDetail.handlePlaySong` passes `activePlaylist.id`; SongTable passes `null`.

### Audio Player (`useAudioPlayer.ts`)

**New ref:**
```ts
const nextHowlRef = useRef<Howl | null>(null)
```

**Crossfade resolution helper** (called inside poll interval):
```ts
function resolveXfade() {
  const { queuePlaylistId } = playerStore.getState()
  const playlist = queuePlaylistId
    ? playlistStore.getState().playlists.find(p => p.id === queuePlaylistId)
    : null
  const enabled = playlist?.crossfade_enabled ?? settingsStore.getState().crossfadeEnabled
  const duration = playlist?.crossfade_duration_s ?? settingsStore.getState().crossfadeDuration
  return { enabled: Boolean(enabled), duration }
}
```

**Poll interval additions** (inside existing 250ms interval, after seek update):

```
crossfadeActive = false  ← module-level flag, prevents re-triggering

Each tick:
  { enabled, duration } = resolveXfade(currentSong, activePlaylist)
  effectiveDuration = min(duration, howlDuration / 2)   ← clamp for short songs

  if enabled && !crossfadeActive && seek >= (howlDuration - effectiveDuration):
    crossfadeActive = true

    nextSong = peek playerStore.queue[queueIndex + 1]   ← no index advance yet
    if !nextSong or !nextSong.file_path: skip (find next valid)

    const vol = playerStore.getState().volume   ← current user volume (0–1)
    nextHowlRef.current = new Howl({ src: `/songs/${nextSong.id}/stream`, volume: 0, autoplay: true })
    howlRef.current.fade(vol, 0, effectiveDuration * 1000)
    nextHowlRef.current.fade(0, vol, effectiveDuration * 1000)

    setTimeout(effectiveDuration * 500):               ← midpoint
      playerStore.next()                               ← UI updates to next song

    setTimeout(effectiveDuration * 1000):              ← fade complete
      howlRef.current.unload()
      howlRef.current = nextHowlRef.current
      nextHowlRef.current = null
      crossfadeActive = false
```

**Manual skip fade** — before destroying Howl on next()/previous():
```ts
if (isPlaying) howlRef.current.fade(currentVolume, 0, 1000)
setTimeout(1000, () => { /* normal song-change effect runs */ })
```

**Crossfade cancellation** — if user manually skips during active crossfade:
```ts
// Detected in song-change effect when currentSong.id changes unexpectedly
nextHowlRef.current?.unload()
nextHowlRef.current = null
crossfadeActive = false
clearAllCrossfadeTimeouts()
```

**Gapless path** (enabled = false): poll interval skips crossfade block entirely. `onend` → `next()` as today.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Queue has only 1 song | Crossfade skipped; repeat/stop per repeat mode |
| Song shorter than crossfade duration | Clamp: `effectiveDuration = min(duration, howlDuration / 2)` |
| Next song has no file path | Peek skips invalid entries, finds next valid |
| Manual skip during active crossfade | Cancel fades, unload nextHowlRef, reset flag |
| Crossfade toggled off mid-playback | Takes effect on next transition |
| Shuffle active | Queue already reordered; peek at `queueIndex + 1` is correct |
| Repeat-one mode | Crossfade from current song back to itself |
| Per-playlist set to gapless | `enabled = false`, full gapless path |

---

## Out of Scope

- Gapless playback (zero-gap, no fade) for individual tracks — separate feature
- Per-song crossfade override
- Crossfade preview/auditioning in settings
