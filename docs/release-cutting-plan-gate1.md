# Release-Cutting Plan — Gate-1 Updater Bootstrap

> **Status:** PROPOSAL — do not execute without human sign-off and merge.
> **Author:** Hermes | **Goal:** create a real `v0.1.1 → v0.1.2` update path so the
> Windows updater (Part B of `docs/gate1-windows-checklist.md`) can be tested.
> **Why now:** N7 only did a *dry-run* (tag + draft release, then deleted). No
> published release exists, so an installed build has nothing to update to.

## Background / constraints

- Updater endpoint (`tauri.conf.json` → `plugins.updater.endpoints`):
  `https://github.com/prajithmalepati/Aurora/releases/latest/download/latest.json`
- `/releases/latest/` resolves to the **newest published, non-draft,
  non-prerelease** release. Therefore the *target* release must be **published
  (not draft) and not marked pre-release**, with `latest.json` attached as an asset.
- Windows NSIS is the only live updater path. Linux AppImage is dead; the Linux
  deb "update" button just opens the release page.
- Signing: CI signs with `TAURI_SIGNING_PRIVATE_KEY` (rotated in N8). The pubkey
  in `tauri.conf.json` must match the CI private key, or signature verification
  fails on update. **Confirm this pairing before publishing** (the dry-run used
  the rotated key — verify CI secret == current pubkey).
- Tags must point at a commit that includes: `fcb5e1f` (CORS), `fa964c4`
  (CREATE_NO_WINDOW), `52e770c` (release logging). I.e. cut **after** the
  closeout branch merges.

## Plan (human executes, after merge)

### Step 0 — pre-flight
- Merge the closeout work to the release branch / `main`.
- Verify version is `0.1.1` in `tauri.conf.json`, `package.json`, `Cargo.toml`
  (it is) and `Cargo.lock` `name = "app"` entry.
- Confirm `latest.json` is produced by CI (`createUpdaterArtifacts` is on) and
  that the workflow uploads it + the signed NSIS asset to the release.

### Step 1 — publish the baseline `v0.1.1`
```
git tag v0.1.1 <merge-commit>
git push origin v0.1.1
```
- CI builds signed NSIS + deb + `latest.json`.
- Edit the resulting release: **uncheck draft**, **uncheck pre-release**, publish.
- This is the "old" build the human installs for Part B (B1).
- **Caution:** while `v0.1.1` is the only published release, `/latest/` points at
  it; an installed `v0.1.1` will see itself and report "up to date". Expected
  until Step 2 publishes `v0.1.2`.

### Step 2 — bump to `v0.1.2` and publish
- Bump `0.1.1 → 0.1.2` in `tauri.conf.json`, `package.json`, `Cargo.toml`, and
  refresh `Cargo.lock` (`cargo update -p app` or build once).
  Commit: `chore(desktop): bump version to 0.1.2`.
```
git tag v0.1.2 <bump-commit>
git push origin v0.1.2
```
- CI builds + signs. Publish the release **non-draft, non-prerelease**.
- `/latest/` now resolves to `v0.1.2`; its `latest.json` advertises `0.1.2`.

### Step 3 — verify the path
- Installed `v0.1.1` → startup check (~10s) → offered `0.1.2` → accept → relaunch
  into `0.1.2`. This is exactly checklist Part B (B3–B5).
- `v0.1.1` and `v0.1.2` may be near-identical content; the updater keys on the
  version string, so a thin bump is sufficient to prove the mechanism.

## Downstream enablement — AUR `aurora-bin`

Once `v0.1.1` (or `v0.1.2`) is a **published release with a stable `.deb` asset
URL**, an `aurora-bin` PKGBUILD becomes possible: download the prebuilt `.deb`
and repackage, instead of building from source like `aurora-git`. Faster install,
no Rust/Node/PyInstaller toolchain on the user's machine.

- `packaging/aur/aurora-git/PKGBUILD` already declares `conflicts=('aurora-bin')`,
  anticipating the pair.
- `aurora-bin` `source` = the release `.deb` download URL; `sha256sums` = the real
  hash (not `SKIP`); `pkgver` = the release version.
- Out of scope for this cycle — author after the first real release exists.

## Rollback / cleanup
- If a published release is bad: delete the release + tag, fix, re-tag. Note that
  any client that already updated stays on the bad version until the next bump —
  prefer to roll *forward* with `v0.1.3` rather than delete a release users pulled.
