use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::net::TcpListener;
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent};

struct SidecarState {
    child: Mutex<Option<Child>>,
    port: Mutex<u16>,
    shutting_down: AtomicBool,
}

fn find_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    port
}

const BIN: &str = if cfg!(target_os = "windows") {
    "aurora-backend.exe"
} else {
    "aurora-backend"
};

fn resolve_backend_bin(app: &tauri::AppHandle) -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        // Dev: repo-relative path from src-tauri/
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir.join("../../backend/dist/aurora-backend").join(BIN)
    } else {
        // Bundled: resources map puts aurora-backend/ at resource_dir/backend/
        let resource_dir = app.path().resource_dir().expect("resource_dir");
        resource_dir.join("backend").join(BIN)
    }
}

fn spawn_backend(bin: &std::path::Path, port: u16) -> std::io::Result<Child> {
    let (stdout, stderr) = if cfg!(debug_assertions) {
        (std::process::Stdio::inherit(), std::process::Stdio::inherit())
    } else {
        (std::process::Stdio::null(), std::process::Stdio::null())
    };
    Command::new(bin)
        .env("AURORA_PORT", port.to_string())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
}

fn wait_for_health(port: u16, timeout: Duration) -> bool {
    let url = format!("http://127.0.0.1:{}/api/health", port);
    let start = Instant::now();
    while start.elapsed() < timeout {
        if let Ok(resp) = reqwest::blocking::get(&url) {
            if resp.status().is_success() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SidecarState {
            child: Mutex::new(None),
            port: Mutex::new(0),
            shutting_down: AtomicBool::new(false),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let bin = resolve_backend_bin(app.handle());
            let port = find_free_port();
            log::info!("sidecar: spawning {} on port {}", bin.display(), port);

            let child = match spawn_backend(&bin, port) {
                Ok(c) => c,
                Err(e) => {
                    log::error!("sidecar: failed to spawn backend: {}", e);
                    let msg = format!("Failed to start backend:\n{}\n\nPath: {}", e, bin.display());
                    use tauri_plugin_dialog::DialogExt;
                    app.dialog()
                        .message(&msg)
                        .title("Aurora — Backend Error")
                        .blocking_show();
                    return Err(Box::new(e));
                }
            };

            // Store port + child in managed state
            {
                let state = app.state::<SidecarState>();
                *state.port.lock().unwrap() = port;
                *state.child.lock().unwrap() = Some(child);
            }

            // Health gate — block until backend is ready (up to 15s)
            let healthy = wait_for_health(port, Duration::from_secs(15));
            if !healthy {
                log::error!("sidecar: backend did not become healthy in 15s");
                // Don't block forever — show window anyway, user will see error
            }

            // Inject base URL via initialization_script (runs before page JS on every nav)
            let init = format!("window.__AURORA_BASE_URL__ = \"http://127.0.0.1:{}\";", port);

            // Create window AFTER health gate — user never sees a white/frozen screen
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("Aurora")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .initialization_script(&init)
                .build()?;

            log::info!("sidecar: ready on port {}", port);

            // Background monitor thread — restart with backoff if sidecar dies
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = handle.state::<SidecarState>();
                loop {
                    std::thread::sleep(Duration::from_secs(2));
                    // Exit if app is shutting down
                    if state.shutting_down.load(Ordering::Acquire) {
                        return;
                    }
                    let mut guard = state.child.lock().unwrap();
                    if let Some(ref mut child) = *guard {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                log::warn!("sidecar: backend exited ({}), restarting...", status);
                                // Clear cached exit status so try_wait can't re-trigger
                                *guard = None;
                                if state.shutting_down.load(Ordering::Acquire) {
                                    return;
                                }
                                let port = *state.port.lock().unwrap();
                                let bin = resolve_backend_bin(&handle);
                                // 3 attempts with backoff
                                let mut restarted = false;
                                for attempt in 1..=3u32 {
                                    let delay = Duration::from_secs(attempt as u64);
                                    log::info!(
                                        "sidecar: restart attempt {} after {:?}",
                                        attempt,
                                        delay
                                    );
                                    drop(guard); // release lock during sleep
                                    std::thread::sleep(delay);
                                    if state.shutting_down.load(Ordering::Acquire) {
                                        return;
                                    }
                                    guard = state.child.lock().unwrap();
                                    match spawn_backend(&bin, port) {
                                        Ok(new_child) => {
                                            *guard = Some(new_child);
                                            log::info!("sidecar: restarted successfully");
                                            restarted = true;
                                            break;
                                        }
                                        Err(e) => {
                                            log::error!("sidecar: restart failed: {}", e);
                                        }
                                    }
                                }
                                if !restarted {
                                    log::error!("sidecar: giving up after 3 failed restarts");
                                }
                            }
                            Ok(None) => { /* still running */ }
                            Err(e) => {
                                log::error!("sidecar: try_wait error: {}", e);
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } = event {
            let state = app_handle.state::<SidecarState>();
            // Signal monitor thread to stop BEFORE killing the child
            state.shutting_down.store(true, Ordering::Release);
            let mut guard = state.child.lock().unwrap();
            if let Some(ref mut child) = *guard {
                log::info!("sidecar: killing backend on exit");
                let _ = child.kill();
                let _ = child.wait();
                *guard = None;
            }
        }
    });
}
