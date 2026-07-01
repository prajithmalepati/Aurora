"""Tests for the filter engine — covers tag matching, boolean operators, and
the exact sidebar-click code path (quoted query) that triggered the Session 31 bug."""
import sqlite3
import pytest
from app.services.filter_engine import filter_songs


SCHEMA = """
CREATE TABLE songs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    artist          TEXT    NOT NULL,
    album           TEXT,
    duration        INTEGER,
    file_path       TEXT,
    file_format     TEXT,
    album_art_path  TEXT,
    source          TEXT    NOT NULL DEFAULT 'manual',
    waveform_peaks  TEXT,
    dominant_color  TEXT,
    dominant_color_2 TEXT,
    replaygain_track_gain REAL,
    replaygain_track_peak REAL,
    replaygain_album_gain REAL,
    replaygain_album_peak REAL,
    artists          TEXT,
    featured_artists TEXT,
    bitrate          INTEGER,
    sample_rate      INTEGER,
    bit_depth        INTEGER,
    file_size        INTEGER,
    created_at      TEXT    NOT NULL DEFAULT '2024-01-01T00:00:00',
    updated_at      TEXT    NOT NULL DEFAULT '2024-01-01T00:00:00'
);
CREATE TABLE tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT '2024-01-01T00:00:00'
);
CREATE TABLE song_tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs(id),
    tag_id  INTEGER NOT NULL REFERENCES tags(id),
    UNIQUE(song_id, tag_id)
);
CREATE TABLE playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    color      TEXT,
    emoji      TEXT,
    image_url  TEXT,
    crossfade_enabled   INTEGER,
    crossfade_duration_s INTEGER,
    created_at TEXT    NOT NULL DEFAULT '2024-01-01T00:00:00',
    updated_at TEXT    NOT NULL DEFAULT '2024-01-01T00:00:00'
);
CREATE TABLE playlist_songs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id),
    song_id     INTEGER NOT NULL REFERENCES songs(id),
    position    INTEGER NOT NULL DEFAULT 0,
    start_time_ms INTEGER NOT NULL DEFAULT 0,
    end_time_ms   INTEGER NOT NULL DEFAULT 0,
    added_at    TEXT    NOT NULL DEFAULT '2024-01-01T00:00:00'
);
"""


def make_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def add_song(conn, title, tags=None):
    cur = conn.execute(
        "INSERT INTO songs (title, artist, source) VALUES (?, '', 'manual')",
        (title,)
    )
    song_id = cur.lastrowid
    for tag_name in (tags or []):
        conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (tag_name,))
        tag_id = conn.execute("SELECT id FROM tags WHERE name = ?", (tag_name,)).fetchone()["id"]
        conn.execute("INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)", (song_id, tag_id))
    conn.commit()
    return song_id


def titles(results):
    return sorted(r["title"] for r in results)


# ── Basic matching ──────────────────────────────────────────────────────────

def test_unquoted_tag_match():
    conn = make_db()
    add_song(conn, "Song A", ["fast"])
    add_song(conn, "Song B", ["slow"])
    assert titles(filter_songs(conn, "fast")) == ["Song A"]


def test_quoted_tag_match():
    """Exact reproduction of sidebar-click code path: always-quoted query."""
    conn = make_db()
    add_song(conn, "Highway Star", ["fast"])
    add_song(conn, "Bang Your Head", ["fast"])
    add_song(conn, "Chill Vibes", ["slow"])
    result = filter_songs(conn, '"fast"')
    assert titles(result) == ["Bang Your Head", "Highway Star"]


def test_multiword_quoted_tag():
    conn = make_db()
    add_song(conn, "Song A", ["easy listening"])
    add_song(conn, "Song B", ["rock"])
    assert titles(filter_songs(conn, '"easy listening"')) == ["Song A"]


def test_case_insensitive_unquoted():
    conn = make_db()
    add_song(conn, "Song A", ["fast"])
    assert titles(filter_songs(conn, "FAST")) == ["Song A"]
    assert titles(filter_songs(conn, "Fast")) == ["Song A"]


def test_case_insensitive_quoted():
    conn = make_db()
    add_song(conn, "Song A", ["fast"])
    assert titles(filter_songs(conn, '"FAST"')) == ["Song A"]


def test_no_match_returns_empty():
    conn = make_db()
    add_song(conn, "Song A", ["fast"])
    assert filter_songs(conn, '"chill"') == []


# ── Boolean operators ───────────────────────────────────────────────────────

def test_boolean_and():
    conn = make_db()
    add_song(conn, "Song A", ["fast", "gym"])
    add_song(conn, "Song B", ["fast"])
    add_song(conn, "Song C", ["gym"])
    result = filter_songs(conn, '"fast" AND "gym"')
    assert titles(result) == ["Song A"]


def test_boolean_or():
    conn = make_db()
    add_song(conn, "Song A", ["fast"])
    add_song(conn, "Song B", ["anime"])
    add_song(conn, "Song C", ["slow"])
    result = filter_songs(conn, '"fast" OR "anime"')
    assert titles(result) == ["Song A", "Song B"]


def test_boolean_not():
    conn = make_db()
    add_song(conn, "Song A", ["fast", "anime"])
    add_song(conn, "Song B", ["fast"])
    result = filter_songs(conn, '"fast" AND NOT "anime"')
    assert titles(result) == ["Song B"]


def test_boolean_and_not_compound():
    conn = make_db()
    add_song(conn, "Song A", ["fast", "gym"])
    add_song(conn, "Song B", ["fast", "anime"])
    add_song(conn, "Song C", ["fast"])
    result = filter_songs(conn, '"fast" AND NOT ("gym" OR "anime")')
    assert titles(result) == ["Song C"]


# ── Edge cases ──────────────────────────────────────────────────────────────

def test_empty_query_raises():
    conn = make_db()
    with pytest.raises(ValueError):
        filter_songs(conn, "")


def test_invalid_syntax_raises():
    conn = make_db()
    with pytest.raises(ValueError):
        filter_songs(conn, "AND")


def test_song_with_no_tags_excluded():
    conn = make_db()
    add_song(conn, "Tagged", ["fast"])
    add_song(conn, "No Tags", [])
    assert titles(filter_songs(conn, '"fast"')) == ["Tagged"]


def test_multiple_tags_on_song():
    conn = make_db()
    add_song(conn, "Song A", ["fast", "gym", "rock", "hype"])
    result = filter_songs(conn, '"fast" AND "gym" AND "rock"')
    assert titles(result) == ["Song A"]


# ── Bare NOT(group) — N29 regression guards ────────────────────────────────

def test_bare_not_group_matches():
    """NOT (rock OR jazz) should match a song tagged only {chill}."""
    conn = make_db()
    add_song(conn, "Chill Vibes", ["chill"])
    add_song(conn, "Highway Star", ["rock"])
    result = filter_songs(conn, 'NOT ("rock" OR "jazz")')
    assert titles(result) == ["Chill Vibes"]


def test_bare_not_group_excludes():
    """NOT (rock OR jazz) should NOT match a song tagged {rock}."""
    conn = make_db()
    add_song(conn, "Highway Star", ["rock"])
    add_song(conn, "Chill Vibes", ["chill"])
    result = filter_songs(conn, 'NOT ("rock" OR "jazz")')
    assert "Highway Star" not in [r["title"] for r in result]


def test_bare_not_and_group():
    """NOT (gym AND anime) should match {gym} (has gym but not both)."""
    conn = make_db()
    add_song(conn, "Gym Song", ["gym"])
    add_song(conn, "Both", ["gym", "anime"])
    result = filter_songs(conn, 'NOT ("gym" AND "anime")')
    assert titles(result) == ["Gym Song"]


# ── Unterminated quotes — N32 parity guards ─────────────────────────────────

def test_unterminated_double_quote_raises():
    """An unclosed double quote must be rejected (not silently accepted)."""
    conn = make_db()
    add_song(conn, "Song A", ["fast"])
    with pytest.raises(ValueError):
        filter_songs(conn, '"fast')


def test_unterminated_single_quote_raises():
    """An unclosed single quote must be rejected."""
    conn = make_db()
    add_song(conn, "Song A", ["chill"])
    with pytest.raises(ValueError):
        filter_songs(conn, "'chill")


def test_unterminated_quote_with_and_raises():
    """Unclosed quote in compound query must be rejected."""
    conn = make_db()
    add_song(conn, "Song A", ["rock", "fast"])
    with pytest.raises(ValueError):
        filter_songs(conn, 'rock AND "fast')


# ── Empty quotes — N32-FIX parity guards ───────────────────────────────────

def test_empty_double_quote_raises():
    """Zero-length inner span: "" must be rejected (Python parity)."""
    conn = make_db()
    add_song(conn, "Song A", ["rock"])
    with pytest.raises(ValueError):
        filter_songs(conn, '""')


def test_empty_single_quote_raises():
    """Zero-length inner span: '' must be rejected (Python parity)."""
    conn = make_db()
    add_song(conn, "Song A", ["rock"])
    with pytest.raises(ValueError):
        filter_songs(conn, "''")


def test_whitespace_only_quoted_ok():
    """Whitespace-only inner (≥1 raw char) must NOT be rejected — no over-reject."""
    conn = make_db()
    add_song(conn, "Song A", [""])
    # Should not raise — whitespace-only is ≥1 raw char
    filter_songs(conn, '"   "')
