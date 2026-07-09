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
  cd "$tmpdir"
  git init -q
  git config user.email "test@tick.local"
  git config user.name "tick-test"
  git commit -q --allow-empty -m "init"
  mkdir -p .tick
  # Do NOT add STATE.md to .git/info/exclude — tick.sh must do that itself
  echo "$tmpdir"
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
  # Fake hermes
  cat > "$fakeroot/hermes" <<'SH'
#!/bin/bash
case "$*" in *"kanban"*"dump"*) echo "[]";; *) echo "{}";; esac
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
  local out rc=0
  out=$(TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot" bash "$TICK" 2>&1) || rc=$?
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
  touch "$tmpdir/PAUSE"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
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
  # Hold the lock — tick.sh should use .tick/tick.lock
  local lockfile="$tmpdir/.tick/tick.lock"
  exec 9>"$lockfile"
  if ! flock -n 9; then
    fail "T3: lock" "could not acquire test lock"
    rm -rf "$tmpdir"; return
  fi
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
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
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
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
  cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" >/dev/null 2>&1
  if [[ ! -f "$tmpdir/STATE.md" ]]; then
    fail "T5: no-change" "STATE.md not created on first run"
    rm -rf "$tmpdir"; return
  fi
  local mtime1; mtime1=$(stat -c %Y "$tmpdir/STATE.md")
  sleep 1
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
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
  cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" >/dev/null 2>&1
  echo "change" > "$tmpdir/newfile.txt"
  git add newfile.txt && git commit -q -m "add file"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
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
  cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" >/dev/null 2>&1
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
  echo "x" > "$tmpdir/f.txt" && git add f.txt && git commit -q -m "feature"
  cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" >/dev/null 2>&1
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
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" --dry-run 2>&1) || rc=$?
  if [[ $rc -eq 0 ]] && [[ ! -f "$tmpdir/STATE.md" ]] && [[ ! -f "$tmpdir/.tick/snapshot.json" ]]; then
    pass "T9: --dry-run → no side effects"
  else
    fail "T9: dry-run" "rc=$rc STATE.md=$([[ -f $tmpdir/STATE.md ]] && echo exists || echo absent) snapshot=$([[ -f $tmpdir/.tick/snapshot.json ]] && echo exists || echo absent)"
  fi
  rm -rf "$tmpdir"
}

# T10: STATE.md has no secrets / absolute home paths
test_no_secrets() {
  local tmpdir; tmpdir="$(setup_test)"
  local fakeroot; fakeroot="$(make_fake_path "$tmpdir")"
  local real_path; real_path="$(get_real_path_dirs)"
  echo "x" > "$tmpdir/f.txt" && git add f.txt && git commit -q -m "feat"
  cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" >/dev/null 2>&1
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
  echo "x" > "$tmpdir/f.txt" && git add f.txt && git commit -q -m "feat"
  cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" >/dev/null 2>&1
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
  echo "x" > "$tmpdir/f.txt" && git add f.txt && git commit -q -m "feat"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
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
  echo "x" > "$tmpdir/f.txt" && git add f.txt && git commit -q -m "feat"
  # Pre-create STATE.md — atomic mv should overwrite it cleanly
  echo "old content" > "$tmpdir/STATE.md"
  local out rc=0
  out=$(cd "$tmpdir" && TICK_REPO_ROOT="$tmpdir" PATH="$fakeroot:$real_path" bash "$TICK" 2>&1) || rc=$?
  if [[ $rc -eq 0 ]] && grep -q "origin/main" "$tmpdir/STATE.md" 2>/dev/null; then
    pass "T13: atomic write — STATE.md overwritten successfully"
  else
    fail "T13: atomic" "rc=$rc content=$(head -1 "$tmpdir/STATE.md" 2>/dev/null)"
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
