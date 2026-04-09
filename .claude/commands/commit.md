Review current changes and create a semantic commit:

1. Run `git status` to see what changed
2. Run `git diff --stat` to see file-level changes
3. Review `git log --oneline -5` for recent commit style
4. Suggest a commit message using conventional commits format: `type(scope): description`
   - Types: feat, fix, style, refactor, chore
   - Scope: backend, frontend, docs
   - Keep under 72 characters
   - Imperative mood: "Add feature" not "Added feature"
5. Show the suggested message and ask for confirmation
6. If confirmed, run `git add . && git commit -m "message"`
7. After committing, update `features.json` if a feature was completed (set status to "completed", passes to true)
8. Update `HANDOFF.md` with what was just done

If $ARGUMENTS is provided, use it as context for the commit message.
