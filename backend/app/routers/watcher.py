"""Watcher router — manage auto-watch folders and trigger scans."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from pathlib import Path
from datetime import datetime, timezone

from app.database import get_db_ctx

router = APIRouter(tags=["watcher"])


class WatchFolderRequest(BaseModel):
    path: str = Field(..., min_length=1)


# ── helpers ──────────────────────────────────────────────────────────


def _folder_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "folder_path": row["folder_path"],
        "is_active": bool(row["is_active"]),
        "last_scan_at": row["last_scan_at"],
        "created_at": row["created_at"],
    }


# ── endpoints ────────────────────────────────────────────────────────


@router.get("/watch")
def list_watched_folders():
    """List all watched folders."""
    with get_db_ctx() as conn:
        rows = conn.execute(
            "SELECT id, folder_path, is_active, last_scan_at, created_at "
            "FROM watched_folders ORDER BY created_at DESC"
        ).fetchall()
    return {"data": [_folder_to_dict(r) for r in rows], "message": "ok"}


@router.post("/watch")
def add_watched_folder(req: WatchFolderRequest):
    """Add a folder to the watch list."""
    folder_path = Path(req.path).resolve()
    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="Path does not exist or is not a directory")

    with get_db_ctx() as conn:
        # Upsert: if already exists but inactive, reactivate
        existing = conn.execute(
            "SELECT id, is_active FROM watched_folders WHERE folder_path = ?",
            (str(folder_path),),
        ).fetchone()

        if existing:
            if not existing["is_active"]:
                conn.execute(
                    "UPDATE watched_folders SET is_active = 1 WHERE id = ?",
                    (existing["id"],),
                )
                conn.commit()
            return {
                "data": {"id": existing["id"], "folder_path": str(folder_path), "is_active": True},
                "message": "Folder already watched" if existing["is_active"] else "Folder reactivated",
            }

        cursor = conn.execute(
            "INSERT INTO watched_folders (folder_path) VALUES (?)",
            (str(folder_path),),
        )
        conn.commit()
        wf_id = cursor.lastrowid

    return {
        "data": {"id": wf_id, "folder_path": str(folder_path), "is_active": True},
        "message": "ok",
    }


@router.delete("/watch/{folder_id}")
def remove_watched_folder(folder_id: int):
    """Remove a folder from the watch list."""
    with get_db_ctx() as conn:
        row = conn.execute(
            "SELECT id FROM watched_folders WHERE id = ?", (folder_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Watched folder not found")
        conn.execute("DELETE FROM watched_folders WHERE id = ?", (folder_id,))
        conn.commit()
    return {"data": {"id": folder_id}, "message": "ok"}


@router.post("/watch/{folder_id}/scan")
def trigger_scan(folder_id: int):
    """Trigger an immediate scan of a specific watched folder."""
    from app.services.file_watcher import get_watcher

    with get_db_ctx() as conn:
        row = conn.execute(
            "SELECT id FROM watched_folders WHERE id = ?", (folder_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Watched folder not found")

    watcher = get_watcher()
    if watcher is None:
        raise HTTPException(status_code=503, detail="File watcher not initialized")

    result = watcher.scan_once(folder_id=folder_id)

    # Update last_scan_at
    with get_db_ctx() as conn:
        conn.execute(
            "UPDATE watched_folders SET last_scan_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), folder_id),
        )
        conn.commit()

    return {"data": result, "message": "ok"}
