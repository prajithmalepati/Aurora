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
        .with_state(state)
}
