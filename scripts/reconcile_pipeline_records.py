"""Safely reconcile dashboard record snapshots from another computer.

The current ``json/pipeline-records.json`` remains authoritative. A Git stash
or JSON snapshot may contribute record IDs that are absent from the current
data. For a Git stash, its first parent is also used as a three-way merge base:
changes made only in the stash are retained when the current record left that
field untouched. Matching changes to the same field remain deliberately
reported and block writing: a line-oriented Git merge is unsafe for the
dashboard's JSON array and could silently discard manual review data.

Examples (run from the repository root)::

    # Inspect company-PC stashes without changing any files.
    python scripts/reconcile_pipeline_records.py --stash 'stash@{1}' --stash 'stash@{0}'

    # Write only when the dry run reports zero conflicts, retaining a backup.
    python scripts/reconcile_pipeline_records.py --stash 'stash@{1}' --stash 'stash@{0}' --write

Use ``--source-json`` when the other snapshot has already been copied out of
Git.  After a successful write, regenerate the derived Obsidian/wiki exports.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main  # noqa: E402


@dataclass(frozen=True)
class Snapshot:
    label: str
    records: list[dict[str, Any]]
    base_records: list[dict[str, Any]] | None = None


def canonical_value_bytes(value: Any) -> bytes:
    """Return a formatting-independent representation for exact comparison."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def canonical_record_bytes(record: dict[str, Any]) -> bytes:
    return canonical_value_bytes(record)


def record_id(record: dict[str, Any]) -> str:
    key = main.record_key(record).strip()
    if not key:
        raise ValueError("A record has a blank dashboard record ID.")
    return key


def duplicate_ids(records: list[dict[str, Any]]) -> dict[str, list[int]]:
    positions: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        positions[record_id(record)].append(index)
    return {key: indexes for key, indexes in positions.items() if len(indexes) > 1}


def parse_records(raw: bytes, label: str) -> list[dict[str, Any]]:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"{label} is not valid UTF-8 JSON: {exc}") from exc
    if not isinstance(data, list) or any(not isinstance(record, dict) for record in data):
        raise ValueError(f"{label} must contain a top-level JSON array of records.")
    return data


def read_git_json(ref: str) -> list[dict[str, Any]]:
    relative_path = main.DATA_FILE.relative_to(ROOT).as_posix()
    result = subprocess.run(
        ["git", "show", f"{ref}:{relative_path}"],
        cwd=ROOT,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValueError(f"Could not read {ref}: {error or 'Git object was not found.'}")
    return parse_records(result.stdout, ref)


def load_git_stash(ref: str) -> Snapshot:
    return Snapshot(label=ref, records=read_git_json(ref), base_records=read_git_json(f"{ref}^1"))


def load_json_snapshot(path_text: str) -> Snapshot:
    path = Path(path_text).expanduser().resolve()
    if not path.is_file():
        raise ValueError(f"Snapshot file was not found: {path}")
    return Snapshot(label=str(path), records=parse_records(path.read_bytes(), str(path)))


def short_hash(record: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_record_bytes(record)).hexdigest()[:12]


MISSING = object()


def values_equal(left: Any, right: Any) -> bool:
    if left is MISSING or right is MISSING:
        return left is right
    return canonical_value_bytes(left) == canonical_value_bytes(right)


def three_way_merge_value(base: Any, current: Any, snapshot: Any, path: str = "") -> tuple[Any, list[str]]:
    """Merge a value only when one side left it at the common base.

    Lists are intentionally atomic. Their ordering often has semantic meaning
    for attachments, history, and sources, so recursively zipping list items
    would be less safe than reporting a collision.
    """
    if values_equal(current, snapshot):
        return copy.deepcopy(current), []
    if values_equal(current, base):
        return copy.deepcopy(snapshot), []
    if values_equal(snapshot, base):
        return copy.deepcopy(current), []
    if isinstance(base, dict) and isinstance(current, dict) and isinstance(snapshot, dict):
        result: dict[str, Any] = {}
        conflicts: list[str] = []
        for key in sorted(set(base) | set(current) | set(snapshot)):
            child_path = f"{path}.{key}" if path else key
            value, child_conflicts = three_way_merge_value(
                base.get(key, MISSING), current.get(key, MISSING), snapshot.get(key, MISSING), child_path
            )
            if value is not MISSING:
                result[key] = value
            conflicts.extend(child_conflicts)
        return result, conflicts
    return copy.deepcopy(current), [path or "(entire record)"]


def summarize_record(record: dict[str, Any]) -> dict[str, str]:
    table = record.get("structured_table") if isinstance(record.get("structured_table"), dict) else {}
    meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
    return {
        "record_id": record_id(record),
        "company": str(table.get("company") or ""),
        "asset": str(table.get("asset_name") or ""),
        "updated_at": str(meta.get("updated_at") or meta.get("created_at") or ""),
        "content_hash": short_hash(record),
    }


def reconcile(current: list[dict[str, Any]], snapshots: list[Snapshot]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Build a safe union and a machine-readable report without writing files."""
    current_duplicates = duplicate_ids(current)
    report: dict[str, Any] = {
        "current_record_count": len(current),
        "sources": [],
        "added": [],
        "identical": [],
        "automatically_merged": [],
        "conflicts": [],
        "duplicate_record_ids": {"current": current_duplicates, "sources": {}},
    }
    merged = [copy.deepcopy(record) for record in current]
    merged_by_id = {record_id(record): record for record in merged}
    merged_index_by_id = {record_id(record): index for index, record in enumerate(merged)}
    origin_by_id = {record_id(record): "current" for record in merged}

    for snapshot in snapshots:
        source_duplicates = duplicate_ids(snapshot.records)
        report["sources"].append({"label": snapshot.label, "record_count": len(snapshot.records)})
        if source_duplicates:
            report["duplicate_record_ids"]["sources"][snapshot.label] = source_duplicates
        base_by_id = {
            record_id(record): record
            for record in (snapshot.base_records or [])
            if record_id(record) not in duplicate_ids(snapshot.base_records or [])
        }
        for source_record in snapshot.records:
            key = record_id(source_record)
            existing = merged_by_id.get(key)
            if existing is None:
                copied = copy.deepcopy(source_record)
                merged.append(copied)
                merged_by_id[key] = copied
                merged_index_by_id[key] = len(merged) - 1
                origin_by_id[key] = snapshot.label
                report["added"].append({"source": snapshot.label, **summarize_record(source_record)})
            elif canonical_record_bytes(existing) == canonical_record_bytes(source_record):
                report["identical"].append({"source": snapshot.label, "existing_source": origin_by_id[key], **summarize_record(source_record)})
            else:
                base_record = base_by_id.get(key)
                if base_record is not None:
                    resolved, field_conflicts = three_way_merge_value(base_record, existing, source_record)
                    if not field_conflicts:
                        merged[merged_index_by_id[key]] = resolved
                        merged_by_id[key] = resolved
                        report["automatically_merged"].append(
                            {"source": snapshot.label, "existing_source": origin_by_id[key], **summarize_record(resolved)}
                        )
                        origin_by_id[key] = f"{origin_by_id[key]} + {snapshot.label}"
                        continue
                report["conflicts"].append(
                    {
                        "source": snapshot.label,
                        "existing_source": origin_by_id[key],
                        "record_id": key,
                        "current": summarize_record(existing),
                        "snapshot": summarize_record(source_record),
                        "field_paths": field_conflicts if base_record is not None else ["(no common Git base available)"],
                    }
                )

    report["merged_record_count_if_safe"] = len(merged)
    report["is_safe_to_write"] = not (
        current_duplicates or report["duplicate_record_ids"]["sources"] or report["conflicts"]
    )
    return merged, report


def write_report(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def backup_and_write(records: list[dict[str, Any]], backup_dir: Path) -> Path:
    source = main.DATA_FILE
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"pipeline-records.before-stash-reconcile.{stamp}.json"
    shutil.copy2(source, backup_path)
    main.write_json_atomic(source, records)
    return backup_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safely merge non-conflicting pipeline records from Git stashes or JSON snapshots.")
    parser.add_argument("--stash", action="append", default=[], metavar="REF", help="Git stash/ref to inspect; may be repeated.")
    parser.add_argument(
        "--source-json",
        action="append",
        default=[],
        metavar="PATH",
        help="Copied pipeline-records JSON snapshot to inspect; may be repeated.",
    )
    parser.add_argument("--report", type=Path, help="Write the detailed reconciliation report to this JSON path.")
    parser.add_argument("--write", action="store_true", help="Atomically write the union only when there are no conflicts or duplicate IDs.")
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=ROOT / "local-backups",
        help="Directory for the pre-write source JSON backup (default: local-backups).",
    )
    return parser


def main_cli(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.stash and not args.source_json:
        raise ValueError("Specify at least one --stash REF or --source-json PATH.")

    snapshots = [load_git_stash(ref) for ref in args.stash]
    snapshots.extend(load_json_snapshot(path) for path in args.source_json)
    current = parse_records(main.DATA_FILE.read_bytes(), "current json/pipeline-records.json")
    merged, report = reconcile(current, snapshots)

    print(f"current_records={report['current_record_count']}")
    for source in report["sources"]:
        print(f"source={source['label']} records={source['record_count']}")
    print(f"added={len(report['added'])}")
    print(f"identical={len(report['identical'])}")
    print(f"automatically_merged={len(report['automatically_merged'])}")
    print(f"conflicts={len(report['conflicts'])}")
    duplicate_count = len(report["duplicate_record_ids"]["current"]) + sum(
        len(value) for value in report["duplicate_record_ids"]["sources"].values()
    )
    print(f"duplicate_id_groups={duplicate_count}")
    print(f"safe_to_write={'yes' if report['is_safe_to_write'] else 'no'}")

    if args.report:
        write_report(report, args.report)
        print(f"report={args.report}")

    if not args.write:
        print("mode=dry-run (no pipeline data changed)")
        return 0
    if not report["is_safe_to_write"]:
        print("mode=blocked (review conflicts/duplicate IDs in the report; no pipeline data changed)")
        return 2

    backup_path = backup_and_write(merged, args.backup_dir)
    print(f"mode=write backup={backup_path} records={len(merged)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main_cli())
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(2)
