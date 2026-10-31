from tests.samples import MERMAID_DIAGRAM, RACI_DIAGRAM


def test_health(make_client):
    client, _ = make_client([])

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_session_returns_diagram(make_client):
    client, _ = make_client([MERMAID_DIAGRAM])

    response = client.post(
        "/api/v1/sessions", json={"diagram_type": "technical", "prompt": "Order service on AWS"}
    )

    body = response.json()
    assert response.status_code == 201
    assert body["session_id"]
    assert isinstance(body["diagram_id"], int)
    assert body["turn"]["format"] == "mermaid"


def test_raci_session_returns_matrix(make_client):
    client, _ = make_client([RACI_DIAGRAM])

    response = client.post("/api/v1/sessions", json={"diagram_type": "raci", "prompt": "Release process"})

    assert response.status_code == 201
    assert response.json()["turn"]["format"] == "raci_matrix"


def test_prompt_over_limit_is_rejected(make_client):
    client, llm = make_client([], max_prompt_chars=100)

    response = client.post("/api/v1/sessions", json={"diagram_type": "technical", "prompt": "x" * 101})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "prompt_too_long"
    assert llm.calls == []


def test_invalid_diagram_type_uses_error_shape(make_client):
    client, _ = make_client([])

    response = client.post("/api/v1/sessions", json={"diagram_type": "bogus", "prompt": "x"})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "diagram_type" in error["message"]


def test_unknown_session_returns_404(make_client):
    client, _ = make_client([])

    response = client.get("/api/v1/sessions/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "session_not_found"


def test_session_history_and_listing(make_client):
    client, _ = make_client([MERMAID_DIAGRAM])
    created = client.post(
        "/api/v1/sessions", json={"diagram_type": "technical", "prompt": "Order service on AWS"}
    ).json()

    listing = client.get("/api/v1/sessions").json()
    detail = client.get(f"/api/v1/sessions/{created['session_id']}").json()

    assert [s["id"] for s in listing] == [created["session_id"]]
    assert detail["latest_turn"]["title"] == "Order service"
    assert detail["latest_diagram_id"] == created["diagram_id"]
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
