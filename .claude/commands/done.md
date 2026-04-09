End-of-session protocol. Do these steps in order:

1. Check `git status` — if there are uncommitted changes, ask whether to commit them first
2. Update `features.json` — mark any completed features as status: "completed", passes: true
3. Update `HANDOFF.md`:
   - Update "Current State" with what was achieved this session
   - Update "Known Bugs" — remove fixed bugs, add any new ones discovered
   - Update "Next Steps" with the specific next task from features.json
4. Commit the updated HANDOFF.md and features.json: `git add HANDOFF.md features.json && git commit -m "chore: update handoff and features for session end"`
5. Show a brief summary of what was accomplished
