//! Tags router — ported from backend/app/routers/tags.py.

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
pub struct CreateTag {
    pub name: String,
}

/// POST /api/tags — create a new tag (201).
pub async fn create_tag(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateTag>,
) -> Response {
    if body.name.trim().is_empty() {
        return envelope::unprocessable("String should have at least 1 character").into_response();
    }

    let conn = state.conn.lock().await;
    match aurora_core::db::queries::create_tag(&conn, &body.name) {
        Ok(tag_id) => {
            let data = serde_json::json!({
                "id": tag_id,
                "name": body.name.to_lowercase().trim(),
                "song_count": 0,
            });
            (StatusCode::CREATED, envelope::ok(data, "Tag created successfully")).into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate_tag") {
                envelope::conflict("tag with this name already exists").into_response()
            } else if msg.contains("empty_name") {
                envelope::unprocessable("String should have at least 1 character").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// GET /api/tags — list all tags with song_count.
pub async fn list_tags(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let conn = state.conn.lock().await;
    let (data, total) = aurora_core::db::queries::list_tags(&conn).unwrap_or_default();
    envelope::ok_meta(
        Value::Array(data),
        "ok",
        serde_json::json!({"total": total}),
    )
}

/// DELETE /api/tags/{tag_id} — delete a tag.
pub async fn delete_tag(
    State(state): State<Arc<AppState>>,
    Path(tag_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::delete_tag(&conn, tag_id) {
        Ok(true) => envelope::ok(Value::Null, "Tag deleted successfully").into_response(),
        Ok(false) => envelope::not_found("tag not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct AssignTags {
    pub tag_names: Vec<String>,
}

/// POST /api/songs/{song_id}/tags — assign tags to a song.
pub async fn assign_tags(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
    Json(body): Json<AssignTags>,
) -> Response {
    if body.tag_names.is_empty() {
        return envelope::unprocessable("List should have at least 1 item after validation, not 0").into_response();
    }

    let conn = state.conn.lock().await;
    match aurora_core::db::queries::assign_tags(&conn, song_id, &body.tag_names) {
        Ok(true) => {
            // Fetch updated song
            match aurora_core::db::queries::get_song(&conn, song_id) {
                Ok(Some(song)) => envelope::ok(song, "ok").into_response(),
                Ok(None) => envelope::not_found("Song not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Ok(false) => envelope::not_found("Song not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// DELETE /api/songs/{song_id}/tags/{tag_id} — remove a tag from a song.
pub async fn remove_tag(
    State(state): State<Arc<AppState>>,
    Path((song_id, tag_id)): Path<(i64, i64)>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::remove_tag(&conn, song_id, tag_id) {
        Ok(()) => {
            // Fetch updated song
            match aurora_core::db::queries::get_song(&conn, song_id) {
                Ok(Some(song)) => envelope::ok(song, "ok").into_response(),
                Ok(None) => envelope::not_found("Song not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("song_not_found") {
                envelope::not_found("Song not found").into_response()
            } else if msg.contains("tag_not_found") {
                envelope::not_found("Tag not found").into_response()
            } else if msg.contains("link_not_found") {
                envelope::not_found("Song-tag link not found").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}
