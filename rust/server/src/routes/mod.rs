pub mod addons;
mod albums;
mod envelope;
mod filter;
mod folders;
mod playlists;
pub mod scanner;
mod smart_playlists;
mod songs;
mod tags;
pub mod watcher;

pub use albums::{get_album, list_albums};
pub use filter::filter_endpoint;
pub use folders::{get_folder_tree, get_folder_songs};
pub use playlists::{
    add_song_to_playlist, create_playlist, delete_playlist, delete_playlist_image,
    export_playlist, get_playlist, import_playlist, list_playlists, remove_song_from_playlist,
    reorder_playlist_songs, serve_playlist_image, update_playlist, update_song_timing,
    upload_playlist_image,
};
pub use smart_playlists::{
    create_smart_playlist, delete_smart_playlist, get_smart_playlist, list_smart_playlists,
    update_smart_playlist,
};
pub use songs::{album_art, bleed_thumb, create_song, delete_song, get_song, list_songs, mark_played, stream_song, update_song};
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
    pub db_path: String,
    pub data_dir: String,
}

/// GET /api/health — full health probe matching Python parity (7-key body).
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

    let db_path = state
        .db_path
        .as_ref()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| aurora_core::paths::DB_PATH.to_string_lossy().into_owned());
    let data_dir = aurora_core::paths::DATA_DIR.to_string_lossy().into_owned();

    Json(HealthResponse {
        status: "ok",
        database: "connected",
        song_count,
        tag_count,
        playlist_count,
        db_path,
        data_dir,
    })
}
