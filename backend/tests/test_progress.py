from tests.samples import MERMAID_DIAGRAM

PROGRESS_ID = "test-progress-0001"


def test_progress_records_steps_for_a_generation(make_client):
    client, _ = make_client([MERMAID_DIAGRAM])

    response = client.post(
        "/api/v1/sessions",
        json={"diagram_type": "technical", "prompt": "Order service on AWS"},
        headers={"X-Progress-Id": PROGRESS_ID},
    )
    progress = client.get(f"/api/v1/progress/{PROGRESS_ID}").json()

    assert response.status_code == 201
    steps = [event["step"] for event in progress["events"]]
    assert steps[0] == "Checking request"
    assert "Calling Claude" in steps
    assert "Validating response" in steps
    assert steps[-1] == "Diagram ready"
    assert progress["done"] is True
    assert progress["failed"] is False
    assert progress["percent"] == 100


def test_progress_records_retry_and_failure(make_client):
    client, _ = make_client(["bad", "still bad"])

    response = client.post(
        "/api/v1/sessions",
        json={"diagram_type": "technical", "prompt": "Order service on AWS"},
        headers={"X-Progress-Id": "test-progress-0002"},
    )
    progress = client.get("/api/v1/progress/test-progress-0002").json()

    assert response.status_code == 502
    steps = [event["step"] for event in progress["events"]]
    assert "Response rejected" in steps
    assert "Retrying with a correction" in steps
    assert progress["failed"] is True
    assert progress["done"] is True


def test_unknown_progress_id_returns_empty_state(make_client):
    client, _ = make_client([])

    progress = client.get("/api/v1/progress/never-started-id").json()

    assert progress == {"id": "never-started-id", "done": False, "failed": False, "percent": 0, "events": []}
