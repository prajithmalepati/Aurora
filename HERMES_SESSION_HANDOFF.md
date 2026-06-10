# HERMES_SESSION_HANDOFF.md

**Session 8 complete (2026-06-09, Fable 5). Next: Session 9 (Fable 5 — Aurora seek bar).**

## Git state
Branch: `hermes/phase0-s8` (4 commits ahead of `hermes/phase0-s7`)

```
c381637 refactor(frontend): extract PlaybackEngine interface, useAudioPlayer talks to HowlerEngine
e7b0088 fix(backend): correct legacy data-dir migration paths off by one level
d6e35e1 fix(audio): stale-howl drain no longer kills the crossfade prev handoff
bc1fe4a refactor(frontend): extract Howler private-API access to howlerCompat.ts   <- S7 (a)
```

Note: S7 ended without a handoff commit. S7 verified complete during S8 startup: (a) `howlerCompat.ts` committed, (b) single-transaction playlist delete at `playlists.py:318`, (c) watcher dir-mtime guard in `file_watcher.py` — all present on `hermes/phase0-s7`.

## What Session 8 delivered

### 1. The PlaybackEngine keystone (task 0.8)
- **`frontend/src/types/playback.ts`** (new) — the contract: `load(PlaybackSource) / play / pause / stop / unload / seek / position / duration / setVolume / getVolume / fade / isPlaying / isLoaded / resetToStart / on / off`. Event model: `play, pause, end, load(duration), loaderror, playerror, buffering(boolean)` — buffering included per spec for Phase-2 addon streams. One engine instance = one voice; crossfade/gapless = orchestrator holding multiple instances.
- **`frontend/src/lib/engines/howlerEngine.ts`** (new) — `HowlerEngine` implements the interface over one Howl (`html5: true` preserved). Exports `createPlaybackEngine()` (the single swap point) and `unlockAudioOutput()`. Buffering semantics: coarse (`true` at load start, `false` at first play or terminal error) — HTML5 audio has no mid-track stall signal; documented in file header.
- **`frontend/src/hooks/useAudioPlayer.ts`** — pure orchestration now: zero Howler imports, all engine calls through the interface. All logic preserved 1:1 — gapless preload+promotion, 3 crossfade curves, ReplayGain, trim enforcement, repeat/shuffle, error auto-advance, 250ms tick.
- Howler containment verified: `grep` shows Howler referenced only in `howlerCompat.ts`, `howlerEngine.ts`, and an AboutView credits string.

### 2. Crossfade regression fix (pre-existing, found during S8 read-through)
`188415f` (June 6) introduced a stale-Howl drain at the TOP of the song-change effect, but effect cleanup deposits the outgoing Howl into both `prevHowlRef` AND `staleHowlsRef`. The drain stopped+unloaded the outgoing Howl before `prev.playing()` was read → `crossfadeIn` always false → **crossfade dead and gapless overlap reduced to a hard cut since June 6**. Fix (`d6e35e1`): read `prev` first, drain skips it, prev stays tracked as `[prev]` for the next drain (rapid-transition leak protection intact). S7's "crossfade matrix passes" claim was not a real verification — audio matrices need human ears.

### 3. Data-dir migration fix (S2 defect, found during S8 smoke test)
`main.py` `_migrate_to_data_dir()` had `old_root = Path(__file__).parent.parent.parent` → resolves to repo root, not `backend/`. All three legacy paths (DB, album-art, playlist-images) missed; migration silently no-op'd; first boot created a FRESH EMPTY DB in `~/.local/share/Aurora/`. Fixed (`e7b0088`): two parents, not three. S2's "existing DB/images migrated" verification was never actually run (S6 handoff even noted "backend hasn't been started since paths.py was added").

## ⚠️ ACTION REQUIRED (human, this machine)
`~/.local/share/Aurora/aurora.db` is an **empty** DB created 2026-06-09 22:09 by the broken migration boot. It BLOCKS the (now fixed) migration via the `not DB_PATH.exists()` guard. The real 352-song DB is still safe at `backend/aurora.db`.

```bash
rm ~/.local/share/Aurora/aurora.db   # it has 0 songs — verified
# then start the backend once; it will migrate backend/aurora.db + album-art + playlist images
```

(Fable was permission-blocked from removing it — correctly so.)
Same check applies to the MAIN LAPTOP before/after pulling these commits: if it ever booted the broken code, the same empty-DB trap exists there.

## Verification run
- `npm run build` clean ✓ (after each commit)
- `pytest` 120/120 passed ✓
- Headless-browser smoke test (Playwright + real 352-song DB copy via `AURORA_DATA_DIR` scratch dir): play via dblclick → position advances; Next → new song plays (exercises prev-engine handoff); pause → frozen; resume → advances; Previous → restart. **5/5 PASS, zero console errors** ✓
- Migration path resolution verified against real files (old_db/old_art found) ✓
- NOT verified (needs ears, next time the human is at this machine): 3 crossfade curves + gapless audio quality. The crossfade fix makes this matrix meaningful again — before it, crossfade literally never triggered.

## Quirks found during S8
- Default headless viewport hides the desktop PlayerBar variant — there are two `aria-label="Next"` buttons (mobile + desktop); Playwright needs `visible=true` filters.
- App default view is Mix, not All Songs — smoke scripts must navigate first.
- Backend `/api/songs/` (trailing slash) → 307 redirect; use `/api/songs?...`.
- Hermes DB has 0 tags (user's tags presumably live on the main laptop DB) — Mix view filter testing needs tags created first.

## Known latent issue (not fixed, document for Gate 0)
During a crossfade, the outgoing engine's `end` handler is still bound; if the fade timer and natural song end race, `next()` could fire twice (double-skip). Pre-existing behavior, preserved by the zero-behavior-change mandate. Worth a guard when the engine work continues (Phase 2/4).

## For the next session
- Start on `hermes/phase0-s8`
- Read CLAUDE.md, HERMES_KICKOFF.md §S9, then this handoff
- S9 = Aurora seek bar redesign (`SeekScrubber.tsx`, `index.css`) — full spec in kickoff §S9. **Fable 5 only.**
- Then S10 (live design audit), then Gate 0 review (cumulative diff of s1→s8 + DESIGN_QA punch list), then PR → human merge.

## Sessions reserved for Fable 5 only
- S9 (seek bar design) — NEXT
- S10 (design audit)
- Gate 0 review

Never attempt these with any other model.
