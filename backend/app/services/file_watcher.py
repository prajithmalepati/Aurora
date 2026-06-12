"""Background file watcher — polls watched folders for new/changed/deleted music files."""
import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from app.database import get_db_ctx
from app.cache import song_cache, tag_cache, folder_cache
from app.services.file_scanner import AUDIO_EXTENSIONS, extract_metadata, import_scanned_songs

logger = logging.getLogger("aurora.file_watcher")

# Module-level singleton — set by main.py during startup
_watcher: "FileWatcher | None" = None


def get_watcher() -> "FileWatcher | None":
    return _watcher


def set_watcher(watcher: "FileWatcher") -> None:
    global _watcher
    _watcher = watcher


class FileWatcher:
    """Polling-based background watcher for music folders.

    Spawns a daemon thread that scans every ``interval`` seconds.
    Compares filesystem state against the songs table by (file_path, file_mtime).
    """

    def __init__(self, interval: int = 30):
        self._interval = interval
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._scan_lock = threading.Lock()
        self._last_dir_mtimes: dict[str, float] = {}

    # ── lifecycle ────────────────────────────────────────────────────

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="file-watcher")
        self._thread.start()
        logger.info("FileWatcher started (interval=%ds)", self._interval)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        logger.info("FileWatcher stopped")

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    # ── manual trigger ───────────────────────────────────────────────

    def scan_once(self, folder_id: int | None = None) -> dict:
        """Run a single scan pass. If *folder_id* is given, scan only that folder."""
        with self._scan_lock:
            return self._do_scan(folder_id=folder_id)

    # ── internal loop ────────────────────────────────────────────────

    @staticmethod
    def _tree_mtime(folder_path: str) -> float | None:
        """Latest mtime of the folder and every directory beneath it.

        import_scanned_songs scans recursively, so the guard must notice
        adds/removes/renames in nested subdirectories — those bump only
        their parent directory's mtime, never the watched root's.
        Stats directories only (not files), so it stays far cheaper than
        the full import it short-circuits.
        """
        try:
            latest = os.stat(folder_path).st_mtime
        except OSError:
            return None
        for dirpath, dirnames, _files in os.walk(folder_path):
            for d in dirnames:
                try:
                    m = os.stat(os.path.join(dirpath, d)).st_mtime
                except OSError:
                    continue
                if m > latest:
                    latest = m
        return latest

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._do_scan()
            except Exception:
                logger.exception("FileWatcher scan pass failed")
            self._stop_event.wait(self._interval)

    def _do_scan(self, folder_id: int | None = None) -> dict:
        """One full scan pass over active watched folders."""
        with get_db_ctx() as conn:
            if folder_id is not None:
                rows = conn.execute(
                    "SELECT id, folder_path FROM watched_folders WHERE id = ? AND is_active = 1",
                    (folder_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, folder_path FROM watched_folders WHERE is_active = 1"
                ).fetchall()

            total_imported = 0
            total_replaced = 0
            total_skipped = 0
            total_deleted = 0
            total_errors = 0
            now = datetime.now(timezone.utc).isoformat()

            for wf in rows:
                wf_id = wf["id"]
                folder_path = wf["folder_path"]

                if not Path(folder_path).is_dir():
                    logger.warning("Watched folder missing: %s", folder_path)
                    continue

                # Cheap interim guard: skip the expensive import_scanned_songs
                # when no directory in the tree changed since last poll.
                # Adding, removing, or renaming files bumps the containing
                # directory's mtime on Linux filesystems (ext4/xfs/btrfs);
                # _tree_mtime takes the max across the whole tree so nested
                # changes are seen too. In-place content edits don't bump dir
                # mtimes — those are caught by manual scans, which always run.
                current_mtime: float | None = None
                dir_unchanged = False
                if folder_id is None:
                    current_mtime = self._tree_mtime(folder_path)
                    if current_mtime is not None and current_mtime == self._last_dir_mtimes.get(folder_path):
                        dir_unchanged = True

                # Use import_scanned_songs for new/changed files
                try:
                    if not dir_unchanged:
                        result = import_scanned_songs(conn, folder_path)
                        total_imported += result.get("imported", 0)
                        total_replaced += result.get("replaced", 0)
                        total_skipped += result.get("skipped", 0)
                        total_errors += len(result.get("errors", []))
                        # Invalidate caches so new songs appear without waiting for TTL
                        if result.get("imported", 0) > 0 or result.get("replaced", 0) > 0:
                            song_cache.invalidate_prefix("songs:")
                            tag_cache.invalidate("tags:list")
                            folder_cache.invalidate("folders:tree")
                        # Record successful scan mtime
                        if current_mtime is not None:
                            self._last_dir_mtimes[folder_path] = current_mtime
                    else:
                        result = None
                        logger.debug("FileWatcher: skipping %s — dir mtime unchanged", folder_path)
                except Exception:
                    logger.exception("Error scanning watched folder %s", folder_path)
                    total_errors += 1

                # Mark missing files: songs whose file_path starts with this
                # folder but no longer exist on disk
                try:
                    deleted = self._mark_missing(conn, folder_path)
                    total_deleted += deleted
                    # Invalidate caches so removed songs disappear without waiting for TTL
                    if deleted > 0:
                        song_cache.invalidate_prefix("songs:")
                        tag_cache.invalidate("tags:list")
                        folder_cache.invalidate("folders:tree")
                except Exception:
                    logger.exception("Error checking missing files in %s", folder_path)

                # Update last_scan_at
                conn.execute(
                    "UPDATE watched_folders SET last_scan_at = ? WHERE id = ?",
                    (now, wf_id),
                )

            conn.commit()

        # Prune stale mtime entries for folders no longer watched
        active_paths = {wf["folder_path"] for wf in rows}
        stale = [p for p in self._last_dir_mtimes if p not in active_paths]
        for p in stale:
            del self._last_dir_mtimes[p]

        summary = {
            "folders_scanned": len(rows),
            "imported": total_imported,
            "replaced": total_replaced,
            "skipped": total_skipped,
            "deleted": total_deleted,
            "errors": total_errors,
        }
        if any(v > 0 for v in summary.values() if isinstance(v, int)):
            logger.info("FileWatcher scan: %s", summary)
        return summary

    @staticmethod
    def _mark_missing(conn, folder_path: str) -> int:
        """Find songs under *folder_path* whose files no longer exist on disk.

        Returns the count of newly-missing songs (those that still had
        file_path set — i.e. were not already marked).
        """
        normalized = str(Path(folder_path).resolve())
        # GLOB: * is wildcard, _ and % are literal — no LIKE-escaping needed
        glob_pattern = normalized + "/*"

        rows = conn.execute(
            "SELECT id, file_path FROM songs WHERE file_path GLOB ?",
            (glob_pattern,),
        ).fetchall()

        deleted = 0
        for row in rows:
            fp = row["file_path"]
            if fp and not os.path.isfile(fp):
                # Null out file_path so the song becomes "orphaned"
                # (won't be matched on disk anymore) but keeps its
                # tags, playlists, and metadata.
                conn.execute(
                    "UPDATE songs SET file_path = NULL, updated_at = ? WHERE id = ?",
                    (datetime.now(timezone.utc).isoformat(), row["id"]),
                )
                deleted += 1
        return deleted
