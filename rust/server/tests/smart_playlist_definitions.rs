//! Integration tests for /api/smart-playlists (G3/B2).
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

fn build_app() -> axum::Router {
    let state = build_state();
    aurora_server::build_router(state)
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

// ── Slice 2: Create ──────────────────────────────────────────────────

#[tokio::test]
async fn create_smart_playlist_valid_returns_201() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "Chill Vibes",
        "query": "chill OR relaxed"
    });
    let (status, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 201, "POST /api/smart-playlists must return 201");

    let v: Value = serde_json::from_str(&resp).unwrap();
    let data = &v["data"];
    assert_eq!(data["name"], "Chill Vibes");
    assert_eq!(data["query"], "chill OR relaxed");
    assert!(data["id"].as_i64().is_some_and(|id| id > 0));
    assert!(data["created_at"].as_str().is_some_and(|s| !s.is_empty()));
    assert!(data["updated_at"].as_str().is_some_and(|s| !s.is_empty()));
}

#[tokio::test]
async fn create_smart_playlist_with_color_and_emoji() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "Workout Mix",
        "color": "#ff5500",
        "emoji": "🔥",
        "query": "energetic"
    });
    let (status, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 201);

    let v: Value = serde_json::from_str(&resp).unwrap();
    let data = &v["data"];
    assert_eq!(data["name"], "Workout Mix");
    assert_eq!(data["color"], "#ff5500");
    assert_eq!(data["emoji"], "🔥");
    assert_eq!(data["query"], "energetic");
}

#[tokio::test]
async fn create_smart_playlist_empty_query_returns_422() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "Bad Playlist",
        "query": ""
    });
    let (status, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 422, "empty query must return 422");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert!(v["detail"].as_str().is_some());
}

#[tokio::test]
async fn create_smart_playlist_malformed_query_returns_422() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "Bad Query",
        "query": "AND"
    });
    let (status, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 422, "malformed query must return 422");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert!(v["detail"].as_str().is_some());
}

#[tokio::test]
async fn create_smart_playlist_blank_query_returns_422() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "Blank Query",
        "query": "   "
    });
    let (status, _) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 422, "whitespace-only query must return 422");
}

#[tokio::test]
async fn create_smart_playlist_duplicate_name_returns_409() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "My Smart List",
        "query": "rock"
    });
    let (status, _) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 201, "first create must succeed");

    let (status, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 409, "duplicate name must return 409");

    let v: Value = serde_json::from_str(&resp).unwrap();
    assert!(v["detail"].as_str().is_some());
}

#[tokio::test]
async fn create_smart_playlist_empty_name_returns_422() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "",
        "query": "rock"
    });
    let (status, _) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 422, "empty name must return 422");
}

#[tokio::test]
async fn create_smart_playlist_atomic_on_bad_query() {
    let app = build_app();
    let body = serde_json::json!({
        "name": "Valid List",
        "query": "rock"
    });
    let (status, _) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 201);
    let body = serde_json::json!({
        "name": "Orphan Test",
        "query": "AND"
    });
    let (status, _) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(status, 422);
    let (status, resp) = send(&app, get("/api/smart-playlists")).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    let list = v["data"].as_array().unwrap();
    assert_eq!(list.len(), 1, "failed create must not leave orphan");
    assert_eq!(list[0]["name"], "Valid List");
}

// ── Slice 3: Read ─────────────────────────────────────────────────────

#[tokio::test]
async fn list_smart_playlists_empty() {
    let app = build_app();
    let (status, resp) = send(&app, get("/api/smart-playlists")).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["data"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn list_smart_playlists_ordered_by_name() {
    let app = build_app();
    for (name, q) in [("Zebra", "rock"), ("Alpha", "jazz"), ("Middle", "pop")] {
        let body = serde_json::json!({"name": name, "query": q});
        let (s, _) = send(&app, post_json("/api/smart-playlists", &body)).await;
        assert_eq!(s, 201);
    }
    let (status, resp) = send(&app, get("/api/smart-playlists")).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    let list = v["data"].as_array().unwrap();
    assert_eq!(list.len(), 3);
    assert_eq!(list[0]["name"], "Alpha");
    assert_eq!(list[1]["name"], "Middle");
    assert_eq!(list[2]["name"], "Zebra");
}

#[tokio::test]
async fn get_smart_playlist_by_id() {
    let app = build_app();
    let body = serde_json::json!({"name": "My List", "query": "chill"});
    let (s, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(s, 201);
    let created: Value = serde_json::from_str(&resp).unwrap();
    let id = created["data"]["id"].as_i64().unwrap();

    let (status, resp) = send(&app, get(&format!("/api/smart-playlists/{id}"))).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["data"]["name"], "My List");
    assert_eq!(v["data"]["query"], "chill");
}

#[tokio::test]
async fn get_smart_playlist_nonexistent_returns_404() {
    let app = build_app();
    let (status, _) = send(&app, get("/api/smart-playlists/999")).await;
    assert_eq!(status, 404);
}

#[tokio::test]
async fn get_smart_playlist_manual_returns_404() {
    let app = build_app();
    // Create a manual playlist via the legacy endpoint
    let body = serde_json::json!({"name": "Manual List"});
    let req = Request::builder()
        .method("POST")
        .uri("/api/playlists")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();
    let (s, resp) = send(&app, req).await;
    assert_eq!(s, 201);
    let v: Value = serde_json::from_str(&resp).unwrap();
    let id = v["data"]["id"].as_i64().unwrap();

    // GET via smart-playlists endpoint must return 404
    let (status, _) = send(&app, get(&format!("/api/smart-playlists/{id}"))).await;
    assert_eq!(status, 404, "manual playlist must not be accessible via smart endpoint");
}

#[tokio::test]
async fn legacy_playlists_have_no_query_field() {
    let app = build_app();
    // Create a smart playlist
    let body = serde_json::json!({"name": "Smart One", "query": "rock"});
    let (s, _) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(s, 201);

    // GET legacy /api/playlists — the item must NOT have a "query" field
    let (status, resp) = send(&app, get("/api/playlists")).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    let list = v["data"].as_array().unwrap();
    assert_eq!(list.len(), 1);
    assert!(
        list[0].get("query").is_none(),
        "legacy playlist response must not contain 'query' field"
    );
}

// ── Slice 4: Update ──────────────────────────────────────────────────

#[tokio::test]
async fn update_smart_playlist_name() {
    let app = build_app();
    let body = serde_json::json!({"name": "Original", "query": "rock"});
    let (s, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(s, 201);
    let created: Value = serde_json::from_str(&resp).unwrap();
    let id = created["data"]["id"].as_i64().unwrap();

    let update = serde_json::json!({"name": "Renamed"});
    let req = Request::builder()
        .method("PUT")
        .uri(format!("/api/smart-playlists/{id}"))
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&update).unwrap()))
        .unwrap();
    let (status, resp) = send(&app, req).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["data"]["name"], "Renamed");
    assert_eq!(v["data"]["query"], "rock", "query must be unchanged");
}

#[tokio::test]
async fn update_smart_playlist_query() {
    let app = build_app();
    let body = serde_json::json!({"name": "My List", "query": "rock"});
    let (s, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(s, 201);
    let created: Value = serde_json::from_str(&resp).unwrap();
    let id = created["data"]["id"].as_i64().unwrap();

    let update = serde_json::json!({"query": "jazz AND blues"});
    let req = Request::builder()
        .method("PUT")
        .uri(format!("/api/smart-playlists/{id}"))
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&update).unwrap()))
        .unwrap();
    let (status, resp) = send(&app, req).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["data"]["query"], "jazz AND blues");
}

#[tokio::test]
async fn update_smart_playlist_invalid_query_no_mutation() {
    let app = build_app();
    let body = serde_json::json!({"name": "My List", "query": "rock"});
    let (s, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(s, 201);
    let created: Value = serde_json::from_str(&resp).unwrap();
    let id = created["data"]["id"].as_i64().unwrap();

    // Try to update with invalid query
    let update = serde_json::json!({"query": "AND"});
    let req = Request::builder()
        .method("PUT")
        .uri(format!("/api/smart-playlists/{id}"))
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&update).unwrap()))
        .unwrap();
    let (status, _) = send(&app, req).await;
    assert_eq!(status, 422, "invalid query must return 422");

    // Verify original query is unchanged
    let (status, resp) = send(&app, get(&format!("/api/smart-playlists/{id}"))).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["data"]["query"], "rock", "query must be unchanged after failed update");
}

#[tokio::test]
async fn update_smart_playlist_nonexistent_returns_404() {
    let app = build_app();
    let update = serde_json::json!({"name": "Ghost"});
    let req = Request::builder()
        .method("PUT")
        .uri("/api/smart-playlists/999")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&update).unwrap()))
        .unwrap();
    let (status, _) = send(&app, req).await;
    assert_eq!(status, 404);
}

// ── Slice 5: Delete ──────────────────────────────────────────────────

#[tokio::test]
async fn delete_smart_playlist_cascades() {
    let app = build_app();
    let body = serde_json::json!({"name": "To Delete", "query": "rock"});
    let (s, resp) = send(&app, post_json("/api/smart-playlists", &body)).await;
    assert_eq!(s, 201);
    let created: Value = serde_json::from_str(&resp).unwrap();
    let id = created["data"]["id"].as_i64().unwrap();

    // Delete
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/smart-playlists/{id}"))
        .body(Body::empty())
        .unwrap();
    let (status, _) = send(&app, req).await;
    assert_eq!(status, 200);

    // Verify it's gone from smart list
    let (status, _) = send(&app, get(&format!("/api/smart-playlists/{id}"))).await;
    assert_eq!(status, 404, "deleted smart playlist must return 404");

    // Verify the backing playlist is also gone from legacy list
    let (status, resp) = send(&app, get("/api/playlists")).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    let list = v["data"].as_array().unwrap();
    assert_eq!(list.len(), 0, "backing playlist must be deleted via cascade");
}

#[tokio::test]
async fn delete_manual_playlist_returns_404() {
    let app = build_app();
    // Create a manual playlist via legacy endpoint
    let body = serde_json::json!({"name": "Manual List"});
    let req = Request::builder()
        .method("POST")
        .uri("/api/playlists")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();
    let (s, resp) = send(&app, req).await;
    assert_eq!(s, 201);
    let v: Value = serde_json::from_str(&resp).unwrap();
    let id = v["data"]["id"].as_i64().unwrap();

    // Try to delete via smart endpoint — must return 404
    let req = Request::builder()
        .method("DELETE")
        .uri(format!("/api/smart-playlists/{id}"))
        .body(Body::empty())
        .unwrap();
    let (status, _) = send(&app, req).await;
    assert_eq!(status, 404, "manual playlist must not be deletable via smart endpoint");

    // Verify the manual playlist still exists
    let (status, resp) = send(&app, get("/api/playlists")).await;
    assert_eq!(status, 200);
    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["data"].as_array().unwrap().len(), 1, "manual playlist must survive");
}

// ── Koji repair: Finding A — atomic update ─────────────────────────────

#[tokio::test]
async fn update_smart_playlist_atomic_rollback_on_definition_failure() {
    let conn = aurora_core::db::open_memory().expect("open_memory failed");

    // Create a smart playlist via core function
    let id = aurora_core::db::queries::create_smart_playlist(
        &conn, "Original", None, None, "rock",
    )
    .expect("create failed");

    // Install a trigger that makes any UPDATE on smart_playlist_definitions fail
    conn.execute_batch(
        "CREATE TEMP TRIGGER fail_def_update
         BEFORE UPDATE ON smart_playlist_definitions
         BEGIN
             SELECT RAISE(ABORT, 'injected failure');
         END",
    )
    .expect("trigger creation failed");

    // Snapshot original values
    let row: (String, String) = conn
        .query_row(
            "SELECT p.name, sp.query FROM playlists p JOIN smart_playlist_definitions sp ON sp.playlist_id = p.id WHERE p.id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("snapshot query failed");
    let (orig_name, orig_query) = row;

    // Attempt update of BOTH name and query — definition write should fail
    let result = aurora_core::db::queries::update_smart_playlist(
        &conn,
        id,
        Some("Renamed"),
        None,
        None,
        Some("jazz"),
    );
    assert!(result.is_err(), "update must fail when definition write fails");

    // Verify BOTH values are unchanged (atomic rollback)
    let row: (String, String) = conn
        .query_row(
            "SELECT p.name, sp.query FROM playlists p JOIN smart_playlist_definitions sp ON sp.playlist_id = p.id WHERE p.id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("verify query failed");
    assert_eq!(row.0, orig_name, "name must be unchanged after failed update");
    assert_eq!(row.1, orig_query, "query must be unchanged after failed update");
}

// ── Koji repair: Finding B — list error propagation ────────────────────

#[tokio::test]
async fn list_smart_playlists_db_error_returns_500() {
    let (app, state) = build_app_with_state();

    // First verify normal list works (regression)
    let (status, resp) = send(&app, get("/api/smart-playlists")).await;
    assert_eq!(status, 200, "normal list must return 200");
    let v: Value = serde_json::from_str(&resp).unwrap();
    assert_eq!(v["data"].as_array().unwrap().len(), 0);
    assert_eq!(v["meta"]["total"], 0);

    // Drop the smart_playlist_definitions table to cause a DB error
    {
        let conn = state.conn.lock().await;
        conn.execute_batch("DROP TABLE smart_playlist_definitions")
            .expect("drop table failed");
    }

    // List must now return 500, NOT 200 with empty data
    let (status, _resp) = send(&app, get("/api/smart-playlists")).await;
    assert_eq!(
        status, 500,
        "list must return 500 when DB query fails, not 200 with empty data"
    );
}
