"""DiagramAgent: session management, LLM orchestration and response validation."""

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession

from app.config import Settings
from app.errors import AppError, LLMError, LLMTimeoutError
from app.llm import LLMClient
from app.models import DiagramRecord, MessageRecord, SessionRecord
from app.parsing import parse_agent_turn
from app.progress import NULL_PROGRESS, ProgressReporter
from app.schemas import AgentTurn, ClarificationTurn, SessionCreate

logger = logging.getLogger("diagram_studio.agent")

DEFAULT_TITLE = "Untitled diagram"
DIAGRAM_REQUIRED_NOTE = (
    "Clarification limit reached. Do not ask any more questions. "
    "Generate the diagram now using the stated assumptions, and list every assumption you made."
)
RETRY_TEMPLATE = (
    "Your previous response was rejected: {error}. "
    "Return valid JSON only, matching the output format in the system prompt. "
    "No markdown fences and no text outside the JSON."
)
REPAIR_TEMPLATE = (
    "The Mermaid renderer reported this error for the diagram above:\n{error}\n\n"
    "Return the corrected diagram in the same JSON format. "
    "Change only what is needed to fix the error."
)


@dataclass(frozen=True)
class AgentResult:
    session_id: str
    diagram_id: int | None
    turn: AgentTurn


@dataclass(frozen=True)
class SessionView:
    session: SessionRecord
    messages: list[MessageRecord]
    latest_turn: AgentTurn | None
    latest_diagram_id: int | None


def _title_from(prompt: str) -> str:
    first_line = next((line.strip() for line in prompt.splitlines() if line.strip()), "")
    return first_line.lstrip("# ")[:80] or DEFAULT_TITLE


class DiagramAgent:
    def __init__(self, llm: LLMClient, settings: Settings, system_prompt: str) -> None:
        self._llm = llm
        self._settings = settings
        self._system_prompt = system_prompt

    # ---- Public operations -------------------------------------------------

    def start_session(
        self, db: DBSession, payload: SessionCreate, progress: ProgressReporter = NULL_PROGRESS
    ) -> AgentResult:
        prompt = self._check_input(payload.prompt)
        progress.step("Checking request", 5, f"{payload.diagram_type} diagram, {len(prompt):,} characters")
        session = SessionRecord(id=str(uuid4()), diagram_type=payload.diagram_type, title=_title_from(prompt))
        db.add(session)
        db.flush()
        user_text = f"Diagram type: {payload.diagram_type}\n\n{prompt}"
        return self._run(db, session, user_text, kind="prompt", progress=progress)

    def reply(
        self, db: DBSession, session_id: str, content: str, progress: ProgressReporter = NULL_PROGRESS
    ) -> AgentResult:
        session = self._get_session(db, session_id)
        content = self._check_input(content)
        progress.step("Checking request", 5, f"{len(content):,} characters")
        kind = "answers" if self._last_assistant_kind(db, session.id) == "clarification" else "refinement"
        return self._run(db, session, content, kind=kind, progress=progress)

    def repair(
        self, db: DBSession, session_id: str, error: str, progress: ProgressReporter = NULL_PROGRESS
    ) -> AgentResult:
        session = self._get_session(db, session_id)
        latest = self._latest_diagram(db, session.id)
        if latest is None or self._last_assistant_kind(db, session.id) != "diagram":
            raise AppError(409, "no_current_diagram", "There is no current diagram to repair.")
        if latest.repair_count >= self._settings.max_repair_attempts:
            raise AppError(
                409,
                "repair_limit_reached",
                "This diagram has already been repaired once. Edit the prompt and generate again.",
            )
        progress.step("Repairing Mermaid code", 5, "Sending the renderer error to Claude")
        return self._run(
            db,
            session,
            REPAIR_TEMPLATE.format(error=error.strip()),
            kind="repair",
            require_diagram=True,
            repair_count=latest.repair_count + 1,
            progress=progress,
        )

    def get_session(self, db: DBSession, session_id: str) -> SessionView:
        session = self._get_session(db, session_id)
        messages = list(
            db.scalars(
                select(MessageRecord).where(MessageRecord.session_id == session.id).order_by(MessageRecord.id)
            )
        )
        last_assistant = next((m for m in reversed(messages) if m.role == "assistant"), None)
        latest_turn = parse_agent_turn(last_assistant.content) if last_assistant else None
        latest = self._latest_diagram(db, session.id)
        return SessionView(
            session=session,
            messages=messages,
            latest_turn=latest_turn,
            latest_diagram_id=latest.id if latest else None,
        )

    def list_sessions(self, db: DBSession, limit: int = 50) -> list[SessionRecord]:
        query = select(SessionRecord).order_by(SessionRecord.updated_at.desc()).limit(limit)
        return list(db.scalars(query))

    # ---- Orchestration -----------------------------------------------------

    def _run(
        self,
        db: DBSession,
        session: SessionRecord,
        user_text: str,
        kind: str,
        require_diagram: bool = False,
        repair_count: int = 0,
        progress: ProgressReporter = NULL_PROGRESS,
    ) -> AgentResult:
        limit_reached = self._clarification_rounds(db, session.id) >= self._settings.max_clarification_rounds
        outgoing_text = user_text
        if limit_reached and not require_diagram:
            outgoing_text = f"{user_text}\n\n{DIAGRAM_REQUIRED_NOTE}"
            progress.step("Clarification limit reached", 15, "Generating from the stated assumptions")

        history = self._history(db, session.id)
        progress.step("Building context", 15, f"{len(history) + 1} messages in the conversation")
        turn = self._request(
            history + [{"role": "user", "content": outgoing_text}],
            require_diagram=require_diagram or limit_reached,
            progress=progress,
        )

        is_clarification = isinstance(turn, ClarificationTurn)
        db.add(MessageRecord(session_id=session.id, role="user", kind=kind, content=user_text))
        db.add(
            MessageRecord(
                session_id=session.id,
                role="assistant",
                kind="clarification" if is_clarification else "diagram",
                content=turn.model_dump_json(),
            )
        )

        diagram_id = None
        if not is_clarification:
            record = DiagramRecord(session_id=session.id, content=turn.model_dump_json(), repair_count=repair_count)
            db.add(record)
            db.flush()
            diagram_id = record.id
            session.title = turn.title[:200]

        progress.step("Saving diagram", 92, "Storing the diagram and conversation history")
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        return AgentResult(session_id=session.id, diagram_id=diagram_id, turn=turn)

    def _request(
        self, messages: list[dict[str, str]], require_diagram: bool, progress: ProgressReporter = NULL_PROGRESS
    ) -> AgentTurn:
        """Call the model and validate its JSON. Retries once with the validation error on failure."""
        outgoing = messages
        for attempt in range(self._settings.max_json_retries + 1):
            if attempt == 0:
                progress.step("Calling Claude", 35, f"Model {self._settings.bedrock_model_id}")
            else:
                progress.step("Retrying with a correction", 80, "Asking Claude for valid JSON only")
            raw = self._call_llm(outgoing)
            try:
                progress.step("Validating response", 70, "Checking the JSON against the diagram schema")
                turn = parse_agent_turn(raw)
                if require_diagram and isinstance(turn, ClarificationTurn):
                    raise ValueError("clarification questions are not allowed here; generate the diagram")
                return turn
            except ValueError as exc:
                problem = str(exc)[:500]
                logger.warning("Rejected model output on attempt %d: %s", attempt + 1, problem)
                progress.step("Response rejected", 72, problem[:160])
                retry = RETRY_TEMPLATE.format(error=problem)
                if require_diagram:
                    retry = f"{retry}\n\n{DIAGRAM_REQUIRED_NOTE}"
                outgoing = outgoing + [
                    {"role": "assistant", "content": raw or "{}"},
                    {"role": "user", "content": retry},
                ]
        raise AppError(502, "invalid_llm_response", "The model returned an invalid response. Please try again.")

    def _call_llm(self, messages: list[dict[str, str]]) -> str:
        started = time.perf_counter()
        try:
            text = self._llm.converse(self._system_prompt, messages)
        except LLMTimeoutError as exc:
            logger.error("LLM call timed out after %.1fs", time.perf_counter() - started)
            raise AppError(504, "llm_timeout", "The model took too long to respond. Please try again.") from exc
        except LLMError as exc:
            logger.error("LLM call failed: %s", exc)
            raise AppError(502, "llm_error", "The model service is unavailable. Please try again.") from exc
        logger.info("LLM call finished in %.2fs with %d messages", time.perf_counter() - started, len(messages))
        return text

    # ---- Helpers -----------------------------------------------------------

    def _check_input(self, text: str) -> str:
        cleaned = text.strip()
        if not cleaned:
            raise AppError(422, "empty_input", "Input cannot be empty.")
        limit = self._settings.max_prompt_chars
        if len(cleaned) > limit:
            raise AppError(422, "prompt_too_long", f"Input is {len(cleaned):,} characters; the limit is {limit:,}.")
        return cleaned

    def _get_session(self, db: DBSession, session_id: str) -> SessionRecord:
        session = db.get(SessionRecord, session_id)
        if session is None:
            raise AppError(404, "session_not_found", f"Session {session_id} was not found.")
        return session

    def _history(self, db: DBSession, session_id: str) -> list[dict[str, str]]:
        rows = db.scalars(
            select(MessageRecord).where(MessageRecord.session_id == session_id).order_by(MessageRecord.id)
        )
        return [{"role": m.role, "content": m.content} for m in rows]

    def _clarification_rounds(self, db: DBSession, session_id: str) -> int:
        query = select(func.count()).where(
            MessageRecord.session_id == session_id,
            MessageRecord.role == "assistant",
            MessageRecord.kind == "clarification",
        )
        return int(db.scalar(query) or 0)

    def _last_assistant_kind(self, db: DBSession, session_id: str) -> str | None:
        query = (
            select(MessageRecord.kind)
            .where(MessageRecord.session_id == session_id, MessageRecord.role == "assistant")
            .order_by(MessageRecord.id.desc())
            .limit(1)
        )
        return db.scalar(query)

    def _latest_diagram(self, db: DBSession, session_id: str) -> DiagramRecord | None:
        query = (
            select(DiagramRecord)
            .where(DiagramRecord.session_id == session_id)
            .order_by(DiagramRecord.id.desc())
            .limit(1)
        )
        return db.scalars(query).first()
