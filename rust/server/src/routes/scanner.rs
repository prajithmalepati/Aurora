//! Scanner router — ported from backend/app/routers/scanner.py.
//!
//! POST /scan — scan folder, import songs.
//! POST /scan/stream — SSE streaming scan progress.

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

#[derive(Deserialize)]
pub struct ScanRequest {
    pub folder_path: String,
    pub playlist_name: Option<String>,
}

/// POST /api/scan — scan a folder for music files and import them.
pub async fn scan_folder_endpoint(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ScanRequest>,
) -> Response {
    // Validate folder_path is not empty
    if req.folder_path.is_empty() {
        return envelope::unprocessable("folder_path is empty").into_response();
    }

    // Check if folder exists
    let path = std::path::Path::new(&req.folder_path);
    if !path.exists() {
        return envelope::not_found("folder_path does not exist or is not a directory").into_response();
    }
    if !path.is_dir() {
        return envelope::not_found("folder_path does not exist or is not a directory").into_response();
    }

    let conn = state.conn.lock().await;
    match aurora_core::scanner::db::import_scanned_songs(
        &conn,
        &req.folder_path,
        req.playlist_name.as_deref(),
        None,
        None,
    ) {
        Ok(result) => {
            // Build message (matches Python scanner.py:41-51)
            let mut parts = Vec::new();
            if result.imported > 0 {
                parts.push(format!("Imported {} new songs", result.imported));
            }
            if result.replaced > 0 {
                parts.push(format!("replaced {} lower-quality songs with higher-quality versions", result.replaced));
            }
            if result.skipped > 0 {
                parts.push(format!("skipped {} already in library", result.skipped));
            }
            if result.art_extracted > 0 {
                parts.push(format!("extracted art for {} songs", result.art_extracted));
            }
            let message = if parts.is_empty() {
                "Scan complete: nothing new found.".to_string()
            } else {
                format!("Scan complete: {}.", parts.join(". "))
            };

            // Strip bleed_thumb from songs for JSON serialization
            let songs_json: Vec<Value> = result.songs.iter().map(strip_bleed_thumb).collect();
            let replaced_json: Vec<Value> = result.replaced_songs.iter().map(strip_bleed_thumb).collect();

            envelope::ok(
                serde_json::json!({
                    "scanned": result.scanned,
                    "imported": result.imported,
                    "replaced": result.replaced,
                    "skipped": result.skipped,
                    "skipped_exact": result.skipped_exact,
                    "skipped_same_format": result.skipped_same_format,
                    "skipped_lower_quality": result.skipped_lower_quality,
                    "errors": result.errors.iter().map(|e| serde_json::json!({"file": e.file, "error": e.error})).collect::<Vec<_>>(),
                    "songs": songs_json,
                    "replaced_songs": replaced_json,
                    "art_extracted": result.art_extracted,
                }),
                &message,
            ).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response()
        }
    }
}

/// POST /api/scan/stream — SSE streaming scan progress.
pub async fn scan_folder_stream(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ScanRequest>,
) -> Response {
    // Validate
    if req.folder_path.is_empty() {
        return envelope::unprocessable("folder_path is empty").into_response();
    }
    let path = std::path::Path::new(&req.folder_path);
    if !path.exists() || !path.is_dir() {
        return envelope::not_found("folder_path does not exist or is not a directory").into_response();
    }

    let cancel = Arc::new(AtomicBool::new(false));
    let cancel_clone = cancel.clone();
    let folder_path = req.folder_path.clone();
    let playlist_name = req.playlist_name.clone();

    // Use tokio::sync::mpsc for SSE event channel
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(256);

    // Spawn blocking task for the scan
    tokio::task::spawn_blocking(move || {
        let conn = match aurora_core::db::open_memory() {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.blocking_send(format!("data: {}\n\n", serde_json::json!({"type": "error", "message": e.to_string()})));
                return;
            }
        };

        let tx_cb = tx.clone();
        let progress_cb = |evt: aurora_core::scanner::db::ScanProgress| {
            let json = serde_json::to_string(&evt).unwrap_or_default();
            let _ = tx_cb.blocking_send(format!("data: {}\n\n", json));
        };

        let result = aurora_core::scanner::db::import_scanned_songs(
            &conn,
            &folder_path,
            playlist_name.as_deref(),
            Some(&cancel_clone),
            Some(&progress_cb),
        );

        match result {
            Ok(_) => {} // Done event already sent
            Err(e) => {
                let _ = tx.blocking_send(format!("data: {}\n\n", serde_json::json!({"type": "error", "message": e.to_string()})));
            }
        }
    });

    // Build SSE response stream
    let stream = async_stream::stream! {
        loop {
            match tokio::time::timeout(
                std::time::Duration::from_secs(30),
                rx.recv(),
            ).await {
                Ok(Some(event)) => {
                    yield Ok::<_, std::convert::Infallible>(event);
                }
                Ok(None) => break, // Channel closed
                Err(_) => {
                    // Timeout — send keep-alive comment
                    yield Ok(": keepalive\n\n".to_string());
                }
            }
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header("cache-control", "no-cache")
        .header("x-accel-buffering", "no")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(Body::empty()).expect("fallback"))
}

/// Strip bleed_thumb from a song JSON value (raw bytes, not serializable).
fn strip_bleed_thumb(v: &Value) -> Value {
    let mut obj = v.clone();
    if let Some(map) = obj.as_object_mut() {
        map.remove("bleed_thumb");
    }
    obj
}
