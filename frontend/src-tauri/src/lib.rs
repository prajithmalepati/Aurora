use std::process::{Child, Command};
use std::sync::Mutex;
use std::net::TcpListener;
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent};

struct SidecarState {
    child: Mutex<Option<Child>>,
    port: Mutex<u16>,
}

fn find_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    port
}

fn resolve_backend_bin(app: &tauri::AppHandle) -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        // Dev: repo-relative path from src-tauri/
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir.join("../../backend/dist/aurora-backend/aurora-backend")
    } else {
        // Bundled: inside resource dir
        let resource_dir = app.path().resource_dir().expect("resource_dir");
        resource_dir.join("backend/dist/aurora-backend/aurora-backend")
    }
}

fn spawn_backend(bin: &std::path::Path, port: u16) -> std::io::Result<Child> {
    Command::new(bin)
        .env("AURORA_PORT", port.to_string())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
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
        .manage(SidecarState {
            child: Mutex::new(None),
            port: Mutex::new(0),
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

            let child = spawn_backend(&bin, port)
                .expect("failed to spawn aurora-backend sidecar");

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

            // Inject base URL before frontend loads
            let base_url = format!("http://127.0.0.1:{}", port);
            let init_script = format!("window.__AURORA_BASE_URL__ = \"{}\";", base_url);

            let window = app.get_webview_window("main").expect("main window");
            window.eval(&init_script).expect("eval init script");

            log::info!("sidecar: ready on {}", base_url);

            // Background monitor thread — restart with backoff if sidecar dies
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = handle.state::<SidecarState>();
                loop {
                    std::thread::sleep(Duration::from_secs(2));
                    let mut guard = state.child.lock().unwrap();
                    if let Some(ref mut child) = *guard {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                log::warn!("sidecar: backend exited ({}), restarting...", status);
                                let port = *state.port.lock().unwrap();
                                let bin = resolve_backend_bin(&handle);
                                // Backoff: 3 retries with increasing delay
                                for attempt in 1..=3u32 {
                                    let delay = Duration::from_secs(attempt as u64);
                                    log::info!(
                                        "sidecar: restart attempt {} after {:?}",
                                        attempt,
                                        delay
                                    );
                                    drop(guard); // release lock during sleep
                                    std::thread::sleep(delay);
                                    guard = state.child.lock().unwrap();
                                    match spawn_backend(&bin, port) {
                                        Ok(new_child) => {
                                            *guard = Some(new_child);
                                            log::info!("sidecar: restarted successfully");
                                            break;
                                        }
                                        Err(e) => {
                                            log::error!("sidecar: restart failed: {}", e);
                                            if attempt == 3 {
                                                log::error!(
                                                    "sidecar: all restart attempts exhausted"
                                                );
                                            }
                                        }
                                    }
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
