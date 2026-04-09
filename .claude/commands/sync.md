Read these files to understand current project state:
1. Read `CLAUDE.md` for project rules and architecture
2. Read `HANDOFF.md` for current status, known bugs, and technical decisions
3. Read `features.json` for remaining tasks and their status
4. Run `git status` and `git log --oneline -10` to see recent changes

Then present a brief summary:
- How many features remain (pending/completed)
- Any uncommitted changes
- What the next priority task is based on features.json order

If $ARGUMENTS is provided, start working on that specific task. Otherwise, ask what to work on next.

IMPORTANT: Do not read the docs/ folder upfront. Only read specific doc files when you need them for a task. This saves tokens.
