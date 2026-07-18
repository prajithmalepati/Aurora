//! Deterministic fixture DB seeder for Q8.4 browser evidence.
//!
//! Creates a fresh synthetic SQLite database using the real `aurora_core`
//! database and query APIs.  For test use only — not a production tool.

use std::env;
use std::path::{Path, PathBuf};

fn main() {
    let db_path = match parse_args() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error: {e}");
            eprintln!("Usage: seed_test_db --db <absolute-path-to-new-db>");
            std::process::exit(1);
        }
    };

    if let Err(e) = validate_path(&db_path) {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }

    if let Err(e) = seed(&db_path) {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

// ── CLI parsing ─────────────────────────────────────────────────────────

fn parse_args() -> Result<PathBuf, String> {
    let args: Vec<String> = env::args().collect();
    let mut db_arg: Option<String> = None;
    let mut i = 1;
    while i < args.len() {
        if args[i] == "--db" {
            i += 1;
            if i >= args.len() {
                return Err("--db requires a value".into());
            }
            db_arg = Some(args[i].clone());
        } else {
            return Err(format!("unknown argument: {}", args[i]));
        }
        i += 1;
    }
    db_arg.ok_or_else(|| "missing required argument: --db <path>".into()).map(PathBuf::from)
}

// ── Path safety checks ──────────────────────────────────────────────────

fn validate_path(db_path: &Path) -> Result<(), String> {
    if db_path.exists() {
        return Err(format!("target file already exists: {}", db_path.display()));
    }
    if !db_path.is_absolute() {
        return Err("path must be absolute".into());
    }
    let parent = db_path
        .parent()
        .ok_or("cannot determine parent directory")?;
    let canonical = parent
        .canonicalize()
        .map_err(|e| format!("cannot resolve parent directory: {e}"))?;
    let temp = env::temp_dir()
        .canonicalize()
        .map_err(|e| format!("cannot resolve temp dir: {e}"))?;
    if !canonical.starts_with(&temp) {
        return Err(format!(
            "path must be under the system temporary directory ({}), got {}",
            temp.display(),
            canonical.display()
        ));
    }
    Ok(())
}

// ── Seeding ─────────────────────────────────────────────────────────────

fn seed(db_path: &Path) -> Result<(), anyhow::Error> {
    let conn = aurora_core::db::open_and_migrate(db_path)?;

    // Tags
    let tag_names = ["rock", "fast", "chill", "anime", "jazz"];
    for name in &tag_names {
        aurora_core::db::queries::create_tag(&conn, name)?;
    }

    // Songs
    let songs: &[(&str, &str, Option<&str>, &[&str])] = &[
        ("Highway Star", "Deep Purple", Some("Machine Head"), &["rock", "fast"]),
        ("Autumn Leaves", "Bill Evans", Some("Portrait in Jazz"), &["chill", "jazz"]),
        ("Unravel", "TK", Some("Tokyo Ghoul OST"), &["anime", "rock"]),
        ("So What", "Miles Davis", Some("Kind of Blue"), &["jazz"]),
    ];
    let mut song_ids = Vec::new();
    for (title, artist, album, _tags) in songs {
        let id = aurora_core::db::queries::create_song(&conn, title, artist, *album, None, None)?;
        song_ids.push(id);
    }

    // Tag assignments
    for (i, (_, _, _, tags)) in songs.iter().enumerate() {
        let tag_strings: Vec<String> = tags.iter().map(|s| s.to_string()).collect();
        aurora_core::db::queries::assign_tags(&conn, song_ids[i], &tag_strings)?;
    }

    // Playlists
    let pl1 = aurora_core::db::queries::create_playlist(&conn, "Rock Classics", Some("#E63946"), None)?;
    let pl2 = aurora_core::db::queries::create_playlist(&conn, "Jazz Standards", Some("#457B9D"), None)?;

    // Playlist membership: Rock Classics → Highway Star
    aurora_core::db::queries::add_song_to_playlist(&conn, pl1, song_ids[0])?;
    // Jazz Standards → Autumn Leaves, So What
    aurora_core::db::queries::add_song_to_playlist(&conn, pl2, song_ids[1])?;
    aurora_core::db::queries::add_song_to_playlist(&conn, pl2, song_ids[3])?;

    // Summary
    let (tags, _) = aurora_core::db::queries::list_tags(&conn)?;
    let tag_count = tags.len();
    let song_count: i64 = conn.query_row("SELECT COUNT(*) FROM songs", [], |r| r.get(0))?;
    let pl_count: i64 = conn.query_row("SELECT COUNT(*) FROM playlists", [], |r| r.get(0))?;
    let uv: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;

    println!("Seeded {db}", db = db_path.display());
    println!("  {tag_count} tags, {song_count} songs, {pl_count} playlists, user_version={uv}");
    Ok(())
}
