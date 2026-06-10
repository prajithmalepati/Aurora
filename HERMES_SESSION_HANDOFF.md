# HERMES_SESSION_HANDOFF.md

**Sessions 8 + 9 complete (2026-06-09, Fable 5). Next: Session 10 (Fable 5 — live design audit).**

## Git state
Branch: `hermes/phase0-s9` (1 commit ahead of `hermes/phase0-s8`)

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

## For the next session
- Start on `hermes/phase0-s9`
- S10 = live design audit (kickoff §S10): Playwright screenshots of every view at 1440/768/390, review vs emil-design-eng checklist + VISUAL_AUDIT.md, produce `DESIGN_QA.md`, fix top tier. **Fable 5 only.**
- Then Gate 0 review (cumulative s1→s9 diff + checklist) → push branches → PR → human merge. Nothing is on main yet.

## Sessions reserved for Fable 5 only
- S10 (design audit) — NEXT
- Gate 0 review
