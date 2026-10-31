import json

from app.schemas import AgentTurn, ClarificationTurn, LayeredDiagram, MermaidDiagram, RaciDiagram


def parse_agent_turn(raw: str) -> AgentTurn:
    """Parse and validate one DiagramAgent response.

    Raises ValueError (including pydantic's ValidationError, a ValueError subclass)
    when the text is not JSON or does not match the required schema.
    """
    data = json.loads(raw.strip())  # JSONDecodeError is a ValueError
    if not isinstance(data, dict):
        raise ValueError("the response must be a JSON object")

    status = data.get("status")
    if status == "needs_clarification":
        return ClarificationTurn.model_validate(data)
    if status == "diagram":
        if data.get("format") == "raci_matrix":
            return RaciDiagram.model_validate(data)
        if data.get("format") == "layered_stack":
            return LayeredDiagram.model_validate(data)
        return MermaidDiagram.model_validate(data)
    raise ValueError(f"unknown status {status!r}")
