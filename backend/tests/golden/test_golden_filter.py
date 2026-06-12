"""Golden parity tests for /api/filter endpoint."""
import pytest
from tests.conftest import check_golden, check_golden_status


def test_filter_rock(client):
    """POST /api/filter query="rock" — matches Highway Star."""
    resp = client.post("/api/filter", json={"query": "rock"})
    data = check_golden_status("filter_rock", resp, 200)
    assert data["meta"]["total"] == 1
    assert data["data"][0]["title"] == "Highway Star"
    assert data["meta"]["query"] == "rock"


def test_filter_and(client):
    """POST /api/filter query="slow AND chill" — matches Chill Vibes (has both tags)."""
    resp = client.post("/api/filter", json={"query": "slow AND chill"})
    data = check_golden_status("filter_slow_and_chill", resp, 200)
    assert data["meta"]["total"] == 1
    assert data["data"][0]["title"] == "Chill Vibes"


def test_filter_or(client):
    """POST /api/filter query="rock OR anime" — matches Highway Star and Unravel."""
    resp = client.post("/api/filter", json={"query": "rock OR anime"})
    data = check_golden_status("filter_rock_or_anime", resp, 200)
    assert data["meta"]["total"] == 2
    titles = {s["title"] for s in data["data"]}
    assert titles == {"Highway Star", "Unravel"}


def test_filter_quoted(client):
    """POST /api/filter query='"fast"' — quoted tag name matches Highway Star."""
    resp = client.post("/api/filter", json={"query": '"fast"'})
    data = check_golden_status("filter_quoted_fast", resp, 200)
    assert data["meta"]["total"] == 1
    assert data["data"][0]["title"] == "Highway Star"


def test_filter_empty_query_422(client):
    """POST /api/filter query="" — returns 422 (Pydantic rejects min_length=1 before handler)."""
    resp = client.post("/api/filter", json={"query": ""})
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    # Pydantic returns an array of error objects
    errors = detail if isinstance(detail, list) else [detail]
    error_msgs = " ".join(str(e.get("msg", "")) for e in errors if isinstance(e, dict))
    assert "empty" in error_msgs.lower() or "string" in error_msgs.lower() or "length" in error_msgs.lower() or "query" in str(detail).lower()


def test_filter_invalid_syntax_400(client):
    """POST /api/filter query="AND" — returns 400 invalid syntax."""
    resp = client.post("/api/filter", json={"query": "AND"})
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert "invalid" in detail.lower() or "syntax" in detail.lower()
