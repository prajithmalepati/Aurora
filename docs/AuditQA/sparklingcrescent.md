# Aurora f008 — Post-QA Audit & Followup Fixes

**Branch:** master (HEAD `102b54b`)
**Date:** 2026-05-26 (Session 29 planning)
**Predecessor:** Session 28 QA pass marked f008 done/passes:true, but live testing revealed multiple regressions Session 28 missed.

---

## Context

f008 "Visual Overhaul — Northern Lights over OLED" was implemented Session 27 and QA'd Session 28 via headless Playwright. User then ran the site on `localhost:5173` (HEAD = current build) and found multiple broken behaviors and aesthetic regressions documented in `docs/design/new2.md`.

External audits (Cursor Opus 4.7 `docs/design/crsrop4.7.md`, DeepSeek V4 `.kilo/plans/1779820994868-session27-audit.md`, GPT 5.5.1 synthesis `docs/design/gpt5.51plan.md`) had already flagged 12 quality-debt items. User testing now confirms several are not just quality debt — they break audio playback, cause visible stutter, and the bleed effect escapes its container.

**Why this plan exists:** Restore baseline functioning (audio, stutter, App-level re-renders), unify cross-surface inconsistencies (play buttons, sort), and document the QA-process gap that let headless Playwright sign off on a build with these defects.

Out of scope here (parked as next plan): PlayerBar visual polish (bleed dial-down, button bloom tuning, seek bar redesign), design pivot (logo, background video/image, light-source-from-image bleed prototype).

---

## In Scope (this plan)

Two buckets:
- **A. Critical bugs** — audio dropout/silence, App-level re-renders, waveform Howler hack, context loss recovery, crossfade pause bug
- **B. Cross-surface consistency** — unify play button across 4 surfaces, add sort + column-clickable headers to playlist views
- **C. Process doc** — append JOURNAL entry explaining what Session 28 QA missed and why

---

## A. Critical Bugs

### A1. Audio silence after pause/play or skip — root cause confirmed

This is the user's #1 complaint and the highest-severity item. Symptom: pause/play makes timer move but no audio; skip-forward sometimes plays silently; song finishes naturally and next plays audibly.

**Root cause (verified in code):**
- `frontend/src/hooks/useAudioAnalyser.ts:25-28` — `if (ctx.state === 'suspended') { ctx.resume(); return }`. The early return runs without scheduling a re-run. If the AudioContext suspends (browser autoplay policy, tab inactive, system audio interruption), the analyser graph is never connected. Because Howler is using `html5: true` and `createMediaElementSource` has captured the `<audio>` element, audio ONLY flows through the Web Audio graph. No graph = no sound.
- `frontend/src/hooks/useAudioAnalyser.ts:88` — effect deps `[currentId, isPlaying]`. The graph tears down + rebuilds on every pause/play and every song change. The tear-down disconnects source from destination. The rebuild reconnects — but between cleanup and the next effect body running, the source has zero downstream connections. Result: audible dropout on every transition.

**Fix:**
1. Drop `isPlaying` from the deps array. The analyser should be built once per song (per `currentId` change), not per play/pause toggle. The RAF inside should self-gate on `isPlaying` via a ref read, not via effect re-runs.
2. Replace the suspended-state early return with: subscribe to `ctx.onstatechange`, and when it transitions back to `'running'`, re-run the connection step. Alternative: wait on `ctx.resume()` then continue inside the effect rather than returning. Practical implementation: convert the body to async, `await ctx.resume()`, then proceed.
3. Insert a passthrough `GainNode` between source and destination that is created once and never disconnected. The analyser tap reads from the source via a separate `connect(analyser)` call. This guarantees source→destination is always intact even when the analyser is being rebuilt.

**Critical constraint:** Do not break the two-effect architecture in `useAudioPlayer.ts` (per CLAUDE.md). Touch only `useAudioAnalyser.ts`.

**Files:**
- `frontend/src/hooks/useAudioAnalyser.ts` (entire file)

**Verification:**
- Manual: play song → pause → resume → confirm audio. Skip → confirm audio. Skip rapidly 5 times → confirm no silent songs.
- DevTools Console: `Howler.ctx.state` should report `running` throughout.
- DevTools Performance tab: capture a pause→play cycle, confirm no >50ms gap in audio.

---

### A2. B1 — Full App re-render per song change (sluggishness contributor)

User reports general sluggishness, click feedback feels delayed. One major contributor: `App.tsx:34` calls `useAuroraColor()` directly, which returns `color1LinearRgb` / `color2LinearRgb` from `useState`. Every song change runs `setColor2Linear` → re-renders the entire `<App>` tree, cascading to SongTable, PlayerBar, Sidebar, QueryBuilder.

The `AuroraColorBridge.tsx` null component exists but is never rendered.

**Fix:**
- Render `<AuroraColorBridge />` in `App.tsx` before `<AppShell>`.
- Move the color values to a Zustand store (extend `playerStore` with `auroraColor1` / `auroraColor2`, OR create a new `auroraStore`). `AuroraColorBridge` writes via the store action. `AppShell` reads via the store selectors. App component no longer subscribes to color state.
- Remove the `useAuroraColor()` call from `App.tsx`.

Per project rule (CLAUDE.md): state lives in Zustand stores, never React Context — extending an existing store is the right move.

**Files:**
- `frontend/src/App.tsx` (lines 16, 34, 199-200)
- `frontend/src/components/aurora/AuroraColorBridge.tsx`
- `frontend/src/stores/playerStore.ts` (extend with color slice)
- `frontend/src/hooks/useAuroraColor.ts` (write through store action)
- `frontend/src/components/layout/AppShell.tsx` (read from store)

**Verification:**
- React DevTools → Profiler → record a song change. Confirm only `AuroraCanvas` and `PlayerBar` re-render. `SongTable`, `Sidebar`, `QueryBuilder` should not.
- Click responsiveness should feel tighter (subjective but reproducible).

---

### A3. B2 — Waveform reads wrong Howl via private API

`frontend/src/components/player/WaveformBar.tsx:53` reads `(window as any).Howler?._howls?.[0]` to drive the playhead position. During crossfade `_howls[0]` is whichever Howl was created last — sometimes the outgoing one — so the playhead races against the audible song.

**Bonus fix unlocked:** Currently the RAF is the only thing that mutates `clipRect.width`. Under `prefers-reduced-motion` the RAF early-returns, so the played region stays at width 0 forever — user sees a dim outline with no progress. (Cursor crsrop4.7 MED 2.)

**Fix:**
- Accept `seek: number` prop from `usePlayerStore.getState().seek` (already populated by `useAudioPlayer.ts:90-93` at 250ms interval) — pass as prop from `PlayerBar.tsx`.
- Drive `clipRect.width` and `playline.x1/x2` from `seek` via `useEffect([seek])` writing to the refs directly (zero re-render, ref attribute mutation).
- Drop the `(window as any).Howler` access entirely. Drop the RAF (or keep it only as a smoothness interpolator between 250ms store updates — optional polish).
- Under reduced motion, the progress is still rendered because the effect runs on every seek tick; only smooth interpolation is disabled.

While in this file, fix the hardcoded playhead stroke `oklch(0.78 0.18 195)` at line 109 → `color-mix(in oklch, var(--song-color) 80%, white 20%)` to honor per-song atmosphere. (Cursor crsrop4.7 LOW 5.)

**Files:**
- `frontend/src/components/player/WaveformBar.tsx` (rewrite tick logic)
- `frontend/src/components/layout/PlayerBar.tsx:110` (pass `seek` prop)

**Verification:**
- Play a song through crossfade transition — playhead should track audible song, not jump.
- Toggle macOS/Windows reduced motion ON → confirm waveform shows progress (no animation, but progress visible).
- Confirm playhead stroke now matches per-song color.

---

### A4. B3 — WebGL context loss leaves canvas blank

`frontend/src/components/aurora/AuroraCanvas.tsx:253-269`. `onContextLost` cancels RAF but does NOT set `webglFailed=true`. If `webglcontextrestored` never fires (Firefox 16-context limit, GPU process crash, mobile thermal throttle), the canvas remains in its last-frame state forever and the CSS `.aurora-fallback` never activates.

**Fix:**
- In `onContextLost`, start a 5-second timer. If `webglcontextrestored` fires before the timer, clear it and resume normally. If the timer fires first, `setWebglFailed(true)` to swap in the CSS fallback.

**Files:**
- `frontend/src/components/aurora/AuroraCanvas.tsx:253-269`

**Verification:**
- DevTools → Rendering → "Lose Context" button. After 5s with no restore, confirm fallback gradient appears.
- "Restore Context" button before timer fires → shader resumes.

---

### A5. N3 — Crossfade pause/resume reveals outgoing song

`frontend/src/hooks/useAudioPlayer.ts:194` calls `prevHowlRef.current?.play()` on resume. If the user pauses mid-crossfade, the outgoing song was being faded toward 0. On resume, it plays at its current (partially faded) volume alongside the new song until its setTimeout fires the stop.

**Fix:**
- Before `prev.play()`, check `prev.volume()` — if < 0.05, do not resume it.

**Files:**
- `frontend/src/hooks/useAudioPlayer.ts:192-199`

**Verification:**
- Enable crossfade in settings. Trigger song change. Pause during the fade. Resume. Confirm only the incoming song is audible.

---

### A6. AuroraCanvas + WaveformBar reduced-motion MQL not re-evaluated

Both `frontend/src/components/aurora/AuroraCanvas.tsx:243` and `frontend/src/components/player/WaveformBar.tsx:66` read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once at mount. Toggling OS-level reduced motion mid-session does not start or stop the loops until full reload.

**Fix:**
- Attach `mql.addEventListener('change', handler)` in both effects. On change, start or cancel the RAF / re-init or destroy WebGL accordingly.

Don't create a `useReducedMotion()` hook for two consumers — inline `matchMedia` with listener is fine.

**Files:**
- `frontend/src/components/aurora/AuroraCanvas.tsx`
- `frontend/src/components/player/WaveformBar.tsx`

**Verification:**
- Play song, toggle OS reduced motion on → shader stops + canvas hides, waveform RAF stops (if kept as polish layer).
- Toggle off → shader resumes.

---

## B. Cross-Surface Consistency

### B1. Unified play button across 4 surfaces

User reports inconsistency: SongTable hover button ≠ PlaylistDetail button ≠ QueryBuilder button ≠ PlayerBar button. Confirmed:
- `frontend/src/components/songs/SongRow.tsx:111` — `aurora-play-btn` class (flat, hover opacity)
- `frontend/src/components/playlists/PlaylistDetail.tsx` — different play handler styling
- `frontend/src/components/filter/QueryBuilder.tsx` — different
- `frontend/src/components/layout/PlayerBar.tsx:151-183, 280-312` — liquid glass + star bloom

**Fix:**
- Create `frontend/src/components/ui/AuroraPlayButton.tsx` with a `variant` prop: `'glass-bloom' | 'row-hover' | 'inline'`.
  - `glass-bloom` = PlayerBar's full liquid-glass + star bloom (current PlayerBar styling).
  - `row-hover` = SongRow's flat circle that fades in on group-hover.
  - `inline` = small variant for list headers (PlaylistDetail's "play whole playlist" button).
- Each variant uses the same base shape (round, same stroke widths) so the family reads as one button system at three sizes/intensities.
- Replace inline JSX in all 4 surfaces with the new component.

**Files:**
- `frontend/src/components/ui/AuroraPlayButton.tsx` (new)
- `frontend/src/components/songs/SongRow.tsx:109-118`
- `frontend/src/components/playlists/PlaylistDetail.tsx` (locate play buttons, swap)
- `frontend/src/components/filter/QueryBuilder.tsx` (locate, swap)
- `frontend/src/components/layout/PlayerBar.tsx:151-183, 280-312`

**Verification:**
- Hover a song row, click play-button on a playlist header, look at PlayerBar — visual family should be obvious.
- All four buttons should respond to the same `active:scale-[0.94]` press feedback.

---

### B2. Sort + column-clickable headers on all list views

Currently only `SongTable` has sort. `PlaylistDetail` does not. User wants column-clickable headers + dropdown sort everywhere a list of songs is displayed.

**Fix:**
- Locate existing sort logic in `SongTable.tsx` — confirm whether it's a reusable hook/util or inline.
- Extract into `frontend/src/hooks/useSongSort.ts` if not already factored.
- Apply to `PlaylistDetail.tsx`'s song list rendering.
- Add a sort dropdown (shadcn `DropdownMenu`) to the PlaylistDetail header next to its existing controls.
- Column headers: make `<th>` elements clickable, cycle ascending → descending → unsorted.

**Files:**
- `frontend/src/components/songs/SongTable.tsx` (extract sort logic)
- `frontend/src/hooks/useSongSort.ts` (new if needed)
- `frontend/src/components/playlists/PlaylistDetail.tsx` (apply sort + dropdown)

**Constraint:** PlaylistDetail has a manual song order (drag-reorder). Sort must be a UI overlay only — don't persist sort order to backend, don't break the manual ordering.

**Verification:**
- Switch between sort modes on All Songs and PlaylistDetail — both feel identical.
- Reload PlaylistDetail — manual order intact (sort is session-local UI).

---

## C. Process Doc — JOURNAL Entry

Append to `claude-workspace/Aurora/JOURNAL.md` (NOT in Aurora repo per global CLAUDE.md). Entry shape:

```
2026-05-26 — MISTAKE — Session 28 headless QA missed live-test regressions

What was done: f008 signed off as done/passes:true via Playwright headless QA.
What should have been done: Headless QA + human live-test before sign-off.
Why it happened: Headless Playwright can verify DOM structure, computed styles,
  ARIA labels, and visual snapshots. It CANNOT verify:
  - Audio plays (no audio output in headless WebKit)
  - Cross-surface design consistency (no human eye)
  - Click latency / perceived sluggishness
  - GPU stutter during interactions
  - Visual escape of effects beyond container bounds (bleed)
Trigger to detect earlier next time: Any feature touching audio playback,
  cross-surface visual systems, or perceived performance MUST have a "human
  10-minute drive" gate before features.json status → done.
```

Once this entry exists alongside any two more "Session N QA missed X" entries, PATTERNS.md gets a new pattern: "Headless QA is necessary but not sufficient for audio/visual/perceptual features."

---

## Execution Order

Phase 1 (Opus or careful Sonnet — high audio regression risk):
- A1 (audio silence — root cause, biggest user impact)
- A5 (crossfade pause)

Phase 2 (parallel-safe Sonnet batch):
- A2 (B1 store extension)
- A3 (B2 waveform rewrite)
- A4 (B3 context loss timer)
- A6 (MQL listener)

Phase 3 (Sonnet, sequential — same files):
- B1 (unified play button — 4-file refactor)
- B2 (sort everywhere)

Phase 4:
- C (JOURNAL entry in `../claude-workspace/Aurora/JOURNAL.md`)

Each fix = one commit per CLAUDE.md format: `fix(scope): description` or `feat(scope): description` or `refactor(scope): description`. No body, no Co-Authored-By.

---

## Out of Scope — Parked for Next Plan

Once this plan is executed, the next plan (Session 30) tackles:

### PlayerBar polish
- Dial down `--halo-art` blur radius from 60px → 36px and spread from 12px → 4px (`tokens.css:47`)
- Dial down bleed gradient opacity in `index.css:904` from 35% → 18%
- Tune star bloom intensity (currently `oklch(0.97 0.04 185 / 1.0)`)
- Promote inline radial gradient on play button to a data-state CSS class
- Remaining inline `style` violations (PlayerBar h=32px, WaveformBarSkeleton)
- M1 (`useSongTransition.ts` dead — delete)
- M2 (only `motion` package truly unused — uninstall)
- M3 (correct HANDOFF curtain count 5→4, or add 5th curtain and re-QA perf)
- M8 (`songStore.ts` relative imports → `@/`)
- N5 (file_scanner alpha PNG composite-on-black bug)

### Design pivot (research + AI dispatch)
- **Aurora logo redesign.** Current SVG wordmark is "bad" per user. Dispatch to: nano banana for concepts → Claude design web (claude.ai Artifacts) for refinement → user picks → re-trace as SVG. Brief written as `docs/design/logo-brief.md`.
- **Background image/video supplement.** Reverses K5 (kill list killed static PNG). Idea: subtle night-sky loop video behind the GLSL canvas. Decision needed: ship video as alternative-to vs supplement-to shader. Battery/bandwidth cost analysis required. **Candidate tool: HeyGen HyperFrames** (`github.com/heygen-com/hyperframes`, Apache 2.0, agent-native HTML→MP4 renderer, v0.6.46) — agent writes HTML/CSS/JS composition and renders deterministic loop. Avoids the nano-banana frame-by-frame route for procedural sky/aurora animations. Trade-off: HyperFrames outputs are headless-Chrome-rendered (same engine as the live shader), so quality ceiling = whatever CSS/canvas can do offline; not a route for photoreal long-exposure footage. Pair: HyperFrames for procedural loops, nano banana for stills, real long-exposure footage for photoreal.
- **Light-source-from-image bleed prototype.** User idea: instead of radial gradient, sample a bright region of album art, blur it heavily, position as a "light leak" behind PlayerBar. Reference points to research: Apple Music ambient mode, Spotify Canvas, iOS Now Playing widget. Prototype in CodePen or local branch before integrating.
- **Resizable PlayerBar** (low-pri feature).
- **Queue button** (low-pri feature).

### Tooling integration (do before Phase 1 execution)
- **agent-browser MCP integration.** Install `minhlucvan/agent-browser-mcp` (or roll own MCP wrapper around `vercel-labs/agent-browser` CLI). Add to project `.mcp.json` or user `.claude.json`. Validates: accessibility-tree snapshots smaller than Playwright DOM dumps, useful for the human-verification gates in this plan. Time: ~30min. Fall back to Playwright MCP if install fails.(user here i edited after made the opus plan: that agentborswer mcp link is to some random dude with 6 stars on that repo. so this is the offical one:https://github.com/vercel-labs/agent-browser)
- **HyperFrames evaluation.** Clone `heygen-com/hyperframes`, run quickstart (`hyperframes.mintlify.app/quickstart`), produce one 5-second test loop rendering an aurora-like CSS animation to MP4. Output: `docs/design/hyperframes-eval.md` — verdict on whether it can author the background-video supplement. Time: ~1hr. Skip if quickstart fails.(user here i edited after made the opus plan:  so this is the offical one:https://hyperframes.heygen.com/quickstart and https://www.heygen.com/hyperframes and https://github.com/heygen-com/hyperframes we have to be careful about what we install)

### External resource dispatch for next plan
- **DeepSeek V4 via Kilo Code** — independent second-pass audit of this plan's changes after execution. Brief as `.kilo/plans/session29-audit-brief.md`.
- **GPT 5.5 (Cursor)** — design-restraint review of the unified play button component and sort UI. Brief as `docs/design/session29-gpt55-review.md`.
- **Opus 4.7 (Cursor)** — code-quality review of `useAudioAnalyser.ts` rewrite and `auroraStore` extension (the highest-risk changes). Brief as `docs/design/session29-opus47-review.md`.
- **Nano banana** — logo concept generation. Brief as `docs/design/logo-brief.md`.
- **Claude design web** — UI polish iteration on PlayerBar and logo. Open user-side, paste in current screenshots.

---

## Verification Checklist (end-to-end after Phase 1-4 complete)

Before declaring this plan done:

1. **Audio drive test** (HUMAN, headphones-on, NOT headless):
   - Play song → pause → resume. Audio resumes.
   - Skip forward 5 times rapid. No silent songs.
   - Pause mid-crossfade, resume. Only incoming song audible.
   - Tab away 5 minutes, return, click play. Audio resumes (ctx.resume path).
2. **Re-render test** (React DevTools Profiler):
   - Record song change → only `AuroraCanvas` + `PlayerBar` re-render.
3. **Waveform test**:
   - Playhead matches audible song through crossfade.
   - OS reduced-motion ON → progress visible, no animation.
4. **Context loss test** (DevTools Rendering):
   - Lose context, wait 5s → CSS fallback gradient visible.
   - Restore context before timer → shader resumes.
5. **Consistency test** (HUMAN):
   - Play buttons on SongRow hover, PlaylistDetail header, QueryBuilder, PlayerBar — visual family obvious.
   - PlaylistDetail has sort dropdown + clickable column headers like All Songs.
6. **Backend connected**: ensure backend at `:8000` runs throughout — none of these touch backend.

Update `features.json`: add `f009` for this followup, mark `done` with `passes:true` only after all 6 checklist items pass.

Update `HANDOFF.md` Session 29 entry.
