"""Folders router — browse music library by directory structure."""

from fastapi import APIRouter, Query
from typing import Optional

from app.database import get_db_ctx, SONG_SELECT_QUERY, COUNT_SONG_QUERY
from app.routers.songs import song_row_to_dict
from app.cache import folder_cache, song_cache

router = APIRouter(tags=["folders"])


def _build_tree(paths: list[str]) -> list[dict]:
    """Build a nested folder tree from a list of directory paths.

    Each path is a directory containing songs. Returns a list of top-level
    folder nodes, each with name, path, song_count, and subfolders.
    """
    # Count songs per directory
    dir_counts: dict[str, int] = {}
    for p in paths:
        dir_counts[p] = dir_counts.get(p, 0) + 1

    # Build nested tree structure
    # We use an intermediate dict where keys are path components
    # and leaves carry the aggregate counts
    tree_root: dict = {}  # keyed by top-level folder name

    for dir_path, count in dir_counts.items():
        # Split path into components, filtering out empty strings
        parts = [p for p in dir_path.split("/") if p]
        if not parts:
            continue

        # Navigate/create the tree branch
        node = tree_root
        accumulated_path = ""
        for i, part in enumerate(parts):
            accumulated_path = accumulated_path + "/" + part if accumulated_path else "/" + part
            if part not in node:
                node[part] = {"_children": {}, "_count": 0, "_path": accumulated_path}
            # Add count to every ancestor
            node[part]["_count"] += count
            node = node[part]["_children"]

    # Convert tree_root dict to the output list format
    def dict_to_list(d: dict) -> list[dict]:
        result = []
        for name, data in d.items():
            item = {
                "name": name,
                "path": data["_path"],
                "song_count": data["_count"],
            }
            if data["_children"]:
                subs = dict_to_list(data["_children"])
                subs.sort(key=lambda x: x["name"].lower())
                item["subfolders"] = subs
            result.append(item)
        result.sort(key=lambda x: x["name"].lower())
        return result

    return dict_to_list(tree_root)


@router.get("/folders")
def get_folder_tree():
    """Return the folder tree built from all songs' file_path directories."""
    # Check cache
    cache_key = "folders:tree"
    cached = folder_cache.get(cache_key)
    if cached is not None:
        return cached

    with get_db_ctx() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT file_path FROM songs WHERE file_path IS NOT NULL AND file_path != ''"
        )
        rows = cursor.fetchall()

    # Extract unique directory paths (parent directory of each file)
    import os
    dirs: set[str] = set()
    for row in rows:
        fp = row["file_path"]
        d = os.path.dirname(fp)
        if d:
            dirs.add(d)

    # Build and return the tree
    tree = _build_tree(list(dirs))

    result = {
        "folders": tree,
        "total_folders": _count_nodes(tree),
        "total_songs": _sum_counts(tree),
    }

    folder_cache.set(cache_key, result)
    return result


def _sum_counts(nodes: list[dict]) -> int:
    """Sum song_count across the top-level nodes (each is already an aggregate)."""
    # song_count in each top-level node is the total for that subtree.
    # But since a song lives in exactly one folder, summing top-level counts
    # gives total unique songs.
    total = 0
    for node in nodes:
        total += node.get("song_count", 0)
    return total


def _count_nodes(nodes: list[dict]) -> int:
    """Count total nodes (folders) in the tree."""
    count = 0
    for node in nodes:
        count += 1
        if "subfolders" in node:
            count += _count_nodes(node["subfolders"])
    return count


@router.get("/folders/songs")
def get_folder_songs(
    path: str = Query(..., description="Full directory path to list songs from"),
    recursive: bool = Query(False, description="Include songs from subfolders"),
    limit: int = Query(500, ge=1),
    offset: int = Query(0, ge=0),
):
    """Return songs within a specific folder.

    path: the exact directory path (e.g., /home/user/Music/Anime)
    recursive: if true, include songs from all subfolders
    """
    with get_db_ctx() as conn:
        cursor = conn.cursor()

        # Normalize path: ensure it doesn't end with / for LIKE matching
        normalized_path = path.rstrip("/")

        # Match path and any subdirectory (always needed as base filter)
        like_pattern = normalized_path + "/%"
        # For non-recursive, exclude files with deeper paths
        deeper_pattern = normalized_path + "/%/%" if not recursive else None

        query = SONG_SELECT_QUERY + " WHERE s.file_path LIKE ?"

        params: list = [like_pattern]

        if not recursive and deeper_pattern is not None:
            query += " AND s.file_path NOT LIKE ?"
            params.append(deeper_pattern)

        query += " GROUP BY s.id ORDER BY s.title COLLATE NOCASE, s.id ASC"

        # Count query
        count_query = COUNT_SONG_QUERY + " WHERE s.file_path LIKE ?"
        count_params: list = [like_pattern]
        if not recursive and deeper_pattern is not None:
            count_query += " AND s.file_path NOT LIKE ?"
            count_params.append(deeper_pattern)

        if limit is not None and limit > 0:
            query += " LIMIT ?"
            params.append(limit)

        if offset is not None and offset >= 0:
            query += " OFFSET ?"
            params.append(offset)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        cursor.execute(count_query, count_params)
        total = cursor.fetchone()["total"]

    data = [song_row_to_dict(row) for row in rows]

    return {
        "data": data,
        "total": total,
        "path": path,
        "recursive": recursive,
        "message": "ok",
    }
