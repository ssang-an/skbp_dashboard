from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import unittest
from datetime import date
from pathlib import Path
from typing import Any

import jsonschema

import main
from record_storage import minimize_record_for_dashboard_storage, serialized_size


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "json" / "pipeline-records.json"
SCHEMA_FILE = ROOT / "json" / "drug-valuation.schema.json"
LEGACY_GIT_REF = "19aa4b9"
LEGACY_GIT_PATH = "json/pipeline-records.json"
EXPECTED_RECORD_COUNT = 33
LEGACY_SERIALIZED_SIZE = 1_107_925
LEGACY_RESEARCH_SERIALIZED_SIZE = 407_650
TRIAGE_SCORE_IDS = ("target_relevance", "moa_validity", "data_maturity")

CORE_TABLE_FIELDS = (
    "company",
    "asset_name",
    "target",
    "moa",
    "modality_platform",
    "main_indication",
    "indication",
    "development_stage",
    "company_country",
)
OPERATIONAL_META_FIELDS = (
    "focus_management",
    "attachments",
    "collaboration",
    "qualitative_review",
    "topic_notes",
    "report_reupload_history",
    "human_review",
    "edit_history",
    "last_edited_at",
    "last_edited_by",
)


def _object(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _home_core_projection(record: dict[str, Any]) -> dict[str, str]:
    """Mirror the home table's identity/core fallback order, without DOM concerns."""

    summary = _object(record.get("json_summary"))
    table = _object(record.get("structured_table"))
    return {
        "company": _text(summary.get("company") or table.get("company") or "-"),
        "asset_name": _text(summary.get("asset_name") or table.get("asset_name") or "-"),
        "target": _text(summary.get("target") or table.get("target") or "-"),
        "moa": _text(table.get("moa") or "-"),
        "company_country": _text(summary.get("company_country") or table.get("company_country") or "-"),
        "development_stage": _text(table.get("development_stage") or "-"),
        "indication": _text(table.get("indication") or "-"),
        "main_indication": _text(
            table.get("main_indication")
            or table.get("primary_indication")
            or summary.get("main_indication")
            or table.get("indication")
            or "-"
        ),
        "modality_platform": _text(table.get("modality_platform") or "-"),
    }


def _summary_without_generated_at(summary: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(summary)
    normalized.pop("generated_at", None)
    return normalized


def _target_card_description(record: dict[str, Any]) -> str:
    summary = _object(record.get("json_summary"))
    target = _object(_object(_object(record.get("scoring")).get("criteria")).get("target_relevance"))
    insight = _object(record.get("final_insight"))
    return _text(
        summary.get("target_description")
        or target.get("main_line_summary")
        or target.get("investigation_note")
        or insight.get("one_line_summary")
        or summary.get("one_line_summary")
        or "-"
    )


def _recalculated_fast_status(record: dict[str, Any]) -> str:
    triage = _object(record.get("triage"))
    criteria = _object(_object(record.get("scoring")).get("criteria"))
    return main.calculate_fast_triage_status(
        identity_verified=triage.get("identity_verified"),
        active_asset=triage.get("active_asset"),
        target_relevance=_object(criteria.get("target_relevance")).get("score"),
        moa_validity=_object(criteria.get("moa_validity")).get("score"),
        data_maturity=_object(criteria.get("data_maturity")).get("score"),
        hard_blocker=main.fast_triage_record_has_hard_blocker(record),
    )


def _research_json_projection(record: dict[str, Any]) -> dict[str, Any]:
    """Exclude immutable report prose/meta when measuring structured JSON savings."""

    projected = copy.deepcopy(record)
    projected.pop("meta", None)
    source_report = _object(projected.get("source_report"))
    source_report.pop("raw_markdown", None)
    if source_report:
        projected["source_report"] = source_report
    else:
        projected.pop("source_report", None)
    return projected


def _source_identity(source: Any) -> str:
    if isinstance(source, str):
        return source.strip()
    item = _object(source)
    return _text(
        item.get("source_url")
        or item.get("url")
        or item.get("href")
        or item.get("source_title")
        or item.get("title")
        or item.get("name")
    )


def _unique_source_identities(sources: list[Any]) -> list[str]:
    identities: list[str] = []
    for source in sources:
        identity = _source_identity(source)
        if identity and identity not in identities:
            identities.append(identity)
    return identities


def _legacy_criterion_sources(record: dict[str, Any], criterion: dict[str, Any]) -> list[Any]:
    validation = _object(record.get("validation"))
    registry_by_id = {
        _text(source.get("source_id") or source.get("id")): source
        for source in validation.get("source_registry", [])
        if isinstance(source, dict) and _text(source.get("source_id") or source.get("id"))
    }
    if isinstance(criterion.get("verified_evidence_sources"), list):
        candidates = list(criterion["verified_evidence_sources"])
    else:
        candidates = list(criterion.get("evidence_sources") or [])
    for source_id in criterion.get("source_ids") or []:
        linked = registry_by_id.get(_text(source_id))
        if linked:
            candidates.append(linked)
    return candidates


def _expected_competitor_rows(record: dict[str, Any]) -> list[dict[str, Any]]:
    validation = _object(record.get("validation"))
    registry_by_id = {
        _text(source.get("source_id") or source.get("id")): source
        for source in validation.get("source_registry", [])
        if isinstance(source, dict)
    }
    rows: list[dict[str, Any]] = []
    competitive = _object(record.get("competitive_analysis"))
    for candidate in competitive.get("competitor_table") or []:
        source = _object(candidate)
        if not source:
            continue
        source_url = _text(source.get("source_url"))
        if not source_url:
            for source_id in source.get("source_ids") or []:
                linked = _object(registry_by_id.get(_text(source_id)))
                source_url = _text(linked.get("source_url") or linked.get("url"))
                if source_url:
                    break
        rows.append(
            {
                "competitor_asset": _text(
                    source.get("competitor_asset")
                    or source.get("asset")
                    or source.get("competitor_name")
                    or "Unknown Competitor"
                ),
                "company": _text(source.get("company") or "Unknown Company"),
                "modality": _text(source.get("modality")),
                "target_or_moa": _text(
                    source.get("target_or_moa") or source.get("target") or source.get("moa")
                ),
                "stage": _text(source.get("stage") or source.get("development_stage")),
                "similarity_level": _text(
                    source.get("similarity_level") or source.get("similarity") or "Unknown"
                ),
                "why_it_matters": _text(
                    source.get("why_it_matters") or source.get("relevance_to_asset")
                ),
                "source_url": source_url,
            }
        )
    return rows


def _expected_similar_pipeline_rows(record: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    competitive = _object(record.get("competitive_analysis"))
    for candidate in competitive.get("similar_pipelines") or []:
        if isinstance(candidate, str) and candidate.strip():
            rows.append(
                {
                    "company": "",
                    "asset_name": candidate.strip(),
                    "similarity_score": None,
                    "matched_dimensions": [],
                    "shared_data_points": [],
                }
            )
            continue
        source = _object(candidate)
        if not source:
            continue
        rows.append(
            {
                "company": _text(source.get("company")),
                "asset_name": _text(source.get("asset_name") or source.get("asset")),
                "similarity_score": source.get("similarity_score"),
                "matched_dimensions": copy.deepcopy(source.get("matched_dimensions") or []),
                "shared_data_points": copy.deepcopy(source.get("shared_data_points") or []),
            }
        )
    return rows


class RecordStorageDatasetDifferentialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # A/B must always use the same pre-compaction source, regardless of what
        # migration state the developer currently has in the working tree.
        cls.worktree_bytes = DATA_FILE.read_bytes()
        cls.worktree_sha256 = hashlib.sha256(cls.worktree_bytes).hexdigest()
        cls.legacy_bytes = subprocess.run(
            ["git", "show", f"{LEGACY_GIT_REF}:{LEGACY_GIT_PATH}"],
            cwd=ROOT,
            check=True,
            capture_output=True,
        ).stdout
        cls.records = json.loads(cls.legacy_bytes.decode("utf-8"))
        cls.records_snapshot = copy.deepcopy(cls.records)
        cls.minimized = [minimize_record_for_dashboard_storage(record) for record in cls.records]
        cls.addClassCleanup(cls._assert_worktree_file_unchanged)

    @classmethod
    def _assert_worktree_file_unchanged(cls) -> None:
        current_bytes = DATA_FILE.read_bytes()
        if current_bytes != cls.worktree_bytes:
            raise AssertionError("record-storage tests changed json/pipeline-records.json bytes")
        current_sha = hashlib.sha256(current_bytes).hexdigest()
        if current_sha != cls.worktree_sha256:
            raise AssertionError("record-storage tests changed json/pipeline-records.json SHA-256")

    def test_git_legacy_baseline_and_worktree_source_guard(self) -> None:
        self.assertEqual(EXPECTED_RECORD_COUNT, len(self.records))
        self.assertEqual(LEGACY_SERIALIZED_SIZE, serialized_size(self.records))
        self.assertEqual(self.worktree_bytes, DATA_FILE.read_bytes())
        self.assertEqual(self.worktree_sha256, hashlib.sha256(DATA_FILE.read_bytes()).hexdigest())
        self.assertEqual(
            self.minimized,
            json.loads(self.worktree_bytes.decode("utf-8")),
            "checked-in worktree data must be the verified migration of the immutable Git baseline",
        )

    def test_record_keys_and_workflow_are_retained(self) -> None:
        original_keys = [main.record_key(record) for record in self.records]
        minimized_keys = [main.record_key(record) for record in self.minimized]
        original_workflows = [main.is_fast_triage_record(record) for record in self.records]
        minimized_workflows = [main.is_fast_triage_record(record) for record in self.minimized]

        self.assertEqual(original_keys, minimized_keys)
        self.assertEqual(original_workflows, minimized_workflows)
        self.assertEqual(23, sum(original_workflows))
        self.assertEqual(10, len(original_workflows) - sum(original_workflows))

    def test_dashboard_summary_is_equal_except_generated_at(self) -> None:
        original_summary = main.build_dashboard_summary(
            copy.deepcopy(self.records), as_of_date=date(2026, 8, 5)
        )
        minimized_summary = main.build_dashboard_summary(
            copy.deepcopy(self.minimized), as_of_date=date(2026, 8, 5)
        )
        self.assertEqual(
            _summary_without_generated_at(original_summary),
            _summary_without_generated_at(minimized_summary),
        )

    def test_raw_markdown_identity_core_table_and_taxonomy_are_retained(self) -> None:
        for original, minimized in zip(self.records, self.minimized, strict=True):
            key = main.record_key(original)
            with self.subTest(record=key, field="raw_markdown"):
                self.assertEqual(
                    _object(original.get("source_report")).get("raw_markdown"),
                    _object(minimized.get("source_report")).get("raw_markdown"),
                )

            original_table = _object(original.get("structured_table"))
            minimized_table = _object(minimized.get("structured_table"))
            for field in CORE_TABLE_FIELDS:
                # Existing research values must survive byte-for-value. Missing values
                # are covered by the consumer projection assertion below.
                if field not in {"target", "main_indication"} and _text(original_table.get(field)):
                    with self.subTest(record=key, field=f"structured_table.{field}"):
                        self.assertEqual(original_table.get(field), minimized_table.get(field))

            original_projection = _home_core_projection(original)
            minimized_projection = _home_core_projection(minimized)
            for field, expected in original_projection.items():
                with self.subTest(record=key, field=f"home_core_projection.{field}"):
                    self.assertEqual(expected, minimized_projection[field])

            original_summary = _object(original.get("json_summary"))
            minimized_summary = _object(minimized.get("json_summary"))
            for field in ("theme", "cluster"):
                with self.subTest(record=key, field=f"json_summary.{field}"):
                    self.assertEqual(original_summary.get(field), minimized_summary.get(field))
            with self.subTest(record=key, field="target_card_description"):
                self.assertEqual(
                    _target_card_description(original),
                    _target_card_description(minimized),
                )

            for path in (
                "company_profile.headquarters",
                "company_profile.company_stage",
                "company_profile.platform_summary",
                "competitive_analysis.similarity_summary.similar_pipeline_count",
                "source_report.parser_status",
                "validation.uncertain_points",
                "final_insight.one_line_summary",
                "final_insight.recommendation",
            ):
                with self.subTest(record=key, field=path):
                    self.assertEqual(main.get_nested(original, path), main.get_nested(minimized, path))
            with self.subTest(record=key, field="competitive_analysis.competitive_density"):
                self.assertEqual(
                    main.get_nested(original, "competitive_analysis.competitive_density", "Unclear"),
                    main.get_nested(minimized, "competitive_analysis.competitive_density", "Unclear"),
                )

    def test_hybrid_score_hover_and_evidence_projection_is_lossless(self) -> None:
        summary_count = 0
        why_not_higher_count = 0
        uncertain_point_count = 0
        source_reference_count = 0
        criterion_count = 0

        for original, minimized in zip(self.records, self.minimized, strict=True):
            key = main.record_key(original)
            triage = main.is_fast_triage_record(original)
            original_criteria = _object(_object(original.get("scoring")).get("criteria"))
            minimized_criteria = _object(_object(minimized.get("scoring")).get("criteria"))
            registry = _object(minimized.get("validation")).get("source_registry") or []
            registry_by_id = {
                _text(source.get("source_id")): source
                for source in registry
                if isinstance(source, dict)
            }
            criterion_ids = TRIAGE_SCORE_IDS if triage else main.CRITERION_IDS

            for criterion_id in criterion_ids:
                criterion_count += 1
                original_item = _object(original_criteria.get(criterion_id))
                minimized_item = _object(minimized_criteria.get(criterion_id))
                expected_fields = {
                    "score": original_item.get("score"),
                    "evidence_type": _text(
                        original_item.get("evidence_type")
                        or ("triage_only" if triage else "")
                    ),
                    "evidence_type_reason": _text(original_item.get("evidence_type_reason")),
                    "evidence_basis": _text(original_item.get("evidence_basis")),
                    "main_line_summary": _text(
                        original_item.get("main_line_summary") or original_item.get("reason")
                    ),
                    "why_not_higher": _text(original_item.get("why_not_higher")),
                    "investigation_note": _text(original_item.get("investigation_note")),
                    "uncertain_points": copy.deepcopy(original_item.get("uncertain_points") or []),
                }
                for field, expected in expected_fields.items():
                    with self.subTest(record=key, criterion=criterion_id, field=field):
                        self.assertEqual(expected, minimized_item.get(field))

                expected_source_identities = _unique_source_identities(
                    _legacy_criterion_sources(original, original_item)
                )
                actual_source_identities = _unique_source_identities(
                    [registry_by_id.get(source_id, {}) for source_id in minimized_item.get("source_ids") or []]
                )
                with self.subTest(record=key, criterion=criterion_id, field="source_ids"):
                    self.assertEqual(expected_source_identities, actual_source_identities)
                    self.assertNotIn("evidence_sources", minimized_item)

                summary_count += bool(expected_fields["main_line_summary"])
                why_not_higher_count += bool(expected_fields["why_not_higher"])
                uncertain_point_count += len(expected_fields["uncertain_points"])
                source_reference_count += len(actual_source_identities)

        # Fixed-ref totals keep this differential test from passing vacuously if a
        # future minimizer silently drops one whole display/evidence domain.
        self.assertEqual(139, criterion_count)
        self.assertEqual(139, summary_count)
        self.assertEqual(70, why_not_higher_count)
        self.assertEqual(223, uncertain_point_count)
        self.assertEqual(360, source_reference_count)

    def test_canonical_source_registry_is_unique_complete_and_has_no_dangling_refs(self) -> None:
        registry_count = 0
        for original, minimized in zip(self.records, self.minimized, strict=True):
            key = main.record_key(original)
            validation = _object(minimized.get("validation"))
            registry = validation.get("source_registry") or []
            source_ids = [_text(_object(source).get("source_id")) for source in registry]
            identities = [_source_identity(source) for source in registry]
            with self.subTest(record=key, field="unique_source_ids"):
                self.assertTrue(all(source_ids))
                self.assertEqual(len(source_ids), len(set(source_ids)))
            with self.subTest(record=key, field="canonical_source_identity"):
                self.assertTrue(all(identities))
                self.assertEqual(len(identities), len(set(identities)))

            known_ids = set(source_ids)
            criteria = _object(_object(minimized.get("scoring")).get("criteria"))
            for criterion_id, criterion in criteria.items():
                for source_id in _object(criterion).get("source_ids") or []:
                    with self.subTest(record=key, criterion=criterion_id, source_id=source_id):
                        self.assertIn(source_id, known_ids)

            original_registry = _object(original.get("validation")).get("source_registry") or []
            original_identities = set(_unique_source_identities(original_registry))
            with self.subTest(record=key, field="legacy_registry_coverage"):
                self.assertLessEqual(original_identities, set(identities))
            registry_count += len(registry)
        self.assertEqual(253, registry_count)

    def test_triage_diligence_and_full_competitor_comparison_data_are_preserved(self) -> None:
        triage_why_count = 0
        triage_missing_count = 0
        cross_checked_count = 0
        competitor_count = 0
        similar_pipeline_count = 0

        for original, minimized in zip(self.records, self.minimized, strict=True):
            key = main.record_key(original)
            original_validation = _object(original.get("validation"))
            minimized_validation = _object(minimized.get("validation"))
            with self.subTest(record=key, field="validation.cross_checked_facts"):
                self.assertEqual(
                    original_validation.get("cross_checked_facts") or [],
                    minimized_validation.get("cross_checked_facts"),
                )
            cross_checked_count += len(minimized_validation.get("cross_checked_facts") or [])

            if main.is_fast_triage_record(original):
                original_triage = _object(original.get("triage"))
                minimized_triage = _object(minimized.get("triage"))
                expected_why = _text(
                    original_triage.get("why") or _object(original.get("hard_filter")).get("reason")
                )
                expected_missing = copy.deepcopy(
                    original_triage.get("missing_evidence_needed_for_full_scout") or []
                )
                with self.subTest(record=key, field="triage.why"):
                    self.assertEqual(expected_why, minimized_triage.get("why"))
                with self.subTest(record=key, field="triage.missing_evidence"):
                    self.assertEqual(
                        expected_missing,
                        minimized_triage.get("missing_evidence_needed_for_full_scout"),
                    )
                triage_why_count += bool(expected_why)
                triage_missing_count += len(expected_missing)
                continue

            minimized_competitive = _object(minimized.get("competitive_analysis"))
            expected_competitors = _expected_competitor_rows(original)
            expected_similar = _expected_similar_pipeline_rows(original)
            with self.subTest(record=key, field="competitive_analysis.competitor_table"):
                self.assertEqual(expected_competitors, minimized_competitive.get("competitor_table"))
            with self.subTest(record=key, field="competitive_analysis.similar_pipelines"):
                self.assertEqual(expected_similar, minimized_competitive.get("similar_pipelines"))
            competitor_count += len(expected_competitors)
            similar_pipeline_count += len(expected_similar)

        self.assertEqual(23, triage_why_count)
        self.assertEqual(75, triage_missing_count)
        self.assertEqual(70, cross_checked_count)
        self.assertEqual(61, competitor_count)
        self.assertEqual(45, similar_pipeline_count)

    def test_scores_totals_and_stored_filters_are_retained(self) -> None:
        for original, minimized in zip(self.records, self.minimized, strict=True):
            key = main.record_key(original)
            original_scoring = _object(original.get("scoring"))
            minimized_scoring = _object(minimized.get("scoring"))
            criterion_ids = TRIAGE_SCORE_IDS if main.is_fast_triage_record(original) else main.CRITERION_IDS
            original_criteria = _object(original_scoring.get("criteria"))
            minimized_criteria = _object(minimized_scoring.get("criteria"))
            for criterion_id in criterion_ids:
                with self.subTest(record=key, field=f"scoring.criteria.{criterion_id}.score"):
                    self.assertEqual(
                        _object(original_criteria.get(criterion_id)).get("score"),
                        _object(minimized_criteria.get(criterion_id)).get("score"),
                    )
            for field in ("total_score", "max_score"):
                with self.subTest(record=key, field=f"scoring.{field}"):
                    self.assertEqual(original_scoring.get(field), minimized_scoring.get(field))
            with self.subTest(record=key, field="hard_filter"):
                original_filter = _object(original.get("hard_filter"))
                minimized_filter = _object(minimized.get("hard_filter"))
                expected_status = main.dashboard_fast_status(original) if main.is_fast_triage_record(original) else original_filter.get("status")
                self.assertEqual(expected_status, minimized_filter.get("status"))
                self.assertEqual(original_filter.get("reason"), minimized_filter.get("reason"))
                self.assertEqual(original_filter.get("flags"), minimized_filter.get("flags"))
                self.assertIsInstance(minimized_filter.get("hard_blocker"), bool)
                self.assertIsInstance(minimized_filter.get("decision_uncertainty"), bool)

    def test_latest_full_filter_calculation_is_retained(self) -> None:
        for original, minimized in zip(self.records, self.minimized, strict=True):
            if main.is_fast_triage_record(original):
                continue
            key = main.record_key(original)
            with self.subTest(record=key):
                self.assertEqual(
                    main.calculate_latest_full_scout_filter(copy.deepcopy(original)),
                    main.calculate_latest_full_scout_filter(copy.deepcopy(minimized)),
                )

    def test_fast_status_is_retained(self) -> None:
        positive_source_counts = 0
        for original, minimized in zip(self.records, self.minimized, strict=True):
            if not main.is_fast_triage_record(original):
                continue
            key = main.record_key(original)
            with self.subTest(record=key, status="stored"):
                self.assertEqual(main.dashboard_fast_status(original), main.dashboard_fast_status(minimized))
                self.assertEqual(main.dashboard_fast_status(original), _object(minimized.get("triage")).get("status"))
            with self.subTest(record=key, status="recalculated"):
                self.assertEqual(_recalculated_fast_status(original), _recalculated_fast_status(minimized))
            source_count = _object(minimized.get("triage")).get("verified_public_source_count")
            with self.subTest(record=key, field="triage.verified_public_source_count"):
                self.assertIsInstance(source_count, int)
                self.assertGreaterEqual(source_count, 0)
            positive_source_counts += int(source_count > 0)
        self.assertEqual(20, positive_source_counts)
        legacy = next(
            minimized
            for original, minimized in zip(self.records, self.minimized, strict=True)
            if main.record_key(original) == "Hangzhou_Vitan_WT-1-2.0_fast_triage_20260623"
        )
        self.assertEqual(2, legacy["triage"]["verified_public_source_count"])

    def test_tab3_classification_is_retained_for_tracked_records(self) -> None:
        tracked_count = 0
        for original, minimized in zip(self.records, self.minimized, strict=True):
            original_focus = _object(_object(original.get("meta")).get("focus_management"))
            if original_focus.get("is_tracked") is not True:
                continue
            tracked_count += 1
            key = main.record_key(original)
            minimized_focus = _object(_object(minimized.get("meta")).get("focus_management"))
            with self.subTest(record=key):
                self.assertEqual(original_focus, minimized_focus)
                self.assertEqual(
                    main.classify_oi_partnership(copy.deepcopy(original), copy.deepcopy(original_focus)),
                    main.classify_oi_partnership(copy.deepcopy(minimized), copy.deepcopy(minimized_focus)),
                )
        self.assertEqual(3, tracked_count)

    def test_operational_meta_is_retained_exactly(self) -> None:
        observed_fields: set[str] = set()
        for original, minimized in zip(self.records, self.minimized, strict=True):
            key = main.record_key(original)
            original_meta = _object(original.get("meta"))
            minimized_meta = _object(minimized.get("meta"))
            for field in OPERATIONAL_META_FIELDS:
                if field not in original_meta and field not in minimized_meta:
                    continue
                observed_fields.add(field)
                with self.subTest(record=key, field=f"meta.{field}"):
                    self.assertEqual(original_meta.get(field), minimized_meta.get(field))
        self.assertTrue(
            {"focus_management", "attachments", "collaboration", "qualitative_review", "human_review"}
            <= observed_fields
        )

    def test_storage_size_reports_total_and_mutable_research_json_reduction(self) -> None:
        original_size = serialized_size(self.records)
        minimized_size = serialized_size(self.minimized)
        original_research_size = serialized_size(
            [_research_json_projection(record) for record in self.records]
        )
        minimized_research_size = serialized_size(
            [_research_json_projection(record) for record in self.minimized]
        )
        total_ratio = minimized_size / original_size
        research_ratio = minimized_research_size / original_research_size
        metrics = (
            f"legacy_total={original_size}, hybrid_total={minimized_size}, "
            f"total_ratio={total_ratio:.3%}, legacy_research={original_research_size}, "
            f"hybrid_research={minimized_research_size}, research_ratio={research_ratio:.3%}"
        )

        self.assertEqual(LEGACY_SERIALIZED_SIZE, original_size)
        self.assertEqual(LEGACY_RESEARCH_SERIALIZED_SIZE, original_research_size)
        self.assertLess(minimized_size, original_size, metrics)
        # Raw Markdown is deliberately immutable and dominates total bytes, so total
        # storage falls modestly while the mutable structured-research projection is
        # the meaningful compaction metric (observed about 73% of legacy).
        self.assertLess(total_ratio, 0.92, metrics)
        self.assertLess(research_ratio, 0.75, metrics)

    def test_hybrid_storage_shape_contains_only_dashboard_and_operational_fields(self) -> None:
        allowed_top_level = {
            "meta", "source_report", "input", "json_summary", "structured_table", "hard_filter",
            "scoring", "validation", "final_insight", "triage", "company_profile",
            "competitive_analysis", "ai_revision_draft",
        }
        required_criterion_fields = {
            "score",
            "evidence_type",
            "evidence_type_reason",
            "evidence_basis",
            "main_line_summary",
            "why_not_higher",
            "investigation_note",
            "uncertain_points",
            "source_ids",
        }
        for record in self.minimized:
            with self.subTest(record=main.record_key(record)):
                self.assertEqual("dashboard_hybrid_v1", _object(record.get("meta")).get("storage_profile"))
                self.assertEqual(set(), set(record) - allowed_top_level)
                criteria = _object(_object(record.get("scoring")).get("criteria"))
                self.assertTrue(criteria)
                for criterion_id, value in criteria.items():
                    item = _object(value)
                    with self.subTest(record=main.record_key(record), criterion=criterion_id):
                        self.assertLessEqual(required_criterion_fields, set(item))
                        self.assertLessEqual(set(item), required_criterion_fields | {"calculation"})
                        self.assertNotIn("evidence_sources", item)

    def test_all_33_hybrid_records_validate_against_backend_and_json_schema(self) -> None:
        # The backend validator is the save-path contract. The checked-in JSON
        # Schema independently catches accidental shape/additional-field drift.
        main.validate_records_for_save(copy.deepcopy(self.minimized))
        schema = json.loads(SCHEMA_FILE.read_text(encoding="utf-8"))
        validator_class = getattr(jsonschema, "Draft202012Validator", jsonschema.Draft7Validator)
        validator = validator_class(schema)
        validation_count = 0
        for index, record in enumerate(self.minimized):
            errors = sorted(validator.iter_errors(record), key=lambda error: list(error.path))
            with self.subTest(index=index, record=main.record_key(record)):
                self.assertEqual([], [error.message for error in errors])
            validation_count += 1
        self.assertEqual(EXPECTED_RECORD_COUNT, validation_count)

    def test_backend_rejects_non_string_items_in_hybrid_display_arrays(self) -> None:
        full = next(record for record in self.minimized if not main.is_fast_triage_record(record))
        triage = next(record for record in self.minimized if main.is_fast_triage_record(record))
        full_with_competitor = next(
            record
            for record in self.minimized
            if _object(record.get("competitive_analysis")).get("competitor_table")
        )
        full_with_similar = next(
            record
            for record in self.minimized
            if _object(record.get("competitive_analysis")).get("similar_pipelines")
        )

        cases: list[tuple[str, dict[str, Any]]] = []
        invalid = copy.deepcopy(full)
        invalid["validation"]["uncertain_points"] = [{"note": "not text"}]
        cases.append(("validation.uncertain_points", invalid))

        invalid = copy.deepcopy(full)
        invalid["validation"]["cross_checked_facts"] = [{"fact": "fact", "sources": [{}]}]
        cases.append(("validation.cross_checked_facts.sources", invalid))

        invalid = copy.deepcopy(full)
        invalid["hard_filter"]["flags"] = [False]
        cases.append(("hard_filter.flags", invalid))

        invalid = copy.deepcopy(full)
        invalid["scoring"]["criteria"]["target_relevance"]["uncertain_points"] = [{}]
        cases.append(("criterion.uncertain_points", invalid))

        invalid = copy.deepcopy(full)
        invalid["scoring"]["criteria"]["target_relevance"]["source_ids"] = [1]
        cases.append(("criterion.source_ids", invalid))

        invalid = copy.deepcopy(triage)
        invalid["triage"]["missing_evidence_needed_for_full_scout"] = [{}]
        cases.append(("triage.missing_evidence", invalid))

        invalid = copy.deepcopy(full_with_competitor)
        invalid["competitive_analysis"]["competitor_table"][0]["source_ids"] = [1]
        cases.append(("competitor.source_ids", invalid))

        invalid = copy.deepcopy(full_with_similar)
        invalid["competitive_analysis"]["similar_pipelines"][0]["matched_dimensions"] = [{}]
        cases.append(("similar.matched_dimensions", invalid))

        for label, record in cases:
            with self.subTest(case=label), self.assertRaises(Exception):
                main.validate_records_for_save([record])

    def test_input_aliases_keep_cross_workflow_identity_grouping(self) -> None:
        fast = {
            "meta": {"review_type": "fast_triage", "generated_at": "2026-08-05", "output_filename_base": "fast"},
            "source_report": {"raw_markdown": "# Fast", "parser_status": "fast_triage"},
            "input": {"company_input": "Common Bio", "asset_input": "CommonAlias"},
            "json_summary": {"theme": "Unknown", "cluster": "Unknown"},
            "structured_table": {
                "company": "Common Bio", "asset_name": "X-001", "target": "Unknown", "moa": "Unknown",
                "modality_platform": "Unknown", "main_indication": "Unknown", "indication": "Unknown",
                "development_stage": "Unknown", "company_country": "Unknown", "sources": [],
            },
            "hard_filter": {"status": "UNVERIFIED", "reason": "", "flags": []},
            "triage": {"status": "UNVERIFIED", "identity_verified": False, "active_asset": None},
            "scoring": {"criteria": {key: {"score": 0} for key in TRIAGE_SCORE_IDS}, "total_score": 0, "max_score": 9},
            "validation": {"uncertain_points": []},
            "final_insight": {"one_line_summary": "", "recommendation": "Verify asset identity"},
        }
        full = copy.deepcopy(fast)
        full["meta"] = {"review_type": "full_scout", "generated_at": "2026-08-05", "output_filename_base": "full"}
        full["source_report"]["parser_status"] = "gpt_structured_output"
        full["structured_table"]["asset_name"] = "CommonAlias"
        full["hard_filter"]["status"] = "FAIL"
        full.pop("triage")
        full["scoring"] = {
            "criteria": {key: {"score": 0} for key in main.CRITERION_IDS},
            "total_score": 0,
            "max_score": 21,
        }
        full["company_profile"] = {}
        full["competitive_analysis"] = {"similarity_summary": {}}

        before = main.dashboard_identity_groups([fast, full])
        after = main.dashboard_identity_groups([
            minimize_record_for_dashboard_storage(fast),
            minimize_record_for_dashboard_storage(full),
        ])
        self.assertEqual(1, len(before))
        self.assertEqual(1, len(after))

    def test_legacy_competitor_aliases_and_fact_source_ids_normalize_without_loss(self) -> None:
        record = copy.deepcopy(next(item for item in self.records if not main.is_fast_triage_record(item)))
        validation = record.setdefault("validation", {})
        registry = validation.setdefault("source_registry", [])
        registry.append({
            "source_id": "S_LEGACY_ALIAS",
            "title": "Legacy official source",
            "url": "https://example.org/legacy-source",
            "source_type": "official_company",
            "verified": True,
        })
        validation["cross_checked_facts"] = [{
            "fact": "Legacy fact remains linked to its source.",
            "source_ids": ["S_LEGACY_ALIAS"],
        }]
        record.setdefault("competitive_analysis", {})["competitor_table"] = [{
            "competitor": "Legacy Competitor",
            "company": "Legacy Bio",
            "modality": "Antibody",
            "target_moa": "Legacy target mechanism",
            "stage_status": "Phase 2",
            "similarity_level": "High",
            "why_it_matters": "Direct legacy-format comparator.",
            "source_ids": ["S_LEGACY_ALIAS"],
        }]

        minimized = minimize_record_for_dashboard_storage(record)
        competitor = minimized["competitive_analysis"]["competitor_table"][0]
        self.assertEqual("Legacy Competitor", competitor["competitor_asset"])
        self.assertEqual("Legacy target mechanism", competitor["target_or_moa"])
        self.assertEqual("Phase 2", competitor["stage"])
        self.assertEqual("https://example.org/legacy-source", competitor["source_url"])
        self.assertEqual(
            [{
                "fact": "Legacy fact remains linked to its source.",
                "sources": ["https://example.org/legacy-source"],
            }],
            minimized["validation"]["cross_checked_facts"],
        )
        main.validate_records_for_save([copy.deepcopy(minimized)])
        self.assertEqual(minimized, minimize_record_for_dashboard_storage(minimized))

    def test_minimizer_is_idempotent_and_does_not_mutate_inputs(self) -> None:
        self.assertEqual(self.records_snapshot, self.records)
        for original, minimized in zip(self.records, self.minimized, strict=True):
            key = main.record_key(original)
            with self.subTest(record=key):
                self.assertEqual(minimized, minimize_record_for_dashboard_storage(minimized))
        self.assertEqual(self.records_snapshot, self.records)

    def test_filter_blocker_and_decision_uncertainty_survive_prose_removal(self) -> None:
        scores = {
            "target_relevance": 3,
            "competitive_landscape": 2,
            "moa_validity": 2,
            "platform_attractiveness": 2,
            "expansion_potential": 2,
            "data_maturity": 2,
            "marketability": 2,
        }

        def record_with_note(note: str) -> dict[str, Any]:
            return {
                "meta": {
                    "review_type": "full_scout",
                    "generated_at": "2026-08-05",
                    "output_filename_base": "Synthetic_Filter_Test",
                },
                "source_report": {"raw_markdown": note, "parser_status": "test"},
                "json_summary": {"theme": "Unknown", "cluster": "Unknown"},
                "structured_table": {
                    "company": "Test",
                    "asset_name": "Asset",
                    "target": "Target",
                    "moa": "MoA",
                    "modality_platform": "Small molecule",
                    "main_indication": "Epilepsy / seizure disorders",
                    "indication": "Epilepsy",
                    "development_stage": "Preclinical Candidate",
                    "company_country": "Unknown",
                    "sources": [],
                },
                "hard_filter": {"status": "PASS", "reason": "Score gate met.", "flags": []},
                "scoring": {
                    "criteria": {
                        key: {"score": value, "main_line_summary": note}
                        for key, value in scores.items()
                    },
                    "total_score": sum(scores.values()),
                    "max_score": 21,
                },
                "company_profile": {},
                "competitive_analysis": {"similarity_summary": {}},
                "validation": {"uncertain_points": []},
                "final_insight": {"one_line_summary": "Candidate.", "recommendation": "Shortlist"},
            }

        blocker = record_with_note("Asset identity is not verified.")
        minimized_blocker = minimize_record_for_dashboard_storage(blocker)
        self.assertTrue(minimized_blocker["hard_filter"]["hard_blocker"])
        self.assertEqual("FAIL", main.calculate_latest_full_scout_filter(blocker)["status"])
        self.assertEqual("FAIL", main.calculate_latest_full_scout_filter(minimized_blocker)["status"])

        uncertain = record_with_note("Ownership remains uncertain.")
        minimized_uncertain = minimize_record_for_dashboard_storage(uncertain)
        self.assertTrue(minimized_uncertain["hard_filter"]["decision_uncertainty"])
        self.assertEqual("REVIEW", main.calculate_latest_full_scout_filter(uncertain)["status"])
        self.assertEqual("REVIEW", main.calculate_latest_full_scout_filter(minimized_uncertain)["status"])


if __name__ == "__main__":
    unittest.main()
