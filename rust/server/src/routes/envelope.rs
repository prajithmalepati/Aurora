//! Response envelope helpers.
//!
//! Success: `{ "data": <...>, "message": "ok", "meta": {...} }`
//! Error:   `{ "detail": <...> }`

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::Value;

/// Success envelope with data + message. No meta.
pub fn ok(data: Value, message: &str) -> Json<Value> {
    Json(serde_json::json!({
        "data": data,
        "message": message,
    }))
}

/// Success envelope with data + message + meta.
pub fn ok_meta(data: Value, message: &str, meta: Value) -> Json<Value> {
    Json(serde_json::json!({
        "data": data,
        "message": message,
        "meta": meta,
    }))
}

/// 404 JSON response.
pub fn not_found(detail: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::NOT_FOUND, Json(serde_json::json!({"detail": detail})))
}

/// 409 JSON response.
pub fn conflict(detail: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::CONFLICT, Json(serde_json::json!({"detail": detail})))
}

/// 422 JSON response — Rust's own validation format (not Pydantic's).
/// Documented as a Gate-2 exception: status matches, body format differs.
pub fn unprocessable(detail: &str) -> (StatusCode, Json<Value>) {
    (
        StatusCode::UNPROCESSABLE_ENTITY,
        Json(serde_json::json!({"detail": detail})),
    )
}

/// 400 JSON response.
pub fn bad_request(detail: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": detail})))
}

/// Generic error response — maps anyhow errors to 500.
#[allow(dead_code)]
pub struct AppError(pub anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = serde_json::json!({"detail": self.0.to_string()});
        (StatusCode::INTERNAL_SERVER_ERROR, Json(body)).into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}
