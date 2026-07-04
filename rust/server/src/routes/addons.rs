//! Addons router — ported from backend/app/routers/addons.py (N37).
//!
//! CRUD + proxy endpoints for music addon protocol.
//! SSRF two-layer defense, rate limiter, circuit breaker.

#![allow(clippy::collapsible_if)]

use std::collections::HashMap;
use std::net::ToSocketAddrs;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use tokio::sync::Mutex;

use aurora_core::addons::is_private_ip;
use crate::AppState;
use super::envelope;

// ── Constants ─────────────────────────────────────────────────────────

const _MAX_REDIRECTS: usize = 3;
const _MAX_BODY_MANIFEST: u64 = 1024 * 1024; // 1 MB
const _MAX_BODY_PROXY: u64 = 4 * 1024 * 1024;    // 4 MB
const _COOLDOWN_SECONDS: i64 = 300; // 5 min
const _FAIL_THRESHOLD: i64 = 3;
const _LOCALHOST_HOSTNAMES: &[&str] = &["localhost", "127.0.0.1", "::1"];

// ── SSRF-Validating DNS Resolver ──────────────────────────────────────

/// reqwest DNS resolver that blocks private/resolved IPs.
/// Implements the connect-time anti-rebinding defense (F2).
struct SsrfResolver;

impl reqwest::dns::Resolve for SsrfResolver {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        Box::pin(async move {
            let host = name.as_str().to_string();
            // Skip validation for localhost
            if _LOCALHOST_HOSTNAMES.contains(&host.as_str()) {
                let addrs = (host.as_str(), 0u16)
                    .to_socket_addrs()
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                return Ok(Box::new(addrs) as Box<_>);
            }

            let addrs = (host.as_str(), 0u16)
                .to_socket_addrs()
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

            // Validate every resolved IP
            let mut vetted = Vec::new();
            for addr in addrs {
                if is_private_ip(addr.ip()) {
                    return Err(Box::new(std::io::Error::other(
                        format!("SSRF blocked: DNS resolved {} to private IP {}", host, addr.ip()),
                    )) as Box<dyn std::error::Error + Send + Sync>);
                }
                vetted.push(addr);
            }

            if vetted.is_empty() {
                return Err(Box::new(std::io::Error::other(
                    format!("Could not resolve {}", host),
                )) as Box<dyn std::error::Error + Send + Sync>);
            }

            Ok(Box::new(vetted.into_iter()) as Box<_>)
        })
    }
}

// ── Rate Limiter ──────────────────────────────────────────────────────

pub struct TokenBucket {
    capacity: f64,
    tokens: f64,
    fill_rate: f64, // tokens per second
    last_fill: Instant,
}

impl TokenBucket {
    fn new(rpm: u32) -> Self {
        Self {
            capacity: rpm as f64,
            tokens: rpm as f64,
            fill_rate: rpm as f64 / 60.0,
            last_fill: Instant::now(),
        }
    }

    fn consume(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_fill).as_secs_f64();
        self.tokens = (self.capacity).min(self.tokens + elapsed * self.fill_rate);
        self.last_fill = now;

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

// ── Shared State ──────────────────────────────────────────────────────

/// Addon-specific state — HTTP client + rate limiters.
pub struct AddonState {
    pub http_client: reqwest::Client,
    pub rate_limiters: Mutex<HashMap<String, TokenBucket>>,
}

impl AddonState {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .dns_resolver(Arc::new(SsrfResolver))
            .redirect(reqwest::redirect::Policy::none()) // F1: manual redirect loop
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(5)
            .build()
            .expect("failed to build SSRF-safe HTTP client");

        Self {
            http_client: client,
            rate_limiters: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for AddonState {
    fn default() -> Self {
        Self::new()
    }
}

// ── SSRF Validation (pre-flight) ─────────────────────────────────────

/// Validate a URL against SSRF. Returns error detail string on rejection.
fn validate_url_for_ssrf(url: &str) -> Result<(), (StatusCode, String)> {
    let parsed = match url::Url::parse(url) {
        Ok(u) => u,
        Err(_) => return Err((StatusCode::BAD_REQUEST, "Invalid URL".to_string())),
    };

    let scheme = parsed.scheme();
    if scheme != "https" && scheme != "http" {
        return Err((StatusCode::BAD_REQUEST, format!("Unsupported URL scheme: {}", scheme)));
    }

    let host = match parsed.host_str() {
        Some(h) => h,
        None => return Err((StatusCode::BAD_REQUEST, "URL has no hostname".to_string())),
    };

    if scheme == "http" && !_LOCALHOST_HOSTNAMES.contains(&host) {
        return Err((
            StatusCode::BAD_REQUEST,
            "HTTP is only allowed for localhost; use HTTPS for remote addons".to_string(),
        ));
    }

    if _LOCALHOST_HOSTNAMES.contains(&host) {
        return Ok(());
    }

    let addrs = match (host, 0u16).to_socket_addrs() {
        Ok(a) => a,
        Err(_) => return Err((StatusCode::BAD_REQUEST, format!("Cannot resolve hostname: {}", host))),
    };

    for addr in addrs {
        if is_private_ip(addr.ip()) {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("URL resolves to private/reserved IP: {}", addr.ip()),
            ));
        }
    }

    Ok(())
}

// ── Safe Fetch with Redirect + Size Cap ───────────────────────────────

/// Read the response body with a running byte count, aborting past max_bytes.
/// Mirrors Python's chunked read + abort (addons.py:140-147).
async fn read_body_capped(
    mut resp: reqwest::Response,
    max_bytes: u64,
) -> Result<Vec<u8>, (StatusCode, String)> {
    let mut body = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| {
        (StatusCode::BAD_GATEWAY, format!("Read error: {}", e))
    })? {
        if (body.len() as u64) + (chunk.len() as u64) > max_bytes {
            return Err((
                StatusCode::BAD_GATEWAY,
                format!("Addon response exceeded size limit ({max_bytes} bytes)"),
            ));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

/// Fetch a URL with manual redirect following + SSRF validation on every hop.
async fn safe_get(
    client: &reqwest::Client,
    url: &str,
    params: Option<&[(&str, &str)]>,
    max_body_bytes: u64,
) -> Result<reqwest::Response, (StatusCode, String)> {
    let mut current_url = url.to_string();
    let mut current_params = params;

    for _hop in 0..=_MAX_REDIRECTS {
        validate_url_for_ssrf(&current_url)?;

        let mut req = client.get(&current_url);
        if let Some(p) = current_params {
            req = req.query(p);
        }
        current_params = None;

        let resp = req.send().await.map_err(|e| {
            (StatusCode::BAD_GATEWAY, format!("Addon unreachable: {}", e))
        })?;

        let status = resp.status();

        // Check size via Content-Length header first
        if let Some(cl) = resp.headers().get("content-length") {
            if let Ok(size) = cl.to_str().unwrap_or("0").parse::<u64>() {
                if size > max_body_bytes {
                    return Err((
                        StatusCode::BAD_GATEWAY,
                        format!("Addon response too large ({} bytes, max {})", size, max_body_bytes),
                    ));
                }
            }
        }

        if status.is_redirection() {
            let location = resp.headers().get("location").and_then(|v| v.to_str().ok());
            let location = match location {
                Some(l) => l.to_string(),
                None => return Err((StatusCode::BAD_GATEWAY, "Redirect with no Location header".to_string())),
            };
            current_url = match url::Url::parse(&current_url) {
                Ok(base) => base.join(&location).unwrap_or_else(|_| url::Url::parse(&location).unwrap_or(base)).to_string(),
                Err(_) => location,
            };
            continue;
        }

        return Ok(resp);
    }

    Err((StatusCode::BAD_GATEWAY, format!("Too many redirects (>{})", _MAX_REDIRECTS)))
}

// ── Circuit Breaker ───────────────────────────────────────────────────

/// Returns true if circuit is OPEN (request should be blocked).
fn check_circuit(fail_count: i64, last_fail_at: Option<&str>) -> bool {
    if fail_count < _FAIL_THRESHOLD {
        return false;
    }
    let Some(fail_str) = last_fail_at else {
        return true;
    };
    match chrono::DateTime::parse_from_rfc3339(fail_str) {
        Ok(fail_dt) => {
            let elapsed = chrono::Utc::now().signed_duration_since(fail_dt);
            elapsed.num_seconds() < _COOLDOWN_SECONDS
        }
        Err(_) => true,
    }
}

// ── Manifest Validation ───────────────────────────────────────────────

fn validate_manifest(data: &Value) -> Result<(), (StatusCode, String)> {
    let required = ["id", "name", "version", "resources", "types"];
    let missing: Vec<_> = required.iter().filter(|f| data.get(**f).is_none()).collect();
    if !missing.is_empty() {
        let fields: Vec<_> = missing.iter().map(|s| s.to_string()).collect();
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("Manifest missing required fields: {}", fields.join(", ")),
        ));
    }

    let valid_types = ["track", "album", "artist", "playlist"];
    if let Some(types) = data["types"].as_array() {
        let invalid: Vec<_> = types
            .iter()
            .filter_map(|t| t.as_str())
            .filter(|t| !valid_types.contains(t))
            .collect();
        if !invalid.is_empty() {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                format!(
                    "Invalid content types: {}. Valid: {}",
                    invalid.join(", "),
                    valid_types.join(", ")
                ),
            ));
        }
    }

    Ok(())
}

// ── Response Normalization ────────────────────────────────────────────

fn normalize_search_response(raw: &Value, addon_id: &str) -> Value {
    serde_json::json!({
        "data": {
            "tracks": raw.get("tracks").cloned().unwrap_or(Value::Array(vec![])),
            "albums": raw.get("albums").cloned().unwrap_or(Value::Array(vec![])),
            "artists": raw.get("artists").cloned().unwrap_or(Value::Array(vec![])),
            "playlists": raw.get("playlists").cloned().unwrap_or(Value::Array(vec![])),
        },
        "meta": {"addon_id": addon_id},
        "message": "ok",
    })
}

fn normalize_stream_response(raw: &Value, addon_id: &str) -> Value {
    serde_json::json!({
        "data": {
            "url": raw.get("url"),
            "format": raw.get("format"),
            "quality": raw.get("quality"),
            "expiresAt": raw.get("expiresAt"),
        },
        "meta": {"addon_id": addon_id},
        "message": "ok",
    })
}

fn normalize_lyrics_response(raw: &Value, addon_id: &str) -> Value {
    serde_json::json!({
        "data": {
            "lyrics": raw.get("lyrics").cloned().unwrap_or(Value::String(String::new())),
        },
        "meta": {"addon_id": addon_id, "format": "lrc"},
        "message": "ok",
    })
}

// ── Helper: Get Addon + Pre-Flight Checks ─────────────────────────────

#[allow(clippy::result_large_err)]
fn get_addon_checked(
    conn: &aurora_core::rusqlite::Connection,
    addon_id: &str,
) -> Result<(Value, String, Value), Response> {
    let (addon, manifest_str) = aurora_core::db::queries::get_addon_full(conn, addon_id)
        .map_err(|e| envelope::bad_request(&e.to_string()).into_response())?
        .ok_or_else(|| envelope::not_found("Addon not found").into_response())?;

    if !addon["enabled"].as_bool().unwrap_or(false) {
        return Err(envelope::forbidden("Addon is disabled").into_response());
    }

    let fail_count = addon["fail_count"].as_i64().unwrap_or(0);
    let last_fail_at = addon["last_fail_at"].as_str();
    if check_circuit(fail_count, last_fail_at) {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "detail": format!("Addon circuit breaker open (fail_count={}). Try again later.", fail_count)
            })),
        ).into_response());
    }

    let base_url = addon["base_url"].as_str().unwrap_or("").to_string();
    let manifest: Value = serde_json::from_str(&manifest_str)
        .unwrap_or(Value::Object(serde_json::Map::new()));

    Ok((addon, base_url, manifest))
}

fn get_addon_rpm(manifest: &Value) -> u32 {
    manifest
        .get("aurora")
        .and_then(|a| a.get("rate_limit_rpm"))
        .and_then(|v| v.as_u64())
        .unwrap_or(60) as u32
}

fn get_stream_ttl(manifest: &Value) -> i64 {
    manifest
        .get("aurora")
        .and_then(|a| a.get("stream_ttl_seconds"))
        .and_then(|v| v.as_i64())
        .unwrap_or(3600)
}

// ── Proxy Request ─────────────────────────────────────────────────────

async fn proxy_request(
    state: &Arc<AppState>,
    addon_id: &str,
    base_url: &str,
    manifest: &Value,
    path: &str,
    params: Option<&[(&str, &str)]>,
) -> Result<Value, Response> {
    let url = format!("{}{}", base_url, path);

    validate_url_for_ssrf(&url).map_err(|(s, m)| (s, Json(serde_json::json!({"detail": m}))).into_response())?;

    // Rate limit
    let rpm = get_addon_rpm(manifest);
    {
        let mut limiters = state.addon_state.rate_limiters.lock().await;
        let limiter = limiters.entry(addon_id.to_string()).or_insert_with(|| TokenBucket::new(rpm));
        if !limiter.consume() {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({
                    "detail": format!("Rate limit exceeded for addon {} ({} rpm)", addon_id, rpm)
                })),
            ).into_response());
        }
    }

    let result = safe_get(&state.addon_state.http_client, &url, params, _MAX_BODY_PROXY).await;

    match result {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                let conn = state.conn.lock().await;
                let _ = aurora_core::db::queries::update_addon_success(&conn, addon_id);

                // F1: read body with running byte cap — chunked responses bypass Content-Length check.
                let body_bytes = read_body_capped(resp, _MAX_BODY_PROXY).await.map_err(|(s, m)| {
                    (s, Json(serde_json::json!({"detail": m}))).into_response()
                })?;
                let body = String::from_utf8(body_bytes).map_err(|e| {
                    (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"detail": format!("Invalid UTF-8: {}", e)}))).into_response()
                })?;
                serde_json::from_str(&body).map_err(|e| {
                    (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"detail": format!("Invalid JSON: {}", e)}))).into_response()
                })
            } else {
                let conn = state.conn.lock().await;
                let _ = aurora_core::db::queries::update_addon_failure(&conn, addon_id);
                Err((
                    StatusCode::BAD_GATEWAY,
                    Json(serde_json::json!({"detail": format!("Addon returned {}", status.as_u16())})),
                ).into_response())
            }
        }
        Err((s, m)) => {
            let conn = state.conn.lock().await;
            let _ = aurora_core::db::queries::update_addon_failure(&conn, addon_id);
            Err((s, Json(serde_json::json!({"detail": m}))).into_response())
        }
    }
}

// ── Request Bodies ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AddonCreate {
    pub base_url: String,
}

#[derive(Deserialize)]
pub struct AddonToggle {
    pub enabled: bool,
}

#[derive(Deserialize)]
pub struct AddonSaveTrack {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration: Option<i64>,
    pub external_id: String,
    pub artwork_url: Option<String>,
    pub stream_url: Option<String>,
}

// ── CRUD Handlers ─────────────────────────────────────────────────────

/// POST /api/addons — add a new addon.
pub async fn add_addon(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AddonCreate>,
) -> Response {
    let base_url = body.base_url.trim_end_matches('/').to_string();
    let manifest_url = format!("{}/manifest.json", base_url);

    if let Err((s, m)) = validate_url_for_ssrf(&base_url) {
        return (s, Json(serde_json::json!({"detail": m}))).into_response();
    }
    if let Err((s, m)) = validate_url_for_ssrf(&manifest_url) {
        return (s, Json(serde_json::json!({"detail": m}))).into_response();
    }

    // Check duplicate
    {
        let conn = state.conn.lock().await;
        match aurora_core::db::queries::get_addon_by_base_url(&conn, &base_url) {
            Ok(Some(_)) => return envelope::conflict("Addon already registered").into_response(),
            Ok(None) => {}
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
        }
    }

    // Fetch manifest
    let result = safe_get(&state.addon_state.http_client, &manifest_url, None, _MAX_BODY_MANIFEST).await;
    let resp = match result {
        Ok(r) => r,
        Err((s, m)) => return (s, Json(serde_json::json!({"detail": m}))).into_response(),
    };

    if !resp.status().is_success() {
        return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"detail": format!("Addon manifest returned {}", resp.status().as_u16())}))).into_response();
    }

    let manifest: Value = match resp.json().await {
        Ok(m) => m,
        Err(e) => return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"detail": format!("Invalid manifest JSON: {}", e)}))).into_response(),
    };

    if let Err((s, m)) = validate_manifest(&manifest) {
        return (s, Json(serde_json::json!({"detail": m}))).into_response();
    }

    let addon_id = manifest["id"].as_str().unwrap_or("").to_string();
    let addon_name = manifest["name"].as_str().map(|s| s.to_string());
    let addon_version = manifest["version"].as_str().map(|s| s.to_string());
    let manifest_json = manifest.to_string();

    let conn = state.conn.lock().await;
    match aurora_core::db::queries::insert_addon(&conn, &addon_id, &base_url, addon_name.as_deref(), addon_version.as_deref(), &manifest_json) {
        Ok(_) => {
            let now = aurora_core::db::queries::chrono_now();
            envelope::ok(
                serde_json::json!({
                    "id": addon_id,
                    "base_url": base_url,
                    "name": addon_name,
                    "version": addon_version,
                    "enabled": true,
                    "fail_count": 0,
                    "last_ok_at": now,
                }),
                "ok",
            ).into_response()
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("UNIQUE constraint") {
                envelope::conflict("Addon already registered").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// GET /api/addons — list all addons.
pub async fn list_addons(State(state): State<Arc<AppState>>) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::list_addons(&conn) {
        Ok(addons) => envelope::ok(Value::Array(addons), "ok").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// PATCH /api/addons/{addon_id} — toggle enabled.
pub async fn toggle_addon(
    State(state): State<Arc<AppState>>,
    Path(addon_id): Path<String>,
    Json(body): Json<AddonToggle>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::toggle_addon(&conn, &addon_id, body.enabled) {
        Ok(true) => Json(serde_json::json!({"message": "ok"})).into_response(),
        Ok(false) => envelope::not_found("Addon not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

/// DELETE /api/addons/{addon_id} — remove addon.
pub async fn delete_addon(
    State(state): State<Arc<AppState>>,
    Path(addon_id): Path<String>,
) -> Response {
    let conn = state.conn.lock().await;
    match aurora_core::db::queries::delete_addon(&conn, &addon_id) {
        Ok(true) => Json(serde_json::json!({"message": "ok"})).into_response(),
        Ok(false) => envelope::not_found("Addon not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    }
}

// ── Proxy Handlers ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SearchParams {
    pub q: String,
    pub limit: Option<u32>,
}

/// GET /api/addons/{addon_id}/search — search an addon.
pub async fn addon_search(
    State(state): State<Arc<AppState>>,
    Path(addon_id): Path<String>,
    Query(params): Query<SearchParams>,
) -> Response {
    let conn = state.conn.lock().await;
    let (_addon, base_url, manifest) = match get_addon_checked(&conn, &addon_id) {
        Ok(v) => v,
        Err(resp) => return resp,
    };
    drop(conn);

    let limit = params.limit.unwrap_or(20);
    let q = params.q.clone();
    let query_params = [("q", q.as_str()), ("limit", &limit.to_string())];

    let raw = match proxy_request(&state, &addon_id, &base_url, &manifest, "/search", Some(&query_params)).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    Json(normalize_search_response(&raw, &addon_id)).into_response()
}

/// GET /api/addons/{addon_id}/stream/{external_id} — resolve stream URL.
pub async fn addon_stream(
    State(state): State<Arc<AppState>>,
    Path((addon_id, external_id)): Path<(String, String)>,
) -> Response {
    let conn = state.conn.lock().await;
    let (_addon, base_url, manifest) = match get_addon_checked(&conn, &addon_id) {
        Ok(v) => v,
        Err(resp) => return resp,
    };
    drop(conn);

    let path = format!("/stream/{}", external_id);
    let raw = match proxy_request(&state, &addon_id, &base_url, &manifest, &path, None).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    Json(normalize_stream_response(&raw, &addon_id)).into_response()
}

#[derive(Deserialize)]
pub struct LyricsParams {
    pub artist: String,
    pub title: String,
}

/// GET /api/addons/{addon_id}/lyrics — fetch lyrics.
pub async fn addon_lyrics(
    State(state): State<Arc<AppState>>,
    Path(addon_id): Path<String>,
    Query(params): Query<LyricsParams>,
) -> Response {
    let conn = state.conn.lock().await;
    let (_addon, base_url, manifest) = match get_addon_checked(&conn, &addon_id) {
        Ok(v) => v,
        Err(resp) => return resp,
    };
    drop(conn);

    let query_params = [("artist", params.artist.as_str()), ("title", params.title.as_str())];
    let raw = match proxy_request(&state, &addon_id, &base_url, &manifest, "/lyrics", Some(&query_params)).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    Json(normalize_lyrics_response(&raw, &addon_id)).into_response()
}

// ── Save-as-Song + Stream Resolution ──────────────────────────────────

/// POST /api/addons/{addon_id}/save — save an addon track as a song.
pub async fn save_addon_track(
    State(state): State<Arc<AppState>>,
    Path(addon_id): Path<String>,
    Json(body): Json<AddonSaveTrack>,
) -> Response {
    let conn = state.conn.lock().await;
    let (_addon, base_url, manifest) = match get_addon_checked(&conn, &addon_id) {
        Ok(v) => v,
        Err(resp) => return resp,
    };
    drop(conn);

    let ttl = get_stream_ttl(&manifest);

    let (stream_url, stream_url_expires_at) = if let Some(url) = body.stream_url {
        let exp = chrono::Utc::now() + chrono::Duration::seconds(ttl);
        (url, exp.format("%Y-%m-%dT%H:%M:%S%.3f+00:00").to_string())
    } else {
        let path = format!("/stream/{}", body.external_id);
        let raw = match proxy_request(&state, &addon_id, &base_url, &manifest, &path, None).await {
            Ok(v) => v,
            Err(resp) => return resp,
        };
        let url = raw["url"].as_str().unwrap_or("").to_string();
        if url.is_empty() {
            return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"detail": "Addon did not return a stream URL"}))).into_response();
        }
        let exp = chrono::Utc::now() + chrono::Duration::seconds(ttl);
        (url, exp.format("%Y-%m-%dT%H:%M:%S%.3f+00:00").to_string())
    };

    let conn = state.conn.lock().await;
    match aurora_core::db::queries::save_addon_track(
        &conn, &addon_id, &body.title, &body.artist,
        body.album.as_deref(), body.duration, &body.external_id,
        &stream_url, Some(&stream_url_expires_at), body.artwork_url.as_deref(),
    ) {
        Ok(song_id) => match aurora_core::db::queries::get_song(&conn, song_id) {
            Ok(Some(song)) => envelope::ok(song, "ok").into_response(),
            Ok(None) => envelope::not_found("Song not found after save").into_response(),
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
        },
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate") {
                envelope::conflict("Track already saved").into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": msg}))).into_response()
            }
        }
    }
}

/// GET /api/songs/{song_id}/resolve — resolve playback URL.
pub async fn resolve_stream(
    State(state): State<Arc<AppState>>,
    Path(song_id): Path<i64>,
) -> Response {
    let conn = state.conn.lock().await;
    let info = match aurora_core::db::queries::get_song_resolve_info(&conn, song_id) {
        Ok(Some(info)) => info,
        Ok(None) => return envelope::not_found("Song not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"detail": e.to_string()}))).into_response(),
    };

    let (file_path, stream_url, stream_url_expires_at, source, external_id) = info;

    // 1. Local file
    if let Some(ref path) = file_path {
        return Json(serde_json::json!({
            "data": {"type": "local", "url": path},
            "message": "ok",
        })).into_response();
    }

    // 2. Fresh stream URL
    if let (Some(url), Some(expires)) = (&stream_url, &stream_url_expires_at) {
        if let Ok(exp) = chrono::DateTime::parse_from_rfc3339(expires) {
            if exp > chrono::Utc::now() {
                return Json(serde_json::json!({
                    "data": {"type": "stream", "url": url, "expires_at": expires},
                    "message": "ok",
                })).into_response();
            }
        }
    }

    // 3. Re-resolve via addon
    if !source.starts_with("addon:") {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "Song has no stream URL and is not from an addon"}))).into_response();
    }

    let addon_id = source.strip_prefix("addon:").unwrap_or("");
    let ext_id = match external_id {
        Some(ref id) => id.clone(),
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"detail": "Song has no external_id for re-resolution"}))).into_response(),
    };

    let (_addon, base_url, manifest) = match get_addon_checked(&conn, addon_id) {
        Ok(v) => v,
        Err(resp) => return resp,
    };
    drop(conn);

    let path = format!("/stream/{}", ext_id);
    let raw = match proxy_request(&state, addon_id, &base_url, &manifest, &path, None).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    let new_url = raw["url"].as_str().unwrap_or("");
    if new_url.is_empty() {
        return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"detail": "Addon did not return a stream URL"}))).into_response();
    }

    let ttl = get_stream_ttl(&manifest);
    let new_expires = (chrono::Utc::now() + chrono::Duration::seconds(ttl))
        .format("%Y-%m-%dT%H:%M:%S%.3f+00:00")
        .to_string();

    let conn = state.conn.lock().await;
    let _ = aurora_core::db::queries::update_song_stream_url(&conn, song_id, new_url, &new_expires);

    Json(serde_json::json!({
        "data": {"type": "stream", "url": new_url, "expires_at": new_expires, "re-resolved": true},
        "message": "ok",
    })).into_response()
}
