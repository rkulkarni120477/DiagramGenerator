from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


class FakeLLM:
    """Returns scripted responses in order and records every request it receives."""

    def __init__(self, responses: list) -> None:
        self.responses = list(responses)
        self.calls: list[list[dict[str, str]]] = []

    def converse(self, system_prompt: str, messages: list[dict[str, str]]) -> str:
        self.calls.append([dict(m) for m in messages])
        if not self.responses:
            raise AssertionError("unexpected LLM call")
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


@pytest.fixture
def make_client(tmp_path: Path):
    def _make(responses: list, **overrides):
        database_url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
        settings = Settings(
            _env_file=None,
            database_url=database_url,
            bedrock_model_id="test-model",
            **overrides,
        )
        llm = FakeLLM(responses)
        return TestClient(create_app(settings=settings, llm=llm)), llm

    return _make
