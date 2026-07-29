import { setupThemeToggle } from './theme.js';

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
  return (sessionStorage.getItem(DETAIL_COMMENT_AUTHOR_KEY) || '').trim();
}

function setStoredIdentity(name) {
  sessionStorage.setItem(DETAIL_COMMENT_AUTHOR_KEY, name);
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
  const stored = getStoredIdentity();
  if (stored) return stored;
  const entered = await openIdentityModal();
  if (!entered) return null;
  setStoredIdentity(entered);
  return entered;
}

const elements = {
  title: document.querySelector('#detailTitle'),
  status: document.querySelector('#detailStatus'),
  subtitle: document.querySelector('#detailSubtitle'),
  detailMetaInfo: document.querySelector('#detailMetaInfo'),
  detailEditHistory: document.querySelector('#detailEditHistory'),
  sourceReportViewer: document.querySelector('#sourceReportViewer'),
  detailOutlineList: document.querySelector('#detailOutlineList'),
  detailFocusToggle: document.querySelector('#detailFocusToggle'),
  detailFilter2Row: document.querySelector('#detailFilter2Row'),
  detailActionDate: document.querySelector('#detailActionDate'),
  detailActionOwner: document.querySelector('#detailActionOwner'),
  detailActionPlan: document.querySelector('#detailActionPlan'),
  detailDecisionStatus: document.querySelector('#detailDecisionStatus'),
  detailDecisionOrigin: document.querySelector('#detailDecisionOrigin'),
  detailTotalScore: document.querySelector('#detailTotalScore'),
  detailScoreSequence: document.querySelector('#detailScoreSequence'),
  detailReviewSummary: document.querySelector('#detailReviewSummary'),
  detailReviewReasonShell: document.querySelector('#detailReviewReasonShell'),
  detailReviewReasonOrigin: document.querySelector('#detailReviewReasonOrigin'),
  detailOiPartnershipRow: document.querySelector('#detailOiPartnershipRow'),
  detailOiPartnershipOrigin: document.querySelector('#detailOiPartnershipOrigin'),
  detailOiPartnershipType: document.querySelector('#detailOiPartnershipType'),
  detailOiPartnershipNoteShell: document.querySelector('#detailOiPartnershipNoteShell'),
  detailOiPartnershipNote: document.querySelector('#detailOiPartnershipNote'),
  detailOiPartnershipNoteOrigin: document.querySelector('#detailOiPartnershipNoteOrigin'),
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
  detailAttachmentStatus: document.querySelector('#detailAttachmentStatus'),
  detailViewerTitle: document.querySelector('#detailViewerTitle'),
  detailViewerBackButton: document.querySelector('#detailViewerBackButton'),
  qualitativeReviewPanel: document.querySelector('#qualitativeReviewPanel'),
  detailAiButton: document.querySelector('#detailAiButton'),
  criteriaDrawerButton: document.querySelector('#criteriaDrawerButton'),
  criteriaDrawer: document.querySelector('#criteriaDrawer'),
  criteriaBackdrop: document.querySelector('#criteriaBackdrop'),
  criteriaDrawerClose: document.querySelector('#criteriaDrawerClose'),
  criteriaDrawerScopeLabel: document.querySelector('#criteriaDrawerScopeLabel'),
  deleteRecordButton: document.querySelector('#deleteRecordButton'),
  aiDrawer: document.querySelector('#aiDrawer'),
  aiBackdrop: document.querySelector('#aiBackdrop'),
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
  editStatus: document.querySelector('#editStatus')
};

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

// Temporary v1 criteria — keep in sync with main.py's QUALITATIVE_REVIEW_CRITERIA
// and config/qualitative_review_criteria.md.
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
let pendingDraftRecord = null;
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

function isPlaceholderRawMarkdown(value) {
  const text = String(value || '').trim();
  return !text
    || text === 'Paste the full Markdown report text here if available.'
    || text === 'Markdown report is provided separately in the MD copy box.';
}

function getRubricMetadata(record) {
  const meta = record?.meta || {};
  const criteriaReference = record?.scoring?.criteria?.target_relevance?.criteria_reference || null;
  const fallbackVersion = meta.schema_version || (isFastTriageRecord(record) ? '3.1' : '3.1');
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

function hasNoThemeFit(theme, cluster) {
  const value = `${theme || ''} ${cluster || ''}`.toLowerCase();
  return !value.trim() || /n\/?a|no theme|no cluster|no mapped|none|미해당/.test(value);
}

function computeHardFilter(record) {
  const summary = record.json_summary || {};
  const criteria = record.scoring?.criteria || {};
  const total = number(record.scoring?.total_score);
  const targetScore = number(summary.target_relevance_score ?? criteria.target_relevance?.score);
  const moaScore = number(criteria.moa_validity?.score);
  const dataScore = number(criteria.data_maturity?.score);
  const notes = collectHardFilterNotes(record);
  const reasons = [];

  const noThemeFit = hasNoThemeFit(summary.theme, summary.cluster);
  const failBlocker = /(outside primary|outside.*theme|out of scope|no public target|no.*target\/moa|discontinued|dormant|범위 밖|미해당|중단)/i.test(notes);
  const reviewUncertainty = /(stage|rights?|license|licensed|ownership|asset identity|identity|source|official|registry|unclear|uncertain|not public|not verified|confirmation|confirm|sponsor|단계|권리|출처|공식|불확실|확인 필요|미확인|정체|라이선스)/i.test(notes);

  if (Number.isFinite(total) && total <= 8) reasons.push(`Total score ${total} <= 8`);
  if (Number.isFinite(targetScore) && targetScore <= 1) reasons.push(`Target Relevance ${targetScore} <= 1`);
  if (noThemeFit) reasons.push('SKBP Theme/Cluster fit ?놁쓬');
  if (failBlocker) reasons.push('Hard blocker keyword detected');

  if (reasons.length) {
    return { status: 'FAIL', reason: reasons.join('; ') };
  }

  const passScores = total >= 14 && targetScore >= 3 && moaScore >= 2 && dataScore >= 2;
  if (passScores && !reviewUncertainty) {
    return {
      status: 'PASS',
      reason: `Total ${total} >= 14, TR ${targetScore} >= 3, MOA ${moaScore} >= 2, Data ${dataScore} >= 2, hard blocker ?놁쓬`
    };
  }

  if (Number.isFinite(total) && total >= 9 && total <= 13) {
    reasons.push(`Total score ${total} is REVIEW range 9-13`);
  }
  if (!passScores) {
    reasons.push(`PASS score gate 誘몄땐議? Total ${total ?? '-'}, TR ${targetScore ?? '-'}, MOA ${moaScore ?? '-'}, Data ${dataScore ?? '-'}`);
  }
  if (reviewUncertainty) {
    reasons.push('stage/rights/asset identity/source 遺덊솗?ㅼ꽦 ?뺤씤 ?꾩슂');
  }

  return { status: 'REVIEW', reason: reasons.join('; ') || '異붽? diligence ?꾩슂' };
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
  const titleHtml = url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
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
    return '<div class="empty-evidence">?곌껐??異쒖쿂 留곹겕媛 ?놁뒿?덈떎. ?먮Ц 由ы룷???먮뒗 evidence_sources??URL??異붽??섎㈃ ?ш린???쒖떆?⑸땲??</div>';
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
    : '<li>?뺤씤??financing / partnership signal ?놁쓬</li>';

  return `
    <section class="company-profile-card">
      <div class="score-card-header">
        <div>
          <span>Company Profile</span>
          <h3>${escapeHtml(profile.company_name || '-')}</h3>
        </div>
        ${profile.website ? `<strong><a href="${escapeHtml(profile.website)}" target="_blank" rel="noreferrer">Official website</a></strong>` : '<strong>Official website ?꾩슂</strong>'}
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
        : '<li>蹂꾨룄 遺덊솗?ㅼ꽦 硫붾え ?놁쓬</li>';
      return `
        <article class="score-evidence-card">
          <div class="score-card-header">
            <div>
              <span>${escapeHtml(label)}</span>
              <h3>${escapeHtml(formatScore(score))} / 3</h3>
            </div>
            <strong>${escapeHtml(rubricDefinition)}</strong>
          </div>
          <div class="score-evidence-block">
            <h4>Evidence Type</h4>
            <p>${escapeHtml(item.evidence_type || '-')}</p>
            <p>${escapeHtml(item.evidence_type_reason || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>?먮떒 ?댁쑀</h4>
            <p>${escapeHtml(item.main_line_summary || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>Why Not Higher</h4>
            <p>${escapeHtml(item.why_not_higher || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>議곗궗 硫붾え</h4>
            <p>${escapeHtml(item.investigation_note || '-')}</p>
          </div>
          <div class="score-evidence-block">
            <h4>遺덊솗?ㅼ꽦 / ?뺤씤 ?꾩슂</h4>
            <ul>${uncertain}</ul>
          </div>
          ${key === 'marketability' ? renderMarketabilityCalculation(item.calculation) : ''}
          <div class="score-evidence-block">
            <h4>異쒖쿂 / ?뱁럹?댁? 留곹겕</h4>
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
          <h3>?꾩껜 異쒖쿂</h3>
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
    elements.detailFocusToggle.innerHTML = tracked
      ? '<span aria-hidden="true">★</span>'
      : '<span aria-hidden="true">☆</span>';
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
    elements.detailDecisionOrigin.textContent = statusIsHuman
      ? 'Human decision'
      : `Rubric v${getDisplayRubricVersion(record)}`;
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
          <span class="score-chip tone-${tone}" title="${escapeHtml(scoringLabels[criterionId])}: ${escapeHtml(formatScore(score))} / 3">
            <span class="score-chip-label">${escapeHtml(label)}</span><span class="score-chip-value">${escapeHtml(formatScore(score))}</span>
          </span>
        `;
      })
      .join('');
  }
  if (elements.detailReviewSummary) {
    const summary = conciseReviewSummary(record);
    elements.detailReviewSummary.value = summary;
    elements.detailReviewSummary.dataset.previousValue = summary;
    elements.detailReviewSummary.title = summary;
    resizeReviewReasonInput();
  }
  if (elements.detailReviewReasonShell) {
    elements.detailReviewReasonShell.classList.toggle('is-human', reasonIsHuman);
  }
  if (elements.detailReviewReasonOrigin) {
    elements.detailReviewReasonOrigin.textContent = reasonIsHuman ? 'Human edited' : 'Rubric rationale';
    elements.detailReviewReasonOrigin.classList.toggle('is-human', reasonIsHuman);
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
    elements.detailOiPartnershipOrigin.textContent = partnershipNoteIsManual
      ? 'Human decision'
      : `OI Partnership v${focus.partnership_classification_criteria_version || '1.0'}`;
    elements.detailOiPartnershipOrigin.classList.toggle('is-human', partnershipNoteIsManual);
  }
  if (elements.detailOiPartnershipNote) {
    const note = String(focus.partnership_note || '');
    elements.detailOiPartnershipNote.value = note;
    elements.detailOiPartnershipNote.dataset.previousValue = note;
    elements.detailOiPartnershipNote.title = note || 'OI Partnership 분류 근거를 입력';
    resizeOiPartnershipNoteInput();
  }
  if (elements.detailOiPartnershipNoteShell) {
    elements.detailOiPartnershipNoteShell.classList.toggle('is-human', partnershipNoteIsManual);
  }
  if (elements.detailOiPartnershipNoteOrigin) {
    elements.detailOiPartnershipNoteOrigin.textContent = partnershipNoteIsManual
      ? '담당자 수동 분류'
      : `자동 분류 v${focus.partnership_classification_criteria_version || '1.0'}`;
    elements.detailOiPartnershipNoteOrigin.classList.toggle('is-human', partnershipNoteIsManual);
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
  const lastEditedAt = meta.last_edited_at ? formatCommentTime(meta.last_edited_at) : null;
  const lastEditedBy = meta.last_edited_by || null;

  const items = [
    `<span class="meta-info-item">GPT 검색일 <strong>${escapeHtml(generatedAt)}</strong></span>`,
    `<span class="meta-info-item">스코어링 지침 <strong>v${escapeHtml(rubricVersion)}</strong></span>`
  ];
  if (lastEditedAt) {
    items.push(
      `<span class="meta-info-item">마지막 수정 <strong>${escapeHtml(lastEditedAt)}</strong>${
        lastEditedBy ? ` · ${escapeHtml(lastEditedBy)}` : ''
      }</span>`
    );
  }
  elements.detailMetaInfo.innerHTML = items.join('');
  elements.detailMetaInfo.title = [
    `GPT 검색일: ${generatedAt}`,
    `스코어링 지침 버전: v${rubricVersion}`,
    lastEditedAt
      ? `마지막 수정: ${lastEditedAt}에 ${lastEditedBy || 'unknown'}에 의해 수정됨`
      : null
  ]
    .filter(Boolean)
    .join('\n');
}

function renderEditHistory(record) {
  if (!elements.detailEditHistory) return;
  const history = Array.isArray(record?.meta?.edit_history) ? record.meta.edit_history : [];
  if (!history.length) {
    elements.detailEditHistory.innerHTML = '';
    return;
  }
  const items = history
    .slice(-10)
    .reverse()
    .map((entry) => {
      const when = formatCommentTime(entry?.changed_at);
      const who = entry?.actor_name || entry?.actor_ip || 'unknown';
      const sourceLabels = {
        dashboard_table_manual_review: 'Review status/점수',
        dashboard_tab3_focus_management: '집중관리 정보',
        dashboard_comment: '팀 코멘트',
        dashboard_attachment_upload: '파트너 자료 업로드',
        dashboard_attachment_delete: '파트너 자료 삭제',
        dashboard_qualitative_review: '정성 평가',
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
      const source = fieldLabels[entry?.field] || sourceLabels[entry?.source] || entry?.field || '레코드';
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
      <summary>변경 활동 이력 (${history.length})</summary>
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
  if (elements.detailAttachmentCount) {
    elements.detailAttachmentCount.textContent = String(attachments.length);
    elements.detailAttachmentCount.setAttribute('aria-label', `첨부자료 ${attachments.length}개`);
  }
  if (!attachments.length) {
    elements.detailAttachmentsList.innerHTML = `
      <p class="attachments-empty">아직 첨부자료가 없습니다.</p>
    `;
    return;
  }
  elements.detailAttachmentsList.innerHTML = attachments
    .map(
      (attachment) => {
        const extension = String(attachment.filename || '').split('.').pop()?.toUpperCase() || 'FILE';
        const activeClass = String(attachment.id) === activeAttachmentId ? ' is-active' : '';
        return `
        <div class="attachment-row${activeClass}" data-attachment-id="${escapeHtml(attachment.id)}">
          <button
            type="button"
            class="attachment-preview-button"
            data-preview-attachment-id="${escapeHtml(attachment.id)}"
            title="${escapeHtml(attachment.filename || 'attachment')}"
          >
            <span class="attachment-type-badge">${escapeHtml(extension)}</span>
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
  activeAttachmentId = '';
  const sourceReport = record.source_report || {};
  const rawMarkdown = isPlaceholderRawMarkdown(sourceReport.raw_markdown) ? '' : sourceReport.raw_markdown;
  if (elements.detailViewerTitle) elements.detailViewerTitle.textContent = 'GPT 원문 리포트';
  if (elements.subtitle) {
    const summary = record.json_summary || {};
    elements.subtitle.textContent = `${summary.target || '-'} · ${summary.theme || '-'} · ${summary.cluster || '-'}`;
  }
  if (elements.detailMetaInfo) elements.detailMetaInfo.hidden = false;
  if (elements.detailViewerBackButton) elements.detailViewerBackButton.hidden = true;
  elements.sourceReportViewer.classList.remove('showing-attachment');
  elements.sourceReportViewer.innerHTML = rawMarkdown
    ? renderMarkdown(sourceReport.raw_markdown)
    : renderMarkdown(buildReadableSourceReport(record));
  renderAttachments(record);
  renderDetailOutline();
}

async function showAttachmentPreview(attachmentId) {
  if (!attachmentId || !currentRecordId || !currentRecord) return;
  const attachment = (currentRecord?.meta?.attachments || []).find(
    (item) => String(item?.id || '') === String(attachmentId)
  );
  if (!attachment) return;

  activeAttachmentId = String(attachmentId);
  renderAttachments(currentRecord);
  if (elements.detailViewerTitle) elements.detailViewerTitle.textContent = attachment.filename || '파트너사 자료';
  if (elements.subtitle) {
    elements.subtitle.textContent = `${formatFileSize(attachment.size_bytes)} · ${formatCommentTime(attachment.uploaded_at)}`;
  }
  if (elements.detailMetaInfo) elements.detailMetaInfo.hidden = true;
  if (elements.detailViewerBackButton) elements.detailViewerBackButton.hidden = false;
  elements.sourceReportViewer.classList.add('showing-attachment');
  elements.sourceReportViewer.innerHTML = '<div class="attachment-preview-loading">자료를 불러오는 중입니다…</div>';

  try {
    const response = await fetch(
      `/api/attachment-preview/${encodeURIComponent(attachmentId)}?record_id=${encodeURIComponent(currentRecordId)}`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '자료 미리보기를 불러오지 못했습니다.');

    const openAction = `
      <a class="attachment-open-link" href="${escapeHtml(data.url || attachment.stored_path)}" target="_blank" rel="noopener">
        원본 파일 열기 ↗
      </a>
    `;
    if (data.preview_type === 'pdf') {
      elements.sourceReportViewer.innerHTML = `
        <div class="attachment-preview-toolbar">${openAction}</div>
        <iframe
          class="attachment-pdf-preview"
          src="${escapeHtml(data.url || attachment.stored_path)}"
          title="${escapeHtml(attachment.filename || 'PDF preview')}"
        ></iframe>
      `;
    } else if (data.preview_type === 'text') {
      elements.sourceReportViewer.innerHTML = `
        <div class="attachment-preview-toolbar">${openAction}</div>
        <pre class="attachment-text-preview">${escapeHtml(data.text || '추출된 텍스트가 없습니다.')}</pre>
      `;
    } else {
      elements.sourceReportViewer.innerHTML = `
        <div class="attachment-preview-empty">
          <span class="attachment-type-badge large">${escapeHtml(String(attachment.filename || '').split('.').pop()?.toUpperCase() || 'FILE')}</span>
          <strong>브라우저 내 미리보기를 지원하지 않는 파일입니다.</strong>
          <p>PPT 바이너리 및 Excel 파일은 원본 열기로 확인할 수 있습니다. PPTX·PDF·TXT는 이 영역에서 내용을 확인할 수 있습니다.</p>
          ${openAction}
        </div>
      `;
    }
    renderDetailOutline();
  } catch (error) {
    elements.sourceReportViewer.innerHTML = `
      <div class="attachment-preview-empty">
        <strong>미리보기를 표시할 수 없습니다.</strong>
        <p>${escapeHtml(error.message)}</p>
        <a class="attachment-open-link" href="${escapeHtml(attachment.stored_path)}" target="_blank" rel="noopener">원본 파일 열기 ↗</a>
      </div>
    `;
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

function renderQualitativeReview(record) {
  if (!elements.qualitativeReviewPanel) return;
  const criteriaState = record?.meta?.qualitative_review?.criteria || {};
  elements.qualitativeReviewPanel.innerHTML = `
    <div class="qualitative-panel-heading">
      <p class="eyebrow">정성 평가 기준 (임시)</p>
      <span>Manual only</span>
      <small>담당자가 직접 작성하며 자동 입력하지 않습니다.</small>
    </div>
    ${qualitativeReviewCriteria
      .map((criterion) => {
        const criterionState = criteriaState[criterion.id]
          || (criterion.legacyIds || []).map((id) => criteriaState[id]).find(Boolean)
          || {};
        const entries = Array.isArray(criterionState.entries)
          ? criterionState.entries.filter((entry) => !entry?.is_ai)
          : [];
        const entriesHtml = entries.length
          ? entries
              .map(
                (entry) => `
                  <article class="qualitative-entry ${entry.is_ai ? 'is-ai' : ''}">
                    <div class="comment-meta">
                      <strong>${escapeHtml(entry.author || '익명')}</strong>
                      <time>${escapeHtml(formatCommentTime(entry.created_at))}</time>
                    </div>
                    <p>${escapeHtml(entry.body || '').replaceAll('\n', '<br>')}</p>
                  </article>
                `
              )
              .join('')
          : '';
        return `
          <section class="qualitative-criterion" data-criterion-id="${escapeHtml(criterion.id)}">
            <header>
              <h3>${escapeHtml(criterion.label)}</h3>
            </header>
            <div class="qualitative-entries">${entriesHtml}</div>
            <form class="qualitative-form" data-criterion-id="${escapeHtml(criterion.id)}">
              <textarea rows="2" maxlength="5000" placeholder="${escapeHtml(criterion.description)}" required></textarea>
              <button type="submit">의견 등록</button>
            </form>
          </section>
        `;
      })
      .join('')}
  `;
}

async function submitQualitativeOpinion(criterionId, form) {
  const textarea = form.querySelector('textarea');
  const body = textarea?.value.trim() || '';
  if (!body || !currentRecordId) return;
  const author = await ensureIdentity();
  if (!author) return;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
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
    if (submitButton) submitButton.disabled = false;
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
  if (elements.detailCommentSubmit) elements.detailCommentSubmit.disabled = true;
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
    if (elements.detailCommentInput) elements.detailCommentInput.value = '';
    clearReplyTarget();
    renderCollaborationPanel(currentRecord);
    elements.detailCommentThread?.scrollTo({ top: elements.detailCommentThread.scrollHeight, behavior: 'smooth' });
    setCollaborationStatus('댓글을 저장했습니다.', 'success');
  } catch (error) {
    setCollaborationStatus(error.message, 'error');
  } finally {
    if (elements.detailCommentSubmit) elements.detailCommentSubmit.disabled = false;
  }
}

function renderRecord(record) {
  const summary = record.json_summary || {};
  const scoring = record.scoring || {};
  elements.title.textContent = `Details : ${summary.asset_name || 'Pipeline'} · ${summary.company || '-'}`;
  elements.subtitle.textContent = `${summary.target || '-'} · ${summary.theme || '-'} · ${summary.cluster || '-'}`;
  if (elements.chatContextAsset) {
    elements.chatContextAsset.textContent = `${summary.asset_name || 'Pipeline'} · ${summary.company || '-'}`;
  }
  if (elements.chatContextScore) {
    elements.chatContextScore.textContent = `${scoring.total_score ?? '-'} / ${scoring.max_score ?? 21} · ${summary.theme || 'No Theme'}`;
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
  return `## ${summary.company || table.company || 'Company'} Lead Pipeline 遺꾩꽍: **${summary.asset_name || table.asset_name || 'Asset'}**

> This report is prepared for SKBP Pipeline Finder v${rubricVersion} (${rubricAuthor}) criteria.

## 1. ??以?寃곕줎

**${finalInsight.one_line_summary || summary.one_line_summary || '-'}**

???먮떒??Shortlist 愿???먯닔??**${scoring.total_score ?? '-'} / ${scoring.max_score ?? 21}??*?낅땲??

## 2. ?뚯궗 諛?Lead Pipeline ?붿빟

| ??ぉ | ?댁슜 |
|---|---|
| ?뚯궗 | ${summary.company || table.company || '-'} |
| 援?? | ${summary.company_country || table.company_country || '-'} |
| Lead asset | ${summary.asset_name || table.asset_name || '-'} |
| ?곸쓳利?| ${table.indication || '-'} |
| Target | ${summary.target || table.target || '-'} |
| Modality | ${table.modality_platform || '-'} |
| 媛쒕컻 ?④퀎 | ${table.development_stage || '-'} |
| Theme fit | ${summary.theme || table.theme || '-'} |
| Cluster | ${summary.cluster || table.cluster || '-'} |

## 3. ?듭떖 怨쇳븰???ъ씤??

${table.moa || '-'}

## 4. SKBP Theme / Cluster ?곹빀??

Theme: **${summary.theme || table.theme || '-'}**  
Cluster: **${summary.cluster || table.cluster || '-'}**

## 5. SKBP Pipeline Finder???먯닔

| Criteria | Score | ?먮떒 |
|---|---:|---|
${Object.entries(scoring.criteria || {})
  .map(([key, item]) => `| ${prettifyKey(key)} | ${item?.score ?? '-'} / 3 | ${item?.main_line_summary || '-'} |`)
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
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '<span class="wikilink">$2</span>')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">$1</span>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
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

function renderDetailOutline() {
  if (!elements.detailOutlineList || !elements.sourceReportViewer) return;
  const headings = [...elements.sourceReportViewer.querySelectorAll('h1, h2, h3')].slice(0, 14);
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

function summarizeDraftChanges(changes = []) {
  if (!changes.length) return '蹂寃???ぉ ?놁쓬';
  return changes.map((change) => `??${change}`).join('\n');
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
  return summary.asset_name || table.asset_name || currentRecordId || '??asset';
}

function defaultDetailChatText() {
  return `${currentAssetLabel()} record瑜?遺덈윭?붿뒿?덈떎. ?먯닔 洹쇨굅, 由ъ뒪?? ?쒖옣?? 寃쎌웳 ?곹솴?????吏덈Ц?????덉뒿?덈떎.`;
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
        status: 'done',
        canApply: false
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
  const speaker = role === 'user' ? 'You' : 'Asset Agent';
  const meta = role === 'user' ? 'question' : (options.pending ? 'streaming response' : 'JSON + Wiki retrieval');
  bubble.innerHTML = `
    <div class="agent-message-meta">
      <strong>${speaker}</strong>
      <span>${meta}</span>
    </div>
    <div class="agent-message-text">${renderMarkdown(text)}</div>
    ${renderChatSources(options.sources)}
  `;

  if (options.draftRecord) {
    pendingDraftRecord = options.draftRecord;
    const draftCard = document.createElement('div');
    draftCard.className = 'draft-card';
    draftCard.innerHTML = `
      <strong>洹쇨굅 ?섏젙 珥덉븞</strong>
      <pre>${escapeHtml(summarizeDraftChanges(options.draftChanges))}</pre>
      <div class="draft-actions">
        <button type="button" data-action="apply-draft">珥덉븞 ?곸슜</button>
        <button type="button" data-action="review-draft">초안 검토</button>
      </div>
    `;
    bubble.appendChild(draftCard);
  }

  if (options.canApply && role === 'assistant' && !bubble.querySelector('[data-action="apply-ai-reply"]')) {
    bubble.insertAdjacentHTML('beforeend', renderMessageActions());
  }

  elements.messages.appendChild(bubble);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  if (options.persist !== false) {
    updateChatSessionMessage({
      id: messageId,
      role,
      text,
      sources: options.sources || [],
      createdAt: new Date().toISOString(),
      status: options.pending ? 'pending' : 'done',
      canApply: Boolean(options.canApply)
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

function renderMessageActions() {
  return `
    <div class="agent-message-actions">
      <button type="button" data-action="apply-ai-reply">JSON/?먮Ц??諛섏쁺</button>
    </div>
  `;
}

function updateMessage(bubble, text, options = {}) {
  const textNode = bubble.querySelector('.agent-message-text');
  if (textNode) textNode.innerHTML = renderMarkdown(text);
  if (options.done) bubble.classList.remove('pending');
  if (options.sources) {
    bubble.querySelector('.agent-sources')?.remove();
    bubble.insertAdjacentHTML('beforeend', renderChatSources(options.sources));
  }
  if (options.done && bubble.classList.contains('assistant') && !bubble.querySelector('[data-action="apply-ai-reply"]')) {
    bubble.insertAdjacentHTML('beforeend', renderMessageActions());
  }
  if (bubble.dataset.messageId) {
    updateChatSessionMessage({
      id: bubble.dataset.messageId,
      role: bubble.classList.contains('user') ? 'user' : 'assistant',
      text,
      sources: options.sources || undefined,
      status: options.done ? 'done' : (bubble.classList.contains('pending') ? 'pending' : 'done'),
      canApply: bubble.classList.contains('assistant') && (options.done || Boolean(bubble.querySelector('[data-action="apply-ai-reply"]')))
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
      canApply: Boolean(message.canApply),
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

async function createAiReplyJsonDraft(button) {
  if (!currentRecord) return;
  const bubble = button.closest('.agent-message');
  const replyText = bubble?.querySelector('.agent-message-text')?.innerText?.trim();
  if (!replyText) return;

  const confirmed = window.confirm('??Agent ?듬????꾩옱 record JSON怨??먮Ц 由ы룷?몄뿉 諛섏쁺?좉퉴?? ???????쒕낫???먯닔??媛깆떊?⑸땲??');
  if (!confirmed) return;

  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = '반영 중';

  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}/apply-ai-revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer_markdown: replyText,
        instruction: isFastTriageRecord(currentRecord)
          ? 'Detail AI Agent GPT 吏移?1 Fast Triage v3.1 update applied from chat answer.'
          : 'Detail AI Agent v3.1 re-evaluation applied from chat answer.'
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'AI ?듬? 諛섏쁺 ?ㅽ뙣');

    if (bubble.dataset.messageId) {
      updateChatSessionMessage({ id: bubble.dataset.messageId, canApply: false });
    }
    currentRecord = data.record;
    currentRecordId = data.record_id;
    window.history.replaceState(null, '', detailUrlForCurrentRecord());
    await loadRecord();
    addMessage('assistant', `JSON怨??먮Ц 由ы룷?몄뿉 諛섏쁺?덉뒿?덈떎.\n\n${summarizeDraftChanges(data.changes || [])}`);
  } catch (error) {
    addMessage('assistant', `諛섏쁺 ?ㅽ뙣: ${error.message}`);
    button.disabled = false;
    button.textContent = previousText;
  }
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
  await fetch('/api/obsidian/export', { method: 'POST' }).catch(() => null);
  await loadRecord();
  return data;
}

async function deleteCurrentRecord() {
  if (!currentRecordId || !currentRecord) return;
  const summary = currentRecord.json_summary || {};
  const table = currentRecord.structured_table || {};
  const asset = summary.asset_name || table.asset_name || currentRecordId;
  const company = summary.company || table.company || '-';
  const confirmed = window.confirm(`${asset} 쨌 ${company} record瑜???젣?좉퉴??\n\njson/pipeline-records.json?먯꽌 ?쒓굅?섍퀬 Obsidian MD???ъ깮?깅맗?덈떎.`);
  if (!confirmed) return;

  elements.status.textContent = 'Deleting';
  elements.deleteRecordButton.disabled = true;
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(currentRecordId)}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '??젣 ?ㅽ뙣');
    elements.status.textContent = 'Deleted';
    window.location.href = '/';
  } catch (error) {
    elements.status.textContent = 'Delete failed';
    elements.deleteRecordButton.disabled = false;
    addMessage('assistant', `??젣 ?ㅽ뙣: ${error.message}`);
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
  elements.status.textContent = 'Loaded';
  initializeChatSessions();
}

function openAiDrawer() {
  elements.aiDrawer.hidden = false;
  elements.aiBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.aiDrawer.classList.add('open');
    elements.aiBackdrop.classList.add('open');
    elements.aiDrawer.setAttribute('aria-hidden', 'false');
    elements.input.focus();
  });
}

function closeAiDrawer() {
  elements.aiDrawer.classList.remove('open');
  elements.aiBackdrop.classList.remove('open');
  elements.aiDrawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    elements.aiDrawer.hidden = true;
    elements.aiBackdrop.hidden = true;
  }, 180);
}

function setupResizableDrawer(drawer, storageKey, defaultWidth = 560) {
  const handle = drawer?.querySelector('[data-resize-drawer]');
  if (!drawer || !handle) return;

  const minWidth = 380;
  const getMaxWidth = () => Math.max(minWidth, Math.min(window.innerWidth - 32, 1080));
  const clampWidth = (value) => Math.max(minWidth, Math.min(value, getMaxWidth()));
  const applyWidth = (value) => {
    const width = clampWidth(value);
    drawer.style.setProperty('--drawer-width', `${width}px`);
    localStorage.setItem(storageKey, String(width));
  };

  const savedWidth = Number(localStorage.getItem(storageKey));
  applyWidth(Number.isFinite(savedWidth) ? savedWidth : defaultWidth);

  const startResize = (event) => {
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    drawer.classList.add('is-resizing');

    const onMove = (moveEvent) => {
      applyWidth(window.innerWidth - moveEvent.clientX);
    };
    const onUp = () => {
      drawer.classList.remove('is-resizing');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  handle.addEventListener('pointerdown', startResize);
  handle.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Number.parseInt(getComputedStyle(drawer).getPropertyValue('--drawer-width'), 10) || defaultWidth;
    if (event.key === 'ArrowLeft') applyWidth(current + 32);
    if (event.key === 'ArrowRight') applyWidth(current - 32);
    if (event.key === 'Home') applyWidth(minWidth);
    if (event.key === 'End') applyWidth(getMaxWidth());
  });

  window.addEventListener('resize', () => {
    const current = Number.parseInt(getComputedStyle(drawer).getPropertyValue('--drawer-width'), 10) || defaultWidth;
    applyWidth(current);
  });
}

const CRITERIA_DRAWER_SCOPE_LABELS = {
  full: 'TAB2 · Full Scout (PASS/REVIEW/FAIL)',
  focus: 'TAB3 · 집중 관리 (OI Partnership Type)'
};

function updateCriteriaDrawerScope() {
  const isFocusTracked = currentRecord?.meta?.focus_management?.is_tracked === true;
  const mode = isFocusTracked ? 'focus' : 'full';
  if (elements.criteriaDrawerScopeLabel) {
    elements.criteriaDrawerScopeLabel.textContent = CRITERIA_DRAWER_SCOPE_LABELS[mode] || '';
  }
  document.querySelectorAll('[data-criteria-tab]').forEach((section) => {
    section.hidden = section.dataset.criteriaTab !== mode;
  });
}

function openCriteriaDrawer() {
  updateCriteriaDrawerScope();
  elements.criteriaDrawer.hidden = false;
  elements.criteriaBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.criteriaDrawer.classList.add('open');
    elements.criteriaBackdrop.classList.add('open');
    elements.criteriaDrawer.setAttribute('aria-hidden', 'false');
  });
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

function openEditDrawer() {
  if (!currentRecord) return;
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
    elements.editStatus.textContent = '?щ㎎ ?꾨즺';
  } catch (error) {
    elements.editStatus.textContent = `JSON ?ㅻ쪟: ${error.message}`;
  }
}

async function saveEditedJson() {
  let payload;
  try {
    payload = JSON.parse(elements.jsonEditor.value);
  } catch (error) {
    elements.editStatus.textContent = `JSON ?ㅻ쪟: ${error.message}`;
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
    addMessage('assistant', '?섏젙 珥덉븞??JSON ?먮낯????ν뻽?듬땲?? ?쇱そ JSON 蹂닿린? 硫붿씤 ??쒕낫???먯닔????媛?湲곗??쇰줈 媛깆떊?⑸땲??');
  } catch (error) {
    addMessage('assistant', `珥덉븞 ????ㅻ쪟: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = '珥덉븞 ?곸슜';
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
      updateMessage(bubble, text || '愿??wiki note瑜?李얠븯?듬땲?? ?듬????앹꽦 以묒엯?덈떎...', { sources });
    }
    if (parsed.event === 'status' && !text) {
      updateMessage(bubble, parsed.data?.message || '?듬? ?앹꽦 以묒엯?덈떎...', { sources });
    }
    if (parsed.event === 'delta') {
      text += parsed.data?.text || '';
      updateMessage(bubble, text, { sources });
    }
    if (parsed.event === 'done') {
      completed = true;
      updateMessage(bubble, text || '?듬???鍮꾩뼱 ?덉뒿?덈떎. ?ㅼ떆 吏덈Ц??二쇱꽭??', { done: true, sources });
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
  if (!completed) updateMessage(bubble, text || '?듬???鍮꾩뼱 ?덉뒿?덈떎. ?ㅼ떆 吏덈Ц??二쇱꽭??', { done: true, sources });
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = elements.input.value.trim();
  if (!message || !currentRecord) return;

  elements.input.value = '';
  retitleActiveChatSessionFromQuestion(message);
  addMessage('user', message);
  const submitButton = elements.form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '응답 중';
  }
  const responseBubble = addMessage('assistant', '吏덈Ц 遺꾩꽍 以?..', { pending: true });

  try {
    await streamDetailChatReply(message, responseBubble);
  } catch (error) {
    updateMessage(responseBubble, `梨꾪똿 ?묐떟 ?ㅻ쪟: ${error.message}`, { done: true });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '吏덈Ц';
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

  if (button.dataset.action === 'apply-ai-reply') {
    createAiReplyJsonDraft(button);
  }

  if (button.dataset.action === 'apply-draft') {
    applyPendingDraft(button);
  }

  if (button.dataset.action === 'review-draft') {
    reviewPendingDraft();
  }
});

elements.detailOutlineList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-outline-target]');
  if (!button) return;
  document.getElementById(button.dataset.outlineTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

elements.detailFocusToggle?.addEventListener('click', () => {
  saveDetailFocus(elements.detailFocusToggle.dataset.focusAction || 'add');
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
  if (!form) return;
  event.preventDefault();
  submitQualitativeOpinion(form.dataset.criterionId, form);
});

elements.detailAiButton.addEventListener('click', openAiDrawer);
elements.criteriaDrawerButton.addEventListener('click', openCriteriaDrawer);
elements.criteriaDrawerClose.addEventListener('click', closeCriteriaDrawer);
elements.criteriaBackdrop.addEventListener('click', closeCriteriaDrawer);
elements.deleteRecordButton.addEventListener('click', deleteCurrentRecord);
elements.aiDrawerClose.addEventListener('click', closeAiDrawer);
elements.aiBackdrop.addEventListener('click', closeAiDrawer);
elements.editButton?.addEventListener('click', openEditDrawer);
elements.editDrawerClose?.addEventListener('click', closeEditDrawer);
elements.editBackdrop?.addEventListener('click', closeEditDrawer);
elements.formatJsonButton?.addEventListener('click', formatEditorJson);
elements.saveJsonEditButton?.addEventListener('click', saveEditedJson);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.aiDrawer.classList.contains('open')) {
    closeAiDrawer();
  }
  if (event.key === 'Escape' && elements.criteriaDrawer.classList.contains('open')) {
    closeCriteriaDrawer();
  }
  if (event.key === 'Escape' && elements.editDrawer.classList.contains('open')) {
    closeEditDrawer();
  }
});

setupResizableDrawer(elements.aiDrawer, 'skbp.detail.aiDrawerWidth', 600);
setupThemeToggle();
renderCommentIdentity();

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
  const entered = await openIdentityModal();
  if (entered) setStoredIdentity(entered);
});

loadRecord().catch((error) => {
  elements.status.textContent = 'Load failed';
  elements.sourceReportViewer.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  if (elements.detailCommentThread) {
    elements.detailCommentThread.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
  setCollaborationStatus('상세 데이터를 불러오지 못했습니다.', 'error');
});
