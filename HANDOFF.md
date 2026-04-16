# Aurora — Session Handoff

## Current State (April 16, 2026)
Backend: 100% complete. All endpoints working — Songs CRUD, Tags CRUD + assignment, Playlists CRUD + song management + reorder, Filter (boolean AND/OR/NOT with parentheses), Scanner (folder scan with mutagen), Audio streaming.

Frontend: Full UI overhaul complete. "Northern Lights Over OLED Black" design system applied across all views. Mix page redesigned as compact command zone. PlayerBar collapse/expand with glassmorphism. Sidebar polished. Global keyboard shortcuts. Wake lock, error boundary, view transitions.

CORS: Currently `allow_origins=["*"]` — was `["http://localhost:5173"]` but caused OPTIONS 400 errors. Lock down in polish.

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

## Completed This Session (April 16 — Session 3)

### Phase 0: Color Token System
Complete aurora palette defined as CSS custom properties in `index.css`. Three accent voices: teal (primary), violet (secondary), warm amber (tertiary). Surface, muted, and glow tokens for consistent glass-panel styling. Text hierarchy warmed from `#f5f7fa` to `#e8e6e3`.

### Phase 1: Mix Page Command Zone
QueryBuilder restructured. All interactive elements now live in a tight 2-row band:
- Row 1: "Mix" title + pill-shaped Search/Jam/Shuffle/Clear buttons.
- Row 2: Single glass container with query input on top, chip tray below. Tag chips (left), operator keys (center), playlist chips (right) separated by vertical dividers. Everything clickable inserts at cursor.

### Phase 2: PlayerBar Collapse/Expand
- **Collapsed** (no song loaded): 44px tall, aurora gradient placeholder + "Play something" in tertiary text. Minimal presence.
- **Expanded** (song loaded): 72px tall desktop layout with album art, transport controls, seek bar, volume. Glassmorphism backdrop (`blur(12px)`, 80% opacity surface).
- Play button: solid `--aurora-primary` fill (muted teal) instead of bright gradient. More refined.
- Seek/volume bars: `--aurora-primary` fill with muted glow thumbs.

### Phase 3: Sidebar Polish
- "YOUR LIBRARY" text replaced with a thin aurora gradient line beneath the logo.
- NavItem active state: 3px solid primary left bar + surface background. Hover: surface-hover background.
- Tag sidebar dots: `--aurora-muted` instead of bright teal gradient.
- Footer actions: ghost button style with surface-hover on hover.
- PlaylistItem: matching 3px left accent bar + surface active background.

### Phase 4–5: Playlist Detail + All Songs
- Consistent token application across all views.
- Active song row left bar: 3px solid primary (was 2px gradient).
- "All Songs" header: display font title + song count.
- View transition fade (`aurora-view-enter`) on all view containers.
- Toaster border updated to `--aurora-muted`.

### Phase 6: Keyboard Shortcuts
Six global shortcuts registered (see table above). `/` navigates to Mix and auto-focuses the query input.

### Phase 7: Micro-interactions & Motion
- `aurora-view-enter`: 200ms opacity fade on view switch.
- `aurora-btn-press`: scale(0.97) on mousedown for tactile feedback.
- `aurora-btn-glow`: hover box-shadow using `--aurora-glow`.
- Chip hover: border brightens, surface background appears.
- Range slider: thumb reveals on hover, track thickens 3→5px.

### Phase 8: Small Details
- **Wake lock**: Requests `navigator.wakeLock` while audio is playing to prevent tab suspension.
- **Error boundary**: `ErrorBoundary` component wraps main content. Shows "Something went wrong" + Reload button on crash.
- **Empty states**: Mix page shows centered icon + italic prompt. All Songs shows Music icon + "Nothing here yet" + call-to-action. Playlist detail shows "This playlist is empty".

## Completed Prior Sessions

### Session 2 (April 16)
Mix page command-palette redesign, muted aurora accent palette (`--aurora-primary`/`--aurora-secondary`), keyboard-key operator buttons, QueryInput simplified, Fraunces display font, aurora atmospheric background.

### Session 1 (April 11)
Playlist emoji clearable, playlist image display bug fixed, Mix page initial redesign, Jam button, Shuffle, Tags panel in sidebar, aurora atmospheric background.

## Known Gaps
- **Tertiary color (`#c49a6c`) unused in UI** — The warm amber token is defined but not yet applied to any component. It's available for future use (e.g., special badges, warning states, decorative accents).
- **No autocomplete on query input** — The input supports typed queries but doesn't offer autocomplete suggestions.
- **Mobile compactness** — The header row (title + 4 buttons) on Mix page is tight on screens under 400px.
- **PlayerBar height transition** — Currently uses conditional rendering with fade-in (`aurora-view-enter`). A true height animation via CSS grid `grid-template-rows` would be smoother but adds complexity.

## Known Bugs
1. **Filter is case-sensitive** — `rock` returns nothing, `Rock` works. Root cause is in `backend/app/services/filter_engine.py`. Fix: lowercase both the query terms and the tag/playlist names during comparison.
2. **Duplicate key warnings in console** — possible id collision between manual test songs and scanned songs.

## Technical Decisions
- Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Don't replace them.
- View switching uses Zustand store (`songStore.view`), no React Router.
- `playSong()` needs the song list as second argument for queue/next/previous to work.
- Howler.js uses `html5: true` mode — required for streaming large files.
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

## Next Steps
See `features.json` for the remaining task list. Priority order: case-sensitivity fix → CORS lockdown.
