//! Canonical song serializer — ported from backend/app/serializers.py.
//!
//! Every endpoint that returns song data uses these functions.
//! No HTTP dependencies — pure data transformation.

use serde_json::Value;

/// Parse a comma-separated tag string into a deduplicated, ordered list.
///
/// Preserves first-occurrence order (same as Python `dict.fromkeys`).
pub fn parse_tags(tags_str: Option<&str>) -> Vec<String> {
    let csv = match tags_str {
        Some(s) => s,
        None => return Vec::new(),
    };
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    for name in csv.split(',') {
        let trimmed = name.trim().to_string();
        if !trimmed.is_empty() && seen.insert(trimmed.clone()) {
            result.push(trimmed);
        }
    }
    result
}

/// Parse a GROUP_CONCAT playlist string (`id:name,...`) into `[{id, name}]`.
///
/// Preserves first-occurrence order, deduplicates by playlist id.
pub fn parse_playlist_refs(playlists_str: Option<&str>) -> Vec<Value> {
    let csv = match playlists_str {
        Some(s) => s,
        None => return Vec::new(),
    };
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    for item in csv.split(',') {
        if let Some((id_part, name_part)) = item.split_once(':') {
            #[allow(clippy::collapsible_if)]
            if let Ok(pid) = id_part.trim().parse::<i64>() {
                if seen.insert(pid) {
                    result.push(serde_json::json!({
                        "id": pid,
                        "name": name_part.trim()
                    }));
                }
            }
        }
    }
    result
}

/// Safely parse a JSON string, returning None on failure.
fn safe_json_loads(raw: Option<&str>) -> Option<Value> {
    let s = raw?;
    if s.is_empty() {
        return None;
    }
    serde_json::from_str(s).ok()
}

/// Serialize a song row into the canonical response shape.
///
/// All ~35 fields are always present (nulls for missing values).
/// `include_peaks`: true for single-song GET (has waveform_peaks),
///                  false for list/filter endpoints (no waveform_peaks).
///
/// # Parameters
/// All values come directly from SQLite row columns.
#[allow(clippy::too_many_arguments)]
pub fn song_to_json(
    id: i64,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration: Option<i64>,
    file_path: Option<&str>,
    file_format: Option<&str>,
    album_art_path: Option<&str>,
    source: &str,
    bitrate: Option<i64>,
    sample_rate: Option<i64>,
    bit_depth: Option<i64>,
    file_size: Option<i64>,
    waveform_peaks: Option<&str>,
    dominant_color: Option<&str>,
    dominant_color_2: Option<&str>,
    replaygain_track_gain: Option<f64>,
    replaygain_track_peak: Option<f64>,
    replaygain_album_gain: Option<f64>,
    replaygain_album_peak: Option<f64>,
    artists: Option<&str>,
    featured_artists: Option<&str>,
    stream_url: Option<&str>,
    stream_url_expires_at: Option<&str>,
    artwork_url: Option<&str>,
    tags_csv: Option<&str>,
    playlists_csv: Option<&str>,
    created_at: &str,
    updated_at: &str,
    include_peaks: bool,
) -> Value {
    let mut map = serde_json::Map::new();

    map.insert("id".into(), Value::Number(id.into()));
    map.insert("title".into(), Value::String(title.to_string()));
    map.insert("artist".into(), Value::String(artist.to_string()));
    map.insert("album".into(), json_opt_str(album));
    map.insert("artists".into(), safe_json_loads(artists).unwrap_or(Value::Null));
    map.insert("featured_artists".into(), safe_json_loads(featured_artists).unwrap_or(Value::Null));
    map.insert("duration".into(), json_opt_i64(duration));
    map.insert("file_path".into(), json_opt_str(file_path));
    map.insert("file_format".into(), json_opt_str(file_format));
    map.insert("album_art_path".into(), json_opt_str(album_art_path));
    map.insert("source".into(), Value::String(source.to_string()));
    map.insert("tags".into(), Value::Array(parse_tags(tags_csv).into_iter().map(Value::String).collect()));
    map.insert("playlists".into(), Value::Array(parse_playlist_refs(playlists_csv)));
    map.insert("created_at".into(), Value::String(created_at.to_string()));
    map.insert("updated_at".into(), Value::String(updated_at.to_string()));
    map.insert("start_time_ms".into(), Value::Number(0.into()));
    map.insert("end_time_ms".into(), Value::Number(0.into()));
    map.insert("position".into(), Value::Null);
    map.insert("bitrate".into(), json_opt_i64(bitrate));
    map.insert("sample_rate".into(), json_opt_i64(sample_rate));
    map.insert("bit_depth".into(), json_opt_i64(bit_depth));
    map.insert("file_size".into(), json_opt_i64(file_size));
    map.insert("dominant_color".into(), json_opt_str(dominant_color));
    map.insert("dominant_color_2".into(), json_opt_str(dominant_color_2));
    map.insert("replaygain_track_gain".into(), json_opt_f64(replaygain_track_gain));
    map.insert("replaygain_track_peak".into(), json_opt_f64(replaygain_track_peak));
    map.insert("replaygain_album_gain".into(), json_opt_f64(replaygain_album_gain));
    map.insert("replaygain_album_peak".into(), json_opt_f64(replaygain_album_peak));
    map.insert("stream_url".into(), json_opt_str(stream_url));
    map.insert("stream_url_expires_at".into(), json_opt_str(stream_url_expires_at));
    map.insert("artwork_url".into(), json_opt_str(artwork_url));

    if include_peaks {
        map.insert("waveform_peaks".into(), safe_json_loads(waveform_peaks).unwrap_or(Value::Null));
    }

    Value::Object(map)
}

fn json_opt_str(v: Option<&str>) -> Value {
    match v {
        Some(s) => Value::String(s.to_string()),
        None => Value::Null,
    }
}

fn json_opt_i64(v: Option<i64>) -> Value {
    match v {
        Some(n) => Value::Number(n.into()),
        None => Value::Null,
    }
}

fn json_opt_f64(v: Option<f64>) -> Value {
    match v {
        Some(n) => serde_json::json!(n),
        None => Value::Null,
    }
}
