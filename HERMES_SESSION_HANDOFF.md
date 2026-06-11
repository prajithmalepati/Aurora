# HERMES_SESSION_HANDOFF.md

**Sessions 8 + 9 + 10 + Gate 0 complete (2026-06-10, Fable 5). Phase 0 APPROVED — see `GATE0_REVIEW.md`. PR #2 open. Post-gate listening pass found real bugs; status below.**

## Post-Gate listening-pass bugs (2026-06-10 evening, Fable 5)

**Fixed + measured (commits `a395939`, `defa340`, `1bfffd8` on `hermes/phase0-s10`):**
1. Double-advance after natural-end crossfade — outgoing engine's `end` handler stayed bound; its true end always lands mid-fade → spurious `next()` ~fade-duration into every following song. Fix: detach all outgoing-engine handlers at handoff. Verified by sampling real `<audio>` elements (Audio-constructor intercept — Howler html5 nodes are DOM-detached).
2. Repeat-one dead with crossfade on — early trigger called `next()` unconditionally. Fix: trigger skipped on repeat-one; end handler loops (respects trim start). Verified.
3. "Awkward fade" — measured equal-power AND linear shapes are mathematically clean; perceived weirdness was bug 1's chained double-fade.

**OPEN — silent playback after natural end (unreproduced).** User heard silence; debug logs showed transition `to:5` with `prevPlaying:false` (= early trigger never fired; song reached absolute end or prior playback was already dead), then a manual-next with `prevPlaying:true` (silent engine WAS "playing"). NOT reproduced in 6 headless configs (equalpower/linear, 3s/5s, trigger path, end path, real autoplay policy, 2 consecutive ends — all clean). Diagnostics now in place, gated by `localStorage.setItem("aurora-debug-audio","1")`: per-transition state + 5s heartbeat (pos/vol/playing). Next occurrence → console screenshot gives the verdict: pos advancing + vol 0.7 + silent ⇒ output-path issue; pos frozen ⇒ blocked play; vol 0 ⇒ fade-state bug.

**Hermes N1 (overnight polish) DONE:** `hermes/phase1-polish`, 6 commits (`98dca53`…`6402429`) — virtualizer key, disabled opacity, press states, transition-all sweep (21 sites), playlist-delete rollback, border tokens. N1.1 (queue badge 8px) reported stale — needs Fable verification. Branch pushed, NOT reviewed yet, NOT in any PR.

## Next session (Fable 5) — agenda
1. Audio silence: read user's debug-console output (heartbeat + transition lines), identify which of the 3 verdicts, fix at root. Repro tooling ready: `/tmp/aurora-{xfade,double-end,linear,endpath,repeat,manualnext}-repro.mjs` (Audio-intercept + volume sampling pattern).
2. Review `hermes/phase1-polish` diff (MiMo already passed it, Fable gate needed): verify N1.1 staleness, check the 21-site transition property lists against actual hover/active classes, then merge into `hermes/phase0-s10` so PR #2 stays the single Phase-0 PR.
3. Finish listening pass: overlap curve, gapless (crossfade off), ReplayGain (NOTE: library currently has ZERO RG metadata — scanner may not extract it; check `file_scanner.py` before blaming playback), repeat-all wrap, pause mid-fade, trimmed song.
4. PR #2 merge once listening pass clean → then Phase 1 per STRATEGIC_PLAN.

## Gate 0 outcome
- All checklist items pass (details in `GATE0_REVIEW.md`). One review-found bug fixed in-session: watcher deletions never invalidated caches (`d076a3d`).
- All 10 `hermes/phase0-s*` branches pushed to origin.
- **PR not yet created** — `gh` unauthenticated on this machine. Human: `gh auth login`, then PR `hermes/phase0-s10 → main` (body drafted in Gate 0 session log / GATE0_REVIEW.md §merge plan).
- **Merge blocked on one human item:** listening pass (crossfade ×3 curves, gapless, ReplayGain, trim).
- Punch list for Phase 1/2 in `GATE0_REVIEW.md` (5 deferred items) + `DESIGN_QA.md` Tier-3 (11 items).

## What Session 10 delivered (task 0.12)

Live design audit on `hermes/phase0-s10`: 42 before + 42 after Playwright screenshots (every view × 1440/768/390, `/tmp/aurora-s10-shots/{before,after}/`), zero console errors. Output: `DESIGN_QA.md` (committed) — tiered punch list with stale-VISUAL_AUDIT items marked.

Tier-1 fixed in-session (commit `b77965a`):
1. **Mobile hamburger overlapped every page title** (<768px) — `AppShell.tsx` main container now `pt-14 md:pt-0`.
2. **Playlist hero collapsed ≤768** (title truncated to one letter at 768, gone at 390) — responsive padding/art/type (`28/44/64px`), `flex-wrap` actions, `min-w-[180px]` metadata.
3. **FoldersView unusable at 390** (fixed 256px tree) — stacks `flex-col md:flex-row`, tree `max-h-[35vh]` on mobile.

Tier-2 also fixed: quick-tag header 26→28px, dead `.playerbar-*` CSS deleted (44/80 vs 52/96 mismatch), WelcomeOverlay off-palette indigo/blue → aurora teal, 3× `transition: all` in index.css → explicit property lists.

Tier-3 punch list (11 items) feeds Gate 0 — see `DESIGN_QA.md`. Verified already-fixed since VISUAL_AUDIT: responsive Settings/About padding, 28px title scale, context-menu clamping, global focus ring.

`npm run build` clean. After-screenshots verified at all 3 widths, desktop unchanged.

## Git state
Branch: `hermes/phase0-s10` (2 commits ahead of `hermes/phase0-s9`: `b77965a` fixes, `41c4224` DESIGN_QA.md)
Previous: `hermes/phase0-s9` (1 commit ahead of `hermes/phase0-s8`)

```
14d9bfa feat(player): Aurora seek bar — split hitbox, song-color gradient fill, comet glow   <- S9
8ffb9c6 docs: S8 handoff — PlaybackEngine keystone complete
c381637 refactor(frontend): extract PlaybackEngine interface, useAudioPlayer talks to HowlerEngine
e7b0088 fix(backend): correct legacy data-dir migration paths off by one level
d6e35e1 fix(audio): stale-howl drain no longer kills the crossfade prev handoff
```

S7 ended without a handoff; verified complete during S8 startup (howlerCompat ✓, single-transaction playlist delete ✓, watcher mtime guard ✓).

## What Session 9 delivered (task 0.11)

`SeekScrubber.tsx` + `index.css` (`.scrub-*` block replaces `.seek-bar`):
- **Split hitbox/visuals**: 24px container, invisible native `<input type=range>` overlay (a11y + keyboard + CLAUDE.md plain-range rule intact), visual layers `pointer-events-none` behind.
- **Fill** `--seek-pct` width, `var(--song-color) → var(--song-color-2)` gradient (tokens.css defaults are the no-color fallback), `transition: width 250ms linear` smoothing 4Hz ticks; suppressed via `data-dragging` / `data-instant` (keyboard + wheel seeks).
- **Comet head**: 16px blurred radial at fill's leading edge, `--song-color-2` @35%, no idle animation.
- **Thumb**: 12px white + song-color ring, hidden at rest, in on hover/focus-visible, `scale(1.15)` while dragging; sibling of the scaled stack so scaleY can't distort it.
- **Hover**: `transform: scaleY(1.5)` (GPU, never height), 150ms `cubic-bezier(0.23,1,0.32,1)`, gated `@media (hover:hover) and (pointer:fine)`; time labels brighten via color.
- **Trim notches**: 2×8px white/25 at `start/end_time_ms`.
- **Buffering shimmer**: sweeps unplayed region on `data-buffering` — LIVE already (S8 wired engine `buffering` → store `isBuffering`), not Phase-2-dormant as the spec assumed.
- **Tooltip**: cursor-anchored on hover, thumb-anchored while dragging.
- **Touch**: thumb always visible 10px. **Reduced motion**: no scaleY/width transitions, opacity/color kept.

### S9 verification (headless chromium, real library)
13/13 PASS: 24px hitbox · all layers · fill advancing with real per-song oklch gradient · thumb rest/hover/drag states · scaleY transform on hover · tooltip · click-to-seek · `data-dragging` + transition suppression · `data-instant` on keyboard · **avg layout 0.387ms (gate <1ms; 226 layouts/10s)** · reduced-motion ✓ · pointer:coarse ✓. Zero console errors. `npm run build` clean.
Not machine-verifiable: 10-min CPU flatness, 60fps drag *feel*, trim-notch visuals (no trimmed song at queue head) — fold into S10/Gate 0 human pass.

## What Session 8 delivered (task 0.8) — summary
- `types/playback.ts` — PlaybackEngine contract (buffering in event model).
- `lib/engines/howlerEngine.ts` — HowlerEngine + `createPlaybackEngine()` factory + `unlockAudioOutput()`.
- `useAudioPlayer.ts` — pure orchestration, zero Howler imports outside engine/compat.
- Smoke-tested 5/5 (play/next/pause/resume/previous), pytest 120/120.

### Bugs found & fixed during S8
1. **Crossfade dead since June 6** (`188415f`): stale-Howl drain stopped the outgoing Howl before `prev.playing()` was read → crossfade never triggered, gapless was a hard cut. Fixed `d6e35e1`.
2. **S2 data-dir migration never ran**: `old_root` had one `.parent` too many (pointed at repo root). Fixed `e7b0088`.

## ✅ Migration completed & verified on this machine (2026-06-09 ~22:40)
Human removed the blocking empty DB; verification boot ran the real migration:
- `~/.local/share/Aurora/aurora.db` — 352 songs ✓ (moved from `backend/`)
- `~/.local/share/Aurora/album-art/` — 312 files, served 200 at `/api/album-art/{file}` ✓
- playlist-images: none ever existed (7 playlists, 0 covers in DB) — nothing to migrate
- `backend/aurora.db` + `backend/album-art/` gone from the source tree ✓

Incident during verification, resolved: the S9 dev boot used `AURORA_DATA_DIR=/tmp/aurora-s8-data` with the fixed migration code — DB move was skipped (scratch DB present) but **album art got moved into /tmp**. Recovered by copy before reboot could wipe it. Lesson: a scratch-data-dir boot still migrates art/images out of the REAL legacy locations; future scratch dirs should pre-create empty `album-art/` + `playlist-images/`… or better, only ever migrate-test on copies.

**MAIN LAPTOP notes:** (1) first boot of any phase0 branch migrates its DB/art to the platformdirs location — expected; (2) booting `main` (pre-S2 code) AFTER that migration will create a fresh empty `backend/aurora.db` — don't panic, the real DB is in the data dir; merge Phase 0 soon to close this gap.
Also: crossfade curves + gapless still need a human listening pass — broken June 6 → tonight.

## Dev/test conveniences from these sessions
- Boot backend against a scratch copy: `AURORA_DATA_DIR=/tmp/aurora-s8-data python run.py` (dir holds a copy of the real DB).
- Headless smoke scripts: `/tmp/aurora-s8-smoke.mjs`, `/tmp/aurora-s9-verify.mjs` (playwright from `frontend/node_modules`; needs `--autoplay-policy=no-user-gesture-required`; two PlayerBar variants → filter `visible=true`; default view is Mix, click "All Songs" first).

## Known latent issue (document for Gate 0)
Outgoing engine's `end` handler stays bound during crossfade; fade-timer vs natural-end race could double-`next()`. Pre-existing, preserved under zero-behavior-change. Guard candidate for Phase 2/4.

## For the next session — Gate 0 (Fable 5 only)
- Start on `hermes/phase0-s10`
- Checklist (kickoff §Gate 0): golden suite green · playback matrix passes · no `localhost:8000` outside `getBaseUrl` · DB/images in data dir · migrations versioned · >500-song library reachable at 60fps · watcher invalidation verified · seek bar perf gate · DESIGN_QA.md top tier fixed ✓ (this session)
- Read cumulative diff `main...hermes/phase0-s10`, approve Phase 1 or bounce sessions → push branches → PR → human merge. Nothing is on main yet.
- Human items still pending: crossfade curves + gapless listening pass (broken June 6–9, fixed in S8); 10-min CPU flatness + trim-notch visuals from S9; mobile drawer nav close-on-select feel (S10 observation: drawer stays open after picking a view — works, but evaluate).
- Dev servers: backend `AURORA_DATA_DIR=/tmp/aurora-s8-data venv/bin/python run.py` (scratch dir intact with album-art/ + playlist-images/ so migration can't steal real art); sweep scripts `/tmp/aurora-s10-sweep.mjs` + `/tmp/aurora-s10-sweep-390fix.mjs` (main sweep times out on 390 dialogs — known, fix-script covers the 4 missing shots).

## N2 — Lagged Crossfade Curve + Respect-Trims Toggle

**Branch:** `hermes/phase1-xfade` (off `hermes/phase0-s10`) — 3 commits:
- `863bcbb` — `feat(settings): lagged crossfade curve option`
- `5a8f2f9` — `feat(audio): lagged crossfade curve — fade out over N, incoming enters at N/2`
- `f388cc0` — `feat(audio): respect-trims toggle — trim-out is the effective end for playback, crossfade, and preload`

**What was implemented:**

| Feature | Detail |
|---|---|
| Lagged crossfade curve | 4th curve option: outgoing fades over full N, incoming starts at N/2 and fades up over remaining N/2. Uses `laggedStartTimerRef` for delayed start, respects pause during delay window, cleans up on skip/unmount. |
| Respect song trims toggle | Global setting (default ON). When enabled: start-trim seek on load, crossfade triggers at trim-out point (not file end), end handler loops to trim start, preload keys off effective end. Apple Music "Stop Time" convention. |

**Files modified:**
- `frontend/src/stores/settingsStore.ts` — added `"lagged"` to CrossfadeCurve type, added `respectTrims` + `setRespectTrims`
- `frontend/src/components/settings/SettingsView.tsx` — "Lagged" curve button, "Respect song trims" toggle row
- `frontend/src/hooks/useAudioPlayer.ts` — laggedStartTimerRef, lagged branch in crossfadeIn, trim-gated tick/end/preload

**Verifications (all green):**
- `npm run build` clean ✓
- `pytest` 120/120 passed ✓
- 5 repro scripts all PASS:
  - `/tmp/aurora-fadelock-repro.mjs` (linear) ✓
  - `/tmp/aurora-fadelock-overlap.mjs` (overlap) ✓
  - `/tmp/aurora-fadelock-ep.mjs` (equalpower) ✓
  - `/tmp/aurora-lagged-repro.mjs` (lagged) ✓
  - `/tmp/aurora-pausefade-repro.mjs` (pause mid-fade) ✓
  - `/tmp/aurora-trimfade-repro.mjs` (trim-crossfade) ✓ — overlap at t=56s before 60s trim
- Toggle-off sanity: FAIL as expected (trims ignored, crossfade at full duration)

**Repro scripts written this session:**
- `/tmp/aurora-lagged-repro.mjs` — asserts incoming silent during first 40% of fade, playing by 70%
- `/tmp/aurora-trimfade-repro.mjs` — asserts crossfade triggers before trim-out point

**Out of scope (per brief):** No per-playlist trim toggle, no skip-crossfade-for-same-album, no trim editor changes, no backend changes, no refactors beyond specified lines.

**For Fable 5 review:** Diff is `main...hermes/phase1-xfade`. Human listening pass needed for lagged curve audibility + trim-crossfade timing feel.

## N3 — Lagged Double-Play Fix + Phase 1 Desktop Start (Tauri + Sidecar)

**Session:** 2026-06-10, Hermes. Branch: `hermes/phase1-xfade` (1 new commit).

### Task 1: lagged double-play guard ✅

**Bug:** During lagged crossfade, pause→resume within the N/2 delay window causes double-play. The isPlaying resume effect calls `engine.play()` on the parked incoming engine, but the pending `laggedStartTimerRef` timeout fires 1.5s later and calls `engine.play()` again on an already-playing engine, spawning a second Howler sound instance.

**Fix:** Added `if (engine.isPlaying()) return` guard in the lagged timer callback (line 516 of `useAudioPlayer.ts`), after the `engineRef.current !== engine` check. No other changes.

**Commit:** `52c093e fix(audio): guard lagged delayed start against double play after pause-resume` (already on branch from previous push).

**Verification:**
- `/tmp/aurora-lagged-pauseresume-repro.mjs` → PASS (1 incoming instance, not 2)
- `/tmp/aurora-lagged-repro.mjs` → PASS (no regression)
- `/tmp/aurora-pausefade-repro.mjs` → PASS (no regression)
- `npm run build` → clean

### Task 2: open PR for `hermes/phase1-xfade` ❌ BLOCKED

`gh auth` token invalid. Cannot create PR. Human needs to run `gh auth login` or provide a valid token. PR command ready:
```
gh pr create --base hermes/phase0-s10 --head hermes/phase1-xfade --title "feat(audio): lagged crossfade curve + respect-trims toggle"
```
Branch has 5 commits (4 N2 + 1 N3 fix), all pushed.

### Task 3: Tauri 2 scaffold ❌ BLOCKED

Rust installed (1.96.0 via rustup, user-level). `webkit2gtk-4.1` and `libayatana-appindicator` not installed — `sudo pacman` requires password. Cannot proceed unattended.

**Next session:** `sudo pacman -S --needed webkit2gtk-4.1 libayatana-appindicator` then `npx tauri init`.

### Task 4: PyInstaller freeze of backend ✅

**Changes:**
- `backend/run.py` — added `import sys`, `is_frozen = getattr(sys, "frozen", False)`, `reload=not is_frozen`. PyInstaller frozen binaries have no source files to watch.
- `backend/aurora-backend.spec` — onedir mode. Explicit `app/` package in datas (uvicorn string-imports aren't traced). Hidden imports: boolean, uvicorn submodules, mutagen submodules, miniaudio, all app.routers and app.services.

**Commit:** `03edbe3 feat(backend): PyInstaller freeze spec — onedir mode, conditional reload`

**Verification:**
- `pyinstaller aurora-backend.spec` → build complete
- Frozen binary on port 8123 (empty data dir) → health 200, songs 0
- Frozen binary on port 8124 (real data dir) → health 200, songs 352, stream 200 (11MB), album art 200 (264KB)
- `pytest -q` → 120/120 passed

### Tasks 5–6: sidecar lifecycle + folder picker ❌ BLOCKED

Both require Tauri scaffold (Task 3). Deferred to next session.

### Deviation from brief

- `frontend/src-tauri/` not created (Task 3 blocked). Brief default layout path preserved for next session.
- PR not opened (Task 2 blocked). All 5 commits pushed, PR command documented above.

### Next session agenda

1. `sudo pacman -S --needed webkit2gtk-4.1 libayatana-appindicator` → Tauri scaffold (Task 3)
2. Sidecar lifecycle (Task 5) + folder picker (Task 6)
3. `gh auth login` → open PR (Task 2)
4. Push `hermes/phase1-desktop` branch
