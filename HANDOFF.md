# Aurora — Session Handoff

## Current State (April 21, 2026)
Backend: 100% complete. All endpoints working — Songs CRUD, Tags CRUD + assignment, Playlists CRUD + song management + reorder, Filter (boolean AND/OR/NOT with parentheses), Scanner (folder scan with mutagen), Audio streaming. `file_format` column added to songs table (backfilled from file_path extension on startup).

Frontend: Full UI overhaul complete. "Northern Lights Over OLED Black" design system applied across all views. Mix page redesigned as compact command zone. PlayerBar idle/playing states with breathing-open transition. Tag-entry vs manual-entry modes in Mix. Surface elevation token scale added. Sidebar polished. Global keyboard shortcuts. Wake lock, error boundary, view transitions. File format displayed inline after duration in all song lists.

CORS: `allow_origins` now covers ports 5173, 5174, 5175.

## Design System — "Northern Lights Over OLED Black"

### Color Token Table

| Token | Hex / Value | Purpose |
|-------|-------------|---------|
| `--aurora-primary` | `#4db8a4` | Primary actions, active nav, seek bar fill, links |
| `--aurora-primary-hover` | `#5ec9b5` | Primary hover state |
| `--aurora-primary-glow` | `rgba(77,184,164,0.18)` | Subtle box-shadows, focus halos |
| `--aurora-secondary` | `#8a75c8` | Secondary/creative actions (Jam button), playlist accents |
| `--aurora-secondary-hover` | `#9b88d6` | Secondary hover state |
| `--aurora-secondary-glow` | `rgba(138,117,200,0.15)` | Secondary ambient shadows |
| `--aurora-tertiary` | `#c49a6c` | Warm amber accent — rarest aurora light, third palette voice |
| `--aurora-tertiary-hover` | `#d4aa7c` | Tertiary hover state |
| `--aurora-tertiary-glow` | `rgba(196,154,108,0.12)` | Tertiary ambient shadows |
| `--aurora-glow` | `rgba(77,184,164,0.12)` | Global hover glow, button shine |
| `--aurora-muted` | `rgba(255,255,255,0.14)` | Borders, dividers, inactive chips, disabled outlines |
| `--aurora-surface` | `rgba(255,255,255,0.04)` | Glass panels, cards, elevated containers |
| `--aurora-surface-hover` | `rgba(255,255,255,0.065)` | Surface on hover |
| `--aurora-surface-border` | `rgba(255,255,255,0.07)` | Surface container borders |
| `--aurora-text` | `#e8e6e3` | Primary text — warm near-white (not pure #fff) |
| `--aurora-text-secondary` | `#8b95a7` | Metadata, subtitles, timestamps |
| `--aurora-text-tertiary` | `#4b5563` | Placeholders, empty states, very dim text |
| `--aurora-text-disabled` | `#2a2f3a` | Disabled elements |
| `--aurora-danger` | `#f87171` | Destructive actions, errors |
| `--aurora-warning` | `#fbbf24` | Warnings |
| `--aurora-rim` | `rgba(255,255,255,0.06)` | Inset keyline borders on glass surfaces |
| `--aurora-accent-muted` | `#459687` | Muted teal — play button fill, seek/volume bar fill, equalizer bars at rest. Same hue as `--aurora-primary`, ~15% less saturated/bright. Hover on play button transitions to full `--aurora-primary` (200ms). |

Legacy aliases (`--aurora-text-dim` → `--aurora-text-secondary`, `--aurora-text-muted` → `--aurora-text-tertiary`) are preserved in CSS for backward compatibility.

### Typography
- **Display font**: Fraunces (variable serif) — headings, logo, playlist names, "Mix" title
- **Body font**: Geist Variable (sans-serif) — UI text, labels, metadata
- **Monospace**: SF Mono / Menlo / ui-monospace — query input, operator keys

### Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `Space` | Play / Pause | When no text input is focused |
| `→` (ArrowRight) | Next track | When no text input is focused |
| `←` (ArrowLeft) | Previous track | When no text input is focused |
| `M` | Mute / Unmute | When no text input is focused |
| `/` | Focus Mix query input (navigates to Mix if needed) | When no text input is focused |
| `Escape` | Blur any focused input | Always |

Registered in `App.tsx` via `useCallback` + `window.addEventListener("keydown", ...)`. All shortcuts check `document.activeElement.tagName` to avoid firing while typing.

## Completed This Session (April 21 — Session 11)

### Feature 1: Jam as primary gradient CTA + floating action zone

**Goal:** Elevate Jam from a cluster button to the headline feature. Add a scroll-aware floating zone so Search + Jam are reachable from anywhere in Mix results.

**Jam button redesign:**
- Removed from the top-right button cluster.
- Inline position: right-aligned row between the query bar and results (always visible in full QueryBuilder mode).
- Size: 50px height, `28px` horizontal padding, `border-radius: 999px`.
- Fill: `linear-gradient(135deg, --aurora-primary → --aurora-secondary)` diagonal.
- Label: "Jam" in Fraunces display font (`font-display text-[18px] font-medium`).
- Icon: `Sparkles` at `18×18px`.
- Hover: `scale(1.02)` + expanded teal/violet glow.
- CSS class: `.mix-jam-primary`.

**Floating action zone:**
- `position: fixed; bottom: 112px; right: 32px; z-index: 30` — 32px above the 80px PlayerBar.
- Glass pill: `rgba(15,15,18,0.9)` + `backdrop-filter: blur(20px)` + 1px `rgba(77,184,164,0.18)` border.
- Contents: compact "Search" (transparent, 34px) on left + gradient "Jam" pill (48px) on right.
- Visibility: `IntersectionObserver` on `sentinelRef` div placed below the query bar. Fades in (`opacity 200ms ease`) once user scrolls the query bar out of view. Hidden in quick-tag compact mode.
- CSS classes: `.mix-float-zone`, `.mix-float-search`, `.mix-float-jam`.
- Top-right cluster now has: Search + Shuffle + Clear.

**Files:** `QueryBuilder.tsx`, `index.css`

---

### Feature 2: Row hover interactions

**Goal:** Results rows should feel alive and responsive.

- Row hover background: `group-hover:bg-[var(--aurora-surface-1)]` (`#0a0a0c`) across all cells, 150ms transition.
- Circular play button: in `#` column on hover, row number fades to 0 and a 40×40px round `.aurora-play-btn` fades in. `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` relative to the `<td>`. Hover: `scale(1.05)` + full `--aurora-primary`. Click: `e.stopPropagation()` + `handlePlay()`.
- Tag chip hover: `hover:scale-[1.03]` + `title="Filter by this tag"` tooltip when `onClick` prop present.

**Files:** `SongRow.tsx`, `TagChip.tsx`

---

### Feature 3: Staggered query-change animation + empty state polish

- `@keyframes aurora-row-in`: `opacity 0→1`, `translateY(4px→0)`, 220ms cubic-bezier. Applied via `.aurora-row-in` class on every `<tr>`.
- Stagger: `animIndex < 16 ? animIndex * 25 : 0` ms delay. First 16 rows stagger at 25ms/row (max 375ms lead); rows 16+ instant.
- `filterStore.ts`: `resultsVersion: number` increments on every result update. `QueryBuilder.tsx` passes it as `animKey={resultsVersion}` to `SongTable`. `SongTable` keys `<tbody key={animKey}>` to force remount and re-trigger animations on new queries.
- Empty state: `<MixEmptyState />` shows aurora wave SVG (three sine paths, teal/violet, no external assets) + "No songs match this query" (italic Fraunces 22px) + "Try relaxing a filter" (12px).

**Files:** `filterStore.ts`, `SongTable.tsx`, `SongRow.tsx`, `QueryBuilder.tsx`, `index.css`

---

### Visual QA Pass
- TypeScript build: clean (only pre-existing `baseUrl` deprecation warning).
- Floating zone: `bottom: 112px` = 32px gap above 80px PlayerBar at all window heights. ✓
- Circular play button: 40px centered in 48px `w-12` td, 4px clearance each side. ✓
- Stagger cap at 16 rows (375ms max lead + 220ms animation = ≈595ms total). ✓
- `resultsVersion` → `animKey` → `tbody key` → `SongRow animIndex` fully wired. ✓

---

## Completed Prior Sessions (April 21 — Session 10)

### Feature 1: Mix quick-tag header icon spacing

`gap-2.5` → `gap-3` on the flex container holding the `<Tag>` icon and tag name in the compact header of `QueryBuilder.tsx`. Fixes clipping between icon and text at all tag name lengths.

**Files:** `QueryBuilder.tsx`

### Feature 2: PlayerBar accent softened

New token `--aurora-accent-muted: #459687` (HSL 169°, 37%, 43% — same hue as `--aurora-primary` but ~15% less saturated/bright). Applied to:
- Play button fill (both mobile h-10 and desktop h-11). Inline `background` style removed; new `.aurora-play-btn` CSS class handles default muted fill + 200ms hover transition to full `--aurora-primary`.
- Seek bar and volume slider filled portion (`.aurora-range` background gradient updated).
- Equalizer bars (`.aurora-eq > span` gradient updated to `--aurora-accent-muted` → muted mint).

Full `--aurora-primary` teal is now reserved for hover state — conveys interactivity without neon harshness on OLED.

**Files:** `index.css`, `PlayerBar.tsx`

### Feature 3: File format display inline with duration

Shows `6:07 · FLAC` (uppercase) inline after duration in all song list views. Missing/null format gracefully degrades to duration alone.

**Backend:**
- `database.py`: `ALTER TABLE songs ADD COLUMN file_format TEXT` migration on startup. Python backfill loop derives format from `file_path` extension for existing rows.
- `file_scanner.py`: `extract_metadata()` returns `file_format: path.suffix.lstrip('.').lower()`. INSERT in `import_scanned_songs()` stores it.
- `songs.py`: All SELECT queries include `s.file_format`. `song_row_to_dict()` maps it. `create_song` derives format from `file_path` on manual creation.
- `models.py`: `SongResponse.file_format: Optional[str] = None`.
- `filter_engine.py`: SELECT and results dict include `file_format`.
- `playlists.py`: All 4 song SELECT queries include `s.file_format`. All `SongResponse` constructors pass it.

**Frontend:**
- `types/index.ts`: `file_format?: string | null` added to `Song`, `FilterResult`, `PlaylistSong`.
- `SongRow.tsx`: Duration cell shows `{formatDuration(song.duration)}{song.file_format && <> · {song.file_format.toUpperCase()}</>}`. Column width `w-24` → `w-28`.
- `SongTable.tsx`: Duration header width `w-24` → `w-28`.
- `PlaylistDetail.tsx`: Same inline format in `PlaylistSongRow` duration cell.

**Verification:** `/api/songs` and `/api/filter` both return `file_format: "mp3"` for scanned songs. Songs with no `file_path` correctly return `file_format: null` and show duration only.

**Files:** `database.py`, `models.py`, `songs.py`, `file_scanner.py`, `filter_engine.py`, `playlists.py`, `types/index.ts`, `SongRow.tsx`, `SongTable.tsx`, `PlaylistDetail.tsx`

### Feature 4: Mix queue auto-starts from filtered results (verified)

**Verified existing implementation is correct.** `QueryBuilder.tsx` already calls `playSong(song, results)` where `results` is the current filter output. `playerStore.playSong()` uses `findIndex(s => s.id === song.id)` to position the cursor in the queue, so clicking result #3 sets `queueIndex=2` and Next/Prev navigate within the filtered list. Jam and Shuffle-Jam buttons in `filterStore.ts` also correctly build queues from filtered results only. No code changes needed.

### Visual QA Pass
- TypeScript build: clean (only pre-existing `baseUrl` deprecation warning).
- Backend `/api/songs` and `/api/filter`: `file_format` field present and correctly backfilled.
- Playlist endpoint: Songs with `file_path: null` correctly return `file_format: null`.
- Frontend dev server: compiled with no HMR errors.

---

## Completed Prior Sessions (April 21 — Session 9)

### Feature 1: PlayerBar persistent idle state

**Goal:** Match Spotify/Apple Music "nothing playing" UX — persistent bar that grows on first play.

**Implementation:**
- Desktop idle: 52px bar with aurora gradient shimmer (animated `background-position` pulse, 3.5s ease-in-out) in the album-art position, "Nothing playing" in italic Fraunces, "Pick a song or hit Jam" in `--aurora-text-muted`.
- Desktop playing: 80px bar with full controls. Height transitions smoothly via `transition: height 300ms cubic-bezier(0.2, 0.7, 0.2, 1)` on the desktop container.
- Mobile idle: 44px with shimmer + same text. Mobile playing: stacked layout unchanged.
- `isIdle = currentSong === null`. Once `playSong()` fires, `currentSong` is never set back to null (confirmed in playerStore — `next()` at end of queue only sets `isPlaying: false`). So idle state is strictly initial app load.
- No transport controls in idle. No seek bar, volume, or queue button.
- `.aurora-idle-shimmer` CSS class added to `index.css` with `aurora-idle-pulse` keyframe.

**Files:** `PlayerBar.tsx`, `index.css`

### Feature 2: Mix page tag-entry vs manual-entry modes

**Goal:** Clicking a sidebar tag goes straight to results with compact header. "Mix" nav item opens full QueryBuilder.

**Implementation:**
- `filterStore.ts`: Added `isQuickTagView: boolean` (default `false`), `quickTagEditorOpen: boolean` (default `false`), `setIsQuickTagView(v)` (also resets `quickTagEditorOpen` to `false`), `setQuickTagEditorOpen(v)`.
- `Sidebar.tsx`: `handleTagClick` calls `setIsQuickTagView(true)` before navigating. Mix NavItem click calls `setIsQuickTagView(false)`.
- `QueryBuilder.tsx`: When `isQuickTagView && !quickTagEditorOpen`, renders compact header: `[Tag icon] tagName · N songs` + "Edit query" button. Results shown directly below. When `quickTagEditorOpen` is `true`, falls through to the full QueryBuilder (same as manual mode). `displayTagName` strips surrounding quotes from the raw query string.
- No `useEffect`/setState-in-effect — editor open/closed state lives in filterStore and is reset in event handlers.

**Files:** `filterStore.ts`, `Sidebar.tsx`, `QueryBuilder.tsx`

### Feature 3: Surface elevation token scale

**Goal:** Add intermediate OLED depth tokens without touching any existing component.

**Tokens added to `index.css` `:root`:**
- `--aurora-surface-0: #000000` — page base, OLED pure black
- `--aurora-surface-1: #0a0a0c` — cards, drawers, subtle lift
- `--aurora-surface-2: #111114` — popovers, dropdowns
- `--aurora-surface-3: #17171b` — modals, sheets, highest elevation
- `--aurora-surface-pressed: rgba(255,255,255,0.035)` — active/pressed state for surface-1 items
- Note: `--aurora-surface-hover` already existed (`rgba(255,255,255,0.065)`) and serves the elevation hover role.
- No existing component was modified to use these tokens.

**Files:** `index.css`

### Visual QA Pass
- TypeScript build: clean (only pre-existing `baseUrl` deprecation warning, unrelated to this session).
- Dev server: started, no new HMR/compilation errors. Only pre-existing duplicate-key console warnings.
- All views checked via code review: PlayerBar idle state, PlayerBar expanded state (with controls), Mix compact tag header, Mix full QueryBuilder, All Songs, Playlist detail — no regressions observed.
- Dev server stopped before session end.

---

## Completed Prior Sessions

### Session 8 (April 20 — audio architecture + PlayerBar spacing)

### Bug 1 (re-fix): Audio double-play — single chokepoint architecture

**Root cause:** The previous fix (removing `autoplay: true`) was insufficient. The real issue was architectural: the `isPlaying` effect had `[isPlaying, currentSong]` as deps, meaning it re-ran on every song change. When switching from Song A → Song B while playing, both the song-change effect (creates HowlB) and the isPlaying effect (plays it) fired in sequence. React effects run after the browser paint — there's a window where both Howls coexist in the HTML5 audio pipeline.

**Fix:** Restructured `useAudioPlayer.ts` so the **song-change effect is the single chokepoint** for all Howl lifecycle management. It stops/unloads the old Howl, creates the new one, and calls `howl.play()` directly (reading `getState().isPlaying` imperatively). The `isPlaying` effect now has only `[isPlaying]` in its deps — it fires only on pause/resume toggling, never on song changes. This makes the stop-create-play sequence atomic within one effect run.

**Path verification:**
- Click song in SongTable → `onPlay(song, queue)` → `playSong()` → `currentSong?.id` changes → song-change effect fires. isPlaying effect does NOT fire (isPlaying unchanged). ✓
- Next/Prev buttons → store's `next()`/`previous()` → `currentSong?.id` changes → same path. ✓
- Jam/Shuffle-Jam buttons in filterStore → `usePlayerStore.getState().playSong()` → same. ✓
- `onend` auto-advance → `next()` callback → same. ✓
- Spacebar / Play button → `togglePlay()` → only `isPlaying` changes → only isPlaying effect fires. ✓
- Volume slider → only volume effect fires. ✓

**Cleanup improvement:** The return cleanup now captures the local `howl` variable (not `howlRef.current`), so it always cleans up the correct instance even if the ref is reassigned.

### Bug 2 (re-fix): PlayerBar spacing

**Root cause:** Previous height fix made the bar 80px but didn't address inter-section spacing. The outer container used `px-6 gap-8`, and fixed section widths (left: 280px, right: 240px) left insufficient room for the center at 1280px widths. The transport cluster `gap-6` (24px) between skip/play/skip buttons made the play button appear visually isolated and close to section edges.

**Fix:**
- Container: `px-6` → `px-8` (more outer breathing room)
- Left section: `w-[280px]` → `w-[240px]`; right section: `w-[240px]` → `w-[200px]` (40px freed from each side)
- Center: `max-w-[620px]` → `max-w-[580px]`, added `min-w-0`
- Transport cluster: `gap-6` → `gap-3` (tighter, more cohesive button cluster)

**Layout verification at target widths:**
- 1280px: 98px gap between center content and right section. ✓
- 1440px: 178px gap. ✓
- 1920px: 418px gap. ✓

**Browser verification:** Dev server was running during session (both servers up, 50 songs confirmed). Code review shows no regressions. Manual browser test recommended before claiming fully resolved.

## Completed Prior Sessions

### Session 7 (April 16 — bug fixes + playlist search)

### Bug 1: PlayerBar overflow fixed
Desktop container height increased from 72px → 80px. LEFT section (album art + song info) given `flex-shrink-0` to prevent squeezing at narrow widths. Root cause: the center column (44px play button + 8px gap + ~20px seek bar = ~72px) exactly filled the 72px container with zero breathing room.

### Bug 2: Duplicate song playback fixed
Removed `autoplay: true` from the Howl constructor in `useAudioPlayer.ts`. Root cause: `autoplay: true` triggered an internal `.play()` call asynchronously (after `canplaythrough`), while the `isPlaying` sync effect also called `.play()` synchronously. In Howler v2, multiple `.play()` calls on the same Howl instance create multiple simultaneous sound sprites. Removing `autoplay` makes the `isPlaying` effect the single source of `.play()` calls.

### Feature: Playlist search bar
Client-side search input added to PlaylistDetail above the song table. Filters by title or artist match (case-insensitive). Glass surface styling matches All Songs search bar. Shows "No songs match" empty state when query has no results. `key={view.playlistId}` added to `<PlaylistDetail>` in App.tsx so all local state (including search query) resets automatically when switching playlists.

### CORS: Port 5175 added
`backend/app/main.py` now allows `http://localhost:5175`.

### Visual QA Pass
All views checked via code review + clean dev server build:
- AppShell grid layout ✓
- Sidebar nav states, tags, footer actions ✓
- PlayerBar collapsed/expanded ✓
- PlaylistDetail hero, song list, search ✓
- Mix / QueryBuilder command zone ✓
- SongTable / All Songs ✓
- All CSS aurora tokens defined ✓
- No HMR errors in dev server ✓

### Session 6 (Claude Code with Opus — full UI overhaul)
Complete aurora color token system, Mix page command zone, PlayerBar collapse/expand, sidebar polish, Playlist detail restyled, All Songs restyled, keyboard shortcuts, view fade transitions, row hover states, button micro-interactions, Wake Lock API, Error boundary, empty states.

### Session 5 (Claude Code with Opus — Mix page redesign)
Mix page QueryBuilder compacted from ~530px to ~210px vertical. New color tokens. Operator keys restyled as keyboard keys. Search/Jam buttons moved to header row.

### Session 4 (Claude Code with Opus — bug fixes)
Playlist image upload pipeline working. Double toast fixed. Aurora background opacity 19%. Neutral default hero gradient. Logo click delay fixed. python-multipart added.

### Session 3 (Claude Code with Cline/Qwen)
OLED black theme, glassmorphism, Fraunces font, aurora background image.

### Sessions 1–2
App shell, song table, filter/Mix view, audio playback, file scanner dialog, initial Mix redesign.

## Known Gaps
- **Tertiary color (`#c49a6c`) unused in UI** — defined but not yet applied. Available for future use (badges, warnings, decorative accents).
- **No autocomplete on query input** — supports typed queries but no suggestions.
- **Mobile compactness** — Mix page header row is tight on screens under 400px.
- **Filter is case-sensitive** — `rock` returns nothing, `Rock` works. Fix: lowercase both sides in `backend/app/services/filter_engine.py` during comparison.
- **Duplicate key warnings in console** — possible id collision between manual test songs and scanned songs.
- **PlayerBar height transition** — currently uses conditional rendering with fade-in. A CSS grid `grid-template-rows` height animation would be smoother but adds complexity.

## Known Bugs
- **Audio double-play (needs browser confirmation):** The Session 8 single-chokepoint rewrite is architecturally sound, but manual A→B song switch testing in the browser is the only way to confirm it's actually fixed.
- **PlayerBar spacing (needs browser confirmation):** Layout math confirmed correct at 1280/1440/1920px. Manual resize test recommended.

## Technical Decisions
- Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Don't replace them.
- View switching uses Zustand store (`songStore.view`), no React Router.
- `playSong()` needs the song list as second argument for queue/next/previous to work.
- Howler.js uses `html5: true` mode — required for streaming large files. The song-change effect (`[currentSong?.id]`) is the SINGLE CHOKEPOINT for Howl creation and initial play. The isPlaying effect (`[isPlaying]` only) handles pause/resume toggling. Never add `currentSong` back to the isPlaying effect deps — that was the root cause of dual-audio.
- Display font (Fraunces) loaded via Google Fonts with the full `opsz,wght,SOFT,WONK` axis range.
- Playlist images stored server-side via `POST /playlists/{id}/image`. Create flow must `await fetchPlaylists()` *after* upload.
- Sidebar responsive state is local to AppShell (useState), not in Zustand.
- `filterStore.jamFilter` / `shuffleAndJamFilter` call `usePlayerStore.getState().playSong()` directly.
- Background image is in `frontend/public/` (served at `/aurora-bg.png`), not imported as a module.
- Mix page CSS classes (`.mix-query-bar`, `.mix-kbd`, `.mix-btn-search`, `.mix-btn-jam`) are in `index.css`.
- QueryInput is "bare" — just `<input>` + validation indicator, container comes from QueryBuilder.
- Keyboard shortcuts registered via `useCallback` in `App.tsx`. All check `activeElement.tagName` to avoid firing in inputs.
- Wake lock is managed via `useEffect` in `App.tsx` watching `isPlaying`.
- ErrorBoundary is a class component wrapping the main content area.
- `aurora-chip` class uses simple `--aurora-muted` border instead of gradient border (Session 3 change — more refined).
- Play button uses solid `--aurora-primary` instead of gradient (Session 3 change — more premium feel).
- PlaylistDetail uses `key={view.playlistId}` in App.tsx — forces full remount (and state reset) when switching playlists.

## Next Steps
See `features.json` for the remaining task list. Priority order:
1. Case-sensitivity fix in filter engine
2. Custom playback times per playlist (start_time_ms / end_time_ms on playlist_songs)
3. Crossfade between songs
