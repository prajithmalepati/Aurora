#!/usr/bin/env bash
# tick.sh — mechanical STATE generator and safe heartbeat foundation
#
# Invocation:  ./tick.sh [--dry-run]
#
# What it does (in order):
#   1. Acquire a non-overlapping lock (.tick/tick.lock)
#   2. Check for PAUSE file at repo root → exit 0 if present
#   3. Verify required commands (git, gh, jq)
#   4. git fetch origin
#   5. Snapshot board + PR state to JSON, diff against last snapshot
#   6. If no change → exit 0 (zero tokens)
#   7. If change detected → render STATE.md mechanically from live commands
#   8. Emit would-spawn-daiki / would-run-verita-stage markers (NOT actually spawning)
#
# Environment contract:
#   TICK_REPO_ROOT   override repo root  (default: directory containing this script)
#   TICK_RUNTIME_DIR override runtime dir (default: $TICK_REPO_ROOT/.tick)
#   TICK_DRY_RUN     same as --dry-run flag
#
# Required commands: git, gh (GitHub CLI), jq
#
# Safe-by-default:
#   - Does NOT configure timers, systemd, or cron
#   - Does NOT invoke models or send notifications
#   - Does NOT modify .gitignore, CI, or Hermes config
#   - STATE.md is added to .git/info/exclude (local-only)
#   - Emits would-spawn-daiki / would-run-verita-stage on detected changes
#
# No API keys, tokens, absolute home paths, Tailscale data, or library data
# appear in logs or STATE.md output.  Fields that cannot be sourced are marked
# "unavailable" — never inherited or invented.

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${TICK_REPO_ROOT:-$SCRIPT_DIR}"
RUNTIME_DIR="${TICK_RUNTIME_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/aurora/tick}"

# Resolve .git dir — in a worktree, .git is a file containing "gitdir: <path>"
# For exclude files and shared config, we need the MAIN repo's .git, not the
# worktree-specific gitdir (which is at .git/worktrees/<name>/).
if [[ -f "$REPO_ROOT/.git" ]]; then
  _worktree_gitdir="$(sed -n 's/^gitdir: //p' "$REPO_ROOT/.git")"
  [[ "$_worktree_gitdir" != /* ]] && _worktree_gitdir="$REPO_ROOT/$_worktree_gitdir"
  # Strip /worktrees/<name> suffix to get the main repo's .git
  GIT_DIR="${_worktree_gitdir%/worktrees/*}"
  unset _worktree_gitdir
else
  GIT_DIR="$REPO_ROOT/.git"
fi

DRY_RUN=false
[[ "${1:-}" == "--dry-run" || "${TICK_DRY_RUN:-}" == "1" ]] && DRY_RUN=true

mkdir -p "$RUNTIME_DIR"

# ---------------------------------------------------------------------------
# Lock — non-overlapping via flock
# ---------------------------------------------------------------------------
LOCK_FD=9
LOCK_FILE="$RUNTIME_DIR/tick.lock"
exec 9>"$LOCK_FILE"
if ! flock -n "$LOCK_FD"; then
  echo "tick: lock held by another process — exiting" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# PAUSE — kill switch
# ---------------------------------------------------------------------------
if [[ -f "$REPO_ROOT/PAUSE" ]]; then
  echo "tick: PAUSE file present — exiting safely"
  exit 0
fi

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------
for cmd in git gh jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "tick: missing required command: $cmd" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------
cd "$REPO_ROOT"
if ! $DRY_RUN; then
  if git remote get-url origin &>/dev/null; then
    if ! git fetch origin --prune 2>/dev/null; then
      echo "tick: git fetch failed — cannot proceed with stale refs" >&2
      exit 1
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Snapshot (JSON)
# ---------------------------------------------------------------------------
build_snapshot() {
  local sha log branch status open_prs merged_prs kanban worktrees
  sha="$(git rev-parse origin/main 2>/dev/null || echo 'unavailable')"
  log="$(git log origin/main --oneline -10 2>/dev/null || echo 'unavailable')"
  branch="$(git branch --show-current 2>/dev/null || echo 'unavailable')"
  status="$(git status --short 2>/dev/null || echo 'unavailable')"
  open_prs="$(gh pr list --state open --limit 20 2>/dev/null || echo 'unavailable')"
  merged_prs="$(gh pr list --state merged --limit 5 --json number,title,mergedAt 2>/dev/null || echo 'unavailable')"
  kanban="$(hermes kanban list --json 2>/dev/null || echo '[]')"
  worktrees="$(git worktree list 2>/dev/null | while read -r line; do
    echo "$(basename "${line%% *}") ${line#* }"
  done || echo 'unavailable')"
  # Use temp files + --rawfile to avoid ARG_MAX overflow on large repos
  local tmpd; tmpd="$(mktemp -d)"
  printf '%s' "$sha" > "$tmpd/sha"
  printf '%s' "$log" > "$tmpd/log"
  printf '%s' "$branch" > "$tmpd/branch"
  printf '%s' "$status" > "$tmpd/status"
  printf '%s' "$open_prs" > "$tmpd/open_prs"
  printf '%s' "$merged_prs" > "$tmpd/merged_prs"
  printf '%s' "$kanban" > "$tmpd/kanban"
  printf '%s' "$worktrees" > "$tmpd/worktrees"
  jq -n \
    --rawfile sha "$tmpd/sha" \
    --rawfile log "$tmpd/log" \
    --rawfile branch "$tmpd/branch" \
    --rawfile status "$tmpd/status" \
    --rawfile open_prs "$tmpd/open_prs" \
    --rawfile merged_prs "$tmpd/merged_prs" \
    --rawfile kanban "$tmpd/kanban" \
    --rawfile worktrees "$tmpd/worktrees" \
    '{
      origin_main_sha: ($sha | gsub("\\s+$"; "")),
      origin_main_short_log: ($log | gsub("\\s+$"; "")),
      branch: ($branch | gsub("\\s+$"; "")),
      git_status: ($status | gsub("\\s+$"; "")),
      open_prs: ($open_prs | gsub("\\s+$"; "")),
      merged_prs: ($merged_prs | gsub("\\s+$"; "")),
      kanban: (try ($kanban | gsub("\\s+$"; "") | fromjson) catch []),
      worktrees: ($worktrees | gsub("\\s+$"; ""))
    }'
  rm -rf "$tmpd"
}

SNAPSHOT_FILE="$RUNTIME_DIR/snapshot.json"
NEW_SNAPSHOT="$(build_snapshot)"

# ---------------------------------------------------------------------------
# Diff-gating — no change → exit 0, zero tokens
# ---------------------------------------------------------------------------
if [[ -f "$SNAPSHOT_FILE" ]] && diff -q <(echo "$NEW_SNAPSHOT") "$SNAPSHOT_FILE" &>/dev/null; then
  echo "tick: no change — exiting"
  exit 0
fi

echo "tick: change detected"

# ---------------------------------------------------------------------------
# Dry-run — bail before any side effects
# ---------------------------------------------------------------------------
if $DRY_RUN; then
  echo "[dry-run] would regenerate STATE.md"
  echo "[dry-run] would-spawn-daiki"
  echo "[dry-run] would-run-verita-stage"
  exit 0
fi

# ---------------------------------------------------------------------------
# Ensure STATE.md is git-ignored via .git/info/exclude
# ---------------------------------------------------------------------------
EXCLUDE_FILE="$GIT_DIR/info/exclude"
mkdir -p "$(dirname "$EXCLUDE_FILE")"
if ! grep -qxF "STATE.md" "$EXCLUDE_FILE" 2>/dev/null; then
  echo "STATE.md" >> "$EXCLUDE_FILE"
  echo "tick: added STATE.md to .git/info/exclude"
fi

# ---------------------------------------------------------------------------
# Render STATE.md — mechanical, evidence-only
# ---------------------------------------------------------------------------

# Origin/main SHA + short log
ORIGIN_SHA="$(git rev-parse origin/main 2>/dev/null || echo 'unavailable')"
ORIGIN_LOG="$(git log origin/main --oneline -10 2>/dev/null || echo 'unavailable')"

# Branch + status
BRANCH="$(git branch --show-current 2>/dev/null || echo 'unavailable')"
GIT_STATUS="$(git status --short 2>/dev/null || echo 'unavailable')"

# PRs
OPEN_PRS="$(gh pr list --state open --limit 20 2>/dev/null || echo 'No pull requests found.')"
MERGED_PRS="$(gh pr list --state merged --limit 5 2>/dev/null || echo 'No pull requests found.')"

# Kanban — derive from supported list --json, project safe fields only
KANBAN_JSON="$(hermes kanban list --json 2>/dev/null || echo '[]')"
if [[ "$KANBAN_JSON" == "[]" || -z "$KANBAN_JSON" ]]; then
  KANBAN_SUMMARY="0 cards"
  KANBAN_ACTIVE="(none)"
else
  KANBAN_SUMMARY="$(echo "$KANBAN_JSON" | jq -r 'length' 2>/dev/null || echo 'unavailable') cards"
  KANBAN_ACTIVE="$(echo "$KANBAN_JSON" | jq -r '
    .[] | select(.status == "running") |
    {id, title, assignee, status, priority}
  ' 2>/dev/null || echo 'unavailable')"
  if [[ -z "$KANBAN_ACTIVE" ]]; then
    KANBAN_ACTIVE="(none)"
  fi
fi

# Worktrees — sanitize to basenames only (no absolute paths)
WORKTREES="$(git worktree list 2>/dev/null | while read -r line; do
  echo "$(basename "${line%% *}") ${line#* }"
done || echo 'unavailable')"

# Gate counts — evidence-only; "unavailable" if no evidence exists
GATE_FILE="$RUNTIME_DIR/last_gate.txt"
if [[ -f "$GATE_FILE" ]]; then
  GATE_COUNTS="$(cat "$GATE_FILE")"
else
  GATE_COUNTS="unavailable"
fi

# Build STATE.md atomically
STATE_TMP="$REPO_ROOT/STATE.md.tmp"
STATE_FINAL="$REPO_ROOT/STATE.md"

cat > "$STATE_TMP" <<STATE_EOF
# STATE.md — auto-generated by tick.sh on $(date -u '+%Y-%m-%d %H:%M:%S UTC')

## Origin/Main
SHA: $ORIGIN_SHA

### Recent commits
$ORIGIN_LOG

## Branch
Current: $BRANCH

## Status
$GIT_STATUS

## Open PRs
$OPEN_PRS

## Merged PRs (last 5)
$MERGED_PRS

## Kanban
Summary: $KANBAN_SUMMARY
$KANBAN_ACTIVE

## Worktrees
$WORKTREES

## Gate
$GATE_COUNTS
STATE_EOF

mv "$STATE_TMP" "$STATE_FINAL"
echo "tick: STATE.md written"

# Save snapshot for next diff
echo "$NEW_SNAPSHOT" > "$SNAPSHOT_FILE"
echo "tick: snapshot saved to $SNAPSHOT_FILE"

# Verify exclusion
if git check-ignore -q STATE.md 2>/dev/null; then
  echo "tick: STATE.md confirmed git-ignored"
else
  echo "tick: WARNING — STATE.md is NOT git-ignored" >&2
fi

# ---------------------------------------------------------------------------
# Safe-by-default markers — NOT actually spawning anything
# ---------------------------------------------------------------------------
echo "tick: would-spawn-daiki"
echo "tick: would-run-verita-stage"
echo "tick: done"
exit 0
