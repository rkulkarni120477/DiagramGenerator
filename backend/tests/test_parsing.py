import json

import pytest

from app.parsing import parse_agent_turn
from app.schemas import ClarificationTurn, LayeredDiagram, MermaidDiagram, RaciDiagram
from tests.samples import (
    CLARIFICATION,
    LAYERED_DIAGRAM,
    MERMAID_DIAGRAM,
    RACI_DIAGRAM,
    RACI_NO_RESPONSIBLE,
    RACI_TWO_ACCOUNTABLE,
)


def test_parses_mermaid_diagram():
    assert isinstance(parse_agent_turn(MERMAID_DIAGRAM), MermaidDiagram)


def test_parses_layered_diagram():
    assert isinstance(parse_agent_turn(LAYERED_DIAGRAM), LayeredDiagram)


def test_layered_diagram_needs_components_in_each_layer():
    data = json.loads(LAYERED_DIAGRAM)
    data["layers"][0]["components"] = []
    with pytest.raises(ValueError):
        parse_agent_turn(json.dumps(data))


def test_parses_clarification():
    assert isinstance(parse_agent_turn(CLARIFICATION), ClarificationTurn)


def test_parses_raci_matrix():
    assert isinstance(parse_agent_turn(RACI_DIAGRAM), RaciDiagram)


def test_surrounding_whitespace_is_allowed():
    assert isinstance(parse_agent_turn(f"\n  {CLARIFICATION}\n"), ClarificationTurn)


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "not json at all",
        f"```json\n{MERMAID_DIAGRAM}\n```",
        "[]",
        json.dumps({"status": "something_else"}),
        json.dumps({"status": "diagram", "format": "svg", "diagram_type": "technical"}),
    ],
)
def test_rejects_malformed_output(raw):
    with pytest.raises(ValueError):
        parse_agent_turn(raw)


def test_rejects_raci_with_two_accountable_roles():
    with pytest.raises(ValueError, match="exactly one A"):
        parse_agent_turn(RACI_TWO_ACCOUNTABLE)


def test_rejects_raci_task_without_responsible_role():
    with pytest.raises(ValueError, match="at least one R"):
        parse_agent_turn(RACI_NO_RESPONSIBLE)


def test_rejects_raci_assignment_for_unknown_role():
    data = json.loads(RACI_DIAGRAM)
    data["tasks"][0]["assignments"]["Ghost"] = "C"
    with pytest.raises(ValueError, match="unknown roles"):
        parse_agent_turn(json.dumps(data))


def test_rejects_more_than_five_questions():
    data = json.loads(CLARIFICATION)
    data["questions"] = [{"id": f"q{i}", "question": "Why?"} for i in range(6)]
    with pytest.raises(ValueError):
        parse_agent_turn(json.dumps(data))
