import { setupThemeToggle } from './theme.js';

import { initPageJumpControls } from './page-jump.js?v=20260823-page-jump-1';
import { getCurrentUser, initAuthUI, requireAuth } from './auth.js?v=20260831-password-reset-2';
import { ENGLISH_CRITERIA_DRAWER_CHROME, englishCriteriaGuideMarkup } from './criteria-guide-i18n.js?v=20260904-triage-v3-7-1';

const params = new URLSearchParams(window.location.search);
const recordId = params.get('id');
let currentRecord = null;
const RUBRIC_REFRESH_OUTCOME_DURATION_MS = 3000;

function encodeRecordIdForPath(recordId) {
  return encodeURIComponent(String(recordId ?? ''))
    .replace(/%2F/gi, '%252F')
    .replace(/%5C/gi, '%255C');
}

const elements = {
  title: document.querySelector('#triageDetailTitle'),
  subtitle: document.querySelector('#triageDetailSubtitle'),
  loadStatus: document.querySelector('#triageDetailLoadStatus'),
  decisionHero: document.querySelector('#triageDecisionHero'),
  identityGrid: document.querySelector('#triageIdentityGrid'),
  scoreGrid: document.querySelector('#triageScoreGrid'),
  scoreTotal: document.querySelector('#triageScoreTotal'),
  sourceList: document.querySelector('#triageSourceList'),
  diligence: document.querySelector('#triageDiligence'),
  quickSummary: document.querySelector('#triageQuickSummary'),
  rawReport: document.querySelector('#triageRawReport'),
  criteriaDrawerButton: document.querySelector('#triageCriteriaDrawerButton'),
  criteriaDrawer: document.querySelector('#triageCriteriaDrawer'),
  criteriaBackdrop: document.querySelector('#triageCriteriaBackdrop'),
  criteriaDrawerClose: document.querySelector('#triageCriteriaDrawerClose'),
  criteriaDrawerBody: document.querySelector('#triageCriteriaDrawerBody'),
  criteriaDrawerTitle: document.querySelector('#triageCriteriaDrawerTitle'),
  criteriaDrawerSubtitle: document.querySelector('#triageCriteriaDrawerSubtitle'),
  criteriaLanguageToggle: document.querySelector('#triageCriteriaLanguageToggle'),
  deleteRecordButton: document.querySelector('#triageDeleteRecordButton'),
  websiteButton: document.querySelector('#triageWebsiteButton'),
  pipelineWebsiteModal: document.querySelector('#pipelineWebsiteModal'),
  pipelineWebsiteInput: document.querySelector('#pipelineWebsiteInput'),
  pipelineWebsiteStatus: document.querySelector('#pipelineWebsiteStatus'),
  pipelineWebsiteCancel: document.querySelector('#pipelineWebsiteCancel'),
  pipelineWebsiteSave: document.querySelector('#pipelineWebsiteSave')
};

const scoreDefinitions = [
  {
    key: 'target_relevance',
    shortLabel: 'TAR',
    label: 'Target Area Relevance',
    description: 'SKBP 우선 관심 적응증 및 해당 질환 biology와의 적합성'
  },
  {
    key: 'moa_validity',
    shortLabel: 'MoA',
    label: 'MoA Validity',
    description: '작용기전의 구체성과 기능적·과학적 검증 수준'
  },
  {
    key: 'data_maturity',
    shortLabel: 'Data',
    label: 'Data Maturity',
    description: '개발 단계에 맞는 공개 데이터의 충분성과 해석 가능성'
  }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function repairMojibake(value) {
  const text = String(value ?? '');
  const suspiciousCount = (text.match(/[À-ÿ°µ¿¸»½ÇÈÆ±³´]/g) || []).length;
  if (suspiciousCount < 2) return text;
  const codePoints = [...text].map((character) => character.codePointAt(0));
  if (codePoints.some((point) => point > 255)) return text;

  try {
    const decoded = new TextDecoder('euc-kr').decode(Uint8Array.from(codePoints));
    const originalHangul = (text.match(/[가-힣]/g) || []).length;
    const decodedHangul = (decoded.match(/[가-힣]/g) || []).length;
    const decodedSuspicious = (decoded.match(/[À-ÿ°µ¿¸»½ÇÈÆ±³´]/g) || []).length;
    if (!decoded.includes('�') && decodedHangul > originalHangul && decodedSuspicious < suspiciousCount) {
      return decoded;
    }
  } catch {
    return text;
  }
  return text;
}

function displayValue(value, fallback = 'Unknown') {
  const text = repairMojibake(value).trim();
  return text || fallback;
}

function confirmTriageCommentDelete({ title = '코멘트를 삭제할까요?', message = '삭제한 코멘트는 복구할 수 없습니다.' } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'operation-modal-backdrop operation-confirm-backdrop';
    backdrop.innerHTML = `
      <section class="operation-modal operation-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="triageCommentConfirmTitle">
        <header class="operation-modal-header">
          <span class="operation-modal-mark operation-confirm-mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6.5 7l.7 13h9.6l.7-13" /></svg></span>
          <div><p class="operation-modal-eyebrow">CONFIRM</p><h2 id="triageCommentConfirmTitle">${escapeHtml(title)}</h2></div>
        </header>
        <p class="operation-modal-copy">${escapeHtml(message)}</p>
        <footer class="operation-modal-actions operation-confirm-actions"><button type="button" class="operation-modal-cancel" data-confirm-cancel>취소</button><button type="button" class="operation-modal-confirm" data-confirm-accept>삭제</button></footer>
      </section>`;
    const finish = (confirmed) => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      document.body.classList.remove('operation-modal-open');
      resolve(confirmed);
    };
    const onKeydown = (event) => { if (event.key === 'Escape') finish(false); };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) finish(false); });
    backdrop.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => finish(false));
    backdrop.querySelector('[data-confirm-accept]')?.addEventListener('click', () => finish(true));
    document.body.appendChild(backdrop);
    document.body.classList.add('operation-modal-open');
    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('[data-confirm-accept]')?.focus();
  });
}

function showTriageProgress(title = '잠시만 기다려 주세요', message = '변경사항을 저장하고 있습니다.') {
  const backdrop = document.createElement('div');
  backdrop.className = 'operation-modal-backdrop';
  backdrop.innerHTML = `<section class="operation-modal" role="status" aria-live="assertive"><header class="operation-modal-header"><span class="operation-modal-mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 3v3m0 12v3M4.2 5.2l2.1 2.1m11.4 11.4 2.1 2.1M3 12h3m12 0h3M4.2 18.8l2.1-2.1M17.7 7.3l2.1-2.1"/></svg></span><div><p class="operation-modal-eyebrow">PROCESSING</p><h2>${escapeHtml(title)}</h2></div></header><p class="operation-modal-copy">${escapeHtml(message)}</p></section>`;
  document.body.appendChild(backdrop);
  document.body.classList.add('operation-modal-open');
  return () => { backdrop.remove(); document.body.classList.remove('operation-modal-open'); };
}

function showTriageActionFailureDialog(title, message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'operation-modal-backdrop listing-import-error-backdrop';
    backdrop.innerHTML = `
      <section class="operation-modal listing-import-error-modal" role="dialog" aria-modal="true" aria-labelledby="triageActionFailureTitle" aria-describedby="triageActionFailureMessage">
        <header class="operation-modal-header">
          <span class="operation-modal-mark listing-import-error-mark" aria-hidden="true">!</span>
          <div><p class="operation-modal-eyebrow">SCORE REFRESH</p><h2 id="triageActionFailureTitle">${escapeHtml(title)}</h2></div>
        </header>
        <p class="operation-modal-copy" id="triageActionFailureMessage">${escapeHtml(message)}</p>
        <footer class="operation-modal-actions operation-confirm-actions">
          <button type="button" class="operation-modal-confirm" data-triage-action-failure-close>확인</button>
        </footer>
      </section>`;
    const close = () => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      document.body.classList.remove('operation-modal-open');
      resolve();
    };
    const onKeydown = (event) => { if (event.key === 'Escape') close(); };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    backdrop.querySelector('[data-triage-action-failure-close]')?.addEventListener('click', close);
    document.body.appendChild(backdrop);
    document.body.classList.add('operation-modal-open');
    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('[data-triage-action-failure-close]')?.focus();
  });
}

function showTriageActionOutcomeToast(title, message, eyebrow = 'FILTER 1') {
  document.querySelector('#rubricRefreshOutcomeToast')?.remove();
  const toast = document.createElement('section');
  toast.id = 'rubricRefreshOutcomeToast';
  toast.className = 'operation-modal rubric-refresh-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <header class="operation-modal-header">
      <span class="operation-modal-mark rubric-refresh-success-mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m5 12 4.2 4.2L19 6.5" /></svg></span>
      <div><p class="operation-modal-eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2></div>
    </header>
    <p class="operation-modal-copy">${escapeHtml(message)}</p>`;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), RUBRIC_REFRESH_OUTCOME_DURATION_MS);
}

function triageRubricRefreshOutcomeCopy(data, latestVersion) {
  const appliedVersion = data.rubric_version || latestVersion;
  const cleared = Array.isArray(data.cleared_manual_scoring_override_fields)
    ? data.cleared_manual_scoring_override_fields
    : [];
  if (data.status === 'updated') {
    return {
      title: 'Filter 1 AI 재평가 완료',
      message: `Simple Research v${appliedVersion} 기준으로 GPT 원문 리포트와 첨부 자료를 다시 평가했습니다. criterion 점수, Total Score, Filter 1 결과를 갱신했고 변경 이력에 기록했습니다.`
    };
  }
  if (['no_evidence', 'no_score_changes'].includes(data.status)) {
    return {
      title: 'Filter 1 AI 재평가 완료 · 점수 유지',
      message: `Simple Research v${appliedVersion} 기준으로 GPT 원문 리포트와 첨부 자료를 검토했습니다. 변경을 뒷받침할 근거가 없어 기존 criterion 점수와 Filter 1 결과를 유지했고 변경 이력에 기록했습니다.`
    };
  }
  if (data.status === 'recalculated') {
    return {
      title: 'Filter 1 재계산 완료',
      message: `Simple Research v${appliedVersion} 기준을 적용했습니다. 저장된 criterion 점수는 유지하고 Total Score와 Filter 1 결과를 다시 계산했으며, 변경 이력에 기록했습니다.`
    };
  }
  const resetItems = [
    cleared.includes('scores') ? '수동 기준별 점수' : '',
    cleared.includes('total_score') ? '수동 Total Score' : ''
  ].filter(Boolean).join(' 및 ') || '수동 점수 설정';
  if (cleared.length && data.official_recalculation_applied === true) {
    return {
      title: '최신 Score 기준 갱신 완료',
      message: `Simple Research v${appliedVersion} 기준을 적용했습니다. ${resetItems} 오버라이드를 해제하고 저장된 GPT 공식 점수로 다시 계산했습니다. 변경 이력에 기록했습니다.`
    };
  }
  if (data.status === 'manual_override_reset' || cleared.length) {
    return {
      title: '수동 점수 오버라이드 해제 완료',
      message: `Simple Research v${appliedVersion}은 이미 적용되어 있어 ${resetItems}만 해제했습니다. 저장된 GPT 공식 점수로 복원했고, 변경 이력에 기록했습니다.`
    };
  }
  if (data.status === 'already_current' || data.changed === false) {
    return {
      title: '이미 최신 Simple Research 기준입니다',
      message: `Simple Research v${appliedVersion} 기준과 현재 점수·결과가 이미 적용되어 있습니다. 변경 사항이 없어 변경 이력은 추가하지 않았습니다.`
    };
  }
  return {
    title: 'Score 기준 갱신 완료',
    message: `Simple Research v${appliedVersion} 기준 갱신을 완료했고, 변경 이력에 기록했습니다.`
  };
}

function textValue(value, fallback = '') {
  if (!['string', 'number', 'boolean'].includes(typeof value)) return fallback;
  return displayValue(value, fallback);
}

function firstTextValue(values, fallback = '') {
  for (const value of values) {
    const text = textValue(value, '');
    if (text) return text;
  }
  return fallback;
}

function dashboardThemeLabel(value) {
  const text = displayValue(value);
  if (/^(unknown|not known|n\/?a)$/i.test(text)) return 'Unknown';
  if (/e\s*\/\s*i\s*balance|excitation.*inhibition/i.test(text)) return 'E/I Balance';
  if (/neuro[\s-]*immune/i.test(text)) return 'Neuroimmune';
  return 'Others';
}

function dashboardClusterLabel(value, theme = '') {
  const text = displayValue(value);
  if (/^(unknown|not known)$/i.test(text)) return 'Unknown';
  if (/^n\/?a$/i.test(text)) return dashboardThemeLabel(theme) === 'Others' ? 'Others' : 'Unknown';
  if (/^others?$|no cluster|no mapped|no fit|out of scope|none/i.test(text)) return 'Others';
  return text;
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function commentByline(breadcrumb, author, dateText) {
  const identity = [breadcrumb, author || 'Team member'].filter(Boolean).join(' · ');
  return dateText ? `${identity} · ${dateText}` : identity;
}

function currentUserOwnsOperationalComment(comment) {
  const user = getCurrentUser();
  const sameId = user?.id && comment?.author_user_id && String(user.id) === String(comment.author_user_id);
  const sameEmail = user?.email && comment?.author_email
    && String(user.email).trim().toLowerCase() === String(comment.author_email).trim().toLowerCase();
  return Boolean(sameId || sameEmail);
}

function displayOperationalAuthor(value, fallback = 'Team') {
  const author = textValue(value, fallback);
  return ['team review', 'tab 0 team review'].includes(author.trim().toLowerCase()) ? 'Team' : author;
}

function listingCommentDisplay(record, entry) {
  const metadata = objectValue(objectValue(record?.meta).pipeline_metadata);
  const isBulk = String(metadata.comment_source || '') === 'team_review_import';
  return {
    breadcrumb: isBulk ? '일괄 업로드: Tab 0 · Comment' : 'Tab 0 · Comment',
    author: isBulk ? 'Team' : displayOperationalAuthor(metadata.comment_author || entry.author),
    timestamp: textValue(metadata.comment_updated_at, textValue(metadata.comment_created_at, textValue(entry.created_at, '')))
  };
}

function isListingContactSource(entry) {
  const source = String(entry?.source || '');
  return source === 'listing_contact_history' || source === 'listing_contact_post';
}

function contactHistoryDisplay(record, entry) {
  if (!isListingContactSource(entry)) {
    return { breadcrumb: 'Tab 1 · Fast Triage · Contact History', author: entry.author, timestamp: entry.updated_at || entry.created_at };
  }
  const metadata = objectValue(objectValue(record?.meta).pipeline_metadata);
  const isBulk = String(metadata.contact_source || '') === 'team_review_import';
  return {
    breadcrumb: isBulk ? '일괄 업로드: Tab 0 · Contact History' : 'Tab 0 · Contact History',
    author: isBulk ? 'Team' : displayOperationalAuthor(metadata.contact_author || entry.author),
    timestamp: textValue(metadata.contact_updated_at, textValue(metadata.contact_created_at, textValue(entry.created_at, '')))
  };
}

function openListingSourceManagement(field) {
  const label = field === 'contact' ? 'Contact History' : 'Comment';
  const backdrop = document.createElement('div');
  backdrop.className = 'operation-modal-backdrop operation-confirm-backdrop';
  backdrop.innerHTML = `
    <section class="operation-modal operation-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="listingSourceManageTitle">
      <header class="operation-modal-header">
        <span class="operation-modal-mark operation-confirm-mark" aria-hidden="true">i</span>
        <div><p class="operation-modal-eyebrow">TAB 0 ORIGINAL</p><h2 id="listingSourceManageTitle">Tab 0 원본에서 관리합니다</h2></div>
      </header>
      <p class="operation-modal-copy">이 ${label}는 Tab 0에서 작성되어 동기화된 내용입니다. 이곳에서는 수정할 수 없으며, Tab 0 원본을 수정하거나 삭제하면 기준 Workspace에도 반영됩니다.</p>
      <footer class="operation-modal-actions operation-confirm-actions"><button type="button" class="operation-modal-cancel" data-listing-source-cancel>닫기</button><button type="button" class="operation-modal-confirm" data-listing-source-go>Tab 0에서 열기</button></footer>
    </section>`;
  const close = () => {
    backdrop.remove();
    document.body.classList.remove('operation-modal-open');
  };
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  backdrop.querySelector('[data-listing-source-cancel]')?.addEventListener('click', close);
  backdrop.querySelector('[data-listing-source-go]')?.addEventListener('click', () => {
    try {
      sessionStorage.setItem('skbp.step0.metadata-target.v1', JSON.stringify({ recordId, field }));
    } catch (_) {}
    window.location.assign('/?tab=step0');
  });
  document.body.appendChild(backdrop);
  document.body.classList.add('operation-modal-open');
  backdrop.querySelector('[data-listing-source-go]')?.focus();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function listValues(value) {
  const items = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ''
      ? []
      : [value];
  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return displayValue(item, '');
      return displayValue(
        item.fact || item.summary || item.text || item.message || item.reason || item.title || item.name,
        ''
      );
    })
    .filter(Boolean);
}

function safeHttpUrl(value) {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) ? text : '';
}

function hostnameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

function pipelineWebsite(record) {
  return safeHttpUrl(objectValue(objectValue(record?.meta).pipeline_metadata).website);
}

function renderPipelineWebsiteAction(record) {
  const button = elements.websiteButton;
  if (!button) return;
  const url = pipelineWebsite(record);
  button.hidden = !url;
  button.dataset.websiteUrl = url;
  button.title = url
    ? `Pipeline Website: ${url}\n한 번 클릭하여 열기 · 두 번 클릭하여 주소 수정`
    : 'Pipeline Website가 등록되지 않았습니다.';
}

let websiteOpenTimer = null;

function closePipelineWebsiteModal() {
  if (elements.pipelineWebsiteModal) elements.pipelineWebsiteModal.hidden = true;
  if (elements.pipelineWebsiteStatus) elements.pipelineWebsiteStatus.textContent = '';
}

function openPipelineWebsiteModal() {
  if (!currentRecord || !recordId || !currentUserIsAdmin()) return;
  if (websiteOpenTimer) window.clearTimeout(websiteOpenTimer);
  websiteOpenTimer = null;
  if (elements.pipelineWebsiteInput) elements.pipelineWebsiteInput.value = pipelineWebsite(currentRecord);
  if (elements.pipelineWebsiteStatus) elements.pipelineWebsiteStatus.textContent = '';
  if (elements.pipelineWebsiteModal) elements.pipelineWebsiteModal.hidden = false;
  elements.pipelineWebsiteInput?.focus();
  elements.pipelineWebsiteInput?.select();
}

async function savePipelineWebsite() {
  if (!currentRecord || !recordId || !currentUserIsAdmin()) return;
  const value = String(elements.pipelineWebsiteInput?.value || '').trim();
  if (value && !safeHttpUrl(value)) {
    if (elements.pipelineWebsiteStatus) elements.pipelineWebsiteStatus.textContent = 'http:// 또는 https:// 주소를 입력해 주세요.';
    return;
  }
  if (elements.pipelineWebsiteSave) elements.pipelineWebsiteSave.disabled = true;
  if (elements.pipelineWebsiteStatus) elements.pipelineWebsiteStatus.textContent = '저장 중…';
  try {
    const response = await fetch('/api/candidate-queue/metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_type: 'record', record_id: recordId, field: 'website', value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Website를 저장하지 못했습니다.');
    currentRecord.meta = currentRecord.meta || {};
    currentRecord.meta.pipeline_metadata = { ...(currentRecord.meta.pipeline_metadata || {}), ...(data.metadata || {}), website: data.metadata?.website || value };
    renderPipelineWebsiteAction(currentRecord);
    closePipelineWebsiteModal();
  } catch (error) {
    if (elements.pipelineWebsiteStatus) elements.pipelineWebsiteStatus.textContent = error.message;
  } finally {
    if (elements.pipelineWebsiteSave) elements.pipelineWebsiteSave.disabled = false;
  }
}

function normalizeMarkdownSourceUrl(value) {
  let text = String(value || '').trim().replace(/^<|>$/g, '');
  text = text.replace(/[.,;:!?]+$/g, '');
  while (text.endsWith(')') && (text.match(/\(/g) || []).length < (text.match(/\)/g) || []).length) {
    text = text.slice(0, -1);
  }
  while (text.endsWith(']') && (text.match(/\[/g) || []).length < (text.match(/\]/g) || []).length) {
    text = text.slice(0, -1);
  }

  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.username || parsed.password) return '';
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || ['localhost', 'localhost.', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(hostname)) return '';
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function markdownAssetVariants(value) {
  const cleaned = repairMojibake(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  return [...new Set([cleaned, ...cleaned.split('/').map((part) => part.trim()).filter(Boolean)])];
}

function recordAssetVariants(record) {
  const table = objectValue(record?.structured_table);
  const summary = objectValue(record?.json_summary);
  const input = objectValue(record?.input);
  return [...new Set([
    table.asset_name,
    summary.asset_name,
    input.asset_input
  ].flatMap(markdownAssetVariants))];
}

function markdownAssetMatches(value, expectedVariants) {
  const actualVariants = markdownAssetVariants(value).flatMap((variant) => [
    variant,
    variant.replace(/^(?:\d+[.)]\s*|asset(?:\s+name)?\s*:\s*)/i, '').trim()
  ]);
  return actualVariants.some((actual) => expectedVariants.some((expected) => (
    actual === expected
      || actual.endsWith(`: ${expected}`)
      || actual.endsWith(` - ${expected}`)
      || actual.startsWith(`${expected} - `)
  )));
}

function markdownTableCells(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|')) return [];
  const body = trimmed.endsWith('|') ? trimmed.slice(1, -1) : trimmed.slice(1);
  return body.split('|').map((cell) => cell.trim());
}

function assetScopedMarkdownFragments(markdown, record) {
  const text = repairMojibake(markdown).replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const expectedVariants = recordAssetVariants(record);
  if (!expectedVariants.length) return [];

  const fragments = [];
  let foundAssetTable = false;
  for (let index = 0; index < lines.length; index += 1) {
    const headings = markdownTableCells(lines[index]);
    const normalizedHeadings = headings.map((heading) => markdownAssetVariants(heading)[0] || '');
    const assetIndex = normalizedHeadings.findIndex((heading) => /^(?:asset|asset name|pipeline|drug)$/.test(heading));
    const sourceIndex = normalizedHeadings.findIndex((heading) => /^(?:source|sources|reference|references)$/.test(heading));
    if (assetIndex < 0 || sourceIndex < 0) continue;
    foundAssetTable = true;

    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const cells = markdownTableCells(lines[rowIndex]);
      if (!cells.length) break;
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))) continue;
      if (cells.length <= Math.max(assetIndex, sourceIndex)) continue;
      if (markdownAssetMatches(cells[assetIndex], expectedVariants)) fragments.push(cells[sourceIndex]);
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    if (!heading || !markdownAssetMatches(heading[2], expectedVariants)) continue;
    const level = heading[1].length;
    let end = index + 1;
    while (end < lines.length) {
      const nextHeading = lines[end].match(/^\s*(#{1,6})\s+/);
      if (nextHeading && nextHeading[1].length <= level) break;
      end += 1;
    }
    fragments.push(lines.slice(index, end).join('\n'));
  }

  if (!fragments.length && !foundAssetTable) {
    const firstHeading = lines.find((line) => /^\s*#{1,2}\s+/.test(line));
    if (firstHeading && markdownAssetMatches(firstHeading.replace(/^\s*#{1,2}\s+/, ''), expectedVariants)) {
      fragments.push(text);
    }
  }
  return [...new Set(fragments.map((fragment) => fragment.trim()).filter(Boolean))];
}

function collectMarkdownSources(markdown, record) {
  const text = repairMojibake(markdown).replace(/\r\n/g, '\n');
  const fragments = assetScopedMarkdownFragments(text, record);
  if (!fragments.length) return [];
  const sources = [];
  const referenceDefinitions = new Map();
  const add = (urlValue, title = '') => {
    const sourceUrl = normalizeMarkdownSourceUrl(urlValue);
    if (!sourceUrl) return;
    const source = {
      source_url: sourceUrl,
      source_type: 'GPT Original Report citation'
    };
    const sourceTitle = String(title || '').trim();
    if (sourceTitle && !/^\d+$/.test(sourceTitle)) source.source_title = sourceTitle;
    sources.push(source);
  };

  const referencePattern = /^\s*\[([^\]\n]+)\]:\s*<?(https?:\/\/[^\s>]+)>?(?:\s+(?:"([^"\n]+)"|'([^'\n]+)'|\(([^)\n]+)\)))?\s*$/gim;
  for (const match of text.matchAll(referencePattern)) {
    referenceDefinitions.set(String(match[1]).trim().toLowerCase(), {
      url: match[2],
      title: match[3] || match[4] || match[5] || match[1]
    });
  }

  const inlinePattern = /\[([^\]\n]+)\]\(\s*<?(https?:\/\/[^\s)>]+)>?(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/gi;
  const referenceUsePattern = /\[([^\]\n]+)\](?!\s*\()/g;
  const bareUrlPattern = /https?:\/\/[^\s<>"'`]+/gi;
  fragments.forEach((fragment) => {
    for (const match of fragment.matchAll(inlinePattern)) add(match[2], match[1]);
    for (const match of fragment.matchAll(referenceUsePattern)) {
      const reference = referenceDefinitions.get(String(match[1]).trim().toLowerCase());
      if (reference) add(reference.url, reference.title);
    }
    for (const match of fragment.matchAll(bareUrlPattern)) add(match[0]);
  });

  const deduplicated = new Map();
  sources.forEach((source) => {
    const key = source.source_url.toLowerCase();
    const existing = deduplicated.get(key);
    deduplicated.set(key, existing ? { ...source, ...existing } : source);
  });
  return [...deduplicated.values()];
}

function renderInlineMarkdown(value) {
  return escapeHtml(repairMojibake(value))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\[(\d+)\](?!\s*\()/g, '<a class="evidence-inline-reference" href="#evidence-reference-$1" title="Evidence [$1] 위치로 이동">[$1]</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

function normalizeGptOriginalReport(value) {
  return String(value || '')
    .replace(/[ \t]*:contentReference\[[^\]\r\n]*\]\{[^}\r\n]*\}/gi, '')
    .replace(/[ \t]*\[?oaicite:[^\]\s}]+\]?/gi, '')
    .replace(/(?:<|&lt;)\s*br\s*\/?\s*(?:>|&gt;)/gi, '\n');
}

function renderMarkdownTable(lines, startIndex) {
  const tableLines = [];
  let index = startIndex;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    tableLines.push(lines[index].trim());
    index += 1;
  }
  const rows = tableLines
    .filter((line) => !/^\|\s*:?-{3,}/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  if (!rows.length) return { html: '', nextIndex: index };
  const [head, ...body] = rows;
  return {
    html: `
      <div class="obsidian-table-wrap">
        <table class="obsidian-table">
          <thead><tr>${head.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('')}</tr></thead>
          <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `,
    nextIndex: index
  };
}

function renderMarkdown(markdown) {
  const lines = repairMojibake(normalizeGptOriginalReport(markdown)).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const referenceDefinition = line.match(/^\[(\d+)\]:\s*(https?:\/\/\S+)(?:\s+.*)?$/i);
    if (referenceDefinition) {
      blocks.push(`<p id="evidence-reference-${referenceDefinition[1]}" class="evidence-reference-target">${renderInlineMarkdown(line)}</p>`);
      continue;
    }
    if (line.startsWith('|')) {
      const table = renderMarkdownTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      const level = Math.min(3, line.match(/^#+/)[0].length);
      blocks.push(`<h${level}>${renderInlineMarkdown(line.replace(/^#{1,3}\s+/, ''))}</h${level}>`);
      continue;
    }
    if (line.startsWith('>')) {
      blocks.push(`<blockquote>${renderInlineMarkdown(line.replace(/^>\s*/, ''))}</blockquote>`);
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().slice(2))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      index -= 1;
      continue;
    }
    if (/^---+$/.test(line)) {
      blocks.push('<hr>');
      continue;
    }
    blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }
  return blocks.join('');
}

function isFastTriageRecord(record) {
  const meta = record?.meta || {};
  return String(meta.review_type || meta.analysis_type || '').toLowerCase().includes('triage')
    || Boolean(record?.triage);
}

function reviewStatus(record) {
  const override = record?.meta?.human_review?.overrides?.filter_status;
  const baseline = override || record?.hard_filter?.status || record?.triage?.status || 'INSUFFICIENT';
  const status = String(baseline).trim().toUpperCase();
  if (['UNVERIFIED', 'N/A'].includes(status)) return 'INSUFFICIENT';
  return ['SELECT', 'REJECT', 'INSUFFICIENT'].includes(status) ? status : 'INSUFFICIENT';
}

function identityIsVerified(record) {
  const parserStatus = String(record?.source_report?.parser_status || '');
  return record?.triage?.identity_verified !== false
    && !/asset_identity_not_verified/i.test(parserStatus);
}

function scoreFor(record, criterionKey) {
  const override = record?.meta?.human_review?.overrides?.scores?.[criterionKey];
  const baseline = record?.scoring?.criteria?.[criterionKey]?.score;
  const score = Number(override ?? baseline);
  return Number.isFinite(score) ? Math.max(0, Math.min(3, score)) : null;
}

function statusTone(status) {
  if (status === 'SELECT') return 'select';
  if (status === 'REJECT') return 'reject';
  return 'na';
}

function currentUserIsAdmin() {
  return Boolean(getCurrentUser()?.is_admin);
}

function scoreHasHumanOverride(record, criterionId) {
  const overrides = objectValue(objectValue(objectValue(record?.meta).human_review).overrides);
  return Object.prototype.hasOwnProperty.call(objectValue(overrides.scores), criterionId);
}

function effectiveTriageTotal(record) {
  const scores = scoreDefinitions.map((definition) => scoreFor(record, definition.key));
  return scores.every((score) => Number.isInteger(score))
    ? scores.reduce((sum, score) => sum + score, 0)
    : null;
}

function finalCommentValue(record) {
  return textValue(objectValue(objectValue(objectValue(record?.meta).human_review).overrides).final_comment, '');
}

function currentUserCanDeleteNote(note) {
  const user = getCurrentUser();
  const sameId = user?.id && note?.author_id && String(note.author_id) === String(user.id);
  const sameEmail = user?.email && note?.author_email
    && String(note.author_email).trim().toLowerCase() === String(user.email).trim().toLowerCase();
  return Boolean(user?.is_admin && (sameId || sameEmail));
}

function currentUserOwnsFinalComment(record) {
  const user = getCurrentUser();
  const humanReview = objectValue(objectValue(record?.meta).human_review);
  const ownerId = textValue(humanReview.final_comment_author_id, '');
  const ownerEmail = textValue(humanReview.final_comment_author_email, '');
  const sameId = user?.id && ownerId && ownerId === String(user.id);
  const sameEmail = user?.email && ownerEmail && ownerEmail.toLowerCase() === String(user.email).trim().toLowerCase();
  return Boolean(sameId || sameEmail);
}

function canDeleteFinalComment(record) {
  return Boolean(getCurrentUser()?.is_admin && currentUserOwnsFinalComment(record));
}

function canEditFinalComment(record) {
  return canDeleteFinalComment(record);
}

function renderDecision(record) {
  const status = reviewStatus(record);
  const triage = record.triage || {};
  const summary = record.json_summary || {};
  const finalInsight = record.final_insight || {};
  const headline = displayValue(
    finalInsight.one_line_summary || summary.one_line_summary || triage.why,
    'Simple Research 판단 요약이 없습니다.'
  );
  const reason = displayValue(
    triage.why || record.hard_filter?.reason,
    '판단 근거가 입력되지 않았습니다.'
  );
  elements.decisionHero.className = `panel triage-decision-hero status-${statusTone(status)}`;
  elements.decisionHero.innerHTML = `
    <div class="triage-decision-topline">
      <span class="triage-status-badge ${statusTone(status)}">${escapeHtml(status)}</span>
      <span>${identityIsVerified(record) ? 'Asset identity verified' : 'Asset identity 확인 필요'}</span>
    </div>
    <h2>${escapeHtml(headline)}</h2>
    <p>${escapeHtml(reason)}</p>
  `;
}

function identityFields(record) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const verified = identityIsVerified(record);
  return [
    ['Company', summary.company || table.company],
    ['Country', summary.company_country || table.company_country],
    ['Asset', summary.asset_name || table.asset_name],
    ['Development stage', table.development_stage],
    ['Target', summary.target || table.target],
    ['Modality', table.modality_platform],
    ['MoA', table.moa],
    ['Main indication', table.main_indication],
    ['Detailed indication', table.indication],
    ['Theme', verified ? dashboardThemeLabel(summary.theme) : 'Unknown'],
    ['Cluster', verified ? dashboardClusterLabel(summary.cluster, summary.theme) : 'Unknown']
  ];
}

function renderIdentity(record) {
  elements.identityGrid.innerHTML = identityFields(record)
    .map(([label, value], index) => `
      <article class="triage-identity-item ${index === 2 || index === 4 || index === 6 ? 'wide' : ''}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(displayValue(value))}</strong>
      </article>
    `)
    .join('');
}

function isCurrentFastTriageContract(record) {
  const meta = objectValue(record?.meta);
  const schemaVersion = String(meta.schema_version || '').trim().replace(/^v/i, '');
  const instructionVersion = String(meta.instruction_version || '').trim().replace(/^v/i, '');
  const triageStatus = String(record?.triage?.status || '').trim().toUpperCase();
  const criteria = objectValue(objectValue(record?.scoring).criteria);
  return schemaVersion === '3.2'
    || instructionVersion === '3.2'
    || triageStatus === 'INSUFFICIENT'
    || Object.values(criteria).some((item) => item && typeof item === 'object' && 'evidence_basis' in item);
}

function sourceRegistryLookup(record) {
  const lookup = new Map();
  arrayValue(objectValue(record?.validation).source_registry).forEach((sourceValue) => {
    const source = objectValue(sourceValue);
    const sourceId = textValue(source.source_id ?? source.id, '');
    if (sourceId && !lookup.has(sourceId)) lookup.set(sourceId, source);
  });
  return lookup;
}

function criterionSources(criterion, { requireExplicitVerification = false, registry = new Map() } = {}) {
  const item = objectValue(criterion);
  const explicitVerifiedList = Array.isArray(item.verified_evidence_sources);
  let preferredSources = explicitVerifiedList
    ? item.verified_evidence_sources
    : Array.isArray(item.evidence_sources)
      ? item.evidence_sources
      : [];
  if (!explicitVerifiedList && !preferredSources.length) {
    preferredSources = arrayValue(item.source_ids)
      .map((sourceId) => registry.get(textValue(sourceId, '')))
      .filter(Boolean);
  }
  const uniqueSources = new Map();
  preferredSources.forEach((source) => {
    if (source && typeof source === 'object') {
      if (source.verified === false) return;
      if (requireExplicitVerification && !explicitVerifiedList && source.verified !== true) return;
    } else if (requireExplicitVerification && !explicitVerifiedList) {
      return;
    }
    const rawUrl = typeof source === 'string' ? source : source?.source_url || source?.url;
    const url = safeHttpUrl(rawUrl);
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      if (!parsed.hostname || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) return;
      parsed.hash = '';
      const normalizedUrl = parsed.href.replace(/\/$/, '');
      const dedupeKey = normalizedUrl;
      if (!uniqueSources.has(dedupeKey)) uniqueSources.set(dedupeKey, normalizedUrl);
    } catch {
      // A descriptive citation without a public URL is not verified evidence.
    }
  });
  return [...uniqueSources.values()];
}

function evidenceBasisLabel(criterion, verifiedSourceCount) {
  const basis = String(criterion?.evidence_basis || '').trim().toLowerCase();
  if (basis === 'user_input_only') return '사용자 입력정보 기반 · 공개자료 미확인';
  if (basis === 'public_source') {
    return verifiedSourceCount > 0
      ? `공개자료 ${verifiedSourceCount}건 확인`
      : '공개자료 기반으로 분류됐으나 확인 가능한 URL 없음';
  }
  if (basis === 'user_input_and_public_source') {
    return verifiedSourceCount > 0
      ? `사용자 입력정보 + 공개자료 ${verifiedSourceCount}건 확인`
      : '사용자 입력정보 + 공개자료로 분류됐으나 확인 가능한 URL 없음';
  }
  if (basis === 'no_supporting_basis') return '확인된 판단근거 없음';
  return verifiedSourceCount > 0 ? `공개자료 ${verifiedSourceCount}건 확인` : '확인된 판단근거 없음';
}

function triageScoreTopic(definition) {
  return {
    id: `triage-score-${definition.key}`,
    key: `fast-triage-${definition.key}`,
    title: `Fast Triage · ${definition.label}`
  };
}

function triageScoreNotes(record, definition) {
  const topic = triageScoreTopic(definition);
  return arrayValue(objectValue(record?.meta).topic_notes)
    .filter((note) => objectValue(note).topic_id === topic.id);
}

function triageScoreNotesMarkup(record, definition) {
  const topic = triageScoreTopic(definition);
  const notes = triageScoreNotes(record, definition);
  return `
    <section class="triage-score-notes${notes.length ? ' has-notes' : ''}" data-triage-score-notes data-topic-id="${escapeHtml(topic.id)}" data-topic-key="${escapeHtml(topic.key)}" data-topic-title="${escapeHtml(topic.title)}">
      ${notes.length ? `<div class="triage-score-note-list">${notes.map((note) => `
        <article class="triage-score-note${currentUserCanDeleteNote(note) ? ' is-editable' : ''}"${currentUserCanDeleteNote(note) ? ` data-triage-score-note-edit data-note-id="${escapeHtml(note.id)}" data-note-body="${escapeHtml(note.body || '')}" title="두 번 클릭하여 수정"` : ''}>
          ${currentUserCanDeleteNote(note) ? `<button type="button" class="triage-note-delete" data-triage-score-note-delete data-note-id="${escapeHtml(note.id)}" aria-label="내 코멘트 삭제" title="내 코멘트 삭제">×</button>` : ''}
          <p>${escapeHtml(note.body || '')}</p>
          <small>${escapeHtml(commentByline(`Tab 1 · Fast Triage · ${definition.label}`, note.author_name, formatTimestamp(note.updated_at || note.created_at)))}</small>
        </article>
      `).join('')}</div>` : ''}
      <button type="button" class="triage-note-trigger" data-triage-score-note-open>＋ 코멘트 입력</button>
      <form class="triage-inline-note-form" data-triage-score-note-form hidden>
        <textarea rows="3" maxlength="4000" placeholder="이 기준의 판단 근거나 추가 확인 의견을 남겨주세요." aria-label="${escapeHtml(definition.label)} 코멘트"></textarea>
        <div><span data-triage-score-note-status></span><button type="button" data-triage-score-note-cancel>취소</button><button type="submit">저장</button></div>
      </form>
    </section>
  `;
}

function finalCommentMarkup(record) {
  const finalComment = finalCommentValue(record);
  const humanReview = objectValue(objectValue(record?.meta).human_review);
  const authorName = textValue(humanReview.final_comment_author_name, '관리자');
  const updatedAt = textValue(humanReview.final_comment_updated_at, '');
  const canManage = Boolean(getCurrentUser());
  const canEdit = canEditFinalComment(record);
  if (!finalComment && !canManage && !getCurrentUser()) return '';
  return `
    <section class="triage-final-comment${finalComment ? ' has-comment' : ''}" aria-label="최종 코멘트">
      ${finalComment ? `<article class="triage-score-note triage-final-comment-note${canEdit ? ' is-editable' : ''}"${canEdit ? ' data-triage-final-comment-edit title="두 번 클릭하여 수정"' : ''}>
        ${canDeleteFinalComment(record) ? '<button type="button" class="triage-note-delete" data-triage-final-comment-delete aria-label="내 최종 코멘트 삭제" title="내 최종 코멘트 삭제">×</button>' : ''}
        <p>${escapeHtml(finalComment)}</p>
        <small>${escapeHtml(commentByline('Tab 1 · Fast Triage · Comment', authorName, updatedAt ? formatTimestamp(updatedAt) : ''))}</small>
      </article>` : ''}
      ${canManage ? `
        <div class="triage-note-actions">
          <button type="button" class="triage-note-trigger" data-triage-final-comment-open>＋ 최종 코멘트 입력</button>
          ${triageContactHistoryTrigger()}
          ${triageRubricRefreshButton()}
        </div>
        <form class="triage-inline-note-form" data-triage-final-comment-form hidden>
          <textarea rows="3" maxlength="4000" placeholder="최종 판단에 대한 관리자 의견을 남겨주세요." aria-label="최종 코멘트">${escapeHtml(finalComment)}</textarea>
          <div><span data-triage-final-comment-status></span><button type="button" data-triage-final-comment-cancel>취소</button><button type="submit">저장</button></div>
        </form>
      ` : `<div class="triage-note-actions">${triageContactHistoryTrigger()}${triageRubricRefreshButton()}</div>`}
    </section>
  `;
}

function triageContactHistoryTrigger() {
  if (!getCurrentUser()) return '';
  return `<button type="button" class="triage-note-trigger triage-contact-history-trigger" data-triage-contact-history-open aria-label="Contact History 입력" title="Contact History 입력">＋ Contact History 입력</button>`;
}

function triageFinalCommentPostsMarkup(record) {
  const entries = arrayValue(objectValue(objectValue(record?.meta).collaboration).comments)
    .filter((entry) => objectValue(entry).category === 'final_comment');
  if (!entries.length) return '';
  return `<section class="triage-final-comment-posts" aria-label="Final Comments">${entries.map((entry) => {
    const isOwn = currentUserOwnsOperationalComment(entry);
    return `<article class="triage-score-note${isOwn ? ' is-editable' : ''}"${isOwn ? ` data-triage-final-post-edit data-comment-id="${escapeHtml(entry.id)}" title="두 번 클릭하여 수정"` : ''}>
      ${isOwn ? `<button type="button" class="triage-note-delete" data-triage-final-post-delete data-comment-id="${escapeHtml(entry.id)}" aria-label="내 최종 코멘트 삭제" title="내 최종 코멘트 삭제">×</button>` : ''}
      <p>${escapeHtml(entry.body || '')}</p><small>${escapeHtml(commentByline('Tab 1 · Fast Triage · Comment', entry.author, formatTimestamp(entry.updated_at || entry.created_at)))}</small>
      ${isOwn ? `<form class="triage-inline-note-form" data-triage-final-post-edit-form data-comment-id="${escapeHtml(entry.id)}" hidden><textarea rows="3" maxlength="5000" aria-label="최종 코멘트 수정">${escapeHtml(entry.body || '')}</textarea><div><span data-triage-final-post-status></span><button type="button" data-triage-final-post-edit-cancel>취소</button><button type="submit">저장</button></div></form>` : ''}
    </article>`;
  }).join('')}</section>`;
}

function triageRubricRefreshButton() {
  return `<button type="button" class="triage-rubric-refresh" data-triage-rubric-refresh aria-label="최신 Score 기준 갱신" title="최신 Score 기준 갱신"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.2 6.5L3 16m0 0v5m0-5h5M3 12A9 9 0 0 1 18.2 5.5L21 8m0 0V3m0 5h-5"></path></svg></button>`;
}

function triageSyncedListingCommentsMarkup(record) {
  const entries = arrayValue(objectValue(objectValue(record?.meta).collaboration).comments)
    .filter((entry) => String(entry?.source || '') === 'listing_comment_post');
  if (!entries.length) return '';
  return `<section class="triage-final-comment-posts" aria-label="Listing Comments">${entries.map((entry) => {
    const display = listingCommentDisplay(record, entry);
    return `<article class="triage-score-note is-listing-source" data-listing-source-field="comment" title="Tab 0 원본에서 관리"><p>${escapeHtml(entry.body || '')}</p><small>${escapeHtml(commentByline(display.breadcrumb, display.author, formatTimestamp(display.timestamp)))}</small></article>`;
  }).join('')}</section>`;
}

function triageContactHistoryMarkup(record) {
  const entries = arrayValue(objectValue(objectValue(record?.meta).collaboration).comments)
    .filter((entry) => objectValue(entry).category === 'contact_history');
  const signedIn = Boolean(getCurrentUser());
  return `
    <section class="triage-contact-history" aria-label="Contact History">
      <div class="triage-contact-history-heading">
        <strong>Contact History</strong>
        <small>해당 Pipeline과 관련해 수행한 미팅·통화·이메일·후속 조치 등 Contact History를 기록하세요.</small>
      </div>
      ${entries.length ? `<div class="triage-score-note-list">${entries.map((entry) => {
        const listingSource = isListingContactSource(entry);
        const isOwn = !listingSource && currentUserOwnsOperationalComment(entry);
        const display = contactHistoryDisplay(record, entry);
        return `<article class="triage-score-note${isOwn ? ' is-editable' : ''}"${isOwn ? ` data-triage-contact-history-edit data-comment-id="${escapeHtml(entry.id)}" title="두 번 클릭하여 수정"` : ''}>
          ${isOwn ? `<button type="button" class="triage-note-delete" data-triage-contact-history-delete data-comment-id="${escapeHtml(entry.id)}" aria-label="내 Contact History 삭제" title="내 Contact History 삭제">×</button>` : ''}
          <p>${escapeHtml(entry.body || '')}</p><small>${escapeHtml(commentByline(display.breadcrumb, display.author, formatTimestamp(display.timestamp)))}</small>
          ${isOwn ? `<form class="triage-inline-note-form" data-triage-contact-history-edit-form data-comment-id="${escapeHtml(entry.id)}" hidden><textarea rows="3" maxlength="5000" aria-label="Contact History 수정">${escapeHtml(entry.body || '')}</textarea><div><span data-triage-contact-history-status></span><button type="button" data-triage-contact-history-edit-cancel>취소</button><button type="submit">저장</button></div></form>` : ''}
        </article>`;
      }).join('')}</div>` : ''}
      ${signedIn ? `<button type="button" class="triage-note-trigger triage-contact-history-trigger" data-triage-contact-history-open>＋ Contact History 입력</button>
        <form class="triage-inline-note-form triage-contact-history-form" data-triage-contact-history-form hidden>
          <textarea rows="3" maxlength="5000" placeholder="미팅, 통화, 이메일 등 연락 여부 및 연락 내용을 기록하세요." aria-label="Contact History 입력"></textarea>
          <div><span data-triage-contact-history-status></span><button type="button" data-triage-contact-history-cancel>취소</button><button type="submit">저장</button></div>
        </form>` : ''}
    </section>
  `;
}

function pipelineMetadataMarkup(record) {
  const metadata = objectValue(objectValue(record?.meta).pipeline_metadata);
  const comment = textValue(metadata.comment, '');
  const contact = textValue(metadata.contact, '');
  if (!comment && !contact) return '';
  const rows = [
    ['Comment', comment],
    ['Contact', contact]
  ].filter(([, value]) => value);
  return `
    <section class="triage-pipeline-metadata" aria-label="Internal pipeline metadata">
      <p>Internal pipeline metadata</p>
      <dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value).replaceAll('\n', '<br>')}</dd></div>`).join('')}</dl>
    </section>
  `;
}

function renderScores(record) {
  const requireExplicitVerification = isCurrentFastTriageContract(record);
  const criteria = objectValue(objectValue(record?.scoring).criteria);
  const registry = sourceRegistryLookup(record);
  elements.scoreGrid.innerHTML = scoreDefinitions.map((definition) => {
    const criterion = objectValue(criteria[definition.key]);
    const score = scoreFor(record, definition.key);
    const evidenceSources = criterionSources(criterion, { requireExplicitVerification, registry });
    const evidenceBasisValue = textValue(criterion.evidence_basis, '');
    const hasEvidenceMetadata = Boolean(evidenceBasisValue || evidenceSources.length);
    const evidenceBasis = hasEvidenceMetadata
      ? evidenceBasisLabel({ ...criterion, evidence_basis: evidenceBasisValue }, evidenceSources.length)
      : '';
    const evidenceType = textValue(criterion.evidence_type, '');
    const visibleEvidenceType = evidenceType === 'triage_only' ? '' : evidenceType;
    const evidenceTypeReason = textValue(criterion.evidence_type_reason, '');
    const rationale = objectValue(criterion.score_rationale);
    const uncertainties = listValues(
      criterion.uncertain_points ?? rationale.conflicting_or_missing_evidence
    );
    const whyNotHigher = textValue(criterion.why_not_higher, '');
    const scoreLabel = score === null ? '미평가' : `${score}점`;
    const judgment = firstTextValue(
      [
        criterion.main_line_summary,
        criterion.reason,
        rationale.decision_summary,
        criterion.investigation_note
      ],
      '상세 판단근거는 GPT ORIGINAL REPORT에서 확인하세요.'
    );
    const evidenceMetadata = [visibleEvidenceType, evidenceBasis].filter(Boolean);
    const isHumanScore = scoreHasHumanOverride(record, definition.key);
    const scoreHeader = currentUserIsAdmin()
      ? `<button type="button" class="triage-score-value" data-triage-score-edit data-criterion="${escapeHtml(definition.key)}" data-score="${score ?? 0}" aria-label="${escapeHtml(definition.label)} ${escapeHtml(scoreLabel)}. 클릭하여 점수 수정" title="클릭하여 점수 수정"><span>${escapeHtml(scoreLabel)}</span><small>최대 3점</small></button>`
      : `<strong>${escapeHtml(scoreLabel)}<small>최대 3점</small></strong>`;
    return `
      <article class="triage-score-card score-${score ?? 'unknown'}${isHumanScore ? ' is-human-score' : ''}">
        <div class="triage-score-card-header">
          <div>
            <span>${definition.shortLabel}</span>
            <h3>${definition.label}</h3>
          </div>
          ${scoreHeader}
        </div>
        <div class="triage-score-track" aria-label="${definition.label} ${score === null ? '미평가' : `${score}점, 최대 3점`}">
          ${[1, 2, 3].map((step) => `<i class="${score >= step ? 'filled' : ''}"></i>`).join('')}
        </div>
        <p class="triage-score-definition">${definition.description}</p>
        <p class="triage-score-judgment">${escapeHtml(judgment)}</p>
        ${whyNotHigher ? `<p class="triage-score-judgment triage-score-why"><b>Why not higher</b> · ${escapeHtml(whyNotHigher)}</p>` : ''}
        ${evidenceMetadata.length ? `
          <div class="triage-score-meta">
            ${evidenceMetadata.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}
          </div>
        ` : ''}
        ${evidenceTypeReason ? `<p class="triage-score-definition">${escapeHtml(evidenceTypeReason)}</p>` : ''}
        ${uncertainties.length ? `
          <div class="triage-score-uncertainty">
            <b>확인 필요</b>
            <ul>${uncertainties.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${evidenceSources.length ? `
          <div class="triage-score-links">
            ${evidenceSources.map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">근거 ${index + 1}</a>`).join('')}
          </div>
        ` : ''}
        ${triageScoreNotesMarkup(record, definition)}
      </article>
    `;
  }).join('');
  if (elements.scoreTotal) {
    const total = effectiveTriageTotal(record);
    const scoreLabel = `${total === null ? '-' : total} / 9`;
    elements.scoreTotal.setAttribute('aria-label', `Total ${scoreLabel}`);
    elements.scoreTotal.innerHTML = `<small>Total</small><strong>${escapeHtml(scoreLabel)}</strong>`;
  }
}

function collectSources(record) {
  const sources = [];
  const add = (source) => {
    if (!source) return;
    if (typeof source === 'string') {
      const url = normalizeMarkdownSourceUrl(source);
      if (url) sources.push({ source_url: url });
      return;
    }
    if (typeof source !== 'object' || Array.isArray(source)) return;
    if (source.verified === false) return;
    const url = normalizeMarkdownSourceUrl(source.source_url || source.url);
    if (url) sources.push({ ...source, source_url: url });
  };

  arrayValue(objectValue(record?.structured_table).sources).forEach(add);
  arrayValue(objectValue(record?.validation).source_registry).forEach(add);
  Object.values(objectValue(objectValue(record?.scoring).criteria)).forEach((criterionValue) => {
    const criterion = objectValue(criterionValue);
    const criterionEvidence = Array.isArray(criterion?.verified_evidence_sources)
      ? criterion.verified_evidence_sources
      : Array.isArray(criterion?.evidence_sources)
        ? criterion.evidence_sources
        : [];
    criterionEvidence.forEach(add);
  });
  collectMarkdownSources(objectValue(record?.source_report).raw_markdown || '', record).forEach(add);

  const deduplicated = new Map();
  sources.forEach((source) => {
    const dedupeKey = source.source_url.replace(/\/+$/, '').toLowerCase();
    const existing = deduplicated.get(dedupeKey);
    if (!existing) {
      deduplicated.set(dedupeKey, source);
      return;
    }
    const merged = { ...source, ...existing };
    Object.entries(source).forEach(([key, value]) => {
      if ((merged[key] === null || merged[key] === undefined || merged[key] === '') && value) merged[key] = value;
    });
    deduplicated.set(dedupeKey, merged);
  });
  return [...deduplicated.values()];
}

function renderSources(record) {
  const sources = collectSources(record);
  if (!sources.length) {
    elements.sourceList.innerHTML = '<div class="triage-empty">공개 출처 정보 없음 · 상세 내용은 GPT ORIGINAL REPORT에서 확인하세요.</div>';
    return;
  }
  elements.sourceList.innerHTML = sources.map((source, index) => {
    const url = source.source_url;
    const title = textValue(source.source_title, hostnameFor(url));
    const sourceType = textValue(source.source_type, 'public source');
    const reliability = textValue(source.reliability, 'reliability unknown');
    const summary = textValue(source.evidence_summary, '출처 링크에서 세부 내용을 확인하세요.');
    return `
      <a class="triage-source-card" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
        <span class="triage-source-index">${index + 1}</span>
        <span class="triage-source-copy">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(sourceType)} · ${escapeHtml(reliability)}</small>
          <p>${escapeHtml(summary)}</p>
          <em>${escapeHtml(hostnameFor(url))} ↗</em>
        </span>
      </a>
    `;
  }).join('');
}

function renderListBlock(title, items, tone = '') {
  if (!items.length) return '';
  return `
    <section class="triage-diligence-block ${tone}">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
  `;
}

function renderDiligence(record) {
  const triage = objectValue(record?.triage);
  const validation = objectValue(record?.validation);
  const finalInsight = objectValue(record?.final_insight);
  const missing = listValues(triage.missing_evidence_needed_for_full_scout);
  const verified = listValues(validation.cross_checked_facts);
  const uncertain = listValues(validation.uncertain_points);
  const question = textValue(finalInsight.most_important_diligence_question, '');
  const recommendation = textValue(finalInsight.recommendation, '');
  elements.diligence.innerHTML = `
    ${recommendation ? `
      <div class="triage-next-action">
        <span>Recommended next action</span>
        <strong>${escapeHtml(recommendation)}</strong>
      </div>
    ` : ''}
    ${question ? `
      <blockquote class="triage-key-question">
        <span>가장 중요한 질문</span>
        <strong>${escapeHtml(question)}</strong>
      </blockquote>
    ` : ''}
    ${renderListBlock('Advanced Research에서 추가할 근거', missing, 'missing')}
    ${renderListBlock('교차 확인된 사실', verified, 'verified')}
    ${renderListBlock('현재 불확실한 부분', uncertain, 'uncertain')}
    ${!missing.length && !verified.length && !uncertain.length && !question
      ? '<div class="triage-empty">추가 diligence 정보 없음 · 상세 판단은 GPT ORIGINAL REPORT에서 확인하세요.</div>'
      : ''}
  `;
}

function renderQuickSummary(record) {
  const meta = record.meta || {};
  const sourceReport = record.source_report || {};
  const triage = record.triage || {};
  const status = reviewStatus(record);
  const requireExplicitVerification = isCurrentFastTriageContract(record);
  const registry = sourceRegistryLookup(record);
  const verifiedCriterionUrls = new Set();
  Object.values(record?.scoring?.criteria || {}).forEach((criterion) => {
    criterionSources(criterion, { requireExplicitVerification, registry }).forEach((url) => verifiedCriterionUrls.add(url));
  });
  const lastEditedAt = meta.last_edited_at ? formatTimestamp(meta.last_edited_at) : null;
  const originalInstructionVersion = String(
    sourceReport.instruction_version || meta.instruction_version || triage.instruction_version || ''
  ).replace(/^v/i, '');
  const originalResearchSummary = [
    originalInstructionVersion ? `GPT 지침 v${originalInstructionVersion}` : 'GPT 지침 버전 미기록',
    meta.generated_at || '생성일 미기록'
  ].join(' · ');
  const latestScoreEvaluation = [
    meta.rescored_rubric_version && meta.rescored_at ? {
      label: '원문 기반 마지막 재평가',
      version: meta.rescored_rubric_version,
      at: meta.rescored_at
    } : null,
    meta.rubric_reviewed_version && meta.rubric_reviewed_at ? {
      label: '원문 기반 마지막 재평가',
      version: meta.rubric_reviewed_version,
      at: meta.rubric_reviewed_at
    } : null
  ].filter(Boolean).reduce((latest, candidate) => {
    if (!latest) return candidate;
    return (Date.parse(candidate.at || '') || 0) > (Date.parse(latest.at || '') || 0)
      ? candidate
      : latest;
  }, null);
  const currentScoreVersion = String(
    meta.rubric_version || meta.rubric_reviewed_version || triage.instruction_version || meta.schema_version || ''
  ).replace(/^v/i, '');
  const rows = [
    ['Triage status', status],
    ['원문 생성', originalResearchSummary],
    ['현재 점수 기준', currentScoreVersion ? `Simple Research 기준 v${currentScoreVersion}` : '기준 버전 미기록'],
    ['Identity verified', identityIsVerified(record) ? 'Yes' : 'Needs review'],
    ['Parser status', sourceReport.parser_status],
    [
      'Verified public sources',
      String(Number.isInteger(triage.verified_public_source_count)
        ? triage.verified_public_source_count
        : verifiedCriterionUrls.size)
    ]
  ];
  if (latestScoreEvaluation) {
    const evaluationVersion = String(latestScoreEvaluation.version || '').replace(/^v/i, '');
    rows.splice(3, 0, [
      latestScoreEvaluation.label,
      `Simple Research 기준 v${evaluationVersion || '?'} · ${formatTimestamp(latestScoreEvaluation.at)}`
    ]);
  }
  if (lastEditedAt) {
    rows.push(['Last edited', `${lastEditedAt} · ${meta.last_edited_by || 'unknown'}`]);
  }
  elements.quickSummary.innerHTML = `
    <dl>
      ${rows.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(displayValue(value))}</dd>
        </div>
      `).join('')}
    </dl>
    ${finalCommentMarkup(record)}
    ${triageSyncedListingCommentsMarkup(record)}
    ${triageFinalCommentPostsMarkup(record)}
    ${triageContactHistoryMarkup(record)}
    ${renderTriageReviewHistory(record)}
  `;
  const contactEntries = arrayValue(objectValue(objectValue(record?.meta).collaboration).comments)
    .filter((entry) => objectValue(entry).category === 'contact_history');
  elements.quickSummary.querySelectorAll('.triage-contact-history .triage-score-note').forEach((card, index) => {
    if (!isListingContactSource(contactEntries[index])) return;
    card.classList.add('is-listing-source');
    card.dataset.listingSourceField = 'contact';
    card.title = 'Tab 0 원본에서 관리';
  });
}

function triageRubricResetSuffix(record, entry) {
  const resetMatch = String(entry?.change_method || '').match(/^rubric_refresh_(latest|existing)_v(.+)$/i);
  if (resetMatch) {
    return `${resetMatch[1].toLowerCase() === 'latest' ? '최신 루브릭' : '기존 루브릭'} v${resetMatch[2]}으로 초기화`;
  }
  if (String(entry?.source || '') !== 'dashboard_rubric_refresh') return '';
  const meta = objectValue(record?.meta);
  const targetVersion = textValue(meta.rubric_reviewed_version || meta.rescored_rubric_version || meta.rubric_version, '').replace(/^v/i, '');
  const originalVersion = textValue(meta.rubric_version, '').replace(/^v/i, '');
  if (!targetVersion) return '공식 GPT 점수로 초기화';
  return `${originalVersion && originalVersion !== targetVersion ? '최신 루브릭' : '기존 루브릭'} v${targetVersion}으로 초기화`;
}

function triageHistoryLabel(record, entry) {
  const field = String(entry?.field || '');
  if (entry?.source === 'dashboard_rubric_refresh' && field === 'rubric_refresh') {
    const version = String(entry?.instruction_version || '').replace(/^v/i, '');
    return entry?.audit_label || `Score recalculated by Simple Research Rubric${version ? ` v${version}` : ''}`;
  }
  const resetSuffix = triageRubricResetSuffix(record, entry);
  const labels = {
    'scores.target_relevance': 'TAR 점수',
    'scores.moa_validity': 'MoA 점수',
    'scores.data_maturity': 'Data 점수',
    total_score: 'Total score',
    'structured_table.company': 'Company',
    'structured_table.asset_name': 'Asset',
    'structured_table.main_indication': 'Main indication',
    'structured_table.development_stage': 'Stage',
    final_comment: entry?.source === 'detail_final_comment_delete' ? '최종 코멘트 삭제' : '최종 코멘트'
  };
  if (labels[field]) return resetSuffix ? `${labels[field]} · ${resetSuffix}` : labels[field];
  if (field.startsWith('topic_notes.triage-score-')) {
    return entry?.source === 'detail_topic_note_delete' ? '기준별 코멘트 삭제' : '기준별 코멘트 입력';
  }
  if (field === 'filter_status') return resetSuffix ? `Triage status · ${resetSuffix}` : 'Triage status';
  return field || 'Simple Research 검토';
}

function triageVisibleReviewHistory(record) {
  const meta = objectValue(record?.meta);
  const auditHistory = arrayValue(meta.edit_history);
  const rubricHistory = arrayValue(meta.rubric_refresh_history);
  const syntheticScoreReviews = rubricHistory
    .filter((entry) => objectValue(entry).reviewed_at)
    .filter((entry) => !auditHistory.some((auditEntry) => {
      const audit = objectValue(auditEntry);
      const review = objectValue(entry);
      if (audit.source !== 'dashboard_rubric_refresh' || audit.field !== 'rubric_refresh') return false;
      if (String(audit.instruction_version || '') !== String(review.version || '')) return false;
      const auditTime = Date.parse(audit.changed_at || '');
      const reviewTime = Date.parse(review.reviewed_at || '');
      return Number.isFinite(auditTime) && Number.isFinite(reviewTime) && Math.abs(auditTime - reviewTime) < 5000;
    }))
    .map((entry) => {
      const review = objectValue(entry);
      return {
        id: `rubric-review-${review.reviewed_at}-${review.version || ''}`,
        changed_at: review.reviewed_at,
        actor_name: review.actor_name || '',
        actor_ip: review.actor_ip || '',
        source: 'dashboard_rubric_refresh',
        field: 'rubric_refresh',
        instruction_version: review.version || '',
        audit_label: `Score recalculated by Simple Research Rubric v${review.version || '?'}`,
        previous_value: '',
        new_value: review.result || 'reviewed'
      };
    });
  return [...auditHistory, ...syntheticScoreReviews];
}

function triageHistoryValue(value) {
  if (value === null || value === undefined || value === '') return 'Auto';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function renderTriageReviewHistory(record) {
  const history = triageVisibleReviewHistory(record);
  if (!history.length) return '';
  const items = history
    .slice(-20)
    .reverse()
    .map((entry) => {
      const when = formatTimestamp(entry?.changed_at);
      const who = entry?.actor_name || '';
      const label = triageHistoryLabel(record, entry);
      const change = `${triageHistoryValue(entry?.previous_value)} → ${triageHistoryValue(entry?.new_value)}`;
      const actorAndChange = who ? `${who} · ${change}` : change;
      return `<li${entry?.actor_name ? ' class="is-human"' : ''}>
        <span>${escapeHtml(when)}</span>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(actorAndChange)}</small>
      </li>`;
    })
    .join('');
  return `
    <details class="triage-edit-history">
      <summary>검토 변경 이력 (${history.length})</summary>
      <ul>${items}</ul>
    </details>
  `;
}

function renderEditHistoryBlock(record) {
  const history = Array.isArray(record?.meta?.edit_history) ? record.meta.edit_history : [];
  if (!history.length) return '';
  const items = history
    .slice(-10)
    .reverse()
    .map((entry) => {
      const when = formatTimestamp(entry?.changed_at);
      const who = entry?.actor_name || entry?.actor_ip || 'unknown';
      const field = entry?.field && entry.field !== 'record' ? ` (${escapeHtml(entry.field)})` : '';
      return `<li>${escapeHtml(when)}에 <strong>${escapeHtml(who)}</strong>에 의해 수정됨${field}</li>`;
    })
    .join('');
  return `
    <details class="triage-edit-history">
      <summary>수정 이력 (${history.length})</summary>
      <ul>${items}</ul>
    </details>
  `;
}

function renderRecord(record) {
  if (!isFastTriageRecord(record)) {
    window.location.replace(`/detail?id=${encodeURIComponent(recordId)}`);
    return;
  }
  currentRecord = record;
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const asset = displayValue(summary.asset_name || table.asset_name, 'Pipeline');
  const company = displayValue(summary.company || table.company, 'Company unknown');
  const verified = identityIsVerified(record);
  const theme = verified ? dashboardThemeLabel(summary.theme) : 'Unknown';
  const cluster = verified ? dashboardClusterLabel(summary.cluster, summary.theme) : 'Unknown';
  elements.title.textContent = `Simple : ${asset}`;
  elements.subtitle.textContent = `${company} · ${displayValue(table.development_stage)} · ${theme} / ${cluster}`;
  document.title = `${asset} · Simple`;
  renderPipelineWebsiteAction(record);
  renderDecision(record);
  renderIdentity(record);
  renderScores(record);
  renderSources(record);
  renderDiligence(record);
  renderQuickSummary(record);

  const rawMarkdown = String(record?.source_report?.raw_markdown || '').trim();
  elements.rawReport.innerHTML = rawMarkdown
    ? renderMarkdown(rawMarkdown)
    : '<div class="triage-empty">저장된 Simple Research 원본 Markdown이 없습니다.</div>';
}

async function updateTriageManualReview(payload) {
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/manual-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '검토 내용을 저장하지 못했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
  return data;
}

async function saveTriageContactHistory(body) {
  const author = await requireAuth();
  if (!author?.name) throw new Error('로그인 후 Contact History를 입력할 수 있습니다.');
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: author.name, body, category: 'contact_history' })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Contact History 저장에 실패했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function updateTriageContactHistory(commentId, body) {
  const closeProgress = showTriageProgress('잠시만 기다려 주세요', 'Contact History를 수정하고 있습니다.');
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  }).finally(closeProgress);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Contact History 수정에 실패했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function deleteTriageContactHistory(commentId) {
  const closeProgress = showTriageProgress('잠시만 기다려 주세요', 'Contact History를 삭제하고 있습니다.');
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }).finally(closeProgress);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Contact History 삭제에 실패했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function saveTriageFinalComment(body) {
  const author = await requireAuth();
  if (!author?.name) throw new Error('로그인 후 최종 코멘트를 입력할 수 있습니다.');
  const closeProgress = showTriageProgress('잠시만 기다려 주세요', '최종 코멘트를 저장하고 있습니다.');
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: author.name, body, category: 'final_comment' })
  }).finally(closeProgress);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '최종 코멘트 저장에 실패했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function updateTriageFinalComment(commentId, body) {
  const closeProgress = showTriageProgress('잠시만 기다려 주세요', '최종 코멘트를 수정하고 있습니다.');
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body })
  }).finally(closeProgress);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '최종 코멘트 수정에 실패했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function deleteTriageFinalComment(commentId) {
  const closeProgress = showTriageProgress('잠시만 기다려 주세요', '최종 코멘트를 삭제하고 있습니다.');
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }).finally(closeProgress);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '최종 코멘트 삭제에 실패했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function saveTriageScore(select) {
  const criterion = String(select.dataset.criterion || '');
  const value = Number(select.value);
  const previousValue = scoreFor(currentRecord, criterion);
  if (!criterion || !Number.isInteger(value)) return;
  select.disabled = true;
  try {
    const data = await updateTriageManualReview({ kind: 'score', criterion, value, previous_value: previousValue });
    const updates = Array.isArray(data.derived_score_updates) ? data.derived_score_updates : [];
    const synchronized = updates.map((item) => item.label || (item.field === 'total_score' ? 'Total Score' : 'Filter 1')).join(' · ');
    void showTriageActionOutcomeToast(
      '수동 점수를 반영했습니다',
      synchronized
        ? `점수 변경에 따라 ${synchronized}을(를) 자동 동기화하고 변경 이력에 기록했습니다.`
        : '점수를 수동 수정하고 변경 이력에 기록했습니다.',
      'FILTER 1'
    );
  } catch (error) {
    window.alert(error.message);
    select.value = String(previousValue ?? 0);
  } finally {
    select.disabled = false;
  }
}

function openTriageScoreInlineEditor(button) {
  if (!button || !currentUserIsAdmin() || button.dataset.editing === 'true') return;
  const criterion = String(button.dataset.criterion || '');
  const currentScore = scoreFor(currentRecord, criterion);
  if (!criterion || !Number.isInteger(currentScore)) return;

  button.dataset.editing = 'true';
  button.replaceChildren();
  const select = document.createElement('select');
  select.className = 'triage-score-inline-select';
  select.dataset.triageScoreSelect = '';
  select.dataset.criterion = criterion;
  select.setAttribute('aria-label', '관리자 점수 수정');
  for (const value of [0, 1, 2, 3]) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${value}점`;
    option.selected = value === currentScore;
    select.append(option);
  }
  const maximum = document.createElement('small');
  maximum.textContent = '최대 3점';
  button.append(select, maximum);
  select.addEventListener('change', () => { button.dataset.editing = 'saving'; });
  select.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (button.isConnected && button.dataset.editing === 'true') renderRecord(currentRecord);
    }, 0);
  }, { once: true });
  select.focus();
}

async function saveTriageScoreNote(panel, body, noteId = '') {
  const response = await fetch(noteId
    ? `/api/records/${encodeRecordIdForPath(recordId)}/topic-notes/${encodeURIComponent(noteId)}`
    : `/api/records/${encodeRecordIdForPath(recordId)}/topic-notes`, {
    method: noteId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteId ? { body } : {
      topic_id: panel.dataset.topicId,
      topic_key: panel.dataset.topicKey,
      topic_title: panel.dataset.topicTitle,
      body
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '코멘트를 저장하지 못했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function deleteTriageScoreNote(noteId) {
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/topic-notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || '코멘트를 삭제하지 못했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

function openTriageInlineForm(form) {
  if (!form) return;
  form.hidden = false;
  form.querySelector('textarea')?.focus();
}

const CRITERIA_GUIDE_LANGUAGE_STORAGE_KEY = 'skbp.dashboard.criteriaGuideLanguage.v1';
let criteriaGuideLanguage = localStorage.getItem(CRITERIA_GUIDE_LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'ko';
let cachedDashboardCriteriaBody = null;

const KOREAN_CRITERIA_DRAWER_CHROME = {
  title: '판단근거',
  close: '닫기',
  closeAriaLabel: 'Simple Research 판단근거 닫기',
  subtitle: 'Advanced Research 검토 후보를 선별하기 위한 3-point screening 기준'
};

function criteriaGuideChrome() {
  return criteriaGuideLanguage === 'en'
    ? { title: ENGLISH_CRITERIA_DRAWER_CHROME.title, close: ENGLISH_CRITERIA_DRAWER_CHROME.close, closeAriaLabel: ENGLISH_CRITERIA_DRAWER_CHROME.closeAriaLabel, subtitle: ENGLISH_CRITERIA_DRAWER_CHROME.subtitles.triage }
    : KOREAN_CRITERIA_DRAWER_CHROME;
}

function englishCriteriaBody() {
  const doc = new DOMParser().parseFromString(`<div>${englishCriteriaGuideMarkup()}</div>`, 'text/html');
  return doc.body.firstElementChild;
}

function renderCriteriaDrawerBody() {
  const sourceBody = criteriaGuideLanguage === 'en' ? englishCriteriaBody() : cachedDashboardCriteriaBody;
  if (!sourceBody || !elements.criteriaDrawerBody) return;
  const triageSections = [...sourceBody.children]
    .filter((section) => section.dataset.criteriaTab === 'triage');
  if (!triageSections.length) throw new Error('Dashboard Tab 1 판단근거가 비어 있습니다.');
  const fragment = document.createDocumentFragment();
  triageSections.forEach((section) => {
    const clone = section.cloneNode(true);
    clone.hidden = false;
    fragment.append(clone);
  });
  elements.criteriaDrawerBody.replaceChildren(fragment);
  elements.criteriaDrawerBody.lang = criteriaGuideLanguage;
  elements.criteriaDrawer.dataset.activeCriteriaTab = 'triage';
}

function applyCriteriaGuideChrome() {
  const chrome = criteriaGuideChrome();
  if (elements.criteriaDrawerTitle) elements.criteriaDrawerTitle.textContent = chrome.title;
  if (elements.criteriaDrawerSubtitle) elements.criteriaDrawerSubtitle.textContent = chrome.subtitle;
  if (elements.criteriaDrawerClose) {
    elements.criteriaDrawerClose.setAttribute('aria-label', chrome.closeAriaLabel);
    const closeLabel = elements.criteriaDrawerClose.querySelector('span');
    if (closeLabel) closeLabel.textContent = chrome.close;
  }
  elements.criteriaLanguageToggle?.querySelectorAll('[data-criteria-language]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.criteriaLanguage === criteriaGuideLanguage));
  });
}

function applyCriteriaGuideLanguage(language) {
  criteriaGuideLanguage = language === 'en' ? 'en' : 'ko';
  localStorage.setItem(CRITERIA_GUIDE_LANGUAGE_STORAGE_KEY, criteriaGuideLanguage);
  applyCriteriaGuideChrome();
  renderCriteriaDrawerBody();
}

let criteriaDrawerSyncPromise = null;

function syncCriteriaDrawerFromDashboard() {
  if (criteriaDrawerSyncPromise) return criteriaDrawerSyncPromise;
  criteriaDrawerSyncPromise = (async () => {
    const response = await fetch('/', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Dashboard criteria HTTP ${response.status}`);
    const dashboardHtml = await response.text();
    const dashboardDocument = new DOMParser().parseFromString(dashboardHtml, 'text/html');
    const dashboardBody = dashboardDocument.querySelector('#criteriaDrawer .criteria-drawer-body');
    if (!dashboardBody || !elements.criteriaDrawerBody) {
      throw new Error('Dashboard Tab 1 판단근거를 찾을 수 없습니다.');
    }
    cachedDashboardCriteriaBody = dashboardBody;
    renderCriteriaDrawerBody();
  })().catch((error) => {
    criteriaDrawerSyncPromise = null;
    throw error;
  });
  return criteriaDrawerSyncPromise;
}

async function openCriteriaDrawer() {
  applyCriteriaGuideChrome();
  elements.criteriaDrawer.hidden = false;
  elements.criteriaBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.criteriaDrawer.classList.add('open');
    elements.criteriaBackdrop.classList.add('open');
    elements.criteriaDrawer.setAttribute('aria-hidden', 'false');
  });
  if (elements.criteriaDrawerBody) elements.criteriaDrawerBody.setAttribute('aria-busy', 'true');
  try {
    await syncCriteriaDrawerFromDashboard();
  } catch (error) {
    console.warn('Dashboard 판단근거 동기화 실패:', error);
  } finally {
    elements.criteriaDrawerBody?.removeAttribute('aria-busy');
  }
}

function closeCriteriaDrawer() {
  elements.criteriaDrawer.classList.remove('open');
  elements.criteriaBackdrop.classList.remove('open');
  elements.criteriaDrawer.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    elements.criteriaDrawer.hidden = true;
    elements.criteriaBackdrop.hidden = true;
  }, 180);
}

async function deleteCurrentRecord() {
  if (!recordId || !currentRecord) return;
  const summary = currentRecord.json_summary || {};
  const table = currentRecord.structured_table || {};
  const asset = displayValue(summary.asset_name || table.asset_name, recordId);
  const company = displayValue(summary.company || table.company, 'Company unknown');
  const confirmed = window.confirm(
    `${asset} · ${company} Simple Research record를 삭제할까요?\n\n저장된 대시보드 레코드와 연결된 Obsidian 문서가 함께 갱신됩니다.`
  );
  if (!confirmed) return;

  elements.loadStatus.textContent = 'Deleting';
  elements.deleteRecordButton.disabled = true;
  try {
    const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '삭제에 실패했습니다.');
    elements.loadStatus.textContent = 'Deleted';
    window.location.href = '/?tab=triage';
  } catch (error) {
    elements.loadStatus.textContent = 'Delete failed';
    elements.deleteRecordButton.disabled = false;
    window.alert(`삭제 실패: ${error.message}`);
  }
}

async function refreshTriageRubric(button) {
  if (!currentRecord || !recordId || !button) return;
  const user = await requireAuth();
  if (!user?.is_admin && !user?.is_developer) {
    await showTriageActionFailureDialog(
      'Score 기준 갱신을 실행할 수 없습니다',
      'Score 기준 갱신은 Developer 또는 관리자 권한이 필요합니다. 로그인한 계정의 권한을 확인해 주세요.'
    );
    return;
  }
  button.disabled = true;
  button.classList.add('is-saving');
  const closeProgress = showTriageProgress(
    '최신 기준으로 업데이트 중입니다',
    '최신 Simple Research 기준으로 기존 근거와 점수를 다시 확인하고 있습니다.'
  );
  let failureShown = false;
  try {
    const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/reassess-rubric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.detail || 'Score 기준 갱신에 실패했습니다.';
      failureShown = true;
      await showTriageActionFailureDialog('Score 기준 갱신에 실패했습니다', message);
      throw new Error(message);
    }
    if (!data.record || data.status === 'error' || data.status === 'conflict') {
      const message = data.message || 'Score 기준 갱신을 완료하지 못했습니다.';
      failureShown = true;
      await showTriageActionFailureDialog('Score 기준 갱신에 실패했습니다', message);
      throw new Error(message);
    }
    if (data.record) {
      currentRecord = data.record;
      renderRecord(currentRecord);
    }
    const outcome = triageRubricRefreshOutcomeCopy(data, '3.7');
    elements.loadStatus.textContent = outcome.message;
    void showTriageActionOutcomeToast(outcome.title, outcome.message, 'FILTER 1');
  } catch (error) {
    if (!failureShown) {
      await showTriageActionFailureDialog('Score 기준 갱신에 실패했습니다', error.message || '예상하지 못한 오류가 발생했습니다.');
    }
  } finally {
    closeProgress();
    if (button.isConnected) {
      button.disabled = false;
      button.classList.remove('is-saving');
    }
  }
}

async function loadRecord() {
  if (!recordId) throw new Error('Simple Research record id가 없습니다.');
  const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  renderRecord(data.record);
  elements.loadStatus.textContent = 'Loaded';
}

elements.criteriaDrawerButton?.addEventListener('click', openCriteriaDrawer);
elements.criteriaDrawerClose?.addEventListener('click', closeCriteriaDrawer);
elements.criteriaLanguageToggle?.querySelectorAll('[data-criteria-language]').forEach((button) => {
  button.addEventListener('click', () => applyCriteriaGuideLanguage(button.dataset.criteriaLanguage));
});
elements.criteriaBackdrop?.addEventListener('click', closeCriteriaDrawer);
elements.deleteRecordButton?.addEventListener('click', deleteCurrentRecord);
elements.websiteButton?.addEventListener('click', () => {
  const url = String(elements.websiteButton.dataset.websiteUrl || '');
  if (!url) return;
  if (websiteOpenTimer) window.clearTimeout(websiteOpenTimer);
  websiteOpenTimer = window.setTimeout(() => {
    websiteOpenTimer = null;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, 220);
});
elements.websiteButton?.addEventListener('dblclick', (event) => {
  event.preventDefault();
  openPipelineWebsiteModal();
});
elements.pipelineWebsiteCancel?.addEventListener('click', closePipelineWebsiteModal);
elements.pipelineWebsiteSave?.addEventListener('click', savePipelineWebsite);
elements.pipelineWebsiteModal?.addEventListener('click', (event) => {
  if (event.target === elements.pipelineWebsiteModal) closePipelineWebsiteModal();
});
elements.pipelineWebsiteInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); savePipelineWebsite(); }
  if (event.key === 'Escape') closePipelineWebsiteModal();
});
elements.scoreGrid?.addEventListener('change', (event) => {
  const select = event.target.closest('[data-triage-score-select]');
  if (select && currentUserIsAdmin()) saveTriageScore(select);
});
elements.scoreGrid?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-triage-score-edit]');
  if (button) openTriageScoreInlineEditor(button);
});
elements.scoreGrid?.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const button = event.target.closest('[data-triage-score-edit]');
  if (!button) return;
  event.preventDefault();
  openTriageScoreInlineEditor(button);
});
elements.scoreGrid?.addEventListener('click', (event) => {
  const panel = event.target.closest('[data-triage-score-notes]');
  if (!panel) return;
  if (event.target.closest('[data-triage-score-note-open]')) {
    const form = panel.querySelector('[data-triage-score-note-form]');
    if (form) delete form.dataset.noteId;
    openTriageInlineForm(form);
    return;
  }
  if (event.target.closest('[data-triage-score-note-cancel]')) {
    const form = panel.querySelector('[data-triage-score-note-form]');
    if (form) {
      form.reset();
      form.hidden = true;
    }
  }
  const deleteButton = event.target.closest('[data-triage-score-note-delete]');
  if (deleteButton) {
    const noteId = String(deleteButton.dataset.noteId || '');
    if (!noteId) return;
    confirmTriageCommentDelete().then((confirmed) => {
      if (confirmed) deleteTriageScoreNote(noteId).catch((error) => window.alert(error.message));
    });
  }
});
elements.scoreGrid?.addEventListener('dblclick', (event) => {
  const note = event.target.closest('[data-triage-score-note-edit]');
  if (!note || event.target.closest('button, textarea')) return;
  const panel = note.closest('[data-triage-score-notes]');
  const form = panel?.querySelector('[data-triage-score-note-form]');
  if (!form) return;
  event.preventDefault();
  form.dataset.noteId = note.dataset.noteId || '';
  const textarea = form.querySelector('textarea');
  if (textarea) textarea.value = note.dataset.noteBody || '';
  openTriageInlineForm(form);
});
elements.scoreGrid?.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-triage-score-note-form]');
  if (!form) return;
  event.preventDefault();
  const panel = form.closest('[data-triage-score-notes]');
  const body = String(form.querySelector('textarea')?.value || '').trim();
  const status = form.querySelector('[data-triage-score-note-status]');
  if (!panel || !body) return;
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  if (status) status.textContent = '저장 중…';
  try {
    await saveTriageScoreNote(panel, body, form.dataset.noteId || '');
  } catch (error) {
    if (status) status.textContent = error.message;
  } finally {
    if (submit) submit.disabled = false;
  }
});
elements.quickSummary?.addEventListener('click', (event) => {
  const rubricRefresh = event.target.closest('[data-triage-rubric-refresh]');
  if (rubricRefresh) {
    refreshTriageRubric(rubricRefresh);
    return;
  }
  const deleteFinalPost = event.target.closest('[data-triage-final-post-delete]');
  if (deleteFinalPost) {
    confirmTriageCommentDelete({ title: '최종 코멘트를 삭제할까요?' }).then((confirmed) => {
      if (confirmed) deleteTriageFinalComment(deleteFinalPost.dataset.commentId).catch((error) => window.alert(error.message));
    });
    return;
  }
  if (event.target.closest('[data-triage-final-post-edit-cancel]')) {
    const form = event.target.closest('[data-triage-final-post-edit-form]');
    if (form) form.hidden = true;
    return;
  }
  const deleteContact = event.target.closest('[data-triage-contact-history-delete]');
  if (deleteContact) {
    confirmTriageCommentDelete({ title: 'Contact History를 삭제할까요?' }).then((confirmed) => {
      if (confirmed) deleteTriageContactHistory(deleteContact.dataset.commentId).catch((error) => window.alert(error.message));
    });
    return;
  }
  if (event.target.closest('[data-triage-contact-history-edit-cancel]')) {
    const form = event.target.closest('[data-triage-contact-history-edit-form]');
    if (form) form.hidden = true;
    return;
  }
  if (event.target.closest('[data-triage-contact-history-open]')) {
    openTriageInlineForm(elements.quickSummary.querySelector('[data-triage-contact-history-form]'));
    return;
  }
  if (event.target.closest('[data-triage-contact-history-cancel]')) {
    const form = elements.quickSummary.querySelector('[data-triage-contact-history-form]');
    if (form) form.hidden = true;
    return;
  }
  if (event.target.closest('[data-triage-final-comment-open]')) {
    openTriageInlineForm(elements.quickSummary.querySelector('[data-triage-final-comment-form]'));
    return;
  }
  if (event.target.closest('[data-triage-final-comment-cancel]')) {
    const form = elements.quickSummary.querySelector('[data-triage-final-comment-form]');
    if (form) form.hidden = true;
  }
  if (event.target.closest('[data-triage-final-comment-delete]')) {
    confirmTriageCommentDelete({ title: '최종 코멘트를 삭제할까요?' }).then((confirmed) => {
      if (confirmed) updateTriageManualReview({ kind: 'final_comment_delete' }).catch((error) => window.alert(error.message));
    });
  }
});
elements.quickSummary?.addEventListener('dblclick', (event) => {
  const listingSource = event.target.closest('[data-listing-source-field]');
  if (listingSource && !event.target.closest('button, textarea, form')) {
    event.preventDefault();
    openListingSourceManagement(listingSource.dataset.listingSourceField);
    return;
  }
  const finalPost = event.target.closest('[data-triage-final-post-edit]');
  if (finalPost && !event.target.closest('button, textarea, form')) {
    event.preventDefault();
    const form = finalPost.querySelector('[data-triage-final-post-edit-form]');
    if (form) openTriageInlineForm(form);
    return;
  }
  const contact = event.target.closest('[data-triage-contact-history-edit]');
  if (contact && !event.target.closest('button, textarea, form')) {
    event.preventDefault();
    const form = contact.querySelector('[data-triage-contact-history-edit-form]');
    if (form) openTriageInlineForm(form);
    return;
  }
  const comment = event.target.closest('[data-triage-final-comment-edit]');
  if (!comment || event.target.closest('button, textarea')) return;
  event.preventDefault();
  openTriageInlineForm(elements.quickSummary.querySelector('[data-triage-final-comment-form]'));
});
elements.quickSummary?.addEventListener('submit', async (event) => {
  const editFinalPostForm = event.target.closest('[data-triage-final-post-edit-form]');
  if (editFinalPostForm) {
    event.preventDefault();
    const value = String(editFinalPostForm.querySelector('textarea')?.value || '').trim();
    const status = editFinalPostForm.querySelector('[data-triage-final-post-status]');
    if (!value) return;
    try {
      await updateTriageFinalComment(editFinalPostForm.dataset.commentId, value);
    } catch (error) {
      if (status) status.textContent = error.message;
    }
    return;
  }
  const editContactForm = event.target.closest('[data-triage-contact-history-edit-form]');
  if (editContactForm) {
    event.preventDefault();
    const value = String(editContactForm.querySelector('textarea')?.value || '').trim();
    const status = editContactForm.querySelector('[data-triage-contact-history-status]');
    const submit = editContactForm.querySelector('button[type="submit"]');
    if (!value) return;
    if (submit) submit.disabled = true;
    try {
      await updateTriageContactHistory(editContactForm.dataset.commentId, value);
    } catch (error) {
      if (status) status.textContent = error.message;
      if (submit) submit.disabled = false;
    }
    return;
  }
  const contactForm = event.target.closest('[data-triage-contact-history-form]');
  if (contactForm) {
    event.preventDefault();
    const value = String(contactForm.querySelector('textarea')?.value || '').trim();
    const status = contactForm.querySelector('[data-triage-contact-history-status]');
    const submit = contactForm.querySelector('button[type="submit"]');
    if (!value) return;
    if (submit) submit.disabled = true;
    if (status) status.textContent = '저장 중…';
    try {
      await saveTriageContactHistory(value);
    } catch (error) {
      if (status) status.textContent = error.message;
    } finally {
      if (submit) submit.disabled = false;
    }
    return;
  }
  const form = event.target.closest('[data-triage-final-comment-form]');
  if (!form || !currentUserIsAdmin()) return;
  event.preventDefault();
  const value = String(form.querySelector('textarea')?.value || '').trim();
  const status = form.querySelector('[data-triage-final-comment-status]');
  const submit = form.querySelector('button[type="submit"]');
  if (!value) return;
  if (submit) submit.disabled = true;
  if (status) status.textContent = '저장 중…';
  try {
    await saveTriageFinalComment(value);
  } catch (error) {
    if (status) status.textContent = error.message;
  } finally {
    if (submit) submit.disabled = false;
  }
});
window.addEventListener('skbp:authchange', () => {
  if (currentRecord) renderRecord(currentRecord);
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.criteriaDrawer?.classList.contains('open')) {
    closeCriteriaDrawer();
  }
});

setupThemeToggle();
initPageJumpControls();
initAuthUI();
syncCriteriaDrawerFromDashboard().catch((error) => {
  console.warn('Dashboard 판단근거 사전 로드 실패:', error);
});
loadRecord().catch((error) => {
  elements.loadStatus.textContent = 'Load failed';
  elements.title.textContent = 'Simple : Load failed';
  elements.subtitle.textContent = error.message;
  elements.decisionHero.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
