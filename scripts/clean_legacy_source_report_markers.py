"""Remove obsolete dashboard-generated revision notices from stored GPT reports.

Older releases wrote score-recalculation banners and Detail AI Agent revision
appendices into ``source_report.raw_markdown``.  The current product keeps that
information in Filter 2 and the change history instead.  This migration removes
only those generated sections, including recoverable reupload snapshots; it
does not alter the original research/report body.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main  # noqa: E402


RECALCULATION_BANNER = re.compile(
    r"^>\s*\*\*Recalculated by (?:Full Scout|Fast Triage) Rubric v[^\n]*\*\*[^\n]*(?:\r?\n){1,2}",
    re.IGNORECASE | re.MULTILINE,
)
CRITERIA_UPDATE_NOTICE = re.compile(
    r"^>\s*\*\*기준 업데이트\s*\(v[^)]*\):\*\*[^\n]*(?:\r?\n){1,2}",
    re.MULTILINE,
)
AI_REVISION_APPENDIX = re.compile(
    r"\r?\n?---\s*\r?\n\s*## AI Agent Revision Note \([^\n]*\)[\s\S]*$",
    re.IGNORECASE,
)


def clean_markdown(value: Any) -> tuple[str, Counter[str]]:
    text = str(value or "")
    counts: Counter[str] = Counter()
    text, count = RECALCULATION_BANNER.subn("", text)
    counts["recalculation_banner"] += count
    text, count = CRITERIA_UPDATE_NOTICE.subn("", text)
    counts["criteria_update_notice"] += count
    text, count = AI_REVISION_APPENDIX.subn("", text)
    counts["ai_revision_appendix"] += count
    return text.rstrip() + ("\n" if text.endswith("\n") else ""), counts


def clean_object(value: Any, counts: Counter[str]) -> bool:
    """Clean every current and snapshot source report without changing other fields."""
    changed = False
    if isinstance(value, dict):
        for report_key in ("source_report", "previous_source_report"):
            source_report = value.get(report_key)
            if not isinstance(source_report, dict) or not isinstance(source_report.get("raw_markdown"), str):
                continue
            cleaned, removed = clean_markdown(source_report["raw_markdown"])
            if cleaned != source_report["raw_markdown"]:
                source_report["raw_markdown"] = cleaned
                counts.update(removed)
                counts["reports_cleaned"] += 1
                changed = True
        for child in value.values():
            changed = clean_object(child, counts) or changed
    elif isinstance(value, list):
        for child in value:
            changed = clean_object(child, counts) or changed
    return changed


def run(apply: bool) -> dict[str, Any]:
    records = main.load_records()
    counts: Counter[str] = Counter()
    cleaned_record_ids: list[str] = []
    for record in records:
        if clean_object(record, counts):
            cleaned_record_ids.append(main.record_key(record))
    if apply and cleaned_record_ids:
        main.save_records(records)
    return {
        "records": len(records),
        "cleaned_records": len(cleaned_record_ids),
        "would_clean_records": len(cleaned_record_ids),
        "removed_sections": dict(counts),
        "record_ids": cleaned_record_ids,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="persist the source-report cleanup")
    arguments = parser.parse_args()
    print(json.dumps(run(arguments.apply), ensure_ascii=False, indent=2))
