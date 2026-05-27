# Session 29 — Kickoff Prompts

All prompts assume the user has run `/clear` and is starting fresh. Each prompt is self-contained — paste verbatim.

---

## A. Claude Code (Opus + plan mode) — main session kickoff

```
read C:\Users\rockz\.claude\plans\all-done-here-s-sparkling-crescent.md (now moved to AuditQA folder. check these files the sparkingcrecscent here is edited a little by me , user) — that's the approved plan from session 28. before touching code:

1. read docs/design/new2.md (user's live-test bug report)
2. read .kilo/plans/1779820994868-session27-audit.md (deepseek v4 audit)
3. read docs/design/crsrop4.7.md (cursor opus 4.7 audit)
4. read HANDOFF.md (session 28 state)
5. read C:\Users\rockz\.claude\projects\D--AI-projects2-Aurora\memory\MEMORY.md (auto-memory index, follow refs)

then before phase 1 starts:
- install agent-browser MCP per plan's tooling section (try minhlucvan/agent-browser-mcp first)
- run hyperframes quickstart, produce 5s aurora test loop, write verdict to docs/design/hyperframes-eval.md

once tooling integration is done, exit plan mode and execute phase 1 (A1 audio bug fix) — that's the highest-impact change. one commit per fix, type(scope): description format. headphones-on human verification before phase 2.

do NOT mark f009 done in features.json until all 6 verification checklist items in the plan pass.
```

---

## B. DeepSeek V4 (via Kilo Code) — audit prompt

Write the brief to `.kilo/plans/session29-audit-brief.md` and have user paste into Kilo Code chat:

```
You are reviewing Aurora's session 29 changes — a followup fix pass for the f008 visual overhaul. Read in order:

1. C:\Users\rockz\.claude\plans\all-done-here-s-sparkling-crescent.md (the plan)
2. git log --oneline a1b075d..HEAD (the commits implementing the plan)
3. git diff a1b075d..HEAD -- frontend/src/hooks/useAudioAnalyser.ts (highest-risk file)
4. git diff a1b075d..HEAD -- frontend/src/stores/playerStore.ts frontend/src/components/aurora/AuroraColorBridge.tsx frontend/src/App.tsx (re-render isolation)
5. git diff a1b075d..HEAD -- frontend/src/components/player/WaveformBar.tsx (B2 rewrite)
6. git diff a1b075d..HEAD -- frontend/src/components/ui/AuroraPlayButton.tsx (new file)

Specifically audit:
- Does the analyser rebuild correctly recover from ctx.state === 'suspended' without losing audio?
- Does the GainNode passthrough actually persist source→destination across analyser teardown?
- Is the playerStore color slice subscribed only by AuroraCanvas+PlayerBar (verify selectors)?
- Are the 4 play-button surfaces using AuroraPlayButton with no remaining inline duplicates?
- Any CLAUDE.md violations (inline styles, relative imports, raw fetch, React Context)?

Output: HIGH / MEDIUM / LOW / NIT findings, file:line citations, suggested fix. Same format as your session 27 audit at .kilo/plans/1779820994868-session27-audit.md.
```

---

## C. GPT 5.5 (Cursor) — design-restraint review

Write to `docs/design/session29-gpt55-review.md` and have user paste:

```
You're reviewing Aurora's new shared play-button component and the sort-everywhere UI from session 29. Files:

- frontend/src/components/ui/AuroraPlayButton.tsx (new, three variants: glass-bloom, row-hover, inline)
- frontend/src/components/songs/SongRow.tsx (consumes row-hover)
- frontend/src/components/playlists/PlaylistDetail.tsx (consumes inline + has new sort dropdown)
- frontend/src/components/layout/PlayerBar.tsx (consumes glass-bloom)
- frontend/src/hooks/useSongSort.ts (new — extracted sort logic)

Read these for context:
- PRODUCT.md (anti-slop rules, per-song atmosphere principle)
- docs/design/2026-05-25-aurora-ux-critique.md (the design-restraint critique that drove f008)

Your job: design-restraint review.
- Does the unified play button preserve PlayerBar's "premium" feel while staying simple enough for hover-only contexts?
- Is the variant API the right shape, or should the three buttons just be three components with shared base styles?
- Sort dropdown on PlaylistDetail — does it clutter the page or feel native?
- Any cross-surface inconsistency still present?
- Anti-slop check: any new "demo-y" affordances introduced?

Output: short prose review, then a numbered fold/skip list of concrete suggestions. Be brutal on visual restraint.
```

---

## D. Opus 4.7 (Cursor) — code-quality review

Write to `docs/design/session29-opus47-review.md` and have user paste:

```
You're code-reviewing the two highest-risk changes in Aurora's session 29 fix pass.

File 1: frontend/src/hooks/useAudioAnalyser.ts (rewrite to fix audio silence bug)
- Root cause being fixed: ctx.state === 'suspended' early-return without re-run scheduling + analyser rebuild on every pause/play disconnecting source from destination
- Approach: drop isPlaying from deps, ctx.onstatechange listener, GainNode passthrough that's never disconnected

File 2: frontend/src/stores/playerStore.ts + frontend/src/components/aurora/AuroraColorBridge.tsx + frontend/src/App.tsx (B1 isolation)
- Problem being fixed: useAuroraColor() in App.tsx caused full App re-render on every song change
- Approach: extend playerStore with auroraColor1/auroraColor2, AuroraColorBridge writes via store action, App no longer subscribes

Read for context:
- CLAUDE.md (Aurora's strict rules — two-effect Howl architecture, Zustand only, @/ imports only)
- C:\Users\rockz\.claude\projects\D--AI-projects2-Aurora\memory\project_aurora_workflow.md (recurrence pipeline)
- The diffs from git diff a1b075d..HEAD on the files listed above

Your job:
- Verify two-effect architecture in useAudioPlayer.ts NOT broken by analyser changes
- Verify the GainNode passthrough survives every code path including unload/destroy
- Verify store extension doesn't introduce cross-store circular deps
- Verify no React Context, no raw fetch, no relative imports, no inline styles added
- Find any subtle React/closure/cleanup bugs (stale refs, missing deps, leaked listeners)

Output: APPROVE / APPROVE-WITH-CHANGES / REJECT, then findings list with file:line.
```

---

## E. Quick-fire — order of operations next session

1. User runs `/clear`
2. User pastes prompt A → Claude Code (Opus + plan mode) reads plan, installs agent-browser MCP, evaluates HyperFrames
3. Claude Code executes Phase 1 (audio fix) → commits → asks user to headphone-verify
4. After Phase 1 verified: write briefs B/C/D into the repo, user copies into respective tools in parallel
5. Claude Code executes Phase 2-4 while external reviews run in background
6. Final sync: incorporate external review findings, mark f009 done/passes:true only when all 6 checklist items pass
