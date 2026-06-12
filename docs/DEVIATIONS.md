# Aurora — Deviations from Plan

> Decisions that diverge from the original spec, brief, or plan. Each entry explains what changed, why, and what the next agent needs to know.

---

## Desktop Build Targets: `deb` + `nsis` (no AppImage, no rpm)

**Brief said:** `"targets": "all"` (AppImage, deb, rpm on Linux; NSIS on Windows)
**Actual:** `"targets": ["deb", "nsis"]`
**Why:** linuxdeploy (AppImage tool) can't resolve PyInstaller `_internal/` library dependencies on Ubuntu 22.04. `libsharpyuv` is missing from the system. See `docs/CHALLENGES.md` #1 for full story.
**Impact:** No `.AppImage` artifact. Linux users get a `.deb` package. Works on Ubuntu/Debian, not on Fedora/Arch without conversion.
**N6 action:** Could revisit with Ubuntu 24.04 runner (has `libsharpyuv0`) or new Tauri AppImage bundler (PR #12491).

---

## Backend Resource Path: `_up_/_up_` in Package

**Brief said:** Bundle `../../backend/dist/aurora-backend/` as a resource.
**Actual:** The relative path `../../` resolves to `_up_/_up_/` in the final package. Backend ends up at `usr/lib/Aurora/_up_/_up_/backend/dist/aurora-backend/`.
**Why:** Tauri's resource bundling resolves `..` as literal `_up_` directory names. This is by design — the resource dir is flat, and relative paths become nested.
**Impact:** Functional but ugly path. The sidecar code in `lib.rs` handles this correctly via `app.path().resource_dir()`.
**N6 action:** Could copy backend dist to a sibling directory (e.g., `frontend/sidecar-backend/`) before building to get a cleaner path like `usr/lib/Aurora/sidecar-backend/aurora-backend`.

---

## `time` Crate Pinned to 0.3.47

**Brief said:** No crate pinning mentioned.
**Actual:** `Cargo.lock` pins `time` to 0.3.47 (not latest 0.3.48).
**Why:** `cookie 0.18.1` (Tauri transitive dep) conflicts with `time 0.3.48` due to a new `From` impl. See `docs/CHALLENGES.md` #2.
**Impact:** None — `time 0.3.47` is functionally identical for our use case. The pin will need to be removed when `cookie` releases a fix (rwf2/cookie-rs#250).
**N6 action:** Check if `cookie` has a newer version that fixes this. If so, remove the pin.

---

## Runtime Verification: Headless Only

**Brief said:** `npx tauri dev` → native window opens, song list loads, playback works.
**Actual:** All Tauri dev runs compile successfully but panic at GTK init (no display server on the build machine). Compilation verified (491/491 crates), runtime not tested.
**Impact:** Code correctness is verified by compilation + CI. Runtime behavior (window, rendering, sidecar lifecycle, folder picker) untested on a real desktop.
**N6 action:** Run `tauri dev` on a machine with a display (Prajith's laptop). Verify: window opens, songs load, sidecar spawns, folder picker works, no orphan processes on exit.

---

## CI Workflow: `projectPath` Required for Monorepo

**Brief said:** `tauri-apps/tauri-action@v0` with default settings.
**Actual:** Added `projectPath: frontend` to both Linux and Windows build steps.
**Why:** `tauri-action` defaults to `.` (repo root). Our `src-tauri/` is inside `frontend/`.
**Impact:** None — this is the correct config for our layout.

---

## CI Workflow: `tauri` npm Script Required

**Brief said:** Not mentioned.
**Actual:** Added `"tauri": "tauri"` to `frontend/package.json` scripts.
**Why:** `tauri-action` runs `npm run tauri build`. Without the script, it fails.
**Impact:** None — this is standard for Tauri projects. `npx tauri init` doesn't add it automatically.

---

## Sidecar: `reqwest` Added for Health Polling

**Brief said:** Poll `GET /api/health` up to 15s.
**Actual:** Added `reqwest = { version = "0.12", features = ["blocking"] }` to Cargo.toml for HTTP health checks.
**Why:** Rust stdlib has no HTTP client. `reqwest` is the standard choice. Blocking mode used because the health poll runs in the setup closure (async not available there).
**Impact:** Adds ~2MB to the binary. Could use `ureq` (lighter) if binary size matters.

---

## Folder Picker: Dynamic Import for Tauri Plugin

**Brief said:** Add `tauri-plugin-dialog`, show "Browse…" button.
**Actual:** Used `const { open } = await import("@tauri-apps/plugin-dialog")` (dynamic import) instead of static import.
**Why:** Static import would fail in browser mode (the module doesn't exist outside Tauri). Dynamic import only loads the module when the button is clicked, and only in Tauri mode (the button is hidden in web mode).
**Impact:** None — this is the correct pattern for optional Tauri features.

---

*Last updated: 2026-06-12 (N5)*
