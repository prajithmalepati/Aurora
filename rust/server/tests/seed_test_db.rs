//! Integration tests for the `seed_test_db` binary.
//!
//! These tests build the binary with `cargo build` and then execute the resulting artifact directly.
//! They validate safety checks (path validation, arg rejection) and the seeded fixture contract.

use std::process::Command;

/// Helper: build the seed_test_db binary once and return the path to the artifact.
fn cargo_bin() -> std::path::PathBuf {
    // CARGO_MANIFEST_DIR = .../rust/server; workspace root = .../rust
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace_root = manifest_dir.parent().expect("server must have parent dir (rust/)");

    // Build the binary first (cached by cargo on subsequent runs)
    let build = Command::new("cargo")
        .args(["build", "-p", "aurora_server", "--bin", "seed_test_db"])
        .current_dir(workspace_root)
        .output()
        .expect("failed to run cargo build");
    assert!(build.status.success(), "cargo build failed: {}", String::from_utf8_lossy(&build.stderr));

    // The binary is at rust/target/debug/seed_test_db
    let bin_path = workspace_root.join("target/debug/seed_test_db");
    assert!(bin_path.exists(), "binary not found at {}", bin_path.display());
    bin_path
}

/// Run the seed_test_db binary with the given args and return (success, stdout, stderr).
fn run_seed(args: &[&str]) -> (bool, String, String) {
    let bin = cargo_bin();
    let output = Command::new(&bin)
        .args(args)
        .output()
        .expect("failed to execute seed_test_db");
    (
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).to_string(),
        String::from_utf8_lossy(&output.stderr).to_string(),
    )
}

// ── Test 1: Happy path — fresh temp DB gets seeded correctly ────────────

#[test]
fn seed_fresh_temp_db_succeeds() {
    let dir = tempfile::tempdir().expect("tempdir");
    let db_path = dir.path().join("test-fixture.db");
    let db_str = db_path.to_str().expect("path str");

    let (success, stdout, stderr) = run_seed(&["--db", db_str]);
    assert!(success, "seed_test_db failed.\nstdout: {stdout}\nstderr: {stderr}");

    // Verify counts and user_version via sqlite3
    let tag_count: i64 = query_scalar(&db_path, "SELECT COUNT(*) FROM tags");
    assert_eq!(tag_count, 5, "expected 5 tags");

    let song_count: i64 = query_scalar(&db_path, "SELECT COUNT(*) FROM songs");
    assert_eq!(song_count, 4, "expected 4 songs");

    let pl_count: i64 = query_scalar(&db_path, "SELECT COUNT(*) FROM playlists");
    assert_eq!(pl_count, 2, "expected 2 playlists");

    let uv: i64 = query_scalar(&db_path, "PRAGMA user_version");
    assert_eq!(uv, 5, "expected user_version = 5");

    // Verify specific tag names
    let tags: Vec<String> = query_column(&db_path, "SELECT name FROM tags ORDER BY name");
    assert_eq!(tags, vec!["anime", "chill", "fast", "jazz", "rock"]);

    // Verify specific song titles
    let songs: Vec<String> = query_column(&db_path, "SELECT title FROM songs ORDER BY title");
    assert_eq!(songs, vec!["Autumn Leaves", "Highway Star", "So What", "Unravel"]);

    // Verify specific playlist names
    let pls: Vec<String> = query_column(&db_path, "SELECT name FROM playlists ORDER BY name");
    assert_eq!(pls, vec!["Jazz Standards", "Rock Classics"]);

    // Verify tag assignments: Highway Star should have rock + fast
    let hs_tags: Vec<String> = query_column(
        &db_path,
        "SELECT t.name FROM tags t JOIN song_tags st ON t.id = st.tag_id \
         JOIN songs s ON st.song_id = s.id WHERE s.title = 'Highway Star' ORDER BY t.name",
    );
    assert_eq!(hs_tags, vec!["fast", "rock"]);

    // Verify playlist membership: Jazz Standards should have Autumn Leaves + So What
    let js_songs: Vec<String> = query_column(
        &db_path,
        "SELECT s.title FROM songs s JOIN playlist_songs ps ON s.id = ps.song_id \
         JOIN playlists p ON ps.playlist_id = p.id WHERE p.name = 'Jazz Standards' ORDER BY s.title",
    );
    assert_eq!(js_songs, vec!["Autumn Leaves", "So What"]);
}

// ── Test 2: Existing file is rejected and remains unmodified ────────────

#[test]
fn seed_rejects_existing_file() {
    let dir = tempfile::tempdir().expect("tempdir");
    let db_path = dir.path().join("existing.db");
    // Create the file before running the seeder
    std::fs::write(&db_path, b"original content").expect("create file");

    let (success, _stdout, stderr) = run_seed(&["--db", db_path.to_str().unwrap()]);
    assert!(!success, "should reject existing file");
    assert!(stderr.contains("already exists"), "stderr should mention 'already exists': {stderr}");

    // File must remain unmodified
    let content = std::fs::read(&db_path).expect("read");
    assert_eq!(content, b"original content", "file was modified by seed_test_db");
}

// ── Test 3: Path outside temp dir is rejected ───────────────────────────

#[test]
fn seed_rejects_non_temp_path() {
    // Derive a guaranteed-absent absolute path that is NOT under the system temp dir.
    // CARGO_MANIFEST_DIR = .../rust/server — use a sibling candidate inside the manifest dir tree.
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let non_temp = manifest_dir.join("test-evil-candidate-should-not-exist.db");
    assert!(!non_temp.exists(), "candidate path must not exist before test");

    let (success, _stdout, stderr) = run_seed(&["--db", non_temp.to_str().unwrap()]);
    assert!(!success, "should reject path outside temp dir");
    assert!(
        stderr.contains("temporary directory") || stderr.contains("temp"),
        "stderr should mention temp dir restriction: {stderr}"
    );
    // The file must remain absent — the binary must not create it
    assert!(!non_temp.exists(), "candidate path should not have been created");
}

// ── Test 4: Missing --db argument is rejected ───────────────────────────

#[test]
fn seed_rejects_missing_args() {
    let (success, _stdout, stderr) = run_seed(&[]);
    assert!(!success, "should reject missing --db arg");
    assert!(
        stderr.contains("--db") || stderr.contains("Usage"),
        "stderr should mention --db or usage: {stderr}"
    );
}

// ── Helpers: thin rusqlite wrappers for test assertions ──────────────────

fn query_scalar<T: rusqlite::types::FromSql>(db_path: &std::path::Path, sql: &str) -> T {
    let conn = rusqlite::Connection::open(db_path).expect("open db for verification");
    conn.query_row(sql, [], |row| row.get(0)).expect("query_scalar")
}

fn query_column<T: rusqlite::types::FromSql + std::fmt::Debug>(db_path: &std::path::Path, sql: &str) -> Vec<T> {
    let conn = rusqlite::Connection::open(db_path).expect("open db for verification");
    let mut stmt = conn.prepare(sql).expect("prepare");
    let rows = stmt.query_map([], |row| row.get(0)).expect("query_map");
    rows.map(|r| r.expect("row")).collect()
}
