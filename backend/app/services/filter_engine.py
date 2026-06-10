"""Filter engine for boolean tag queries."""
import re
import boolean

from app.serializers import song_row_to_dict

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

    # Complexity limit: count atoms (tag names) in the expression
    atom_count = len(re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', query_string))
    if atom_count > 50:
        raise ValueError("Query too complex: maximum 50 terms allowed")

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
            s.artists, s.featured_artists,
            s.bitrate, s.sample_rate, s.bit_depth, s.file_size,
            s.created_at, s.updated_at,
            GROUP_CONCAT(DISTINCT t.name) AS tags,
            GROUP_CONCAT(DISTINCT p.id || ':' || p.name) AS playlists
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
        GROUP BY s.id
    """)
    
    results = []
    for row in cursor.fetchall():
        tag_set = build_tag_set(row["tags"], row["playlists"])
        
        if evaluate_song(expression, quoted_tags, tag_set):
            song_dict = song_row_to_dict(row, include_peaks=False)
            # Filter engine returns tags as sorted set (for boolean evaluation),
            # not the deduplicated list from the serializer
            song_dict["tags"] = sorted(tag_set)
            results.append(song_dict)
    
    # Sort by title
    results.sort(key=lambda s: s["title"].lower())
    return results