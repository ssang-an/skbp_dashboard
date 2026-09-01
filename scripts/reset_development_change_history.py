"""Remove development-era audit events while retaining other administrators' events.

Run without ``--apply`` to see the exact classification.  Durable memo/comment
content is never touched.  Audit lists are pruned entry by entry: blank/system
events and the initial development authors are removed, while named changes by
other people remain visible.  The latest score-recalculation audit is retained
independently because it explains the score currently shown to users.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main  # noqa: E402


INITIAL_DEVELOPMENT_ACTORS = {"정주원", "Codex"}
AUDIT_LIST_PATHS = (
    ("meta", "edit_history"),
    ("meta", "human_review", "history"),
    ("meta", "rubric_refresh_history"),
)


def text_present(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def audit_entries(record: dict[str, Any]) -> list[dict[str, Any]]:
    meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
    review = meta.get("human_review") if isinstance(meta.get("human_review"), dict) else {}
    entries: list[dict[str, Any]] = []
    for value in (meta.get("edit_history"), review.get("history"), meta.get("rubric_refresh_history")):
        if isinstance(value, list):
            entries.extend(item for item in value if isinstance(item, dict))
    return entries


def retain_other_person_entry(entry: dict[str, Any]) -> bool:
    """Keep only a named, non-development author in an audit trail."""
    actor = str(entry.get("actor_name") or "").strip()
    return bool(actor) and actor not in INITIAL_DEVELOPMENT_ACTORS


def latest_rubric_review_entries(entries: list[Any]) -> list[dict[str, Any]]:
    """Keep one latest score-review event as provenance for the displayed score."""
    for entry in reversed(entries):
        if isinstance(entry, dict) and text_present(entry.get("reviewed_at")):
            return [entry]
    return []


def history_reset_decision(record: dict[str, Any]) -> str:
    if not audit_entries(record):
        return "no_history"
    if any(retain_other_person_entry(entry) for entry in audit_entries(record)):
        return "prune_keep_other_author"
    return "clear_all_audit"


def clear_development_history(record: dict[str, Any]) -> Counter[str]:
    """Prune development/system audit events without touching record content."""
    meta = record.setdefault("meta", {})
    removed: Counter[str] = Counter()
    value = meta.get("edit_history")
    if isinstance(value, list):
        retained = [entry for entry in value if isinstance(entry, dict) and retain_other_person_entry(entry)]
        removed["edit_history"] += len(value) - len(retained)
        if retained:
            meta["edit_history"] = retained
        else:
            meta.pop("edit_history", None)

    value = meta.get("rubric_refresh_history")
    if isinstance(value, list):
        retained = latest_rubric_review_entries(value)
        removed["rubric_refresh_history"] += len(value) - len(retained)
        if retained:
            meta["rubric_refresh_history"] = retained
        else:
            meta.pop("rubric_refresh_history", None)

    review = meta.get("human_review")
    if isinstance(review, dict):
        history = review.get("history")
        if isinstance(history, list):
            retained = [entry for entry in history if isinstance(entry, dict) and retain_other_person_entry(entry)]
            removed["human_review.history"] += len(history) - len(retained)
            if retained:
                review["history"] = retained
            else:
                review.pop("history", None)
        # These are audit-display stamps, not the actual override values.  They
        # are meaningful only while a retained human-review event exists.
        if not review.get("history"):
            for field in ("last_updated_at", "last_updated_by", "last_updated_source"):
                review.pop(field, None)
    return removed


def run(apply: bool) -> dict[str, Any]:
    records = main.load_records()
    decisions = Counter(history_reset_decision(record) for record in records)
    targets = [record for record in records if history_reset_decision(record) != "no_history"]
    removed: Counter[str] = Counter()
    if apply:
        for record in targets:
            removed.update(clear_development_history(record))
        main.save_records(records)
    return {
        "records": len(records),
        "decisions": dict(decisions),
        "pruned_records": len(targets) if apply else 0,
        "would_prune_records": len(targets),
        "removed_entries": dict(removed),
        "target_ids": [main.record_key(record) for record in targets],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="persist the selective audit-history reset")
    arguments = parser.parse_args()
    print(json.dumps(run(arguments.apply), ensure_ascii=False, indent=2))
