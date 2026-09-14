import asyncio
import unittest
from unittest.mock import patch

import main


class ListingWebsiteValidationTests(unittest.TestCase):
    def test_malformed_hosts_and_ports_are_rejected_without_exceptions(self):
        for value in ("https://[", "https://[bad]/", "https://example.com:bad", "https://example.com:99999", "https://user@", "javascript:alert(1)"):
            with self.subTest(value=value):
                self.assertEqual(main.normalize_listing_website(value), "")

    def test_valid_domains_paths_and_ipv6_hosts_are_preserved(self):
        for value, expected in (
            ("https://example.com/path?q=1", "https://example.com/path?q=1"),
            ("www.example.com", "https://www.example.com"),
            ("https://[::1]", "https://[::1]"),
            ("https://[::1]:8443/path", "https://[::1]:8443/path"),
        ):
            with self.subTest(value=value):
                self.assertEqual(main.normalize_listing_website(value), expected)

    def test_invalid_optional_website_does_not_abort_listing_import_preview(self):
        rows = [
            {"company_input": "Audit Bio", "asset_input": "AUD-1", "website": "https://["},
            {"company_input": "Other Bio", "asset_input": "AUD-2", "website": "https://example.com"},
        ]

        class Request:
            async def json(self):
                return {"rows": rows}

        with (
            patch.object(main, "require_authenticated_user", return_value={"id": "audit"}),
            patch.object(main, "load_records", return_value=[]),
            patch.object(main, "load_candidate_queue", return_value=[]),
            patch.object(main, "save_candidate_queue") as save,
        ):
            result = asyncio.run(main.preview_candidate_queue_import(Request()))
            self.assertEqual(result["parsed"], 2)
            self.assertEqual(result["unparsed_lines"], [])
            save.assert_not_called()
        parsed = main.normalize_candidate_queue_rows(rows)
        self.assertEqual(parsed["rows"][0]["website"], "")
        self.assertEqual(parsed["rows"][1]["website"], "https://example.com")
