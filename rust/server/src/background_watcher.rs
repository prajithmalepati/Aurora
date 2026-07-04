//! Background file watcher — auto-imports songs when files change in watched folders.
//!
//! Uses the `notify` crate (native inotify/FSEvents) with debouncing.
//! Behavior-parity with Python's `FileWatcher` (auto-import on change),
//! but uses native FS events instead of 30s polling.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use notify_debouncer_mini::{DebouncedEvent, Debouncer};
use tokio::sync::{mpsc, watch};

use aurora_core::db::queries;
use aurora_core::scanner::db::SUPPORTED_EXTENSIONS;

/// Handle for communicating with the background watcher task.
/// Stored in AppState so endpoints can signal reconfiguration.
pub struct WatcherHandle {
    /// Send a reconfiguration signal (re-read active folders from DB).
    pub reconfigure_tx: mpsc::Sender<()>,
}

/// Start the background file watcher.
///
/// Returns a `WatcherHandle` for signaling reconfiguration from endpoints,
/// and a `watch::Sender` for shutdown (dropping it signals stop).
pub fn start_background_watcher(db_path: PathBuf) -> (WatcherHandle, watch::Sender<bool>) {
    let (reconfigure_tx, reconfigure_rx) = mpsc::channel::<()>(8);
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    tokio::spawn(watcher_task(db_path, reconfigure_rx, shutdown_rx));

    (WatcherHandle { reconfigure_tx }, shutdown_tx)
}

/// The main watcher task loop.
///
/// On startup and on each reconfiguration signal:
/// 1. Read active watched folders from DB
/// 2. Register notify watches for each folder (recursive)
/// 3. On file events, run import_scanned_songs for the affected folder
async fn watcher_task(
    db_path: PathBuf,
    mut reconfigure_rx: mpsc::Receiver<()>,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    // Track current debouncer and folder→path mapping
    let mut current_debouncer: Option<Debouncer<notify::RecommendedWatcher>> = None;
    let mut watched_paths: HashMap<PathBuf, i64> = HashMap::new(); // path → folder_id
    let (event_tx, mut event_rx) = mpsc::channel::<Vec<DebouncedEvent>>(64);

    // Initial setup
    match reconfigure_watches(&db_path, &mut current_debouncer, &mut watched_paths, event_tx.clone()) {
        Ok(()) => println!("Background watcher initialized with {} folders", watched_paths.len()),
        Err(e) => println!("Background watcher init failed: {}", e),
    }

    loop {
        tokio::select! {
            // Reconfiguration signal from endpoint
            _ = reconfigure_rx.recv() => {
                if let Err(e) = reconfigure_watches(&db_path, &mut current_debouncer, &mut watched_paths, event_tx.clone()) {
                    println!("Watcher reconfiguration failed: {}", e);
                }
            }
            // File event from notify
            events = event_rx.recv() => {
                match events {
                    Some(events) => {
                        handle_events(&db_path, &events, &watched_paths).await;
                    }
                    None => break, // Channel closed
                }
            }
            // Shutdown signal
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    println!("Background watcher shutting down");
                    break;
                }
            }
        }
    }
}

/// Re-read active folders from DB and re-register notify watches.
fn reconfigure_watches(
    db_path: &Path,
    debouncer: &mut Option<Debouncer<notify::RecommendedWatcher>>,
    watched_paths: &mut HashMap<PathBuf, i64>,
    event_tx: mpsc::Sender<Vec<DebouncedEvent>>,
) -> anyhow::Result<()> {
    // Read active folders from DB
    let conn = aurora_core::db::open_and_migrate(db_path)?;
    let active_folders = queries::list_active_watched_folders(&conn)?;
    drop(conn);

    // Drop old debouncer (stops all watches)
    *debouncer = None;
    watched_paths.clear();

    // Create new debouncer with 2s quiet window
    let mut deb = notify_debouncer_mini::new_debouncer(
        Duration::from_secs(2),
        move |events: Result<Vec<DebouncedEvent>, notify::Error>| {
            if let Ok(events) = events {
                let _ = event_tx.blocking_send(events);
            }
        },
    )?;

    // Register watches for each active folder
    for (folder_id, folder_path) in &active_folders {
        let path = PathBuf::from(folder_path);
        if path.is_dir() {
            if let Err(e) = deb.watcher().watch(&path, notify::RecursiveMode::Recursive) {
                println!("Failed to watch folder {}: {}", folder_path, e);
                continue;
            }
            watched_paths.insert(path, *folder_id);
            println!("Watching folder {} (id={})", folder_path, folder_id);
        } else {
            println!("Watched folder no longer exists: {}", folder_path);
        }
    }

    *debouncer = Some(deb);
    Ok(())
}

/// Handle debounced file events — trigger imports for affected folders.
async fn handle_events(
    db_path: &Path,
    events: &[DebouncedEvent],
    watched_paths: &HashMap<PathBuf, i64>,
) {
    // Collect unique folder_ids that need scanning
    let mut folders_to_scan: HashMap<i64, String> = HashMap::new(); // folder_id → path

    for event in events {
        let path = &event.path;

        // Check if this is an audio file we care about
        if !is_audio_file(path) {
            continue;
        }

        // Find which watched folder contains this file
        for (watched_path, &folder_id) in watched_paths {
            if path.starts_with(watched_path) {
                folders_to_scan
                    .entry(folder_id)
                    .or_insert_with(|| watched_path.to_string_lossy().to_string());
                break;
            }
        }
    }

    // Import each affected folder on a blocking thread
    for (folder_id, folder_path) in folders_to_scan {
        let db_path = db_path.to_path_buf();
        let folder_path_clone = folder_path.clone();

        let result = tokio::task::spawn_blocking(move || {
            let conn = aurora_core::db::open_and_migrate(&db_path)?;
            let result = aurora_core::scanner::db::import_scanned_songs(
                &conn,
                &folder_path_clone,
                None,
                None,
                None,
            )?;
            queries::update_watched_folder_last_scan(&conn, folder_id)?;
            Ok::<_, anyhow::Error>(result)
        })
        .await;

        match result {
            Ok(Ok(scan_result)) => {
                if scan_result.imported > 0 || scan_result.replaced > 0 {
                    println!(
                        "Background import for folder {}: imported={}, replaced={}, skipped={}",
                        folder_path,
                        scan_result.imported,
                        scan_result.replaced,
                        scan_result.skipped,
                    );
                }
            }
            Ok(Err(e)) => {
                println!("Background import failed for folder {}: {}", folder_path, e);
            }
            Err(e) => {
                println!("Background import task panicked for folder {}: {}", folder_path, e);
            }
        }
    }
}

/// Check if a file path has a supported audio extension.
fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| {
            let ext_lower = format!(".{}", ext.to_lowercase());
            SUPPORTED_EXTENSIONS.contains(&ext_lower.as_str())
        })
        .unwrap_or(false)
}
