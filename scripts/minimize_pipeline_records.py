"""Migrate pipeline records to the dashboard hybrid storage profile.

Dry-run is the default. Pass --write only after the UI/data differential checks
succeed. A historical Git object can be used as the immutable migration source.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main  # noqa: E402
from record_storage import minimize_record_for_dashboard_storage, serialized_size  # noqa: E402


def without_generated_at(value: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(value)
    normalized.pop("generated_at", None)
    return normalized


def object_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def list_value(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def criterion_display_projection(value: Any, *, triage: bool) -> dict[str, Any]:
    item = object_value(value)
    return {
        "score": item.get("score"),
        "evidence_type": str(item.get("evidence_type") or ("triage_only" if triage else "")),
        "evidence_type_reason": str(item.get("evidence_type_reason") or ""),
        "evidence_basis": str(item.get("evidence_basis") or ""),
        "main_line_summary": str(item.get("main_line_summary") or item.get("reason") or ""),
        "why_not_higher": str(item.get("why_not_higher") or ""),
        "investigation_note": str(item.get("investigation_note") or ""),
        "uncertain_points": copy.deepcopy(list_value(item.get("uncertain_points"))),
    }


def research_json_size(records: list[dict[str, Any]]) -> int:
    """Measure research/dashboard JSON without immutable Markdown or app state."""
    projection = [
        {key: value for key, value in record.items() if key not in {"meta", "source_report"}}
        for record in records
    ]
    return serialized_size(projection)


def assert_equivalent(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> None:
    before_keys = [main.record_key(record) for record in before]
    after_keys = [main.record_key(record) for record in after]
    if before_keys != after_keys or len(set(after_keys)) != len(after_keys):
        raise RuntimeError("Record keys changed or became duplicated during migration.")
    if [main.is_fast_triage_record(record) for record in before] != [
        main.is_fast_triage_record(record) for record in after
    ]:
        raise RuntimeError("Fast Triage / Full Scout workflow classification changed.")

    as_of = date.today()
    before_summary = without_generated_at(main.build_dashboard_summary(copy.deepcopy(before), as_of_date=as_of))
    after_summary = without_generated_at(main.build_dashboard_summary(copy.deepcopy(after), as_of_date=as_of))
    if before_summary != after_summary:
        raise RuntimeError("Dashboard summary changed during migration.")

    for original, minimized in zip(before, after, strict=True):
        record_id = main.record_key(original)
        triage = main.is_fast_triage_record(original)
        if object_value(original.get("source_report")).get("raw_markdown") != object_value(
            minimized.get("source_report")
        ).get("raw_markdown"):
            raise RuntimeError(f"GPT original report changed: {record_id}")

        original_criteria = object_value(object_value(original.get("scoring")).get("criteria"))
        hybrid_criteria = object_value(object_value(minimized.get("scoring")).get("criteria"))
        criterion_ids = main.STORAGE_TRIAGE_CRITERION_IDS if triage else main.STORAGE_FULL_CRITERION_IDS
        for criterion_id in criterion_ids:
            if criterion_display_projection(original_criteria.get(criterion_id), triage=triage) != criterion_display_projection(
                hybrid_criteria.get(criterion_id), triage=triage
            ):
                raise RuntimeError(f"Score-hover projection changed: {record_id} / {criterion_id}")

        registry = list_value(object_value(minimized.get("validation")).get("source_registry"))
        registry_ids = [str(object_value(source).get("source_id") or "").strip() for source in registry]
        if any(not source_id for source_id in registry_ids) or len(registry_ids) != len(set(registry_ids)):
            raise RuntimeError(f"Canonical source registry contains blank or duplicate IDs: {record_id}")
        known_ids = set(registry_ids)
        for criterion_id, criterion in hybrid_criteria.items():
            dangling = {
                str(source_id or "").strip()
                for source_id in list_value(object_value(criterion).get("source_ids"))
                if str(source_id or "").strip() not in known_ids
            }
            if dangling:
                raise RuntimeError(f"Dangling criterion source IDs: {record_id} / {criterion_id}: {sorted(dangling)}")

        if object_value(original.get("validation")).get("cross_checked_facts", []) != object_value(
            minimized.get("validation")
        ).get("cross_checked_facts", []):
            raise RuntimeError(f"Cross-checked facts changed: {record_id}")

        if main.is_fast_triage_record(original):
            if main.dashboard_fast_status(original) != main.dashboard_fast_status(minimized):
                raise RuntimeError(f"Fast Triage status changed: {record_id}")
            original_triage = object_value(original.get("triage"))
            hybrid_triage = object_value(minimized.get("triage"))
            if str(original_triage.get("why") or object_value(original.get("hard_filter")).get("reason") or "") != str(
                hybrid_triage.get("why") or ""
            ):
                raise RuntimeError(f"TAB1 why changed: {record_id}")
            if list_value(original_triage.get("missing_evidence_needed_for_full_scout")) != list_value(
                hybrid_triage.get("missing_evidence_needed_for_full_scout")
            ):
                raise RuntimeError(f"TAB1 missing-evidence list changed: {record_id}")
        else:
            if main.calculate_latest_full_scout_filter(original) != main.calculate_latest_full_scout_filter(minimized):
                raise RuntimeError(f"Full Scout filter changed: {record_id}")
            original_competitors = list_value(object_value(original.get("competitive_analysis")).get("competitor_table"))
            hybrid_competitors = list_value(object_value(minimized.get("competitive_analysis")).get("competitor_table"))
            if len(original_competitors) != len(hybrid_competitors):
                raise RuntimeError(f"Competitor graph row count changed: {record_id}")
        focus = (original.get("meta") or {}).get("focus_management")
        if isinstance(focus, dict) and focus.get("is_tracked") is True:
            if main.classify_oi_partnership(original, copy.deepcopy(focus)) != main.classify_oi_partnership(
                minimized, copy.deepcopy(focus)
            ):
                raise RuntimeError(f"TAB3 partnership classification changed: {record_id}")
        main.validate_records_for_save([copy.deepcopy(minimized)])


def main_cli() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="atomically replace json/pipeline-records.json")
    parser.add_argument(
        "--source-git-ref",
        help="read the pre-migration JSON from this Git ref instead of the working-tree data file",
    )
    args = parser.parse_args()

    working_tree_bytes = main.DATA_FILE.read_bytes()
    if args.source_git_ref:
        relative_path = main.DATA_FILE.relative_to(ROOT).as_posix()
        source_bytes = subprocess.run(
            ["git", "show", f"{args.source_git_ref}:{relative_path}"],
            cwd=ROOT,
            check=True,
            capture_output=True,
        ).stdout
    else:
        source_bytes = working_tree_bytes
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    records = main.normalize_records(json.loads(source_bytes.decode("utf-8")))
    minimized = [minimize_record_for_dashboard_storage(record) for record in records]
    assert_equivalent(records, minimized)

    before_size = serialized_size(records)
    after_size = serialized_size(minimized)
    before_research_size = research_json_size(records)
    after_research_size = research_json_size(minimized)
    print(f"records={len(records)}")
    print(f"source_sha256={source_hash}")
    print(f"serialized_bytes={before_size}->{after_size} ({after_size / before_size:.1%} retained)")
    print(
        f"research_json_bytes={before_research_size}->{after_research_size} "
        f"({after_research_size / before_research_size:.1%} retained)"
    )
    print("ab_checks=dashboard,TAB1,score-hover,competitors,TAB3,sources,raw-report passed")
    if not args.write:
        if main.DATA_FILE.read_bytes() != working_tree_bytes:
            raise RuntimeError("Dry-run unexpectedly changed the source file.")
        print("mode=dry-run (no files changed)")
        return 0

    main.write_json_atomic(main.DATA_FILE, minimized)
    persisted = main.normalize_records(main.read_json(main.DATA_FILE))
    if persisted != minimized:
        raise RuntimeError("Persisted records do not match the verified migration result.")
    print(f"mode=write persisted_sha256={hashlib.sha256(main.DATA_FILE.read_bytes()).hexdigest()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main_cli())
