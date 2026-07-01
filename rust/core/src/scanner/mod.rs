//! File scanner — metadata extraction ported from Python `file_scanner.py`.
//!
//! Metadata half: tags, format, ReplayGain, artist parsing (N30).
//! Analysis half: peaks, colors, bleed (N31).

pub mod analysis;
pub mod color_utils;
pub mod peaks;

use regex::Regex;
use std::path::Path;
use std::sync::LazyLock;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// The metadata fields extracted from an audio file.
/// N30: tags, format, ReplayGain, artist parsing.
/// N31: peaks, dominant colors, bleed thumb.
#[derive(Debug, Clone, PartialEq)]
pub struct ScannedMetadata {
    // --- N30 metadata fields ---
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub artists: Vec<String>,
    pub featured_artists: Option<Vec<String>>,
    pub duration: Option<i64>,
    pub file_path: String,
    pub file_format: String,
    pub file_mtime: Option<f64>,
    pub bitrate: Option<i64>,
    pub sample_rate: Option<i64>,
    pub bit_depth: Option<i64>,
    pub file_size: Option<i64>,
    pub replaygain_track_gain: Option<f64>,
    pub replaygain_track_peak: Option<f64>,
    pub replaygain_album_gain: Option<f64>,
    pub replaygain_album_peak: Option<f64>,
    pub album_art_bytes: Option<Vec<u8>>,
    // --- N31 analysis fields ---
    pub waveform_peaks: Option<Vec<f32>>,
    pub dominant_color: Option<String>,
    pub dominant_color_2: Option<String>,
    pub bleed_thumb: Option<Vec<u8>>,
    pub bleed_region_x: i64,
    pub bleed_region_y: i64,
    pub bleed_region_w: i64,
    pub bleed_region_h: i64,
}

// ---------------------------------------------------------------------------
// Pure functions — parse_artists, format_tier
// ---------------------------------------------------------------------------

/// Split a string on common artist delimiters.
/// Regex: `\s*[;/\\,]\s*|\s*&\s*|\x00`
fn split_on_delimiters(s: &str) -> Vec<String> {
    static RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r#"\s*[;/\\,]\s*|\s*&\s*|\x00"#).unwrap());
    RE.split(s)
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect()
}

/// Parse a multi-artist string into (primary_artist, all_artists, featured_artists).
///
/// Splits on common delimiters: `; / \ , &` plus NUL bytes.
/// Artists after `feat.` / `ft.` are treated as featured/guest artists.
/// Returns `(primary_artist, all_artists, featured_opt)`.
pub fn parse_artists(artist_string: &str) -> (String, Vec<String>, Option<Vec<String>>) {
    let trimmed = artist_string.trim();
    if trimmed.is_empty() {
        return ("Unknown Artist".to_string(), vec![], None);
    }

    let s = trimmed;

    // Detect feat/ft sections: `(?:\s+|^)(?:feat\.|ft\.)\s+`
    static FEAT_RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r#"(?i)(?:\s+|^)(?:feat\.|ft\.)\s+"#).unwrap());

    let (before_feat, featured_raw) = if let Some(mat) = FEAT_RE.find(s) {
        let start = mat.start();
        let end = mat.end();
        (
            s[..start].trim().to_string(),
            Some(s[end..].trim().to_string()),
        )
    } else {
        (s.to_string(), None)
    };

    let primary_parts = split_on_delimiters(&before_feat);
    let featured_parts: Vec<String> = match &featured_raw {
        Some(raw) if !raw.is_empty() => split_on_delimiters(raw),
        _ => vec![],
    };

    if primary_parts.is_empty() {
        if !featured_parts.is_empty() {
            let primary_artist = featured_parts[0].clone();
            let all_artists = featured_parts.clone();
            let featured = if featured_parts.len() > 1 {
                Some(featured_parts[1..].to_vec())
            } else {
                None
            };
            (primary_artist, all_artists, featured)
        } else {
            (s.to_string(), vec![s.to_string()], None)
        }
    } else {
        let primary_artist = primary_parts[0].clone();
        let mut all_artists = primary_parts;
        all_artists.extend(featured_parts.clone());
        let featured = if !featured_parts.is_empty() {
            Some(featured_parts)
        } else {
            None
        };
        (primary_artist, all_artists, featured)
    }
}

/// Quality rank table — matches Python `FORMAT_TIER` exactly.
pub fn format_tier(fmt: &str) -> i32 {
    match fmt.to_lowercase().as_str() {
        "flac" => 6,
        "wav" => 5,
        "m4a_alac" => 4,
        "ogg" => 3,
        "opus" => 3,
        "m4a_aac" => 2,
        "m4a" => 2, // undetected M4A treated as AAC
        "mp3" => 1,
        "aac" => 1,
        "wma" => 1,
        "aiff" => 1,
        "ape" => 1,
        "wv" => 1,
        _ => 0,
    }
}

/// Detect ALAC vs AAC inside an .m4a container via lofty.
/// Returns `"m4a_alac"` or `"m4a_aac"` (fallback).
fn detect_m4a_format(path: &Path) -> String {
    use lofty::config::ParseOptions;
    use lofty::file::AudioFile;
    use lofty::mp4::{Mp4Codec, Mp4File};
    use std::fs::File;
    use std::io::BufReader;

    let Ok(file) = File::open(path) else {
        return "m4a_aac".to_string();
    };
    let mut reader = BufReader::new(file);

    let Ok(mp4_file) = Mp4File::read_from(&mut reader, ParseOptions::default()) else {
        return "m4a_aac".to_string();
    };

    match mp4_file.properties().codec() {
        Mp4Codec::ALAC => "m4a_alac".to_string(),
        _ => "m4a_aac".to_string(),
    }
}

/// Determine the file format string from extension + optional M4A detection.
fn determine_format(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "m4a" {
        detect_m4a_format(path)
    } else {
        ext
    }
}

// ---------------------------------------------------------------------------
// ReplayGain extraction
// ---------------------------------------------------------------------------

/// Extract ReplayGain tags from an audio file.
/// Supports MP3 (ID3 TXXX), FLAC/Vorbis, MP4/M4A (iTunes atoms).
pub fn extract_replaygain(path: &Path) -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    use lofty::file::TaggedFileExt;
    use lofty::probe::Probe;
    use lofty::tag::ItemKey;

    let Ok(tagged) = Probe::open(path).and_then(|p| p.read()) else {
        return (None, None, None, None);
    };

    let tag = match tagged.primary_tag().or_else(|| tagged.first_tag()) {
        Some(t) => t,
        None => return (None, None, None, None),
    };

    let mut track_gain: Option<f64> = None;
    let mut track_peak: Option<f64> = None;
    let mut album_gain: Option<f64> = None;
    let mut album_peak: Option<f64> = None;

    let rg_keys: [(ItemKey, &str); 4] = [
        (ItemKey::ReplayGainTrackGain, "track_gain"),
        (ItemKey::ReplayGainTrackPeak, "track_peak"),
        (ItemKey::ReplayGainAlbumGain, "album_gain"),
        (ItemKey::ReplayGainAlbumPeak, "album_peak"),
    ];

    for (key, name) in &rg_keys {
        if let Some(text) = tag.get_string(key) {
            let cleaned = text.replace(" dB", "").trim().to_string();
            if let Ok(val) = cleaned.parse::<f64>() {
                match *name {
                    "track_gain" => track_gain = Some(val),
                    "track_peak" => track_peak = Some(val),
                    "album_gain" => album_gain = Some(val),
                    "album_peak" => album_peak = Some(val),
                    _ => {}
                }
            }
        }
    }

    (track_gain, track_peak, album_gain, album_peak)
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

/// Extract metadata from an audio file. Returns None on failure (no panic).
pub fn extract_metadata(file_path: &str) -> Option<ScannedMetadata> {
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::probe::Probe;
    use lofty::tag::{Accessor, ItemKey};
    use std::fs;

    let path = Path::new(file_path);
    let path_abs = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());

    let tagged = match Probe::open(path).and_then(|p| p.read()) {
        Ok(t) => t,
        Err(_) => return None,
    };

    let properties = tagged.properties();

    // Duration in seconds (float → round to int)
    let duration = Some(properties.duration().as_secs() as i64);

    // Bitrate (kbps)
    let bitrate = properties
        .overall_bitrate()
        .map(|b| b as i64)
        .or_else(|| properties.audio_bitrate().map(|b| b as i64));

    // Sample rate
    let sample_rate = properties.sample_rate().map(|sr| sr as i64);

    // Bit depth
    let bit_depth = properties.bit_depth().map(|bd| bd as i64);

    // File size
    let file_size = fs::metadata(path).ok().map(|m| m.len() as i64);

    // File mtime
    let file_mtime = fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .ok()
                .map(|d| d.as_secs_f64())
        });

    // Tags
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    // Title: tag → filename stem
    let title = tag
        .and_then(|t| t.title().map(|s| s.to_string()))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string()
        });

    // Album
    let album = tag
        .and_then(|t| t.album().map(|s| s.to_string()))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    // Artist — join multiple values with "; " then parse
    let raw_artist = if let Some(t) = tag {
        let artists: Vec<String> = t
            .get_strings(&ItemKey::TrackArtist)
            .map(|s| s.to_string())
            .collect();
        if artists.is_empty() {
            String::new()
        } else if artists.len() == 1 {
            artists[0].clone()
        } else {
            artists.join("; ")
        }
    } else {
        String::new()
    };

    let (primary_artist, all_artists, featured_artists) = parse_artists(&raw_artist);
    let artist = if primary_artist.is_empty() {
        "Unknown Artist".to_string()
    } else {
        primary_artist
    };

    // File format
    let file_format = determine_format(path);

    // ReplayGain
    let (rg_track_gain, rg_track_peak, rg_album_gain, rg_album_peak) = extract_replaygain(path);

    // Album art bytes
    let album_art_bytes = tag.and_then(|t| t.pictures().first().map(|pic| pic.data().to_vec()));

    // --- N31 analysis fields ---

    // Waveform peaks (from file path, independent of art)
    let waveform_peaks = peaks::extract_peaks(file_path, 1000);

    // Dominant colors + bleed from album art
    let (
        dominant_color,
        dominant_color_2,
        bleed_thumb,
        bleed_region_x,
        bleed_region_y,
        bleed_region_w,
        bleed_region_h,
    ) = if let Some(ref art) = album_art_bytes {
        let (c1, c2) = analysis::extract_dominant_colors(art);
        let (thumb, bx, by, bw, bh) = analysis::extract_bright_region(art);
        (c1, c2, thumb, bx, by, bw, bh)
    } else {
        (None, None, None, 0, 0, 0, 0)
    };

    Some(ScannedMetadata {
        title: title.trim().to_string(),
        artist: artist.trim().to_string(),
        album,
        artists: all_artists,
        featured_artists,
        duration,
        file_path: path_abs.to_string_lossy().to_string(),
        file_format,
        file_mtime,
        bitrate,
        sample_rate,
        bit_depth,
        file_size,
        replaygain_track_gain: rg_track_gain,
        replaygain_track_peak: rg_track_peak,
        replaygain_album_gain: rg_album_gain,
        replaygain_album_peak: rg_album_peak,
        album_art_bytes,
        // N31 analysis fields
        waveform_peaks,
        dominant_color,
        dominant_color_2,
        bleed_thumb,
        bleed_region_x,
        bleed_region_y,
        bleed_region_w,
        bleed_region_h,
    })
}

// ===========================================================================
// Tests — T1 pure-function tests (ported from Python)
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ----- parse_artists tests -----

    #[test]
    fn test_parse_artists_simple() {
        let (primary, all, featured) = parse_artists("Radiohead");
        assert_eq!(primary, "Radiohead");
        assert_eq!(all, vec!["Radiohead"]);
        assert_eq!(featured, None);
    }

    #[test]
    fn test_parse_artists_semicolon() {
        let (primary, all, featured) = parse_artists("Artist A; Artist B");
        assert_eq!(primary, "Artist A");
        assert_eq!(all, vec!["Artist A", "Artist B"]);
        assert_eq!(featured, None);
    }

    #[test]
    fn test_parse_artists_slash() {
        let (primary, all, _featured) = parse_artists("Artist A / Artist B");
        assert_eq!(primary, "Artist A");
        assert_eq!(all, vec!["Artist A", "Artist B"]);
    }

    #[test]
    fn test_parse_artists_backslash() {
        let (primary, all, _featured) = parse_artists("Artist A \\ Artist B");
        assert_eq!(primary, "Artist A");
        assert_eq!(all, vec!["Artist A", "Artist B"]);
    }

    #[test]
    fn test_parse_artists_comma() {
        let (primary, all, _featured) = parse_artists("Artist A, Artist B");
        assert_eq!(primary, "Artist A");
        assert_eq!(all, vec!["Artist A", "Artist B"]);
    }

    #[test]
    fn test_parse_artists_ampersand() {
        let (primary, all, _featured) = parse_artists("Artist A & Artist B");
        assert_eq!(primary, "Artist A");
        assert_eq!(all, vec!["Artist A", "Artist B"]);
    }

    #[test]
    fn test_parse_artists_nul() {
        let (primary, all, _featured) = parse_artists("Artist A\x00Artist B");
        assert_eq!(primary, "Artist A");
        assert_eq!(all, vec!["Artist A", "Artist B"]);
    }

    #[test]
    fn test_parse_artists_feat() {
        let (primary, all, featured) = parse_artists("Main Artist feat. Guest Artist");
        assert_eq!(primary, "Main Artist");
        assert_eq!(all, vec!["Main Artist", "Guest Artist"]);
        assert_eq!(featured, Some(vec!["Guest Artist".to_string()]));
    }

    #[test]
    fn test_parse_artists_ft() {
        let (primary, all, featured) = parse_artists("Main Artist ft. Guest Artist");
        assert_eq!(primary, "Main Artist");
        assert_eq!(all, vec!["Main Artist", "Guest Artist"]);
        assert_eq!(featured, Some(vec!["Guest Artist".to_string()]));
    }

    #[test]
    fn test_parse_artists_feat_case_insensitive() {
        let (primary, _all, featured) = parse_artists("Main Artist FEAT. Guest");
        assert_eq!(primary, "Main Artist");
        assert_eq!(featured, Some(vec!["Guest".to_string()]));
    }

    #[test]
    fn test_parse_artists_multiple_featured() {
        let (primary, all, featured) = parse_artists("Main feat. Guest1; Guest2");
        assert_eq!(primary, "Main");
        assert_eq!(all, vec!["Main", "Guest1", "Guest2"]);
        assert_eq!(
            featured,
            Some(vec!["Guest1".to_string(), "Guest2".to_string()])
        );
    }

    #[test]
    fn test_parse_artists_empty() {
        let (primary, all, featured) = parse_artists("");
        assert_eq!(primary, "Unknown Artist");
        assert_eq!(all, Vec::<String>::new());
        assert_eq!(featured, None);
    }

    #[test]
    fn test_parse_artists_whitespace_only() {
        let (primary, all, featured) = parse_artists("   ");
        assert_eq!(primary, "Unknown Artist");
        assert_eq!(all, Vec::<String>::new());
        assert_eq!(featured, None);
    }

    #[test]
    fn test_parse_artists_multi_value_join() {
        // Simulates Python's "; " join of multiple ARTIST values
        let (primary, all, featured) = parse_artists("A; B");
        assert_eq!(primary, "A");
        assert_eq!(all, vec!["A", "B"]);
        assert_eq!(featured, None);
    }

    #[test]
    fn test_parse_artists_only_featured() {
        // When before-feat is empty but featured exists
        let (primary, all, _featured) = parse_artists("feat. Guest");
        assert_eq!(primary, "Guest");
        assert_eq!(all, vec!["Guest"]);
        // featured_parts[1..] is empty, so featured = None
    }

    // ----- format_tier tests -----

    #[test]
    fn test_format_tier_flac() {
        assert_eq!(format_tier("flac"), 6);
    }

    #[test]
    fn test_format_tier_wav() {
        assert_eq!(format_tier("wav"), 5);
    }

    #[test]
    fn test_format_tier_m4a_alac() {
        assert_eq!(format_tier("m4a_alac"), 4);
    }

    #[test]
    fn test_format_tier_ogg() {
        assert_eq!(format_tier("ogg"), 3);
    }

    #[test]
    fn test_format_tier_opus() {
        assert_eq!(format_tier("opus"), 3);
    }

    #[test]
    fn test_format_tier_m4a_aac() {
        assert_eq!(format_tier("m4a_aac"), 2);
    }

    #[test]
    fn test_format_tier_m4a() {
        assert_eq!(format_tier("m4a"), 2);
    }

    #[test]
    fn test_format_tier_mp3() {
        assert_eq!(format_tier("mp3"), 1);
    }

    #[test]
    fn test_format_tier_unknown() {
        assert_eq!(format_tier("xyz"), 0);
    }

    #[test]
    fn test_format_tier_case_insensitive() {
        assert_eq!(format_tier("FLAC"), 6);
        assert_eq!(format_tier("Mp3"), 1);
    }

    #[test]
    fn test_format_tier_empty() {
        assert_eq!(format_tier(""), 0);
    }

    // ----- split_on_delimiters tests -----

    #[test]
    fn test_split_mixed_delimiters() {
        let parts = split_on_delimiters("A; B / C \\ D, E & F");
        assert_eq!(parts, vec!["A", "B", "C", "D", "E", "F"]);
    }

    #[test]
    fn test_split_trim() {
        let parts = split_on_delimiters("  A  ;  B  ");
        assert_eq!(parts, vec!["A", "B"]);
    }

    #[test]
    fn test_split_empty_parts() {
        let parts = split_on_delimiters(";;;");
        assert!(parts.is_empty());
    }
}
