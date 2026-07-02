//! Database query functions — ported from Python routers + filter_engine.
//!
//! All functions take a `&Connection` and return typed results.
//! No HTTP dependencies — pure DB access.

use anyhow::Result;
use rusqlite::Connection;
use rusqlite::OptionalExtension;

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

// ── Playlist queries ────────────────────────────────────────────────────

/// Row constants for PLAYLIST_SONG_SELECT columns.
/// Must match the column order exactly.
#[allow(dead_code)]
mod pl_col {
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
    pub const START_TIME_MS: usize = 26;
    pub const END_TIME_MS: usize = 27;
    pub const POSITION: usize = 28;
}

/// SELECT for songs within a playlist context.
/// Uses JOIN (not LEFT JOIN) for playlist_songs, no playlist aggregation.
const PLAYLIST_SONG_SELECT: &str = r#"
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
    ps.start_time_ms, ps.end_time_ms, ps.position
FROM songs s
JOIN playlist_songs ps ON s.id = ps.song_id
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id
"#;

/// Serialize a playlist_songs JOIN row into the song-in-playlist JSON.
fn row_to_playlist_song(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
    Ok(serializer::song_to_playlist_json(
        row.get(pl_col::ID)?,
        row.get::<_, String>(pl_col::TITLE)?.as_str(),
        row.get::<_, String>(pl_col::ARTIST)?.as_str(),
        row.get::<_, Option<String>>(pl_col::ALBUM)?.as_deref(),
        row.get(pl_col::DURATION)?,
        row.get::<_, Option<String>>(pl_col::FILE_PATH)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::FILE_FORMAT)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::ALBUM_ART_PATH)?.as_deref(),
        row.get::<_, String>(pl_col::SOURCE)?.as_str(),
        row.get(pl_col::BITRATE)?,
        row.get(pl_col::SAMPLE_RATE)?,
        row.get(pl_col::BIT_DEPTH)?,
        row.get(pl_col::FILE_SIZE)?,
        row.get::<_, Option<String>>(pl_col::DOMINANT_COLOR)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::DOMINANT_COLOR_2)?.as_deref(),
        row.get(pl_col::REPLAYGAIN_TRACK_GAIN)?,
        row.get(pl_col::REPLAYGAIN_TRACK_PEAK)?,
        row.get(pl_col::REPLAYGAIN_ALBUM_GAIN)?,
        row.get(pl_col::REPLAYGAIN_ALBUM_PEAK)?,
        row.get::<_, Option<String>>(pl_col::ARTISTS)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::FEATURED_ARTISTS)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::STREAM_URL)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::STREAM_URL_EXPIRES_AT)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::ARTWORK_URL)?.as_deref(),
        row.get::<_, Option<String>>(pl_col::TAGS)?.as_deref(),
        row.get(pl_col::START_TIME_MS)?,
        row.get(pl_col::END_TIME_MS)?,
        row.get(pl_col::POSITION)?,
    ))
}

/// List all playlists with song_count, ordered by name ASC.
pub fn list_playlists(conn: &Connection) -> Result<Vec<serde_json::Value>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.color, p.emoji, p.image_url, \
         p.crossfade_enabled, p.crossfade_duration_s, \
         COUNT(ps.song_id) AS song_count, \
         p.dominant_color, p.dominant_color_2, p.created_at, p.updated_at \
         FROM playlists p LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id \
         GROUP BY p.id ORDER BY p.name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(serializer::playlist_to_json(
            row.get(0)?,
            &row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?.as_deref(),
            row.get::<_, Option<String>>(3)?.as_deref(),
            row.get::<_, Option<String>>(4)?.as_deref(),
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
            row.get::<_, Option<String>>(8)?.as_deref(),
            row.get::<_, Option<String>>(9)?.as_deref(),
            &row.get::<_, String>(10)?,
            &row.get::<_, String>(11)?,
        ))
    })?;
    let mut data = Vec::new();
    for r in rows {
        data.push(r?);
    }
    Ok(data)
}

/// Get a single playlist with its songs ordered by position.
pub fn get_playlist(conn: &Connection, playlist_id: i64) -> Result<Option<serde_json::Value>> {
    // Fetch playlist metadata
    let meta = conn.query_row(
        "SELECT id, name, color, emoji, image_url, \
         crossfade_enabled, crossfade_duration_s, \
         dominant_color, dominant_color_2, created_at, updated_at \
         FROM playlists WHERE id = ?1",
        [playlist_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<i64>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, String>(10)?,
            ))
        },
    );
    let (id, name, color, emoji, image_url, ce, cd, dc, dc2, created_at, updated_at) = match meta {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e.into()),
    };

    // Fetch songs
    let sql = format!("{PLAYLIST_SONG_SELECT} WHERE ps.playlist_id = ?1 GROUP BY s.id ORDER BY ps.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let song_rows = stmt.query_map([playlist_id], row_to_playlist_song)?;
    let mut songs = Vec::new();
    for r in song_rows {
        songs.push(r?);
    }
    let song_count = songs.len() as i64;

    // Build detail response
    let mut map = serde_json::Map::new();
    map.insert("id".into(), serde_json::json!(id));
    map.insert("name".into(), serde_json::json!(name));
    map.insert("color".into(), serde_json::json!(color));
    map.insert("emoji".into(), serde_json::json!(emoji));
    map.insert("image_url".into(), serde_json::json!(image_url));
    map.insert("crossfade_enabled".into(), serde_json::json!(ce));
    map.insert("crossfade_duration_s".into(), serde_json::json!(cd));
    map.insert("song_count".into(), serde_json::json!(song_count));
    map.insert("dominant_color".into(), serde_json::json!(dc));
    map.insert("dominant_color_2".into(), serde_json::json!(dc2));
    map.insert("songs".into(), serde_json::Value::Array(songs));
    map.insert("created_at".into(), serde_json::json!(created_at));
    map.insert("updated_at".into(), serde_json::json!(updated_at));
    Ok(Some(serde_json::Value::Object(map)))
}

/// Create a playlist. Returns Ok(id) or Err("duplicate_name").
pub fn create_playlist(
    conn: &Connection,
    name: &str,
    color: Option<&str>,
    emoji: Option<&str>,
) -> Result<i64> {
    let name = name.trim();
    if name.is_empty() {
        return Err(anyhow::anyhow!("empty_name"));
    }
    let now = chrono_now();
    match conn.execute(
        "INSERT INTO playlists (name, color, emoji, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![name, color, emoji, now, now],
    ) {
        Ok(_) => Ok(conn.last_insert_rowid()),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("UNIQUE constraint failed") {
                Err(anyhow::anyhow!("duplicate_name"))
            } else {
                Err(e.into())
            }
        }
    }
}

/// Update a playlist. Returns Ok(true) if updated, Ok(false) if not found.
#[allow(clippy::too_many_arguments)]
pub fn update_playlist(
    conn: &Connection,
    playlist_id: i64,
    name: Option<&str>,
    color: Option<&str>,
    emoji: Option<&str>,
    crossfade_enabled: Option<Option<i64>>,
    crossfade_duration_s: Option<Option<i64>>,
) -> Result<bool> {
    // Check existence
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM playlists WHERE id = ?1",
        [playlist_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !exists {
        return Ok(false);
    }

    let now = chrono_now();
    let mut sets = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1usize;

    if let Some(v) = name {
        sets.push(format!("name = ?{idx}"));
        params.push(Box::new(v.trim().to_string()));
        idx += 1;
    }
    if let Some(v) = color {
        sets.push(format!("color = ?{idx}"));
        params.push(Box::new(v.to_string()));
        idx += 1;
    }
    if let Some(v) = emoji {
        sets.push(format!("emoji = ?{idx}"));
        params.push(Box::new(if v.is_empty() { None::<String> } else { Some(v.to_string()) }));
        idx += 1;
    }
    if let Some(ce) = crossfade_enabled {
        sets.push(format!("crossfade_enabled = ?{idx}"));
        params.push(Box::new(ce));
        idx += 1;
    }
    if let Some(cd) = crossfade_duration_s {
        sets.push(format!("crossfade_duration_s = ?{idx}"));
        params.push(Box::new(cd));
        idx += 1;
    }
    sets.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(now));
    idx += 1;

    let sql = format!("UPDATE playlists SET {} WHERE id = ?{idx}", sets.join(", "));
    params.push(Box::new(playlist_id));
    conn.execute(
        &sql,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
    )?;
    Ok(true)
}

/// Delete a playlist. Returns Ok(true) if deleted, Ok(false) if not found.
pub fn delete_playlist(conn: &Connection, playlist_id: i64) -> Result<bool> {
    let affected = conn.execute("DELETE FROM playlists WHERE id = ?1", [playlist_id])?;
    Ok(affected > 0)
}

/// Add a song to a playlist.
/// Returns Ok(new_position), Err("playlist_not_found"), Err("song_not_found"), or Err("duplicate").
pub fn add_song_to_playlist(
    conn: &Connection,
    playlist_id: i64,
    song_id: i64,
) -> Result<i64> {
    // Check playlist exists
    let pl_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM playlists WHERE id = ?1",
        [playlist_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !pl_exists {
        return Err(anyhow::anyhow!("playlist_not_found"));
    }
    // Check song exists
    let song_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE id = ?1",
        [song_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !song_exists {
        return Err(anyhow::anyhow!("song_not_found"));
    }
    // Check not already in playlist
    let dup: bool = conn.query_row(
        "SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
        rusqlite::params![playlist_id, song_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if dup {
        return Err(anyhow::anyhow!("duplicate"));
    }
    // Get max position
    let max_pos: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position), -1) FROM playlist_songs WHERE playlist_id = ?1",
        [playlist_id],
        |r| r.get(0),
    )?;
    let new_pos = max_pos + 1;
    let now = chrono_now();
    conn.execute(
        "INSERT INTO playlist_songs (playlist_id, song_id, position, added_at, start_time_ms, end_time_ms) \
         VALUES (?1, ?2, ?3, ?4, 0, 0)",
        rusqlite::params![playlist_id, song_id, new_pos, now],
    )?;
    Ok(new_pos)
}

/// Remove a song from a playlist and recompact positions.
/// Returns Ok(()), Err("playlist_not_found"), Err("song_not_found"), or Err("not_in_playlist").
pub fn remove_song_from_playlist(
    conn: &Connection,
    playlist_id: i64,
    song_id: i64,
) -> Result<()> {
    // Check playlist
    let pl_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM playlists WHERE id = ?1",
        [playlist_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !pl_exists {
        return Err(anyhow::anyhow!("playlist_not_found"));
    }
    // Check song
    let song_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM songs WHERE id = ?1",
        [song_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !song_exists {
        return Err(anyhow::anyhow!("song_not_found"));
    }
    // Get position
    let position: Option<i64> = conn.query_row(
        "SELECT position FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
        rusqlite::params![playlist_id, song_id],
        |r| r.get(0),
    )
    .optional()?
    .flatten();
    let position = match position {
        Some(p) => p,
        None => return Err(anyhow::anyhow!("not_in_playlist")),
    };
    // Delete + recompact
    conn.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
        rusqlite::params![playlist_id, song_id],
    )?;
    conn.execute(
        "UPDATE playlist_songs SET position = position - 1 WHERE playlist_id = ?1 AND position > ?2",
        rusqlite::params![playlist_id, position],
    )?;
    Ok(())
}

/// Reorder songs in a playlist.
/// Returns Ok(()), Err("playlist_not_found"), or Err("id_mismatch").
pub fn reorder_playlist_songs(
    conn: &Connection,
    playlist_id: i64,
    song_ids: &[i64],
) -> Result<()> {
    // Check playlist
    let pl_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM playlists WHERE id = ?1",
        [playlist_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !pl_exists {
        return Err(anyhow::anyhow!("playlist_not_found"));
    }
    // Get current song ids
    let mut stmt = conn.prepare(
        "SELECT song_id FROM playlist_songs WHERE playlist_id = ?1 ORDER BY position",
    )?;
    let current: Vec<i64> = stmt.query_map([playlist_id], |r| r.get(0))?.collect::<std::result::Result<Vec<_>, _>>()?;

    let current_set: std::collections::HashSet<i64> = current.iter().copied().collect();
    let new_set: std::collections::HashSet<i64> = song_ids.iter().copied().collect();
    if current_set != new_set {
        return Err(anyhow::anyhow!("id_mismatch"));
    }

    for (pos, sid) in song_ids.iter().enumerate() {
        conn.execute(
            "UPDATE playlist_songs SET position = ?1 WHERE playlist_id = ?2 AND song_id = ?3",
            rusqlite::params![pos as i64, playlist_id, sid],
        )?;
    }
    Ok(())
}

/// Update timing for a song in a playlist.
/// Returns Ok((start_time_ms, end_time_ms)), Err("not_in_playlist"), or Err("invalid_timing").
pub fn update_song_timing(
    conn: &Connection,
    playlist_id: i64,
    song_id: i64,
    start_time_ms: i64,
    end_time_ms: i64,
) -> Result<(i64, i64)> {
    // Validate timing
    if start_time_ms > 0 && end_time_ms > 0 && start_time_ms >= end_time_ms {
        return Err(anyhow::anyhow!("invalid_timing"));
    }
    // Check link exists
    let link_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?1 AND song_id = ?2",
        rusqlite::params![playlist_id, song_id],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !link_exists {
        return Err(anyhow::anyhow!("not_in_playlist"));
    }
    // Clamp end_time_ms to duration
    let mut final_end = end_time_ms;
    if final_end > 0 {
        let duration: Option<i64> = conn.query_row(
            "SELECT duration FROM songs WHERE id = ?1",
            [song_id],
            |r| r.get(0),
        )?;
        if let Some(dur) = duration {
            let max_ms = dur * 1000;
            if final_end > max_ms {
                final_end = max_ms;
            }
        }
    }
    conn.execute(
        "UPDATE playlist_songs SET start_time_ms = ?1, end_time_ms = ?2 WHERE playlist_id = ?3 AND song_id = ?4",
        rusqlite::params![start_time_ms, final_end, playlist_id, song_id],
    )?;
    Ok((start_time_ms, final_end))
}

/// Update a playlist's image_url, dominant_color, dominant_color_2.
pub fn update_playlist_image(
    conn: &Connection,
    playlist_id: i64,
    image_url: Option<&str>,
    dominant_color: Option<&str>,
    dominant_color_2: Option<&str>,
) -> Result<bool> {
    let now = chrono_now();
    let affected = conn.execute(
        "UPDATE playlists SET image_url = ?1, dominant_color = ?2, dominant_color_2 = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![image_url, dominant_color, dominant_color_2, now, playlist_id],
    )?;
    Ok(affected > 0)
}

/// Get playlist info for image operations.
pub fn get_playlist_image_info(conn: &Connection, playlist_id: i64) -> Result<Option<Option<String>>> {
    // Returns Some(Some(image_url)) if playlist exists and has image,
    // Some(None) if playlist exists but no image, None if playlist not found.
    let mut stmt = conn.prepare("SELECT image_url FROM playlists WHERE id = ?1")?;
    let mut rows = stmt.query_map([playlist_id], |row| row.get::<_, Option<String>>(0))?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

/// Get playlist metadata for export.
pub fn get_playlist_for_export(conn: &Connection, playlist_id: i64) -> Result<Option<(serde_json::Value, Vec<serde_json::Value>)>> {
    let meta = conn.query_row(
        "SELECT id, name, color, emoji, crossfade_enabled, crossfade_duration_s FROM playlists WHERE id = ?1",
        [playlist_id],
        |row| {
            Ok((
                row.get::<_, String>(1)?,  // name
                row.get::<_, Option<String>>(2)?,  // color
                row.get::<_, Option<String>>(3)?,  // emoji
                row.get::<_, Option<i64>>(4)?,  // crossfade_enabled
                row.get::<_, Option<i64>>(5)?,  // crossfade_duration_s
            ))
        },
    );
    let (name, color, emoji, ce, cd) = match meta {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e.into()),
    };

    // Fetch songs
    let sql = format!("{PLAYLIST_SONG_SELECT} WHERE ps.playlist_id = ?1 GROUP BY s.id ORDER BY ps.position ASC");
    let mut stmt = conn.prepare(&sql)?;
    let song_rows = stmt.query_map([playlist_id], |row| {
        // For export, we need a simplified song shape
        Ok(serde_json::json!({
            "title": row.get::<_, String>(pl_col::TITLE)?,
            "artist": row.get::<_, String>(pl_col::ARTIST)?,
            "album": row.get::<_, Option<String>>(pl_col::ALBUM)?,
            "duration": row.get::<_, Option<i64>>(pl_col::DURATION)?,
            "file_path": row.get::<_, Option<String>>(pl_col::FILE_PATH)?,
            "file_format": row.get::<_, Option<String>>(pl_col::FILE_FORMAT)?,
            "tags": serializer::parse_tags(row.get::<_, Option<String>>(pl_col::TAGS)?.as_deref()),
            "start_time_ms": row.get::<_, i64>(pl_col::START_TIME_MS)?,
            "end_time_ms": row.get::<_, i64>(pl_col::END_TIME_MS)?,
        }))
    })?;
    let mut songs = Vec::new();
    for r in song_rows {
        songs.push(r?);
    }

    let playlist_meta = serde_json::json!({
        "name": name,
        "color": color,
        "emoji": emoji,
        "crossfade_enabled": ce,
        "crossfade_duration_s": cd,
    });
    Ok(Some((playlist_meta, songs)))
}

/// Import: create a playlist with songs matched by file_path.
pub fn import_playlist(
    conn: &Connection,
    name: &str,
    color: Option<&str>,
    emoji: Option<&str>,
    crossfade_enabled: Option<i64>,
    crossfade_duration_s: Option<i64>,
    file_paths: &[String],
) -> Result<(i64, String, usize, Vec<String>)> {
    // Build path → song_id lookup
    let mut stmt = conn.prepare("SELECT id, file_path FROM songs WHERE file_path IS NOT NULL AND file_path != ''")?;
    let db_rows: Vec<(i64, String)> = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?.collect::<std::result::Result<Vec<_>, _>>()?;

    let mut path_to_id: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for (id, fp) in &db_rows {
        let norm = fp.replace('\\', "/").trim().to_string();
        if !norm.is_empty() {
            path_to_id.insert(norm, *id);
        }
    }

    let mut matched_ids = Vec::new();
    let mut unmatched_paths = Vec::new();

    for fp in file_paths {
        let norm = fp.replace('\\', "/").trim().to_string();
        if let Some(&id) = path_to_id.get(&norm) {
            matched_ids.push(id);
        } else {
            // Try matching by filename only
            let filename = std::path::Path::new(&norm)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("");
            let mut found = false;
            for (db_fp, &db_id) in &path_to_id {
                let db_filename = std::path::Path::new(db_fp)
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or("");
                if db_filename == filename && !filename.is_empty() {
                    matched_ids.push(db_id);
                    found = true;
                    break;
                }
            }
            if !found {
                unmatched_paths.push(fp.clone());
            }
        }
    }

    if matched_ids.is_empty() {
        return Err(anyhow::anyhow!("no_matches"));
    }

    // Deduplicate preserving order
    let mut seen = std::collections::HashSet::new();
    let unique_ids: Vec<i64> = matched_ids.into_iter().filter(|id| seen.insert(*id)).collect();

    // Handle name collision
    let mut final_name = name.trim().to_string();
    let mut suffix = 1i64;
    loop {
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM playlists WHERE name = ?1",
            [&final_name],
            |r| r.get::<_, i64>(0),
        )? > 0;
        if !exists {
            break;
        }
        final_name = format!("{} ({})", name.trim(), suffix);
        suffix += 1;
    }

    let now = chrono_now();
    conn.execute(
        "INSERT INTO playlists (name, color, emoji, crossfade_enabled, crossfade_duration_s, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![final_name, color, emoji, crossfade_enabled, crossfade_duration_s, now, now],
    )?;
    let playlist_id = conn.last_insert_rowid();

    for (pos, sid) in unique_ids.iter().enumerate() {
        conn.execute(
            "INSERT INTO playlist_songs (playlist_id, song_id, position, added_at, start_time_ms, end_time_ms) \
             VALUES (?1, ?2, ?3, ?4, 0, 0)",
            rusqlite::params![playlist_id, sid, pos as i64, now],
        )?;
    }

    let matched_count = unique_ids.len();
    Ok((playlist_id, final_name, matched_count, unmatched_paths))
}

/// Get the playlist id + image_url for a given playlist.
pub fn get_playlist_image_url(conn: &Connection, playlist_id: i64) -> Result<Option<(Option<String>,)>> {
    let mut stmt = conn.prepare("SELECT image_url FROM playlists WHERE id = ?1")?;
    let mut rows = stmt.query_map([playlist_id], |row| {
        Ok((row.get::<_, Option<String>>(0)?,))
    })?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

// ── Folder queries ─────────────────────────────────────────────────────

/// Build a folder tree entry from accumulated data.
fn build_folder_json(
    path: &str,
    all_paths: &std::collections::BTreeMap<String, i64>,
    children_of: &std::collections::BTreeMap<String, Vec<String>>,
) -> serde_json::Value {
    let name = std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());
    let count = all_paths.get(path).copied().unwrap_or(0);

    let mut item = serde_json::json!({
        "name": name,
        "path": path,
        "song_count": count,
    });

    if let Some(children) = children_of.get(path) {
        let mut subs: Vec<serde_json::Value> = children
            .iter()
            .map(|c| build_folder_json(c, all_paths, children_of))
            .collect();
        subs.sort_by(|a, b| {
            let na = a["name"].as_str().unwrap_or("").to_lowercase();
            let nb = b["name"].as_str().unwrap_or("").to_lowercase();
            na.cmp(&nb)
        });
        if !subs.is_empty() {
            item.as_object_mut()
                .unwrap()
                .insert("subfolders".to_string(), serde_json::Value::Array(subs));
        }
    }

    item
}

/// List the folder tree built from songs' file_path directories.
/// Returns `(tree_array_value, total_folders, total_songs)`.
/// Songs with `file_path = NULL` are excluded.
pub fn list_folder_tree(conn: &Connection) -> Result<(serde_json::Value, i64, i64)> {
    let mut stmt = conn.prepare(
        "SELECT file_path FROM songs WHERE file_path IS NOT NULL AND file_path != ''",
    )?;
    let rows: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    // Count songs per directory
    let mut dir_counts: std::collections::BTreeMap<String, i64> = std::collections::BTreeMap::new();
    for fp in &rows {
        let fp = fp.replace('\\', "/");
        if let Some(parent) = std::path::Path::new(&fp).parent() {
            let dir = parent.to_string_lossy().to_string();
            if !dir.is_empty() {
                *dir_counts.entry(dir).or_insert(0) += 1;
            }
        }
    }

    // Accumulate counts for all ancestor paths
    let mut all_paths: std::collections::BTreeMap<String, i64> = std::collections::BTreeMap::new();
    for (dir_path, &count) in &dir_counts {
        let mut acc = String::new();
        for part in dir_path.split('/').filter(|p| !p.is_empty()) {
            acc = if acc.is_empty() {
                format!("/{}", part)
            } else {
                format!("{}/{}", acc, part)
            };
            *all_paths.entry(acc.clone()).or_insert(0) += count;
        }
    }

    // Build parent-child relationships
    let mut children_of: std::collections::BTreeMap<String, Vec<String>> =
        std::collections::BTreeMap::new();
    let mut roots: Vec<String> = Vec::new();
    for path in all_paths.keys() {
        let parent = std::path::Path::new(path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        if parent.is_empty() || !all_paths.contains_key(&parent) {
            roots.push(path.clone());
        } else {
            children_of.entry(parent).or_default().push(path.clone());
        }
    }

    // Build JSON
    let mut folders: Vec<serde_json::Value> = roots
        .iter()
        .map(|r| build_folder_json(r, &all_paths, &children_of))
        .collect();
    folders.sort_by(|a, b| {
        let na = a["name"].as_str().unwrap_or("").to_lowercase();
        let nb = b["name"].as_str().unwrap_or("").to_lowercase();
        na.cmp(&nb)
    });

    let total_folders = all_paths.len() as i64;
    let total_songs: i64 = dir_counts.values().sum();

    Ok((serde_json::Value::Array(folders), total_folders, total_songs))
}

/// List songs within a specific folder path.
/// Returns `(songs, total)`. Songs serialized with peaks (include_peaks = true).
/// LIKE hygiene: escapes `%`/`_` in path, uses `ESCAPE`, normalizes column
/// so backslash-stored and leading-slash-less paths match (Python parity).
pub fn list_folder_songs(
    conn: &Connection,
    path: &str,
    recursive: bool,
    limit: i64,
    offset: i64,
) -> Result<(Vec<serde_json::Value>, i64)> {
    let normalized_path = path.trim_end_matches('/');

    // Escape % and _ in the path for LIKE patterns (backslash escape)
    let escaped_path = normalized_path
        .replace('%', "\\%")
        .replace('_', "\\_");
    let like_pattern = format!("{}/%", escaped_path);

    // Normalize column: convert backslash to '/', ensure leading '/'
    // char(92) = backslash in SQLite
    let norm_col = "('/' || LTRIM(REPLACE(s.file_path, char(92), '/'), '/'))";

    // Count
    let total: i64 = if recursive {
        conn.query_row(
            &format!("SELECT COUNT(*) FROM songs s WHERE {} LIKE ?1 ESCAPE '\\'", norm_col),
            rusqlite::params![like_pattern],
            |row| row.get(0),
        )?
    } else {
        let deeper_pattern = format!("{}/%/%", escaped_path);
        conn.query_row(
            &format!("SELECT COUNT(*) FROM songs s WHERE {} LIKE ?1 ESCAPE '\\' AND {} NOT LIKE ?2 ESCAPE '\\'", norm_col, norm_col),
            rusqlite::params![like_pattern, deeper_pattern],
            |row| row.get(0),
        )?
    };

    // Data query
    let songs = if recursive {
        let sql = format!(
            "{} WHERE {} LIKE ?1 ESCAPE '\\' GROUP BY s.id ORDER BY s.title COLLATE NOCASE ASC, s.id ASC LIMIT ?2 OFFSET ?3",
            SONG_SELECT, norm_col
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params![like_pattern, limit, offset], |row| {
            row_to_song(row, true)
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    } else {
        let deeper_pattern = format!("{}/%/%", escaped_path);
        let sql = format!(
            "{} WHERE {} LIKE ?1 ESCAPE '\\' AND {} NOT LIKE ?2 ESCAPE '\\' GROUP BY s.id ORDER BY s.title COLLATE NOCASE ASC, s.id ASC LIMIT ?3 OFFSET ?4",
            SONG_SELECT, norm_col, norm_col
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(
            rusqlite::params![like_pattern, deeper_pattern, limit, offset],
            |row| row_to_song(row, true),
        )?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };

    Ok((songs, total))
}

// ── Album queries ──────────────────────────────────────────────────────

/// List all albums with aggregated metadata, sorted by album_name ASC.
pub fn list_albums(conn: &Connection) -> Result<(Vec<serde_json::Value>, i64)> {
    let mut stmt = conn.prepare(
        "SELECT COALESCE(album, 'Unknown Album') AS album_name, \
         artist AS album_artist, COUNT(*) AS song_count, \
         COALESCE(SUM(duration), 0) AS total_duration, \
         album_art_path AS cover_art_path, dominant_color \
         FROM songs GROUP BY COALESCE(album, 'Unknown Album'), artist \
         ORDER BY album_name COLLATE NOCASE ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let cover: Option<String> = row.get(4)?;
        let cover = cover.filter(|c| !c.is_empty());
        Ok(serde_json::json!({
            "album_name": row.get::<_, String>(0)?,
            "album_artist": row.get::<_, String>(1)?,
            "song_count": row.get::<_, i64>(2)?,
            "total_duration": row.get::<_, i64>(3)?,
            "cover_art_path": cover,
            "dominant_color": row.get::<_, Option<String>>(5)?,
        }))
    })?;
    let data: Vec<serde_json::Value> = rows.collect::<std::result::Result<Vec<_>, _>>()?;
    let total = data.len() as i64;
    Ok((data, total))
}

/// Get songs in an album by name.
/// Uses COALESCE for NULL album -> "Unknown Album".
/// Returns songs sorted by title ASC.
pub fn get_album_songs(conn: &Connection, album_name: &str) -> Result<Vec<serde_json::Value>> {
    let sql = format!(
        "{} WHERE COALESCE(s.album, 'Unknown Album') = ?1 GROUP BY s.id ORDER BY s.title COLLATE NOCASE ASC",
        SONG_SELECT
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([album_name], |row| row_to_song(row, true))?;
    let songs = rows.collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(songs)
}

/// Current UTC time in ISO format.
/// Uses Howard Hinnant's `days_from_civil` inverse algorithm for correct
/// year/month/day conversion from epoch days. Matches Python's
/// `datetime.now(timezone.utc).isoformat()` shape.
pub fn chrono_now() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let secs = now.as_secs();
    let days = (secs / 86400) as i64;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Hinnant's civil_from_days inverse (~15 lines, no dependency)
    // https://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hours, minutes, seconds
    )
}
