# Aurora — Session Handoff

## Current State (April 11, 2026)
Backend: 100% complete. All endpoints working — Songs CRUD, Tags CRUD + assignment, Playlists CRUD + song management + reorder, Filter (boolean AND/OR/NOT with parentheses), Scanner (folder scan with mutagen), Audio streaming.

Frontend: Mix-centric overhaul complete. Mix page is the spatial and behavioral center of the app. All core features working.

CORS: Currently `allow_origins=["*"]` — was `["http://localhost:5173"]` but caused OPTIONS 400 errors. Lock down in polish.

## Completed This Session (April 11)
1. **Playlist emoji clearable** — Backend now converts empty-string emoji to NULL. Edit dialog sends `emoji: ""` when cleared (was `undefined`, which the backend skipped). Clear button added next to the emoji input in the edit dialog.
2. **Playlist image display bug fixed** — Image was saved to localStorage *after* the sidebar had already re-rendered, so `PlaylistItem` never saw it. Create flow now forces a `fetchPlaylists()` after saving the image; edit flow saves the image *before* calling `updatePlaylist()` so the downstream re-render picks it up.
3. **Mix page redesign** — Tag/playlist chips are now compact horizontal-scroll rows (new `.aurora-chiprow` CSS utility hides the native scrollbar; buttons are `flex-shrink-0 whitespace-nowrap`). Song count label is now a subtle `label-micro` pill above the results table. Action bar layout: Search → **Jam** → Shuffle (icon) → Clear pushed right with `ml-auto`.
4. **Jam button** — Signature teal→violet gradient pill (`rounded-full px-6 py-2`, white bold text, `Sparkles` icon). Wired to new `filterStore.jamFilter()` — executes the filter and instantly plays `results[0]` with the full results as the queue.
5. **Shuffle icon button** — Circular icon button next to Jam. Wired to new `filterStore.shuffleAndJamFilter()` — executes, shuffles the array Fisher-Yates, plays first, full shuffled list as queue.
6. **Tags panel in sidebar** — New section below Playlists inside the same scrollable middle area. Each tag renders as a `TagSidebarItem` (aurora gradient dot + tag name + song count). Click navigates to Mix view and auto-executes a filter with that tag as the sole query term.
7. **Font swap: Space Grotesk → Fraunces** — Display font is now Fraunces (variable serif from Undercase). Uses `opsz`, `SOFT`, and `WONK` variation axes — large titles get warm display-optical weight, smaller subtitles tighten up automatically. `.font-display-italic` is now actual Fraunces italic (was faux Geist). Picked over another geometric sans because a warm editorial serif paired with a geometric body sans (Geist) gives the app a "late-night record sleeve" character that no grotesk could deliver, and Fraunces is not overused the way Space Grotesk/Inter/Playfair are.
8. **Aurora atmospheric background** — `docs/Aurora.png` copied to `frontend/public/aurora-bg.png`. New `.aurora-bg-image` fixed layer (10% opacity, cover, slightly desaturated) sits behind a new `.aurora-bg-veil` layer (radial black gradient 55%→92%) which sits behind the existing atmosphere and noise layers. Composition: the aurora is barely perceptible — it reads as a feeling in the room, not a photograph. OLED blacks are preserved in the center-dark region; text contrast is not affected because the brightest aurora pixels are multiplied down to ~5% luminance.

## Known Bugs
1. **Filter is case-sensitive** — `rock` returns nothing, `Rock` works. Root cause is in `backend/app/services/filter_engine.py`. Fix: lowercase both the query terms and the tag/playlist names during comparison.
2. **Duplicate key warnings in console** — possible id collision between manual test songs and scanned songs.

## Technical Decisions
- Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Don't replace them.
- View switching uses Zustand store (`songStore.view`), no React Router.
- `playSong()` needs the song list as second argument for queue/next/previous to work.
- Howler.js uses `html5: true` mode — required for streaming large files.
- Display font (Fraunces) loaded via Google Fonts with the full `opsz,wght,SOFT,WONK` axis range so CSS can dial character per-use-site via `font-variation-settings`.
- Playlist images stored as base64 data URLs in localStorage (`aurora-playlist-img-{id}`). Backend doesn't support images yet. Create flow must `await fetchPlaylists()` *after* localStorage write, or Sidebar won't re-read.
- Sidebar responsive state is local to AppShell (useState), not in Zustand.
- `filterStore.jamFilter` / `shuffleAndJamFilter` call `usePlayerStore.getState().playSong()` directly — the filter store intentionally depends on the player store, not the other way around. Don't reverse this.
- Empty-string emoji from the frontend is converted to SQL NULL in the backend update handler. Sending `undefined` (field omitted) still means "don't update".
- Background image is in `frontend/public/` (served at `/aurora-bg.png`), not imported as a module. Keep it there if you need to reference it from CSS `url()`.

## Next Steps
See `features.json` for the remaining task list. Priority order: case-sensitivity fix → CORS lockdown.
