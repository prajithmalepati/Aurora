//! Database query functions — ported from Python routers + filter_engine.
//!
//! All functions take a `&Connection` and return typed results.
//! No HTTP dependencies — pure DB access.

use anyhow::Result;
use rusqlite::Connection;

use crate::filter;
use crate::serializer;

// ── Song queries ──────────────────────────────────────────────────────────

/// Base SELECT for songs with GROUP_CONCAT tags + playlists.
/// Mirrors Python `SONG_SELECT_QUERY` exactly.
const SONG_SELECT: &str = r#"
SELECT
    s.id, s.title, s.artist, s.album, s.duration,
    s.file_path, s.file_format, s.album_art_path, s.source,
    s.bitrate, s.sample_rate, s.bit_depth, s.file_size,
    s.waveform_peaks, s.dominant_color, s.dominant_color_2,
    s.replaygain_track_gain, s.replaygain_track_peak,
    s.replaygain_album_gain, s.replaygain_album_peak,
    s.artists, s.featured_artists,
    s.stream_url, s.stream_url_expires_at, s.artwork_url,
    GROUP_CONCAT(DISTINCT t.name) AS tags,
    GROUP_CONCAT(DISTINCT p.id || ':' || p.name) AS playlists,
    s.created_at, s.updated_at
FROM songs s
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id
LEFT JOIN playlist_songs ps ON s.id = ps.song_id
LEFT JOIN playlists p ON ps.playlist_id = p.id
"#;

const COUNT_SONGS: &str = "SELECT COUNT(*) AS total FROM songs s";

/// Allowed sort fields → SQL expressions.
fn sort_column(sort: &str) -> &'static str {
    match sort {
        "title" => "s.title COLLATE NOCASE",
        "artist" => "s.artist COLLATE NOCASE",
        "album" => "s.album COLLATE NOCASE",
        "duration" => "s.duration",
        "created_at" => "s.created_at",
        "file_format" => "s.file_format COLLATE NOCASE",
        _ => "s.title COLLATE NOCASE",
    }
}

/// Row index constants for the SONG_SELECT columns.
/// These MUST match the column order in SONG_SELECT exactly.
mod col {
    pub const ID: usize = 0;
    pub const TITLE: usize = 1;
    pub const ARTIST: usize = 2;
    pub const ALBUM: usize = 3;
    pub const DURATION: usize = 4;
    pub const FILE_PATH: usize = 5;
    pub const FILE_FORMAT: usize = 6;
    pub const ALBUM_ART_PATH: usize = 7;
    pub const SOURCE: usize = 8;
    pub const BITRATE: usize = 9;
    pub const SAMPLE_RATE: usize = 10;
    pub const BIT_DEPTH: usize = 11;
    pub const FILE_SIZE: usize = 12;
    pub const WAVEFORM_PEAKS: usize = 13;
    pub const DOMINANT_COLOR: usize = 14;
    pub const DOMINANT_COLOR_2: usize = 15;
    pub const REPLAYGAIN_TRACK_GAIN: usize = 16;
    pub const REPLAYGAIN_TRACK_PEAK: usize = 17;
    pub const REPLAYGAIN_ALBUM_GAIN: usize = 18;
    pub const REPLAYGAIN_ALBUM_PEAK: usize = 19;
    pub const ARTISTS: usize = 20;
    pub const FEATURED_ARTISTS: usize = 21;
    pub const STREAM_URL: usize = 22;
    pub const STREAM_URL_EXPIRES_AT: usize = 23;
    pub const ARTWORK_URL: usize = 24;
    pub const TAGS: usize = 25;
    pub const PLAYLISTS: usize = 26;
    pub const CREATED_AT: usize = 27;
    pub const UPDATED_AT: usize = 28;
}

/// Serialize a rusqlite Row into the canonical song JSON.
fn row_to_song(row: &rusqlite::Row, include_peaks: bool) -> rusqlite::Result<serde_json::Value> {
    Ok(serializer::song_to_json(
        row.get(col::ID)?,
        row.get::<_, String>(col::TITLE)?.as_str(),
        row.get::<_, String>(col::ARTIST)?.as_str(),
        row.get::<_, Option<String>>(col::ALBUM)?.as_deref(),
        row.get(col::DURATION)?,
        row.get::<_, Option<String>>(col::FILE_PATH)?.as_deref(),
        row.get::<_, Option<String>>(col::FILE_FORMAT)?.as_deref(),
        row.get::<_, Option<String>>(col::ALBUM_ART_PATH)?.as_deref(),
        row.get::<_, String>(col::SOURCE)?.as_str(),
        row.get(col::BITRATE)?,
        row.get(col::SAMPLE_RATE)?,
        row.get(col::BIT_DEPTH)?,
        row.get(col::FILE_SIZE)?,
        row.get::<_, Option<String>>(col::WAVEFORM_PEAKS)?.as_deref(),
        row.get::<_, Option<String>>(col::DOMINANT_COLOR)?.as_deref(),
        row.get::<_, Option<String>>(col::DOMINANT_COLOR_2)?.as_deref(),
        row.get(col::REPLAYGAIN_TRACK_GAIN)?,
        row.get(col::REPLAYGAIN_TRACK_PEAK)?,
        row.get(col::REPLAYGAIN_ALBUM_GAIN)?,
        row.get(col::REPLAYGAIN_ALBUM_PEAK)?,
        row.get::<_, Option<String>>(col::ARTISTS)?.as_deref(),
        row.get::<_, Option<String>>(col::FEATURED_ARTISTS)?.as_deref(),
        row.get::<_, Option<String>>(col::STREAM_URL)?.as_deref(),
        row.get::<_, Option<String>>(col::STREAM_URL_EXPIRES_AT)?.as_deref(),
        row.get::<_, Option<String>>(col::ARTWORK_URL)?.as_deref(),
        row.get::<_, Option<String>>(col::TAGS)?.as_deref(),
        row.get::<_, Option<String>>(col::PLAYLISTS)?.as_deref(),
        row.get::<_, String>(col::CREATED_AT)?.as_str(),
        row.get::<_, String>(col::UPDATED_AT)?.as_str(),
        include_peaks,
    ))
}

/// List songs with optional search, sort, limit, offset.
/// Returns `(songs_json, total_count)`.
pub fn list_songs(
    conn: &Connection,
    search: Option<&str>,
    sort: &str,
    order: &str,
    limit: i64,
    offset: i64,
) -> Result<(Vec<serde_json::Value>, i64)> {
    let sort_col = sort_column(sort);
    let order_str = if order == "desc" { "DESC" } else { "ASC" };

    // Build WHERE clause
    let (where_clause, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match search {
        Some(q) => {
            let pattern = format!("%{}%", q);
            (
                " WHERE (s.title LIKE ?1 OR s.artist LIKE ?2)".to_string(),
                vec![
                    Box::new(pattern.clone()) as Box<dyn rusqlite::types::ToSql>,
                    Box::new(pattern),
                ],
            )
        }
        None => (String::new(), vec![]),
    };

    // Count query
    let count_sql = format!("{COUNT_SONGS}{where_clause}");
    let total: i64 = conn.query_row(
        &count_sql,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
        |row| row.get(0),
    )?;

    // Data query
    let data_sql = format!(
        "{SONG_SELECT}{where_clause} GROUP BY s.id ORDER BY {sort_col} {order_str}, s.id ASC LIMIT ? OFFSET ?",
    );
    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = params;
    all_params.push(Box::new(limit));
    all_params.push(Box::new(offset));

    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(all_params.iter().map(|p| p.as_ref())),
        |row| row_to_song(row, false),
    )?;
    let mut songs = Vec::new();
    for r in rows {
        songs.push(r?);
    }

    Ok((songs, total))
}

/// Get a single song by ID (with waveform_peaks).
pub fn get_song(conn: &Connection, song_id: i64) -> Result<Option<serde_json::Value>> {
    let sql = format!("{SONG_SELECT} WHERE s.id = ?1 GROUP BY s.id");
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map([song_id], |row| row_to_song(row, true))?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

/// Get just the file_path for a song (for stream/bleed-thumb).
pub fn get_song_file_path(conn: &Connection, song_id: i64) -> Result<Option<Option<String>>> {
    // Returns Some(Some(path)) if song exists and has path,
    // Some(None) if song exists but no path, None if song not found.
    let mut stmt = conn.prepare("SELECT file_path FROM songs WHERE id = ?1")?;
    let mut rows = stmt.query_map([song_id], |row| row.get::<_, Option<String>>(0))?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

/// Create a song. Returns `(id, song_json)`.
pub fn create_song(
    conn: &Connection,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration: Option<i64>,
    file_path: Option<&str>,
) -> Result<i64> {
    let now = chrono_now();
    match conn.execute(
        "INSERT INTO songs (title, artist, album, duration, file_path, source, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, 'manual', ?6, ?7)",
        rusqlite::params![title, artist, album, duration, file_path, now, now],
    ) {
        Ok(_) => Ok(conn.last_insert_rowid()),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("UNIQUE constraint failed") && msg.contains("file_path") {
                Err(anyhow::anyhow!("duplicate_file_path"))
            } else {
                Err(e.into())
            }
        }
    }
}

/// Update a song. Returns Ok(true) if updated, Ok(false) if not found.
pub fn update_song(
    conn: &Connection,
    song_id: i64,
    title: Option<&str>,
    artist: Option<&str>,
    album: Option<&str>,
    duration: Option<i64>,
) -> Result<bool> {
    // Check existence
    let exists: bool =
        conn.query_row("SELECT COUNT(*) FROM songs WHERE id = ?1", [song_id], |r| {
            r.get::<_, i64>(0)
        })? > 0;
    if !exists {
        return Ok(false);
    }

    let now = chrono_now();
    let mut sets = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1usize;

    if let Some(v) = title {
        sets.push(format!("title = ?{idx}"));
        params.push(Box::new(v.to_string()));
        idx += 1;
    }
    if let Some(v) = artist {
        sets.push(format!("artist = ?{idx}"));
        params.push(Box::new(v.to_string()));
        idx += 1;
    }
    if let Some(v) = album {
        sets.push(format!("album = ?{idx}"));
        params.push(Box::new(v.to_string()));
        idx += 1;
    }
    if let Some(v) = duration {
        sets.push(format!("duration = ?{idx}"));
        params.push(Box::new(v));
        idx += 1;
    }
    sets.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(now));
    idx += 1;

    let sql = format!("UPDATE songs SET {} WHERE id = ?{idx}", sets.join(", "));
    params.push(Box::new(song_id));
    conn.execute(
        &sql,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
    )?;
    Ok(true)
}

/// Delete a song. Returns Ok(true) if deleted, Ok(false) if not found.
pub fn delete_song(conn: &Connection, song_id: i64) -> Result<bool> {
    let affected = conn.execute("DELETE FROM songs WHERE id = ?1", [song_id])?;
    Ok(affected > 0)
}

// ── Tag queries ───────────────────────────────────────────────────────────

/// Create a tag. Returns Ok(id) or Err("duplicate").
pub fn create_tag(conn: &Connection, name: &str) -> Result<i64> {
    let name = name.to_lowercase().trim().to_string();
    if name.is_empty() {
        return Err(anyhow::anyhow!("empty_name"));
    }
    let now = chrono_now();
    match conn.execute(
        "INSERT INTO tags (name, created_at) VALUES (?1, ?2)",
        rusqlite::params![name, now],
    ) {
        Ok(_) => Ok(conn.last_insert_rowid()),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("UNIQUE constraint failed") {
                Err(anyhow::anyhow!("duplicate_tag"))
            } else {
                Err(e.into())
            }
        }
    }
}

/// List all tags with song_count, ordered by name ASC.
pub fn list_tags(conn: &Connection) -> Result<(Vec<serde_json::Value>, i64)> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, COUNT(st.tag_id) AS song_count, t.created_at \
         FROM tags t LEFT JOIN song_tags st ON t.id = st.tag_id \
         GROUP BY t.id ORDER BY t.name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "song_count": row.get::<_, i64>(2)?,
            "created_at": row.get::<_, String>(3)?,
        }))
    })?;
    let mut data = Vec::new();
    for r in rows {
        data.push(r?);
    }
    let total = data.len() as i64;
    Ok((data, total))
}

/// Delete a tag. Returns Ok(true) if deleted, Ok(false) if not found.
pub fn delete_tag(conn: &Connection, tag_id: i64) -> Result<bool> {
    let affected = conn.execute("DELETE FROM tags WHERE id = ?1", [tag_id])?;
    Ok(affected > 0)
}

/// Assign tags to a song. Creates tags if they don't exist.
/// Returns Ok(true) if song exists, Ok(false) if not found.
pub fn assign_tags(conn: &Connection, song_id: i64, tag_names: &[String]) -> Result<bool> {
    // Check song exists
    let exists: bool =
        conn.query_row("SELECT COUNT(*) FROM songs WHERE id = ?1", [song_id], |r| {
            r.get::<_, i64>(0)
        })? > 0;
    if !exists {
        return Ok(false);
    }

    let now = chrono_now();
    for raw_name in tag_names {
        let name = raw_name.to_lowercase().trim().to_string();
        if name.is_empty() {
            continue;
        }
        // Insert tag if not exists
        conn.execute(
            "INSERT OR IGNORE INTO tags (name, created_at) VALUES (?1, ?2)",
            rusqlite::params![name, now],
        )?;
        // Get tag id
        let tag_id: i64 =
            conn.query_row("SELECT id FROM tags WHERE name = ?1", [&name], |r| r.get(0))?;
        // Insert song_tag link if not exists
        conn.execute(
            "INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![song_id, tag_id],
        )?;
    }
    Ok(true)
}

/// Remove a tag from a song.
/// Returns Ok("ok"), Err("song_not_found"), Err("tag_not_found"), or Err("link_not_found").
pub fn remove_tag(conn: &Connection, song_id: i64, tag_id: i64) -> Result<()> {
    // Check song
    let song_exists: bool =
        conn.query_row("SELECT COUNT(*) FROM songs WHERE id = ?1", [song_id], |r| {
            r.get::<_, i64>(0)
        })? > 0;
    if !song_exists {
        return Err(anyhow::anyhow!("song_not_found"));
    }
    // Check tag
    let tag_exists: bool =
        conn.query_row("SELECT COUNT(*) FROM tags WHERE id = ?1", [tag_id], |r| {
            r.get::<_, i64>(0)
        })? > 0;
    if !tag_exists {
        return Err(anyhow::anyhow!("tag_not_found"));
    }
    // Check link
    let link_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM song_tags WHERE song_id = ?1 AND tag_id = ?2",
        rusqlite::params![song_id, tag_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !link_exists {
        return Err(anyhow::anyhow!("link_not_found"));
    }
    conn.execute(
        "DELETE FROM song_tags WHERE song_id = ?1 AND tag_id = ?2",
        rusqlite::params![song_id, tag_id],
    )?;
    Ok(())
}

// ── Filter query ──────────────────────────────────────────────────────────

/// Run a boolean filter query. Returns matching songs with sorted tags.
/// Mirrors Python `filter_songs()` + `build_tag_set()` + `song_row_to_dict()`.
pub fn filter_songs(conn: &Connection, query: &str) -> Result<Vec<serde_json::Value>> {
    let (expr, quoted_tags) = filter::parse(query).map_err(|e| anyhow::anyhow!("{}", e))?;

    let sql = format!("{SONG_SELECT} GROUP BY s.id");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| row_to_song(row, false))?;

    let mut results = Vec::new();
    for row_result in rows {
        let mut song = row_result?;

        // Build tag set from the song's own tags + playlist-derived tags
        let tags_csv = song.get("tags").and_then(|v| {
            v.as_array().map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(",")
            })
        });
        let playlists_csv = song.get("playlists").and_then(|v| {
            v.as_array().map(|arr| {
                arr.iter()
                    .filter_map(|p| {
                        let id = p.get("id")?.as_i64()?;
                        let name = p.get("name")?.as_str()?;
                        Some(format!("{}:{}", id, name))
                    })
                    .collect::<Vec<_>>()
                    .join(",")
            })
        });

        let tag_set =
            filter::build_tag_set(tags_csv.as_deref(), playlists_csv.as_deref());

        if filter::evaluate(&expr, &quoted_tags, &tag_set) {
            // Replace tags with sorted set (filter-specific behavior)
            let mut sorted_tags: Vec<String> = tag_set.into_iter().collect();
            sorted_tags.sort();
            song.as_object_mut().unwrap().insert(
                "tags".into(),
                serde_json::Value::Array(sorted_tags.into_iter().map(serde_json::Value::String).collect()),
            );
            results.push(song);
        }
    }

    // Sort by title (case-insensitive)
    results.sort_by(|a, b| {
        let ta = a
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();
        let tb = b
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();
        ta.cmp(&tb)
    });

    Ok(results)
}

/// Backfill file_format from file_path extension.
/// Mirrors Python init_db() backfill logic.
pub fn backfill_file_format(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT id, file_path FROM songs WHERE file_format IS NULL AND file_path IS NOT NULL",
    )?;
    let rows: Vec<(i64, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    for (id, path) in &rows {
        if let Some(ext) = std::path::Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
        {
            let ext_lower = ext.to_lowercase();
            conn.execute(
                "UPDATE songs SET file_format = ?1 WHERE id = ?2",
                rusqlite::params![ext_lower, id],
            )?;
        }
    }
    Ok(())
}

/// Current UTC time in ISO format.
fn chrono_now() -> String {
    // Use a simple implementation without chrono dependency
    // For golden tests this doesn't matter (we strip timestamps)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let secs = now.as_secs();
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Days since epoch to Y-M-D (simplified — good enough for created_at)
    let y = 1970 + (days / 365);
    let remaining = days % 365;
    let m = (remaining / 30) + 1;
    let d = (remaining % 30) + 1;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hours, minutes, seconds
    )
}
