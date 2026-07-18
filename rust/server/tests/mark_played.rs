//! Integration tests for POST /api/songs/{id}/played (G3/A2).
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

fn build_app() -> axum::Router {
    let conn = aurora_core::db::open_memory().expect("open_memory failed");
    seed_songs(&conn);
    let state = Arc::new(AppState {
        conn: Mutex::new(conn),
        db_path: None,
        addon_state: Arc::new(aurora_server::routes::addons::AddonState::new()),
        watcher_handle: None,
        aurora_token: None,
    });
    aurora_server::build_router(state)
}

fn seed_songs(conn: &aurora_core::rusqlite::Connection) {
    conn.execute(
        "INSERT INTO songs (id, title, artist, album, duration, file_path, file_format, \
         album_art_path, source, created_at, updated_at) \
         VALUES (1,'Test Song','Test Artist','Test Album',200,'/tmp/t.mp3','mp3',NULL,'manual', \
         '2025-01-01T00:00:00Z','2025-01-01T00:00:00Z')",
        [],
    )
    .unwrap();
}

async fn send(app: &axum::Router, req: Request<Body>) -> (StatusCode, String) {
    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body = String::from_utf8_lossy(&body_bytes).to_string();
    (status, body)
}

fn post(uri: &str) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .body(Body::empty())
        .unwrap()
}

#[allow(dead_code)]
fn get(uri: &str) -> Request<Body> {
    Request::builder().uri(uri).body(Body::empty()).unwrap()
}

// ── Tests ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn mark_played_increments_from_zero() {
    let app = build_app();
    let (status, body) = send(&app, post("/api/songs/1/played")).await;
    assert_eq!(status, 200, "POST /songs/1/played must return 200");

    let v: Value = serde_json::from_str(&body).unwrap();
    let song = &v["data"];
    assert_eq!(song["play_count"], 1, "play_count must be 1 after first call");
    assert!(
        song["last_played_at"].as_str().is_some_and(|s| !s.is_empty()),
        "last_played_at must be a non-empty ISO timestamp"
    );
}

#[tokio::test]
async fn mark_played_three_calls_equals_three() {
    let app = build_app();
    let mut last_body = String::new();
    for _ in 0..3 {
        let (status, body) = send(&app, post("/api/songs/1/played")).await;
        assert_eq!(status, 200);
        last_body = body;
    }

    // Verify from the last POST response (play fields are endpoint-specific)
    let v: Value = serde_json::from_str(&last_body).unwrap();
    assert_eq!(v["data"]["play_count"], 3, "play_count must be 3 after three calls");
}

#[tokio::test]
async fn mark_played_nonexistent_returns_404() {
    let app = build_app();
    let (status, body) = send(&app, post("/api/songs/999/played")).await;
    assert_eq!(status, 404, "POST /songs/999/played must return 404");

    let v: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["detail"], "Song not found");
}
