use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;

pub mod background_watcher;
pub mod routes;

/// Shared application state — holds a single rusqlite Connection
/// plus the DB file path (for opening scan-dedicated connections).
///
/// Wrapped in `Arc<Mutex<>>` so axum handlers can share it.
/// rusqlite's Connection is `!Send`, but `Mutex` makes it usable
/// across async tasks (lock is held only during synchronous DB calls).
pub struct AppState {
    pub conn: Mutex<aurora_core::rusqlite::Connection>,
    /// Path to the SQLite DB file. None for in-memory test harness.
    pub db_path: Option<PathBuf>,
    /// Addon proxy state (HTTP client, rate limiters).
    pub addon_state: Arc<routes::addons::AddonState>,
    /// Background file watcher handle — endpoints signal reconfiguration.
    pub watcher_handle: Option<background_watcher::WatcherHandle>,
    /// Sidecar auth token. When `Some`, all `/api/*` except `/api/health`
    /// and `OPTIONS` require a matching `X-Aurora-Token` header or `?token=`
    /// query parameter. When `None`, auth is fully disabled (web-dev mode).
    pub aurora_token: Option<String>,
}

/// Constant-time string comparison (matches Python `secrets.compare_digest`).
/// XOR-accumulates bytes so timing does not leak which position mismatched.
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.bytes().zip(b.bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Token-auth middleware.  Reads the configured token from AppState.
/// Exempts `/api/health` (all methods) and `OPTIONS` (CORS preflight).
/// Token source: `X-Aurora-Token` header first, then `?token=` query param.
/// Returns 401 "Unauthorized" when token is missing or mismatched.
async fn token_auth_middleware(
    State(state): State<Arc<AppState>>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    // If no token configured, auth is off — pass through
    let expected = match &state.aurora_token {
        Some(t) => t.as_str(),
        None => return next.run(request).await,
    };

    let path = request.uri().path();
    let method = request.method();

    // Exempt /api/health (all methods) — Tauri health gate polls pre-token
    if path == "/api/health" {
        return next.run(request).await;
    }

    // Exempt OPTIONS — CORS preflight carries no custom headers
    if method == axum::http::Method::OPTIONS {
        return next.run(request).await;
    }

    // Token source: header first, then query param
    let token_from_header = request
        .headers()
        .get("X-Aurora-Token")
        .and_then(|v| v.to_str().ok());

    let token_from_query = if token_from_header.is_none() {
        request.uri().query().and_then(|q| {
            url::form_urlencoded::parse(q.as_bytes())
                .find(|(k, _)| k == "token")
                .map(|(_, v)| v.into_owned())
        })
    } else {
        None
    };

    let provided = token_from_header.or(token_from_query.as_deref());

    match provided {
        Some(t) if constant_time_eq(t, expected) => next.run(request).await,
        _ => axum::response::Response::builder()
            .status(axum::http::StatusCode::UNAUTHORIZED)
            .body(axum::body::Body::from("Unauthorized"))
            .unwrap(),
    }
}

use axum::extract::State;

/// Build the axum Router with all API routes mounted.
///
/// Shared by `main()` and the golden test harness.
pub fn build_router(state: Arc<AppState>) -> axum::Router {
    let api_routes = axum::Router::new()
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
        .route(
            "/api/tags/{tag_id}",
            axum::routing::delete(routes::delete_tag),
        )
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
                .delete(routes::delete_playlist_image)
                // F6: axum default is 2MB; raise to 12MB (10MB payload + multipart overhead).
                // Handler's own 10MB → 413 check remains the enforcing boundary.
                .layer(axum::extract::DefaultBodyLimit::max(12 * 1024 * 1024)),
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
        .route("/api/folders", axum::routing::get(routes::get_folder_tree))
        .route(
            "/api/folders/songs",
            axum::routing::get(routes::get_folder_songs),
        )
        // ── Album routes ──
        .route("/api/albums", axum::routing::get(routes::list_albums))
        .route(
            "/api/albums/{album_name}",
            axum::routing::get(routes::get_album),
        )
        // ── Scanner routes ──
        .route(
            "/api/scan",
            axum::routing::post(routes::scanner::scan_folder_endpoint),
        )
        .route(
            "/api/scan/stream",
            axum::routing::post(routes::scanner::scan_folder_stream),
        )
        // ── Watcher routes ──
        .route(
            "/api/watch",
            axum::routing::get(routes::watcher::list_watched_folders)
                .post(routes::watcher::add_watched_folder),
        )
        .route(
            "/api/watch/{folder_id}",
            axum::routing::delete(routes::watcher::remove_watched_folder),
        )
        .route(
            "/api/watch/{folder_id}/scan",
            axum::routing::post(routes::watcher::trigger_scan),
        )
        // ── Addon routes (N37) ──
        .route(
            "/api/addons",
            axum::routing::get(routes::addons::list_addons).post(routes::addons::add_addon),
        )
        .route(
            "/api/addons/{addon_id}",
            axum::routing::patch(routes::addons::toggle_addon).delete(routes::addons::delete_addon),
        )
        .route(
            "/api/addons/{addon_id}/search",
            axum::routing::get(routes::addons::addon_search),
        )
        .route(
            "/api/addons/{addon_id}/stream/{external_id}",
            axum::routing::get(routes::addons::addon_stream),
        )
        .route(
            "/api/addons/{addon_id}/lyrics",
            axum::routing::get(routes::addons::addon_lyrics),
        )
        .route(
            "/api/addons/{addon_id}/save",
            axum::routing::post(routes::addons::save_addon_track),
        )
        .route(
            "/api/songs/{song_id}/resolve",
            axum::routing::get(routes::addons::resolve_stream),
        );

    // Apply token-auth middleware around all /api routes.
    // Health and OPTIONS are exempted inside the middleware function.
    //
    // CORS: Tauri WebView2 sends requests from tauri://localhost or
    // https://tauri.localhost — origins the browser considers opaque.
    // Reflect any origin, which is fine because token auth protects
    // all mutating endpoints.
    api_routes
        .layer(CorsLayer::very_permissive())
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            token_auth_middleware,
        ))
        .with_state(state)
}
