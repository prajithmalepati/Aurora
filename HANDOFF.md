# Aurora — Session Handoff

## Current State (April 10, 2026)
Backend: 100% complete. All endpoints working — Songs CRUD, Tags CRUD + assignment, Playlists CRUD + song management + reorder, Filter (boolean AND/OR/NOT with parentheses), Scanner (folder scan with mutagen), Audio streaming.

Frontend: Comprehensive UX overhaul complete. All core features working plus major design improvements.

CORS: Currently `allow_origins=["*"]` — was `["http://localhost:5173"]` but caused OPTIONS 400 errors. Lock down in polish.

## Completed in UX Overhaul (April 10)
1. **Font overhaul** — Replaced Outfit with Space Grotesk (Google Fonts) as display font. Geist remains body font. Weight hierarchy: SG 700 titles, 500 subtitles, Geist 400 body / 500 labels / 600 emphasis.
2. **Mix is default view** — App lands on Mix (filter view) instead of All Songs. Changed in songStore default view.
3. **Smart tag selection in Mix** — Clicking tag/playlist chips auto-inserts AND between terms. Green checkmark / red X validation indicator on query input. Shuffle button (client-side Fisher-Yates). Result count shown above results.
4. **Tag column redesign** — Tags show as aurora-chip pills with +N more overflow (expands on click). Max 200px column width. Playlists column shows plain text with colored square dot prefix.
5. **Sidebar playlists redesign** — Colored dot replaced with 32x32 gradient thumbnail squares. Gradient is deterministic (name-hashed from aurora palette). Image upload via localStorage (base64 data URLs keyed by playlist ID). Image picker in both Create and Edit playlist dialogs. Song count shown below name.
6. **Glassmorphism** — PlayerBar: `rgba(6,7,9,0.75)` + `blur(24px)`. Dialogs: `rgba(14,17,22,0.82)` + `blur(32px)`. Search inputs: subtle `blur(12px)` background.
7. **Responsive foundations** — Sidebar collapses to hamburger overlay below md (768px). Duration + Playlists columns hidden below lg (1024px). PlayerBar stacks vertically below sm (640px) with volume hidden. AppShell uses responsive grid.
8. **Production polish** — Removed All Songs hero header (just search bar). Moved Add Song button from content area to sidebar footer. Consistent p-4/sm:p-10 padding. Empty states have centered icon + muted text.

## Known Bugs
1. **Filter is case-sensitive** — `rock` returns nothing, `Rock` works. Root cause is in `backend/app/services/filter_engine.py` — matching is case-sensitive. Fix: lowercase both the query terms and the tag/playlist names during comparison.
2. **Duplicate key warnings in console** — possible id collision between manual test songs and scanned songs.

## Technical Decisions
- Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Don't replace them.
- PlayerBar uses HTML range inputs, not shadcn Slider. This was intentional.
- View switching uses Zustand store (`songStore.view`), no React Router.
- `playSong()` needs the song list as second argument for queue/next/previous to work.
- Howler.js uses `html5: true` mode — required for streaming large files.
- Display font (Space Grotesk) loaded via Google Fonts CDN in index.html, not fontsource.
- Playlist images stored as base64 data URLs in localStorage (`aurora-playlist-img-{id}`). Backend doesn't support images yet.
- Sidebar responsive state is local to AppShell (useState), not in Zustand.

## Next Steps
See `features.json` for the remaining task list. Priority order: case-sensitivity fix → CORS lockdown.
