//! AURORA_TOKEN auth parity tests (N42).
//!
//! Validates the Rust server enforces the same token auth contract as Python
//! (backend/app/main.py:127-150): opt-in by env, health/OPTIONS exempt,
//! header-then-query, constant-time compare, 401 on mismatch.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceExt;

use aurora_server::AppState;

const TEST_TOKEN: &str = "test-secret-token-32bytes-long!";

// ── Helpers ───────────────────────────────────────────────────────────

/// Build app with AURORA_TOKEN configured.
fn build_app_with_token() -> axum::Router {
    let conn = aurora_core::db::open_memory().expect("open_memory failed");
    seed_minimal(&conn);
    let state = Arc::new(AppState {
        conn: Mutex::new(conn),
        db_path: None,
        addon_state: Arc::new(aurora_server::routes::addons::AddonState::new()),
        watcher_handle: None,
        aurora_token: Some(TEST_TOKEN.to_string()),
    });
    aurora_server::build_router(state)
}

/// Build app with NO token configured (auth fully off).
fn build_app_no_token() -> axum::Router {
    let conn = aurora_core::db::open_memory().expect("open_memory failed");
    seed_minimal(&conn);
    let state = Arc::new(AppState {
        conn: Mutex::new(conn),
        db_path: None,
        addon_state: Arc::new(aurora_server::routes::addons::AddonState::new()),
        watcher_handle: None,
        aurora_token: None,
    });
    aurora_server::build_router(state)
}

fn seed_minimal(conn: &aurora_core::rusqlite::Connection) {
    conn.execute(
        "INSERT INTO songs (id, title, artist, album, duration, file_path, file_format, \
         album_art_path, source, bitrate, sample_rate, bit_depth, file_size, \
         waveform_peaks, dominant_color, dominant_color_2, \
         replaygain_track_gain, replaygain_track_peak, \
         replaygain_album_gain, replaygain_album_peak, \
         artists, featured_artists, created_at, updated_at) \
         VALUES (1,'Test','Artist','Album',200,'/tmp/t.mp3','mp3',NULL,'manual', \
         NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL, \
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

fn get(uri: &str) -> Request<Body> {
    Request::builder().uri(uri).body(Body::empty()).unwrap()
}

fn get_with_header(uri: &str, header_name: &str, header_value: &str) -> Request<Body> {
    Request::builder()
        .uri(uri)
        .header(header_name, header_value)
        .body(Body::empty())
        .unwrap()
}

fn options(uri: &str) -> Request<Body> {
    Request::builder()
        .method("OPTIONS")
        .uri(uri)
        .body(Body::empty())
        .unwrap()
}

fn options_with_origin(uri: &str, origin: &str) -> Request<Body> {
    Request::builder()
        .method("OPTIONS")
        .uri(uri)
        .header("Origin", origin)
        .header("Access-Control-Request-Method", "GET")
        .body(Body::empty())
        .unwrap()
}

fn get_with_origin(uri: &str, origin: &str) -> Request<Body> {
    Request::builder()
        .uri(uri)
        .header("Origin", origin)
        .body(Body::empty())
        .unwrap()
}

// ═══════════════════════════════════════════════════════════════════════
// Auth tests — token configured
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn auth_health_exempt_no_token() {
    let app = build_app_with_token();
    let (s, _) = send(&app, get("/api/health")).await;
    assert_eq!(s, 200, "GET /api/health must be 200 with no token (exempt)");
}

#[tokio::test]
async fn auth_options_exempt() {
    let app = build_app_with_token();
    let (s, _) = send(&app, options("/api/songs")).await;
    // OPTIONS should pass the auth guard (status depends on route existence,
    // but should NOT be 401)
    assert_ne!(s, 401, "OPTIONS /api/songs must not be 401 (exempt)");
}

#[tokio::test]
async fn auth_no_token_rejects() {
    let app = build_app_with_token();
    let (s, body) = send(&app, get("/api/songs")).await;
    assert_eq!(s, 401, "GET /api/songs with no token must be 401");
    assert_eq!(body, "Unauthorized", "401 body must be 'Unauthorized'");
}

#[tokio::test]
async fn auth_wrong_header_token_rejects() {
    let app = build_app_with_token();
    let (s, body) = send(
        &app,
        get_with_header("/api/songs", "X-Aurora-Token", "wrong-token"),
    )
    .await;
    assert_eq!(
        s, 401,
        "GET /api/songs with wrong X-Aurora-Token must be 401"
    );
    assert_eq!(body, "Unauthorized");
}

#[tokio::test]
async fn auth_correct_header_token_passes() {
    let app = build_app_with_token();
    let (s, _) = send(
        &app,
        get_with_header("/api/songs", "X-Aurora-Token", TEST_TOKEN),
    )
    .await;
    assert_eq!(
        s, 200,
        "GET /api/songs with correct X-Aurora-Token must be 200"
    );
}

#[tokio::test]
async fn auth_correct_query_token_passes() {
    let app = build_app_with_token();
    let uri = format!("/api/songs?token={}", TEST_TOKEN);
    let (s, _) = send(&app, get(&uri)).await;
    assert_eq!(
        s, 200,
        "GET /api/songs?token=<correct> must be 200 (query fallback)"
    );
}

#[tokio::test]
async fn auth_wrong_query_token_rejects() {
    let app = build_app_with_token();
    let (s, body) = send(&app, get("/api/songs?token=wrong-token")).await;
    assert_eq!(s, 401, "GET /api/songs?token=<wrong> must be 401");
    assert_eq!(body, "Unauthorized");
}

// ═══════════════════════════════════════════════════════════════════════
// Auth tests — no token configured (auth fully off)
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn no_token_allows_all() {
    let app = build_app_no_token();
    let (s, _) = send(&app, get("/api/songs")).await;
    assert_eq!(
        s, 200,
        "GET /api/songs with no token configured must be 200 (auth off)"
    );
}

// ═══════════════════════════════════════════════════════════════════════
// CORS tests — Tauri WebView2 origins
// ═══════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn cors_preflight_tauri_localhost_not_rejected() {
    let app = build_app_with_token();
    let (s, _) = send(
        &app,
        options_with_origin("/api/songs", "https://tauri.localhost"),
    )
    .await;
    assert_ne!(
        s, 401,
        "Preflight from https://tauri.localhost must not be rejected by auth"
    );
    assert_ne!(
        s, 403,
        "Preflight from https://tauri.localhost must not be forbidden"
    );
    assert_ne!(
        s, 405,
        "Preflight from https://tauri.localhost must be allowed"
    );
}

#[tokio::test]
async fn cors_preflight_tauri_scheme_not_rejected() {
    let app = build_app_with_token();
    let (s, _) = send(&app, options_with_origin("/api/songs", "tauri://localhost")).await;
    assert_ne!(
        s, 401,
        "Preflight from tauri://localhost must not be rejected by auth"
    );
    assert_ne!(
        s, 403,
        "Preflight from tauri://localhost must not be forbidden"
    );
    assert_ne!(s, 405, "Preflight from tauri://localhost must be allowed");
}

#[tokio::test]
async fn cors_preflight_has_acao_header() {
    let app = build_app_with_token();
    let resp = app
        .clone()
        .oneshot(options_with_origin("/api/songs", "https://tauri.localhost"))
        .await
        .unwrap();
    let acao = resp.headers().get("access-control-allow-origin");
    assert!(
        acao.is_some(),
        "Preflight response must include access-control-allow-origin"
    );
}

#[tokio::test]
async fn cors_get_has_acao_for_tauri_origin() {
    let app = build_app_with_token();
    let resp = app
        .clone()
        .oneshot(get_with_origin("/api/health", "tauri://localhost"))
        .await
        .unwrap();
    let acao = resp.headers().get("access-control-allow-origin");
    assert!(
        acao.is_some(),
        "GET from tauri://localhost must have access-control-allow-origin"
    );
    // very_permissive() reflects the request origin
    assert_eq!(acao.unwrap().to_str().unwrap(), "tauri://localhost");
}

#[tokio::test]
async fn cors_get_has_acao_for_https_tauri_origin() {
    let app = build_app_with_token();
    let resp = app
        .clone()
        .oneshot(get_with_origin("/api/health", "https://tauri.localhost"))
        .await
        .unwrap();
    let acao = resp.headers().get("access-control-allow-origin");
    assert!(
        acao.is_some(),
        "GET from https://tauri.localhost must have access-control-allow-origin"
    );
    assert_eq!(acao.unwrap().to_str().unwrap(), "https://tauri.localhost");
}

#[tokio::test]
async fn auth_still_rejects_without_token_despite_cors() {
    // CORS allows the request through, but auth middleware must still block it
    let app = build_app_with_token();
    let (s, body) = send(
        &app,
        get_with_origin("/api/songs", "https://tauri.localhost"),
    )
    .await;
    assert_eq!(
        s, 401,
        "GET /api/songs from Tauri origin without token must still be 401"
    );
    assert_eq!(body, "Unauthorized");
}
