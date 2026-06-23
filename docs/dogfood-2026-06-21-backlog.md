# Dogfood Backlog — 2026-06-21 (pre-v0.1.1 round)

> Source: developer dogfood pass, 2026-06-21 (Tailscale/dev build, ahead of the v0.1.1 release cut).
> Captured by Opus (planner). **Daiki is implementing these** — recorded so nothing is buried.
> Severity: 🔴 blocks daily use · 🟠 major UX/functional · 🟡 polish · 🔵 feature/backlog.
> Feeds the R2 polish pass; the meaty structural ones graduate to `docs/CHALLENGES.md` once solved.

---

## A. Bug fixes (quick)

| ID | Item | Sev | File / root-cause hypothesis | Notes |
|----|------|-----|------------------------------|-------|
| G1 | **Playlist cover doesn't refresh after upload** | 🟠 | Upload succeeds (backend fine); the store never refreshes the image URL after save. `stores/playlistStore.ts` upload handler / `components/playlists/PlaylistDetail.tsx` | Fix: after a successful upload, `fetchPlaylistDetail(id)` (or update local state with the new URL + a cache-bust query param so the browser re-fetches the image). |
| G2 | **Type ("file_format") column won't sort** | 🟡 | ⚠️ **DIAGNOSIS CORRECTED:** `sortable: "file_format"` **already exists** at `columns.tsx:117` — it is NOT missing. Real cause is downstream: either the backend `/songs` sort whitelist doesn't accept `file_format`, or the Type column header isn't wired to trigger the sort click. | Re-diagnose before coding: (a) check the backend allowed sort fields in `routers/songs.py`; (b) confirm the header for this column dispatches the sort. Don't "add sortable" — it's there. |
| G3 | **Folders "Showing X of X" footer — duplicate count** | 🟡 | ✅ Fixed. Footer was not mis-positioned; FoldersView header showed "{N} songs" AND SongTable footer showed "Showing N of N". Removed header duplicate. Sticky footer is the single source of truth across all views. |

## B. Structural (bigger effort)

| ID | Item | Sev | File / root-cause hypothesis | Notes |
|----|------|-----|------------------------------|-------|
| G4 | **Scroll breaks at the bottom of playlists** | 🟠 | The playlist cover hero + song list aren't inside one proper scroll container; the last few songs scroll the *page* instead of the list. `components/playlists/PlaylistDetail.tsx` layout. | Restructure: hero + list share a single scroll container (the list scrolls within a flex/overflow region, hero scrolls with it or is sticky). Likely a `min-h-0` / `overflow` flex pitfall. → **CHALLENGES candidate once fixed** (flexbox scroll-container gotcha). |
| G5 | **Layout breaks at Windows 150% display scaling** | 🟠 | Hardcoded pixel values don't adapt to OS display scaling; scrollbars/spacing wrong at 125/150%. Needs a CSS audit (`index.css` + components using fixed `px`). | Audit fixed `px` → relative units / `rem`; verify at 100/125/150%. → **CHALLENGES candidate** (px vs DPI scaling). |
| G6 | **Auto-load on scroll (replace "Load More" button)** | 🟠 | ✅ Fixed. Replaced `handleScroll` + "Load More" button with `IntersectionObserver` on a non-sticky sentinel at the content bottom. Uses `rootMargin: "0px 0px 300px 0px"` for prefetch. See CHALLENGES #24. |

## C. Feature requests (backlog)

| ID | Item | Sev | Notes |
|----|------|-----|-------|
| G7 | **"Recently added" songs view** | 🔵 | New view/sort keyed on `created_at`/scan time. |
| G8 | **Custom animated SVG logo** | 🔵 | Brand polish; pairs with the About audit (E2 in gate1 backlog). |
| G9 | **Scroll highlight smoothing** | 🔵 | Row hover "sticks" during scroll. Fix via `pointer-events: none` on the list during scroll, or scroll-aware hover gating. |

---

## Status / routing
- **G1 ✅, G2 ✅, G4 ✅** — fixed in commit `4a7e006` (playlist cover refresh; `file_format` sort added to SortField + dropdown + backend whitelist; playlist flex scroll container). CHALLENGES #22 (scroll container) + #23 (scaling) added by Daiki.
- **G3 ✅, G6 ✅** — fixed in commit `27118e5` (IntersectionObserver auto-load; duplicate folder count removed). CHALLENGES #24 (IntersectionObserver pattern).
- **G5** — design pass DONE (Opus via impeccable `/adapt`, headless-verified at 1280/1024/911 DPR 1.5). Brief = `HERMES_G5_BRIEF.md`. Corrected deep-dive below — the original hypotheses were wrong; scope is much smaller than feared (one real fix + two polish).
- **G7–G9:** backlog; sequence post-1.0 or as spare-cycle polish.
- These are R2 polish — land before the public v1.0.0 cut, not gating the v0.1.1/v0.1.2 updater test.

---

## G5 deep-dive — Windows 125/150% display scaling (research 2026-06-21)

**Two separate problems (don't conflate):**
- **A — layout (our symptom).** At 150% OS scale the CSS viewport shrinks: 1920→**1280×720 CSS px**,
  1536→**~1024**, 1366→**~911**. CSS `px` already scale via `devicePixelRatio`, so nothing is "too
  small" — there's just less logical width. Testable on Linux: Chrome DevTools responsive mode at
  those widths, DPR 1.5.
- **B — blurry rendering.** WebView2 renders at 1× when the host isn't Per-Monitor-DPI-aware. Fix =
  Tauri/tao DPI config, **not CSS**; needs a Windows look. Out of scope for the CSS pass. Refs:
  tauri-apps/tauri #1074, #11968.

### Opus design-pass findings (2026-06-22, headless-measured) — supersedes the original guesses

Drove the running app (Playwright + bundled chromium) at 1280×720, 1024×640, 911×512 (DPR 1.5),
every view, playback active, measuring live `scrollWidth` vs `clientWidth`. **Two original
hypotheses were DISPROVEN:**

- ❌ "root `font-size` is a fixed 10.5px, so `rem`/px-swap is inert." **Wrong** — there is no
  `font-size` on `html`/`body`; root = browser default **16px**. The 10.5px is `.label-micro` (one
  utility class). Tailwind v4 breakpoints are therefore standard (sm640/md768/lg1024/xl1280/2xl1536),
  **not** shrunk. (The conclusion "responsive layout > unit-swap" still holds — premise was wrong.)
- ❌ "PlayerBar `300+580+220 ≈ 1100px` overflows below ~1150px." **Wrong** — PlayerBar fits cleanly
  640→1280. Its only overflow is a *constant* +60px at every width (so not a flex problem): the
  bleed-glow layer is `inset:-60px`, clipped invisibly by the shell `overflow-hidden`. Center is
  `flex-1 min-w-0`; side text truncates → squeeze absorbed.

**The app is largely responsive-clean down to ~900px** (no page-level h-scroll anywhere). The real
scope is **three items** (see `HERMES_G5_BRIEF.md` for exact file:line + fixes):
- **G5-A 🟠 (only visible break): FoldersView** two-pane `md:flex-row` (line 225/227) splits at
  md(768) too early → at ~911 tree+breadcrumb+songtable cram, header +63px. Fix: split at `lg`,
  stack below.
- **G5-B 🟡: SongTable** hides `type/duration/artist/album` via `hidden lg:table-cell` keyed to the
  **viewport**, but the table's space is `viewport−240px sidebar` → columns reveal ~240px too early,
  small h-scrollbar/cramp in the ~960–1040 band (graceful — `overflow-auto`, no clip). Fix:
  container queries (`@container` on the scroll wrapper, reveal on table width).
- **G5-C 🟡 hygiene: PlayerBar** bleed `inset:-60px` has no clip → +60px scrollWidth, invisible now
  (shell clips it) but a latent h-scroll source in WebView2. Fix: `overflow-hidden` on the bar wrapper.

**Verifiable entirely on Linux** (DevTools/Playwright at the widths above); only B (blur) needs
Windows. On fix, fold A's root cause (viewport-keyed vs container-keyed reveal) + the clipped
decoration into `docs/CHALLENGES.md` #23.

Sources:
- https://medium.com/@drashtisolanki.jobs/your-ui-looks-different-debugging-display-scaling-issues-15e93354848f
- https://silvawebdesigns.com/how-to-fix-windows-scaling-issues-above-100-for-your-website/
- https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- https://github.com/tauri-apps/tauri/issues/1074
- https://deepwiki.com/tauri-apps/tao/8.3-dpi-and-scaling

---

On fix, promote **G4 / G5 / G6** to `docs/CHALLENGES.md` with root cause + lesson (interview material).
