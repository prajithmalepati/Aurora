# Gate-1 Dogfood Feedback Backlog

> **Source:** Developer dogfood pass on the first installed Windows desktop build, 2026-06-14.
> **Captured by:** Hermes (planner). **Role split:** Hermes writes briefs / Fable designs the
> design-critical items / implementing agent codes. Nothing here is implemented yet.
> **Why this doc:** the feedback was large and risked getting buried. Every item is recorded,
> grounded to a file + root-cause hypothesis, severity-tagged. Feeds **Phase 1.8** in
> `STRATEGIC_PLAN.md`.

Confirmed working in the same pass: **scan works, song playback works.**

Severity: 🔴 blocks daily use · 🟠 major UX/functional · 🟡 polish · 🔵 question/verify.

---

## A. Desktop / build

| ID | Item | Sev | File / root cause | Notes |
|----|------|-----|-------------------|-------|
| A1 | Console window still appears on launch; on close no orphan backend, but it returns empty on next start | 🟠 | Build predates `fa964c4` (CREATE_NO_WINDOW). **Not a new bug** | Rebuild desktop from `hermes/phase1-closeout` HEAD; re-test checklist #3/#9. No code change needed. |
| A2 | Resizing window makes the background aurora/waveform stutter, and a white square flashes | 🟡 | `components/aurora/AuroraCanvas.tsx` — canvas repaint not debounced to resize; white square = unpainted canvas frame during resize | Needs reproduce on real display + canvas resize handling (debounce / preserve buffer / paint background first). |
| A3 | When the global PlayerBar is small (no song playing yet) the extra space is black instead of showing songs/hero content | 🟡 | `components/layout/PlayerBar.tsx` + `AppShell` layout — empty-player state leaves an unfilled black band | Design an empty/idle player state (recent or hero fill), or collapse the bar so the view reclaims the space. |

## B. Functional bugs

| ID | Item | Sev | File / root-cause hypothesis | Notes |
|----|------|-----|------------------------------|-------|
| B1 | Playlist cover upload → "failed to fetch" (playback fine) | 🔴 | `lib/api.ts` `uploadRequest` uses **PUT** multipart → CORS **preflight**. Verify backend `main.py` CORSMiddleware `allow_methods` includes PUT/POST/PATCH/DELETE (or `["*"]`) and that the token middleware exempts OPTIONS for the `/playlists/{id}/image` route. "failed to fetch" = transport/preflight failure (status 0), not a 4xx | Reproduce with DevTools Network; check the OPTIONS response for `Access-Control-Allow-Methods`. Likely a one-line CORS fix. |
| B2 | Cannot add tags from the playlist page ("biggest blunder") | 🔴 | `components/playlists/PlaylistDetail.tsx` renders a **bespoke `PlaylistSongRow`** (line ~1140) that lacks the add-tag affordance. The shared `SongTable`/`SongRow` has the tag popover (`SongTable.tsx` ~146–221) | Fixed by row unification (C1) or by adding the tag action to `PlaylistSongRow`. Tied to C1. |
| B3 | Folders page: folders list on the left but main area shows nothing; selecting a folder should immediately show its songs | 🟠 | `components/folders/FoldersView.tsx` fetches `/folders/songs?…` on `currentPath` change and renders `SongTable`; no folder auto-selected, and/or folder click doesn't set `currentPath` | Verify the folder-click → `currentPath` → fetch chain; auto-select first folder or show songs on single click. |
| B4 | Tags page: a tag with 3 songs shows "showing 3 of 345 — load more" | 🟠 | `stores/songStore.ts` `totalCount` comes from the **global** `/songs` `meta.total` (358/345), not the tag-scoped count; the tag view reuses songStore without a tag-filtered total | Scope `totalCount`/`hasMore` to the active tag query, or fetch tag songs through a query that returns the filtered total. |
| B5 | Right-click shows the browser menu (Refresh, DevTools…) instead of a tailored, context-aware menu (Spotify-style) | 🟠 | Only `components/songs/SongRow.tsx` has `onContextMenu`; nothing globally suppresses the webview default menu | Suppress default `contextmenu` globally (and disable in prod webview), then build per-context menus (song, playlist, tag, empty space). |

## C. UX consistency

| ID | Item | Sev | File | Notes |
|----|------|-----|------|-------|
| C1 | Song rows inconsistent: playlist rows are compact, but All Songs / Mix / Tags / Albums / Folders rows are bigger | 🟠 | `PlaylistDetail.PlaylistSongRow` (bespoke) vs `songs/SongTable.tsx` + `songs/SongRow.tsx` (used by Albums, QueryBuilder, Folders, Tags) | **Unify on one row component** across all views. Resolves B2 and C5 too. Design-critical → Fable. |
| C2 | All Songs "duration" column crams time + `mp3` + `320kbps` + `11.4 MB` | 🟠 | `songs/SongRow.tsx` / `SongTable.tsx` columns | Split into clean columns; decide the column set **per page** (see table below). |
| C3 | Per-row actions should collapse into a single 3-dots (⋯) overflow menu | 🟡 | row components | One overflow menu instead of always-visible actions; pairs with B5 context menu. |
| C4 | Sort control differs between All Songs and Playlist | 🟡 | `SongTable` sort vs `PlaylistDetail` sort | Unify the sort UI (falls out of C1). |
| C5 | Tags page songs use the bigger row view | 🟠 | same as C1 | Covered by C1. |

**Proposed per-page column set (for Fable to finalize):**

| Page | Columns |
|------|---------|
| All Songs | # · Title · Artist · Album · Tags · Duration · ⋯ |
| Playlist | # · Title · Artist · Album · Duration · ⋯ |
| Tags / Folders / Albums | # · Title · Artist · Album · Duration · ⋯ |

> Codec / bitrate / file size → move out of the row into the song detail / Edit dialog, or a
> toggleable column — not crammed under Duration.

## D. Information architecture / navigation

| ID | Item | Sev | File | Notes |
|----|------|-----|------|-------|
| D1 | Move New Playlist / Scan Folder / Add Song / Import out of the sidebar into a fleshed-out Settings; free sidebar space for playlists/tags | 🟠 | `layout/Sidebar.tsx` (lines ~278–310), `settings/SettingsView.tsx` | Library-management actions live in Settings; sidebar becomes navigation + library. Design-critical → Fable. |
| D2 | New Playlist via a small hover "+" next to the "Playlists" heading/count | 🟡 | `layout/Sidebar.tsx` | Inline create affordance. |
| D3 | "Add Song" should open a native file picker (like ScanDialog's Browse), not a bare text path field | 🟠 | `songs/AddSongDialog.tsx` (only a "File path" text input) | Reuse the Tauri dialog pattern from `ScanDialog.tsx` (`@tauri-apps/plugin-dialog`, web fallback). |
| D4 | "Import" purpose is unclear | 🔵 | `layout/Sidebar.tsx` `handleImport` — uploads a file and **matches its songs to a playlist** ("Imported: N songs matched") | Either clarify with a label/description or fold into the per-playlist flow (D5). Decide if it stays. |
| D5 | Each playlist should have an "Add song" by default; adding there adds to that playlist | 🟠 | `playlists/PlaylistDetail.tsx` | Per-playlist add-song entry; wired to that playlist id. |

## E. Comprehension / content

| ID | Item | Sev | File | Notes |
|----|------|-----|------|-------|
| E1 | Fade curves are hard to understand in-app (the developer couldn't tell them apart → users won't) | 🟠 | `settings/SettingsView.tsx` (labels only: Linear / Equal Power / Overlap / Lagged, lines ~179–182) | Add a per-curve **visual** (mini fade-shape diagram) + one-line plain-language description. Highest-value comprehension fix. |
| E2 | Verify the About section is current and looks good | 🔵 | `about/AboutView.tsx` | Audit content + visuals. |

---

## Proposed briefs (Hermes execution)

- **N11 — functional bug sweep** (🔴/🟠 bugs, no design needed): B1 (CORS/upload), B3 (folders), B4 (tags pagination), B5 (context-menu suppression baseline), A1 (rebuild + verify console fix), D3 (add-song native picker). Hermes-codeable from a brief.
- **N12 — UX/IA overhaul** (design-critical, **Fable designs first**): C1 row unification (resolves B2, C4, C5), C2 columns, C3 overflow menu, D1 sidebar→settings IA, D2 playlist "+", D5 per-playlist add-song, E1 fade-curve explainer, B5 tailored menus. Then implementing agent codes.
- **Polish tail:** A2 (resize/canvas), A3 (empty player bar), E2 (About) — fold into N12 or a cleanup pass.

Gate-1 sign-off recommendation: A1 + B1 + B2 should be cleared before declaring Phase 1 "daily-usable"; the rest is Phase 1.8 hardening.
