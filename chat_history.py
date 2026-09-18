"""Private AI conversations, separate from shared research records and static mounts."""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager

from fastapi import APIRouter, HTTPException, Request

DB_PATH = Path(__file__).resolve().parent / "data" / "chat-history.sqlite3"


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("""CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, scope TEXT NOT NULL,
        updated_at TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL
    )""")
    try:
        with db:
            yield db
    finally:
        db.close()


def read_owned(user, conversation_id):
    if not conversation_id:
        return None
    with connect() as db:
        row = db.execute("SELECT content FROM conversations WHERE id=? AND owner_id=?",
                         (conversation_id, str(user['id']))).fetchone()
    if not row:
        raise HTTPException(404, "대화를 찾을 수 없습니다.")
    return json.loads(row['content'])


def model_history(user, conversation_id):
    session = read_owned(user, conversation_id)
    if not session:
        return []
    messages = [m for m in session['messages'] if m.get('status') == 'done']
    # The current user question has already been saved by the UI and is sent separately.
    if messages and messages[-1]['role'] == 'user':
        messages = messages[:-1]
    result, budget = [], 16000
    for message in reversed(messages[-20:]):
        content = message['text']
        if len(content) > budget:
            break
        result.append({'role': message['role'], 'content': content})
        budget -= len(content)
    return list(reversed(result))


def router(require_user, require_developer):
    api = APIRouter()

    @api.get('/api/chat/sessions')
    async def list_sessions(request: Request, scope: str = 'dashboard', all_users: bool = False):
        user = require_developer(request) if all_users else require_user(request)
        with connect() as db:
            if all_users:
                rows = db.execute('SELECT content FROM conversations ORDER BY updated_at DESC').fetchall()
            else:
                rows = db.execute('SELECT content FROM conversations WHERE owner_id=? AND scope=? ORDER BY updated_at DESC',
                                  (str(user['id']), scope)).fetchall()
        return {'sessions': [json.loads(row['content']) for row in rows], 'owner_id': str(user['id'])}

    @api.put('/api/chat/sessions/{session_id}')
    async def save_session(session_id: str, request: Request):
        user = require_user(request)
        body = await request.json()
        if not isinstance(body, dict) or body.get('owner_id') != str(user['id']):
            raise HTTPException(409, '로그인 계정이 변경되었습니다. 대화를 다시 불러와 주세요.')
        if len(json.dumps(body)) > 4_000_000:
            raise HTTPException(413, '대화가 너무 큽니다. 새 대화를 시작해 주세요.')
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,120}', session_id):
            raise HTTPException(400, '잘못된 대화 ID입니다.')
        messages = body.get('messages')
        scope = body.get('scope')
        if not isinstance(scope, str) or not scope or len(scope) > 500:
            raise HTTPException(400, '대화 범위를 확인해 주세요.')
        if not isinstance(messages, list) or len(messages) > 1000:
            raise HTTPException(400, '한 대화는 1,000개 메시지까지 저장할 수 있습니다. 새 대화를 시작해 주세요.')
        clean = []
        for message in messages:
            if (not isinstance(message, dict) or message.get('role') not in ('user', 'assistant')
                    or not isinstance(message.get('text'), str) or len(message['text']) > 40000):
                raise HTTPException(400, '메시지 형식 또는 길이를 확인해 주세요.')
            clean.append({key: message[key] for key in ('id', 'role', 'text', 'sources', 'createdAt', 'status') if key in message})
        now = datetime.now(timezone.utc).isoformat()
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            existing = db.execute('SELECT owner_id, version, content FROM conversations WHERE id=?', (session_id,)).fetchone()
            if existing and existing['owner_id'] != str(user['id']):
                raise HTTPException(404, '대화를 찾을 수 없습니다.')
            if existing and body.get('version') != existing['version']:
                raise HTTPException(409, '다른 창에서 대화가 변경되었습니다. 새로고침 후 다시 시도해 주세요.')
            previous = json.loads(existing['content']) if existing else {}
            session = dict(id=session_id, owner_id=str(user['id']), owner_name=user.get('name') or user.get('email'),
                           scope=scope, title=str(body.get('title') or '새 대화')[:160],
                           createdAt=previous.get('createdAt', now), updatedAt=now,
                           version=(existing['version'] if existing else 0) + 1, messages=clean)
            db.execute('INSERT OR REPLACE INTO conversations VALUES (?, ?, ?, ?, ?, ?)',
                       (session_id, str(user['id']), scope, now, session['version'], json.dumps(session, ensure_ascii=False)))
        return {'session': session}

    @api.delete('/api/chat/sessions/{session_id}')
    async def delete_session(session_id: str, request: Request):
        user = require_user(request)
        if request.query_params.get('owner_id') != str(user['id']):
            raise HTTPException(409, '로그인 계정이 변경되었습니다.')
        with connect() as db:
            db.execute('DELETE FROM conversations WHERE id=? AND owner_id=?', (session_id, str(user['id'])))
        return {'ok': True}

    return api
