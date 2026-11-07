import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import llm_client


class FakeResponse:
    def __init__(self, status=200, body=None, lines=None):
        self.status_code = status
        self.headers = {}
        self._body = body if body is not None else {}
        self._lines = lines or []
        self.closed = False

    def json(self):
        return self._body

    @property
    def text(self):
        return json.dumps(self._body)

    def iter_lines(self, *args, **kwargs):
        return iter(self._lines)

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests
            raise requests.HTTPError(f"HTTP {self.status_code}", response=self)

    def close(self):
        self.closed = True


class LlmClientTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.token = Path(self.tmp.name) / "token"
        self.token.write_text("tok-123\n", encoding="utf-8")
        self.env = mock.patch.dict(os.environ, {
            "LLM_PROVIDER": "cortex",
            "SNOWFLAKE_HOST": "acct.snowflakecomputing.com",
            "SNOWFLAKE_TOKEN_FILE_PATH": str(self.token),
            "CORTEX_MODEL": "claude-sonnet-4-6",
        })
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def post(self, payload, **kwargs):
        return llm_client.post_chat(payload, llm_client.credential(), openrouter_url=lambda: "unused",
                                    openrouter_headers=lambda key: {}, **kwargs)

    def test_default_provider_keeps_openrouter_behaviour(self):
        with mock.patch.dict(os.environ, {"LLM_PROVIDER": "", "OPENROUTER_API_KEY": "or-key"}):
            self.assertFalse(llm_client.is_cortex())
            self.assertEqual(llm_client.credential(), "or-key")
            with mock.patch("llm_client.requests.post", return_value=FakeResponse()) as post:
                llm_client.post_chat({"model": "x/y", "max_tokens": 5}, "or-key",
                                     openrouter_url=lambda: "https://openrouter.ai/api/v1/chat/completions",
                                     openrouter_headers=lambda key: {"Authorization": f"Bearer {key}"})
            args, kwargs = post.call_args
            self.assertEqual(args[0], "https://openrouter.ai/api/v1/chat/completions")
            self.assertEqual(kwargs["json"], {"model": "x/y", "max_tokens": 5})

    def test_cortex_credential_is_marker_not_token(self):
        self.assertEqual(llm_client.credential(), llm_client.CORTEX_CREDENTIAL_MARKER)
        self.token.unlink()
        self.assertIsNone(llm_client.credential())

    def test_payload_translation(self):
        body = llm_client.cortex_payload({
            "model": "openrouter/free", "max_tokens": 100, "temperature": 0.2,
            "provider": {"require_parameters": True}, "reasoning": {"effort": "none"},
            "plugins": [{"id": "file-parser"}], "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": "hi"}],
        })
        self.assertEqual(body["model"], "claude-sonnet-4-6")
        self.assertEqual(body["max_completion_tokens"], 100)
        for gone in ("max_tokens", "provider", "reasoning", "plugins", "response_format"):
            self.assertNotIn(gone, body)
        self.assertEqual(body["temperature"], 0.2)

    def test_cortex_model_names_are_kept_and_schema_simplified(self):
        body = llm_client.cortex_payload({
            "model": "claude-opus-4-6",
            "response_format": {"type": "json_schema", "json_schema": {"name": "t", "strict": True, "schema": {
                "type": "object", "properties": {"n": {"type": "integer", "minimum": 0, "maximum": 3},
                                                 "s": {"type": "string", "maxLength": 10}},
                "required": ["n"], "additionalProperties": False}}},
        })
        self.assertEqual(body["model"], "claude-opus-4-6")
        props = body["response_format"]["json_schema"]["schema"]["properties"]
        self.assertEqual(props["n"], {"type": "integer"})
        self.assertEqual(props["s"], {"type": "string"})

    def test_rest_request_uses_session_token(self):
        with mock.patch("llm_client.requests.post", return_value=FakeResponse(body={"choices": [{"message": {"content": "ok"}}]})) as post:
            response = self.post({"model": "openrouter/free", "messages": [], "max_tokens": 10})
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://acct.snowflakecomputing.com/api/v2/cortex/v1/chat/completions")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer tok-123")
        self.assertEqual(kwargs["headers"]["X-Snowflake-Authorization-Token-Type"], "OAUTH")
        self.assertEqual(response.json()["choices"][0]["message"]["content"], "ok")

    def test_stream_drops_chunks_without_choices(self):
        lines = [
            b'data: {"choices":[{"delta":{"content":"A"}}]}',
            b'data: {"choices":[],"usage":{"total_tokens":5}}',
            b'data: {"usage":{"total_tokens":5}}',
            b'',
            b'data: {"choices":[{"delta":{"content":"B"}}]}',
            b'data: [DONE]',
        ]
        with mock.patch("llm_client.requests.post", return_value=FakeResponse(lines=lines)) as post:
            response = self.post({"model": "claude-sonnet-4-6", "messages": []}, stream=True)
        self.assertEqual(post.call_args.kwargs["headers"]["Accept"], "text/event-stream")
        self.assertTrue(post.call_args.kwargs["json"]["stream"])
        out = list(response.iter_lines())
        self.assertEqual(out, [lines[0], b'', lines[4], lines[5]])

    def test_auth_rejection_falls_back_to_sql_ai_complete(self):
        sql_result = FakeResponse(body={"data": [[json.dumps({"choices": [{"messages": "SQL answer"}]})]]})
        with mock.patch.dict(os.environ, {"CORTEX_SQL_WAREHOUSE": "WH_BETATEST"}), \
                mock.patch("llm_client.requests.post", side_effect=[FakeResponse(status=401), sql_result]) as post:
            response = self.post({"model": "claude-sonnet-4-6", "temperature": 0.2, "max_tokens": 50,
                                  "messages": [{"role": "system", "content": "S"}, {"role": "user", "content": "U"}]},
                                 stream=True)
        sql_call = post.call_args_list[1]
        self.assertTrue(sql_call.args[0].endswith("/api/v2/statements"))
        body = sql_call.kwargs["json"]
        self.assertEqual(body["statement"], "SELECT AI_COMPLETE('claude-sonnet-4-6', ?, PARSE_JSON(?))")
        self.assertEqual(body["warehouse"], "WH_BETATEST")
        self.assertIn("[USER]\nU", body["bindings"]["1"]["value"])
        self.assertEqual(json.loads(body["bindings"]["2"]["value"]), {"temperature": 0.2, "max_tokens": 50})
        self.assertEqual(response.json()["choices"][0]["message"]["content"], "SQL answer")
        chunks = list(response.iter_lines())
        self.assertEqual(json.loads(chunks[0][6:])["choices"][0]["delta"]["content"], "SQL answer")
        self.assertEqual(chunks[-1], b"data: [DONE]")

    def test_sql_fallback_rejects_unsafe_model_name(self):
        with self.assertRaises(RuntimeError):
            llm_client._sql_fallback({"model": "x'); DROP TABLE t; --", "messages": []}, False, 5)

    def test_http_errors_still_raise_like_requests(self):
        import requests
        with mock.patch("llm_client.requests.post", return_value=FakeResponse(status=500)):
            with self.assertRaises(requests.HTTPError):
                self.post({"model": "claude-sonnet-4-6", "messages": []})


if __name__ == "__main__":
    unittest.main()
