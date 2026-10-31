from typing import Any, Protocol
from urllib.parse import quote

import boto3
import httpx
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError, ConnectTimeoutError, ReadTimeoutError

from app.errors import LLMError, LLMTimeoutError


class LLMClient(Protocol):
    def converse(self, system_prompt: str, messages: list[dict[str, str]]) -> str:
        """Send a conversation and return the model's text. Raises LLMError or LLMTimeoutError."""
        ...


class BedrockLLMClient:
    """Calls an Anthropic Claude model on Amazon Bedrock through the Converse API.

    By default credentials come from the boto3 chain (IAM role, profile or environment).
    If a Bedrock API key (bearer token) is supplied, the REST endpoint is called directly
    with an Authorization header, because boto3 does not read that token.
    """

    def __init__(
        self,
        model_id: str,
        region: str,
        timeout_seconds: float,
        max_tokens: int,
        temperature: float | None,
        bearer_token: str | None = None,
        client: Any | None = None,
    ) -> None:
        self._model_id = model_id
        self._max_tokens = max_tokens
        self._temperature = temperature
        self._bearer_token = bearer_token
        self._http: httpx.Client | None = None
        self._client = None
        if bearer_token:
            self._http = httpx.Client(
                base_url=f"https://bedrock-runtime.{region}.amazonaws.com",
                timeout=httpx.Timeout(timeout_seconds, connect=10.0),
                headers={"Authorization": f"Bearer {bearer_token}", "Content-Type": "application/json"},
            )
        else:
            self._client = client or boto3.client(
                "bedrock-runtime",
                region_name=region,
                config=BotoConfig(
                    connect_timeout=10,
                    read_timeout=int(timeout_seconds),
                    retries={"max_attempts": 3, "mode": "standard"},
                ),
            )

    def converse(self, system_prompt: str, messages: list[dict[str, str]]) -> str:
        converse_messages = [{"role": m["role"], "content": [{"text": m["content"]}]} for m in messages]
        inference_config: dict[str, Any] = {"maxTokens": self._max_tokens}
        if self._temperature is not None:
            inference_config["temperature"] = self._temperature
        if self._http is not None:
            return self._converse_with_token(system_prompt, converse_messages, inference_config)

        try:
            response = self._client.converse(
                modelId=self._model_id,
                system=[{"text": system_prompt}],
                messages=converse_messages,
                inferenceConfig=inference_config,
            )
        except (ReadTimeoutError, ConnectTimeoutError) as exc:
            raise LLMTimeoutError(str(exc)) from exc
        except (ClientError, BotoCoreError) as exc:
            raise LLMError(str(exc)) from exc
        return _text_of(response)

    def _converse_with_token(self, system_prompt: str, messages: list[dict], inference_config: dict) -> str:
        path = f"/model/{quote(self._model_id, safe='')}/converse"
        body = {"system": [{"text": system_prompt}], "messages": messages, "inferenceConfig": inference_config}
        try:
            response = self._http.post(path, json=body)
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(str(exc)) from exc
        except httpx.HTTPError as exc:
            raise LLMError(str(exc)) from exc
        if response.status_code >= 400:
            raise LLMError(f"Bedrock returned HTTP {response.status_code}: {response.text[:300]}")
        return _text_of(response.json())


def _text_of(response: dict) -> str:
    blocks = response["output"]["message"]["content"]
    return "".join(block.get("text", "") for block in blocks)
