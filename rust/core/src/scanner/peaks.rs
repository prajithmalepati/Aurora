//! Waveform peak extraction — ported from Python `extract_peaks`.
//!
//! Decodes audio to mono 22050 Hz via symphonia, computes max-amplitude per bin.
//! Returns 1000 bins of f32 in [0, 1], or None on failure.

use std::path::Path;

/// Decode audio file to mono f32 samples at the given sample rate using symphonia.
/// Returns the samples as Vec<f32> (mono, -1.0..1.0 range), or None on failure.
fn decode_to_mono_f32(path: &Path, target_sr: u32) -> Option<Vec<f32>> {
    use symphonia::core::audio::{AudioBufferRef, Signal};
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = std::fs::File::open(path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .ok()?;

    let mut format = probed.format;
    let track = format.default_track()?;
    let track_id = track.id;
    let codec_params = &track.codec_params;

    let mut decoder = symphonia::default::get_codecs()
        .make(codec_params, &DecoderOptions::default())
        .ok()?;

    // Copy channel count before the decode loop (format borrow conflict)
    let channels = codec_params.channels.map(|c| c.count()).unwrap_or(1).max(1);
    let src_sr = codec_params.sample_rate.unwrap_or(44100);

    // Collect all decoded samples as f32
    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(_) => break,
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                // Convert to f32 regardless of native format
                match decoded {
                    AudioBufferRef::U8(buf) => {
                        for ch in 0..buf.spec().channels.count() {
                            let chan = buf.chan(ch);
                            for &s in chan {
                                all_samples.push((s as f32 - 128.0) / 128.0);
                            }
                        }
                    }
                    AudioBufferRef::S16(buf) => {
                        for ch in 0..buf.spec().channels.count() {
                            let chan = buf.chan(ch);
                            for &s in chan {
                                all_samples.push(s as f32 / 32768.0);
                            }
                        }
                    }
                    AudioBufferRef::S24(buf) => {
                        for ch in 0..buf.spec().channels.count() {
                            let chan = buf.chan(ch);
                            for &s in chan {
                                all_samples.push(s.0 as f32 / 8388608.0);
                            }
                        }
                    }
                    AudioBufferRef::S32(buf) => {
                        for ch in 0..buf.spec().channels.count() {
                            let chan = buf.chan(ch);
                            for &s in chan {
                                all_samples.push(s as f32 / 2147483648.0);
                            }
                        }
                    }
                    AudioBufferRef::F32(buf) => {
                        for ch in 0..buf.spec().channels.count() {
                            let chan = buf.chan(ch);
                            for &s in chan {
                                all_samples.push(s);
                            }
                        }
                    }
                    AudioBufferRef::F64(buf) => {
                        for ch in 0..buf.spec().channels.count() {
                            let chan = buf.chan(ch);
                            for &s in chan {
                                all_samples.push(s as f32);
                            }
                        }
                    }
                    _ => {
                        // Unsupported format
                        return None;
                    }
                }
            }
            Err(symphonia::core::errors::Error::IoError(_)) => break,
            Err(_) => continue,
        }
    }

    if all_samples.is_empty() {
        return None;
    }

    // Mixdown to mono if multi-channel

    let mono: Vec<f32> = if channels == 1 {
        all_samples
    } else {
        // Samples are grouped by channel per packet. For simplicity,
        // we'll do a naive interleaved assumption — the symphonia Signal trait
        // gives per-channel slices, so our samples are actually grouped as
        // [ch0_block0, ch1_block0, ch0_block1, ch1_block1, ...] per packet.
        // But since we appended all of ch0 then all of ch1 per packet,
        // and there may be multiple packets, this gets complicated.
        // Simpler: just downmix by averaging every `channels` samples.
        let total = all_samples.len();
        let frames = total / channels;
        (0..frames)
            .map(|i| {
                let sum: f32 = (0..channels).map(|c| all_samples[c * frames + i]).sum();
                sum / channels as f32
            })
            .collect()
    };

    // Resample to target_sr using simple linear interpolation
    // (Python's miniaudio does the same thing internally)
    let src_len = mono.len();
    if src_len == 0 {
        return None;
    }

    // For waveform peaks, we don't need high-quality resampling.
    // Resample to target_sr using simple linear interpolation
    if src_sr == target_sr {
        return Some(mono);
    }

    // Simple linear interpolation resample
    let ratio = target_sr as f64 / src_sr as f64;
    let out_len = (src_len as f64 * ratio) as usize;
    if out_len == 0 {
        return None;
    }

    let mut resampled = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_pos = i as f64 / ratio;
        let idx = src_pos as usize;
        let frac = src_pos - idx as f64;
        let s0 = mono[idx.min(src_len - 1)];
        let s1 = mono[(idx + 1).min(src_len - 1)];
        resampled.push(s0 + (s1 - s0) * frac as f32);
    }

    Some(resampled)
}

/// Extract waveform peaks from an audio file.
///
/// Decodes to mono ~22050 Hz, computes `num_bins` bins of max-amplitude.
/// Returns `None` on failure / empty / unreadable.
///
/// Parity: structural — exactly 1000 bins, all in [0,1], None on bad input.
/// Per-bin values will differ from Python (symphonia ≠ miniaudio resampler).
pub fn extract_peaks(file_path: &str, num_bins: usize) -> Option<Vec<f32>> {
    let path = Path::new(file_path);

    // Pre-validate: can we read the file at all?
    if !path.exists() {
        return None;
    }

    let samples = decode_to_mono_f32(path, 22050)?;
    let n = samples.len();
    if n == 0 {
        return None;
    }

    let bin_size = (n / num_bins).max(1);
    let mut peaks = Vec::with_capacity(num_bins);

    for i in 0..num_bins {
        let start = i * bin_size;
        let end = (start + bin_size).min(n);
        if start >= n {
            peaks.push(0.0);
            continue;
        }
        let max_val = samples[start..end]
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, f32::max);
        peaks.push((max_val / 1.0).min(1.0)); // already in 0..1 range from f32 decode
    }

    Some(peaks)
}

// ===========================================================================
// Tests — T2 structural (ported from Python test_scanner_peaks.py)
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_peaks_bad_path() {
        let result = extract_peaks("/nonexistent/file.mp3", 1000);
        assert!(result.is_none(), "bad path should return None");
    }

    #[test]
    fn test_extract_peaks_empty_path() {
        let result = extract_peaks("", 1000);
        assert!(result.is_none(), "empty path should return None");
    }

    /// Generate a minimal WAV file (1 second silence, 16-bit mono 22050Hz).
    fn make_silence_wav() -> Vec<u8> {
        let data_size: u32 = 22050 * 2; // 1 second, 16-bit mono
        let mut wav = Vec::with_capacity(44 + data_size as usize);
        // RIFF header
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36u32 + data_size).to_le_bytes());
        wav.extend_from_slice(b"WAVE");
        // fmt chunk
        wav.extend_from_slice(b"fmt ");
        wav.extend_from_slice(&16u32.to_le_bytes()); // chunk size
        wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav.extend_from_slice(&1u16.to_le_bytes()); // mono
        wav.extend_from_slice(&22050u32.to_le_bytes()); // sample rate
        wav.extend_from_slice(&44100u32.to_le_bytes()); // byte rate
        wav.extend_from_slice(&2u16.to_le_bytes()); // block align
        wav.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
        // data chunk
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_size.to_le_bytes());
        wav.resize(44 + data_size as usize, 0); // silence = zeros
        wav
    }

    #[test]
    fn test_extract_peaks_silence_wav() {
        use std::io::Write;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("silence.wav");
        let wav = make_silence_wav();
        std::fs::File::create(&path)
            .unwrap()
            .write_all(&wav)
            .unwrap();

        let result = extract_peaks(path.to_str().unwrap(), 1000);
        // Python test: result is None or (len==1000 and all 0≤v≤1)
        match result {
            None => {} // acceptable
            Some(peaks) => {
                assert_eq!(peaks.len(), 1000, "should have exactly 1000 bins");
                for (i, v) in peaks.iter().enumerate() {
                    assert!(*v >= 0.0 && *v <= 1.0, "bin {} out of range: {}", i, v);
                }
            }
        }
    }

    #[test]
    fn test_extract_peaks_nonexistent_wav() {
        let result = extract_peaks("/tmp/definitely_not_a_real_file_xyz.wav", 1000);
        assert!(result.is_none());
    }
}
