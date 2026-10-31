import re
from collections.abc import Callable, Iterator
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session as DBSession

from app.agent import AgentResult, DiagramAgent
from app.errors import AppError
from app.progress import ProgressReporter, ProgressStore
from app.schemas import (
    HealthResponse,
    MessageCreate,
    MessageOut,
    ProgressEvent,
    ProgressResponse,
    RepairRequest,
    SessionCreate,
    SessionDetail,
    SessionSummary,
    TurnResponse,
)

API_VERSION = "1.0.0"

router = APIRouter()


def get_db(request: Request) -> Iterator[DBSession]:
    db = request.app.state.session_factory()
    try:
        yield db
    finally:
        db.close()


def get_agent(request: Request) -> DiagramAgent:
    return request.app.state.agent


DbDep = Annotated[DBSession, Depends(get_db)]
AgentDep = Annotated[DiagramAgent, Depends(get_agent)]
ProgressIdHeader = Annotated[str | None, Header(alias="X-Progress-Id")]

_VALID_PROGRESS_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


def _turn_response(result: AgentResult) -> TurnResponse:
    return TurnResponse(session_id=result.session_id, diagram_id=result.diagram_id, turn=result.turn)


def _track(request: Request, progress_id: str | None, operation: Callable[[ProgressReporter], AgentResult]) -> AgentResult:
    """Runs one generation step while recording its progress under the client's id."""
    store: ProgressStore = request.app.state.progress
    op_id = progress_id if progress_id and _VALID_PROGRESS_ID.match(progress_id) else str(uuid4())
    reporter = store.start(op_id)
    try:
        result = operation(reporter)
    except AppError as exc:
        reporter.fail(exc.message)
        raise
    except Exception:
        reporter.fail("Unexpected error")
        raise
    reporter.finish()
    return result


@router.get("/health", response_model=HealthResponse)
def health(db: DbDep) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise AppError(503, "database_unavailable", "The database is not reachable.") from exc
    return HealthResponse(status="ok", database="ok", version=API_VERSION)


@router.post("/sessions", response_model=TurnResponse, status_code=201)
def create_session(
    payload: SessionCreate,
    request: Request,
    agent: AgentDep,
    db: DbDep,
    progress_id: ProgressIdHeader = None,
) -> TurnResponse:
    return _turn_response(_track(request, progress_id, lambda p: agent.start_session(db, payload, p)))


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(agent: AgentDep, db: DbDep) -> list[SessionSummary]:
    return [SessionSummary.model_validate(s) for s in agent.list_sessions(db)]


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: str, agent: AgentDep, db: DbDep) -> SessionDetail:
    view = agent.get_session(db, session_id)
    return SessionDetail(
        id=view.session.id,
        title=view.session.title,
        diagram_type=view.session.diagram_type,
        created_at=view.session.created_at,
        updated_at=view.session.updated_at,
        messages=[MessageOut.model_validate(m) for m in view.messages],
        latest_turn=view.latest_turn,
        latest_diagram_id=view.latest_diagram_id,
    )


@router.post("/sessions/{session_id}/messages", response_model=TurnResponse)
def send_message(
    session_id: str,
    payload: MessageCreate,
    request: Request,
    agent: AgentDep,
    db: DbDep,
    progress_id: ProgressIdHeader = None,
) -> TurnResponse:
    return _turn_response(
        _track(request, progress_id, lambda p: agent.reply(db, session_id, payload.content, p))
    )


@router.post("/sessions/{session_id}/repair", response_model=TurnResponse)
def repair_diagram(
    session_id: str,
    payload: RepairRequest,
    request: Request,
    agent: AgentDep,
    db: DbDep,
    progress_id: ProgressIdHeader = None,
) -> TurnResponse:
    return _turn_response(
        _track(request, progress_id, lambda p: agent.repair(db, session_id, payload.error, p))
    )


@router.get("/progress/{op_id}", response_model=ProgressResponse)
def get_progress(op_id: str, request: Request) -> ProgressResponse:
    snapshot = request.app.state.progress.snapshot(op_id)
    events = [ProgressEvent(**event) for event in snapshot["events"]]
    return ProgressResponse(
        id=op_id,
        done=snapshot["done"],
        failed=snapshot["failed"],
        percent=events[-1].percent if events else 0,
        events=events,
    )
