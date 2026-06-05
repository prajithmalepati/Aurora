"""One-off backfill: populate dominant_color / dominant_color_2 / bleed_thumb
(+ bleed region) for songs whose color fields are NULL.

Needed because songs scanned before the easy=True art-read fix in
extract_metadata never got their album-art colors computed, so the player-bar
color bleed falls back to the default color. Safe to re-run: only touches rows
where dominant_color IS NULL and the source file still exists.

Run:  venv/bin/python backfill_colors.py
"""
import sqlite3
import mutagen
from pathlib import Path
from datetime import datetime, timezone

from app.services.file_scanner import _get_art_bytes, extract_dominant_colors
from app.services.color_utils import extract_bright_region

DB = "aurora.db"


def main() -> None:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, file_path FROM songs WHERE dominant_color IS NULL"
    ).fetchall()
    print(f"{len(rows)} songs need backfill")

    updated = no_file = no_art = failed = 0
    for r in rows:
        path = r["file_path"]
        if not path or not Path(path).exists():
            no_file += 1
            continue
        try:
            art = _get_art_bytes(mutagen.File(path))
            if not art:
                no_art += 1
                continue
            c1, c2 = extract_dominant_colors(art)
            thumb, rx, ry, rw, rh = extract_bright_region(art)
            conn.execute(
                """UPDATE songs SET dominant_color=?, dominant_color_2=?,
                       bleed_thumb=?, bleed_region_x=?, bleed_region_y=?,
                       bleed_region_w=?, bleed_region_h=?, updated_at=?
                   WHERE id=?""",
                (c1, c2, thumb, rx, ry, rw, rh,
                 datetime.now(timezone.utc).isoformat(), r["id"]),
            )
            updated += 1
        except Exception as exc:
            failed += 1
            print(f"  id={r['id']} failed: {exc}")

    conn.commit()
    conn.close()
    print(f"updated={updated}  no_file={no_file}  no_embedded_art={no_art}  failed={failed}")


if __name__ == "__main__":
    main()
