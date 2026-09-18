import asyncio
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import auth_activity as activity
import main
from tests.test_auth_admin import FakeRequest
from tests.test_chat_privacy import LocalClient


class ActivityMetricsTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 9, 19, 0, 0, tzinfo=timezone.utc)

    def test_heartbeat_is_bounded_and_concurrent_tabs_do_not_double_count(self):
        user = {}
        activity.record_activity(user, {}, self.now, 'ip', 'ip')
        event = activity.record_activity(user, {'active_seconds': 999999}, self.now + timedelta(seconds=60), 'ip', 'ip')
        self.assertEqual(event['active_seconds'], 60)
        activity.record_activity(user, {'active_seconds': 60}, self.now + timedelta(seconds=60), 'ip', 'ip')
        self.assertEqual(user['active_seconds_total'], 60)
        activity.record_activity(user, {'active_seconds': 999999}, self.now + timedelta(days=1), 'ip', 'ip')
        self.assertEqual(user['active_seconds_total'], 180)
        for value in (None, 'bad', [], {}, True, float('inf'), -5):
            event = activity.record_activity(user, {'active_seconds': value}, self.now + timedelta(days=1), 'ip', 'ip')
            self.assertEqual(event['active_seconds'], 0)

    def test_legacy_visits_are_counted_without_inventing_time(self):
        user = {'activity_log': [{'event': 'page_view', 'at': self.now.isoformat()}]}
        metrics = activity.user_metrics(user, self.now)
        self.assertEqual(metrics['active_days_30d'], 1)
        self.assertEqual(metrics['active_seconds_30d'], 0)
        self.assertIsNone(metrics['activity_measurement_started_at'])
        self.assertIsNone(activity.summary([user], self.now)['activity_measurement_started_at'])

    def test_korean_day_boundary_and_retention_preserve_aggregates(self):
        now = datetime(2026, 9, 18, 15, 0, tzinfo=timezone.utc)
        user = {'activity_log': [{'event': 'page_view', 'at': '2026-01-01T00:00:00Z'}] * 2000,
                'activity_clock_at': (now - timedelta(seconds=60)).isoformat(),
                'activity_daily': {'2026-01-01': {'active_seconds': 99, 'events': 1}}}
        activity.record_activity(user, {'active_seconds': 60}, now, 'ip', 'ip')
        self.assertEqual(len(user['activity_log']), 2000)
        self.assertEqual(set(user['activity_daily']), {'2026-09-19'})
        user['activity_log'] = []
        self.assertEqual(activity.user_metrics(user, now)['active_seconds_30d'], 60)
        self.assertEqual(activity.user_metrics(user, now + timedelta(days=30))['active_seconds_30d'], 0)
        self.assertEqual(activity.summary([user], now)['activity_days'][-1], {'date': '2026-09-19', 'active_seconds': 60})

    def test_last_seen_includes_new_login_and_ignores_bad_dates(self):
        self.assertEqual(activity.last_seen({'last_seen_at': 'bad', 'last_login_at': self.now.isoformat()}), self.now.isoformat())
        self.assertEqual(activity.last_seen({'last_seen_at': '2020-01-01', 'last_login_at': self.now.isoformat()}), self.now.isoformat())


class ActivityApiTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        file_patch = patch.object(main, 'USERS_FILE', self.root / 'users.json')
        file_patch.start()
        self.addCleanup(file_patch.stop)
        self.users = [{'id': key, 'name': key, 'email': key + '@example.test', 'role': role,
                       'created_at': '2026-09-01T00:00:00Z', 'activity_log': [], 'sessions': []}
                      for key, role in [('dev', 'developer'), ('alice', 'user'), ('bob', 'user'), ('admin', 'admin')]]
        main.save_users(self.users)
        auth_patch = patch.object(main, 'authenticated_user', side_effect=lambda req: next(
            (user for user in self.users if user['id'] == req.headers.get('x-test-user')), None))
        auth_patch.start()
        self.addCleanup(auth_patch.stop)
        self.client = LocalClient()

    def test_company_peer_ip_is_recorded_under_authenticated_account_and_visible(self):
        request = FakeRequest(payload={'path': '/?tab=advanced'}, ip='10.145.144.194')
        request.headers = {'x-test-user': 'alice', 'x-forwarded-for': '10.1.2.3'}
        result = asyncio.run(main.record_auth_activity(request))
        self.assertEqual(result['user_id'], 'alice')
        response = self.client.get('/api/admin/users', headers={'x-test-user': 'dev'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        data = response.json()
        self.assertEqual(data['users'][0]['id'], 'alice')
        event = data['users'][0]['activity_log'][-1]
        self.assertEqual(event['peer_ip'], '10.145.144.194')
        self.assertEqual(event['actor_ip'], '10.1.2.3')
        self.assertEqual(event['path'], '/?tab=advanced')
        self.assertEqual(data['server']['storage'], 'local')
        self.assertEqual(data['summary']['timezone'], 'Asia/Seoul')
        self.assertNotIn('sessions', data['users'][0])
        self.assertEqual(next(u for u in data['users'] if u['id'] == 'bob')['activity_count'], 0)

    def test_only_developer_can_read_activity_and_invalid_posts_fail(self):
        for user in ('alice', 'bob', 'admin'):
            self.assertEqual(self.client.get('/api/admin/users', headers={'x-test-user': user}).status_code, 403)
        self.assertEqual(self.client.get('/api/admin/users').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/activity', json={}).status_code, 401)
        self.assertEqual(self.client.post('/api/auth/activity', headers={'x-test-user': 'alice'}, json=['bad']).status_code, 400)
        self.assertEqual(sum(len(u['activity_log']) for u in main.load_users()), 0)

    def test_save_failure_does_not_acknowledge_success(self):
        request = FakeRequest(payload={'path': '/'})
        request.headers = {'x-test-user': 'alice'}
        with patch.object(main, 'save_users', side_effect=OSError('disk error')):
            with self.assertRaises(OSError):
                asyncio.run(main.record_auth_activity(request))

    def test_distinct_server_files_have_distinct_scope_and_no_shared_events(self):
        self.client.post('/api/auth/activity', headers={'x-test-user': 'alice'}, json={'path': '/wiki'})
        first = self.client.get('/api/admin/users', headers={'x-test-user': 'dev'}).json()
        with patch.object(main, 'USERS_FILE', self.root / 'second-server' / 'users.json'):
            main.save_users(self.users)
            second = self.client.get('/api/admin/users', headers={'x-test-user': 'dev'}).json()
        self.assertNotEqual(first['server']['instance_id'], second['server']['instance_id'])
        self.assertEqual(sum(u['activity_count'] for u in first['users']), 1)
        self.assertEqual(sum(u['activity_count'] for u in second['users']), 0)


if __name__ == '__main__':
    unittest.main()
