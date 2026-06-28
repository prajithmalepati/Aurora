use axum::{routing::get, Router};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

mod routes;

/// Shared application state.
pub struct AppState {
    pub db_path: PathBuf,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // DB path: AURORA_DB_PATH env var, or default to platform data dir
    let db_path = std::env::var("AURORA_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            // Mirror Python's platformdirs.user_data_dir("Aurora")
            let data_dir = dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("Aurora");
            data_dir.join("aurora.db")
        });

    // Port: AURORA_PORT env var, or default 8001 (8000 is Python)
    let port: u16 = std::env::var("AURORA_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8001);

    // Open + migrate the DB
    println!("Aurora Rust server starting...");
    println!("  DB path: {}", db_path.display());
    println!("  Port:    {port}");

    let conn = aurora_core::db::open_and_migrate(&db_path)?;
    let user_version: i64 =
        conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    println!("  user_version: {user_version}");

    // Wrap in Arc for shared state
    let state = Arc::new(AppState { db_path });

    let app = Router::new()
        .route("/api/health", get(routes::health))
        .route("/api/songs", get(routes::songs))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
