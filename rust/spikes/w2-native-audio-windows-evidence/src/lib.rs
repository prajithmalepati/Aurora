// ---------- helpers shared with production (imported via the lib) ----------

/// Redact an absolute filesystem path to its basename only.
/// Handles both `\` (Windows) and `/` (Unix) separators so redaction works
/// cross-platform — a Linux-hosted harness must still strip Windows paths.
pub fn redact_path(path: &str) -> String {
    // Split on both separator styles to handle cross-platform paths.
    path.rsplit(['\\', '/'])
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("<unknown>")
        .to_string()
}

/// Extension without the leading dot, lowercased.
/// Handles both separator styles for cross-platform correctness.
pub fn extension_of(path: &str) -> String {
    let basename = path.rsplit(['\\', '/']).next().unwrap_or(path);
    basename
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_lowercase())
        .unwrap_or_default()
}

// ---------- report types ----------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileReport {
    pub basename: String,
    pub extension: String,
    pub codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub bit_depth: Option<u16>,
    pub duration_secs: Option<f64>,
    pub decode_result: DecodeResult,
    pub playback_result: PlaybackResult,
    pub human_audible: Option<bool>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum DecodeResult {
    Ok {
        codec: String,
        sample_rate: u32,
        channels: u16,
    },
    Err {
        category: String,
        message: String,
    },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum PlaybackResult {
    /// Played through platform audio backend.
    Played,
    /// Decode succeeded but playback was skipped (e.g. non-Windows platform gate).
    Skipped,
    /// Playback attempted but failed.
    Err { category: String, message: String },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HarnessReport {
    pub platform: String,
    pub audio_backend: String,
    pub rodio_version: String,
    pub files: Vec<FileReport>,
}

// ---------- platform gate ----------

/// Returns Ok(backend_name) on Windows, Err otherwise.
pub fn require_windows_backend() -> Result<String, String> {
    if cfg!(target_os = "windows") {
        Ok("WASAPI".to_string())
    } else {
        Err(format!(
            "Gate-1 evidence must be captured on Windows. \
             Current platform: {}. ALSA/Pulse output does not prove WASAPI.",
            std::env::consts::OS
        ))
    }
}

// ============================== TESTS ======================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- RED: filename redaction ---

    #[test]
    fn redact_path_strips_directory() {
        let result = redact_path(r"C:\Users\dogfood\Music\test.flac");
        assert_eq!(result, "test.flac");
    }

    #[test]
    fn redact_path_unix_style() {
        let result = redact_path("/home/user/music/song.mp3");
        assert_eq!(result, "song.mp3");
    }

    #[test]
    fn redact_path_bare_filename() {
        let result = redact_path("song.ogg");
        assert_eq!(result, "song.ogg");
    }

    #[test]
    fn redact_path_empty_returns_unknown() {
        let result = redact_path("");
        assert_eq!(result, "<unknown>");
    }

    // --- RED: extension extraction ---

    #[test]
    fn extension_of_flac() {
        assert_eq!(extension_of("test.flac"), "flac");
    }

    #[test]
    fn extension_of_uppercase() {
        assert_eq!(extension_of("test.FLAC"), "flac");
    }

    #[test]
    fn extension_of_no_ext() {
        assert_eq!(extension_of("noext"), "");
    }

    // --- RED: non-Windows fail-closed ---

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn non_windows_rejects_with_clear_message() {
        let result = require_windows_backend();
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("Windows"), "Error must mention Windows: {msg}");
        assert!(msg.contains("WASAPI"), "Error must mention WASAPI: {msg}");
        assert!(
            msg.contains("ALSA") || msg.contains("Pulse"),
            "Error must mention non-Windows backends: {msg}"
        );
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn windows_accepts_wasapi() {
        let result = require_windows_backend();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "WASAPI");
    }

    // --- RED: report schema serialises deterministically ---

    #[test]
    fn report_schema_roundtrip() {
        let report = HarnessReport {
            platform: "windows".to_string(),
            audio_backend: "WASAPI".to_string(),
            rodio_version: "0.22.2".to_string(),
            files: vec![FileReport {
                basename: "test.flac".to_string(),
                extension: "flac".to_string(),
                codec: Some("FLAC".to_string()),
                sample_rate: Some(44100),
                channels: Some(2),
                bit_depth: Some(16),
                duration_secs: Some(120.5),
                decode_result: DecodeResult::Ok {
                    codec: "FLAC".to_string(),
                    sample_rate: 44100,
                    channels: 2,
                },
                playback_result: PlaybackResult::Played,
                human_audible: Some(true),
            }],
        };

        let json = serde_json::to_string_pretty(&report).unwrap();
        assert!(json.contains("\"basename\": \"test.flac\""));
        assert!(json.contains("\"audio_backend\": \"WASAPI\""));

        // Roundtrip
        let parsed: HarnessReport = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.files.len(), 1);
        assert_eq!(parsed.files[0].basename, "test.flac");
    }

    // --- RED: decode error report serialises ---

    #[test]
    fn decode_error_report_schema() {
        let report = HarnessReport {
            platform: "windows".to_string(),
            audio_backend: "WASAPI".to_string(),
            rodio_version: "0.22.2".to_string(),
            files: vec![FileReport {
                basename: "corrupt.flac".to_string(),
                extension: "flac".to_string(),
                codec: None,
                sample_rate: None,
                channels: None,
                bit_depth: None,
                duration_secs: None,
                decode_result: DecodeResult::Err {
                    category: "decode".to_string(),
                    message: "unexpected EOF".to_string(),
                },
                playback_result: PlaybackResult::Skipped,
                human_audible: None,
            }],
        };

        let json = serde_json::to_string(&report).unwrap();
        let parsed: HarnessReport = serde_json::from_str(&json).unwrap();
        match &parsed.files[0].decode_result {
            DecodeResult::Err { category, message } => {
                assert_eq!(category, "decode");
                assert_eq!(message, "unexpected EOF");
            }
            _ => panic!("Expected Err variant"),
        }
    }

    // --- RED: redaction never leaks in serialised output ---

    #[test]
    fn serialised_report_never_contains_absolute_paths() {
        let report = HarnessReport {
            platform: "windows".to_string(),
            audio_backend: "WASAPI".to_string(),
            rodio_version: "0.22.2".to_string(),
            files: vec![FileReport {
                basename: redact_path(r"C:\Users\dogfood\Music\secret.flac"),
                extension: extension_of(r"C:\Users\dogfood\Music\secret.flac"),
                codec: None,
                sample_rate: None,
                channels: None,
                bit_depth: None,
                duration_secs: None,
                decode_result: DecodeResult::Ok {
                    codec: "FLAC".to_string(),
                    sample_rate: 44100,
                    channels: 2,
                },
                playback_result: PlaybackResult::Played,
                human_audible: Some(true),
            }],
        };

        let json = serde_json::to_string(&report).unwrap();
        assert!(
            !json.contains("Users"),
            "Report must not contain directory components: {json}"
        );
        assert!(
            !json.contains("dogfood"),
            "Report must not contain usernames: {json}"
        );
        assert!(
            !json.contains("Music"),
            "Report must not contain parent directory: {json}"
        );
        assert!(
            json.contains("secret.flac"),
            "Report SHOULD contain the basename: {json}"
        );
    }
}
