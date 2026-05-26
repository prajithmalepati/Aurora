import pytest
from pathlib import Path
from app.services.file_scanner import extract_peaks


def test_extract_peaks_bad_path():
    result = extract_peaks("/nonexistent/file.mp3")
    assert result is None


def test_extract_peaks_returns_1000_bins_or_none(tmp_path):
    import struct
    wav_path = tmp_path / "silence.wav"
    data_size = 22050 * 2  # 1 second of 16-bit mono at 22050Hz
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, 22050, 22050 * 2, 2, 16,
        b"data", data_size,
    )
    wav_path.write_bytes(header + b"\x00" * data_size)

    result = extract_peaks(str(wav_path))
    assert result is None or (len(result) == 1000 and all(0.0 <= v <= 1.0 for v in result))
