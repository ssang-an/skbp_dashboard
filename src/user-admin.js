import { initAuthUI } from './auth.js?v=20260823-active-time-1';
import { setupThemeToggle } from './theme.js';

const state = { users: [], summary: {}, query: '', sortKey: 'created_at', sortDirection: -1, selectedId: null };
const eventLabels = {
  signup: '회원가입', signin: '로그인', signout: '로그아웃', page_view: '페이지 접속',
  account_activated: '계정 활성화', account_deactivated: '계정 비활성화', role_changed: '권한 변경',
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';
const formatDuration = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return value ? `${Math.floor(value)}초` : '-';
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;
};

const numericSortKeys = new Set(['activity_count', 'active_session_count', 'active_seconds_30d', 'active_seconds_total']);
const formatChartDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

function filteredUsers() {
  const query = state.query.trim().toLowerCase();
  const users = query ? state.users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query)) : [...state.users];
  return users.sort((left, right) => {
    const a = left[state.sortKey] ?? '';
    const b = right[state.sortKey] ?? '';
    if (numericSortKeys.has(state.sortKey)) return (Number(a) - Number(b)) * state.sortDirection;
    return String(a).localeCompare(String(b), 'ko', { numeric: true }) * state.sortDirection;
  });
}

function renderSummary() {
  const today = new Date().toLocaleDateString('en-CA');
  document.querySelector('#adminTotalUsers').textContent = state.users.length;
  document.querySelector('#adminActiveUsers').textContent = state.users.filter((user) => user.active).length;
  document.querySelector('#adminActiveSessions').textContent = state.users.reduce((sum, user) => sum + user.active_session_count, 0);
  document.querySelector('#adminTodayUsers').textContent = state.users.filter((user) => user.last_seen_at && new Date(user.last_seen_at).toLocaleDateString('en-CA') === today).length;
  document.querySelector('#adminMonthlyActiveUsers').textContent = state.users.filter((user) => Number(user.active_seconds_30d) > 0).length;
  document.querySelector('#adminMonthlyActiveTime').textContent = formatDuration(state.users.reduce((sum, user) => sum + (Number(user.active_seconds_30d) || 0), 0));
}

function renderMiniChart(element, values, valueKey, label, maxBars = 100, unit = '명') {
  const chartValues = values.length > maxBars ? values.filter((_, index) => index % Math.ceil(values.length / maxBars) === 0 || index === values.length - 1) : values;
  const max = Math.max(...chartValues.map((item) => Number(item[valueKey]) || 0), 1);
  const labelIndexes = new Set([0, Math.floor((chartValues.length - 1) / 2), chartValues.length - 1]);
  element.style.setProperty('--bar-count', chartValues.length);
  element.innerHTML = chartValues.map((item, index) => {
    const value = Number(item[valueKey]) || 0;
    const height = Math.max(2, Math.round((value / max) * 100));
    const showLabel = labelIndexes.has(index);
    return `<div class="admin-mini-chart-bar" title="${escapeHtml(`${formatChartDate(item.date)} · ${label} ${valueKey === 'active_seconds' ? formatDuration(value) : `${value}${unit}`}`)}"><i style="--bar-height:${height}%"></i>${showLabel ? `<span>${formatChartDate(item.date)}</span>` : ''}</div>`;
  }).join('');
}

function groupChartValues(values, valueKey, bucketSize = 7) {
  const groups = [];
  for (let index = 0; index < values.length; index += bucketSize) {
    const bucket = values.slice(index, index + bucketSize);
    groups.push({
      date: bucket.at(-1)?.date,
      [valueKey]: bucket.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0),
    });
  }
  return groups;
}

function renderExecutiveSummary() {
  const summary = state.summary || {};
  const activityDays = Array.isArray(summary.activity_days) ? summary.activity_days : [];
  const signupDays = Array.isArray(summary.signup_days) ? summary.signup_days : [];
  const activityWeeks = groupChartValues(activityDays, 'active_seconds');
  const signupWeeks = groupChartValues(signupDays, 'count');
  const activeTotal = activityDays.reduce((sum, item) => sum + (Number(item.active_seconds) || 0), 0);
  const signupTotal = signupDays.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const pipelineTrend = Array.isArray(summary.pipeline_registration_trend) ? summary.pipeline_registration_trend : [];
  const pipelineTotal = pipelineTrend.at(-1)?.cumulative_count || 0;
  const pipelineStart = summary.pipeline_registration_start_date;
  const granularity = summary.pipeline_registration_granularity || '일';
  document.querySelector('#adminActiveChartTotal').textContent = formatDuration(activeTotal);
  document.querySelector('#adminSignupChartTotal').textContent = `${signupTotal}명`;
  document.querySelector('#adminPipelineChartTotal').textContent = `${pipelineTotal}건`;
  document.querySelector('#adminPipelineChartRange').textContent = pipelineStart ? `${formatChartDate(pipelineStart)} ~ 오늘 · ${granularity} 단위 누적` : '등록 이력이 없습니다.';
  document.querySelector('#adminExecutiveUpdated').textContent = '활성·가입: 최근 100일';
  renderMiniChart(document.querySelector('#adminActiveTimeChart'), activityWeeks, 'active_seconds', '주간 활성 시간');
  renderMiniChart(document.querySelector('#adminSignupChart'), signupWeeks, 'count', '주간 신규 가입');
  renderMiniChart(document.querySelector('#adminPipelineChart'), pipelineTrend, 'cumulative_count', '누적 분석 리포트', 100, '건');
}

function renderUsers() {
  const users = filteredUsers();
  const body = document.querySelector('#adminUsersBody');
  body.innerHTML = users.length ? users.map((user) => `
    <tr data-user-id="${escapeHtml(user.id)}" class="${user.id === state.selectedId ? 'is-selected' : ''}" tabindex="0">
      <td><strong>${escapeHtml(user.name)}</strong></td>
      <td>${escapeHtml(user.email)}</td>
      <td><select class="admin-role-select" data-user-role="${escapeHtml(user.id)}"><option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option><option value="developer" ${user.role === 'developer' ? 'selected' : ''}>Developer</option></select></td>
      <td><span class="admin-state ${user.active ? 'is-active' : 'is-inactive'}">${user.active ? '활성' : '비활성'}</span></td>
      <td>${formatDate(user.created_at)}</td><td>${formatDate(user.last_login_at)}</td><td>${formatDate(user.last_seen_at)}</td>
      <td>${user.activity_count}</td>
      <td>${formatDuration(user.active_seconds_30d)}</td>
      <td><button class="admin-account-toggle secondary-button" type="button" data-user-toggle="${escapeHtml(user.id)}" data-next-active="${!user.active}" ${user.is_admin ? 'disabled title="관리자 계정은 비활성화할 수 없습니다."' : ''}>${user.active ? '비활성화' : '활성화'}</button></td>
    </tr>`).join('') : '<tr><td colspan="10" class="admin-empty">조건에 맞는 사용자가 없습니다.</td></tr>';
}

function renderActivity(user) {
  state.selectedId = user?.id || null;
  document.querySelector('#adminActivityTitle').textContent = user ? `${user.name} · ${user.email}` : '사용자를 선택해주세요';
  const activities = [...(user?.activity_log || [])].reverse();
  document.querySelector('#adminActivityCount').textContent = user ? `이벤트 ${activities.length}건 · 30일 활성 ${formatDuration(user.active_seconds_30d)}` : '';
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
    state.summary = data.summary || {};
    renderSummary(); renderExecutiveSummary(); renderUsers();
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

async function updateRole(select) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(select.dataset.userRole)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: select.value }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '권한을 변경하지 못했습니다.');
  await loadUsers();
}

function exportCsv() {
  const header = ['이름', '이메일', '권한', '계정 상태', '가입일', '최근 로그인', '최근 접속', '이벤트 수', '30일 활성 시간(초)', '누적 활성 시간(초)', '유효 세션'];
  const rows = filteredUsers().map((user) => [user.name, user.email, user.is_admin ? '관리자' : '사용자', user.active ? '활성' : '비활성', user.created_at, user.last_login_at, user.last_seen_at, user.activity_count, user.active_seconds_30d || 0, user.active_seconds_total || 0, user.active_session_count]);
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
document.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-user-role]');
  if (!select) return;
  select.disabled = true;
  try { await updateRole(select); } catch (error) { document.querySelector('#adminStatus').textContent = error.message; select.disabled = false; }
});
document.addEventListener('keydown', (event) => { const row = event.target.closest('[data-user-id]'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); renderActivity(state.users.find((user) => user.id === row.dataset.userId)); } });
document.querySelector('#adminUserSearch').addEventListener('input', (event) => { state.query = event.target.value; renderUsers(); });
document.querySelector('#adminRefresh').addEventListener('click', loadUsers);
document.querySelector('#adminCsvExport').addEventListener('click', exportCsv);

setupThemeToggle();
await initAuthUI();
await loadUsers();
