# Aurora Holistic Audit — Design Spec

**Date:** 2026-05-23  
**Status:** Approved  
**Branch:** aesthetic-quick-wins  

---

## Goal

Produce a living `docs/HEALTH.md` that tracks visual and workflow health across Aurora. Run a comprehensive audit across four domains using parallel agents, score all findings P1/P2/P3, fix P1s immediately via an implementation plan, defer P2/P3 to future sessions.

---

## Audit Domains

### 1. Glow / Bleed (Sonnet)

**Scope:** AlbumArt glow rendering inconsistency. Dark album art (e.g. Bad Omens) produces imperceptible glow on OLED black background because the computed `albumGradient.glow` color is too dark. All surfaces where `AlbumArt` renders must be audited.

**Files to read:**
- `frontend/src/components/songs/AlbumArt.tsx`
- `frontend/src/components/layout/PlayerBar.tsx`
- `frontend/src/components/playlists/PlaylistDetail.tsx`
- `frontend/src/index.css` — glow token section (`--aurora-*-glow`, `--aurora-accent-interactive`)
- Worktree diff: `git diff aesthetic-quick-wins claude/pensive-bouman-c15aea -- "*.tsx" "*.css"`

**Agent task:** Identify root cause of dark-art glow invisibility. Enumerate every surface where glow/bleed renders. Document inconsistencies. Propose fix (minimum perceptible glow floor, or fallback to `--aurora-primary-glow` when computed color is below a lightness threshold). Do not implement — report only.

---

### 2. Animation & Timing (Sonnet)

**Scope:** All CSS transitions, `@keyframes`, and hover state response times across the app. Flag anything over 250ms for interactive feedback (hover, click response). Identify inconsistent easing functions.

**Files to read:**
- `frontend/src/index.css` — all `@keyframes`, `.transition-*`, `transition:` rules
- `frontend/src/components/layout/PlayerBar.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/filter/QueryBuilder.tsx`
- `frontend/src/components/songs/SongRow.tsx`

**Agent task:** Catalog every transition duration and easing in use. Build a table: element → current duration → easing → verdict (ok / too-slow / inconsistent). Identify the dominant easing in the codebase and flag deviations. Propose a motion token set (3–4 durations, 2 easings max). Do not implement — report only.

---

### 3. Visual Consistency (Sonnet)

**Scope:** Aurora design token compliance across all components. Find raw hex values, ad-hoc `rgba()` calls not matching any defined token, inconsistent spacing (mixed `px`/`rem`/Tailwind), typography drift (font sizes outside the scale).

**Files to read:**
- All files in `frontend/src/components/` — grep for raw hex (`#[0-9a-fA-F]{3,6}`), `rgba(`, `style={{`
- `frontend/src/index.css` — full token table (`:root` block)
- `frontend/src/types/index.ts`

**Agent task:** List every token violation found (file + line + offending value). Note which token it *should* be using. Flag any components that mix Tailwind spacing with custom `px` values in a way that creates visual rhythm breaks. Do not fix — report only.

---

### 4. Workflow Practices (Haiku)

**Scope:** Are the project's meta-process tools being kept current?

**Items to check:**
- `graphify-out/GRAPH_REPORT.md` — last modified date. Compare to output of `git log --oneline -3 -- frontend/src/ backend/app/` (source-only changes, excludes docs/meta). If graph predates any of these commits, flag as stale.
- `D:/AI/projects2/claude-workspace/Aurora/JOURNAL.md` — last entry date. Should have an entry from Session 16 (2026-05-23 or nearby).
- `D:/AI/projects2/claude-workspace/Aurora/CONTEXT.md` — "Next session prep" section. Is it current with today's session?
- `D:/AI/projects2/Aurora/HANDOFF.md` — last session block. Does it match what actually happened recently?
- `D:/AI/projects2/Aurora/features.json` — are `f001` and `f006` still the only pending items? Any completed items mis-marked?

**Agent task:** For each item, report: current state, last-updated date, verdict (current / stale / missing). Recommend any immediate updates needed. Do not edit files — report only.

---

## Output: docs/HEALTH.md

Living document committed to the Aurora repo at `docs/HEALTH.md`.

**Structure per domain:**

```markdown
## Domain Name

| ID | Severity | Status | Description | Files |
|----|----------|--------|-------------|-------|
| G1 | P1 | open | Dark art glow imperceptible on OLED | AlbumArt.tsx, PlayerBar.tsx |
```

**Severity definitions:**
- `P1` — Visible user-facing bug or broken interaction. Fix this session.
- `P2` — Inconsistency or drift that degrades quality over time. Fix next 1–2 sessions.
- `P3` — Minor polish or technical debt. Fix when passing through the file.

**Status values:** `open` / `in-progress` / `fixed` / `deferred`

**Living doc rules:**
- Add new issues as discovered (don't wait for a full audit pass).
- Update status when a fix lands — same commit as the fix.
- Review the P1 column at every session start.
- Full re-audit when a major UI pass completes.

---

## Implementation Plan Shape

After health doc is written and user approves:

1. Invoke `writing-plans` skill.
2. Plan covers **P1 issues only** from all four domains.
3. Known P1 candidates going in (may grow from agent findings):
   - Glow: minimum-perceptible glow floor for dark album art
   - Animations: normalize sluggish transitions to motion token set
4. P2/P3 items stay in `docs/HEALTH.md`, fixed opportunistically.

---

## Execution Notes

- Agents dispatched via `Agent` tool with `subagent_type: claude`.
- Agents 1–3: `model: sonnet`. Agent 4: `model: haiku`.
- All 4 dispatched in parallel in a single message.
- Each agent brief is self-contained (agents start cold).
- Synthesis happens in main context (Opus) after all 4 complete.
- Worktree `claude/pensive-bouman-c15aea` must be checked by Agent 1 — it may contain the in-progress glow fix. Do not merge until audit confirms it solves the root cause.
