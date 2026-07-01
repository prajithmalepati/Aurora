//! Folders router — ported from backend/app/routers/folders.rs.

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

#[derive(Deserialize)]
pub struct FolderSongsParams {
    pub path: String,
    pub recursive: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /api/folders — return the folder tree.
pub async fn get_folder_tree(
    State(state): State<Arc<AppState>>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::list_folder_tree(&conn) {
        Ok((tree, total_folders, total_songs)) => envelope::ok_meta(
            serde_json::json!({ "folders": tree }),
            "ok",
            serde_json::json!({ "total_folders": total_folders, "total_songs": total_songs }),
        )
        .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"detail": e.to_string()})),
        )
            .into_response(),
    }
}

/// GET /api/folders/songs — songs within a folder path.
pub async fn get_folder_songs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<FolderSongsParams>,
) -> Response {
    let conn = state.conn.lock().await;
    let recursive = params.recursive.unwrap_or(false);
    let limit = params.limit.unwrap_or(500);
    let offset = params.offset.unwrap_or(0);

    match aurora_core::db::queries::list_folder_songs(
        &conn,
        &params.path,
        recursive,
        limit,
        offset,
    ) {
        Ok((songs, total)) => envelope::ok_meta(
            Value::Array(songs),
            "ok",
            serde_json::json!({
                "total": total,
                "path": params.path,
                "recursive": recursive,
            }),
        )
        .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"detail": e.to_string()})),
        )
            .into_response(),
    }
}
