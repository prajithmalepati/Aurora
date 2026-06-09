# Aurora — Quick Onboarding

> Read this at the start of any new session working on Aurora.

## What is Aurora?

A personal music library app — offline, local, no cloud. Think iTunes/MusicBee but modern.

- **Backend:** Python (FastAPI + SQLite) at `backend/`
- **Frontend:** React 19 + TypeScript + Vite + Tailwind at `frontend/`
- **State:** Zustand stores in `frontend/src/stores/`
- **Audio:** Howler.js with crossfade, gapless, ReplayGain
- **Design:** Dark mode only, per-song color bleed, glass surfaces

## Quick Commands

```bash
# Start backend (port 8000)
cd backend && source venv/bin/activate && python run.py

# Start frontend (port 5173)
cd frontend && npm run dev

# Build check (ALWAYS run after changes)
cd frontend && npm run build

# Backend tests
cd backend && source venv/bin/activate && python -m pytest tests/ -v
```

## Architecture at a Glance

**Backend (FastAPI)**
- `backend/app/routers/` — 8 routers: songs, tags, playlists, filter, scanner, folders, watcher, albums
- `backend/app/services/` — filter_engine (boolean parser), file_scanner (mutagen + art), file_watcher (polling)
- `backend/app/database.py` — SQLite schema, `SONG_SELECT_QUERY` (DRY), `get_db_ctx()` context manager
- `backend/app/main.py` — lifespan startup/shutdown, CORS, router registration

**Frontend (React)**
- `frontend/src/stores/` — 6 Zustand stores:
  - `songStore` — songs, view routing (no React Router)
  - `playerStore` — current song, queue, playback, crossfade
  - `playlistStore` — playlists, CRUD, reorder
  - `filterStore` — boolean filter query, results, Jam
  - `tagStore` — tags, assignment
  - `settingsStore` — crossfade, ReplayGain (localStorage)
- `frontend/src/hooks/useAudioPlayer.ts` — THE audio engine. Two effects only:
  - Song-change effect `[currentSong?.id]` — creates/destroys Howl
  - isPlaying effect `[isPlaying]` — pause/resume only
- `frontend/src/components/` — organized by domain (layout, player, songs, playlists, etc.)

## Key Conventions

1. **Imports:** `@/` alias only. No relative imports.
2. **State:** Zustand stores only. No React Context.
3. **API calls:** `src/lib/api.ts` only. No raw `fetch()`.
4. **UI:** shadcn/ui components from `src/components/ui/`. No other libraries.
5. **Styling:** Tailwind classes only. No inline style objects. Dark mode only.
6. **Toast:** Import from `@/lib/toast`, never from `"sonner"` directly.
7. **Commits:** `type(scope): description` only. No Co-Authored-By.
8. **One component per file.** Keep components small.

## Common Pitfalls

- **Inline style beats Tailwind** — if an element has `style={{boxShadow}}`, Tailwind `focus-within:shadow-[...]` won't work. Move to CSS class.
- **Howler effects** — song-change effect is the ONLY place that creates Howls. isPlaying effect is ONLY for pause/resume. Never mix deps.
- **`playSong(song, queue)`** — second arg is required for Next/Prev to work.
- **`queue` includes current song** — `queue[queueIndex]` is the current song. "Up next" = `queue.slice(queueIndex + 1)`.
- **Zustand v5** — no second-arg equality function. Use narrow selectors.
- **PlayerBar backdrop-filter** — creates containing block. Use `createPortal` for fixed children (QueuePanel).

## Database

- SQLite with WAL mode, auto-created at `backend/aurora.db`
- Key tables: `songs`, `tags`, `song_tags`, `playlists`, `playlist_songs`, `watched_folders`
- Context manager: `with get_db_ctx() as conn:` (never manual `get_db()`/`conn.close()`)
- DRY query: `SONG_SELECT_QUERY` in `database.py`

## Current State (as of 2026-06-09)

- 352 songs, 321 albums, 7 playlists in the DB
- All v1.0 features built and working
- Code split: 327KB initial JS (102KB gz), views lazy-loaded
- 17 commits ahead of origin/main
- README updated with correct screenshot paths

## Docs Index

- `docs/01-data-model.md` — DB schema
- `docs/02-api-contract.md` — API endpoints
- `docs/03-filter-engine.md` — boolean filter spec
- `docs/10-frontend-components.md` — component tree
- `docs/11-frontend-styling.md` — design tokens
- `docs/12-frontend-implementation-plan.md` — implementation notes
- `CLAUDE.md` — Claude Code instructions (detailed conventions)
- `V1_EXECUTION_PLAN.md` — what was done and what's next
