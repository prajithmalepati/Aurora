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

/// GET /api/watch — list all watched folders.
pub async fn list_watched_folders(
    State(state): State<Arc<AppState>>,
) -> Response {
    let conn = state.conn.lock().await;
    let mut stmt = match conn.prepare(
        "SELECT id, folder_path, is_active, last_scan_at, created_at FROM watched_folders ORDER BY created_at DESC"
    ) {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    };

    let rows = match stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "folder_path": row.get::<_, String>(1)?,
            "is_active": row.get::<_, i64>(2)? != 0,
            "last_scan_at": row.get::<_, Option<String>>(3)?,
            "created_at": row.get::<_, String>(4)?,
        }))
    }) {
        Ok(rows) => rows,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    };

    let data: Vec<Value> = match rows.collect::<std::result::Result<Vec<_>, _>>() {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    };

    envelope::ok(Value::Array(data), "ok").into_response()
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

    // Check if already exists
    let existing = conn.query_row(
        "SELECT id, is_active FROM watched_folders WHERE folder_path = ?1",
        [&path_str],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)? != 0)),
    ).optional();

    match existing {
        Ok(Some((id, is_active))) => {
            if !is_active {
                let _ = conn.execute(
                    "UPDATE watched_folders SET is_active = 1 WHERE id = ?1",
                    [id],
                );
            }
            let message = if is_active { "Folder already watched" } else { "Folder reactivated" };
            envelope::ok(
                serde_json::json!({"id": id, "folder_path": path_str, "is_active": true}),
                message,
            ).into_response()
        }
        Ok(None) => {
            let result = conn.execute(
                "INSERT INTO watched_folders (folder_path) VALUES (?1)",
                [&path_str],
            );
            match result {
                Ok(_) => {
                    let id = conn.last_insert_rowid();
                    envelope::ok(
                        serde_json::json!({"id": id, "folder_path": path_str, "is_active": true}),
                        "ok",
                    ).into_response()
                }
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
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM watched_folders WHERE id = ?1",
        [folder_id],
        |row| row.get::<_, i64>(0),
    ).map(|c| c > 0).unwrap_or(false);

    if !exists {
        return envelope::not_found("Watched folder not found").into_response();
    }

    let _ = conn.execute("DELETE FROM watched_folders WHERE id = ?1", [folder_id]);
    envelope::ok(serde_json::json!({"id": folder_id}), "ok").into_response()
}

/// POST /api/watch/{id}/scan — trigger scan of a specific watched folder.
pub async fn trigger_scan(
    State(state): State<Arc<AppState>>,
    Path(folder_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;

    // Check folder exists
    let folder_path: String = match conn.query_row(
        "SELECT folder_path FROM watched_folders WHERE id = ?1",
        [folder_id],
        |row| row.get(0),
    ).optional() {
        Ok(Some(p)) => p,
        Ok(None) => return envelope::not_found("Watched folder not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    };

    // Run scan
    let result = aurora_core::scanner::db::import_scanned_songs(
        &conn,
        &folder_path,
        None,
        None,
        None,
    );

    // Update last_scan_at
    let now = aurora_core::db::queries::chrono_now();
    let _ = conn.execute(
        "UPDATE watched_folders SET last_scan_at = ?1 WHERE id = ?2",
        rusqlite::params![now, folder_id],
    );

    match result {
        Ok(scan_result) => {
            envelope::ok(
                serde_json::json!({
                    "folders_scanned": 1,
                    "imported": scan_result.imported,
                    "replaced": scan_result.replaced,
                    "skipped": scan_result.skipped,
                    "deleted": 0,
                    "errors": scan_result.errors.len(),
                }),
                "ok",
            ).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

use rusqlite::OptionalExtension;
