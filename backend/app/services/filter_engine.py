"""Filter engine for boolean tag queries."""
import json
import re
import boolean


algebra = boolean.BooleanAlgebra()


def parse_query(query_string: str):
    """
    Parse a user query string into a boolean expression.
    
    Handles quoted strings (for tag names with spaces), AND/OR/NOT operators,
    and parentheses. Returns the parsed expression and a mapping of quoted tags.
    
    Raises boolean.ParseError if syntax is invalid.
    """
    # Step 1: Extract quoted strings and replace with placeholders
    quoted_tags = {}
    placeholder_counter = [0]  # Use list to allow mutation in nested function
    
    def replace_quoted(match):
        placeholder = f"QTAG{placeholder_counter[0]}"
        quoted_tags[placeholder] = match.group(1).strip().lower()
        placeholder_counter[0] += 1
        return placeholder
    
    # Match both "double quoted" and 'single quoted' strings
    processed = re.sub(r'"([^"]+)"', replace_quoted, query_string)
    processed = re.sub(r"'([^']+)'", replace_quoted, processed)
    
    # Step 2: Normalize operators
    processed = re.sub(r'\bAND\b', '&', processed, flags=re.IGNORECASE)
    processed = re.sub(r'\bOR\b', '|', processed, flags=re.IGNORECASE)
    processed = re.sub(r'\bNOT\b', '~', processed, flags=re.IGNORECASE)
    
    # Step 3: Parse
    expression = algebra.parse(processed)
    
    return expression, quoted_tags


def build_tag_set(tag_names_csv: str | None, playlist_names_csv: str | None) -> set[str]:
    """
    Build a complete tag set for a song from CSV strings.
    
    Combines explicit tag names from song_tags and playlist names from playlist_songs.
    """
    tags = set()
    if tag_names_csv:
        tags.update(name.strip().lower() for name in tag_names_csv.split(","))
    if playlist_names_csv:
        for item in playlist_names_csv.split(","):
            # Items are formatted as "id:name" — extract just the name
            name = item.split(":", 1)[1].strip().lower() if ":" in item else item.strip().lower()
            tags.add(name)
    return tags


def evaluate_song(expression, quoted_tags: dict, song_tag_set: set[str]) -> bool:
    """
    Evaluate whether a song's tag set satisfies the boolean expression.
    
    Uses boolean.py's subs() method to substitute each symbol with
    TRUE or FALSE based on whether the tag is in the song's tag set.
    """
    TRUE = algebra.TRUE
    FALSE = algebra.FALSE
    
    # Build substitution map: for each symbol in the expression,
    # check if it's in the song's tag set
    subs_map = {}
    for symbol in expression.symbols:
        symbol_name = str(symbol)
        # Check if this is a quoted-tag placeholder
        if symbol_name in quoted_tags:
            tag_name = quoted_tags[symbol_name]
        else:
            tag_name = symbol_name.strip().lower()
        
        if tag_name in song_tag_set:
            subs_map[symbol] = TRUE
        else:
            subs_map[symbol] = FALSE
    
    # Substitute and simplify
    result = expression.subs(subs_map).simplify()
    return result == TRUE


def filter_songs(db_connection, query_string: str) -> list[dict]:
    """
    Main entry point for the filter engine.
    
    1. Parse the query
    2. Load all songs with their tag sets
    3. Evaluate each song
    4. Return matching songs
    
    Args:
        db_connection: SQLite database connection
        query_string: Boolean expression to evaluate
        
    Returns:
        List of matching songs with their metadata and tags
        
    Raises:
        ValueError: If query syntax is invalid or query is empty
    """
    # Validate query is not empty
    if not query_string or not query_string.strip():
        raise ValueError("Query cannot be empty")
    
    # Parse
    try:
        expression, quoted_tags = parse_query(query_string)
    except boolean.ParseError as e:
        raise ValueError(f"Invalid query syntax: {e}")
    
    # Load all songs with tags
    cursor = db_connection.execute("""
        SELECT
            s.id, s.title, s.artist, s.album, s.duration,
            s.file_path, s.file_format, s.album_art_path, s.source,
            s.waveform_peaks, s.dominant_color, s.dominant_color_2,
            s.replaygain_track_gain, s.replaygain_track_peak,
            s.replaygain_album_gain, s.replaygain_album_peak,
            s.created_at, s.updated_at,
            GROUP_CONCAT(DISTINCT t.name) AS tag_names,
            GROUP_CONCAT(DISTINCT p.id || ':' || p.name) AS playlist_ids_names
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
        GROUP BY s.id
    """)
    
    results = []
    for row in cursor.fetchall():
        tag_set = build_tag_set(row["tag_names"], row["playlist_ids_names"])
        
        if evaluate_song(expression, quoted_tags, tag_set):
            # Parse playlists as objects with id and name
            playlists = []
            if row["playlist_ids_names"]:
                for item in row["playlist_ids_names"].split(","):
                    if ":" in item:
                        id_part, name_part = item.split(":", 1)
                        playlists.append({"id": int(id_part), "name": name_part.strip()})
            
            # Parse waveform_peaks JSON
            raw_peaks = row["waveform_peaks"] if "waveform_peaks" in row.keys() else None
            waveform_peaks = json.loads(raw_peaks) if raw_peaks else None

            results.append({
                "id": row["id"],
                "title": row["title"],
                "artist": row["artist"],
                "album": row["album"],
                "duration": row["duration"],
                "file_path": row["file_path"],
                "file_format": row["file_format"] if "file_format" in row.keys() else None,
                "album_art_path": (row["album_art_path"] or None) if "album_art_path" in row.keys() else None,
                "source": row["source"],
                "tags": sorted(tag_set),
                "playlists": playlists,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "waveform_peaks": waveform_peaks,
                "dominant_color": row["dominant_color"] if "dominant_color" in row.keys() else None,
                "dominant_color_2": row["dominant_color_2"] if "dominant_color_2" in row.keys() else None,
                "replaygain_track_gain": row["replaygain_track_gain"] if "replaygain_track_gain" in row.keys() else None,
                "replaygain_track_peak": row["replaygain_track_peak"] if "replaygain_track_peak" in row.keys() else None,
                "replaygain_album_gain": row["replaygain_album_gain"] if "replaygain_album_gain" in row.keys() else None,
                "replaygain_album_peak": row["replaygain_album_peak"] if "replaygain_album_peak" in row.keys() else None,
            })
    
    # Sort by title
    results.sort(key=lambda s: s["title"].lower())
    return results