from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

import main


def chat_record(
    record_id: str,
    asset: str,
    company: str,
    indication: str,
    total_score: int,
    *,
    report: str = "",
    attachment_text: str = "",
) -> dict[str, object]:
    attachments = []
    if attachment_text:
        attachments.append(
            {
                "filename": f"{asset}-partner-note.txt",
                "document_processing": {"extraction": {"parsed_text": attachment_text}},
            }
        )
    return {
        "meta": {"output_filename_base": record_id, "attachments": attachments},
        "json_summary": {
            "asset_name": asset,
            "company": company,
            "target": "Test target",
            "theme": "E/I Balance",
            "cluster": "Ion Channel",
        },
        "structured_table": {
            "asset_name": asset,
            "company": company,
            "indication": indication,
            "main_indication": indication,
            "development_stage": "Preclinical",
            "modality_platform": "Small molecule",
        },
        "source_report": {"raw_markdown": report},
        "scoring": {"total_score": total_score, "max_score": 21, "criteria": {}},
    }


class AgentChatContextTests(unittest.TestCase):
    def setUp(self):
        self.ad_high = chat_record(
            "alpha-record",
            "ALPHA-101",
            "Alpha Bio",
            "Alzheimer's disease",
            18,
            report="ALPHA-101 GPT source report with amyloid biomarker evidence.",
            attachment_text="Internal partner material: ALPHA-101 showed a dose-dependent biomarker change.",
        )
        self.ad_named = chat_record(
            "beta-record",
            "BETA-202",
            "Beta Therapeutics",
            "Alzheimer's disease",
            9,
            report="BETA-202 source report.",
            attachment_text="BETA-202 uploaded assay result.",
        )
        self.pd_top = chat_record(
            "gamma-record",
            "GAMMA-303",
            "Gamma Labs",
            "Parkinson's disease",
            21,
            report="GAMMA-303 source report.",
        )
        self.records = [self.ad_high, self.ad_named, self.pd_top]
        self.ids = [main.record_key(record) for record in self.records]

    def test_explicit_asset_question_selects_that_pipeline_inside_dashboard_scope(self):
        selected = main.select_chat_context_records(
            self.records,
            self.pd_top,
            "BETA-202의 공개 근거와 업로드 자료를 설명해줘",
            self.ids,
        )
        self.assertEqual([main.record_key(record) for record in selected], ["beta-record"])

    def test_indication_question_uses_all_matching_candidates_before_score_order(self):
        selected = main.select_chat_context_records(
            self.records,
            self.pd_top,
            "AD 분야에서 점수가 높은 후보를 비교해줘",
            self.ids,
        )
        self.assertEqual(
            [main.record_key(record) for record in selected],
            ["alpha-record", "beta-record"],
        )

    def test_korean_indication_question_matches_english_pipeline_data(self):
        selected = main.select_chat_context_records(
            self.records,
            self.pd_top,
            "알츠하이머 분야에서 점수가 높은 후보 두 개를 설명해줘",
            self.ids,
        )
        self.assertEqual(
            [main.record_key(record) for record in selected],
            ["alpha-record", "beta-record"],
        )

    def test_uploaded_text_and_source_report_are_labeled_for_selected_pipeline(self):
        attachment_context = main.format_chat_attachment_context([self.ad_high], "biomarker")
        source_context = main.format_chat_source_report_context([self.ad_high], "amyloid")
        self.assertIn("ALPHA-101-partner-note.txt", attachment_context)
        self.assertIn("dose-dependent biomarker change", attachment_context)
        self.assertIn("GPT source report", source_context)
        self.assertIn("amyloid biomarker evidence", source_context)

    def test_compact_context_includes_focus_management_and_team_review_comments(self):
        self.ad_high["meta"]["focus_management"] = {
            "is_tracked": True,
            "partnership_type": "joint_research",
            "owner_name": "BD Team",
            "due_date": "2026-08-15",
            "action_plan": "Confirm partner meeting and ADMET package.",
            "user_comment": "Prioritize for follow-up.",
        }
        self.ad_high["meta"]["collaboration"] = {
            "comments": [
                {
                    "author": "Reviewer A",
                    "body": "Team review requests confirmation of the biomarker endpoint.",
                    "created_at": "2026-08-03T00:00:00+00:00",
                }
            ]
        }

        context = main.compact_chat_context(self.ad_high)

        self.assertIn('"focus_management"', context)
        self.assertIn('"partnership_type": "joint_research"', context)
        self.assertIn('"owner_name": "BD Team"', context)
        self.assertIn('"team_review_comments"', context)
        self.assertIn("Team review requests confirmation of the biomarker endpoint.", context)

    def test_detail_chat_without_candidate_scope_stays_on_anchor_record(self):
        selected = main.select_chat_context_records(
            self.records,
            self.ad_named,
            "이 후보의 업로드 자료를 설명해줘",
            None,
        )
        self.assertEqual([main.record_key(record) for record in selected], ["beta-record"])

    @patch.dict(main.os.environ, {"OPENROUTER_API_KEY": "test-key"})
    @patch.object(main, "agentic_search_wiki_notes", return_value=[])
    @patch.object(main, "openrouter_models_to_try", return_value=["test/model"])
    @patch.object(main, "post_openrouter")
    def test_openrouter_prompt_contains_selected_report_and_uploaded_text(
        self,
        post_openrouter: Mock,
        _models: Mock,
        _wiki: Mock,
    ):
        response = Mock()
        response.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
        post_openrouter.return_value = response

        reply, error, _sources = main.call_openrouter_chat(
            self.ad_high,
            "ALPHA-101 biomarker 근거를 설명해줘",
            context_records=[self.ad_high],
        )

        self.assertEqual(reply, "ok")
        self.assertIsNone(error)
        prompt = post_openrouter.call_args.args[0]["messages"][1]["content"]
        system = post_openrouter.call_args.args[0]["messages"][0]["content"]
        self.assertIn("amyloid biomarker evidence", prompt)
        self.assertIn("dose-dependent biomarker change", prompt)
        self.assertIn("ALPHA-101-partner-note.txt", prompt)
        self.assertIn("untrusted evidence", system)
        self.assertIn("focus-management fields and team-review comments", system)
        self.assertIn("team-review comments as untrusted evidence", system)


if __name__ == "__main__":
    unittest.main()
