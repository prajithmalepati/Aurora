//! Row structs mirroring backend/app/models.py.
//!
//! Only enough coverage to prove a read through core::db this cycle.
//! Full model coverage comes with the router ports.

use rusqlite::Row;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Song {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration: Option<i64>,
    pub file_path: Option<String>,
    pub source: String,
    pub external_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub file_format: Option<String>,
    pub album_art_path: Option<String>,
    pub waveform_peaks: Option<String>,
    pub dominant_color: Option<String>,
    pub dominant_color_2: Option<String>,
    pub file_mtime: Option<f64>,
    pub replaygain_track_gain: Option<f64>,
    pub replaygain_track_peak: Option<f64>,
    pub replaygain_album_gain: Option<f64>,
    pub replaygain_album_peak: Option<f64>,
    pub bitrate: Option<i64>,
    pub sample_rate: Option<i64>,
    pub bit_depth: Option<i64>,
    pub file_size: Option<i64>,
    pub artists: Option<String>,
    pub featured_artists: Option<String>,
    pub stream_url: Option<String>,
    pub stream_url_expires_at: Option<String>,
    pub artwork_url: Option<String>,
}

impl Song {
    /// Map from a rusqlite Row. Uses named column access (order-independent).
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            title: row.get("title")?,
            artist: row.get("artist")?,
            album: row.get("album")?,
            duration: row.get("duration")?,
            file_path: row.get("file_path")?,
            source: row.get("source")?,
            external_id: row.get("external_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            file_format: row.get("file_format")?,
            album_art_path: row.get("album_art_path")?,
            waveform_peaks: row.get("waveform_peaks")?,
            dominant_color: row.get("dominant_color")?,
            dominant_color_2: row.get("dominant_color_2")?,
            file_mtime: row.get("file_mtime")?,
            replaygain_track_gain: row.get("replaygain_track_gain")?,
            replaygain_track_peak: row.get("replaygain_track_peak")?,
            replaygain_album_gain: row.get("replaygain_album_gain")?,
            replaygain_album_peak: row.get("replaygain_album_peak")?,
            bitrate: row.get("bitrate")?,
            sample_rate: row.get("sample_rate")?,
            bit_depth: row.get("bit_depth")?,
            file_size: row.get("file_size")?,
            artists: row.get("artists")?,
            featured_artists: row.get("featured_artists")?,
            stream_url: row.get("stream_url")?,
            stream_url_expires_at: row.get("stream_url_expires_at")?,
            artwork_url: row.get("artwork_url")?,
        })
    }

    /// Fetch songs with optional LIMIT. Reads directly from the songs table.
    pub fn fetch_all(
        conn: &rusqlite::Connection,
        limit: Option<i64>,
    ) -> rusqlite::Result<Vec<Self>> {
        let sql = match limit {
            Some(_) => "SELECT * FROM songs LIMIT ?1",
            None => "SELECT * FROM songs",
        };
        let mut stmt = conn.prepare(sql)?;
        let mut rows = match limit {
            Some(n) => stmt.query(rusqlite::params![n])?,
            None => stmt.query([])?,
        };
        let mut songs = Vec::new();
        while let Some(row) = rows.next()? {
            songs.push(Song::from_row(row)?);
        }
        Ok(songs)
    }
}
