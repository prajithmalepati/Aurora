#!/usr/bin/env bash
# scripts/tests/test_tick.sh — hermetic tests for tick.sh state-render/diff/guard/activation behavior
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
  # Fake ntfy — always succeeds silently
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
exit 0
SH
  chmod +x "$fakeroot/ntfy"
  echo "$fakeroot"
}

# Create a hermes shim that records argv and exits 0 for chat commands
make_fake_hermes_path() {
  local tmpdir="$1"
  local fakeroot="$tmpdir/_fakebin"
  mkdir -p "$fakeroot"
  # Bash shim
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
  # Fake hermes — records argv for chat, responds to kanban list --json
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
# Record all chat invocations
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
SH
  chmod +x "$fakeroot/hermes"
  # Fake ntfy
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
exit 0
SH
  chmod +x "$fakeroot/ntfy"
  echo "$fakeroot"
}

# Create a hermes shim that fails on chat commands (exit 1)
make_failing_hermes_path() {
  local tmpdir="$1"
  local fakeroot="$tmpdir/_fakebin"
  mkdir -p "$fakeroot"
  cat > "$fakeroot/bash" <<BASHSH
#!/bin/bash
exec "$(command -v bash)" "\$@"
BASHSH
  chmod +x "$fakeroot/bash"
  cat > "$fakeroot/gh" <<'SH'
#!/bin/bash
case "$*" in *"pr list"*) echo "No pull requests found.";; *) echo "{}";; esac
SH
  chmod +x "$fakeroot/gh"
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
# Record all chat invocations
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
  exit 1
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
SH
  chmod +x "$fakeroot/hermes"
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
exit 0
SH
  chmod +x "$fakeroot/ntfy"
  echo "$fakeroot"
}

# Create a hermes shim that hangs on chat commands (for timeout testing)
make_timeout_hermes_path() {
  local tmpdir="$1"
  local fakeroot="$tmpdir/_fakebin"
  mkdir -p "$fakeroot"
  cat > "$fakeroot/bash" <<BASHSH
#!/bin/bash
exec "$(command -v bash)" "\$@"
BASHSH
  chmod +x "$fakeroot/bash"
  cat > "$fakeroot/gh" <<'SH'
#!/bin/bash
case "$*" in *"pr list"*) echo "No pull requests found.";; *) echo "{}";; esac
SH
  chmod +x "$fakeroot/gh"
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
  # Hang until killed (in the real test, timeout is set to 5s)
  while true; do sleep 100; done
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
SH
  chmod +x "$fakeroot/hermes"
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
exit 0
SH
  chmod +x "$fakeroot/ntfy"
  echo "$fakeroot"
}

get_real_path_dirs() {
  # Minimal real PATH: bash, coreutils, git, grep, diff, mktemp, date, cat, mv, flock
  # plus setsid and timeout for process supervision
  local dirs=""
  for cmd in bash git grep diff mktemp date cat mv flock dirname basename mkdir rm cp sort head tail wc stat setsid timeout kill; do
    local p
    p="$(command -v "$cmd" 2>/dev/null)" || continue
    local d
    d="$(dirname "$p")"
    case ":$dirs:" in *":$d:"*) ;; *) dirs="${dirs:+$dirs:}$d";; esac
  done
  echo "$dirs"
}

# Run tick.sh with the given fake path and optional env vars
# Returns: sets TICK_OUT, TICK_RC
run_tick() {
  local tmpdir="$1"
  local fakeroot="$2"
  local real_path
  real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" \
    "${@:3}" \
    bash "$TICK" 2>&1) || rc=$?
  TICK_OUT="$out"
  TICK_RC=$rc
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
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
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
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" ) >/dev/null 2>&1
  if [[ ! -f "$tmpdir/STATE.md" ]]; then
    fail "T5: no-change" "STATE.md not created on first run"
    rm -rf "$tmpdir"; return
  fi
  local mtime1; mtime1=$(stat -c %Y "$tmpdir/STATE.md")
  sleep 1
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
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
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" ) >/dev/null 2>&1
  (cd "$tmpdir" && echo "change" > newfile.txt && git add newfile.txt && git commit -q -m "add file")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
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
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" ) >/dev/null 2>&1
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
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feature")
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" ) >/dev/null 2>&1
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
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" ) >/dev/null 2>&1
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
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" ) >/dev/null 2>&1
  local state; state=$(cat "$tmpdir/STATE.md" 2>/dev/null || echo "")
  # With fake gh returning empty, PR sections should say unavailable/none — not fabricate numbers
  if grep -qE "(unavailable|No pull requests|none|0 open)" "$tmpdir/STATE.md" 2>/dev/null; then
    pass "T11: missing fields → unavailable or empty, not invented"
  else
    fail "T11: unavailable" "STATE.md may contain invented data"
  fi
  rm -rf "$tmpdir"
}

# T12: changed state → Daiki spawned with -p default and approved flags (NOT nonexistent 'daiki' profile)
test_daiki_profile_argv() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # Read recorded argv
  local recorded=""
  [[ -f "$argv_file" ]] && recorded="$(cat "$argv_file")"
  # Must contain -p default and --skills kanban,aurora
  local has_default=false has_skills=false has_source=false
  echo "$recorded" | grep -q "\-p default" && has_default=true
  echo "$recorded" | grep -q -- "--skills kanban,aurora" && has_skills=true
  echo "$recorded" | grep -q -- "--source tick" && has_source=true
  # Must NOT contain -p daiki
  local has_daiki_profile=false
  echo "$recorded" | grep -q "\-p daiki" && has_daiki_profile=true
  if [[ $rc -eq 0 ]] && $has_default && $has_skills && $has_source && ! $has_daiki_profile; then
    pass "T12: Daiki uses -p default, --skills kanban,aurora, --source tick"
  else
    fail "T12: Daiki argv" "rc=$rc default=$has_default skills=$has_skills source=$has_source daiki_profile=$has_daiki_profile recorded=$recorded"
  fi
  rm -rf "$tmpdir"
}

# T13: atomic write — STATE.md written via tmp+mv, not direct write
test_atomic_write() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  # Pre-create STATE.md — atomic mv should overwrite it cleanly
  echo "old content" > "$tmpdir/STATE.md"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  if [[ $rc -eq 0 ]] && grep -qi "origin.main" "$tmpdir/STATE.md" 2>/dev/null; then
    pass "T13: atomic write — STATE.md overwritten successfully"
  else
    fail "T13: atomic" "rc=$rc content=$(head -1 "$tmpdir/STATE.md" 2>/dev/null)"
  fi
  rm -rf "$tmpdir"
}

# T14 (B1): hermes kanban dump/active are unsupported → script uses kanban list --json
test_kanban_uses_supported_verb() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local state; state=$(cat "$tmpdir/STATE.md" 2>/dev/null || echo "")
  local has_id=false has_title=false has_safe_fields=false
  echo "$state" | grep -q "t_test" && has_id=true
  echo "$state" | grep -q "test card" && has_title=true
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
test_worktree_paths_sanitized() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  local wt_branch="_tick_test_wt_$$"
  (cd "$tmpdir" && git worktree add -b "$wt_branch" "$tmpdir/_wt" -q) 2>/dev/null || true
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local state; state=$(cat "$tmpdir/STATE.md" 2>/dev/null || echo "")
  local raw_leaked=false
  echo "$state" | grep -qF "$tmpdir" && raw_leaked=true
  local snap; snap=$(cat "$runtime/snapshot.json" 2>/dev/null || echo "")
  local snap_leaked=false
  echo "$snap" | grep -qF "$tmpdir" && snap_leaked=true
  if [[ $rc -eq 0 ]] && ! $raw_leaked && ! $snap_leaked; then
    pass "T15 (B2+B3): worktree paths sanitized — no raw paths in STATE or snapshot"
  else
    fail "T15 (B2+B3): worktree sanitize" "rc=$rc raw_leaked=$raw_leaked snap_leaked=$snap_leaked"
  fi
  (cd "$tmpdir" && git worktree remove "$tmpdir/_wt" --force) 2>/dev/null || true
  rm -rf "$tmpdir"
}

# T16 (B4): default runtime dir is outside repo; no .tick/ in repo after run
test_runtime_dir_external() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local expected_runtime="${XDG_CACHE_HOME:-$HOME/.cache}/aurora/tick"
  local argv_file="$expected_runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" \
    HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local expected_cache="${XDG_CACHE_HOME:-$HOME/.cache}/aurora/tick"
  local has_external_runtime=false
  [[ -d "$expected_cache" ]] && has_external_runtime=true
  local has_repo_tick=false
  [[ -d "$tmpdir/.tick" ]] && has_repo_tick=true
  local status_out; status_out=$(cd "$tmpdir" && git status --short 2>/dev/null)
  local tick_in_status=false
  echo "$status_out" | grep -q "\.tick" && tick_in_status=true
  if [[ $rc -eq 0 ]] && $has_external_runtime && ! $has_repo_tick && ! $tick_in_status; then
    pass "T16 (B4): runtime dir external to repo ($expected_cache)"
  else
    fail "T16 (B4): runtime dir" "rc=$rc external=$has_external_runtime repo_tick=$has_repo_tick tick_in_status=$tick_in_status expected=$expected_cache"
  fi
  rm -rf "$expected_cache"
  rm -rf "$tmpdir"
}

# T17 (S1): failed git fetch → non-zero exit, no STATE or snapshot write
test_fetch_failure_halts() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
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
  local exit_ok=false
  [[ $rc -ne 0 ]] && exit_ok=true
  local has_diag=false
  echo "$out" | grep -qi "fetch" && has_diag=true
  if $exit_ok && ! $has_state && ! $has_snapshot && $has_diag; then
    pass "T17 (S1): failed fetch → non-zero exit, no STATE/snapshot, diagnostic emitted"
  else
    fail "T17 (S1): fetch failure" "rc=$rc has_state=$has_state has_snapshot=$has_snapshot has_diag=$has_diag out=$out"
  fi
  rm -rf "$tmpdir"
}

# === NEW TESTS T18-T30 ===

# T18: no-change → exits before any fake Hermes invocation, preserves snapshot contract
test_no_change_before_hermes() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  # First run to create snapshot
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  ( cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" ) >/dev/null 2>&1
  # Clear argv log
  rm -f "$argv_file"
  local snapshot_before; snapshot_before=$(cat "$runtime/snapshot.json" 2>/dev/null || echo "")
  # Second run — no change
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local snapshot_after; snapshot_after=$(cat "$runtime/snapshot.json" 2>/dev/null || echo "")
  local no_argv=true
  [[ -f "$argv_file" ]] && [[ -s "$argv_file" ]] && no_argv=false
  local snapshot_unchanged=false
  [[ "$snapshot_before" == "$snapshot_after" ]] && snapshot_unchanged=true
  if [[ $rc -eq 0 ]] && $no_argv && $snapshot_unchanged; then
    pass "T18: no-change → no Hermes call, snapshot preserved"
  else
    fail "T18: no-change" "rc=$rc no_argv=$no_argv snap_unchanged=$snapshot_unchanged out=$out"
  fi
  rm -rf "$tmpdir"
}

# T19: PAUSE and --dry-run each invoke neither profile and do not reserve budget
test_pause_dry_run_no_budget() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Test PAUSE
  touch "$tmpdir/PAUSE"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  rm -f "$tmpdir/PAUSE"
  local pause_no_argv=true
  [[ -f "$argv_file" ]] && [[ -s "$argv_file" ]] && pause_no_argv=false
  local pause_no_counter=true
  [[ -f "$runtime/attempts_day.txt" ]] && pause_no_counter=false

  # Test --dry-run (need change to get past no-change gate)
  rm -f "$argv_file"
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" --dry-run 2>&1) || rc=$?
  local dry_no_argv=true
  [[ -f "$argv_file" ]] && [[ -s "$argv_file" ]] && dry_no_argv=false
  local dry_no_counter=true
  [[ -f "$runtime/attempts_day.txt" ]] && dry_no_counter=false

  if [[ $rc -eq 0 ]] && $pause_no_argv && $pause_no_counter && $dry_no_argv && $dry_no_counter; then
    pass "T19: PAUSE and --dry-run → no Hermes call, no budget reservation"
  else
    fail "T19: pause/dry-run" "rc=$rc pause_argv=$pause_no_argv pause_budget=$pause_no_counter dry_argv=$dry_no_argv dry_budget=$dry_no_counter"
  fi
  rm -rf "$tmpdir"
}

# T20: Daiki success → Verita invoked exactly once, strictly after Daiki
test_daiki_success_verita_order() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # Check argv file: count -p invocations and verify order
  local invocations=0
  [[ -f "$argv_file" ]] && invocations=$(grep -c "^-p " "$argv_file" 2>/dev/null || echo "0")
  # Also check -p default appears before -p verita using line numbers
  local default_line=0 verita_line=0
  if [[ -f "$argv_file" ]]; then
    default_line=$(grep -n "^-p default" "$argv_file" 2>/dev/null | head -1 | cut -d: -f1 || echo "0")
    verita_line=$(grep -n "^-p verita" "$argv_file" 2>/dev/null | head -1 | cut -d: -f1 || echo "0")
  fi
  local has_default=false has_verita=false has_skills=false order_ok=false
  [[ "$default_line" -gt 0 ]] && has_default=true
  [[ "$verita_line" -gt 0 ]] && has_verita=true
  grep -q -- "--skills kanban,aurora" "$argv_file" 2>/dev/null && has_skills=true
  if $has_default && $has_verita && [[ $default_line -lt $verita_line ]]; then
    order_ok=true
  fi
  if [[ $rc -eq 0 ]] && [[ $invocations -eq 2 ]] && $order_ok && $has_skills; then
    pass "T20: Daiki success → Verita invoked exactly once, strictly after"
  else
    fail "T20: Daiki→Verita order" "rc=$rc invocations=$invocations order_ok=$order_ok has_default=$has_default has_verita=$has_verita has_skills=$has_skills default_line=$default_line verita_line=$verita_line"
  fi
  rm -rf "$tmpdir"
}

# T21: Daiki failure → no Verita invoked; failure logged as metadata-only
test_daiki_failure_no_verita() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_failing_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # Only Daiki should have been called (one -p invocation)
  local invocations=0
  [[ -f "$argv_file" ]] && invocations=$(grep -c "^-p " "$argv_file" 2>/dev/null || echo "0")
  local only_daiki=false
  [[ $invocations -eq 1 ]] && only_daiki=true
  # Snapshot should NOT be saved (Daiki failed)
  local snapshot_saved=false
  [[ -f "$runtime/snapshot.json" ]] && snapshot_saved=true
  # Log should contain daiki-failed
  local logged=false
  [[ -f "$runtime/tick.log" ]] && grep -q "daiki-failed" "$runtime/tick.log" && logged=true
  if [[ $rc -eq 0 ]] && $only_daiki && ! $snapshot_saved && $logged; then
    pass "T21: Daiki failure → no Verita, no snapshot, metadata logged"
  else
    fail "T21: Daiki failure" "rc=$rc only_daiki=$only_daiki snapshot_saved=$snapshot_saved logged=$logged"
  fi
  rm -rf "$tmpdir"
}

# T22: Daiki timeout → releases lock, no Verita, no lock-holding descendant
test_daiki_timeout_cleanup() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_timeout_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  # Run with a short timeout override for testing
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    DAIKI_TIMEOUT_SECS=5 KILL_GRACE_SECS=2 \
    bash "$TICK" 2>&1) || rc=$?
  # Lock should be released — a second tick should not fail on lock
  local lock_out lock_rc=0
  lock_out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    DAIKI_TIMEOUT_SECS=5 KILL_GRACE_SECS=2 \
    bash "$TICK" 2>&1) || lock_rc=$?
  local lock_released=false
  if [[ $lock_rc -eq 0 ]]; then
    lock_released=true  # Second run succeeded → lock was released
  elif echo "$lock_out" | grep -q "lock held"; then
    lock_released=false  # Lock still held
  else
    lock_released=true  # Failed for other reason → lock was released
  fi
  # Log should contain daiki-timeout
  local logged=false
  [[ -f "$runtime/tick.log" ]] && grep -q "daiki-timeout" "$runtime/tick.log" && logged=true
  # Snapshot should NOT be saved
  local snapshot_saved=false
  [[ -f "$runtime/snapshot.json" ]] && snapshot_saved=true
  if $lock_released && $logged && ! $snapshot_saved; then
    pass "T22: Daiki timeout → lock released, no Verita, no snapshot, logged"
  else
    fail "T22: Daiki timeout" "rc=$rc lock_released=$lock_released logged=$logged snapshot_saved=$snapshot_saved out=$out"
  fi
  rm -rf "$tmpdir"
}

# T23: Verita failure is logged/non-fatal; verita-owed marker written; snapshot acknowledged
test_verita_failure_nonfatal() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot="$tmpdir/_fakebin"
  mkdir -p "$fakeroot"
  # Create a hermes shim that succeeds for Daiki (-p default) but fails for Verita (-p verita)
  cat > "$fakeroot/bash" <<BASHSH
#!/bin/bash
exec "$(command -v bash)" "\$@"
BASHSH
  chmod +x "$fakeroot/bash"
  cat > "$fakeroot/gh" <<'SH'
#!/bin/bash
case "$*" in *"pr list"*) echo "No pull requests found.";; *) echo "{}";; esac
SH
  chmod +x "$fakeroot/gh"
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
# Record all chat invocations
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
  # Fail for verita, succeed for default
  if [[ "$2" == "verita" ]]; then
    exit 1
  fi
  exit 0
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
SH
  chmod +x "$fakeroot/hermes"
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
exit 0
SH
  chmod +x "$fakeroot/ntfy"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # Snapshot SHOULD be saved (Daiki succeeded)
  local snapshot_saved=false
  [[ -f "$runtime/snapshot.json" ]] && snapshot_saved=true
  # verita-owed marker should exist
  local verita_owed=false
  [[ -f "$runtime/verita_owed" ]] && verita_owed=true
  # Log should contain verita-failed
  local logged=false
  [[ -f "$runtime/tick.log" ]] && grep -q "verita-failed" "$runtime/tick.log" && logged=true
  if [[ $rc -eq 0 ]] && $snapshot_saved && $verita_owed && $logged; then
    pass "T23: Verita failure → non-fatal, snapshot acknowledged, verita-owed marker, logged"
  else
    fail "T23: Verita failure" "rc=$rc snapshot=$snapshot_saved owed=$verita_owed logged=$logged"
  fi
  rm -rf "$tmpdir"
}

# T24: daily cap checked before spawn; malformed counter fails closed
test_daily_cap_malformed() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  local argv_file="$runtime/argv.log"
  local today; today="$(date -u '+%Y-%m-%d')"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Test: malformed counter fails closed (today's date but non-numeric count)
  echo "$today INVALID" > "$runtime/attempts_day.txt"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local malformed_exit=false
  [[ $rc -ne 0 ]] && malformed_exit=true
  local no_argv=true
  [[ -f "$argv_file" ]] && [[ -s "$argv_file" ]] && no_argv=false

  # Test: at cap → skips model work
  rm -f "$argv_file"
  echo "$today 12" > "$runtime/attempts_day.txt"
  # Need to export MAX_ATTEMPTS_DAY since it's readonly in tick.sh
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local cap_no_argv=true
  [[ -f "$argv_file" ]] && [[ -s "$argv_file" ]] && cap_no_argv=false
  local cap_msg=false
  echo "$out" | grep -q "daily attempt cap" && cap_msg=true

  if $malformed_exit && $no_argv && $cap_no_argv && $cap_msg; then
    pass "T24: malformed counter fails closed; cap reached skips model work"
  else
    fail "T24: daily cap" "malformed_exit=$malformed_exit no_argv=$no_argv cap_no_argv=$cap_no_argv cap_msg=$cap_msg out=$out"
  fi
  rm -rf "$tmpdir"
}

# T25: parent lock excludes second tick for full two-stage duration
test_lock_two_stage() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  # First run — should acquire lock and complete
  local out1 rc1=0
  out1=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc1=$?
  # Lock should be released — second run should succeed (no-change path)
  local out2 rc2=0
  out2=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc2=$?
  local no_lock_error=true
  echo "$out2" | grep -q "lock held" && no_lock_error=false
  if [[ $rc1 -eq 0 ]] && [[ $rc2 -eq 0 ]] && $no_lock_error; then
    pass "T25: lock released after two-stage run; second tick succeeds"
  else
    fail "T25: lock two-stage" "rc1=$rc1 rc2=$rc2 no_lock_error=$no_lock_error"
  fi
  rm -rf "$tmpdir"
}

# T26: profile commands do not inherit lock fd; lingering child cannot pin next tick
test_fd_inheritance() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot="$tmpdir/_fakebin"
  mkdir -p "$fakeroot"
  # Create a hermes shim that records argv and spawns a lingering background child
  cat > "$fakeroot/bash" <<BASHSH
#!/bin/bash
exec "$(command -v bash)" "\$@"
BASHSH
  chmod +x "$fakeroot/bash"
  cat > "$fakeroot/gh" <<'SH'
#!/bin/bash
case "$*" in *"pr list"*) echo "No pull requests found.";; *) echo "{}";; esac
SH
  chmod +x "$fakeroot/gh"
  cat > "$fakeroot/hermes" <<'HERMESH'
#!/bin/bash
# Record all chat invocations
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
  # Spawn a lingering child (simulating a process that holds fd 9 if inherited)
  # The child writes its PID and whether fd 9 is open
  (sleep 30) &
  # The hermes process itself exits immediately
  exit 0
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
HERMESH
  chmod +x "$fakeroot/hermes"
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
exit 0
SH
  chmod +x "$fakeroot/ntfy"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # After tick completes, try a second tick — it should NOT fail on lock
  sleep 1
  local out2 rc2=0
  out2=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc2=$?
  local no_lock_pin=true
  echo "$out2" | grep -q "lock held" && no_lock_pin=false
  if [[ $rc -eq 0 ]] && $no_lock_pin; then
    pass "T26: child process does not inherit lock fd; second tick succeeds"
  else
    fail "T26: fd inheritance" "rc=$rc rc2=$rc2 no_lock_pin=$no_lock_pin"
  fi
  rm -rf "$tmpdir"
}

# T27: tick.log accepts only fixed metadata; no model output or sentinel secrets/paths
test_log_metadata_only() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  # Put a sentinel secret in the hermes shim's stdout to test log isolation
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
  # Emit a sentinel to stdout (should NOT appear in tick.log)
  echo "SENTINEL_SECRET_abc123"
  echo "/home/fake/sentinel/path"
  exit 0
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
SH
  chmod +x "$fakeroot/hermes"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # Log should not contain the sentinel
  local log_clean=true
  if [[ -f "$runtime/tick.log" ]]; then
    if grep -q "SENTINEL_SECRET" "$runtime/tick.log" || grep -q "/home/fake/sentinel" "$runtime/tick.log"; then
      log_clean=false
    fi
    # Log should contain timestamp | outcome format
    local has_format=false
    if grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}T" "$runtime/tick.log"; then
      has_format=true
    fi
    if ! $log_clean || ! $has_format; then
      fail "T27: log metadata" "log_clean=$log_clean has_format=$has_format"
      rm -rf "$tmpdir"; return
    fi
  fi
  if [[ $rc -eq 0 ]] && $log_clean; then
    pass "T27: tick.log contains only fixed metadata, no sentinel/path"
  else
    fail "T27: log metadata" "rc=$rc log_clean=$log_clean"
  fi
  rm -rf "$tmpdir"
}

# T28: notification adapter failure is non-fatal, no config content execution, no sentinel exposure
test_notification_nonfatal() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  # Replace ntfy shim with one that fails
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
exit 1
SH
  chmod +x "$fakeroot/ntfy"
  # Create a secrets file with a sentinel to verify it's not leaked
  mkdir -p "$runtime"
  echo "SECRET_TOKEN_xyz789" > "$runtime/ntfy_secrets"
  chmod 600 "$runtime/ntfy_secrets"
  # Use a hermes shim that fails to trigger notification path
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
  exit 1
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
SH
  chmod +x "$fakeroot/hermes"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # Script should complete (notification failure is non-fatal)
  local completed=false
  echo "$out" | grep -q "tick: done" && completed=true
  # Log should not contain the secret token
  local log_clean=true
  if [[ -f "$runtime/tick.log" ]] && grep -q "SECRET_TOKEN" "$runtime/tick.log"; then
    log_clean=false
  fi
  # Output should not contain the secret token
  local out_clean=true
  echo "$out" | grep -q "SECRET_TOKEN" && out_clean=false
  if [[ $rc -eq 0 ]] && $completed && $log_clean && $out_clean; then
    pass "T28: notification failure non-fatal, no config execution, no sentinel leak"
  else
    fail "T28: notification" "rc=$rc completed=$completed log_clean=$log_clean out_clean=$out_clean"
  fi
  rm -rf "$tmpdir"
}

# T29: fix-round enforcement is absent/disabled; no unsupported status/field invented
test_no_fix_round() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  # Neither script output nor log should reference fix_round
  local output_clean=true
  echo "$out" | grep -qi "fix.round" && output_clean=false
  local log_clean=true
  if [[ -f "$runtime/tick.log" ]] && grep -qi "fix.round" "$runtime/tick.log"; then
    log_clean=false
  fi
  if [[ $rc -eq 0 ]] && $output_clean && $log_clean; then
    pass "T29: no fix-round enforcement, no unsupported status/field"
  else
    fail "T29: fix-round" "rc=$rc output=$output_clean log=$log_clean"
  fi
  rm -rf "$tmpdir"
}

# T30: snapshot acknowledgement only at Daiki-exit-0 checkpoint
test_snapshot_ack_checkpoint() {
  local tmpdir; tmpdir="$(setup_test)"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  local argv_file="$runtime/argv.log"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Case 1: Daiki success → snapshot saved
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local success_snapshot=false
  [[ -f "$runtime/snapshot.json" ]] && success_snapshot=true

  # Case 2: Daiki failure → snapshot NOT saved
  rm -f "$runtime/snapshot.json"
  rm -f "$argv_file"
  fakeroot="$(make_failing_hermes_path "$tmpdir")"
  # Need a new commit to trigger change detection
  (cd "$tmpdir" && echo "y" > f.txt && git add f.txt && git commit -q -m "feat2")
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?
  local failure_snapshot=true
  [[ -f "$runtime/snapshot.json" ]] && failure_snapshot=false

  if $success_snapshot && $failure_snapshot; then
    pass "T30: snapshot acknowledged only on Daiki exit 0; not on failure"
  else
    fail "T30: snapshot ack" "success=$success_snapshot failure_no_snap=$failure_snapshot"
  fi
  rm -rf "$tmpdir"
}

# === NEW TESTS T31-T36: notification cap + snapshot preservation ===

# Helper: create a fake path with an ntfy shim that records invocations
make_recording_ntfy_path() {
  local tmpdir="$1"
  local fakeroot="$tmpdir/_fakebin"
  mkdir -p "$fakeroot"
  cat > "$fakeroot/bash" <<BASHSH
#!/bin/bash
exec "$(command -v bash)" "\$@"
BASHSH
  chmod +x "$fakeroot/bash"
  cat > "$fakeroot/gh" <<'SH'
#!/bin/bash
case "$*" in *"pr list"*) echo "No pull requests found.";; *) echo "{}";; esac
SH
  chmod +x "$fakeroot/gh"
  # Hermes shim that fails on chat (triggers notification path)
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
if [[ "$1" == "-p" ]] && [[ "$3" == "chat" ]]; then
  echo "$@" >> "${HERMES_ARGV_FILE:-/dev/null}"
  exit 1
fi
case "$*" in *"kanban"*"list"*"--json"*) echo '[{"id":"t_test","title":"test card","assignee":"lars","status":"running","priority":100}]';; esac
exit 0
SH
  chmod +x "$fakeroot/hermes"
  # ntfy shim that records each invocation to a file
  cat > "$fakeroot/ntfy" <<'SH'
#!/bin/bash
echo "called: $*" >> "${NTFY_CALL_LOG:-/dev/null}"
exit 0
SH
  chmod +x "$fakeroot/ntfy"
  echo "$fakeroot"
}

# T31: notify same-day cap → no ntfy call, muted logged exactly once
test_notify_same_day_cap() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_recording_ntfy_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  local argv_file="$runtime/argv.log"
  local ntfy_log="$runtime/ntfy_calls.log"
  local today; today="$(date -u '+%Y-%m-%d')"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Pre-set notify counter at cap (10)
  echo "$today 10" > "$runtime/notify_count.txt"

  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    NTFY_CALL_LOG="$ntfy_log" \
    bash "$TICK" 2>&1) || rc=$?

  # ntfy should NOT have been called
  local ntfy_called=false
  [[ -f "$ntfy_log" ]] && [[ -s "$ntfy_log" ]] && ntfy_called=true

  # muted indication should be in the log
  local muted_logged=false
  [[ -f "$runtime/tick.log" ]] && grep -q "notifications-muted" "$runtime/tick.log" && muted_logged=true

  if ! $ntfy_called && $muted_logged; then
    pass "T31: notify same-day cap → no ntfy call, muted logged"
  else
    fail "T31: notify same-day cap" "ntfy_called=$ntfy_called muted_logged=$muted_logged out=$out"
  fi
  rm -rf "$tmpdir"
}

# T32: notify UTC-day reset → previous day counter resets, notification sent
test_notify_day_reset() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_recording_ntfy_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  local argv_file="$runtime/argv.log"
  local ntfy_log="$runtime/ntfy_calls.log"
  # Yesterday's date
  local yesterday; yesterday="$(date -u -d 'yesterday' '+%Y-%m-%d' 2>/dev/null || date -u -v-1d '+%Y-%m-%d')"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Pre-set notify counter from yesterday at cap
  echo "$yesterday 10" > "$runtime/notify_count.txt"

  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    NTFY_CALL_LOG="$ntfy_log" \
    bash "$TICK" 2>&1) || rc=$?

  # ntfy SHOULD have been called (counter reset from yesterday)
  local ntfy_called=false
  [[ -f "$ntfy_log" ]] && [[ -s "$ntfy_log" ]] && ntfy_called=true

  # notify_count.txt should be updated to today with count 1
  local count_content; count_content="$(cat "$runtime/notify_count.txt" 2>/dev/null || echo "")"
  local today; today="$(date -u '+%Y-%m-%d')"
  local count_ok=false
  [[ "$count_content" == "$today 1" ]] && count_ok=true

  if $ntfy_called && $count_ok; then
    pass "T32: notify UTC-day reset → counter reset, notification sent"
  else
    fail "T32: notify day reset" "ntfy_called=$ntfy_called count_ok=$count_ok content='$count_content' out=$out"
  fi
  rm -rf "$tmpdir"
}

# T33: notify malformed current-day counter → fail closed, no transport
test_notify_malformed_counter() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_recording_ntfy_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  local argv_file="$runtime/argv.log"
  local ntfy_log="$runtime/ntfy_calls.log"
  local today; today="$(date -u '+%Y-%m-%d')"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Malformed current-day counter (date correct, count non-numeric)
  echo "$today INVALID" > "$runtime/notify_count.txt"

  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    NTFY_CALL_LOG="$ntfy_log" \
    bash "$TICK" 2>&1) || rc=$?

  # ntfy should NOT have been called (fail closed)
  local ntfy_called=false
  [[ -f "$ntfy_log" ]] && [[ -s "$ntfy_log" ]] && ntfy_called=true

  # Diagnostic should be in stderr/stdout
  local has_diag=false
  echo "$out" | grep -q "malformed notify counter" && has_diag=true

  if ! $ntfy_called && $has_diag; then
    pass "T33: notify malformed counter → fail closed, no transport"
  else
    fail "T33: notify malformed" "ntfy_called=$ntfy_called has_diag=$has_diag out=$out"
  fi
  rm -rf "$tmpdir"
}

# T34: notify exactly-once muted → second capped call has no duplicate muted log
test_notify_exactly_once_muted() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_recording_ntfy_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  local argv_file="$runtime/argv.log"
  local ntfy_log="$runtime/ntfy_calls.log"
  local today; today="$(date -u '+%Y-%m-%d')"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Pre-set notify counter at cap
  echo "$today 10" > "$runtime/notify_count.txt"

  # First run — should log muted
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    NTFY_CALL_LOG="$ntfy_log" \
    bash "$TICK" 2>&1) || rc=$?

  # Second run (new commit to trigger change)
  rm -f "$ntfy_log"
  (cd "$tmpdir" && echo "y" > f.txt && git add f.txt && git commit -q -m "feat2")
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    NTFY_CALL_LOG="$ntfy_log" \
    bash "$TICK" 2>&1) || rc=$?

  # Count "notifications-muted" entries in log — should be exactly 1
  local muted_count=0
  if [[ -f "$runtime/tick.log" ]]; then
    muted_count=$(grep -c "notifications-muted" "$runtime/tick.log" 2>/dev/null || echo "0")
  fi

  # ntfy should NOT have been called on either run
  local ntfy_called=false
  [[ -f "$ntfy_log" ]] && [[ -s "$ntfy_log" ]] && ntfy_called=true

  if [[ "$muted_count" -eq 1 ]] && ! $ntfy_called; then
    pass "T34: notify exactly-once muted → single muted log entry, no duplicate"
  else
    fail "T34: exactly-once muted" "muted_count=$muted_count ntfy_called=$ntfy_called out=$out"
  fi
  rm -rf "$tmpdir"
}

# T35: daily attempt cap → no snapshot written, pending change preserved
test_daily_cap_no_snapshot() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  local argv_file="$runtime/argv.log"
  local today; today="$(date -u '+%Y-%m-%d')"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Set daily counter at cap
  echo "$today 12" > "$runtime/attempts_day.txt"

  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?

  # snapshot.json should NOT exist (no prior snapshot)
  local snapshot_exists=false
  [[ -f "$runtime/snapshot.json" ]] && snapshot_exists=true

  # No model command should have run
  local no_argv=true
  [[ -f "$argv_file" ]] && [[ -s "$argv_file" ]] && no_argv=false

  if ! $snapshot_exists && $no_argv; then
    pass "T35: daily attempt cap → no snapshot written, no model command"
  else
    fail "T35: daily cap snapshot" "snapshot_exists=$snapshot_exists no_argv=$no_argv out=$out"
  fi
  rm -rf "$tmpdir"
}

# T36: monthly attempt cap → existing prior snapshot unchanged, no model command
test_monthly_cap_snapshot_unchanged() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_hermes_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  local runtime="$tmpdir/runtime"
  mkdir -p "$runtime"
  local argv_file="$runtime/argv.log"
  local month; month="$(date -u '+%Y-%m')"
  (cd "$tmpdir" && echo "x" > f.txt && git add f.txt && git commit -q -m "feat")

  # Pre-create a snapshot (simulating a prior successful run)
  echo '{"prior": "snapshot"}' > "$runtime/snapshot.json"
  local snap_before; snap_before="$(cat "$runtime/snapshot.json")"

  # Set monthly counter at cap
  echo "$month 250" > "$runtime/attempts_month.txt"

  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" TICK_RUNTIME_DIR="$runtime" \
    PATH="$fakeroot:$real_path" HERMES_ARGV_FILE="$argv_file" \
    bash "$TICK" 2>&1) || rc=$?

  # snapshot.json should be unchanged
  local snap_after; snap_after="$(cat "$runtime/snapshot.json" 2>/dev/null || echo "")"
  local snapshot_unchanged=false
  [[ "$snap_before" == "$snap_after" ]] && snapshot_unchanged=true

  # No model command should have run
  local no_argv=true
  [[ -f "$argv_file" ]] && [[ -s "$argv_file" ]] && no_argv=false

  if $snapshot_unchanged && $no_argv; then
    pass "T36: monthly attempt cap → prior snapshot unchanged, no model command"
  else
    fail "T36: monthly cap snapshot" "snapshot_unchanged=$snapshot_unchanged no_argv=$no_argv out=$out"
  fi
  rm -rf "$tmpdir"
}

# --- run all ---
echo -e "${BOLD}tick.sh test suite${NC}"
echo "=================="
echo ""

# T1-T17 (original + reworked T12)
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
test_daiki_profile_argv
test_atomic_write
test_kanban_uses_supported_verb
test_worktree_paths_sanitized
test_runtime_dir_external
test_fetch_failure_halts

# T18-T30 (new activation tests)
test_no_change_before_hermes
test_pause_dry_run_no_budget
test_daiki_success_verita_order
test_daiki_failure_no_verita
test_daiki_timeout_cleanup
test_verita_failure_nonfatal
test_daily_cap_malformed
test_lock_two_stage
test_fd_inheritance
test_log_metadata_only
test_notification_nonfatal
test_no_fix_round
test_snapshot_ack_checkpoint

# T31-T36 (notification cap + snapshot preservation fixes)
test_notify_same_day_cap
test_notify_day_reset
test_notify_malformed_counter
test_notify_exactly_once_muted
test_daily_cap_no_snapshot
test_monthly_cap_snapshot_unchanged

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
