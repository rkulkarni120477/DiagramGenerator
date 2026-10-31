import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent import DiagramAgent
from app.config import Settings, get_settings
from app.database import Base, make_engine, make_session_factory
from app.errors import register_exception_handlers
from app.llm import BedrockLLMClient, LLMClient
from app.progress import ProgressStore
from app.routes import API_VERSION, router

PROMPT_PATH = Path(__file__).parent / "prompts" / "diagram_agent_system_prompt.txt"


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None, llm: LLMClient | None = None) -> FastAPI:
    """Application factory. Pass `llm` to replace Bedrock, for example with a fake in tests."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    if llm is None:
        if not settings.bedrock_model_id:
            raise RuntimeError("BEDROCK_MODEL_ID must be set to a Bedrock Claude model ID")
        llm = BedrockLLMClient(
            model_id=settings.bedrock_model_id,
            region=settings.aws_region,
            timeout_seconds=settings.llm_timeout_seconds,
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
            bearer_token=settings.aws_bearer_token_bedrock,
        )

    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)

    app = FastAPI(title="Diagram Studio API", version=API_VERSION)
    app.state.settings = settings
    app.state.session_factory = make_session_factory(engine)
    app.state.agent = DiagramAgent(llm, settings, PROMPT_PATH.read_text(encoding="utf-8"))
    app.state.progress = ProgressStore()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Progress-Id"],
    )
    register_exception_handlers(app)
    app.include_router(router, prefix="/api/v1")
    return app
