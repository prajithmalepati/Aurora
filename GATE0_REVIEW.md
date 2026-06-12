# GATE0_REVIEW.md — Phase 0 Gate Review

**Date:** 2026-06-10 · **Reviewer:** Fable 5 · **Scope:** cumulative `main...hermes/phase0-s10` (130 files, +5143/−1026) · **Verdict: ✅ APPROVED for Phase 1** (conditions below)

## Checklist results

| Gate item | Result | Evidence |
|---|---|---|
| Golden suite green | ✅ | 120/120 pytest (9 `test_golden_*.py`, 95 fixtures), 0.85s |
| No `localhost:8000` outside `getBaseUrl` | ✅ | grep: only `api.ts:8` (the default inside `getBaseUrl`) |
| DB/images in data dir | ✅ | verified on this machine 2026-06-09: 352 songs + 312 art files in `~/.local/share/Aurora/`, source tree clean |
| Migrations versioned | ✅ | `PRAGMA user_version` ladder in `database.py` (pre-versioning DBs handled, unknown-future fails loudly) |
| >500-song library reachable | ✅ | `useVirtualizer` + PAGE_SIZE load-more in songStore; S6 verified 1,000-song scratch at 60fps; live: scroller fits viewport at 390/1440, no body scroll |
| Watcher invalidation | ✅ | import path verified S1; **gap found this review** — deletions didn't invalidate; fixed `d076a3d`, pytest green |
| Seek bar perf gate | ✅ | S9 measured: avg layout 0.387ms/tick (gate <1ms), 13/13 checks |
| DESIGN_QA top tier fixed | ✅ | S10, before/after screenshots at 3 widths |
| Playback matrix | ⚠️ machine-only | S8 smoke 5/5 (play/next/pause/resume/previous); **human listening pass still owed**: crossfade curves × 3, gapless, ReplayGain, trim (broken Jun 6–9, fixed in S8 — nobody has listened since) |

## Adversarial review (3 reviewers over cumulative diff, findings re-verified by me)

**Confirmed + fixed in-session:**
- `file_watcher.py` — `_mark_missing()` deleted songs but never invalidated `song/tag/folder` caches → deleted songs ghosted in `/songs` until TTL. Fixed (`d076a3d`), mirrors the import-path invalidation block.

**Confirmed, deferred to punch list (not gate-blocking):**
1. `filter_engine.py` returns `tags` as `sorted(set)`; every other endpoint preserves insertion order via `parse_tags()`. Ordering-only inconsistency; frontend treats tags as a set. Standardize during the Rust-port serializer work (Phase 2) — golden fixtures pin current behavior, so changing it now would churn them twice.
2. `howlerEngine.load()` doesn't clear prior listeners; promoted preloaded engines keep dead preload handlers. Harmless today (one engine per song, load() called once) — fold into the Phase-2/4 engine-guard work alongside the documented end-handler/double-next race.
3. `playlists.py` delete-song transaction relies on implicit rollback via `conn.close()` on exception — works, fragile. Wrap in explicit try/rollback whenever the file is next touched.
4. `SongTable` `h-[calc(100vh-15rem)]` hardcodes chrome height — measured OK live at 390/1440 (794<844, 810<900) but breaks silently if player bar height changes. Candidate: flex-based height.
5. `SongTable` `getItemKey` falls back to array index when row undefined — transient duplicate-key risk during delete-while-scrolled. One-line: prefix fallback (`\`idx-${index}\``).

**Reviewer findings refuted (recorded so they don't resurface):**
- `fetchMore` concurrent-offset collision — guarded: synchronous `loading` flag + `fetchId` token; JS single thread.
- `main.py` boot UPDATE re-runs wastefully — pattern `'/playlist-images/%'` can't match migrated `'/api/...'` values; idempotent by construction.
- Scrubber thumb "snaps on keyboard seek" — intentional (`data-instant` = 1:1 response per S9 spec).
- Playlist hero `image_url` double-prepend — backend only ever stores root-relative paths.

Plus DESIGN_QA.md Tier-3 (11 UI polish items) feeds Phase 1 scheduling.

## Conditions attached to approval
1. **Human listening pass before merging to main** (crossfade curves, gapless, ReplayGain, trim) — only item between this branch and merge. Checklist in kickoff §S8.
2. Punch-list items above logged for Phase 1/2 scheduling; none block.

## Branch / merge plan
`hermes/phase0-s10` contains s1→s10 cumulatively. Push all `hermes/phase0-s*` branches, PR `hermes/phase0-s10 → main`, human merges after listening pass. Note for main laptop (from S8/S9 handoff): first boot post-merge migrates DB/art to platformdirs location — expected, don't panic at the fresh empty `backend/aurora.db` if an old checkout boots afterward.
