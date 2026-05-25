# Aurora — Session Handoff

## Completed This Session (2026-05-26 — Session 26)

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
- K5 (static PNG background): NOT removed in Phase 2 — only Phase 4 removes it when AuroraCanvas replaces it
- Kimi noted for frontend visual iteration (Phases 2–5) once backend lands
- Agent-browser (Vercel Labs) noted as better than Playwright for visual regression

**State:**
- No code changed this session
- Plan file created: `docs/superpowers/plans/2026-05-25-aurora-visual-overhaul.md`
- **Next session: execute plan — start with Phase 0 + Phase 1 (backend scanner), then Phase 2 in parallel**

---

## Completed This Session (2026-05-25 — Session 25)

### Visual overhaul design spec — finalized

**What this session was:** Design-only. No code written. Full brainstorm → multi-model review → spec iteration cycle.

**Spec:** `docs/superpowers/specs/2026-05-25-aurora-visual-overhaul-design.md` — read this first.
**UX critique:** `docs/superpowers/specs/2026-05-25-aurora-ux-critique.md` — Opus 7500-token review, score 6.5/10 → patches applied.

**Core design decisions locked:**

| Decision | Chosen | Why |
|---|---|---|
| Aurora background | Vanilla GLSL canvas | @paper-design has no aurora effect; custom GLSL = real northern lights physics, 0KB bundle |
| Color computation | Backend scanner (scan time) | Eliminates `decodeAudioData` freeze + K-means hitch on song change |
| Play button interaction | Playback-state-driven (bloom on play, dim on pause, pulse on buffer) | Pointer theatrics (waver/hold-glow) = demo behavior on high-frequency control |
| Shader palette | `uColor1` = fixed brand teal, `uColor2` = album color | Preserves identity on any album art color |
| Aurora intensity | `uIntensity` uniform: 15–80% by view | Fullscreen shader at 100% behind dense list = visual migraine |
| Waveform | Pre-computed peaks from backend | Real-time FFT on progress bar looks cheap, perf risk |
| Fraunces | Max 2–3 uses per view | Three typefaces in product UI risks costume design |

**Three external reviews done:**
- Opus UX critic agent: 6.5/10 — flagged color contradiction, no calm regions, main-thread decode → all fixed
- Gemini 3.1 Pro: technical gotchas (`align-items: start` for grid-template-rows, decodeAudioData blocking) → added to spec
- GPT 5.5 via Cursor: 7/10 — killed mouse waver/hold glow, added performance budget + DB migration plan + Howler→AnalyserNode note → all absorbed

**Implementation order (critical — do not reorder):**
1. Backend scanner (prerequisite for everything)
2. Kill list + fonts + SVG wordmark (independent)
3. Color pipeline (`useAuroraColor` hook, CSS vars)
4. GLSL aurora shader (needs color pipeline first)
5. Waveform bar (needs backend peaks first)
6. Polish (reduced-motion, loading states, a11y)

### State
- All code: unchanged. No features added. Spec-only session.
- `docs/superpowers/specs/` — two new files committed to `master`
- `docs/design/new1.md` — user design notes (committed)
- **Next session: invoke `writing-plans`, produce implementation plan, then start Phase 1 (backend scanner)**

---

## Completed This Session (2026-05-25 — Session 24)

### Aurora identity locked + full tooling install

**What this session was**
Not a feature session. Full identity + design-language decision session before the visual overhaul.

**Identity doc:** `docs/design/identity-and-skills-plan.md` — single source of truth. Read this first next session.

**Decisions locked:**
- Aurora = personal tag+query music library dressed as "Northern Lights over OLED"
- Design language: pure OLED black `#000`, Liquid Glass surfaces (iOS 26 / visionOS), per-song dominant-color bleed
- Wordmark: custom SVG 'A' (two strokes, razor apex), bright-star at apex, 'urora' trailing in editorial italic. The star IS the play button interior — shared primitive.
- Fonts: Reckless Neue Italic / PP Editorial New Italic (display), General Sans (body), JetBrains Mono (tags, filter syntax, metadata)
- Bleed scope: player bar + now-playing + playlist hero. Filter cards stay neutral.
- Play button hold-to-glow: keep as easter egg
- Sessions log: keep current HANDOFF + `claude-workspace/Aurora/` workflow

**Skills installed (user-scoped unless noted):**
- `impeccable` (`~/.claude/skills/impeccable/`) — replaces ui-ux-pro-max. 23 commands, 27 anti-pattern rules.
- `emil-design-eng` (project `.claude/skills/`, symlinked from `.agents/skills/`) — Emil Kowalski motion principles
- `playwright` MCP — visual regression suite
- `context7` MCP — live React 19 / Tailwind 4 docs
- `shadcn` MCP — live shadcn registry
- `ui-ux-pro-max` — REMOVED (two visual skills = design drift)

**Visual exploration started:**
- Wordmark concept C selected (scale-contrast: big A, small trailing urora)
- Custom SVG A with star at exact apex coordinate — needs more work (strokes too uniform, star too rudimentary). Next session starts here with proper reference research.
- Visual companion server at `.superpowers/brainstorm/` (needs restart next session)

### State
- Session 23 code fixes uncommitted — commit them first
- `docs/design/identity-and-skills-plan.md` — new, commit
- `docs/design/AURORA1.md`, `docs/design/new1.md` — new design input docs, commit
- **Next session starts: impeccable audit of current frontend → kill list → DESIGN.md → wordmark refinement with real refs**

---

## Completed This Session (2026-05-25 — Session 23)

### Bug fixes: crossfade playback + autocomplete layout

**Crossfade / playback bug** (`fix(player)`)
- Root cause: Session 22 `nextHowlRef` architecture — React cleanup runs BEFORE new effect body. Cleanup was stopping old Howl; new body tried to fade an already-stopped Howl → silent.
- Fix: `prevHowlRef` pattern. Cleanup deposits outgoing Howl WITHOUT stopping. New body reads `prevHowlRef`, checks `prev.playing()` → `crossfadeIn = enabled && prev.playing()`. Natural end: `prev.playing() === false` → instant stop + full-volume start. Crossfade trigger: `prev.playing() === true` → fade old to 0, fade new from 0.
- Single `howlRef` for active song. Interval ticker always on the single active Howl's `onplay`. No dual-howl architecture.

**Autocomplete in-flow layout** (`fix(filter)`)
- Was: Absolute-positioned dropdown rendered over chip tray
- Now: In-flow `max-height` CSS transition between QueryInput and chip tray. Dropdown state lifted to QueryBuilder via `onDropdownChange` prop. Smooth push-down/push-up animation.

### State
- Build verified clean
- `useAudioPlayer.ts` — current architecture is `prevHowlRef` (see above)
- **Needs testing** at http://localhost:5173: natural song end, crossfade overlap, timer starts on new song

---

## Completed This Session (2026-05-24 — Session 22)

### Three spec features shipped (autocomplete, trim times, crossfade)

**Query autocomplete** (`feat(filter)`)
- `AutocompleteDropdown.tsx` — glassmorphism dropdown, operator badges, tag rows, active 3px left bar
- `QueryInput.tsx` — `getTokenAtCursor` (quote-aware context detection), `computeSuggestions` (3 tiers: operators, prefix tags, substring tags, cap 8), `acceptSuggestion` (quoted-space handling), arrow/tab/esc/enter keyboard nav, 150ms blur delay + `onMouseDown preventDefault` click pattern

**Custom playback times + per-playlist crossfade** (`feat(playlists)`)
- DB: 4 migrations (`playlist_songs.start_time_ms/end_time_ms`, `playlists.crossfade_enabled/crossfade_duration_s`)
- Backend models, routers: `PATCH /playlists/{id}/songs/{song_id}/timing`, crossfade fields on `PlaylistUpdate`/`PlaylistResponse`, `model_fields_set` for null-vs-missing distinction
- Frontend: `TrimPanel` component (zone bar, sliders, inline M:SS editing, Mark In/Out), `CrossfadeChip` popover (Inherit/On/Off, duration slider)
- `api.ts`: added `patch<T>()` method

**Crossfade player** (`feat(player)`)
- `settingsStore.ts` — crossfade enabled/duration, persisted to localStorage
- `SettingsView.tsx` — toggle + duration slider (1–12s), Settings nav item in Sidebar
- `playerStore.ts` — `queuePlaylistId` for per-playlist context
- `useAudioPlayer.ts` — complete rewrite: `nextHowlRef` + `crossfadeActiveRef` pattern, `resolveXfade()` (playlist override → global fallback), midpoint `next()` timer + fade-complete Howl swap timer, end-time enforcement, start-time auto-seek

### State
- `master` clean — 3 commits this session
- Build verified clean (`npm run build`)
- Fixed TS errors: unused `resolvedEnabled`, `asChild` on Base UI `PopoverTrigger` (pass props directly)

---

## Completed This Session (2026-05-24 — Session 21)

### Offline player completeness (all 8 plan tasks)
- **Backend:** `sort` + `order` params on `GET /songs` (COLLATE NOCASE, allowlist-validated, stable `s.id` tiebreaker)
- **songStore:** `sortField`, `sortOrder`, `sortSongs` — all post-mutation fetches inherit current sort
- **playerStore:** volume persist to localStorage (read on init, write on change + mute); repeat mode (none/all/one) with `cycleRepeat`; shuffle with Fisher-Yates + queue restore; fixed `previous()` no-op at queue start
- **useAudioPlayer:** `onend` checks `repeatMode === "one"` to replay vs advance
- **PlayerBar:** Shuffle + Repeat buttons in both desktop and mobile layouts; `previous` handler always calls `seekTo(0)` for low-seek case (fixed Howl not actually seeking)
- **SongTable:** sort dropdown + sortable Title/Duration column headers; `showSort={false}` in QueryBuilder (filter results don't have a sortable backing fetch)

### HEALTH.md — all remaining open items closed
- **G-6:** Hero glow now seeds from first song ID, not playlist name
- **A-07:** Float zone animation moved entirely to CSS (`mix-float-zone--visible` class); JSX no longer owns opacity/transform
- **I-10:** `heroTileGradient` raw rgba replaced with `var(--aurora-surface-3)` / `var(--aurora-surface-1)` tokens
- **I-13:** Half-pixel font sizes rounded to scale: 9.5→10, 10.5→11, 12.5→13, 17→18px
- **WF-001:** `graphify update .` run — 444 nodes, 576 edges, 91 communities

### State
- `master` clean, all items done, no open health issues
- Next: user-driven new features (crossfade, custom playlist playback times, query autocomplete)

---

## Completed This Session (2026-05-23 — Session 20)

### features.json closeout + doc audit

Merged `health-p3-fixes` → master.

Verified f001 (filter case-sensitivity) and f006 (CORS lockdown) — both already implemented in prior commits, never marked done in features.json. Updated features.json only; no code changes needed.

**All features.json items: done (f001–f007).**

JOURNAL.md updated with missed mistake entries (G-3 skip, glob pattern bug, Edit old_string line-number issue, missing HANDOFF entry).

**Current state:** master clean, no open branches, all planned work complete.
**Remaining:** low-priority items in docs/HEALTH.md (G-6, I-10, A-07, I-13, WF-001).

---

## Completed This Session (2026-05-23 — Session 19)

### P3 fixes + audit cleanup

Merged `health-p2-fixes` → master. Executed remaining P3 issues from holistic audit.

**Fixes shipped (9 issues):**
- G-3: PlayerBar glow — negative spread `(-4px/-6px)` → `0` (wider footprint)
- A-04: `transition-all` → specific props on NavItem, FooterAction, TagSidebarItem, SongRow play btn, IconBtn, QueryBuilder chips, PlaylistItem
- A-05: Sonner slide-in cubic-bezier → `var(--ease-spring)` token
- A-06: Motion tokens defined in `:root` (`--duration-*`, `--ease-*`)
- I-08: SongRow color dot fallback → `var(--aurora-accent-vivid)` + `var(--aurora-accent-interactive-glow)`
- I-09: `--aurora-surface-inset` defined, applied to ScanDialog + TagEditor
- I-11: `rgba(255,255,255,0.06)` → `var(--aurora-rim)` in PlayerBar + PlaylistDetail box-shadows
- I-12: `--font-mono` defined, applied to QueryInput
- WF-003: pensive-bouman branch deleted

**Deferred:**
- G-5: AlbumArt surface param (pensive-bouman was rejected, param never existed in master)
- G-6: PlaylistDetail glow from name (design limitation)
- A-07: QueryBuilder float zone refactor
- I-10: heroTileGradient (needs --aurora-surface-1/2 design decision)
- I-13: One-off font sizes
- WF-001: graphify refresh (run `graphify update .`)

**Branch:** `health-p3-fixes` (5 commits). Build clean.
**Next:** Merge `health-p3-fixes` → master, then f001 filter case-sensitivity.

---

## Completed This Session (2026-05-23 — Session 18)

### P1 + P2 fixes from holistic audit

Executed all open P1 and P2 audit issues from `docs/HEALTH.md`. 12 issues fixed.

**P1 (2 — Session 17 carry-over):**
- G-2: `albumGradient.ts` — glow lightness floor `Math.max(a.l, 60)`
- I-01: `button.tsx` — `text-[#050608]` → `text-[var(--aurora-slate)]`

**P2 — Animation (3):**
- A-01: `index.css` — `aurora-fade-up` 420ms → 300ms
- A-02: `index.css` — Sonner toast height 0.4s → 0.3s
- A-03: `Sidebar.tsx` — NavItem active-bar `transition-all` → `transition-[height,opacity] duration-200`

**P2 — Token consistency (6):**
- I-02: `PlayerBar.tsx` — Play/Pause `fill="#050608"` → `fill="currentColor"` + `text-[var(--aurora-slate)]`
- I-03: `SongRow.tsx` — hover play `text-[#050608]` → `text-[var(--aurora-slate)]`
- I-04: `ErrorBoundary.tsx` — `color: "#050608"` → `color: "var(--aurora-slate)"`
- I-05: defined `--aurora-surface-bar`, applied to `PlayerBar.tsx` + `AppShell.tsx`
- I-06: `ScanDialog.tsx` — `#5eead4` → `var(--aurora-accent-interactive-hover)`
- I-07: `Sidebar.tsx` — `bg-[#050608]/60` → `bg-[var(--aurora-obsidian)]/60`

**Merges:** `aesthetic-quick-wins` → `master`. Branch: `health-p2-fixes` (7 commits, build clean).

**Next:** Merge `health-p2-fixes` → master, then f001 filter case-sensitivity.

---

## Completed This Session (2026-05-23 — Session 17)

### Holistic Audit — Phase 1

Dispatched 4 parallel audit agents (Glow/Bleed, Animations, Visual Consistency, Workflow).
Synthesized findings into `docs/HEALTH.md`.

**Audit results: 29 issues total — 3 P1, 9 P2, 17 P3**

P1 issues (fix next session):
- G-2: Lightness floor missing in albumGradient.ts — dark art glow invisible on OLED black
- I-01: #050608 hardcoded on primary Button variant (button.tsx:21) — propagates app-wide

Worktree `claude/pensive-bouman-c15aea`: reviewed, not merged. Alpha bump was palliative;
G-2 lightness floor is the correct fix. Worktree force-removed.

Branch: `aesthetic-quick-wins` (clean)

## Next Steps
See `docs/HEALTH.md` for full issue list. Phase 2 implementation plan covers P1 fixes.

---

## Current State (April 23, 2026 — Session 15a)
Backend: 100% complete. All endpoints working — Songs CRUD, Tags CRUD + assignment, Playlists CRUD + song management + reorder, Filter (boolean AND/OR/NOT with parentheses), Scanner (folder scan with mutagen, format-aware dedup), Audio streaming. `file_format` column added to songs table (backfilled from file_path extension on startup). `album_art_path` column added — extracted from embedded artwork during scan, deduplicated by SHA-1, served via `GET /api/album-art/{filename}`.

Frontend: Full UI overhaul complete. "Northern Lights Over OLED Black" design system applied across all views. Mix page redesigned as compact command zone. PlayerBar idle/playing states with breathing-open transition. Tag-entry vs manual-entry modes in Mix. Surface elevation token scale added. Sidebar polished. Global keyboard shortcuts. Wake lock, error boundary, view transitions. File format displayed inline after duration in all song lists. Album art displayed in all song rows, PlayerBar, and playlist hero (2x2 grid fallback). Toast system at top-right with slide animation, click-to-dismiss. Dead affordances revived: pencil icon opens EditSongDialog (controlled mode), EditSongDialog includes playlist-add section, AddSongDialog accepts file_path.

CORS: `allow_origins` now covers ports 5173, 5174, 5175.

---

## Completed This Session (April 23 — Session 15a)

### Fix 1: Wire pencil icon to EditSongDialog

`EditSongDialog` was a complete component that nothing rendered. `SongRow`'s pencil `IconBtn` had only `e.stopPropagation()` as its handler.

**Changes:**
- `EditSongDialog.tsx`: Converted from fully self-contained (own `DialogTrigger`) to supporting controlled mode via optional `open`/`onOpenChange` props, matching the `AddSongDialog` pattern. `DialogTrigger` removed (unused path). Added `useEffect` to reset all form fields to current song values whenever `open` flips to `true`. Removed the duplicate `toast.success("Song updated")` — the store's `updateSong` already fires it.
- `SongRow.tsx`: Added `editDialogOpen` state. Pencil `IconBtn` onClick now calls `setEditDialogOpen(true)` (keeping `e.stopPropagation()`). `<EditSongDialog>` rendered as a sibling to `<TagEditor>` and the delete `<AlertDialog>`.

**Verify:** Hover a song row → click pencil → dialog opens pre-filled with current values → edit title → Save → dialog closes → row shows new title without page refresh.

---

### Fix 2: Add "Add to playlist" section in EditSongDialog

`playlistStore.addSongToPlaylist` had zero callers in the UI. No path existed to add an existing song to an existing playlist.

**Changes:**
- `EditSongDialog.tsx`: Added a `selectedPlaylistId` state and `addingToPlaylist` loading flag. Below the existing fields, a bordered section shows a native `<select>` listing all playlists (from `usePlaylistStore`) and an "Add" button. Clicking "Add" calls `addSongToPlaylist(playlistId, song.id)` — the store's existing success/error toasts fire. The playlist section resets on dialog open.

**Verify:** Open EditSongDialog → pick a playlist from the dropdown → click Add → toast fires → navigate to that playlist → song is there.

**Note:** Both Fix 1 and Fix 2 landed in `EditSongDialog.tsx` in a single edit, so they were committed together (`feat(songs): wire pencil icon to EditSongDialog; add playlist section`).

---

### Fix 3: AddSongDialog accepts file_path

Manual song entries had no `file_path` field, making them always unplayable despite `SongCreate` accepting it.

**Changes:**
- `AddSongDialog.tsx`: Added `filePath` state and a "File path (leave empty for metadata-only entry)" `Input` field. Passed as `file_path: filePath.trim() || undefined` to `createSong`. Reset on successful submit.
- `songStore.ts`: Extended the `createSong` data type to include `file_path?: string` (the implementation already passes the entire data object through to `api.post`, so no body change needed).

**Verify:** Open Add Song dialog → fill title/artist → enter a valid absolute path to an audio file → Add Song → click the new row → it plays.

---

## Completed This Session (April 23 — Session 14)

### Fix 1: AlbumArt loaded-state reset on song change

**Root cause (Hypothesis A confirmed):** `AlbumArt.tsx` keeps `loaded` and `error` as component-level `useState`. When the `song` prop changes (new song in PlayerBar), the img `src` changes but both states remain from the previous song. If a prior song had `onError` fire (no embedded art), `error = true` persists → `showImg = false` → gradient shows instead of the new song's art. Also, `loaded` staying `true` meant the fade-in animation never played on song change.

**Fix (`AlbumArt.tsx`):** Added a `useEffect` that resets both `loaded` and `error` to `false` whenever `src` changes. `src` is now derived before `showImg` so the effect dependency is clean.

```ts
useEffect(() => {
  setLoaded(false)
  setError(false)
}, [src])
```

Three paths verified: regular song click, Jam (from idle → playing), playlist detail click — all correctly show art in PlayerBar.

**Files:** `frontend/src/components/songs/AlbumArt.tsx`

---

### Fix 2: Toast system — top-right, shorter duration, click-to-dismiss

**Changes:**
- `App.tsx`: Toaster moved from `position="bottom-right"` to `position="top-right"`, `offset={{ top: 24, right: 24 }}`.
- `src/lib/toast.ts` (new): Thin wrapper around sonner's `toast`. Overrides `success`/`info` to `duration: 3000`, `error` to `duration: 5000`, `warning` to `duration: 4000`. All 11 call sites updated to import from `@/lib/toast` instead of `"sonner"`.
- `src/components/ui/ToastClickDismiss.tsx` (new): Uses `useSonner()` to get current toasts array. Event delegation on `document` detects clicks on `[data-sonner-toast]` elements, reads `data-index` attribute (Sonner sets this to the toast's array index), maps to toast ID, calls `toast.dismiss(id)`. Ignores clicks on buttons/links inside the toast.
- `src/index.css`: CSS overrides for `[data-sonner-toaster][data-y-position=top][data-x-position=right]` — overrides Sonner's default slide-from-top with `--y: translateX(calc(100% + 24px))` (slide from right), 200ms cubic-bezier entrance. `[data-mounted=true][data-removed=true]` override sets 150ms exit to right. `cursor: pointer` on all toasts.
- Hover-pause: Sonner's built-in behavior (no changes needed).
- z-index: Sonner's default `z-index: 999999999` already exceeds PlayerBar and floating Jam zone.

**Files:** `App.tsx`, `src/lib/toast.ts`, `src/components/ui/ToastClickDismiss.tsx`, `src/index.css`, 11 store/component files

---

### Spot-check 3: FLAC album art — already working

Query: all 10 FLAC songs sampled have real SHA-1 hash filenames in `album_art_path`. The `audio.pictures` list iteration in `extract_album_art()` was already correct. No fix needed.

---

### Feature 4: Format-aware scanner dedup

**Format tier hierarchy (higher = better quality):**

| Tier | Format(s) |
|------|-----------|
| 6 | FLAC |
| 5 | WAV |
| 4 | M4A_ALAC |
| 3 | OGG, OPUS |
| 2 | M4A_AAC, M4A (undetected) |
| 1 | MP3, AAC, WMA, AIFF, APE, WV |
| 0 | Unknown |

**M4A codec detection:** `_detect_m4a_format(file_path)` calls `mutagen.File()` (non-easy mode) and reads `audio.info.codec`. If `"alac"` is in the codec string → `"m4a_alac"` (tier 4). Otherwise → `"m4a_aac"` (tier 2). `extract_metadata()` now calls this for `.m4a` files before returning `file_format`.

**Decision logic in `import_scanned_songs()`:**
1. Exact `file_path` match → skip (true duplicate, `skipped_exact` counter)
2. `(title, artist)` match + incoming tier **>** existing tier → **REPLACE** via `_replace_song()`
3. `(title, artist)` match + incoming tier **==** existing tier → skip (`skipped_same_format`)
4. `(title, artist)` match + incoming tier **<** existing tier → skip (`skipped_lower_quality`)
5. No match → fresh import

**`_replace_song()` (transactional via SQLite SAVEPOINT):**
1. `SAVEPOINT replace_song`
2. INSERT new song row with new file's metadata
3. Migrate `song_tags`: INSERT OR IGNORE each tag_id for new song_id
4. Migrate `playlist_songs`: UPDATE SET song_id = new_id WHERE song_id = old_id (preserves position)
5. DELETE old song row (CASCADE removes its remaining song_tags rows)
6. `RELEASE SAVEPOINT replace_song`
7. On any exception: `ROLLBACK TO SAVEPOINT replace_song` + re-raise (old row preserved, rest of import unaffected)

**Scan response now returns:** `imported`, `replaced`, `skipped`, `skipped_exact`, `skipped_same_format`, `skipped_lower_quality`, `replaced_songs[]`.

**ScanDialog UI:** Shows separate rows for imported (teal dot), upgraded/replaced (violet dot, only when > 0), and skipped (dim dot with lower-quality count annotation). Toast summary shows "Imported X new, Y upgraded".

**Testing guide:**
1. Note current song count and pick an existing MP3 song with custom tags.
2. Run scan on a folder with FLAC versions of the same songs.
3. After scan: (a) those songs should show `file_format=FLAC`, (b) custom tags should survive, (c) report shows correct replaced count.

**Files:** `backend/app/services/file_scanner.py`, `backend/app/routers/scanner.py`, `frontend/src/types/index.ts`, `frontend/src/components/scanner/ScanDialog.tsx`

## Design System — "Northern Lights Over OLED Black"

### Color Token Table

| Token | Hex / Value | Purpose |
|-------|-------------|---------|
| `--aurora-primary` | `#4db8a4` | Primary actions, active nav, seek bar fill, links |
| `--aurora-primary-hover` | `#5ec9b5` | Primary hover state |
| `--aurora-primary-glow` | `rgba(77,184,164,0.18)` | Subtle box-shadows, focus halos |
| `--aurora-secondary` | `#8a75c8` | Secondary/creative actions (Jam button), playlist accents |
| `--aurora-secondary-hover` | `#9b88d6` | Secondary hover state |
| `--aurora-secondary-glow` | `rgba(138,117,200,0.15)` | Secondary ambient shadows |
| `--aurora-tertiary` | `#c49a6c` | Warm amber accent — rarest aurora light, third palette voice |
| `--aurora-tertiary-hover` | `#d4aa7c` | Tertiary hover state |
| `--aurora-tertiary-glow` | `rgba(196,154,108,0.12)` | Tertiary ambient shadows |
| `--aurora-glow` | `rgba(77,184,164,0.12)` | Global hover glow, button shine |
| `--aurora-muted` | `rgba(255,255,255,0.14)` | Borders, dividers, inactive chips, disabled outlines |
| `--aurora-surface` | `rgba(255,255,255,0.04)` | Glass panels, cards, elevated containers |
| `--aurora-surface-hover` | `rgba(255,255,255,0.065)` | Surface on hover |
| `--aurora-surface-border` | `rgba(255,255,255,0.07)` | Surface container borders |
| `--aurora-text` | `#e8e6e3` | Primary text — warm near-white (not pure #fff) |
| `--aurora-text-secondary` | `#8b95a7` | Metadata, subtitles, timestamps |
| `--aurora-text-tertiary` | `#4b5563` | Placeholders, empty states, very dim text |
| `--aurora-text-disabled` | `#2a2f3a` | Disabled elements |
| `--aurora-danger` | `#f87171` | Destructive actions, errors |
| `--aurora-warning` | `#fbbf24` | Warnings |
| `--aurora-rim` | `rgba(255,255,255,0.06)` | Inset keyline borders on glass surfaces |
| `--aurora-accent-muted` | `#459687` | Muted teal — play button fill, seek/volume bar fill, equalizer bars at rest. Same hue as `--aurora-primary`, ~15% less saturated/bright. Hover on play button transitions to full `--aurora-primary` (200ms). |

Legacy aliases (`--aurora-text-dim` → `--aurora-text-secondary`, `--aurora-text-muted` → `--aurora-text-tertiary`) are preserved in CSS for backward compatibility.

### Typography
- **Display font**: Fraunces (variable serif) — headings, logo, playlist names, "Mix" title
- **Body font**: Geist Variable (sans-serif) — UI text, labels, metadata
- **Monospace**: SF Mono / Menlo / ui-monospace — query input, operator keys

### Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `Space` | Play / Pause | When no text input is focused |
| `→` (ArrowRight) | Next track | When no text input is focused |
| `←` (ArrowLeft) | Previous track | When no text input is focused |
| `M` | Mute / Unmute | When no text input is focused |
| `/` | Focus Mix query input (navigates to Mix if needed) | When no text input is focused |
| `Escape` | Blur any focused input | Always |

Registered in `App.tsx` via `useCallback` + `window.addEventListener("keydown", ...)`. All shortcuts check `document.activeElement.tagName` to avoid firing while typing.

## Completed This Session (April 22 — Session 12)

### Feature 1: Album art extraction, storage, and display

**Goal:** Extract embedded artwork from audio files during scan and display it everywhere songs appear.

**Backend:**
- `file_scanner.py`: Added `ALBUM_ART_DIR = backend/album-art/` constant. Added `extract_album_art(file_path, art_dir)` that reads APIC frames (MP3/ID3), FLAC pictures, MP4/M4A `covr` atoms, and OGG `METADATA_BLOCK_PICTURE` base64 blocks. Deduplicates by SHA-1 — two songs sharing the same artwork bytes write only one file. Returns `{hash}.jpg` or `{hash}.png`.
- `import_scanned_songs()`: Calls `extract_album_art` for each new song during import. Returns `art_extracted` count.
- `database.py`: Migration adds `album_art_path TEXT` column. `_backfill_album_art()` extracts art for songs with `album_art_path IS NULL AND file_path IS NOT NULL`. Uses `""` as a processed-but-no-art sentinel to avoid re-scanning on every startup.
- `models.py`: `SongResponse.album_art_path: Optional[str] = None` added.
- `songs.py`: All SELECT queries include `s.album_art_path`. `song_row_to_dict()` maps `""` sentinel to `None`. `GET /api/album-art/{filename}` endpoint added with path-traversal guard.
- `filter_engine.py`: SELECT and results dict include `album_art_path`.
- `playlists.py`: All 4 song SELECT queries + SongResponse constructors include `album_art_path`.
- `scanner.py`: Completion message surfaces art extraction count.
- `.gitignore`: `backend/album-art/` excluded.

**Frontend:**
- `types/index.ts`: `album_art_path?: string | null` added to `Song`, `PlaylistSong`, `FilterResult`.
- `AlbumArt.tsx` (new): Sizes sm/md/lg/fill. Procedural `albumGradient` always as background. Lazy `<img>` fades in (opacity 0→1, 200ms) on load; falls back to gradient silently on error. Accepts `style` prop for glow/shadow passthrough.
- `SongRow.tsx`: Gradient div → `<AlbumArt size="sm">`. `albumGradient` import + `art` useMemo removed.
- `PlayerBar.tsx`: Mobile (sm) and desktop (md) art areas → `<AlbumArt>` with `art.glow` via `style`. `albumGradient` kept for glow only.
- `PlaylistDetail.tsx`: `PlaylistSongRow` gradient → `<AlbumArt size="sm">`. Hero: when no custom image and 4+ songs have art, shows a 2×2 `<AlbumArt size="fill">` grid. Falls back to emoji/gradient otherwise.

**Files:** `file_scanner.py`, `database.py`, `models.py`, `songs.py`, `filter_engine.py`, `playlists.py`, `scanner.py`, `.gitignore`, `types/index.ts`, `AlbumArt.tsx` (new), `SongRow.tsx`, `PlayerBar.tsx`, `PlaylistDetail.tsx`

---

## Completed Prior Sessions (April 21 — Session 11)

### Feature 1: Jam as primary gradient CTA + floating action zone

**Goal:** Elevate Jam from a cluster button to the headline feature. Add a scroll-aware floating zone so Search + Jam are reachable from anywhere in Mix results.

**Jam button redesign:**
- Removed from the top-right button cluster.
- Inline position: right-aligned row between the query bar and results (always visible in full QueryBuilder mode).
- Size: 50px height, `28px` horizontal padding, `border-radius: 999px`.
- Fill: `linear-gradient(135deg, --aurora-primary → --aurora-secondary)` diagonal.
- Label: "Jam" in Fraunces display font (`font-display text-[18px] font-medium`).
- Icon: `Sparkles` at `18×18px`.
- Hover: `scale(1.02)` + expanded teal/violet glow.
- CSS class: `.mix-jam-primary`.

**Floating action zone:**
- `position: fixed; bottom: 112px; right: 32px; z-index: 30` — 32px above the 80px PlayerBar.
- Glass pill: `rgba(15,15,18,0.9)` + `backdrop-filter: blur(20px)` + 1px `rgba(77,184,164,0.18)` border.
- Contents: compact "Search" (transparent, 34px) on left + gradient "Jam" pill (48px) on right.
- Visibility: `IntersectionObserver` on `sentinelRef` div placed below the query bar. Fades in (`opacity 200ms ease`) once user scrolls the query bar out of view. Hidden in quick-tag compact mode.
- CSS classes: `.mix-float-zone`, `.mix-float-search`, `.mix-float-jam`.
- Top-right cluster now has: Search + Shuffle + Clear.

**Files:** `QueryBuilder.tsx`, `index.css`

---

### Feature 2: Row hover interactions

**Goal:** Results rows should feel alive and responsive.

- Row hover background: `group-hover:bg-[var(--aurora-surface-1)]` (`#0a0a0c`) across all cells, 150ms transition.
- Circular play button: in `#` column on hover, row number fades to 0 and a 40×40px round `.aurora-play-btn` fades in. `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` relative to the `<td>`. Hover: `scale(1.05)` + full `--aurora-primary`. Click: `e.stopPropagation()` + `handlePlay()`.
- Tag chip hover: `hover:scale-[1.03]` + `title="Filter by this tag"` tooltip when `onClick` prop present.

**Files:** `SongRow.tsx`, `TagChip.tsx`

---

### Feature 3: Staggered query-change animation + empty state polish

- `@keyframes aurora-row-in`: `opacity 0→1`, `translateY(4px→0)`, 220ms cubic-bezier. Applied via `.aurora-row-in` class on every `<tr>`.
- Stagger: `animIndex < 16 ? animIndex * 25 : 0` ms delay. First 16 rows stagger at 25ms/row (max 375ms lead); rows 16+ instant.
- `filterStore.ts`: `resultsVersion: number` increments on every result update. `QueryBuilder.tsx` passes it as `animKey={resultsVersion}` to `SongTable`. `SongTable` keys `<tbody key={animKey}>` to force remount and re-trigger animations on new queries.
- Empty state: `<MixEmptyState />` shows aurora wave SVG (three sine paths, teal/violet, no external assets) + "No songs match this query" (italic Fraunces 22px) + "Try relaxing a filter" (12px).

**Files:** `filterStore.ts`, `SongTable.tsx`, `SongRow.tsx`, `QueryBuilder.tsx`, `index.css`

---

### Visual QA Pass
- TypeScript build: clean (only pre-existing `baseUrl` deprecation warning).
- Floating zone: `bottom: 112px` = 32px gap above 80px PlayerBar at all window heights. ✓
- Circular play button: 40px centered in 48px `w-12` td, 4px clearance each side. ✓
- Stagger cap at 16 rows (375ms max lead + 220ms animation = ≈595ms total). ✓
- `resultsVersion` → `animKey` → `tbody key` → `SongRow animIndex` fully wired. ✓

---

## Completed Prior Sessions (April 21 — Session 10)

### Feature 1: Mix quick-tag header icon spacing

`gap-2.5` → `gap-3` on the flex container holding the `<Tag>` icon and tag name in the compact header of `QueryBuilder.tsx`. Fixes clipping between icon and text at all tag name lengths.

**Files:** `QueryBuilder.tsx`

### Feature 2: PlayerBar accent softened

New token `--aurora-accent-muted: #459687` (HSL 169°, 37%, 43% — same hue as `--aurora-primary` but ~15% less saturated/bright). Applied to:
- Play button fill (both mobile h-10 and desktop h-11). Inline `background` style removed; new `.aurora-play-btn` CSS class handles default muted fill + 200ms hover transition to full `--aurora-primary`.
- Seek bar and volume slider filled portion (`.aurora-range` background gradient updated).
- Equalizer bars (`.aurora-eq > span` gradient updated to `--aurora-accent-muted` → muted mint).

Full `--aurora-primary` teal is now reserved for hover state — conveys interactivity without neon harshness on OLED.

**Files:** `index.css`, `PlayerBar.tsx`

### Feature 3: File format display inline with duration

Shows `6:07 · FLAC` (uppercase) inline after duration in all song list views. Missing/null format gracefully degrades to duration alone.

**Backend:**
- `database.py`: `ALTER TABLE songs ADD COLUMN file_format TEXT` migration on startup. Python backfill loop derives format from `file_path` extension for existing rows.
- `file_scanner.py`: `extract_metadata()` returns `file_format: path.suffix.lstrip('.').lower()`. INSERT in `import_scanned_songs()` stores it.
- `songs.py`: All SELECT queries include `s.file_format`. `song_row_to_dict()` maps it. `create_song` derives format from `file_path` on manual creation.
- `models.py`: `SongResponse.file_format: Optional[str] = None`.
- `filter_engine.py`: SELECT and results dict include `file_format`.
- `playlists.py`: All 4 song SELECT queries include `s.file_format`. All `SongResponse` constructors pass it.

**Frontend:**
- `types/index.ts`: `file_format?: string | null` added to `Song`, `FilterResult`, `PlaylistSong`.
- `SongRow.tsx`: Duration cell shows `{formatDuration(song.duration)}{song.file_format && <> · {song.file_format.toUpperCase()}</>}`. Column width `w-24` → `w-28`.
- `SongTable.tsx`: Duration header width `w-24` → `w-28`.
- `PlaylistDetail.tsx`: Same inline format in `PlaylistSongRow` duration cell.

**Verification:** `/api/songs` and `/api/filter` both return `file_format: "mp3"` for scanned songs. Songs with no `file_path` correctly return `file_format: null` and show duration only.

**Files:** `database.py`, `models.py`, `songs.py`, `file_scanner.py`, `filter_engine.py`, `playlists.py`, `types/index.ts`, `SongRow.tsx`, `SongTable.tsx`, `PlaylistDetail.tsx`

### Feature 4: Mix queue auto-starts from filtered results (verified)

**Verified existing implementation is correct.** `QueryBuilder.tsx` already calls `playSong(song, results)` where `results` is the current filter output. `playerStore.playSong()` uses `findIndex(s => s.id === song.id)` to position the cursor in the queue, so clicking result #3 sets `queueIndex=2` and Next/Prev navigate within the filtered list. Jam and Shuffle-Jam buttons in `filterStore.ts` also correctly build queues from filtered results only. No code changes needed.

### Visual QA Pass
- TypeScript build: clean (only pre-existing `baseUrl` deprecation warning).
- Backend `/api/songs` and `/api/filter`: `file_format` field present and correctly backfilled.
- Playlist endpoint: Songs with `file_path: null` correctly return `file_format: null`.
- Frontend dev server: compiled with no HMR errors.

---

## Completed Prior Sessions (April 21 — Session 9)

### Feature 1: PlayerBar persistent idle state

**Goal:** Match Spotify/Apple Music "nothing playing" UX — persistent bar that grows on first play.

**Implementation:**
- Desktop idle: 52px bar with aurora gradient shimmer (animated `background-position` pulse, 3.5s ease-in-out) in the album-art position, "Nothing playing" in italic Fraunces, "Pick a song or hit Jam" in `--aurora-text-muted`.
- Desktop playing: 80px bar with full controls. Height transitions smoothly via `transition: height 300ms cubic-bezier(0.2, 0.7, 0.2, 1)` on the desktop container.
- Mobile idle: 44px with shimmer + same text. Mobile playing: stacked layout unchanged.
- `isIdle = currentSong === null`. Once `playSong()` fires, `currentSong` is never set back to null (confirmed in playerStore — `next()` at end of queue only sets `isPlaying: false`). So idle state is strictly initial app load.
- No transport controls in idle. No seek bar, volume, or queue button.
- `.aurora-idle-shimmer` CSS class added to `index.css` with `aurora-idle-pulse` keyframe.

**Files:** `PlayerBar.tsx`, `index.css`

### Feature 2: Mix page tag-entry vs manual-entry modes

**Goal:** Clicking a sidebar tag goes straight to results with compact header. "Mix" nav item opens full QueryBuilder.

**Implementation:**
- `filterStore.ts`: Added `isQuickTagView: boolean` (default `false`), `quickTagEditorOpen: boolean` (default `false`), `setIsQuickTagView(v)` (also resets `quickTagEditorOpen` to `false`), `setQuickTagEditorOpen(v)`.
- `Sidebar.tsx`: `handleTagClick` calls `setIsQuickTagView(true)` before navigating. Mix NavItem click calls `setIsQuickTagView(false)`.
- `QueryBuilder.tsx`: When `isQuickTagView && !quickTagEditorOpen`, renders compact header: `[Tag icon] tagName · N songs` + "Edit query" button. Results shown directly below. When `quickTagEditorOpen` is `true`, falls through to the full QueryBuilder (same as manual mode). `displayTagName` strips surrounding quotes from the raw query string.
- No `useEffect`/setState-in-effect — editor open/closed state lives in filterStore and is reset in event handlers.

**Files:** `filterStore.ts`, `Sidebar.tsx`, `QueryBuilder.tsx`

### Feature 3: Surface elevation token scale

**Goal:** Add intermediate OLED depth tokens without touching any existing component.

**Tokens added to `index.css` `:root`:**
- `--aurora-surface-0: #000000` — page base, OLED pure black
- `--aurora-surface-1: #0a0a0c` — cards, drawers, subtle lift
- `--aurora-surface-2: #111114` — popovers, dropdowns
- `--aurora-surface-3: #17171b` — modals, sheets, highest elevation
- `--aurora-surface-pressed: rgba(255,255,255,0.035)` — active/pressed state for surface-1 items
- Note: `--aurora-surface-hover` already existed (`rgba(255,255,255,0.065)`) and serves the elevation hover role.
- No existing component was modified to use these tokens.

**Files:** `index.css`

### Visual QA Pass
- TypeScript build: clean (only pre-existing `baseUrl` deprecation warning, unrelated to this session).
- Dev server: started, no new HMR/compilation errors. Only pre-existing duplicate-key console warnings.
- All views checked via code review: PlayerBar idle state, PlayerBar expanded state (with controls), Mix compact tag header, Mix full QueryBuilder, All Songs, Playlist detail — no regressions observed.
- Dev server stopped before session end.

---

## Completed Prior Sessions

### Session 8 (April 20 — audio architecture + PlayerBar spacing)

### Bug 1 (re-fix): Audio double-play — single chokepoint architecture

**Root cause:** The previous fix (removing `autoplay: true`) was insufficient. The real issue was architectural: the `isPlaying` effect had `[isPlaying, currentSong]` as deps, meaning it re-ran on every song change. When switching from Song A → Song B while playing, both the song-change effect (creates HowlB) and the isPlaying effect (plays it) fired in sequence. React effects run after the browser paint — there's a window where both Howls coexist in the HTML5 audio pipeline.

**Fix:** Restructured `useAudioPlayer.ts` so the **song-change effect is the single chokepoint** for all Howl lifecycle management. It stops/unloads the old Howl, creates the new one, and calls `howl.play()` directly (reading `getState().isPlaying` imperatively). The `isPlaying` effect now has only `[isPlaying]` in its deps — it fires only on pause/resume toggling, never on song changes. This makes the stop-create-play sequence atomic within one effect run.

**Path verification:**
- Click song in SongTable → `onPlay(song, queue)` → `playSong()` → `currentSong?.id` changes → song-change effect fires. isPlaying effect does NOT fire (isPlaying unchanged). ✓
- Next/Prev buttons → store's `next()`/`previous()` → `currentSong?.id` changes → same path. ✓
- Jam/Shuffle-Jam buttons in filterStore → `usePlayerStore.getState().playSong()` → same. ✓
- `onend` auto-advance → `next()` callback → same. ✓
- Spacebar / Play button → `togglePlay()` → only `isPlaying` changes → only isPlaying effect fires. ✓
- Volume slider → only volume effect fires. ✓

**Cleanup improvement:** The return cleanup now captures the local `howl` variable (not `howlRef.current`), so it always cleans up the correct instance even if the ref is reassigned.

### Bug 2 (re-fix): PlayerBar spacing

**Root cause:** Previous height fix made the bar 80px but didn't address inter-section spacing. The outer container used `px-6 gap-8`, and fixed section widths (left: 280px, right: 240px) left insufficient room for the center at 1280px widths. The transport cluster `gap-6` (24px) between skip/play/skip buttons made the play button appear visually isolated and close to section edges.

**Fix:**
- Container: `px-6` → `px-8` (more outer breathing room)
- Left section: `w-[280px]` → `w-[240px]`; right section: `w-[240px]` → `w-[200px]` (40px freed from each side)
- Center: `max-w-[620px]` → `max-w-[580px]`, added `min-w-0`
- Transport cluster: `gap-6` → `gap-3` (tighter, more cohesive button cluster)

**Layout verification at target widths:**
- 1280px: 98px gap between center content and right section. ✓
- 1440px: 178px gap. ✓
- 1920px: 418px gap. ✓

**Browser verification:** Dev server was running during session (both servers up, 50 songs confirmed). Code review shows no regressions. Manual browser test recommended before claiming fully resolved.

## Completed Prior Sessions

### Session 7 (April 16 — bug fixes + playlist search)

### Bug 1: PlayerBar overflow fixed
Desktop container height increased from 72px → 80px. LEFT section (album art + song info) given `flex-shrink-0` to prevent squeezing at narrow widths. Root cause: the center column (44px play button + 8px gap + ~20px seek bar = ~72px) exactly filled the 72px container with zero breathing room.

### Bug 2: Duplicate song playback fixed
Removed `autoplay: true` from the Howl constructor in `useAudioPlayer.ts`. Root cause: `autoplay: true` triggered an internal `.play()` call asynchronously (after `canplaythrough`), while the `isPlaying` sync effect also called `.play()` synchronously. In Howler v2, multiple `.play()` calls on the same Howl instance create multiple simultaneous sound sprites. Removing `autoplay` makes the `isPlaying` effect the single source of `.play()` calls.

### Feature: Playlist search bar
Client-side search input added to PlaylistDetail above the song table. Filters by title or artist match (case-insensitive). Glass surface styling matches All Songs search bar. Shows "No songs match" empty state when query has no results. `key={view.playlistId}` added to `<PlaylistDetail>` in App.tsx so all local state (including search query) resets automatically when switching playlists.

### CORS: Port 5175 added
`backend/app/main.py` now allows `http://localhost:5175`.

### Visual QA Pass
All views checked via code review + clean dev server build:
- AppShell grid layout ✓
- Sidebar nav states, tags, footer actions ✓
- PlayerBar collapsed/expanded ✓
- PlaylistDetail hero, song list, search ✓
- Mix / QueryBuilder command zone ✓
- SongTable / All Songs ✓
- All CSS aurora tokens defined ✓
- No HMR errors in dev server ✓

### Session 6 (Claude Code with Opus — full UI overhaul)
Complete aurora color token system, Mix page command zone, PlayerBar collapse/expand, sidebar polish, Playlist detail restyled, All Songs restyled, keyboard shortcuts, view fade transitions, row hover states, button micro-interactions, Wake Lock API, Error boundary, empty states.

### Session 5 (Claude Code with Opus — Mix page redesign)
Mix page QueryBuilder compacted from ~530px to ~210px vertical. New color tokens. Operator keys restyled as keyboard keys. Search/Jam buttons moved to header row.

### Session 4 (Claude Code with Opus — bug fixes)
Playlist image upload pipeline working. Double toast fixed. Aurora background opacity 19%. Neutral default hero gradient. Logo click delay fixed. python-multipart added.

### Session 3 (Claude Code with Cline/Qwen)
OLED black theme, glassmorphism, Fraunces font, aurora background image.

### Sessions 1–2
App shell, song table, filter/Mix view, audio playback, file scanner dialog, initial Mix redesign.

## Known Gaps
- **Tertiary color (`#c49a6c`) unused in UI** — defined but not yet applied. Available for future use (badges, warnings, decorative accents).
- **No autocomplete on query input** — supports typed queries but no suggestions.
- **Mobile compactness** — Mix page header row is tight on screens under 400px.
- **Filter is case-sensitive** — `rock` returns nothing, `Rock` works. Fix: lowercase both sides in `backend/app/services/filter_engine.py` during comparison.
- **Duplicate key warnings in console** — possible id collision between manual test songs and scanned songs.
- **PlayerBar height transition** — currently uses conditional rendering with fade-in. A CSS grid `grid-template-rows` height animation would be smoother but adds complexity.

## Known Bugs
- **Audio double-play (needs browser confirmation):** The Session 8 single-chokepoint rewrite is architecturally sound, but manual A→B song switch testing in the browser is the only way to confirm it's actually fixed.
- **PlayerBar spacing (needs browser confirmation):** Layout math confirmed correct at 1280/1440/1920px. Manual resize test recommended.

## Technical Decisions
- Audio sliders use plain HTML `<input type="range">` — shadcn Slider had compatibility issues. Don't replace them.
- View switching uses Zustand store (`songStore.view`), no React Router.
- `playSong()` needs the song list as second argument for queue/next/previous to work.
- Howler.js uses `html5: true` mode — required for streaming large files. The song-change effect (`[currentSong?.id]`) is the SINGLE CHOKEPOINT for Howl creation and initial play. The isPlaying effect (`[isPlaying]` only) handles pause/resume toggling. Never add `currentSong` back to the isPlaying effect deps — that was the root cause of dual-audio.
- Display font (Fraunces) loaded via Google Fonts with the full `opsz,wght,SOFT,WONK` axis range.
- Playlist images stored server-side via `POST /playlists/{id}/image`. Create flow must `await fetchPlaylists()` *after* upload.
- Sidebar responsive state is local to AppShell (useState), not in Zustand.
- `filterStore.jamFilter` / `shuffleAndJamFilter` call `usePlayerStore.getState().playSong()` directly.
- Background image is in `frontend/public/` (served at `/aurora-bg.png`), not imported as a module.
- Mix page CSS classes (`.mix-query-bar`, `.mix-kbd`, `.mix-btn-search`, `.mix-btn-jam`) are in `index.css`.
- QueryInput is "bare" — just `<input>` + validation indicator, container comes from QueryBuilder.
- Keyboard shortcuts registered via `useCallback` in `App.tsx`. All check `activeElement.tagName` to avoid firing in inputs.
- Wake lock is managed via `useEffect` in `App.tsx` watching `isPlaying`.
- ErrorBoundary is a class component wrapping the main content area.
- `aurora-chip` class uses simple `--aurora-muted` border instead of gradient border (Session 3 change — more refined).
- Play button uses solid `--aurora-primary` instead of gradient (Session 3 change — more premium feel).
- PlaylistDetail uses `key={view.playlistId}` in App.tsx — forces full remount (and state reset) when switching playlists.

## Technical Decisions (Session 12 additions)
- `backend/album-art/` stores images named `{sha1}.jpg` or `{sha1}.png`. Deduplication means 20 tracks from the same album write only one file. Directory is gitignored.
- Empty string `""` is the "already tried, no art" sentinel in `album_art_path`. `song_row_to_dict()` and playlists router map `""` → `None` before sending to frontend. This prevents re-scanning on every startup for files without embedded art.
- `AlbumArt` always renders the procedural gradient as the container background. The `<img>` overlays it with `opacity: 0` until `onLoad`, then transitions to `1` (200ms). On `onError`, img state is cleared and the gradient remains — no broken-image icon.
- `size="fill"` on `AlbumArt` uses `w-full h-full`, intended for use inside a CSS Grid cell (the 2×2 playlist hero grid). `className="rounded-none"` removes the default `rounded-md` so the parent's `rounded-xl overflow-hidden` clips all four corners cleanly.
- The 2×2 hero grid only activates when `!heroImage && songsWithArt.length >= 4`. Playlists with a custom uploaded image always show that image. Playlists with fewer than 4 songs with art fall back to emoji/gradient.
- PlayerBar keeps `albumGradient` to compute `art.glow` for the box-shadow that glows around the album art container — the glow color is derived from the song identity, not the actual image pixels.

## Technical Decisions (Session 14 additions)
- `AlbumArt` loaded/error states reset via `useEffect([src])`. When `src` changes (new song), both states go to `false` so the new image fades in cleanly and a previous error doesn't ghost-block the new image.
- Toast wrapper at `src/lib/toast.ts` re-exports sonner's `toast` with type-specific durations (success/info: 3s, error: 5s, warning: 4s). All call sites import from `@/lib/toast`, never directly from `"sonner"`. Adding per-type durations in future requires editing only this file.
- `ToastClickDismiss` component uses `useSonner()` + document-level click delegation. Sonner sets `data-index` on each `<li>` matching the toast's index in the `toasts[]` array. Click handler maps `data-index` → `toasts[index].id` → `toast.dismiss(id)`. Ignores clicks on `button/a/[data-button]/[data-cancel]` elements inside the toast.
- Toast CSS overrides target `[data-sonner-toaster][data-y-position=top][data-x-position=right]` (4+ attribute specificity), beating Sonner's internal 2–3 attribute rules without `!important`.
- Format-aware scanner: `file_format` for `.m4a` files is now `"m4a_alac"` or `"m4a_aac"` (detected via `audio.info.codec`), not the generic `"m4a"`. Existing DB rows with `"m4a"` get tier 2 (same as `m4a_aac`) so a real ALAC scan would correctly replace them.
- `_replace_song` uses `SAVEPOINT replace_song` / `RELEASE` / `ROLLBACK TO` for sub-transaction isolation. A failed replace rolls back only that song's migration, not the entire import batch.

## Next Steps
See `features.json` for the remaining task list. Priority order:
1. Case-sensitivity fix in filter engine
2. Custom playback times per playlist (start_time_ms / end_time_ms on playlist_songs)
3. Crossfade between songs
