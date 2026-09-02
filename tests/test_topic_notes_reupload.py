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

    def test_reupload_moves_unmatched_topic_note_to_comment(self):
        incoming = full_scout_record()
        incoming["source_report"]["raw_markdown"] = "# New Full Scout report\n\n## 4.2 MoA Validity"
        incoming["meta"]["topic_notes"] = [{
            "id": "note-1",
            "topic_id": "topic-target-relevance",
            "topic_key": "target-relevance",
            "topic_title": "4.1 Target Relevance",
            "body": "Keep this operational context",
            "author_name": "Reviewer Kim",
            "author_id": "reviewer-1",
            "author_email": "reviewer@example.com",
        }]

        moved = main.move_unmatched_topic_notes_to_comments(incoming)

        self.assertEqual(moved, ["note-1"])
        self.assertEqual(incoming["meta"]["topic_notes"], [])
        comment = incoming["meta"]["collaboration"]["comments"][0]
        self.assertEqual(comment["source"], "report_reupload_unmatched_topic_note")
        self.assertEqual(comment["author"], "Reviewer Kim")
        self.assertEqual(comment["author_user_id"], "reviewer-1")
        self.assertEqual(comment["author_email"], "reviewer@example.com")
        self.assertIn("매핑되지 않은 Topic 메모", comment["body"])
        self.assertIn("Keep this operational context", comment["body"])

    def test_confirmed_reupload_records_admin_and_moves_unmatched_topic_note(self):
        existing = full_scout_record()
        existing["meta"].update({"review_type": "full_scout", "output_filename_base": "Acme_AX-101"})
        existing["meta"]["topic_notes"] = [{
            "id": "note-1",
            "topic_id": "topic-target-relevance",
            "topic_key": "target-relevance",
            "topic_title": "4.1 Target Relevance",
            "body": "Keep this operational context",
            "author_name": "Reviewer Kim",
        }]
        incoming = copy.deepcopy(existing)
        incoming["source_report"]["raw_markdown"] = "# New Full Scout report\n\n## 4.2 MoA Validity"
        request = json_request({
            "records": [incoming],
            "confirmed_replacements": [{
                "incoming_record_id": main.record_key(incoming),
                "existing_record_id": main.record_key(existing),
            }],
        })
        saved: list[list[dict[str, object]]] = []
        admin = {"id": "admin-1", "name": "Review Admin", "email": "admin@example.com", "role": "administrator"}
        with (
            patch.object(main, "require_auth_admin", return_value=admin),
            patch.object(main, "load_records", return_value=[copy.deepcopy(existing)]),
            patch.object(main, "load_candidate_queue", return_value=[]),
            patch.object(main, "save_candidate_queue"),
            patch.object(main, "save_records", side_effect=lambda records: saved.append(copy.deepcopy(records))),
            patch.object(main, "deferred_markdown_exports", return_value={"exports": []}),
        ):
            result = asyncio.run(main.upsert_records(request))

        self.assertEqual(result["confirmed_reuploads"], 1)
        updated = saved[-1][0]
        snapshot = updated["meta"]["report_reupload_history"][-1]
        self.assertEqual(snapshot["actor_name"], "Review Admin")
        self.assertEqual(updated["meta"]["topic_notes"], [])
        self.assertEqual(
            updated["meta"]["collaboration"]["comments"][0]["source"],
            "report_reupload_unmatched_topic_note",
        )

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
        self.assertIn("combined-ingestion.js?v=20260805-ingestion-guard-5", DETAIL_JS)
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
