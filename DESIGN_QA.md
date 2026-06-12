# DESIGN_QA.md — S10 Live Design Audit

**Date:** 2026-06-10 · **Auditor:** Fable 5 · **Method:** Playwright headless chromium, every view × 1440/768/390px, 42 screenshots (`/tmp/aurora-s10-shots/before/`), reviewed against emil-design-eng checklist + VISUAL_AUDIT.md. Zero console errors across the sweep.

**Stale VISUAL_AUDIT.md items verified already fixed** (do not re-fix): Settings/About responsive padding (`p-4 sm:p-10` ✓), page titles standardized to 28px ✓ (one straggler, see T2-1), context-menu viewport clamping (`SongRow.tsx:87-88` ✓), global `:focus-visible` ring ✓.

---

## Tier 1 — User-visible breakage (fixed in S10)

### T1-1. Mobile hamburger overlaps every page title (<768px)
**Evidence:** `settings-390.png` reads "tings", `about-390.png` reads "rora", `folders-390.png` reads "lders", `mix-390.png` title fully hidden, `all-songs-390.png` reads "Songs" ("All " hidden).
**Cause:** `AppShell.tsx:28-39` hamburger is `fixed top-4 left-4 z-50` (occupies y 16–52px); every view renders its h1 at the same origin under it (`p-4` mobile padding).
**Fix:** mobile-only top padding on the main scroll container in `AppShell.tsx:71` — `pt-14 md:pt-0`. One file, every view inherits clearance; content scrolls under the floating button, standard pattern.

### T1-2. Playlist hero collapses at ≤768px — title truncates to one letter
**Evidence:** `playlist-detail-768.png` shows hero title "A" (playlist is "Anime"); at 390 the title row is pushed out entirely, stats wrap into a vertical crumb column.
**Cause:** `PlaylistDetail.tsx:620-716` — fixed `px-10 pt-10` padding, fixed `w-[168px]` art, fixed `text-[64px]` title, non-wrapping `flex items-end gap-7` with a fixed-width actions cluster. At 768: 528px main − 80 padding − 168 art − 28 gap − ~150 actions ≈ 100px for a 64px-type title.
**Fix:** responsive hero — `px-4 pt-6 pb-6 sm:px-10 sm:pt-10 sm:pb-8`; art `w-[96px] h-[96px] sm:w-[168px] sm:h-[168px]`; title `text-[28px] sm:text-[44px] lg:text-[64px]`; actions row wraps below metadata on mobile (`flex-wrap`); divider `mx-4 sm:mx-10`.

### T1-3. FoldersView unusable at 390px — fixed 256px tree starves content
**Evidence:** `folders-390.png` — tree column + empty-state share 390px; content column ~130px wide, text shredded into 3-word lines.
**Cause:** `FoldersView.tsx:194-196` — `flex` row with `w-64 flex-shrink-0` tree, no mobile fallback.
**Fix:** stack on mobile — container `flex-col md:flex-row`; tree `w-full md:w-64`, `max-h-[35vh] md:max-h-none overflow-y-auto`, `border-b md:border-b-0 md:border-r`.

---

## Tier 2 — Consistency (cheap, fixed in S10 where ≤3 lines)

### T2-1. Quick-tag header off type scale — `QueryBuilder.tsx:103` `text-[26px]` → `text-[28px]` (last straggler from the 28px standardization). **Fixed.**
### T2-2. Dead `.playerbar-*` CSS block — `index.css:1205-1232` defines 44/80px heights; `PlayerBar.tsx:244` uses Tailwind 52/96px. Classes unreferenced — VISUAL_AUDIT §2.5 confirmed. Deleted (also removes a `transition: height` + `will-change: height` layout-animation rule, emil perf checklist). **Fixed.**
### T2-3. WelcomeOverlay off-palette glow blobs — `WelcomeOverlay.tsx:38/51/65` hardcode indigo `rgba(99,102,241)` / blue `rgba(59,130,246)`, not in the aurora palette. → teal `rgba(45,212,191)` + violet kept `rgba(139,92,246)`. **Fixed.**
### T2-4. `transition: all` in hand-written CSS — `index.css` `.aurora-chip` (302), `.mix-kbd` (1092), `.mix-btn-jam` (1154). → explicit property lists (border-color/background/color/box-shadow/transform). Emil rule: never `all`. **Fixed.**

---

## Tier 3 — Punch list for Gate 0 / later sessions (not fixed here)

| # | Item | Where | Concrete fix |
|---|------|-------|--------------|
| 1 | `transition-all` Tailwind utility, 21 sites | e.g. `App.tsx:133`, `ui/button.tsx:15`, `ui/input.tsx:14`, `WelcomeOverlay.tsx:126/159/192` | Mechanical sweep → name exact properties (`transition-[box-shadow,color]` etc). Flash-grade task; needs per-site eyeballing of which props actually change |
| 2 | Mix chip tray has no overflow affordance | `QueryBuilder.tsx:215` (`overflow-x-auto`, scrollbar hidden) | Add right-edge fade mask (`mask-image: linear-gradient`) when scrollable; tray DOES scroll, discoverability only |
| 3 | No `:active` press state on list items | Sidebar nav/playlist items, queue rows, settings preset buttons | `active:bg-white/[0.03]` or `aurora-btn-press`; emil checklist "buttons must feel responsive" |
| 4 | Disabled opacity inconsistent: 0.25 / 0.40 / 0.55 | transport btns / range inputs / mix btns | Standardize 0.40 |
| 5 | Queue count badge `text-[8px]` | `PlayerBar.tsx:233` | → 9px min legible |
| 6 | Raw CSS `:hover` rules not hover-gated (1 of ~12 gated) | `index.css` `.aurora-chip:hover`, `.mix-kbd:hover`, etc. | Tailwind v4 gates `hover:` utilities natively; hand-written CSS rules need `@media (hover: hover)` wrap. Touch-only false-positives |
| 7 | Folders tree header `text-[18px]` reads as orphan | `FoldersView.tsx:198` | It's a panel header not a page title — defensible; consider `label-micro` treatment like sidebar section headers for hierarchy clarity |
| 8 | Hero halo `opacity-60` + 700px radial on every PlaylistDetail mount | `PlaylistDetail.tsx:622-628` | Fine on GPU; verify no repaint on scroll during Gate 0 perf pass |
| 9 | Border token split: `--aurora-rim` vs `--aurora-surface-border` for same glass-container role | `App.tsx:134` vs `PlaylistDetail.tsx:730` | Pick `--aurora-rim`; mechanical |
| 10 | WelcomeOverlay action cards: hover relies on child text color only | `WelcomeOverlay.tsx:126/159/192` | Add card-level `hover:bg-white/[0.03]` |
| 11 | `tokens.css` System-A variables unused by components | `tokens.css` | Consolidate or document as shadcn-bridge only |

---

## Emil checklist — pass/fail summary (live code, this session)

| Check | Result |
|---|---|
| Easing: no `ease-in` anywhere | ✅ PASS (grep clean) |
| Durations ≤300ms on UI | ✅ PASS (longest UI transition 300ms playerbar height; dead CSS removed) |
| Transform/opacity-only animation | ⚠️ mostly — scrubber exemplary (scaleY, GPU); ScanDialog progress bar animates width via `transition-all duration-150` (acceptable: continuous progress, linear-ish, small) |
| `:active` press states | ⚠️ buttons/chips yes (`aurora-btn-press`, `ui/button.tsx`), list items missing (T3-3) |
| Hover gated `(hover:hover) and (pointer:fine)` | ⚠️ Tailwind v4 utilities auto-gated + scrubber gated; raw CSS rules not (T3-6) |
| Focus rings | ✅ global `:focus-visible` + `--focus-ring` token, per-song color |
| `scale(0)` entries | ✅ none found |
| Keyboard actions not animated | ✅ scrubber `data-instant` suppresses transition on keyboard seek |

## Verification
- `npm run build` clean after fixes (output in session log)
- After-screenshots for every Tier-1/2 fix: `/tmp/aurora-s10-shots/after/`
