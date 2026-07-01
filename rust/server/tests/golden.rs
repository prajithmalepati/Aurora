//! Golden parity test harness.
//!
//! Seeds in-memory DBs identically to Python `conftest.py:seed_database()`,
//! builds the axum router, and asserts every golden fixture matches.
//!
//! Each Python test module re-seeds the DB, so we replicate that with
//! separate test functions that each get a fresh seeded DB.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceExt;

use aurora_server::AppState;

// ── Seed data — must match backend/tests/conftest.py exactly ────────────

const TS_CREATE: &str = "2025-06-01T12:00:00Z";
const TS_CREATE_2: &str = "2025-06-01T12:01:00Z";

fn seed_database(conn: &aurora_core::rusqlite::Connection) {
    let songs: &[&[&str]] = &[
        &["1", "Highway Star", "Deep Purple", "Machine Head", "367",
          "/music/rock/Deep Purple - Highway Star.mp3", "mp3", "abc123def456.jpg",
          "local_scan", "320000", "44100", "16", "8812345",
          "[0.1,0.25,0.5,0.75,0.9,0.85,0.6,0.3,0.1,0.05]",
          "#E63946", "#457B9D", "-8.5", "0.95", "-7.2", "0.98",
          "[\"Deep Purple\"]", "NULL", TS_CREATE, "2025-06-01T12:30:00Z"],
        &["2", "Chill Vibes", "LoFi Girl", "NULL", "180",
          "NULL", "NULL", "NULL", "manual", "NULL", "NULL", "NULL", "NULL",
          "NULL", "NULL", "NULL", "NULL", "NULL", "NULL", "NULL",
          "NULL", "NULL", TS_CREATE_2, TS_CREATE_2],
        &["3", "Unravel", "TK from Ling Tosite Sigure", "Tokyo Ghoul OST", "240",
          "/music/anime/TK - Unravel.mp3", "mp3", "NULL",
          "local_scan", "256000", "44100", "16", "4801234",
          "[0.05,0.15,0.35,0.55,0.8,0.95,0.7,0.4,0.2,0.08]",
          "#2A9D8F", "#E9C46A", "-6.0", "0.88", "-5.5", "0.92",
          "[\"TK from Ling Tosite Sigure\"]", "[]", TS_CREATE, TS_CREATE],
    ];

    for s in songs {
        conn.execute(
            "INSERT INTO songs (id, title, artist, album, duration, file_path, file_format, \
             album_art_path, source, bitrate, sample_rate, bit_depth, file_size, \
             waveform_peaks, dominant_color, dominant_color_2, \
             replaygain_track_gain, replaygain_track_peak, \
             replaygain_album_gain, replaygain_album_peak, \
             artists, featured_artists, created_at, updated_at) \
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            aurora_core::rusqlite::params![
                s[0].parse::<i64>().unwrap(), s[1], s[2],
                if s[3] == "NULL" { None } else { Some(s[3]) },
                if s[4] == "NULL" { None } else { Some(s[4].parse::<i64>().unwrap()) },
                if s[5] == "NULL" { None } else { Some(s[5]) },
                if s[6] == "NULL" { None } else { Some(s[6]) },
                if s[7] == "NULL" { None } else { Some(s[7]) },
                s[8],
                if s[9] == "NULL" { None } else { Some(s[9].parse::<i64>().unwrap()) },
                if s[10] == "NULL" { None } else { Some(s[10].parse::<i64>().unwrap()) },
                if s[11] == "NULL" { None } else { Some(s[11].parse::<i64>().unwrap()) },
                if s[12] == "NULL" { None } else { Some(s[12].parse::<i64>().unwrap()) },
                if s[13] == "NULL" { None } else { Some(s[13]) },
                if s[14] == "NULL" { None } else { Some(s[14]) },
                if s[15] == "NULL" { None } else { Some(s[15]) },
                if s[16] == "NULL" { None } else { Some(s[16].parse::<f64>().unwrap()) },
                if s[17] == "NULL" { None } else { Some(s[17].parse::<f64>().unwrap()) },
                if s[18] == "NULL" { None } else { Some(s[18].parse::<f64>().unwrap()) },
                if s[19] == "NULL" { None } else { Some(s[19].parse::<f64>().unwrap()) },
                if s[20] == "NULL" { None } else { Some(s[20]) },
                if s[21] == "NULL" { None } else { Some(s[21]) },
                s[22], s[23]
            ],
        ).unwrap();
    }

    for &(id, name, ts) in &[
        (1i64, "rock", TS_CREATE), (2, "fast", TS_CREATE),
        (3, "slow", TS_CREATE_2), (4, "chill", TS_CREATE_2),
        (5, "anime", TS_CREATE), (6, "opening", TS_CREATE),
    ] {
        conn.execute(
            "INSERT INTO tags (id, name, created_at) VALUES (?1, ?2, ?3)",
            aurora_core::rusqlite::params![id, name, ts],
        ).unwrap();
    }

    for &(sid, tid) in &[
        (1i64, 1i64), (1, 2), (2, 3), (2, 4), (3, 5), (3, 6),
    ] {
        conn.execute(
            "INSERT INTO song_tags (song_id, tag_id) VALUES (?1, ?2)",
            aurora_core::rusqlite::params![sid, tid],
        ).unwrap();
    }

    for &(id, name, color, ts, ts2) in &[
        (1i64, "Rock Classics", "#E63946", TS_CREATE, TS_CREATE),
        (2, "Lo-Fi Study", "#457B9D", TS_CREATE_2, TS_CREATE_2),
        (3, "Anime", "#2A9D8F", TS_CREATE, TS_CREATE),
    ] {
        let (ce, cd) = if id == 2 { (Some(1i64), Some(8i64)) } else { (None, None) };
        conn.execute(
            "INSERT INTO playlists (id, name, color, crossfade_enabled, crossfade_duration_s, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            aurora_core::rusqlite::params![id, name, color, ce, cd, ts, ts2],
        ).unwrap();
    }

    for &(plid, sid, ts) in &[(1i64, 1i64, TS_CREATE), (2, 2, TS_CREATE_2), (3, 3, TS_CREATE)] {
        conn.execute(
            "INSERT INTO playlist_songs (playlist_id, song_id, position, start_time_ms, end_time_ms, added_at) \
             VALUES (?1, ?2, 0, 0, 0, ?3)",
            aurora_core::rusqlite::params![plid, sid, ts],
        ).unwrap();
    }

    conn.execute(
        "INSERT INTO watched_folders (id, folder_path, is_active, last_scan_at, created_at) \
         VALUES (1, '/music/rock', 1, NULL, ?1)",
        [TS_CREATE],
    ).unwrap();
}

// ── Test helpers ────────────────────────────────────────────────────────

fn load_golden(name: &str) -> Value {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent().unwrap().parent().unwrap()
        .join("backend/tests/golden").join(format!("{name}.json"));
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("Failed to read {}: {}", path.display(), e));
    serde_json::from_str(&text).unwrap()
}

fn build_test_app() -> (axum::Router, Arc<AppState>) {
    let conn = aurora_core::db::open_memory().expect("open_memory failed");
    seed_database(&conn);
    let state = Arc::new(AppState { conn: Mutex::new(conn) });
    (aurora_server::build_router(state.clone()), state)
}

async fn send(app: &axum::Router, req: Request<Body>) -> (StatusCode, Value) {
    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body: Value = serde_json::from_slice(&body_bytes).unwrap_or(Value::Null);
    (status, body)
}

fn assert_body(name: &str, actual: &Value, golden: &Value) {
    assert_eq!(actual, golden,
        "Golden mismatch for '{}':\n--- Expected ---\n{}\n--- Actual ---\n{}",
        name, serde_json::to_string_pretty(golden).unwrap(),
        serde_json::to_string_pretty(actual).unwrap());
}

fn strip_ts(mut body: Value) -> Value {
    if let Some(obj) = body.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.remove("created_at");
        obj.remove("updated_at");
    }
    body
}

fn get(uri: &str) -> Request<Body> {
    Request::builder().uri(uri).body(Body::empty()).unwrap()
}

fn post_json(uri: &str, json: &str) -> Request<Body> {
    Request::builder().method("POST").uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(json.to_string())).unwrap()
}

fn put_json(uri: &str, json: &str) -> Request<Body> {
    Request::builder().method("PUT").uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(json.to_string())).unwrap()
}

fn delete(uri: &str) -> Request<Body> {
    Request::builder().method("DELETE").uri(uri).body(Body::empty()).unwrap()
}

// ═══════════════════════════════════════════════════════════════════════
// SONGS golden tests — share a DB with cumulative mutations
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn golden_songs() {
    let (app, state) = build_test_app();

    // list
    let (s, b) = send(&app, get("/api/songs")).await;
    assert_eq!(s, 200); assert_body("songs_list", &b, &load_golden("songs_list"));

    // list_search
    let (s, b) = send(&app, get("/api/songs?search=High")).await;
    assert_eq!(s, 200); assert_body("songs_list_search", &b, &load_golden("songs_list_search"));

    // list_sort_artist_desc
    let (s, b) = send(&app, get("/api/songs?sort=artist&order=desc")).await;
    assert_eq!(s, 200); assert_body("songs_list_sort_artist_desc", &b, &load_golden("songs_list_sort_artist_desc"));

    // list_limit_offset (limit=1, offset=1)
    let (s, b) = send(&app, get("/api/songs?limit=1&offset=1")).await;
    assert_eq!(s, 200); assert_body("songs_list_limit_offset", &b, &load_golden("songs_list_limit_offset"));

    // get_1/2/3
    for id in [1, 2, 3] {
        let (s, b) = send(&app, get(&format!("/api/songs/{id}"))).await;
        assert_eq!(s, 200);
        assert_body(&format!("songs_get_{id}"), &b, &load_golden(&format!("songs_get_{id}")));
    }

    // get_404
    let (s, b) = send(&app, get("/api/songs/999")).await;
    assert_eq!(s, 404); assert_body("songs_get_404", &b, &load_golden("songs_get_404"));

    // create_happy (creates song 4)
    let (s, b) = send(&app, post_json("/api/songs",
        r#"{"title":"Golden Test Song","artist":"Test Artist","album":"Test Album","duration":200,"file_path":"/tmp/golden_test.mp3"}"#)).await;
    assert_eq!(s, 201);
    assert_body("songs_create_happy", &strip_ts(b), &load_golden("songs_create_happy"));

    // Backfill file_format (mirrors Python init_db backfill that runs on each TestClient creation)
    {
        let conn = state.conn.lock().await;
        aurora_core::db::queries::backfill_file_format(&conn).unwrap();
    }

    // create_409_duplicate
    let (s, b) = send(&app, post_json("/api/songs",
        r#"{"title":"Dup","artist":"Dup","file_path":"/music/rock/Deep Purple - Highway Star.mp3"}"#)).await;
    assert_eq!(s, 409); assert_body("songs_create_409_duplicate", &b, &load_golden("songs_create_409_duplicate"));

    // create_422 (status only)
    let (s, _) = send(&app, post_json("/api/songs", r#"{"title":"","artist":"Test Artist"}"#)).await;
    assert_eq!(s, 422);

    // update_happy (updates song 4)
    let (s, b) = send(&app, put_json("/api/songs/4", r#"{"title":"Updated Golden Song"}"#)).await;
    assert_eq!(s, 200);
    assert_body("songs_update_happy", &strip_ts(b), &load_golden("songs_update_happy"));

    // update_422 (status only)
    let (s, _) = send(&app, put_json("/api/songs/4", r#"{"artist":""}"#)).await;
    assert_eq!(s, 422);

    // update_404
    let (s, b) = send(&app, put_json("/api/songs/999", r#"{"title":"Nope"}"#)).await;
    assert_eq!(s, 404); assert_body("songs_update_404", &b, &load_golden("songs_update_404"));

    // delete_happy (deletes song 4)
    let (s, b) = send(&app, delete("/api/songs/4")).await;
    assert_eq!(s, 200); assert_body("songs_delete_happy", &b, &load_golden("songs_delete_happy"));

    // delete_404
    let (s, b) = send(&app, delete("/api/songs/999")).await;
    assert_eq!(s, 404); assert_body("songs_delete_404", &b, &load_golden("songs_delete_404"));

    // stream_404_no_file
    let (s, b) = send(&app, get("/api/songs/2/stream")).await;
    assert_eq!(s, 404); assert_body("songs_stream_404_no_file", &b, &load_golden("songs_stream_404_no_file"));

    // stream_404_not_found
    let (s, b) = send(&app, get("/api/songs/999/stream")).await;
    assert_eq!(s, 404); assert_body("songs_stream_404_not_found", &b, &load_golden("songs_stream_404_not_found"));

    // bleed_thumb_404
    let (s, b) = send(&app, get("/api/songs/1/bleed-thumb")).await;
    assert_eq!(s, 404); assert_body("songs_bleed_thumb_404", &b, &load_golden("songs_bleed_thumb_404"));

    // album_art_404
    let (s, b) = send(&app, get("/api/album-art/nonexistent.png")).await;
    assert_eq!(s, 404); assert_body("album_art_404", &b, &load_golden("album_art_404"));
}

// ═══════════════════════════════════════════════════════════════════════
// TAGS golden tests — fresh DB, cumulative mutations within
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn golden_tags() {
    let (app, _state) = build_test_app();

    // tags_list (6 seeded tags)
    let (s, b) = send(&app, get("/api/tags")).await;
    assert_eq!(s, 200); assert_body("tags_list", &b, &load_golden("tags_list"));

    // tags_create_happy (creates tag 7)
    let (s, b) = send(&app, post_json("/api/tags", r#"{"name":"golden-test-tag"}"#)).await;
    assert_eq!(s, 201);
    assert_body("tags_create_happy", &b, &load_golden("tags_create_happy"));

    // tags_create_422 (status only)
    let (s, _) = send(&app, post_json("/api/tags", r#"{"name":""}"#)).await;
    assert_eq!(s, 422);

    // tags_create_409_duplicate
    let (s, b) = send(&app, post_json("/api/tags", r#"{"name":"rock"}"#)).await;
    assert_eq!(s, 409); assert_body("tags_create_409_duplicate", &b, &load_golden("tags_create_409_duplicate"));

    // tags_assign_happy (assigns golden-alpha, golden-beta to song 1)
    let (s, b) = send(&app, post_json("/api/songs/1/tags",
        r#"{"tag_names":["golden-alpha","golden-beta"]}"#)).await;
    assert_eq!(s, 200); assert_body("tags_assign_happy", &b, &load_golden("tags_assign_happy"));

    // tags_assign_422 (status only)
    let (s, _) = send(&app, post_json("/api/songs/1/tags", r#"{"tag_names":[]}"#)).await;
    assert_eq!(s, 422);

    // tags_assign_404_song
    let (s, b) = send(&app, post_json("/api/songs/999/tags", r#"{"tag_names":["test"]}"#)).await;
    assert_eq!(s, 404); assert_body("tags_assign_404_song", &b, &load_golden("tags_assign_404_song"));

    // tags_remove_happy (removes tag 1/rock from song 1)
    let (s, b) = send(&app, delete("/api/songs/1/tags/1")).await;
    assert_eq!(s, 200); assert_body("tags_remove_happy", &b, &load_golden("tags_remove_happy"));

    // tags_remove_404_song
    let (s, b) = send(&app, delete("/api/songs/999/tags/1")).await;
    assert_eq!(s, 404); assert_body("tags_remove_404_song", &b, &load_golden("tags_remove_404_song"));

    // tags_remove_404_tag
    let (s, b) = send(&app, delete("/api/songs/1/tags/99999")).await;
    assert_eq!(s, 404); assert_body("tags_remove_404_tag", &b, &load_golden("tags_remove_404_tag"));

    // tags_remove_404_link (tag 1 not linked to song 2)
    let (s, b) = send(&app, delete("/api/songs/2/tags/1")).await;
    assert_eq!(s, 404); assert_body("tags_remove_404_link", &b, &load_golden("tags_remove_404_link"));

    // tags_delete_happy (deletes tag 7 — the one we created)
    let (s, b) = send(&app, delete("/api/tags/7")).await;
    assert_eq!(s, 200); assert_body("tags_delete_happy", &b, &load_golden("tags_delete_happy"));

    // tags_delete_404
    let (s, b) = send(&app, delete("/api/tags/99999")).await;
    assert_eq!(s, 404); assert_body("tags_delete_404", &b, &load_golden("tags_delete_404"));
}

// ═══════════════════════════════════════════════════════════════════════
// FILTER golden tests — fresh DB, no mutations
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn golden_filter() {
    let (app, _state) = build_test_app();

    // filter_rock
    let (s, b) = send(&app, post_json("/api/filter", r#"{"query":"rock"}"#)).await;
    assert_eq!(s, 200); assert_body("filter_rock", &b, &load_golden("filter_rock"));

    // filter_slow_and_chill
    let (s, b) = send(&app, post_json("/api/filter", r#"{"query":"slow AND chill"}"#)).await;
    assert_eq!(s, 200); assert_body("filter_slow_and_chill", &b, &load_golden("filter_slow_and_chill"));

    // filter_rock_or_anime
    let (s, b) = send(&app, post_json("/api/filter", r#"{"query":"rock OR anime"}"#)).await;
    assert_eq!(s, 200); assert_body("filter_rock_or_anime", &b, &load_golden("filter_rock_or_anime"));

    // filter_quoted_fast
    let (s, b) = send(&app, post_json("/api/filter", r#"{"query":"\"fast\""}"#)).await;
    assert_eq!(s, 200); assert_body("filter_quoted_fast", &b, &load_golden("filter_quoted_fast"));
}

// ═══════════════════════════════════════════════════════════════════════
// Cross-run proof: flipping a value breaks the test
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
#[should_panic(expected = "Golden mismatch")]
async fn cross_run_proof() {
    let conn = aurora_core::db::open_memory().unwrap();
    seed_database(&conn);
    conn.execute("UPDATE songs SET artist = 'WRONG' WHERE id = 1", []).unwrap();

    let state = Arc::new(AppState { conn: Mutex::new(conn) });
    let app = aurora_server::build_router(state);

    let (status, body) = send(&app, get("/api/songs/1")).await;
    assert_eq!(status, StatusCode::OK);
    assert_body("songs_get_1 (corrupted)", &body, &load_golden("songs_get_1"));
}
