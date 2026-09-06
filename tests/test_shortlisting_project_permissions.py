from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

import main


class FakeRequest:
    def __init__(self, payload: dict | None = None):
        self._payload = payload or {}
        self.client = SimpleNamespace(host="127.0.0.1")
        self.headers = {}
        self.cookies = {}

    async def json(self):
        return self._payload


def make_account(email: str, role: str = "user") -> dict:
    return {"id": f"user_{email}", "name": email.split("@")[0], "email": email, "role": role, "active": True}


def custom_project(project_id: str = "proj_test", members: list[dict] | None = None) -> dict:
    now = "2026-01-01T00:00:00+00:00"
    return {
        "id": project_id,
        "name": "Test Project",
        "description": "",
        "is_default": False,
        "archived": False,
        "metric_columns": [],
        "members": members if members is not None else [],
        "created_by_name": "Creator",
        "created_by_user_id": "user_creator",
        "created_by_email": "creator@example.com",
        "created_at": now,
        "updated_at": now,
    }


def full_scout_record() -> dict:
    return {
        "meta": {"review_type": "full_scout", "generated_at": "2026-08-22", "output_filename_base": "Acme_AX-101"},
        "structured_table": {"company": "Acme", "asset_name": "AX-101"},
        "json_summary": {"company": "Acme", "asset_name": "AX-101"},
    }


class RoleResolutionTests(unittest.TestCase):
    def test_admin_is_owner_without_membership(self) -> None:
        project = custom_project()
        admin = make_account("admin@example.com", role="admin")
        self.assertEqual(main.shortlisting_project_role_for_account(project, admin), "owner")

    def test_unlisted_user_is_read(self) -> None:
        project = custom_project()
        user = make_account("nobody@example.com")
        self.assertEqual(main.shortlisting_project_role_for_account(project, user), "read")

    def test_anonymous_is_read(self) -> None:
        project = custom_project()
        self.assertEqual(main.shortlisting_project_role_for_account(project, None), "read")

    def test_email_match_is_case_insensitive(self) -> None:
        project = custom_project(members=[{"email": "foo@bar.com", "role": "write", "added_by": "x", "added_at": "now"}])
        user = make_account("Foo@Bar.com")
        self.assertEqual(main.shortlisting_project_role_for_account(project, user), "write")

    def test_owner_role_resolves(self) -> None:
        project = custom_project(members=[{"email": "owner@bar.com", "role": "owner", "added_by": "x", "added_at": "now"}])
        user = make_account("owner@bar.com")
        self.assertEqual(main.shortlisting_project_role_for_account(project, user), "owner")

    def test_oic_default_starts_with_empty_members(self) -> None:
        oic_project = main.default_shortlisting_project()
        self.assertEqual(oic_project.get("members"), [])
        # No explicit member yet: only site admins can act as owner.
        self.assertEqual(main.shortlisting_project_role_for_account(oic_project, make_account("nobody@x.com")), "read")
        self.assertEqual(main.shortlisting_project_role_for_account(oic_project, make_account("admin@x.com", role="admin")), "owner")

    def test_oic_default_can_be_granted_explicit_members(self) -> None:
        oic_project = main.default_shortlisting_project()
        oic_project["members"].append({"email": "writer@x.com", "role": "write", "added_by": "admin@x.com", "added_at": "now"})
        self.assertEqual(main.shortlisting_project_role_for_account(oic_project, make_account("writer@x.com")), "write")


class RecordStateEndpointPermissionTests(unittest.TestCase):
    def call(self, project: dict, account: dict, payload: dict):
        record = full_scout_record()
        record_id = main.record_key(record)
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
        ):
            return asyncio.run(
                main.update_shortlisting_project_record_state(record_id, project["id"], FakeRequest(payload))
            )

    def test_write_member_can_track_record(self) -> None:
        project = custom_project(members=[{"email": "writer@x.com", "role": "write", "added_by": "x", "added_at": "now"}])
        account = make_account("writer@x.com")
        result = self.call(project, account, {"action": "add"})
        self.assertTrue(result["ok"])

    def test_read_only_user_cannot_track_record(self) -> None:
        project = custom_project()
        account = make_account("stranger@x.com")
        with self.assertRaises(HTTPException) as ctx:
            self.call(project, account, {"action": "add"})
        self.assertEqual(ctx.exception.status_code, 403)

    def test_admin_can_track_record_without_membership(self) -> None:
        project = custom_project()
        account = make_account("admin@x.com", role="admin")
        result = self.call(project, account, {"action": "add"})
        self.assertTrue(result["ok"])


class ProjectAndColumnOwnerGateTests(unittest.TestCase):
    def test_write_member_cannot_add_metric_column(self) -> None:
        project = custom_project(members=[{"email": "writer@x.com", "role": "write", "added_by": "x", "added_at": "now"}])
        account = make_account("writer@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(main.create_shortlisting_metric_column(
                    project["id"], FakeRequest({"label": "새 지표", "description": "", "return_type": "boolean"})
                ))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_owner_can_add_metric_column(self) -> None:
        project = custom_project(members=[{"email": "owner@x.com", "role": "owner", "added_by": "x", "added_at": "now"}])
        account = make_account("owner@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            result = asyncio.run(main.create_shortlisting_metric_column(
                project["id"], FakeRequest({"label": "새 지표", "description": "", "return_type": "boolean"})
            ))
        self.assertTrue(result["ok"])
        self.assertEqual(len(project["metric_columns"]), 1)

    def test_non_owner_cannot_rename_project(self) -> None:
        project = custom_project(members=[{"email": "writer@x.com", "role": "write", "added_by": "x", "added_at": "now"}])
        account = make_account("writer@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(main.update_shortlisting_project(project["id"], FakeRequest({"name": "Renamed"})))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_owner_can_rename_and_archive_project(self) -> None:
        project = custom_project(members=[{"email": "owner@x.com", "role": "owner", "added_by": "x", "added_at": "now"}])
        account = make_account("owner@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            renamed = asyncio.run(main.update_shortlisting_project(project["id"], FakeRequest({"name": "Renamed"})))
            self.assertEqual(renamed["project"]["name"], "Renamed")
            archived = asyncio.run(main.delete_shortlisting_project(project["id"], FakeRequest({})))
            self.assertTrue(archived["project"]["archived"])


class MemberManagementTests(unittest.TestCase):
    def test_member_upsert_adds_and_updates_role(self) -> None:
        project = custom_project(members=[{"email": "owner@x.com", "role": "owner", "added_by": "x", "added_at": "now"}])
        account = make_account("owner@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            asyncio.run(main.upsert_shortlisting_project_member(
                project["id"], FakeRequest({"email": "new@x.com", "role": "write"})
            ))
            asyncio.run(main.upsert_shortlisting_project_member(
                project["id"], FakeRequest({"email": "new@x.com", "role": "owner"})
            ))
        entry = next(m for m in project["members"] if m["email"] == "new@x.com")
        self.assertEqual(entry["role"], "owner")
        self.assertEqual(len(project["members"]), 2)

    def test_write_member_cannot_manage_members(self) -> None:
        project = custom_project(members=[{"email": "writer@x.com", "role": "write", "added_by": "x", "added_at": "now"}])
        account = make_account("writer@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(main.upsert_shortlisting_project_member(
                    project["id"], FakeRequest({"email": "new@x.com", "role": "write"})
                ))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_cannot_remove_last_owner(self) -> None:
        project = custom_project(members=[{"email": "owner@x.com", "role": "owner", "added_by": "x", "added_at": "now"}])
        account = make_account("owner@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(main.remove_shortlisting_project_member(project["id"], "owner@x.com", FakeRequest({})))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_cannot_demote_last_owner(self) -> None:
        project = custom_project(members=[{"email": "owner@x.com", "role": "owner", "added_by": "x", "added_at": "now"}])
        account = make_account("owner@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(main.upsert_shortlisting_project_member(
                    project["id"], FakeRequest({"email": "owner@x.com", "role": "write"})
                ))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_can_remove_owner_when_second_owner_exists(self) -> None:
        project = custom_project(members=[
            {"email": "owner@x.com", "role": "owner", "added_by": "x", "added_at": "now"},
            {"email": "owner2@x.com", "role": "owner", "added_by": "x", "added_at": "now"},
        ])
        account = make_account("owner@x.com")
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            result = asyncio.run(main.remove_shortlisting_project_member(project["id"], "owner@x.com", FakeRequest({})))
        self.assertTrue(result["ok"])
        self.assertEqual(len(project["members"]), 1)


class LazyMigrationTests(unittest.TestCase):
    def test_lazy_migration_seeds_owner_from_created_by_email(self) -> None:
        legacy_project = custom_project(project_id="proj_legacy")
        del legacy_project["members"]
        legacy_project["created_by_email"] = "Alice@Example.com"
        default_project = main.default_shortlisting_project()

        with (
            patch.object(type(main.SHORTLISTING_PROJECTS_FILE), "exists", return_value=True),
            patch.object(main, "read_json", return_value=[default_project, legacy_project]),
            patch.object(main, "write_json_atomic") as mock_write,
        ):
            projects = main.load_shortlisting_projects()

        migrated = next(p for p in projects if p["id"] == "proj_legacy")
        self.assertEqual(len(migrated["members"]), 1)
        self.assertEqual(migrated["members"][0]["email"], "alice@example.com")
        self.assertEqual(migrated["members"][0]["role"], "owner")
        mock_write.assert_called_once()

    def test_migration_is_idempotent_once_members_exists(self) -> None:
        already_migrated = custom_project(project_id="proj_done", members=[
            {"email": "x@y.com", "role": "owner", "added_by": "x@y.com", "added_at": "now"}
        ])
        default_project = main.default_shortlisting_project()

        with (
            patch.object(type(main.SHORTLISTING_PROJECTS_FILE), "exists", return_value=True),
            patch.object(main, "read_json", return_value=[default_project, already_migrated]),
            patch.object(main, "write_json_atomic") as mock_write,
        ):
            main.load_shortlisting_projects()

        mock_write.assert_not_called()


class ActionDateReminderPerProjectTests(unittest.TestCase):
    def test_reminder_fires_for_due_date_stored_only_in_custom_project(self) -> None:
        record = full_scout_record()
        record["meta"]["shortlisting_projects"] = {
            "proj_x": {
                "is_tracked": True,
                "due_date": "2026-08-24",
                "owner_email": "owner@x.com",
                "owner_name": "Owner",
                "action_plan": "",
            }
        }
        owner_user = make_account("owner@x.com")
        project = custom_project(project_id="proj_x")

        with (
            patch.object(main, "ACTION_DATE_REMINDERS_ENABLED", True),
            patch.object(main, "password_reset_email_configured", return_value=True),
            patch.object(main, "load_users", return_value=[owner_user]),
            patch.object(main, "load_shortlisting_projects", return_value=[project]),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "send_action_date_reminder_email") as mock_send,
        ):
            from datetime import datetime, timezone
            now = datetime(2026, 8, 24, 0, 0, tzinfo=timezone.utc)
            result = main.run_action_date_reminders(now=now)

        mock_send.assert_called_once()
        self.assertEqual(result["sent"], 1)
        self.assertEqual(len(record["meta"]["shortlisting_projects"]["proj_x"]["action_date_reminders"]), 1)


class OicPermissionParityTests(unittest.TestCase):
    """oic_default now shares the same members[]/role model as custom Projects
    for /focus-management, while column management stays permanently blocked
    (its 7 columns are hardcoded, not user-managed)."""

    def call_focus_management(self, oic_project: dict, account: dict, payload: dict):
        record = full_scout_record()
        record_id = main.record_key(record)
        with (
            patch.object(main, "require_authenticated_user", return_value=account),
            patch.object(main, "load_shortlisting_projects", return_value=[oic_project]),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
        ):
            return asyncio.run(main.update_focus_management(record_id, FakeRequest(payload)))

    def test_oic_write_member_can_use_focus_management(self) -> None:
        oic_project = main.default_shortlisting_project()
        oic_project["members"].append({"email": "writer@x.com", "role": "write", "added_by": "x", "added_at": "now"})
        result = self.call_focus_management(oic_project, make_account("writer@x.com"), {"action": "add"})
        self.assertTrue(result["ok"])

    def test_oic_unlisted_user_cannot_use_focus_management(self) -> None:
        oic_project = main.default_shortlisting_project()
        with self.assertRaises(HTTPException) as ctx:
            self.call_focus_management(oic_project, make_account("stranger@x.com"), {"action": "add"})
        self.assertEqual(ctx.exception.status_code, 403)

    def test_oic_admin_still_works_without_membership(self) -> None:
        oic_project = main.default_shortlisting_project()
        result = self.call_focus_management(oic_project, make_account("admin@x.com", role="admin"), {"action": "add"})
        self.assertTrue(result["ok"])

    def test_oic_column_add_blocked_even_for_owner(self) -> None:
        oic_project = main.default_shortlisting_project()
        oic_project["members"].append({"email": "owner@x.com", "role": "owner", "added_by": "x", "added_at": "now"})
        with (
            patch.object(main, "require_authenticated_user", return_value=make_account("owner@x.com")),
            patch.object(main, "load_shortlisting_projects", return_value=[oic_project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(main.create_shortlisting_metric_column(
                    main.DEFAULT_SHORTLISTING_PROJECT_ID,
                    FakeRequest({"label": "새 지표", "description": "", "return_type": "boolean"}),
                ))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_oic_members_can_now_be_managed(self) -> None:
        oic_project = main.default_shortlisting_project()
        with (
            patch.object(main, "require_authenticated_user", return_value=make_account("admin@x.com", role="admin")),
            patch.object(main, "load_shortlisting_projects", return_value=[oic_project]),
            patch.object(main, "save_shortlisting_projects"),
        ):
            result = asyncio.run(main.upsert_shortlisting_project_member(
                main.DEFAULT_SHORTLISTING_PROJECT_ID, FakeRequest({"email": "new@x.com", "role": "write"})
            ))
        self.assertTrue(result["ok"])
        self.assertEqual(len(oic_project["members"]), 1)


if __name__ == "__main__":
    unittest.main()
