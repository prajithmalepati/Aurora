#!/usr/bin/env bash
# tick.sh — mechanical STATE generator, safe Daiki→Verita heartbeat pipeline
#
# Invocation:  ./tick.sh [--dry-run]
#
# What it does (in order):
#   1. Acquire a non-overlapping lock ($XDG_CACHE_HOME/aurora/tick/tick.lock)
#   2. Check for PAUSE file at repo root → exit 0 if present
#   3. Verify required commands (git, gh, jq, hermes)
#   4. git fetch origin
#   5. Snapshot board + PR state to JSON, diff against last snapshot
#   6. If no change → exit 0 (zero tokens)
#   7. If change detected → render STATE.md mechanically from live commands
#   8. Check attempt budget, reserve one attempt
#   9. Run Daiki under bounded supervisor (30 min timeout)
#  10. On Daiki exit 0: acknowledge snapshot, then run Verita (10 min timeout)
#     On Daiki failure/timeout: leave snapshot unacknowledged, skip Verita
#  11. Log metadata-only outcome, optionally notify
#
# Environment contract:
#   TICK_REPO_ROOT   override repo root  (default: directory containing this script)
#   TICK_RUNTIME_DIR override runtime dir (default: ${XDG_CACHE_HOME:-$HOME/.cache}/aurora/tick)
#   TICK_DRY_RUN     same as --dry-run flag
#
# Required commands: git, gh, jq, hermes
#
# Safe-by-default:
#   - Does NOT configure timers, systemd, or cron
#   - Does NOT modify .gitignore, CI, or Hermes config
#   - Does NOT create or modify Hermes profiles
#   - STATE.md is added to .git/info/exclude (local-only)
#   - No direct Kanban DB writes
#   - No fix-round field/status invention
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
# Named budget and timeout constants
# ---------------------------------------------------------------------------
readonly MAX_ATTEMPTS_DAY=12
readonly MAX_ATTEMPTS_MONTH=250
readonly NOTIFY_CAP_DAY=10

# Timeouts — overridable via env for testing; defaults are the production values
DAIKI_TIMEOUT_SECS="${DAIKI_TIMEOUT_SECS:-1800}"   # 30 minutes
VERITA_TIMEOUT_SECS="${VERITA_TIMEOUT_SECS:-600}"  # 10 minutes
KILL_GRACE_SECS="${KILL_GRACE_SECS:-30}"

# Runtime files
readonly COUNTER_DAY="$RUNTIME_DIR/attempts_day.txt"
readonly COUNTER_MONTH="$RUNTIME_DIR/attempts_month.txt"
readonly LOG_FILE="$RUNTIME_DIR/tick.log"

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
# Validate hermes binary — must exist before any budget or spawn work
# ---------------------------------------------------------------------------
if ! command -v hermes &>/dev/null; then
  echo "tick: hermes command not found on PATH" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Supervise — run a command in a new process group with bounded timeout
#   supervise <timeout_secs> <log_label> <command...>
#
# Returns the supervised command's exit code, or 124 on timeout.
# The child runs in its own process group (setsid).
# Lock fd 9 is closed in the child (CLOEXEC / explicit).
# On timeout: SIGTERM group → grace → SIGKILL group.
# ---------------------------------------------------------------------------
supervise() {
  local timeout_secs="$1"
  local label="$2"
  shift 2
  local cmd=("$@")
  local pid_file="$RUNTIME_DIR/supervise_${label}_$$.pid"

  # Launch in a new session via setsid. setsid may fork if the calling
  # process is a process group leader (which backgrounded children are).
  # To get the actual child PID (the session leader), the child writes
  # its own $$ to a PID file before exec'ing the command.
  setsid bash -c '
    echo $$ > "'"$pid_file"'"
    exec 9>&-
    exec "$@"
  ' _ "${cmd[@]}" &
  local setsid_parent=$!

  # Wait for the PID file to appear (child started and wrote its PID)
  local waited=0
  while [[ ! -f "$pid_file" ]] && kill -0 "$setsid_parent" 2>/dev/null; do
    sleep 0.1
    waited=$((waited + 1))
    [[ $waited -ge 50 ]] && break  # 5s max wait
  done

  local child_pid=""
  if [[ -f "$pid_file" ]]; then
    child_pid="$(cat "$pid_file" 2>/dev/null)"
    rm -f "$pid_file"
  fi

  # Fallback: if we couldn't get the child PID, use setsid parent
  if [[ -z "$child_pid" ]] || ! kill -0 "$child_pid" 2>/dev/null; then
    rm -f "$pid_file"
    wait "$setsid_parent" 2>/dev/null
    return $?
  fi

  # Wait with timeout
  local elapsed=0
  while kill -0 "$child_pid" 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [[ $elapsed -ge $timeout_secs ]]; then
      # Timeout: SIGTERM the process group (child_pid IS the PGID)
      kill -TERM -"$child_pid" 2>/dev/null || true
      sleep "$KILL_GRACE_SECS"
      # SIGKILL if still alive
      kill -KILL -"$child_pid" 2>/dev/null || true
      wait "$child_pid" 2>/dev/null || true
      wait "$setsid_parent" 2>/dev/null || true
      rm -f "$pid_file"
      return 124
    fi
  done

  # Child exited normally
  wait "$child_pid" 2>/dev/null
  local child_rc=$?
  wait "$setsid_parent" 2>/dev/null || true
  rm -f "$pid_file"
  return $child_rc
}

# ---------------------------------------------------------------------------
# Send notification (optional, non-fatal)
#   send_notification <title> <message>
#
# notify_count.txt format: "YYYY-MM-DD N" (UTC-day scoped, like attempt counters)
# notify_muted.txt format: "YYYY-MM-DD"   (tracks exactly-once muted indication)
# ---------------------------------------------------------------------------
send_notification() {
  local title="$1"
  local message="$2"
  local secrets_file="$RUNTIME_DIR/ntfy_secrets"
  local notify_count_file="$RUNTIME_DIR/notify_count.txt"
  local notify_muted_file="$RUNTIME_DIR/notify_muted.txt"

  local today_utc
  today_utc="$(date -u '+%Y-%m-%d')"

  # Rate limit: read and validate current count (UTC-day scoped)
  local notify_count=0
  if [[ -f "$notify_count_file" ]]; then
    local _raw _date _num
    _raw="$(cat "$notify_count_file" 2>/dev/null || echo "")"
    _date="${_raw%% *}"
    _num="${_raw#* }"
    if [[ "$_date" != "$today_utc" ]]; then
      # Previous day — reset
      notify_count=0
    elif [[ "$_num" =~ ^[0-9]+$ ]]; then
      notify_count="$_num"
    else
      # Malformed current-day counter — fail closed
      echo "tick: malformed notify counter — failing closed" >&2
      return 0
    fi
  fi

  if [[ $notify_count -ge $NOTIFY_CAP_DAY ]]; then
    # Capped — record exactly-once muted indication, then stay silent
    local muted_today=false
    if [[ -f "$notify_muted_file" ]]; then
      local muted_date
      muted_date="$(cat "$notify_muted_file" 2>/dev/null || echo "")"
      [[ "$muted_date" == "$today_utc" ]] && muted_today=true
    fi
    if ! $muted_today; then
      echo "$today_utc" > "$notify_muted_file"
      log_tick "notifications-muted" "notify" "cap-$today_utc"
    fi
    return 0
  fi

  # Build argv array — no source, no eval
  local ntfy_args=("ntfy" "notify")

  # Optional token from permission-checked secrets file
  if [[ -f "$secrets_file" ]]; then
    local perms
    perms="$(stat -c '%a' "$secrets_file" 2>/dev/null || echo "")"
    if [[ "$perms" == "600" ]]; then
      local token
      token="$(cat "$secrets_file" 2>/dev/null || echo "")"
      if [[ -n "$token" ]]; then
        ntfy_args+=("--token" "$token")
      fi
    fi
  fi

  ntfy_args+=("--title" "$title" "$message")

  # Execute with argv array, discard output, non-fatal
  if "${ntfy_args[@]}" >/dev/null 2>&1; then
    notify_count=$((notify_count + 1))
    echo "$today_utc $notify_count" > "$notify_count_file"
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Log — metadata-only, no model output or secrets
#   log_tick <outcome> [stage] [exit_class]
# ---------------------------------------------------------------------------
log_tick() {
  local outcome="$1"
  local stage="${2:-}"
  local exit_class="${3:-}"
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  local line="$ts | $outcome"
  [[ -n "$stage" ]] && line="$line | stage=$stage"
  [[ -n "$exit_class" ]] && line="$line | exit=$exit_class"
  echo "$line" >> "$LOG_FILE"
}

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
  echo "[dry-run] would check budget"
  echo "[dry-run] would run Daiki"
  echo "[dry-run] would run Verita"
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

# Verify exclusion
if git check-ignore -q STATE.md 2>/dev/null; then
  echo "tick: STATE.md confirmed git-ignored"
else
  echo "tick: WARNING — STATE.md is NOT git-ignored" >&2
fi

# ---------------------------------------------------------------------------
# Attempt budget — check and reserve before spawning
# ---------------------------------------------------------------------------
today="$(date -u '+%Y-%m-%d')"
month="$(date -u '+%Y-%m')"

# Read daily counter: format "YYYY-MM-DD N"
day_count=0
if [[ -f "$COUNTER_DAY" ]]; then
  _raw="$(cat "$COUNTER_DAY" 2>/dev/null || echo "")"
  _date="${_raw%% *}"
  _num="${_raw#* }"
  if [[ "$_date" != "$today" ]]; then
    day_count=0
  elif [[ "$_num" =~ ^[0-9]+$ ]]; then
    day_count="$_num"
  else
    # Malformed counter — fail closed
    echo "tick: malformed daily counter — failing closed" >&2
    log_tick "fail-closed" "budget" "malformed-counter"
    exit 1
  fi
fi

# Read monthly counter: format "YYYY-MM N"
month_count=0
if [[ -f "$COUNTER_MONTH" ]]; then
  _raw="$(cat "$COUNTER_MONTH" 2>/dev/null || echo "")"
  _mon="${_raw%% *}"
  _num="${_raw#* }"
  if [[ "$_mon" != "$month" ]]; then
    month_count=0
  elif [[ "$_num" =~ ^[0-9]+$ ]]; then
    month_count="$_num"
  else
    # Malformed counter — fail closed
    echo "tick: malformed monthly counter — failing closed" >&2
    log_tick "fail-closed" "budget" "malformed-counter"
    exit 1
  fi
fi

if [[ $day_count -ge $MAX_ATTEMPTS_DAY ]]; then
  echo "tick: daily attempt cap reached ($day_count/$MAX_ATTEMPTS_DAY) — skipping model work"
  log_tick "cap-reached" "budget" "daily"
  send_notification "Tick: daily cap" "Daily attempt cap ($MAX_ATTEMPTS_DAY) reached"
  # Do NOT write snapshot — preserve pending change for next day's tick
  exit 0
fi

if [[ $month_count -ge $MAX_ATTEMPTS_MONTH ]]; then
  echo "tick: monthly attempt cap reached ($month_count/$MAX_ATTEMPTS_MONTH) — skipping model work"
  log_tick "cap-reached" "budget" "monthly"
  send_notification "Tick: monthly cap" "Monthly attempt cap ($MAX_ATTEMPTS_MONTH) reached"
  # Do NOT write snapshot — preserve pending change for next month's tick
  exit 0
fi

# Reserve attempt — count before spawn, never refund
day_count=$((day_count + 1))
month_count=$((month_count + 1))
echo "$today $day_count" > "$COUNTER_DAY"
echo "$month $month_count" > "$COUNTER_MONTH"

# ---------------------------------------------------------------------------
# Daiki prompt
# ---------------------------------------------------------------------------
DAIKI_PROMPT='Daiki — Aurora operating cycle. You are the orchestrator, not an implementer.

Load, in order:
1. /home/fusei/Aurora/HERMES_NORTH_STAR.md      — goals, ranked; fixed; you propose changes only via north-star-proposal cards.
2. /home/fusei/Aurora/HERMES_OPERATING_PLAN.md  — your operating manual: seats (§3), wave queue (§4), rules (§5), board contract + card anatomy (§6), escalation (§8).
3. /home/fusei/Aurora/STATE.md if it exists, else /home/fusei/Aurora/FABLE_STATE_REVIEW_2026-07-08.md — last verified state.
4. Ground truth: git fetch && git log origin/main --oneline -15 && gh pr list. The tree overrules every doc.

Then, this cycle:
- Reconcile the Kanban board against the wave queue (§4): create/update/close cards so the board matches. Every card follows the §6 anatomy — scope line, verified anchors, evidence gate, stop conditions, done definition. No bare "fix X" cards.
- Do not start a lower wave'\''s cards while a higher wave has open, workable blockers.
- Dispatch per the §6 column contract. Koji-MoA only where §3'\''s policy says. Fix-round cap = 2, then Blocked.
- STATE.md is script-generated by the tick before you were spawned (§11) — read it, never write it and never card it. Wave logs, ledgers, and doc hygiene belong to the post-cycle Verita stage (§7); your job is to leave the board and your digest in a state it can archive.
- Rules §5 are non-negotiable; the ones that will tempt you: evidence gates are scripts not claims (§5.2), review-before-merge for mutating code (§5.3), golden fixtures read-only (§5.6), never git add -A (§5.7).
- End of cycle: post a board digest; anything needing merge/release/budget → notify Prajith; architecture forks → FABLE_REVIEW_QUEUE.md, keep working elsewhere. You never merge.'

# ---------------------------------------------------------------------------
# Run Daiki
# ---------------------------------------------------------------------------
echo "tick: spawning Daiki (timeout ${DAIKI_TIMEOUT_SECS}s)"
daiki_rc=0
supervise "$DAIKI_TIMEOUT_SECS" "daiki" \
  hermes -p default chat -Q -q "$DAIKI_PROMPT" --skills kanban,aurora --source tick \
  || daiki_rc=$?

if [[ $daiki_rc -eq 0 ]]; then
  # Daiki success → acknowledge snapshot
  echo "$NEW_SNAPSHOT" > "$SNAPSHOT_FILE"
  echo "tick: Daiki succeeded — snapshot acknowledged"

  # ---------------------------------------------------------------------------
  # Run Verita
  # ---------------------------------------------------------------------------
  VERITA_PROMPT='Read and freshness-check STATE.md — never generate it. Then perform only the §7 documentation charter: wave logs, ledgers, doc hygiene, and this queue.'

  if [[ -f "$RUNTIME_DIR/verita_owed" ]]; then
    VERITA_PROMPT="$VERITA_PROMPT

Process documentation backlog since last successful run."
    rm -f "$RUNTIME_DIR/verita_owed"
  fi

  echo "tick: spawning Verita (timeout ${VERITA_TIMEOUT_SECS}s)"
  verita_rc=0
  supervise "$VERITA_TIMEOUT_SECS" "verita" \
    hermes -p verita chat -Q -q "$VERITA_PROMPT" --skills aurora --source tick \
    || verita_rc=$?

  if [[ $verita_rc -eq 0 ]]; then
    log_tick "ok" "daiki+verita" "0"
  else
    # Verita failure is non-fatal; record verita-owed marker
    echo "verita_owed" > "$RUNTIME_DIR/verita_owed"
    if [[ $verita_rc -eq 124 ]]; then
      log_tick "verita-timeout" "verita" "124"
      send_notification "Tick: Verita timeout" "Verita stage timed out after ${VERITA_TIMEOUT_SECS}s"
    else
      log_tick "verita-failed" "verita" "$verita_rc"
      send_notification "Tick: Verita failed" "Verita exited with code $verita_rc"
    fi
  fi
else
  # Daiki failure or timeout — snapshot NOT acknowledged, no Verita
  if [[ $daiki_rc -eq 124 ]]; then
    log_tick "daiki-timeout" "daiki" "124"
    send_notification "Tick: Daiki timeout" "Daiki timed out after ${DAIKI_TIMEOUT_SECS}s"
  else
    log_tick "daiki-failed" "daiki" "$daiki_rc"
    send_notification "Tick: Daiki failed" "Daiki exited with code $daiki_rc"
  fi
fi

# ---------------------------------------------------------------------------
# Exit — lock released by shell exit (fd 9 closed)
# ---------------------------------------------------------------------------
echo "tick: done"
exit 0
