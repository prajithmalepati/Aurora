//! Filter router — ported from backend/app/routers/filter.py.

use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

use crate::AppState;
use super::envelope;

#[derive(Deserialize)]
pub struct FilterRequest {
    pub query: String,
}

/// POST /api/filter — run a boolean tag query.
pub async fn filter_endpoint(
    State(state): State<Arc<AppState>>,
    Json(body): Json<FilterRequest>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::filter_songs(&conn, &body.query) {
        Ok(results) => {
            let total = results.len();
            let meta = serde_json::json!({
                "total": total,
                "query": body.query,
            });
            envelope::ok_meta(Value::Array(results), "ok", meta).into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            // Filter engine errors map to 400
            envelope::bad_request(&msg).into_response()
        }
    }
}
