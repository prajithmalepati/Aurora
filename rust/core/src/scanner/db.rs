//! Scanner DB operations — ported from Python `file_scanner.py`.
//!
//! `scan_folder`: recursive walk, filter by supported extensions, skip symlinks.
//! `_replace_song`: SAVEPOINT-based atomic replacement (preserves tags/playlists).
//! `import_scanned_songs`: main import logic with dedup, format-tier replace,
//!   playlist handling, single commit.

#![allow(clippy::collapsible_if, clippy::collapsible_else_if, clippy::if_same_then_else)]

use anyhow::Result;
use rusqlite::Connection;
use rusqlite::OptionalExtension;
use std::path::{Path, PathBuf};

use super::{extract_metadata, format_tier, ScannedMetadata};
use crate::db::queries::chrono_now;

/// Supported audio file extensions (lowercase, with dot).
/// Matches Python `AUDIO_EXTENSIONS` exactly.
const SUPPORTED_EXTENSIONS: &[&str] = &[
    ".mp3", ".flac", ".m4a", ".ogg", ".opus",
    ".wav", ".wma", ".aac", ".aiff", ".ape",
    ".wv",
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
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type")]
pub enum ScanProgress {
    #[serde(rename = "total")]
    Total { total: usize },
    #[serde(rename = "progress")]
    Progress { done: usize, total: usize, current: String },
    #[serde(rename = "done")]
    Done {
        scanned: usize,
        imported: usize,
        replaced: usize,
        skipped: usize,
        skipped_exact: usize,
        skipped_same_format: usize,
        skipped_lower_quality: usize,
        errors: usize,
        art_extracted: usize,
        playlist_created: bool,
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
        let featured_json = metadata.featured_artists.as_ref().and_then(|fa| serde_json::to_string(fa).ok());
        let peaks_json = metadata.waveform_peaks.as_ref().and_then(|p| serde_json::to_string(p).ok());

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
        let tag_ids: Vec<i64> = tag_stmt.query_map([old_id], |r| r.get(0))?.collect::<std::result::Result<Vec<_>, _>>()?;
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
/// Returns a detailed summary.
pub fn import_scanned_songs(
    conn: &Connection,
    folder_path: &str,
    playlist_name: Option<&str>,
    cancel_token: Option<&std::sync::atomic::AtomicBool>,
    progress_cb: Option<&dyn Fn(ScanProgress)>,
) -> Result<ScanResult> {
    let audio_files = walk_audio_files(folder_path)?;
    let total_files = audio_files.len();

    if let Some(cb) = progress_cb {
        cb(ScanProgress::Total { total: total_files });
    }

    let mut result = ScanResult::default();
    let mut playlist_song_ids: Vec<i64> = Vec::new();
    let now = chrono_now();

    for (done, file_path) in audio_files.iter().enumerate() {
        // Check cancellation
        if let Some(token) = cancel_token {
            if token.load(std::sync::atomic::Ordering::Relaxed) {
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
        let exact = conn.query_row(
            "SELECT id, file_mtime FROM songs WHERE file_path = ?1",
            [incoming_path],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?)),
        ).optional()?;

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

            // mtime changed → update in place
            let art_path = match extract_and_save_art(incoming_path) {
                Some(path) => {
                    result.art_extracted += 1;
                    Some(path)
                }
                None => None,
            };

            let artists_json = serde_json::to_string(&metadata.artists).ok();
            let featured_json = metadata.featured_artists.as_ref().and_then(|fa| serde_json::to_string(fa).ok());
            let peaks_json = metadata.waveform_peaks.as_ref().and_then(|p| serde_json::to_string(p).ok());

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
                    metadata.title, metadata.artist, metadata.album,
                    metadata.duration, incoming_fmt, art_path,
                    peaks_json, metadata.dominant_color, metadata.dominant_color_2,
                    metadata.bleed_thumb, metadata.bleed_region_x, metadata.bleed_region_y,
                    metadata.bleed_region_w, metadata.bleed_region_h, incoming_mtime,
                    metadata.bitrate, metadata.sample_rate, metadata.bit_depth, metadata.file_size,
                    metadata.replaygain_track_gain, metadata.replaygain_track_peak,
                    metadata.replaygain_album_gain, metadata.replaygain_album_peak,
                    artists_json, featured_json, now, existing_id,
                ],
            )?;

            playlist_song_ids.push(existing_id);
            continue;
        }

        // Rule 2-5: check for (title, artist) match
        let title_artist_match = conn.query_row(
            "SELECT id, file_path, file_format FROM songs WHERE title = ?1 AND artist = ?2",
            rusqlite::params![metadata.title, metadata.artist],
            |row| Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            )),
        ).optional()?;

        if let Some((existing_id, _existing_path, existing_fmt)) = title_artist_match {
            let incoming_tier = format_tier(incoming_fmt);
            let existing_tier = format_tier(existing_fmt.as_deref().unwrap_or(""));

            if incoming_tier > existing_tier {
                // Incoming is HIGHER quality → replace
                let art_path = match extract_and_save_art(incoming_path) {
                    Some(path) => {
                        result.art_extracted += 1;
                        Some(path)
                    }
                    None => None,
                };

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
        let art_path = match extract_and_save_art(incoming_path) {
            Some(path) => {
                result.art_extracted += 1;
                Some(path)
            }
            None => None,
        };

        let artists_json = serde_json::to_string(&metadata.artists).ok();
        let featured_json = metadata.featured_artists.as_ref().and_then(|fa| serde_json::to_string(fa).ok());
        let peaks_json = metadata.waveform_peaks.as_ref().and_then(|p| serde_json::to_string(p).ok());

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
    let mut playlist_created = false;
    let ordered_ids = dedup_preserve_order(&playlist_song_ids);
    if let Some(pl_name) = playlist_name {
        if !ordered_ids.is_empty() {
            let existing_playlist = conn.query_row(
                "SELECT id FROM playlists WHERE name = ?1",
                [pl_name],
                |row| row.get::<_, i64>(0),
            ).optional()?;

            let playlist_id = if let Some(pid) = existing_playlist {
                pid
            } else {
                conn.execute(
                    "INSERT INTO playlists (name, created_at, updated_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![pl_name, now, now],
                )?;
                playlist_created = true;
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

    // Single commit — all-or-nothing semantics.
    // rusqlite auto-commits when not in an explicit transaction.
    // If the caller started a transaction, this commits it.

    // Send done event
    if let Some(cb) = progress_cb {
        cb(ScanProgress::Done {
            scanned: result.scanned,
            imported: result.imported,
            replaced: result.replaced,
            skipped: result.skipped,
            skipped_exact: result.skipped_exact,
            skipped_same_format: result.skipped_same_format,
            skipped_lower_quality: result.skipped_lower_quality,
            errors: result.errors.len(),
            art_extracted: result.art_extracted,
            playlist_created,
        });
    }

    Ok(result)
}

/// Extract album art from a file and save to the art directory.
/// Returns the saved filename or None.
fn extract_and_save_art(file_path: &str) -> Option<String> {
    let metadata = extract_metadata(file_path)?;
    let art_bytes = metadata.album_art_bytes?;

    let art_dir = get_art_dir();
    std::fs::create_dir_all(&art_dir).ok()?;

    // SHA-1 dedup
    use std::io::Write;
    let hash = {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        art_bytes.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    };

    // Determine extension from first bytes
    let ext = if art_bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if art_bytes.starts_with(&[0xFF, 0xD8]) {
        "jpg"
    } else {
        "jpg" // fallback
    };

    let filename = format!("{}.{}", hash, ext);
    let art_path = art_dir.join(&filename);

    if !art_path.exists() {
        let mut file = std::fs::File::create(&art_path).ok()?;
        file.write_all(&art_bytes).ok()?;
    }

    Some(filename)
}

/// Get the album art directory (matches Python paths.py layout).
fn get_art_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("AURORA_ALBUM_ART_DIR") {
        return PathBuf::from(dir);
    }
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("aurora")
        .join("album_art")
}

/// Build a minimal JSON song representation from metadata (for SSE streaming).
/// Omits bleed_thumb (raw bytes, not JSON serializable).
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
    })
}

/// Deduplicate a slice preserving order.
fn dedup_preserve_order(ids: &[i64]) -> Vec<i64> {
    let mut seen = std::collections::HashSet::new();
    ids.iter().copied().filter(|id| seen.insert(*id)).collect()
}

/// Create a minimal valid WAV file (1 second of silence at 44100Hz).
/// Shared between unit tests and integration tests.
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
}
