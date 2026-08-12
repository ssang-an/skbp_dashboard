let currentUser = null;
let authReady = null;
let pendingAuthResolve = null;

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
        <label><span>이메일</span><input name="email" type="email" maxlength="254" autocomplete="email" placeholder="name@company.com" required /></label>
        <label><span>비밀번호</span><input name="password" type="password" minlength="4" maxlength="200" autocomplete="current-password" placeholder="4자 이상" required /></label>
        <p class="auth-form-status" data-auth-status role="status" aria-live="polite"></p>
        <button class="auth-submit" type="submit">로그인</button>
      </form>
      <button class="auth-mode-switch" type="button" data-auth-mode-switch>처음이신가요? <b>간단 회원가입</b></button>
    </section>
  </div>`;
}

function emitAuthChange() {
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
}

function setMode(mode) {
  const signup = mode === 'signup';
  const modal = document.querySelector('[data-auth-modal]');
  modal.dataset.mode = mode;
  modal.querySelector('#authModalTitle').textContent = signup ? '간단 회원가입' : '로그인';
  modal.querySelector('[data-auth-copy]').textContent = signup
    ? '이름, 이메일, 비밀번호만 입력하면 바로 시작할 수 있습니다.'
    : 'SKBP Pipeline Finder를 사용하려면 로그인해주세요.';
  modal.querySelector('[data-auth-name-field]').hidden = !signup;
  modal.querySelector('input[name="name"]').required = signup;
  modal.querySelector('input[name="password"]').autocomplete = signup ? 'new-password' : 'current-password';
  modal.querySelector('.auth-submit').textContent = signup ? '가입하고 시작하기' : '로그인';
  modal.querySelector('[data-auth-mode-switch]').innerHTML = signup ? '이미 계정이 있나요? <b>로그인</b>' : '처음이신가요? <b>간단 회원가입</b>';
  modal.querySelector('[data-auth-status]').textContent = '';
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
  modal.querySelector(mode === 'signup' ? 'input[name="name"]' : 'input[name="email"]')?.focus();
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
      fetch('/api/auth/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `${location.pathname}${location.search}` }),
      }).catch(() => {});
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
    const status = form.querySelector('[data-auth-status]');
    const submit = form.querySelector('.auth-submit');
    const payload = Object.fromEntries(new FormData(form).entries());
    status.textContent = '';
    submit.disabled = true;
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '처리하지 못했습니다.');
      currentUser = data.user;
      renderAuth();
      emitAuthChange();
      form.reset();
      closeAuthModal(currentUser);
      fetch('/api/auth/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `${location.pathname}${location.search}` }) }).catch(() => {});
    } catch (error) {
      status.textContent = error.message;
    } finally {
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
