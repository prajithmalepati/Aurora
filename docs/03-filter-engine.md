# Aurora — Boolean Filter Engine Specification
## Document 3 of 6

---

## Purpose

The filter engine is the core feature of Aurora. It takes a boolean expression like `slow AND (rock OR anime) AND NOT opening` and returns all songs whose tag set satisfies the expression.

---

## Library

**`boolean.py`** (PyPI package name: `boolean.py`, import as `boolean`)

```
pip install boolean.py
```

This is a production-stable library for parsing and evaluating boolean algebra expressions. It handles AND, OR, NOT, parentheses, and operator precedence out of the box.

---

## How It Works

### Step 1: Build the tag set for every song

For each song in the database, its **complete tag set** is:

```
song_tag_set = {explicit tags from song_tags} ∪ {lowercased playlist names from playlist_songs}
```

SQL to get this efficiently:

```sql
-- Get all songs with their explicit tags and playlist names in one query
SELECT
    s.id,
    s.title,
    s.artist,
    s.album,
    s.duration,
    s.file_path,
    s.source,
    GROUP_CONCAT(DISTINCT t.name) AS tag_names,
    GROUP_CONCAT(DISTINCT LOWER(p.name)) AS playlist_names
FROM songs s
LEFT JOIN song_tags st ON s.id = st.song_id
LEFT JOIN tags t ON st.tag_id = t.id
LEFT JOIN playlist_songs ps ON s.id = ps.song_id
LEFT JOIN playlists p ON ps.playlist_id = p.id
GROUP BY s.id;
```

This returns one row per song. Parse `tag_names` and `playlist_names` (comma-separated strings from GROUP_CONCAT) into a Python set:

```python
def build_tag_set(tag_names_csv: str | None, playlist_names_csv: str | None) -> set[str]:
    tags = set()
    if tag_names_csv:
        tags.update(name.strip() for name in tag_names_csv.split(","))
    if playlist_names_csv:
        tags.update(name.strip() for name in playlist_names_csv.split(","))
    return tags
```

### Step 2: Parse the query

```python
import boolean

algebra = boolean.BooleanAlgebra()

def parse_query(query_string: str):
    """
    Parse a user query string into a boolean expression.
    Raises boolean.ParseError if syntax is invalid.
    """
    # Normalize: lowercase the operators but preserve tag names with spaces
    # boolean.py expects: & for AND, | for OR, ~ for NOT
    # But it also accepts the words AND, OR, NOT by default... 
    # Actually, by default boolean.py uses &, |, ~ as operators.
    # We need to convert user-friendly syntax to boolean.py syntax.
    
    normalized = query_string
    # Replace operators (case-insensitive) with boolean.py symbols
    # Must replace longer strings first to avoid partial matches
    # Use word boundaries to avoid replacing inside tag names
    import re
    normalized = re.sub(r'\bAND\b', '&', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bOR\b', '|', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bNOT\b', '~', normalized, flags=re.IGNORECASE)
    
    return algebra.parse(normalized)
```

**Important nuance:** Tag names can contain spaces (e.g., "3am drive"). In boolean.py, symbols are separated by operators and parentheses. A bare `3am drive` would be parsed as two separate symbols. 

**Solution:** Tags with spaces must be quoted in the query. The user types:

```
"3am drive" AND rock
```

We need to handle this in the parser. Before passing to boolean.py, replace quoted strings with a placeholder symbol, then map back.

```python
def parse_query(query_string: str):
    algebra = boolean.BooleanAlgebra()
    
    # Step 1: Extract quoted strings and replace with placeholders
    quoted_tags = {}
    placeholder_counter = 0
    
    def replace_quoted(match):
        nonlocal placeholder_counter
        placeholder = f"QTAG{placeholder_counter}"
        quoted_tags[placeholder] = match.group(1).strip().lower()
        placeholder_counter += 1
        return placeholder
    
    import re
    # Match both "double quoted" and 'single quoted' strings
    processed = re.sub(r'"([^"]+)"', replace_quoted, query_string)
    processed = re.sub(r"'([^']+)'", replace_quoted, processed)
    
    # Step 2: Normalize operators
    processed = re.sub(r'\bAND\b', '&', processed, flags=re.IGNORECASE)
    processed = re.sub(r'\bOR\b', '|', processed, flags=re.IGNORECASE)
    processed = re.sub(r'\bNOT\b', '~', processed, flags=re.IGNORECASE)
    
    # Step 3: Lowercase remaining unquoted tag names
    # (boolean.py symbols are case-sensitive, our tags are lowercase)
    # We'll handle this in the evaluation step instead
    
    # Step 4: Parse
    expression = algebra.parse(processed)
    
    return expression, quoted_tags
```

### Step 3: Evaluate the expression against each song

```python
def evaluate_song(expression, quoted_tags: dict, song_tag_set: set[str]) -> bool:
    """
    Evaluate whether a song's tag set satisfies the boolean expression.
    
    Uses boolean.py's subs() method to substitute each symbol with
    TRUE or FALSE based on whether the tag is in the song's tag set.
    """
    algebra = boolean.BooleanAlgebra()
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
```

### Step 4: Put it all together

```python
def filter_songs(db_connection, query_string: str) -> list[dict]:
    """
    Main entry point for the filter engine.
    
    1. Parse the query
    2. Load all songs with their tag sets
    3. Evaluate each song
    4. Return matching songs
    """
    # Parse
    try:
        expression, quoted_tags = parse_query(query_string)
    except boolean.ParseError as e:
        raise ValueError(f"Invalid query syntax: {e}")
    
    # Load all songs with tags
    cursor = db_connection.execute("""
        SELECT
            s.id, s.title, s.artist, s.album, s.duration,
            s.file_path, s.source,
            GROUP_CONCAT(DISTINCT t.name) AS tag_names,
            GROUP_CONCAT(DISTINCT LOWER(p.name)) AS playlist_names
        FROM songs s
        LEFT JOIN song_tags st ON s.id = st.song_id
        LEFT JOIN tags t ON st.tag_id = t.id
        LEFT JOIN playlist_songs ps ON s.id = ps.song_id
        LEFT JOIN playlists p ON ps.playlist_id = p.id
        GROUP BY s.id
    """)
    
    results = []
    for row in cursor.fetchall():
        tag_set = build_tag_set(row["tag_names"], row["playlist_names"])
        
        if evaluate_song(expression, quoted_tags, tag_set):
            results.append({
                "id": row["id"],
                "title": row["title"],
                "artist": row["artist"],
                "album": row["album"],
                "duration": row["duration"],
                "file_path": row["file_path"],
                "source": row["source"],
                "tags": sorted(tag_set),
                "playlists": [n.strip() for n in (row["playlist_names"] or "").split(",") if n.strip()],
            })
    
    # Sort by title
    results.sort(key=lambda s: s["title"].lower())
    return results
```

---

## Query Syntax Reference

| Input                            | Meaning                                             |
|----------------------------------|-----------------------------------------------------|
| `slow`                           | All songs tagged "slow" or in a playlist named "slow" |
| `slow AND rock`                  | Songs that are both "slow" AND in "rock"            |
| `fast OR hype`                   | Songs that are "fast" OR "hype" (or both)           |
| `NOT opening`                    | All songs that are NOT tagged "opening"             |
| `slow AND (rock OR anime)`       | Slow songs from either Rock or Anime                |
| `anime AND slow AND NOT opening` | Chill anime music, no opening themes                |
| `"3am drive"`                    | Songs tagged "3am drive" (quotes needed for spaces) |
| `"3am drive" AND slow`           | Slow songs tagged "3am drive"                       |

**Operator precedence** (handled by boolean.py):
1. `NOT` (highest)
2. `AND`
3. `OR` (lowest)

So `fast AND rock OR anime` means `(fast AND rock) OR anime`, NOT `fast AND (rock OR anime)`. When in doubt, use parentheses.

---

## Edge Cases to Handle

| Case | Behavior |
|------|----------|
| Empty query string | Return 400 error |
| Query with only spaces | Return 400 error |
| Single tag that matches nothing | Return empty array, not error |
| Tag name that doesn't exist | Treated as FALSE for all songs (no match), not an error |
| Unbalanced parentheses | boolean.py raises ParseError → return 400 |
| All caps `SLOW AND ROCK` | Works (case-insensitive matching) |
| Mixed case `Slow and Rock` | Works (case-insensitive matching) |

---

## Performance Notes

For v1, this loads ALL songs into memory and evaluates in Python. This is fine for a personal library (under ~10,000 songs). If performance becomes an issue later:

1. **SQL-level pre-filtering:** If the query is a simple `AND` of tags, convert to SQL `INTERSECT` queries
2. **Caching:** Cache tag sets in memory, invalidate on song/tag changes
3. **Index optimization:** Composite indexes on join tables

Don't optimize prematurely. The Python-side evaluation will handle thousands of songs in milliseconds.

---

## File Location

```
backend/app/services/filter_engine.py
```

This module exports one function: `filter_songs(db_connection, query_string) -> list[dict]`

The `/api/filter` router imports and calls this function.
