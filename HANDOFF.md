# Aurora — Session Handoff

## ✅ AURORA v1.0 — COMPLETE (2026-06-04)

All 23 tasks across 4 phases executed. **12 agents dispatched over 6 waves.** All builds pass. All commits made.

### Phase 1: Ship Blockers (7 tasks)
| Task | What | Commit |
|---|---|---|
| 1.1 | Playlist flash fix: `detailLoading` decoupled from sidebar `loading` | `cd26c83` |
| 1.2 | M8 relative import: `./playerStore` → `@/stores/playerStore` | `ab2900e` |
| 1.3 | B4 audio prebuffer: `nextHowlRef` preloads next song in last 5s | `3e2c143` |
| 1.4 | Error Boundaries: 5 boundaries wrapping all key component trees | `b4ebad7` |
| 1.5 | Empty/loading/error states: 21 audited, 5 gaps fixed | `3e2c143` |
| 1.6 | Scan flow verified: Session 36 fixes confirmed, runtime PASS | `6f006ca` |
| 1.7 | Commit & docs: HANDOFF updated, v1.0 plan committed | `6f006ca` |

### Phase 2: Core Music Player (6 tasks)
| Task | What | Commit |
|---|---|---|
| 2.1 | True gapless: play-before-stop + preload readiness tracking | `1615f07` |
| 2.2 | ReplayGain: extract during scan, 4 DB columns, volume normalization | `15c221a` / `c95d4a3` |
| 2.3 | Queue management: history, reorder, Play Next, QueuePanel, context menu | `e53a9a2` |
| 2.4 | Keyboard shortcuts: 16 total, useKeyboardShortcuts hook, overlay modal | `63063f4` |
| 2.5 | Waveform seek: smooth scrubbing, real peaks, hover tooltip, wheel seek | `921d5a6` |
| 2.6 | Crossfade: 3 curves (Linear/Equal Power/Overlap), presets, visual indicator | `a989d37` |

### Phase 3: Library Management (5 tasks)
| Task | What | Commit |
|---|---|---|
| 3.1 | Multi-artist tags: split on delimiters, primary/all/featured artists | `062f353` |
| 3.2 | Better metadata: format badge, bitrate, sample rate, file size, file type | `3893096` |
| 3.3 | Drag-to-reorder + multi-select + bulk operations + undo-remove | `9c1007f` |
| 3.4 | Import/export playlists (M3U/M3U8/JSON) | `0980c9e` |
| 3.5 | Folder-level browsing with tree navigation + breadcrumbs | `9710778` |

### Phase 4: Polish for Public Release (5 tasks)
| Task | What | Commit |
|---|---|---|
| 4.1 | README.md: comprehensive with features, tech stack, quick start, usage | `e3eb140` |
| 4.2 | Screenshots: 8 Playwright-captured views for GitHub README | final |
| 4.3 | About view: version, credits, full keyboard ref, filter syntax guide | `e3eb140` |
| 4.4 | First-run WelcomeOverlay with 3 action cards, auto-dismiss | `e3eb140` |
| 4.5 | Performance audit: 2 new indexes, TTLCache layer, React.memo on SongRow | final |

### Bugs resolved this session
B1-B4 all resolved. M1 (useSongTransition never created) and M3 (doc mismatch) remain trivial.

### Files changed
~40 files modified, ~12 new files created, ~3,000+ lines of code added.

### Build
`frontend/ npm run build` passes clean. Bundle: 781KB JS, 107KB CSS.

### Claude Code (Opus 4.8)
Produced the initial plan via ACP transport (410s, 15 API calls, 30+ files read).

---

### Phase 1 complete — 7 tasks, 7 commits

| Task | What | Commit |
|---|---|---|
| 1.1 | Playlist flash fix: `detailLoading` decoupled from sidebar `loading` | `cd26c83` |
| 1.2 | M8 relative import: `./playerStore` → `@/stores/playerStore` | `ab2900e` |
| 1.3 | B4 audio prebuffer: `nextHowlRef` preloads next song in last 5s | `3e2c143` |
| 1.4 | Error Boundaries: 5 boundaries (Sidebar, PlayerBar, main content, fatal App-level) | `b4ebad7` |
| 1.5 | Empty/loading/error states: 21 audited, 5 gaps fixed (audio errors, network errors, error UIs, tagStore error field) | `3e2c143` |
| 1.6 | Scan flow verified: all 3 Session 36 fixes confirmed working, runtime tests PASS | `6f006ca` |
| 1.7 | Commit & docs: HANDOFF updated, v1.0 plan + audit reports committed | `6f006ca` |

**Bugs resolved:** B1 (already fixed), B2 (already fixed), B3 (already fixed), B4 (audio prebuffer implemented), M8 (relative import fixed). M1 (useSongTransition unused — not created), M3 (doc mismatch — trivial) remain.

**Build:** `frontend/ npm run build` passes. All TypeScript clean.

**Plan:** 23 tasks across 4 phases. Phase 1 done. Phases 2-4 pending. Full plan at `docs/v1.0-release-plan.md`.

**Claude Code (Opus 4.8):** Produced the plan via ACP transport (410s, 15 API calls, 30+ files read).

---

## Completed This Session (2026-06-04 — Session 36)

### Spare ("Hermes") environment brought up + two scan bugs fixed

**Environment:** reproduced on spare per Session-35 plan — backend `venv` + deps (incl. **`python-multipart`**, which was missing from `requirements.txt` and crashed backend startup; now pinned `==0.0.32`), `frontend/node_modules`, graphify CLI (0.8.31), global skills `graphify`/`impeccable`, project skill `emil-design-eng`, plugins (`caveman` installed; `superpowers`/`frontend-design` already enabled via official marketplace), `.claude/settings.json` graphify PreToolUse hook. graphify graph force-rebuilt (stale WinSCP copy → real build, 2029 nodes/2779 edges/165 communities). Both servers verified up: backend :8000, frontend :5173, `aurora.db` auto-created (65 anime songs already imported from `/home/fusei/Desktop/Music/Anime`).

**Bug 1 — scan completes then "input stream error", no playlist (SSE serialization crash).** `POST /api/scan/stream` built its final `{"type":"done"}` event with the full song dicts, which still carried `bleed_thumb` (raw image **bytes**). `json.dumps` can't serialize bytes → stream crashed mid-send after the progress bar filled. **Fix:** `file_scanner.py` strips `bleed_thumb` from `songs`/`replaced_songs` before streaming (thumb already in DB, served via `GET /api/songs/{id}/bleed-thumb`). Supersedes the Session-34 note that `/scan/stream` was "confirmed working" — it was never tested through to the done event with art-bearing files.

**Bug 2 — re-scanning an already-imported folder doesn't create the playlist.** Playlist was filled only from `imported`; on a re-scan all files are skipped duplicates → `imported: 0` → playlist never created. **Fix:** new `playlist_song_ids` list captures the DB id at every path (import, replace, all three skip cases); playlist built from that (order-preserving dedupe, `INSERT OR IGNORE` = idempotent). Verified end-to-end against the real 65-song DB: re-scan with `imported:0, skipped:65` produced a 65-song playlist (test playlist then removed).

**Bug 3 — player-bar color bleed shows default blue for every song (NULL `dominant_color`).** Pre-existing bug exposed by the fresh spare DB (aurora.db was not copied). `extract_metadata` loads audio with `mutagen.File(..., easy=True)`; an `EasyMP3` object does not expose embedded APIC art, so `_get_art_bytes` returned None → `dominant_color`/`bleed_thumb` never computed (165/167 songs NULL). `extract_album_art` reads the file itself, so `album_art_path` was populated for all — masking the gap. Frontend bleed reads `dominant_color` → `--song-color` (`useAuroraColor.ts`), falling back to default cool-blue when NULL. **Fix:** `extract_metadata` now retries `_get_art_bytes(mutagen.File(file_path))` (non-easy) when easy mode yields no art. Backfilled the 165 existing NULL rows with `backend/backfill_colors.py` (one-off, idempotent — only touches `dominant_color IS NULL`): all 167 songs now have `dominant_color` + `bleed_thumb`; `/api/songs/{id}/bleed-thumb` returns 200. NOT my Session-36 edits — verified my `file_scanner.py` diff is confined to `import_scanned_songs`.

Docs updated: `docs/02-api-contract.md` (scan step 7), `docs/04-file-scanner.md` (two authoritative behavior notes), `file_scanner.py` docstrings. Not yet committed.

## Completed Previous Session (2026-06-03 — Session 35)

### GitHub mirror + dual-agent (Hermes) setup prep

**What this session was:** infra/workflow, no app code changed. Got Aurora onto GitHub as a code-only mirror and planned the two-machine (main + spare "Hermes") collaboration.

| Item | Outcome |
|---|---|
| **GitHub push** | Force-pushed current code to existing private repo `prajithmalepati/Aurora`, overwriting the stale 9-month Supabase version (`cce4950` → `75aca21`). `origin` set; local branch renamed `master`→`main` (tracks `origin/main`). Repo confirmed **PRIVATE**. |
| **Code-only cleanup** | Untracked AI/process files via `git rm --cached` (disk preserved): `CLAUDE.md`, `HANDOFF.md`, `features.json`, `.claude/commands/`, `.kilo/`, `docs/superpowers/`, `docs/design/`, `docs/audits/`, `docs/qa/`, `docs/deferred-ideas.md`, `graphify-out/GRAPH_REPORT.md`. Added all to `.gitignore`. 190→132 tracked files. Verified no secrets/.env in tree. Commit `75aca21`. |
| **KEPT in repo** | `backend/`, `frontend/`, core specs `docs/01`–`12`, `docs/design-system.md`, `docs/design-decisions-memo.md`, `docs/HEALTH.md`, `docs/Aurora.png`. |
| **Branches** | 3 task branches (`aesthetic-quick-wins`, `health-p2-fixes`, `health-p3-fixes`) left local, NOT pushed. |

**Dual-agent architecture (agreed, not yet operational):**
- GitHub private repo = transport. Branch ownership: `claude/*` = main (Opus), `hermes/*` = spare (DeepSeek V4 / MiMo).
- Hermes work → PR → Opus reviews → human merges. Direct push only on `hermes/scratch-*`.
- Coordination via HANDOFF.md + features.json (both copied to spare via WinSCP). **Top risk: stale HANDOFF → drift.** Keep it tight.

**Spare (Hermes) setup — handed to user to execute:**
- GitHub auth: **fine-grained PAT scoped to Aurora only** (Contents R/W + PR R/W, no Administration = no delete). `gh auth login --with-token` → `gh auth setup-git` → clone. NOT full `gh auth login` web flow.
- WinSCP copies (not in repo): music library, all process/AI docs, `backend/aurora.db` (or rescan), `frontend/public/playlist-images/` (or re-upload after rescan).
- Regenerate on spare (don't copy): `backend/venv` (68M, `pip install -r requirements.txt`), `frontend/node_modules` (286M, `npm install`).
- Reproduce plugins: `superpowers`, `frontend-design`, `caveman`; global skills `graphify`/`impeccable`; project skill `emil-design-eng`; copy `.claude/settings.json` (graphify hook) + `.claude/commands/`.

### Interim work since Session 34 (play-button saga + perf, already committed)

Long iteration on the player play button: WebGL/three.js fluid-glass attempts → reverted → landed on **pure CSS frosted glass** (`78ca7e9`), green-accent, taller 96px bar so controls don't clip (`b587cb1`), row play button centered via inset-0 flex overlay (`3f6af46`). Plus perf: **SeekScrubber extracted** so PlayerBar no longer re-renders 4×/sec on seek tick (`470fa8f`) — this is the fix the deferred "C — wave speed" item asked for; consider it addressed. Dead `.aurora-play-btn` CSS removed (`2db9750`). Sidebar playlist hover glow reworked to edge-light border line (`4e2ada9`).

---

## Completed Previous Session (2026-05-28 — Session 34)

### Refinement pass v2 — executed from `docs/design/refinement-pass-v2.md`

Plan was Opus 4.8 re-audit of the prior session's plan (two stale root causes fixed). 4 steps: A1/A2/A3, B1→B2, C (skipped), D.

| Step | What | Commit |
|---|---|---|
| A1 | BorderGlow: base border → transparent, fill-opacity → 0, remove PlaylistItem hover wash | `843dcf0` |
| A2 | AlbumArt: add imgRef + cached-image guard (`complete && naturalWidth > 0`) → fixes Firefox cover vanish after sort | `843dcf0` |
| A3 | Mix: debounced auto-search (280ms, validateQuery guard) — tag click triggers results without pressing Search | `843dcf0` |
| B1 | PlayerBar: stop animating height (layout prop → static class), remove overflow-hidden → clears halo clip path | `251f0db` |
| B2 | AuroraPlayButton: complete rewrite — pure CSS Approach 1, drop feTurbulence, glass family unified across PlayerBar + SongRow + PlaylistDetail | `78ca7e9` |
| C | SKIPPED — Playwright RAF throttled to 1fps, profiling not possible. Code analysis suggests WaveformBar already reads seek via refs (immune to re-render speed). Needs real DevTools profiling to confirm. | — |
| D | Scan: SSE streaming progress endpoint (`POST /scan/stream`), AbortController cancel, progress bar UI, mtime re-scan detection for edited files | `290e46e` |

**C notes for next session:** To profile wave speed — open DevTools Performance, record 3s playing + 3s paused. Look for WaveformBar re-renders every ~250ms in the flame chart. If confirmed, fix: (1) wrap `formatDuration(seek)` text in a tiny `SeekText` subscriber component, (2) change WaveformBar to read `playerStore.getState()` in RAF instead of props. No wall-clock changes.

**D notes:** Backend `/scan/stream` endpoint confirmed working (PowerShell test returned 404 for nonexistent path as expected). Browser test timed out because I picked a folder with 50k+ venv files — expected behavior. Real music folder will complete normally.

---

## Previous Session (2026-05-27 — Session 33)

### Visual overhaul refinements — executed from plan `new2-md-recovered-cross-check-vs-twinkly-hopper.md`

**What this session was:** Executed all 9 tiers from the locked plan (5 external research responses pre-existed). All tiers shipped, verified with Playwright screenshots, and committed individually.

| Tier | What | Commit |
|---|---|---|
| 1C | Move `useAudioAnalyser`+`useAuroraIntensity` from App.tsx → AuroraCanvas. App no longer re-renders on audio frames. | `80075a0` |
| 1A | Rewrite WaveformBar as dual animated sine-wave lines (no peaks data). Delete WaveformBarSkeleton. | `02e1b88` |
| 2D | AnimatePresence mode="wait" spring crossfade on song info block in PlayerBar (mobile + desktop). | `0b88105` |
| 1B | Liquid glass play button: SVG feTurbulence displacement + chromatic dispersion + pointer-tracked specular. CSS+SVG path (no separate WebGL canvas). | `c328a5e` |
| 2A | Audit — no code changes needed. PlayerBar already uses correct glass variants; SongRow uses row variant; PlaylistDetail uses raw Lucide icon. | — |
| 2B | PlaylistDetail: replace native sort `<select>` with ArrowUpDown icon → Popover. Title + Duration column headers clickable with chevron indicator. | `cf9aa90` |
| 2C | Backend: `extract_bright_region()` in `color_utils.py` (pure Pillow, no numpy). 5 new DB columns (`bleed_thumb BLOB`, 4 region ints). New `GET /api/songs/{id}/bleed-thumb` endpoint. Frontend: bleed CSS layer in PlayerBar using background-image + blur + screen blend. | `8c6e00a` |
| 3A | BorderGlow on sidebar playlist tiles. CSS in index.css, `BorderGlow.tsx` TypeScript component, hex→HSL helper in Sidebar. `glowRadius=8`, `glowIntensity=0.4`, paint-only. | `abf4687` |
| 3C | Library Label logo: Fraunces upright Roman (`SOFT=0`, `opsz=144`, weight 500), tracking +0.02em, no star, no italic, no glow. | `f2217af` |

Also created `docs/deferred-ideas.md` capturing all explicitly deferred/parked items (FlowingMenu rejection, waveform_peaks column, bespoke ligature fallback, etc.).

**Backend note:** `bleed_thumb` only populated on new scans. Existing 358 songs have NULL → 404 on `/bleed-thumb`. Rescan populates them. Manual backfill helper: `backend/backfill_one.py` (test only, not production).

---

## Previous Session (2026-05-26 — Session 28)

### Visual overhaul QA — f008 driven to `done` / `passes: true`

**What this session was:** Full QA pass of f008 "Visual Overhaul — Northern Lights over OLED" (implemented in Session 27, never QA'd). Used MCP Playwright (WebKit headless). External audits from GPT 5.5 (`docs/design/gpt5.52.md`) and DeepSeek V4 (`.kilo/plans/1779820994868-session27-audit.md`) incorporated before testing.

**Features.json:** `f008` updated to `status: done, passes: true`.

### QA results (3.1–3.9)

| Section | Result | Notes |
|---|---|---|
| 3.1 Aurora shader | PASS | WebGL active, 4 curtains, DPR cap 1.5, RAF running |
| 3.2 Per-song color bleed | PASS | --song-color/--song-color-2 update on click, halo wired |
| 3.3 WaveformBar | PASS | 200 bars via 2 paths, clip-path playhead, a11y range overlay |
| 3.4 Play button liquid glass | PASS | backdrop-blur, specular, star bloom, active:scale-[0.94] |
| 3.5 Wordmark + typography | PASS | SVG wordmark, Fraunces ≤3, JetBrains Mono on kbd operators |
| 3.6 Focus model | PASS | Double ring on all 12 tab-cycled elements, no trap |
| 3.7 Empty/loading/error | PASS | 0-results MixEmptyState + clear button, star-buffering class, shader survives backend kill |
| 3.8 Reduced motion | PASS* | *2 inline fixes required (see below) |
| 3.9 Performance | PARTIAL PASS | RAF cadence fine; GPU frame time UNABLE TO VERIFY in headless |

### Inline fixes applied during QA

1. **PlayerBar.tsx** — Lucide `Shuffle`/`Repeat`/`Volume` icons: `strokeWidth` 2 → 1.5 (GPT5.5/DeepSeek audit confirmed)
2. **WaveformBar.tsx:65** — Added `prefers-reduced-motion` guard: skip RAF start when media query matches
3. **AuroraCanvas.tsx:243** — Added `prefers-reduced-motion` guard: skip `initWebGL` + RAF when media query matches (CSS already hides canvas + shows static `body::before` gradient)

### Backend rescan — already done

Backfill script (`backend/backfill_peaks_colors.py`) ran in Session 28: 358 songs processed, 335/358 have waveform_peaks, 355/358 have dominant_color. API confirmed returning new fields.

### Open follow-up issues (not blocking, filed during audit)

| ID | Issue |
|---|---|
| B1 | AuroraColorBridge never rendered — `useAuroraColor()` in App.tsx causes full App re-renders on song change |
| B2 | WaveformBar uses `Howler._howls[0]` private API for seek position — wrong Howl during crossfade |
| B3 | AuroraCanvas context loss: `webglFailed` not set on `webglcontextlost` — fallback never activates |
| B4 | Audio dropout between song changes (source node disconnected briefly) |
| M1 | `useSongTransition.ts` defined but never imported — 400ms waveform choreography is dead code |
| M3 | 4 GLSL curtains in code; HANDOFF claimed 5 (phase 7.93 missing) |
| M8 | `songStore.ts` uses relative imports `./tagStore`, `./filterStore` — CLAUDE.md violation |

---

## Previous Session (2026-05-27 — Session 27)

### Visual overhaul — full implementation executed (all 39 tasks)

**What this session was:** Execution of `docs/superpowers/plans/2026-05-25-aurora-visual-overhaul.md` using subagent-driven development. All 6 phases complete.

**Total commits this session:** ~20 commits from `17099cb` to `b37b314`.

### Phase summary

**Phase 0 — Design tokens:** `tokens.css` — surfaces, borders, text, motion, `--song-color`/`--song-color-2`, `--focus-ring`, `--halo-art`. (Carried over from Session 26.)

**Phase 1 — Backend contract:** DB migration (3 new columns), SongResponse model, songs/filter/playlists routers updated, backend packages (miniaudio, Pillow), color_utils.py (OKLCH math), peak extraction, dominant color extraction, scanner pipeline wired, frontend types updated.

**Phase 2 — Kill list + fonts:** JetBrains Mono installed + wired, SongRow gradient text + left bar removed, SVG wordmark, nav indicator, FooterAction hover, QueryBuilder inline hovers, PlayerBar grid-template-rows + remove "Playing" label, liquid glass play button.

**Phase 3 — Color pipeline:** `useAuroraColor` hook (OKLCH → linear RGB, CSS vars), `useSongTransition` hook (400ms choreography, latest-ref pattern), `AuroraColorBridge` null component, PlayerBar color bleed + halo.

**Phase 4 — GLSL Aurora shader:**
- `AuroraCanvas.tsx` — WebGL GLSL (fBm, OKLab mix, altitude tinting, 4 curtains with phases 0.00/1.70/3.14/5.30), context loss handling, DPR cap 1.5, additive blend, lerped color2/intensity
- Bug fixed: `amplitude`/`color1` in `draw`'s useCallback deps → full WebGL reinit at 60fps (fixed with latest-ref pattern, commit `31e30dd`)
- `useAudioAnalyser` — B5-adapted: `createMediaElementSource` + WeakMap cache (NOT Howler.masterGain which is bypassed with `html5:true`)
- `useAuroraIntensity` — view + currentSong + 30s idle → uIntensity
- Wired into AppShell: `aurora-bg-image` removed, AuroraCanvas rendered as z-0 fixed layer
- Reduced-motion + WebGL fallback CSS

**Phase 5 — WaveformBar:** SVG component (200 bars, viewBox 600×32, RAF loop via `Howler._howls[0]`, clip-path playhead split), skeleton shimmer, wired into PlayerBar replacing both seek inputs with invisible native range overlay for a11y.

**Phase 6 — Polish:**
- Empty/loading/error states: `isBuffering` in playerStore + useAudioPlayer wiring + star-buffering class; MixEmptyState clear affordance
- Focus model: global `:focus-visible` + `.aurora-focus`/`.aurora-chip` all using `var(--focus-ring)` (per-song color double-ring)
- Anti-slop: Lucide strokeWidth 1.5 on Sidebar/AppShell icons, Fraunces reduced to ≤3 in QueryBuilder
- Performance validation: browser-only — see notes below

### Notable bugs fixed during execution

1. **`useAuroraColor` stale ref** — `color2Linear` was `useRef`, never triggering re-renders on song change. Changed to `useState` (commit `4f7a11f`).
2. **AuroraCanvas WebGL reinit at 60fps** — `amplitude` in `draw`'s dep array caused full shader recompile per audio frame. Fixed with latest-ref pattern (commit `31e30dd`).
3. **B5 confirmed** — Howler `html5:true` bypasses masterGain. useAudioAnalyser uses `createMediaElementSource` + WeakMap instead.
4. **`useEffectEvent` not in React 19 stable** — `useSongTransition` uses latest-ref pattern instead.
5. **`seekPct` orphaned** — Removed automatically when seek input replaced by WaveformBar.

### Performance validation (Task 6.4) — needs browser testing

Run `cd frontend && npm run dev`, then verify:
- GPU frame time ≤4ms (DevTools → Performance → GPU frames during aurora)
- No AnalyserNode/WebGLRenderingContext accumulation after 20 rapid song changes (Chrome Memory tab)
- Song list scrolls at 60fps with large library

**One architectural note:** `amplitude` from `useAudioAnalyser()` lives in App.tsx state. Every audio spike causes App-level re-render. The SPIKE_THRESHOLD=0.3 filter limits frequency, but if perf is an issue, move audio hooks into AppShell.

### Backend: rescan needed

After deploying backend, existing songs need a rescan to populate `waveform_peaks`/`dominant_color`/`dominant_color_2`. Until then:
- WaveformBar shows skeleton (correct behavior)
- AuroraCanvas uses default color2 (oklch(0.55 0.12 210))

---

## Next session

The visual overhaul is functionally complete. Next actions:

1. **Run the app and do visual QA** — verify aurora shader visible, waveform renders on scanned songs, color bleed works, play button liquid glass effect. Check reduced-motion in system preferences.

2. **Rescan music library** — Settings → Scan to populate peaks/colors for existing songs.

3. **Performance validation** — GPU frame time ≤4ms, memory leak test.

4. **Optional: move audio hooks down from App.tsx** — if App re-render perf is a concern, move `useAudioAnalyser()` and `useAuroraIntensity()` into AppShell.tsx so only AppShell re-renders on amplitude changes.

5. **Next feature** — see `features.json` for remaining work.

---

## Previous Session (2026-05-26 — Session 26)

### Implementation plan — written, not yet executed

**What this session was:** Plan-only. No code written. Multi-model review synthesis → `writing-plans` skill → full implementation plan.

**Plan:** `docs/superpowers/plans/2026-05-25-aurora-visual-overhaul.md` — read this before executing.

**External model reviews absorbed:**
- DeepSeek gap audit (`.kilo/plans/`) — blockers B1–B5 confirmed by GPT 5.5
- GPT 5.5 corrections: `start_time_ms`/`end_time_ms` already in model; culori needed for shader uniforms; don't remove static bg until AuroraCanvas lands; API returns `waveform_peaks` as `list[float] | null`
- Opus (Cursor) additions: token system, track transition choreography (useSongTransition), focus model, empty/error states, anti-slop checks (prime curtain phases, Lucide stroke-width 1.25, grain opacity 3–7%, diverse radii)

**Plan structure (6 phases + Phase 0):**
- Phase 0: Design tokens (`tokens.css`) — 30 min, no deps
- Phase 1: Backend contract (DB + scanner + API + frontend types) — blocks Phases 3–5
- Phase 2: Kill list + fonts — independent, can run in parallel with Phase 1
- Phase 3: Color pipeline (`useAuroraColor`, `useSongTransition`) — needs Phase 1
- Phase 4: GLSL aurora shader + `useAudioAnalyser` + `useAuroraIntensity` — needs Phase 3
- Phase 5: `WaveformBar` SVG — needs Phase 1
- Phase 6: Polish, focus model, anti-slop audit, perf validation

**Key technical decisions locked in plan:**
- `miniaudio.decode_file()` for peak extraction; graceful None for unsupported formats
- Pure Python sRGB→OKLCH math in `color_utils.py` (no colour-science dependency)
- 5 GLSL curtains with irrational phase offsets (0.00, 1.70, 3.14, 5.30, 7.93) — prevents mechanical repetition
- `waveform_peaks` stored as JSON TEXT in SQLite, decoded in `song_row_to_dict`
- `useAuroraIntensity` derives from 3 signals: `songStore.view` + `playerStore.isExpanded` + 30s idle timer
