# HERMES_SESSION_HANDOFF.md

**Session 3 complete (2026-06-09). Next: Session 4.**

## Git state
Branch: `hermes/phase0-s3` (1 commit ahead of `hermes/phase0-s2`)

```
d1eac9b refactor(backend): replace try/except init_db with PRAGMA user_version migration ladder
```

S2 commits (on `hermes/phase0-s2`, base of this branch):
```
c4f9fc5 feat(backend): centralize data directory with platformdirs migration
```

S1 commits (on `hermes/phase0-s1`):
```
eefcb51 chore(frontend): delete unmounted WaveformBar dead code
291d3dd fix(watcher): invalidate caches after background auto-import
2d24e8d refactor(frontend): replace hardcoded localhost:8000 with runtime getBaseUrl()
```

All verifications passed:
- `pytest` 23/23 passed
- Real aurora.db copy upgrades to `user_version=1` ✓
- Fresh DB creates at `user_version=1` with all 31 songs columns ✓
- Unknown version (99) raises `RuntimeError` with clear message ✓
- Idempotent (running init_db twice on same DB) ✓

## What Session 3 delivered
1. **`INIT_SQL`** now defines the complete current schema — all 31 songs columns, 9 playlists columns (including crossfade), 7 playlist_songs columns (including trim). Fresh databases create at the latest version with zero ALTER TABLE calls.
2. **`MIGRATIONS` list** — version 1 contains all 26 ALTER TABLE statements from the original try/except blocks. The ladder is append-only: future migrations go as `(2, [...])`, `(3, [...])`, etc.
3. **`_run_migrations()`** — handles three paths:
   - `user_version == 0`: runs all migrations with targeted "duplicate column" error handling, stamps version 1
   - `user_version > CURRENT_VERSION`: raises `RuntimeError` (fail loudly)
   - `user_version < latest`: applies forward migrations only (no try/except)
4. **Backfills** (file_format, album_art) remain outside the version ladder — they're idempotent and only touch NULL rows.
5. **MiMo review** caught overly-broad `except OperationalError` → fixed to only catch "duplicate column" errors.

## Quirks found during S3
- None. Clean rewrite, no surprises.

## For the next session
- Start on branch `hermes/phase0-s3` (or merge to main first — your call)
- Read CLAUDE.md, then HERMES_KICKOFF.md, then this handoff
- Execute Session 4 (S4) exactly as written
- Do NOT start Session 5 in the same context — start fresh for each session

## Sessions reserved for Fable 5 only
- S8 (PlaybackEngine contract)
- S9 (seek bar design)
- S10 (design audit)
- Gate 0 review

Never attempt these with any other model.
