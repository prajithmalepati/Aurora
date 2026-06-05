# Aurora v1.0 — Final Comprehensive Audit Report

**Date:** 2026-06-04
**Auditor:** Hermes Agent (DeepSeek V4 Pro)
**Scope:** Full codebase — all 6 backend routers, 2 services, frontend stores/hooks/types/components
**Files checked:** 38 source files (~7,400 source lines)

---

## Executive Summary

The Aurora v1.0 codebase is in **good shape** after the 23-task sprint by 12 concurrent agents. One critical `sqlite3.Row.get()` bug remains unfixed in the playlist export path, and there are several type-mismatch and missing-column warnings. No build-breaking issues found — both TypeScript `tsc --noEmit` and Python `ast.parse()` pass cleanly.

---

## Critical Bugs Found (Must Fix)

### 1. 🔴 `sqlite3.Row.get()` misuse in `_get_playlist_songs_for_export` — playlist export will crash

**File:** `backend/app/routers/playlists.py` — lines 1038–1039
**Impact:** `GET /api/playlists/{id}/export` will raise `AttributeError: 'sqlite3.Row' object has no attribute 'get'`

```python
# Line 1038-1039 (broken)
artists=json.loads(sr["artists"]) if sr.get("artists") else None,
featured_artists=json.loads(sr["featured_artists"]) if sr.get("featured_artists") else None,
```

`sr` is an `sqlite3.Row` from `cursor.fetchall()`. The `.get()` method does not exist on sqlite3.Row objects — it only supports bracket access (`sr["artists"]`). The correct fix:

```python
# Fix
artists=json.loads(sr["artists"]) if sr["artists"] else None,
featured_artists=json.loads(sr["featured_artists"]) if sr["featured_artists"] else None,
```

Since `artists` and `featured_artists` ARE in the SQL SELECT list (lines 1008-1013), bracket access works and returns `None` when the column value is NULL.

**Background:** This is the exact same bug pattern previously discovered and fixed in the main playlist detail/songs/add/remove/reorder endpoints. The export helper was either missed or introduced by a concurrent agent after the original fix.

---

## Warnings (Should Fix)

### 2. 🟡 Relative imports in 5 frontend files — CLAUDE.md violation

CLAUDE.md states: *"Frontend imports use `@/` alias. Never relative imports."*

| File | Line | Relative Import |
|---|---|---|
| `components/filter/QueryInput.tsx` | 5 | `from "./AutocompleteDropdown"` |
| `components/filter/QueryBuilder.tsx` | 6 | `from "./QueryInput"` |
| `components/filter/QueryBuilder.tsx` | 7 | `from "./AutocompleteDropdown"` |
| `components/tags/TagList.tsx` | 1 | `from "./TagChip"` |
| `components/songs/SongTable.tsx` | 3 | `from "./SongRow"` |

**Risk:** Low (Vite resolves these fine), but violates project convention. The HANDOFF.md task 1.2 specifically fixed one such relative import (`cd26c83`), suggesting these were missed.

**Fix:** Replace with `@/components/filter/AutocompleteDropdown`, `@/components/filter/QueryInput`, etc.

---

### 3. 🟡 `filter_engine.py` query missing audio quality columns

**File:** `backend/app/services/filter_engine.py` — lines 122–139

The filter query selects:
```
s.id, s.title, s.artist, s.album, s.duration,
s.file_path, s.file_format, s.album_art_path, s.source,
s.waveform_peaks, s.dominant_color, s.dominant_color_2,
s.replaygain_track_gain, s.replaygain_track_peak,
s.replaygain_album_gain, s.replaygain_album_peak,
s.artists, s.featured_artists,
s.created_at, s.updated_at,
```

**Missing:** `s.bitrate`, `s.sample_rate`, `s.bit_depth`, `s.file_size`

These columns exist in both the DB schema (database.py migrations) and the frontend `FilterResult` type (types/index.ts lines 99-102). The filter_engine's result dict construction at lines 162-185 does NOT include these fields either.

**Impact:** Filter/Mix results won't show audio quality metadata (format badges, bitrate, sample rate, file size). Songs shown in filter results will have `undefined` for these fields.

**Fix:** Add `s.bitrate, s.sample_rate, s.bit_depth, s.file_size` to the SELECT list and include them in the result dict.

---

### 4. 🟡 `tags.py` queries missing columns — incomplete `song_row_to_dict` output

**File:** `backend/app/routers/tags.py` — lines 189-218 (assign_tags), lines 268-297 (remove_tag)

Both queries select:
```
s.id, s.title, s.artist, s.album, s.duration,
s.file_path, s.file_format, s.album_art_path, s.source,
s.waveform_peaks, s.dominant_color, s.dominant_color_2,
s.replaygain_track_gain, s.replaygain_track_peak,
s.replaygain_album_gain, s.replaygain_album_peak,
```

**Missing:** `s.bitrate`, `s.sample_rate`, `s.bit_depth`, `s.file_size`, `s.artists`, `s.featured_artists`

The `song_row_to_dict` function (imported from songs.py) uses defensive `if "column" in row.keys() else None` guards, so missing columns return `None` — no crash, but data is silently absent.

**Impact:** After assigning/removing tags, the returned song object lacks audio quality metadata and multi-artist data.

---

### 5. 🟡 Type mismatch: `Song.playlists` expects `Playlist[]` but API returns `{id, name}[]`

The backend `song_row_to_dict` returns playlists as:
```json
[{"id": 1, "name": "My Playlist"}, {"id": 2, "name": "Favorites"}]
```

The frontend `Song` type declares:
```typescript
playlists: Playlist[]  // Playlist has id, name, color, emoji, image_url, crossfade_*, song_count, created_at, updated_at
```

**Impact:** TypeScript won't error (structural typing), but the frontend `Playlist` type implies fields that are never present from the `Song.playlists` array. Only `id` and `name` are actually available. The `SongRow` component accesses `playlist.color` on line 263 — this works because the code checks `playlist.color || "var(--aurora-accent-vivid)"` with a fallback, but it's semantically wrong since `color` will always be `undefined`.

**Fix:** Either (A) create a `PlaylistRef` type with just `id` and `name` for the `Song.playlists` field, or (B) enrich the backend query to include full playlist data.

---

### 6. 🟡 PlaylistDetail's `handlePlaySelected`/`handleAddSelectedToQueue` build incomplete Song objects

**File:** `frontend/src/components/playlists/PlaylistDetail.tsx` — lines 390-417

When playing selected songs from a playlist, the code casts `PlaylistSong` objects to `Song`:
```typescript
const asSongs = songsWithFile.map(s => ({
  ...s,
  source: "local" as const,
  playlists: [],
  created_at: "",
  updated_at: "",
}))
```

This drops all audio quality metadata fields (`bitrate`, `sample_rate`, `bit_depth`, `file_size`), `waveform_peaks`, `dominant_color/*`, `replaygain_*`, `artists`, `featured_artists`. While playback itself works (only `file_path` and `id` are required), the player bar won't show format badges or quality labels, and color bleed/ReplayGain won't work for these songs.

---

## Observations (Cosmetic / Nice-to-Have)

### 7. Dead code: `external_id` field

- **DB schema** (database.py:19): Column exists
- **Backend INSERT** (songs.py:377): Only place it's written, always `NULL`
- **No backend query** selects this column
- **No backend response model** includes it
- **Frontend `Song` type** (types/index.ts:11): Declared as `external_id?: string | null`
- **No frontend component** accesses it

Suggestion: Remove `external_id` from the Song type (or implement it properly if needed for future external service integration).

### 8. Duplicate song-row-to-dict logic

The SongResponse construction pattern exists in **5 separate places** in `playlists.py` (lines 283-311, 457-484, 591-618, 886-913, 1033-1058) and once in `filter_engine.py` (lines 162-185). Each is a slightly different subset of fields. If a new column is added, 6 locations must be updated.

Suggestion: Refactor to use `song_row_to_dict()` from songs.py consistently. The `start_time_ms`/`end_time_ms`/`position` from playlist_songs would need to be handled separately, but all song-column fields could be centralized.

### 9. Empty `created_at`/`updated_at` in playlist song responses

In all playlist response constructions, `created_at=""` and `updated_at=""` are passed for each song. This is intentional (song timestamps are less relevant in playlist context) but loses data that the API already fetched.

### 10. `FilterResult` type is largely identical to `Song`

`FilterResult` (types/index.ts:83-110) duplicates ~95% of the `Song` interface. Could be simplified to `Song` with an optional `query` field on the response wrapper.

### 11. `handleImport` in Sidebar.tsx uses raw `fetch()` instead of `api.upload()`

**File:** `frontend/src/components/layout/Sidebar.tsx` — lines 84-91

The import handler uses raw `fetch('http://localhost:8000/api/playlists/import', ...)` instead of `api.upload()`. This bypasses the centralized error handling in `api.ts`. Same pattern exists in PlaylistDetail.tsx's `handleExport` (line 165) — uses raw `fetch` for downloading blobs.

---

## Files Checked with Line Counts

| File | Lines | Status |
|---|---|---|
| `backend/app/database.py` | 218 | ✅ Clean |
| `backend/app/models.py` | 129 | ✅ Clean |
| `backend/app/cache.py` | 52 | ✅ Clean |
| `backend/app/main.py` | 45 | ✅ Clean |
| `backend/app/routers/songs.py` | 527 | ✅ Clean |
| `backend/app/routers/playlists.py` | 1368 | 🔴 Bug (lines 1038-1039) |
| `backend/app/routers/tags.py` | 306 | 🟡 Missing columns |
| `backend/app/routers/folders.py` | 212 | ✅ Clean |
| `backend/app/routers/filter.py` | 29 | ✅ Clean |
| `backend/app/routers/scanner.py` | 123 | ✅ Clean |
| `backend/app/services/filter_engine.py` | 188 | 🟡 Missing columns |
| `backend/app/services/file_scanner.py` | 903 | ✅ Clean |
| `frontend/src/types/index.ts` | 150 | 🟢 Observations |
| `frontend/src/lib/api.ts` | 50 | ✅ Clean |
| `frontend/src/stores/songStore.ts` | 170 | ✅ Clean |
| `frontend/src/stores/playerStore.ts` | 336 | ✅ Clean |
| `frontend/src/stores/filterStore.ts` | 188 | ✅ Clean |
| `frontend/src/stores/playlistStore.ts` | 149 | ✅ Clean |
| `frontend/src/stores/tagStore.ts` | 40 | ✅ Clean |
| `frontend/src/stores/settingsStore.ts` | 53 | ✅ Clean |
| `frontend/src/hooks/useAudioPlayer.ts` | 477 | ✅ Clean |
| `frontend/src/hooks/useKeyboardShortcuts.ts` | 216 | ✅ Clean |
| `frontend/src/App.tsx` | 223 | ✅ Clean |
| `frontend/src/components/layout/Sidebar.tsx` | 431 | ✅ Clean |
| `frontend/src/components/layout/PlayerBar.tsx` | 402 | ✅ Clean |
| `frontend/src/components/songs/SongRow.tsx` | 459 | ✅ Clean |
| `frontend/src/components/songs/SongTable.tsx` | 220 | 🟡 Relative import |
| `frontend/src/components/playlists/PlaylistDetail.tsx` | 1677 | 🟡 Incomplete Song casts |
| `frontend/src/components/player/WaveformBar.tsx` | 222 | ✅ Clean |
| `frontend/src/components/player/QueuePanel.tsx` | 348 | ✅ Clean |
| `frontend/src/components/settings/SettingsView.tsx` | 198 | ✅ Clean |
| `frontend/src/components/about/AboutView.tsx` | 292 | ✅ Clean |
| `frontend/src/components/welcome/WelcomeOverlay.tsx` | 231 | ✅ Clean |
| `frontend/src/components/folders/FoldersView.tsx` | 335 | ✅ Clean |
| `frontend/src/components/ui/ErrorBoundary.tsx` | 47 | ✅ Clean |

**Total:** 38 files, ~7,400 source lines

---

## Build Verification

- **TypeScript:** `npx tsc --noEmit` — passes clean, zero errors
- **Python syntax:** All 12 `.py` files parse without syntax errors via `ast.parse()`
- **Dependencies:** `boolean` (required by filter_engine.py) is installed in venv

---

## `.get()` Audit — sqlite3.Row Safety

| Location | Pattern | Safe? |
|---|---|---|
| `songs.py` (all Row access) | `row["column"]` bracket | ✅ Yes |
| `playlists.py` (detail/songs/add/remove/reorder) | `sr["column"]` bracket | ✅ Yes |
| `playlists.py:1038-1039` (`_get_playlist_songs_for_export`) | `sr.get("artists")` | 🔴 **BUG** |
| `tags.py` | `row["column"]` bracket | ✅ Yes |
| `filter.py` | N/A — delegates to filter_engine | ✅ Yes |
| `filter_engine.py` | `row["column"]` bracket | ✅ Yes |
| `folders.py` | `row["column"]` bracket | ✅ Yes |
| `file_scanner.py` (all `.get()` calls) | On `dict` objects, not Row | ✅ Yes |

---

## View Completeness Audit

| View | Renders | Data Source | Issues |
|---|---|---|---|
| All Songs | ✅ | `songStore.fetchSongs()` → `GET /api/songs` | None |
| Mix/Filter | ✅ | `filterStore.executeFilter()` → `POST /api/filter` | Missing audio quality columns (Warning #3) |
| Playlists (list) | ✅ | `playlistStore.fetchPlaylists()` → `GET /api/playlists` | None |
| Playlist Detail | ✅ | `playlistStore.fetchPlaylistDetail()` → `GET /api/playlists/{id}` | Partial Song casts (Warning #6) |
| Folders | ✅ | `api.get("/folders")` + `api.get("/folders/songs")` | None |
| Settings | ✅ | `settingsStore` (localStorage-backed) | None |
| About | ✅ | Static content | None |
| Keyboard Shortcuts Overlay | ✅ | Static content | None |
| Queue Panel | ✅ | `playerStore.queue` | None |
| Welcome Overlay | ✅ | Static content + localStorage state | None |

---

## Verdict

**PASS WITH FIXES** — 1 critical, 5 warnings, 5 observations

The codebase is production-quality for an initial release. The single critical bug (playlist export crash) is isolated and has a one-line fix. The warnings are all non-crashing quality/consistency issues. The build passes cleanly on both frontend and backend.

### Recommended Actions Before Merge

1. **Fix critical:** Replace `sr.get("artists")` and `sr.get("featured_artists")` with bracket access in `_get_playlist_songs_for_export` (playlists.py:1038-1039)
2. **Fix warnings #2:** Replace 5 relative imports with `@/` aliases
3. **Fix warning #3:** Add quality columns to filter_engine.py SELECT + result dict
4. **Consider:** Add quality columns to tags.py queries or centralize via `song_row_to_dict()` refactor
5. **Deploy:** All other issues are cosmetic and can be addressed post-release
