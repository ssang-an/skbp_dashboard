"""Backfill missing legacy author emails from recorded ID/email evidence.

This deliberately never infers an email from a display name. It uses a current
account with the same immutable ID, an existing authored Comment with that ID,
or an explicit, administrator-confirmed migration mapping.
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


# The first development account for the current administrator predates author
# email storage. Its successor is confirmed by the administrator for this
# one-time metadata migration.
CONFIRMED_LEGACY_EMAILS = {
    "3dd1472cc5bd4f888238b0a6d1776816": "joowon.jung@sk.com",
}


def normalized_email(value: Any) -> str:
    return main.normalized_identity_email(value)


def known_emails_by_author_id(records: list[dict[str, Any]], users: list[dict[str, Any]]) -> dict[str, str]:
    emails = dict(CONFIRMED_LEGACY_EMAILS)
    for user in users:
        user_id = str(user.get("id") or "").strip()
        email = normalized_email(user.get("email"))
        if user_id and email:
            emails[user_id] = email
    for record in records:
        meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
        collaboration = meta.get("collaboration") if isinstance(meta.get("collaboration"), dict) else {}
        for comment in collaboration.get("comments", []):
            if not isinstance(comment, dict):
                continue
            author_id = str(comment.get("author_user_id") or "").strip()
            email = normalized_email(comment.get("author_email"))
            if author_id and email:
                emails[author_id] = email
    return emails


def backfill_author_emails(records: list[dict[str, Any]], users: list[dict[str, Any]]) -> Counter[str]:
    known_emails = known_emails_by_author_id(records, users)
    changed: Counter[str] = Counter()
    for record in records:
        meta = record.get("meta") if isinstance(record.get("meta"), dict) else {}
        for note in meta.get("topic_notes", []):
            if not isinstance(note, dict) or normalized_email(note.get("author_email")):
                continue
            email = known_emails.get(str(note.get("author_id") or "").strip())
            if email:
                note["author_email"] = email
                changed["topic_notes"] += 1

        review = meta.get("human_review") if isinstance(meta.get("human_review"), dict) else {}
        overrides = review.get("overrides") if isinstance(review.get("overrides"), dict) else {}
        if str(overrides.get("final_comment") or "").strip() and not normalized_email(review.get("final_comment_author_email")):
            email = known_emails.get(str(review.get("final_comment_author_id") or "").strip())
            if email:
                review["final_comment_author_email"] = email
                changed["final_comments"] += 1

        qualitative = meta.get("qualitative_review") if isinstance(meta.get("qualitative_review"), dict) else {}
        criteria = qualitative.get("criteria") if isinstance(qualitative.get("criteria"), dict) else {}
        for criterion in criteria.values():
            if not isinstance(criterion, dict):
                continue
            for entry in criterion.get("entries", []):
                if not isinstance(entry, dict) or entry.get("is_ai") is True or normalized_email(entry.get("author_email")):
                    continue
                email = known_emails.get(str(entry.get("author_id") or "").strip())
                if email:
                    entry["author_email"] = email
                    changed["qualitative_entries"] += 1
    return changed


def run(apply: bool) -> dict[str, Any]:
    records = main.load_records()
    changed = backfill_author_emails(records, main.load_users())
    if apply and changed:
        main.save_records(records)
    return {"applied": apply, "updated": dict(changed), "records": len(records)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="persist confirmed email backfills")
    args = parser.parse_args()
    print(json.dumps(run(args.apply), ensure_ascii=False, indent=2))
