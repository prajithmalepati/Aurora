# AURORA.md — Build Handoff & Operating Manual

> Drop this in the Aurora repo root. Claude Code (Opus, plan mode) should read this first, then proceed.
> This file is the source of truth for **how we work**, not just what to build. Keep it under ~2.5k tokens of actual instruction (Boris Cherny's rule); move long reference material into linked files.

---

## 0. Read order for the agent

1. Read this file fully.
2. Read `DESIGN.md` (the anti-slop design system) before touching any UI.
3. Read the latest file in `sessions/` to see where we left off.
4. Enter **plan mode**. Do not write code until the plan is approved.

---

## 1. What Aurora is

A cross-playlist music player. The core idea: traditional playlists silo songs into one context; Aurora lets you tag songs with unlimited custom tags (slow, fast, hype, emotional, gym, etc.) and query them with **boolean logic** (AND/OR/NOT) across the entire library.

**Stack**
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui + Zustand + Howler.js
- Backend: FastAPI + SQLite
- Boolean filtering: `boolean.py` library
- Audio: Howler in `html5: true` mode (large-file streaming)

**Hard-won technical facts (do not relearn these):**
- `playSong()` requires the song list as a **second argument**.
- View switching uses `useState` in `App.tsx` — **no React Router**.
- Audio sliders are **plain HTML range inputs**, not a component lib.
- Album art has an error state that **must reset on song change** (past bug).
- Only **one Howler instance** allowed — rapid song clicks previously spawned multiples (past bug).
- Double audio playback was caused by **two conflicting React effects** (past bug).

**Aesthetic:** "Northern Lights over OLED black." OLED blacks dominate; aurora-family accent colors are rare and atmospheric. Full system lives in `DESIGN.md`. Design references: Feishin, Nora, Tauon Music Box — Aurora is the refined middle ground.

---

## 2. Model routing (who does what)

We run a tiered setup. **Match the model to the task; don't burn the expensive one on cheap work.**

| Task | Model | Why |
|---|---|---|
| Architecture, plan-mode planning, hard debugging, design critique, finishing passes | **Opus 4.7** (Claude Pro) | Best reasoning; worth the cost on decisions |
| Bulk implementation, refactors, test-writing, codebase exploration | **GLM-5.1** (GLM Coding Plan, base-url swap) | Near-frontier coding, flat-rate, no meter anxiety |
| Big-context whole-repo reads, screenshot/vision diffing against DESIGN.md | **Gemini 3.1 Pro** | 2M context + vision |
| Optional experiment / second opinion | DeepSeek V4-Pro ($5 trial), via PAL MCP for consensus | Taste-test only; not the backbone |

**Note:** "DeepSeek V5" does not exist — current flagship is V4-Pro. GLM Coding Plan Lite is **$18/mo, or ~$14/mo billed annually** (verify current price at z.ai before subscribing — it has changed before).

**Rule:** Opus *plans*, GLM/Sonnet *execute*. But if a task is genuinely gnarly, run Opus end-to-end (this is what Boris Cherny does — he uses Opus with thinking for *all* coding and finds it ultimately faster because of fewer retries).

---

## 3. Skills to install (the floor)

These trigger automatically once installed. Install at user level so they're available across all projects.

**Discipline (most important):**
- **Superpowers** (`obra/superpowers`) — enforces brainstorm → plan → implement, red/green TDD (watch the test fail first), self-updating memory, and subagent code review. This is the layer that turns the agent from a code generator into a disciplined engineer.
  - `/plugin marketplace add obra/superpowers-marketplace`
  - `/plugin install superpowers@superpowers-marketplace` → restart

**Frontend / anti-slop:**
- **Anthropic `frontend-design`** (official) — bans generic defaults, forces aesthetic commitment.
  - `/plugin marketplace add anthropics/claude-code` → `/plugin install frontend-design`
- **impeccable** (`pbakaus/impeccable`) — design auditing + polishing. Use `/impeccable critique` and `/impeccable audit` against Aurora pages. Commands: typeset, animate, colorize, polish, audit, critique.
  - `npx skills add pbakaus/impeccable`
- **Do NOT also install** ui-ux-pro-max or other taste skills alongside impeccable — they give conflicting design opinions.

**Live docs (stops stale-API code):**
- **Context7 MCP** — injects current React 19 / Tailwind 4 / shadcn docs.
  - `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest`
- **shadcn MCP** — reads the live shadcn registry for correct prop signatures.
  - `claude mcp add shadcn -- npx shadcn@latest mcp`

**Codebase recall (sleeper pick):**
- **graphify** (`safishamsi/graphify`) — turns the Aurora codebase into a queryable knowledge graph so the agent navigates structurally instead of re-reading files. Reach for it when the agent keeps re-reading the same files.

**Motion (when working on animations):**
- **Emil Kowalski's `animate-skill`** (`delphi-ai/animate-skill`) — highest-quality single motion skill; auto-triggers on animation/transition/hover/modal prompts.

**Utility (optional):**
- **caveman** (`/caveman`) — terse output to save tokens on GLM/DeepSeek runs. Leaves code and reasoning intact.

---

## 4. Workflow practices (how Boris, Jesse, Andrej actually work)

### The core loop (Boris Cherny — creator of Claude Code)
1. **Plan mode for everything non-trivial.** Plan mode is how you build a great prompt — it pulls all needed context into one session. Go back and forth on the plan until it's *right*, THEN switch to auto-accept and let it execute.
2. **Verification is the multiplier.** "Give Claude a way to verify its work and it will 2-3x the quality." For Aurora: after any UI change, verify in the browser (Chrome extension or a `verify-app` subagent) — don't just eyeball it. **Never consider a change done until it's been verified running.**
3. **CLAUDE.md / this file is a mistake-log.** Every time the agent does something wrong, add ONE line here so it doesn't repeat. Prune ruthlessly to stay under ~2.5k tokens.
4. **Slash commands for daily inner-loop actions.** Make a `/commit-push-pr` and similar; check them into `.claude/commands/`. Ask Claude Code to create them.
5. **Parallelism over complexity.** Run 2+ sessions in separate git checkouts/worktrees for independent tasks (e.g. UI experiment in one, audio-engine refactor in another). Keep each session simple; don't overload one.

### The discipline (Jesse Vincent — Superpowers)
- **Plan before you build. Always.** The gap between shipping code and slop is discipline, not model intelligence.
- **Red/green TDD:** write the test, watch it fail, then make it pass. Especially for the boolean filter engine and audio state logic.
- **Subagent self-review** before declaring done.

### "Diagnose before patching" (our own established rule)
When a bug appears, **do not patch immediately.** First: state 3 hypotheses for the cause, ranked by likelihood, with the evidence for each. Then propose one experiment to discriminate between them. Only then fix. (This is how Karpathy debugs neural nets; it works for React state bugs too.)

### Documentation discipline (Andrej Karpathy — the wiki habit)
- Document everything as you go. Code-with-explanation beats abstract lectures.
- When explaining code to the human, go **line-by-line with specific line numbers** — that's how he learns best. e.g. "src/AudioEngine.ts lines 23-67: this method owns X state, lives here because Y."
- End every session by appending a handoff note to `sessions/` (see §6).

---

## 5. Communication style (the human's preferences)

- Direct and casual. Concise, actionable. No filler.
- **Make design decisions — don't ask open-ended questions.** Instead of "what font should we use?", pick one, commit, and give a one-sentence reason. The human will reject if needed.
- Show the **diff first** on anything non-trivial; the human verifies, you apply.
- The human is learning AI while building — when relevant, briefly explain the *why* behind a choice, with specific line references.

---

## 6. Session handoff (do this at the end of every session)

Append a file to `sessions/` named `YYYY-MM-DD-topic.md` with:

```markdown
## Session: <topic> — <date>
- **What we did:**
- **What works (verified how):**
- **What's broken / blocked:**
- **Open questions:**
- **Decisions made:**
- **Next session starts with:**
```

---

## 7. Queued features (future sessions)

- Per-playlist song start/end times
- Built-in equalizer via Web Audio API
- Crossfade
- Lyrics display

---

## 8. Mistake log (append one line each time the agent errs)

- (none yet — add as they happen)
