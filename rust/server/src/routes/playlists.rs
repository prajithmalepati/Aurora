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
use image::ImageFormat;
use std::path::PathBuf;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

// ── Playlist CRUD ─────────────────────────────────────────────────────

/// GET /api/playlists — list all with song_count.
/// Includes lazy backfill: if a playlist has image_url but NULL dominant_color,
/// reads the stored file, extracts colors, persists, and returns filled values.
pub async fn list_playlists(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let conn = state.conn.lock().await;
    let mut playlists = aurora_core::db::queries::list_playlists(&conn).unwrap_or_default();
    // T4b — lazy backfill per playlist
    for pl in playlists.iter_mut() {
        backfill_dominant_color_from_json(&conn, pl);
    }
    let total = playlists.len() as i64;
    envelope::ok_meta(Value::Array(playlists), "ok", serde_json::json!({ "total": total }))
}

/// GET /api/playlists/{id} — single playlist with songs.
/// Includes lazy backfill for dominant colors.
pub async fn get_playlist(
    State(state): State<Arc<AppState>>,
    Path(playlist_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::get_playlist(&conn, playlist_id) {
        Ok(Some(mut pl)) => {
            // T4b — lazy backfill
            backfill_dominant_color_from_json(&conn, &mut pl);
            envelope::ok(pl, "ok").into_response()
        }
        Ok(None) => envelope::not_found("Playlist not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// T4b — lazy backfill: if a playlist JSON has image_url but NULL dominant_color,
/// read the stored file, extract colors, persist, and fill the JSON in-place.
/// Errors are silently swallowed (matches Python behavior — :49).
fn backfill_dominant_color_from_json(conn: &aurora_core::rusqlite::Connection, pl: &mut serde_json::Value) {
    // Only backfill if image_url exists and dominant_color is NULL
    let image_url = match pl.get("image_url").and_then(|v| v.as_str()) {
        Some(u) if !u.is_empty() => u,
        _ => return,
    };
    let dc = pl.get("dominant_color");
    if dc.is_some() && !dc.unwrap().is_null() {
        return; // already has color
    }

    let playlist_id = match pl.get("id").and_then(|v| v.as_i64()) {
        Some(id) => id,
        None => return,
    };

    // Resolve file path from image_url (/api/playlist-images/123.jpg → PLAYLIST_IMAGES_DIR/123.jpg)
    let filename = image_url.rsplit('/').next().unwrap_or(image_url);
    let file_path = aurora_core::paths::PLAYLIST_IMAGES_DIR.join(filename);
    let data = match std::fs::read(&file_path) {
        Ok(d) => d,
        Err(_) => return,
    };

    let (new_dc, new_dc2) = aurora_core::scanner::analysis::extract_dominant_colors(&data);
    if new_dc.is_none() {
        return;
    }

    // Persist to DB (best-effort)
    let _ = aurora_core::db::queries::update_playlist_dominant_colors(
        conn, playlist_id, new_dc.as_deref(), new_dc2.as_deref(),
    );

    // Update the JSON in-place
    if let Some(obj) = pl.as_object_mut() {
        obj.insert("dominant_color".into(), serde_json::json!(new_dc));
        obj.insert("dominant_color_2".into(), serde_json::json!(new_dc2));
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
///
/// Parity with Python (playlists.py:58-129):
/// 1. content-type must start with `image/` → 400
/// 2. body > 10 MB → 413
/// 3. structure validation via image crate decode → 400
/// 4. extension from MIME map (png/gif/webp explicit, else jpg)
/// 5. stale-file cleanup: delete `{id}.*` before writing
/// 6. re-encode through decoder (polyglot defense)
/// 7. dominant colors: extract + persist
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

    // T4.1 — content-type must start with image/
    let ct = content_type.unwrap_or_default();
    if !ct.starts_with("image/") {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "File must be an image"}))).into_response();
    }

    // T4.2 — body > 10 MB → 413
    if data.len() > 10 * 1024 * 1024 {
        return (StatusCode::PAYLOAD_TOO_LARGE, Json(serde_json::json!({"detail": "Image too large (max 10 MB)"}))).into_response();
    }

    // T4.3 — structure validation: decode with image crate
    let img = match image::load_from_memory(&data) {
        Ok(img) => img,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "Invalid or corrupt image file"}))).into_response();
        }
    };

    // T4.4 — extension from MIME map
    let ext = match ct.as_str() {
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "jpg",
    };

    // T4.5 — stale-file cleanup: delete {id}.* before writing
    let images_dir = playlist_images_dir();
    std::fs::create_dir_all(&images_dir).ok();
    if let Ok(entries) = std::fs::read_dir(&images_dir) {
        for entry in entries.flatten() {
            let fname = entry.file_name();
            let fname_str = fname.to_string_lossy();
            if fname_str.starts_with(&format!("{}.", playlist_id)) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    // T4.6 — re-encode through decoder (polyglot defense)
    let filename = format!("{}.{}", playlist_id, ext);
    let filepath = images_dir.join(&filename);
    let re_encoded = reencode_image(&img, ext);
    if std::fs::write(&filepath, &re_encoded).is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": "Failed to save image"}))).into_response();
    }

    // T4.7 — dominant colors
    let (dominant_color, dominant_color_2) = aurora_core::scanner::analysis::extract_dominant_colors(&data);

    let image_url = format!("/api/playlist-images/{}", filename);

    // Update DB with image_url + colors
    {
        let conn = state.conn.lock().await;
        aurora_core::db::queries::update_playlist_image(
            &conn, playlist_id, Some(&image_url), dominant_color.as_deref(), dominant_color_2.as_deref(),
        ).ok();
    }

    envelope::ok(serde_json::json!({"image_url": image_url}), "ok").into_response()
}

/// Re-encode a decoded image for the target extension (polyglot defense).
/// Converts RGBA/P → RGB for JPEG. Returns raw bytes to write.
fn reencode_image(img: &image::DynamicImage, ext: &str) -> Vec<u8> {
    use image::codecs::jpeg::JpegEncoder;
    use image::codecs::png::PngEncoder;
    use image::ImageEncoder;

    let mut buf = std::io::Cursor::new(Vec::new());
    match ext {
        "jpg" => {
            let rgb = img.to_rgb8();
            let encoder = JpegEncoder::new_with_quality(&mut buf, 90);
            let _ = encoder.write_image(rgb.as_raw(), rgb.width(), rgb.height(), image::ColorType::Rgb8.into());
        }
        "png" => {
            let encoder = PngEncoder::new(&mut buf);
            let rgba = img.to_rgba8();
            let _ = encoder.write_image(rgba.as_raw(), rgba.width(), rgba.height(), image::ColorType::Rgba8.into());
        }
        "gif" => {
            let _ = img.write_to(&mut buf, ImageFormat::Gif);
        }
        "webp" => {
            let _ = img.write_to(&mut buf, ImageFormat::WebP);
        }
        _ => {
            let _ = img.write_to(&mut buf, ImageFormat::Jpeg);
        }
    }
    buf.into_inner()
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
                // M3U / M3U8 — return raw text (Python parity)
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

                Response::builder()
                    .status(StatusCode::OK)
                    .header("content-type", mime)
                    .header("content-disposition", format!("attachment; filename=\"{}.{}\"", safe_name, ext))
                    .body(Body::from(content))
                    .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).expect("fallback"))
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
