//! Integration tests for GET /api/smart-playlists/{id}/songs (G3/W1).
//!
//! TDD: tests written before implementation.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceExt;

use aurora_server::AppState;

// ── Helpers ───────────────────────────────────────────────────────────

fn build_state() -> Arc<AppState> {
    let conn = aurora_core::db::open_memory().expect("open_memory failed");
    Arc::new(AppState {
        conn: Mutex::new(conn),
        db_path: None,
        addon_state: Arc::new(aurora_server::routes::addons::AddonState::new()),
        watcher_handle: None,
        aurora_token: None,
    })
}

fn build_app_with_state() -> (axum::Router, Arc<AppState>) {
    let state = build_state();
    let router = aurora_server::build_router(Arc::clone(&state));
    (router, state)
}

async fn send(app: &axum::Router, req: Request<Body>) -> (StatusCode, String) {
    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body = String::from_utf8_lossy(&body_bytes).to_string();
    (status, body)
}

fn post_json(uri: &str, json: &Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(json).unwrap()))
        .unwrap()
}

fn get(uri: &str) -> Request<Body> {
    Request::builder().uri(uri).body(Body::empty()).unwrap()
}

/// Seed songs and tags via SQL directly. Returns (conn) for further manipulation.
fn seed_songs_and_tags(conn: &aurora_core::rusqlite::Connection) {
    // Insert songs
    for i in 1..=3 {
        conn.execute(
            "INSERT INTO songs (id, title, artist, album, duration, file_path, file_format, \
             source, created_at, updated_at) \
             VALUES (?1, ?2, 'Artist', 'Album', 200, ?3, 'mp3', 'manual', \
             '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            rusqlite::params![
                i,
                format!("Song {i}"),
                format!("/tmp/song{i}.mp3"),
            ],
        )
        .unwrap();
    }

    // Insert tags: "rock" (id=1), "chill" (id=2)
    conn.execute(
        "INSERT INTO tags (id, name, created_at) VALUES (1, 'rock', '2025-01-01T00:00:00Z')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO tags (id, name, created_at) VALUES (2, 'chill', '2025-01-01T00:00:00Z')",
        [],
    )
    .unwrap();

    // Tag song 1 as "rock", song 2 as "chill", song 3 as both
    conn.execute(
        "INSERT INTO song_tags (song_id, tag_id) VALUES (1, 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO song_tags (song_id, tag_id) VALUES (2, 2)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO song_tags (song_id, tag_id) VALUES (3, 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO song_tags (song_id, tag_id) VALUES (3, 2)",
        [],
    )
    .unwrap();
}

/// Create a smart playlist via the API and return its ID.
async fn create_smart_playlist(app: &axum::Router, name: &str, query: &str) -> i64 {
    let body = serde_json::json!({ "name": name, "query": query });
    let (status, resp) = send(app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 201, "create_smart_playlist failed: {resp}");
    let v: Value = serde_json::from_str(&resp).unwrap();
    v["data"]["id"].as_i64().unwrap()
}

/// Parse the response body and extract the data array.
fn parse_data_array(body: &str) -> Vec<Value> {
    let v: Value = serde_json::from_str(body).unwrap();
    v["data"].as_array().unwrap().clone()
}

/// Parse meta.total from the response body.
fn parse_meta_total(body: &str) -> i64 {
    let v: Value = serde_json::from_str(body).unwrap();
    v["meta"]["total"].as_i64().unwrap()
}

// ── Slice A: Resolve a smart playlist ─────────────────────────────────

#[tokio::test]
async fn resolve_smart_playlist_returns_matching_songs() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs_and_tags(&conn); }

    // Create smart playlist with query "rock" — should match song 1 and song 3
    let sp_id = create_smart_playlist(&app, "Rock Mix", "rock").await;

    // Resolve via GET /api/smart-playlists/{id}/songs
    let (status, body) = send(&app, get(&format!("/api/smart-playlists/{sp_id}/songs"))).await;
    assert_eq!(status, 200, "GET /api/smart-playlists/{sp_id}/songs must return 200: {body}");

    let songs = parse_data_array(&body);
    let total = parse_meta_total(&body);
    assert_eq!(songs.len(), 2, "must return 2 songs matching 'rock'");
    assert_eq!(total, 2, "meta.total must be 2");

    // Must be sorted by title ASC (case-insensitive) — same as filter engine
    assert_eq!(songs[0]["title"], "Song 1");
    assert_eq!(songs[1]["title"], "Song 3");

    // Verify message is "ok"
    let v: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["message"], "ok");
}

#[tokio::test]
async fn resolve_smart_playlist_matches_filter_endpoint() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs_and_tags(&conn); }

    // Create smart playlist with query "chill OR rock"
    let sp_id = create_smart_playlist(&app, "All Music", "chill OR rock").await;

    // Resolve via smart playlist endpoint
    let (sp_status, sp_body) = send(&app, get(&format!("/api/smart-playlists/{sp_id}/songs"))).await;
    assert_eq!(sp_status, 200);

    // Resolve via filter endpoint with same query
    let filter_body = serde_json::json!({ "query": "chill OR rock" });
    let (filter_status, filter_resp) = send(&app, post_json("/api/filter", &filter_body)).await;
    assert_eq!(filter_status, 200);

    let sp_songs = parse_data_array(&sp_body);
    let filter_songs = parse_data_array(&filter_resp);

    // Same number of results
    assert_eq!(sp_songs.len(), filter_songs.len(), "smart playlist and filter must return same count");

    // Same song IDs in same order
    let sp_ids: Vec<i64> = sp_songs.iter().map(|s| s["id"].as_i64().unwrap()).collect();
    let filter_ids: Vec<i64> = filter_songs.iter().map(|s| s["id"].as_i64().unwrap()).collect();
    assert_eq!(sp_ids, filter_ids, "smart playlist and filter must return same songs in same order");

    // Same song shape keys (no peaks)
    for song in &sp_songs {
        assert!(song["title"].is_string());
        assert!(song["artist"].is_string());
        assert!(song["id"].is_number());
        // No peaks field (filter engine doesn't include them)
        assert!(song["waveform_peaks"].is_null() || song["waveform_peaks"].as_str() == Some(""));
    }
}

#[tokio::test]
async fn resolve_smart_playlist_single_matching_song() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs_and_tags(&conn); }

    // Query "rock" matches songs 1 and 3. Query "chill" matches 2 and 3.
    // "chill AND NOT rock" should match only song 2.
    let sp_id = create_smart_playlist(&app, "Chill Only", "chill AND NOT rock").await;

    let (status, body) = send(&app, get(&format!("/api/smart-playlists/{sp_id}/songs"))).await;
    assert_eq!(status, 200);

    let songs = parse_data_array(&body);
    assert_eq!(songs.len(), 1, "chill NOT rock should match 1 song");
    assert_eq!(songs[0]["title"], "Song 2");
    assert_eq!(songs[0]["id"], 2);
}

#[tokio::test]
async fn resolve_smart_playlist_empty_result() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs_and_tags(&conn); }

    // Query "electronic" matches nothing
    let sp_id = create_smart_playlist(&app, "Electronic", "electronic").await;

    let (status, body) = send(&app, get(&format!("/api/smart-playlists/{sp_id}/songs"))).await;
    assert_eq!(status, 200, "empty result is still 200, not 404");

    let songs = parse_data_array(&body);
    let total = parse_meta_total(&body);
    assert_eq!(songs.len(), 0, "empty result should have 0 songs");
    assert_eq!(total, 0, "meta.total should be 0");
}

// ── Slice B: Resolution failure semantics ─────────────────────────────

#[tokio::test]
async fn resolve_manual_playlist_returns_404() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs_and_tags(&conn); }

    // Create a manual playlist via the legacy API
    let body = serde_json::json!({ "name": "My Manual Playlist" });
    let (create_status, create_resp) = send(&app, post_json("/api/playlists", &body)).await;
    assert_eq!(create_status, 201, "create manual playlist failed: {create_resp}");
    let v: Value = serde_json::from_str(&create_resp).unwrap();
    let manual_id = v["data"]["id"].as_i64().unwrap();

    // Try to resolve it as a smart playlist — must be 404
    let (status, resp_body) = send(&app, get(&format!("/api/smart-playlists/{manual_id}/songs"))).await;
    assert_eq!(status, 404, "manual playlist must return 404, not {status}: {resp_body}");

    let v: Value = serde_json::from_str(&resp_body).unwrap();
    assert_eq!(v["detail"], "Smart playlist not found");
}

#[tokio::test]
async fn resolve_nonexistent_id_returns_404() {
    let (app, _state) = build_app_with_state();

    let (status, body) = send(&app, get("/api/smart-playlists/99999/songs")).await;
    assert_eq!(status, 404, "nonexistent ID must return 404: {body}");

    let v: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["detail"], "Smart playlist not found");
}

#[tokio::test]
async fn resolve_invalid_stored_query_returns_400() {
    let (app, state) = build_app_with_state();
    {
        let conn = state.conn.lock().await;
        seed_songs_and_tags(&conn);

        // Create a backing playlist
        conn.execute(
            "INSERT INTO playlists (id, name, created_at, updated_at) VALUES (100, 'Bad SP', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        ).unwrap();

        // Insert a smart definition with an invalid query directly (bypasses API validation)
        conn.execute(
            "INSERT INTO smart_playlist_definitions (playlist_id, query, created_at, updated_at) \
             VALUES (100, 'AND AND AND', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        ).unwrap();
    }

    let (status, body) = send(&app, get("/api/smart-playlists/100/songs")).await;
    assert_eq!(status, 400, "invalid stored query must return 400: {body}");

    let v: Value = serde_json::from_str(&body).unwrap();
    let detail = v["detail"].as_str().unwrap();
    // F3: exact fixed string, no raw error leaking
    assert_eq!(detail, "Smart playlist query is invalid");
}

#[tokio::test]
async fn resolve_smart_playlist_db_error_returns_500() {
    let (app, state) = build_app_with_state();
    {
        let conn = state.conn.lock().await;
        seed_songs_and_tags(&conn);

        // Create a backing playlist
        conn.execute(
            "INSERT INTO playlists (id, name, created_at, updated_at) VALUES (101, 'Good SP', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        ).unwrap();

        // Insert a valid smart definition
        conn.execute(
            "INSERT INTO smart_playlist_definitions (playlist_id, query, created_at, updated_at) \
             VALUES (101, 'rock', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            [],
        ).unwrap();

        // Drop the songs table so resolve fails at execution time
        conn.execute("DROP TABLE songs", []).unwrap();
    }

    let (status, body) = send(&app, get("/api/smart-playlists/101/songs")).await;
    assert_eq!(status, 500, "DB error during resolve must return 500: {body}");

    let v: Value = serde_json::from_str(&body).unwrap();
    let detail = v["detail"].as_str().unwrap();
    // F3: exact fixed string, no SQL/schema text leaking
    assert_eq!(detail, "Unable to resolve smart playlist");
    // Must NOT contain raw SQL or schema details
    assert!(!detail.contains("no such table"), "must not leak SQL error: {detail}");
}
