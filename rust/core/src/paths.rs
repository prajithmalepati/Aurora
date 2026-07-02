//! Central path resolution for Aurora's data directory.
//!
//! Resolution order for the data directory:
//!   1. `AURORA_DATA_DIR` environment variable (if set)
//!   2. Platform-appropriate default matching Python's `platformdirs.user_data_dir("Aurora")`
//!
//! All persistent data (database, album art, playlist images) lives here,
//! decoupled from the source tree for packaging compatibility.
//!
//! Matches Python `backend/app/paths.py` exactly.

use std::path::PathBuf;
use std::sync::LazyLock;

/// Resolve the Aurora data directory.
///
/// 1. `AURORA_DATA_DIR` env var (if set and non-empty)
/// 2. Platform default matching `platformdirs.user_data_dir("Aurora")`:
///    - Linux/macOS: `$XDG_DATA_HOME/Aurora` or `~/.local/share/Aurora`
///    - Windows: `%LOCALAPPDATA%\Aurora\Aurora` (platformdirs' appauthor
///      defaults to appname when not specified, producing the double dir)
#[allow(clippy::collapsible_if)]
pub static DATA_DIR: LazyLock<PathBuf> = LazyLock::new(|| {
    if let Ok(dir) = std::env::var("AURORA_DATA_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    platform_data_dir()
});

/// Album art directory: `DATA_DIR/album-art`.
/// Matches Python `paths.py`: `ALBUM_ART_DIR = DATA_DIR / "album-art"`.
pub static ALBUM_ART_DIR: LazyLock<PathBuf> = LazyLock::new(|| DATA_DIR.join("album-art"));

/// Database path: `DATA_DIR/aurora.db`.
/// Matches Python `paths.py`: `DB_PATH = DATA_DIR / "aurora.db"`.
pub static DB_PATH: LazyLock<PathBuf> = LazyLock::new(|| DATA_DIR.join("aurora.db"));

/// Playlist images directory: `DATA_DIR/playlist-images`.
pub static PLAYLIST_IMAGES_DIR: LazyLock<PathBuf> =
    LazyLock::new(|| DATA_DIR.join("playlist-images"));

/// Platform-specific data directory matching Python's `platformdirs.user_data_dir("Aurora")`.
///
/// On Linux/macOS: `dirs::data_dir() / "Aurora"` (e.g. `~/.local/share/Aurora`).
/// On Windows: `%LOCALAPPDATA%\Aurora\Aurora` — platformdirs' `user_data_dir("Aurora")`
/// with default `appauthor=None` produces `<appauthor>\<appname>` which resolves to
/// `Aurora\Aurora` when appauthor defaults to appname.
fn platform_data_dir() -> PathBuf {
    // On Windows, platformdirs uses LOCALAPPDATA (not Roaming) for user_data_dir
    // when app_version is not set, and appauthor defaults to appname.
    // This produces: C:\Users\<user>\AppData\Local\Aurora\Aurora
    #[cfg(target_os = "windows")]
    {
        // dirs::data_dir() returns Roaming on Windows, but platformdirs uses Local.
        // Use std env var for LOCALAPPDATA to match Python exactly.
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local).join("Aurora").join("Aurora");
        }
        // Fallback: Roaming (dirs::data_dir())
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Aurora")
            .join("Aurora")
    }
    // On Linux/macOS, dirs::data_dir() matches platformdirs exactly:
    // Linux: ~/.local/share, macOS: ~/Library/Application Support
    #[cfg(not(target_os = "windows"))]
    {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("Aurora")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_album_art_dir_suffix() {
        // Must end with "album-art" (hyphen, not underscore)
        let art_dir = ALBUM_ART_DIR.clone();
        assert!(
            art_dir.ends_with("album-art"),
            "Expected suffix 'album-art', got: {:?}",
            art_dir
        );
    }

    #[test]
    fn test_db_path_suffix() {
        let db = DB_PATH.clone();
        assert!(db.ends_with("aurora.db"));
    }

    #[test]
    fn test_env_override() {
        // AURORA_DATA_DIR is tested via the live battery (sets the env var).
        // This test just verifies the static resolves without panic.
        let _ = DATA_DIR.clone();
    }
}
