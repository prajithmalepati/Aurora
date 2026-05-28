# Plan — Refinement pass v2 (corrected against live code, Opus 4.8 re-audit)

> Per Aurora convention, plans live in `docs/design/`. Plan mode forced this temp file to
> `~/.claude/plans/`. On execution: copy final to `docs/design/`, delete this temp copy.

## Context

The previous plan (`recap-executed-the-full-bright-nest.md`, authored by Opus 4.7) was re-audited
line-by-line against the current code by Opus 4.8 before execution. Two of its root causes were
**stale** — the exact "false-audit" failure mode the plan itself warned against, inverted:

1. **Section C was already shipped.** It claimed `useAudioAnalyser()`/`useAuroraIntensity()` "still
   live in App.tsx" causing a re-render storm. False — both already live in `AuroraCanvas.tsx:160-161`
   (commit `80075a0`, Session 33). App.tsx imports neither. The user confirms stutter is gone, but a
   **new, real** symptom remains: the wave runs slightly *slower* while playing, *faster* while paused
   (both smooth). Re-diagnosed below — different cause.
2. **Section B2's premise was stale.** It claimed "three different buttons." Reality: `AuroraPlayButton`
   is already one unified component with variants `player-desktop | player-mobile | row`. PlayerBar and
   `SongRow.tsx:113` both use it. The genuine remaining problems: it still uses grainy
   `feTurbulence`/`feDisplacementMap`, the `row` variant renders the old `.aurora-play-btn` look, and
   `PlaylistDetail.tsx:655` still uses a raw `<Play>` icon. User wants a **complete rewrite**.

A1, A2, A3, B1, D were verified accurate (minor path/line drift noted). This plan keeps those, drops
C's wrong cause for a real re-diagnosis, and re-scopes B2 as a clean-glass rewrite + true unification.

**User decisions locked this pass:**
- Wave speed: symptom is real (not stutter). Re-diagnose live, fix the actual cause.
- Play button: **complete rewrite** — DeepSeek Approach 1 (pure CSS layered gradients), drop
  `feTurbulence`, unify PlayerBar + SongRow row + PlaylistDetail hero into one glass family.

---

## A. Quick bug fixes (low risk, ship first)

### A1 — Sidebar BorderGlow (no rest border, hover edge-glow only, kill tile fill)
**Verified root cause:** `index.css:1214` `.border-glow-card` carries an always-on border; only the glow
pseudo-elements are hover-gated (`index.css:1248-1250`). `::after` (`index.css:1281-1303`) paints a
full color fill driven by `--fill-opacity: 0.4` hardcoded at `BorderGlow.tsx:108`. That stacks on top
of `PlaylistItem`'s own `group-hover` surface wash (`PlaylistItem.tsx:43-49`).
**Fix:**
- Gate the host border behind `:hover`/`.sweep-active` (or make base border transparent) → no visible
  border at rest.
- Drop/zero the `::after` fill (`--fill-opacity` ~0 or remove the `::after` layer) → hover shows only
  the edge glow (`.edge-light::before`, `index.css:1321+`), not a tile-wide wash.
- Keep ONE hover affordance: the colored edge glow in `playlist.color`. Soften/remove the duplicate
  `PlaylistItem` surface wash on glow tiles.
**Files:** `frontend/src/index.css` (1214–1340), `frontend/src/components/ui/BorderGlow.tsx:108`,
`frontend/src/components/layout/Sidebar.tsx` (BorderGlow wrapping; verify wiring),
`frontend/src/components/playlists/PlaylistItem.tsx:43-49`.
**Correction vs old plan:** PlaylistItem path is `components/playlists/` (old plan said `layout/`);
border line is 1214 (old said 1228).

### A2 — Covers vanish after sort (Firefox cached-image race)
**Verified root cause:** `AlbumArt.tsx:48` renders `<img opacity: loaded ? 1 : 0>`; `loaded` flips only
via `onLoad` (`:45`). Re-sort re-fetches → `useEffect([src])` (`:28-31`) resets `loaded=false`; in
Firefox a cached image fires `load` before React attaches the handler → stuck at `opacity:0`.
**Fix:** add `imgRef`; on mount and in the `[src]` effect, if `imgRef.current?.complete &&
naturalWidth > 0` set `loaded=true` immediately. Standard cached-image guard. (`AlbumArt.tsx:20-49`.)

### A3 — Mix page auto-search
**Verified root cause:** `executeFilter` runs only on Search/Enter (`QueryBuilder.tsx:144`). The moment a
tag makes `query` non-empty, `hasSearched` (`QueryBuilder.tsx:71`) is true and stale-empty `results`
route to `MixEmptyState` ("No songs match this query").
**Fix:** debounced reactive search — `useEffect([query])` in `QueryBuilder` (~280ms) → `executeFilter()`,
guarded by `validateQuery` (`QueryInput.tsx`) so half-typed `AND`/open-paren don't fire. Show the
"Build a query above" prompt (`QueryBuilder.tsx:297-306`) until the first auto-search resolves, not
"no match." Keep the Search button (immediate fire). (`stores/filterStore.ts:114-126`.)

---

## B. Player bar + play button (B1 before B2)

### B1 — Fix the clipping (impeccable: don't animate layout props)
**Verified root cause:** desktop bar animates `height` 52↔80 (`PlayerBar.tsx:207-210`) inside
`overflow-hidden` (`:210`, also outer `:48`). The 44px liquid button's decoration spills its box
(specular `inset:-35%` `AuroraPlayButton.tsx:179`, big drop shadow `:134`, SVG filter region 160%
`:71-77`) → sheared top/bottom.
**Fix:**
- Stop animating `height` (layout prop — impeccable ban + reflow jank). Use fixed/`min-height` +
  content fade, or animate `transform`/opacity of inner content.
- Remove `overflow-hidden` from the immediate flex row holding the button; keep it scoped only to the
  bleed-glow layer (`PlayerBar.tsx:56-75`, which already uses `maskImage` so likely needs none).
- Give the button cell ≥16px padding so the halo isn't clipped by any ancestor (prereq for B2).

### B2 — Complete rewrite: one clean liquid-glass button, truly unified
**Verified current state:** `AuroraPlayButton.tsx` is already one component (variants
`player-desktop | player-mobile | row`). PlayerBar uses it; `SongRow.tsx:113` uses the `row` variant;
`PlaylistDetail.tsx:655` uses a raw `<Play>` icon. The liquid variant still uses
`feTurbulence`→`feDisplacementMap` (`:79-94`); the `row` variant renders the old `.aurora-play-btn`
class (`AuroraPlayButton.tsx:18`, CSS `index.css:547-591`).
**Fix (rewrite):**
- Rewrite `AuroraPlayButton.tsx` using **DeepSeek Approach 1 — pure CSS layered gradients**
  (`docs/research/liquid-glass-button-clean-impl-response.md`). **Drop `feTurbulence` entirely.**
  Layers: backdrop-filter refraction div behind icon + song-color tint (overlay) + `::before` inner
  light-bend (soft-light) + `::after` pointer-tracked specular (radial glints + linear sweep,
  `mix-blend-mode: screen`, parallax via `--dx/--dy`) + 1px white rim + chromatic inset box-shadow.
- Keep a single component; sizes differ by variant, look is one family. Use in PlayerBar (desktop +
  mobile), SongRow row, and PlaylistDetail hero (replace the raw `<Play>` at `:655`).
- Delete the `.aurora-play-btn` CSS path (`index.css:547-591`) and the inline PlaylistDetail icon.
- Pointer tracking: keep `--mx/--my/--dx/--dy` set on pointermove, reset on leave; desktop only
  (mobile/row skip the handlers).
- Required guards: `color-mix` `@supports not` fallback (hardcoded teal tint);
  `@media (prefers-reduced-motion: reduce)` kills specular transform + transitions; `overflow: visible`
  + ≥16px parent padding (B1 must land first).
- Do NOT build DeepSeek Approach 2 (SVG `feDiffuseLighting`) unless the glass reads flat after viewing
  the rewrite live.
- Motion: ease-out `cubic-bezier(0.2,0.8,0.2,1)`, no bounce; press `scale(0.955)` + rim brighten.
**Files:** `frontend/src/components/player/AuroraPlayButton.tsx` (rewrite),
`frontend/src/components/layout/PlayerBar.tsx`, `frontend/src/components/songs/SongRow.tsx`,
`frontend/src/components/playlists/PlaylistDetail.tsx:655`, `frontend/src/index.css` (remove 547-591).
**Consult during execution:** `impeccable` (layout for B1, polish for B2) + `frontend-design`.
Verify at true 44px over the live aurora shader; Firefox + Chrome; 60fps press.

---

## C. Wave speed: slower playing / faster paused (RE-DIAGNOSED — old cause was wrong)

**Old plan's cause is invalid** (1C already shipped; App.tsx no longer re-renders on audio frames).
**New verified analysis:** both wave drivers are wall-clock — `WaveformBar.tsx:56`
(`t = (performance.now() - startRef)/1000`) and `AuroraCanvas.tsx:209`. Wall-clock animation is
frame-rate independent: it cannot truly slow under load — dropped frames produce *temporal aliasing*
(wagon-wheel effect) that reads as "smooth but slower." The playback-only trigger:
`useAudioPlayer.ts:92` runs a 250ms interval → `updateSeek` → `PlayerBar` subscribes to `seek`
(`PlayerBar.tsx:16`) → re-renders the whole player subtree 4×/sec (incl. `WaveformBar`, whose `seek`
prop changes). Paused = interval cleared (`onpause` `:127-132`) = no re-render = full 60fps = true speed.

**Hypothesis to confirm BEFORE coding (do not assert):** record a DevTools Performance profile during
playback vs paused. Expect PlayerBar/WaveformBar re-renders every ~250ms during playback and frame
intervals jittering off 16.7ms. If confirmed, fix by **decoupling wave + playhead rendering from the
seek re-render**:
- Make `WaveformBar` read seek/duration imperatively in its RAF (subscribe to `playerStore` via
  `getState()` or a ref) instead of via props, so the 250ms `updateSeek` no longer re-renders it.
- Isolate PlayerBar's time-text (`formatDuration(seek)`) into a tiny subscriber component so the 250ms
  tick re-renders only that text node, not the whole bar.
If profiling shows a *different* cause, stop and report — do not force this fix.
**Files (likely):** `frontend/src/components/player/WaveformBar.tsx`,
`frontend/src/components/layout/PlayerBar.tsx`. **No change to the wall-clock time math.**

---

## D. Scan dialog: async + progress + cancel (verified accurate)
**Verified root cause:** `POST /scan` is synchronous (`scanner.py:28`, plain `def`) — walks folder +
extracts art/peaks/colors per file with no progress/cancel/timeout. `ScanDialog.tsx` has no
AbortController; closing the modal abandons the UI while the server keeps running.
**Dedup — confirmed already solid** (`file_scanner.py`): skips exact `file_path` dupes, replaces
lower-quality `(title,artist)`, reuses playlist by name, `INSERT OR IGNORE` into `playlist_songs`. So
re-scanning the same folder adds no doubles today. **Gap:** no mtime check → an edited file at the same
path is skipped rather than re-read.
**Fix:**
- Backend: stream progress via SSE (simplest for single-user local) — `files_done / total` + current
  filename — from a new streaming endpoint; cooperative cancel flag on the job.
- Frontend: real progress bar (done/total + filename) + Cancel button; AbortController in
  `lib/api.ts`; closing modal/X aborts the in-flight request and stops the server walk.
- Add mtime-based update detection in the dedup path (upsert-by-path keyed on mtime, like iTunes/Plex).
**Files:** `backend/app/routers/scanner.py`, `backend/app/services/file_scanner.py`,
`frontend/src/lib/api.ts`, `frontend/src/components/scanner/ScanDialog.tsx` (+ possible backend
job/progress store).

---

## Execution order (commit after each — `type(scope): description` ONLY, stage specific files)
1. **A1, A2, A3** — independent quick wins.
2. **B1 → B2** — clipping fix, then clean-glass rewrite + unify. `impeccable` + `frontend-design`.
3. **C** — profile FIRST to confirm the seek-tick re-render cause, then decouple. Stop if cause differs.
4. **D** — largest; SSE progress + cancel + mtime.

Each step: `cd frontend && npm run build` (types) → browser-verify with Playwright MCP (A2 in Firefox;
B at true 44px over the shader; C with a Performance recording play-vs-pause) → use the `verify` skill
before claiming done → commit. Append `claude-workspace/Aurora/JOURNAL.md` for any mistake/decision
(esp. the two stale root causes found this audit). Update `HANDOFF.md` at session end.

## Verification (end-to-end)
- A1: sidebar — no border at rest; hover = soft colored edge glow only, no tile-wide wash. Screenshot.
- A2: Firefox — sort songs repeatedly; all covers stay visible.
- A3: Mix — pick a tag without pressing Search; results auto-populate after debounce; invalid partial
  query doesn't fire.
- B: identical glass family in PlayerBar + SongRow + PlaylistDetail; not clipped at any bar state;
  clean glass (no grain); 60fps press.
- C: Performance recording — RAF holds ~16.7ms during playback; wave speed matches play vs pause.
- D: progress bar advances + Cancel aborts server cleanly; re-scan = 0 dupes; edited file re-reads.

## Out of scope (parked)
- Logo redesign, resizable player bar, Queue page/button, seek-bar shape — not in this pass.
