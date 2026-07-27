//! Integration tests for smart playlist membership guard (G3/W1).
//!
//! TDD: tests written before implementation.
//!
//! Smart playlists are dynamic-only — manual membership mutations must
//! return 409 CONFLICT for smart playlist IDs.

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

fn put_json(uri: &str, json: &Value) -> Request<Body> {
    Request::builder()
        .method("PUT")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(json).unwrap()))
        .unwrap()
}

fn patch_json(uri: &str, json: &Value) -> Request<Body> {
    Request::builder()
        .method("PATCH")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(json).unwrap()))
        .unwrap()
}

fn delete(uri: &str) -> Request<Body> {
    Request::builder()
        .method("DELETE")
        .uri(uri)
        .body(Body::empty())
        .unwrap()
}

/// Seed a song so we have a valid song_id for mutation attempts.
fn seed_songs(conn: &aurora_core::rusqlite::Connection) {
    for i in 1..=3 {
        conn.execute(
            "INSERT INTO songs (id, title, artist, album, duration, file_path, file_format, \
             source, created_at, updated_at) \
             VALUES (?1, ?2, 'Artist', 'Album', 200, ?3, 'mp3', 'manual', \
             '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
            rusqlite::params![i, format!("Song {i}"), format!("/tmp/song{i}.mp3")],
        )
        .unwrap();
    }
}

/// Create a smart playlist via the API and return its ID.
async fn create_smart_playlist(app: &axum::Router, name: &str, query: &str) -> i64 {
    let body = serde_json::json!({ "name": name, "query": query });
    let (status, resp) = send(app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 201, "create_smart_playlist failed: {resp}");
    let v: Value = serde_json::from_str(&resp).unwrap();
    v["data"]["id"].as_i64().unwrap()
}

/// Create a manual playlist via the API and return its ID.
async fn create_manual_playlist(app: &axum::Router, name: &str) -> i64 {
    let body = serde_json::json!({ "name": name });
    let (status, resp) = send(app, post_json("/api/playlists", &body)).await;
    assert_eq!(status, 201, "create_manual_playlist failed: {resp}");
    let v: Value = serde_json::from_str(&resp).unwrap();
    v["data"]["id"].as_i64().unwrap()
}

// ── Slice C: Membership guard — smart playlist mutations must 409 ─────

#[tokio::test]
async fn add_song_to_smart_playlist_returns_405() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let sp_id = create_smart_playlist(&app, "Rock SP", "rock").await;

    let body = serde_json::json!({ "song_id": 1 });
    let (status, resp) = send(&app, post_json(&format!("/api/playlists/{sp_id}/songs"), &body)).await;
    assert_eq!(status, 409, "POST songs to smart playlist must return 409: {resp}");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["detail"], "Cannot manually modify a smart playlist's songs");
}

#[tokio::test]
async fn remove_song_from_smart_playlist_returns_405() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let sp_id = create_smart_playlist(&app, "Rock SP", "rock").await;

    let (status, resp) = send(&app, delete(&format!("/api/playlists/{sp_id}/songs/1"))).await;
    assert_eq!(status, 409, "DELETE song from smart playlist must return 409: {resp}");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["detail"], "Cannot manually modify a smart playlist's songs");
}

#[tokio::test]
async fn reorder_smart_playlist_songs_returns_405() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let sp_id = create_smart_playlist(&app, "Rock SP", "rock").await;

    let body = serde_json::json!({ "song_ids": [1, 2, 3] });
    let (status, resp) = send(&app, put_json(&format!("/api/playlists/{sp_id}/songs/reorder"), &body)).await;
    assert_eq!(status, 409, "PUT reorder smart playlist must return 409: {resp}");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["detail"], "Cannot manually modify a smart playlist's songs");
}

#[tokio::test]
async fn update_timing_on_smart_playlist_returns_405() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let sp_id = create_smart_playlist(&app, "Rock SP", "rock").await;

    let body = serde_json::json!({ "start_time_ms": 0, "end_time_ms": 60000 });
    let (status, resp) = send(&app, patch_json(&format!("/api/playlists/{sp_id}/songs/1/timing"), &body)).await;
    assert_eq!(status, 409, "PATCH timing on smart playlist must return 409: {resp}");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["detail"], "Cannot manually modify a smart playlist's songs");
}

#[tokio::test]
async fn smart_playlist_has_no_manual_membership_rows() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let sp_id = create_smart_playlist(&app, "Rock SP", "rock").await;

    // Attempt all 4 mutations
    let body = serde_json::json!({ "song_id": 1 });
    send(&app, post_json(&format!("/api/playlists/{sp_id}/songs"), &body)).await;
    send(&app, delete(&format!("/api/playlists/{sp_id}/songs/1"))).await;
    let reorder_body = serde_json::json!({ "song_ids": [1, 2, 3] });
    send(&app, put_json(&format!("/api/playlists/{sp_id}/songs/reorder"), &reorder_body)).await;
    let timing_body = serde_json::json!({ "start_time_ms": 0, "end_time_ms": 60000 });
    send(&app, patch_json(&format!("/api/playlists/{sp_id}/songs/1/timing"), &timing_body)).await;

    // Verify playlist_songs has zero rows for this smart playlist
    let conn = state.conn.lock().await;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?1",
        [sp_id],
        |r| r.get(0),
    ).unwrap();
    assert_eq!(count, 0, "smart playlist must have zero playlist_songs rows after mutation attempts");
}

// ── Slice C regression: manual + nonexistent still work ───────────────

#[tokio::test]
async fn add_song_to_manual_playlist_still_works() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let manual_id = create_manual_playlist(&app, "My Playlist").await;

    let body = serde_json::json!({ "song_id": 1 });
    let (status, resp) = send(&app, post_json(&format!("/api/playlists/{manual_id}/songs"), &body)).await;
    assert_eq!(status, 200, "POST song to manual playlist must return 200: {resp}");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["message"], "ok");
}

#[tokio::test]
async fn remove_song_from_manual_playlist_still_works() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let manual_id = create_manual_playlist(&app, "My Playlist").await;

    // Add a song first
    let body = serde_json::json!({ "song_id": 1 });
    let (add_status, _) = send(&app, post_json(&format!("/api/playlists/{manual_id}/songs"), &body)).await;
    assert_eq!(add_status, 200);

    // Remove it
    let (status, resp) = send(&app, delete(&format!("/api/playlists/{manual_id}/songs/1"))).await;
    assert_eq!(status, 200, "DELETE song from manual playlist must return 200: {resp}");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["message"], "ok");
}

#[tokio::test]
async fn add_song_to_nonexistent_playlist_returns_404() {
    let (app, state) = build_app_with_state();
    { let conn = state.conn.lock().await; seed_songs(&conn); }

    let body = serde_json::json!({ "song_id": 1 });
    let (status, resp) = send(&app, post_json("/api/playlists/99999/songs", &body)).await;
    assert_eq!(status, 404, "POST song to nonexistent playlist must return 404: {resp}");
}
