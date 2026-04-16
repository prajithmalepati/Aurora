# Aurora — Session Handoff

## Current State (April 16, 2026)
Backend: 100% complete. All endpoints working — Songs CRUD, Tags CRUD + assignment, Playlists CRUD + song management + reorder, Filter (boolean AND/OR/NOT with parentheses), Scanner (folder scan with mutagen), Audio streaming.

Frontend: Full UI overhaul complete. "Northern Lights Over OLED Black" design system applied across all views. Mix page redesigned as compact command zone. PlayerBar collapse/expand with glassmorphism. Sidebar polished. Global keyboard shortcuts. Wake lock, error boundary, view transitions. Bug fixes and playlist search added this session.

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

## Completed This Session (April 16 — Session 7)

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

## Completed Prior Sessions

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
_(All critical bugs from the Session 7 brief are now fixed.)_

## Technical Decisions
- Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Don't replace them.
- View switching uses Zustand store (`songStore.view`), no React Router.
- `playSong()` needs the song list as second argument for queue/next/previous to work.
- Howler.js uses `html5: true` mode — required for streaming large files. NO `autoplay: true` — the `isPlaying` sync effect in `useAudioPlayer` is the single caller of `.play()`.
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
