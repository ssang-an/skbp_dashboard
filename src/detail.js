import { setupThemeToggle } from './theme.js';

import { initFloatingAgent } from './floating-agent.js?v=20260801-draggable-launcher-1';
import { getCurrentUser, initAuthUI, openAuthModal, requireAuth } from './auth.js?v=20260802-required-login-1';
import { expandCompactInputRecord } from './compact-ingestion.js?v=20260805-compact-v1';

const params = new URLSearchParams(window.location.search);
const recordId = params.get('id');
const viewTab = params.get('tab'); // 'full' | 'focus' | null — which dashboard tab this record was opened from

function detailUrlForCurrentRecord() {
  const query = new URLSearchParams({ id: currentRecordId });
  if (viewTab) query.set('tab', viewTab);
  return `/detail?${query.toString()}`;
}

const DETAIL_CHAT_SESSION_PREFIX = 'skbp.detail.chatSessions.v1';
const DETAIL_CHAT_ACTIVE_PREFIX = 'skbp.detail.activeChatSession.v1';
const DETAIL_COMMENT_AUTHOR_KEY = 'skbp.detail.commentAuthor';

function getStoredIdentity() {
  return getCurrentUser()?.name || '';
}

function setStoredIdentity(name) {
  renderCommentIdentity();
}

function renderCommentIdentity() {
  if (!elements.detailCommentIdentity) return;
  const identity = getStoredIdentity();
  elements.detailCommentIdentity.textContent = identity
    ? `${identity}님으로 작성 중`
    : '이름이 설정되지 않았습니다';
}

let identityPromptResolve = null;

function openIdentityModal() {
  if (!elements.identityModalBackdrop) return Promise.resolve(null);
  return new Promise((resolve) => {
    identityPromptResolve = resolve;
    if (elements.identityModalInput) elements.identityModalInput.value = getStoredIdentity();
    elements.identityModalBackdrop.hidden = false;
    elements.identityModalInput?.focus();
  });
}

function closeIdentityModal(result) {
  if (elements.identityModalBackdrop) elements.identityModalBackdrop.hidden = true;
  if (identityPromptResolve) {
    const resolve = identityPromptResolve;
    identityPromptResolve = null;
    resolve(result);
  }
}

async function ensureIdentity() {
  const user = await requireAuth();
  renderCommentIdentity();
  return user?.name || null;
}

const elements = {
  detailBackLink: document.querySelector('#detailBackLink'),
  title: document.querySelector('#detailTitle'),
  subtitle: document.querySelector('#detailSubtitle'),
  detailMetaInfo: document.querySelector('#detailMetaInfo'),
  detailEditHistory: document.querySelector('#detailEditHistory'),
  sourceReportViewer: document.querySelector('#sourceReportViewer'),
  detailOutlineList: document.querySelector('#detailOutlineList'),
  detailFocusToggle: document.querySelector('#detailFocusToggle'),
  detailReviewInfoStack: document.querySelector('#detailReviewInfoStack'),
  detailReviewInfoToggle: document.querySelector('#detailReviewInfoToggle'),
  detailFilter2Row: document.querySelector('#detailFilter2Row'),
  detailActionDate: document.querySelector('#detailActionDate'),
  detailActionOwner: document.querySelector('#detailActionOwner'),
  detailActionPlan: document.querySelector('#detailActionPlan'),
  detailDecisionStatus: document.querySelector('#detailDecisionStatus'),
  detailDecisionOrigin: document.querySelector('#detailDecisionOrigin'),
  rubricRefreshButton: document.querySelector('#rubricRefreshButton'),
  detailTotalScore: document.querySelector('#detailTotalScore'),
  detailScoreSequence: document.querySelector('#detailScoreSequence'),
  detailReviewSummary: document.querySelector('#detailReviewSummary'),
  detailReviewReasonShell: document.querySelector('#detailReviewReasonShell'),
  detailOiPartnershipRow: document.querySelector('#detailOiPartnershipRow'),
  detailOiPartnershipOrigin: document.querySelector('#detailOiPartnershipOrigin'),
  oiPartnershipRefreshButton: document.querySelector('#oiPartnershipRefreshButton'),
  detailOiPartnershipType: document.querySelector('#detailOiPartnershipType'),
  detailOiPartnershipNoteShell: document.querySelector('#detailOiPartnershipNoteShell'),
  detailOiPartnershipNote: document.querySelector('#detailOiPartnershipNote'),
  detailOiMaterialFlags: document.querySelector('#detailOiMaterialFlags'),
  detailOiMaterialButtons: document.querySelectorAll('.oi-material-toggle[data-material-key]'),
  detailCollaborationStatus: document.querySelector('#detailCollaborationStatus'),
  detailCommentCount: document.querySelector('#detailCommentCount'),
  detailCommentThread: document.querySelector('#detailCommentThread'),
  detailCommentForm: document.querySelector('#detailCommentForm'),
  detailCommentIdentity: document.querySelector('#detailCommentIdentity'),
  detailCommentIdentityChange: document.querySelector('#detailCommentIdentityChange'),
  identityModalBackdrop: document.querySelector('#identityModalBackdrop'),
  identityModalInput: document.querySelector('#identityModalInput'),
  identityModalCancel: document.querySelector('#identityModalCancel'),
  identityModalSubmit: document.querySelector('#identityModalSubmit'),
  detailCommentInput: document.querySelector('#detailCommentInput'),
  detailCommentSubmit: document.querySelector('#detailCommentSubmit'),
  detailReplyContext: document.querySelector('#detailReplyContext'),
  detailReplyLabel: document.querySelector('#detailReplyLabel'),
  detailReplyParentId: document.querySelector('#detailReplyParentId'),
  detailReplyCancel: document.querySelector('#detailReplyCancel'),
  detailAttachmentAddButton: document.querySelector('#detailAttachmentAddButton'),
  detailAttachmentInput: document.querySelector('#detailAttachmentInput'),
  detailAttachmentDropzone: document.querySelector('#detailAttachmentDropzone'),
  detailAttachmentCount: document.querySelector('#detailAttachmentCount'),
  detailAttachmentsList: document.querySelector('#detailAttachmentsList'),
  detailAttachmentAiScope: document.querySelector('#detailAttachmentAiScope'),
  detailAttachmentStatus: document.querySelector('#detailAttachmentStatus'),
  detailViewerTitle: document.querySelector('#detailViewerTitle'),
  detailViewerBackGroup: document.querySelector('#detailViewerBackGroup'),
  detailViewerBackButton: document.querySelector('#detailViewerBackButton'),
  detailAttachmentOriginalActions: document.querySelector('#detailAttachmentOriginalActions'),
  detailViewerOpenWindowButton: document.querySelector('#detailViewerOpenWindowButton'),
  detailViewerCopyButton: document.querySelector('#detailViewerCopyButton'),
  reportModalBackdrop: document.querySelector('#reportModalBackdrop'),
  reportModalBody: document.querySelector('#reportModalBody'),
  reportModalCloseButton: document.querySelector('#reportModalCloseButton'),
  reportModalCopyButton: document.querySelector('#reportModalCopyButton'),
  qualitativeReviewPanel: document.querySelector('#qualitativeReviewPanel'),
  detailAiButton: document.querySelector('#detailAiButton'),
  criteriaDrawerButton: document.querySelector('#criteriaDrawerButton'),
  criteriaDrawer: document.querySelector('#criteriaDrawer'),
  criteriaBackdrop: document.querySelector('#criteriaBackdrop'),
  criteriaDrawerClose: document.querySelector('#criteriaDrawerClose'),
  criteriaDrawerScopeLabel: document.querySelector('#criteriaDrawerScopeLabel'),
  criteriaDrawerBody: document.querySelector('#criteriaDrawerBody'),
  deleteRecordButton: document.querySelector('#deleteRecordButton'),
  detailReuploadButton: document.querySelector('#detailReuploadButton'),
  aiDrawer: document.querySelector('#aiDrawer'),
  aiDrawerClose: document.querySelector('#aiDrawerClose'),
  chatContextAsset: document.querySelector('#chatContextAsset'),
  chatContextScore: document.querySelector('#chatContextScore'),
  chatSessionSelect: document.querySelector('#chatSessionSelect'),
  chatNewSessionButton: document.querySelector('#chatNewSessionButton'),
  chatDeleteSessionButton: document.querySelector('#chatDeleteSessionButton'),
  messages: document.querySelector('#chatMessages'),
  form: document.querySelector('#chatForm'),
  input: document.querySelector('#chatInput'),
  editButton: document.querySelector('#editJsonButton'),
  editDrawer: document.querySelector('#editDrawer'),
  editBackdrop: document.querySelector('#editBackdrop'),
  editDrawerClose: document.querySelector('#editDrawerClose'),
  jsonEditor: document.querySelector('#jsonEditor'),
  saveJsonEditButton: document.querySelector('#saveJsonEditButton'),
  formatJsonButton: document.querySelector('#formatJsonButton'),
  editStatus: document.querySelector('#editStatus'),
  reportReuploadBackdrop: document.querySelector('#reportReuploadBackdrop'),
  reportReuploadClose: document.querySelector('#reportReuploadClose'),
  reportReuploadInput: document.querySelector('#reportReuploadInput'),
  reportReuploadValidation: document.querySelector('#reportReuploadValidation'),
  reportReuploadReview: document.querySelector('#reportReuploadReview'),
  reportReuploadSave: document.querySelector('#reportReuploadSave')
};

if (elements.detailBackLink && viewTab) {
  elements.detailBackLink.href = `/?${new URLSearchParams({ tab: viewTab }).toString()}`;
}

const scoringLabels = {
  target_relevance: 'Target Relevance',
  competitive_landscape: 'Competitive Landscape',
  moa_validity: 'MoA Validity',
  platform_attractiveness: 'Platform Attractiveness',
  expansion_potential: 'Expansion Potential',
  data_maturity: 'Data Maturity',
  marketability: 'Marketability'
};

const scoringFirstWord = Object.fromEntries(
  Object.entries(scoringLabels).map(([criterionId, label]) => [criterionId, label.split(' ')[0]])
);

function scoreChipTone(score, max = 3) {
  if (score === null || score === undefined) return 'pending';
  return score >= max ? 'high' : score >= max * 0.6 ? 'mid' : 'low';
}

// Fixed base criteria — keep in sync with main.py's QUALITATIVE_REVIEW_CRITERIA
// and config/qualitative_review_criteria.md. Additional per-record criteria can be
// registered by users at runtime and are stored in meta.qualitative_review.custom_criteria.
const qualitativeReviewCriteria = [
  {
    id: 'efficacy',
    legacyIds: ['scientific_rigor'],
    label: 'Efficacy',
    description: '% Reversal(정상군 대비 회복율) 및 SoC 대비 통계적 유의성(p-value) 있는 개선 우위 확인'
  },
  {
    id: 'commercial_appeal',
    label: 'Commercial',
    description: 'L-IN / L-OUT 파트너사 관점에서의 TPP 매력도, Unmet Need 충족 및 시장 차별성 평가'
  },
  {
    id: 'execution_risk',
    label: 'Dev. & Partnership Risk',
    description: '임상/안전성/CMC 진행 시 주요 리스크, 불확실성 및 Due Diligence(DD) 추가 확인 필요 사항'
  }
];

let currentRecord = null;
let currentRecordId = recordId;
let activeAttachmentId = '';
let attachmentPreviewController = null;
let activeReportJumpHeading = null;
let reportJumpHighlightTimer = null;
let chatSessions = [];
let activeChatSessionId = '';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function syncMessageComposer(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  const styles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
  const verticalChrome = [
    styles.paddingTop,
    styles.paddingBottom,
    styles.borderTopWidth,
    styles.borderBottomWidth
  ].reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
  const minHeight = Math.ceil(lineHeight + verticalChrome);
  const maxHeight = Math.ceil(lineHeight * 3 + verticalChrome);

  textarea.style.height = 'auto';
  const contentHeight = textarea.value ? Math.max(textarea.scrollHeight, minHeight) : minHeight;
  const shouldScroll = Boolean(textarea.value) && contentHeight > maxHeight + 1;
  textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`;
  textarea.style.overflowY = shouldScroll ? 'auto' : 'hidden';
  textarea.classList.toggle('has-scroll', shouldScroll);

  const submitButton = textarea.closest('form')?.querySelector('.message-send-button');
  if (submitButton && submitButton.dataset.saving !== 'true') {
    submitButton.disabled = !textarea.value.trim();
  }
}

function dashboardThemeLabel(value) {
  const text = String(value || '').trim();
  if (!text || text === '-' || /^(unknown|not known|n\/?a)$/i.test(text)) return 'Unknown';
  if (/e\s*\/\s*i\s*balance|excitation.*inhibition/i.test(text)) return 'E/I Balance';
  if (/neuro[\s-]*immune/i.test(text)) return 'Neuroimmune';
  return 'Others';
}

function dashboardClusterLabel(value, theme = '') {
  const text = String(value || '').trim();
  if (!text || text === '-' || /^(unknown|not known)$/i.test(text)) return 'Unknown';
  if (/^n\/?a$/i.test(text)) return dashboardThemeLabel(theme) === 'Others' ? 'Others' : 'Unknown';
  if (/^others?$|no cluster|no mapped|no fit|out of scope|none/i.test(text)) return 'Others';
  return text;
}

function isPlaceholderRawMarkdown(value) {
  const text = String(value || '').trim();
  return !text
    || text === 'Paste the full Markdown report text here if available.'
    || text === 'Markdown report is provided separately in the MD copy box.';
}

function getRubricMetadata(record) {
  const meta = record?.meta || {};
  const criteriaReference = record?.scoring?.criteria?.target_relevance?.criteria_reference || null;
  // New v3.2/v3.3 outputs always carry meta.rubric_version. Keep the historical
  // fallback conservative so a legacy record without provenance is never
  // mislabeled as having been researched under the newest instruction.
  const fallbackVersion = meta.schema_version || '3.1';
  const version = meta.rubric_version
    || criteriaReference?.criteria_version
    || criteriaReference?.version
    || fallbackVersion;
  const author = meta.rubric_author
    || meta.author
    || criteriaReference?.criteria_author
    || 'kate';

  return { version, author };
}

function getDisplayRubricVersion(record) {
  return getRubricMetadata(record).version;
}

function getDisplayRubricAuthor(record) {
  return getRubricMetadata(record).author;
}

function isFastTriageRecord(record) {
  const reviewType = String(record?.meta?.review_type || '').toLowerCase();
  const parserStatus = String(record?.source_report?.parser_status || '').toLowerCase();
  const sourceFormat = String(record?.source_report?.source_format || '').toLowerCase();
  return reviewType === 'fast_triage'
    || parserStatus.includes('triage')
    || sourceFormat.includes('fast_triage')
    || Boolean(record?.triage);
}

function prettifyKey(key) {
  return key.replaceAll('_', ' ');
}

function renderPrimitive(value) {
  if (value === null) return '<span class="json-null">null</span>';
  if (typeof value === 'number') return `<span class="json-number">${value}</span>`;
  if (typeof value === 'boolean') return `<span class="json-bool">${value}</span>`;
  return `<span>${escapeHtml(value)}</span>`;
}

function renderValue(value, depth = 0) {
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="json-empty">[]</span>';
    return `
      <div class="json-array">
        ${value
          .map((item, index) => `
            <div class="json-array-item">
              <span class="json-index">${index + 1}</span>
              <div>${renderValue(item, depth + 1)}</div>
            </div>
          `)
          .join('')}
      </div>
    `;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '<span class="json-empty">{}</span>';
    return `
      <div class="json-object depth-${Math.min(depth, 3)}">
        ${entries
          .map(([key, item]) => `
            <div class="json-row">
              <div class="json-key">${escapeHtml(prettifyKey(key))}</div>
              <div class="json-value">${renderValue(item, depth + 1)}</div>
            </div>
          `)
          .join('')}
      </div>
    `;
  }

  return renderPrimitive(value);
}

function formatScore(value) {
  return value === null || value === undefined ? '-' : value;
}

function formatCriterionScore(value) {
  return value === null || value === undefined ? '미평가' : `${value}점`;
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function collectHardFilterNotes(record) {
  const hardFilter = record.hard_filter || {};
  const criteria = record.scoring?.criteria || {};
  const notes = [
    hardFilter.status,
    hardFilter.overall_result,
    hardFilter.reason,
    ...(Array.isArray(hardFilter.flags) ? hardFilter.flags : []),
    ...(Array.isArray(hardFilter.fail_reasons) ? hardFilter.fail_reasons : []),
    record.structured_table?.development_stage,
    record.json_summary?.theme,
    record.json_summary?.cluster
  ];

  Object.values(criteria).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    notes.push(item.main_line_summary, item.investigation_note);
    if (Array.isArray(item.uncertain_points)) notes.push(...item.uncertain_points);
  });

  return notes.filter(Boolean).join(' | ');
}

function hasAffirmedHardBlocker(notes) {
  const blockerPattern = /(\boutside\s+(?:the\s+)?(?:primary\s+)?(?:therapeutic\s+area|indication|disease)\s+scope\b|\bout\s+of\s+(?:therapeutic|indication|disease)\s+scope\b|\bno\s+public\s+target\b|\bno\b[^|.;\n]{0,48}\btarget\s*\/\s*moa\b|\basset\s+identity\s+(?:is\s+)?(?:not\s+verified|unverified)\b|\b(?:discontinued|terminated|withdrawn|suspended|dormant|inactive|clearly\s+failed)\b|(?:관심\s*)?(?:질환|적응증|치료\s*영역)\s*범위\s*밖|자산\s*식별\s*불가|(?:개발|프로그램|임상)\s*(?:이\s*)?(?:중단|종료|철회|휴면|비활성))/i;
  return String(notes || '').split('|').some((segment) => {
    const match = blockerPattern.exec(segment);
    if (!match) return false;
    const prefix = segment.slice(Math.max(0, match.index - 28), match.index);
    const suffix = segment.slice(match.index + match[0].length, match.index + match[0].length + 20);
    if (/\b(?:not|without|never)\b[^.;\n]{0,20}$|(?:아니|없)는?\s*$/i.test(prefix)) return false;
    if (/^\s*(?:없(?:음|다)?|아님|아니|not\b|false\b)/i.test(suffix)) return false;
    return true;
  });
}

function hasScopedFullScoutReviewUncertainty(notes) {
  const text = String(notes || '');
  const subject = '(?:stage|rights?|licen[cs]e|ownership|asset\\s+identity|source|registry|sponsor)';
  const uncertainty = '(?:unclear|uncertain|unknown|unverified|unconfirmed|ambiguous|not\\s+(?:public(?:ly\\s+available)?|verified|confirmed|clear|established)|(?:could\\s+not|cannot|unable\\s+to)\\s+(?:be\\s+)?(?:verify|verified|confirm|confirmed|establish|established|identify|identified)|(?:pending|requires?|needs?)\\s+(?:independent\\s+)?(?:verification|confirmation)|(?:verification|confirmation)\\s+(?:is\\s+)?(?:required|needed|pending))';
  const english = new RegExp(`\\b${subject}\\b[^|.;\\n]{0,64}\\b${uncertainty}\\b|\\b${uncertainty}\\b[^|.;\\n]{0,64}\\b${subject}\\b`, 'i');
  const koreanSubject = '(?:개발\\s*단계|단계|권리|라이선스|소유권|자산\\s*식별|출처|소스|레지스트리|스폰서)';
  const koreanUncertainty = '(?:불확실|불명확|미확인|확인\\s*(?:불가|필요)|검증\\s*(?:불가|필요)|자료\\s*(?:부족|없음))';
  const korean = new RegExp(`${koreanSubject}[^|.;\\n]{0,48}${koreanUncertainty}|${koreanUncertainty}[^|.;\\n]{0,48}${koreanSubject}`, 'i');
  return english.test(text) || korean.test(text);
}

function computeHardFilter(record) {
  const summary = record.json_summary || {};
  const criteria = record.scoring?.criteria || {};
  const total = number(record.scoring?.total_score);
  const targetScore = number(criteria.target_relevance?.score ?? summary.target_relevance_score);
  const moaScore = number(criteria.moa_validity?.score);
  const dataScore = number(criteria.data_maturity?.score);
  const notes = collectHardFilterNotes(record);
  const reasons = [];

  const failBlocker = hasAffirmedHardBlocker(notes);
  const reviewUncertainty = hasScopedFullScoutReviewUncertainty(notes);

  if (Number.isFinite(total) && total <= 8) reasons.push(`Total score ${total} <= 8`);
  if (Number.isFinite(targetScore) && targetScore <= 1) reasons.push(`Target Relevance ${targetScore} <= 1`);
  if (failBlocker) reasons.push('Hard blocker keyword detected');

  if (reasons.length) {
    return { status: 'FAIL', reason: reasons.join('; ') };
  }

  const passScores = total >= 14 && targetScore >= 3 && moaScore >= 2 && dataScore >= 2;
  if (passScores && !reviewUncertainty) {
    return {
      status: 'PASS',
      reason: `Total ${total} >= 14, TR ${targetScore} >= 3, MOA ${moaScore} >= 2, Data ${dataScore} >= 2, hard blocker 없음`
    };
  }

  if (Number.isFinite(total) && total >= 9 && total <= 13) {
    reasons.push(`Total score ${total} is REVIEW range 9-13`);
  }
  if (!passScores) {
    reasons.push(`PASS score gate 미충족: Total ${total ?? '-'}, TR ${targetScore ?? '-'}, MOA ${moaScore ?? '-'}, Data ${dataScore ?? '-'}`);
  }
  if (reviewUncertainty) {
    reasons.push('stage/rights/asset identity/source 불확실성 확인 필요');
  }

  return { status: 'REVIEW', reason: reasons.join('; ') || '추가 diligence 필요' };
}

function formatMillionUsd(value, unit = '') {
  if (value === null || value === undefined || value === '') return '-';
  const isMillionUnit = /million\s*usd/i.test(String(unit));
  if (typeof value === 'number') {
    const millionValue = isMillionUnit ? value : value / 1_000_000;
    return `USD ${millionValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  }

  const text = String(value).trim();
  const numeric = Number(text.replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return text;
  if (/\b(b|bn|billion)\b/i.test(text)) {
    return `USD ${(numeric * 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  }
  if (/\b(m|mn|million)\b/i.test(text)) {
    return `USD ${numeric.toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  }
  if (/usd|dollar|\$/i.test(text) && numeric >= 1_000_000) {
    return `USD ${(numeric / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  }
  return text;
}

function getRubricDefinition(record, key, score) {
  return record.rubric?.[key]?.score_definitions?.[String(score)] || '-';
}

function renderSourceLink(source, index) {
  if (!source || typeof source !== 'object') return '';
  const title = source.source_title || source.title || source.name || `Source ${index + 1}`;
  const url = source.source_url || source.url || source.link || '';
  const type = source.source_type || source.type || '-';
  const reliability = source.reliability || '-';
  const summary = source.evidence_summary || source.source_excerpt || source.summary || '';
  const relevance = source.relevance_to_assessment || source.relevance || '';
  const safeUrl = safeHttpUrl(url);
  const titleHtml = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`
    : `<span>${escapeHtml(title)}</span>`;

  return `
    <li class="source-link-item">
      <div>
        <strong>${titleHtml}</strong>
        <span>${escapeHtml(type)} · reliability ${escapeHtml(reliability)}</span>
      </div>
      ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
      ${relevance ? `<p>${escapeHtml(relevance)}</p>` : ''}
    </li>
  `;
}

function renderSourceList(sources = []) {
  const normalized = Array.isArray(sources) ? sources.filter((source) => source && typeof source === 'object') : [];
  if (!normalized.length) {
    return '<div class="empty-evidence">연결된 출처 링크가 없습니다. 원문 리포트의 evidence_sources에 URL을 추가하면 여기에 표시됩니다.</div>';
  }
  return `<ul class="source-link-list">${normalized.map(renderSourceLink).join('')}</ul>`;
}

function collectMarkdownReferenceSources(markdown = '') {
  const sources = [];
  const pattern = /^\[(\d+)\]:\s+(\S+)(?:\s+"([^"]+)")?/gm;
  let match = pattern.exec(markdown);
  while (match) {
    sources.push({
      source_id: `raw-report-ref-${match[1]}`,
      source_title: match[3] || `Raw report reference ${match[1]}`,
      source_url: match[2],
      source_type: 'raw_report_reference',
      reliability: 'Unclear',
      evidence_summary: 'Reference link extracted from the original GPT report.'
    });
    match = pattern.exec(markdown);
  }
  return sources;
}

function renderMarketabilityCalculation(calculation) {
  if (!calculation || typeof calculation !== 'object') return '';
  const stepA = calculation.A_targetable_addressable_patient || {};
  const stepB = calculation.B_unrisked_peak_sales || {};
  const stepC = calculation.C_obtainable_peak_sales || {};
  const entry = stepB.entry_order_share_assumption || {};

  return `
    <div class="market-calc">
      <h4>Marketability A/B/C Calculation</h4>
      <div class="calc-step">
        <strong>Commercial Rationale Gate</strong>
        <p>${escapeHtml(calculation.commercial_rationale_status || '-')}</p>
        ${calculation.commercial_rationale_failure_reason ? `<p>${escapeHtml(calculation.commercial_rationale_failure_reason)}</p>` : ''}
      </div>
      <div class="calc-step">
        <strong>A. TAP</strong>
        <p>${escapeHtml(stepA.formula || 'TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate')}</p>
        <dl>
          <div><dt>Total patient pool</dt><dd>${escapeHtml(formatScore(stepA.total_patient_pool))}</dd></div>
          <div><dt>Diagnosis rate</dt><dd>${escapeHtml(formatScore(stepA.diagnosis_rate))}</dd></div>
          <div><dt>Eligibility rate</dt><dd>${escapeHtml(formatScore(stepA.eligibility_rate))}</dd></div>
          <div><dt>Biomarker-positive</dt><dd>${escapeHtml(formatScore(stepA.biomarker_positive_rate))}</dd></div>
          <div><dt>TAP output</dt><dd>${escapeHtml(formatScore(stepA.targetable_addressable_patient))}</dd></div>
        </dl>
      </div>
      <div class="calc-step">
        <strong>B. Unrisked Peak Sales</strong>
        <p>${escapeHtml(stepB.formula || 'Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor')}</p>
        <dl>
          <div><dt>Annual net price</dt><dd>${escapeHtml(formatScore(stepB.annual_net_price))}</dd></div>
          <div><dt>Peak penetration</dt><dd>${escapeHtml(formatScore(stepB.peak_penetration))}</dd></div>
          <div><dt>Duration factor</dt><dd>${escapeHtml(formatScore(stepB.treatment_duration_factor))}</dd></div>
          <div><dt>Entry-order share</dt><dd>${escapeHtml(entry.matrix_share_reference || '-')}</dd></div>
          <div><dt>Unrisked sales</dt><dd>${escapeHtml(formatMillionUsd(stepB.unrisked_peak_sales, stepB.sales_unit))}</dd></div>
        </dl>
      </div>
      <div class="calc-step">
        <strong>C. Obtainable Peak Sales</strong>
        <p>${escapeHtml(stepC.formula || 'Obtainable Peak Sales = Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment')}</p>
        <dl>
          <div><dt>Competition haircut</dt><dd>${escapeHtml(formatScore(stepC.competition_haircut))}</dd></div>
          <div><dt>Pricing power</dt><dd>${escapeHtml(formatScore(stepC.pricing_power_adjustment))}</dd></div>
          <div><dt>Expansion capacity</dt><dd>${escapeHtml(formatScore(stepC.expansion_capacity_adjustment))}</dd></div>
          <div><dt>Obtainable sales</dt><dd>${escapeHtml(formatMillionUsd(stepC.obtainable_peak_sales, stepC.sales_unit))}</dd></div>
        </dl>
      </div>
    </div>
  `;
}

function extractImportantLine(markdown = '') {
  const lines = String(markdown || '').split(/\r?\n/);
  for (const line of lines.slice(0, 30)) {
    const cleaned = line.replace(/^>\s*/, '').trim();
    const match = cleaned.match(/^(?:중요|important)\s*[:：]\s*(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function buildFilterRationale(record, hardFilter) {
  const sourceImportantLine = extractImportantLine(record.source_report?.raw_markdown || '');
  const explicitReason = record.hard_filter?.reason || record.hard_filter?.overall_result || '';
  const insight = record.final_insight?.one_line_summary || record.json_summary?.one_line_summary || '';
  const reason = sourceImportantLine || explicitReason || insight || hardFilter.reason || 'Filter rationale is not available in this record.';
  const status = record.hard_filter?.status || hardFilter.status || '-';
  return { status, reason };
}

function renderFilterRationale(record, hardFilter) {
  const rationale = buildFilterRationale(record, hardFilter);
  return `
    <section class="filter-rationale-card">
      <div>
        <span>Filter rationale</span>
        <strong>${escapeHtml(rationale.status)}</strong>
      </div>
      <p>${escapeHtml(rationale.reason)}</p>
    </section>
  `;
}

function renderCompanyProfile(profile = {}) {
  const officialSources = Array.isArray(profile.official_source_urls) ? profile.official_source_urls : [];
  const focusAreas = Array.isArray(profile.focus_areas) && profile.focus_areas.length ? profile.focus_areas.join(', ') : '-';
  const aliases = Array.isArray(profile.aliases) && profile.aliases.length ? profile.aliases.join(', ') : '-';
  const signals = Array.isArray(profile.financing_or_partnership_signals) && profile.financing_or_partnership_signals.length
    ? profile.financing_or_partnership_signals
        .map((signal) => `<li>${escapeHtml(signal.summary || signal.title || JSON.stringify(signal))}</li>`)
        .join('')
    : '<li>확인된 financing / partnership signal 없음</li>';
  const websiteUrl = safeHttpUrl(profile.website);

  return `
    <section class="company-profile-card">
      <div class="score-card-header">
        <div>
          <span>Company Profile</span>
          <h3>${escapeHtml(profile.company_name || '-')}</h3>
        </div>
        ${websiteUrl ? `<strong><a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">Official website</a></strong>` : '<strong>Official website 확인 필요</strong>'}
      </div>
      <div class="company-profile-grid">
        <div><span>Legal / aliases</span><strong>${escapeHtml(profile.legal_name || aliases)}</strong></div>
        <div><span>Country</span><strong>${escapeHtml(profile.country || '-')}</strong></div>
        <div><span>Headquarters</span><strong>${escapeHtml(profile.headquarters || '-')}</strong></div>
        <div><span>Company stage</span><strong>${escapeHtml(profile.company_stage || '-')}</strong></div>
        <div><span>Focus areas</span><strong>${escapeHtml(focusAreas)}</strong></div>
        <div><span>Ownership</span><strong>${escapeHtml(profile.ownership_status || '-')}</strong></div>
      </div>
      <div class="score-evidence-block">
        <h4>Platform / Lead Pipeline</h4>
        <p>${escapeHtml(profile.platform_summary || '-')}</p>
        <p>${escapeHtml(profile.lead_pipeline_summary || '-')}</p>
      </div>
      <div class="score-evidence-block">
        <h4>Financing / Partnership Signals</h4>
        <ul>${signals}</ul>
      </div>
      <div class="score-evidence-block">
        <h4>Official Company Sources</h4>
        ${renderSourceList(officialSources)}
      </div>
    </section>
  `;
}

function collectGlobalSources(record) {
  const sources = [];
  const add = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (item && typeof item === 'object') sources.push(item);
    });
  };
  add(record.structured_table?.sources);
  add(record.validation?.source_registry);
  add(collectMarkdownReferenceSources(record.source_report?.raw_markdown || ''));
  Object.values(record.scoring?.criteria || {}).forEach((criterion) => add(criterion?.evidence_sources));
  const seen = new Set();
  return sources.filter((source) => {
    const key = `${source.source_title || source.title || ''}|${source.source_url || source.url || ''}|${source.evidence_summary || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderScoreEvidence(record) {
  const scoring = record.scoring || {};
  const criteria = scoring.criteria || {};
  const hardFilter = computeHardFilter(record);
  const cards = Object.entries(scoringLabels)
    .map(([key, label]) => {
      const item = criteria[key] || {};
      const score = item.score;
      const rubricDefinition = getRubricDefinition(record, key, score);
      const uncertain = Array.isArray(item.uncertain_points) && item.uncertain_points.length
        ? item.uncertain_points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')
        : '<li>별도 불확실성 메모 없음</li>';
      return `
        <article class="score-evidence-card">
          <div class="score-card-header">
            <div>
              <span>${escapeHtml(label)}</span>
              <h3>${escapeHtml(formatCriterionScore(score))}<small>최대 3점</small></h3>
            </div>
            <strong>${escapeHtml(rubricDefinition)}</strong>
          </div>
          <div class="score-evidence-block">
            <h4>Evidence Type</h4>
            <p>${escapeHtml(item.evidence_type || '-')}</p>
            <p>${escapeHtml(item.evidence_type_reason || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>판단 이유</h4>
            <p>${escapeHtml(item.main_line_summary || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>Why Not Higher</h4>
            <p>${escapeHtml(item.why_not_higher || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>조사 메모</h4>
            <p>${escapeHtml(item.investigation_note || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>불확실성 / 확인 필요</h4>
            <ul>${uncertain}</ul>
          </div>
          ${key === 'marketability' ? renderMarketabilityCalculation(item.calculation) : ''}
          <div class="score-evidence-block">
            <h4>출처 / Evidence 링크</h4>
            ${renderSourceList(item.evidence_sources)}
          </div>
        </article>
      `;
    })
    .join('');

  return `
    ${renderFilterRationale(record, hardFilter)}
    ${renderCompanyProfile(record.company_profile || {})}
    <div class="score-evidence-summary">
      <div><span>Total Score</span><strong>${escapeHtml(formatScore(scoring.total_score))} / ${escapeHtml(formatScore(scoring.max_score || 21))}</strong></div>
      <div><span>Pipeline Filter</span><strong>${escapeHtml(hardFilter.status)}</strong></div>
      <div><span>Rubric</span><strong>${escapeHtml(getDisplayRubricVersion(record))} · ${escapeHtml(getDisplayRubricAuthor(record))}</strong></div>
    </div>
    <div class="score-evidence-list">${cards}</div>
    <section class="score-evidence-card source-index-card">
      <div class="score-card-header">
        <div>
          <span>Source Index</span>
          <h3>전체 출처</h3>
        </div>
      </div>
      ${renderSourceList(collectGlobalSources(record))}
    </section>
  `;
}

function recordReviewStatus(record) {
  const override = record?.meta?.human_review?.overrides?.filter_status;
  const baseline = override || record?.hard_filter?.status || computeHardFilter(record).status;
  const normalized = String(baseline || '').trim().toUpperCase();
  return ['PASS', 'REVIEW', 'FAIL'].includes(normalized) ? normalized : 'REVIEW';
}

function collaborationComments(record) {
  const comments = record?.meta?.collaboration?.comments;
  return Array.isArray(comments) ? comments.filter((comment) => comment && comment.id) : [];
}

function formatCommentTime(value) {
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

function renderCommentNode(comment, childrenByParent, depth = 0, visited = new Set()) {
  if (visited.has(comment.id) || depth > 8) return '';
  const nextVisited = new Set(visited);
  nextVisited.add(comment.id);
  const replies = childrenByParent.get(comment.id) || [];
  const body = escapeHtml(comment.body || '').replaceAll('\n', '<br>');
  return `
    <article class="comment-card ${depth ? 'is-reply' : ''}" data-comment-id="${escapeHtml(comment.id)}">
      <div class="comment-meta">
        <strong>${escapeHtml(comment.author || '익명')}</strong>
        <time datetime="${escapeHtml(comment.created_at || '')}">${escapeHtml(formatCommentTime(comment.created_at))}</time>
      </div>
      <p>${body}</p>
      <button
        type="button"
        class="comment-reply-button"
        data-reply-comment-id="${escapeHtml(comment.id)}"
        data-reply-author="${escapeHtml(comment.author || '익명')}"
      >답글</button>
      ${replies.length ? `<div class="comment-replies">${replies.map((reply) => renderCommentNode(reply, childrenByParent, depth + 1, nextVisited)).join('')}</div>` : ''}
    </article>
  `;
}

function renderCommentThread(record) {
  if (!elements.detailCommentThread) return;
  const comments = collaborationComments(record);
  if (elements.detailCommentCount) {
    elements.detailCommentCount.textContent = String(comments.length);
    elements.detailCommentCount.setAttribute('aria-label', `댓글 ${comments.length}개`);
  }
  if (!comments.length) {
    elements.detailCommentThread.innerHTML = `
      <div class="comment-empty-state">
        <strong>아직 등록된 코멘트가 없습니다.</strong>
        <span>첫 검토 의견을 남겨 팀의 후속 판단을 시작하세요.</span>
      </div>
    `;
    return;
  }

  const byId = new Map(comments.map((comment) => [String(comment.id), comment]));
  const childrenByParent = new Map();
  const roots = [];
  comments.forEach((comment) => {
    const parentId = String(comment.parent_id || '');
    if (parentId && byId.has(parentId)) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(comment);
    } else {
      roots.push(comment);
    }
  });
  elements.detailCommentThread.innerHTML = roots
    .map((comment) => renderCommentNode(comment, childrenByParent))
    .join('');
}

function setCollaborationStatus(message = '', tone = '') {
  if (!elements.detailCollaborationStatus) return;
  elements.detailCollaborationStatus.textContent = message;
  elements.detailCollaborationStatus.dataset.tone = tone;
}

function conciseReviewSummary(record) {
  const manualReason = record?.meta?.human_review?.overrides?.status_reason;
  if (typeof manualReason === 'string') return manualReason;
  const finalInsight = record?.final_insight || {};
  const hardFilter = record?.hard_filter || {};
  const candidates = [
    finalInsight.one_line_summary,
    finalInsight.summary,
    hardFilter.reason,
    hardFilter.rationale,
    record?.json_summary?.one_line_summary
  ];
  const value = candidates.find((candidate) => String(candidate || '').trim());
  return String(value || '현재 공개자료와 점수 기준으로 담당자 검토가 필요한 파이프라인입니다.')
    .replace(/\s+/g, ' ')
    .trim();
}

function resizeReviewReasonInput() {
  const input = elements.detailReviewSummary;
  if (!input) return;
  const fixedHeight = 124;
  input.style.height = `${fixedHeight}px`;
  input.style.overflowY = input.scrollHeight > fixedHeight ? 'auto' : 'hidden';
}

function resizeOiPartnershipNoteInput() {
  const input = elements.detailOiPartnershipNote;
  if (!input) return;
  input.style.height = '34px';
  input.style.overflowY = input.scrollHeight > 34 ? 'auto' : 'hidden';
}

const reviewScoreOrder = [
  ['target_relevance', 'TR'],
  ['competitive_landscape', 'CL'],
  ['moa_validity', 'MoA'],
  ['platform_attractiveness', 'PA'],
  ['expansion_potential', 'EP'],
  ['data_maturity', 'DM'],
  ['marketability', 'MKT']
];

function hasManualReviewField(record, field) {
  const humanReview = record?.meta?.human_review || {};
  const overrides = humanReview.overrides || {};
  if (Object.prototype.hasOwnProperty.call(overrides, field)) return true;
  return Array.isArray(humanReview.history)
    && humanReview.history.some((entry) => String(entry?.field || '') === field);
}

function effectiveReviewScores(record) {
  const criteria = record?.scoring?.criteria || {};
  const reviewOverrides = record?.meta?.human_review?.overrides || {};
  const scoreOverrides = reviewOverrides.scores || {};
  const scores = reviewScoreOrder.map(([criterionId]) => {
    const override = scoreOverrides[criterionId];
    const rawValue = override !== undefined && override !== null
      ? override
      : criteria?.[criterionId]?.score;
    return rawValue === null || rawValue === undefined || rawValue === ''
      ? null
      : number(rawValue);
  });
  const totalOverride = reviewOverrides.total_score;
  const total = totalOverride === null || totalOverride === undefined || totalOverride === ''
    ? number(record?.scoring?.total_score)
    : number(totalOverride);
  return {
    scores,
    total,
    max: number(record?.scoring?.max_score) || 21
  };
}

function partnershipLabel(value) {
  return {
    value_up: 'Value Up',
    joint_research: '공동 연구',
    investment: '투자',
    n_a: 'N/A',
    unknown: 'Unknown'
  }[value] || '미분류';
}

const partnerMaterialLabels = {
  cdp: 'CDP',
  ncdp: 'NCDP',
  admet: 'ADMET'
};

function detectPartnerMaterialFlags(attachments) {
  const detected = { cdp: false, ncdp: false, admet: false };
  (Array.isArray(attachments) ? attachments : []).forEach((attachment) => {
    const filename = String(attachment?.filename || '').toLowerCase();
    const isNcdp = /(^|[^a-z0-9])ncdp([^a-z0-9]|$)/.test(filename);
    if (isNcdp) {
      detected.ncdp = true;
    } else if (/(^|[^a-z0-9])cdp([^a-z0-9]|$)/.test(filename)) {
      detected.cdp = true;
    }
    if (/(^|[^a-z0-9])admet([^a-z0-9]|$)/.test(filename)) {
      detected.admet = true;
    }
  });
  return detected;
}

function setReviewInfoExpanded(expanded) {
  const isExpanded = expanded === true;
  elements.detailReviewInfoStack?.classList.toggle('is-collapsed', !isExpanded);
  if (!elements.detailReviewInfoToggle) return;
  elements.detailReviewInfoToggle.setAttribute('aria-expanded', String(isExpanded));
  elements.detailReviewInfoToggle.setAttribute(
    'aria-label',
    isExpanded ? 'Review Workspace 세부 정보 숨기기' : 'Review Workspace 세부 정보 표시'
  );
  elements.detailReviewInfoToggle.title = isExpanded ? '세부 정보 숨기기' : '세부 정보 표시';
  const label = elements.detailReviewInfoToggle.querySelector('[data-review-toggle-label]');
  if (label) label.textContent = isExpanded ? 'Hide' : 'Show';
}

function renderCollaborationPanel(record) {
  const focus = record?.meta?.focus_management || {};
  const tracked = focus.is_tracked === true;
  const attachments = Array.isArray(record?.meta?.attachments) ? record.meta.attachments : [];
  const statusIsHuman = hasManualReviewField(record, 'filter_status');
  const reasonIsHuman = hasManualReviewField(record, 'status_reason');
  const reviewScores = effectiveReviewScores(record);
  if (elements.detailFocusToggle) {
    elements.detailFocusToggle.dataset.focusAction = tracked ? 'remove' : 'add';
    elements.detailFocusToggle.classList.toggle('add', !tracked);
    elements.detailFocusToggle.classList.toggle('remove', tracked);
    elements.detailFocusToggle.title = tracked
      ? '즐겨찾기(집중 관리)에서 제거합니다.'
      : '즐겨찾기(집중 관리)에 추가합니다.';
    elements.detailFocusToggle.setAttribute(
      'aria-label',
      tracked ? '즐겨찾기됨 (클릭 시 해제)' : '즐겨찾기에 추가'
    );
  }
  if (elements.detailActionDate) {
    elements.detailActionDate.value = String(focus.due_date || '');
  }
  if (elements.detailActionOwner) {
    elements.detailActionOwner.value = String(focus.owner_name || '');
  }
  if (elements.detailActionPlan) {
    elements.detailActionPlan.value = String(focus.action_plan || '');
  }
  if (elements.detailDecisionStatus) {
    const status = recordReviewStatus(record);
    elements.detailDecisionStatus.value = status;
    elements.detailDecisionStatus.dataset.tone = status.toLowerCase();
    elements.detailDecisionStatus.classList.toggle('is-human', statusIsHuman);
  }
  if (elements.detailDecisionOrigin) {
    elements.detailDecisionOrigin.textContent = `Rubric v${getDisplayRubricVersion(record)}`;
    elements.detailDecisionOrigin.classList.toggle('is-human', statusIsHuman);
  }
  if (elements.detailTotalScore) {
    elements.detailTotalScore.textContent = `${formatScore(reviewScores.total)} / ${formatScore(reviewScores.max)}`;
  }
  if (elements.detailScoreSequence) {
    elements.detailScoreSequence.innerHTML = reviewScoreOrder
      .map(([criterionId], index) => {
        const score = reviewScores.scores[index];
        const tone = scoreChipTone(score);
        const label = scoringFirstWord[criterionId] || criterionId;
        return `
          <button
            type="button"
            class="score-chip score-chip-link tone-${tone}"
            data-report-criterion="${escapeHtml(criterionId)}"
            title="${escapeHtml(scoringLabels[criterionId])}: ${escapeHtml(formatCriterionScore(score))} · GPT 원문 근거로 이동"
            aria-label="${escapeHtml(scoringLabels[criterionId])} ${escapeHtml(formatCriterionScore(score))}점, GPT 원문 근거로 이동"
          >
            <span class="score-chip-label">${escapeHtml(label)}</span><span class="score-chip-value">${escapeHtml(formatCriterionScore(score))}</span>
          </button>
        `;
      })
      .join('');
  }
  if (elements.detailReviewSummary) {
    const summary = conciseReviewSummary(record);
    elements.detailReviewSummary.value = summary;
    elements.detailReviewSummary.dataset.previousValue = summary;
    elements.detailReviewSummary.title = '해당 Pipeline의 최종 평가 의견을 한 줄로 요약합니다.';
    resizeReviewReasonInput();
  }
  if (elements.detailReviewReasonShell) {
    elements.detailReviewReasonShell.classList.toggle('is-human', reasonIsHuman);
  }
  // Full Scout (Filter 2) and 집중 관리 (OI partnership) now show side by side.
  // Filter 2 always applies (every Full Scout record has a scored decision); the
  // 집중 관리 column only makes sense once the record is actually tracked.
  if (elements.detailFilter2Row) {
    elements.detailFilter2Row.hidden = false;
  }
  if (elements.detailOiPartnershipRow) {
    elements.detailOiPartnershipRow.hidden = !tracked;
  }
  if (elements.detailOiPartnershipType) {
    elements.detailOiPartnershipType.value = String(focus.partnership_type || '');
  }
  const partnershipNoteIsManual = focus.partnership_classification_source === 'manual';
  if (elements.detailOiPartnershipOrigin) {
    elements.detailOiPartnershipOrigin.textContent = `OI Partnership v${focus.partnership_classification_criteria_version || '1.0'}`;
    elements.detailOiPartnershipOrigin.classList.toggle('is-human', partnershipNoteIsManual);
  }
  if (elements.detailOiPartnershipNote) {
    const note = String(focus.partnership_note || '');
    elements.detailOiPartnershipNote.value = note;
    elements.detailOiPartnershipNote.dataset.previousValue = note;
    elements.detailOiPartnershipNote.title = 'OI 파트너십 분류 근거를 짧게 요약합니다.';
    resizeOiPartnershipNoteInput();
  }
  if (elements.detailOiPartnershipNoteShell) {
    elements.detailOiPartnershipNoteShell.classList.toggle('is-human', partnershipNoteIsManual);
  }
  const materialFlags = focus.partner_material_flags && typeof focus.partner_material_flags === 'object'
    ? focus.partner_material_flags
    : {};
  const materialOverrides = focus.partner_material_flag_overrides
    && typeof focus.partner_material_flag_overrides === 'object'
    ? focus.partner_material_flag_overrides
    : {};
  const autoMaterialFlags = detectPartnerMaterialFlags(attachments);
  elements.detailOiMaterialButtons?.forEach((button) => {
    const key = button.dataset.materialKey;
    const hasManualOverride = typeof materialOverrides[key] === 'boolean';
    const manualActive = hasManualOverride
      ? materialOverrides[key] === true
      : materialFlags[key] === true;
    const autoActive = autoMaterialFlags[key] === true;
    const active = hasManualOverride ? manualActive : (manualActive || autoActive);
    const label = partnerMaterialLabels[key] || key.toUpperCase();
    button.classList.toggle('is-active', active);
    button.classList.toggle('is-auto', autoActive);
    button.classList.toggle('is-manual', hasManualOverride || manualActive);
    button.setAttribute('aria-pressed', String(active));
    button.dataset.manualActive = String(manualActive);
    button.dataset.hasManualOverride = String(hasManualOverride);
    button.dataset.autoActive = String(autoActive);
    button.disabled = false;
    button.classList.remove('is-saving');
    if (hasManualOverride && manualActive) {
      button.title = `${label} 자료 있음 · 담당자 수동 표시 · 클릭하면 해제`;
    } else if (hasManualOverride) {
      button.title = `${label} 자료 없음 · 담당자 수동 해제 · 클릭하면 표시`;
    } else if (autoActive) {
      button.title = `${label} 자료 있음 · 파일명 자동 인식`;
    } else if (manualActive) {
      button.title = `${label} 자료 있음 · 수동 표시 · 클릭하면 해제`;
    } else {
      button.title = `${label} 자료 없음 · 클릭하면 보유로 표시`;
    }
  });
  renderCommentThread(record);
  renderMetaInfoBar(record);
  renderEditHistory(record);
  renderAttachments(record);
  renderQualitativeReview(record);
}

function renderMetaInfoBar(record) {
  if (!elements.detailMetaInfo) return;
  const meta = record?.meta || {};
  const generatedAt = meta.generated_at || '-';
  const rubricVersion = getDisplayRubricVersion(record);
  const rescoredVersion = String(meta.rescored_rubric_version || '');
  const rescoredLabel = rescoredVersion && rescoredVersion !== String(rubricVersion)
    ? ` · Score recalculated with rubric v${rescoredVersion}`
    : '';
  const history = Array.isArray(meta.edit_history) ? meta.edit_history : [];
  const sourceReportEdit = [...history]
    .reverse()
    .find((entry) => entry?.field === 'source_report.raw_markdown');
  const lastEditedAt = sourceReportEdit?.changed_at ? formatCommentTime(sourceReportEdit.changed_at) : null;
  const lastEditedBy = sourceRevisionActorLabel(sourceReportEdit);
  const sourceRevisionLabel = sourceReportEditLabel(sourceReportEdit);

  const items = [
    `<span class="meta-info-item">GPT 검색일 <strong>${escapeHtml(generatedAt)}</strong></span>`,
    `<span class="meta-info-item">원본 스코어링 지침 <strong>v${escapeHtml(rubricVersion)}</strong>${escapeHtml(rescoredLabel)}</span>`
  ];
  if (lastEditedAt) {
    items.push(
      `<span class="meta-info-item">${escapeHtml(sourceRevisionLabel)} <strong>${escapeHtml(lastEditedAt)}</strong>${
        lastEditedBy ? ` · ${escapeHtml(lastEditedBy)}` : ''
      }</span>`
    );
  }
  elements.detailMetaInfo.innerHTML = items.join('');
  elements.detailMetaInfo.title = [
    `GPT 검색일: ${generatedAt}`,
    `원본 스코어링 지침 버전: v${rubricVersion}${rescoredLabel}`,
    lastEditedAt
      ? `${sourceRevisionLabel}: ${lastEditedAt} · ${lastEditedBy || 'unknown'}`
      : null
  ]
    .filter(Boolean)
    .join('\n');
}

function sourceReportEditLabel(entry) {
  const source = String(entry?.source || '');
  if (source === 'detail_json_editor') return 'GPT 원문 갱신일';
  if (source === 'paste_json_upsert') return 'GPT 원문 재업로드일';
  if (['dashboard_rubric_refresh', 'dashboard_tab2_rubric_recalculation'].includes(source)) {
    return 'GPT 원문·Score 갱신일';
  }
  return 'GPT 원문 갱신일';
}

function sourceRevisionActorLabel(entry) {
  if (!entry) return null;
  if (['dashboard_rubric_refresh', 'dashboard_tab2_rubric_recalculation'].includes(entry.source)) {
    const rubricVersion = String(entry.new_value || '').match(/rubric\s+v([^\s]+)/i)?.[1];
    return rubricVersion ? `Rubric v${rubricVersion}` : 'Rubric recalculation';
  }
  if (entry.actor_name) return String(entry.actor_name);
  if (['127.0.0.1', '::1', 'localhost'].includes(String(entry.actor_ip || '').toLowerCase())) {
    return 'Local workspace';
  }
  return entry.actor_ip ? String(entry.actor_ip) : null;
}

function teamReviewActorLabel(entry) {
  if (entry?.actor_name) return String(entry.actor_name);
  if (['127.0.0.1', '::1', 'localhost'].includes(String(entry?.actor_ip || '').toLowerCase())) {
    return 'Local workspace';
  }
  return String(entry?.actor_ip || 'unknown');
}

function renderEditHistory(record) {
  if (!elements.detailEditHistory) return;
  const auditHistory = Array.isArray(record?.meta?.edit_history) ? record.meta.edit_history : [];
  const history = auditHistory.filter((entry) => entry?.field !== 'source_report.raw_markdown');
  if (!history.length) {
    elements.detailEditHistory.innerHTML = '';
    return;
  }
  const items = history
    .slice()
    .reverse()
    .map((entry) => {
      const when = formatCommentTime(entry?.changed_at);
      const who = teamReviewActorLabel(entry);
      const sourceLabels = {
        dashboard_table_manual_review: 'Review status/점수',
        dashboard_tab3_focus_management: '집중관리 정보',
        dashboard_comment: '팀 코멘트',
        dashboard_attachment_upload: '파트너 자료 업로드',
        dashboard_attachment_delete: '파트너 자료 삭제',
        dashboard_qualitative_review: '정성 평가',
        dashboard_qualitative_review_ai_generate: 'AI 정성 평가',
        dashboard_qualitative_review_delete: '정성 평가 삭제',
        dashboard_qualitative_review_criterion_add: '정성평가 기준 추가',
        dashboard_qualitative_review_criterion_import: '정성평가 기준 가져오기',
        dashboard_qualitative_review_criterion_delete: '정성평가 기준 삭제',
        paste_json_upsert: 'GPT JSON 저장',
        detail_json_editor: 'Record JSON'
      };
      const fieldLabels = {
        filter_status: 'Review status',
        status_reason: 'Review 한 줄 근거',
        'scores.target_relevance': 'TR 점수',
        'scores.competitive_landscape': 'Competitive 점수',
        'scores.moa_validity': 'MoA 점수',
        'scores.platform_attractiveness': 'Platform 점수',
        'scores.expansion_potential': 'Expansion 점수',
        'scores.data_maturity': 'Data 점수',
        'scores.marketability': 'Market 점수',
        total_score: 'Tab2 Total Score',
        'focus_management.total_score_override': 'Tab3 Total Score'
      };
      const fieldSource = fieldLabels[entry?.field];
      const baseSource = entry?.source === 'paste_json_score_reset' && fieldSource
        ? `${fieldSource} · GPT 원문 재업로드`
        : fieldSource || sourceLabels[entry?.source] || entry?.field || '레코드';
      const source = entry?.change_method === 'ai_agent' ? `${baseSource} · AI Agent` : baseSource;
      const formatAuditValue = (value) => {
        if (value === null || value === undefined || value === '') return 'Auto';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      };
      const change = `${formatAuditValue(entry?.previous_value)} → ${formatAuditValue(entry?.new_value)}`;
      const humanClass = entry?.actor_name ? ' class="is-human"' : '';
      return `<li${humanClass}><span>${escapeHtml(when)}</span><strong title="${escapeHtml(source)}">${escapeHtml(source)}</strong><small title="${escapeHtml(`${who} · ${change}`)}">${escapeHtml(who)} · ${escapeHtml(change)}</small></li>`;
    })
    .join('');
  elements.detailEditHistory.innerHTML = `
    <details>
      <summary>Team Review 변경 이력 (${history.length})</summary>
      <ul>${items}</ul>
    </details>
  `;
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function setAttachmentStatus(message = '', tone = '') {
  if (!elements.detailAttachmentStatus) return;
  elements.detailAttachmentStatus.textContent = message;
  elements.detailAttachmentStatus.dataset.tone = tone;
}

function attachmentProcessingLabel(attachment) {
  const processing = attachment?.document_processing || {};
  const extraction = processing.extraction || {};
  const analysis = processing.deepseek_analysis || {};
  const parser = processing.parser || {};
  if (attachment?.processing_status === 'processing') return '문자 추출·Filter 3 분석 중';
  if (attachment?.processing_status === 'failed') return '문서 처리 실패';
  if (processing.status === 'not_applicable' || attachment?.processing_status === 'not_applicable') {
    return '원본 보관';
  }
  const methodLabels = {
    native_pdf_text: 'PDF native text',
    native_pptx_text: 'PPTX slide text',
    libreoffice_pdf_native_text: 'LibreOffice PDF text'
  };
  const method = methodLabels[extraction.method]
    || (String(extraction.method || '').startsWith('openrouter_file_parser_')
      ? `OpenRouter ${parser.parser_engine || 'PDF parser'}`
      : '문자 추출');
  const analysisLabel = analysis.status === 'completed'
    ? 'Filter 3 분석 완료'
    : 'Filter 3 분석 확인 필요';
  return `${method} · ${analysisLabel}`;
}

function renderAttachments(record) {
  if (!elements.detailAttachmentsList) return;
  const attachments = Array.isArray(record?.meta?.attachments) ? record.meta.attachments : [];
  if (elements.detailAttachmentAiScope) {
    elements.detailAttachmentAiScope.hidden = attachments.length > 0;
  }
  if (elements.detailAttachmentCount) {
    elements.detailAttachmentCount.textContent = String(attachments.length);
    elements.detailAttachmentCount.setAttribute('aria-label', `첨부자료 ${attachments.length}개`);
  }
  if (!attachments.length) {
    elements.detailAttachmentsList.innerHTML = '';
    return;
  }
  elements.detailAttachmentsList.innerHTML = attachments
    .map(
      (attachment) => {
        const activeClass = String(attachment.id) === activeAttachmentId ? ' is-active' : '';
        return `
        <div class="attachment-row${activeClass}" data-attachment-id="${escapeHtml(attachment.id)}">
          <button
            type="button"
            class="attachment-preview-button"
            data-preview-attachment-id="${escapeHtml(attachment.id)}"
            title="${escapeHtml(attachment.filename || 'attachment')}"
          >
            <span class="attachment-copy">
              <strong>${escapeHtml(attachment.filename || 'attachment')}</strong>
              <small>${escapeHtml(formatFileSize(attachment.size_bytes))} · ${escapeHtml(formatCommentTime(attachment.uploaded_at))}</small>
            </span>
          </button>
          <span class="attachment-meta">
            ${escapeHtml(attachment.uploaded_by || '')} · ${escapeHtml(attachmentProcessingLabel(attachment))}
          </span>
          <button
            type="button"
            class="attachment-delete-button"
            data-delete-attachment-id="${escapeHtml(attachment.id)}"
            aria-label="첨부파일 삭제"
          >×</button>
        </div>
      `;
      }
    )
    .join('');
}

async function uploadAttachment(file) {
  if (!file || !currentRecordId) return;
  if (elements.detailAttachmentAddButton) elements.detailAttachmentAddButton.disabled = true;
  setAttachmentStatus('파일 업로드 중…');
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploaded_by', getStoredIdentity());
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/attachments`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '파일 업로드에 실패했습니다.');
    currentRecord = data.record;
    renderCollaborationPanel(currentRecord);
    setAttachmentStatus(`${file.name}을(를) 추가했습니다.`, 'success');
    if (data.attachment?.id) await showAttachmentPreview(data.attachment.id);
  } catch (error) {
    setAttachmentStatus(error.message, 'error');
  } finally {
    if (elements.detailAttachmentAddButton) elements.detailAttachmentAddButton.disabled = false;
    if (elements.detailAttachmentInput) elements.detailAttachmentInput.value = '';
  }
}

async function uploadAttachments(files) {
  const queue = [...(files || [])].filter(Boolean);
  for (const file of queue) {
    await uploadAttachment(file);
  }
}

function renderSourceReport(record = currentRecord) {
  if (!record || !elements.sourceReportViewer) return;
  attachmentPreviewController?.abort();
  attachmentPreviewController = null;
  activeAttachmentId = '';
  const sourceReport = record.source_report || {};
  const rawMarkdown = isPlaceholderRawMarkdown(sourceReport.raw_markdown) ? '' : sourceReport.raw_markdown;
  if (elements.detailViewerTitle) elements.detailViewerTitle.textContent = 'GPT ORIGINAL REPORT';
  if (elements.subtitle) {
    elements.subtitle.textContent = '';
    elements.subtitle.hidden = true;
  }
  if (elements.detailMetaInfo) elements.detailMetaInfo.hidden = false;
  if (elements.detailViewerBackGroup) elements.detailViewerBackGroup.hidden = true;
  if (elements.detailViewerBackButton) elements.detailViewerBackButton.hidden = true;
  if (elements.detailAttachmentOriginalActions) {
    elements.detailAttachmentOriginalActions.hidden = true;
    elements.detailAttachmentOriginalActions.innerHTML = '';
  }
  if (elements.detailViewerOpenWindowButton) elements.detailViewerOpenWindowButton.hidden = false;
  if (elements.detailViewerCopyButton) elements.detailViewerCopyButton.hidden = false;
  elements.sourceReportViewer.classList.remove('showing-attachment');
  elements.sourceReportViewer.innerHTML = rawMarkdown
    ? renderMarkdown(sourceReport.raw_markdown)
    : renderMarkdown(buildReadableSourceReport(record));
  renderTopicNotes(record);
  renderAttachments(record);
  renderDetailOutline();
}

async function showAttachmentPreview(attachmentId) {
  if (!attachmentId || !currentRecordId || !currentRecord) return;
  const attachment = (currentRecord?.meta?.attachments || []).find(
    (item) => String(item?.id || '') === String(attachmentId)
  );
  if (!attachment) return;

  const previewId = String(attachmentId);
  attachmentPreviewController?.abort();
  const previewController = new AbortController();
  attachmentPreviewController = previewController;
  activeAttachmentId = previewId;
  renderAttachments(currentRecord);
  if (elements.detailViewerTitle) elements.detailViewerTitle.textContent = attachment.filename || '파트너사 자료';
  if (elements.subtitle) {
    elements.subtitle.textContent = `${formatFileSize(attachment.size_bytes)} · ${formatCommentTime(attachment.uploaded_at)}`;
    elements.subtitle.hidden = false;
  }
  if (elements.detailMetaInfo) elements.detailMetaInfo.hidden = true;
  if (elements.detailViewerBackGroup) elements.detailViewerBackGroup.hidden = false;
  if (elements.detailViewerBackButton) elements.detailViewerBackButton.hidden = false;
  if (elements.detailAttachmentOriginalActions) {
    elements.detailAttachmentOriginalActions.hidden = true;
    elements.detailAttachmentOriginalActions.innerHTML = '';
  }
  if (elements.detailViewerOpenWindowButton) elements.detailViewerOpenWindowButton.hidden = true;
  if (elements.detailViewerCopyButton) elements.detailViewerCopyButton.hidden = true;
  elements.sourceReportViewer.classList.add('showing-attachment');
  elements.sourceReportViewer.innerHTML = '<div class="attachment-preview-loading">자료를 불러오는 중입니다…</div>';

  try {
    const response = await fetch(
      `/api/attachment-preview/${encodeURIComponent(attachmentId)}?record_id=${encodeURIComponent(currentRecordId)}`,
      { signal: previewController.signal }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '자료 미리보기를 불러오지 못했습니다.');
    if (previewController.signal.aborted || activeAttachmentId !== previewId) return;

    const previewUrl = data.url || attachment.stored_path;
    const originalName = attachment.filename || 'attachment';
    const downloadIcon = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3v12"></path><path d="m7.5 10.5 4.5 4.5 4.5-4.5"></path><path d="M5 20h14"></path>
      </svg>
    `;
    const openIcon = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"></path>
      </svg>
    `;
    if (elements.detailAttachmentOriginalActions) {
      elements.detailAttachmentOriginalActions.innerHTML = `
        <a class="report-action-icon help-tooltip attachment-original-action" href="${escapeHtml(attachment.stored_path)}" download="${escapeHtml(originalName)}" data-tooltip="원본 다운로드" aria-label="원본 다운로드">
          ${downloadIcon}
        </a>
        <a class="report-action-icon help-tooltip attachment-original-action" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener" data-tooltip="원본 파일 열기" aria-label="원본 파일 열기">
          ${openIcon}
        </a>
      `;
      elements.detailAttachmentOriginalActions.hidden = false;
    }

    if (data.preview_type === 'pdf') {
      elements.sourceReportViewer.innerHTML = `
        <iframe
          class="attachment-pdf-preview"
          src="${escapeHtml(previewUrl)}"
          title="${escapeHtml(attachment.filename || 'PDF preview')}"
        ></iframe>
      `;
    } else if (data.preview_type === 'text') {
      elements.sourceReportViewer.innerHTML = `
        <pre class="attachment-text-preview">${escapeHtml(data.text || '추출된 텍스트가 없습니다.')}</pre>
      `;
    } else {
      elements.sourceReportViewer.innerHTML = `
        <div class="attachment-preview-empty">
          <span class="attachment-type-badge large">${escapeHtml(String(attachment.filename || '').split('.').pop()?.toUpperCase() || 'FILE')}</span>
          <strong>브라우저 내 미리보기를 지원하지 않는 파일입니다.</strong>
          <p>PPT 바이너리 및 Excel 파일은 원본 열기로 확인할 수 있습니다. PPTX·PDF·TXT는 이 영역에서 내용을 확인할 수 있습니다.</p>
        </div>
      `;
    }
  } catch (error) {
    if (error?.name === 'AbortError' || previewController.signal.aborted || activeAttachmentId !== previewId) return;
    elements.sourceReportViewer.innerHTML = `
      <div class="attachment-preview-empty">
        <strong>미리보기를 표시할 수 없습니다.</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
    if (elements.detailAttachmentOriginalActions) {
      elements.detailAttachmentOriginalActions.innerHTML = `
        <a class="report-action-icon help-tooltip attachment-original-action" href="${escapeHtml(attachment.stored_path)}" download="${escapeHtml(attachment.filename || 'attachment')}" data-tooltip="원본 다운로드" aria-label="원본 다운로드">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12"></path><path d="m7.5 10.5 4.5 4.5 4.5-4.5"></path><path d="M5 20h14"></path></svg>
        </a>
        <a class="report-action-icon help-tooltip attachment-original-action" href="${escapeHtml(attachment.stored_path)}" target="_blank" rel="noopener" data-tooltip="원본 파일 열기" aria-label="원본 파일 열기">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"></path></svg>
        </a>
      `;
      elements.detailAttachmentOriginalActions.hidden = false;
    }
  } finally {
    if (attachmentPreviewController === previewController) attachmentPreviewController = null;
  }
}

async function deleteAttachment(attachmentId) {
  if (!attachmentId || !currentRecordId) return;
  setAttachmentStatus('파일 삭제 중…');
  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: 'DELETE' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '파일 삭제에 실패했습니다.');
    currentRecord = data.record;
    if (activeAttachmentId === String(attachmentId)) renderSourceReport(currentRecord);
    renderCollaborationPanel(currentRecord);
    setAttachmentStatus('파일을 삭제했습니다.', 'success');
  } catch (error) {
    setAttachmentStatus(error.message, 'error');
  }
}

const QUALITATIVE_LEGACY_AI_AUTHOR = 'AI (초안)';
let isGeneratingAllQualitativeOpinions = false;

function renderQualitativeReview(record) {
  if (!elements.qualitativeReviewPanel) return;
  const qualitativeState = record?.meta?.qualitative_review || {};
  const criteriaState = qualitativeState.criteria || {};
  const customCriteria = Array.isArray(qualitativeState.custom_criteria) ? qualitativeState.custom_criteria : [];
  const allCriteria = [
    ...qualitativeReviewCriteria,
    ...customCriteria
      .filter((item) => item && item.id)
      .map((item) => ({
        id: item.id,
        label: item.label || '이름 없음',
        description: item.description || '',
        isCustom: true
      }))
  ];

  elements.qualitativeReviewPanel.innerHTML = `
    <div class="qualitative-panel-heading">
      <p class="eyebrow">정성 평가</p>
      <button
        type="button"
        class="qualitative-ai-generate-all-button help-tooltip"
        id="qualitativeAiGenerateAllButton"
        data-tooltip="전체 AI 생성"
        aria-label="전체 AI 생성"
      ><span aria-hidden="true">✨</span></button>
      <small>담당자가 직접 작성하거나, 'AI 생성' 버튼으로 원문·업로드 자료 기반 1차 초안을 받아 검토·수정할 수 있습니다.</small>
    </div>
    ${allCriteria.map((criterion) => renderQualitativeCriterionSection(criterion, criteriaState)).join('')}
    ${renderQualitativeAddCriterionSection()}
  `;
}

function renderQualitativeCriterionSection(criterion, criteriaState) {
  const criterionState = criteriaState[criterion.id]
    || (criterion.legacyIds || []).map((id) => criteriaState[id]).find(Boolean)
    || {};
  const entries = Array.isArray(criterionState.entries)
    ? criterionState.entries.filter((entry) => entry?.author !== QUALITATIVE_LEGACY_AI_AUTHOR)
    : [];
  const entriesHtml = entries.length
    ? entries
        .map(
          (entry) => `
            <article class="qualitative-entry ${entry.is_ai ? 'is-ai' : ''}">
              <div class="qualitative-entry-meta">
                <div class="qualitative-entry-meta-left">
                  ${entry.is_ai ? '<span class="qualitative-ai-badge">AI</span>' : ''}
                  <strong>${escapeHtml(entry.author || '익명')}</strong>
                  <time>${escapeHtml(formatCommentTime(entry.created_at))}</time>
                </div>
                <button
                  type="button"
                  class="qualitative-entry-delete"
                  data-delete-qualitative-entry-id="${escapeHtml(entry.id)}"
                  aria-label="의견 삭제"
                >×</button>
              </div>
              <p>${escapeHtml(entry.body || '').replaceAll('\n', '<br>')}</p>
            </article>
          `
        )
        .join('')
    : '<p class="qualitative-empty">아직 등록된 의견이 없습니다.</p>';

  return `
    <section class="qualitative-criterion" data-criterion-id="${escapeHtml(criterion.id)}">
      <header class="qualitative-criterion-header">
        <div class="qualitative-criterion-heading">
          <h3>${escapeHtml(criterion.label)}</h3>
          ${criterion.description ? `<p>${escapeHtml(criterion.description)}</p>` : ''}
        </div>
        <div class="qualitative-criterion-actions">
          <button
            type="button"
            class="qualitative-ai-generate-button help-tooltip"
            data-ai-generate-criterion-id="${escapeHtml(criterion.id)}"
            data-tooltip="AI 생성"
            aria-label="AI 생성"
          ><span aria-hidden="true">✨</span></button>
          ${criterion.isCustom
            ? `<button
                 type="button"
                 class="qualitative-criterion-delete"
                 data-delete-criterion-id="${escapeHtml(criterion.id)}"
                 aria-label="평가 항목 삭제"
               >×</button>`
            : ''}
        </div>
      </header>
      <div class="qualitative-entries">${entriesHtml}</div>
      <form class="qualitative-form" data-criterion-id="${escapeHtml(criterion.id)}">
        <textarea
          class="message-composer-textarea"
          rows="1"
          maxlength="5000"
          aria-label="${escapeHtml(criterion.label)} 의견 입력"
          placeholder="의견을 추가하세요…"
          required
        ></textarea>
        <button
          class="message-send-button"
          type="submit"
          aria-label="${escapeHtml(criterion.label)} 의견 보내기"
          title="의견 보내기"
          disabled
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 2 9.6 14.4"></path>
            <path d="m22 2-7.2 20-4.1-8.7L2 9.2Z"></path>
          </svg>
        </button>
      </form>
    </section>
  `;
}

function renderQualitativeAddCriterionSection() {
  return `
    <section class="qualitative-add-criterion">
      <button type="button" class="qualitative-add-criterion-toggle" id="qualitativeAddCriterionToggle">
        + 새 평가 항목 추가
      </button>
      <form class="qualitative-add-criterion-form" id="qualitativeAddCriterionForm" hidden>
        <div class="qualitative-criterion-suggestions" id="qualitativeCriterionSuggestions" aria-live="polite">
          <div class="qualitative-suggestion-heading">
            <strong>다른 파이프라인에서 사용 중</strong>
            <span>불러오면 제목과 설명만 복사됩니다.</span>
          </div>
          <p class="qualitative-suggestion-status">추천 항목을 불러오는 중…</p>
        </div>
        <label>
          <span>제목</span>
          <input type="text" name="label" maxlength="60" placeholder="예: Regulatory Pathway" required />
        </label>
        <label>
          <span>설명 / 질문</span>
          <textarea
            name="description"
            rows="2"
            maxlength="400"
            placeholder="이 항목에서 평가하고자 하는 질문이나 관점을 입력하세요 (AI 생성 시 이 설명을 기준으로 초안을 작성합니다)"
          ></textarea>
        </label>
        <div class="qualitative-add-criterion-form-actions">
          <button type="button" class="qualitative-add-criterion-cancel" id="qualitativeAddCriterionCancel">취소</button>
          <button type="submit">항목 등록</button>
        </div>
      </form>
    </section>
  `;
}

async function submitQualitativeOpinion(criterionId, form) {
  const textarea = form.querySelector('textarea');
  const body = textarea?.value.trim() || '';
  if (!body || !currentRecordId) return;
  const author = await ensureIdentity();
  if (!author) return;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.dataset.saving = 'true';
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
  }
  setCollaborationStatus('의견 저장 중…');
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterion_id: criterionId, author, body })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '의견 저장에 실패했습니다.');
    currentRecord = data.record;
    renderQualitativeReview(currentRecord);
    setCollaborationStatus('정성 평가 의견을 저장했습니다.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  } finally {
    if (submitButton?.isConnected) {
      delete submitButton.dataset.saving;
      submitButton.removeAttribute('aria-busy');
      submitButton.disabled = !textarea?.value.trim();
    }
  }
}

async function deleteQualitativeOpinion(entryId) {
  if (!entryId || !currentRecordId) return;
  setCollaborationStatus('의견 삭제 중…');
  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review/${encodeURIComponent(entryId)}`,
      { method: 'DELETE' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '의견 삭제에 실패했습니다.');
    currentRecord = data.record;
    renderQualitativeReview(currentRecord);
    setCollaborationStatus('정성 평가 의견을 삭제했습니다.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  }
}

async function generateQualitativeAiOpinion(criterionId, button) {
  if (!criterionId || !currentRecordId || !button || isGeneratingAllQualitativeOpinions) return;
  const originalTooltip = button.dataset.tooltip || 'AI 생성';
  const originalAriaLabel = button.getAttribute('aria-label') || 'AI 생성';
  button.disabled = true;
  button.dataset.tooltip = 'AI 생성 중…';
  button.setAttribute('aria-label', 'AI 생성 중');
  setCollaborationStatus('원문·업로드 자료를 분석해 AI 초안을 생성하는 중입니다…');
  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review/ai-generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterion_id: criterionId })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'AI 생성에 실패했습니다.');
    currentRecord = data.record;
    renderQualitativeReview(currentRecord);
    setCollaborationStatus('AI 초안을 생성했습니다. 내용을 검토 후 필요하면 직접 의견을 추가해주세요.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
    button.disabled = false;
    button.dataset.tooltip = originalTooltip;
    button.setAttribute('aria-label', originalAriaLabel);
  }
}

async function generateAllQualitativeAiOpinions(button) {
  if (!currentRecordId || !button || isGeneratingAllQualitativeOpinions) return;
  isGeneratingAllQualitativeOpinions = true;
  const fixedCriteria = qualitativeReviewCriteria.slice(0, 3);
  const failures = [];

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  elements.qualitativeReviewPanel
    ?.querySelectorAll('[data-ai-generate-criterion-id]')
    .forEach((item) => { item.disabled = true; });

  try {
    for (let index = 0; index < fixedCriteria.length; index += 1) {
      const criterion = fixedCriteria[index];
      button.dataset.tooltip = `전체 AI 생성 중 ${index + 1}/${fixedCriteria.length}`;
      button.setAttribute('aria-label', `전체 AI 생성 중 ${index + 1}/${fixedCriteria.length}`);
      setCollaborationStatus(`${criterion.label} AI 초안을 생성하는 중입니다… (${index + 1}/${fixedCriteria.length})`);
      try {
        const response = await fetch(
          `/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review/ai-generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ criterion_id: criterion.id })
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'AI 생성에 실패했습니다.');
        currentRecord = data.record;
      } catch (error) {
        failures.push(`${criterion.label}: ${error.message}`);
      }
    }
  } finally {
    isGeneratingAllQualitativeOpinions = false;
    renderQualitativeReview(currentRecord);
  }

  if (failures.length) {
    setCollaborationStatus(
      `${fixedCriteria.length - failures.length}개 항목을 생성했습니다. 실패: ${failures.join(' / ')}`,
      'error'
    );
  } else {
    setCollaborationStatus('정성평가 3개 항목의 AI 초안을 모두 생성했습니다.', 'success');
  }
}

async function addCustomQualitativeCriterion(form) {
  if (!currentRecordId || !form) return;
  const label = form.querySelector('input[name="label"]')?.value.trim() || '';
  const description = form.querySelector('textarea[name="description"]')?.value.trim() || '';
  if (!label) return;
  const author = await ensureIdentity();
  if (!author) return;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setCollaborationStatus('평가 항목 등록 중…');
  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review/criteria`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, description, author })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '평가 항목 등록에 실패했습니다.');
    currentRecord = data.record;
    renderQualitativeReview(currentRecord);
    setCollaborationStatus('새 평가 항목을 등록했습니다.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
    if (submitButton) submitButton.disabled = false;
  }
}

async function loadQualitativeCriterionSuggestions(form) {
  const container = form?.querySelector('#qualitativeCriterionSuggestions');
  if (!container || !currentRecordId) return;
  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review/criteria/suggestions`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '추천 평가 항목을 불러오지 못했습니다.');
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    container.innerHTML = `
      <div class="qualitative-suggestion-heading">
        <strong>다른 파이프라인에서 사용 중</strong>
        <span>불러오면 제목과 설명만 복사됩니다.</span>
      </div>
      ${suggestions.length
        ? `<div class="qualitative-suggestion-list">${suggestions.map(renderQualitativeCriterionSuggestion).join('')}</div>`
        : '<p class="qualitative-suggestion-status">가져올 수 있는 새 평가 항목이 아직 없습니다.</p>'}
    `;
  } catch (error) {
    container.innerHTML = `<p class="qualitative-suggestion-status is-error">${escapeHtml(error.message)}</p>`;
  }
}

function renderQualitativeCriterionSuggestion(suggestion) {
  const sources = Array.isArray(suggestion.source_records) ? suggestion.source_records : [];
  const sourceText = sources.map((item) => item?.label).filter(Boolean).join(', ');
  return `
    <article class="qualitative-suggestion-card">
      <div>
        <strong>${escapeHtml(suggestion.label || '이름 없음')}</strong>
        ${suggestion.description ? `<p>${escapeHtml(suggestion.description)}</p>` : ''}
        <small>${escapeHtml(sourceText || '다른 파이프라인')} · ${Number(suggestion.usage_count) || 1}개 레코드에서 사용</small>
      </div>
      <button
        type="button"
        class="qualitative-suggestion-import"
        data-import-criterion="true"
        data-label="${escapeHtml(suggestion.label || '')}"
        data-description="${escapeHtml(suggestion.description || '')}"
        data-source-record-id="${escapeHtml(sources[0]?.record_id || '')}"
        data-source-criterion-id="${escapeHtml(suggestion.source_criterion_id || '')}"
      >가져오기</button>
    </article>
  `;
}

async function importQualitativeCriterion(button) {
  if (!button || !currentRecordId) return;
  const author = await ensureIdentity();
  if (!author) return;
  button.disabled = true;
  setCollaborationStatus('추천 평가 항목을 가져오는 중…');
  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review/criteria`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: button.dataset.label || '',
          description: button.dataset.description || '',
          author,
          imported_from_record_id: button.dataset.sourceRecordId || '',
          imported_from_criterion_id: button.dataset.sourceCriterionId || ''
        })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '평가 항목 가져오기에 실패했습니다.');
    currentRecord = data.record;
    renderQualitativeReview(currentRecord);
    setCollaborationStatus(`'${button.dataset.label}' 평가 항목을 가져왔습니다.`, 'success');
  } catch (error) {
    button.disabled = false;
    setCollaborationStatus(error.message, 'error');
  }
}

async function deleteCustomQualitativeCriterion(criterionId) {
  if (!criterionId || !currentRecordId) return;
  const confirmed = window.confirm('이 평가 항목과 등록된 모든 의견을 삭제할까요?');
  if (!confirmed) return;
  setCollaborationStatus('평가 항목 삭제 중…');
  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/qualitative-review/criteria/${encodeURIComponent(criterionId)}`,
      { method: 'DELETE' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '평가 항목 삭제에 실패했습니다.');
    currentRecord = data.record;
    renderQualitativeReview(currentRecord);
    setCollaborationStatus('평가 항목을 삭제했습니다.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  }
}

function clearReplyTarget() {
  if (elements.detailReplyParentId) elements.detailReplyParentId.value = '';
  if (elements.detailReplyContext) elements.detailReplyContext.hidden = true;
  if (elements.detailReplyLabel) elements.detailReplyLabel.textContent = '';
}

async function saveDetailFocus(action, trigger = elements.detailFocusToggle) {
  if (!currentRecordId || !currentRecord) return;
  if (trigger) trigger.disabled = true;
  setCollaborationStatus(action === 'remove' ? 'TAB3에서 제거 중…' : 'TAB3에 반영 중…');
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/focus-management`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'TAB3 반영에 실패했습니다.');
    currentRecord = data.record;
    renderCollaborationPanel(currentRecord);
    setCollaborationStatus(action === 'remove' ? 'TAB3에서 제거했습니다.' : 'TAB3에 추가했습니다.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

async function saveDetailFocusField(field, value, control, label) {
  if (!currentRecordId || !currentRecord || !control) return;
  const previousValue = String(currentRecord?.meta?.focus_management?.[field] || '');
  control.disabled = true;
  setCollaborationStatus(`${label} 저장 중…`);
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/focus-management`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', field, value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `${label} 저장에 실패했습니다.`);
    currentRecord = data.record;
    renderCollaborationPanel(currentRecord);
    setCollaborationStatus(`${label}을(를) 저장하고 집중 관리에 반영했습니다.`, 'success');
    return data;
  } catch (error) {
    control.value = previousValue;
    setCollaborationStatus(error.message, 'error');
    return null;
  } finally {
    control.disabled = false;
  }
}

async function saveDetailActionDate(value) {
  return saveDetailFocusField('due_date', value, elements.detailActionDate, 'Action date');
}

async function saveDetailActionOwner(value) {
  return saveDetailFocusField('owner_name', value, elements.detailActionOwner, '담당자');
}

async function saveDetailActionPlan(value) {
  return saveDetailFocusField('action_plan', value, elements.detailActionPlan, 'F/U 계획');
}

async function saveDetailPartnershipType(value) {
  const control = elements.detailOiPartnershipType;
  const previousValue = String(currentRecord?.meta?.focus_management?.partnership_type || '');
  const isAutoCommand = value === '';

  // "↻ 자동 기준으로 재분류"는 저장되는 결과값이 아니라 실행 명령이다.
  // 요청 중에도 명령 문구 대신 직전 분류 결과를 계속 보여준다.
  if (isAutoCommand && previousValue && control) {
    control.value = previousValue;
  }

  const data = await saveDetailFocusField(
    'partnership_type',
    value,
    control,
    'OI Partnership 분류'
  );
  if (!data || !control) return data;

  const focus = data.focus_management || data.record?.meta?.focus_management || {};
  const resolvedType = String(focus.partnership_type || '');
  if (resolvedType) {
    control.value = resolvedType;
  }

  if (isAutoCommand) {
    const resolvedLabel = control.selectedOptions?.[0]?.textContent?.trim() || resolvedType;
    setCollaborationStatus(`자동 재분류 완료: ${resolvedLabel}`, 'success');
  }
  return data;
}

async function saveDetailMaterialFlag(key, active, control) {
  if (!currentRecordId || !currentRecord || !control || !partnerMaterialLabels[key]) return;
  const label = partnerMaterialLabels[key];
  control.classList.toggle('is-active', active);
  control.classList.add('is-manual');
  control.setAttribute('aria-pressed', String(active));
  control.disabled = true;
  control.classList.add('is-saving');
  setCollaborationStatus(`${label} 자료 표시 저장 중…`);
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/focus-management`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        field: 'partner_material_flag',
        value: key,
        active
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `${label} 자료 표시 저장에 실패했습니다.`);
    currentRecord = data.record;
    renderCollaborationPanel(currentRecord);
    const message = active
      ? `${label} 자료 있음으로 표시했습니다.`
      : `${label} 자료 표시를 해제했습니다.`;
    setCollaborationStatus(message, 'success');
  } catch (error) {
    renderCollaborationPanel(currentRecord);
    setCollaborationStatus(error.message, 'error');
  } finally {
    control.disabled = false;
    control.classList.remove('is-saving');
  }
}

async function saveDetailDecisionStatus(value) {
  if (!currentRecordId || !currentRecord || !elements.detailDecisionStatus) return;
  const previousValue = recordReviewStatus(currentRecord);
  const actorName = await ensureIdentity();
  if (!actorName) {
    elements.detailDecisionStatus.value = previousValue;
    return;
  }
  elements.detailDecisionStatus.disabled = true;
  setCollaborationStatus(`${value}로 변경 중…`);
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/manual-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'status', value, previous_value: previousValue, actor_name: actorName })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Decision 저장에 실패했습니다.');
    currentRecord = data.record;
    renderCollaborationPanel(currentRecord);
    setCollaborationStatus(`${value}로 저장했습니다. TAB2와 TAB3에 동일하게 표시됩니다.`, 'success');
  } catch (error) {
    elements.detailDecisionStatus.value = previousValue;
    setCollaborationStatus(error.message, 'error');
  } finally {
    elements.detailDecisionStatus.disabled = false;
  }
}

async function saveDetailReviewReason(value) {
  if (!currentRecordId || !currentRecord || !elements.detailReviewSummary) return;
  const nextValue = String(value || '').trim();
  const previousValue = String(elements.detailReviewSummary.dataset.previousValue || '');
  if (nextValue === previousValue) return;
  const actorName = await ensureIdentity();
  if (!actorName) {
    elements.detailReviewSummary.value = previousValue;
    return;
  }

  elements.detailReviewSummary.disabled = true;
  elements.detailReviewSummary.classList.add('is-saving');
  setCollaborationStatus('Review 한 줄 근거 저장 중…');
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/manual-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'status_reason',
        value: nextValue,
        previous_value: previousValue,
        actor_name: actorName
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Review 근거 저장에 실패했습니다.');
    currentRecord = data.record;
    renderCollaborationPanel(currentRecord);
    setCollaborationStatus('Review 한 줄 근거와 수정 이력을 저장했습니다.', 'success');
  } catch (error) {
    elements.detailReviewSummary.value = previousValue;
    setCollaborationStatus(error.message, 'error');
  } finally {
    elements.detailReviewSummary.disabled = false;
    elements.detailReviewSummary.classList.remove('is-saving');
  }
}

async function submitDetailComment() {
  const body = elements.detailCommentInput?.value.trim() || '';
  if (!body || !currentRecordId) return;
  const author = await ensureIdentity();
  if (!author) return;
  if (elements.detailCommentSubmit) {
    elements.detailCommentSubmit.dataset.saving = 'true';
    elements.detailCommentSubmit.disabled = true;
    elements.detailCommentSubmit.setAttribute('aria-busy', 'true');
  }
  setCollaborationStatus('댓글 저장 중…');
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author,
        body,
        parent_id: elements.detailReplyParentId?.value || null
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '댓글 저장에 실패했습니다.');
    currentRecord = data.record;
    if (elements.detailCommentInput) {
      elements.detailCommentInput.value = '';
      syncMessageComposer(elements.detailCommentInput);
    }
    clearReplyTarget();
    renderCollaborationPanel(currentRecord);
    elements.detailCommentThread?.scrollTo({ top: elements.detailCommentThread.scrollHeight, behavior: 'smooth' });
    setCollaborationStatus('댓글을 저장했습니다.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  } finally {
    if (elements.detailCommentSubmit) {
      delete elements.detailCommentSubmit.dataset.saving;
      elements.detailCommentSubmit.removeAttribute('aria-busy');
      elements.detailCommentSubmit.disabled = !elements.detailCommentInput?.value.trim();
    }
  }
}

function renderRecord(record) {
  const summary = record.json_summary || {};
  const scoring = record.scoring || {};
  const assetLabel = summary.asset_name || record.structured_table?.asset_name || 'Pipeline';
  const companyLabel = summary.company || record.structured_table?.company || '-';
  elements.title.textContent = `Details : ${assetLabel} · ${companyLabel}`;
  document.title = `${assetLabel} · ${companyLabel} · SKBP`;
  if (elements.chatContextAsset) {
    elements.chatContextAsset.textContent = `${summary.asset_name || 'Pipeline'} · ${summary.company || '-'}`;
  }
  if (elements.chatContextScore) {
    elements.chatContextScore.textContent = `${scoring.total_score ?? '-'} / ${scoring.max_score ?? 21} · ${dashboardThemeLabel(summary.theme)}`;
  }
  renderSourceReport(record);
  renderCollaborationPanel(record);
}

function buildReadableSourceReport(record) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const scoring = record.scoring || {};
  const finalInsight = record.final_insight || {};
  const rubricVersion = getDisplayRubricVersion(record);
  const rubricAuthor = getDisplayRubricAuthor(record);
  return `## ${summary.company || table.company || 'Company'} Lead Pipeline 분석: **${summary.asset_name || table.asset_name || 'Asset'}**

> This report is prepared for SKBP Pipeline Finder v${rubricVersion} (${rubricAuthor}) criteria.

## 1. 최종 결론

**${finalInsight.one_line_summary || summary.one_line_summary || '-'}**

이 판단의 Shortlist 관련 총점은 **${scoring.total_score ?? '-'} / ${scoring.max_score ?? 21}**입니다.

## 2. 회사 및 Lead Pipeline 요약

| 항목 | 내용 |
|---|---|
| 회사 | ${summary.company || table.company || '-'} |
| 국가 | ${summary.company_country || table.company_country || '-'} |
| Lead asset | ${summary.asset_name || table.asset_name || '-'} |
| 적응증 | ${table.indication || '-'} |
| Target | ${summary.target || table.target || '-'} |
| Modality | ${table.modality_platform || '-'} |
| 개발 단계 | ${table.development_stage || '-'} |
| Theme fit | ${dashboardThemeLabel(summary.theme || table.theme)} |
| Cluster | ${dashboardClusterLabel(summary.cluster || table.cluster, summary.theme || table.theme)} |

## 3. 핵심 과학적 차별점

${table.moa || '-'}

## 4. SKBP Theme / Cluster 적합성

Theme: **${dashboardThemeLabel(summary.theme || table.theme)}**

Cluster: **${dashboardClusterLabel(summary.cluster || table.cluster, summary.theme || table.theme)}**

## 5. SKBP Pipeline Finder 평가 점수

| Criteria | Score | 판단 |
|---|---:|---|
${Object.entries(scoring.criteria || {})
  .map(([key, item]) => `| ${prettifyKey(key)} | ${formatCriterionScore(item?.score)} | ${item?.main_line_summary || '-'} |`)
  .join('\n')}
| **Total** | **${scoring.total_score ?? '-'} / ${scoring.max_score ?? 21}** | **${finalInsight.one_line_summary || '-'}** |
`;
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---')) return { frontmatter: '', body: markdown };
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: markdown };
  return {
    frontmatter: markdown.slice(3, end).trim(),
    body: markdown.slice(end + 4).trim()
  };
}

function renderFrontmatter(frontmatter) {
  if (!frontmatter) return '';
  const rows = frontmatter
    .split('\n')
    .filter((line) => line.includes(':') && !line.trim().startsWith('-'))
    .slice(0, 12)
    .map((line) => {
      const [key, ...rest] = line.split(':');
      return `
        <div class="obsidian-meta-row">
          <span>${escapeHtml(prettifyKey(key.trim()))}</span>
          <strong>${escapeHtml(rest.join(':').trim().replace(/^"|"$/g, '') || '-')}</strong>
        </div>
      `;
    })
    .join('');
  return `<div class="obsidian-meta">${rows}</div>`;
}

function renderMarkdownTable(lines, startIndex) {
  const tableLines = [];
  let index = startIndex;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    tableLines.push(lines[index].trim());
    index += 1;
  }

  const rows = tableLines
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  if (!rows.length) return { html: '', nextIndex: index };

  const [head, ...body] = rows;
  const html = `
    <div class="obsidian-table-wrap">
      <table class="obsidian-table">
        <thead><tr>${head.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('')}</tr></thead>
        <tbody>
          ${body
            .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`)
            .join('')}
        </tbody>
      </table>
    </div>
  `;
  return { html, nextIndex: index };
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, target, label) => renderWikiLink(target, label))
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => renderWikiLink(target, target))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderWikiLink(rawTarget, rawLabel) {
  const target = String(rawTarget || '').split('#', 1)[0].trim();
  const label = String(rawLabel || target).trim();
  if (!target) return `<span class="wikilink">${label}</span>`;
  const path = /\.md$/i.test(target) ? target : `${target}.md`;
  return `<a class="wikilink" href="/wiki-view?path=${encodeURIComponent(path)}">${label}</a>`;
}

function renderMarkdown(markdown) {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const lines = body.split('\n');
  const blocks = [renderFrontmatter(frontmatter)];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'code';
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(`<pre><span>${escapeHtml(language)}</span><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (line.startsWith('|')) {
      const table = renderMarkdownTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(`<h1>${renderInlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
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
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      index -= 1;
      continue;
    }

    blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  return blocks.join('');
}

function normalizedTopicKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/^\s*(?:section\s+)?\d+(?:\.\d+)*[.)\-:]?\s*/i, '')
    .replace(/[^0-9a-z가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

function reportTopicDescriptors() {
  const headings = [...(elements.sourceReportViewer?.querySelectorAll('h1, h2, h3') || [])];
  const seen = new Map();
  return headings.flatMap((heading, index) => {
    const title = String(heading.textContent || '').trim();
    const isReportTitle = index === 0 && heading.tagName === 'H1';
    const key = normalizedTopicKey(title);
    if (!title || !key || isReportTitle) return [];
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    const topicId = `topic-${key}${occurrence > 1 ? `-${occurrence}` : ''}`;
    heading.id = topicId;
    heading.dataset.topicId = topicId;
    heading.dataset.topicKey = key;
    return [{ heading, title, key, topicId, level: Number(heading.tagName.slice(1)), index }];
  });
}

function currentUserCanManageTopicNote(note) {
  const user = getCurrentUser();
  return Boolean(user && (user.is_admin || String(note?.author_id || '') === String(user.id || '')));
}

function topicNoteMarkup(note) {
  const canManage = currentUserCanManageTopicNote(note);
  return `
    <article class="topic-note-item" data-topic-note-id="${escapeHtml(note.id || '')}">
      <div class="topic-note-meta">
        <strong>${escapeHtml(note.author_name || 'Unknown')}</strong>
        <span>${escapeHtml(formatCommentTime(note.updated_at || note.created_at))}</span>
      </div>
      <p>${escapeHtml(note.body || '')}</p>
      ${canManage ? `
        <div class="topic-note-item-actions">
          <button type="button" data-topic-note-edit>수정</button>
          <button type="button" data-topic-note-delete>삭제</button>
        </div>
      ` : ''}
    </article>
  `;
}

function topicNotePanelMarkup(topic, notes, unmatched = false) {
  const noteStateClass = notes.length ? ' has-notes' : ' is-empty';
  return `
    <section class="topic-note-panel${unmatched ? ' is-unmatched' : ''}${noteStateClass}" data-topic-note-panel data-topic-id="${escapeHtml(topic.topicId)}" data-topic-key="${escapeHtml(topic.key)}" data-topic-title="${escapeHtml(topic.title)}">
      <div class="topic-note-panel-heading">
        <strong>${unmatched ? '이전 리포트 미매칭 메모' : 'Topic 메모'}</strong>
        <span>${notes.length}</span>
        ${unmatched ? '' : '<button type="button" data-topic-note-add>＋ 메모 추가</button>'}
      </div>
      <div class="topic-note-list">${notes.map(topicNoteMarkup).join('')}</div>
      ${unmatched ? '' : `
        <form class="topic-note-form" data-topic-note-form hidden>
          <textarea maxlength="4000" rows="3" placeholder="이 Topic에 대한 정성 의견이나 확인할 내용을 남겨주세요." aria-label="${escapeHtml(topic.title)} Topic 메모"></textarea>
          <div><span data-topic-note-status></span><button type="button" data-topic-note-cancel>취소</button><button type="submit">저장</button></div>
        </form>
      `}
    </section>
  `;
}

function renderTopicNotes(record = currentRecord) {
  if (!elements.sourceReportViewer || elements.sourceReportViewer.classList.contains('showing-attachment')) return;
  elements.sourceReportViewer.querySelectorAll('[data-topic-note-panel]').forEach((panel) => panel.remove());
  const topics = reportTopicDescriptors();
  const notes = Array.isArray(record?.meta?.topic_notes) ? record.meta.topic_notes.filter((note) => note && typeof note === 'object') : [];
  const matchedNoteIds = new Set();

  [...topics].reverse().forEach((topic, reverseIndex) => {
    const topicIndex = topics.length - reverseIndex - 1;
    const boundary = topics.slice(topicIndex + 1).find((candidate) => candidate.level <= topic.level)?.heading || null;
    const topicNotes = notes.filter((note) => {
      const matches = note.topic_id === topic.topicId || normalizedTopicKey(note.topic_key || note.topic_title) === topic.key;
      if (matches && note.id) matchedNoteIds.add(note.id);
      return matches;
    });
    const shell = document.createElement('div');
    shell.innerHTML = topicNotePanelMarkup(topic, topicNotes);
    const panel = shell.firstElementChild;
    if (boundary) elements.sourceReportViewer.insertBefore(panel, boundary);
    else elements.sourceReportViewer.append(panel);
  });

  const unmatched = notes.filter((note) => !matchedNoteIds.has(note.id));
  if (unmatched.length) {
    const shell = document.createElement('div');
    shell.innerHTML = topicNotePanelMarkup(
      { topicId: 'unmatched', key: 'unmatched', title: '이전 리포트 미매칭 메모' },
      unmatched,
      true
    );
    elements.sourceReportViewer.append(shell.firstElementChild);
  }
}

async function saveTopicNote(panel, body) {
  const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/topic-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic_id: panel.dataset.topicId,
      topic_key: panel.dataset.topicKey,
      topic_title: panel.dataset.topicTitle,
      body
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Topic 메모 저장에 실패했습니다.');
  currentRecord = data.record;
  renderSourceReport(currentRecord);
}

async function editTopicNote(noteId, body) {
  const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/topic-notes/${encodeURIComponent(noteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Topic 메모 수정에 실패했습니다.');
  currentRecord = data.record;
  renderSourceReport(currentRecord);
}

async function deleteTopicNote(noteId) {
  const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/topic-notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Topic 메모 삭제에 실패했습니다.');
  currentRecord = data.record;
  renderSourceReport(currentRecord);
}

function openMarkdownInNewWindow(title, rawMarkdown) {
  const win = window.open('', '_blank');
  if (!win) return;
  // Keep a usable WindowProxy for document.write while preventing the opened
  // report from navigating its parent page.
  win.opener = null;
  const theme = document.documentElement.dataset.theme || 'light';
  win.document.write(`<!doctype html>
<html lang="ko" data-theme="${theme === 'dark' ? 'dark' : 'light'}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title || 'Markdown')}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 40px; max-width: 880px; margin-inline: auto; font-family: Tahoma, 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.7; color: #1f2933; background: #ffffff; }
  h1, h2, h3 { line-height: 1.35; }
  pre { background: #f4f6f8; padding: 12px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #d7dde4; padding: 6px 10px; text-align: left; }
  blockquote { border-left: 3px solid #cbd5e1; margin: 0; padding-left: 12px; color: #52606d; }
  code { background: #f4f6f8; padding: 1px 5px; border-radius: 4px; }
  html[data-theme="dark"] body { background: #10161d; color: #e5e9ee; }
  html[data-theme="dark"] pre, html[data-theme="dark"] code { background: #1b232c; }
  html[data-theme="dark"] th, html[data-theme="dark"] td { border-color: #2a333d; }
  html[data-theme="dark"] blockquote { border-color: #3a4552; color: #9aa7b4; }
  @media (prefers-color-scheme: dark) {
    body { background: #10161d; color: #e5e9ee; }
    pre, code { background: #1b232c; }
    th, td { border-color: #2a333d; }
    blockquote { border-color: #3a4552; color: #9aa7b4; }
  }
</style>
</head>
<body>${renderMarkdown(String(rawMarkdown || ''))}</body>
</html>`);
  win.document.close();
}

function getCurrentSourceMarkdown() {
  if (!currentRecord) return '';
  const sourceReport = currentRecord.source_report || {};
  const rawMarkdown = isPlaceholderRawMarkdown(sourceReport.raw_markdown) ? '' : sourceReport.raw_markdown;
  return rawMarkdown || buildReadableSourceReport(currentRecord);
}

async function copyCurrentSourceMarkdown(button) {
  const text = getCurrentSourceMarkdown();
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    if (button) {
      if (button.classList.contains('report-action-icon')) {
        const originalTooltip = button.dataset.tooltip || '복사';
        const originalLabel = button.getAttribute('aria-label') || 'GPT 원문 리포트 복사';
        button.dataset.tooltip = '복사됨';
        button.setAttribute('aria-label', '복사됨');
        button.classList.add('is-success');
        window.setTimeout(() => {
          button.dataset.tooltip = originalTooltip;
          button.setAttribute('aria-label', originalLabel);
          button.classList.remove('is-success');
        }, 1400);
      } else {
        const original = button.innerHTML;
        button.innerHTML = '<span aria-hidden="true">✓</span> 복사됨';
        window.setTimeout(() => { button.innerHTML = original; }, 1400);
      }
    }
  } catch (error) {
    console.error('원문 리포트 복사 실패:', error);
  }
}

function openReportModal() {
  const text = getCurrentSourceMarkdown();
  if (!text || !elements.reportModalBackdrop || !elements.reportModalBody) return;
  elements.reportModalBody.innerHTML = renderMarkdown(text);
  elements.reportModalBackdrop.hidden = false;
  document.body.classList.add('report-modal-open');
  elements.reportModalCloseButton?.focus();
}

function closeReportModal() {
  if (!elements.reportModalBackdrop || elements.reportModalBackdrop.hidden) return;
  elements.reportModalBackdrop.hidden = true;
  document.body.classList.remove('report-modal-open');
  elements.detailViewerOpenWindowButton?.focus();
}

function renderDetailOutline() {
  if (!elements.detailOutlineList || !elements.sourceReportViewer) return;
  const headings = [...elements.sourceReportViewer.querySelectorAll('h1, h2, h3')]
    .filter((heading, index) => {
      const headingText = String(heading.textContent || '').trim();
      const isReportTitle = index === 0
        && heading.tagName === 'H1'
        && /\bpipeline\s+scout\s+report\b/i.test(headingText);
      return !isReportTitle;
    })
    .slice(0, 14);
  if (!headings.length) {
    elements.detailOutlineList.innerHTML = '<span class="detail-outline-empty">No headings</span>';
    return;
  }

  headings.forEach((heading, index) => {
    heading.id = heading.id || `detail-section-${index + 1}`;
  });

  elements.detailOutlineList.innerHTML = headings
    .map((heading) => `
      <button type="button" data-outline-target="${escapeHtml(heading.id)}" class="outline-${heading.tagName.toLowerCase()}">
        ${escapeHtml(heading.textContent.trim() || 'Section')}
      </button>
    `)
    .join('');
}

function navigateToOutlineTarget(targetId) {
  if (!targetId) return;
  const returnToReport = elements.sourceReportViewer?.classList.contains('showing-attachment');
  if (returnToReport && currentRecord) {
    renderSourceReport(currentRecord);
    window.requestAnimationFrame(() => {
      scrollReportHeadingIntoView(document.getElementById(targetId));
    });
    return;
  }
  scrollReportHeadingIntoView(document.getElementById(targetId));
}

const criterionReportHeadingPatterns = {
  target_relevance: /\btarget\s+relevance\b/i,
  competitive_landscape: /\bcompetitive\s+landscape\b/i,
  moa_validity: /\b(?:moa|mechanism\s+of\s+action)\s+validity\b/i,
  platform_attractiveness: /\bplatform\s+attractiveness\b/i,
  expansion_potential: /\bexpansion\s+potential\b/i,
  data_maturity: /\bdata\s+maturity\b/i,
  marketability: /\bmarketability\b/i
};

function reportCriterionHeading(criterionId) {
  const headings = [...(elements.sourceReportViewer?.querySelectorAll('h1, h2, h3') || [])];
  const pattern = criterionReportHeadingPatterns[criterionId];
  if (!pattern) return null;
  return headings.find((heading) => pattern.test(heading.textContent || ''))
    || headings.find((heading) => /scorecard|criterion|평가\s*점수/i.test(heading.textContent || ''))
    || null;
}

function scrollReportHeadingIntoView(heading) {
  if (!heading) return false;
  activeReportJumpHeading?.classList.remove('criterion-jump-highlight');
  window.clearTimeout(reportJumpHighlightTimer);
  activeReportJumpHeading = heading;
  heading.classList.add('criterion-jump-highlight');
  heading.setAttribute('tabindex', '-1');
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  heading.focus({ preventScroll: true });
  reportJumpHighlightTimer = window.setTimeout(() => {
    heading.classList.remove('criterion-jump-highlight');
    if (activeReportJumpHeading === heading) activeReportJumpHeading = null;
  }, 1800);
  return true;
}

function navigateToCriterionReportSection(criterionId) {
  if (!criterionId || !currentRecord) return;
  if (activeAttachmentId) renderSourceReport(currentRecord);
  const heading = reportCriterionHeading(criterionId);
  if (scrollReportHeadingIntoView(heading)) {
    setCollaborationStatus(`${scoringLabels[criterionId] || criterionId} GPT 원문 근거로 이동했습니다.`, 'success');
    return;
  }
  setCollaborationStatus(`${scoringLabels[criterionId] || criterionId} 원문 섹션을 찾지 못했습니다.`, 'error');
}

function detailChatStorageKey() {
  return `${DETAIL_CHAT_SESSION_PREFIX}:${currentRecordId || 'unknown'}`;
}

function detailChatActiveKey() {
  return `${DETAIL_CHAT_ACTIVE_PREFIX}:${currentRecordId || 'unknown'}`;
}

function createChatMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function currentAssetLabel() {
  const summary = currentRecord?.json_summary || {};
  const table = currentRecord?.structured_table || {};
  return summary.asset_name || table.asset_name || currentRecordId || '현재 asset';
}

function defaultDetailChatText() {
  return `${currentAssetLabel()} record를 불러왔습니다. 점수 근거, 리스크, 시장 및 경쟁 상황을 질문할 수 있습니다.`;
}

function createChatSession(title = '새 대화') {
  const now = new Date().toISOString();
  return {
    id: `session_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createChatMessageId(),
        role: 'assistant',
        text: defaultDetailChatText(),
        sources: [],
        createdAt: now,
        status: 'done'
      }
    ]
  };
}

function loadChatSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(detailChatStorageKey()) || '[]');
    chatSessions = Array.isArray(parsed) ? parsed.filter((session) => session && session.id) : [];
  } catch {
    chatSessions = [];
  }

  activeChatSessionId = localStorage.getItem(detailChatActiveKey()) || '';
  if (!chatSessions.length) {
    chatSessions = [createChatSession('Asset evidence')];
  }
  if (!chatSessions.some((session) => session.id === activeChatSessionId)) {
    activeChatSessionId = chatSessions[0].id;
  }
  saveChatSessions();
}

function saveChatSessions() {
  const trimmed = chatSessions
    .slice(-12)
    .map((session) => ({
      ...session,
      messages: (session.messages || []).slice(-60)
    }));
  chatSessions = trimmed;
  localStorage.setItem(detailChatStorageKey(), JSON.stringify(trimmed));
  localStorage.setItem(detailChatActiveKey(), activeChatSessionId);
}

function activeChatSession() {
  return chatSessions.find((session) => session.id === activeChatSessionId) || chatSessions[0];
}

function sessionTitleFromQuestion(question) {
  const compact = String(question || '').replace(/\s+/g, ' ').trim();
  return compact.length > 34 ? `${compact.slice(0, 34)}...` : compact || '새 대화';
}

function renderChatSessionControls() {
  if (!elements.chatSessionSelect) return;
  elements.chatSessionSelect.innerHTML = chatSessions
    .map((session) => {
      const count = Math.max(0, (session.messages || []).filter((message) => message.role === 'user').length);
      return `<option value="${escapeHtml(session.id)}">${escapeHtml(session.title || '새 대화')} · ${count}Q</option>`;
    })
    .join('');
  elements.chatSessionSelect.value = activeChatSessionId;
  if (elements.chatDeleteSessionButton) {
    elements.chatDeleteSessionButton.disabled = chatSessions.length <= 1;
  }
}

function updateChatSessionMessage(message) {
  const session = activeChatSession();
  if (!session) return;
  const index = (session.messages || []).findIndex((item) => item.id === message.id);
  if (index >= 0) {
    session.messages[index] = { ...session.messages[index], ...message };
  } else {
    session.messages = [...(session.messages || []), message];
  }
  session.updatedAt = new Date().toISOString();
  saveChatSessions();
  renderChatSessionControls();
}

function addMessage(role, text, options = {}) {
  const bubble = document.createElement('div');
  bubble.className = `agent-message ${role}${options.pending ? ' pending' : ''}`;
  const messageId = options.messageId || createChatMessageId();
  bubble.dataset.messageId = messageId;
  const speaker = role === 'user' ? 'You' : 'Due Diligence Agent';
  const meta = role === 'user' ? 'question' : (options.pending ? 'streaming response' : '현재 파이프라인 1개');
  bubble.innerHTML = `
    <div class="agent-message-meta">
      <div class="agent-message-meta-labels">
        <strong>${speaker}</strong>
        <span>${meta}</span>
      </div>
    </div>
    <div class="agent-message-text">${renderMarkdown(text)}</div>
    ${renderChatSources(options.sources)}
    ${role === 'assistant' ? `
      <div class="agent-message-actions">
        <button type="button" class="help-tooltip" data-action="copy-message" data-tooltip="복사" aria-label="복사"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg></button>
        <button type="button" class="help-tooltip" data-action="open-message-window" data-tooltip="전체보기" aria-label="전체보기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"></path></svg></button>
      </div>
    ` : ''}
  `;

  elements.messages.appendChild(bubble);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  if (options.persist !== false) {
    updateChatSessionMessage({
      id: messageId,
      role,
      text,
      sources: options.sources || [],
      createdAt: new Date().toISOString(),
      status: options.pending ? 'pending' : 'done'
    });
  }
  return bubble;
}

function sourceLabel(path) {
  return String(path || '')
    .split('/')
    .pop()
    .replace(/\.md$/i, '')
    .replaceAll('_', ' ');
}

function renderChatSources(sources = []) {
  if (!Array.isArray(sources) || !sources.length) return '';
  const chips = sources.slice(0, 5).map((source) => {
    const label = escapeHtml(sourceLabel(source.path));
    const score = escapeHtml(source.score ?? '');
    const href = `/wiki-view?path=${encodeURIComponent(source.path || '')}`;
    return `<a class="agent-source-chip" href="${href}" target="_blank" rel="noreferrer">${label}<span>${score}</span></a>`;
  }).join('');
  return `<div class="agent-sources"><span>Wiki sources</span>${chips}</div>`;
}

async function copyChatMessage(text, button) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  if (button) {
    const originalHtml = button.innerHTML;
    const originalTooltip = button.dataset.tooltip || '복사';
    const originalAriaLabel = button.getAttribute('aria-label') || '복사';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>';
    button.dataset.tooltip = '복사됨';
    button.setAttribute('aria-label', '복사됨');
    window.setTimeout(() => {
      button.innerHTML = originalHtml;
      button.dataset.tooltip = originalTooltip;
      button.setAttribute('aria-label', originalAriaLabel);
    }, 1400);
  }
}

function updateMessage(bubble, text, options = {}) {
  const textNode = bubble.querySelector('.agent-message-text');
  if (textNode) textNode.innerHTML = renderMarkdown(text);
  if (options.done) bubble.classList.remove('pending');
  if (options.sources) {
    bubble.querySelector('.agent-sources')?.remove();
    bubble.insertAdjacentHTML('beforeend', renderChatSources(options.sources));
  }
  if (bubble.dataset.messageId) {
    updateChatSessionMessage({
      id: bubble.dataset.messageId,
      role: bubble.classList.contains('user') ? 'user' : 'assistant',
      text,
      sources: options.sources || undefined,
      status: options.done ? 'done' : (bubble.classList.contains('pending') ? 'pending' : 'done')
    });
  }
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderMessagesFromChatSession() {
  const session = activeChatSession();
  if (!session || !elements.messages) return;
  elements.messages.innerHTML = '';
  (session.messages || []).forEach((message) => {
    addMessage(message.role, message.text, {
      messageId: message.id,
      sources: message.sources || [],
      pending: message.status === 'pending',
      persist: false
    });
  });
}

function initializeChatSessions() {
  loadChatSessions();
  renderChatSessionControls();
  renderMessagesFromChatSession();
}

function startNewChatSession(title = '새 대화') {
  const session = createChatSession(title);
  chatSessions.push(session);
  activeChatSessionId = session.id;
  saveChatSessions();
  renderChatSessionControls();
  renderMessagesFromChatSession();
  elements.input?.focus();
}

function deleteActiveChatSession() {
  if (chatSessions.length <= 1) return;
  const current = activeChatSession();
  const confirmed = window.confirm(`'${current?.title || '현재 대화'}' 세션을 삭제할까요?`);
  if (!confirmed) return;
  chatSessions = chatSessions.filter((session) => session.id !== activeChatSessionId);
  activeChatSessionId = chatSessions[0]?.id || '';
  saveChatSessions();
  renderChatSessionControls();
  renderMessagesFromChatSession();
}

function retitleActiveChatSessionFromQuestion(question) {
  const session = activeChatSession();
  if (!session) return;
  const userQuestionCount = (session.messages || []).filter((message) => message.role === 'user').length;
  if (userQuestionCount === 0 || /^(새 대화|Asset evidence)$/i.test(session.title || '')) {
    session.title = sessionTitleFromQuestion(question);
    session.updatedAt = new Date().toISOString();
    saveChatSessions();
    renderChatSessionControls();
  }
}

async function refreshRubric() {
  if (!currentRecord || !currentRecordId) return;
  const button = elements.rubricRefreshButton;
  if (!button) return;

  button.disabled = true;
  button.classList.add('is-saving');
  setCollaborationStatus('Score 기준 갱신 검토 중…');

  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/refresh-rubric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Score 재계산에 실패했습니다.');

    const tone = data.status === 'updated' ? 'success' : data.status === 'error' ? 'error' : '';
    setCollaborationStatus(data.message || '', tone);

    if (data.status === 'updated' && data.record) {
      currentRecord = data.record;
      await loadRecord();
    }
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
  }
}

async function refreshOiPartnership() {
  if (!currentRecord || !currentRecordId) return;
  const button = elements.oiPartnershipRefreshButton;
  if (!button) return;

  button.disabled = true;
  button.classList.add('is-saving');
  setCollaborationStatus('OI Partnership 기준 갱신 중…');

  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(currentRecordId)}/recalculate-oi-partnership`,
      { method: 'POST' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'OI Partnership 재분류에 실패했습니다.');

    currentRecord = data.record;
    renderCollaborationPanel(currentRecord);
    setCollaborationStatus(
      `OI Partnership v${data.oi_partnership_criteria_version || '1.0'} 기준 갱신 완료`,
      'success'
    );
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
  }
}

function aiRevisionInstruction(record) {
  return isFastTriageRecord(record)
    ? 'Detail AI Agent GPT 지침 1 Fast Triage v3.2 update applied from chat answer.'
    : 'Detail AI Agent Full Scout v3.3 re-evaluation applied from chat answer.';
}

function setAiApplyModalStatus(message = '', tone = '') {
  if (!elements.aiApplyModalStatus) return;
  elements.aiApplyModalStatus.textContent = message;
  elements.aiApplyModalStatus.dataset.tone = tone;
}

function setAiApplyModalStep(step) {
  if (!elements.aiApplyModal) return;
  const previewStep = step === 'preview';
  elements.aiApplyModal.dataset.step = previewStep ? 'preview' : 'confirm';
  elements.aiApplyConfirmView.hidden = previewStep;
  elements.aiApplyPreviewView.hidden = !previewStep;
  elements.aiApplyConfirmActions.hidden = previewStep;
  elements.aiApplyPreviewActions.hidden = !previewStep;
  elements.aiApplyModalTitle.textContent = previewStep
    ? '변경 내용 미리보기'
    : 'Agent 답변을 현재 Asset에 반영할까요?';
  setAiApplyModalStatus('');
  (previewStep ? elements.aiApplyCommitButton : elements.aiApplyPreviewButton)?.focus();
}

function openAiApplyModal(context) {
  if (!elements.aiApplyModalBackdrop) return;
  pendingAiApplyContext = context;
  pendingAiApplyPreview = null;
  elements.aiApplySummaryPills.innerHTML = '';
  elements.aiApplyDiffList.innerHTML = '';
  setAiApplyModalStep('confirm');
  elements.aiApplyModalBackdrop.hidden = false;
  document.body.classList.add('ai-apply-modal-open');
  elements.aiApplyPreviewButton?.focus();
}

function closeAiApplyModal() {
  if (!elements.aiApplyModalBackdrop || elements.aiApplyModalBackdrop.hidden) return;
  const sourceButton = pendingAiApplyContext?.button;
  elements.aiApplyModalBackdrop.hidden = true;
  document.body.classList.remove('ai-apply-modal-open');
  pendingAiApplyContext = null;
  pendingAiApplyPreview = null;
  setAiApplyModalStatus('');
  if (sourceButton?.isConnected) sourceButton.focus();
}

function aiApplyChangeType(row = {}) {
  const path = String(row.path || '').toLowerCase();
  if (path.includes('score')) return '점수 변경';
  if (path.includes('source')) return '출처 추가';
  if (/summary|reason|rationale|why_not_higher/.test(path)) return '판단근거 추가';
  return 'Agent 검토 메모 추가';
}

function aiApplyContentPreview(value, label = '실제 반영 내용') {
  const text = String(value ?? '');
  const lines = text.split(/\r?\n/);
  const truncated = lines.length > 5 || text.length > 700;
  const shortText = lines.slice(0, 5).join('\n').slice(0, 700);
  return `
    <div class="ai-apply-content-preview">
      <span>${escapeHtml(label)}</span>
      <pre>${escapeHtml(shortText || '내용 없음')}${truncated ? '\n…' : ''}</pre>
      ${truncated ? `<details><summary>전체 내용 보기</summary><pre>${escapeHtml(text)}</pre></details>` : ''}
    </div>
  `;
}

function renderAiApplyPreview(preview) {
  const summary = preview?.summary || {};
  elements.aiApplySummaryPills.innerHTML = `
    <span><b>${Number(summary.json_change_count) || 0}</b> 실제 변경 항목</span>
    <span><b>${Number(summary.report_change_count) || 0}</b> Revision Note 변경</span>
    <span><b>${Number(summary.wiki_export_count) || 0}</b> 재생성 대상</span>
  `;

  const jsonRows = Array.isArray(preview?.json_diff) ? preview.json_diff : [];
  const jsonContent = jsonRows.length
    ? jsonRows.map((row) => `
        <article class="ai-apply-json-row">
          <div class="ai-apply-change-heading">
            <strong>${escapeHtml(row.label || row.path)}</strong>
            <span>${escapeHtml(aiApplyChangeType(row))}</span>
          </div>
          ${aiApplyContentPreview(row.after)}
          <p class="ai-apply-location"><span>반영 위치</span><code>${escapeHtml(row.label || row.path)} · ${escapeHtml(row.path)}</code></p>
          <div class="ai-apply-before-after">
            <div><span>변경 전</span><pre>${escapeHtml(row.before)}</pre></div>
            <div><span>변경 후</span><pre>${escapeHtml(row.after)}</pre></div>
          </div>
        </article>
      `).join('')
    : '<p class="ai-apply-empty">구조화 JSON에서 변경되는 값이 없습니다.</p>';
  const rawJsonDiff = jsonRows.length
    ? `<details class="ai-apply-raw-details"><summary>전체 raw JSON diff 보기</summary><pre>${escapeHtml(JSON.stringify(jsonRows, null, 2))}</pre></details>`
    : '';

  const reportDiff = preview?.report_diff || {};
  const reportLines = Array.isArray(reportDiff.lines) ? reportDiff.lines : [];
  const revisionNote = reportLines
    .filter((line) => line.type === 'add')
    .map((line) => line.text)
    .join('\n')
    .trim();
  const reportContent = reportLines.length
    ? `${aiApplyContentPreview(revisionNote, '실제로 추가될 Revision Note')}
       <p class="ai-apply-location"><span>반영 위치</span><code>GPT 원문 리포트 하단 · Revision Note</code></p>
       <details class="ai-apply-raw-details"><summary>원문 Report diff 상세보기</summary><div class="ai-apply-code-diff">${reportLines.map((line) => `
        <div class="is-${escapeHtml(line.type || 'context')}"><span>${line.type === 'add' ? '+' : line.type === 'remove' ? '−' : '·'}</span><code>${escapeHtml(line.text)}</code></div>
      `).join('')}</div>${reportDiff.truncated ? '<p class="ai-apply-truncated">긴 변경 내용은 일부만 표시했습니다.</p>' : ''}</details>`
    : '<p class="ai-apply-empty">GPT 원문 리포트에서 변경되는 줄이 없습니다.</p>';

  const wiki = preview?.wiki_export || {};
  const wikiTargets = Array.isArray(wiki.targets) ? wiki.targets : [];
  elements.aiApplyDiffList.innerHTML = `
    <section class="ai-apply-diff-section">
      <header><span>JSON</span><h3>점수 및 판단근거</h3></header>
      <p class="ai-apply-diff-help">최종 저장될 항목명, 변경 유형, 실제 내용과 JSON 위치를 확인하세요.</p>
      <div class="ai-apply-diff-section-body">${jsonContent}${rawJsonDiff}</div>
    </section>
    <section class="ai-apply-diff-section">
      <header><span>REPORT</span><h3>GPT 원문 리포트</h3></header>
      <p class="ai-apply-diff-help">${escapeHtml(reportDiff.summary || '')} 원문 하단에 추가될 내용을 최종 반영 전에 확인할 수 있습니다.</p>
      <div class="ai-apply-diff-section-body">${reportContent}</div>
    </section>
    <section class="ai-apply-diff-section">
      <header><span>EXPORT</span><h3>Wiki export</h3></header>
      <div class="ai-apply-export-row">
        <span class="ai-apply-export-icon" aria-hidden="true">↻</span>
        <div><strong>${escapeHtml(wikiTargets.join(' · ') || 'Wiki export')}</strong><small>${escapeHtml(wiki.note || '')} 저장된 JSON을 기준으로 기존 Wiki 파일을 재생성합니다.</small></div>
      </div>
    </section>
  `;
}

async function requestAiApplyPreview() {
  if (!pendingAiApplyContext) return;
  const button = elements.aiApplyPreviewButton;
  const previousContent = button.innerHTML;
  button.disabled = true;
  button.textContent = '변경 계산 중…';
  setAiApplyModalStatus('저장하지 않고 변경 전·후를 계산하고 있습니다.', 'working');
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/preview-ai-revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer_markdown: pendingAiApplyContext.replyText,
        actor_name: pendingAiApplyContext.actorName,
        instruction: pendingAiApplyContext.instruction
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '변경 내용 미리보기 실패');
    pendingAiApplyPreview = data;
    renderAiApplyPreview(data.preview || {});
    setAiApplyModalStep('preview');
  } catch (error) {
    setAiApplyModalStatus(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = previousContent;
  }
}

async function commitAiApplyPreview() {
  if (!pendingAiApplyContext || !pendingAiApplyPreview) return;
  const context = pendingAiApplyContext;
  const preview = pendingAiApplyPreview;
  const button = elements.aiApplyCommitButton;
  const previousText = button.textContent;
  button.disabled = true;
  button.textContent = '반영 중…';
  setAiApplyModalStatus('확인한 변경을 저장하고 Wiki export를 재생성하고 있습니다.', 'working');
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/apply-ai-revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer_markdown: context.replyText,
        actor_name: context.actorName,
        instruction: context.instruction,
        base_record_hash: preview.base_record_hash
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'AI 응답 반영 실패');

    if (context.messageId) updateChatSessionMessage({ id: context.messageId, canApply: false });
    const wasFastTriage = isFastTriageRecord(currentRecord);
    currentRecord = data.record;
    currentRecordId = data.record_id;
    window.history.replaceState(null, '', detailUrlForCurrentRecord());
    closeAiApplyModal();
    await loadRecord();
    addMessage('assistant', `${wasFastTriage
      ? '확인한 JSON과 원문 리포트 변경을 반영했습니다.'
      : '확인한 Team Review override와 Revision Note를 반영했습니다. GPT 원문 점수표는 변경하지 않았습니다.'}\n\n${summarizeDraftChanges(data.changes || [])}`);
  } catch (error) {
    setAiApplyModalStatus(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = previousText;
  }
}

async function createAiReplyJsonDraft(button) {
  if (!currentRecord) return;
  const bubble = button.closest('.agent-message');
  const replyText = bubble?.querySelector('.agent-message-text')?.innerText?.trim();
  if (!replyText) return;

  const actorName = await ensureIdentity();
  if (!actorName) return;
  openAiApplyModal({
    button,
    messageId: bubble.dataset.messageId || '',
    replyText,
    actorName,
    instruction: aiRevisionInstruction(currentRecord)
  });
}

async function saveRecord(payload, statusTarget = null) {
  if (statusTarget) statusTarget.textContent = '저장 중';
  const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || '저장 실패');
  }

  currentRecordId = data.record_id;
  window.history.replaceState(null, '', detailUrlForCurrentRecord());
  await loadRecord();
  return data;
}

async function deleteCurrentRecord() {
  if (!currentRecordId || !currentRecord) return;
  const summary = currentRecord.json_summary || {};
  const table = currentRecord.structured_table || {};
  const asset = summary.asset_name || table.asset_name || currentRecordId;
  const company = summary.company || table.company || '-';
  const confirmed = window.confirm(`${asset} · ${company} record를 삭제할까요?\n\njson/pipeline-records.json에서 제거되고 Obsidian MD가 재생성됩니다.`);
  if (!confirmed) return;

  elements.status.textContent = 'Deleting';
  elements.deleteRecordButton.disabled = true;
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '삭제 실패');
    elements.status.textContent = 'Deleted';
    window.location.href = elements.detailBackLink?.href || '/';
  } catch (error) {
    elements.status.textContent = 'Delete failed';
    elements.deleteRecordButton.disabled = false;
    addMessage('assistant', `삭제 실패: ${error.message}`);
  }
}

async function loadRecord() {
  if (!currentRecordId) {
    elements.status.textContent = 'Missing id';
    elements.sourceReportViewer.innerHTML = '<div class="empty-state">record id가 없습니다.</div>';
    return;
  }

  const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}`);
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  currentRecord = data.record;
  currentRecordId = data.record_id;
  renderRecord(currentRecord);
  initializeChatSessions();
}

let floatingAgentController = null;

const CRITERIA_DRAWER_SCOPE_LABELS = {
  full: 'TAB2 · Full Scout (PASS/REVIEW/FAIL)',
  focus: 'TAB3 · 집중관리 (OI Partnership Type)'
};

function updateCriteriaDrawerScope() {
  const isFocusTracked = currentRecord?.meta?.focus_management?.is_tracked === true;
  const mode = viewTab === 'focus' && isFocusTracked ? 'focus' : 'full';
  if (elements.criteriaDrawerScopeLabel) {
    elements.criteriaDrawerScopeLabel.textContent = CRITERIA_DRAWER_SCOPE_LABELS[mode] || '';
  }
  elements.criteriaDrawerBody?.querySelectorAll('[data-criteria-tab]').forEach((section) => {
    section.hidden = section.dataset.criteriaTab !== mode;
  });
  if (elements.criteriaDrawer) elements.criteriaDrawer.dataset.activeCriteriaTab = mode;
  return mode;
}

async function syncCriteriaDrawerFromDashboard(mode) {
  const response = await fetch('/', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Dashboard criteria HTTP ${response.status}`);
  const dashboardHtml = await response.text();
  const dashboardDocument = new DOMParser().parseFromString(dashboardHtml, 'text/html');
  const dashboardBody = dashboardDocument.querySelector('#criteriaDrawer .criteria-drawer-body');
  if (!dashboardBody || !elements.criteriaDrawerBody) {
    throw new Error('Dashboard 판단근거를 찾을 수 없습니다.');
  }
  const activeSections = [...dashboardBody.children]
    .filter((section) => section.dataset.criteriaTab === mode);
  if (!activeSections.length) throw new Error(`Dashboard ${mode} 판단근거가 비어 있습니다.`);
  const fragment = document.createDocumentFragment();
  activeSections.forEach((section) => {
    const clone = section.cloneNode(true);
    clone.hidden = false;
    fragment.append(clone);
  });
  elements.criteriaDrawerBody.replaceChildren(fragment);
  elements.criteriaDrawer.dataset.activeCriteriaTab = mode;
}

async function openCriteriaDrawer() {
  const mode = updateCriteriaDrawerScope();
  elements.criteriaDrawer.hidden = false;
  elements.criteriaBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.criteriaDrawer.classList.add('open');
    elements.criteriaBackdrop.classList.add('open');
    elements.criteriaDrawer.setAttribute('aria-hidden', 'false');
  });
  if (elements.criteriaDrawerBody) elements.criteriaDrawerBody.setAttribute('aria-busy', 'true');
  try {
    await syncCriteriaDrawerFromDashboard(mode);
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
  setTimeout(() => {
    elements.criteriaDrawer.hidden = true;
    elements.criteriaBackdrop.hidden = true;
  }, 180);
}

let pendingReuploadRecord = null;

function normalizedPipelineIdentityText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function recordIdentityParts(record) {
  const table = record?.structured_table || {};
  const summary = record?.json_summary || {};
  return {
    company: String(table.company || summary.company || '').trim(),
    asset: String(table.asset_name || summary.asset_name || '').trim()
  };
}

function recordKeyForDetailReupload(record) {
  const explicit = String(record?.meta?.output_filename_base || '').trim();
  if (explicit) return explicit;
  const identity = recordIdentityParts(record);
  return `${identity.company || 'unknown'}_${identity.asset || 'asset'}`;
}

function parseFullScoutReupload(value) {
  let text = String(value || '').trim();
  const outerFence = text.match(/^```(?:text|markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  if (outerFence) text = outerFence[1].trim();
  const separatorMatches = [...text.matchAll(/^--- JSON DATA ---[ \t]*$/gm)];
  if (separatorMatches.length !== 1) {
    throw new Error('--- JSON DATA --- 구분선이 정확히 한 번 있어야 합니다.');
  }
  const separator = separatorMatches[0];
  const markdown = text.slice(0, separator.index).trim();
  const jsonText = text.slice(separator.index + separator[0].length).trim();
  if (!markdown || !/^#{1,6}\s+/m.test(markdown)) throw new Error('제목이 포함된 Markdown 원문을 찾지 못했습니다.');
  if (!jsonText) throw new Error('구분선 아래에 Full Scout JSON이 없습니다.');
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`JSON 문법 오류: ${error.message}`);
  }
  if (payload && !Array.isArray(payload) && Array.isArray(payload.records)) payload = payload.records;
  if (Array.isArray(payload)) {
    if (payload.length !== 1) throw new Error('상세 재업로드는 Full Scout record 한 개만 입력할 수 있습니다.');
    [payload] = payload;
  }
  if (!payload || typeof payload !== 'object') throw new Error('Full Scout JSON 객체를 찾지 못했습니다.');
  const record = expandCompactInputRecord(payload, 'full');
  const reviewType = String(record?.meta?.review_type || '').toLowerCase();
  if (reviewType.includes('triage') || record.triage) throw new Error('TAB1 Fast Triage 결과는 상세 Full Scout 재업로드에 사용할 수 없습니다.');
  const criteria = record?.scoring?.criteria || {};
  const requiredCriteria = Object.keys(scoringLabels);
  const missing = requiredCriteria.filter((criterionId) => !criteria[criterionId]);
  if (missing.length) throw new Error(`Full Scout 점수 항목이 누락되었습니다: ${missing.join(', ')}`);
  record.source_report = {
    ...(record.source_report || {}),
    raw_markdown: markdown,
    source_format: record.source_report?.source_format || 'gpt_markdown_report',
    parser_status: record.source_report?.parser_status || 'gpt_structured_output',
    parser_note: record.source_report?.parser_note || 'Detail Full Scout combined response reupload.'
  };
  return { record, markdown };
}

function openReportReuploadModal() {
  pendingReuploadRecord = null;
  elements.reportReuploadInput.value = '';
  elements.reportReuploadValidation.textContent = '입력 대기 중';
  elements.reportReuploadValidation.dataset.tone = '';
  elements.reportReuploadSave.disabled = true;
  elements.reportReuploadBackdrop.hidden = false;
  document.body.classList.add('report-reupload-open');
  elements.reportReuploadInput.focus();
}

function closeReportReuploadModal() {
  pendingReuploadRecord = null;
  elements.reportReuploadBackdrop.hidden = true;
  document.body.classList.remove('report-reupload-open');
  elements.detailReuploadButton?.focus();
}

function reviewReportReupload() {
  try {
    const parsed = parseFullScoutReupload(elements.reportReuploadInput.value);
    const incoming = recordIdentityParts(parsed.record);
    const existing = recordIdentityParts(currentRecord);
    if (
      normalizedPipelineIdentityText(incoming.company) !== normalizedPipelineIdentityText(existing.company)
      || normalizedPipelineIdentityText(incoming.asset) !== normalizedPipelineIdentityText(existing.asset)
    ) {
      throw new Error(`현재 Asset(${existing.company} · ${existing.asset})과 입력 결과(${incoming.company} · ${incoming.asset})가 일치하지 않습니다.`);
    }
    pendingReuploadRecord = parsed.record;
    const noteCount = Array.isArray(currentRecord?.meta?.topic_notes) ? currentRecord.meta.topic_notes.length : 0;
    elements.reportReuploadValidation.dataset.tone = 'success';
    elements.reportReuploadValidation.textContent = `검증 완료 · ${incoming.company} · ${incoming.asset} · Topic 메모 ${noteCount}개 유지`;
    elements.reportReuploadSave.disabled = false;
  } catch (error) {
    pendingReuploadRecord = null;
    elements.reportReuploadValidation.dataset.tone = 'error';
    elements.reportReuploadValidation.textContent = error.message;
    elements.reportReuploadSave.disabled = true;
  }
}

async function saveReportReupload() {
  if (!pendingReuploadRecord || !currentRecordId) return;
  const identity = recordIdentityParts(currentRecord);
  const confirmed = window.confirm(
    `${identity.company} · ${identity.asset} Full Scout 원문과 구조화 데이터를 교체할까요?\n\nTopic 메모, 팀 코멘트, 파트너사 자료는 유지됩니다.`
  );
  if (!confirmed) return;
  const incomingId = recordKeyForDetailReupload(pendingReuploadRecord);
  elements.reportReuploadSave.disabled = true;
  elements.reportReuploadValidation.dataset.tone = '';
  elements.reportReuploadValidation.textContent = '검증된 리포트로 교체하는 중…';
  try {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: [pendingReuploadRecord],
        confirmed_replacements: [{ incoming_record_id: incomingId, existing_record_id: currentRecordId }]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Full Scout 재업로드에 실패했습니다.');
    closeReportReuploadModal();
    await loadRecord();
  } catch (error) {
    elements.reportReuploadValidation.dataset.tone = 'error';
    elements.reportReuploadValidation.textContent = error.message;
    elements.reportReuploadSave.disabled = false;
  }
}

function openEditDrawer() {
  if (!currentRecord || !getCurrentUser()?.is_admin) return;
  elements.jsonEditor.value = JSON.stringify(currentRecord, null, 2);
  elements.editStatus.textContent = '편집 가능';
  elements.editDrawer.hidden = false;
  elements.editBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.editDrawer.classList.add('open');
    elements.editBackdrop.classList.add('open');
    elements.editDrawer.setAttribute('aria-hidden', 'false');
    elements.jsonEditor.focus();
  });
}

function closeEditDrawer() {
  elements.editDrawer.classList.remove('open');
  elements.editBackdrop.classList.remove('open');
  elements.editDrawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    elements.editDrawer.hidden = true;
    elements.editBackdrop.hidden = true;
  }, 180);
}

function formatEditorJson() {
  try {
    const parsed = JSON.parse(elements.jsonEditor.value);
    elements.jsonEditor.value = JSON.stringify(parsed, null, 2);
    elements.editStatus.textContent = '정렬 완료';
  } catch (error) {
    elements.editStatus.textContent = `JSON 오류: ${error.message}`;
  }
}

async function saveEditedJson() {
  let payload;
  try {
    payload = JSON.parse(elements.jsonEditor.value);
  } catch (error) {
    elements.editStatus.textContent = `JSON 오류: ${error.message}`;
    return;
  }

  try {
    await saveRecord(payload, elements.editStatus);
    elements.editStatus.textContent = '저장 완료';
    closeEditDrawer();
  } catch (error) {
    elements.editStatus.textContent = error.message;
  }
}

async function applyPendingDraft(button) {
  if (!pendingDraftRecord) return;
  button.disabled = true;
  button.textContent = '적용 중';
  try {
    await saveRecord(pendingDraftRecord);
    pendingDraftRecord = null;
    addMessage('assistant', '수정 초안을 JSON 원본에 저장했습니다. 원문 JSON 보기와 메인 대시보드 점수가 같은 기준으로 갱신됩니다.');
  } catch (error) {
    addMessage('assistant', `초안 저장 오류: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = '초안 적용';
  }
}

function reviewPendingDraft() {
  if (!pendingDraftRecord) return;
  elements.jsonEditor.value = JSON.stringify(pendingDraftRecord, null, 2);
  elements.editStatus.textContent = 'AI 초안 검토 중';
  elements.editDrawer.hidden = false;
  elements.editBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.editDrawer.classList.add('open');
    elements.editBackdrop.classList.add('open');
    elements.editDrawer.setAttribute('aria-hidden', 'false');
    elements.jsonEditor.focus();
  });
}

function parseSseEvent(block) {
  const lines = block.split('\n');
  let event = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

async function streamDetailChatReply(message, bubble) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      record_id: currentRecordId,
      message,
      dashboard_context: '',
      allow_draft: false
    })
  });
  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || 'stream failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let sources = [];
  let completed = false;

  const handleSseBlock = (block) => {
    const parsed = parseSseEvent(block);
    if (!parsed) return;
    if (parsed.event === 'sources') {
      sources = parsed.data || [];
      updateMessage(bubble, text || '관련 wiki note를 찾았습니다. 응답을 생성 중입니다…', { sources });
    }
    if (parsed.event === 'status' && !text) {
      updateMessage(bubble, parsed.data?.message || '응답을 생성 중입니다…', { sources });
    }
    if (parsed.event === 'delta') {
      text += parsed.data?.text || '';
      updateMessage(bubble, text, { sources });
    }
    if (parsed.event === 'done') {
      completed = true;
      updateMessage(bubble, text || '응답이 비어 있습니다. 다시 질문해 주세요.', { done: true, sources });
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) handleSseBlock(block);
  }

  if (buffer.trim()) handleSseBlock(buffer);
  if (!completed) updateMessage(bubble, text || '응답이 비어 있습니다. 다시 질문해 주세요.', { done: true, sources });
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = elements.input.value.trim();
  if (!message || !currentRecord) return;

  elements.input.value = '';
  retitleActiveChatSessionFromQuestion(message);
  addMessage('user', message);
  const submitButton = elements.form.querySelector('button[type="submit"]');
  const submitButtonContent = submitButton?.innerHTML;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.setAttribute('aria-label', '답변 생성 중');
    submitButton.innerHTML = '<svg class="agent-send-progress" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" /></svg>';
  }
  const responseBubble = addMessage('assistant', '질문 분석 중…', { pending: true });

  try {
    await streamDetailChatReply(message, responseBubble);
  } catch (error) {
    updateMessage(responseBubble, `채팅 응답 오류: ${error.message}`, { done: true });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.setAttribute('aria-label', '질문 전송');
      submitButton.innerHTML = submitButtonContent;
    }
  }
});

elements.input.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  elements.form.requestSubmit();
});

document.querySelectorAll('[data-chat-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    elements.input.value = button.dataset.chatPrompt;
    elements.input.focus();
  });
});

elements.chatSessionSelect?.addEventListener('change', (event) => {
  activeChatSessionId = event.target.value;
  saveChatSessions();
  renderMessagesFromChatSession();
});

elements.chatNewSessionButton?.addEventListener('click', () => {
  startNewChatSession();
});

elements.chatDeleteSessionButton?.addEventListener('click', deleteActiveChatSession);

elements.messages.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  if (button.dataset.action === 'copy-message') {
    const bubble = button.closest('.agent-message');
    const messageId = bubble?.dataset.messageId;
    const message = activeChatSession()?.messages?.find((item) => item.id === messageId);
    if (message) copyChatMessage(message.text || '', button);
  }

  if (button.dataset.action === 'open-message-window') {
    const bubble = button.closest('.agent-message');
    const messageId = bubble?.dataset.messageId;
    const message = activeChatSession()?.messages?.find((item) => item.id === messageId);
    if (message) openMarkdownInNewWindow('AI 응답 전체보기', message.text || '');
  }
});

elements.detailOutlineList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-outline-target]');
  if (!button) return;
  navigateToOutlineTarget(button.dataset.outlineTarget);
});

elements.detailScoreSequence?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-report-criterion]');
  if (!button) return;
  navigateToCriterionReportSection(button.dataset.reportCriterion);
});

elements.detailFocusToggle?.addEventListener('click', () => {
  saveDetailFocus(elements.detailFocusToggle.dataset.focusAction || 'add');
});

elements.rubricRefreshButton?.addEventListener('click', refreshRubric);
elements.oiPartnershipRefreshButton?.addEventListener('click', refreshOiPartnership);
elements.detailReviewInfoToggle?.addEventListener('click', () => {
  const expanded = elements.detailReviewInfoToggle.getAttribute('aria-expanded') === 'true';
  setReviewInfoExpanded(!expanded);
});

elements.detailActionDate?.addEventListener('change', (event) => {
  saveDetailActionDate(event.target.value || '');
});

elements.detailActionOwner?.addEventListener('change', (event) => {
  saveDetailActionOwner(event.target.value || '');
});

elements.detailActionPlan?.addEventListener('change', (event) => {
  saveDetailActionPlan(event.target.value || '');
});

elements.detailOiPartnershipType?.addEventListener('change', (event) => {
  saveDetailPartnershipType(event.target.value || '');
});

elements.detailOiPartnershipNote?.addEventListener('change', (event) => {
  saveDetailFocusField(
    'partnership_note',
    event.target.value,
    elements.detailOiPartnershipNote,
    'OI Partnership 근거'
  );
});

elements.detailOiPartnershipNote?.addEventListener('input', resizeOiPartnershipNoteInput);

elements.detailOiPartnershipNote?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    event.currentTarget.value = event.currentTarget.dataset.previousValue || '';
    event.currentTarget.blur();
  }
});

elements.detailOiMaterialFlags?.addEventListener('click', (event) => {
  const button = event.target.closest('.oi-material-toggle[data-material-key]');
  if (!button || !elements.detailOiMaterialFlags.contains(button) || button.disabled) return;
  event.preventDefault();
  const key = button.dataset.materialKey;
  const nextActive = !button.classList.contains('is-active');
  saveDetailMaterialFlag(key, nextActive, button);
});

elements.detailDecisionStatus?.addEventListener('change', (event) => {
  saveDetailDecisionStatus(event.target.value);
});

elements.detailReviewSummary?.addEventListener('change', (event) => {
  saveDetailReviewReason(event.target.value);
});

elements.detailReviewSummary?.addEventListener('input', resizeReviewReasonInput);

elements.detailReviewSummary?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.blur();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    event.currentTarget.value = event.currentTarget.dataset.previousValue || '';
    event.currentTarget.blur();
  }
});

elements.detailCommentForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitDetailComment();
});

elements.detailCommentInput?.addEventListener('input', (event) => {
  syncMessageComposer(event.currentTarget);
});

elements.detailCommentInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.detailCommentForm?.requestSubmit();
  }
});

elements.detailCommentThread?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-reply-comment-id]');
  if (!button) return;
  elements.detailReplyParentId.value = button.dataset.replyCommentId;
  elements.detailReplyLabel.textContent = `${button.dataset.replyAuthor || '익명'}님에게 답글 작성 중`;
  elements.detailReplyContext.hidden = false;
  elements.detailCommentInput?.focus();
});

elements.detailReplyCancel?.addEventListener('click', clearReplyTarget);

elements.detailAttachmentAddButton?.addEventListener('click', () => {
  elements.detailAttachmentInput?.click();
});

elements.detailAttachmentInput?.addEventListener('change', (event) => {
  const files = event.target.files;
  if (files?.length) uploadAttachments(files);
});

elements.detailAttachmentsList?.addEventListener('click', (event) => {
  const previewButton = event.target.closest('[data-preview-attachment-id]');
  if (previewButton) {
    showAttachmentPreview(previewButton.dataset.previewAttachmentId);
    return;
  }
  const deleteButton = event.target.closest('[data-delete-attachment-id]');
  if (deleteButton) deleteAttachment(deleteButton.dataset.deleteAttachmentId);
});

elements.detailViewerBackButton?.addEventListener('click', () => {
  renderSourceReport(currentRecord);
});

elements.detailViewerOpenWindowButton?.addEventListener('click', () => {
  openReportModal();
});

elements.detailViewerCopyButton?.addEventListener('click', () => {
  copyCurrentSourceMarkdown(elements.detailViewerCopyButton);
});

elements.reportModalCopyButton?.addEventListener('click', () => {
  copyCurrentSourceMarkdown(elements.reportModalCopyButton);
});

elements.reportModalCloseButton?.addEventListener('click', closeReportModal);

elements.reportModalBackdrop?.addEventListener('click', (event) => {
  if (event.target === elements.reportModalBackdrop) closeReportModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.reportModalBackdrop?.hidden) closeReportModal();
});

if (elements.detailAttachmentDropzone) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    elements.detailAttachmentDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      elements.detailAttachmentDropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    elements.detailAttachmentDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      elements.detailAttachmentDropzone.classList.remove('is-dragover');
    });
  });
  elements.detailAttachmentDropzone.addEventListener('drop', (event) => {
    const files = event.dataTransfer?.files;
    if (files?.length) uploadAttachments(files);
  });
  elements.detailAttachmentDropzone.addEventListener('click', () => {
    elements.detailAttachmentInput?.click();
  });
  elements.detailAttachmentDropzone.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    elements.detailAttachmentInput?.click();
  });
}

elements.qualitativeReviewPanel?.addEventListener('submit', (event) => {
  const form = event.target.closest('.qualitative-form');
  if (form) {
    event.preventDefault();
    submitQualitativeOpinion(form.dataset.criterionId, form);
    return;
  }
  const addCriterionForm = event.target.closest('#qualitativeAddCriterionForm');
  if (addCriterionForm) {
    event.preventDefault();
    addCustomQualitativeCriterion(addCriterionForm);
  }
});

elements.qualitativeReviewPanel?.addEventListener('input', (event) => {
  const textarea = event.target.closest('.qualitative-form .message-composer-textarea');
  if (textarea) syncMessageComposer(textarea);
});

elements.qualitativeReviewPanel?.addEventListener('keydown', (event) => {
  const textarea = event.target.closest('.qualitative-form .message-composer-textarea');
  if (!textarea || event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  textarea.closest('form')?.requestSubmit();
});

elements.qualitativeReviewPanel?.addEventListener('click', (event) => {
  const aiGenerateAllButton = event.target.closest('#qualitativeAiGenerateAllButton');
  if (aiGenerateAllButton) {
    generateAllQualitativeAiOpinions(aiGenerateAllButton);
    return;
  }
  const deleteButton = event.target.closest('[data-delete-qualitative-entry-id]');
  if (deleteButton) {
    deleteQualitativeOpinion(deleteButton.dataset.deleteQualitativeEntryId);
    return;
  }
  const aiGenerateButton = event.target.closest('[data-ai-generate-criterion-id]');
  if (aiGenerateButton) {
    generateQualitativeAiOpinion(aiGenerateButton.dataset.aiGenerateCriterionId, aiGenerateButton);
    return;
  }
  const deleteCriterionButton = event.target.closest('[data-delete-criterion-id]');
  if (deleteCriterionButton) {
    deleteCustomQualitativeCriterion(deleteCriterionButton.dataset.deleteCriterionId);
    return;
  }
  const addToggleButton = event.target.closest('#qualitativeAddCriterionToggle');
  if (addToggleButton) {
    const form = elements.qualitativeReviewPanel.querySelector('#qualitativeAddCriterionForm');
    if (form) {
      form.hidden = false;
      addToggleButton.hidden = true;
      loadQualitativeCriterionSuggestions(form);
      form.querySelector('input[name="label"]')?.focus();
    }
    return;
  }
  const importCriterionButton = event.target.closest('[data-import-criterion]');
  if (importCriterionButton) {
    importQualitativeCriterion(importCriterionButton);
    return;
  }
  const cancelAddButton = event.target.closest('#qualitativeAddCriterionCancel');
  if (cancelAddButton) {
    const form = elements.qualitativeReviewPanel.querySelector('#qualitativeAddCriterionForm');
    const toggleButton = elements.qualitativeReviewPanel.querySelector('#qualitativeAddCriterionToggle');
    if (form) {
      form.reset();
      form.hidden = true;
    }
    if (toggleButton) toggleButton.hidden = false;
  }
});

elements.criteriaDrawerButton.addEventListener('click', openCriteriaDrawer);
elements.criteriaDrawerClose.addEventListener('click', closeCriteriaDrawer);
elements.criteriaBackdrop.addEventListener('click', closeCriteriaDrawer);
elements.deleteRecordButton.addEventListener('click', deleteCurrentRecord);
elements.detailReuploadButton?.addEventListener('click', openReportReuploadModal);
elements.reportReuploadClose?.addEventListener('click', closeReportReuploadModal);
elements.reportReuploadBackdrop?.addEventListener('click', (event) => {
  if (event.target === elements.reportReuploadBackdrop) closeReportReuploadModal();
});
elements.reportReuploadReview?.addEventListener('click', reviewReportReupload);
elements.reportReuploadSave?.addEventListener('click', saveReportReupload);
elements.reportReuploadInput?.addEventListener('input', () => {
  pendingReuploadRecord = null;
  elements.reportReuploadSave.disabled = true;
  elements.reportReuploadValidation.dataset.tone = '';
  elements.reportReuploadValidation.textContent = '내용이 변경되었습니다. 입력 검토를 다시 실행해 주세요.';
});
elements.editButton?.addEventListener('click', openEditDrawer);
elements.editDrawerClose?.addEventListener('click', closeEditDrawer);
elements.editBackdrop?.addEventListener('click', closeEditDrawer);
elements.formatJsonButton?.addEventListener('click', formatEditorJson);
elements.saveJsonEditButton?.addEventListener('click', saveEditedJson);

elements.sourceReportViewer?.addEventListener('click', async (event) => {
  const panel = event.target.closest('[data-topic-note-panel]');
  if (!panel) return;
  if (event.target.closest('[data-topic-note-add]')) {
    const form = panel.querySelector('[data-topic-note-form]');
    if (form) {
      form.hidden = false;
      form.querySelector('textarea')?.focus();
    }
    return;
  }
  if (event.target.closest('[data-topic-note-cancel]')) {
    const form = panel.querySelector('[data-topic-note-form]');
    if (form) {
      form.reset();
      form.hidden = true;
    }
    return;
  }
  const noteItem = event.target.closest('[data-topic-note-id]');
  const noteId = noteItem?.dataset.topicNoteId;
  if (!noteId) return;
  const note = (currentRecord?.meta?.topic_notes || []).find((item) => item?.id === noteId);
  if (event.target.closest('[data-topic-note-edit]')) {
    const nextBody = window.prompt('Topic 메모 수정', note?.body || '');
    if (nextBody === null || nextBody.trim() === String(note?.body || '').trim()) return;
    try {
      await editTopicNote(noteId, nextBody.trim());
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }
  if (event.target.closest('[data-topic-note-delete]')) {
    if (!window.confirm('이 Topic 메모를 삭제할까요?')) return;
    try {
      await deleteTopicNote(noteId);
    } catch (error) {
      window.alert(error.message);
    }
  }
});

elements.sourceReportViewer?.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-topic-note-form]');
  if (!form) return;
  event.preventDefault();
  const panel = form.closest('[data-topic-note-panel]');
  const textarea = form.querySelector('textarea');
  const status = form.querySelector('[data-topic-note-status]');
  const body = textarea?.value.trim() || '';
  if (!body) {
    if (status) status.textContent = '메모를 입력해 주세요.';
    textarea?.focus();
    return;
  }
  form.querySelectorAll('button, textarea').forEach((control) => { control.disabled = true; });
  if (status) status.textContent = '저장 중…';
  try {
    await saveTopicNote(panel, body);
  } catch (error) {
    form.querySelectorAll('button, textarea').forEach((control) => { control.disabled = false; });
    if (status) status.textContent = error.message;
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (elements.editDrawer.classList.contains('open')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeEditDrawer();
    return;
  }
  if (!elements.reportReuploadBackdrop?.hidden) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeReportReuploadModal();
    return;
  }
  if (elements.criteriaDrawer.classList.contains('open')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeCriteriaDrawer();
  }
});

floatingAgentController = initFloatingAgent({
  launcher: elements.detailAiButton,
  panel: elements.aiDrawer,
  closeButton: elements.aiDrawerClose,
  minimizeButton: elements.aiDrawer.querySelector('[data-floating-agent-minimize]'),
  maximizeButton: elements.aiDrawer.querySelector('[data-floating-agent-maximize]'),
  dragHandle: elements.aiDrawer.querySelector('[data-floating-agent-drag]'),
  resizeHandle: elements.aiDrawer.querySelector('[data-floating-agent-resize]'),
  storageKey: 'skbp.detail.floatingAgentGeometry.v1',
  initialWidth: 600,
  initialHeight: 700,
  focusTarget: elements.input
});
setupThemeToggle();
initAuthUI();
renderCommentIdentity();
window.addEventListener('skbp:authchange', renderCommentIdentity);

elements.identityModalSubmit?.addEventListener('click', () => {
  const value = elements.identityModalInput?.value.trim() || '';
  if (!value) {
    elements.identityModalInput?.focus();
    return;
  }
  closeIdentityModal(value);
});

elements.identityModalCancel?.addEventListener('click', () => closeIdentityModal(null));

elements.identityModalBackdrop?.addEventListener('click', (event) => {
  if (event.target === elements.identityModalBackdrop) closeIdentityModal(null);
});

elements.identityModalInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    elements.identityModalSubmit?.click();
  }
  if (event.key === 'Escape') {
    closeIdentityModal(null);
  }
});

elements.detailCommentIdentityChange?.addEventListener('click', async () => {
  await openAuthModal('signin');
  renderCommentIdentity();
});

loadRecord().catch((error) => {
  elements.status.textContent = 'Load failed';
  elements.sourceReportViewer.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  if (elements.detailCommentThread) {
    elements.detailCommentThread.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
  setCollaborationStatus('상세 데이터를 불러오지 못했습니다.', 'error');
});
