use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::Mutex;

use aurora_server::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let db_path = std::env::var("AURORA_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let data_dir = dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("Aurora");
            data_dir.join("aurora.db")
        });

    let port: u16 = std::env::var("AURORA_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8001);

    println!("Aurora Rust server starting...");
    println!("  DB path: {}", db_path.display());
    println!("  Port:    {port}");

    let conn = aurora_core::db::open_and_migrate(&db_path)?;
    let user_version: i64 =
        conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    println!("  user_version: {user_version}");

    let state = Arc::new(AppState {
        conn: Mutex::new(conn),
    });

    let app = aurora_server::build_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
