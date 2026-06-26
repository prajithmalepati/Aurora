//! Database connection, schema, and migration ladder.
//!
//! Ported 1:1 from backend/app/database.py. The migration ladder,
//! user_version numbering, and pragmas must match exactly so that a
//! DB created by Python is readable by Rust and vice-versa.

mod migrations;

use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;

/// Open (or create) the Aurora database at `db_path`, run the INIT_SQL,
/// apply the migration ladder, and return the connection.
///
/// Mirrors Python `init_db()` exactly: runs INIT_SQL (CREATE TABLE IF NOT EXISTS),
/// then the forward migration ladder, then stamps user_version.
pub fn open_and_migrate(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)
        .with_context(|| format!("failed to open DB at {}", db_path.display()))?;

    // Pragmas — must match Python get_db()
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch("PRAGMA busy_timeout = 5000;")?;

    // INIT_SQL — create all tables (idempotent via IF NOT EXISTS)
    conn.execute_batch(migrations::INIT_SQL)?;

    // Migration ladder
    migrations::run_migrations(&conn)?;

    Ok(conn)
}

/// Open an existing DB read-only (for health/read proofs).
/// Does NOT run migrations — use open_and_migrate for init.
pub fn open_readonly(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open_with_flags(db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .with_context(|| format!("failed to open DB (ro) at {}", db_path.display()))?;

    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch("PRAGMA busy_timeout = 5000;")?;

    Ok(conn)
}
