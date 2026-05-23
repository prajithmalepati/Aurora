# Aurora Holistic Audit — Phase 1: Run Audit + Write HEALTH.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dispatch 4 parallel audit agents across glow/bleed, animations, visual consistency, and workflow domains; synthesize findings into `docs/HEALTH.md`; resolve the pending worktree; prepare for Phase 2 P1 fix plan.

**Architecture:** Four Sonnet/Haiku subagents read-only audit their respective domains and return structured reports. Main context (Opus) synthesizes all four into a scored health document. Worktree `claude/pensive-bouman-c15aea` is assessed during the glow audit and merged or superseded based on findings.

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind 4 + FastAPI + SQLite. CSS tokens in `frontend/src/index.css`. Components in `frontend/src/components/`. Claude `Agent` tool for subagent dispatch.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `docs/HEALTH.md` | **Create** | Living health document — 4 domain sections, P1/P2/P3 issues |
| `frontend/src/components/songs/AlbumArt.tsx` | Read (Agent 1) | Glow render logic |
| `frontend/src/components/layout/PlayerBar.tsx` | Read (Agents 1+2) | Glow surface + animation timing |
| `frontend/src/components/layout/AppShell.tsx` | Read (Agent 2) | Layout animation |
| `frontend/src/components/layout/Sidebar.tsx` | Read (Agent 2) | Sidebar transitions |
| `frontend/src/components/filter/QueryBuilder.tsx` | Read (Agent 2) | Result animation |
| `frontend/src/components/songs/SongRow.tsx` | Read (Agents 2+3) | Row hover + token compliance |
| `frontend/src/components/playlists/PlaylistDetail.tsx` | Read (Agent 1) | Hero glow surface |
| `frontend/src/index.css` | Read (Agents 1+2+3) | Tokens, keyframes, transitions |
| `graphify-out/GRAPH_REPORT.md` | Read (Agent 4) | Freshness check |
| `D:/AI/projects2/claude-workspace/Aurora/JOURNAL.md` | Read (Agent 4) | Recency check |
| `D:/AI/projects2/claude-workspace/Aurora/CONTEXT.md` | Read (Agent 4) | Accuracy check |
| `D:/AI/projects2/Aurora/HANDOFF.md` | Read (Agent 4) | Currency check |
| `D:/AI/projects2/Aurora/features.json` | Read (Agent 4) | Pending status check |

---

## Task 1: Dispatch 4 Parallel Audit Agents

**Files:** Read-only. No edits in this task.

- [ ] **Step 1: Send a single message with all 4 Agent tool calls in parallel**

  Dispatch all four simultaneously. Do NOT send them sequentially — they must run in parallel.

  **Agent 1 — Glow/Bleed (model: sonnet)**

  ```
  You are auditing the Aurora music app's album art glow inconsistency.
  Aurora is a personal music library app (React + Vite + TypeScript + Tailwind).
  Working directory: D:/AI/projects2/Aurora

  ISSUE: Some album art shows a visible glow/bleed in the PlayerBar, others don't.
  Dark album art (near-black colors, e.g. Bad Omens) produces imperceptible glow
  on OLED black background. Bright/saturated art (e.g. Akaza, AC/DC) shows glow fine.

  YOUR TASK IS READ ONLY. Do not modify any files.

  Read these files:
  1. frontend/src/components/songs/AlbumArt.tsx
  2. frontend/src/components/layout/PlayerBar.tsx
  3. frontend/src/components/playlists/PlaylistDetail.tsx
  4. frontend/src/index.css — search for: --aurora-*-glow, albumGradient, box-shadow

  Run this command (read-only):
    git diff aesthetic-quick-wins claude/pensive-bouman-c15aea -- "*.tsx" "*.css"
  This shows a pending in-progress bleed fix. Assess whether it solves the root cause.

  After reading, report:

  ## Glow/Bleed Audit Report

  ### Root Cause
  [Why does dark art produce invisible glow? Trace the data flow from album_art_path
   through albumGradient computation to the final box-shadow or filter CSS.]

  ### Surfaces Affected
  | Surface | File:Line | Current Behavior | Verdict (ok/broken/partial) |
  |---------|-----------|------------------|-----------------------------|

  ### Worktree Assessment
  Does the pensive-bouman diff fix the root cause? Answer: yes / partial / no + why.

  ### Proposed Fix
  Concrete approach (pick one and justify):
  - Option A: Minimum lightness floor on computed glow color (boost HSL lightness if < threshold)
  - Option B: Fallback to --aurora-primary-glow when computed color luminance < 0.05
  - Option C: Something else you discovered in the code
  Include a code sketch showing the change.

  ### Issues List
  | ID | Severity (P1/P2/P3) | Description | Files |
  |----|---------------------|-------------|-------|
  ```

  **Agent 2 — Animations (model: sonnet)**

  ```
  You are auditing the Aurora music app's animation and transition timing.
  Aurora is React + Vite + TypeScript + Tailwind 4. Dark-mode only.
  Working directory: D:/AI/projects2/Aurora

  YOUR TASK IS READ ONLY. Do not modify any files.

  Read these files:
  1. frontend/src/index.css — find ALL: transition:, animation:, @keyframes, duration values
  2. frontend/src/components/layout/PlayerBar.tsx
  3. frontend/src/components/layout/AppShell.tsx
  4. frontend/src/components/layout/Sidebar.tsx
  5. frontend/src/components/filter/QueryBuilder.tsx
  6. frontend/src/components/songs/SongRow.tsx

  Rule: interactive feedback (hover, click visual response) should complete in ≤200ms.
  Panel/view transitions can be up to 300ms. Anything longer feels sluggish.

  After reading, report:

  ## Animation Audit Report

  ### Transitions Catalog
  | Element or Class | Duration | Easing | Verdict (ok/slow/inconsistent) |
  |------------------|----------|--------|-------------------------------|

  ### Keyframes Catalog
  | Name | Duration | Usage | Verdict |
  |------|----------|-------|---------|

  ### Dominant Easing
  What is the most common easing in the codebase? List deviations.

  ### Proposed Motion Token Set
  ```css
  /* Paste proposed token additions to :root in index.css */
  --duration-instant: Xms;   /* snap, no animation */
  --duration-fast: Xms;      /* hover, chip, icon micro-interactions */
  --duration-normal: Xms;    /* panel open/close, dialog */
  --duration-slow: Xms;      /* page-level, large area transitions */
  --ease-ui: cubic-bezier(...);     /* standard UI movement */
  --ease-expressive: cubic-bezier(...); /* elastic, accent moments */
  ```
  For each existing duration that deviates, note what it should become.

  ### Issues List
  | ID | Severity (P1/P2/P3) | Description | Files |
  |----|---------------------|-------------|-------|
  ```

  **Agent 3 — Visual Consistency (model: sonnet)**

  ```
  You are auditing the Aurora music app for design token compliance and visual consistency.
  Aurora uses a custom CSS token system (--aurora-* variables) defined in frontend/src/index.css.
  All color values in components MUST use these tokens. Raw hex, raw rgba(), or inline
  style objects with color values are violations.
  Working directory: D:/AI/projects2/Aurora

  YOUR TASK IS READ ONLY. Do not modify any files.

  Steps:
  1. Read frontend/src/index.css :root block — understand all defined --aurora-* tokens
  2. Search frontend/src/components/**/*.tsx for:
     - Raw hex colors: pattern #[0-9a-fA-F]{3,6} (excluding className strings and comments)
     - Raw rgba() calls in JSX props
     - style={{ ... }} objects containing color, background, borderColor, boxShadow
  3. Read flagged files to understand context (is the raw value intentional or a missed token?)
  4. Check for spacing inconsistencies: Tailwind spacing classes mixed with arbitrary px values
     in the same component in a way that breaks visual rhythm
  5. Check font sizes: look for hardcoded text-[Xpx] values that deviate from the established
     type scale (Fraunces for display, Geist for body, SF Mono for mono)

  After reading, report:

  ## Visual Consistency Audit Report

  ### Token Violations
  | File:Line | Offending Value | Should Use Token | Severity |
  |-----------|-----------------|------------------|----------|

  ### Inline Style Violations
  | File:Line | Inline Style | Notes |
  |-----------|--------------|-------|

  ### Spacing/Typography Drift
  [List any components with inconsistent spacing or font size patterns]

  ### Summary
  Total violations: X token, Y inline style, Z spacing/type
  Most common violation pattern: [describe]

  ### Issues List
  | ID | Severity (P1/P2/P3) | Description | Files |
  |----|---------------------|-------------|-------|
  ```

  **Agent 4 — Workflow Practices (model: haiku)**

  ```
  You are auditing workflow practices for the Aurora music app project.
  Working directory: D:/AI/projects2/Aurora
  Today's date: 2026-05-23

  YOUR TASK IS READ ONLY. Do not modify any files.

  Check these 5 items:

  1. GRAPHIFY FRESHNESS
     - Read graphify-out/GRAPH_REPORT.md — look for a date in the content or header
     - Run: git log --oneline -3 -- frontend/src/ backend/app/
     - Compare: is GRAPH_REPORT.md older than the most recent source commit?

  2. JOURNAL RECENCY
     - Read first 40 lines of D:/AI/projects2/claude-workspace/Aurora/JOURNAL.md
     - Is there an entry dated 2026-05-23 or referencing Session 16/17?

  3. CONTEXT.MD ACCURACY
     - Read D:/AI/projects2/claude-workspace/Aurora/CONTEXT.md sections:
       "Next session prep" and "What to do first next session"
     - We are now in Session 17, running the holistic audit (aesthetic-quick-wins branch).
     - Is the "What to do first" still accurate, or does it need updating?

  4. HANDOFF.MD CURRENCY
     - Read first 20 lines of D:/AI/projects2/Aurora/HANDOFF.md
     - What session does it reflect? Expected: Session 15a or 16.

  5. FEATURES.JSON
     - Read D:/AI/projects2/Aurora/features.json
     - Are f001 (filter case-sensitivity) and f006 (CORS lockdown) still the only pending items?
     - Are all done items correctly marked done?

  Report:

  ## Workflow Practices Audit Report

  | Item | Current State | Last Updated | Verdict |
  |------|---------------|--------------|---------|
  | graphify GRAPH_REPORT.md | | | current / stale |
  | JOURNAL.md | | | current / stale |
  | CONTEXT.md Next-session prep | | | accurate / needs-update |
  | HANDOFF.md | | | current / stale |
  | features.json | | | accurate / needs-update |

  ### Recommended Immediate Updates
  For each stale/inaccurate item: what specifically needs to change.

  ### Issues List
  | ID | Severity (P1/P2/P3) | Description |
  |----|---------------------|-------------|
  ```

- [ ] **Step 2: Wait for all 4 agents to complete before proceeding**

  All four must finish before Task 2 begins.

---

## Task 2: Synthesize Reports + Write HEALTH.md

**Files:**
- Create: `docs/HEALTH.md`

- [ ] **Step 1: Read all 4 agent reports and extract their Issues Lists**

  Collect every issue row from all four `### Issues List` sections.

- [ ] **Step 2: Score and deduplicate**

  - Merge any duplicate issues (same root cause, different agent found it)
  - Confirm severity: P1 = user-visible bug or broken interaction, P2 = quality drift, P3 = polish/debt
  - Assign global IDs: G1, G2... (glow), A1, A2... (animation), V1, V2... (visual), W1, W2... (workflow)

- [ ] **Step 3: Write docs/HEALTH.md**

  ```markdown
  # Aurora Health Document

  Living audit of visual and workflow health. Updated as fixes land.
  Last full audit: 2026-05-23 (Session 17)

  **Severity:** P1 = fix this session | P2 = fix next 1-2 sessions | P3 = fix when passing through

  **Status:** `open` | `in-progress` | `fixed` | `deferred`

  ---

  ## Glow / Bleed

  [Root cause summary from Agent 1 report — 2-3 sentences]

  | ID | Severity | Status | Description | Files |
  |----|----------|--------|-------------|-------|
  [rows from Agent 1 Issues List]

  ---

  ## Animation & Timing

  [Summary of dominant easing, worst offenders — 2 sentences]

  **Proposed motion tokens:** [paste Agent 2's token set]

  | ID | Severity | Status | Description | Files |
  |----|----------|--------|-------------|-------|
  [rows from Agent 2 Issues List]

  ---

  ## Visual Consistency

  [Summary: total violations, most common pattern — 2 sentences]

  | ID | Severity | Status | Description | Files |
  |----|----------|--------|-------------|-------|
  [rows from Agent 3 Issues List]

  ---

  ## Workflow Practices

  | Item | Status | Last Updated | Verdict |
  |------|--------|--------------|---------|
  [rows from Agent 4 report table]

  | ID | Severity | Status | Description |
  |----|----------|--------|-------------|
  [rows from Agent 4 Issues List]

  ---

  ## P1 Summary

  All open P1 issues across domains — the fix list for Phase 2.

  | ID | Domain | Description | Files |
  |----|--------|-------------|-------|
  [all P1 rows]
  ```

- [ ] **Step 4: Verify HEALTH.md has all required sections**

  Check: 4 domain sections present, each has an issues table, P1 Summary populated, no empty rows or "TBD" values.

---

## Task 3: Commit HEALTH.md

**Files:**
- Commit: `docs/HEALTH.md`

- [ ] **Step 1: Stage and commit**

  ```bash
  git add docs/HEALTH.md
  git commit -m "docs(health): add Aurora health document — Session 17 full audit"
  ```

---

## Task 4: Resolve Worktree (pensive-bouman-c15aea)

**Files:** Depends on Agent 1 worktree assessment.

- [ ] **Step 1: Read Agent 1's Worktree Assessment section**

- [ ] **Step 2a: If verdict is "yes — worktree fixes root cause"**

  ```bash
  git checkout aesthetic-quick-wins
  git merge claude/pensive-bouman-c15aea
  git worktree remove "D:/AI/projects2/Aurora/.claude/worktrees/pensive-bouman-c15aea"
  ```

  Verify: playlist covers visible (they appeared blank in worktree — confirm they're fine in main branch).

- [ ] **Step 2b: If verdict is "partial" or "no"**

  Do not merge. Update the relevant glow issue row in `docs/HEALTH.md` — set status to `in-progress` and add note: "worktree pensive-bouman reviewed, does not fully resolve — see Phase 2 plan". Commit:

  ```bash
  git add docs/HEALTH.md
  git commit -m "docs(health): note worktree pensive-bouman partial — glow fix deferred to Phase 2"
  ```

  Remove worktree only after Phase 2 fix is implemented:

  ```bash
  git worktree remove "D:/AI/projects2/Aurora/.claude/worktrees/pensive-bouman-c15aea"
  ```

---

## Task 5: Update Workflow Docs + Trigger Phase 2

**Files:**
- Update: `D:/AI/projects2/claude-workspace/Aurora/CONTEXT.md`
- Update: `D:/AI/projects2/Aurora/HANDOFF.md` (append Session 17 block)

- [ ] **Step 1: Apply Agent 4's recommended workflow updates**

  For each item Agent 4 flagged as stale/inaccurate: make the update now.
  - If CONTEXT.md "Next session prep" is stale: update it to reflect current state (Phase 2 P1 fixes pending).
  - If JOURNAL.md has no Session 17 entry: append one now covering the audit run.
  - If graphify is stale: run `graphify update .` from the Aurora directory.

- [ ] **Step 2: Append Session 17 block to HANDOFF.md**

  Add at the top of the "Completed This Session" section:

  ```markdown
  ## Completed This Session (2026-05-23 — Session 17)

  ### Holistic Audit — Phase 1

  Dispatched 4 parallel audit agents (Glow/Bleed, Animations, Visual Consistency, Workflow).
  Synthesized findings into `docs/HEALTH.md`. [N] issues found: [X] P1, [Y] P2, [Z] P3.
  Worktree pensive-bouman: [merged / superseded — one line outcome].
  Phase 2 implementation plan pending.
  ```

- [ ] **Step 3: Commit workflow doc updates**

  ```bash
  # In claude-workspace repo (D:/AI/projects2/claude-workspace)
  cd "D:/AI/projects2/claude-workspace"
  git add Aurora/JOURNAL.md Aurora/CONTEXT.md
  git commit -m "chore(aurora): Session 17 audit — update JOURNAL + CONTEXT"

  # Back in Aurora repo
  cd "D:/AI/projects2/Aurora"
  git add HANDOFF.md
  git commit -m "docs(handoff): Session 17 — holistic audit Phase 1 complete"
  ```

- [ ] **Step 4: Invoke writing-plans for Phase 2 (P1 fixes)**

  Use the `Skill` tool with `skill: "superpowers:writing-plans"`. Brief it with:
  - The P1 Summary table from `docs/HEALTH.md`
  - The proposed fix from Agent 1's Glow/Bleed report
  - The motion token set from Agent 2's Animation report
  - The token violations list from Agent 3's report
  - Any workflow P1s from Agent 4

  Phase 2 plan saves to: `docs/superpowers/plans/2026-05-23-holistic-audit-phase2-p1-fixes.md`
