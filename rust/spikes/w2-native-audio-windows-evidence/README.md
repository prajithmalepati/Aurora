# W2 Evidence Harness

Standalone, disposable probe that tests whether rodio 0.22.2 / symphonia 0.5.5
can decode and audibly play audio files through Windows WASAPI.

**This is not a production audio engine.** It is a Gate-1 evidence tool.

## Usage (Windows only)

```
cargo build --release
.\target\release\w2-evidence.exe file1.flac file2.mp3 ...
```

On non-Windows, the harness exits with a clear error message.

## What it does

1. Probes each file with symphonia (codec, sample rate, channels, bit depth, duration).
2. Plays through rodio's default output stream (WASAPI on Windows).
3. Prompts for human audible/not-audible confirmation.
4. Emits a sanitised JSON report — no absolute paths included.

## Tests

```
cargo test
```

11 tests covering: filename redaction, extension extraction, report schema
roundtrip, non-Windows fail-closed, path sanitisation in serialised output.

## Static checks

```
cargo fmt --check
cargo clippy -- -D warnings
```

## Scope

- Only this directory and `docs/research/w2-native-audio-windows-gate1-runbook-2026-07-12.md`
- Does NOT modify Aurora's workspace, Cargo.toml, frontend, backend, or CI
- Does NOT integrate with PlaybackEngine, useAudioPlayer, settings, or Howler
