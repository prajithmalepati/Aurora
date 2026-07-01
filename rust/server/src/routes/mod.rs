mod envelope;
mod filter;
mod songs;
mod tags;

pub use filter::filter_endpoint;
pub use songs::{album_art, bleed_thumb, create_song, delete_song, get_song, list_songs, stream_song, update_song};
pub use tags::{assign_tags, create_tag, delete_tag, list_tags, remove_tag};

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
}

/// GET /api/health — minimal liveness probe.
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}
