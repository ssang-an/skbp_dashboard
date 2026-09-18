import json
import tempfile
import unittest
import asyncio
from types import SimpleNamespace
from urllib.parse import urlsplit
from pathlib import Path
from unittest.mock import patch

import chat_history
import main
from tests.test_agent_chat_context import chat_record


class LocalClient:
    """Exercise ASGI routes in process without network or optional HTTP clients."""
    def request(self, method, url, headers=None, json=None):
        import json as codec
        parts = urlsplit(url)
        body = codec.dumps(json).encode() if json is not None else b''
        events = []
        async def run():
            delivered = False
            async def receive():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {'type': 'http.request', 'body': body, 'more_body': False}
                await asyncio.Event().wait()
            async def send(event): events.append(event)
            await main.app({'type': 'http', 'asgi': {'version': '3.0', 'spec_version': '2.4'},
                'http_version': '1.1', 'method': method, 'scheme': 'http', 'path': parts.path,
                'raw_path': parts.path.encode(), 'query_string': parts.query.encode(),
                'headers': [(k.encode(), v.encode()) for k, v in (headers or {}).items()],
                'client': ('127.0.0.1', 12345), 'server': ('test', 80), 'root_path': ''}, receive, send)
        asyncio.run(run())
        start = next(e for e in events if e['type'] == 'http.response.start')
        text = b''.join(e.get('body', b'') for e in events if e['type'] == 'http.response.body').decode()
        return SimpleNamespace(status_code=start['status'], text=text, json=lambda: codec.loads(text),
            headers={k.decode(): v.decode() for k, v in start['headers']})
    def get(self, url, **kwargs): return self.request('GET', url, **kwargs)
    def put(self, url, **kwargs): return self.request('PUT', url, **kwargs)
    def post(self, url, **kwargs): return self.request('POST', url, **kwargs)
    def delete(self, url, **kwargs): return self.request('DELETE', url, **kwargs)


class ChatPrivacyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.patch = patch.object(chat_history, 'DB_PATH', Path(self.temp.name) / 'history.sqlite3')
        self.patch.start()
        self.addCleanup(self.patch.stop)
        users = {key: {'id': key, 'name': key, 'role': role} for key, role in
                 [('alice', 'user'), ('bob', 'user'), ('admin', 'admin'), ('dev', 'developer')]}
        auth = patch.object(main, 'authenticated_user', side_effect=lambda req: users.get(req.headers.get('x-test-user')))
        auth.start()
        self.addCleanup(auth.stop)
        self.client = LocalClient()

    def save(self, who='alice', session='session_1', **extra):
        body = {'owner_id': who, 'title': 'Private question', 'scope': 'dashboard', 'messages': [
            {'id': 'u1', 'role': 'user', 'text': 'ALPHA-101 evidence?', 'status': 'done'},
            {'id': 'a1', 'role': 'assistant', 'text': 'Previous answer', 'status': 'done'},
            {'id': 'u2', 'role': 'user', 'text': 'What about that candidate?', 'status': 'done'},
            {'id': 'a2', 'role': 'assistant', 'text': 'Pending', 'status': 'pending'},
        ], **extra}
        return self.client.put('/api/chat/sessions/' + session, headers={'x-test-user': who}, json=body)

    def test_history_is_owner_scoped_and_only_developer_can_read_all(self):
        self.assertEqual(self.save().status_code, 200)
        for who, count in [('alice', 1), ('bob', 0), ('dev', 0)]:
            response = self.client.get('/api/chat/sessions', headers={'x-test-user': who})
            self.assertEqual(len(response.json()['sessions']), count)
            self.assertEqual(response.headers['cache-control'], 'no-store')
        for who in ('alice', 'bob', 'admin'):
            self.assertEqual(self.client.get('/api/chat/sessions?all_users=true', headers={'x-test-user': who}).status_code, 403)
        result = self.client.get('/api/chat/sessions?all_users=true', headers={'x-test-user': 'dev'})
        self.assertEqual(result.json()['sessions'][0]['owner_id'], 'alice')
        self.assertEqual(self.client.get('/api/chat/sessions').status_code, 401)

    def test_ownership_cannot_be_forged_or_overwritten_even_by_developer(self):
        self.save()
        for who in ('bob', 'dev'):
            self.assertEqual(self.save(who).status_code, 404)
            self.client.delete('/api/chat/sessions/session_1?owner_id=' + who, headers={'x-test-user': who})
        self.assertEqual(self.save('bob', owner_id='alice').status_code, 409)
        result = self.client.get('/api/chat/sessions', headers={'x-test-user': 'alice'})
        self.assertEqual(len(result.json()['sessions']), 1)

    def test_conflicting_tabs_cannot_silently_overwrite_and_history_is_not_truncated(self):
        response = self.save()
        self.assertEqual(response.json()['session']['version'], 1)
        self.assertEqual(self.save().status_code, 409)
        messages = [{'role': 'user', 'text': str(i), 'status': 'done'} for i in range(90)]
        response = self.save(version=1, messages=messages)
        self.assertEqual(len(response.json()['session']['messages']), 90)
        self.assertEqual(response.json()['session']['version'], 2)

    def test_detail_scope_and_delete(self):
        self.save(scope='detail:alpha-record')
        self.assertEqual(self.client.get('/api/chat/sessions', headers={'x-test-user': 'alice'}).json()['sessions'], [])
        self.assertEqual(len(self.client.get('/api/chat/sessions?scope=detail:alpha-record', headers={'x-test-user': 'alice'}).json()['sessions']), 1)
        self.client.delete('/api/chat/sessions/session_1?owner_id=alice', headers={'x-test-user': 'alice'})
        with self.assertRaises(main.HTTPException):
            chat_history.read_owned({'id': 'alice'}, 'session_1')

    def test_chat_rejects_foreign_history_before_external_call(self):
        self.save()
        with patch.object(main, 'stream_openrouter_chat') as call:
            response = self.client.post('/api/chat/stream', headers={'x-test-user': 'bob'}, json={
                'conversation_id': 'session_1', 'record_id': 'alpha-record', 'message': 'hello'})
            self.assertEqual(response.status_code, 404)
            call.assert_not_called()

    def test_stream_passes_saved_history_and_closes_transport(self):
        self.save()
        record = chat_record('alpha-record', 'ALPHA-101', 'Alpha Bio', 'AD', 12)
        class Stream:
            closed = False
            def __iter__(self):
                yield b'data: {"choices":[{"delta":{"content":"Mock answer"}}]}'
                yield b'data: [DONE]'
            def close(self): self.closed = True
        stream = Stream()
        with patch.object(main, 'load_records', return_value=[record]), patch.object(main, 'stream_openrouter_chat', return_value=(stream, [], None)) as call:
            response = self.client.post('/api/chat/stream', headers={'x-test-user': 'alice'}, json={
                'conversation_id': 'session_1', 'record_id': 'alpha-record', 'message': 'What about that candidate?'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('Mock answer', response.text)
        self.assertTrue(stream.closed)
        history = call.call_args.kwargs['conversation_history']
        self.assertEqual([m['content'] for m in history], ['ALPHA-101 evidence?', 'Previous answer'])

    @patch.dict(main.os.environ, {'OPENROUTER_API_KEY': 'mock-key'})
    def test_openrouter_messages_preserve_history_and_retrieved_report(self):
        record = chat_record('alpha-record', 'ALPHA-101', 'Alpha Bio', 'AD', 12, report='Quantitative marker evidence')
        with patch.object(main, 'agentic_search_wiki_notes', return_value=[]), patch.object(main, 'post_openrouter') as post:
            post.return_value.json.return_value = {'choices': [{'message': {'content': 'Mock answer'}}]}
            main.call_openrouter_chat(record, 'Follow up', conversation_history=[{'role': 'user', 'content': 'Prior question'}])
        messages = post.call_args.args[0]['messages']
        self.assertEqual(messages[1], {'role': 'user', 'content': 'Prior question'})
        self.assertIn('Quantitative marker evidence', messages[-1]['content'])

    def test_listing_candidates_are_searchable_before_a_research_record_exists(self):
        with patch.object(main, 'load_records', return_value=[]), patch.object(main, 'load_candidate_queue', return_value=[
            {'id': 'queue1', 'asset_input': 'EARLY-1', 'company_input': 'Early Bio'}]):
            records = main.load_chat_scope_records({'scope_mode': 'listing'})
        self.assertEqual(main.record_key(records[0]), 'listing:queue1')
        self.assertEqual(records[0]['structured_table']['asset_name'], 'EARLY-1')
        self.assertNotIn('scoring', records[0])

    def test_stream_provider_error_and_empty_response_are_visible(self):
        record = chat_record('alpha-record', 'ALPHA-101', 'Alpha Bio', 'AD', 12)
        for lines in ([b'data: {"error":{"message":"Credit limit exceeded"}}'], [b'data: [DONE]']):
            with self.subTest(lines=lines), patch.object(main, 'load_records', return_value=[record]), patch.object(main, 'stream_openrouter_chat', return_value=(iter(lines), [], None)):
                result = self.client.post('/api/chat/stream', headers={'x-test-user': 'alice'}, json={
                    'record_id': 'alpha-record', 'message': 'Explain evidence'})
            self.assertIn('"fallback": true', result.text)
            self.assertIn('OpenRouter', result.text)

    def test_unauthenticated_chat_cannot_call_openrouter(self):
        with patch.object(main, 'stream_openrouter_chat') as call:
            self.assertEqual(self.client.post('/api/chat/stream', json={'message': 'hello'}).status_code, 401)
            call.assert_not_called()


if __name__ == '__main__':
    unittest.main()
