# Gate-1 Windows Checklist

> **Target:** Windows main laptop (Gate-1 reference hardware)
> **Tester:** Human (Prajith) | **Reviewer/author:** Hermes
> **Counterpart:** Linux Gate-1 results live in `docs/desktop-qa-matrix.md` §6.
> **Status legend:** ☐ not run · ✅ pass · ❌ fail · ⏸ blocked

Record the build under test before starting:

- Installer: `Aurora_<version>_x64-setup.exe` (NSIS) — version: ______
- Built from commit: ______ (`git rev-parse --short HEAD` of the tag/branch CI built)
- **Pre-req for a clean run:** commit `fcb5e1f` (CORS preflight exempt) MUST be in
  the built commit, else scan/playlists fail with "failed to fetch". Confirm with
  `git merge-base --is-ancestor fcb5e1f <built-commit>`.
- **Console-window fix:** commit `fa964c4` (CREATE_NO_WINDOW) must be in the build
  to clear the reopening cmd window. If testing a build *without* it, expect the
  window — note it and move on.

---

## Part A — Runnable now (no published release required)

Install the locally-built NSIS installer and exercise the core desktop loop.

### A1. Install & first launch

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Run `Aurora_<v>_x64-setup.exe`, complete installer | Installs to `C:\Users\<you>\AppData\Local\Aurora`, launches | ☐ |
| 2 | Observe window during startup | Window appears only after backend health gate — no white/frozen frame | ☐ |
| 3 | **Console window check** | **No cmd/console window appears** (CREATE_NO_WINDOW). With the fix, none ever shows | ☐ |

### A2. Core data path (verifies fcb5e1f / CORS)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4 | Sidebar loads playlists + tags | Both populate, no "Failed to load" | ☐ |
| 5 | Open Scan dialog, "Browse…" picks a folder, run scan | Folder picker is native; scan imports songs, no "failed to fetch" | ☐ |
| 6 | Play a song; Next / Prev; pause/resume; seek | Audio plays; transport + seek work | ☐ |
| 7 | Crossfade on (Settings) → let a song cross into the next | Crossfade audible, no dual-audio / double-advance | ☐ |

### A3. Process lifecycle

| # | Step | Expected | Result |
|---|------|----------|--------|
| 8 | Close window via title-bar **X** | App exits; **no orphan** `aurora-backend.exe` in Task Manager | ☐ |
| 9 | Relaunch, then **kill `aurora-backend.exe`** from Task Manager | Monitor thread respawns backend within ~5s; app keeps working; **no console window** on the restarted backend | ☐ |
| 10 | Quit again | No orphan backend process | ☐ |

> NOTE: the Linux Gate-1 SIGTERM finding (backend respawns on `kill` of the app)
> is a Unix-signal path and does not apply to the Windows X-button quit, which
> goes through `RunEvent::ExitRequested`. Step 8 is the path that matters here.

### A4. Single-instance

| # | Step | Expected | Result |
|---|------|----------|--------|
| 11 | With Aurora open, launch the installed app again | No 2nd window; existing window unminimizes + focuses; only one backend running | ☐ |

### A5. Window-state restore

| # | Step | Expected | Result |
|---|------|----------|--------|
| 12 | Resize + move window, then quit via X | — | ☐ |
| 13 | Relaunch | Window restores prior size + position (`tauri-plugin-window-state`) | ☐ |
| 14 | Maximize, quit, relaunch | Restores maximized | ☐ |

### A6. Release-build logging (diagnosability)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 15 | After a session, open `%LOCALAPPDATA%\app.aurora.music\logs\` (or the app log dir) | `aurora.log` present with sidecar narrative (spawn attempts, port, health, restarts) | ☐ |
| 16 | Same dir | `backend.log` present with backend stdout/stderr (uvicorn lines) | ☐ |

> If A6 fails, attach whatever logs exist — that itself is the diagnostic signal.

---

## Part B — Updater old→new cycle — ⏸ BLOCKED

**Blocked until two real GitHub releases exist** (no published release with assets
yet). Unblocks after the release-cutting plan (tags `v0.1.1` then `v0.1.2`) ships
signed NSIS artifacts + `latest.json`. See the proposed release plan in the N10
handoff.

When unblocked, run:

| # | Step | Expected | Result |
|---|------|----------|--------|
| B1 | Install the **older** release (`v0.1.1`) NSIS build | Runs normally | ⏸ |
| B2 | Publish `v0.1.2` release (signed, with `latest.json`) | Asset + `latest.json` reachable at the updater endpoint | ⏸ |
| B3 | Launch `v0.1.1`; wait for startup update check (~10s) | Update prompt offers `v0.1.2` | ⏸ |
| B4 | Accept the update | Downloads, verifies signature, installs, relaunches into `v0.1.2` | ⏸ |
| B5 | Confirm version post-update (Settings / About) | Shows `v0.1.2`; library + settings intact | ⏸ |
| B6 | Re-open Settings → "Check for updates" on latest | Reports up to date | ⏸ |

> Windows NSIS is the **only live updater path** (Linux AppImage is dead; the
> Linux deb-update button only opens the release page in the browser).

---

## Sign-off

- Part A complete + all ✅ → Windows Gate-1 **Part A signed**: ______ (date)
- Part B requires releases; sign after B1–B6 ✅: ______ (date)
- **Do not declare Gate 1 fully signed until both Linux (§6) and Windows Part A
  are green.** Part B can trail behind once releases exist.
