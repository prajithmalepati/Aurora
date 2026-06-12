"""Central path resolution for Aurora's data directory.

Resolution order for the data directory:
  1. AURORA_DATA_DIR environment variable (if set)
  2. platformdirs.user_data_dir("Aurora") (OS-appropriate default)

All persistent data (database, album art, playlist images) lives here,
decoupled from the source tree for packaging compatibility.
"""
import os
from pathlib import Path

from platformdirs import user_data_dir

DATA_DIR = Path(os.environ.get("AURORA_DATA_DIR", user_data_dir("Aurora")))

DB_PATH = DATA_DIR / "aurora.db"
ALBUM_ART_DIR = DATA_DIR / "album-art"
PLAYLIST_IMAGES_DIR = DATA_DIR / "playlist-images"
