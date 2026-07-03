//! Watcher router — ported from backend/app/routers/watcher.py.
//!
//! GET /watch — list watched folders.
//! POST /watch — add folder to watch list.
//! DELETE /watch/{id} — remove watched folder.
//! POST /watch/{id}/scan — trigger scan of watched folder.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

#[derive(Deserialize)]
pub struct WatchFolderRequest {
    pub path: String,
}

/// Build the scan result JSON envelope (shared by trigger_scan paths).
fn build_scan_response(result: aurora_core::scanner::db::ScanResult) -> Value {
    serde_json::json!({
        "folders_scanned": 1,
        "imported": result.imported,
        "replaced": result.replaced,
        "skipped": result.skipped,
        "deleted": 0,
        "errors": result.errors.len(),
    })
}

/// GET /api/watch — list all watched folders.
pub async fn list_watched_folders(
    State(state): State<Arc<AppState>>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::list_watched_folders(&conn) {
        Ok(data) => envelope::ok(Value::Array(data), "ok").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// POST /api/watch — add a folder to the watch list.
pub async fn add_watched_folder(
    State(state): State<Arc<AppState>>,
    Json(req): Json<WatchFolderRequest>,
) -> Response {
    let folder_path = std::path::Path::new(&req.path).canonicalize();
    let folder_path = match folder_path {
        Ok(p) => p,
        Err(_) => return envelope::not_found("Path does not exist or is not a directory").into_response(),
    };

    if !folder_path.is_dir() {
        return envelope::not_found("Path does not exist or is not a directory").into_response();
    }

    let path_str = folder_path.to_string_lossy().to_string();
    let conn = state.conn.lock().await;

    let existing = aurora_core::db::queries::get_watched_folder_by_path(&conn, &path_str);

    match existing {
        Ok(Some((id, is_active))) => {
            if !is_active {
                let _ = aurora_core::db::queries::reactivate_watched_folder(&conn, id);
            }
            let message = if is_active { "Folder already watched" } else { "Folder reactivated" };
            envelope::ok(
                serde_json::json!({"id": id, "folder_path": path_str, "is_active": true}),
                message,
            ).into_response()
        }
        Ok(None) => {
            match aurora_core::db::queries::insert_watched_folder(&conn, &path_str) {
                Ok(id) => envelope::ok(
                    serde_json::json!({"id": id, "folder_path": path_str, "is_active": true}),
                    "ok",
                ).into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// DELETE /api/watch/{id} — remove a watched folder.
pub async fn remove_watched_folder(
    State(state): State<Arc<AppState>>,
    Path(folder_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::watched_folder_exists(&conn, folder_id) {
        Ok(true) => {}
        Ok(false) => return envelope::not_found("Watched folder not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }

    let _ = aurora_core::db::queries::delete_watched_folder(&conn, folder_id);
    envelope::ok(serde_json::json!({"id": folder_id}), "ok").into_response()
}

/// POST /api/watch/{id}/scan — trigger scan of a specific watched folder.
///
/// Uses spawn_blocking for the scan+decode work so the tokio worker is not
/// pinned. Opens a dedicated DB connection inside the blocking task (same
/// pattern as the SSE scan path).
pub async fn trigger_scan(
    State(state): State<Arc<AppState>>,
    Path(folder_id): Path<i64>,
) -> Response {
    // Phase 1: Get folder path while holding the lock, then release
    let folder_path: String = {
        let conn = state.conn.lock().await;
        match aurora_core::db::queries::get_watched_folder_path(&conn, folder_id) {
            Ok(Some(p)) => p,
            Ok(None) => return envelope::not_found("Watched folder not found").into_response(),
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
        }
    };
    // Lock released — other routes can proceed

    // Phase 2: Open dedicated scan connection and run scan on blocking thread
    let db_path = match state.db_path.clone() {
        Some(p) => p,
        None => {
            // Test harness: use shared connection (lock briefly)
            let conn = state.conn.lock().await;
            let result = aurora_core::scanner::db::import_scanned_songs(
                &conn,
                &folder_path,
                None,
                None,
                None,
            );
            let _ = aurora_core::db::queries::update_watched_folder_last_scan(&conn, folder_id);
            return match result {
                Ok(scan_result) => envelope::ok(build_scan_response(scan_result), "ok").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            };
        }
    };

    // Scan using dedicated connection on blocking thread (AppState.conn NOT held)
    let scan_result = tokio::task::spawn_blocking(move || {
        let conn = aurora_core::db::open_and_migrate(&db_path)?;
        aurora_core::scanner::db::import_scanned_songs(
            &conn,
            &folder_path,
            None,
            None,
            None,
        )
    })
    .await;

    // Phase 3: Update last_scan_at (re-acquire lock briefly)
    {
        let conn = state.conn.lock().await;
        let _ = aurora_core::db::queries::update_watched_folder_last_scan(&conn, folder_id);
    }

    match scan_result {
        Ok(Ok(result)) => envelope::ok(build_scan_response(result), "ok").into_response(),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}
