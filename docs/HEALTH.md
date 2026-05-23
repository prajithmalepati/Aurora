# Aurora Health Document

Living audit of visual and workflow health across Aurora.
Updated as fixes land. Review the P1 column at every session start.

**Last full audit:** 2026-05-23 (Session 17 — 4 agent parallel audit)

**Severity:** `P1` = fix this session | `P2` = fix next 1–2 sessions | `P3` = fix when passing through

**Status:** `open` | `in-progress` | `fixed` | `deferred`

---

## Glow / Bleed

Glow color is derived entirely from a procedural hash of the song ID, never sampling real album art pixels. This means songs that hash to dim hue buckets (l≤45 at alpha≤0.45) produce sub-visible glow on OLED black (#06080b), while brighter buckets appear correctly. The fix is to add a lightness floor of 60% to the glow output in `albumGradient.ts`, keeping the background gradient at the original (dark) lightness — combined with the existing alpha bump this yields ~3x luminance on worst-case songs.

| ID | Severity | Status | Description | Files |
|----|----------|--------|-------------|-------|
| G-1 | P1 | deferred | Glow color is content-blind (procedural hash, ignores actual album art pixels) — root cause of per-album inconsistency. True fix = pixel sampling via canvas (requires CORS changes); G-2 lightness floor is the immediate mitigation | albumGradient.ts, PlayerBar.tsx |
| G-2 | P1 | fixed | Lightness floor missing: hues with l≤45 at alpha≤0.45 are sub-visible on OLED black | albumGradient.ts |
| G-3 | P2 | fixed | Negative spread (-6px, -4px) tightens shadow footprint for already-dim colors — amplifies G-2 | PlayerBar.tsx:69,184 |
| G-4 | P2 | deferred | pensive-bouman alpha bump (0.32→0.45) is a palliative, not a fix — ships without addressing root cause. Worktree reviewed 2026-05-23, not merged; G-2 lightness floor is the correct Phase 2 fix | albumGradient.ts worktree |
| G-5 | P3 | deferred | AlbumArt.tsx ignores surface parameter added in pensive-bouman — worktree was rejected, param was never merged | AlbumArt.tsx:24 |
| G-6 | P3 | open | PlaylistDetail hero glow seeded from playlist name string, not constituent song art | PlaylistDetail.tsx:76 |

---

## Animation & Timing

The dominant easing throughout the app is the CSS `ease` keyword, with the system expressive curve `cubic-bezier(0.2,0.7,0.2,1)` used inconsistently for entrances and panels. No motion tokens are defined — all durations and easings are hardcoded literals spread across 40+ rules, making global tuning impossible and causing drift. The worst offenders are the 420ms fade-up view entrance and 400ms Sonner toast transitions, both of which are noticeably sluggish.

**Proposed motion tokens** (add to `:root` in `index.css`):

```css
--duration-instant:  0ms;
--duration-fast:   150ms;
--duration-normal: 200ms;
--duration-panel:  300ms;
--duration-enter:  300ms;
--duration-slow:   400ms;
--ease-ui:         cubic-bezier(0.25, 0.10, 0.25, 1.00);
--ease-expressive: cubic-bezier(0.20, 0.70, 0.20, 1.00);
--ease-spring:     cubic-bezier(0.16, 1.00, 0.30, 1.00);
```

| ID | Severity | Status | Description | Files |
|----|----------|--------|-------------|-------|
| A-01 | P2 | fixed | aurora-fade-up keyframe runs at 420ms — sluggish for view mount entrance. Reduce to 300ms (--duration-enter) | index.css |
| A-02 | P2 | fixed | Sonner toast height transition is 400ms on both in and out. Slowest transition in system. Reduce to 300ms | index.css |
| A-03 | P2 | fixed | Sidebar NavItem active-bar uses transition-all duration-300. 300ms too slow for nav click response. Change to transition-[height,opacity] duration-200 | Sidebar.tsx |
| A-04 | P3 | fixed | transition-all on 9+ elements (NavItem, FooterAction, TagSidebarItem, SongRow play btn, IconBtn, QueryBuilder chips). Animates non-animating properties, wastes composite budget | Sidebar.tsx, SongRow.tsx, QueryBuilder.tsx |
| A-05 | P3 | fixed | Sonner toast slide-in uses cubic-bezier(0.16,1,0.3,1) — only place this curve appears, not aligned with system. Now references --ease-spring | index.css |
| A-06 | P3 | fixed | No motion tokens in :root. All durations and easings hardcoded as literals across 40+ rules. Prevents global tuning, causes drift | index.css |
| A-07 | P3 | open | QueryBuilder float zone uses JSX inline opacity/transform + CSS class transition — dual source of truth. JS should only toggle a class; animation should live entirely in CSS | QueryBuilder.tsx, index.css |

---

## Visual Consistency

The most common violation is `#050608` hardcoded as an icon color on play/pause buttons across multiple files; because it originates in `button.tsx`, it propagates to every `variant="primary"` button app-wide. There are 13 issues total: 1 P1, 5 P2, and 7 P3 — spanning raw hex colors, unregistered magic rgba values, missing font-mono and sub-surface tokens, and one-off font sizes that break the informal type scale. Note: `--aurora-slate` and `--aurora-obsidian` token names are recommended below — verify they exist in `index.css` before implementing; define them if missing.

| ID | Severity | Status | Description | Files |
|----|----------|--------|-------------|-------|
| I-01 | P1 | fixed | text-[#050608] hardcoded on primary Button variant — propagates to all variant="primary" buttons app-wide. Replace with text-[var(--aurora-slate)] (define token if missing) | button.tsx:21 |
| I-02 | P2 | fixed | Same #050608 repeated inline on Play/Pause icons in mobile and desktop PlayerBar | PlayerBar.tsx:134,136,233,235 |
| I-03 | P2 | fixed | Same #050608 on SongRow hover play button | SongRow.tsx:127 |
| I-04 | P2 | fixed | Same #050608 in ErrorBoundary Reload button inline style | ErrorBoundary.tsx:44 |
| I-05 | P2 | fixed | rgba(6,7,9,0.80) raw magic color for PlayerBar and AppShell hamburger backgrounds. Defined --aurora-surface-bar in index.css | PlayerBar.tsx:40, AppShell.tsx:29 |
| I-06 | P2 | fixed | backgroundColor: "#5eead4" raw hex in ScanDialog results dot | ScanDialog.tsx:149 |
| I-07 | P2 | fixed | bg-[#050608]/60 on Sidebar aside — unregistered value, use --aurora-obsidian or --aurora-surface-0 | Sidebar.tsx:52 |
| I-08 | P3 | fixed | Playlist color dot fallbacks use "#5eead4" and "#a78bfa" literals — SongRow fixed; QueryBuilder:217 deferred (hex alpha template literal pattern incompatible with CSS vars) | SongRow.tsx:192, QueryBuilder.tsx:217 |
| I-09 | P3 | fixed | rgba(255,255,255,0.02) and rgba(255,255,255,0.015) as surface backgrounds — defined --aurora-surface-inset, applied to ScanDialog + TagEditor | ScanDialog.tsx:141, TagEditor.tsx:128 |
| I-10 | P3 | open | heroTileGradient uses opaque rgba colors approximating --aurora-surface-1/2 but with blue tint offset — needs --aurora-surface-1/2 token design decision | PlaylistDetail.tsx:88-89 |
| I-11 | P3 | fixed | rgba(255,255,255,0.06) in boxShadow strings — replaced with var(--aurora-rim) in PlayerBar + PlaylistDetail | PlaylistDetail.tsx:274, PlayerBar.tsx:69,184 |
| I-12 | P3 | fixed | No --font-mono token. Defined in :root, applied to QueryInput.tsx inline style | QueryInput.tsx:67, ScanDialog.tsx:189 |
| I-13 | P3 | open | One-off font sizes with single use: text-[9.5px], text-[10.5px], text-[12.5px], text-[17px] — break informal type scale | ScanDialog.tsx, PlayerBar.tsx, Sidebar.tsx, QueryBuilder.tsx |

---

## Workflow Practices

| Item | Current State | Last Updated | Verdict |
|------|---------------|--------------|---------|
| graphify GRAPH_REPORT.md | 460 nodes, 709 edges, 43 communities | 2026-04-28 | STALE (25 days, 3 source commits since) |
| JOURNAL.md | Session 16 entry present | 2026-05-23 | CURRENT |
| CONTEXT.md Next-session prep | Reflects Session 16 state | 2026-05-23 | ACCURATE |
| HANDOFF.md | Last entry: Session 15a | 2026-04-23 | STALE (30 days) |
| features.json | f001+f006 pending, f002-f005+f007 done | 2026-05-23 | ACCURATE |

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| WF-001 | P2 | fixed | GRAPH_REPORT.md refreshed 2026-05-23 via `graphify update .` — 390 nodes, 563 edges, 60 communities |
| WF-002 | P2 | fixed | HANDOFF.md last entry is Session 15a (April 23). Session 16 completed but handoff never updated. Breaks continuity. |
| WF-003 | P3 | fixed | Branch claude/pensive-bouman-c15aea deleted 2026-05-23 (Session 18) |

---

## P1 Summary

All open P1 issues — fix these first.

| ID | Domain | Description | Files | Fix |
|----|--------|-------------|-------|-----|
| G-2 | Glow/Bleed | Lightness floor missing: hues with l≤45 invisible on OLED black | albumGradient.ts | Add `const glowL = Math.max(a.l, 60)` before glow hsla construction |
| I-01 | Visual Consistency | #050608 hardcoded on primary Button — propagates app-wide | button.tsx:21 | Replace with text-[var(--aurora-slate)] (define token if not in index.css) |
