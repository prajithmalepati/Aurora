#!/usr/bin/env python3
"""Generate test audio fixtures with known tags for parity testing.

Creates short synthesized audio files in MP3, FLAC, OGG, and M4A formats
with known metadata (title, artist, album, ReplayGain tags, embedded art).

Run from Aurora/backend: source venv/bin/activate && python ../rust/core/tests/fixtures/generate_fixtures.py
"""
import subprocess
import json
import sys
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

# Minimal 1x1 red JPEG for album art (smallest valid JPEG)
JPEG_1X1_RED = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb00430008060607060508070707"
    "0909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c"
    "2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4"
    "001f0000010501010101010100000000000000000102030405060708090a0bffc40000"
    "ffda00080101000003f4007b10ffd9"
)


def run_ffmpeg(args: list[str]) -> bool:
    """Run ffmpeg and return success status."""
    result = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error"] + args,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr}", file=sys.stderr)
        return False
    return True


def generate_mp3(path: Path) -> bool:
    """Generate a 1-second MP3 with ID3 tags + ReplayGain TXXX frames."""
    # Generate raw audio first
    ok = run_ffmpeg([
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-codec:a", "libmp3lame", "-b:a", "128k",
        str(path),
    ])
    if not ok:
        return False

    # Tag with mutagen
    from mutagen.easyid3 import EasyID3
    from mutagen.id3 import ID3, TXXX, APIC

    try:
        audio = EasyID3(str(path))
    except Exception:
        audio = EasyID3()

    audio["title"] = ["Test Song"]
    audio["artist"] = ["Primary Artist; Secondary Artist"]
    audio["album"] = ["Test Album"]
    audio.save()

    # Add TXXX ReplayGain + APIC via ID3 directly
    id3 = ID3(str(path))
    id3.add(TXXX(desc="replaygain_track_gain", text=["-6.5 dB"]))
    id3.add(TXXX(desc="replaygain_track_peak", text=["0.95"]))
    id3.add(TXXX(desc="replaygain_album_gain", text=["-8.2 dB"]))
    id3.add(TXXX(desc="replaygain_album_peak", text=["0.88"]))
    id3.add(APIC(encoding=3, mime="image/jpeg", type=3, desc="Cover", data=JPEG_1X1_RED))
    id3.save()

    return True


def generate_flac(path: Path) -> bool:
    """Generate a 1-second FLAC with Vorbis comments + ReplayGain."""
    ok = run_ffmpeg([
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-codec:a", "flac",
        str(path),
    ])
    if not ok:
        return False

    from mutagen.flac import FLAC, Picture
    import base64

    audio = FLAC(str(path))
    audio["title"] = ["FLAC Test"]
    audio["artist"] = ["Artist A / Artist B"]
    audio["album"] = ["FLAC Album"]
    # Multi-value artist: two separate ARTIST tags
    audio["artist"] = ["Artist A", "Artist B"]
    # ReplayGain
    audio["REPLAYGAIN_TRACK_GAIN"] = ["-4.3 dB"]
    audio["REPLAYGAIN_TRACK_PEAK"] = ["0.92"]
    audio["REPLAYGAIN_ALBUM_GAIN"] = ["-7.1 dB"]
    audio["REPLAYGAIN_ALBUM_PEAK"] = ["0.85"]

    # Embedded picture
    pic = Picture()
    pic.type = 3
    pic.mime = "image/jpeg"
    pic.desc = "Cover"
    pic.data = JPEG_1X1_RED
    audio.add_picture(pic)

    audio.save()
    return True


def generate_ogg(path: Path) -> bool:
    """Generate a 1-second OGG Vorbis with Vorbis comments + ReplayGain + art."""
    ok = run_ffmpeg([
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-codec:a", "libvorbis", "-q:a", "3",
        str(path),
    ])
    if not ok:
        return False

    import base64
    from mutagen.flac import Picture
    from mutagen.oggvorbis import OggVorbis

    audio = OggVorbis(str(path))
    audio["title"] = ["OGG Test"]
    audio["artist"] = ["OGG Artist feat. Guest"]
    audio["album"] = ["OGG Album"]
    audio["REPLAYGAIN_TRACK_GAIN"] = ["-3.0 dB"]
    audio["REPLAYGAIN_TRACK_PEAK"] = ["0.98"]

    # Embed cover art via metadata_block_picture (base64-encoded FLAC Picture)
    pic = Picture()
    pic.type = 3  # Cover (front)
    pic.mime = "image/jpeg"
    pic.desc = "Cover"
    pic.data = JPEG_1X1_RED
    audio["metadata_block_picture"] = [base64.b64encode(pic.write()).decode("ascii")]

    audio.save()

    return True


def generate_m4a_aac(path: Path) -> bool:
    """Generate a 1-second M4A (AAC) with MP4/iTunes tags."""
    ok = run_ffmpeg([
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-codec:a", "aac", "-b:a", "128k",
        str(path),
    ])
    if not ok:
        return False

    from mutagen.mp4 import MP4, MP4Cover

    audio = MP4(str(path))
    audio["\xa9nam"] = ["M4A Test"]
    audio["\xa9ART"] = ["M4A Artist"]
    audio["\xa9alb"] = ["M4A Album"]
    # ReplayGain via iTunes freeform atoms
    audio["----:com.apple.iTunes:replaygain_track_gain"] = [b"-5.0 dB"]
    audio["----:com.apple.iTunes:replaygain_track_peak"] = [b"0.90"]
    # Cover art
    audio["covr"] = [MP4Cover(JPEG_1X1_RED, imageformat=MP4Cover.FORMAT_JPEG)]
    audio.save()

    return True


def extract_reference_metadata(file_path: str) -> dict:
    """Extract metadata using the Python scanner (reference implementation)."""
    # Add backend to path
    backend_dir = str(Path(__file__).resolve().parents[3] / "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    import mutagen
    from app.services.file_scanner import (
        extract_metadata, _get_art_bytes,
    )

    meta = extract_metadata(file_path)
    if meta is None:
        return {"error": "extract_metadata returned None"}

    # Real art check: use _get_art_bytes with a full (non-easy) mutagen handle,
    # since easy-mode hides APIC picture frames on MP3.
    has_art = False
    try:
        audio = mutagen.File(file_path)
        has_art = _get_art_bytes(audio) is not None
    except Exception:
        pass

    # Remove fields not in scope for N30 (analysis half)
    in_scope = {
        "title": meta["title"],
        "artist": meta["artist"],
        "album": meta["album"],
        "artists": meta["artists"],
        "featured_artists": meta["featured_artists"],
        "duration": meta["duration"],
        "file_format": meta["file_format"],
        "bitrate": meta.get("bitrate"),
        "sample_rate": meta.get("sample_rate"),
        "bit_depth": meta.get("bit_depth"),
        "file_size": meta.get("file_size"),
        "replaygain_track_gain": meta.get("replaygain_track_gain"),
        "replaygain_track_peak": meta.get("replaygain_track_peak"),
        "replaygain_album_gain": meta.get("replaygain_album_gain"),
        "replaygain_album_peak": meta.get("replaygain_album_peak"),
        "has_album_art": has_art,
    }
    return in_scope


def main():
    print("Generating audio fixtures...")

    fixtures = [
        ("test_song.mp3", generate_mp3),
        ("test_song.flac", generate_flac),
        ("test_song.ogg", generate_ogg),
        ("test_song.m4a", generate_m4a_aac),
    ]

    results = {}
    for name, generator in fixtures:
        path = FIXTURES_DIR / name
        print(f"  {name}...", end=" ")
        if generator(path):
            print("OK")
            # Extract reference metadata
            meta = extract_reference_metadata(str(path))
            results[name] = meta
            print(f"    format={meta.get('file_format')}, "
                  f"artist={meta.get('artist')}, "
                  f"rg_track={meta.get('replaygain_track_gain')}")
        else:
            print("FAILED")
            results[name] = {"error": "generation failed"}

    # Write reference JSON
    ref_path = FIXTURES_DIR / "reference_metadata.json"
    with open(ref_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nReference metadata written to {ref_path}")


if __name__ == "__main__":
    main()
