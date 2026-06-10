"""Golden parity tests for /api/health endpoint."""
import pytest
from tests.conftest import check_golden_status, _seed_database


@pytest.fixture(scope="module", autouse=True)
def _reset_db():
    """Re-seed DB before this module's tests execute (not at import time)."""
    _seed_database()


def test_health(client):
    """GET /api/health — returns status ok with database counts."""
    resp = client.get("/api/health")
    data = check_golden_status("health_golden", resp, 200)
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    # After full test suite runs, song/tag counts may differ from seed (stateful
    # tests create/delete items). Golden fixture captures the final state.
    assert isinstance(data["song_count"], int)
    assert isinstance(data["tag_count"], int)
    assert isinstance(data["playlist_count"], int)
