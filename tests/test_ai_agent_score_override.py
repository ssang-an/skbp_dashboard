from __future__ import annotations

import copy
import unittest

import main


SCORES = {
    "target_relevance": 3,
    "competitive_landscape": 2,
    "moa_validity": 2,
    "platform_attractiveness": 2,
    "expansion_potential": 2,
    "data_maturity": 2,
    "marketability": 1,
}


def full_scout_record() -> dict[str, object]:
    record = {
        "meta": {
            "review_type": "full_scout",
            "schema_version": main.FULL_SCOUT_SCHEMA_VERSION,
            "instruction_version": main.SCORING_CRITERIA_VERSION,
            "rubric_version": main.SCORING_CRITERIA_VERSION,
            "generated_at": "2026-08-03",
            "output_filename_base": "AI_Agent_Override_Test",
            "edit_history": [],
        },
        "structured_table": {
            "company": "Test Bio",
            "asset_name": "TEST-101",
            "development_stage": "Preclinical unspecified",
        },
        "json_summary": {"company": "Test Bio", "asset_name": "TEST-101"},
        "scoring": {
            "total_score": sum(SCORES.values()),
            "max_score": 21,
            "criteria": {
                criterion_id: {
                    "score": score,
                    "evidence_type": "E3_asset_specific_preclinical_or_technical_evidence",
                    "main_line_summary": "Official GPT score",
                    "why_not_higher": "Additional evidence required",
                    "uncertain_points": [],
                }
                for criterion_id, score in SCORES.items()
            },
        },
        "hard_filter": {"status": "PASS", "reason": "Official rubric result"},
        "source_report": {
            "raw_markdown": """# TEST-101 Full Scout

| Criterion | Score |
|---|---:|
| Marketability | 1 / 3 |
| **Total** | **14 / 21** |
""",
            "revision_history": [],
        },
    }
    record["scoring"]["criteria"]["marketability"]["calculation"] = {
        "commercial_rationale_status": "evidence_based",
        "A_targetable_addressable_patient": {"targetable_addressable_patient": 100_000},
        "B_unrisked_peak_sales": {"unrisked_peak_sales": 1_200_000_000},
        "C_obtainable_peak_sales": {"obtainable_peak_sales": 800_000_000},
    }
    return record


class AiAgentScoreOverrideTests(unittest.TestCase):
    def test_agent_score_change_uses_team_review_override_and_preserves_official_score(self):
        original = full_scout_record()
        result = main.build_ai_revision_update(
            original,
            "Marketability: 3 / 3\n근거: 업로드 자료에서 상업성 근거를 확인했습니다.",
            "Detail AI Agent score review",
            actor_name="Reviewer Kim",
            actor_ip="127.0.0.1",
        )
        updated = result["record"]

        self.assertEqual(updated["scoring"]["criteria"]["marketability"]["score"], 1)
        self.assertEqual(updated["scoring"]["total_score"], 14)
        overrides = updated["meta"]["human_review"]["overrides"]
        self.assertEqual(overrides["scores"]["marketability"], 3)
        self.assertEqual(overrides["total_score"], 16)

        team_events = [
            entry
            for entry in updated["meta"]["edit_history"]
            if entry.get("source") == "detail_ai_agent_score_override"
        ]
        self.assertEqual([entry["field"] for entry in team_events], ["scores.marketability", "total_score"])
        self.assertTrue(all(entry["actor_name"] == "Reviewer Kim" for entry in team_events))
        self.assertTrue(all(entry["change_method"] == "ai_agent" for entry in team_events))

        report = updated["source_report"]["raw_markdown"]
        self.assertIn("| Marketability | 1 / 3 |", report)
        self.assertIn("| **Total** | **14 / 21** |", report)
        self.assertIn("## AI Agent Revision Note", report)
        self.assertNotIn("> **기준 업데이트", report)
        self.assertEqual(updated["source_report"]["revision_history"][-1]["actor_name"], "Reviewer Kim")

    def test_agent_score_path_assignment_cannot_bypass_human_override_layer(self):
        original = full_scout_record()
        result = main.build_ai_revision_update(
            original,
            "scoring.criteria.marketability.score = 3\nMarketability: 3 / 3",
            actor_name="Reviewer Kim",
            actor_ip="127.0.0.1",
        )
        updated = result["record"]

        self.assertEqual(updated["scoring"]["criteria"]["marketability"]["score"], 1)
        self.assertEqual(updated["meta"]["human_review"]["overrides"]["scores"]["marketability"], 3)

    def test_manual_criterion_override_updates_effective_total_without_changing_gpt_scores(self):
        record = full_scout_record()
        record["meta"]["human_review"] = {
            "overrides": {"scores": {"target_relevance": 2}},
        }

        self.assertEqual(main.dashboard_effective_score(record, "target_relevance"), 2)
        self.assertEqual(main.dashboard_effective_total_score(record), 13)
        self.assertEqual(record["scoring"]["criteria"]["target_relevance"]["score"], 3)
        self.assertEqual(record["scoring"]["total_score"], 14)

    def test_rubric_refresh_clears_active_score_overrides_but_preserves_history(self):
        record = full_scout_record()
        result = main.build_ai_revision_update(
            record,
            "Marketability: 3 / 3",
            actor_name="Reviewer Kim",
            actor_ip="127.0.0.1",
        )
        updated = result["record"]
        history_before = copy.deepcopy(updated["meta"]["human_review"]["history"])

        cleared = main.clear_manual_scoring_overrides_for_rubric_refresh(updated, "2026-08-03T00:00:00+00:00")

        self.assertEqual(cleared["scores"]["marketability"], 3)
        self.assertEqual(cleared["total_score"], 16)
        self.assertNotIn("scores", updated["meta"]["human_review"]["overrides"])
        self.assertNotIn("total_score", updated["meta"]["human_review"]["overrides"])
        self.assertEqual(updated["meta"]["human_review"]["history"], history_before)

    def test_agent_revision_note_does_not_replace_gpt_source_modified_provenance(self):
        record = full_scout_record()
        main.append_edit_history(
            record,
            source="dashboard_tab2_rubric_recalculation",
            actor_ip="127.0.0.1",
            field="source_report.raw_markdown",
            new_value="rubric v3.3",
        )
        expected_timestamp = record["meta"]["edit_history"][-1]["changed_at"]
        main.append_edit_history(
            record,
            source="detail_ai_agent_revision",
            actor_ip="127.0.0.1",
            actor_name="Reviewer Kim",
            field="source_report.revision_note",
            new_value="AI Agent Revision Note 추가",
        )

        main.synchronize_full_scout_source_revision_metadata(record)

        self.assertEqual(record["meta"]["last_edited_at"], expected_timestamp)
        self.assertEqual(record["meta"]["last_edited_by"], "127.0.0.1")

    def test_agent_apply_preview_shows_json_report_and_export_without_mutating_base_record(self):
        record = full_scout_record()
        base_hash = main.record_revision_hash(record)

        result = main.prepare_ai_revision_candidate(
            record,
            "Marketability: 3 / 3",
            "Detail AI Agent score review",
            actor_name="Reviewer Kim",
            actor_ip="127.0.0.1",
        )
        preview = main.build_ai_revision_preview(record, result["record"], result["changes"])

        paths = {row["path"] for row in preview["json_diff"]}
        self.assertIn("meta.human_review.overrides.scores.marketability", paths)
        self.assertIn("meta.human_review.overrides.total_score", paths)
        self.assertEqual(preview["report_diff"]["mode"], "append")
        self.assertIn("Revision Note", preview["report_diff"]["summary"])
        self.assertEqual(preview["wiki_export"]["targets"], ["Obsidian export", "Pipeline Wiki export"])
        self.assertEqual(result["record"]["meta"]["edit_history"][-1]["field"], "source_report.revision_note")
        self.assertEqual(record["scoring"]["criteria"]["marketability"]["score"], 1)
        self.assertEqual(main.record_revision_hash(record), base_hash)


if __name__ == "__main__":
    unittest.main()
