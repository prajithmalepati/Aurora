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
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::AppState;
use super::envelope;

#[derive(Deserialize)]
pub struct ScanRequest {
    pub folder_path: String,
    pub playlist_name: Option<String>,
}

/// Build the scan result JSON + human message (shared by all scan paths).
fn build_scan_envelope(result: aurora_core::scanner::db::ScanResult) -> (serde_json::Value, String) {
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

    let data = serde_json::json!({
        "scanned": result.scanned,
        "imported": result.imported,
        "replaced": result.replaced,
        "skipped": result.skipped,
        "skipped_exact": result.skipped_exact,
        "skipped_same_format": result.skipped_same_format,
        "skipped_lower_quality": result.skipped_lower_quality,
        "errors": result.errors.iter().map(|e| serde_json::json!({"file": e.file, "error": e.error})).collect::<Vec<_>>(),
        "songs": result.songs,
        "replaced_songs": result.replaced_songs,
        "art_extracted": result.art_extracted,
    });
    (data, message)
}

/// POST /api/scan — scan a folder for music files and import them.
///
/// F1: Uses spawn_blocking so audio decode doesn't pin a tokio worker.
/// Opens a dedicated DB connection inside the blocking task.
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
    if !path.exists() || !path.is_dir() {
        return envelope::not_found("folder_path does not exist or is not a directory").into_response();
    }

    // F1: Open a dedicated scan connection so the main AppState.conn is not
    // held during audio decode. For in-memory test harness (db_path = None),
    // fall back to the shared connection.
    let db_path = match state.db_path.clone() {
        Some(p) => p,
        None => {
            // Test harness: use shared in-memory connection
            return scan_with_shared_conn(&state, &req).await;
        }
    };

    let folder_path = req.folder_path.clone();
    let playlist_name = req.playlist_name.clone();

    // F1 req 2: AppState.conn mutex is NOT held — /api/health stays responsive
    let result = tokio::task::spawn_blocking(move || {
        let conn = aurora_core::db::open_and_migrate(&db_path)?;
        aurora_core::scanner::db::import_scanned_songs(
            &conn,
            &folder_path,
            playlist_name.as_deref(),
            None,
            None,
        )
    })
    .await;

    match result {
        Ok(Ok(scan_result)) => {
            let (data, message) = build_scan_envelope(scan_result);
            envelope::ok(data, &message).into_response()
        }
        Ok(Err(e)) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response()
        }
    }
}

/// Fallback for in-memory test harness: scan using the shared AppState connection.
async fn scan_with_shared_conn(state: &AppState, req: &ScanRequest) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::scanner::db::import_scanned_songs(
        &conn,
        &req.folder_path,
        req.playlist_name.as_deref(),
        None,
        None,
    ) {
        Ok(result) => {
            let (data, message) = build_scan_envelope(result);
            envelope::ok(data, &message).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response()
        }
    }
}

/// POST /api/scan/stream — SSE streaming scan progress.
pub async fn scan_folder_stream(
    State(state): State<Arc<AppState>>,
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
    let db_path = state.db_path.clone();

    // Use tokio::sync::mpsc for SSE event channel
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(256);

    // Spawn blocking task for the scan
    tokio::task::spawn_blocking(move || {
        // F1: Open a dedicated connection to the real DB file.
        // Falls back to in-memory for test harness (no file path).
        let conn = match db_path {
            Some(ref path) => match aurora_core::db::open_and_migrate(path) {
                Ok(c) => c,
                Err(e) => {
                    let _ = tx.blocking_send(format!("data: {}\n\n", serde_json::json!({"type": "error", "message": e.to_string()})));
                    return;
                }
            },
            None => match aurora_core::db::open_memory() {
                Ok(c) => c,
                Err(e) => {
                    let _ = tx.blocking_send(format!("data: {}\n\n", serde_json::json!({"type": "error", "message": e.to_string()})));
                    return;
                }
            },
        };

        let cancel_for_cb = cancel_clone.clone();
        let tx_cb = tx.clone();
        let progress_cb = |evt: aurora_core::scanner::db::ScanProgress| {
            let json = serde_json::to_string(&evt).unwrap_or_default();
            let result = tx_cb.blocking_send(format!("data: {}\n\n", json));
            // F8: If the receiver is gone (client disconnected), set cancel flag
            if result.is_err() {
                cancel_for_cb.store(true, Ordering::Relaxed);
            }
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
