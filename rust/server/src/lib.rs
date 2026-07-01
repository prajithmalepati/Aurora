use std::sync::Arc;

use tokio::sync::Mutex;

mod routes;

/// Shared application state — holds a single rusqlite Connection.
///
/// Wrapped in `Arc<Mutex<>>` so axum handlers can share it.
/// rusqlite's Connection is `!Send`, but `Mutex` makes it usable
/// across async tasks (lock is held only during synchronous DB calls).
pub struct AppState {
    pub conn: Mutex<aurora_core::rusqlite::Connection>,
}

/// Build the axum Router with all API routes mounted.
///
/// Shared by `main()` and the golden test harness.
pub fn build_router(state: Arc<AppState>) -> axum::Router {
    axum::Router::new()
        .route("/api/health", axum::routing::get(routes::health))
        .route(
            "/api/songs",
            axum::routing::get(routes::list_songs).post(routes::create_song),
        )
        .route(
            "/api/songs/{song_id}",
            axum::routing::get(routes::get_song)
                .put(routes::update_song)
                .delete(routes::delete_song),
        )
        .route(
            "/api/songs/{song_id}/stream",
            axum::routing::get(routes::stream_song),
        )
        .route(
            "/api/songs/{song_id}/bleed-thumb",
            axum::routing::get(routes::bleed_thumb),
        )
        .route(
            "/api/album-art/{filename}",
            axum::routing::get(routes::album_art),
        )
        .route(
            "/api/tags",
            axum::routing::get(routes::list_tags).post(routes::create_tag),
        )
        .route("/api/tags/{tag_id}", axum::routing::delete(routes::delete_tag))
        .route(
            "/api/songs/{song_id}/tags",
            axum::routing::post(routes::assign_tags),
        )
        .route(
            "/api/songs/{song_id}/tags/{tag_id}",
            axum::routing::delete(routes::remove_tag),
        )
        .route("/api/filter", axum::routing::post(routes::filter_endpoint))
        // ── Playlist routes ──
        .route(
            "/api/playlists",
            axum::routing::get(routes::list_playlists).post(routes::create_playlist),
        )
        .route(
            "/api/playlists/import",
            axum::routing::post(routes::import_playlist),
        )
        .route(
            "/api/playlists/{playlist_id}",
            axum::routing::get(routes::get_playlist)
                .put(routes::update_playlist)
                .delete(routes::delete_playlist),
        )
        .route(
            "/api/playlists/{playlist_id}/songs",
            axum::routing::post(routes::add_song_to_playlist),
        )
        .route(
            "/api/playlists/{playlist_id}/songs/reorder",
            axum::routing::put(routes::reorder_playlist_songs),
        )
        .route(
            "/api/playlists/{playlist_id}/songs/{song_id}",
            axum::routing::delete(routes::remove_song_from_playlist),
        )
        .route(
            "/api/playlists/{playlist_id}/songs/{song_id}/timing",
            axum::routing::patch(routes::update_song_timing),
        )
        .route(
            "/api/playlists/{playlist_id}/image",
            axum::routing::put(routes::upload_playlist_image)
                .delete(routes::delete_playlist_image),
        )
        .route(
            "/api/playlists/{playlist_id}/export",
            axum::routing::get(routes::export_playlist),
        )
        .route(
            "/api/playlist-images/{filename}",
            axum::routing::get(routes::serve_playlist_image),
        )
        // ── Folder routes ──
        .route(
            "/api/folders",
            axum::routing::get(routes::get_folder_tree),
        )
        .route(
            "/api/folders/songs",
            axum::routing::get(routes::get_folder_songs),
        )
        // ── Album routes ──
        .route(
            "/api/albums",
            axum::routing::get(routes::list_albums),
        )
        .route(
            "/api/albums/{album_name}",
            axum::routing::get(routes::get_album),
        )
        .with_state(state)
}
