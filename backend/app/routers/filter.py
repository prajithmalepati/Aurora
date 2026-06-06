"""Filter router."""
from fastapi import APIRouter, HTTPException
from app.services.filter_engine import filter_songs
from app.database import get_db_ctx
from app.models import FilterRequest

router = APIRouter(tags=["filter"])


@router.post("/filter")
def filter_endpoint(request: FilterRequest):
    """
    Run a boolean tag query and return matching songs.
    
    Accepts a FilterRequest with a query string containing a boolean expression
    using tag/playlist names. Returns matching songs with the query echoed back.
    
    Raises 400 for invalid query syntax or empty query.
    """
    try:
        with get_db_ctx() as db:
            results = filter_songs(db, request.query)
        return {
            "data": results,
            "total": len(results),
            "query": request.query,
            "message": "ok"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))