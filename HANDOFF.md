# Aurora — Session Handoff

## Current State (April 9, 2026)
Backend: 100% complete. All endpoints working — Songs CRUD, Tags CRUD + assignment, Playlists CRUD + song management + reorder, Filter (boolean AND/OR/NOT with parentheses), Scanner (folder scan with mutagen), Audio streaming.

Frontend: Tasks 0.1–8.1 complete. App shell, song table, search, tag editor, playlists, filter/query builder, audio player (Howler.js), scanner dialog — all working.

CORS: Currently `allow_origins=["*"]` — was `["http://localhost:5173"]` but caused OPTIONS 400 errors. Lock down in polish.

## Known Bugs
1. **Filter is case-sensitive** — `rock` returns nothing, `Rock` works. Root cause is in `backend/app/services/filter_engine.py` — matching is case-sensitive. Fix: lowercase both the query terms and the tag/playlist names during comparison.
2. **Volume slider thumb slightly clipped at right edge** — needs padding adjustment in PlayerBar.
3. **Player bar spacing not perfectly balanced** — left/center/right sections need fine-tuning.
4. **No loading skeletons** — tables show nothing while loading.
5. **Toasts not on all actions** — need comprehensive pass across all stores/components.
6. **No keyboard shortcuts** — space for play/pause planned.
7. **Tag editor UI is rough** — functional but needs styling polish.
8. **Duplicate key warnings in console** — possible id collision between manual test songs and scanned songs.

## Technical Decisions
- Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Don't replace them.
- PlayerBar uses HTML range inputs, not shadcn Slider. This was intentional.
- View switching uses `useState` in App.tsx, no React Router.
- `playSong()` needs the song list as second argument for queue/next/previous to work.
- Howler.js uses `html5: true` mode — required for streaming large files.

## Next Steps
See `features.json` for the remaining task list. Priority order: case-sensitivity fix → toasts → loading states → keyboard shortcuts → visual polish.
