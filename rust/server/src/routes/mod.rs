mod envelope;
mod filter;
mod playlists;
mod songs;
mod tags;

pub use filter::filter_endpoint;
pub use playlists::{
    add_song_to_playlist, create_playlist, delete_playlist, delete_playlist_image,
    export_playlist, get_playlist, import_playlist, list_playlists, remove_song_from_playlist,
    reorder_playlist_songs, serve_playlist_image, update_playlist, update_song_timing,
    upload_playlist_image,
};
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
