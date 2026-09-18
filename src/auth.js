let currentUser = null;
let authReady = null;
let pendingAuthResolve = null;
let activityHeartbeatTimer = null;
let activityLastSentAt = 0;
let activityLastEngagedAt = 0;
const ACTIVITY_HEARTBEAT_MS = 60_000;
const ACTIVITY_ENGAGEMENT_WINDOW_MS = 120_000;
const AUTH_IDENTITY_KEY = 'skbp.auth.identity.v1';

window.addEventListener('storage', (event) => {
  if (event.key !== AUTH_IDENTITY_KEY) return;
  // Clear private UI immediately while rechecking the shared login cookie.
  currentUser = null;
  renderAuth();
  window.dispatchEvent(new CustomEvent('skbp:authchange', { detail: { user: null } }));
  void loadCurrentUser();
});

function activityPath() {
  return `${location.pathname}${location.search}`;
}

function postAuthActivity(activeSeconds = 0, { keepalive = false } = {}) {
  if (!currentUser) return;
  fetch('/api/auth/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: activityPath(), active_seconds: activeSeconds }),
    keepalive,
  }).catch(() => {});
}

function recordEngagement() {
  activityLastEngagedAt = Date.now();
}

function sendActiveHeartbeat({ force = false, keepalive = false } = {}) {
  if (!currentUser || (document.hidden && !force)) return;
  const now = Date.now();
  if (!force && now - activityLastEngagedAt > ACTIVITY_ENGAGEMENT_WINDOW_MS) return;
  const elapsedSeconds = Math.floor((now - activityLastSentAt) / 1000);
  if (elapsedSeconds < 5) return;
  activityLastSentAt = now;
  postAuthActivity(Math.min(elapsedSeconds, 120), { keepalive });
}

function startActivityTracking() {
  recordEngagement();
  activityLastSentAt = Date.now();
  if (activityHeartbeatTimer) return;
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, recordEngagement, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sendActiveHeartbeat({ force: true });
    else { recordEngagement(); activityLastSentAt = Date.now(); }
  });
  window.addEventListener('pagehide', () => sendActiveHeartbeat({ force: true, keepalive: true }));
  activityHeartbeatTimer = window.setInterval(() => sendActiveHeartbeat(), ACTIVITY_HEARTBEAT_MS);
}

function authMarkup() {
  return `
    <button class="auth-trigger" type="button" data-auth-trigger aria-label="로그인">
      <span class="auth-user-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" /></svg>
        <i class="auth-status-dot"></i>
      </span>
      <b>로그인</b>
    </button>
    <div class="auth-menu" data-auth-menu hidden>
      <strong data-auth-menu-name></strong><span data-auth-menu-email></span>
      <a class="auth-admin-link" href="/admin/users" data-auth-admin hidden>사용자 관리</a>
      <button type="button" data-auth-change-password>비밀번호 변경</button>
      <button type="button" data-auth-signout>로그아웃</button>
    </div>`;
}

function modalMarkup() {
  return `<div class="auth-modal-backdrop" data-auth-modal hidden>
    <section class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
      <button class="auth-modal-close" type="button" data-auth-close aria-label="닫기">×</button>
      <p class="auth-modal-eyebrow">SKBP ACCOUNT</p>
      <h2 id="authModalTitle">로그인</h2>
      <p class="auth-modal-copy" data-auth-copy>SKBP Pipeline Finder를 사용하려면 로그인해주세요.</p>
      <form data-auth-form novalidate>
        <label data-auth-name-field hidden><span>이름</span><input name="name" maxlength="100" autocomplete="name" placeholder="이름" /></label>
        <label data-auth-email-field><span>이메일</span><input name="email" type="email" maxlength="254" autocomplete="email" placeholder="name@company.com" required /></label>
        <label data-auth-password-field><span data-auth-password-label>비밀번호</span><input name="password" type="password" minlength="4" maxlength="200" autocomplete="current-password" placeholder="4자 이상" required /></label>
        <label data-auth-new-password-field hidden><span>새 비밀번호</span><input name="new_password" type="password" minlength="4" maxlength="200" autocomplete="new-password" placeholder="4자 이상" /></label>
        <label data-auth-new-password-confirm-field hidden><span>새 비밀번호 확인</span><input name="new_password_confirmation" type="password" minlength="4" maxlength="200" autocomplete="new-password" placeholder="새 비밀번호를 다시 입력하세요" /></label>
        <p class="auth-form-status" data-auth-status role="status" aria-live="polite"></p>
        <button class="auth-submit" type="submit">로그인</button>
      </form>
      <button class="auth-forgot-password" type="button" data-auth-forgot-password>비밀번호를 잊으셨나요?</button>
      <button class="auth-mode-switch" type="button" data-auth-mode-switch>처음이신가요? <b>간단 회원가입</b></button>
      <button class="auth-back-to-signin" type="button" data-auth-back-to-signin hidden>로그인으로 돌아가기</button>
      <div class="auth-processing" data-auth-processing hidden role="status" aria-live="polite">
        <span class="auth-processing-icon" aria-hidden="true">⌛</span>
        <strong>새 비밀번호를 이메일로 보내고 있습니다</strong>
        <span>잠시만 기다려 주세요.</span>
      </div>
    </section>
  </div>`;
}

function emitAuthChange() {
  try {
    const identity = String(currentUser?.id || '');
    if (localStorage.getItem(AUTH_IDENTITY_KEY) !== identity) localStorage.setItem(AUTH_IDENTITY_KEY, identity);
  } catch { /* Account events in this tab remain available without localStorage. */ }
  window.dispatchEvent(new CustomEvent('skbp:authchange', { detail: { user: currentUser } }));
}

function renderAuth() {
  document.querySelectorAll('[data-auth-trigger]').forEach((button) => {
    button.classList.toggle('is-signed-in', Boolean(currentUser));
    button.querySelector('b').textContent = currentUser ? currentUser.name : '로그인';
    button.setAttribute('aria-label', currentUser ? `${currentUser.name} 계정 메뉴` : '로그인');
  });
  document.querySelectorAll('[data-auth-menu-name]').forEach((node) => { node.textContent = currentUser?.name || ''; });
  document.querySelectorAll('[data-auth-menu-email]').forEach((node) => { node.textContent = currentUser?.email || ''; });
  document.querySelectorAll('[data-auth-admin]').forEach((node) => { node.hidden = !currentUser?.is_developer; });
  document.querySelectorAll('[data-auth-change-password]').forEach((node) => {
    node.textContent = currentUser?.password_is_temporary ? '비밀번호 변경 (필요)' : '비밀번호 변경';
  });
}

function setMode(mode) {
  const signup = mode === 'signup';
  const resetRequest = mode === 'password-reset-request';
  const passwordChange = mode === 'password-change';
  const modal = document.querySelector('[data-auth-modal]');
  const passwordInput = modal.querySelector('input[name="password"]');
  const emailInput = modal.querySelector('input[name="email"]');
  modal.dataset.mode = mode;
  modal.querySelector('#authModalTitle').textContent = resetRequest
    ? '비밀번호 찾기'
    : (passwordChange ? '비밀번호 변경' : (signup ? '간단 회원가입' : '로그인'));
  modal.querySelector('[data-auth-copy]').textContent = resetRequest
    ? '가입한 이메일 주소를 입력하면 새 비밀번호를 이메일로 보내드립니다.'
    : (passwordChange
      ? (currentUser?.password_is_temporary
        ? '임시 비밀번호로 로그인하셨습니다. 아래에서 새 비밀번호로 변경해 주세요.'
        : '현재 비밀번호와 새 비밀번호를 입력하세요. 변경하면 다른 기기의 로그인은 모두 종료됩니다.')
      : (signup ? '이름, 이메일, 비밀번호만 입력하면 바로 시작할 수 있습니다.' : 'SKBP Pipeline Finder를 사용하려면 로그인해주세요.'));
  modal.querySelector('[data-auth-name-field]').hidden = !signup;
  modal.querySelector('[data-auth-email-field]').hidden = passwordChange;
  modal.querySelector('[data-auth-password-field]').hidden = resetRequest;
  modal.querySelector('[data-auth-new-password-field]').hidden = !passwordChange;
  modal.querySelector('[data-auth-new-password-confirm-field]').hidden = !passwordChange;
  modal.querySelector('input[name="name"]').required = signup;
  emailInput.required = !passwordChange;
  passwordInput.required = !resetRequest;
  passwordInput.minLength = 4;
  passwordInput.autocomplete = passwordChange ? 'current-password' : (signup ? 'new-password' : 'current-password');
  passwordInput.placeholder = passwordChange ? '현재 비밀번호' : '4자 이상';
  modal.querySelector('[data-auth-password-label]').textContent = passwordChange ? '현재 비밀번호' : '비밀번호';
  modal.querySelector('input[name="new_password"]').required = passwordChange;
  modal.querySelector('input[name="new_password_confirmation"]').required = passwordChange;
  modal.querySelector('.auth-submit').textContent = resetRequest
    ? '새 비밀번호 이메일로 받기'
    : (passwordChange ? '비밀번호 변경' : (signup ? '가입하고 시작하기' : '로그인'));
  modal.querySelector('[data-auth-forgot-password]').hidden = mode !== 'signin';
  modal.querySelector('[data-auth-mode-switch]').hidden = resetRequest || passwordChange;
  modal.querySelector('[data-auth-mode-switch]').innerHTML = signup ? '이미 계정이 있나요? <b>로그인</b>' : '처음이신가요? <b>간단 회원가입</b>';
  modal.querySelector('[data-auth-back-to-signin]').hidden = !resetRequest && !passwordChange;
  modal.querySelector('[data-auth-back-to-signin]').textContent = passwordChange ? '취소' : '로그인으로 돌아가기';
  modal.querySelector('[data-auth-status]').textContent = '';
  modal.querySelector('[data-auth-status]').classList.remove('is-success');
}

function setAuthProcessing(modal, processing) {
  const panel = modal.querySelector('[data-auth-processing]');
  if (processing && !panel.dataset.sharedProcessingModal) {
    panel.className = 'auth-processing operation-modal-backdrop';
    panel.innerHTML = `
      <section class="operation-modal" role="status" aria-live="polite">
        <header class="operation-modal-header">
          <span class="operation-modal-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M7 3h10M7 21h10M8.5 3c0 4 1 5.5 3.5 7.3 2.5-1.8 3.5-3.3 3.5-7.3M8.5 21c0-4 1-5.5 3.5-7.3 2.5 1.8 3.5 3.3 3.5 7.3" /><path d="M9.5 17h5" /></svg>
          </span>
          <div>
            <p class="operation-modal-eyebrow">PROCESSING</p>
            <h2>새 비밀번호를 이메일로 보내고 있습니다</h2>
          </div>
        </header>
        <p class="operation-modal-copy">잠시만 기다려 주세요.</p>
      </section>`;
    panel.dataset.sharedProcessingModal = 'true';
  }
  panel.hidden = !processing;
  modal.classList.toggle('is-processing', processing);
}

function setRequiredGate(required) {
  const modal = document.querySelector('[data-auth-modal]');
  if (!modal) return;
  modal.dataset.required = required ? 'true' : 'false';
  modal.querySelector('[data-auth-close]').hidden = required;
  document.body.classList.toggle('auth-required', required);
}

export function openAuthModal(mode = 'signin', options = {}) {
  const modal = document.querySelector('[data-auth-modal]');
  if (!modal) return Promise.resolve(null);
  setMode(mode);
  setRequiredGate(Boolean(options.required));
  modal.hidden = false;
  const focusTarget = mode === 'signup' ? 'input[name="name"]' : 'input[name="email"]';
  modal.querySelector(focusTarget)?.focus();
  return new Promise((resolve) => { pendingAuthResolve = resolve; });
}

function closeAuthModal(result = null) {
  const modal = document.querySelector('[data-auth-modal]');
  if (!modal || (modal.dataset.required === 'true' && !result)) return;
  modal.hidden = true;
  setRequiredGate(false);
  if (pendingAuthResolve) {
    const resolve = pendingAuthResolve;
    pendingAuthResolve = null;
    resolve(result);
  }
}

export async function requireAuth() {
  await authReady;
  if (currentUser) return currentUser;
  return openAuthModal('signin', { required: true });
}

export function getCurrentUser() { return currentUser; }

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    currentUser = data.authenticated ? data.user : null;
    if (currentUser) {
      postAuthActivity();
      startActivityTracking();
    }
  } catch (_) {
    currentUser = null;
  }
  renderAuth();
  emitAuthChange();
  if (!currentUser) openAuthModal('signin', { required: true });
  return currentUser;
}

export function initAuthUI() {
  if (document.querySelector('[data-auth-modal]')) return authReady;
  document.querySelectorAll('.top-actions').forEach((actions) => {
    const shell = document.createElement('div');
    shell.className = 'auth-shell';
    shell.innerHTML = authMarkup();
    const personalActions = actions.querySelector('.top-personal-actions') || actions;
    const themeButton = personalActions.querySelector('[data-theme-toggle]');
    personalActions.insertBefore(shell, themeButton || null);
  });
  document.body.insertAdjacentHTML('beforeend', modalMarkup());

  document.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-auth-trigger]');
    if (trigger) {
      const menu = trigger.parentElement.querySelector('[data-auth-menu]');
      if (currentUser) menu.hidden = !menu.hidden;
      else openAuthModal('signin', { required: true });
      return;
    }
    if (event.target.closest('[data-auth-mode-switch]')) {
      setMode(document.querySelector('[data-auth-modal]').dataset.mode === 'signup' ? 'signin' : 'signup');
      return;
    }
    if (event.target.closest('[data-auth-forgot-password]')) {
      setMode('password-reset-request');
      return;
    }
    if (event.target.closest('[data-auth-change-password]')) {
      document.querySelectorAll('[data-auth-menu]').forEach((menu) => { menu.hidden = true; });
      openAuthModal('password-change');
      return;
    }
    if (event.target.closest('[data-auth-back-to-signin]')) {
      const modal = document.querySelector('[data-auth-modal]');
      if (modal.dataset.mode === 'password-change') closeAuthModal();
      else setMode('signin');
      return;
    }
    if (event.target.closest('[data-auth-close]') || event.target.matches('[data-auth-modal]')) closeAuthModal();
    if (event.target.closest('[data-auth-signout]')) {
      await fetch('/api/auth/signout', { method: 'POST' });
      currentUser = null;
      document.querySelectorAll('[data-auth-menu]').forEach((menu) => { menu.hidden = true; });
      renderAuth();
      emitAuthChange();
      openAuthModal('signin', { required: true });
    }
  });

  document.querySelector('[data-auth-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = form.closest('[data-auth-modal]').dataset.mode;
    const modal = form.closest('[data-auth-modal]');
    const status = form.querySelector('[data-auth-status]');
    const submit = form.querySelector('.auth-submit');
    const payload = Object.fromEntries(new FormData(form).entries());
    status.textContent = '';
    status.classList.remove('is-success');
    submit.disabled = true;
    const resetRequest = mode === 'password-reset-request';
    const passwordChange = mode === 'password-change';
    if (resetRequest) setAuthProcessing(modal, true);
    try {
      const endpoint = resetRequest
        ? '/api/auth/password-reset/request'
        : (passwordChange ? '/api/auth/change-password' : `/api/auth/${mode}`);
      const requestBody = passwordChange
        ? { current_password: payload.password, new_password: payload.new_password, new_password_confirmation: payload.new_password_confirmation }
        : payload;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '처리하지 못했습니다.');
      if (resetRequest) {
        status.textContent = data.message || '가입된 이메일이 있으면 새 비밀번호를 이메일로 발송했습니다. 이메일을 확인해 주세요.';
        status.classList.add('is-success');
        return;
      }
      if (passwordChange) {
        currentUser = data.user || currentUser;
        renderAuth();
        emitAuthChange();
        form.reset();
        status.textContent = data.message || '비밀번호가 변경되었습니다.';
        status.classList.add('is-success');
        return;
      }
      currentUser = data.user;
      renderAuth();
      emitAuthChange();
      form.reset();
      closeAuthModal(currentUser);
      postAuthActivity();
      startActivityTracking();
      if (currentUser?.password_is_temporary) {
        window.setTimeout(() => openAuthModal('password-change'), 300);
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      if (resetRequest) setAuthProcessing(modal, false);
      submit.disabled = false;
    }
  });

  document.addEventListener('keydown', (event) => {
    const modal = document.querySelector('[data-auth-modal]');
    if (event.key === 'Escape' && !modal.hidden && modal.dataset.required !== 'true') closeAuthModal();
  });
  authReady = loadCurrentUser();
  return authReady;
}
