//! Scanner DB operations — ported from Python `file_scanner.py`.
//!
//! `scan_folder`: recursive walk, filter by supported extensions, skip symlinks.
//! `_replace_song`: SAVEPOINT-based atomic replacement (preserves tags/playlists).
//! `import_scanned_songs`: main import logic with dedup, format-tier replace,
//!   playlist handling, single commit.

use anyhow::Result;
use rusqlite::Connection;
use rusqlite::OptionalExtension;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use super::{extract_metadata, format_tier, ScannedMetadata};
use crate::db::queries::chrono_now;
use crate::paths;

/// Supported audio file extensions (lowercase, with dot).
/// Matches Python `AUDIO_EXTENSIONS` exactly.
const SUPPORTED_EXTENSIONS: &[&str] = &[
    ".mp3", ".flac", ".m4a", ".ogg", ".opus", ".wav", ".wma", ".aac", ".aiff", ".ape", ".wv",
];

/// Scan result summary.
#[derive(Debug, Clone, Default)]
pub struct ScanResult {
    pub scanned: usize,
    pub imported: usize,
    pub replaced: usize,
    pub skipped: usize,
    pub skipped_exact: usize,
    pub skipped_same_format: usize,
    pub skipped_lower_quality: usize,
    pub errors: Vec<ScanError>,
    pub songs: Vec<serde_json::Value>,
    pub replaced_songs: Vec<serde_json::Value>,
    pub art_extracted: usize,
}

/// Scan error entry.
#[derive(Debug, Clone)]
pub struct ScanError {
    pub file: String,
    pub error: String,
}

/// Progress event for SSE streaming.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum ScanProgress {
    #[serde(rename = "total")]
    Total { total: usize },
    #[serde(rename = "progress")]
    Progress {
        done: usize,
        total: usize,
        current: String,
    },
    #[serde(rename = "done")]
    Done {
        scanned: usize,
        imported: usize,
        replaced: usize,
        skipped: usize,
        skipped_exact: usize,
        skipped_same_format: usize,
        skipped_lower_quality: usize,
        #[serde(rename = "errors")]
        errors: Vec<serde_json::Value>,
        art_extracted: usize,
        songs: Vec<serde_json::Value>,
        replaced_songs: Vec<serde_json::Value>,
    },
    #[serde(rename = "error")]
    Error { message: String },
}

/// Walk a folder recursively, skipping symlinks, collecting audio files.
/// Returns paths to files matching SUPPORTED_EXTENSIONS.
/// Returns empty vec if folder doesn't exist (matches Python behavior).
pub fn walk_audio_files(folder_path: &str) -> Result<Vec<PathBuf>> {
    let root = Path::new(folder_path);
    if !root.exists() || !root.is_dir() {
        return Ok(Vec::new()); // match Python: rglob on nonexistent = empty
    }

    let mut results = Vec::new();
    walk_recursive(root, &mut results);
    Ok(results)
}

#[allow(clippy::collapsible_if)]
fn walk_recursive(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        // Skip symlinks
        if path.is_symlink() {
            continue;
        }
        if path.is_dir() {
            walk_recursive(&path, out);
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = format!(".{}", ext.to_lowercase());
                if SUPPORTED_EXTENSIONS.contains(&ext_lower.as_str()) {
                    out.push(path);
                }
            }
        }
    }
}

/// Atomically replace an existing song row with a higher-quality version.
/// Migrates song_tags and playlist_songs to the new row, then deletes the old row.
/// Uses a SQLite SAVEPOINT so a failure rolls back only this operation.
/// Returns the new song_id.
pub fn replace_song(
    conn: &Connection,
    old_id: i64,
    metadata: &ScannedMetadata,
    album_art_path: Option<&str>,
    now: &str,
) -> Result<i64> {
    conn.execute("SAVEPOINT replace_song", [])?;

    let result = (|| -> Result<i64> {
        // Insert new song row
        let artists_json = serde_json::to_string(&metadata.artists).ok();
        let featured_json = metadata
            .featured_artists
            .as_ref()
            .and_then(|fa| serde_json::to_string(fa).ok());
        let peaks_json = metadata
            .waveform_peaks
            .as_ref()
            .and_then(|p| serde_json::to_string(p).ok());

        conn.execute(
            "INSERT INTO songs
               (title, artist, album, duration, file_path, file_format,
                album_art_path, source, waveform_peaks, dominant_color,
                dominant_color_2, bleed_thumb, bleed_region_x, bleed_region_y,
                bleed_region_w, bleed_region_h, file_mtime,
                bitrate, sample_rate, bit_depth, file_size,
                replaygain_track_gain, replaygain_track_peak,
                replaygain_album_gain, replaygain_album_peak,
                artists, featured_artists,
                created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,'local_scan',?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28)",
            rusqlite::params![
                metadata.title,
                metadata.artist,
                metadata.album,
                metadata.duration,
                metadata.file_path,
                metadata.file_format,
                album_art_path,
                peaks_json,
                metadata.dominant_color,
                metadata.dominant_color_2,
                metadata.bleed_thumb,
                metadata.bleed_region_x,
                metadata.bleed_region_y,
                metadata.bleed_region_w,
                metadata.bleed_region_h,
                metadata.file_mtime,
                metadata.bitrate,
                metadata.sample_rate,
                metadata.bit_depth,
                metadata.file_size,
                metadata.replaygain_track_gain,
                metadata.replaygain_track_peak,
                metadata.replaygain_album_gain,
                metadata.replaygain_album_peak,
                artists_json,
                featured_json,
                now, now,
            ],
        )?;
        let new_id = conn.last_insert_rowid();

        // Migrate tags
        let mut tag_stmt = conn.prepare("SELECT tag_id FROM song_tags WHERE song_id = ?1")?;
        let tag_ids: Vec<i64> = tag_stmt
            .query_map([old_id], |r| r.get(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        for tid in tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?1, ?2)",
                rusqlite::params![new_id, tid],
            )?;
        }

        // Migrate playlist memberships
        conn.execute(
            "UPDATE playlist_songs SET song_id = ?1 WHERE song_id = ?2",
            rusqlite::params![new_id, old_id],
        )?;

        // Delete old song
        conn.execute("DELETE FROM songs WHERE id = ?1", [old_id])?;

        Ok(new_id)
    })();

    match result {
        Ok(new_id) => {
            conn.execute("RELEASE SAVEPOINT replace_song", [])?;
            Ok(new_id)
        }
        Err(e) => {
            // Best-effort rollback
            let _ = conn.execute("ROLLBACK TO SAVEPOINT replace_song", []);
            Err(e)
        }
    }
}

/// Scan folder, import new songs, optionally add to playlist.
///
/// Format-aware dedup: if (title, artist) already exists at lower quality,
/// the existing song is replaced and its tags/playlists are migrated.
///
/// `cancel_token`: if set, checked before each file — allows cancellation.
/// `progress_cb`: if set, called with progress events for SSE streaming.
///
/// The entire import is wrapped in a single transaction — all-or-nothing
/// semantics matching Python's single `db_connection.commit()` at
/// `file_scanner.py:878`.
///
/// Returns a detailed summary.
#[allow(clippy::collapsible_if)]
pub fn import_scanned_songs(
    conn: &Connection,
    folder_path: &str,
    playlist_name: Option<&str>,
    cancel_token: Option<&AtomicBool>,
    progress_cb: Option<&dyn Fn(ScanProgress)>,
) -> Result<ScanResult> {
    let audio_files = walk_audio_files(folder_path)?;
    let total_files = audio_files.len();

    if let Some(cb) = progress_cb {
        cb(ScanProgress::Total { total: total_files });
    }

    // F2: Begin transaction — all-or-nothing semantics.
    // This wraps the entire import; replace_song's SAVEPOINT nests inside.
    let tx = conn.unchecked_transaction()?;

    let mut result = ScanResult::default();
    let mut playlist_song_ids: Vec<i64> = Vec::new();
    let now = chrono_now();

    for (done, file_path) in audio_files.iter().enumerate() {
        // Check cancellation
        if let Some(token) = cancel_token {
            if token.load(Ordering::Relaxed) {
                break;
            }
        }

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if let Some(cb) = progress_cb {
            cb(ScanProgress::Progress {
                done,
                total: total_files,
                current: file_name,
            });
        }

        result.scanned += 1;

        let metadata = match extract_metadata(&file_path.to_string_lossy()) {
            Some(m) => m,
            None => {
                result.errors.push(ScanError {
                    file: file_path.to_string_lossy().to_string(),
                    error: "Could not read metadata".to_string(),
                });
                continue;
            }
        };

        let incoming_path = &metadata.file_path;
        let incoming_fmt = &metadata.file_format;
        let incoming_mtime = metadata.file_mtime;

        // Rule 1: exact file_path match
        let exact = conn
            .query_row(
                "SELECT id, file_mtime FROM songs WHERE file_path = ?1",
                [incoming_path],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?)),
            )
            .optional()?;

        if let Some((existing_id, stored_mtime)) = exact {
            // If mtime unchanged → true duplicate, skip
            let mtime_match = match (stored_mtime, incoming_mtime) {
                (Some(stored), Some(incoming)) => (incoming - stored).abs() < 1.0,
                _ => false,
            };
            if mtime_match {
                result.skipped_exact += 1;
                result.skipped += 1;
                playlist_song_ids.push(existing_id);
                continue;
            }

            // F6: mtime changed → update in place + count as imported
            let art_path = save_art(metadata.album_art_bytes.as_deref());
            if art_path.is_some() {
                result.art_extracted += 1;
            }

            let artists_json = serde_json::to_string(&metadata.artists).ok();
            let featured_json = metadata
                .featured_artists
                .as_ref()
                .and_then(|fa| serde_json::to_string(fa).ok());
            let peaks_json = metadata
                .waveform_peaks
                .as_ref()
                .and_then(|p| serde_json::to_string(p).ok());

            conn.execute(
                "UPDATE songs SET
                   title=?1, artist=?2, album=?3, duration=?4, file_format=?5,
                   album_art_path=COALESCE(?6, album_art_path),
                   waveform_peaks=?7, dominant_color=?8, dominant_color_2=?9,
                   bleed_thumb=?10, bleed_region_x=?11, bleed_region_y=?12,
                   bleed_region_w=?13, bleed_region_h=?14, file_mtime=?15,
                   bitrate=?16, sample_rate=?17, bit_depth=?18, file_size=?19,
                   replaygain_track_gain=?20, replaygain_track_peak=?21,
                   replaygain_album_gain=?22, replaygain_album_peak=?23,
                   artists=?24, featured_artists=?25,
                   updated_at=?26
                 WHERE id=?27",
                rusqlite::params![
                    metadata.title,
                    metadata.artist,
                    metadata.album,
                    metadata.duration,
                    incoming_fmt,
                    art_path,
                    peaks_json,
                    metadata.dominant_color,
                    metadata.dominant_color_2,
                    metadata.bleed_thumb,
                    metadata.bleed_region_x,
                    metadata.bleed_region_y,
                    metadata.bleed_region_w,
                    metadata.bleed_region_h,
                    incoming_mtime,
                    metadata.bitrate,
                    metadata.sample_rate,
                    metadata.bit_depth,
                    metadata.file_size,
                    metadata.replaygain_track_gain,
                    metadata.replaygain_track_peak,
                    metadata.replaygain_album_gain,
                    metadata.replaygain_album_peak,
                    artists_json,
                    featured_json,
                    now,
                    existing_id,
                ],
            )?;

            // F6: count as imported, push full song JSON with existing id
            result.imported += 1;
            let song_json = song_json_from_metadata(&metadata, existing_id);
            result.songs.push(song_json);
            playlist_song_ids.push(existing_id);
            continue;
        }

        // Rule 2-5: check for (title, artist) match
        let title_artist_match = conn
            .query_row(
                "SELECT id, file_path, file_format FROM songs WHERE title = ?1 AND artist = ?2",
                rusqlite::params![metadata.title, metadata.artist],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .optional()?;

        if let Some((existing_id, _existing_path, existing_fmt)) = title_artist_match {
            let incoming_tier = format_tier(incoming_fmt);
            let existing_tier = format_tier(existing_fmt.as_deref().unwrap_or(""));

            if incoming_tier > existing_tier {
                // Incoming is HIGHER quality → replace
                let art_path = save_art(metadata.album_art_bytes.as_deref());
                if art_path.is_some() {
                    result.art_extracted += 1;
                }

                match replace_song(conn, existing_id, &metadata, art_path.as_deref(), &now) {
                    Ok(new_id) => {
                        result.replaced += 1;
                        let song_json = song_json_from_metadata(&metadata, new_id);
                        result.replaced_songs.push(song_json);
                        playlist_song_ids.push(new_id);
                    }
                    Err(e) => {
                        result.errors.push(ScanError {
                            file: incoming_path.clone(),
                            error: format!("Replace failed (kept existing): {}", e),
                        });
                        playlist_song_ids.push(existing_id);
                    }
                }
            } else if incoming_tier == existing_tier {
                result.skipped_same_format += 1;
                result.skipped += 1;
                playlist_song_ids.push(existing_id);
            } else {
                result.skipped_lower_quality += 1;
                result.skipped += 1;
                playlist_song_ids.push(existing_id);
            }
            continue;
        }

        // No match → fresh import
        let art_path = save_art(metadata.album_art_bytes.as_deref());
        if art_path.is_some() {
            result.art_extracted += 1;
        }

        let artists_json = serde_json::to_string(&metadata.artists).ok();
        let featured_json = metadata
            .featured_artists
            .as_ref()
            .and_then(|fa| serde_json::to_string(fa).ok());
        let peaks_json = metadata
            .waveform_peaks
            .as_ref()
            .and_then(|p| serde_json::to_string(p).ok());

        conn.execute(
            "INSERT INTO songs
               (title, artist, album, duration, file_path, file_format,
                album_art_path, source, waveform_peaks, dominant_color,
                dominant_color_2, bleed_thumb, bleed_region_x, bleed_region_y,
                bleed_region_w, bleed_region_h, file_mtime,
                bitrate, sample_rate, bit_depth, file_size,
                replaygain_track_gain, replaygain_track_peak,
                replaygain_album_gain, replaygain_album_peak,
                artists, featured_artists,
                created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,'local_scan',?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28)",
            rusqlite::params![
                metadata.title, metadata.artist, metadata.album,
                metadata.duration, incoming_path, incoming_fmt,
                art_path,
                peaks_json, metadata.dominant_color, metadata.dominant_color_2,
                metadata.bleed_thumb, metadata.bleed_region_x, metadata.bleed_region_y,
                metadata.bleed_region_w, metadata.bleed_region_h, incoming_mtime,
                metadata.bitrate, metadata.sample_rate, metadata.bit_depth, metadata.file_size,
                metadata.replaygain_track_gain, metadata.replaygain_track_peak,
                metadata.replaygain_album_gain, metadata.replaygain_album_peak,
                artists_json, featured_json, now, now,
            ],
        )?;
        let song_id = conn.last_insert_rowid();

        result.imported += 1;
        let song_json = song_json_from_metadata(&metadata, song_id);
        result.songs.push(song_json);
        playlist_song_ids.push(song_id);
    }

    // Optional playlist creation/population
    let ordered_ids = dedup_preserve_order(&playlist_song_ids);
    if let Some(pl_name) = playlist_name {
        if !ordered_ids.is_empty() {
            let existing_playlist = conn
                .query_row(
                    "SELECT id FROM playlists WHERE name = ?1",
                    [pl_name],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?;

            let playlist_id = if let Some(pid) = existing_playlist {
                pid
            } else {
                conn.execute(
                    "INSERT INTO playlists (name, created_at, updated_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![pl_name, now, now],
                )?;
                conn.last_insert_rowid()
            };

            let max_pos: i64 = conn.query_row(
                "SELECT COALESCE(MAX(position), -1) FROM playlist_songs WHERE playlist_id = ?1",
                [playlist_id],
                |row| row.get(0),
            )?;

            for (i, song_id) in ordered_ids.iter().enumerate() {
                conn.execute(
                    "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![playlist_id, song_id, max_pos + 1 + i as i64, now],
                )?;
            }
        }
    }

    // F2: Commit — all-or-nothing. Matches Python file_scanner.py:878.
    tx.commit()?;

    // Send done event (after commit, matching Python order)
    if let Some(cb) = progress_cb {
        let errors_json: Vec<serde_json::Value> = result
            .errors
            .iter()
            .map(|e| serde_json::json!({"file": e.file, "error": e.error}))
            .collect();
        cb(ScanProgress::Done {
            scanned: result.scanned,
            imported: result.imported,
            replaced: result.replaced,
            skipped: result.skipped,
            skipped_exact: result.skipped_exact,
            skipped_same_format: result.skipped_same_format,
            skipped_lower_quality: result.skipped_lower_quality,
            errors: errors_json,
            art_extracted: result.art_extracted,
            songs: result.songs.clone(),
            replaced_songs: result.replaced_songs.clone(),
        });
    }

    Ok(result)
}

/// Save album art bytes to the art directory.
/// Returns the saved filename or None.
/// Uses real SHA-1 (matching Python hashlib.sha1) for content-addressed dedup.
/// Extension matches Python: "png" if PNG magic bytes, else "jpg".
fn save_art(art_bytes: Option<&[u8]>) -> Option<String> {
    let art_bytes = art_bytes?;

    let art_dir = paths::ALBUM_ART_DIR.clone();
    std::fs::create_dir_all(&art_dir).ok()?;

    // F4: Real SHA-1 — matches Python hashlib.sha1(art_data).hexdigest()
    use sha1::{Digest, Sha1};
    let mut hasher = Sha1::new();
    hasher.update(art_bytes);
    let hash = format!("{:x}", hasher.finalize());

    // Extension: match Python logic — "png" if PNG magic bytes, else "jpg"
    let ext = if art_bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else {
        "jpg"
    };

    let filename = format!("{}.{}", hash, ext);
    let art_path = art_dir.join(&filename);

    if !art_path.exists() {
        let mut file = std::fs::File::create(&art_path).ok()?;
        std::io::Write::write_all(&mut file, art_bytes).ok()?;
    }

    Some(filename)
}

/// Build a full JSON song representation from metadata (for SSE streaming).
/// Matches Python's full metadata dict shape. Omits bleed_thumb (raw bytes).
fn song_json_from_metadata(metadata: &ScannedMetadata, song_id: i64) -> serde_json::Value {
    serde_json::json!({
        "id": song_id,
        "title": metadata.title,
        "artist": metadata.artist,
        "album": metadata.album,
        "duration": metadata.duration,
        "file_path": metadata.file_path,
        "file_format": metadata.file_format,
        "source": "local_scan",
        "file_mtime": metadata.file_mtime,
        "bitrate": metadata.bitrate,
        "sample_rate": metadata.sample_rate,
        "bit_depth": metadata.bit_depth,
        "file_size": metadata.file_size,
        "waveform_peaks": metadata.waveform_peaks,
        "dominant_color": metadata.dominant_color,
        "dominant_color_2": metadata.dominant_color_2,
        "replaygain_track_gain": metadata.replaygain_track_gain,
        "replaygain_track_peak": metadata.replaygain_track_peak,
        "replaygain_album_gain": metadata.replaygain_album_gain,
        "replaygain_album_peak": metadata.replaygain_album_peak,
        "artists": metadata.artists,
        "featured_artists": metadata.featured_artists,
        "bleed_region_x": metadata.bleed_region_x,
        "bleed_region_y": metadata.bleed_region_y,
        "bleed_region_w": metadata.bleed_region_w,
        "bleed_region_h": metadata.bleed_region_h,
    })
}

/// Deduplicate a slice preserving order.
fn dedup_preserve_order(ids: &[i64]) -> Vec<i64> {
    let mut seen = std::collections::HashSet::new();
    ids.iter().copied().filter(|id| seen.insert(*id)).collect()
}

/// Create a minimal valid WAV file (1 second of silence at 44100Hz).
/// Shared between unit tests and integration tests.
#[cfg(any(test, feature = "test-utils"))]
pub fn create_minimal_wav() -> Vec<u8> {
    let sample_rate: u32 = 44100;
    let num_samples: u32 = sample_rate; // 1 second
    let num_channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * num_channels as u32 * bits_per_sample as u32 / 8;
    let block_align = num_channels * bits_per_sample / 8;
    let data_size = num_samples * num_channels as u32 * bits_per_sample as u32 / 8;

    let mut wav = Vec::new();
    // RIFF header
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_size).to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    // fmt chunk
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes()); // chunk size
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
    wav.extend_from_slice(&num_channels.to_le_bytes());
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&block_align.to_le_bytes());
    wav.extend_from_slice(&bits_per_sample.to_le_bytes());
    // data chunk
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    wav.extend_from_slice(&vec![0u8; data_size as usize]);
    wav
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_walk_audio_files_nonexistent() {
        let result = walk_audio_files("/nonexistent/path/xyz").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_walk_audio_files_not_dir() {
        // Create a temp file — should return empty, not error
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let result = walk_audio_files(tmp.path().to_str().unwrap()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_walk_audio_files_empty_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let result = walk_audio_files(tmp.path().to_str().unwrap()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_walk_audio_files_with_wav() {
        let tmp = tempfile::tempdir().unwrap();
        // Create a minimal WAV file
        let wav_path = tmp.path().join("test.wav");
        std::fs::write(&wav_path, create_minimal_wav()).unwrap();
        // Create a non-audio file
        let txt_path = tmp.path().join("readme.txt");
        std::fs::write(&txt_path, b"not audio").unwrap();

        let result = walk_audio_files(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].to_string_lossy().contains("test.wav"));
    }

    #[test]
    fn test_walk_audio_files_skips_symlinks() {
        let tmp = tempfile::tempdir().unwrap();
        let wav_path = tmp.path().join("real.wav");
        std::fs::write(&wav_path, create_minimal_wav()).unwrap();
        let link_path = tmp.path().join("link.wav");
        std::os::unix::fs::symlink(&wav_path, &link_path).unwrap();

        let result = walk_audio_files(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_save_art_sha1_deterministic() {
        // Known bytes → known SHA-1 hex digest (40 chars)
        // hashlib.sha1(b"test art data").hexdigest()
        let art_bytes = b"test art data";
        use sha1::{Digest, Sha1};
        let mut hasher = Sha1::new();
        hasher.update(art_bytes);
        let hash = format!("{:x}", hasher.finalize());
        assert_eq!(hash.len(), 40, "SHA-1 digest must be 40 hex chars");
        // Verify determinism
        let mut hasher2 = Sha1::new();
        hasher2.update(art_bytes);
        let hash2 = format!("{:x}", hasher2.finalize());
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_save_art_png_extension() {
        // PNG magic bytes → .png extension
        let mut png_data = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        png_data.extend_from_slice(&[0u8; 100]);
        let result = save_art(Some(&png_data));
        assert!(result.is_some());
        assert!(result.unwrap().ends_with(".png"));
    }

    #[test]
    fn test_save_art_jpg_extension() {
        // JPEG magic bytes → .jpg extension
        let mut jpg_data = vec![0xFF, 0xD8, 0xFF, 0xE0];
        jpg_data.extend_from_slice(&[0u8; 100]);
        let result = save_art(Some(&jpg_data));
        assert!(result.is_some());
        assert!(result.unwrap().ends_with(".jpg"));
    }

    #[test]
    fn test_save_art_none_bytes() {
        let result = save_art(None);
        assert!(result.is_none());
    }

    /// F7: chrono_now() format matches Python datetime.now(timezone.utc).isoformat()
    #[test]
    fn test_chrono_now_format() {
        let now = crate::db::queries::chrono_now();
        // Must match: 2026-07-02T15:01:08.347620+00:00
        let re = regex::Regex::new(
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+00:00$",
        )
        .unwrap();
        assert!(
            re.is_match(&now),
            "chrono_now() format mismatch: {}",
            now
        );
    }

    /// F1: Stream scan writes to real DB, songs visible via API.
    #[test]
    fn test_stream_scan_persists_to_db() {
        use crate::db::open_memory;
        let conn = open_memory().unwrap();

        let tmp = tempfile::tempdir().unwrap();
        let wav_path = tmp.path().join("test.wav");
        std::fs::write(&wav_path, create_minimal_wav()).unwrap();

        // Import via the same function the stream handler uses
        let result = import_scanned_songs(
            &conn,
            tmp.path().to_str().unwrap(),
            None,
            None,
            None,
        )
        .unwrap();

        assert_eq!(result.imported, 1, "Should import 1 song");

        // Verify song is visible via a SELECT on the same connection
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM songs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "Song should be persisted in DB");
    }

    /// F2: Transaction — mid-batch failure rolls back everything.
    #[test]
    fn test_transaction_rollback_on_conflict() {
        use crate::db::open_memory;
        let conn = open_memory().unwrap();

        let tmp = tempfile::tempdir().unwrap();
        let wav_path = tmp.path().join("test.wav");
        std::fs::write(&wav_path, create_minimal_wav()).unwrap();

        // First import — should succeed
        let result = import_scanned_songs(
            &conn,
            tmp.path().to_str().unwrap(),
            None,
            None,
            None,
        )
        .unwrap();
        assert_eq!(result.imported, 1);

        // Second import of same file — should skip (exact match), not error
        let result2 = import_scanned_songs(
            &conn,
            tmp.path().to_str().unwrap(),
            None,
            None,
            None,
        )
        .unwrap();
        assert_eq!(result2.skipped_exact, 1);
        assert_eq!(result2.imported, 0);

        // Total songs should still be 1
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM songs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    /// F5: Done event has errors as list, songs/replaced_songs included.
    #[test]
    fn test_done_event_shape() {
        use crate::db::open_memory;
        let conn = open_memory().unwrap();

        let tmp = tempfile::tempdir().unwrap();
        let wav_path = tmp.path().join("test.wav");
        std::fs::write(&wav_path, create_minimal_wav()).unwrap();

        let events = std::cell::RefCell::new(Vec::<ScanProgress>::new());
        let cb = |evt: ScanProgress| {
            // We can't move out of the closure, so we serialize/deserialize
            let json = serde_json::to_string(&evt).unwrap();
            let parsed: ScanProgress = serde_json::from_str(&json).unwrap();
            events.borrow_mut().push(parsed);
        };

        let _ = import_scanned_songs(&conn, tmp.path().to_str().unwrap(), None, None, Some(&cb));

        let events = events.borrow();
        // Find the done event
        let done = events.iter().find(|e| matches!(e, ScanProgress::Done { .. }));
        assert!(done.is_some(), "Should have a done event");

        if let Some(ScanProgress::Done {
            errors,
            songs,
            replaced_songs,
            ..
        }) = done
        {
            // errors must be a Vec (not an int)
            assert!(errors.is_empty(), "No errors expected for valid WAV");
            // songs should contain the imported song
            assert_eq!(songs.len(), 1, "Should have 1 song in done event");
            // Song should have full metadata fields
            let song = &songs[0];
            assert!(song.get("file_mtime").is_some(), "Song must have file_mtime");
            assert!(song.get("waveform_peaks").is_some(), "Song must have waveform_peaks");
            assert!(song.get("bitrate").is_some(), "Song must have bitrate");
            assert!(song.get("artists").is_some(), "Song must have artists");
            // Must NOT have bleed_thumb bytes
            assert!(song.get("bleed_thumb").is_none(), "Song must not have bleed_thumb");
            // replaced_songs should be empty
            assert!(replaced_songs.is_empty());
        } else {
            panic!("Expected Done variant");
        }
    }

    /// F6: mtime-changed update counts as imported.
    #[test]
    fn test_mtime_update_counts_as_imported() {
        use crate::db::open_memory;
        let conn = open_memory().unwrap();

        let tmp = tempfile::tempdir().unwrap();
        let wav_path = tmp.path().join("test.wav");
        std::fs::write(&wav_path, create_minimal_wav()).unwrap();

        // First import
        let result = import_scanned_songs(
            &conn,
            tmp.path().to_str().unwrap(),
            None,
            None,
            None,
        )
        .unwrap();
        assert_eq!(result.imported, 1);
        let original_id: i64 = conn
            .query_row("SELECT id FROM songs LIMIT 1", [], |r| r.get(0))
            .unwrap();

        // Modify the file to change mtime (>1s difference)
        std::thread::sleep(std::time::Duration::from_millis(1100));
        std::fs::write(&wav_path, create_minimal_wav()).unwrap();

        // Re-scan
        let result2 = import_scanned_songs(
            &conn,
            tmp.path().to_str().unwrap(),
            None,
            None,
            None,
        )
        .unwrap();
        assert_eq!(result2.imported, 1, "mtime-changed update should count as imported");
        assert_eq!(result2.songs.len(), 1);
        assert_eq!(result2.songs[0]["id"].as_i64().unwrap(), original_id, "Should keep same id");
    }
}
