# Aurora — Engineering Challenges Log

> Real problems encountered during development. Root causes, solutions, and lessons learned. Useful for interviews, postmortems, and general knowledge.

---

## 1. linuxdeploy + PyInstaller: Silent Library Resolution Failure (N5 — 2026-06-12)

**Context:** Building the Tauri desktop app in CI (GitHub Actions, Ubuntu 22.04). The frontend wraps a PyInstaller-frozen Python backend as a bundled resource.

**Symptom:** `failed to run linuxdeploy` during AppImage bundling. All other targets (deb, rpm) built fine.

**First instinct (wrong):** `strip` incompatibility — linuxdeploy crashes on modern ELF `.relr.dyn` sections. Multiple Tauri issues (#14796, #13113) confirm this. Set `NO_STRIP=true` at step level.

**Why that didn't work:** `NO_STRIP` at the GitHub Actions step level only sets the env var for the *outer* process. Tauri's CLI spawns linuxdeploy as a child process that doesn't inherit step-level env vars. Setting it at the job level also didn't help.

**Actual root cause (discovered via `--verbose`):** linuxdeploy scans ALL `.so` files in the AppDir, including the PyInstaller `_internal/` directory. One bundled library (`libwebp-*.so`) depends on `libsharpyuv-*.so`, which exists inside `_internal/` but NOT on the Ubuntu 22.04 system. linuxdeploy resolves dependencies against system paths only — it can't find libraries that are only in the bundle.

```
ERROR: Could not find dependency: libsharpyuv-60a7c00b.so.0.1.1
ERROR: Failed to deploy dependencies for existing files
```

**Solution:** Dropped AppImage from bundle targets. Used `deb` + `nsis` only. The `.deb` package correctly contains the backend resources.

**Lessons:**
1. **`--verbose` is your friend** — the original error message was misleading (`failed to run linuxdeploy` with no detail). Verbose mode revealed the actual missing dependency.
2. **Env vars at CI step level ≠ child process level** — when a tool spawns subprocesses, step-level env vars may not propagate. Job-level is better but still not guaranteed.
3. **Bundling a bundle is fragile** — PyInstaller creates a self-contained `_internal/` directory with its own `.so` files. When linuxdeploy scans this, it tries to resolve those libraries against the system. This is fundamentally incompatible.
4. **AppImage + PyInstaller is a known pain point** — the Tauri team is rewriting the AppImage bundler (PR #12491). Until then, deb/rpm are safer for apps with bundled native libraries.
5. **Ubuntu version matters for library availability** — `libsharpyuv` was introduced in `libwebp 1.3.x` (Ubuntu 24.04+). Ubuntu 22.04 has `libwebp 1.2.x`. Always check library availability on your target CI runner.

**Interview angle:** "Tell me about a time you had to debug a CI build failure" — this is a multi-layered debugging story: wrong diagnosis (strip), right tool (verbose), real root cause (library resolution in nested bundles).

---

## 2. `cookie` / `time` Crate Conflict in Rust (N5 — 2026-06-12)

**Context:** Building the Tauri scaffold. `cargo build` fails with conflicting trait implementations.

**Error:**
```
error[E0119]: conflicting implementations of trait `From<format_description::parse::format_item::HourBase>`
for type `<HourBase as ModifierValue>::Type`
```

**Root cause:** `cookie 0.18.1` (a transitive dependency of Tauri) implements `From<T: Into<Option<OffsetDateTime>>>` for `Expiration`. The `time 0.3.48` crate added a new `From` implementation for `HourBase` that creates a conflict with this blanket impl. This is a Rust coherence/orphan rule issue.

**Solution:** `cargo update -p time --precise 0.3.47` — downgrade `time` to the last compatible version.

**Lessons:**
1. **Semver doesn't prevent all breakage** — `time 0.3.47 → 0.3.48` is a patch version bump, but it introduced a new trait impl that broke downstream crates. This is technically a semver violation by `time`, but it's a known class of breakage in Rust.
2. **Check GitHub issues early** — rwf2/cookie-rs#250 had the exact fix. Searching for the error message + crate names would have saved 10 minutes.
3. **`Cargo.lock` is your friend** — committing the lockfile with the pin ensures CI uses the same version.

**Interview angle:** "How do you handle dependency conflicts?" — demonstrates understanding of Rust's trait coherence rules, the limits of semver, and pragmatic pinning strategies.

---

## 3. `tauri-action` Missing `npm run tauri` Script (N5 — 2026-06-12)

**Context:** CI uses `tauri-apps/tauri-action@v0` to build the Tauri app.

**Error:** `npm error Missing script: "tauri"` — the action runs `npm run tauri build` by default.

**Root cause:** The frontend's `package.json` had `dev`, `build`, `lint`, `preview` scripts but no `tauri` script. The `@tauri-apps/cli` package provides the `tauri` binary, but npm scripts must be explicitly defined.

**Solution:** Added `"tauri": "tauri"` to `package.json` scripts.

**Lesson:** Always check what command a CI action actually runs. The `tauri-action` docs assume you have a `tauri` npm script. If you scaffold with `npx tauri init` (not `npm create tauri-app`), you don't get this script automatically.

---

## 4. `tauri-action` Missing `projectPath` (N5 — 2026-06-12)

**Context:** Monorepo layout — `frontend/` contains the Tauri app, repo root contains `backend/`.

**Error:** `tauri-action` couldn't find `src-tauri/` because it defaults to `.` (repo root).

**Solution:** Added `projectPath: frontend` to both Linux and Windows build steps.

**Lesson:** `tauri-action` defaults to the repo root for `projectPath`. In monorepo layouts, always specify it explicitly. This was caught by Fable's code review before the session — having a review step before CI iteration saved one round-trip.

---

## 5. GTK Backend Panic on Headless Linux (N5 — 2026-06-12)

**Context:** Running `npx tauri dev` on a headless Linux server (no display).

**Error:** `Failed to initialize gtk backend!: BoolError { message: "Failed to initialize GTK" }`

**Root cause:** Tauri uses GTK/WebKitGTK for rendering on Linux. These require a display server (X11 or Wayland). A headless server has neither.

**Solution:** None needed — this is expected. The compilation succeeds (all crates build), which validates the code. Runtime testing requires a desktop environment.

**Lesson:** Don't confuse "code compiles" with "code runs." On headless servers, you can verify compilation and static analysis, but runtime behavior (window creation, rendering, user interaction) needs a display. CI runners with `xvfb` can bridge this gap if needed.

---

## 6. PyInstaller `onedir` vs `onefile` for Desktop Bundling (N3-N5 — 2026-06-10 to 2026-06-12)

**Context:** Choosing how to package the Python backend for the Tauri sidecar.

**Decision:** `onedir` (directory with binary + shared libs) instead of `onefile` (single self-extracting binary).

**Why:**
- `onefile` extracts to a temp directory on every launch (~2-5s overhead)
- `onedir` launches instantly
- `onedir` lets Tauri bundle the directory as resources, spawning the inner binary by path
- `onefile` would require `externalBin` (Tauri's native sidecar support), which expects a single file per target triple — doesn't work with the `_internal/` directory structure

**Trade-off:** `onedir` produces a directory (~8MB) instead of a single file. Tauri bundles it as a resource directory, which works but creates a nested path (`_up_/_up_/`) in the final package.

**Lesson:** Packaging decisions have long downstream effects. The `onedir` choice was correct for performance but created the `_up_` path issue in the deb package. A cleaner approach would be to copy the backend dist to a sibling directory before building.

---

## 7. `getBaseUrl()` Injection Pattern for Desktop/Web Dual Mode (N5 — 2026-06-12)

**Context:** The app needs to work in both browser (localhost:8000) and desktop (Tauri sidecar on random port).

**Solution:** `window.__AURORA_BASE_URL__` — set by Tauri's `window.eval()` before the frontend loads. `getBaseUrl()` reads it first, falls back to `VITE_API_BASE_URL`, then `http://localhost:8000`.

**Why this pattern:**
- Zero frontend code changes for the common case
- The sidecar picks a free port (avoids conflicts), so the URL can't be hardcoded
- `eval()` runs before the frontend's module scripts, so the variable is available when `getBaseUrl()` is first called

**Lesson:** Runtime injection via `window.eval()` is a clean way to pass configuration from a native wrapper to a web app. It avoids build-time configuration and works with any bundler.

---

*Last updated: 2026-06-12 (N5)*
