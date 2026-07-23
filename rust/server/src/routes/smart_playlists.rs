//! Smart playlist definitions router — G3/B2.
//!
//! New `/api/smart-playlists` route family. Does NOT modify any legacy
//! `/api/playlists` responses.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

// ── Request types ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateSmartPlaylist {
    pub name: String,
    pub color: Option<String>,
    pub emoji: Option<String>,
    pub query: String,
}

#[derive(Deserialize)]
pub struct UpdateSmartPlaylist {
    pub name: Option<String>,
    pub color: Option<Option<String>>,
    pub emoji: Option<Option<String>>,
    pub query: Option<String>,
}

// ── Handlers ─────────────────────────────────────────────────────────

/// POST /api/smart-playlists — atomically create a smart playlist.
pub async fn create_smart_playlist(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateSmartPlaylist>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::create_smart_playlist(
        &conn,
        &body.name,
        body.color.as_deref(),
        body.emoji.as_deref(),
        &body.query,
    ) {
        Ok(id) => {
            // Fetch the created definition to return it
            match aurora_core::db::queries::get_smart_playlist(&conn, id) {
                Ok(Some(data)) => (StatusCode::CREATED, envelope::ok(data, "created")).into_response(),
                Ok(None) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": "created but not found"}))).into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Err(e) => {
            let msg = e.to_string();
            if msg == "empty_name" {
                envelope::unprocessable("Name cannot be empty").into_response()
            } else if msg.starts_with("invalid_query:") {
                let detail = msg.strip_prefix("invalid_query: ").unwrap_or(&msg);
                envelope::unprocessable(&format!("Invalid query: {detail}")).into_response()
            } else if msg == "duplicate_name" {
                envelope::conflict("A playlist with this name already exists").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// GET /api/smart-playlists — list all smart playlist definitions.
pub async fn list_smart_playlists(
    State(state): State<Arc<AppState>>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::list_smart_playlists(&conn) {
        Ok(playlists) => {
            let total = playlists.len() as i64;
            envelope::ok_meta(Value::Array(playlists), "ok", serde_json::json!({ "total": total })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "detail": e.to_string() }))).into_response()
        }
    }
}

/// GET /api/smart-playlists/{id} — get one smart playlist definition.
pub async fn get_smart_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::get_smart_playlist(&conn, playlist_id) {
        Ok(Some(data)) => envelope::ok(data, "ok").into_response(),
        Ok(None) => envelope::not_found("Smart playlist not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// PUT /api/smart-playlists/{id} — update a smart playlist definition.
pub async fn update_smart_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
    Json(body): Json<UpdateSmartPlaylist>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::update_smart_playlist(
        &conn,
        playlist_id,
        body.name.as_deref(),
        body.color.as_ref().map(|c| c.as_deref()),
        body.emoji.as_ref().map(|e| e.as_deref()),
        body.query.as_deref(),
    ) {
        Ok(true) => {
            // Fetch and return the updated definition
            match aurora_core::db::queries::get_smart_playlist(&conn, playlist_id) {
                Ok(Some(data)) => envelope::ok(data, "updated").into_response(),
                Ok(None) => envelope::not_found("Smart playlist not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Ok(false) => envelope::not_found("Smart playlist not found").into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.starts_with("invalid_query:") {
                let detail = msg.strip_prefix("invalid_query: ").unwrap_or(&msg);
                envelope::unprocessable(&format!("Invalid query: {detail}")).into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// DELETE /api/smart-playlists/{id} — delete a smart playlist.
pub async fn delete_smart_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::delete_smart_playlist(&conn, playlist_id) {
        Ok(true) => envelope::ok(serde_json::json!({"deleted": true}), "deleted").into_response(),
        Ok(false) => envelope::not_found("Smart playlist not found").into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg == "manual_playlist" {
                envelope::not_found("Cannot delete a manual playlist via smart playlist endpoint").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// GET /api/smart-playlists/{id}/songs — resolve a smart playlist's songs dynamically.
pub async fn resolve_smart_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::resolve_smart_playlist(&conn, playlist_id) {
        Ok(Some(songs)) => {
            let total = songs.len() as i64;
            envelope::ok_meta(
                Value::Array(songs),
                "ok",
                serde_json::json!({ "total": total }),
            )
            .into_response()
        }
        Ok(None) => envelope::not_found("Smart playlist not found").into_response(),
        Err(e) => {
            let msg = e.to_string();
            // Filter engine errors map to 400
            envelope::bad_request(&msg).into_response()
        }
    }
}
