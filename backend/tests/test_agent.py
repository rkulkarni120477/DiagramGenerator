from app.agent import DIAGRAM_REQUIRED_NOTE
from app.errors import LLMTimeoutError
from tests.samples import CLARIFICATION, MERMAID_DIAGRAM, MERMAID_REFINED


def _create(client, prompt="Design an order service"):
    return client.post("/api/v1/sessions", json={"diagram_type": "technical", "prompt": prompt})


def test_retries_once_after_invalid_json(make_client):
    client, llm = make_client(["Sure! Here is the diagram", MERMAID_DIAGRAM])

    response = _create(client)

    assert response.status_code == 201
    assert response.json()["turn"]["status"] == "diagram"
    assert len(llm.calls) == 2
    assert "rejected" in llm.calls[1][-1]["content"]


def test_gives_up_after_second_invalid_response(make_client):
    client, llm = make_client(["bad", "still bad"])

    response = _create(client)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "invalid_llm_response"
    assert len(llm.calls) == 2


def test_clarification_limit_forces_a_diagram(make_client):
    # Creating the session is round 1; two more answers give rounds 2 and 3.
    client, llm = make_client([CLARIFICATION, CLARIFICATION, CLARIFICATION, MERMAID_DIAGRAM])
    session_id = _create(client).json()["session_id"]

    for answer in ["Around 5k users", "Batch jobs too"]:
        response = client.post(f"/api/v1/sessions/{session_id}/messages", json={"content": answer})
        assert response.json()["turn"]["status"] == "needs_clarification"

    response = client.post(f"/api/v1/sessions/{session_id}/messages", json={"content": "Use your judgment"})

    assert response.json()["turn"]["status"] == "diagram"
    assert DIAGRAM_REQUIRED_NOTE in llm.calls[-1][-1]["content"]


def test_clarification_after_limit_is_rejected_and_retried(make_client):
    client, llm = make_client([CLARIFICATION, CLARIFICATION, CLARIFICATION, CLARIFICATION, MERMAID_DIAGRAM])
    session_id = _create(client).json()["session_id"]
    for answer in ["one", "two"]:
        client.post(f"/api/v1/sessions/{session_id}/messages", json={"content": answer})

    response = client.post(f"/api/v1/sessions/{session_id}/messages", json={"content": "three"})

    assert response.json()["turn"]["status"] == "diagram"
    assert len(llm.calls) == 5


def test_refinement_sends_full_history(make_client):
    client, llm = make_client([MERMAID_DIAGRAM, MERMAID_REFINED])
    session_id = _create(client).json()["session_id"]

    response = client.post(
        f"/api/v1/sessions/{session_id}/messages", json={"content": "add a cache layer"}
    )

    assert response.status_code == 200
    roles = [m["role"] for m in llm.calls[1]]
    assert roles == ["user", "assistant", "user"]
    assert llm.calls[1][-1]["content"] == "add a cache layer"


def test_repair_is_limited_to_one_attempt(make_client):
    client, _ = make_client([MERMAID_DIAGRAM, MERMAID_REFINED])
    session_id = _create(client).json()["session_id"]
    repair = {"error": "Parse error on line 2"}

    first = client.post(f"/api/v1/sessions/{session_id}/repair", json=repair)
    second = client.post(f"/api/v1/sessions/{session_id}/repair", json=repair)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "repair_limit_reached"


def test_repair_without_a_diagram_conflicts(make_client):
    client, _ = make_client([CLARIFICATION])
    session_id = _create(client).json()["session_id"]

    response = client.post(f"/api/v1/sessions/{session_id}/repair", json={"error": "Parse error"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "no_current_diagram"


def test_llm_timeout_maps_to_504(make_client):
    client, _ = make_client([LLMTimeoutError("read timed out")])

    response = _create(client)

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "llm_timeout"
