import { initAuthUI } from './auth.js?v=20260802-required-login-1';
import { setupThemeToggle } from './theme.js';

const state = { users: [], query: '', sortKey: 'created_at', sortDirection: -1, selectedId: null };
const eventLabels = {
  signup: '회원가입', signin: '로그인', signout: '로그아웃', page_view: '페이지 접속',
  account_activated: '계정 활성화', account_deactivated: '계정 비활성화',
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';

function filteredUsers() {
  const query = state.query.trim().toLowerCase();
  const users = query ? state.users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query)) : [...state.users];
  return users.sort((left, right) => {
    const a = left[state.sortKey] ?? '';
    const b = right[state.sortKey] ?? '';
    return String(a).localeCompare(String(b), 'ko', { numeric: true }) * state.sortDirection;
  });
}

function renderSummary() {
  const today = new Date().toLocaleDateString('en-CA');
  document.querySelector('#adminTotalUsers').textContent = state.users.length;
  document.querySelector('#adminActiveUsers').textContent = state.users.filter((user) => user.active).length;
  document.querySelector('#adminActiveSessions').textContent = state.users.reduce((sum, user) => sum + user.active_session_count, 0);
  document.querySelector('#adminTodayUsers').textContent = state.users.filter((user) => user.last_seen_at && new Date(user.last_seen_at).toLocaleDateString('en-CA') === today).length;
}

function renderUsers() {
  const users = filteredUsers();
  const body = document.querySelector('#adminUsersBody');
  body.innerHTML = users.length ? users.map((user) => `
    <tr data-user-id="${escapeHtml(user.id)}" class="${user.id === state.selectedId ? 'is-selected' : ''}" tabindex="0">
      <td><strong>${escapeHtml(user.name)}</strong>${user.is_admin ? '<small class="admin-role">관리자</small>' : ''}</td>
      <td>${escapeHtml(user.email)}</td>
      <td><span class="admin-state ${user.active ? 'is-active' : 'is-inactive'}">${user.active ? '활성' : '비활성'}</span></td>
      <td>${formatDate(user.created_at)}</td><td>${formatDate(user.last_login_at)}</td><td>${formatDate(user.last_seen_at)}</td>
      <td>${user.activity_count}</td>
      <td><button class="admin-account-toggle secondary-button" type="button" data-user-toggle="${escapeHtml(user.id)}" data-next-active="${!user.active}" ${user.is_admin ? 'disabled title="관리자 계정은 비활성화할 수 없습니다."' : ''}>${user.active ? '비활성화' : '활성화'}</button></td>
    </tr>`).join('') : '<tr><td colspan="8" class="admin-empty">조건에 맞는 사용자가 없습니다.</td></tr>';
}

function renderActivity(user) {
  state.selectedId = user?.id || null;
  document.querySelector('#adminActivityTitle').textContent = user ? `${user.name} · ${user.email}` : '사용자를 선택해주세요';
  const activities = [...(user?.activity_log || [])].reverse();
  document.querySelector('#adminActivityCount').textContent = user ? `총 ${activities.length}건` : '';
  document.querySelector('#adminActivityBody').innerHTML = activities.length ? activities.map((item) => `<tr>
    <td>${formatDate(item.at)}</td><td>${escapeHtml(eventLabels[item.event] || item.event)}</td><td>${escapeHtml(item.path || '-')}</td><td>${escapeHtml(item.actor_ip || '-')}</td>
  </tr>`).join('') : '<tr><td colspan="4" class="admin-empty">저장된 활동 이력이 없습니다.</td></tr>';
  renderUsers();
}

async function loadUsers() {
  const status = document.querySelector('#adminStatus');
  status.textContent = '불러오는 중…';
  try {
    const response = await fetch('/api/admin/users');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '사용자 목록을 불러오지 못했습니다.');
    state.users = data.users || [];
    renderSummary(); renderUsers();
    if (state.selectedId) renderActivity(state.users.find((user) => user.id === state.selectedId));
    status.textContent = `마지막 갱신 ${new Date().toLocaleTimeString('ko-KR')}`;
  } catch (error) { status.textContent = error.message; }
}

async function toggleUser(button) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(button.dataset.userToggle)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: button.dataset.nextActive === 'true' }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '계정 상태를 변경하지 못했습니다.');
  await loadUsers();
}

function exportCsv() {
  const header = ['이름', '이메일', '권한', '상태', '가입일', '최근 로그인', '최근 접속', '활동 수', '활성 세션'];
  const rows = filteredUsers().map((user) => [user.name, user.email, user.is_admin ? '관리자' : '사용자', user.active ? '활성' : '비활성', user.created_at, user.last_login_at, user.last_seen_at, user.activity_count, user.active_session_count]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  link.download = `skbp-users-${new Date().toLocaleDateString('en-CA')}.csv`;
  link.click(); URL.revokeObjectURL(link.href);
}

document.addEventListener('click', async (event) => {
  const toggle = event.target.closest('[data-user-toggle]');
  if (toggle) { event.stopPropagation(); toggle.disabled = true; try { await toggleUser(toggle); } catch (error) { document.querySelector('#adminStatus').textContent = error.message; toggle.disabled = false; } return; }
  const row = event.target.closest('[data-user-id]');
  if (row) renderActivity(state.users.find((user) => user.id === row.dataset.userId));
  const sort = event.target.closest('[data-admin-sort]');
  if (sort) { const key = sort.dataset.adminSort; state.sortDirection = state.sortKey === key ? -state.sortDirection : 1; state.sortKey = key; renderUsers(); }
});
document.addEventListener('keydown', (event) => { const row = event.target.closest('[data-user-id]'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); renderActivity(state.users.find((user) => user.id === row.dataset.userId)); } });
document.querySelector('#adminUserSearch').addEventListener('input', (event) => { state.query = event.target.value; renderUsers(); });
document.querySelector('#adminRefresh').addEventListener('click', loadUsers);
document.querySelector('#adminCsvExport').addEventListener('click', exportCsv);

setupThemeToggle();
await initAuthUI();
await loadUsers();
