// Conversation content is kept on the authenticated server, never in shared localStorage.
export function createPrivateConversations({ getUser, getScope, bar, form, controls, onLoad }) {
  const tools = document.createElement('div');
  tools.className = 'agent-history-tools';
  const view = document.createElement('select');
  view.setAttribute('aria-label', '대화 이력 조회 범위');
  view.innerHTML = '<option value="mine">내 대화</option><option value="all">전체 대화 · 개발자 조회</option>';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  tools.append(view, status);
  bar.after(tools);
  const submitButton = form.querySelector('button[type="submit"]');
  const submitMarkup = submitButton?.innerHTML;
  let owner = '', generation = 0, loaded = false, busy = false, timer = 0;
  let sessions = [], chain = Promise.resolve(), versions = new Map(), saved = new Map();
  let lastError = null;
  const readonly = () => view.value === 'all';
  const writable = () => loaded && owner === String(getUser()?.id || '') && !readonly();
  const signature = (s) => JSON.stringify({ title: s.title, messages: s.messages });
  function applyState() {
    view.hidden = !getUser()?.is_developer;
    view.disabled = busy || !loaded;
    for (const control of controls) if (control) control.disabled = !loaded || busy || (readonly() && control.tagName !== 'SELECT');
    for (const control of form.querySelectorAll('textarea, button')) control.disabled = !writable() || busy;
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || '대화 저장소에 연결하지 못했습니다.');
    return data;
  }
  async function load({ resetView = false } = {}) {
    const token = ++generation;
    clearTimeout(timer);
    owner = String(getUser()?.id || '');
    if (resetView || !getUser()?.is_developer) view.value = 'mine';
    loaded = false; busy = false; lastError = null;
    if (submitButton) {
      submitButton.innerHTML = submitMarkup;
      submitButton.removeAttribute('aria-busy');
      submitButton.setAttribute('aria-label', '질문 전송');
    }
    sessions = []; versions = new Map(); saved = new Map();
    onLoad([], readonly());
    applyState();
    if (!owner) { status.textContent = '로그인 후 개인 대화를 이용할 수 있습니다.'; return; }
    status.textContent = '내 대화를 불러오는 중…';
    try {
      const data = await request(`/api/chat/sessions?scope=${encodeURIComponent(getScope())}&all_users=${readonly()}`);
      if (token !== generation) return;
      if (data.owner_id !== owner) throw new Error('로그인 계정이 변경되었습니다.');
      sessions = data.sessions || [];
      for (const session of sessions) {
        versions.set(session.id, session.version);
        saved.set(session.id, signature(session));
        if (!readonly()) for (const message of session.messages || []) {
          if (message.status === 'pending') {
            message.status = 'interrupted';
            message.text += '\n\n응답이 완료되지 않았습니다. 질문을 다시 전송해 주세요.';
          }
        }
      }
      loaded = true;
      status.textContent = readonly() ? '전체 사용자 이력 · 읽기 전용' : '개인 대화 · 본인과 개발자만 조회';
      onLoad(sessions, readonly());
      applyState();
    } catch (error) {
      if (token !== generation) return;
      lastError = error;
      status.textContent = `${error.message} 새로고침해 주세요.`;
    }
  }
  function save(next) {
    if (!writable()) return;
    sessions = next;
    clearTimeout(timer);
    timer = setTimeout(() => { void flush().catch(() => {}); }, 450);
  }
  async function flush() {
    clearTimeout(timer);
    if (!writable()) throw new Error('개인 대화를 불러온 후 다시 시도해 주세요.');
    if (lastError) throw lastError;
    const token = generation, expectedOwner = owner, scope = getScope();
    const snapshot = JSON.parse(JSON.stringify(sessions));
    const work = chain.catch(() => {}).then(async () => {
      if (token !== generation) return;
      for (const session of snapshot) {
        const stamp = signature(session);
        if (saved.get(session.id) === stamp) continue;
        const data = await request(`/api/chat/sessions/${encodeURIComponent(session.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...session, owner_id: expectedOwner, scope, version: versions.get(session.id) })
        });
        if (token !== generation) return;
        versions.set(session.id, data.session.version);
        saved.set(session.id, stamp);
      }
      const currentIds = new Set(snapshot.map(s => s.id));
      for (const id of [...saved.keys()]) {
        if (currentIds.has(id)) continue;
        await request(`/api/chat/sessions/${encodeURIComponent(id)}?owner_id=${encodeURIComponent(expectedOwner)}`, { method: 'DELETE' });
        if (token !== generation) return;
        saved.delete(id); versions.delete(id);
      }
      status.textContent = '개인 대화 저장됨 · 본인과 개발자만 조회';
    });
    chain = work;
    try { await work; }
    catch (error) {
      if (token === generation) {
        lastError = error;
        status.textContent = `저장 실패: ${error.message} 이 창의 내용을 복사한 뒤 새로고침해 주세요.`;
      }
      throw error;
    }
  }
  view.addEventListener('change', async () => {
    const next = view.value;
    if (next === 'all') {
      view.value = 'mine';
      try { await flush(); } catch { return; }
      view.value = next;
    }
    void load();
  });
  return { load, save, flush, readonly, writable, applyState,
    setBusy(value) { busy = value; applyState(); } };
}
