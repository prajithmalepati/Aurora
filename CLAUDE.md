# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Aurora — Claude Code Instructions

## Project
Aurora is a personal music library app with custom tagging and boolean filtering (AND/OR/NOT with parentheses). Backend complete (FastAPI + SQLite). Frontend nearly complete (React + Vite + TypeScript + Tailwind + shadcn/ui + Zustand + Howler.js). Dark mode only.

## Architecture
- Backend: `backend/app/` — FastAPI routers (`songs`, `tags`, `playlists`, `filter`, `scanner`), SQLite (WAL), `services/filter_engine.py` (boolean parser), `services/file_scanner.py` (mutagen + album art extraction)
- Frontend: `frontend/src/` — React 19, Vite 6, TypeScript 5, Tailwind 4, shadcn/ui, Howler.js
- Docs: `docs/` — 12 spec documents covering data model, API, components, styling, state

### Zustand Stores (`src/stores/`)
| Store | Owns |
|-------|------|
| `songStore` | Songs list, view routing (`view` field — no React Router), CRUD |
| `filterStore` | Filter query, results, Jam/Shuffle-Jam, quick-tag view state |
| `playerStore` | Current song, queue, playback state |
| `playlistStore` | Playlists, playlist songs |
| `tagStore` | Tags list, tag assignment |

View switching: `songStore.view` + `songStore.currentView` — **no React Router**.

### Audio Player (`src/hooks/useAudioPlayer.ts`)
Two effects, strictly separated:
- **Song-change effect** `[currentSong?.id]` — ONLY place that creates/destroys Howl and calls initial `howl.play()`. Single chokepoint.
- **isPlaying effect** `[isPlaying]` — ONLY fires on pause/resume toggle. **Never** add `currentSong` to this dep array — that was the root cause of dual-audio bug.

Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Do not replace them.

## Rules
- Only change what is explicitly asked. Do not add features, refactor, or "improve" unprompted.
- Frontend imports use `@/` alias. Never relative imports.
- State uses Zustand stores in `src/stores/`. Never React Context.
- API calls go through `src/lib/api.ts`. Never raw `fetch()` in components.
- UI components from shadcn/ui (`src/components/ui/`). No other component libraries.
- Dark mode only. Never add light mode.
- Tailwind classes only. No CSS modules, styled-components, or inline style objects.
- One component per file. Keep components small and focused.
- After changes, verify nothing is clipped, overflowing, or misaligned.
- Commit messages use `type(scope): description` format only. No Co-Authored-By, no body, no footer.
- Toast: import from `@/lib/toast`, never directly from `"sonner"`.
- `playSong(song, queue)` requires the full song list as second arg for Next/Prev to work.
- `filterStore.jamFilter` / `shuffleAndJamFilter` call `usePlayerStore.getState().playSong()` directly (not via hooks).

## Key References (read on demand, not upfront)
- Data model & DB schema: `docs/01-data-model.md`
- API endpoints: `docs/02-api-contract.md`
- Filter engine spec: `docs/03-filter-engine.md`
- Frontend components: `docs/10-frontend-components.md`
- Styling & theme: `docs/11-frontend-styling.md`
- Implementation plan: `docs/12-frontend-implementation-plan.md`
- Current status & bugs: `HANDOFF.md`
- Remaining tasks: `features.json`

## Workflow Docs (external — not in this repo)

Claude meta-process docs live OUTSIDE the Aurora repo, in a sibling `claude-workspace/` folder. Do not duplicate here, do not commit copies to Aurora.

- **Parent CLAUDE.md** (`../CLAUDE.md`) — auto-loaded by Claude Code. Holds workflow rules + model dispatch advisory + recurrence pipeline.
- **Project Claude docs** (`../claude-workspace/Aurora/`):
  - `JOURNAL.md` — append-only mistakes / issues / decisions log
  - `PATTERNS.md` — distilled recurrence (3+ hits)
  - `CONTEXT.md` — vision, threads, open questions, next-session prep

## Commands
- Backend: `cd backend && venv\Scripts\activate && python run.py` (port 8000)
- Frontend dev: `cd frontend && npm run dev` (port 5173)
- Frontend type-check: `cd frontend && npm run build`
- Test backend: http://localhost:8000/docs (Swagger UI)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
