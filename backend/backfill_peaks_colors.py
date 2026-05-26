"""Backfill waveform_peaks + dominant_color for existing songs."""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.file_scanner import extract_peaks, extract_dominant_colors

DB_PATH = Path(__file__).parent / "aurora.db"
ART_DIR = Path(__file__).parent / "album-art"


def backfill():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, file_path, album_art_path FROM songs WHERE waveform_peaks IS NULL OR dominant_color IS NULL"
    ).fetchall()

    print(f"Songs to backfill: {len(rows)}")
    ok = 0
    fail_peaks = 0
    fail_color = 0

    for i, row in enumerate(rows):
        song_id = row["id"]
        file_path = row["file_path"]
        art_path = row["album_art_path"]

        peaks = extract_peaks(file_path)
        if peaks is None:
            fail_peaks += 1

        color1 = color2 = None
        if art_path:
            art_file = ART_DIR / art_path
            if art_file.exists():
                art_data = art_file.read_bytes()
                color1, color2 = extract_dominant_colors(art_data)
        if color1 is None:
            fail_color += 1

        conn.execute(
            "UPDATE songs SET waveform_peaks = ?, dominant_color = ?, dominant_color_2 = ? WHERE id = ?",
            (
                json.dumps(peaks) if peaks else None,
                color1,
                color2,
                song_id,
            ),
        )
        ok += 1
        if (i + 1) % 10 == 0:
            conn.commit()
            print(f"  {i+1}/{len(rows)} processed...")

    conn.commit()
    conn.close()
    print(f"Done. ok={ok}, peaks_failed={fail_peaks}, color_failed={fail_color}")


if __name__ == "__main__":
    backfill()
