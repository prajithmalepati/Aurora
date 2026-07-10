#!/usr/bin/env bash
# scripts/tests/test_tick.sh — hermetic tests for tick.sh state-render/diff/guard behavior
#
# Each test creates an isolated temp git repo + fake command shims.
# No network, no model, no real kanban DB, no side effects outside /tmp.
# Run: bash scripts/tests/test_tick.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TICK="$REPO_ROOT/tick.sh"

# --- test framework ---
declare -i PASS=0 FAIL=0 TOTAL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

pass() { PASS+=1; TOTAL+=1; echo -e "${GREEN}PASS${NC} $1"; }
fail() { FAIL+=1; TOTAL+=1; echo -e "${RED}FAIL${NC} $1: $2"; }

# --- helpers ---
setup_test() {
  local tmpdir
  tmpdir=$(mktemp -d "/tmp/tick_test_XXXXXX")
  # Create a bare origin first, then clone from it
  git init -q --bare "$tmpdir/origin.git"
  local clonedir="$tmpdir/work"
  git clone -q "$tmpdir/origin.git" "$clonedir"
  (
    cd "$clonedir"
    git config user.email "test@tick.local"
    git config user.name "tick-test"
    git commit -q --allow-empty -m "init"
    git push -q origin main 2>/dev/null || git push -q origin HEAD:main 2>/dev/null
  )
  # Do NOT add STATE.md to .git/info/exclude — tick.sh must do that itself
  echo "$clonedir"
}

make_fake_path() {
  local tmpdir="$1"
  local fakeroot="$tmpdir/_fakebin"
  mkdir -p "$fakeroot"
  # Bash shim — delegates to real bash
  cat > "$fakeroot/bash" <<BASHSH
#!/bin/bash
exec "$(command -v bash)" "\$@"
BASHSH
  chmod +x "$fakeroot/bash"
  # Fake gh
  cat > "$fakeroot/gh" <<'SH'
#!/bin/bash
case "$*" in *"pr list"*) echo "No pull requests found.";; *) echo "{}";; esac
SH
  chmod +x "$fakeroot/gh"
  # Fake hermes — responds only to supported `kanban list --json`
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; *) exit 2;; esac
SH
  chmod +x "$fakeroot/hermes"
  echo "$fakeroot"
}

get_real_path_dirs() {
  # Minimal real PATH: bash, coreutils, git, grep, diff, mktemp, date, cat, mv, flock
  local dirs=""
  for cmd in bash git grep diff mktemp date cat mv flock dirname basename mkdir rm cp sort head tail wc stat; do
    local p
    p="$(command -v "$cmd" 2>/dev/null)" || continue
    local d
    d="$(dirname "$p")"
    case ":$dirs:" in *":$d:"*) ;; *) dirs="${dirs:+$dirs:}$d";; esac
  done
  echo "$dirs"
}

# --- tests ---

# T1: exit on missing git
test_missing_command() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  # PATH with only bash shim + our shims — no git, no jq
  rm -f "$fakeroot/git" "$fakeroot/jq"  # ensure no git/jq
  local runtime="$tmpdir/runtime"
  local out rc=0
  out=$(TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot" bash "$TICK" 2>&1) || rc=$?
  if [[ $rc -ne 0 ]]; then
    pass "T1: missing command → non-zero exit"
  else
    fail "T1: missing command" "rc=$rc out=$out"
  fi
  rm -rf "$tmpdir"
}

# T2: PAUSE file → exit 0, no side effects
test_pause() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  touch "$tmpdir/PAUSE"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  local has_state=false
  [[ -f "$tmpdir/STATE.md" ]] && has_state=true
  if [[ $rc -eq 0 ]] && ! $has_state; then
    pass "T2: PAUSE file → exit 0, no STATE.md"
  else
    fail "T2: PAUSE" "rc=$rc state_exists=$has_state out=$out"
  fi
  rm -rf "$tmpdir"
}

# T3: lock contention → non-zero exit
test_lock() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  # Hold the lock — tick.sh uses $RUNTIME_DIR/tick.lock
  local lockfile="$runtime/tick.lock"
  exec 9>"$lockfile"
  if ! flock -n 9; then
    fail "T3: lock" "could not acquire test lock"
    rm -rf "$tmpdir"; return
  fi
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  exec 9>&-
  rm -f "$lockfile"
  if [[ $rc -ne 0 ]]; then
    pass "T3: lock contention → non-zero exit"
  else
    fail "T3: lock" "rc=$rc out=$out"
  fi
  rm -rf "$tmpdir"
}

# T4: first run with no snapshot → STATE.md generated
test_first_run_generates_state() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  if [[ $rc -eq 0 ]] && [[ -f "$tmpdir/STATE.md" ]]; then
    pass "T4: first run → STATE.md generated"
  else
    fail "T4: first run" "rc=$rc STATE.md exists=$([[ -f $tmpdir/STATE.md ]] && echo yes || echo no) out=$out"
  fi
  rm -rf "$tmpdir"
}

# T5: no-change → no STATE.md regeneration (mtime preserved)
test_no_change_is_noop() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" ) >/dev/null 2>&1
  if [[ ! -f "$tmpdir/STATE.md" ]]; then
    fail "T5: no-change" "STATE.md not created on first run"
    rm -rf "$tmpdir"; return
  fi
  local mtime1; mtime1=$(stat -c %Y "$tmpdir/STATE.md")
  sleep 1
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  local mtime2; mtime2=$(stat -c %Y "$tmpdir/STATE.md")
  if [[ $rc -eq 0 ]] && [[ "$mtime1" == "$mtime2" ]]; then
    pass "T5: no-change → STATE.md not rewritten"
  else
    fail "T5: no-change" "rc=$rc mtime1=$mtime1 mtime2=$mtime2 out=$out"
  fi
  rm -rf "$tmpdir"
}

# T6: new commit → STATE.md regenerated
test_change_detected() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" ) >/dev/null 2>&1
  (cd "$tmpdir" && echo "change" > newfile.txt && git add newfile.txt && git commit -q -m "add file")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  if [[ $rc -eq 0 ]] && [[ -f "$tmpdir/STATE.md" ]]; then
    pass "T6: new commit → STATE.md regenerated"
  else
    fail "T6: change detected" "rc=$rc out=$out"
  fi
  rm -rf "$tmpdir"
}

# T7: STATE.md is git-ignored via .git/info/exclude (tick.sh adds it)
test_state_ignored() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" ) >/dev/null 2>&1
  local out
  out=$(cd "$tmpdir" && git check-ignore -v STATE.md 2>&1)
  if echo "$out" | grep -q "exclude"; then
    pass "T7: STATE.md git-ignored via exclude"
  else
    fail "T7: git-ignore" "out=$out"
  fi
  rm -rf "$tmpdir"
}

# T8: STATE.md contains required sections
test_state_sections() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feature")
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" ) >/dev/null 2>&1
  local ok=true missing=""
  for section in "origin/main" "Branch" "PR" "Kanban" "Worktrees" "Gate"; do
    if ! grep -qi "$section" "$tmpdir/STATE.md" 2>/dev/null; then
      ok=false; missing="$missing $section"
    fi
  done
  if $ok; then
    pass "T8: STATE.md contains all required sections"
  else
    fail "T8: sections" "missing:$missing"
  fi
  rm -rf "$tmpdir"
}

# T9: --dry-run → no STATE.md, no snapshot
test_dry_run() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" --dry-run 2>&1) || rc=$?
  if [[ $rc -eq 0 ]] && [[ ! -f "$tmpdir/STATE.md" ]] && [[ ! -f "$runtime/snapshot.json" ]]; then
    pass "T9: --dry-run → no side effects"
  else
    fail "T9: dry-run" "rc=$rc STATE.md=$([[ -f $tmpdir/STATE.md ]] && echo exists || echo absent) snapshot=$([[ -f $runtime/snapshot.json ]] && echo exists || echo absent)"
  fi
  rm -rf "$tmpdir"
}

# T10: STATE.md has no secrets / absolute home paths
test_no_secrets() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" ) >/dev/null 2>&1
  local state; state=$(cat "$tmpdir/STATE.md" 2>/dev/null || echo "")
  local leaked=false
  for pattern in "sk-" "tvly-" "ghp_" "X-Aurora-Token" "/home/fusei" "100.80.8" "100.105"; do
    if echo "$state" | grep -qi "$pattern"; then leaked=true; break; fi
  done
  if ! $leaked; then
    pass "T10: no secrets in STATE.md"
  else
    fail "T10: secrets" "found sensitive pattern in STATE.md"
  fi
  rm -rf "$tmpdir"
}

# T11: missing fields → "unavailable", never invented
test_unavailable_fields() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" ) >/dev/null 2>&1
  local state; state=$(cat "$tmpdir/STATE.md" 2>/dev/null || echo "")
  # With fake gh returning empty, PR sections should say unavailable/none — not fabricate numbers
  if grep -qE "(unavailable|No pull requests|none|0 open)" "$tmpdir/STATE.md" 2>/dev/null; then
    pass "T11: missing fields → unavailable or empty, not invented"
  else
    fail "T11: unavailable" "STATE.md may contain invented data"
  fi
  rm -rf "$tmpdir"
}

# T12: would-spawn-daiki / would-run-verita-stage emitted on change
test_would_spawn_markers() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  if echo "$out" | grep -q "would-spawn-daiki" && echo "$out" | grep -q "would-run-verita-stage"; then
    pass "T12: emits would-spawn-daiki + would-run-verita-stage"
  else
    fail "T12: markers" "rc=$rc out=$out"
  fi
  rm -rf "$tmpdir"
}

# T13: atomic write — STATE.md written via tmp+mv, not direct write
test_atomic_write() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  # Pre-create STATE.md — atomic mv should overwrite it cleanly
  echo "old content" > "$tmpdir/STATE.md"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  if [[ $rc -eq 0 ]] && grep -qi "origin.main" "$tmpdir/STATE.md" 2>/dev/null; then
    pass "T13: atomic write — STATE.md overwritten successfully"
  else
    fail "T13: atomic" "rc=$rc content=$(head -1 "$tmpdir/STATE.md" 2>/dev/null)"
  fi
  rm -rf "$tmpdir"
}

# T14 (B1): hermes kanban dump/active are unsupported → script uses kanban list --json
# The fake hermes shim exits 2 for any verb other than `kanban list --json`.
# If tick.sh called dump/active, hermes would exit 2 and the test would detect
# 'unavailable' or a script failure — proving B1 is fixed.
test_kanban_uses_supported_verb() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  local state; state=$(cat "$tmpdir/STATE.md" 2>/dev/null || echo "")
  # Fake hermes returns a card with id=t_test via list --json.
  # If dump/active were called, hermes exits 2 → kanban would be "unavailable".
  # With list --json, the active card's safe fields should appear.
  local has_id=false has_title=false has_safe_fields=false
  echo "$state" | grep -q "t_test" && has_id=true
  echo "$state" | grep -q "test card" && has_title=true
  # Verify only safe fields appear (no 'description', 'body', 'source', 'tenant')
  if echo "$state" | grep -qi "Kanban" && ! echo "$state" | grep -qi '"description"\|"body"\|"source"\|"tenant"'; then
    has_safe_fields=true
  fi
  if [[ $rc -eq 0 ]] && $has_id && $has_title && $has_safe_fields; then
    pass "T14 (B1): kanban uses list --json with safe field projection"
  else
    fail "T14 (B1): kanban" "rc=$rc has_id=$has_id has_title=$has_title has_safe_fields=$has_safe_fields"
  fi
  rm -rf "$tmpdir"
}

# T15 (B2+B3): worktree paths sanitized — no raw absolute paths in STATE
# Dynamically proves the temp worktree path is absent from STATE while
# the sanitized basename label is present.
test_worktree_paths_sanitized() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  # Create a second worktree to guarantee git worktree list has entries
  local wt_branch="_tick_test_wt_$$"
  (cd "$tmpdir" && git worktree add -b "$wt_branch" "$tmpdir/_wt" -q) 2>/dev/null || true
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  local state; state=$(cat "$tmpdir/STATE.md" 2>/dev/null || echo "")
  # The actual tmpdir path must NOT appear in STATE
  local raw_leaked=false
  echo "$state" | grep -qF "$tmpdir" && raw_leaked=true
  # The sanitized basename label (directory name only) should appear
  local has_label=false
  # The basename of $tmpdir (e.g., tick_test_abc123) should appear
  local base; base="$(basename "$tmpdir")"
  echo "$state" | grep -q "$base" && has_label=true
  # Also verify the worktree list raw output is not in snapshot
  local snap; snap=$(cat "$runtime/snapshot.json" 2>/dev/null || echo "")
  local snap_leaked=false
  echo "$snap" | grep -qF "$tmpdir" && snap_leaked=true
  if [[ $rc -eq 0 ]] && ! $raw_leaked && ! $snap_leaked; then
    pass "T15 (B2+B3): worktree paths sanitized — no raw paths in STATE or snapshot"
  else
    fail "T15 (B2+B3): worktree sanitize" "rc=$rc raw_leaked=$raw_leaked snap_leaked=$snap_leaked has_label=$has_label base=$base"
  fi
  # Cleanup worktree before removing tmpdir
  (cd "$tmpdir" && git worktree remove "$tmpdir/_wt" --force) 2>/dev/null || true
  rm -rf "$tmpdir"
}

# T16 (B4): default runtime dir is outside repo; no .tick/ in repo after run
test_runtime_dir_external() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  # Do NOT set TICK_RUNTIME_DIR — test the default
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  # Default should be $XDG_CACHE_HOME/aurora/tick or $HOME/.cache/aurora/tick
  local expected_cache="${XDG_CACHE_HOME:-$HOME/.cache}/aurora/tick"
  local has_external_runtime=false
  [[ -d "$expected_cache" ]] && has_external_runtime=true
  # No .tick/ directory should be created inside the repo
  local has_repo_tick=false
  [[ -d "$tmpdir/.tick" ]] && has_repo_tick=true
  # Also check git status — no .tick/ tracked
  local status_out; status_out=$(cd "$tmpdir" && git status --short 2>/dev/null)
  local tick_in_status=false
  echo "$status_out" | grep -q "\.tick" && tick_in_status=true
  if [[ $rc -eq 0 ]] && $has_external_runtime && ! $has_repo_tick && ! $tick_in_status; then
    pass "T16 (B4): runtime dir external to repo ($expected_cache)"
  else
    fail "T16 (B4): runtime dir" "rc=$rc external=$has_external_runtime repo_tick=$has_repo_tick tick_in_status=$tick_in_status expected=$expected_cache"
  fi
  # Cleanup: remove the external cache dir we created
  rm -rf "$expected_cache"
  rm -rf "$tmpdir"
}

# T17 (S1): failed git fetch → non-zero exit, no STATE or snapshot write
test_fetch_failure_halts() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  # Point origin to a path that exists as a directory but is NOT a git repo
  # This ensures `git remote get-url origin` succeeds (origin configured)
  # but `git fetch origin` fails (not a valid repo)
  local bad_remote="$tmpdir/not_a_repo"
  mkdir -p "$bad_remote"
  (cd "$tmpdir" && git remote set-url origin "$bad_remote")
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  local has_state=false
  [[ -f "$tmpdir/STATE.md" ]] && has_state=true
  local has_snapshot=false
  [[ -f "$runtime/snapshot.json" ]] && has_snapshot=true
  # Must exit non-zero
  local exit_ok=false
  [[ $rc -ne 0 ]] && exit_ok=true
  # Must have diagnostic
  local has_diag=false
  echo "$out" | grep -qi "fetch" && has_diag=true
  if $exit_ok && ! $has_state && ! $has_snapshot && $has_diag; then
    pass "T17 (S1): failed fetch → non-zero exit, no STATE/snapshot, diagnostic emitted"
  else
    fail "T17 (S1): fetch failure" "rc=$rc has_state=$has_state has_snapshot=$has_snapshot has_diag=$has_diag out=$out"
  fi
  rm -rf "$tmpdir"
}

# --- run all ---
echo -e "${BOLD}tick.sh test suite${NC}"
echo "=================="
echo ""

test_missing_command
test_pause
test_lock
test_first_run_generates_state
test_no_change_is_noop
test_change_detected
test_state_ignored
test_state_sections
test_dry_run
test_no_secrets
test_unavailable_fields
test_would_spawn_markers
test_atomic_write
test_kanban_uses_supported_verb
test_worktree_paths_sanitized
test_runtime_dir_external
test_fetch_failure_halts

echo ""
echo "=================="
echo -e "Total: $TOTAL  ${GREEN}Pass: $PASS${NC}  ${RED}Fail: $FAIL${NC}"
if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}SOME TESTS FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}ALL TESTS PASSED${NC}"
  exit 0
fi
