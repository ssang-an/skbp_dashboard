import asyncio
import hashlib
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

import main


class FakeRequest:
    def __init__(self, token="", payload=None, ip="127.0.0.1"):
        self.cookies = {main.AUTH_COOKIE_NAME: token} if token else {}
        self._payload = payload or {}
        self.client = SimpleNamespace(host=ip)
        self.headers = {}

    async def json(self):
        return self._payload


class AuthAdminTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.users_file = Path(self.temp_dir.name) / "users.json"
        self.patcher = patch.object(main, "USERS_FILE", self.users_file)
        self.patcher.start()
        main.save_users([])

    def tearDown(self):
        self.patcher.stop()
        self.temp_dir.cleanup()

    def create_user(self, email, name="Test User"):
        salt, digest = main.password_hash("test1234")
        user = {
            "id": email.split("@")[0], "name": name, "email": email.lower(),
            "password_salt": salt, "password_hash": digest,
            "created_at": "2026-08-02T00:00:00+00:00", "last_login_at": "2026-08-02T00:00:00+00:00",
            "sessions": [], "activity_log": [],
        }
        token, _ = main.start_user_session(user)
        users = main.load_users()
        users.append(user)
        main.save_users(users)
        return user, token

    def test_approved_admin_roster_requires_exact_name_and_email(self):
        approved_admins = [
            ("주연주", "yeonjoo"),
            ("허정환", "jeonghwan.hur"),
            ("이정태", "jeongtae_lee"),
            ("유택상", "taegsang.you"),
            ("서지영", "jiyoungseo"),
            ("정영찬", "alex_jeong"),
        ]
        for name, local_part in approved_admins:
            for domain in ("skbp.com", "sk.com"):
                self.assertEqual(
                    main.initial_role_for_identity(name, f"{local_part}@{domain}"),
                    main.ROLE_ADMIN,
                )

        self.assertEqual(
            main.initial_role_for_identity("정주원", "JOOWON.JUNG@SK.COM"),
            main.ROLE_DEVELOPER,
        )
        self.assertEqual(main.initial_role_for_identity("정주원", "joowon.jung@outside.com"), main.ROLE_USER)
        self.assertEqual(main.initial_role_for_identity("주연주", "yeonjoo@skbp.com"), main.ROLE_ADMIN)
        self.assertEqual(main.initial_role_for_identity("주연쥬", "yeonjoo@skbp.com"), main.ROLE_USER)
        self.assertEqual(main.initial_role_for_identity("user", "user@sk.com"), main.ROLE_USER)

    def test_regular_user_cannot_read_admin_api(self):
        _, token = self.create_user("user@sk.com")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.list_admin_users(FakeRequest(token)))
        self.assertEqual(error.exception.status_code, 403)

    def test_admin_can_view_activity_and_deactivate_account(self):
        _, admin_token = self.create_user("joowon.jung@skbp.com", "정주원")
        regular, regular_token = self.create_user("user@sk.com")
        asyncio.run(main.record_auth_activity(FakeRequest(regular_token, {"path": "/detail?id=asset-1"})))

        response = asyncio.run(main.list_admin_users(FakeRequest(admin_token)))
        target = next(user for user in response["users"] if user["email"] == "user@sk.com")
        self.assertTrue(any(item.get("path") == "/detail?id=asset-1" for item in target["activity_log"]))

        result = asyncio.run(main.update_admin_user(regular["id"], FakeRequest(admin_token, {"active": False})))
        self.assertFalse(result["user"]["active"])
        saved = next(user for user in main.load_users() if user["id"] == regular["id"])
        self.assertEqual(saved["sessions"], [])

    def test_admin_cannot_deactivate_self(self):
        admin, token = self.create_user("joowon.jung@skbp.com", "정주원")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.update_admin_user(admin["id"], FakeRequest(token, {"active": False})))
        self.assertEqual(error.exception.status_code, 400)

    def test_self_service_password_reset_emails_a_new_password_and_revokes_sessions(self):
        user, _ = self.create_user("user@sk.com")
        delivery = {}

        def capture_delivery(recipient, new_password):
            delivery["recipient"] = recipient
            delivery["new_password"] = new_password

        with (
            patch.object(main, "password_reset_email_configured", return_value=True),
            patch.object(main, "send_password_reset_email", side_effect=capture_delivery),
        ):
            result = asyncio.run(main.request_password_reset(FakeRequest(payload={"email": "user@sk.com"})))

        self.assertTrue(result["ok"])
        self.assertEqual(delivery["recipient"], "user@sk.com")
        self.assertGreaterEqual(len(delivery["new_password"]), 12)

        saved = next(item for item in main.load_users() if item["id"] == user["id"])
        _, expected_digest = main.password_hash(delivery["new_password"], saved["password_salt"])
        self.assertEqual(saved["password_hash"], expected_digest)
        self.assertEqual(saved["sessions"], [])

    def test_password_reset_delivery_failure_leaves_the_existing_password_usable(self):
        user, _ = self.create_user("user@sk.com")
        saved_before = next(item for item in main.load_users() if item["id"] == user["id"])

        with (
            patch.object(main, "password_reset_email_configured", return_value=True),
            patch.object(main, "send_password_reset_email", side_effect=RuntimeError("smtp down")),
        ):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(main.request_password_reset(FakeRequest(payload={"email": "user@sk.com"})))

        self.assertEqual(error.exception.status_code, 503)
        saved_after = next(item for item in main.load_users() if item["id"] == user["id"])
        self.assertEqual(saved_after["password_hash"], saved_before["password_hash"])
        self.assertEqual(saved_after["sessions"], saved_before["sessions"])

    def test_password_reset_resend_is_rate_limited(self):
        user, _ = self.create_user("user@sk.com")
        deliveries = []

        with (
            patch.object(main, "password_reset_email_configured", return_value=True),
            patch.object(main, "send_password_reset_email", side_effect=lambda recipient, new_password: deliveries.append(new_password)),
        ):
            first = asyncio.run(main.request_password_reset(FakeRequest(payload={"email": "user@sk.com"})))
            second = asyncio.run(main.request_password_reset(FakeRequest(payload={"email": "user@sk.com"})))

        self.assertTrue(first["ok"])
        self.assertTrue(second["ok"])
        self.assertEqual(len(deliveries), 1)
        self.assertIn("이미 재설정 이메일을 요청했습니다", second["message"])
        saved = next(item for item in main.load_users() if item["id"] == user["id"])
        _, expected_digest = main.password_hash(deliveries[0], saved["password_salt"])
        self.assertEqual(saved["password_hash"], expected_digest)

    def test_change_password_requires_current_password_and_prunes_other_sessions(self):
        user, token = self.create_user("user@sk.com")
        other_token, _ = main.start_user_session(user)
        users = main.load_users()
        stored = next(item for item in users if item["id"] == user["id"])
        stored["sessions"] = user["sessions"]
        stored["password_is_temporary"] = True
        main.save_users(users)

        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.change_password(FakeRequest(token, {
                "current_password": "wrong-password",
                "new_password": "brand-new-pw-1",
                "new_password_confirmation": "brand-new-pw-1",
            })))
        self.assertEqual(error.exception.status_code, 401)

        result = asyncio.run(main.change_password(FakeRequest(token, {
            "current_password": "test1234",
            "new_password": "brand-new-pw-1",
            "new_password_confirmation": "brand-new-pw-1",
        })))
        self.assertTrue(result["ok"])
        self.assertFalse(result["user"]["password_is_temporary"])

        saved = next(item for item in main.load_users() if item["id"] == user["id"])
        _, expected_digest = main.password_hash("brand-new-pw-1", saved["password_salt"])
        self.assertEqual(saved["password_hash"], expected_digest)
        self.assertEqual(len(saved["sessions"]), 1)
        self.assertEqual(saved["sessions"][0]["token_hash"], hashlib.sha256(token.encode("utf-8")).hexdigest())
        self.assertNotEqual(saved["sessions"][0]["token_hash"], hashlib.sha256(other_token.encode("utf-8")).hexdigest())

    def test_action_date_reminder_sends_once_to_resolved_shortlisting_owner(self):
        owner, _ = self.create_user("owner@sk.com", name="Action Owner")
        record = {
            "meta": {
                "review_type": "full_scout",
                "focus_management": {
                    "is_tracked": True,
                    "due_date": "2026-08-31",
                    "owner_name": "Action Owner",
                    "owner_user_id": owner["id"],
                    "owner_email": owner["email"],
                    "action_plan": "Confirm next meeting",
                },
            },
            "structured_table": {"asset_name": "Asset-1", "company": "Test Co"},
            "json_summary": {},
        }
        deliveries = []
        now = datetime(2026, 8, 31, 0, 0, tzinfo=timezone.utc)  # 09:00 KST, on the Action Date.
        with (
            patch.object(main, "password_reset_email_configured", return_value=True),
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "load_users", return_value=[owner]),
            patch.object(main, "save_records") as save_records,
            patch.object(main, "send_action_date_reminder_email", side_effect=lambda recipient, **kwargs: deliveries.append((recipient, kwargs))),
        ):
            result = main.run_action_date_reminders(now)
            repeat = main.run_action_date_reminders(now)

        self.assertEqual(result["sent"], 1)
        self.assertEqual(repeat["sent"], 0)
        self.assertEqual(deliveries[0][0], "owner@sk.com")
        self.assertEqual(record["meta"]["focus_management"]["action_date_reminders"][0]["days_until_due"], 0)
        self.assertTrue(save_records.called)


    def test_manual_review_requires_authentication(self):
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.update_manual_review("asset-1", FakeRequest(payload={"kind": "status", "value": "PASS"})))
        self.assertEqual(error.exception.status_code, 401)

    def test_manual_review_audit_uses_authenticated_name_not_payload_name(self):
        _, token = self.create_user("yeonjoo@skbp.com", name="주연주")
        record = {
            "meta": {},
            "json_summary": {"company": "Test Co", "asset_name": "Asset-1"},
            "structured_table": {
                "company": "Test Co",
                "asset_name": "Asset-1",
                "development_stage": "Preclinical Candidate",
            },
            "hard_filter": {"status": "PASS", "reason": "", "flags": []},
            "scoring": {"total_score": 15, "max_score": 21, "criteria": {}},
        }
        record_id = main.record_key(record)
        request = FakeRequest(
            token,
            {
                "kind": "status",
                "value": "REVIEW",
                "previous_value": "PASS",
                "actor_name": "Spoofed Name",
            },
        )
        with (
            patch.object(main, "load_records", return_value=[record]),
            patch.object(main, "save_records"),
            patch.object(main, "run_markdown_exports", return_value={}),
        ):
            result = asyncio.run(main.update_manual_review(record_id, request))

        human_review = result["record"]["meta"]["human_review"]
        self.assertEqual(human_review["history"][-1]["actor_name"], "주연주")
        self.assertEqual(human_review["last_updated_by"], "주연주")


if __name__ == "__main__":
    unittest.main()
