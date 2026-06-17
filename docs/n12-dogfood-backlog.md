# N12 Dogfood Feedback Backlog (Round 2)

> **Source:** Developer dogfood of the **post-N12 Windows desktop build**, 2026-06-14
> (built via CI `desktop-build.yml` off `hermes/phase1-closeout`).
> **Captured by:** Hermes planner (Opus 4.8). Nothing here is implemented yet.
> **Predecessor:** `docs/gate1-feedback-backlog.md` (Round 1 → N11/N12). The polish
> tail there (A2 canvas stutter, A3 empty player-bar, E2 About) is **still open**.
> **Design mandate:** every UX/visual item below MUST be designed using the
> **`impeccable`** and **`frontend-design`** superpowers skills before coding — the
> user has asked for this repeatedly. The implementing brief is authored *through*
> those skills, not freehand.

Severity: 🔴 blocks daily use · 🟠 major UX/functional · 🟡 polish · 🔵 question.

**Confirmed FIXED in this build:** Tags page count is correct (user added an extra
tag with songs to verify — no bogus "of 345"). ✅

---

## A. Functional / visual bugs

| ID | Item | Sev | File / root-cause hypothesis | Fix direction |
|----|------|-----|------------------------------|---------------|
| R1 | **Folders still show no songs** when a folder is selected. N11's "auto-select first leaf" did not fix it on the real build — main area stays empty. | 🔴 | `components/folders/FoldersView.tsx` — auto-selects first **leaf** (`firstLeaf.path`, line ~53) then fetches `/folders/songs?path=` on `currentPath` change (line ~79). Hypotheses: (a) the chosen leaf has no **direct** songs (songs live on a parent/other node), (b) the endpoint needs a recursive/`?path=` shape that doesn't match, (c) songs fetch succeeds but render chain doesn't show them. | Reproduce against the real DB; log the `/folders/songs` response for the auto-selected path. Likely select a folder that actually **has** songs (or make selection show songs from the subtree), not just the first leaf. |
| R2 | **Playlist cover "bleed" is the wrong color.** Upload saves and persists across restart, but the ambient bleed/glow behind the cover uses some other color instead of being **generated from the cover image itself** — the way song covers do. | 🟠 | Song covers derive an ambient color from the artwork; playlist cover bleed uses a different (static/playlist-accent) source. Bleed refs: `layout/AppShell.tsx`, `layout/Sidebar.tsx`, `playlists/PlaylistDetail.tsx`, `playlists/PlaylistItem.tsx`. | Find the cover→color extraction used for song artwork and apply the **same** technique to the playlist cover image so the bleed matches the uploaded cover. |
| R3 | **Lagged crossfade curve is wrong.** It waits until the old song **fully dies** before the new one starts (sequential), instead of starting the incoming track at ~**half** (overlap). | 🟠 | `hooks/useAudioPlayer.ts` — `laggedStartTimerRef` (line ~37) schedules the delayed start of the incoming engine; `resolveXfade()` (line ~80) supplies duration/curve. The lag delay is set too long (≈ full fade) instead of ≈ `duration/2`. | Make the lagged curve start the incoming engine partway through the outgoing fade (overlap at ~50%), matching the intended design. Re-derive against the curve spec. |
| R4 | **Fade-curve graphs look wrong / aren't understandable.** Either the SVG shapes don't match the real engine math, or they don't read clearly. | 🟡 | `settings/SettingsView.tsx` (N12 SVG diagrams) vs the actual gain functions in `hooks/useAudioPlayer.ts`. R3 implies at least the lagged shape is inaccurate. | Re-draw each diagram from the **real** gain-over-time function (esp. lagged after R3 fix); add clearer plain-language framing. Design via `impeccable`. |
| R5 | **Album border glow is buggy / not snappy.** The hover glow on album cards feels janky, not crisp. | 🟡 | `albums/AlbumsView.tsx` line ~190 — `transition-[box-shadow] duration-200` + inset rim (line 193). box-shadow transitions are not GPU-composited → jank. | Use a composited glow (pseudo-element opacity / transform) or `will-change`, tune timing. Design via `impeccable`/`frontend-design`. |
| R6 | **Right-click menu not opaque/frosted enough** — text behind the menu bleeds through and makes the menu text messy. | 🟡 | Menu uses `bg-popover` (translucent dark token) with **no backdrop blur** (`components/ui/dropdown-menu.tsx` + SongRow's custom menu in `songs/SongRow.tsx`). | Give the menu a solid/near-opaque surface or a real frosted-glass effect (`backdrop-blur` + higher-opacity bg) so text is always legible. |
| R7 | **"showing 100 of 345 — load more"** footer is semi-transparent and looks bad. | 🟡 | `components/songs/SongTable.tsx` pagination footer styling. | Restyle the footer (legible, intentional). See R-columns / load-more rethink below. |

## B. UX / interaction

| ID | Item | Sev | File | Fix direction |
|----|------|-----|------|---------------|
| R8 | **Bulk-action options are pinned to the top.** In a 250-song list you must scroll all the way up to act on something — counterintuitive. | 🟠 | `components/songs/SongTable.tsx` bulk bar (top). | Make actions reachable without scrolling: sticky/floating bulk bar that follows, and ensure the per-row **⋯** menu (added in N12) fully covers single-item edits in place. Design via `impeccable`. |
| R9 | **Selection checkbox shows on every row** by default — visually noisy. | 🟠 | `songs/SongRow.tsx` / `SongTable.tsx` selection column. | Hide checkboxes by default; add a **"Select"** toggle button (in the toolbar) that enters selection mode and reveals checkboxes. |
| R10 | **Add a tag by right-clicking a song** → context menu → tag dropdown. | 🟠 | `songs/SongRow.tsx` custom context menu. | Add an "Add tag" entry to the song context menu opening a tag submenu/dropdown (reuse the existing tag-popover logic). |
| R11 | **Row height too tall** (carried from earlier this session). User prefers the compact playlist density; N12 unified everyone to the tall library row. | 🟠 | `SongTable.tsx:360` `ROW_HEIGHT = 64`; `songs/SongRow.tsx` cells `py-3`. | Lower density (e.g. `ROW_HEIGHT` 64 → ~52, `py-3` → `py-2`). Confirm final number visually. |

## C. Columns (configurable-columns feature)

| ID | Item | Sev | File | Fix direction |
|----|------|-----|------|---------------|
| R12 | **Columns are atrocious / not user-controllable.** Users should choose which columns show, **reorder by drag**, and **resize** them. All-Songs must-have set: **Title, Duration, Album (optional), Type (mp3/flac/…), Tags**. | 🟠 | `songs/SongTable.tsx` + `SongRow.tsx` (N12 added a fixed per-page `columns` prop — needs to become user-configurable). | Build a column manager: show/hide picker, drag-reorder, resizable widths, persisted per page (localStorage, like `settingsStore`). Bring back **Type** as a real column (codec was moved to the Edit dialog in N12 — user wants it selectable as a column). Design-critical → `impeccable`. |
| R13 | **Playlist page shows a redundant "playlist" column** — not needed inside a playlist. | 🟡 | `playlists/PlaylistDetail.tsx` column set. | Drop the redundant column on the playlist page; trim its columns to the useful set. Falls out of R12. |

---

## Still open from Round 1 (not yet done)
- **A2** aurora/waveform canvas stutter + white flash on window resize (`components/aurora/AuroraCanvas.tsx`).
- **A3** empty/idle PlayerBar shows a black band (`components/layout/PlayerBar.tsx` + AppShell).
- **E2** About section audit (`components/about/AboutView.tsx`).

## Sequencing note
This is a larger UX/design pass than the original N13 "polish tail." Recommend the
next brief (N13 or split N13/N14) bundle: R1 + R3 (the two functional bugs), then the
design cluster (R6/R8/R9/R10/R11/R12/R13 + R2 bleed + R5 glow + R4/R7 polish), each
designed through `impeccable` / `frontend-design`. Keep ambiguous calls tagged
🔎 DAIKI CROSS-CHECK per the dual-review model.
