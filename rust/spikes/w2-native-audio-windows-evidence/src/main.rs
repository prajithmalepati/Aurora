use std::env;
use std::fs::File;
use std::io::{self, Write};
use std::path::Path;

use symphonia::core::codecs::CODEC_TYPE_NULL;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use w2_evidence::{
    extension_of, redact_path, require_windows_backend, DecodeResult, FileReport, HarnessReport,
    PlaybackResult,
};

fn probe_file(
    path: &str,
) -> (
    DecodeResult,
    Option<u32>,
    Option<u16>,
    Option<u16>,
    Option<f64>,
) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            return (
                DecodeResult::Err {
                    category: "io".to_string(),
                    message: e.to_string(),
                },
                None,
                None,
                None,
                None,
            );
        }
    };

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path).extension() {
        hint.with_extension(&ext.to_string_lossy());
    }

    let meta_opts = MetadataOptions::default();
    let fmt_opts = FormatOptions::default();

    let probed = match symphonia::default::get_probe().format(&hint, mss, &fmt_opts, &meta_opts) {
        Ok(p) => p,
        Err(e) => {
            return (
                DecodeResult::Err {
                    category: "probe".to_string(),
                    message: e.to_string(),
                },
                None,
                None,
                None,
                None,
            );
        }
    };

    let format = probed.format;

    // Find the first audio track.
    let track = match format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
    {
        Some(t) => t,
        None => {
            return (
                DecodeResult::Err {
                    category: "probe".to_string(),
                    message: "no audio track found".to_string(),
                },
                None,
                None,
                None,
                None,
            );
        }
    };

    let cp = &track.codec_params;
    let sample_rate = cp.sample_rate;
    let channels = cp.channels.map(|c| c.count() as u16);
    let bits_per_sample = cp.bits_per_sample.map(|b| b as u16);

    // Duration from time_base + n_frames.
    let duration_secs = match (cp.n_frames, cp.time_base) {
        (Some(frames), Some(tb)) => {
            let time = tb.calc_time(frames);
            Some(time.seconds as f64 + time.frac)
        }
        _ => None,
    };

    let codec_name = format!("{:?}", cp.codec);

    (
        DecodeResult::Ok {
            codec: codec_name.clone(),
            sample_rate: sample_rate.unwrap_or(0),
            channels: channels.unwrap_or(0),
        },
        sample_rate,
        channels,
        bits_per_sample,
        duration_secs,
    )
}

fn play_file_windows(path: &str) -> PlaybackResult {
    // rodio 0.22.2 API: DeviceSinkBuilder → Player → append → sleep_until_end.
    let handle = match rodio::DeviceSinkBuilder::open_default_sink() {
        Ok(h) => h,
        Err(e) => {
            return PlaybackResult::Err {
                category: "output_stream".to_string(),
                message: e.to_string(),
            };
        }
    };

    let player = rodio::Player::connect_new(handle.mixer());

    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            return PlaybackResult::Err {
                category: "io".to_string(),
                message: e.to_string(),
            };
        }
    };

    let source = match rodio::Decoder::try_from(file) {
        Ok(s) => s,
        Err(e) => {
            return PlaybackResult::Err {
                category: "decode".to_string(),
                message: e.to_string(),
            };
        }
    };

    player.append(source);

    // Block until playback finishes.
    player.sleep_until_end();

    PlaybackResult::Played
}

fn prompt_human(basename: &str) -> Option<bool> {
    print!("  >> Was '{basename}' audible? [y/n/skip]: ");
    io::stdout().flush().ok();

    let mut input = String::new();
    if io::stdin().read_line(&mut input).is_err() {
        return None;
    }

    match input.trim().to_lowercase().as_str() {
        "y" | "yes" => Some(true),
        "n" | "no" => Some(false),
        _ => None,
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();

    if args.is_empty() {
        eprintln!("w2-evidence: Windows native audio evidence harness");
        eprintln!();
        eprintln!("Usage: w2-evidence <file1.flac> [file2.mp3] ...");
        eprintln!();
        eprintln!("Probes and plays audio files through rodio/symphonia (WASAPI on Windows).");
        eprintln!("Emits a sanitised JSON report — no absolute paths are included.");
        std::process::exit(1);
    }

    // Platform gate: fail closed on non-Windows.
    let backend = match require_windows_backend() {
        Ok(b) => b,
        Err(msg) => {
            eprintln!("ERROR: {msg}");
            eprintln!();
            eprintln!("This harness must be run on the Windows dogfood machine.");
            eprintln!("ALSA/Pulse playback does not constitute WASAPI evidence.");
            std::process::exit(2);
        }
    };

    println!("w2-evidence: Windows native audio evidence harness");
    println!("Audio backend: {backend}");
    println!("rodio version: {}", env!("CARGO_PKG_VERSION"));
    println!("Processing {} file(s)...\n", args.len());

    let mut reports = Vec::new();

    for path in &args {
        let basename = redact_path(path);
        let ext = extension_of(path);

        println!("--- {basename} ---");

        // Check file exists.
        if !Path::new(path).exists() {
            eprintln!("  ERROR: file not found: {basename}");
            reports.push(FileReport {
                basename,
                extension: ext,
                codec: None,
                sample_rate: None,
                channels: None,
                bit_depth: None,
                duration_secs: None,
                decode_result: DecodeResult::Err {
                    category: "io".to_string(),
                    message: "file not found".to_string(),
                },
                playback_result: PlaybackResult::Skipped,
                human_audible: None,
            });
            continue;
        }

        // Probe/decode.
        let (decode_result, sample_rate, channels, bit_depth, duration_secs) = probe_file(path);

        match &decode_result {
            DecodeResult::Ok {
                codec,
                sample_rate,
                channels,
            } => {
                println!("  Codec:       {codec}");
                println!("  Sample rate: {sample_rate} Hz");
                println!("  Channels:    {channels}");
                if let Some(bd) = bit_depth {
                    println!("  Bit depth:   {bd}-bit");
                }
                if let Some(d) = duration_secs {
                    println!("  Duration:    {:.1}s", d);
                }
            }
            DecodeResult::Err { category, message } => {
                println!("  Decode FAILED: [{category}] {message}");
            }
        }

        // Play (only if decode succeeded).
        let playback_result = match &decode_result {
            DecodeResult::Ok { .. } => {
                println!("  Playing through {backend}...");
                play_file_windows(path)
            }
            _ => {
                println!("  Skipping playback (decode failed).");
                PlaybackResult::Skipped
            }
        };

        match &playback_result {
            PlaybackResult::Played => println!("  Playback complete."),
            PlaybackResult::Skipped => println!("  Playback skipped."),
            PlaybackResult::Err { category, message } => {
                println!("  Playback FAILED: [{category}] {message}");
            }
        }

        // Human confirmation.
        let human_audible = match &playback_result {
            PlaybackResult::Played => prompt_human(&basename),
            _ => None,
        };

        match human_audible {
            Some(true) => println!("  Human confirmed: AUDIBLE"),
            Some(false) => println!("  Human confirmed: NOT AUDIBLE"),
            None => println!("  Human confirmation: skipped"),
        }

        reports.push(FileReport {
            basename,
            extension: ext,
            codec: None,
            sample_rate,
            channels,
            bit_depth,
            duration_secs,
            decode_result,
            playback_result,
            human_audible,
        });

        println!();
    }

    // Emit final report.
    let report = HarnessReport {
        platform: std::env::consts::OS.to_string(),
        audio_backend: backend,
        rodio_version: env!("CARGO_PKG_VERSION").to_string(),
        files: reports,
    };

    let json = serde_json::to_string_pretty(&report).expect("report serialisation failed");
    println!("=== SANITISED REPORT ===");
    println!("{json}");
    println!("=== END REPORT ===");
}
