from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


def _ensure_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


UtcDatetime = Annotated[datetime, AfterValidator(_ensure_utc)]

DiagramType = Literal["technical", "layered", "logical", "network", "raci", "workflow"]
RaciCode = Literal["R", "A", "C", "I", "A/R"]


# ---- Requests -------------------------------------------------------------

class SessionCreate(BaseModel):
    diagram_type: DiagramType
    prompt: str = Field(min_length=1, description="Full prompt. Length is checked against MAX_PROMPT_CHARS.")


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class RepairRequest(BaseModel):
    error: str = Field(min_length=1, max_length=2000)


# ---- DiagramAgent output (validated) -------------------------------------

class ClarificationQuestion(BaseModel):
    id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    options: list[str] | None = None


class ClarificationTurn(BaseModel):
    status: Literal["needs_clarification"]
    summary: str
    questions: list[ClarificationQuestion] = Field(min_length=1, max_length=5)


class MermaidDiagram(BaseModel):
    status: Literal["diagram"]
    diagram_type: Literal["technical", "logical", "network", "workflow"]
    title: str = Field(min_length=1, max_length=200)
    format: Literal["mermaid"]
    mermaid: str = Field(min_length=1)
    assumptions: list[str] = Field(default_factory=list)
    constraints_applied: list[str] = Field(default_factory=list)
    notes: str | None = None


class LayerComponent(BaseModel):
    name: str = Field(min_length=1)
    kind: Literal["component", "database"] = "component"


class Layer(BaseModel):
    name: str = Field(min_length=1)
    closed: bool = True
    components: list[LayerComponent] = Field(min_length=1, max_length=8)


class CrossCuttingConcern(BaseModel):
    name: str = Field(min_length=1)
    components: list[LayerComponent] = Field(min_length=1, max_length=8)


class HostingInfo(BaseModel):
    """Where the system runs, shown as a badge on the diagram."""

    provider: str = Field(min_length=1, max_length=60, description="For example AWS, Microsoft Azure, Google Cloud, On-premises")
    region: str | None = None


class LayeredDiagram(BaseModel):
    """Stacked layers with components, closed or open layer markers and cross-cutting concerns."""

    status: Literal["diagram"]
    diagram_type: Literal["layered"]
    title: str = Field(min_length=1, max_length=200)
    format: Literal["layered_stack"]
    entry_point: str = "Request"
    hosting: HostingInfo | None = None
    layers: list[Layer] = Field(min_length=1, max_length=8)
    cross_cutting: list[CrossCuttingConcern] = Field(default_factory=list, max_length=6)
    assumptions: list[str] = Field(default_factory=list)
    constraints_applied: list[str] = Field(default_factory=list)
    notes: str | None = None


class RaciTask(BaseModel):
    task: str = Field(min_length=1)
    assignments: dict[str, RaciCode]

    @model_validator(mode="after")
    def _check_assignments(self) -> "RaciTask":
        # "A" and "A/R" both mark the single accountable role.
        accountable = [role for role, code in self.assignments.items() if code in ("A", "A/R")]
        if len(accountable) != 1:
            raise ValueError(f"task '{self.task}' must have exactly one A; found {len(accountable)}")
        if not any(code in ("R", "A/R") for code in self.assignments.values()):
            raise ValueError(f"task '{self.task}' must have at least one R")
        return self


class RaciDiagram(BaseModel):
    status: Literal["diagram"]
    diagram_type: Literal["raci"]
    title: str = Field(min_length=1, max_length=200)
    format: Literal["raci_matrix"]
    roles: list[str] = Field(min_length=1)
    tasks: list[RaciTask] = Field(min_length=1)
    assumptions: list[str] = Field(default_factory=list)
    constraints_applied: list[str] = Field(default_factory=list)
    notes: str | None = None

    @model_validator(mode="after")
    def _check_roles(self) -> "RaciDiagram":
        known = set(self.roles)
        for task in self.tasks:
            unknown = set(task.assignments) - known
            if unknown:
                raise ValueError(f"task '{task.task}' references unknown roles: {sorted(unknown)}")
        return self


AgentTurn = ClarificationTurn | MermaidDiagram | RaciDiagram | LayeredDiagram


# ---- Responses ------------------------------------------------------------

class TurnResponse(BaseModel):
    session_id: str
    diagram_id: int | None
    turn: AgentTurn


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    kind: str
    content: str
    created_at: UtcDatetime


class SessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    diagram_type: DiagramType
    updated_at: UtcDatetime


class SessionDetail(BaseModel):
    id: str
    title: str
    diagram_type: DiagramType
    created_at: UtcDatetime
    updated_at: UtcDatetime
    messages: list[MessageOut]
    latest_turn: AgentTurn | None
    latest_diagram_id: int | None


class ProgressEvent(BaseModel):
    step: str
    detail: str
    percent: int
    at: str


class ProgressResponse(BaseModel):
    id: str
    done: bool
    failed: bool
    percent: int
    events: list[ProgressEvent]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["ok"]
    version: str


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
