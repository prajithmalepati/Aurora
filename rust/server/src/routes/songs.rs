//! Songs router — ported from backend/app/routers/songs.py.

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Utc};
use md5::{Digest, Md5};
use serde::Deserialize;
use serde_json::Value;
use std::io::SeekFrom;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::AppState;
use super::envelope;

#[derive(Deserialize)]
pub struct ListParams {
    pub search: Option<String>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    /// Source filter: "offline" for local_scan+manual+NULL, "addon:<id>" for specific addon.
    pub source: Option<String>,
}

/// GET /api/songs — list with search/sort/pagination/source-filter.
pub async fn list_songs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListParams>,
) -> Json<Value> {
    let conn = state.conn.lock().await;
    let sort = params.sort.as_deref().unwrap_or("title");
    let order = params.order.as_deref().unwrap_or("asc");
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    let (songs, total) = aurora_core::db::queries::list_songs(
        &conn,
        params.search.as_deref(),
        params.source.as_deref(),
        sort,
        order,
        limit,
        offset,
    )
    .unwrap_or_default();

    envelope::ok_meta(
        Value::Array(songs),
        "ok",
        serde_json::json!({"total": total}),
    )
}

/// GET /api/songs/{song_id} — get single song with waveform_peaks.
pub async fn get_song(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::get_song(&conn, song_id) {
        Ok(Some(song)) => envelope::ok(song, "ok").into_response(),
        Ok(None) => envelope::not_found("Song not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct CreateSong {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration: Option<i64>,
    pub file_path: Option<String>,
}

/// POST /api/songs — create a new song (201).
pub async fn create_song(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateSong>,
) -> Response {
    // Validate non-empty title and artist
    if body.title.is_empty() {
        return envelope::unprocessable("String should have at least 1 character").into_response();
    }
    if body.artist.is_empty() {
        return envelope::unprocessable("String should have at least 1 character").into_response();
    }

    let conn = state.conn.lock().await;
    match aurora_core::db::queries::create_song(
        &conn,
        &body.title,
        &body.artist,
        body.album.as_deref(),
        body.duration,
        body.file_path.as_deref(),
    ) {
        Ok(song_id) => {
            // Fetch the full song to return
            match aurora_core::db::queries::get_song(&conn, song_id) {
                Ok(Some(song)) => {
                    (StatusCode::CREATED, envelope::ok(song, "Song created successfully")).into_response()
                }
                Ok(None) => envelope::not_found("Song not found").into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
            }
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate_file_path") {
                envelope::conflict("file_path already exists").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateSong {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<i64>,
}

/// PUT /api/songs/{song_id} — update a song.
pub async fn update_song(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
    Json(body): Json<UpdateSong>,
) -> Response {
    // Validate non-empty if provided
    #[allow(clippy::collapsible_if)]
    if let Some(ref t) = body.title {
        if t.is_empty() {
            return envelope::unprocessable("String should have at least 1 character").into_response();
        }
    }
    #[allow(clippy::collapsible_if)]
    if let Some(ref a) = body.artist {
        if a.is_empty() {
            return envelope::unprocessable("String should have at least 1 character").into_response();
        }
    }

    let conn = state.conn.lock().await;
    match aurora_core::db::queries::update_song(
        &conn,
        song_id,
        body.title.as_deref(),
        body.artist.as_deref(),
        body.album.as_deref(),
        body.duration,
    ) {
        Ok(true) => match aurora_core::db::queries::get_song(&conn, song_id) {
            Ok(Some(song)) => envelope::ok(song, "ok").into_response(),
            Ok(None) => envelope::not_found("Song not found").into_response(),
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
        },
        Ok(false) => envelope::not_found("Song not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// DELETE /api/songs/{song_id} — delete a song.
pub async fn delete_song(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::delete_song(&conn, song_id) {
        Ok(true) => envelope::ok(Value::Null, "Song deleted successfully").into_response(),
        Ok(false) => envelope::not_found("Song not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// Map file extension to MIME content type.
fn mime_from_extension(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "opus" => "audio/opus",
        "wma" => "audio/x-ms-wma",
        _ => "application/octet-stream",
    }
}

/// Parse a Range header value. Returns (start, end_inclusive) or None if unsatisfiable.
/// Supports: `bytes=start-end`, `bytes=start-`, `bytes=-suffix`.
fn parse_range(range_str: &str, file_size: u64) -> Option<(u64, u64)> {
    let range_str = range_str.trim();
    let range_val = range_str.strip_prefix("bytes=")?;
    let range_val = range_val.trim();

    if file_size == 0 {
        return None;
    }

    if let Some(suffix_str) = range_val.strip_prefix('-') {
        // Suffix range: bytes=-N → last N bytes
        let suffix: u64 = suffix_str.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let start = file_size.saturating_sub(suffix);
        Some((start, file_size - 1))
    } else if let Some((start_str, end_str)) = range_val.split_once('-') {
        let start: u64 = start_str.parse().ok()?;
        if start >= file_size {
            return None;
        }
        let end = if end_str.is_empty() {
            file_size - 1
        } else {
            let end: u64 = end_str.parse().ok()?;
            if end >= file_size {
                file_size - 1
            } else {
                end
            }
        };
        if start > end {
            return None;
        }
        Some((start, end))
    } else {
        None
    }
}

/// Compute ETag and Last-Modified headers from file metadata.
/// ETag mirrors Python/Starlette: `"{md5(str(st_mtime) + '-' + str(st_size))}"`.
/// Last-Modified: RFC 1123 from file mtime.
fn etag_and_lm(metadata: &std::fs::Metadata) -> (String, String) {
    let mtime = metadata.modified().unwrap_or(std::time::UNIX_EPOCH);
    let mtime_epoch = mtime
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64();
    let file_size = metadata.len();

    // ETag: md5(str(st_mtime) + "-" + str(st_size))
    // Python str() on a float always includes at least one decimal digit
    // (e.g. str(1783152000.0) → "1783152000.0", str(1783152000.5) → "1783152000.5").
    // Rust's default f64 Display omits the decimal for whole numbers.
    // Mirror Python's repr rule: if no '.' in the rendered string, append ".0".
    let mut mtime_str = format!("{}", mtime_epoch);
    if !mtime_str.contains('.') {
        mtime_str.push_str(".0");
    }
    let etag_base = format!("{}-{}", mtime_str, file_size);
    let mut hasher = Md5::new();
    hasher.update(etag_base.as_bytes());
    let etag = format!("\"{:x}\"", hasher.finalize());

    // Last-Modified: RFC 1123
    let datetime: DateTime<Utc> = mtime.into();
    let last_modified = datetime.format("%a, %d %b %Y %H:%M:%S GMT").to_string();

    (etag, last_modified)
}

/// GET /api/songs/{song_id}/stream — stream audio file with HTTP-range support.
///
/// - No Range header → 200 full body with Content-Type, Content-Length, Accept-Ranges
/// - Range: bytes=start-end → 206 Partial Content with Content-Range
/// - Multi-range → 416 (documented exception — Starlette multipart is non-RFC)
/// - Unsatisfiable range → 416 Range Not Satisfiable
/// - Missing file/song → 404
pub async fn stream_song(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
    headers: axum::http::HeaderMap,
) -> Response {
    let conn = state.conn.lock().await;
    let file_path = match aurora_core::db::queries::get_song_file_path(&conn, song_id) {
        Ok(Some(Some(path))) => path,
        Ok(Some(None)) => return envelope::not_found("No audio file available").into_response(),
        Ok(None) => return envelope::not_found("Song not found").into_response(),
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"detail": e.to_string()})),
            )
                .into_response()
        }
    };
    drop(conn);

    let path = std::path::Path::new(&file_path);
    let metadata = match tokio::fs::metadata(path).await {
        Ok(m) => m,
        Err(_) => return envelope::not_found("Audio file not found on disk").into_response(),
    };

    let file_size = metadata.len();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let content_type = mime_from_extension(ext);
    let (etag, last_modified) = etag_and_lm(&metadata);

    // Helper: build a base Response::builder with common headers.
    // 200/206 include ETag + Last-Modified; 416 omits them (Starlette parity).
    let base_headers = |status: StatusCode, content_len: u64, include_validators: bool| {
        let mut builder = Response::builder()
            .status(status)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::CONTENT_LENGTH, content_len.to_string())
            .header(header::ACCEPT_RANGES, "bytes");
        if include_validators {
            builder = builder
                .header(header::ETAG, &etag)
                .header(header::LAST_MODIFIED, &last_modified);
        }
        builder
    };

    // Check for Range header
    if let Some(range_value) = headers.get(header::RANGE) {
        let range_str = range_value.to_str().unwrap_or("");

        // Multi-range (contains comma after "bytes=") → 416
        // Documented exception: Starlette multipart is non-RFC-7233;
        // no real audio client sends multi-range.
        // Starlette quirk: 416 Content-Range omits "bytes " prefix.
        #[allow(clippy::collapsible_if)]
        if let Some(spec) = range_str.strip_prefix("bytes=") {
            if spec.contains(',') {
                return base_headers(StatusCode::RANGE_NOT_SATISFIABLE, 0, false)
                    .header(header::CONTENT_RANGE, format!("*/{}", file_size))
                    .body(Body::empty())
                    .unwrap();
            }
        }

        if let Some((start, end)) = parse_range(range_str, file_size) {
            let len = end - start + 1;
            let content_range = format!("bytes {}-{}/{}", start, end, file_size);

            // Open file, seek, take, stream
            let mut file = match tokio::fs::File::open(path).await {
                Ok(f) => f,
                Err(_) => return envelope::not_found("Audio file not found on disk").into_response(),
            };
            if file.seek(SeekFrom::Start(start)).await.is_err() {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"detail": "seek failed"})),
                )
                    .into_response();
            }
            let limited = file.take(len);
            let stream = ReaderStream::new(limited);

            return base_headers(StatusCode::PARTIAL_CONTENT, len, true)
                .header(header::CONTENT_RANGE, content_range)
                .body(Body::from_stream(stream))
                .unwrap();
        } else {
            // Unsatisfiable range — Starlette quirk: no "bytes " prefix, no validators
            return base_headers(StatusCode::RANGE_NOT_SATISFIABLE, 0, false)
                .header(header::CONTENT_RANGE, format!("*/{}", file_size))
                .body(Body::empty())
                .unwrap();
        }
    }

    // Full response (no Range header)
    let file = match tokio::fs::File::open(path).await {
        Ok(f) => f,
        Err(_) => return envelope::not_found("Audio file not found on disk").into_response(),
    };
    let stream = ReaderStream::new(file);
    base_headers(StatusCode::OK, file_size, true)
        .body(Body::from_stream(stream))
        .unwrap()
}

/// POST /api/songs/{song_id}/played — increment play_count, set last_played_at.
/// Returns play_count and last_played_at in the response (endpoint-specific fields).
pub async fn mark_played(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::increment_play_count(&conn, song_id) {
        Ok(Some((mut song, pc, lpa))) => {
            // Inject play fields into the response (endpoint-specific, not in global serializer)
            if let Some(obj) = song.as_object_mut() {
                obj.insert("play_count".into(), serde_json::json!(pc));
                obj.insert("last_played_at".into(), serde_json::json!(lpa));
            }
            envelope::ok(song, "ok").into_response()
        }
        Ok(None) => envelope::not_found("Song not found").into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"detail": e.to_string()})),
        )
            .into_response(),
    }
}

/// GET /api/songs/{song_id}/bleed-thumb — bleed thumbnail.
pub async fn bleed_thumb(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    let result: Result<Option<Vec<u8>>, _> = conn.query_row(
        "SELECT bleed_thumb FROM songs WHERE id = ?1",
        [song_id],
        |row| row.get(0),
    );
    match result {
        Ok(Some(blob)) if !blob.is_empty() => {
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", "image/png")
                .header("cache-control", "public, max-age=31536000, immutable")
                .body(Body::from(blob))
                .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).expect("fallback"))
        }
        _ => envelope::not_found("No bleed thumb available").into_response(),
    }
}

/// GET /api/album-art/{filename} — serve album art from disk.
/// Traversal guard: strips to file name (matches Python's Path(filename).name).
pub async fn album_art(
    Path(filename): Path<String>,
) -> Response {
    // Traversal guard — only use the bare filename
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if safe_name.is_empty() {
        return envelope::not_found("Album art not found").into_response();
    }

    // F3: Resolve art directory via central paths module (matches Python paths.py)
    let art_dir = aurora_core::paths::ALBUM_ART_DIR.clone();

    let art_path = art_dir.join(safe_name);
    match tokio::fs::read(&art_path).await {
        Ok(bytes) => {
            // Detect content-type from extension
            let content_type = match art_path.extension().and_then(|e| e.to_str()) {
                Some("png") => "image/png",
                Some("jpg") | Some("jpeg") => "image/jpeg",
                Some("webp") => "image/webp",
                _ => "application/octet-stream",
            };
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", content_type)
                .header("cache-control", "public, max-age=31536000, immutable")
                .body(Body::from(bytes))
                .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).expect("fallback"))
        }
        Err(_) => envelope::not_found("Album art not found").into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// F4: Verify etag_and_lm produces correct ETag format on a real file.
    #[test]
    fn etag_and_lm_format_real_file() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), b"test content").unwrap();
        let metadata = std::fs::metadata(tmp.path()).unwrap();
        let (etag, lm) = etag_and_lm(&metadata);

        // ETag must be quoted hex
        assert!(etag.starts_with('"') && etag.ends_with('"'), "ETag must be quoted: {}", etag);
        let hex = &etag[1..etag.len()-1];
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()), "ETag must be hex: {}", etag);
        assert_eq!(hex.len(), 32, "MD5 hex must be 32 chars: {}", etag);

        // Last-Modified must be RFC 1123 ending in GMT
        assert!(lm.ends_with(" GMT"), "Last-Modified must end with GMT: {}", lm);
    }

    /// F4: Verify whole-second mtime renders as "X.0" (Python str() parity).
    /// We test the formatting logic directly since setting arbitrary mtimes
    /// requires platform-specific code not worth adding a dependency for.
    #[test]
    fn etag_mtime_format_whole_second() {
        let mtime_epoch: f64 = 1783152000.0;
        let mut mtime_str = format!("{}", mtime_epoch);
        if !mtime_str.contains('.') {
            mtime_str.push_str(".0");
        }
        assert_eq!(mtime_str, "1783152000.0");
    }

    #[test]
    fn etag_mtime_format_fractional() {
        let mtime_epoch: f64 = 1751513151.1234567;
        let mut mtime_str = format!("{}", mtime_epoch);
        if !mtime_str.contains('.') {
            mtime_str.push_str(".0");
        }
        assert!(mtime_str.contains('.'), "fractional mtime must contain '.': {}", mtime_str);
    }
}
