"""Scanner router."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path

from app.services.file_scanner import import_scanned_songs


router = APIRouter(tags=["scanner"])


class ScanRequest(BaseModel):
    """Request body for POST /scan."""
    folder_path: str
    playlist_name: str | None = None


class ScanResponse(BaseModel):
    """Response body for POST /scan."""
    scanned: int
    imported: int
    skipped: int
    errors: list[dict]
    songs: list[dict]


@router.post("/scan")
def scan_folder(request: ScanRequest):
    """Scan a folder for music files and import them into the database."""
    # Validate folder_path is not empty
    if not request.folder_path:
        raise HTTPException(status_code=400, detail="folder_path is empty")
    
    # Check if folder exists
    folder_path = Path(request.folder_path)
    if not folder_path.exists():
        raise HTTPException(status_code=404, detail="folder_path does not exist or is not a directory")
    if not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="folder_path does not exist or is not a directory")
    
    # Import the database connection
    from app.database import get_db
    conn = get_db()
    
    try:
        result = import_scanned_songs(conn, request.folder_path, request.playlist_name)
        
        # Build message
        parts = []
        if result["imported"]:
            parts.append(f"Imported {result['imported']} new songs")
        if result.get("replaced"):
            parts.append(f"replaced {result['replaced']} lower-quality songs with higher-quality versions")
        if result["skipped"]:
            parts.append(f"skipped {result['skipped']} already in library")
        art_count = result.get("art_extracted", 0)
        if art_count:
            parts.append(f"extracted art for {art_count} songs")
        message = "Scan complete: " + (". ".join(parts) if parts else "nothing new found") + "."

        return {
            "data": result,
            "message": message,
        }
    finally:
        conn.close()