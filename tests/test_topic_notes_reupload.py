from __future__ import annotations

import asyncio
import copy
import inspect
import json
import unittest
from unittest.mock import patch

import main
from tests.test_ai_agent_score_override import full_scout_record


ROOT = main.ROOT
DETAIL_HTML = (ROOT / "detail.html").read_text(encoding="utf-8")
DETAIL_JS = (ROOT / "src" / "detail.js").read_text(encoding="utf-8")
CSS = (ROOT / "src" / "styles.css").read_text(encoding="utf-8")


def json_request(payload: dict[str, object]) -> main.Request:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    delivered = False

    async def receive():
        nonlocal delivered
        if delivered:
            return {"type": "http.request", "body": b"", "more_body": False}
        delivered = True
        return {"type": "http.request", "body": body, "more_body": False}

    return main.Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [(b"content-type", b"application/json")],
            "client": ("127.0.0.1", 12345),
        },
        receive,
    )


class TopicNotesAndReuploadTests(unittest.TestCase):
    def test_topic_note_is_saved_outside_source_markdown(self):
        record = full_scout_record()
        original_report = record["source_report"]["raw_markdown"]
        saved: list[list[dict[str, object]]] = []
        request = json_request({
            "topic_id": "topic-target-relevance",
            "topic_key": "target-relevance",
            "topic_title": "4.1 Target Relevance",
            "body": "추가 확인이 필요한 biology 근거",
        })
        account = {"id": "user-1", "name": "Reviewer Kim", "email": "reviewer@example.com"}
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_records", return_value=[copy.deepcopy(record)]),
            patch.object(main, "save_records", side_effect=lambda records: saved.append(copy.deepcopy(records))),
        ):
            result = asyncio.run(main.add_record_topic_note(main.record_key(record), request))

        updated = result["record"]
        self.assertEqual(updated["source_report"]["raw_markdown"], original_report)
        self.assertEqual(updated["meta"]["topic_notes"][0]["topic_key"], "target-relevance")
        self.assertEqual(updated["meta"]["topic_notes"][0]["author_name"], "Reviewer Kim")
        self.assertEqual(saved[0][0]["source_report"]["raw_markdown"], original_report)

    def test_reupload_preserves_topic_notes_and_other_dashboard_meta(self):
        existing = full_scout_record()
        existing["meta"]["topic_notes"] = [{
            "id": "note-1",
            "topic_id": "topic-target-relevance",
            "topic_key": "target-relevance",
            "topic_title": "4.1 Target Relevance",
            "body": "Keep this note",
        }]
        incoming = full_scout_record()
        incoming["source_report"]["raw_markdown"] = "# New Full Scout report"

        main.preserve_dashboard_meta(incoming, existing)

        self.assertEqual(incoming["meta"]["topic_notes"], existing["meta"]["topic_notes"])
        self.assertIsNot(incoming["meta"]["topic_notes"], existing["meta"]["topic_notes"])
        self.assertEqual(incoming["source_report"]["raw_markdown"], "# New Full Scout report")

        main.append_report_reupload_snapshot(incoming, existing, actor_ip="127.0.0.1")
        snapshot = incoming["meta"]["report_reupload_history"][-1]
        self.assertEqual(snapshot["previous_source_report"]["raw_markdown"], existing["source_report"]["raw_markdown"])
        self.assertEqual(snapshot["previous_record_snapshot"]["scoring"], existing["scoring"])
        self.assertNotIn("report_reupload_history", snapshot["previous_record_snapshot"]["meta"])

    def test_topic_key_survives_numbering_changes(self):
        self.assertEqual(main.normalized_topic_note_key("4.1 Target Relevance"), "target-relevance")
        self.assertEqual(main.normalized_topic_note_key("5.2 Target Relevance"), "target-relevance")

    def test_detail_reupload_and_admin_json_controls_are_separated(self):
        self.assertIn('id="detailReuploadButton"', DETAIL_HTML)
        self.assertIn('M12 16V4M7.5 8.5 12 4l4.5 4.5', DETAIL_HTML)
        self.assertIn('id="reportReuploadInput"', DETAIL_HTML)
        self.assertIn('최신에 출력한 지침 2 GPT 응답 전체를 붙여넣으세요.', DETAIL_HTML)
        self.assertIn('id="editJsonButton"', DETAIL_HTML)
        self.assertIn("data-auth-admin", DETAIL_HTML)
        self.assertIn("json-admin-floating", DETAIL_HTML)
        self.assertIn("expandCompactInputRecord(payload, 'full')", DETAIL_JS)
        self.assertIn("splitAtRecoverableJsonSeparator(value)", DETAIL_JS)
        self.assertIn("형식 보정 ${parsed.recoveryCount}건", DETAIL_JS)
        self.assertIn("combined-ingestion.js?v=20260805-ingestion-guard-3", DETAIL_JS)
        self.assertIn("confirmed_replacements", DETAIL_JS)
        self.assertIn("Topic 메모", DETAIL_JS)
        self.assertIn("noteStateClass = notes.length ? ' has-notes' : ' is-empty'", DETAIL_JS)
        self.assertIn(".topic-note-panel", CSS)
        self.assertIn("border-top: 1px solid color-mix(in srgb, var(--muted) 22%, transparent);", CSS)
        self.assertIn(".topic-note-panel:hover .topic-note-panel-heading button", CSS)
        self.assertIn("@media (hover: none)", CSS)
        self.assertIn(".topic-note-form textarea:focus", CSS)
        self.assertIn(".report-reupload-modal", CSS)
        self.assertIn("#reportReuploadInput:focus-visible", CSS)
        self.assertIn(".json-admin-floating", CSS)
        self.assertIn(".topbar #detailReuploadButton", CSS)
        self.assertIn(".detail-shell .topbar #detailReuploadButton:hover", CSS)
        self.assertIn("linear-gradient(135deg, rgba(20, 184, 166, 0.34), rgba(14, 165, 233, 0.18))", CSS)
        self.assertIn(".detail-shell .collaboration-title-row .collaboration-title-actions", CSS)
        self.assertIn(".detail-shell .collaboration-title-actions .comment-count", CSS)

    def test_json_record_put_requires_configured_admin(self):
        source = inspect.getsource(main.update_record)
        self.assertIn("require_auth_admin(request)", source)


if __name__ == "__main__":
    unittest.main()
