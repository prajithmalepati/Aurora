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

    for &(id, name, color, emoji, ts, ts2) in &[
        (1i64, "Rock Classics", "#E63946", "🎸", TS_CREATE, TS_CREATE),
        (2, "Lo-Fi Study", "#457B9D", "📚", TS_CREATE_2, TS_CREATE_2),
        (3, "Anime", "#2A9D8F", "🎌", TS_CREATE, TS_CREATE),
    ] {
        let (ce, cd) = if id == 2 { (Some(1i64), Some(8i64)) } else { (None, None) };
        conn.execute(
            "INSERT INTO playlists (id, name, color, emoji, image_url, crossfade_enabled, crossfade_duration_s, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8)",
            aurora_core::rusqlite::params![id, name, color, emoji, ce, cd, ts, ts2],
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
// PLAYLISTS golden tests — cumulative mutations
// ═══════════════════════════════════════════════════════════════════════

/// Build a multipart/form-data body with a single file field.
fn multipart_file_body(field_name: &str, filename: &str, content_type: &str, data: &[u8]) -> (String, Vec<u8>) {
    let boundary = "----TestBoundary123456";
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(format!(
        "Content-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\n",
        field_name, filename
    ).as_bytes());
    body.extend_from_slice(format!("Content-Type: {}\r\n\r\n", content_type).as_bytes());
    body.extend_from_slice(data);
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());
    (boundary.to_string(), body)
}

/// Build a multipart body with file + text field.
#[allow(dead_code)]
fn multipart_file_and_text(
    file_field: &str, filename: &str, content_type: &str, file_data: &[u8],
    text_field: &str, text_value: &str,
) -> (String, Vec<u8>) {
    let boundary = "----TestBoundary123456";
    let mut body = Vec::new();
    // File part
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(format!(
        "Content-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\n",
        file_field, filename
    ).as_bytes());
    body.extend_from_slice(format!("Content-Type: {}\r\n\r\n", content_type).as_bytes());
    body.extend_from_slice(file_data);
    body.extend_from_slice(b"\r\n");
    // Text part
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(format!(
        "Content-Disposition: form-data; name=\"{}\"\r\n\r\n",
        text_field
    ).as_bytes());
    body.extend_from_slice(text_value.as_bytes());
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());
    (boundary.to_string(), body)
}

fn post_multipart(uri: &str, boundary: &str, body: Vec<u8>) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", format!("multipart/form-data; boundary={}", boundary))
        .body(Body::from(body))
        .unwrap()
}

fn put_multipart(uri: &str, boundary: &str, body: Vec<u8>) -> Request<Body> {
    Request::builder()
        .method("PUT")
        .uri(uri)
        .header("content-type", format!("multipart/form-data; boundary={}", boundary))
        .body(Body::from(body))
        .unwrap()
}

/// A minimal valid 1x1 red PNG (67 bytes).
fn minimal_png() -> Vec<u8> {
    vec![
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        // IHDR chunk
        0x00, 0x00, 0x00, 0x0D, // length = 13
        0x49, 0x48, 0x44, 0x52, // "IHDR"
        0x00, 0x00, 0x00, 0x01, // width = 1
        0x00, 0x00, 0x00, 0x01, // height = 1
        0x08, 0x02,             // bit depth = 8, color type = 2 (RGB)
        0x00, 0x00, 0x00,       // compression, filter, interlace
        0x90, 0x77, 0x53, 0xDE, // CRC
        // IDAT chunk
        0x00, 0x00, 0x00, 0x0C, // length = 12
        0x49, 0x44, 0x41, 0x54, // "IDAT"
        0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, // compressed data
        0x18, 0xDD, 0x8D, 0xB4, // CRC
        // IEND chunk
        0x00, 0x00, 0x00, 0x00, // length = 0
        0x49, 0x45, 0x4E, 0x44, // "IEND"
        0xAE, 0x42, 0x60, 0x82, // CRC
    ]
}

// Strip created_at/updated_at from playlist list items (they change with mutations)
fn strip_playlist_list_ts(mut body: Value) -> Value {
    if let Some(arr) = body.get_mut("data").and_then(|d| d.as_array_mut()) {
        for item in arr.iter_mut() {
            if let Some(obj) = item.as_object_mut() {
                obj.remove("created_at");
                obj.remove("updated_at");
            }
        }
    }
    body
}

// Strip created_at/updated_at from playlist detail (but not from songs — those are "")
fn strip_playlist_detail_ts(mut body: Value) -> Value {
    if let Some(obj) = body.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.remove("created_at");
        obj.remove("updated_at");
    }
    body
}

#[tokio::test]
async fn golden_playlists() {
    // Set temp dir for playlist images
    let tmp = tempfile::tempdir().unwrap();
    // SAFETY: single-threaded test, no concurrent env access
    unsafe { std::env::set_var("AURORA_PLAYLIST_IMAGES_DIR", tmp.path().to_str().unwrap()); }

    let (app, _state) = build_test_app();

    // ── list (initial: 3 playlists, alphabetical: Anime, Lo-Fi Study, Rock Classics) ──
    let (s, b) = send(&app, get("/api/playlists")).await;
    assert_eq!(s, 200);
    // Strip timestamps since they vary
    let golden = load_golden("playlists_list");
    assert_eq!(
        serde_json::to_string_pretty(&strip_playlist_list_ts(b)).unwrap(),
        serde_json::to_string_pretty(&strip_playlist_list_ts(golden)).unwrap(),
        "playlists_list mismatch"
    );

    // ── get_1, get_2, get_3 ──
    for id in [1, 2, 3] {
        let (s, b) = send(&app, get(&format!("/api/playlists/{}", id))).await;
        assert_eq!(s, 200);
        let golden = load_golden(&format!("playlists_get_{}", id));
        assert_eq!(
            serde_json::to_string_pretty(&strip_playlist_detail_ts(b)).unwrap(),
            serde_json::to_string_pretty(&strip_playlist_detail_ts(golden)).unwrap(),
            "playlists_get_{} mismatch", id
        );
    }

    // ── get_404 ──
    let (s, b) = send(&app, get("/api/playlists/999")).await;
    assert_eq!(s, 404);
    assert_body("playlists_get_404", &b, &load_golden("playlists_get_404"));

    // ── create_happy (creates playlist 4) ──
    let (s, b) = send(&app, post_json("/api/playlists",
        r##"{"name":"Golden Test Create","color":"#FF5500","emoji":"🧪"}"##)).await;
    assert_eq!(s, 201);
    // Strip timestamps from response
    let mut b_stripped = b.clone();
    if let Some(obj) = b_stripped.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.remove("created_at");
        obj.remove("updated_at");
    }
    let mut golden = load_golden("playlists_create_happy");
    if let Some(obj) = golden.get_mut("data").and_then(|d| d.as_object_mut()) {
        obj.remove("created_at");
        obj.remove("updated_at");
    }
    assert_body("playlists_create_happy (no ts)", &b_stripped, &golden);

    // ── create_400 (empty name) ──
    let (s, b) = send(&app, post_json("/api/playlists", r#"{"name":""}"#)).await;
    assert_eq!(s, 400);
    assert_body("playlists_create_400", &b, &load_golden("playlists_create_400"));

    // ── create_409 (duplicate name) ──
    let (s, b) = send(&app, post_json("/api/playlists",
        r##"{"name":"Rock Classics","color":"#000"}"##)).await;
    assert_eq!(s, 409);
    assert_body("playlists_create_409", &b, &load_golden("playlists_create_409"));

    // ── update_happy (updates playlist 1) ──
    let (s, b) = send(&app, put_json("/api/playlists/1",
        r##"{"name":"Rock Classics Updated","color":"#111111","emoji":"🎵"}"##)).await;
    assert_eq!(s, 200);
    let b_stripped = strip_playlist_detail_ts(b);
    let golden = strip_playlist_detail_ts(load_golden("playlists_update_happy"));
    assert_body("playlists_update_happy (no ts)", &b_stripped, &golden);

    // ── update_crossfade (updates playlist 1 with crossfade) ──
    let (s, b) = send(&app, put_json("/api/playlists/1",
        r#"{"crossfade_enabled":1,"crossfade_duration_s":12}"#)).await;
    assert_eq!(s, 200);
    let b_stripped = strip_playlist_detail_ts(b);
    let golden = strip_playlist_detail_ts(load_golden("playlists_update_crossfade"));
    assert_body("playlists_update_crossfade (no ts)", &b_stripped, &golden);

    // ── update_404 ──
    let (s, b) = send(&app, put_json("/api/playlists/999", r#"{"name":"Nope"}"#)).await;
    assert_eq!(s, 404);
    assert_body("playlists_update_404", &b, &load_golden("playlists_update_404"));

    // ── add_song_happy (add song 1 to playlist 2) ──
    let (s, b) = send(&app, post_json("/api/playlists/2/songs", r#"{"song_id":1}"#)).await;
    assert_eq!(s, 200);
    let b_stripped = strip_playlist_detail_ts(b);
    let golden = strip_playlist_detail_ts(load_golden("playlists_add_song_happy"));
    assert_body("playlists_add_song_happy (no ts)", &b_stripped, &golden);

    // ── add_song_409 (song 1 already in playlist 2) ──
    let (s, b) = send(&app, post_json("/api/playlists/2/songs", r#"{"song_id":1}"#)).await;
    assert_eq!(s, 409);
    assert_body("playlists_add_song_409", &b, &load_golden("playlists_add_song_409"));

    // ── add_song_404_playlist ──
    let (s, b) = send(&app, post_json("/api/playlists/999/songs", r#"{"song_id":1}"#)).await;
    assert_eq!(s, 404);
    assert_body("playlists_add_song_404_playlist", &b, &load_golden("playlists_add_song_404_playlist"));

    // ── add_song_404_song ──
    let (s, b) = send(&app, post_json("/api/playlists/1/songs", r#"{"song_id":999}"#)).await;
    assert_eq!(s, 404);
    assert_body("playlists_add_song_404_song", &b, &load_golden("playlists_add_song_404_song"));

    // ── remove_song_happy (remove song 1 from playlist 2) ──
    let (s, b) = send(&app, delete("/api/playlists/2/songs/1")).await;
    assert_eq!(s, 200);
    let b_stripped = strip_playlist_detail_ts(b);
    let golden = strip_playlist_detail_ts(load_golden("playlists_remove_song_happy"));
    assert_body("playlists_remove_song_happy (no ts)", &b_stripped, &golden);

    // ── remove_song_404_playlist ──
    let (s, b) = send(&app, delete("/api/playlists/999/songs/1")).await;
    assert_eq!(s, 404);
    assert_body("playlists_remove_song_404_playlist", &b, &load_golden("playlists_remove_song_404_playlist"));

    // ── remove_song_404_song ──
    let (s, b) = send(&app, delete("/api/playlists/1/songs/999")).await;
    assert_eq!(s, 404);
    assert_body("playlists_remove_song_404_song", &b, &load_golden("playlists_remove_song_404_song"));

    // ── remove_song_404_not_in_playlist ──
    let (s, b) = send(&app, delete("/api/playlists/1/songs/2")).await;
    assert_eq!(s, 404);
    assert_body("playlists_remove_song_404_not_in_playlist", &b, &load_golden("playlists_remove_song_404_not_in_playlist"));

    // ── timing_happy (set timing on playlist 1, song 1) ──
    let (s, b) = send(&app, Request::builder().method("PATCH").uri("/api/playlists/1/songs/1/timing")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"start_time_ms":1000,"end_time_ms":300000}"#.to_string())).unwrap()).await;
    assert_eq!(s, 200);
    assert_body("playlists_timing_happy", &b, &load_golden("playlists_timing_happy"));

    // ── timing_404 (song not in playlist) ──
    let (s, b) = send(&app, Request::builder().method("PATCH").uri("/api/playlists/1/songs/2/timing")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"start_time_ms":0,"end_time_ms":0}"#.to_string())).unwrap()).await;
    assert_eq!(s, 404);
    assert_body("playlists_timing_404", &b, &load_golden("playlists_timing_404"));

    // ── timing_422 (invalid timing) ──
    let (s, b) = send(&app, Request::builder().method("PATCH").uri("/api/playlists/1/songs/1/timing")
        .header("content-type", "application/json")
        .body(Body::from(r#"{"start_time_ms":5000,"end_time_ms":1000}"#.to_string())).unwrap()).await;
    assert_eq!(s, 422);
    assert_body("playlists_timing_422", &b, &load_golden("playlists_timing_422"));

    // ── Setup for reorder: add songs 2,1 to playlist 3 (which has song 3 at pos 0) ──
    let (s, _) = send(&app, post_json("/api/playlists/3/songs", r#"{"song_id":2}"#)).await;
    assert_eq!(s, 200);
    let (s, _) = send(&app, post_json("/api/playlists/3/songs", r#"{"song_id":1}"#)).await;
    assert_eq!(s, 200);
    // Now playlist 3 has: pos0=song3, pos1=song2, pos2=song1

    // ── reorder_happy (reorder to: song2, song3, song1) ──
    let (s, b) = send(&app, put_json("/api/playlists/3/songs/reorder",
        r#"{"song_ids":[2,3,1]}"#)).await;
    assert_eq!(s, 200);
    let b_stripped = strip_playlist_detail_ts(b);
    let golden = strip_playlist_detail_ts(load_golden("playlists_reorder_happy"));
    assert_body("playlists_reorder_happy (no ts)", &b_stripped, &golden);

    // ── reorder_400 (id set mismatch) ──
    let (s, b) = send(&app, put_json("/api/playlists/3/songs/reorder",
        r#"{"song_ids":[1,2]}"#)).await;
    assert_eq!(s, 400);
    assert_body("playlists_reorder_400", &b, &load_golden("playlists_reorder_400"));

    // ── reorder_404 ──
    let (s, b) = send(&app, put_json("/api/playlists/999/songs/reorder",
        r#"{"song_ids":[1]}"#)).await;
    assert_eq!(s, 404);
    assert_body("playlists_reorder_404", &b, &load_golden("playlists_reorder_404"));

    // ── upload_image_happy ──
    let png = minimal_png();
    let (boundary, body) = multipart_file_body("file", "cover.png", "image/png", &png);
    let (s, b) = send(&app, put_multipart("/api/playlists/1/image", &boundary, body)).await;
    assert_eq!(s, 200);
    assert_body("playlists_upload_image_happy", &b, &load_golden("playlists_upload_image_happy"));

    // ── serve_image_404 ──
    let (s, b) = send(&app, get("/api/playlist-images/nonexistent.png")).await;
    assert_eq!(s, 404);
    assert_body("playlists_serve_image_404", &b, &load_golden("playlists_serve_image_404"));

    // ── upload_image_400 (not an image) ──
    let (boundary, body) = multipart_file_body("file", "test.txt", "text/plain", b"hello");
    let (s, b) = send(&app, put_multipart("/api/playlists/1/image", &boundary, body)).await;
    assert_eq!(s, 400);
    assert_body("playlists_upload_image_400", &b, &load_golden("playlists_upload_image_400"));

    // ── upload_image_404 ──
    let (boundary, body) = multipart_file_body("file", "cover.png", "image/png", &png);
    let (s, b) = send(&app, put_multipart("/api/playlists/999/image", &boundary, body)).await;
    assert_eq!(s, 404);
    assert_body("playlists_upload_image_404", &b, &load_golden("playlists_upload_image_404"));

    // ── delete_image_happy ──
    let (s, b) = send(&app, delete("/api/playlists/1/image")).await;
    assert_eq!(s, 200);
    assert_body("playlists_delete_image_happy", &b, &load_golden("playlists_delete_image_happy"));

    // ── Create and delete a dummy playlist to match Python's autoincrement counter ──
    // Python's delete test creates "To Be Deleted" (id 5), then deletes it.
    // We do this before export/import so import gets id 6.
    let (s, _) = send(&app, post_json("/api/playlists",
        r##"{"name":"To Be Deleted"}"##)).await;
    assert_eq!(s, 201);
    // Now delete it — this is our "delete_happy" test
    let (s, b) = send(&app, delete("/api/playlists/5")).await;
    assert_eq!(s, 200);
    assert_body("playlists_delete_happy", &b, &load_golden("playlists_delete_happy"));

    // ── delete_image_404 ──
    let (s, b) = send(&app, delete("/api/playlists/999/image")).await;
    assert_eq!(s, 404);
    assert_body("playlists_delete_image_404", &b, &load_golden("playlists_delete_image_404"));

    // ── export_json (playlist 2 = Lo-Fi Study) ──
    let (s, b) = send(&app, get("/api/playlists/2/export?format=json")).await;
    assert_eq!(s, 200);
    assert_body("playlists_export_json", &b, &load_golden("playlists_export_json"));

    // ── export_m3u8 (playlist 1 = Rock Classics Updated, has song 1) ──
    let (s, b) = send(&app, get("/api/playlists/1/export?format=m3u8")).await;
    assert_eq!(s, 200);
    assert_body("playlists_export_m3u8", &b, &load_golden("playlists_export_m3u8"));

    // ── export_404 ──
    let (s, b) = send(&app, get("/api/playlists/999/export?format=json")).await;
    assert_eq!(s, 404);
    assert_body("playlists_export_404", &b, &load_golden("playlists_export_404"));

    // ── import_json_happy ──
    let import_json = serde_json::json!({
        "playlist": {
            "name": "Imported Golden Playlist",
            "color": "#FF0000",
            "emoji": "📥"
        },
        "songs": [
            {"title": "Highway Star", "artist": "Deep Purple", "file_path": "/music/rock/Deep Purple - Highway Star.mp3"},
            {"title": "Unravel", "artist": "TK", "file_path": "/music/anime/TK - Unravel.mp3"}
        ]
    });
    let json_bytes = serde_json::to_vec(&import_json).unwrap();
    let (boundary, body) = multipart_file_body("file", "playlist.json", "application/json", &json_bytes);
    let (s, b) = send(&app, post_multipart("/api/playlists/import", &boundary, body)).await;
    assert_eq!(s, 200);
    assert_body("playlists_import_json_happy", &b, &load_golden("playlists_import_json_happy"));

    // ── import_400 (invalid JSON) ──
    let (boundary, body) = multipart_file_body("file", "bad.json", "application/json", b"not json");
    let (s, b) = send(&app, post_multipart("/api/playlists/import", &boundary, body)).await;
    assert_eq!(s, 400);
    assert_body("playlists_import_400", &b, &load_golden("playlists_import_400"));

    // ── delete_404 ──
    let (s, b) = send(&app, delete("/api/playlists/999")).await;
    assert_eq!(s, 404);
    assert_body("playlists_delete_404", &b, &load_golden("playlists_delete_404"));
}

// ═══════════════════════════════════════════════════════════════════════
// FOLDERS golden tests — fresh DB, no mutations
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn golden_folders() {
    let (app, _state) = build_test_app();

    // folders_tree
    let (s, b) = send(&app, get("/api/folders")).await;
    assert_eq!(s, 200);
    assert_body("folders_tree", &b, &load_golden("folders_tree"));

    // folders_songs_rock
    let (s, b) = send(&app, get("/api/folders/songs?path=/music/rock")).await;
    assert_eq!(s, 200);
    assert_body("folders_songs_rock", &b, &load_golden("folders_songs_rock"));

    // folders_songs_anime
    let (s, b) = send(&app, get("/api/folders/songs?path=/music/anime")).await;
    assert_eq!(s, 200);
    assert_body("folders_songs_anime", &b, &load_golden("folders_songs_anime"));

    // folders_songs_nonexistent
    let (s, b) = send(&app, get("/api/folders/songs?path=/nonexistent")).await;
    assert_eq!(s, 200);
    assert_body("folders_songs_nonexistent", &b, &load_golden("folders_songs_nonexistent"));
}

// ═══════════════════════════════════════════════════════════════════════
// ALBUMS golden tests — fresh DB, no mutations
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn golden_albums() {
    let (app, _state) = build_test_app();

    // albums_list
    let (s, b) = send(&app, get("/api/albums")).await;
    assert_eq!(s, 200);
    assert_body("albums_list", &b, &load_golden("albums_list"));

    // albums_get_machine_head (URL-decoded: Machine Head)
    let (s, b) = send(&app, get("/api/albums/Machine%20Head")).await;
    assert_eq!(s, 200);
    assert_body("albums_get_machine_head", &b, &load_golden("albums_get_machine_head"));

    // albums_get_nonexistent → 404
    let (s, b) = send(&app, get("/api/albums/nonexistent")).await;
    assert_eq!(s, 404);
    assert_eq!(b["detail"], "Album not found");
}

// ═══════════════════════════════════════════════════════════════════════
// STREAM range tests — uses temp file, not golden JSON
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn stream_range_tests() {
    // Create a temp audio file with known content
    let tmp = tempfile::Builder::new().suffix(".mp3").tempfile().unwrap();
    let test_data: Vec<u8> = (0..=255u8).collect(); // 256 bytes: 0x00..0xFF
    std::fs::write(tmp.path(), &test_data).unwrap();
    let file_path = tmp.path().to_string_lossy().to_string();

    // Create a fresh DB with a song pointing to the temp file
    let conn = aurora_core::db::open_memory().expect("open_memory failed");
    seed_database(&conn);
    // Insert a 4th song with the temp file path
    conn.execute(
        "INSERT INTO songs (id, title, artist, source, file_path, file_format, created_at, updated_at)          VALUES (100, 'Test Stream', 'Test', 'manual', ?1, 'mp3', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
        aurora_core::rusqlite::params![file_path],
    ).unwrap();

    let state = Arc::new(AppState { conn: tokio::sync::Mutex::new(conn) });
    let app = aurora_server::build_router(state);

    // ── Full request (no Range) → 200 ──
    let req = Request::builder()
        .uri("/api/songs/100/stream")
        .body(Body::empty())
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.headers().get("content-type").unwrap().to_str().unwrap(),
        "audio/mpeg"
    );
    assert_eq!(
        response.headers().get("accept-ranges").unwrap().to_str().unwrap(),
        "bytes"
    );
    assert_eq!(
        response.headers().get("content-length").unwrap().to_str().unwrap(),
        "256"
    );
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body_bytes.as_ref(), test_data.as_slice());

    // ── Range: bytes=0-49 → 206 ──
    let req = Request::builder()
        .uri("/api/songs/100/stream")
        .header("range", "bytes=0-49")
        .body(Body::empty())
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), 206);
    assert_eq!(
        response.headers().get("content-range").unwrap().to_str().unwrap(),
        "bytes 0-49/256"
    );
    assert_eq!(
        response.headers().get("content-length").unwrap().to_str().unwrap(),
        "50"
    );
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body_bytes.as_ref(), &test_data[0..=49]);

    // ── Range: bytes=100-199 → 206 ──
    let req = Request::builder()
        .uri("/api/songs/100/stream")
        .header("range", "bytes=100-199")
        .body(Body::empty())
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), 206);
    assert_eq!(
        response.headers().get("content-range").unwrap().to_str().unwrap(),
        "bytes 100-199/256"
    );
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body_bytes.as_ref(), &test_data[100..=199]);

    // ── Range: bytes=200- → 206 (open-ended) ──
    let req = Request::builder()
        .uri("/api/songs/100/stream")
        .header("range", "bytes=200-")
        .body(Body::empty())
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), 206);
    assert_eq!(
        response.headers().get("content-range").unwrap().to_str().unwrap(),
        "bytes 200-255/256"
    );
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body_bytes.as_ref(), &test_data[200..]);

    // ── Range: bytes=-50 → 206 (suffix) ──
    let req = Request::builder()
        .uri("/api/songs/100/stream")
        .header("range", "bytes=-50")
        .body(Body::empty())
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), 206);
    assert_eq!(
        response.headers().get("content-range").unwrap().to_str().unwrap(),
        "bytes 206-255/256"
    );
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body_bytes.as_ref(), &test_data[206..]);

    // ── Unsatisfiable range (start >= file_size) → 416 ──
    let req = Request::builder()
        .uri("/api/songs/100/stream")
        .header("range", "bytes=300-400")
        .body(Body::empty())
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), 416);
    assert_eq!(
        response.headers().get("content-range").unwrap().to_str().unwrap(),
        "bytes */256"
    );

    // ── 404: song not found ──
    let (s, b) = send(&app, get("/api/songs/999/stream")).await;
    assert_eq!(s, 404);
    assert_body("stream_404_not_found", &b, &load_golden("songs_stream_404_not_found"));

    // ── 404: no file path ──
    let (s, b) = send(&app, get("/api/songs/2/stream")).await;
    assert_eq!(s, 404);
    assert_body("stream_404_no_file", &b, &load_golden("songs_stream_404_no_file"));
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
