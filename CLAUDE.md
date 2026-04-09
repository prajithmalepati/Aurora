# Aurora — Claude Code Instructions

## Project
Aurora is a personal music library app with custom tagging and boolean filtering (AND/OR/NOT with parentheses). Backend complete (FastAPI + SQLite). Frontend nearly complete (React + Vite + TypeScript + Tailwind + shadcn/ui + Zustand + Howler.js). Dark mode only.

## Architecture
- Backend: `backend/app/` — FastAPI, SQLite (WAL), boolean.py, mutagen
- Frontend: `frontend/src/` — React 19, Vite 6, TypeScript 5, Tailwind 4, shadcn/ui, Zustand 5 stores, Howler.js
- Docs: `docs/` — 12 spec documents covering data model, API, components, styling, state

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

## Key References (read on demand, not upfront)
- Data model & DB schema: `docs/01-data-model.md`
- API endpoints: `docs/02-api-contract.md`
- Filter engine spec: `docs/03-filter-engine.md`
- Frontend components: `docs/10-frontend-components.md`
- Styling & theme: `docs/11-frontend-styling.md`
- Implementation plan: `docs/12-frontend-implementation-plan.md`
- Current status & bugs: `HANDOFF.md`
- Remaining tasks: `features.json`

## Commands
- Backend: `cd backend && venv\Scripts\activate && python run.py` (port 8000)
- Frontend: `cd frontend && npm run dev` (port 5173)
- Test backend: http://localhost:8000/docs (Swagger UI)
