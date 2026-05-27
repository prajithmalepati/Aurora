import sys
sys.path.insert(0, '.')
from app.database import get_db
from app.routers.songs import song_row_to_dict

conn = get_db()
cursor = conn.cursor()
cursor.execute(
    """SELECT s.id, s.title, s.artist, s.album, s.duration,
       s.file_path, s.file_format, s.album_art_path, s.source,
       s.waveform_peaks, s.dominant_color, s.dominant_color_2,
       GROUP_CONCAT(t.name) as tags,
       GROUP_CONCAT(p.id || ':' || p.name) as playlists,
       s.created_at, s.updated_at
       FROM songs s
       LEFT JOIN song_tags st ON s.id = st.song_id
       LEFT JOIN tags t ON st.tag_id = t.id
       LEFT JOIN playlist_songs ps ON s.id = ps.song_id
       LEFT JOIN playlists p ON ps.playlist_id = p.id
       WHERE s.id = 6 GROUP BY s.id"""
)
row = cursor.fetchone()
print("row keys:", list(row.keys()))
print("dominant_color raw:", row["dominant_color"])
d = song_row_to_dict(row)
print("dominant_color in dict:", d.get("dominant_color"))
print("waveform_peaks len:", len(d["waveform_peaks"]) if d.get("waveform_peaks") else 0)
print("all new keys:", [k for k in d.keys() if "color" in k or "wave" in k])
