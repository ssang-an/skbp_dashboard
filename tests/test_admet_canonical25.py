from __future__ import annotations

import unittest

import main


def admet_attachment(text: str, filename: str = "partner_ADMET.pdf", category: str | None = None) -> dict:
    attachment = {
        "filename": filename,
        "document_processing": {"extraction": {"parsed_text": text}},
    }
    if category:
        attachment["partner_material_category"] = category
    return attachment


class AdmetCanonical25Tests(unittest.TestCase):
    def test_partner_material_category_supports_ir_and_dd_report(self):
        self.assertEqual(main.partner_material_category("Threebrooks_IR.pdf"), "ir")
        self.assertEqual(main.partner_material_category("Threebrooks_DD Report.pdf"), "dd_report")
        self.assertEqual(
            main.attachment_partner_material_category({"filename": "opaque.pdf", "partner_material_category": "dd_report"}),
            "dd_report",
        )

    def test_case_a_table_format_counts_each_canonical_study_once(self):
        studies = [
            "Cell permeability / P-gp", "Mouse PK", "Rat PK", "Dog PK", "Monkey PK",
            "BBB penetration", "Brain tissue binding", "Plasma protein binding", "Liver microsome stability",
            "Hepatocyte clearance", "Metabolite identification", "Microsomal protein binding",
            "CYP inhibition", "Reaction phenotyping", "Human PK prediction", "Rodent single dose toxicity",
            "Rodent 5d repeated dose", "Rodent 14d repeated dose", "Non-rodent dose escalation",
            "Ames", "In vitro MN", "In vivo MN", "hERG", "Cardiac ion channel", "MEA",
        ]
        text = "\n".join(f"{study} | Y" for study in studies)
        self.assertEqual(main.count_admet_completed([admet_attachment(text)]), 25)

    def test_case_b_aliases_and_multiline_status_do_not_double_count(self):
        text = "\n".join([
            "Cell permeability", "Y", "P-gp substrate | completed", "Metabolite ID", "Y (Met ID)",
        ])
        self.assertEqual(main.count_admet_completed([admet_attachment(text)]), 2)

    def test_case_c_negative_and_pending_statuses_are_not_completed(self):
        text = "\n".join([
            "Mouse PK | N", "Rat PK | planned", "Dog PK | not completed", "Monkey PK | 진행 중",
        ])
        self.assertEqual(main.count_admet_completed([admet_attachment(text)]), 0)

    def test_case_c2_korean_completion_and_negative_precedence(self):
        text = "\n".join([
            "Mouse PK | 수행 완료",
            "Rat PK | 시험 완료. 보고서 작성 중",
            "Dog PK | COMPLETE",
            "Monkey PK | Incomplete",
            "BBB penetration | Not completed",
        ])
        self.assertEqual(main.count_admet_completed([admet_attachment(text)]), 3)

    def test_case_d_optional_study_is_excluded(self):
        self.assertEqual(main.count_admet_completed([admet_attachment("Dog telemetry | Y")]), 0)

    def test_case_e_unknown_study_is_not_in_the_numerator(self):
        self.assertEqual(main.count_admet_completed([admet_attachment("SafetyScreen panel | Y")]), 0)

    def test_case_f_only_admet_materials_are_counted(self):
        self.assertIsNone(main.count_admet_completed([admet_attachment("Mouse PK | Y", "partner_CDP.pdf")]))
        self.assertEqual(
            main.count_admet_completed([admet_attachment("Mouse PK | Y", "opaque.pdf", category="admet")]),
            1,
        )

    def test_case_g_admet_text_does_not_change_in_vivo_or_in_vitro_status(self):
        record = {
            "source_report": {"raw_markdown": ""},
            "meta": {"attachments": [admet_attachment("Mouse PK | Y\nIn vivo efficacy demonstrated", category="admet")]},
        }
        detected = main.auto_detect_evidence_fields(record)
        self.assertEqual(detected["admet_completed"], 1)
        self.assertEqual(detected["in_vivo_status"], "N/A")
        self.assertEqual(detected["in_vitro_status"], "N/A")

    def test_case_h_study_status_count_wins_when_deepseek_count_is_blank(self):
        attachment = admet_attachment("Mouse PK | Y\nRat PK | Completed")
        attachment["document_processing"]["deepseek_analysis"] = {
            "status": "completed",
            "result": {
                "in_vivo_efficacy": {"verdict": "unknown"},
                "in_vitro_efficacy": {"verdict": "unknown"},
                "admet_completed_count": None,
            },
        }
        detected = main.auto_detect_evidence_fields(
            {"source_report": {"raw_markdown": ""}, "meta": {"attachments": [attachment]}}
        )
        self.assertEqual(detected["admet_completed"], 2)
        self.assertEqual(detected["admet_completed_source"], "study_status")


if __name__ == "__main__":
    unittest.main()
