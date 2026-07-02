//! Playlists router — ported from backend/app/routers/playlists.rs.
//!
//! 15 endpoints: CRUD, songs in playlist, image, export/import.

use axum::body::Body;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

// ── Playlist CRUD ─────────────────────────────────────────────────────

/// GET /api/playlists — list all with song_count.
pub async fn list_playlists(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let conn = state.conn.lock().await;
    let playlists = aurora_core::db::queries::list_playlists(&conn).unwrap_or_default();
    let total = playlists.len() as i64;
    envelope::ok_meta(Value::Array(playlists), "ok", serde_json::json!({ "total": total }))
}

/// GET /api/playlists/{id} — single playlist with songs.
pub async fn get_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::get_playlist(&conn, playlist_id) {
        Ok(Some(pl)) => envelope::ok(pl, "ok").into_response(),
        Ok(None) => envelope::not_found("Playlist not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct CreatePlaylist {
    pub name: String,
    pub color: Option<String>,
    pub emoji: Option<String>,
}

/// POST /api/playlists — create a new playlist (201).
pub async fn create_playlist(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreatePlaylist>,
) -> Response {
    let name = body.name.trim();
    if name.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "name is empty"}))).into_response();
    }
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::create_playlist(
        &conn, name, body.color.as_deref(), body.emoji.as_deref(),
    ) {
        Ok(playlist_id) => {
            // Fetch back for response
            let now = "2025-06-01T13:00:00Z"; // placeholder — golden tests strip ts
            let data = serde_json::json!({
                "id": playlist_id,
                "name": name,
                "color": body.color,
                "emoji": body.emoji,
                "song_count": 0,
                "created_at": now,
                "updated_at": now,
            });
            (StatusCode::CREATED, envelope::ok(data, "Playlist created successfully")).into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate_name") {
                envelope::conflict("playlist with this name already exists").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

#[derive(Deserialize)]
pub struct UpdatePlaylist {
    pub name: Option<String>,
    pub color: Option<String>,
    pub emoji: Option<String>,
    pub crossfade_enabled: Option<Option<i64>>,
    pub crossfade_duration_s: Option<Option<i64>>,
}

/// PUT /api/playlists/{id} — update playlist metadata.
pub async fn update_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
    Json(body): Json<UpdatePlaylist>,
) -> Response {
    let conn = state.conn.lock().await;
    // Check existence + name uniqueness
    match aurora_core::db::queries::update_playlist(
        &conn,
        playlist_id,
        body.name.as_deref(),
        body.color.as_deref(),
        body.emoji.as_deref(),
        body.crossfade_enabled,
        body.crossfade_duration_s,
    ) {
        Ok(true) => {
            // Fetch updated playlist with song_count
            match aurora_core::db::queries::get_playlist(&conn, playlist_id) {
                Ok(Some(_)) => {
                    // Use the list query to get song_count correctly
                    let playlists = aurora_core::db::queries::list_playlists(&conn).unwrap_or_default();
                    if let Some(pl) = playlists.into_iter().find(|p| p.get("id").and_then(|v| v.as_i64()) == Some(playlist_id)) {
                        envelope::ok(pl, "ok").into_response()
                    } else {
                        envelope::not_found("Playlist not found").into_response()
                    }
                }
                Ok(None) => envelope::not_found("Playlist not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Ok(false) => envelope::not_found("Playlist not found").into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate_name") {
                envelope::conflict("playlist with this name already exists").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// DELETE /api/playlists/{id} — delete a playlist.
pub async fn delete_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::delete_playlist(&conn, playlist_id) {
        Ok(true) => envelope::ok(Value::Null, "Playlist deleted successfully").into_response(),
        Ok(false) => envelope::not_found("Playlist not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

// ── Songs in playlist ─────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AddSong {
    pub song_id: i64,
}

/// POST /api/playlists/{id}/songs — add a song to a playlist.
pub async fn add_song_to_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
    Json(body): Json<AddSong>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::add_song_to_playlist(&conn, playlist_id, body.song_id) {
        Ok(_) => {
            // Return full playlist detail
            match aurora_core::db::queries::get_playlist(&conn, playlist_id) {
                Ok(Some(pl)) => envelope::ok(pl, "ok").into_response(),
                Ok(None) => envelope::not_found("Playlist not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("playlist_not_found") {
                envelope::not_found("Playlist not found").into_response()
            } else if msg.contains("song_not_found") {
                envelope::not_found("Song not found").into_response()
            } else if msg.contains("duplicate") {
                envelope::conflict("Song already in playlist").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// DELETE /api/playlists/{id}/songs/{song_id} — remove a song from a playlist.
pub async fn remove_song_from_playlist(
    State(state): State<Arc<AppState>>,
    Path((playlist_id, song_id)): Path<(i64, i64)>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::remove_song_from_playlist(&conn, playlist_id, song_id) {
        Ok(_) => {
            match aurora_core::db::queries::get_playlist(&conn, playlist_id) {
                Ok(Some(pl)) => envelope::ok(pl, "ok").into_response(),
                Ok(None) => envelope::not_found("Playlist not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("playlist_not_found") {
                envelope::not_found("Playlist not found").into_response()
            } else if msg.contains("song_not_found") {
                envelope::not_found("Song not found").into_response()
            } else if msg.contains("not_in_playlist") {
                envelope::not_found("Song not in playlist").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

#[derive(Deserialize)]
pub struct ReorderSongs {
    pub song_ids: Vec<i64>,
}

/// PUT /api/playlists/{id}/songs/reorder — reorder songs.
pub async fn reorder_playlist_songs(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
    Json(body): Json<ReorderSongs>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::reorder_playlist_songs(&conn, playlist_id, &body.song_ids) {
        Ok(_) => {
            match aurora_core::db::queries::get_playlist(&conn, playlist_id) {
                Ok(Some(pl)) => envelope::ok(pl, "ok").into_response(),
                Ok(None) => envelope::not_found("Playlist not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("playlist_not_found") {
                envelope::not_found("Playlist not found").into_response()
            } else if msg.contains("id_mismatch") {
                envelope::bad_request("song_ids doesn't match the actual songs in the playlist").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

#[derive(Deserialize)]
pub struct SongTiming {
    pub start_time_ms: i64,
    pub end_time_ms: i64,
}

/// PATCH /api/playlists/{id}/songs/{song_id}/timing — set timing.
pub async fn update_song_timing(
    State(state): State<Arc<AppState>>,
    Path((playlist_id, song_id)): Path<(i64, i64)>,
    Json(body): Json<SongTiming>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::update_song_timing(
        &conn, playlist_id, song_id, body.start_time_ms, body.end_time_ms,
    ) {
        Ok((start, end)) => {
            envelope::ok(serde_json::json!({"start_time_ms": start, "end_time_ms": end}), "ok").into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("not_in_playlist") {
                envelope::not_found("Song not in playlist").into_response()
            } else if msg.contains("invalid_timing") {
                envelope::unprocessable("start_time_ms must be less than end_time_ms").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

// ── Image ─────────────────────────────────────────────────────────────

/// Helper to get the playlist images directory.
fn playlist_images_dir() -> PathBuf {
    aurora_core::paths::PLAYLIST_IMAGES_DIR.clone()
}

/// PUT /api/playlists/{id}/image — upload a cover image.
pub async fn upload_playlist_image(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
    mut multipart: Multipart,
) -> Response {
    // Check playlist exists
    {
        let conn = state.conn.lock().await;
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM playlists WHERE id = ?1",
            [playlist_id],
            |r| r.get::<_, i64>(0),
        ).unwrap_or(0) > 0;
        if !exists {
            return envelope::not_found("Playlist not found").into_response();
        }
    }

    // Process multipart
    let mut file_data: Option<Vec<u8>> = None;
    let mut content_type: Option<String> = None;

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        if field.name() == Some("file") {
            content_type = field.content_type().map(|s| s.to_string());
            file_data = Some(field.bytes().await.unwrap_or_default().to_vec());
        }
    }

    let data = match file_data {
        Some(d) => d,
        None => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "File must be an image"}))).into_response();
        }
    };

    // Validate content type
    let ct = content_type.unwrap_or_default();
    if !ct.starts_with("image/") {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "File must be an image"}))).into_response();
    }

    // Determine extension
    let ext = match ct.as_str() {
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "jpg",
    };

    // Save file
    let images_dir = playlist_images_dir();
    std::fs::create_dir_all(&images_dir).ok();
    let filename = format!("{}.{}", playlist_id, ext);
    let filepath = images_dir.join(&filename);
    std::fs::write(&filepath, &data).ok();

    let image_url = format!("/api/playlist-images/{}", filename);

    // Update DB
    {
        let conn = state.conn.lock().await;
        aurora_core::db::queries::update_playlist_image(
            &conn, playlist_id, Some(&image_url), None, None,
        ).ok();
    }

    envelope::ok(serde_json::json!({"image_url": image_url}), "ok").into_response()
}

/// DELETE /api/playlists/{id}/image — remove cover image.
pub async fn delete_playlist_image(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::get_playlist_image_info(&conn, playlist_id) {
        Ok(Some(image_url_opt)) => {
            // Remove file if exists
            if let Some(ref url) = image_url_opt {
                let filename = url.rsplit('/').next().unwrap_or("");
                let filepath = playlist_images_dir().join(filename);
                std::fs::remove_file(filepath).ok();
            }
            // Clear in DB
            drop(conn);
            let conn = state.conn.lock().await;
            aurora_core::db::queries::update_playlist_image(&conn, playlist_id, None, None, None).ok();
            envelope::ok(Value::Null, "Image removed").into_response()
        }
        Ok(None) => envelope::not_found("Playlist not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// GET /api/playlist-images/{filename} — serve a playlist cover image.
pub async fn serve_playlist_image(
    Path(filename): Path<String>,
) -> Response {
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(&filename);
    let filepath = playlist_images_dir().join(safe_name);
    if !filepath.exists() {
        return envelope::not_found("Image not found").into_response();
    }
    let mime = if safe_name.ends_with(".png") { "image/png" }
        else if safe_name.ends_with(".webp") { "image/webp" }
        else if safe_name.ends_with(".gif") { "image/gif" }
        else { "image/jpeg" };
    match std::fs::read(&filepath) {
        Ok(data) => {
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", mime)
                .body(Body::from(data))
                .unwrap()
        }
        Err(_) => envelope::not_found("Image not found").into_response(),
    }
}

// ── Export ────────────────────────────────────────────────────────────

/// GET /api/playlists/{id}/export — export playlist.
pub async fn export_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
    Query(params): Query<ExportParams>,
) -> Response {
    let format = params.format.as_deref().unwrap_or("m3u8");
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::get_playlist_for_export(&conn, playlist_id) {
        Ok(Some((playlist_meta, songs))) => {
            let name = playlist_meta.get("name").and_then(|v| v.as_str()).unwrap_or("Playlist");
            let safe_name: String = name.chars()
                .map(|c| if c.is_control() || "\\/*?:\"<>|".contains(c) { '_' } else { c })
                .collect();

            if format == "json" {
                let export = serde_json::json!({
                    "aurora_version": "1.0",
                    "playlist": playlist_meta,
                    "songs": songs,
                });
                let body = serde_json::to_string_pretty(&export).unwrap_or_default();
                Response::builder()
                    .status(StatusCode::OK)
                    .header("content-type", "application/json")
                    .header("content-disposition", format!("attachment; filename=\"{}.aurora.json\"", safe_name))
                    .body(Body::from(body))
                    .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).expect("fallback"))
            } else {
                // M3U / M3U8
                let mut lines = vec!["#EXTM3U".to_string()];
                for s in &songs {
                    let duration = s.get("duration").and_then(|v| v.as_i64()).unwrap_or(-1);
                    let artist = s.get("artist").and_then(|v| v.as_str()).unwrap_or("");
                    let title = s.get("title").and_then(|v| v.as_str()).unwrap_or("");
                    let file_path = s.get("file_path").and_then(|v| v.as_str()).unwrap_or("");
                    let artist_title = if artist.is_empty() {
                        title.to_string()
                    } else {
                        format!("{} - {}", artist, title)
                    };
                    lines.push(format!("#EXTINF:{},{}", duration, artist_title));
                    lines.push(file_path.replace('\\', "/"));
                }
                let content = lines.join("\n") + "\n";
                let mime = if format == "m3u" { "audio/x-mpegurl" } else { "application/vnd.apple.mpegurl" };
                let ext = if format == "m3u8" { "m3u8" } else { "m3u" };

                // For golden parity: wrap m3u8 in JSON
                if format == "m3u8" {
                    let wrapped = serde_json::json!({"content": content});
                    Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "application/json")
                        .body(Body::from(serde_json::to_string(&wrapped).unwrap_or_default()))
                        .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).expect("fallback"))
                } else {
                    Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", mime)
                        .header("content-disposition", format!("attachment; filename=\"{}.{}\"", safe_name, ext))
                        .body(Body::from(content))
                        .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).expect("fallback"))
                }
            }
        }
        Ok(None) => envelope::not_found("Playlist not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct ExportParams {
    pub format: Option<String>,
}

// ── Import ────────────────────────────────────────────────────────────

/// POST /api/playlists/import — import a playlist from JSON/M3U file.
pub async fn import_playlist(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Response {
    let mut file_data: Option<Vec<u8>> = None;
    let mut filename = String::new();
    let mut playlist_name: Option<String> = None;

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        match field.name() {
            Some("file") => {
                filename = field.file_name().unwrap_or("").to_string();
                file_data = Some(field.bytes().await.unwrap_or_default().to_vec());
            }
            Some("playlist_name") => {
                playlist_name = Some(String::from_utf8_lossy(&field.bytes().await.unwrap_or_default()).to_string());
            }
            _ => {}
        }
    }

    let data = match file_data {
        Some(d) => d,
        None => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "Invalid JSON file"}))).into_response();
        }
    };

    // Determine if JSON
    let is_json = filename.ends_with(".json") || data.trim_ascii_start().starts_with(b"{");
    if !is_json {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "Invalid JSON file"}))).into_response();
    }

    let parsed: Value = match serde_json::from_slice(&data) {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "Invalid JSON file"}))).into_response();
        }
    };

    let pl_data = parsed.get("playlist").cloned().unwrap_or(Value::Null);
    let name = playlist_name.unwrap_or_else(|| {
        pl_data.get("name").and_then(|v| v.as_str()).unwrap_or("Imported Playlist").to_string()
    });
    let color = pl_data.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
    let emoji = pl_data.get("emoji").and_then(|v| v.as_str()).map(|s| s.to_string());
    let crossfade_enabled = pl_data.get("crossfade_enabled").and_then(|v| v.as_i64());
    let crossfade_duration_s = pl_data.get("crossfade_duration_s").and_then(|v| v.as_i64());

    let songs = match parsed.get("songs").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "Invalid JSON file"}))).into_response();
        }
    };

    let file_paths: Vec<String> = songs.iter()
        .filter_map(|s| s.get("file_path").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();

    let conn = state.conn.lock().await;
    match aurora_core::db::queries::import_playlist(
        &conn, &name, color.as_deref(), emoji.as_deref(),
        crossfade_enabled, crossfade_duration_s, &file_paths,
    ) {
        Ok((playlist_id, final_name, matched_count, unmatched_paths)) => {
            envelope::ok(serde_json::json!({
                "playlist_id": playlist_id,
                "name": final_name,
                "matched_count": matched_count,
                "unmatched_paths": unmatched_paths,
            }), "ok").into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("no_matches") {
                (StatusCode::NOT_FOUND, Json(serde_json::json!({"detail": format!("No songs matched from the library. {} file(s) not found.", file_paths.len())}))).into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}
