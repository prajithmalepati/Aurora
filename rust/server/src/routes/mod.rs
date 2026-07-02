mod albums;
mod envelope;
mod filter;
mod folders;
mod playlists;
mod songs;
mod tags;

pub use albums::{get_album, list_albums};
pub use filter::filter_endpoint;
pub use folders::{get_folder_tree, get_folder_songs};
pub use playlists::{
    add_song_to_playlist, create_playlist, delete_playlist, delete_playlist_image,
    export_playlist, get_playlist, import_playlist, list_playlists, remove_song_from_playlist,
    reorder_playlist_songs, serve_playlist_image, update_playlist, update_song_timing,
    upload_playlist_image,
};
pub use songs::{album_art, bleed_thumb, create_song, delete_song, get_song, list_songs, stream_song, update_song};
pub use tags::{assign_tags, create_tag, delete_tag, list_tags, remove_tag};

use axum::extract::State;
use axum::Json;
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub database: &'static str,
    pub song_count: i64,
    pub tag_count: i64,
    pub playlist_count: i64,
}

/// GET /api/health — full health probe matching Python parity (5-key body).
pub async fn health(
    State(state): State<Arc<crate::AppState>>,
) -> Json<HealthResponse> {
    let conn = state.conn.lock().await;
    let song_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM songs", [], |r| r.get(0))
        .unwrap_or(0);
    let tag_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM tags", [], |r| r.get(0))
        .unwrap_or(0);
    let playlist_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM playlists", [], |r| r.get(0))
        .unwrap_or(0);
    Json(HealthResponse {
        status: "ok",
        database: "connected",
        song_count,
        tag_count,
        playlist_count,
    })
}
