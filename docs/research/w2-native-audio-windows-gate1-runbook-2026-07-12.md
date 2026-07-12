# W2 Gate-1 Runbook — Windows Native Audio Evidence

**Date:** 2026-07-12
**Spike:** `rust/spikes/w2-native-audio-windows-evidence/`
**Stack:** rodio 0.22.2 + symphonia 0.5.5 (WASAPI via cpal 0.17.x)
**Machine:** alienware2 (Windows dogfood)

---

## Prerequisites

1. Rust toolchain installed (`rustup`).
2. The spike package checked out on the Windows machine:
   ```powershell
   git clone https://github.com/<owner>/Aurora.git
   cd Aurora
   git checkout spike/w2-native-audio-windows-evidence
   ```
3. Speakers/headphones connected and audible.

## Test files

Replace the placeholders below with actual file paths on the dogfood machine.
**Do NOT paste full local paths or audio file contents into chat, commits, or logs.**
Use only basenames in all reports.

| # | Role | Placeholder | Notes |
|---|------|-------------|-------|
| 1 | Previously failing high-bitrate FLAC | `<FAILING_FLAC_1>` | 24-bit / 96kHz or higher, known to stutter/drop on Howler |
| 2 | Previously failing high-bitrate FLAC | `<FAILING_FLAC_2>` | Different codec profile or sample rate from #1 |
| 3 | Previously failing high-bitrate FLAC | `<FAILING_FLAC_3>` | Third variant if available |
| 4 | Known-working control FLAC | `<CONTROL_FLAC>` | ~1075 kbps, 16-bit / 44.1kHz — must play cleanly |
| 5 | MP3 or OGG control | `<CONTROL_MP3_OGG>` | Any standard MP3 or OGG to verify non-FLAC path |

## Step 1 — Build the harness

```powershell
cd rust\spikes\w2-native-audio-windows-evidence
cargo build --release 2>&1 | Tee-Object -FilePath ..\..\..\build-log.txt
```

Expected: clean build, no errors. Warnings about unused imports are acceptable.

## Step 2 — Run the evidence harness

Run all test files in a single invocation. The harness plays each file sequentially,
probes metadata, then prompts for audible confirmation.

```powershell
.\target\release\w2-evidence.exe ^
    "<FAILING_FLAC_1>" ^
    "<FAILING_FLAC_2>" ^
    "<FAILING_FLAC_3>" ^
    "<CONTROL_FLAC>" ^
    "<CONTROL_MP3_OGG>" ^
    2>&1 | Tee-Object -FilePath ..\..\..\evidence-output.txt
```

For each file, the harness will:
1. Print codec, sample rate, channels, bit depth, duration.
2. Play the file through WASAPI (you should hear it).
3. Prompt: `Was '<basename>' audible? [y/n/skip]`
   - Type `y` + Enter if you heard clean audio.
   - Type `n` + Enter if audio was silent, garbled, or errored.
   - Type anything else to skip.

## Step 3 — Capture the sanitised report

The harness prints a JSON report at the end between `=== SANITISED REPORT ===`
and `=== END REPORT ===`. Copy just that JSON block to a file **outside** the repo:

```powershell
# Extract the JSON report from the output
$content = Get-Content ..\..\..\evidence-output.txt -Raw
$start = $content.IndexOf("=== SANITISED REPORT ===")
$end = $content.IndexOf("=== END REPORT ===")
$json = $content.Substring($start + 25, $end - $start - 25).Trim()
$json | Out-File -FilePath ..\..\..\w2-evidence-report.json -Encoding utf8
```

The report contains ONLY: basename, extension, codec, sample rate, channels,
bit depth, duration, decode result, playback result, and human audible flag.
No absolute paths, no tokens, no file contents.

## Step 4 — Verify output device

The report's `audio_backend` field should read `"WASAPI"`. If it reads anything
else, the evidence is invalid — file a blocker.

## Step 5 — Media key and lock-screen behaviour

After the harness finishes:
1. Play a song in any media player (Spotify, foobar2000, etc.).
2. Press the keyboard media play/pause key. Confirm it still works.
3. Lock the screen (Win+L). Confirm audio continues or pauses as expected
   for the player (this is app behaviour, not harness behaviour).
4. Note any anomalies in the evidence output file.

## Step 6 — Report

Paste ONLY the following into your completion message:
- The `w2-evidence-report.json` content (already sanitised).
- Whether media keys and lock-screen behaved normally.
- Any anomalies observed.

**Do NOT paste:**
- Full local file paths (e.g. `C:\Users\...\file.flac`).
- Audio file contents or base64-encoded audio.
- Build logs with system paths.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERROR: Gate-1 evidence must be captured on Windows` | Running on Linux/Mac | Must run on the Windows dogfood machine |
| `Decode FAILED: [probe] ...` | symphonia can't read the file | Check file isn't corrupted; try `ffprobe` to verify |
| `Playback FAILED: [output_stream] ...` | No audio device | Check speakers/headphones connected; Windows sound settings |
| `Playback FAILED: [decode] ...` | rodio can't decode | symphonia probe succeeded but rodio decoder failed; file a bug |
| Silent playback | Volume muted or wrong device | Check Windows volume mixer; ensure correct output device |

## What this runbook does NOT prove

- Crossfade behaviour (not tested here).
- Gapless playback (not tested here).
- Trim gating (not tested here).
- Media key integration with Aurora (not tested here).
- Long-running stability (single playback per file only).

This is Gate-1 evidence only. G2, WD-08, and N56 remain unfulfilled until
the full native audio engine is implemented and tested.
