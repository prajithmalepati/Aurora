//! Albums router — ported from backend/app/routers/albums.py.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::Value;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

/// GET /api/albums — list all albums with aggregated metadata.
pub async fn list_albums(
    State(state): State<Arc<AppState>>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::list_albums(&conn) {
        Ok((data, total)) => envelope::ok_meta(
            Value::Array(data),
            "ok",
            serde_json::json!({ "total": total }),
        )
        .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"detail": e.to_string()})),
        )
            .into_response(),
    }
}

/// GET /api/albums/{album_name} — songs in an album.
pub async fn get_album(
    State(state): State<Arc<AppState>>,
    Path(album_name): Path<String>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::get_album_songs(&conn, &album_name) {
        Ok(songs) => {
            if songs.is_empty() {
                return envelope::not_found("Album not found").into_response();
            }
            envelope::ok(
                serde_json::json!({
                    "album_name": album_name,
                    "songs": songs,
                }),
                "ok",
            )
            .into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"detail": e.to_string()})),
        )
            .into_response(),
    }
}
