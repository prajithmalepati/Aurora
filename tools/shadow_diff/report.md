# Shadow-Diff Parity Report (N40)

**Date:** 2026-07-04 20:55 UTC
**Total endpoints tested:** 51
**PASS:** 37 | **DIFF:** 13 | **WHITELISTED:** 0 | **ERROR:** 1

⚠️ **Non-whitelisted diffs found — requires planner adjudication.**

---

## DIFF (requires adjudication) (13)

### `GET GET /api/songs`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": [
    {
      "id": 2,
      "title": "Chill Vibes",
      "artist": "LoFi Girl",
      "album": null,
      "artists": null,
      "featured_artists": null,
      "duration": 180,
      "file_path": null,
      "file_format": null,
      "album_art_path": null,
      "source": "manual",
      "tags": [
        "slow",
        "chill"
      ],
      "playlists": [
        {
          "id": 2,
          "name": "Lo-Fi Study"
        }
      ],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": null,
      "sample_rate": null,
      "bit_depth": null,
      "file_size": null,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": null,
      "replaygain_track_peak": null,
      "replaygain_album_gain": null,
      "replaygain_album_peak": null,
      "stream_url": null,
      "stream_url_expires_at": null,
      "artwork_url": null
    },
    {
      "id": 4,
      "title": "FLAC Test",
      "artist": "Artist A",
      "album": "FLAC Album",
      "artists": [
        "Artist A",
        "Artist B"
      ],
      "featured_artists": null,
      "duration": 1,
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.flac",
      "file_format": "flac",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "source": "local_scan",
      "tags": [],
      "playlists": [],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": 96,
      "sample_rate": 44100,
      "bit_depth": 16,
      "file_size": 20324,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": -4.3,
      "replaygain_track_peak": 0.92,
      "replaygain_album_gain": -7.1,
      "replaygain_album_peak": 0.85,
      "stream_url": null,
      "stream_url_expires_at": nul
Rust   (normalized): {
  "data": [
    {
      "album": null,
      "album_art_path": null,
      "artist": "LoFi Girl",
      "artists": null,
      "artwork_url": null,
      "bit_depth": null,
      "bitrate": null,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 180,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": null,
      "file_path": null,
      "file_size": null,
      "id": 2,
      "playlists": [
        {
          "id": 2,
          "name": "Lo-Fi Study"
        }
      ],
      "position": null,
      "replaygain_album_gain": null,
      "replaygain_album_peak": null,
      "replaygain_track_gain": null,
      "replaygain_track_peak": null,
      "sample_rate": null,
      "source": "manual",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [
        "slow",
        "chill"
      ],
      "title": "Chill Vibes",
      "updated_at": "<TIMESTAMP>"
    },
    {
      "album": "FLAC Album",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "artist": "Artist A",
      "artists": [
        "Artist A",
        "Artist B"
      ],
      "artwork_url": null,
      "bit_depth": 16,
      "bitrate": 162,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 1,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": "flac",
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.flac",
      "file_size": 20324,
      "id": 4,
      "playlists": [],
      "position": null,
      "replaygain_album_gain": -7.1,
      "replaygain_album_peak": 0.85,
      "replaygain_track_gain": -4.3,
      "replaygain_track_peak": 0.92,
      "sample_rate": 44100,
      "source": "local_scan",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [],
      "title": "FLAC Test",
    
  ```

### `GET GET /api/songs/1`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": {
    "id": 1,
    "title": "Test Song",
    "artist": "Primary Artist",
    "album": "Test Album",
    "artists": [
      "Primary Artist",
      "Secondary Artist"
    ],
    "featured_artists": null,
    "duration": 1,
    "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
    "file_format": "mp3",
    "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
    "source": "local_scan",
    "tags": [
      "rock",
      "fast"
    ],
    "playlists": [
      {
        "id": 1,
        "name": "Rock Classics"
      }
    ],
    "created_at": "<TIMESTAMP>",
    "updated_at": "<TIMESTAMP>",
    "start_time_ms": 0,
    "end_time_ms": 0,
    "position": null,
    "bitrate": 127,
    "sample_rate": 44100,
    "bit_depth": null,
    "file_size": 18298,
    "dominant_color": null,
    "dominant_color_2": null,
    "replaygain_track_gain": -6.5,
    "replaygain_track_peak": 0.95,
    "replaygain_album_gain": -8.2,
    "replaygain_album_peak": 0.88,
    "stream_url": null,
    "stream_url_expires_at": null,
    "artwork_url": null,
    "waveform_peaks": "<PEAKS[1000]>"
  },
  "message": "ok"
}
Rust   (normalized): {
  "data": {
    "album": "Test Album",
    "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
    "artist": "Primary Artist",
    "artists": [
      "Primary Artist",
      "Secondary Artist"
    ],
    "artwork_url": null,
    "bit_depth": null,
    "bitrate": 140,
    "created_at": "<TIMESTAMP>",
    "dominant_color": null,
    "dominant_color_2": null,
    "duration": 1,
    "end_time_ms": 0,
    "featured_artists": null,
    "file_format": "mp3",
    "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
    "file_size": 18298,
    "id": 1,
    "playlists": [
      {
        "id": 1,
        "name": "Rock Classics"
      }
    ],
    "position": null,
    "replaygain_album_gain": -8.2,
    "replaygain_album_peak": 0.88,
    "replaygain_track_gain": -6.5,
    "replaygain_track_peak": 0.95,
    "sample_rate": 44100,
    "source": "local_scan",
    "start_time_ms": 0,
    "stream_url": null,
    "stream_url_expires_at": null,
    "tags": [
      "rock",
      "fast"
    ],
    "title": "Test Song",
    "updated_at": "<TIMESTAMP>",
    "waveform_peaks": "<PEAKS[1000]>"
  },
  "message": "ok"
}
  ```

### `POST POST /api/filter (rock)`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": [
    {
      "id": 1,
      "title": "Test Song",
      "artist": "Primary Artist",
      "album": "Test Album",
      "artists": [
        "Primary Artist",
        "Secondary Artist"
      ],
      "featured_artists": null,
      "duration": 1,
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
      "file_format": "mp3",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "source": "local_scan",
      "tags": [
        "fast",
        "rock",
        "rock classics"
      ],
      "playlists": [
        {
          "id": 1,
          "name": "Rock Classics"
        }
      ],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": 127,
      "sample_rate": 44100,
      "bit_depth": null,
      "file_size": 18298,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": -6.5,
      "replaygain_track_peak": 0.95,
      "replaygain_album_gain": -8.2,
      "replaygain_album_peak": 0.88,
      "stream_url": null,
      "stream_url_expires_at": null,
      "artwork_url": null
    }
  ],
  "meta": {
    "total": 1,
    "query": "rock"
  },
  "message": "ok"
}
Rust   (normalized): {
  "data": [
    {
      "album": "Test Album",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "artist": "Primary Artist",
      "artists": [
        "Primary Artist",
        "Secondary Artist"
      ],
      "artwork_url": null,
      "bit_depth": null,
      "bitrate": 140,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 1,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": "mp3",
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
      "file_size": 18298,
      "id": 1,
      "playlists": [
        {
          "id": 1,
          "name": "Rock Classics"
        }
      ],
      "position": null,
      "replaygain_album_gain": -8.2,
      "replaygain_album_peak": 0.88,
      "replaygain_track_gain": -6.5,
      "replaygain_track_peak": 0.95,
      "sample_rate": 44100,
      "source": "local_scan",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [
        "fast",
        "rock",
        "rock classics"
      ],
      "title": "Test Song",
      "updated_at": "<TIMESTAMP>"
    }
  ],
  "message": "ok",
  "meta": {
    "query": "rock",
    "total": 1
  }
}
  ```

### `POST POST /api/filter (rock OR anime)`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": [
    {
      "id": 1,
      "title": "Test Song",
      "artist": "Primary Artist",
      "album": "Test Album",
      "artists": [
        "Primary Artist",
        "Secondary Artist"
      ],
      "featured_artists": null,
      "duration": 1,
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
      "file_format": "mp3",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "source": "local_scan",
      "tags": [
        "fast",
        "rock",
        "rock classics"
      ],
      "playlists": [
        {
          "id": 1,
          "name": "Rock Classics"
        }
      ],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": 127,
      "sample_rate": 44100,
      "bit_depth": null,
      "file_size": 18298,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": -6.5,
      "replaygain_track_peak": 0.95,
      "replaygain_album_gain": -8.2,
      "replaygain_album_peak": 0.88,
      "stream_url": null,
      "stream_url_expires_at": null,
      "artwork_url": null
    },
    {
      "id": 3,
      "title": "Unravel",
      "artist": "TK from Ling Tosite Sigure",
      "album": "Tokyo Ghoul OST",
      "artists": [
        "TK from Ling Tosite Sigure"
      ],
      "featured_artists": [],
      "duration": 240,
      "file_path": "/music/anime/TK - Unravel.mp3",
      "file_format": "mp3",
      "album_art_path": null,
      "source": "local_scan",
      "tags": [
        "anime",
        "opening"
      ],
      "playlists": [
        {
          "id": 3,
          "name": "Anime"
        }
      ],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": 256000,
      "sample_rate": 44100,
      "bit_depth": 16,
      "file_size": 4801234,
      "
Rust   (normalized): {
  "data": [
    {
      "album": "Test Album",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "artist": "Primary Artist",
      "artists": [
        "Primary Artist",
        "Secondary Artist"
      ],
      "artwork_url": null,
      "bit_depth": null,
      "bitrate": 140,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 1,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": "mp3",
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
      "file_size": 18298,
      "id": 1,
      "playlists": [
        {
          "id": 1,
          "name": "Rock Classics"
        }
      ],
      "position": null,
      "replaygain_album_gain": -8.2,
      "replaygain_album_peak": 0.88,
      "replaygain_track_gain": -6.5,
      "replaygain_track_peak": 0.95,
      "sample_rate": 44100,
      "source": "local_scan",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [
        "fast",
        "rock",
        "rock classics"
      ],
      "title": "Test Song",
      "updated_at": "<TIMESTAMP>"
    },
    {
      "album": "Tokyo Ghoul OST",
      "album_art_path": null,
      "artist": "TK from Ling Tosite Sigure",
      "artists": [
        "TK from Ling Tosite Sigure"
      ],
      "artwork_url": null,
      "bit_depth": 16,
      "bitrate": 256000,
      "created_at": "<TIMESTAMP>",
      "dominant_color": "<COLOR>",
      "dominant_color_2": "<COLOR>",
      "duration": 240,
      "end_time_ms": 0,
      "featured_artists": [],
      "file_format": "mp3",
      "file_path": "/music/anime/TK - Unravel.mp3",
      "file_size": 4801234,
      "id": 3,
      "playlists": [
        {
          "id": 3,
          "name": "Anime"
        }
      ],
      "position": null,
      "replaygain_album_gain": -5.5,
      "replaygain_album_peak": 0.92,
      "replaygain_track_gain": -6.0,
  
  ```

### `POST POST /api/filter (NOT rock)`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": [
    {
      "id": 2,
      "title": "Chill Vibes",
      "artist": "LoFi Girl",
      "album": null,
      "artists": null,
      "featured_artists": null,
      "duration": 180,
      "file_path": null,
      "file_format": null,
      "album_art_path": null,
      "source": "manual",
      "tags": [
        "chill",
        "lo-fi study",
        "slow"
      ],
      "playlists": [
        {
          "id": 2,
          "name": "Lo-Fi Study"
        }
      ],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": null,
      "sample_rate": null,
      "bit_depth": null,
      "file_size": null,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": null,
      "replaygain_track_peak": null,
      "replaygain_album_gain": null,
      "replaygain_album_peak": null,
      "stream_url": null,
      "stream_url_expires_at": null,
      "artwork_url": null
    },
    {
      "id": 4,
      "title": "FLAC Test",
      "artist": "Artist A",
      "album": "FLAC Album",
      "artists": [
        "Artist A",
        "Artist B"
      ],
      "featured_artists": null,
      "duration": 1,
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.flac",
      "file_format": "flac",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "source": "local_scan",
      "tags": [],
      "playlists": [],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": 96,
      "sample_rate": 44100,
      "bit_depth": 16,
      "file_size": 20324,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": -4.3,
      "replaygain_track_peak": 0.92,
      "replaygain_album_gain": -7.1,
      "replaygain_album_peak": 0.85,
      "stream_url": null,
      "stre
Rust   (normalized): {
  "data": [
    {
      "album": null,
      "album_art_path": null,
      "artist": "LoFi Girl",
      "artists": null,
      "artwork_url": null,
      "bit_depth": null,
      "bitrate": null,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 180,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": null,
      "file_path": null,
      "file_size": null,
      "id": 2,
      "playlists": [
        {
          "id": 2,
          "name": "Lo-Fi Study"
        }
      ],
      "position": null,
      "replaygain_album_gain": null,
      "replaygain_album_peak": null,
      "replaygain_track_gain": null,
      "replaygain_track_peak": null,
      "sample_rate": null,
      "source": "manual",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [
        "chill",
        "lo-fi study",
        "slow"
      ],
      "title": "Chill Vibes",
      "updated_at": "<TIMESTAMP>"
    },
    {
      "album": "FLAC Album",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "artist": "Artist A",
      "artists": [
        "Artist A",
        "Artist B"
      ],
      "artwork_url": null,
      "bit_depth": 16,
      "bitrate": 162,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 1,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": "flac",
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.flac",
      "file_size": 20324,
      "id": 4,
      "playlists": [],
      "position": null,
      "replaygain_album_gain": -7.1,
      "replaygain_album_peak": 0.85,
      "replaygain_track_gain": -4.3,
      "replaygain_track_peak": 0.92,
      "sample_rate": 44100,
      "source": "local_scan",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [],
      "ti
  ```

### `POST POST /api/filter ("fast")`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": [
    {
      "id": 1,
      "title": "Test Song",
      "artist": "Primary Artist",
      "album": "Test Album",
      "artists": [
        "Primary Artist",
        "Secondary Artist"
      ],
      "featured_artists": null,
      "duration": 1,
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
      "file_format": "mp3",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "source": "local_scan",
      "tags": [
        "fast",
        "rock",
        "rock classics"
      ],
      "playlists": [
        {
          "id": 1,
          "name": "Rock Classics"
        }
      ],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": 127,
      "sample_rate": 44100,
      "bit_depth": null,
      "file_size": 18298,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": -6.5,
      "replaygain_track_peak": 0.95,
      "replaygain_album_gain": -8.2,
      "replaygain_album_peak": 0.88,
      "stream_url": null,
      "stream_url_expires_at": null,
      "artwork_url": null
    }
  ],
  "meta": {
    "total": 1,
    "query": "\"fast\""
  },
  "message": "ok"
}
Rust   (normalized): {
  "data": [
    {
      "album": "Test Album",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "artist": "Primary Artist",
      "artists": [
        "Primary Artist",
        "Secondary Artist"
      ],
      "artwork_url": null,
      "bit_depth": null,
      "bitrate": 140,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 1,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": "mp3",
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3",
      "file_size": 18298,
      "id": 1,
      "playlists": [
        {
          "id": 1,
          "name": "Rock Classics"
        }
      ],
      "position": null,
      "replaygain_album_gain": -8.2,
      "replaygain_album_peak": 0.88,
      "replaygain_track_gain": -6.5,
      "replaygain_track_peak": 0.95,
      "sample_rate": 44100,
      "source": "local_scan",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [
        "fast",
        "rock",
        "rock classics"
      ],
      "title": "Test Song",
      "updated_at": "<TIMESTAMP>"
    }
  ],
  "message": "ok",
  "meta": {
    "query": "\"fast\"",
    "total": 1
  }
}
  ```

### `POST POST /api/filter (id:1)`
- Python status: 200
- Rust status: 400
- **Diff details:**
  ```
  Status mismatch: Python=200, Rust=400
  ```

### `POST POST /api/filter (AND only)`
- Python status: 400
- Rust status: 400
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "detail": "Invalid query syntax: Invalid operator sequence without symbols such as AND OR or OR OR for token: \"&\""
}
Rust   (normalized): {
  "detail": "Invalid query syntax: Unexpected token: Amp"
}
  ```

### `GET GET /api/playlists/1/export (m3u8)`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): null
Rust   (normalized): {
  "content": "#EXTM3U\n#EXTINF:1,Primary Artist - Test Song\n/home/fusei/Aurora/rust/core/tests/fixtures/test_song.mp3\n"
}
  ```

### `GET GET /api/tags/9999 (405 expected)`
- Python status: 405
- Rust status: 405
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "detail": "Method Not Allowed"
}
Rust   (normalized): null
  ```

### `POST POST /api/tags (create shadowtest)`
- Python status: 201
- Rust status: 201
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": {
    "id": 7,
    "name": "shadowtest",
    "song_count": 0,
    "created_at": "<TIMESTAMP>"
  },
  "message": "Tag created successfully"
}
Rust   (normalized): {
  "data": {
    "id": 7,
    "name": "shadowtest",
    "song_count": 0
  },
  "message": "Tag created successfully"
}
  ```

### `POST POST /api/playlists/import`
- Python status: 404
- Rust status: 400
- **Diff details:**
  ```
  Status mismatch: Python=404, Rust=400
  ```

### `GET GET /api/songs (post-mutation)`
- Python status: 200
- Rust status: 200
- **Diff details:**
  ```
  Body differs after normalization.
Python (normalized): {
  "data": [
    {
      "id": 2,
      "title": "Chill Vibes",
      "artist": "LoFi Girl",
      "album": null,
      "artists": null,
      "featured_artists": null,
      "duration": 180,
      "file_path": null,
      "file_format": null,
      "album_art_path": null,
      "source": "manual",
      "tags": [
        "slow",
        "chill"
      ],
      "playlists": [
        {
          "id": 2,
          "name": "Lo-Fi Study"
        }
      ],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": null,
      "sample_rate": null,
      "bit_depth": null,
      "file_size": null,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": null,
      "replaygain_track_peak": null,
      "replaygain_album_gain": null,
      "replaygain_album_peak": null,
      "stream_url": null,
      "stream_url_expires_at": null,
      "artwork_url": null
    },
    {
      "id": 4,
      "title": "FLAC Test",
      "artist": "Artist A",
      "album": "FLAC Album",
      "artists": [
        "Artist A",
        "Artist B"
      ],
      "featured_artists": null,
      "duration": 1,
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.flac",
      "file_format": "flac",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "source": "local_scan",
      "tags": [],
      "playlists": [],
      "created_at": "<TIMESTAMP>",
      "updated_at": "<TIMESTAMP>",
      "start_time_ms": 0,
      "end_time_ms": 0,
      "position": null,
      "bitrate": 96,
      "sample_rate": 44100,
      "bit_depth": 16,
      "file_size": 20324,
      "dominant_color": null,
      "dominant_color_2": null,
      "replaygain_track_gain": -4.3,
      "replaygain_track_peak": 0.92,
      "replaygain_album_gain": -7.1,
      "replaygain_album_peak": 0.85,
      "stream_url": null,
      "stream_url_expires_at": nul
Rust   (normalized): {
  "data": [
    {
      "album": null,
      "album_art_path": null,
      "artist": "LoFi Girl",
      "artists": null,
      "artwork_url": null,
      "bit_depth": null,
      "bitrate": null,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 180,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": null,
      "file_path": null,
      "file_size": null,
      "id": 2,
      "playlists": [
        {
          "id": 2,
          "name": "Lo-Fi Study"
        }
      ],
      "position": null,
      "replaygain_album_gain": null,
      "replaygain_album_peak": null,
      "replaygain_track_gain": null,
      "replaygain_track_peak": null,
      "sample_rate": null,
      "source": "manual",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [
        "slow",
        "chill"
      ],
      "title": "Chill Vibes",
      "updated_at": "<TIMESTAMP>"
    },
    {
      "album": "FLAC Album",
      "album_art_path": "b6346c8edcd6cd0b9794b8a0b03390f6c51ee455.jpg",
      "artist": "Artist A",
      "artists": [
        "Artist A",
        "Artist B"
      ],
      "artwork_url": null,
      "bit_depth": 16,
      "bitrate": 162,
      "created_at": "<TIMESTAMP>",
      "dominant_color": null,
      "dominant_color_2": null,
      "duration": 1,
      "end_time_ms": 0,
      "featured_artists": null,
      "file_format": "flac",
      "file_path": "/home/fusei/Aurora/rust/core/tests/fixtures/test_song.flac",
      "file_size": 20324,
      "id": 4,
      "playlists": [],
      "position": null,
      "replaygain_album_gain": -7.1,
      "replaygain_album_peak": 0.85,
      "replaygain_track_gain": -4.3,
      "replaygain_track_peak": 0.92,
      "sample_rate": 44100,
      "source": "local_scan",
      "start_time_ms": 0,
      "stream_url": null,
      "stream_url_expires_at": null,
      "tags": [],
      "title": "FLAC Test",
    
  ```

## ERROR (1)

### `GET GET /api/songs/1/stream (multi-range)`
- **Diff details:**
  ```
  Python request failed: peer closed connection without sending complete message body (received 379 bytes, expected 410)
  ```

## PASS (37)

### `GET GET /api/health`
- Python status: 200
- Rust status: 200

### `GET GET /api/tags`
- Python status: 200
- Rust status: 200

### `GET GET /api/playlists`
- Python status: 200
- Rust status: 200

### `GET GET /api/playlists/1`
- Python status: 200
- Rust status: 200

### `GET GET /api/folders`
- Python status: 200
- Rust status: 200

### `GET GET /api/albums`
- Python status: 200
- Rust status: 200

### `GET GET /api/albums/Machine Head`
- Python status: 404
- Rust status: 404

### `GET GET /api/addons`
- Python status: 200
- Rust status: 200

### `GET GET /api/watch`
- Python status: 200
- Rust status: 200

### `GET GET /api/songs/1/stream (full)`
- Python status: 200
- Rust status: 200

### `GET GET /api/songs/1/stream (bytes=0-99)`
- Python status: 206
- Rust status: 206

### `GET GET /api/songs/1/stream (unsat)`
- Python status: 416
- Rust status: 416

### `GET GET /api/album-art/abc123def456.jpg`
- Python status: 404
- Rust status: 404

### `GET GET /api/songs/1/bleed-thumb`
- Python status: 404
- Rust status: 404

### `POST POST /api/filter (slow AND chill)`
- Python status: 200
- Rust status: 200

### `POST POST /api/filter (51 atoms)`
- Python status: 400
- Rust status: 400

### `GET GET /api/playlists/1/export (json)`
- Python status: 200
- Rust status: 200

### `GET GET /api/folders/songs?path=/music/rock`
- Python status: 200
- Rust status: 200

### `GET GET /api/addons/1/search?q=sunset`
- Python status: 404
- Rust status: 404

### `GET GET /api/songs/9999 (404)`
- Python status: 404
- Rust status: 404

### `GET GET /api/playlists/9999 (404)`
- Python status: 404
- Rust status: 404

### `GET GET /api/addons/9999/search (404)`
- Python status: 404
- Rust status: 404

### `DELETE DELETE /api/tags/{new_tag_id}`
- Python status: 200
- Rust status: 200

### `POST POST /api/playlists (create)`
- Python status: 201
- Rust status: 201

### `POST POST /api/playlists/{new_playlist_id}/songs (add song 1)`
- Python status: 200
- Rust status: 200

### `POST POST /api/playlists/{new_playlist_id}/songs (add song 2)`
- Python status: 200
- Rust status: 200

### `POST POST /api/playlists/{new_playlist_id}/songs (add song 3)`
- Python status: 200
- Rust status: 200

### `DELETE DELETE /api/playlists/{new_playlist_id}/songs/2`
- Python status: 200
- Rust status: 200

### `PUT PUT /api/playlists/{new_playlist_id}/songs/reorder`
- Python status: 200
- Rust status: 200

### `PATCH PATCH /api/playlists/{new_playlist_id}/songs/1/timing`
- Python status: 200
- Rust status: 200

### `PATCH PATCH /api/addons/1 (toggle off)`
- Python status: 404
- Rust status: 404

### `PATCH PATCH /api/addons/1 (toggle on)`
- Python status: 404
- Rust status: 404

### `DELETE DELETE /api/playlists/{new_playlist_id}`
- Python status: 200
- Rust status: 200

### `GET GET /api/tags (post-mutation)`
- Python status: 200
- Rust status: 200

### `GET GET /api/playlists (post-mutation)`
- Python status: 200
- Rust status: 200

### `GET GET /api/playlists/1 (post-mutation)`
- Python status: 200
- Rust status: 200

### `GET GET /api/addons (post-mutation)`
- Python status: 200
- Rust status: 200

---

## Whitelist Rules Applied

| Rule | Description |
|------|-------------|
| W1 | Volatile timestamps normalized to `<TIMESTAMP>` |
| W2 | 422 validation body format (Pydantic vs Rust) — status-only check |
| W3 | §2B analysis values (dominant_color, peaks, bleed) — NULL-parity + shape only |
| W4 | Multi-range stream: Rust 416 vs Python 206 (N39 T3) |
| W5 | Re-encoded image bytes differ — compare metadata only |
| W6 | Read-time backfill mutation (NULL→non-NULL color on GET) |
| W7 | JSON key ordering (serde alphabetical vs FastAPI insertion order) |
| W8 | Float formatting (`1.0` vs `1`) — numeric epsilon comparison |
