use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
}

/// GET /api/health — minimal liveness probe.
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

#[derive(Deserialize)]
pub struct SongsQuery {
    pub limit: Option<i64>,
}

/// GET /api/songs?limit=N — read-only proof that core::db works end-to-end.
/// Reads a real Aurora DB and returns song rows. Full router parity is later.
pub async fn songs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SongsQuery>,
) -> Json<serde_json::Value> {
    // Open a read-only connection for each request
    let conn = match aurora_core::db::open_readonly(&state.db_path) {
        Ok(c) => c,
        Err(e) => {
            return Json(serde_json::json!({
                "error": format!("DB open failed: {e}")
            }));
        }
    };

    match aurora_core::models::Song::fetch_all(&conn, params.limit) {
        Ok(songs) => Json(serde_json::json!({ "songs": songs })),
        Err(e) => Json(serde_json::json!({
            "error": format!("query failed: {e}")
        })),
    }
}
