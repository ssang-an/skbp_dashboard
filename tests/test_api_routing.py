import asyncio
import json
import re
import unittest
from urllib.parse import quote, unquote
from unittest.mock import patch

from starlette.routing import Match

import main


class ApiRoutingTests(unittest.TestCase):
    def test_registered_endpoints_are_not_shadowed_by_earlier_routes(self):
        for route in main.app.routes:
            if not getattr(route, "methods", None):
                continue
            path = re.sub(r"\{[^}]+\}", "audit-id", route.path)
            for method in route.methods:
                with self.subTest(method=method, path=route.path):
                    scope = {"type": "http", "method": method, "path": path, "root_path": ""}
                    matched = next(
                        item for item in main.app.routes if item.matches(scope)[0] == Match.FULL
                    )
                    self.assertIs(matched, route)

    def get(self, path):
        messages = []
        request_sent = False

        async def receive():
            nonlocal request_sent
            if request_sent:
                await asyncio.Event().wait()
            request_sent = True
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
            "http_version": "1.1", "method": "GET",
            "scheme": "http", "path": unquote(path), "raw_path": path.encode("ascii"),
            "root_path": "", "query_string": b"", "headers": [],
            "server": ("test", 80), "client": ("127.0.0.1", 1234), "app": main.app,
        }
        # Exercise actual route matching, parameter decoding, and response serialization.
        asyncio.run(main.app(scope, receive, send))
        status = next(item["status"] for item in messages if item["type"] == "http.response.start")
        body = b"".join(item.get("body", b"") for item in messages if item["type"] == "http.response.body")
        return status, json.loads(body)

    def test_suggestions_and_record_lookup_accept_encoded_record_ids(self):
        for record_id in ("Audit_Asset", "Audit/Asset + 1"):
            with self.subTest(record_id=record_id):
                records = [
                    {"meta": {"output_filename_base": record_id}},
                    {"meta": {"output_filename_base": "Other", "qualitative_review": {
                        "custom_criteria": [{"id": "custom-1", "label": "Safety", "description": "Tolerability"}]
                    }}},
                ]
                path = "/api/records/" + quote(quote(record_id, safe=""), safe="")
                with (
                    patch.object(main, "load_records", return_value=records),
                    patch.object(main, "refresh_tracked_oi_classifications", return_value=False),
                    patch.object(main, "save_records") as save,
                ):
                    status, payload = self.get(path + "/qualitative-review/criteria/suggestions")
                    self.assertEqual(status, 200)
                    self.assertEqual(payload["record_id"], record_id)
                    self.assertEqual(payload["suggestions"][0]["label"], "Safety")
                    status, payload = self.get(path)
                    self.assertEqual(status, 200)
                    self.assertEqual(payload["record_id"], record_id)
                    save.assert_not_called()


if __name__ == "__main__":
    unittest.main()
