# HERMES_SESSION_HANDOFF.md

**Session 5 complete (2026-06-09). Next: Session 6.**

## Git state
Branch: `hermes/phase0-s5` (1 commit ahead of `hermes/phase0-s4`)

```
3946bac test(backend): add golden parity pytest+httpx suite with 85 fixtures
```

S4 commits (on `hermes/phase0-s4`, base of this branch):
```
ab69700 docs: S4 handoff — unified serializer complete
b2f5717 refactor(backend): unify song serialization and standardize response envelopes
```

All verifications passed:
- `pytest` 120/120 passed (97 golden + 23 existing) ✓
- Running suite 3× produces identical results ✓
- Golden fixtures free of cross-module mutation leakage ✓
- MiMo diff review: PASS WITH CHANGES — 2 HIGH issues fixed (fixture scoping, re-recorded from clean state), 1 MEDIUM documented, 1 LOW fixed ✓

## What Session 5 delivered

### Golden parity test suite

- **`backend/tests/conftest.py`** — Test infrastructure:
  - Isolated `AURORA_DATA_DIR` via temp directory (cleaned up on exit)
  - Seeded SQLite DB: 3 songs (varying metadata profiles), 6 tags, 3 playlists, 1 watched folder
  - FastAPI TestClient fixture
  - `check_golden()` / `check_golden_status()` helpers for fixture recording + comparison
  - `record_bug()` for documenting backend bugs found (test-only rule)
  - `_seed_database()` for state reset between test groups
  - Fixed timestamps throughout for deterministic output

- **9 test files** (97 tests, 85 golden JSON fixtures):
  | File | Tests | Endpoints |
  |------|-------|-----------|
  | `test_golden_songs.py` | 20 | GET/POST/PUT/DELETE /api/songs, stream, bleed-thumb, album-art |
  | `test_golden_tags.py` | 13 | GET/POST/DELETE /api/tags, assign/remove song tags |
  | `test_golden_health.py` | 1 | GET /api/health |
  | `test_golden_playlists.py` | 38 | All 17 playlist endpoints including image, export, import, timing |
  | `test_golden_folders.py` | 4 | GET /api/folders, /api/folders/songs |
  | `test_golden_albums.py` | 3 | GET /api/albums, /api/albums/{name} |
  | `test_golden_filter.py` | 6 | POST /api/filter (happy + errors) |
  | `test_golden_watcher.py` | 6 | GET/POST/DELETE /api/watch, trigger scan |
  | `test_golden_zscanner.py` | 6 | POST /api/scan, /api/scan/stream (last — adds songs) |

- **85 golden JSON fixtures** in `backend/tests/golden/` — committed, deterministic on repeated runs

### Architecture decisions
- **Scanner runs last** (`zscanner`) — adds songs to shared DB; downstream modules re-seed
- **Module-scoped autouse fixtures** — `_seed_database()` via `@pytest.fixture(scope="module", autouse=True)` in songs/tags/health modules (not at import time — fixes ordering fragility)
- **Timestamp stripping** — create/update endpoints strip `created_at`/`updated_at` from golden comparison (runtime values)
- **Pydantic 422 vs 400** — `min_length=1` validations return 422 (Pydantic layer), tests document this
- **Playlist tests** — test groups separated by `_seed_database()` calls within file

### Backend bugs found (documented, NOT fixed — test-only rule)
1. **Empty timestamps in embedded playlist songs** — `PLAYLIST_SONG_SELECT_COLUMNS` omits `s.created_at`/`s.updated_at`; serializer defaults to `""`. Affects `GET /api/playlists/{id}`. Recorded via `record_bug()`.

## Quirks found during S5
- **Module-level `_seed_database()` runs at import time**, not execution time — caused golden fixtures to encode mutated state from playlists tests. Fixed by switching to `@pytest.fixture(scope="module", autouse=True)`.
- **Pydantic validates before endpoint handlers** — `min_length=1` on `FilterRequest.query` and `ScanRequest.folder_path` returns 422 (not the documented 400) for empty strings.
- **Shared DB across all test modules** — scanner adds songs, watcher adds folders. Modules that depend on seed counts must re-seed.

## For the next session
- Start on branch `hermes/phase0-s5` (or merge to main first — your call)
- Read CLAUDE.md, then HERMES_KICKOFF.md, then this handoff
- Execute Session 6 (S6) exactly as written
- Do NOT start Session 7 in the same context — start fresh for each session

## Sessions reserved for Fable 5 only
- S8 (PlaybackEngine contract)
- S9 (seek bar design)
- S10 (design audit)
- Gate 0 review

Never attempt these with any other model.
