"""LLM transport for the dashboard: OpenRouter (default, unchanged) or Snowflake Cortex.

Select with LLM_PROVIDER:
  openrouter (default)  POST to OpenRouter with OPENROUTER_API_KEY, exactly as before.
  cortex                POST to the Cortex REST API (OpenAI-compatible chat/completions) inside
                        Snowflake, authenticated with the SPCS session token. No API key and no
                        external access integration are needed.

Cortex settings (all optional):
  CORTEX_MODEL           model used when a request still names an OpenRouter model id
                         (default claude-sonnet-4-6)
  CORTEX_BASE_URL        override https://$SNOWFLAKE_HOST
  CORTEX_SQL_WAREHOUSE   warehouse for the SQL fallback (AI_COMPLETE) used only if the REST API
                         rejects the session token (401/403)
  SNOWFLAKE_TOKEN_FILE_PATH  token file (default /snowflake/session/token)
"""

from __future__ import annotations

import copy
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Callable, Iterator

import requests

CORTEX_CHAT_PATH = "/api/v2/cortex/v1/chat/completions"
CORTEX_SQL_PATH = "/api/v2/statements"
DEFAULT_CORTEX_MODEL = "claude-sonnet-4-6"
CORTEX_CREDENTIAL_MARKER = "snowflake-cortex-session"
# Request fields Cortex rejects or that only mean something to OpenRouter.
OPENROUTER_ONLY_FIELDS = ("provider", "plugins", "transforms", "route", "models", "reasoning")
# JSON-Schema keywords Claude structured output rejects (verified for minimum/maximum).
UNSUPPORTED_SCHEMA_KEYWORDS = {
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
    "minLength", "maxLength", "pattern", "format", "minItems", "maxItems", "uniqueItems",
}
MODEL_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]*$")


def provider() -> str:
    return os.getenv("LLM_PROVIDER", "openrouter").strip().lower() or "openrouter"


def is_cortex() -> bool:
    return provider() == "cortex"


def _token_path() -> Path:
    return Path(os.getenv("SNOWFLAKE_TOKEN_FILE_PATH") or "/snowflake/session/token")


def _read_token() -> str:
    # SPCS refreshes this file; read it on every request instead of caching.
    try:
        return _token_path().read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def credential() -> str | None:
    """Value callers treat as 'AI is configured'. In Cortex mode this is a marker, not a secret."""
    if is_cortex():
        return CORTEX_CREDENTIAL_MARKER if _read_token() else None
    return os.getenv("OPENROUTER_API_KEY")


def _cortex_base_url() -> str:
    base = os.getenv("CORTEX_BASE_URL", "").strip()
    if base:
        return base.rstrip("/")
    host = os.getenv("SNOWFLAKE_HOST", "").strip()
    if not host:
        raise RuntimeError("SNOWFLAKE_HOST is not set; Cortex mode must run inside Snowpark Container Services.")
    return f"https://{host}"


def _cortex_headers(accept: str) -> dict[str, str]:
    token = _read_token()
    if not token:
        raise RuntimeError(f"Snowflake session token not found at {_token_path()}.")
    return {
        "Authorization": f"Bearer {token}",
        "X-Snowflake-Authorization-Token-Type": "OAUTH",
        "Content-Type": "application/json",
        "Accept": accept,
    }


def _simplify_schema(node: Any) -> Any:
    if isinstance(node, dict):
        return {k: _simplify_schema(v) for k, v in node.items() if k not in UNSUPPORTED_SCHEMA_KEYWORDS}
    if isinstance(node, list):
        return [_simplify_schema(v) for v in node]
    return node


def cortex_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Translate an OpenRouter-style chat payload into one the Cortex REST API accepts."""
    body = copy.deepcopy(payload)
    if "max_tokens" in body:
        body.setdefault("max_completion_tokens", body.pop("max_tokens"))
        body.pop("max_tokens", None)
    for field in OPENROUTER_ONLY_FIELDS:
        body.pop(field, None)
    response_format = body.get("response_format")
    if isinstance(response_format, dict):
        if response_format.get("type") == "json_schema":
            json_schema = response_format.get("json_schema") or {}
            if isinstance(json_schema.get("schema"), dict):
                json_schema["schema"] = _simplify_schema(json_schema["schema"])
        else:
            # json_object is rejected by Cortex; the prompts already require a JSON-only answer.
            body.pop("response_format", None)
    model = str(body.get("model") or "")
    if not MODEL_NAME_RE.match(model):
        body["model"] = os.getenv("CORTEX_MODEL", DEFAULT_CORTEX_MODEL).strip() or DEFAULT_CORTEX_MODEL
    return body


def _filtered_sse_lines(raw_lines: Iterator[bytes]) -> Iterator[bytes]:
    """Drop chunks without choices (e.g. usage-only) so callers can always read choices[0]."""
    for raw in raw_lines:
        line = raw.decode("utf-8", errors="replace").strip() if isinstance(raw, bytes) else str(raw).strip()
        if line.startswith("data:"):
            data_text = line[5:].strip()
            if data_text and data_text != "[DONE]":
                try:
                    data = json.loads(data_text)
                except json.JSONDecodeError:
                    data = None
                if isinstance(data, dict) and not data.get("error") and not data.get("choices"):
                    continue
        yield raw if isinstance(raw, bytes) else str(raw).encode("utf-8")


class _CortexStreamResponse:
    """requests.Response stand-in whose iter_lines() yields only chunks that carry choices."""

    def __init__(self, response: requests.Response):
        self._response = response
        self.status_code = response.status_code
        self.headers = response.headers

    def iter_lines(self, *args: Any, **kwargs: Any) -> Iterator[bytes]:
        return _filtered_sse_lines(self._response.iter_lines(*args, **kwargs))

    def raise_for_status(self) -> None:
        self._response.raise_for_status()

    def json(self) -> Any:
        return self._response.json()

    @property
    def text(self) -> str:
        return self._response.text

    def close(self) -> None:
        self._response.close()


class _CompletedResponse:
    """Response built from a SQL AI_COMPLETE result, shaped like an OpenAI chat completion."""

    def __init__(self, content: str, model: str, stream: bool):
        self.status_code = 200
        self.headers: dict[str, str] = {}
        self._content = content
        self._model = model
        self._stream = stream

    def json(self) -> dict[str, Any]:
        return {
            "model": self._model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": self._content}, "finish_reason": "stop"}],
            "usage": {},
        }

    def iter_lines(self, *args: Any, **kwargs: Any) -> Iterator[bytes]:
        chunk = {"model": self._model, "choices": [{"index": 0, "delta": {"content": self._content}}]}
        yield ("data: " + json.dumps(chunk, ensure_ascii=False)).encode("utf-8")
        yield b"data: [DONE]"

    @property
    def text(self) -> str:
        return json.dumps(self.json(), ensure_ascii=False)

    def raise_for_status(self) -> None:
        return None

    def close(self) -> None:
        return None


def _flatten_messages(messages: list[dict[str, Any]]) -> str:
    parts = []
    for message in messages or []:
        content = message.get("content")
        if isinstance(content, list):
            content = "\n".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
        parts.append(f"[{str(message.get('role') or 'user').upper()}]\n{content}")
    return "\n\n".join(parts)


def _sql_fallback(body: dict[str, Any], stream: bool, timeout: int) -> _CompletedResponse:
    """Call AI_COMPLETE through the SQL API with the same session token (no streaming)."""
    model = body["model"]
    if not MODEL_NAME_RE.match(model):
        raise RuntimeError(f"Unsupported Cortex model name: {model!r}")
    parameters = {}
    if isinstance(body.get("temperature"), (int, float)):
        parameters["temperature"] = float(body["temperature"])
    if isinstance(body.get("max_completion_tokens"), int):
        parameters["max_tokens"] = int(body["max_completion_tokens"])
    request_body: dict[str, Any] = {
        # Model must be a literal; it is validated against MODEL_NAME_RE above. The prompt is bound.
        "statement": f"SELECT AI_COMPLETE('{model}', ?, PARSE_JSON(?))",
        "bindings": {
            "1": {"type": "TEXT", "value": _flatten_messages(body.get("messages") or [])},
            "2": {"type": "TEXT", "value": json.dumps(parameters)},
        },
        "timeout": timeout,
    }
    warehouse = os.getenv("CORTEX_SQL_WAREHOUSE", "").strip()
    if warehouse:
        request_body["warehouse"] = warehouse
    url = _cortex_base_url() + CORTEX_SQL_PATH
    response = requests.post(url, json=request_body, headers=_cortex_headers("application/json"), timeout=timeout)
    deadline = time.monotonic() + timeout
    while response.status_code == 202 and time.monotonic() < deadline:
        handle_url = _cortex_base_url() + response.json().get("statementStatusUrl", "")
        time.sleep(1)
        response = requests.get(handle_url, headers=_cortex_headers("application/json"), timeout=timeout)
    response.raise_for_status()
    value = response.json()["data"][0][0]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            parsed = value
    else:
        parsed = value
    if isinstance(parsed, dict):
        # AI_COMPLETE with model parameters returns {"choices":[{"messages": "..."}], ...}.
        choices = parsed.get("choices") or [{}]
        content = choices[0].get("messages") or choices[0].get("message") or ""
        if isinstance(content, dict):
            content = content.get("content", "")
    else:
        content = str(parsed)
    return _CompletedResponse(str(content), model, stream)


def post_chat(
    payload: dict[str, Any],
    api_key: str | None,
    *,
    stream: bool = False,
    timeout: int = 120,
    openrouter_url: Callable[[], str],
    openrouter_headers: Callable[[str], dict[str, str]],
) -> Any:
    """POST a chat-completions payload. Raises requests.HTTPError like requests.raise_for_status()."""
    if not is_cortex():
        response = requests.post(
            openrouter_url(),
            json=payload,
            headers=openrouter_headers(api_key or ""),
            timeout=timeout,
            stream=stream,
            verify=False,
        )
        response.raise_for_status()
        return response

    body = cortex_payload(payload)
    if stream:
        body["stream"] = True
    response = requests.post(
        _cortex_base_url() + CORTEX_CHAT_PATH,
        json=body,
        headers=_cortex_headers("text/event-stream" if stream else "application/json"),
        timeout=timeout,
        stream=stream,
    )
    if response.status_code in (401, 403):
        response.close()
        return _sql_fallback(body, stream, timeout)
    response.raise_for_status()
    return _CortexStreamResponse(response) if stream else response
