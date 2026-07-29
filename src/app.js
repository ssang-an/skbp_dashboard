import { setupThemeToggle } from './theme.js';

const API_URL = '/api/records';
const CATEGORY_SYNONYMS_URL = '/api/category-synonyms';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_STORAGE_KEY = 'skbp.dashboard.pageSize.v1';
const AGENT_SESSION_STORAGE_KEY = 'skbp.dashboard.agentSessions.v1';
const AGENT_ACTIVE_SESSION_KEY = 'skbp.dashboard.activeAgentSession.v1';
const DASHBOARD_REVIEWER_ID_KEY = 'skbp.detail.commentAuthor';
const COLUMN_WIDTH_STORAGE_KEY = 'skbp.dashboard.columnWidths.v2';
const FOCUS_COLUMN_WIDTH_STORAGE_KEY = 'skbp.dashboard.focusColumnWidths.v2';

const DEFAULT_COLUMN_WIDTHS = {
  select: 36,
  company: 128,
  country: 112,
  asset: 92,
  modality: 140,
  target: 320,
  mainIndication: 180,
  stage: 190,
  filter1: 82,
  filter2: 82,
  filter3: 82,
  filter3Note: 280,
  targetScore: 52,
  competitiveScore: 58,
  moaScore: 52,
  platformScore: 52,
  expansionScore: 52,
  dataScore: 56,
  marketScore: 64,
  totalScore: 58,
  focusAction: 112,
  inVivo: 74,
  inVitro: 74,
  admet: 84,
  focusDueDate: 140,
  focusManage: 90,
  extra: 180
};

const MIN_COLUMN_WIDTHS = {
  select: 34,
  company: 86,
  country: 82,
  asset: 72,
  modality: 100,
  target: 260,
  mainIndication: 130,
  stage: 120,
  filter1: 70,
  filter2: 70,
  filter3: 70,
  filter3Note: 210,
  targetScore: 46,
  competitiveScore: 50,
  moaScore: 46,
  platformScore: 46,
  expansionScore: 46,
  dataScore: 50,
  marketScore: 56,
  totalScore: 52,
  focusAction: 100,
  inVivo: 64,
  inVitro: 64,
  admet: 70,
  focusDueDate: 120,
  focusManage: 70,
  extra: 110
};

const FOCUS_DEFAULT_COLUMN_WIDTHS = {
  ...DEFAULT_COLUMN_WIDTHS,
  target: 430,
  mainIndication: 165,
  stage: 125,
  filter2: 76,
  totalScore: 92,
  filter3: 104,
  filter3Note: 300,
  focusManage: 72
};

const FOCUS_MIN_COLUMN_WIDTHS = {
  ...MIN_COLUMN_WIDTHS,
  target: 320,
  stage: 96,
  filter2: 68,
  totalScore: 82,
  filter3Note: 220,
  focusManage: 62
};

const MAX_COLUMN_WIDTH = 720;
const PROMPT_TOOLTIP =
  'GPT 조사 지침을 클립보드에 복사합니다. 복사한 지침을 ChatGPT에 붙여넣은 뒤, 조사할 회사명과 약물명/파이프라인명을 함께 입력하면 MD 리포트와 JSON Schema 형식으로 결과를 받을 수 있습니다.';
const TRIAGE_PROMPT_TOOLTIP =
  'GPT fast triage 지침을 복사합니다. 여러 asset을 빠르게 SELECT / REJECT / N/A로 screening할 때 사용합니다.';
const LATEST_FULL_SCOUT_RUBRIC_VERSION = '3.2';
const requestedTableMode = new URLSearchParams(window.location.search).get('tab');
const initialTableMode = ['triage', 'full', 'focus'].includes(requestedTableMode)
  ? requestedTableMode
  : 'full';

const state = {
  rawRecords: [],
  rows: [],
  query: '',
  stage: 'all',
  theme: 'all',
  cluster: 'all',
  modality: 'all',
  indication: 'all',
  country: 'all',
  pass: 'all',
  tableMode: initialTableMode,
  sortKey: 'totalScore',
  sortDirection: 'desc',
  page: 1,
  pageSize: Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)) || DEFAULT_PAGE_SIZE,
  selectedIds: new Set(),
  extraColumns: new Set(JSON.parse(localStorage.getItem('skbp.dashboard.extraColumns') || '[]')),
  columnWidths: JSON.parse(localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY) || '{}'),
  focusColumnWidths: JSON.parse(localStorage.getItem(FOCUS_COLUMN_WIDTH_STORAGE_KEY) || '{}'),
  agentSessions: [],
  activeAgentSessionId: localStorage.getItem(AGENT_ACTIVE_SESSION_KEY) || '',
  categorySynonyms: { country: [], stage: [], indication: [] },
  categorySynonymsLoaded: false
};

const elements = {
  dataStatus: document.querySelector('#dataStatus'),
  refreshButton: document.querySelector('#refreshButton'),
  exportExcelButton: document.querySelector('#exportExcelButton'),
  aiDrawerButton: document.querySelector('#aiDrawerButton'),
  aiDrawer: document.querySelector('#aiDrawer'),
  aiBackdrop: document.querySelector('#aiBackdrop'),
  aiDrawerClose: document.querySelector('#aiDrawerClose'),
  criteriaDrawerButton: document.querySelector('#criteriaDrawerButton'),
  criteriaDrawer: document.querySelector('#criteriaDrawer'),
  criteriaBackdrop: document.querySelector('#criteriaBackdrop'),
  criteriaDrawerClose: document.querySelector('#criteriaDrawerClose'),
  criteriaDrawerScopeLabel: document.querySelector('#criteriaDrawerScopeLabel'),
  agentContextCount: document.querySelector('#agentContextCount'),
  agentMessages: document.querySelector('#agentMessages'),
  agentForm: document.querySelector('#agentForm'),
  agentInput: document.querySelector('#agentInput'),
  agentSessionSelect: document.querySelector('#agentSessionSelect'),
  agentNewSessionButton: document.querySelector('#agentNewSessionButton'),
  agentDeleteSessionButton: document.querySelector('#agentDeleteSessionButton'),
  metricTotal: document.querySelector('#metricTotal'),
  metricPass: document.querySelector('#metricPass'),
  metricScore: document.querySelector('#metricScore'),
  metricTarget: document.querySelector('#metricTarget'),
  metricCountries: document.querySelector('#metricCountries'),
  themeChart: document.querySelector('#themeChart'),
  indicationChart: document.querySelector('#indicationChart'),
  modalityChart: document.querySelector('#modalityChart'),
  countryChart: document.querySelector('#countryChart'),
  priorityList: document.querySelector('#priorityList'),
  dueDateList: document.querySelector('#dueDateList'),
  searchInput: document.querySelector('#searchInput'),
  stageFilter: document.querySelector('#stageFilter'),
  themeFilter: document.querySelector('#themeFilter'),
  clusterFilter: document.querySelector('#clusterFilter'),
  modalityFilter: document.querySelector('#modalityFilter'),
  countryFilter: document.querySelector('#countryFilter'),
  indicationFilter: document.querySelector('#indicationFilter'),
  passFilter: document.querySelector('#passFilter'),
  tableCount: document.querySelector('#tableCount'),
  pageSizeSelect: document.querySelector('#pageSizeSelect'),
  columnSettingsButton: document.querySelector('#columnSettingsButton'),
  columnSettingsPanel: document.querySelector('#columnSettingsPanel'),
  columnSettingsGrid: document.querySelector('#columnSettingsGrid'),
  pipelineTableTabs: document.querySelectorAll('[data-table-mode]'),
  focusTabCount: document.querySelector('#focusTabCount'),
  pipelineTableHead: document.querySelector('#pipelineTableHead'),
  pipelineHeaderRow: document.querySelector('#pipelineHeaderRow'),
  selectPageRows: document.querySelector('#selectPageRows'),
  deleteSelectedButton: document.querySelector('#deleteSelectedButton'),
  pipelineTable: document.querySelector('#pipelineTable'),
  pipelineColGroup: document.querySelector('#pipelineColGroup'),
  pageInfo: document.querySelector('#pageInfo'),
  prevPage: document.querySelector('#prevPage'),
  nextPage: document.querySelector('#nextPage'),
  rawReportInput: document.querySelector('#rawReportInput'),
  structuredJsonInput: document.querySelector('#structuredJsonInput'),
  previewInputButton: document.querySelector('#previewInputButton'),
  saveJsonButton: document.querySelector('#saveJsonButton'),
  clearJsonButton: document.querySelector('#clearJsonButton'),
  saveStatus: document.querySelector('#saveStatus'),
  copyTriagePromptTopButton: document.querySelector('#copyTriagePromptTopButton'),
  copyPromptTopButton: document.querySelector('#copyPromptTopButton'),
  copyPromptButton: document.querySelector('#copyPromptButton'),
  promptCopyStatus: document.querySelector('#promptCopyStatus'),
  reviewerIdentityModal: document.querySelector('#reviewerIdentityModal'),
  reviewerIdentityInput: document.querySelector('#reviewerIdentityInput'),
  reviewerIdentityCancel: document.querySelector('#reviewerIdentityCancel'),
  reviewerIdentitySubmit: document.querySelector('#reviewerIdentitySubmit')
};

let activeColumnResize = null;
let promptCopyFeedbackTimer = null;
let targetContextTooltip = null;
let targetContextAnchor = null;
const focusSaveQueues = new Map();
let reviewerIdentityResolve = null;

function getDashboardReviewerIdentity() {
  return (sessionStorage.getItem(DASHBOARD_REVIEWER_ID_KEY) || '').trim();
}

function openReviewerIdentityModal() {
  if (!elements.reviewerIdentityModal) return Promise.resolve(null);
  return new Promise((resolve) => {
    reviewerIdentityResolve = resolve;
    elements.reviewerIdentityInput.value = getDashboardReviewerIdentity();
    elements.reviewerIdentityModal.hidden = false;
    elements.reviewerIdentityInput.focus();
  });
}

function closeReviewerIdentityModal(value = null) {
  if (elements.reviewerIdentityModal) elements.reviewerIdentityModal.hidden = true;
  const resolve = reviewerIdentityResolve;
  reviewerIdentityResolve = null;
  if (resolve) resolve(value);
}

async function ensureDashboardReviewerIdentity() {
  const existing = getDashboardReviewerIdentity();
  if (existing) return existing;
  const entered = await openReviewerIdentityModal();
  if (!entered) return null;
  const identity = String(entered).trim();
  if (!identity) return null;
  sessionStorage.setItem(DASHBOARD_REVIEWER_ID_KEY, identity);
  return identity;
}

function get(record, path, fallback = '') {
  return path.split('.').reduce((value, key) => value?.[key], record) ?? fallback;
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
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

function mainIndicationFrom(value) {
  const text = String(value || '').trim();
  if (!text || text === '-' || /^n\/?a$/i.test(text)) return 'Unknown';
  return text
    .split(/\s*(?:;|\||,|\band\b)\s*/i)
    .map((item) => item.trim())
    .filter(Boolean)[0] || text;
}

function normalizeCategoryText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesDictionaryTerm(normalizedText, term) {
  const normalizedTerm = normalizeCategoryText(term);
  if (!normalizedText || !normalizedTerm) return false;
  if (normalizedText === normalizedTerm) return true;

  const compactTerm = normalizedTerm.replace(/[^a-z0-9]/g, '');
  const isShortToken = compactTerm.length <= 3 && /^[a-z0-9]+$/.test(compactTerm);
  if (isShortToken) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(compactTerm)}([^a-z0-9]|$)`, 'i')
      .test(normalizedText.replace(/[^a-z0-9]+/g, ' '));
  }

  return normalizedText.includes(normalizedTerm);
}

function orderedDictionaryEntries(kind) {
  const entries = Array.isArray(state.categorySynonyms?.[kind]) ? state.categorySynonyms[kind] : [];
  if (kind !== 'stage') return entries;

  const stagePriority = {
    'Discontinued / inactive': 120,
    'Approved / marketed': 110,
    Registration: 100,
    'Phase 3': 90,
    'Phase 2/3': 85,
    'Phase 2': 80,
    'Phase 1/2': 75,
    'Phase 1': 70,
    'IND-enabling': 65,
    IND: 60,
    'Lead Selection': 40,
    'Lead Optimization': 30,
    'Hit discovery': 20
  };

  return [...entries].sort((a, b) => {
    return (stagePriority[b?.canonical] || 0) - (stagePriority[a?.canonical] || 0);
  });
}

function canonicalFromDictionary(kind, value) {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  if (!normalized || normalized === '-') return null;

  for (const entry of orderedDictionaryEntries(kind)) {
    if (!entry?.canonical) continue;
    if (matchesDictionaryTerm(normalized, entry.canonical)) return entry.canonical;

    const synonyms = Array.isArray(entry.synonyms) ? entry.synonyms : [];
    if (synonyms.some((term) => matchesDictionaryTerm(normalized, term))) {
      return entry.canonical;
    }

    const patterns = Array.isArray(entry.patterns) ? entry.patterns : [];
    for (const pattern of patterns) {
      try {
        if (new RegExp(pattern, 'i').test(normalized)) return entry.canonical;
      } catch (error) {
        console.warn(`Invalid ${kind} synonym pattern skipped: ${pattern}`, error);
      }
    }
  }

  return null;
}

async function loadCategorySynonyms() {
  if (state.categorySynonymsLoaded) return;
  try {
    const response = await fetch(CATEGORY_SYNONYMS_URL);
    if (!response.ok) throw new Error(await response.text());
    const dictionary = await response.json();
    state.categorySynonyms = {
      country: Array.isArray(dictionary.country) ? dictionary.country : [],
      stage: Array.isArray(dictionary.stage) ? dictionary.stage : [],
      indication: Array.isArray(dictionary.indication) ? dictionary.indication : []
    };
  } catch (error) {
    console.warn('Category synonym dictionary unavailable; using built-in fallback rules.', error);
  } finally {
    state.categorySynonymsLoaded = true;
  }
}

function canonicalDashboardIndication(value) {
  const text = String(value || '').trim();
  const fromDictionary = canonicalFromDictionary('indication', text);
  if (fromDictionary) return fromDictionary;

  const normalized = normalizeCategoryText(text);
  if (!text || text === '-' || /^n\/?a$/i.test(text)) return 'Unknown';
  if (/alzheimer|ad\b/.test(normalized)) return "Alzheimer's disease";
  if (/epilep|seizure|focal onset|partial onset|status epilepticus/.test(normalized)) return 'Epilepsy / seizure disorders';
  if (/chronic cough|rcc|ucc|refractory cough|unexplained cough/.test(normalized)) return 'Chronic cough';
  if (/multiple sclerosis|\bms\b|neuroinflamm|autoimmune/.test(normalized)) return 'Multiple sclerosis / neuroinflammatory disease';
  if (/inflammatory bowel|\bibd\b|crohn|ulcerative colitis/.test(normalized)) return 'Inflammatory bowel disease';
  if (/major depressive|depression|\bmdd\b/.test(normalized)) return 'Major depressive disorder';
  if (/pain/.test(normalized)) return 'Pain';
  if (/acute ischemic stroke|stroke/.test(normalized)) return 'Stroke';
  return mainIndicationFrom(text).replace(/[\u2018\u2019\u201A\u201B]/g, "'");
}

function canonicalCountry(value) {
  const text = String(value || '').trim();
  const fromDictionary = canonicalFromDictionary('country', text);
  if (fromDictionary) return fromDictionary;

  const lowered = normalizeCategoryText(text);
  if (!text || text === '-' || /^n\/?a$/i.test(text)) return 'Unknown';
  if (/china|hong kong|prc|mainland/.test(lowered)) return 'China';
  if (/korea|republic of korea|south korea/.test(lowered)) return 'Republic of Korea';
  if (/united states|usa|u\.s\.|us\b/.test(lowered)) return 'United States';
  return text;
}

function canonicalDevelopmentStage(value) {
  const text = String(value || '').trim();
  const fromDictionary = canonicalFromDictionary('stage', text);
  if (fromDictionary) return fromDictionary;

  const normalized = normalizeCategoryText(text);
  if (!text || text === '-' || /^n\/?a$/i.test(text)) return 'Unknown';
  if (/discontinued|terminated|withdrawn|suspended|inactive|dormant/.test(normalized)) return 'Discontinued / inactive';
  if (/approved|launched|marketed|commercial/.test(normalized)) return 'Approved / marketed';
  if (/nda|bla|maa|registration|filed|under review/.test(normalized)) return 'Registration';
  if (/(phase|ph|p)\s*-?\s*(2|ii)\s*\/\s*(3|iii)|\b2\s*\/\s*3\s*상/.test(normalized)) return 'Phase 2/3';
  if (/(phase|ph|p)\s*-?\s*(1|i)\s*\/\s*(2|ii)|\b1\s*\/\s*2\s*상/.test(normalized)) return 'Phase 1/2';
  if (/(phase|ph|p)\s*-?\s*(3|iii)\b|\b3상/.test(normalized)) return 'Phase 3';
  if (/(phase|ph|p)\s*-?\s*(2|ii)\b|\b2상/.test(normalized)) return 'Phase 2';
  if (/(phase|ph|p)\s*-?\s*(1|i)\b|\b1상|\bfih\b|first[- ]?in[- ]?human/.test(normalized)) return 'Phase 1';
  if (/ind[- ]?enabling|ind preparation|ind-ready|glp tox|candidate selection|candidate selected/.test(normalized)) return 'IND-enabling';
  if (/preclinical|pre-clinical|nonclinical|in vivo|in vitro/.test(normalized)) return 'Preclinical';
  if (/discovery|lead optimization|lead-op|hit-to-lead|research/.test(normalized)) return 'Discovery';
  return text;
}

function canonicalModality(value) {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  if (!text || text === '-' || /^(unknown|not known|n\/a)$/i.test(text)) return 'Unknown';
  if (/small molecule|\bsm\b|oral compound|chemical compound/.test(normalized)) return 'Small molecule';
  if (/peptide/.test(normalized)) return 'Peptide';
  if (/rna|oligonucleotide|antisense|\baso\b|sirna|mirna|mrna/.test(normalized)) return 'RNA therapy';
  if (/car[- ]?t|tcr[- ]?t|cell therapy|cellular therapy|stem cell/.test(normalized)) return 'Cell therapy';
  if (/gene therapy|aav|lentiviral|gene editing|crispr/.test(normalized)) return 'Gene therapy';
  if (/antibody|antibody drug conjugate|\badc\b|bispecific/.test(normalized)) return 'Antibody';
  if (/protein biologic|recombinant protein|fusion protein|enzyme replacement/.test(normalized)) return 'Protein biologic';
  return 'Other';
}

function canonicalTheme(value) {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  if (!text || text === '-' || /^(unknown|not known)$/i.test(text)) return 'Unknown';
  if (/^n\/?a$|no theme|no mapped|no fit|out of scope|none/.test(normalized)) return 'N/A';
  return text;
}

function canonicalCluster(value) {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  if (!text || text === '-' || /^(unknown|not known)$/i.test(text)) return 'Unknown';
  if (/^n\/?a$|no cluster|no mapped|no fit|out of scope|none/.test(normalized)) return 'N/A';
  return text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureTargetContextTooltip() {
  if (targetContextTooltip) return targetContextTooltip;
  targetContextTooltip = document.createElement('div');
  targetContextTooltip.id = 'targetContextTooltip';
  targetContextTooltip.className = 'target-context-tooltip';
  targetContextTooltip.setAttribute('role', 'tooltip');
  targetContextTooltip.hidden = true;
  document.body.appendChild(targetContextTooltip);
  return targetContextTooltip;
}

function positionTargetContextTooltip(anchor, tooltip) {
  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportPadding = 12;
  let left = Math.max(
    viewportPadding,
    Math.min(anchorRect.left, window.innerWidth - tooltipRect.width - viewportPadding)
  );
  let top = anchorRect.bottom + 8;
  if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
    top = anchorRect.top - tooltipRect.height - 8;
  }
  if (top < viewportPadding) top = viewportPadding;
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function showTargetContextTooltip(anchor) {
  if (!anchor) return;
  const tooltip = ensureTargetContextTooltip();
  const theme = anchor.dataset.theme || 'Unknown';
  const cluster = anchor.dataset.cluster || 'Unknown';
  const description = anchor.dataset.description || '-';
  targetContextAnchor = anchor;
  tooltip.innerHTML = `
    <div><span>Theme</span><strong title="${escapeHtml(theme)}">${escapeHtml(theme)}</strong></div>
    <div><span>Cluster</span><strong title="${escapeHtml(cluster)}">${escapeHtml(cluster)}</strong></div>
    <div><span>Description</span><strong title="${escapeHtml(description)}">${escapeHtml(description)}</strong></div>
  `;
  tooltip.hidden = false;
  anchor.setAttribute('aria-describedby', tooltip.id);
  requestAnimationFrame(() => positionTargetContextTooltip(anchor, tooltip));
}

function hideTargetContextTooltip(anchor = null) {
  if (!targetContextTooltip) return;
  if (anchor && targetContextAnchor && anchor !== targetContextAnchor) return;
  targetContextAnchor?.removeAttribute('aria-describedby');
  targetContextAnchor = null;
  targetContextTooltip.hidden = true;
}

function isPlaceholderRawMarkdown(value) {
  const text = String(value || '').trim();
  return !text
    || text === 'Paste the full Markdown report text here if available.'
    || text === 'Markdown report is provided separately in the MD copy box.';
}

function criterion(record, key) {
  const item = get(record, `scoring.criteria.${key}`, {});
  const rubric = get(record, `rubric.${key}`, {});
  const definition = get(record, `criteria_registry.criteria.${key}`, {});
  const appliedRule = item.criteria_reference?.applied_rule_id || item.ai_champion?.rule_applied || (item.score != null ? `${key}:${item.score}` : '-');
  const rationale = item.score_rationale || {};
  const evidenceSources = Array.isArray(item.evidence_sources) ? item.evidence_sources : [];
  const matchingRule = (definition.scoring_rules || []).find((rule) => {
    return rule.rule_id === appliedRule || rule.score === item.score;
  });
  const scoreDefinition = item.score != null ? rubric.score_definitions?.[String(item.score)] : '';
  const mainLineSummary = item.main_line_summary || item.reason || rationale.decision_summary || '-';
  const uncertainPoints = Array.isArray(item.uncertain_points)
    ? item.uncertain_points
    : rationale.conflicting_or_missing_evidence || [];
  const sourceSummaries = evidenceSources
    .map((source) => source.evidence_summary)
    .filter(Boolean);

  return {
    score: number(item.score),
    reason: mainLineSummary,
    mainLineSummary,
    evidenceType: item.evidence_type || '-',
    evidenceTypeReason: item.evidence_type_reason || '-',
    whyNotHigher: item.why_not_higher || '-',
    version: get(record, 'meta.rubric_version', item.criteria_reference?.criteria_version || '-'),
    author: get(record, 'meta.rubric_author', item.criteria_reference?.criteria_author || '-'),
    rule: appliedRule,
    ruleLabel: matchingRule?.label || (item.score != null ? `${item.score}점 기준` : '-'),
    ruleCriteria: scoreDefinition || matchingRule?.criteria || '-',
    evidenceExpectation: definition.evidence_expectation || '-',
    appliedScoreDefinition: scoreDefinition || rationale.applied_score_definition || matchingRule?.criteria || '-',
    decisionSummary: mainLineSummary,
    keyJudgmentFactors: rationale.key_judgment_factors || [],
    supportingEvidenceSummary: sourceSummaries.join(' | ') || rationale.supporting_evidence_summary || '-',
    conflictingOrMissingEvidence: uncertainPoints,
    confidence: rationale.confidence || 'Unclear',
    investigationNote: item.investigation_note || rationale.reviewer_notes || '-',
    calculation: item.calculation || null,
    evidenceSources
  };
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

function computeHardFilter(record, criteria) {
  const summary = record.json_summary || {};
  const scoring = record.scoring || {};
  const totalOverrideRaw = humanReviewOverrides(record).total_score;
  const totalOverride = totalOverrideRaw === null || totalOverrideRaw === undefined || totalOverrideRaw === ''
    ? null
    : number(totalOverrideRaw);
  const effectiveScores = [
    criteria.target.score,
    criteria.competitive.score,
    criteria.moa.score,
    criteria.platform.score,
    criteria.expansion.score,
    criteria.data.score,
    criteria.market.score
  ].map(number);
  const storedTotal = number(scoring.total_score);
  const total = Number.isInteger(totalOverride) && totalOverride >= 0 && totalOverride <= 21
    ? totalOverride
    : Number.isFinite(storedTotal)
      ? storedTotal
      : effectiveScores.every(Number.isFinite)
        ? effectiveScores.reduce((sum, score) => sum + score, 0)
        : null;
  const targetScore = number(summary.target_relevance_score ?? criteria.target.score);
  const moaScore = number(criteria.moa.score);
  const dataScore = number(criteria.data.score);
  const theme = summary.theme || '';
  const cluster = summary.cluster || '';
  const notes = collectHardFilterNotes(record);
  const reasons = [];

  const noThemeFit = hasNoThemeFit(theme, cluster);
  const failBlocker = /(outside primary|outside.*theme|out of scope|no public target|no.*target\/moa|discontinued|dormant|범위 밖|미해당|중단)/i.test(notes);
  const reviewUncertainty = /(stage|rights?|license|licensed|ownership|asset identity|identity|source|official|registry|unclear|uncertain|not public|not verified|confirmation|confirm|sponsor|단계|권리|출처|공식|불확실|확인|미확인|식별|정체|라이선스|스폰서)/i.test(notes);

  if (Number.isFinite(total) && total <= 8) reasons.push(`Total score ${total} <= 8`);
  if (Number.isFinite(targetScore) && targetScore <= 1) reasons.push(`Target Relevance ${targetScore} <= 1`);
  if (noThemeFit) reasons.push('SKBP Theme/Cluster fit 없음');
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

function normalizeTriageStatus(value) {
  const text = String(value || '').trim().toUpperCase();
  if (['SELECT', 'REJECT', 'N/A', 'NA'].includes(text)) {
    return text === 'NA' ? 'N/A' : text;
  }
  return '';
}

function normalizeFullStatus(value) {
  const text = String(value || '').trim().toUpperCase();
  return ['PASS', 'REVIEW', 'FAIL'].includes(text) ? text : '';
}

function humanReviewOverrides(record) {
  const overrides = get(record, 'meta.human_review.overrides', {});
  return overrides && typeof overrides === 'object' ? overrides : {};
}

function humanScoreOverride(record, criterionId, fallback) {
  const value = get(record, `meta.human_review.overrides.scores.${criterionId}`, null);
  if (value !== null && value !== undefined && value !== '') {
    const numeric = number(value);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 3) return numeric;
  }
  return fallback === null || fallback === undefined || fallback === '' ? null : number(fallback);
}

function isTriageRecord(record) {
  const status = normalizeTriageStatus(record?.hard_filter?.status || record?.triage?.status || record?.triage_status);
  const parserStatus = String(record?.source_report?.parser_status || '').toLowerCase();
  const reviewType = String(record?.meta?.review_type || record?.meta?.workflow || '').toLowerCase();
  return Boolean(status) || parserStatus.includes('triage') || reviewType.includes('triage');
}

function recordFilterStatus(record, computedHardFilter) {
  const triageRecord = isTriageRecord(record);
  const stage = canonicalDevelopmentStage(record?.structured_table?.development_stage || '');
  if (triageRecord && stage === 'Discontinued / inactive') {
    return {
      status: 'REJECT',
      reason: 'Fast triage auto-reject: discontinued / inactive pipeline'
    };
  }

  const triageStatus = normalizeTriageStatus(record?.hard_filter?.status || record?.triage?.status || record?.triage_status);
  if (triageStatus) {
    return {
      status: triageStatus,
      reason: record?.hard_filter?.reason || record?.triage?.reason || record?.triage_reason || 'Fast triage result'
    };
  }
  return computedHardFilter;
}

function recordFilter1Status(record) {
  const triageRecord = isTriageRecord(record);
  const manualStatus = normalizeTriageStatus(humanReviewOverrides(record).filter_status);
  if (triageRecord && manualStatus) {
    return {
      status: manualStatus,
      reason: 'Human reviewer override from dashboard table'
    };
  }

  const stage = canonicalDevelopmentStage(record?.structured_table?.development_stage || '');
  if (triageRecord && stage === 'Discontinued / inactive') {
    return {
      status: 'REJECT',
      reason: 'Fast triage auto-reject: discontinued / inactive pipeline'
    };
  }

  const triageStatus = normalizeTriageStatus(record?.hard_filter?.status || record?.triage?.status || record?.triage_status);
  if (triageStatus) {
    return {
      status: triageStatus,
      reason: record?.hard_filter?.reason || record?.triage?.reason || record?.triage_reason || 'Fast triage result'
    };
  }

  return { status: '-', reason: '' };
}

function recordFilter2Status(record, computedHardFilter) {
  if (isTriageRecord(record)) {
    return { status: '-', reason: 'Full Scout v3.2 not run yet' };
  }
  const manualStatus = normalizeFullStatus(humanReviewOverrides(record).filter_status);
  return manualStatus
    ? { status: manualStatus, reason: 'Human reviewer override from dashboard table' }
    : computedHardFilter;
}

function flattenRecord(record, index) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const scoring = record.scoring || {};
  const focusManagement = get(record, 'meta.focus_management', {});
  const collaborationComments = get(record, 'meta.collaboration.comments', []);
  const teamComments = Array.isArray(collaborationComments) ? collaborationComments : [];
  const latestTeamComment = teamComments.at(-1) || {};
  const targetCriterion = get(record, 'scoring.criteria.target_relevance', {});
  const champion = targetCriterion.ai_champion || {};
  const criteria = {
    target: criterion(record, 'target_relevance'),
    competitive: criterion(record, 'competitive_landscape'),
    moa: criterion(record, 'moa_validity'),
    platform: criterion(record, 'platform_attractiveness'),
    expansion: criterion(record, 'expansion_potential'),
    data: criterion(record, 'data_maturity'),
    market: criterion(record, 'marketability')
  };
  const isTriage = isTriageRecord(record);
  const targetScore = humanScoreOverride(
    record,
    'target_relevance',
    summary.target_relevance_score ?? criteria.target.score ?? champion.score
  );
  const competitiveScore = humanScoreOverride(record, 'competitive_landscape', criteria.competitive.score);
  const moaScore = humanScoreOverride(record, 'moa_validity', criteria.moa.score);
  const platformScore = humanScoreOverride(record, 'platform_attractiveness', criteria.platform.score);
  const expansionScore = humanScoreOverride(record, 'expansion_potential', criteria.expansion.score);
  const dataScore = humanScoreOverride(record, 'data_maturity', criteria.data.score);
  const marketScore = humanScoreOverride(record, 'marketability', criteria.market.score);
  criteria.target.score = targetScore;
  criteria.competitive.score = competitiveScore;
  criteria.moa.score = moaScore;
  criteria.platform.score = platformScore;
  criteria.expansion.score = expansionScore;
  criteria.data.score = dataScore;
  criteria.market.score = marketScore;
  const totalScoreOverrideRaw = humanReviewOverrides(record).total_score;
  const totalScoreOverride = totalScoreOverrideRaw === null
    || totalScoreOverrideRaw === undefined
    || totalScoreOverrideRaw === ''
    ? null
    : number(totalScoreOverrideRaw);
  const storedTotalScore = number(scoring.total_score);
  const effectiveTotalScore = Number.isInteger(totalScoreOverride)
    && totalScoreOverride >= 0
    && totalScoreOverride <= 21
    ? totalScoreOverride
    : storedTotalScore;

  const computedHardFilter = computeHardFilter(record, criteria);
  const filter1Status = recordFilter1Status(record);
  const filter2Status = recordFilter2Status(record, computedHardFilter);
  const filterStatus = filter1Status.status !== '-' ? filter1Status : filter2Status;

  return {
    id: get(record, 'meta.output_filename_base', `${summary.company || table.company || 'record'}-${index}`),
    company: summary.company || table.company || '-',
    countryRaw: summary.company_country || table.company_country || '-',
    country: canonicalCountry(summary.company_country || table.company_country || '-'),
    asset: summary.asset_name || table.asset_name || '-',
    target: summary.target || table.target || '-',
    theme: canonicalTheme(summary.theme || get(champion, 'matched_theme.name', '-')),
    cluster: canonicalCluster(summary.cluster || get(champion, 'matched_cluster.name', '-')),
    stageRaw: table.development_stage || '-',
    stage: canonicalDevelopmentStage(table.development_stage || '-'),
    indication: table.indication || '-',
    mainIndicationRaw: table.main_indication || table.primary_indication || summary.main_indication || mainIndicationFrom(table.indication),
    mainIndication: canonicalDashboardIndication(table.main_indication || table.primary_indication || summary.main_indication || table.indication),
    modality: canonicalModality(table.modality_platform),
    targetDescription: String(
      targetCriterion.main_line_summary
      || targetCriterion.investigation_note
      || get(record, 'final_insight.one_line_summary', summary.one_line_summary || '-')
    ),
    focusTracked: focusManagement?.is_tracked === true,
    focusComment: String(focusManagement?.user_comment || ''),
    focusDueDate: String(focusManagement?.due_date || ''),
    focusAddedAt: String(focusManagement?.added_at || ''),
    teamCommentCount: teamComments.length,
    latestTeamComment: String(latestTeamComment?.body || ''),
    latestTeamCommentAuthor: String(latestTeamComment?.author || ''),
    isTriage,
    filter1: filter1Status.status,
    filter2: filter2Status.status,
    filter3: String(focusManagement?.partnership_type || ''),
    filter3Note: String(focusManagement?.partnership_note || ''),
    filter3Source: String(focusManagement?.partnership_classification_source || 'auto'),
    filter3EvidenceSources: Array.isArray(focusManagement?.partnership_evidence_sources)
      ? focusManagement.partnership_evidence_sources.map(String)
      : [],
    inVivoStatus: String(focusManagement?.in_vivo_status || 'N/A'),
    inVivoSource: String(focusManagement?.in_vivo_status_source || 'auto'),
    inVitroStatus: String(focusManagement?.in_vitro_status || 'N/A'),
    inVitroSource: String(focusManagement?.in_vitro_status_source || 'auto'),
    admetCompleted: Number.isFinite(focusManagement?.admet_completed) ? focusManagement.admet_completed : null,
    admetSource: String(focusManagement?.admet_completed_source || 'auto'),
    hardFilter: filterStatus.status,
    hardFilterReason: filterStatus.reason,
    targetScore,
    competitiveScore,
    moaScore,
    platformScore,
    expansionScore,
    dataScore,
    marketScore,
    totalScore: effectiveTotalScore,
    focusTotalScore: effectiveTotalScore,
    maxScore: number(scoring.max_score) || 21,
    competition: get(record, 'competitive_analysis.competitive_density', 'Unclear'),
    similarPipelineCount: number(get(record, 'competitive_analysis.similarity_summary.similar_pipeline_count', 0)),
    highSimilarityCount: number(get(record, 'competitive_analysis.similarity_summary.high_similarity_count', 0)),
    summary: get(record, 'final_insight.one_line_summary', summary.one_line_summary || '-'),
    criteriaVersion: get(record, 'meta.rubric_version', get(record, 'scoring.criteria.target_relevance.criteria_reference.criteria_version', '-')),
    generatedAt: get(record, 'meta.generated_at', ''),
    lastEditedAt: get(record, 'meta.last_edited_at', ''),
    lastEditedBy: get(record, 'meta.last_edited_by', ''),
    criteria,
    raw: record
  };
}

function formatDateTimeKo(value) {
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

function metaTooltipSuffix(row) {
  const lines = [
    `GPT 검색일: ${row.generatedAt || '-'}`,
    `스코어링 지침: v${row.criteriaVersion || '-'}`
  ];
  if (row.lastEditedAt) {
    lines.push(`마지막 수정: ${formatDateTimeKo(row.lastEditedAt)}에 ${row.lastEditedBy || 'unknown'}에 의해 수정됨`);
  }
  return lines.join('\n');
}

function rowHoverTitle(row, baseText = row.summary) {
  return [baseText, metaTooltipSuffix(row)].filter(Boolean).join('\n\n');
}

const EXTRA_COLUMN_DEFINITIONS = [
  { key: 'moa', label: 'MoA', path: 'structured_table.moa' },
  { key: 'modality', label: 'Modality', path: 'structured_table.modality_platform' },
  { key: 'indication', label: 'Indication', path: 'structured_table.indication' },
  { key: 'headquarters', label: 'HQ', path: 'company_profile.headquarters' },
  { key: 'companyStage', label: 'Company stage', path: 'company_profile.company_stage' },
  { key: 'platformSummary', label: 'Platform summary', path: 'company_profile.platform_summary' },
  { key: 'competitiveDensity', label: 'Competition', path: 'competitive_analysis.competitive_density' },
  { key: 'similarCount', label: 'Similar count', path: 'competitive_analysis.similarity_summary.similar_pipeline_count' },
  { key: 'recommendation', label: 'Recommendation', path: 'scoring.recommendation' },
  { key: 'parserStatus', label: 'Parser status', path: 'source_report.parser_status' },
  { key: 'firstSource', label: 'First source URL', path: 'structured_table.sources.0.source_url' },
  { key: 'uncertainPoints', label: 'Uncertain points', path: 'validation.uncertain_points' }
];

function formatExtraColumnValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .filter(Boolean)
      .slice(0, 3)
      .join(' | ') || '-';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function selectedExtraColumns() {
  return EXTRA_COLUMN_DEFINITIONS.filter((column) => (
    state.extraColumns.has(column.key)
    && !(activeTableMode() === 'full' && column.key === 'modality')
  ));
}

function persistExtraColumns() {
  localStorage.setItem('skbp.dashboard.extraColumns', JSON.stringify([...state.extraColumns]));
}

function extraColumnKey(column) {
  return `extra:${column.key}`;
}

function defaultColumnWidth(key) {
  if (activeTableMode() === 'focus') {
    return FOCUS_DEFAULT_COLUMN_WIDTHS[key] || FOCUS_DEFAULT_COLUMN_WIDTHS.extra;
  }
  return DEFAULT_COLUMN_WIDTHS[key] || DEFAULT_COLUMN_WIDTHS.extra;
}

function minColumnWidth(key) {
  if (activeTableMode() === 'focus') {
    return FOCUS_MIN_COLUMN_WIDTHS[key] || FOCUS_MIN_COLUMN_WIDTHS.extra;
  }
  return MIN_COLUMN_WIDTHS[key] || MIN_COLUMN_WIDTHS.extra;
}

function activeColumnWidths() {
  return activeTableMode() === 'focus' ? state.focusColumnWidths : state.columnWidths;
}

function columnWidth(key) {
  const width = Number(activeColumnWidths()[key]);
  return Number.isFinite(width)
    ? Math.max(minColumnWidth(key), Math.min(MAX_COLUMN_WIDTH, width))
    : defaultColumnWidth(key);
}

function columnWidthStyle(key) {
  const width = columnWidth(key);
  return `width: ${width}px; min-width: ${width}px; max-width: ${width}px;`;
}

function columnAttrs(key) {
  return `data-col-key="${escapeHtml(key)}" style="${columnWidthStyle(key)}"`;
}

function resizeHandle(key) {
  if (key === 'select') return '';
  return `<span class="column-resize-handle" data-resize-column="${escapeHtml(key)}" aria-hidden="true"></span>`;
}

function sortableHeader(label, sortKey, columnKey, attrs = '') {
  return `<th ${attrs} ${columnAttrs(columnKey)}><button data-sort="${escapeHtml(sortKey)}" type="button">${escapeHtml(label)}</button>${resizeHandle(columnKey)}</th>`;
}

function plainHeader(label, columnKey, className = '', attrs = '') {
  const classAttr = className ? ` class="${escapeHtml(className)}"` : '';
  return `<th${classAttr} ${attrs} ${columnAttrs(columnKey)}><span title="${escapeHtml(label)}">${escapeHtml(label)}</span>${resizeHandle(columnKey)}</th>`;
}

function activeTableMode() {
  if (state.tableMode === 'triage') return 'triage';
  if (state.tableMode === 'focus') return 'focus';
  return 'full';
}

function activeFilterKey() {
  return activeTableMode() === 'triage' ? 'filter1' : 'filter2';
}

function activeFilterLabel() {
  return activeTableMode() === 'triage' ? 'Filter 1' : 'Filter 2';
}

function activeScoreColumnKeys() {
  const triageCore = ['targetScore', 'moaScore', 'dataScore'];
  if (activeTableMode() === 'triage') return triageCore;
  if (activeTableMode() === 'focus') return [];
  return [
    ...triageCore,
    'competitiveScore',
    'platformScore',
    'expansionScore',
    'marketScore',
    'totalScore'
  ];
}

function rowMatchesActiveTableMode(row) {
  if (activeTableMode() === 'focus') {
    return !row.isTriage && row.focusTracked;
  }
  if (activeTableMode() === 'full') {
    return !row.isTriage;
  }
  const status = row[activeFilterKey()];
  return Boolean(status && status !== '-');
}

const FOCUS_TABLE_COLUMN_KEYS = [
  'company',
  'country',
  'asset',
  'modality',
  'target',
  'mainIndication',
  'stage',
  'filter2',
  'totalScore',
  'filter3',
  'inVivo',
  'inVitro',
  'admet',
  'focusDueDate',
  'focusManage'
];

function visibleColumnKeys(extraColumns = selectedExtraColumns()) {
  if (activeTableMode() === 'focus') return FOCUS_TABLE_COLUMN_KEYS;
  const keys = [
    'select',
    'company',
    'country',
    'asset',
    'modality',
    'target',
    'mainIndication',
    'stage',
    activeFilterKey(),
    ...activeScoreColumnKeys(),
    ...extraColumns.map(extraColumnKey)
  ];
  if (activeTableMode() === 'full') keys.push('focusAction');
  return keys;
}

function updateFrozenColumnOffsets() {
  const tableElement = elements.pipelineTable?.closest('table');
  if (!tableElement) return;
  let offset = 0;
  if (activeTableMode() !== 'focus') offset += columnWidth('select');
  tableElement.style.setProperty('--freeze-left-company', `${offset}px`);
  offset += columnWidth('company');
  tableElement.style.setProperty('--freeze-left-asset', `${offset}px`);
}

function visibleTableWidth(extraColumns = selectedExtraColumns()) {
  return visibleColumnKeys(extraColumns).reduce((sum, key) => sum + columnWidth(key), 0);
}

function persistColumnWidths() {
  if (activeTableMode() === 'focus') {
    localStorage.setItem(FOCUS_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(state.focusColumnWidths));
    return;
  }
  localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(state.columnWidths));
}

function applyColumnWidths(extraColumns = selectedExtraColumns()) {
  visibleColumnKeys(extraColumns).forEach((key) => {
    document.querySelectorAll(`[data-col-key="${CSS.escape(key)}"]`).forEach((element) => {
      element.style.width = `${columnWidth(key)}px`;
      element.style.minWidth = `${columnWidth(key)}px`;
      element.style.maxWidth = `${columnWidth(key)}px`;
    });
  });
  const tableElement = elements.pipelineTable?.closest('table');
  if (tableElement) tableElement.style.minWidth = `${visibleTableWidth(extraColumns)}px`;
  updateFrozenColumnOffsets();
}

function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function formatAverage(value, max) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(1)} / ${max}`;
}

function countBy(rows, keyGetter) {
  return rows.reduce((acc, row) => {
    const key = keyGetter(row) || '-';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topCountsWithOthers(
  rows,
  keyGetter,
  topN = 5,
  othersLabel = 'Others',
  { adjacentSequence = [] } = {}
) {
  const counts = countBy(rows, keyGetter);
  const isGenericOtherLabel = (label) => /^others?$/i.test(String(label).trim());
  const entries = Object.entries(counts);
  const genericOtherTotal = entries
    .filter(([label]) => isGenericOtherLabel(label))
    .reduce((sum, [, value]) => sum + value, 0);
  const sorted = entries
    .filter(([label]) => !isGenericOtherLabel(label))
    .sort((a, b) => b[1] - a[1]);
  let top = sorted.slice(0, topN);

  const normalizedSequence = adjacentSequence.map((label) => normalizeCategoryText(label));
  if (normalizedSequence.length) {
    const pinnedEntries = normalizedSequence
      .map((normalizedLabel) => sorted.find(([label]) => normalizeCategoryText(label) === normalizedLabel))
      .filter(Boolean);
    pinnedEntries.forEach((entry) => {
      if (top.includes(entry)) return;
      const removableIndex = [...top]
        .map(([label], index) => ({ label: normalizeCategoryText(label), index }))
        .reverse()
        .find((item) => !normalizedSequence.includes(item.label))?.index;
      if (removableIndex !== undefined) top.splice(removableIndex, 1, entry);
    });

    const pinnedInTop = pinnedEntries.filter((entry) => top.includes(entry));
    if (pinnedInTop.length > 1) {
      const firstRank = Math.min(...pinnedInTop.map((entry) => sorted.indexOf(entry)));
      const remaining = top
        .filter((entry) => !pinnedInTop.includes(entry))
        .sort((a, b) => sorted.indexOf(a) - sorted.indexOf(b));
      const insertionIndex = remaining.filter((entry) => sorted.indexOf(entry) < firstRank).length;
      remaining.splice(insertionIndex, 0, ...pinnedInTop);
      top = remaining;
    }
  }

  const selectedLabels = new Set(top.map(([label]) => label));
  const othersTotal = sorted
    .filter(([label]) => !selectedLabels.has(label))
    .reduce((sum, [, value]) => sum + value, 0) + genericOtherTotal;
  if (othersTotal > 0) top.push([othersLabel, othersTotal]);
  return top;
}

function getVisibleRows() {
  const query = state.query.trim().toLowerCase();
  const filterKey = activeFilterKey();
  return state.rows
    .filter((row) => {
      const searchable = [
        row.company,
        row.country,
        row.countryRaw,
        row.asset,
        row.target,
        row.theme,
        row.cluster,
        row.stage,
        row.stageRaw,
        row.mainIndication,
        row.mainIndicationRaw,
        row.indication,
        row.modality
      ]
        .join(' ')
        .toLowerCase();

      return (
        rowMatchesActiveTableMode(row) &&
        (!query || searchable.includes(query)) &&
        (state.stage === 'all' || row.stage === state.stage) &&
        (state.theme === 'all' || row.theme === state.theme) &&
        (state.cluster === 'all' || row.cluster === state.cluster) &&
        (state.modality === 'all' || row.modality === state.modality) &&
        (state.indication === 'all' || row.mainIndication === state.indication) &&
        (state.country === 'all' || row.country === state.country) &&
        (state.pass === 'all' || row[filterKey] === state.pass)
      );
    })
    .sort((a, b) => {
      const av = a[state.sortKey];
      const bv = b[state.sortKey];
      const direction = state.sortDirection === 'asc' ? 1 : -1;

      if (typeof av === 'number' || typeof bv === 'number') {
        return ((av ?? -Infinity) - (bv ?? -Infinity)) * direction;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'ko') * direction;
    });
}

function renderFilters() {
  const stages = [...new Set(state.rows.map((row) => row.stage).filter(Boolean))].sort();
  const themes = [...new Set(state.rows.map((row) => row.theme).filter(Boolean))].sort();
  const clusters = [...new Set(state.rows.map((row) => row.cluster).filter(Boolean))].sort();
  const modalities = [...new Set(state.rows.map((row) => row.modality).filter(Boolean))].sort();
  const countries = [...new Set(state.rows.map((row) => row.country).filter(Boolean))].sort();
  const indications = [...new Set(state.rows.map((row) => row.mainIndication).filter(Boolean))].sort();
  const filterKey = activeFilterKey();
  const filterStatuses = [...new Set(state.rows
    .filter(rowMatchesActiveTableMode)
    .map((row) => row[filterKey])
    .filter((value) => value && value !== '-'))]
    .sort((a, b) => {
      const order = ['SELECT', 'PASS', 'REVIEW', 'REJECT', 'FAIL', 'N/A'];
      return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
    });
  const option = (value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
  if (state.pass !== 'all' && !filterStatuses.includes(state.pass)) {
    state.pass = 'all';
  }

  elements.stageFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...stages.map(option)
  ].join('');
  elements.themeFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...themes.map(option)
  ].join('');
  elements.clusterFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...clusters.map(option)
  ].join('');
  elements.modalityFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...modalities.map(option)
  ].join('');
  elements.modalityFilter.value = state.modality;

  elements.countryFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...countries.map(option)
  ].join('');
  elements.indicationFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...indications.map(option)
  ].join('');
  elements.passFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...filterStatuses.map(option)
  ].join('');
  elements.passFilter.value = state.pass;
}

function renderMetrics() {
  const total = state.rows.length;
  const pass = state.rows.filter((row) => row.filter1 === 'SELECT' || row.filter2 === 'PASS').length;
  const avgTotal = average(state.rows.map((row) => row.totalScore));
  const avgTarget = average(state.rows.map((row) => row.targetScore));
  const maxTotal = state.rows.find((row) => Number.isFinite(row.maxScore))?.maxScore || 21;
  const countries = new Set(state.rows.map((row) => row.country).filter((country) => country && country !== '-'));

  elements.metricTotal.textContent = String(total);
  elements.metricPass.textContent = total ? `${pass} / ${total}` : '-';
  elements.metricScore.textContent = formatAverage(avgTotal, maxTotal);
  elements.metricTarget.textContent = formatAverage(avgTarget, 3);
  elements.metricCountries.textContent = String(countries.size);
}

const DONUT_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)'
];
const DONUT_OTHERS_COLOR = 'var(--chart-other)';

function distributionDisplayLabel(kind, label) {
  const value = String(label || '');
  if (kind === 'country' && /^republic of korea$/i.test(value)) return 'Korea';
  if (kind === 'modality') {
    if (/^small molecule$/i.test(value)) return 'SM';
    if (/^cell therapy$/i.test(value)) return 'CT';
    if (/^gene therapy$/i.test(value)) return 'GT';
  }
  if (kind !== 'indication') return value;

  const indicationAbbreviations = [
    [/alzheimer/i, 'AD'],
    [/parkinson/i, 'PD'],
    [/^multiple sclerosis\b/i, 'MS'],
    [/amyotrophic lateral sclerosis|\bals\b/i, 'ALS'],
    [/major depressive disorder|\bmdd\b/i, 'MDD'],
    [/inflammatory bowel disease|\bibd\b/i, 'IBD'],
    [/developmental and epileptic encephalopathy|\bdee\b/i, 'DEE'],
    [/epilepsy\s*\/\s*seizure disorders/i, 'Epilepsy']
  ];
  return indicationAbbreviations.find(([pattern]) => pattern.test(value))?.[1] || value;
}

function distributionDescription(kind, label) {
  const value = String(label || '').trim();
  if (value === 'Others') {
    return '빈도 상위 5개에 포함되지 않은 6번째 이하 항목과 일반 Other 값을 합산한 그룹입니다.';
  }
  if (value === 'Unknown') {
    return kind === 'theme'
      ? '공개자료의 Target 또는 MoA 근거가 부족해 SKBP Theme/Cluster를 확정하지 못한 경우입니다.'
      : '공개자료가 부족해 해당 항목을 확정하지 못한 경우입니다.';
  }
  if (value === 'N/A') {
    return kind === 'theme'
      ? '파이프라인은 확인됐지만 SKBP 관심 Theme/Cluster 범위에 부합하지 않는 것으로 확인된 경우입니다.'
      : '해당 항목이 적용되지 않거나, Fast Triage에서 파이프라인 identity를 확인하지 못한 경우입니다.';
  }
  return '';
}

const DONUT_RADIUS = 38;
const DONUT_STROKE_WIDTH = 14;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function donutChart(entries, kind) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return '<div class="empty-state">데이터 없음</div>';

  let cursor = 0;
  const isNeutralDonutLabel = (label) => label === 'Others' || label === 'Unknown';
  const segmentColor = (label, index) => (isNeutralDonutLabel(label) ? DONUT_OTHERS_COLOR : DONUT_PALETTE[index % DONUT_PALETTE.length]);
  const segments = entries
    .map(([label, value], index) => {
      const fraction = value / total;
      const pct = Math.round(fraction * 100);
      const dash = fraction * DONUT_CIRCUMFERENCE;
      const offset = -cursor * DONUT_CIRCUMFERENCE;
      cursor += fraction;
      const displayLabel = distributionDisplayLabel(kind, label);
      return `
        <circle
          class="donut-segment"
          cx="50" cy="50" r="${DONUT_RADIUS}"
          fill="none"
          stroke="${segmentColor(label, index)}"
          stroke-width="${DONUT_STROKE_WIDTH}"
          stroke-dasharray="${dash} ${DONUT_CIRCUMFERENCE - dash}"
          stroke-dashoffset="${offset}"
          data-donut-index="${index}"
          data-value="${value}"
          data-label="${escapeHtml(displayLabel)}"
          data-pct="${pct}"
          tabindex="0"
          aria-label="${escapeHtml(displayLabel)} ${value}, ${pct}%"
        ></circle>
      `;
    })
    .join('');

  const legend = entries
    .map(([label, value], index) => {
      const pct = Math.round((value / total) * 100);
      const displayLabel = distributionDisplayLabel(kind, label);
      const description = distributionDescription(kind, label);
      const fullNameNote = displayLabel !== label ? `${displayLabel}: ${label}` : label;
      const tooltip = [fullNameNote, description].filter(Boolean).join(' — ');
      return `
        <span
          class="${description ? 'has-description' : ''}"
          data-donut-index="${index}"
          title="${escapeHtml(tooltip)}"
          aria-label="${escapeHtml(tooltip)}, ${value}, ${pct}%"
          tabindex="0"
        >
          <b class="legend-dot" style="background:${segmentColor(label, index)}"></b>${escapeHtml(displayLabel)}
          <em>${pct}%</em>
        </span>
      `;
    })
    .join('');

  return `
    <div class="donut-wrap">
      <div class="donut" data-default-value="${total}">
        <svg class="donut-svg" viewBox="0 0 100 100">${segments}</svg>
        <div class="donut-center">
          <span class="donut-value">${total}</span>
        </div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>
  `;
}

function wireDonutHover(container) {
  const donut = container.querySelector('.donut');
  if (!donut) return;
  const valueEl = donut.querySelector('.donut-value');
  const defaultValue = donut.dataset.defaultValue || '';
  const segments = [...donut.querySelectorAll('.donut-segment')];
  const legendItems = [...container.querySelectorAll('.donut-legend [data-donut-index]')];

  const activateIndex = (index) => {
    const activeSegment = segments.find(
      (segment) => segment.dataset.donutIndex === String(index)
    );
    if (!activeSegment) return;
    valueEl.textContent = activeSegment.dataset.value;
    segments.forEach((segment) => {
      const isActive = segment === activeSegment;
      segment.classList.toggle('is-active', isActive);
      segment.classList.toggle('is-dimmed', !isActive);
    });
    legendItems.forEach((item) => {
      const isActive = item.dataset.donutIndex === String(index);
      item.classList.toggle('is-active', isActive);
      item.classList.toggle('is-dimmed', !isActive);
    });
  };

  const resetCenter = () => {
    valueEl.textContent = defaultValue;
    segments.forEach((segment) => segment.classList.remove('is-active', 'is-dimmed'));
    legendItems.forEach((item) => item.classList.remove('is-active', 'is-dimmed'));
  };

  container.addEventListener('pointerover', (event) => {
    const item = event.target.closest('[data-donut-index]');
    if (!item || !container.contains(item)) return;
    activateIndex(item.dataset.donutIndex);
  });

  container.addEventListener('pointerout', (event) => {
    const item = event.target.closest('[data-donut-index]');
    if (!item) return;
    const nextItem = event.relatedTarget?.closest?.('[data-donut-index]');
    if (nextItem && container.contains(nextItem)) {
      activateIndex(nextItem.dataset.donutIndex);
      return;
    }
    resetCenter();
  });

  container.addEventListener('focusin', (event) => {
    const item = event.target.closest('[data-donut-index]');
    if (item) activateIndex(item.dataset.donutIndex);
  });

  container.addEventListener('focusout', (event) => {
    const nextItem = event.relatedTarget?.closest?.('[data-donut-index]');
    if (nextItem && container.contains(nextItem)) {
      activateIndex(nextItem.dataset.donutIndex);
      return;
    }
    resetCenter();
  });
}

function renderCharts() {
  const themeTop = topCountsWithOthers(state.rows, (row) => row.theme || 'N/A', 5, 'Others');
  elements.themeChart.innerHTML = donutChart(themeTop, 'theme');
  wireDonutHover(elements.themeChart);

  const indicationTop = topCountsWithOthers(state.rows, (row) => row.mainIndication || 'N/A', 5, 'Others');
  elements.indicationChart.innerHTML = donutChart(indicationTop, 'indication');
  wireDonutHover(elements.indicationChart);

  const modalityTop = topCountsWithOthers(
    state.rows,
    (row) => row.modality || 'N/A',
    5,
    'Others',
    { adjacentSequence: ['Cell therapy', 'Gene therapy'] }
  );
  elements.modalityChart.innerHTML = donutChart(modalityTop, 'modality');
  wireDonutHover(elements.modalityChart);

  const countryTop = topCountsWithOthers(state.rows, (row) => row.country || 'N/A', 6, 'Others');
  elements.countryChart.innerHTML = donutChart(countryTop, 'country');
  wireDonutHover(elements.countryChart);

  if (elements.priorityList) {
    const reviewRows = state.rows.filter((row) => row.filter1 === 'REVIEW' || row.filter2 === 'REVIEW');
    const topRows = [...reviewRows]
      .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))
      .slice(0, 3);
    elements.priorityList.innerHTML = topRows.length
      ? topRows.map((row) => `
          <button type="button" class="priority-item" data-record-id="${escapeHtml(row.id)}" data-is-triage="${row.isTriage ? '1' : ''}">
            <strong>${escapeHtml(row.asset)}</strong>
            <span>${escapeHtml(row.theme)} · ${escapeHtml(row.cluster)}</span>
            <b>${row.totalScore ?? '-'} / ${row.maxScore ?? 21}</b>
          </button>
        `).join('')
      : '<div class="empty-state">Review 대기 중인 pipeline이 없습니다</div>';
  }

  if (elements.dueDateList) {
    const dueRows = state.rows
      .filter((row) => row.focusTracked && row.focusDueDate)
      .sort((a, b) => (a.focusDueDate < b.focusDueDate ? -1 : a.focusDueDate > b.focusDueDate ? 1 : 0))
      .slice(0, 3);
    elements.dueDateList.innerHTML = dueRows.length
      ? dueRows.map((row) => `
          <button type="button" class="priority-item" data-record-id="${escapeHtml(row.id)}" data-is-triage="${row.isTriage ? '1' : ''}">
            <strong>${escapeHtml(row.asset)}</strong>
            <span>${escapeHtml(row.focusComment || row.latestTeamComment || '등록된 action item 없음')}</span>
            <b>${escapeHtml(row.focusDueDate)}</b>
          </button>
        `).join('')
      : '<div class="empty-state">Action date가 설정된 관심 목록 항목이 없습니다</div>';
  }
}

function renderColumnSettings() {
  if (!elements.columnSettingsGrid) return;
  elements.columnSettingsGrid.innerHTML = EXTRA_COLUMN_DEFINITIONS.map((column) => {
    const isBuiltInFullScoutColumn = activeTableMode() === 'full' && column.key === 'modality';
    return `
      <label class="column-option ${isBuiltInFullScoutColumn ? 'is-built-in' : ''}">
        <input
          type="checkbox"
          value="${escapeHtml(column.key)}"
          ${isBuiltInFullScoutColumn || state.extraColumns.has(column.key) ? 'checked' : ''}
          ${isBuiltInFullScoutColumn ? 'disabled' : ''}
        />
        <span>${escapeHtml(column.label)}</span>
        <small>${isBuiltInFullScoutColumn ? 'TAB2 기본 컬럼' : escapeHtml(column.path)}</small>
      </label>
    `;
  }).join('');
}

function scoreTooltipLegacy(label, criterionInfo, max) {
  const score = criterionInfo?.score ?? '-';
  const missing = (criterionInfo?.conflictingOrMissingEvidence || []).slice(0, 2).join('; ') || '-';
  const sources = (criterionInfo?.evidenceSources || [])
    .slice(0, 3)
    .map((source) => `${source.source_title || '-'}${source.source_url ? ` (${source.source_url})` : ''}`)
    .join('\n') || '-';
  const lines = [
    `${label}: ${score} / ${max}`,
    `Evidence Type: ${criterionInfo?.evidenceType || '-'} (${criterionInfo?.evidenceTypeReason || '-'})`,
    `Rubric 기준: ${criterionInfo?.appliedScoreDefinition || criterionInfo?.ruleCriteria || '-'}`,
    `판단 이유: ${criterionInfo?.mainLineSummary || criterionInfo?.decisionSummary || criterionInfo?.reason || '-'}`,
    `Why not higher: ${criterionInfo?.whyNotHigher || '-'}`,
    `조사 메모: ${criterionInfo?.investigationNote || '-'}`,
    `자료 근거 요약: ${criterionInfo?.supportingEvidenceSummary || '-'}`,
    `출처: ${sources}`,
    `부족/상충 자료: ${missing}`,
    `Rubric version: ${criterionInfo?.version || '-'} / ${criterionInfo?.author || '-'}`
  ];
  const calc = criterionInfo?.calculation;
  if (calc?.A_targetable_addressable_patient || calc?.B_unrisked_peak_sales || calc?.C_obtainable_peak_sales) {
    const a = calc.A_targetable_addressable_patient || {};
    const b = calc.B_unrisked_peak_sales || {};
    const c = calc.C_obtainable_peak_sales || {};
    lines.splice(
      3,
      0,
      `A. TAP: ${a.targetable_addressable_patient ?? '-'} (${a.formula || '-'})`,
      `B. Unrisked Peak Sales: ${formatMillionUsd(b.unrisked_peak_sales, b.sales_unit)} (${b.formula || '-'})`,
      `C. Obtainable Peak Sales: ${formatMillionUsd(c.obtainable_peak_sales, c.sales_unit)} (${c.formula || '-'})`
    );
  }
  return lines.join('\n');
}

function scoreTooltip(label, criterionInfo, max) {
  const meaningfulValue = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text || text === '-' || /^null$/i.test(text) || /^undefined$/i.test(text)) return '';
    return text;
  };
  const pushLine = (lines, lineLabel, value) => {
    const text = meaningfulValue(value);
    if (text) lines.push(`${lineLabel}: ${text}`);
  };
  const score = meaningfulValue(criterionInfo?.score);
  const lines = [score ? `${label}: ${score} / ${max}` : label];
  const evidenceType = meaningfulValue(criterionInfo?.evidenceType);
  const evidenceReason = meaningfulValue(criterionInfo?.evidenceTypeReason);
  if (evidenceType && evidenceReason) {
    lines.push(`Evidence Type: ${evidenceType} (${evidenceReason})`);
  } else {
    pushLine(lines, 'Evidence Type', evidenceType);
  }

  const calc = criterionInfo?.calculation;
  if (calc?.A_targetable_addressable_patient || calc?.B_unrisked_peak_sales || calc?.C_obtainable_peak_sales) {
    const a = calc.A_targetable_addressable_patient || {};
    const b = calc.B_unrisked_peak_sales || {};
    const c = calc.C_obtainable_peak_sales || {};
    const aValue = [meaningfulValue(a.targetable_addressable_patient), meaningfulValue(a.formula)].filter(Boolean).join(' | ');
    const bValue = [meaningfulValue(formatMillionUsd(b.unrisked_peak_sales, b.sales_unit)), meaningfulValue(b.formula)].filter(Boolean).join(' | ');
    const cValue = [meaningfulValue(formatMillionUsd(c.obtainable_peak_sales, c.sales_unit)), meaningfulValue(c.formula)].filter(Boolean).join(' | ');
    pushLine(lines, 'A. TAP', aValue);
    pushLine(lines, 'B. Unrisked Peak Sales', bValue);
    pushLine(lines, 'C. Obtainable Peak Sales', cValue);
  }

  pushLine(lines, 'Rubric', criterionInfo?.appliedScoreDefinition || criterionInfo?.ruleCriteria);
  pushLine(lines, 'Judgment', criterionInfo?.mainLineSummary || criterionInfo?.decisionSummary || criterionInfo?.reason);
  pushLine(lines, 'Why not higher', criterionInfo?.whyNotHigher);
  pushLine(lines, 'Investigation note', criterionInfo?.investigationNote);
  pushLine(lines, 'Evidence summary', criterionInfo?.supportingEvidenceSummary);

  const sources = (criterionInfo?.evidenceSources || [])
    .slice(0, 3)
    .map((source) => {
      const title = meaningfulValue(source.source_title);
      const url = meaningfulValue(source.source_url);
      if (title && url) return `${title} (${url})`;
      return title || url;
    })
    .filter(Boolean)
    .join('\n');
  pushLine(lines, 'Sources', sources);

  const missing = (criterionInfo?.conflictingOrMissingEvidence || [])
    .map(meaningfulValue)
    .filter(Boolean)
    .slice(0, 2)
    .join('; ');
  pushLine(lines, 'Missing or conflicting evidence', missing);

  const versionInfo = [criterionInfo?.version, criterionInfo?.author].map(meaningfulValue).filter(Boolean).join(' / ');
  pushLine(lines, 'Rubric version', versionInfo);
  return lines.join('\n');
}

function scoreBadge(score, max = 3, tooltip = '', extraClass = '') {
  const tone = score >= max ? 'high' : score >= max * 0.6 ? 'mid' : 'low';
  const className = `score ${tone}${extraClass ? ` ${extraClass}` : ''}`;
  const safeTooltip = escapeHtml(tooltip);
  return `<span class="${className}" data-tooltip="${safeTooltip}" title="${safeTooltip}">${score ?? '-'}</span>`;
}

function selectOption(value, currentValue, label = value) {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(currentValue) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function statusEditSelect(row, filterKey) {
  const value = row[filterKey];
  const options = row.isTriage ? ['SELECT', 'REJECT', 'N/A'] : ['PASS', 'REVIEW', 'FAIL'];
  const isManual = Object.prototype.hasOwnProperty.call(humanReviewOverrides(row.raw), 'filter_status');
  return `
    <select
      class="table-edit-select status-edit ${filterToneClass(value)} ${isManual ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-edit-kind="status"
      data-previous-value="${escapeHtml(value)}"
      aria-label="${escapeHtml(row.asset)} reviewer status"
      title="AI initial status; editable by a human reviewer"
    >
      ${options.map((option) => selectOption(option, value)).join('')}
    </select>
  `;
}

const PARTNERSHIP_TYPE_OPTIONS = [
  { value: '', label: '↻ Auto' },
  { value: 'investment', label: '투자' },
  { value: 'value_up', label: 'Value Up' },
  { value: 'joint_research', label: '공동 연구' },
  { value: 'n_a', label: 'N/A' },
  { value: 'unknown', label: 'Unknown' }
];

function partnershipToneClass(value) {
  if (!value) return 'empty';
  if (value === 'investment') return 'investment';
  if (value === 'value_up') return 'value-up';
  if (value === 'joint_research') return 'joint-research';
  return 'na';
}

function partnershipEditSelect(row) {
  const value = row.filter3;
  const isManual = row.filter3Source === 'manual';
  const note = row.filter3Note || '등록된 OI Note 없음';
  const evidence = row.filter3EvidenceSources.length
    ? row.filter3EvidenceSources.join(' · ')
    : '등록된 Evidence Source 없음';
  const hoverText = [
    `OI Note: ${note}`,
    `Evidence Source: ${evidence}`,
    `분류 기준: ${isManual ? 'HUMAN · 담당자 수동 분류' : 'AUTO · OI Partnership v1.0'}`
  ].join('\n');
  return `
    <select
      class="partnership-edit-select ${partnershipToneClass(value)} ${isManual ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-previous-value="${escapeHtml(value)}"
      aria-label="${escapeHtml(row.asset)} filter 3 (partnership type)"
      title="${escapeHtml(hoverText)}"
    >
      ${PARTNERSHIP_TYPE_OPTIONS.map((option) => selectOption(option.value, value, option.label)).join('')}
    </select>
  `;
}

function partnershipNoteEditor(row) {
  const evidence = row.filter3EvidenceSources.length
    ? row.filter3EvidenceSources.join(' · ')
    : '저장된 근거 출처 없음';
  const sourceLabel = row.filter3Source === 'manual' ? 'HUMAN' : 'AUTO';
  return `
    <div class="partnership-note-editor" title="${escapeHtml(`Evidence Source: ${evidence}`)}">
      <input
        class="partnership-note-input"
        type="text"
        maxlength="500"
        data-record-id="${escapeHtml(row.id)}"
        data-previous-value="${escapeHtml(row.filter3Note)}"
        value="${escapeHtml(row.filter3Note)}"
        aria-label="${escapeHtml(row.asset)} OI Partnership Note"
      />
      <span class="partnership-source-badge ${row.filter3Source === 'manual' ? 'is-human' : 'is-auto'}">${sourceLabel}</span>
    </div>
  `;
}

const EVIDENCE_STATUS_OPTIONS = ['O', 'X', 'N/A'];
const ADMET_TOTAL_ITEMS = 50;
const EVIDENCE_FIELD_TO_BACKEND = {
  inVivoStatus: 'in_vivo_status',
  inVitroStatus: 'in_vitro_status',
  admetCompleted: 'admet_completed'
};

function evidenceToneClass(value) {
  if (value === 'O') return 'pass';
  if (value === 'X') return 'fail';
  return 'na';
}

function evidenceSourceLabel(source) {
  return source === 'manual' ? '수동 입력' : '자동 판단 (GPT 원문 리포트 + 첨부파일 키워드 기반, 실험 데이터 확인 필요)';
}

function evidenceEditSelect(row, field, sourceField, label) {
  const value = row[field] || 'N/A';
  const source = row[sourceField];
  return `
    <select
      class="evidence-edit ${evidenceToneClass(value)} ${source === 'manual' ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-evidence-field="${escapeHtml(field)}"
      data-previous-value="${escapeHtml(value)}"
      aria-label="${escapeHtml(row.asset)} ${escapeHtml(label)}"
      title="${escapeHtml(`${label}: ${evidenceSourceLabel(source)}`)}"
    >
      ${EVIDENCE_STATUS_OPTIONS.map((option) => selectOption(option, value)).join('')}
    </select>
  `;
}

function admetToneClass(value) {
  if (value === null) return 'na';
  if (value >= ADMET_TOTAL_ITEMS) return 'pass';
  if (value === 0) return 'na';
  return 'review';
}

function admetEditSelect(row) {
  const value = row.admetCompleted;
  const options = [
    { value: '', label: `-/${ADMET_TOTAL_ITEMS}` },
    ...Array.from({ length: ADMET_TOTAL_ITEMS + 1 }, (_, count) => ({ value: String(count), label: `${count}/${ADMET_TOTAL_ITEMS}` }))
  ];
  const currentValue = value === null ? '' : String(value);
  return `
    <select
      class="evidence-edit ${admetToneClass(value)} ${row.admetSource === 'manual' ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-evidence-field="admetCompleted"
      data-previous-value="${escapeHtml(currentValue)}"
      aria-label="${escapeHtml(row.asset)} ADMET completed"
      title="${escapeHtml(`ADMET: ${evidenceSourceLabel(row.admetSource)}`)}"
    >
      ${options.map((option) => selectOption(option.value, currentValue, option.label)).join('')}
    </select>
  `;
}

function scoreEditSelect(row, scoreKey, criterionId, label) {
  const value = row[scoreKey];
  const tone = value >= 3 ? 'high' : value >= 2 ? 'mid' : 'low';
  const isManual = Object.prototype.hasOwnProperty.call(
    humanReviewOverrides(row.raw)?.scores || {},
    criterionId
  );
  const tooltip = scoreTooltip(label, row.criteria[
    {
      target_relevance: 'target',
      competitive_landscape: 'competitive',
      moa_validity: 'moa',
      platform_attractiveness: 'platform',
      expansion_potential: 'expansion',
      data_maturity: 'data',
      marketability: 'market'
    }[criterionId]
  ], 3);
  return `
    <select
      class="table-edit-select score-edit ${tone} ${isManual ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-edit-kind="score"
      data-criterion="${escapeHtml(criterionId)}"
      data-previous-value="${escapeHtml(value ?? '')}"
      aria-label="${escapeHtml(row.asset)} ${escapeHtml(label)} score"
      title="${escapeHtml(`AI evidence remains in the report. Human reviewer can override 0-3.\n${tooltip}`)}"
    >
      ${[0, 1, 2, 3].map((score) => selectOption(score, value)).join('')}
    </select>
  `;
}

function hasManualTotalScoreOverride(record) {
  return Object.prototype.hasOwnProperty.call(humanReviewOverrides(record), 'total_score');
}

function totalScoreEditCircle(row) {
  const isManual = hasManualTotalScoreOverride(row.raw);
  const displayValue = row.totalScore ?? '';
  const tone = displayValue >= row.maxScore
    ? 'high'
    : displayValue >= row.maxScore * 0.6
      ? 'mid'
      : 'low';
  const title = isManual
    ? `HUMAN · 담당자가 Tab2 Total Score를 ${displayValue}점으로 수정했습니다.`
    : `AUTO · 원본 Full Scout Total Score ${displayValue}점. Tab2에서 독립적으로 수정할 수 있습니다.`;
  return `
    <input
      class="total-score-edit-circle ${tone} ${isManual ? 'is-human' : 'is-auto'}"
      type="number"
      min="0"
      max="21"
      step="1"
      inputmode="numeric"
      data-record-id="${escapeHtml(row.id)}"
      data-edit-kind="total_score"
      data-previous-value="${escapeHtml(displayValue)}"
      value="${escapeHtml(displayValue)}"
      aria-label="${escapeHtml(row.asset)} Tab2 Total Score"
      title="${escapeHtml(title)}"
    />
  `;
}

function pendingScoreBadge(message = 'Full Scout v3.2 review not run yet') {
  const safeTooltip = escapeHtml(message);
  return `<span class="score pending" data-tooltip="${safeTooltip}" title="${safeTooltip}">-</span>`;
}

function fullReviewScoreBadge(row, scoreKey, criterionKey, label) {
  if (row.isTriage) return pendingScoreBadge();
  return scoreBadge(row[scoreKey], 3, scoreTooltip(label, row.criteria[criterionKey], 3));
}

function filterToneClass(status) {
  if (!status || status === '-') return 'empty';
  if (['PASS', 'SELECT'].includes(status)) return 'pass select';
  if (status === 'FAIL') return 'fail';
  if (['REJECT', 'N/A'].includes(status)) return 'na reject';
  return 'review';
}

function renderTableLegacy() {
  const visibleRows = getVisibleRows();
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  const extraColumns = selectedExtraColumns();

  if (elements.pipelineColGroup) {
    elements.pipelineColGroup.innerHTML = `
      <col class="pipeline-col-select" />
      <col class="pipeline-col-company" />
      <col class="pipeline-col-country" />
      <col class="pipeline-col-asset" />
      <col class="pipeline-col-target" />
      <col class="pipeline-col-indication" />
      <col class="pipeline-col-stage" />
      <col class="pipeline-col-filter" />
      <col class="pipeline-col-filter" />
      <col class="pipeline-col-score" />
      <col class="pipeline-col-score" />
      <col class="pipeline-col-score" />
      <col class="pipeline-col-score" />
      <col class="pipeline-col-score" />
      <col class="pipeline-col-score" />
      <col class="pipeline-col-score" />
      <col class="pipeline-col-score" />
      ${extraColumns.map(() => '<col class="pipeline-col-extra" />').join('')}
    `;
  }
  if (elements.pipelineColGroup) {
    elements.pipelineColGroup.innerHTML = `
      <col class="pipeline-col-select" data-col-key="select" style="${columnWidthStyle('select')}" />
      <col class="pipeline-col-company" data-col-key="company" style="${columnWidthStyle('company')}" />
      <col class="pipeline-col-country" data-col-key="country" style="${columnWidthStyle('country')}" />
      <col class="pipeline-col-asset" data-col-key="asset" style="${columnWidthStyle('asset')}" />
      <col class="pipeline-col-target" data-col-key="target" style="${columnWidthStyle('target')}" />
      <col class="pipeline-col-indication" data-col-key="mainIndication" style="${columnWidthStyle('mainIndication')}" />
      <col class="pipeline-col-stage" data-col-key="stage" style="${columnWidthStyle('stage')}" />
      <col class="pipeline-col-filter" data-col-key="filter1" style="${columnWidthStyle('filter1')}" />
      <col class="pipeline-col-filter" data-col-key="filter2" style="${columnWidthStyle('filter2')}" />
      <col class="pipeline-col-score" data-col-key="targetScore" style="${columnWidthStyle('targetScore')}" />
      <col class="pipeline-col-score" data-col-key="moaScore" style="${columnWidthStyle('moaScore')}" />
      <col class="pipeline-col-score" data-col-key="dataScore" style="${columnWidthStyle('dataScore')}" />
      <col class="pipeline-col-score" data-col-key="competitiveScore" style="${columnWidthStyle('competitiveScore')}" />
      <col class="pipeline-col-score" data-col-key="platformScore" style="${columnWidthStyle('platformScore')}" />
      <col class="pipeline-col-score" data-col-key="expansionScore" style="${columnWidthStyle('expansionScore')}" />
      <col class="pipeline-col-score" data-col-key="marketScore" style="${columnWidthStyle('marketScore')}" />
      <col class="pipeline-col-score" data-col-key="totalScore" style="${columnWidthStyle('totalScore')}" />
      ${extraColumns.map((column) => `<col class="pipeline-col-extra" data-col-key="${escapeHtml(extraColumnKey(column))}" style="${columnWidthStyle(extraColumnKey(column))}" />`).join('')}
    `;
  }
  const tableElement = elements.pipelineTable?.closest('table');
  if (tableElement) {
    tableElement.classList.remove('focus-management-table');
    tableElement.style.minWidth = `${visibleTableWidth(extraColumns)}px`;
  }

  if (elements.pipelineHeaderRow) {
    elements.pipelineHeaderRow.innerHTML = `
      <th class="select-col">
        <input id="selectPageRows" type="checkbox" aria-label="현재 페이지 전체 선택" />
      </th>
      <th><button data-sort="company" type="button">Company</button></th>
      <th><button data-sort="country" type="button">Country</button></th>
      <th><button data-sort="asset" type="button">Asset</button></th>
      <th><button data-sort="target" type="button">Target / Modality / Theme / Cluster</button></th>
      <th><button data-sort="mainIndication" type="button">Main indication</button></th>
      <th><button data-sort="stage" type="button">Stage</button></th>
      <th><button data-sort="filter1" type="button">Filter 1</button></th>
      <th><button data-sort="filter2" type="button">Filter 2</button></th>
      <th><button data-sort="targetScore" type="button">TR</button></th>
      <th><button data-sort="moaScore" type="button">MOA</button></th>
      <th><button data-sort="dataScore" type="button">Data</button></th>
      <th><button data-sort="competitiveScore" type="button">Comp</button></th>
      <th><button data-sort="platformScore" type="button">Plat</button></th>
      <th><button data-sort="expansionScore" type="button">Exp</button></th>
      <th><button data-sort="marketScore" type="button">Market</button></th>
      <th><button data-sort="totalScore" type="button">Total</button></th>
      ${extraColumns.map((column) => `<th class="extra-column-head"><span title="${escapeHtml(column.path)}">${escapeHtml(column.label)}</span></th>`).join('')}
    `;
    elements.selectPageRows = document.querySelector('#selectPageRows');
  }

  if (elements.pipelineTableHead) {
    elements.pipelineTableHead.innerHTML = `
      <tr id="pipelineHeaderRow" class="pipeline-group-row">
        <th class="select-col" rowspan="2">
          <input id="selectPageRows" type="checkbox" aria-label="현재 페이지 전체 선택" />
        </th>
        <th rowspan="2"><button data-sort="company" type="button">Company</button></th>
        <th rowspan="2"><button data-sort="country" type="button">Country</button></th>
        <th rowspan="2"><button data-sort="asset" type="button">Asset</button></th>
        <th rowspan="2"><button data-sort="target" type="button">Target / Modality / Theme / Cluster</button></th>
        <th rowspan="2"><button data-sort="mainIndication" type="button">Main indication</button></th>
        <th rowspan="2"><button data-sort="stage" type="button">Stage</button></th>
        <th rowspan="2"><button data-sort="filter1" type="button">Filter 1</button></th>
        <th rowspan="2"><button data-sort="filter2" type="button">Filter 2</button></th>
        <th class="score-group-head" colspan="3">Triage Core</th>
        <th class="score-group-head" colspan="5">Full Scout only</th>
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
      </tr>
      <tr class="pipeline-score-row">
        <th><button data-sort="targetScore" type="button">TR</button></th>
        <th><button data-sort="moaScore" type="button">MOA</button></th>
        <th><button data-sort="dataScore" type="button">Data</button></th>
        <th><button data-sort="competitiveScore" type="button">Comp</button></th>
        <th><button data-sort="platformScore" type="button">Plat</button></th>
        <th><button data-sort="expansionScore" type="button">Exp</button></th>
        <th><button data-sort="marketScore" type="button">Market</button></th>
        <th><button data-sort="totalScore" type="button">Total</button></th>
        ${extraColumns.map((column) => `<th class="extra-column-head"><span title="${escapeHtml(column.path)}">${escapeHtml(column.label)}</span></th>`).join('')}
      </tr>
    `;
    elements.pipelineHeaderRow = document.querySelector('#pipelineHeaderRow');
    elements.selectPageRows = document.querySelector('#selectPageRows');
  }
  if (elements.pipelineTableHead) {
    elements.pipelineTableHead.innerHTML = `
      <tr id="pipelineHeaderRow" class="pipeline-group-row">
        <th class="select-col" rowspan="2" ${columnAttrs('select')}>
          <input id="selectPageRows" type="checkbox" aria-label="현재 페이지 전체 선택" />
        </th>
        ${sortableHeader('Company', 'company', 'company', 'rowspan="2"')}
        ${sortableHeader('Country', 'country', 'country', 'rowspan="2"')}
        ${sortableHeader('Asset', 'asset', 'asset', 'rowspan="2"')}
        ${sortableHeader('Target / Modality / Theme / Cluster', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Main indication', 'mainIndication', 'mainIndication', 'rowspan="2"')}
        ${sortableHeader('Stage', 'stage', 'stage', 'rowspan="2"')}
        ${sortableHeader('Filter 1', 'filter1', 'filter1', 'rowspan="2"')}
        ${sortableHeader('Filter 2', 'filter2', 'filter2', 'rowspan="2"')}
        <th class="score-group-head" colspan="3">Triage Core</th>
        <th class="score-group-head" colspan="5">Full Scout only</th>
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
      </tr>
      <tr class="pipeline-score-row">
        ${sortableHeader('TR', 'targetScore', 'targetScore')}
        ${sortableHeader('MOA', 'moaScore', 'moaScore')}
        ${sortableHeader('Data', 'dataScore', 'dataScore')}
        ${sortableHeader('Comp', 'competitiveScore', 'competitiveScore')}
        ${sortableHeader('Plat', 'platformScore', 'platformScore')}
        ${sortableHeader('Exp', 'expansionScore', 'expansionScore')}
        ${sortableHeader('Market', 'marketScore', 'marketScore')}
        ${sortableHeader('Total', 'totalScore', 'totalScore')}
        ${extraColumns.map((column) => plainHeader(column.label, extraColumnKey(column), 'extra-column-head')).join('')}
      </tr>
    `;
    elements.pipelineHeaderRow = document.querySelector('#pipelineHeaderRow');
    elements.selectPageRows = document.querySelector('#selectPageRows');
  }

  elements.tableCount.textContent = `${visibleRows.length} items · ${state.pageSize} rows/page`;
  elements.pipelineTable.innerHTML = pageRows.length
    ? pageRows
        .map((row) => {
          const filter1Class = `pill ${filterToneClass(row.filter1)}`;
          const filter2Class = `pill ${filterToneClass(row.filter2)}`;
          const isSelected = state.selectedIds.has(row.id);
          const checked = isSelected ? 'checked' : '';
          return `
            <tr class="clickable-row${isSelected ? ' selected-row' : ''}" data-record-id="${escapeHtml(row.id)}" title="${escapeHtml(rowHoverTitle(row))}">
              <td class="select-col">
                <input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} 선택" ${checked} />
              </td>
              <td class="company-cell">${escapeHtml(row.company)}</td>
              <td class="country-cell" title="${escapeHtml(row.countryRaw)}">${escapeHtml(row.country)}</td>
              <td class="asset-cell"><strong>${escapeHtml(row.asset)}</strong></td>
              <td class="target-column-cell">
                <div class="target-cell">
                  <strong>${escapeHtml(row.target)}</strong>
                  <span>Modality: ${escapeHtml(row.modality)}</span>
                  <span>Theme: ${escapeHtml(row.theme)}</span>
                  <span>Cluster: ${escapeHtml(row.cluster)}</span>
                </div>
              </td>
              <td class="indication-cell" title="${escapeHtml(row.indication)}">${escapeHtml(row.mainIndication)}</td>
              <td class="stage-cell" title="${escapeHtml(row.stageRaw)}">${escapeHtml(row.stage)}</td>
              <td class="filter-cell"><span class="${filter1Class}">${escapeHtml(row.filter1)}</span></td>
              <td class="filter-cell"><span class="${filter2Class}">${escapeHtml(row.filter2)}</span></td>
              <td class="score-cell">${scoreBadge(row.targetScore, 3, scoreTooltip('Target Relevance', row.criteria.target, 3))}</td>
              <td class="score-cell">${scoreBadge(row.moaScore, 3, scoreTooltip('MOA Validity', row.criteria.moa, 3))}</td>
              <td class="score-cell">${scoreBadge(row.dataScore, 3, scoreTooltip('Data Maturity', row.criteria.data, 3))}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'competitiveScore', 'competitive', 'Competitive Landscape')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'platformScore', 'platform', 'Platform Attractiveness')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'expansionScore', 'expansion', 'Expansion Potential')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'marketScore', 'market', 'Marketability')}</td>
              <td class="score-cell total-score-cell">${row.isTriage ? pendingScoreBadge('Full Scout total score not available for triage rows') : totalScoreEditCircle(row)}</td>
              ${extraColumns.map((column) => {
                const value = formatExtraColumnValue(get(row.raw, column.path, '-'));
                return `<td class="extra-column-cell" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
              }).join('')}
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="${17 + extraColumns.length}" class="empty-cell">조건에 맞는 데이터가 없습니다.</td></tr>`;

  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateSelectionControls(pageRows);
}

function focusActionButton(row, location = 'full') {
  const isTracked = row.focusTracked;
  const action = isTracked ? 'remove' : 'add';
  const ariaLabel = location === 'focus'
    ? '즐겨찾기 해제'
    : isTracked
      ? '즐겨찾기됨 (클릭 시 해제)'
      : '즐겨찾기에 추가';
  return `
    <button
      type="button"
      class="focus-action-button icon-only ${isTracked ? 'remove' : 'add'}"
      data-focus-action="${action}"
      data-record-id="${escapeHtml(row.id)}"
      title="${isTracked ? '즐겨찾기(집중 관리)에서 제거합니다. 작성한 메모는 보존됩니다.' : '이 약물을 즐겨찾기(집중 관리)에 추가합니다.'}"
      aria-label="${escapeHtml(ariaLabel)}"
    >
      <span aria-hidden="true">${isTracked ? '★' : '☆'}</span>
    </button>
  `;
}

function rubricRefreshButton(row) {
  const currentVersion = String(row.criteriaVersion || '-');
  const lastVersion = String(get(row.raw, 'meta.rubric_recalculation.version', ''));
  const isCurrent = lastVersion === LATEST_FULL_SCOUT_RUBRIC_VERSION;
  return `
    <button
      type="button"
      class="focus-action-button icon-only rubric-refresh-button ${isCurrent ? 'is-current' : ''}"
      data-rubric-refresh
      data-record-id="${escapeHtml(row.id)}"
      title="저장된 7개 점수로 최신 Full Scout Rubric v${LATEST_FULL_SCOUT_RUBRIC_VERSION}의 Total Score와 Filter 2를 재계산합니다. 현재 표시 버전: v${escapeHtml(currentVersion)}"
      aria-label="${escapeHtml(row.asset)} 최신 Rubric v${LATEST_FULL_SCOUT_RUBRIC_VERSION} 재계산"
    >
      <span aria-hidden="true">↻</span>
    </button>
  `;
}

function fullScoutRowActions(row) {
  return `
    <div class="full-scout-row-actions">
      ${rubricRefreshButton(row)}
      ${focusActionButton(row, 'full')}
    </div>
  `;
}

function focusDueState(value) {
  if (!value) return '';
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  return value < today ? 'overdue' : value === today ? 'due-today' : '';
}

function renderFocusTable() {
  const visibleRows = getVisibleRows();
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  const tableElement = elements.pipelineTable?.closest('table');

  if (tableElement) {
    tableElement.classList.add('focus-management-table');
    tableElement.style.minWidth = `${visibleTableWidth()}px`;
  }
  if (elements.deleteSelectedButton) elements.deleteSelectedButton.hidden = true;
  if (elements.columnSettingsButton) elements.columnSettingsButton.hidden = true;
  if (elements.pipelineColGroup) {
    elements.pipelineColGroup.innerHTML = `
      <col class="pipeline-col-company" data-col-key="company" style="${columnWidthStyle('company')}" />
      <col class="pipeline-col-country" data-col-key="country" style="${columnWidthStyle('country')}" />
      <col class="pipeline-col-asset" data-col-key="asset" style="${columnWidthStyle('asset')}" />
      <col class="pipeline-col-modality" data-col-key="modality" style="${columnWidthStyle('modality')}" />
      <col class="pipeline-col-target" data-col-key="target" style="${columnWidthStyle('target')}" />
      <col class="pipeline-col-indication" data-col-key="mainIndication" style="${columnWidthStyle('mainIndication')}" />
      <col class="pipeline-col-stage" data-col-key="stage" style="${columnWidthStyle('stage')}" />
      <col class="pipeline-col-filter" data-col-key="filter2" style="${columnWidthStyle('filter2')}" />
      <col class="pipeline-col-score" data-col-key="totalScore" style="${columnWidthStyle('totalScore')}" />
      <col class="pipeline-col-filter" data-col-key="filter3" style="${columnWidthStyle('filter3')}" />
      <col class="pipeline-col-filter" data-col-key="inVivo" style="${columnWidthStyle('inVivo')}" />
      <col class="pipeline-col-filter" data-col-key="inVitro" style="${columnWidthStyle('inVitro')}" />
      <col class="pipeline-col-filter" data-col-key="admet" style="${columnWidthStyle('admet')}" />
      <col data-col-key="focusDueDate" style="${columnWidthStyle('focusDueDate')}" />
      <col data-col-key="focusManage" style="${columnWidthStyle('focusManage')}" />
    `;
  }
  if (elements.pipelineTableHead) {
    elements.pipelineTableHead.innerHTML = `
      <tr id="pipelineHeaderRow" class="pipeline-group-row focus-pipeline-group-row">
        ${sortableHeader('Company', 'company', 'company', 'rowspan="2"')}
        ${sortableHeader('Country', 'country', 'country', 'rowspan="2"')}
        ${sortableHeader('Asset', 'asset', 'asset', 'rowspan="2"')}
        ${sortableHeader('Modality', 'modality', 'modality', 'rowspan="2"')}
        ${sortableHeader('Target', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Main indication', 'mainIndication', 'mainIndication', 'rowspan="2"')}
        ${sortableHeader('Stage', 'stage', 'stage', 'rowspan="2"')}
        <th class="score-group-head focus-group-head" colspan="2">Full Scout</th>
        <th class="score-group-head focus-group-head" colspan="5">집중 관리</th>
        ${plainHeader('관리', 'focusManage', 'focus-action-head', 'rowspan="2"')}
      </tr>
      <tr class="pipeline-score-row focus-column-label-row">
        ${sortableHeader('Filter 2', 'filter2', 'filter2')}
        ${sortableHeader('Total Score', 'focusTotalScore', 'totalScore')}
        ${sortableHeader('Filter 3', 'filter3', 'filter3')}
        ${sortableHeader('In-vivo', 'inVivoStatus', 'inVivo')}
        ${sortableHeader('In-vitro', 'inVitroStatus', 'inVitro')}
        ${sortableHeader('ADMET', 'admetCompleted', 'admet')}
        ${sortableHeader('Action date', 'focusDueDate', 'focusDueDate')}
      </tr>
    `;
    elements.pipelineHeaderRow = document.querySelector('#pipelineHeaderRow');
    elements.selectPageRows = null;
  }

  elements.tableCount.textContent = `집중 관리: ${visibleRows.length} items · ${state.pageSize} rows/page`;
  elements.pipelineTable.innerHTML = pageRows.length
    ? pageRows.map((row) => `
        <tr class="clickable-row focus-management-row" data-record-id="${escapeHtml(row.id)}" title="${escapeHtml(rowHoverTitle(row))}">
          <td class="company-cell">${escapeHtml(row.company)}</td>
          <td class="country-cell" title="${escapeHtml(row.countryRaw)}">${escapeHtml(row.country)}</td>
          <td class="asset-cell"><strong>${escapeHtml(row.asset)}</strong></td>
          <td
            class="modality-column-cell"
            tabindex="0"
            data-target-context
            data-theme="${escapeHtml(row.theme)}"
            data-cluster="${escapeHtml(row.cluster)}"
            data-description="${escapeHtml(row.targetDescription)}"
            aria-label="${escapeHtml(`${row.modality}. Theme ${row.theme}. Cluster ${row.cluster}. Description ${row.targetDescription}`)}"
          >
            <span class="single-line-cell">${escapeHtml(row.modality)}</span>
          </td>
          <td
            class="target-column-cell target-context-cell"
            tabindex="0"
            data-target-context
            data-theme="${escapeHtml(row.theme)}"
            data-cluster="${escapeHtml(row.cluster)}"
            data-description="${escapeHtml(row.targetDescription)}"
            aria-label="${escapeHtml(`${row.target}. Theme ${row.theme}. Cluster ${row.cluster}. Description ${row.targetDescription}`)}"
          >
            <span class="target-single-line">${escapeHtml(row.target)}</span>
            <span class="target-context-indicator" aria-hidden="true">i</span>
          </td>
          <td class="indication-cell" title="${escapeHtml(row.indication)}">${escapeHtml(row.mainIndication)}</td>
          <td class="stage-cell" title="${escapeHtml(row.stageRaw)}">${escapeHtml(row.stage)}</td>
          <td class="filter-cell">${statusEditSelect(row, 'filter2')}</td>
          <td class="score-cell total-score-cell">${scoreBadge(
            row.totalScore,
            row.maxScore,
            `Tab2 Total Score: ${row.totalScore ?? '-'}${hasManualTotalScoreOverride(row.raw) ? ' · Human edited' : ''}`,
            hasManualTotalScoreOverride(row.raw) ? 'is-human' : ''
          )}</td>
          <td class="focus-status-cell">${partnershipEditSelect(row)}</td>
          <td class="focus-status-cell">${evidenceEditSelect(row, 'inVivoStatus', 'inVivoSource', 'In-vivo efficacy')}</td>
          <td class="focus-status-cell">${evidenceEditSelect(row, 'inVitroStatus', 'inVitroSource', 'In-vitro efficacy')}</td>
          <td class="focus-status-cell">${admetEditSelect(row)}</td>
          <td class="focus-due-cell ${focusDueState(row.focusDueDate)}">
            <input
              class="focus-due-input"
              type="date"
              data-record-id="${escapeHtml(row.id)}"
              data-focus-field="due_date"
              data-previous-value="${escapeHtml(row.focusDueDate)}"
              value="${escapeHtml(row.focusDueDate)}"
              aria-label="${escapeHtml(row.asset)} action date"
            />
            ${focusDueState(row.focusDueDate) === 'overdue' ? '<span class="due-label">Overdue</span>' : ''}
            ${focusDueState(row.focusDueDate) === 'due-today' ? '<span class="due-label">Today</span>' : ''}
          </td>
          <td class="focus-action-cell">${focusActionButton(row, 'focus')}</td>
        </tr>
      `).join('')
    : `
      <tr>
        <td colspan="15" class="empty-cell focus-empty-state">
          <strong>아직 집중 관리 중인 약물이 없습니다.</strong>
          <span>TAB2 Full Scout의 오른쪽 ‘즐겨찾기’ 버튼으로 관리 대상을 추가하세요.</span>
        </td>
      </tr>
    `;

  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateFrozenColumnOffsets();
}

function renderTable() {
  hideTargetContextTooltip();
  const mode = activeTableMode();
  if (mode === 'focus') {
    renderFocusTable();
    return;
  }
  if (elements.deleteSelectedButton) elements.deleteSelectedButton.hidden = false;
  if (elements.columnSettingsButton) elements.columnSettingsButton.hidden = false;

  const visibleRows = getVisibleRows();
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  const extraColumns = selectedExtraColumns();
  const filterKey = activeFilterKey();
  const filterLabel = activeFilterLabel();
  const scoreColumns = activeScoreColumnKeys();
  const modeLabel = mode === 'triage' ? 'Fast Triage' : 'Full Scout';
  const scoreLabels = {
    targetScore: 'TR',
    moaScore: 'MOA',
    dataScore: 'Data',
    competitiveScore: 'Comp',
    platformScore: 'Plat',
    expansionScore: 'Exp',
    marketScore: 'Market',
    totalScore: 'Total'
  };

  if (elements.pipelineColGroup) {
    elements.pipelineColGroup.innerHTML = `
      <col class="pipeline-col-select" data-col-key="select" style="${columnWidthStyle('select')}" />
      <col class="pipeline-col-company" data-col-key="company" style="${columnWidthStyle('company')}" />
      <col class="pipeline-col-country" data-col-key="country" style="${columnWidthStyle('country')}" />
      <col class="pipeline-col-asset" data-col-key="asset" style="${columnWidthStyle('asset')}" />
      <col class="pipeline-col-modality" data-col-key="modality" style="${columnWidthStyle('modality')}" />
      <col class="pipeline-col-target" data-col-key="target" style="${columnWidthStyle('target')}" />
      <col class="pipeline-col-indication" data-col-key="mainIndication" style="${columnWidthStyle('mainIndication')}" />
      <col class="pipeline-col-stage" data-col-key="stage" style="${columnWidthStyle('stage')}" />
      <col class="pipeline-col-filter" data-col-key="${filterKey}" style="${columnWidthStyle(filterKey)}" />
      ${scoreColumns.map((key) => `<col class="pipeline-col-score" data-col-key="${escapeHtml(key)}" style="${columnWidthStyle(key)}" />`).join('')}
      ${extraColumns.map((column) => `<col class="pipeline-col-extra" data-col-key="${escapeHtml(extraColumnKey(column))}" style="${columnWidthStyle(extraColumnKey(column))}" />`).join('')}
      ${mode === 'full' ? `<col class="pipeline-col-focus-action" data-col-key="focusAction" style="${columnWidthStyle('focusAction')}" />` : ''}
    `;
  }

  const tableElement = elements.pipelineTable?.closest('table');
  if (tableElement) {
    tableElement.classList.remove('focus-management-table');
    tableElement.style.minWidth = `${visibleTableWidth(extraColumns)}px`;
  }

  if (elements.pipelineTableHead) {
    elements.pipelineTableHead.innerHTML = `
      <tr id="pipelineHeaderRow" class="pipeline-group-row">
        <th class="select-col" rowspan="2" ${columnAttrs('select')}>
          <input id="selectPageRows" type="checkbox" aria-label="Select visible page rows" />
        </th>
        ${sortableHeader('Company', 'company', 'company', 'rowspan="2"')}
        ${sortableHeader('Country', 'country', 'country', 'rowspan="2"')}
        ${sortableHeader('Asset', 'asset', 'asset', 'rowspan="2"')}
        ${sortableHeader('Modality', 'modality', 'modality', 'rowspan="2"')}
        ${sortableHeader('Target', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Main indication', 'mainIndication', 'mainIndication', 'rowspan="2"')}
        ${sortableHeader('Stage', 'stage', 'stage', 'rowspan="2"')}
        ${sortableHeader(filterLabel, filterKey, filterKey, 'rowspan="2"')}
        ${mode === 'triage'
          ? '<th class="score-group-head" colspan="3">Fast Triage Core</th>'
          : '<th class="score-group-head" colspan="3">Triage Core</th><th class="score-group-head" colspan="5">Full Scout only</th>'}
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
        ${mode === 'full' ? plainHeader('관리', 'focusAction', 'focus-action-head', 'rowspan="2"') : ''}
      </tr>
      <tr class="pipeline-score-row">
        ${scoreColumns.map((key) => sortableHeader(scoreLabels[key] || key, key, key)).join('')}
        ${extraColumns.map((column) => plainHeader(column.label, extraColumnKey(column), 'extra-column-head')).join('')}
      </tr>
    `;
    elements.pipelineHeaderRow = document.querySelector('#pipelineHeaderRow');
    elements.selectPageRows = document.querySelector('#selectPageRows');
  }

  elements.tableCount.textContent = `${modeLabel}: ${visibleRows.length} items · ${state.pageSize} rows/page`;
  elements.pipelineTable.innerHTML = pageRows.length
    ? pageRows
        .map((row) => {
          const isSelected = state.selectedIds.has(row.id);
          const checked = isSelected ? 'checked' : '';
          const rowTitle = mode === 'triage'
            ? rowHoverTitle(row, markdownPreviewSnippet(rawMarkdownForRow(row), row.summary))
            : rowHoverTitle(row);
          return `
            <tr
              class="clickable-row${mode === 'triage' ? ' triage-preview-row' : ''}${isSelected ? ' selected-row' : ''}"
              data-record-id="${escapeHtml(row.id)}"
              ${mode === 'triage' ? `title="${escapeHtml(rowTitle)}"` : ''}
            >
              <td class="select-col">
                <input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} select" ${checked} />
              </td>
              <td class="company-cell">${escapeHtml(row.company)}</td>
              <td class="country-cell" title="${escapeHtml(row.countryRaw)}">${escapeHtml(row.country)}</td>
              <td class="asset-cell"><strong>${escapeHtml(row.asset)}</strong></td>
              <td
                class="modality-column-cell"
                tabindex="0"
                data-target-context
                data-theme="${escapeHtml(row.theme)}"
                data-cluster="${escapeHtml(row.cluster)}"
                data-description="${escapeHtml(row.targetDescription)}"
                aria-label="${escapeHtml(`${row.modality}. Theme ${row.theme}. Cluster ${row.cluster}. Description ${row.targetDescription}`)}"
              >
                <span class="single-line-cell">${escapeHtml(row.modality)}</span>
              </td>
              <td
                class="target-column-cell target-context-cell"
                tabindex="0"
                data-target-context
                data-theme="${escapeHtml(row.theme)}"
                data-cluster="${escapeHtml(row.cluster)}"
                data-description="${escapeHtml(row.targetDescription)}"
                aria-label="${escapeHtml(`${row.target}. Theme ${row.theme}. Cluster ${row.cluster}. Description ${row.targetDescription}`)}"
              >
                <span class="target-single-line">${escapeHtml(row.target)}</span>
                <span class="target-context-indicator" aria-hidden="true">i</span>
              </td>
              <td class="indication-cell" title="${escapeHtml(row.indication)}">${escapeHtml(row.mainIndication)}</td>
              <td class="stage-cell" title="${escapeHtml(row.stageRaw)}">${escapeHtml(row.stage)}</td>
              <td class="filter-cell">${statusEditSelect(row, filterKey)}</td>
              <td class="score-cell">${mode === 'full'
                ? scoreEditSelect(row, 'targetScore', 'target_relevance', 'Target Relevance')
                : scoreBadge(row.targetScore, 3, scoreTooltip('Target Relevance', row.criteria.target, 3))}</td>
              <td class="score-cell">${mode === 'full'
                ? scoreEditSelect(row, 'moaScore', 'moa_validity', 'MOA Validity')
                : scoreBadge(row.moaScore, 3, scoreTooltip('MOA Validity', row.criteria.moa, 3))}</td>
              <td class="score-cell">${mode === 'full'
                ? scoreEditSelect(row, 'dataScore', 'data_maturity', 'Data Maturity')
                : scoreBadge(row.dataScore, 3, scoreTooltip('Data Maturity', row.criteria.data, 3))}</td>
              ${mode === 'full' ? `
                <td class="score-cell">${scoreEditSelect(row, 'competitiveScore', 'competitive_landscape', 'Competitive Landscape')}</td>
                <td class="score-cell">${scoreEditSelect(row, 'platformScore', 'platform_attractiveness', 'Platform Attractiveness')}</td>
                <td class="score-cell">${scoreEditSelect(row, 'expansionScore', 'expansion_potential', 'Expansion Potential')}</td>
                <td class="score-cell">${scoreEditSelect(row, 'marketScore', 'marketability', 'Marketability')}</td>
                <td class="score-cell total-score-cell">${totalScoreEditCircle(row)}</td>
              ` : ''}
              ${extraColumns.map((column) => {
                const value = formatExtraColumnValue(get(row.raw, column.path, '-'));
                return `<td class="extra-column-cell" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
              }).join('')}
              ${mode === 'full' ? `<td class="focus-action-cell">${fullScoutRowActions(row)}</td>` : ''}
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="${9 + scoreColumns.length + extraColumns.length + (mode === 'full' ? 1 : 0)}" class="empty-cell">No matching ${modeLabel} rows.</td></tr>`;

  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateSelectionControls(pageRows);
  updateFrozenColumnOffsets();
}

function updateSelectionControls(pageRows = null) {
  const visibleRows = pageRows || getVisibleRows().slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
  const selectedCount = state.selectedIds.size;
  if (elements.deleteSelectedButton) {
    elements.deleteSelectedButton.disabled = selectedCount === 0;
    elements.deleteSelectedButton.textContent = selectedCount ? `선택 삭제 (${selectedCount})` : '선택 삭제';
  }
  if (elements.selectPageRows) {
    const selectableIds = visibleRows.map((row) => row.id);
    const checkedCount = selectableIds.filter((id) => state.selectedIds.has(id)).length;
    elements.selectPageRows.checked = selectableIds.length > 0 && checkedCount === selectableIds.length;
    elements.selectPageRows.indeterminate = checkedCount > 0 && checkedCount < selectableIds.length;
    elements.selectPageRows.disabled = selectableIds.length === 0;
  }
}

async function deleteSelectedRecords() {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  const confirmed = window.confirm(`${ids.length}개 record를 삭제할까요? 이 작업은 json/pipeline-records.json에서 해당 데이터를 제거합니다.`);
  if (!confirmed) return;

  elements.dataStatus.textContent = 'Deleting';
  try {
    const response = await fetch(`${API_URL}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    state.selectedIds.clear();
    elements.dataStatus.textContent = `${result.deleted} records deleted`;
    await loadRecords();
  } catch (error) {
    elements.dataStatus.textContent = 'Delete failed';
    elements.saveStatus.textContent = error.message;
  }
}

function renderTableTabs() {
  if (elements.focusTabCount) {
    elements.focusTabCount.textContent = String(state.rows.filter((row) => !row.isTriage && row.focusTracked).length);
  }
  elements.pipelineTableTabs?.forEach((tab) => {
    const isActive = tab.dataset.tableMode === activeTableMode();
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
  });
}

function render() {
  if (elements.pageSizeSelect) elements.pageSizeSelect.value = String(state.pageSize);
  renderTableTabs();
  renderMetrics();
  renderCharts();
  renderColumnSettings();
  renderTable();
}

function csvValue(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function scoreExportFields(row, key) {
  const item = row.criteria[key] || {};
  const sources = (item.evidenceSources || [])
    .map((source) => `${source.source_title || ''}${source.source_url ? ` ${source.source_url}` : ''}`.trim())
    .filter(Boolean)
    .join(' | ');
  return [
    item.score ?? '',
    item.evidenceType || '',
    item.evidenceTypeReason || '',
    item.rule || '',
    item.ruleLabel || '',
    item.appliedScoreDefinition || item.ruleCriteria || '',
    item.mainLineSummary || item.reason || '',
    item.whyNotHigher || '',
    item.decisionSummary || item.mainLineSummary || '',
    (item.keyJudgmentFactors || []).join(' | '),
    item.supportingEvidenceSummary || '',
    (item.conflictingOrMissingEvidence || []).join(' | '),
    item.confidence || '',
    sources
  ];
}

function exportPipelineTable() {
  const rows = getVisibleRows();
  const extraColumns = selectedExtraColumns();
  const headers = [
    'Company',
    'Country',
    'Asset',
    'Target',
    'Theme',
    'Cluster',
    'Main Indication',
    'Stage',
    'Indication',
    'Modality',
    'Filter 1',
    'Filter 2',
    'Target Relevance Score',
    'Target Relevance Evidence Type',
    'Target Relevance Evidence Type Reason',
    'Target Relevance Rule',
    'Target Relevance Rule Label',
    'Target Relevance Applied Criteria',
    'Target Relevance Reason',
    'Target Relevance Why Not Higher',
    'Target Relevance Decision Summary',
    'Target Relevance Key Factors',
    'Target Relevance Evidence Summary',
    'Target Relevance Missing Evidence',
    'Target Relevance Confidence',
    'Target Relevance Sources',
    'Competitive Score',
    'Competitive Evidence Type',
    'Competitive Evidence Type Reason',
    'Competitive Rule',
    'Competitive Rule Label',
    'Competitive Applied Criteria',
    'Competitive Reason',
    'Competitive Why Not Higher',
    'Competitive Decision Summary',
    'Competitive Key Factors',
    'Competitive Evidence Summary',
    'Competitive Missing Evidence',
    'Competitive Confidence',
    'Competitive Sources',
    'MOA Score',
    'MOA Evidence Type',
    'MOA Evidence Type Reason',
    'MOA Rule',
    'MOA Rule Label',
    'MOA Applied Criteria',
    'MOA Reason',
    'MOA Why Not Higher',
    'MOA Decision Summary',
    'MOA Key Factors',
    'MOA Evidence Summary',
    'MOA Missing Evidence',
    'MOA Confidence',
    'MOA Sources',
    'Platform Score',
    'Platform Evidence Type',
    'Platform Evidence Type Reason',
    'Platform Rule',
    'Platform Rule Label',
    'Platform Applied Criteria',
    'Platform Reason',
    'Platform Why Not Higher',
    'Platform Decision Summary',
    'Platform Key Factors',
    'Platform Evidence Summary',
    'Platform Missing Evidence',
    'Platform Confidence',
    'Platform Sources',
    'Expansion Score',
    'Expansion Evidence Type',
    'Expansion Evidence Type Reason',
    'Expansion Rule',
    'Expansion Rule Label',
    'Expansion Applied Criteria',
    'Expansion Reason',
    'Expansion Why Not Higher',
    'Expansion Decision Summary',
    'Expansion Key Factors',
    'Expansion Evidence Summary',
    'Expansion Missing Evidence',
    'Expansion Confidence',
    'Expansion Sources',
    'Data Score',
    'Data Evidence Type',
    'Data Evidence Type Reason',
    'Data Rule',
    'Data Rule Label',
    'Data Applied Criteria',
    'Data Reason',
    'Data Why Not Higher',
    'Data Decision Summary',
    'Data Key Factors',
    'Data Evidence Summary',
    'Data Missing Evidence',
    'Data Confidence',
    'Data Sources',
    'Market Score',
    'Market Evidence Type',
    'Market Evidence Type Reason',
    'Market Rule',
    'Market Rule Label',
    'Market Applied Criteria',
    'Market Reason',
    'Market Why Not Higher',
    'Market Decision Summary',
    'Market Key Factors',
    'Market Evidence Summary',
    'Market Missing Evidence',
    'Market Confidence',
    'Market Sources',
    'Total Score',
    'Max Score',
    'Similar Pipeline Count',
    'High Similarity Count',
    'One Line Summary',
    'Record ID',
    ...extraColumns.map((column) => column.label)
  ];

  const body = rows.map((row) => [
    row.company,
    row.country,
    row.asset,
    row.target,
    row.theme,
    row.cluster,
    row.mainIndication,
    row.stage,
    row.indication,
    row.modality,
    row.filter1,
    row.filter2,
    ...scoreExportFields(row, 'target'),
    ...scoreExportFields(row, 'competitive'),
    ...scoreExportFields(row, 'moa'),
    ...scoreExportFields(row, 'platform'),
    ...scoreExportFields(row, 'expansion'),
    ...scoreExportFields(row, 'data'),
    ...scoreExportFields(row, 'market'),
    row.totalScore ?? '',
    row.maxScore ?? '',
    row.similarPipelineCount ?? '',
    row.highSimilarityCount ?? '',
    row.summary,
    row.id,
    ...extraColumns.map((column) => formatExtraColumnValue(get(row.raw, column.path, '-')))
  ]);

  const csv = [headers, ...body].map((line) => line.map(csvValue).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const link = document.createElement('a');
  link.href = url;
  link.download = `skbp_pipeline_table_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  elements.dataStatus.textContent = `${rows.length} rows exported`;
}

async function loadRecords() {
  elements.dataStatus.textContent = 'Loading';
  await loadCategorySynonyms();
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  state.rawRecords = Array.isArray(data.records) ? data.records : [];
  state.rows = state.rawRecords.map(flattenRecord);
  const availableIds = new Set(state.rows.map((row) => row.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => availableIds.has(id)));
  state.page = 1;
  renderFilters();
  render();
  elements.dataStatus.textContent = `${state.rows.length} records loaded`;
  elements.agentContextCount.textContent = `${state.rows.length} pipelines`;
}

async function saveManualReviewEdit(select) {
  const recordId = select.dataset.recordId;
  const kind = select.dataset.editKind;
  const previousValue = select.dataset.previousValue;
  if (kind === 'total_score' && select.value.trim() === '') {
    select.value = previousValue;
    elements.dataStatus.textContent = 'Total Score는 0~21 정수로 입력해주세요';
    return;
  }
  const value = ['score', 'total_score'].includes(kind) ? Number(select.value) : select.value;
  if (!recordId || !['status', 'score', 'total_score'].includes(kind)) return;
  const actorName = await ensureDashboardReviewerIdentity();
  if (!actorName) {
    select.value = previousValue;
    elements.dataStatus.textContent = '수정자 ID 입력이 취소되어 변경하지 않았습니다';
    return;
  }

  const payload = {
    kind,
    value,
    actor_name: actorName,
    previous_value: ['score', 'total_score'].includes(kind) && previousValue !== ''
      ? Number(previousValue)
      : previousValue
  };
  if (kind === 'score') payload.criterion = select.dataset.criterion;

  select.disabled = true;
  select.classList.add('is-saving');
  elements.dataStatus.textContent = 'Saving human review';

  try {
    const response = await fetch(`/api/records/${encodeURIComponent(recordId)}/manual-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);

    const rowIndex = state.rows.findIndex((row) => row.id === recordId);
    if (rowIndex >= 0 && data.record) {
      state.rawRecords[rowIndex] = data.record;
      state.rows = state.rawRecords.map(flattenRecord);
    }
    renderFilters();
    render();
    elements.dataStatus.textContent = 'Human review saved';
  } catch (error) {
    select.value = previousValue;
    select.disabled = false;
    select.classList.remove('is-saving');
    elements.dataStatus.textContent = `Human review save failed: ${error.message}`;
  }
}

function replaceRecordFromApi(recordId, record) {
  const rowIndex = state.rows.findIndex((row) => row.id === recordId);
  if (rowIndex < 0 || !record) return;
  state.rawRecords[rowIndex] = record;
  state.rows = state.rawRecords.map(flattenRecord);
}

async function recalculateLatestRubric(button) {
  const recordId = button?.dataset.recordId;
  if (!recordId) return;
  button.disabled = true;
  button.classList.add('is-saving');
  elements.dataStatus.textContent = `Rubric v${LATEST_FULL_SCOUT_RUBRIC_VERSION} 재계산 중`;

  try {
    const response = await fetch(
      `/api/records/${encodeURIComponent(recordId)}/recalculate-rubric`,
      { method: 'POST' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    replaceRecordFromApi(recordId, data.record);
    renderFilters();
    render();
    elements.dataStatus.textContent = `Recalculated by Full Scout Rubric v${data.rubric_version || LATEST_FULL_SCOUT_RUBRIC_VERSION}`;
  } catch (error) {
    button.disabled = false;
    button.classList.remove('is-saving');
    elements.dataStatus.textContent = `Rubric 재계산 실패: ${error.message}`;
  }
}

async function performFocusManagementSave(recordId, payload, control = null) {
  if (!recordId) return false;
  const actorName = getDashboardReviewerIdentity();
  if (actorName && !payload.actor_name) payload = { ...payload, actor_name: actorName };
  if (control) {
    control.disabled = true;
    control.classList.add('is-saving');
  }
  elements.dataStatus.textContent = 'Saving TAB3';

  try {
    const response = await fetch(`/api/records/${encodeURIComponent(recordId)}/focus-management`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    replaceRecordFromApi(recordId, data.record);
    if (payload.action === 'update') {
      if (control) {
        control.disabled = false;
        control.classList.remove('is-saving');
        control.dataset.previousValue = String(payload.value ?? '');
      }
      if (payload.field === 'due_date' && control) {
        const cell = control.closest('.focus-due-cell');
        const stateClass = focusDueState(String(payload.value || ''));
        cell?.classList.toggle('overdue', stateClass === 'overdue');
        cell?.classList.toggle('due-today', stateClass === 'due-today');
        cell?.querySelector('.due-label')?.remove();
        if (stateClass && cell) {
          cell.insertAdjacentHTML('beforeend', `<span class="due-label">${stateClass === 'overdue' ? 'Overdue' : 'Today'}</span>`);
        }
      }
      renderTableTabs();
      renderTable();
    } else {
      renderFilters();
      render();
    }
    elements.dataStatus.textContent = payload.action === 'add'
      ? 'TAB3에 추가했습니다'
      : payload.action === 'remove'
        ? 'TAB3에서 제거했습니다'
        : 'TAB3 내용을 저장했습니다';
    return true;
  } catch (error) {
    if (control) {
      control.disabled = false;
      control.classList.remove('is-saving');
    }
    elements.dataStatus.textContent = `TAB3 저장 실패: ${error.message}`;
    return false;
  }
}

function saveFocusManagement(recordId, payload, control = null) {
  const previous = focusSaveQueues.get(recordId) || Promise.resolve();
  const next = previous
    .catch(() => false)
    .then(() => performFocusManagementSave(recordId, payload, control));
  focusSaveQueues.set(recordId, next);
  next.finally(() => {
    if (focusSaveQueues.get(recordId) === next) focusSaveQueues.delete(recordId);
  });
  return next;
}

function openAiDrawer() {
  elements.aiDrawer.hidden = false;
  elements.aiBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.aiDrawer.classList.add('open');
    elements.aiBackdrop.classList.add('open');
    elements.aiDrawer.setAttribute('aria-hidden', 'false');
    elements.agentInput.focus();
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

function setupResizableDrawer(drawer, storageKey, defaultWidth = 520) {
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
  triage: 'TAB1 · Fast Triage (SELECT/REJECT/N/A)',
  full: 'TAB2 · Full Scout (PASS/REVIEW/FAIL)',
  focus: 'TAB3 · 집중 관리 (OI Partnership Type)'
};

function updateCriteriaDrawerScope() {
  const mode = activeTableMode();
  if (elements.criteriaDrawerScopeLabel) {
    elements.criteriaDrawerScopeLabel.textContent = CRITERIA_DRAWER_SCOPE_LABELS[mode] || '';
  }
  document.querySelectorAll('[data-criteria-tab]').forEach((section) => {
    const scopes = section.dataset.criteriaTab.split(' ');
    section.hidden = !scopes.includes(mode);
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

function rawMarkdownForRow(row) {
  const markdown = row?.raw?.source_report?.raw_markdown;
  return String(markdown || '').trim();
}

function markdownPreviewSnippet(markdown, fallback = '') {
  const compactSource = String(markdown || fallback || '')
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^```/.test(trimmed)) return false;
      if (/^\|/.test(trimmed)) return false;
      if (/^[-=_]{3,}$/.test(trimmed)) return false;
      const withoutMarkdown = trimmed
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/^[-*]\s+/, '')
        .replace(/[*_`>#]/g, '')
        .trim();
      return Boolean(withoutMarkdown && withoutMarkdown !== '-');
    })
    .join(' ');
  const text = compactSource
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 520 ? `${text.slice(0, 520)}...` : text;
}

function renderAgentInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderAgentMarkdownTable(lines, startIndex) {
  const tableLines = [];
  let index = startIndex;
  while (index < lines.length && lines[index].trim().startsWith('|')) {
    tableLines.push(lines[index].trim());
    index += 1;
  }

  const rows = tableLines
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
  if (!rows.length) return { html: '', nextIndex: index };

  const [head, ...body] = rows;
  const header = `<thead><tr>${head.map((cell) => `<th>${renderAgentInlineMarkdown(cell)}</th>`).join('')}</tr></thead>`;
  const bodyHtml = `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderAgentInlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return {
    html: `<div class="agent-md-table-wrap"><table class="agent-md-table">${header}${bodyHtml}</table></div>`,
    nextIndex: index,
  };
}

function renderAgentText(text) {
  const lines = String(text || '').split('\n');
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(`<pre><span>${escapeHtml(language || 'code')}</span><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (line.startsWith('|')) {
      const table = renderAgentMarkdownTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(`<h4>${renderAgentInlineMarkdown(line.slice(4))}</h4>`);
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(`<h3>${renderAgentInlineMarkdown(line.slice(3))}</h3>`);
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(`<h3>${renderAgentInlineMarkdown(line.slice(2))}</h3>`);
      continue;
    }
    if (line.startsWith('>')) {
      blocks.push(`<blockquote>${renderAgentInlineMarkdown(line.replace(/^>\s*/, ''))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderAgentInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      index -= 1;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderAgentInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      index -= 1;
      continue;
    }

    blocks.push(`<p>${renderAgentInlineMarkdown(line)}</p>`);
  }

  return blocks.join('');
}

function sourceLabel(path) {
  return String(path || '')
    .split('/')
    .pop()
    .replace(/\.md$/i, '')
    .replaceAll('_', ' ');
}

function renderAgentSources(sources = []) {
  if (!Array.isArray(sources) || !sources.length) return '';
  const chips = sources.slice(0, 5).map((source) => {
    const path = escapeHtml(source.path || '');
    const label = escapeHtml(sourceLabel(source.path));
    const score = escapeHtml(source.score ?? '');
    return `<a class="agent-source-chip" href="/wiki-view?path=${encodeURIComponent(source.path || '')}" target="_blank" rel="noreferrer">${label}<span>${score}</span></a>`;
  }).join('');
  return `<div class="agent-sources"><span>Wiki sources</span>${chips}</div>`;
}

function createAgentMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createAgentSession(title = '새 대화') {
  const now = new Date().toISOString();
  return {
    id: `session_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createAgentMessageId(),
        role: 'assistant',
        text: '대시보드 JSON과 skbp_pipeline_wiki note를 자동으로 검색해 답변합니다. 후보 비교, shortlist, evidence gap, 경쟁 리스크를 질문해보세요.',
        sources: [],
        createdAt: now,
        status: 'done'
      }
    ]
  };
}

function loadAgentSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_SESSION_STORAGE_KEY) || '[]');
    state.agentSessions = Array.isArray(parsed) ? parsed.filter((session) => session && session.id) : [];
  } catch {
    state.agentSessions = [];
  }
  if (!state.agentSessions.length) {
    state.agentSessions = [createAgentSession('Pipeline discovery')];
  }
  if (!state.agentSessions.some((session) => session.id === state.activeAgentSessionId)) {
    state.activeAgentSessionId = state.agentSessions[0].id;
  }
  saveAgentSessions();
}

function saveAgentSessions() {
  const trimmed = state.agentSessions
    .slice(-12)
    .map((session) => ({
      ...session,
      messages: (session.messages || []).slice(-60)
    }));
  state.agentSessions = trimmed;
  localStorage.setItem(AGENT_SESSION_STORAGE_KEY, JSON.stringify(trimmed));
  localStorage.setItem(AGENT_ACTIVE_SESSION_KEY, state.activeAgentSessionId);
}

function activeAgentSession() {
  return state.agentSessions.find((session) => session.id === state.activeAgentSessionId) || state.agentSessions[0];
}

function updateAgentSessionMessage(message) {
  const session = activeAgentSession();
  if (!session) return;
  const index = (session.messages || []).findIndex((item) => item.id === message.id);
  if (index >= 0) {
    session.messages[index] = { ...session.messages[index], ...message };
  } else {
    session.messages = [...(session.messages || []), message];
  }
  session.updatedAt = new Date().toISOString();
  saveAgentSessions();
  renderAgentSessionControls();
}

function sessionTitleFromQuestion(question) {
  const compact = String(question || '').replace(/\s+/g, ' ').trim();
  return compact.length > 34 ? `${compact.slice(0, 34)}...` : compact || '새 대화';
}

function renderAgentSessionControls() {
  if (!elements.agentSessionSelect) return;
  elements.agentSessionSelect.innerHTML = state.agentSessions
    .map((session) => {
      const count = Math.max(0, (session.messages || []).filter((message) => message.role === 'user').length);
      return `<option value="${escapeHtml(session.id)}">${escapeHtml(session.title || '새 대화')} · ${count}Q</option>`;
    })
    .join('');
  elements.agentSessionSelect.value = state.activeAgentSessionId;
  if (elements.agentDeleteSessionButton) {
    elements.agentDeleteSessionButton.disabled = state.agentSessions.length <= 1;
  }
}

function renderAgentMessagesFromSession() {
  const session = activeAgentSession();
  if (!session || !elements.agentMessages) return;
  elements.agentMessages.innerHTML = '';
  (session.messages || []).forEach((message) => {
    addAgentMessage(message.role, message.text, {
      messageId: message.id,
      sources: message.sources || [],
      pending: message.status === 'pending',
      persist: false
    });
  });
}

function initializeAgentSessions() {
  loadAgentSessions();
  renderAgentSessionControls();
  renderAgentMessagesFromSession();
}

function startNewAgentSession(title = '새 대화') {
  const session = createAgentSession(title);
  state.agentSessions.push(session);
  state.activeAgentSessionId = session.id;
  saveAgentSessions();
  renderAgentSessionControls();
  renderAgentMessagesFromSession();
  elements.agentInput?.focus();
}

function deleteActiveAgentSession() {
  if (state.agentSessions.length <= 1) return;
  const current = activeAgentSession();
  const confirmed = window.confirm(`'${current?.title || '현재 대화'}' 세션을 삭제할까요?`);
  if (!confirmed) return;
  state.agentSessions = state.agentSessions.filter((session) => session.id !== state.activeAgentSessionId);
  state.activeAgentSessionId = state.agentSessions[0]?.id || '';
  saveAgentSessions();
  renderAgentSessionControls();
  renderAgentMessagesFromSession();
}

function retitleActiveSessionFromQuestion(question) {
  const session = activeAgentSession();
  if (!session) return;
  const userQuestionCount = (session.messages || []).filter((message) => message.role === 'user').length;
  if (userQuestionCount === 0 || /^새 대화|Pipeline discovery$/i.test(session.title || '')) {
    session.title = sessionTitleFromQuestion(question);
    session.updatedAt = new Date().toISOString();
    saveAgentSessions();
    renderAgentSessionControls();
  }
}

function addAgentMessage(role, text, options = {}) {
  const bubble = document.createElement('div');
  bubble.className = `agent-message ${role}`;
  if (options.pending) bubble.classList.add('pending');
  const messageId = options.messageId || createAgentMessageId();
  bubble.dataset.messageId = messageId;
  bubble.innerHTML = `
    <div class="agent-message-meta">
      <strong>${role === 'user' ? 'You' : 'Pipeline Agent'}</strong>
      ${role === 'assistant' ? '<span>JSON + Wiki retrieval</span>' : ''}
    </div>
    <div class="agent-message-text">${renderAgentText(text)}</div>
    ${renderAgentSources(options.sources)}
  `;
  elements.agentMessages.appendChild(bubble);
  elements.agentMessages.scrollTop = elements.agentMessages.scrollHeight;
  if (options.persist !== false) {
    updateAgentSessionMessage({
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

function updateAgentMessage(bubble, text, options = {}) {
  const textNode = bubble.querySelector('.agent-message-text');
  if (textNode) textNode.innerHTML = renderAgentText(text);
  if (options.done) bubble.classList.remove('pending');
  if (options.sources) {
    bubble.querySelector('.agent-sources')?.remove();
    bubble.insertAdjacentHTML('beforeend', renderAgentSources(options.sources));
  }
  if (bubble.dataset.messageId) {
    updateAgentSessionMessage({
      id: bubble.dataset.messageId,
      role: bubble.classList.contains('user') ? 'user' : 'assistant',
      text,
      sources: options.sources || undefined,
      status: options.done ? 'done' : (bubble.classList.contains('pending') ? 'pending' : 'done')
    });
  }
  elements.agentMessages.scrollTop = elements.agentMessages.scrollHeight;
}

function mockAgentReply(question) {
  const visibleRows = getVisibleRows();
  const topRows = [...visibleRows]
    .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))
    .slice(0, 3);
  const summary = topRows
    .map((row) => `- ${row.asset} (${row.company}, ${row.country}): ${row.totalScore}/${row.maxScore}, ${row.theme}, ${row.cluster}`)
    .join('\n');

  return [
    `Mock search query: "${question}"`,
    '',
    'Dashboard context에서 우선 볼 후보:',
    summary || '- 현재 필터 조건에 맞는 후보가 없습니다.',
    '',
    'Obsidian mock: 관련 note alias/tags를 확인하고, Agentic Search mock은 target, modality, front runner, marketability 근거를 보강하는 흐름으로 구성됩니다.'
  ].join('\n');
}

function buildDashboardAgentContext() {
  const visibleRows = getVisibleRows();
  const topRows = [...visibleRows]
    .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))
    .slice(0, 5);
  const summary = topRows
    .map((row) => [
      `- ${row.asset} (${row.company}, ${row.country})`,
      `theme=${row.theme}`,
      `cluster=${row.cluster}`,
      `stage=${row.stage}`,
      `scores=${row.totalScore}/${row.maxScore}`,
      `TR=${row.targetScore}`,
      `Data=${row.dataScore}`,
      `Market=${row.marketScore}`,
      `filter1=${row.filter1}`,
      `filter2=${row.filter2}`
    ].join('; '))
    .join('\n');

  return [
    'Dashboard visible pipeline context:',
    summary || '- No candidates match the current filters.',
    '',
    'Answer as a SKBP Pipeline Finder dashboard agent. Compare assets using the visible dashboard context and the selected anchor asset JSON context. If source evidence is missing, say what evidence is missing.'
  ].join('\n');
}

function getAgentAnchorRecordId(question = '') {
  const visibleRows = getVisibleRows();
  const lowerQuestion = question.toLowerCase();
  if (lowerQuestion.includes('e/i') || lowerQuestion.includes('excitation') || lowerQuestion.includes('inhibition')) {
    const eiRow = visibleRows
      .filter((row) => String(row.theme).toLowerCase().includes('e/i'))
      .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))[0];
    if (eiRow) return eiRow.id;
  }
  if (lowerQuestion.includes('neuroimmune')) {
    const neuroimmuneRow = visibleRows
      .filter((row) => String(row.theme).toLowerCase().includes('neuroimmune'))
      .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))[0];
    if (neuroimmuneRow) return neuroimmuneRow.id;
  }

  const selectedVisibleRow = visibleRows.find((row) => state.selectedIds.has(row.id));
  if (selectedVisibleRow) return selectedVisibleRow.id;

  const topVisibleRow = [...visibleRows]
    .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))[0];
  return topVisibleRow?.id || state.rows[0]?.id || null;
}

async function requestDashboardAgentReply(question) {
  const recordId = getAgentAnchorRecordId(question);
  if (!recordId) {
    return '분석할 pipeline JSON이 없습니다. 먼저 json 폴더에 데이터를 추가해 주세요.';
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      record_id: recordId,
      message: question,
      dashboard_context: buildDashboardAgentContext(),
      allow_draft: false
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'chat failed');
  return data;
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

async function streamDashboardAgentReply(question, bubble) {
  const recordId = getAgentAnchorRecordId(question);
  if (!recordId) {
    updateAgentMessage(bubble, '분석할 pipeline JSON이 없습니다. 먼저 json 폴더에 데이터를 추가해 주세요.', { done: true });
    return;
  }

  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      record_id: recordId,
      message: question,
      dashboard_context: buildDashboardAgentContext(),
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
      updateAgentMessage(bubble, text || '관련 wiki note를 찾았습니다. 답변을 생성 중입니다...', { sources });
    }
    if (parsed.event === 'status' && !text) {
      updateAgentMessage(bubble, parsed.data?.message || '답변 생성 중입니다...', { sources });
    }
    if (parsed.event === 'delta') {
      text += parsed.data?.text || '';
      updateAgentMessage(bubble, text, { sources });
    }
    if (parsed.event === 'done') {
      completed = true;
      updateAgentMessage(bubble, text || '답변이 비어 있습니다. 다시 질문해 주세요.', { done: true, sources });
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      handleSseBlock(block);
    }
  }

  if (buffer.trim()) handleSseBlock(buffer);
  if (!completed) updateAgentMessage(bubble, text || '답변이 비어 있습니다. 다시 질문해 주세요.', { done: true, sources });
}

async function previewPastedReportParsing() {
  const rawText = elements.rawReportInput.value.trim();
  const jsonText = elements.structuredJsonInput.value.trim();
  if (!rawText && !jsonText) {
    elements.saveStatus.textContent = '붙여넣을 원문 또는 JSON이 없습니다.';
    return;
  }

  const headingCount = (rawText.match(/^#{1,3}\s+/gm) || []).length;
  const tableCount = (rawText.match(/^\|.+\|$/gm) || []).length;
  const hasScore = /(\d+)\s*\/\s*21|Total|Score|점수/i.test(rawText);
  const hasMarketabilitySteps = /A\.\s*TAP|B\.\s*Unrisked|C\.\s*Obtainable/i.test(rawText);
  let jsonStatus = 'JSON 없음';

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const validCount = records.filter((record) => record && typeof record === 'object' && record.structured_table).length;
      jsonStatus = `JSON valid · ${validCount}/${records.length} records`;
    } catch (error) {
      jsonStatus = `JSON error · ${error.message}`;
    }
  }

  elements.saveStatus.textContent = `원문 headings ${headingCount}, tables ${tableCount}, score ${hasScore ? 'OK' : 'missing'}, A/B/C ${hasMarketabilitySteps ? 'OK' : 'missing'} · ${jsonStatus}`;
}

async function saveStructuredJsonInput() {
  const rawText = elements.rawReportInput.value.trim();
  const jsonText = elements.structuredJsonInput.value.trim();
  if (!jsonText) {
    elements.saveStatus.textContent = '저장할 JSON이 없습니다.';
    return;
  }

  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    elements.saveStatus.textContent = `JSON 파싱 실패: ${error.message}`;
    return;
  }

  const records = Array.isArray(payload) ? payload : [payload];
  for (const record of records) {
    if (!record || typeof record !== 'object' || !record.structured_table) {
      elements.saveStatus.textContent = '저장 실패: 각 record에는 structured_table이 필요합니다.';
      return;
    }
    if (rawText) {
      const existingSourceReport = record.source_report && typeof record.source_report === 'object' ? record.source_report : {};
      const existingRaw = existingSourceReport.raw_markdown;
      record.source_report = {
        ...existingSourceReport,
        raw_markdown: isPlaceholderRawMarkdown(existingRaw) ? rawText : rawText || existingRaw,
        source_format: existingSourceReport.source_format || 'gpt_markdown_report',
        parser_status: existingSourceReport.parser_status || 'manual_json_paste',
        parser_note: existingSourceReport.parser_note || 'Dashboard input panel에서 원문과 JSON을 함께 붙여넣어 저장함.'
      };
    }
  }

  elements.saveStatus.textContent = '저장 중...';
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.isArray(payload) ? records : records[0])
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }
    const result = await response.json();
    elements.saveStatus.textContent = `저장 완료 · inserted ${result.inserted}, updated ${result.updated}, total ${result.total}`;
    elements.structuredJsonInput.value = JSON.stringify(Array.isArray(payload) ? records : records[0], null, 2);
    await loadRecords();
  } catch (error) {
    elements.saveStatus.textContent = `저장 실패: ${error.message}`;
  }
}

function buildTriageInstructionPrompt() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Run FAST TRIAGE on biotech/pharma pipeline assets. The purpose is to decide which assets should proceed to the full SKBP Pipeline Finder v3.1 in-depth review.

This is GPT instruction 1: Fast Triage v3.1.
Use GPT instruction 2 only after a candidate receives SELECT and needs full SKBP v3.1 review.

Core rule:
- Do not create a full scout report.
- Do not evaluate all 7 SKBP criteria.
- Do not build a full competitive landscape table.
- Do not calculate marketability.
- Do not estimate peak sales.
- Do not perform full diligence.
- Only perform quick source-aware triage.

Important distinction:
- Triage status is not a final SKBP v3.1 recommendation.
- SELECT means worth sending to Full Scout v3.1.
- REJECT means not worth full review based on current quick evidence.
- N/A means asset identity cannot be verified as a biotech/pharma pipeline asset from public sources.
- A REJECT or N/A can change later if the user provides better target, MoA, data, company, or source evidence.

Input:
The user may provide structured rows copied from Excel/TSV/CSV/plain text or a simple asset list.
Each entry may include asset name, target, MoA, company, therapeutic area, indication, development stage, region/country, notes, and source URL.
The input may contain 1 to 50 entries. If more than 50 entries are provided, process only the first 50 and state this in the markdown block.

Parsing rules:
- Parse each entry as one candidate asset.
- Preserve row order.
- If the same asset appears multiple times with different indications or regions, keep separate rows and add a duplicate/related-row note.
- If a field is missing, write "Unknown".
- If a source URL is not provided, write "source_url_not_provided".
- Do not ask the user to reformat unless the entries are impossible to parse.

Research rules:
- If structured fields are provided, use them as the starting point.
- If only an asset name or sparse list is provided, perform only a quick public-source identity check.
- Search only enough to support triage.
- Prefer credible biotech/pharma source types: official company/pipeline page, clinical trial registry, regulatory source, peer-reviewed publication, reputable biotech news, company presentation, or patent/source clearly linking asset to target/indication.
- Do not invent facts or URLs.
- If public search results are ambiguous, choose the lower score and explain uncertainty.
- If search results are unrelated SKUs, tools, electronics, finance tickers, or ambiguous non-drug references, classify as N/A.

Early stop rules:
- Apply N/A before scoring if the candidate cannot be verified as a biotech/pharma pipeline asset, or if company/target/indication cannot be credibly linked after a quick identity check. Do not continue deep searching.
- Apply REJECT before scoring if the development stage is Discontinued / inactive, terminated, withdrawn, suspended, dormant, or clearly failed. This means the pipeline is not an active review candidate.
- For N/A or Discontinued / inactive cases, keep the markdown and JSON short. Do not perform full diligence, marketability, competitor landscaping, or extended source chasing.

Triage scoring:
- Use the same scoring direction as Full Scout v3.1, but only for these three matching criteria:
  - Full Scout criterion 1: Target Relevance (TR)
  - Full Scout criterion 3: MoA Validity (MOA)
  - Full Scout criterion 6: Data Maturity (Data)
- Assign preliminary integer scores only: 0, 1, 2, or 3. Do not output ranges such as 1-2.
- Do not assign E0-E4 evidence types, do not write why_not_higher, and do not require full source trails.
- The difference from GPT instruction 2 is depth, not scoring direction: instruction 1 is a fast preliminary read; instruction 2 is the full evidence-based review.
- Quick interpretation:
  - 0 = unclear / not assessable / out of scope
  - 1 = weak or sparse
  - 2 = plausible enough to consider
  - 3 = strong fit or clearly visible maturity

Triage status rule:
- SELECT if asset identity is verified and at least two of TR/MOA/Data are >= 2.
- REJECT if asset identity is verified but SKBP fit, MoA, or Data is too weak for Full Scout priority.
- REJECT if development_stage is Discontinued / inactive, terminated, withdrawn, suspended, dormant, or clearly failed, even if target/MoA look interesting.
- N/A if asset identity is not verified as a biotech/pharma pipeline asset.
- If unsure between SELECT and REJECT, choose REJECT and explain the missing evidence needed.

Controlled vocabulary:
- For an identity-verified asset, use Unknown (never N/A) when country, development stage, modality, main indication, target, or another factual field cannot be established from public sources. N/A is reserved for the triage status when asset identity itself is not verified.
- company_country must use canonical values such as China, Republic of Korea, Japan, United States, Europe/UK, Taiwan, Singapore, Canada, Australia, Israel, or Unknown.
- development_stage must use one canonical bucket when possible: Hit discovery, Lead Selection, Lead Optimization, IND-enabling, IND, Phase 1, Phase 1/2, Phase 2, Phase 2/3, Phase 3, Registration, Approved / marketed, Discontinued / inactive, or Unknown.
- modality_platform must use exactly one short dashboard label: Small molecule, Peptide, RNA therapy, Cell therapy, Gene therapy, Antibody, Protein biologic, Other, or Unknown.
- main_indication must use one canonical disease bucket when possible: Alzheimer's disease, Parkinson's disease, Epilepsy / seizure disorders, Multiple sclerosis / neuroinflammatory disease, Amyotrophic lateral sclerosis / motor neuron disease, Frontotemporal dementia, Stroke, Pain, Major depressive disorder, Chronic cough, Inflammatory bowel disease, Systemic lupus erythematosus / autoimmune disease, or Unknown.
- For theme and cluster only: use N/A for both fields when an identity-verified asset is confirmed not to fit an SKBP interest theme/cluster. Use Unknown for both fields when target or MoA evidence is insufficient to map the asset. Do not use No Theme.

Output language:
Korean. English is allowed for scientific terms.

Final output format:
The final answer must contain exactly two fenced code blocks:

\`\`\`markdown
# SKBP Fast Triage Result

중요: 한 문장으로 triage 결론과 filter rationale을 먼저 씁니다. 예: 공개 자료상 asset identity는 확인되지만 개발 단계가 Discontinued / inactive로 확인되어 REJECT로 처리합니다.

| # | Asset | Company | Target/MoA | Main indication | Stage | Country | TR | MOA | Data | Triage | Why | Source |
|---:|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| 1 |  |  |  |  |  |  |  |  |  | SELECT/REJECT/N/A |  |  |

## Notes
- Keep notes short.
- Mention only source uncertainty, duplicate rows, or reason to run Full Scout.
\`\`\`

\`\`\`json
[
  {
    "meta": {
      "schema_version": "3.1",
      "rubric_version": "3.1",
      "review_type": "fast_triage",
      "generated_at": "YYYY-MM-DD",
      "language": "ko",
      "output_filename_base": "Company_Asset_fast_triage_YYYYMMDD"
    },
    "input": {
      "company_input": "",
      "asset_input": "",
      "source_type": "fast triage",
      "notes": ""
    },
    "source_report": {
      "raw_markdown": "",
      "source_format": "fast_triage_markdown",
      "parser_status": "fast_triage",
      "parser_note": "GPT instruction 1 Fast Triage v3.1 output. Full SKBP v3.1 review has not been run."
    },
    "json_summary": {
      "company": "",
      "asset_name": "",
      "target": "",
      "theme": "E/I Balance | Neuroimmune | N/A | Unknown",
      "cluster": "",
      "target_relevance_score": 0,
      "one_line_summary": "",
      "company_country": ""
    },
    "structured_table": {
      "company": "",
      "asset_name": "",
      "target": "",
      "moa": "",
      "modality_platform": "Unknown",
      "main_indication": "",
      "indication": "",
      "development_stage": "",
      "company_country": "",
      "sources": [
        {
          "source_title": "",
          "source_type": "official_company | publication | clinical_trial_registry | regulatory | news | patent | source_url_not_provided | other",
          "source_url": "",
          "reliability": "high | medium | low | unknown",
          "evidence_summary": ""
        }
      ]
    },
    "hard_filter": {
      "status": "SELECT | REJECT | N/A",
      "reason": "",
      "flags": []
    },
    "triage": {
      "instruction_version": "3.1",
      "status": "SELECT | REJECT | N/A",
      "identity_verified": true,
      "why": "",
      "missing_evidence_needed_for_full_scout": []
    },
    "scoring": {
      "total_score": null,
      "max_score": 21,
      "criteria": {
        "target_relevance": {
          "score": 0,
          "evidence_type": "triage_only",
          "main_line_summary": "",
          "evidence_sources": [],
          "uncertain_points": []
        },
        "moa_validity": {
          "score": 0,
          "evidence_type": "triage_only",
          "main_line_summary": "",
          "evidence_sources": [],
          "uncertain_points": []
        },
        "data_maturity": {
          "score": 0,
          "evidence_type": "triage_only",
          "main_line_summary": "",
          "evidence_sources": [],
          "uncertain_points": []
        }
      }
    },
    "validation": {
      "cross_checked_facts": [],
      "uncertain_points": [],
      "source_registry": []
    },
    "final_insight": {
      "one_line_summary": "",
      "recommendation": "Run Full Scout | Do not run Full Scout | N/A",
      "most_important_diligence_question": ""
    }
  }
]
\`\`\`

Remember:
- Output only the two fenced code blocks.
- Do not include prose outside the code blocks.
- For one input entry, output a JSON array with one object.
- Do not include full v3.1 criteria, marketability, competitor tables, or peak sales.`;
}

function buildGptInstructionPrompt() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Find and evaluate a pipeline asset by doing the full workflow: company research, source verification, competitor search, SKBP scoring, and evidence tracking. The final answer must include two copyable boxes: first a complete Markdown file code block, then a valid JSON code block that follows the SKBP JSON schema.

This is GPT instruction 2: Full Scout v3.2.

Company: [COMPANY_NAME]
Asset / drug / pipeline name: [ASSET_NAME]
Output language: Korean. English is allowed for scientific terms.

Identity Gate / N-A early stop:
- Before writing the full report, first verify whether the input appears to be a real biotech/pharma pipeline asset.
- Use only a short identity check at this gate. Check for at least one credible biotech source type: official company/pipeline page, clinical trial registry, regulatory source, peer-reviewed publication, reputable biotech news, company presentation, patent/source that clearly links the asset to a drug target or indication.
- If the asset cannot be linked to a biotech/pharma company, drug target, modality, indication, or credible pipeline source, stop early. Do not write the full report sections, do not score, do not build competitor tables, and do not estimate marketability.
- If search results are mostly unrelated SKUs, tools, electronics, finance tickers, unrelated abbreviations, or ambiguous non-drug references, classify as N/A unless a credible drug-development source is found.
- In the N/A case, the final answer must still be exactly two fenced code blocks, but both must be short.
- N/A markdown block format:
  - Title: "# N/A Pipeline Scout Result: **[ASSET_NAME]**"
  - One-line conclusion: "Public-source identity check did not verify this as a biotech/pharma pipeline asset."
  - Include only 3 short bullets: what was searched, what was found, what source would be needed to proceed.
  - Include references only for the few sources that explain the non-match or ambiguity.
- N/A JSON block format:
  - Keep it valid JSON.
  - Set meta.schema_version and meta.rubric_version to "3.2".
  - Set source_report.parser_status to "asset_identity_not_verified".
  - Set hard_filter.status to "FAIL".
  - Set hard_filter.reason to "Asset identity not verified from public biotech/pharma sources."
  - Set scoring.total_score to 0 and scoring.max_score to 21.
  - Set final_insight.recommendation to "Deprioritize".
  - Use "N/A" or null for unknown company, target, indication, stage, country, and source URLs. Do not invent placeholders.

Non-negotiable rules:
1. Final answer format must be exactly two fenced code blocks:
   - Box 1: \`\`\`markdown containing either the complete .md report or the short N/A markdown block allowed by the Identity Gate.
   - Box 2: \`\`\`json containing either the complete structured JSON or the short N/A JSON block allowed by the Identity Gate.
2. Do not write the Markdown report as normal prose outside the markdown code block.
3. The final JSON block must be valid JSON: no comments, no trailing commas, no Markdown inside the JSON except string values.
4. Every factual claim used for scoring must include a source URL or a clear uncertainty note.
5. Include actual URLs in Markdown reference-link format at the end of the markdown block, and also include source URLs inside the JSON evidence fields.
6. Distinguish official company sources, peer-reviewed papers, regulatory/clinical trial sources, market sources, and news/financing sources.
7. For every score, include: score, one-line judgment, what was checked, evidence trail, investigation note, uncertain points, and source URLs.
8. Competitive Landscape must include competitor drugs/assets with company, modality, target/MoA, stage/status, why it matters, similarity level, and source.
9. Marketability must show A. TAP, B. Unrisked Peak Sales, and C. Obtainable Peak Sales in both the markdown report and JSON.
10. Express every sales output in million USD. In JSON, store sales values as numeric million USD values, not raw USD. Example: USD 1.2B should be 1200.
11. Hard Filter must use this rule: PASS if Total >= 14, Target Relevance >= 3, MoA Validity >= 2, Data Maturity >= 2, and no hard blocker. REVIEW if Total 9-13, or score is high but stage / rights / asset identity / source uncertainty exists. FAIL if Total <= 8, Target Relevance <= 1, or no SKBP Theme / Cluster fit.
12. If the latest stage, ownership, financing, or trial status is unclear, mark it as uncertain and state what source is needed.
13. Do not invent URLs. If a URL cannot be verified, write null in JSON and describe the missing source in uncertain_points.
14. For scoring.criteria.marketability.calculation.commercial_rationale_status, use exactly one of: evidence_based, assumption_based, assumption_based_scenario, established, not_established, or insufficient_evidence. Use not_established or insufficient_evidence only when marketability.score is 0; then set commercial_rationale_failure_reason and leave the A/B/C output values null. For assumption_based_scenario, also provide commercial_rationale_basis. Do not invent other status values.

Scoring v3.2 rules:
- Each scoring criterion must be scored independently using its own criterion-specific scoring table.
- Do not apply a universal scoring rule across all criteria.
- For every criterion, assign exactly one integer score: 0, 1, 2, or 3.
- For every criterion, assign exactly one Evidence Type:
  - E0_not_found_or_not_assessable
  - E1_company_claim_or_scientific_rationale_only
  - E2_indirect_or_class_level_evidence
  - E3_asset_specific_preclinical_or_technical_evidence
  - E4_asset_specific_clinical_evidence
- Explain why the selected score is appropriate.
- Explain why the score was not one point higher in why_not_higher.
- Clearly distinguish company claims, indirect/class-level evidence, and asset-specific evidence.
- Do not output score ranges such as 0-1, 1-2, or 2-3.
- If evidence is ambiguous, select the single closest score and explain uncertainty in uncertain_points.

Controlled vocabulary for dashboard filters:
- Use canonical values for filter-facing fields so the dashboard can group comparable assets.
- For an identity-verified asset, use Unknown (never N/A) when country, development stage, modality, main indication, target, or another factual field cannot be established from public sources.
- N/A is reserved for an Identity Gate failure, except for Theme and Cluster: use N/A for both only when an identity-verified asset is confirmed not to fit an SKBP interest theme/cluster. Use Unknown for both when target or MoA evidence is insufficient to map the asset. Do not use No Theme.
- json_summary.company_country and structured_table.company_country must use a single canonical country/region label. Examples: China, Republic of Korea, United States, Japan, Europe/UK. Do not write combined labels such as "China / Hong Kong" or "China / United States operations" in these fields; put that nuance in headquarters, company_profile.notes, or validation.uncertain_points.
- structured_table.main_indication is required and must contain one canonical disease bucket. structured_table.indication can contain the full detailed indication wording.
- If the asset has many indications, choose the lead/currently most relevant indication as main_indication and keep the rest in indication.
- structured_table.development_stage must use one canonical stage bucket for dashboard filtering. Put detailed wording such as recruiting status, indication-specific stages, or expected IND timing in source evidence, notes, or validation.uncertain_points.
- Standard development stage buckets include: Hit discovery, Lead Selection, Lead Optimization, IND-enabling, IND, Phase 1, Phase 1/2, Phase 2, Phase 2/3, Phase 3, Registration, Approved / marketed, Discontinued / inactive.
- Map stage synonyms into the same bucket. Examples: P1, Ph1, Phase I, FIH, first-in-human, Phase 1 SAD/MAD, and 1상 -> Phase 1; P2, Ph2, Phase II, Phase 2 recruiting, and 2상 -> Phase 2; preclinical / IND preparation -> IND-enabling when IND-enabling work is explicitly described.
- structured_table.modality_platform must use exactly one short dashboard label: Small molecule, Peptide, RNA therapy, Cell therapy, Gene therapy, Antibody, Protein biologic, Other, or Unknown. Put technical platform detail in structured_table.moa, company_profile.platform_summary, or source evidence; do not combine multiple labels in modality_platform.
- Standard indication buckets include:
  - Alzheimer's disease
  - Parkinson's disease
  - Epilepsy / seizure disorders
  - Amyotrophic lateral sclerosis / motor neuron disease
  - Frontotemporal dementia
  - Huntington's disease
  - Chronic cough
  - Multiple sclerosis / neuroinflammatory disease
  - Inflammatory bowel disease
  - Major depressive disorder
  - Schizophrenia / psychosis
  - Bipolar disorder
  - Anxiety disorders
  - Autism spectrum disorder
  - ADHD
  - Migraine / headache disorders
  - Pain
  - Stroke
- Map synonymous or narrower terms into the same bucket. Examples: partial-onset seizure, focal-onset seizure, epilepsy, and status epilepticus -> Epilepsy / seizure disorders; RCC, UCC, refractory chronic cough, and unexplained chronic cough -> Chronic cough; Crohn's disease and ulcerative colitis -> Inflammatory bowel disease.

Expected final answer shape:

\`\`\`markdown
# [Company] Pipeline Scout Report: **[Asset]**
...complete report...
\`\`\`

\`\`\`json
{
  "meta": {
    "schema_version": "3.2"
  }
}
\`\`\`

If the Identity Gate returns N/A:
- Return short N/A markdown + valid compact N/A JSON only.
- In JSON, set source_report.parser_status = "asset_identity_not_verified", hard_filter.status = "FAIL", scoring.total_score = 0, scoring.max_score = 21, final_insight.recommendation = "Deprioritize".
- Use "N/A", null, or [] for unknown company, target, indication, stage, country, sources, and unavailable fields.
- Keep only the sources needed to explain the non-match or ambiguity.

Use this exact report structure inside the markdown code block:

# [Company] Pipeline Scout Report: **[Asset]**

 Briefly state that this report is prepared for SKBP Pipeline Finder v3.2 and that URLs are included for auditability.

중요: 한 문장으로 filter/recommendation rationale을 먼저 씁니다. 예: 공개 자료상 active asset명·compound code·임상 단계가 명확히 확인되지 않아 stage/ownership은 uncertain / REVIEW로 처리합니다.

---

## 1) Company Profile

| Field | Content | Evidence |
|---|---|---|
| Company |  | Official company site URL |
| Legal name / aliases |  | Official company site or registry |
| Country |  | Official company site / company profile |
| Headquarters |  | Official company site / company profile |
| Website |  | URL |
| Company type / stage | private/public, biotech stage | company page, financing, news |
| Focus areas |  | official company description |
| Platform summary |  | platform page / publication |
| Financing / partnership signals |  | press release / investor news |
| Lead pipeline summary |  | official pipeline page |

---

## 2) Pipeline Snapshot

| Field | Content | Evidence |
|---|---|---|
| Company |  | URL or source title |
| Lead asset |  | URL or source title |
| Target |  | URL or source title |
| Theme / Cluster | Theme: ___ / Cluster: ___ | internal SKBP mapping + source used |
| MoA |  | publication / company page URL |
| Modality / Platform |  | platform page URL |
| Indication |  | pipeline page URL |
| Stage |  | official pipeline page, clinical trial registry, company deck, or uncertainty note |
| Key data |  | paper / abstract / poster / company page URL |

Allowed Theme values:
- E/I Balance
- Neuroimmune
- N/A (identity-verified asset confirmed outside SKBP Theme/Cluster scope)
- Unknown (target or MoA evidence insufficient to map)

Allowed clusters:
- E/I Balance: Ion Channel, Inhibitory Tone 강화, Synaptic Transmission, Chloride Homeostasis, Network Modulation
- Neuroimmune: CNS 손상 면역반응, 교세포 향상성, Cytokine 신경조절, 손상/질환 면역조절, 말초 면역기관 연결

---

## 3) Scorecard Summary

| Criterion | Score | One-line judgment | Evidence used |
|---|---:|---|---|
| Target Relevance |  / 3 |  | URL/source |
| Competitive Landscape |  / 3 |  | URL/source |
| MoA Validity |  / 3 |  | URL/source |
| Platform Attractiveness |  / 3 |  | URL/source |
| Expansion Potential |  / 3 |  | URL/source |
| Data Maturity |  / 3 |  | URL/source |
| Marketability |  / 3 | Must mention A/B/C | URL/source |
| **Total** | ** / 21** |  |  |

---

## 4) Criterion Detail Pages

### 4.1 Target Relevance
Score:
Main line:

What was checked:
- Target identity
- Disease/biology relevance
- SKBP Theme / Cluster fit
- General neurodegeneration / neuroinflammation / epilepsy relevance

Evidence trail:
- Include specific facts and URLs.

Investigation note:
- Explain why this score was selected instead of adjacent scores.

### 4.2 Competitive Landscape
Score:
Main line:

What was checked:
- Same disease competitors
- Same target competitors
- Same or similar MoA competitors
- Front runner count
- Approved / Phase 3 / clinical / preclinical status

Competitor table:

| Competitor | Company | Modality | Target / MoA | Stage | Why it matters | Source |
|---|---|---|---|---|---|---|

Investigation note:
- Start from same disease and biology, then separate true same-MoA front runners from broader indication competitors.

### 4.3 MoA Validity
Score:
Main line:

What was checked:
- Journal publication / PMID / DOI
- Mechanistic consistency
- Functional readout
- Disease linkage
- Safety-relevant signal

Evidence trail:
- Cite exact paper, abstract, company page, or source URL.

Investigation note:
- 2점 이상이면 publication or equivalent technical evidence must be visible.

### 4.4 Platform Attractiveness
Score:
Main line:

What was checked:
- Is the platform real and reproducible?
- Is differentiation supported by data?
- Does modality fit SKBP priorities?
- Preferred modalities: small molecule, ASO, siRNA
- Secondary modalities: AOC, antibody, biologic

Evidence trail:
- Cite platform page, paper, patent, data page, or company technical material.

Investigation note:
- 2점 이상이면 the data supporting differentiation must be explicit.

Platform vs Data Maturity separation:
- Platform Attractiveness evaluates platform-level technical advantage and may use evidence from other assets officially linked to the same platform.
- Data Maturity evaluates only the assessed asset's stage-appropriate development evidence.
- A 2-point Platform score requires at least one quantitative experimental result directly testing the claimed technical advantage against an appropriate comparator.
- A 3-point Platform score requires First Patient Dosed for an asset officially linked to the platform. Before clinical dosing, 3 points require repeated quantitative advantage across multiple conditions plus credible external validation.
- IND clearance, trial registration, financing, patent, MOU, or partnership announcement alone is insufficient for 3 points.
- The same endpoint must not be double-counted in Platform Attractiveness and Data Maturity.

### 4.5 Expansion Potential
Score:
Main line:

What was checked:
- Expansion beyond main indication
- Same biology/platform reuse
- Adjacent indications
- Multiple assets from same platform

Evidence trail:
- Cite pipeline page, platform page, company deck, publication, or press release.

Investigation note:
- Adjacent indication means outside the main indication, not merely a different wording of the same disease.

### 4.6 Data Maturity
Score:
Main line:

What was checked:
- In vitro data
- In vivo data
- Quantitative result
- Reproducibility
- IND-enabling / GLP tox / PK/PD / CMC / human data availability

Evidence trail:
- Cite publication, abstract, poster, company data page, or trial registry.

Investigation note:
- This score should be driven by preclinical experimental evidence, not market excitement.
- Data Maturity must be based only on asset-specific, stage-appropriate evidence; platform-wide or other-asset data must not increase this score.

### 4.7 Marketability
Score:
Main line:

What was checked:
- Targetable addressable patient
- Unrisked peak sales
- Competition haircut
- Pricing power adjustment
- Expansion capacity adjustment

Worksheet:

| Step | What to fill | Evidence / assumption |
|---|---|---|
| A. TAP | Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate | patient/epidemiology source URL |
| B. Unrisked Peak Sales | TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor; output in million USD | pricing source, penetration/share assumption |
| Entry-order matrix | 3-player example: 1st ~50%, 2nd ~30%, 3rd ~20% | competitor count and likely entry order |
| C. Obtainable Peak Sales | Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment; output in million USD | competition/price/expansion evidence |
| Final score basis | 0 < weak market, 1 < USD 1,000M obtainable, 2 >= USD 1,000M, 3 >= USD 2,000M + high expansion | final judgment |

Investigation note:
- Marketability is based on obtainable peak sales, not rNPV.
- Always show TAP -> Unrisked Peak Sales -> Obtainable Peak Sales.
- All sales outputs must be in million USD.

---

## 5) Validation Notes

Cross-checked facts:
- Include facts checked against more than one source where possible.

Uncertain points:
- Include exact missing source or source type needed.

Search log:
- Official company page:
- Pipeline page:
- Platform page:
- Publications:
- Regulatory / trial registry:
- Competitor sources:
- Market / epidemiology sources:
- Financing / partnership sources:

---

## 6) Final Take

One-line summary:

Recommendation:
- Shortlist / Watch / Deprioritize

Most important diligence question:

---

## References

Use Markdown reference links:
[1]: https://example.com "Source title"

End the markdown code block after References.

After the markdown code block, output the second copyable box as a JSON code block. Fill it with the same facts, scores, reasons, source URLs, competitor evidence, and marketability A/B/C assumptions used in the Markdown report. The user will paste the markdown block into the dashboard's left input box and the JSON block into the dashboard's right input box.

\`\`\`json
{
  "meta": {
    "schema_version": "3.2",
    "generated_at": "YYYY-MM-DD",
    "language": "ko",
    "analyst_role": "[OIT] PreC Pipeline Shortlister",
    "output_format": ["markdown_report", "json"],
    "output_filename_base": "Company_Asset_YYYYMMDD",
    "rubric_version": "3.2",
    "rubric_author": "kate"
  },
  "input": {
    "company_input": "[COMPANY_NAME]",
    "asset_input": "[ASSET_NAME]",
    "source_text": null,
    "source_type": "web research",
    "notes": "GPT generated Markdown report + structured JSON for SKBP Pipeline Finder"
  },
  "source_report": {
    "raw_markdown": "",
    "source_format": "gpt_markdown_report",
    "parser_status": "gpt_structured_output",
    "parser_note": "Markdown report and JSON were generated together from the same evidence set."
  },
  "company_profile": {
    "company_name": "",
    "legal_name": "",
    "aliases": [],
    "country": "",
    "headquarters": "",
    "website": "",
    "company_stage": "",
    "ownership_status": "",
    "focus_areas": [],
    "platform_summary": "",
    "lead_pipeline_summary": "",
    "financing_or_partnership_signals": [],
    "official_source_urls": [],
    "notes": ""
  },
  "json_summary": {
    "company": "",
    "asset_name": "",
    "target": "",
    "theme": "E/I Balance | Neuroimmune | N/A | Unknown",
    "cluster": "",
    "target_relevance_score": 0,
    "one_line_summary": "",
    "company_country": ""
  },
  "structured_table": {
    "company": "",
    "asset_name": "",
    "target": "",
    "moa": "",
    "modality_platform": "",
    "main_indication": "",
    "indication": "",
    "development_stage": "",
    "company_country": "",
    "sources": [
      {
        "source_title": "",
        "source_type": "official_company | publication | clinical_trial_registry | market | news | other",
        "source_url": "",
        "reliability": "high | medium | low",
        "evidence_summary": ""
      }
    ]
  },
  "hard_filter": {
    "status": "PASS | FAIL | REVIEW",
    "reason": "",
    "flags": []
  },
  "scoring": {
    "total_score": 0,
    "max_score": 21,
    "criteria": {
      "target_relevance": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "main_line_summary": "",
        "what_was_checked": [],
        "evidence_trail": [],
        "evidence_sources": [],
        "investigation_note": "",
        "why_not_higher": "",
        "uncertain_points": []
      },
      "competitive_landscape": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "main_line_summary": "",
        "what_was_checked": [],
        "evidence_trail": [],
        "evidence_sources": [],
        "investigation_note": "",
        "why_not_higher": "",
        "uncertain_points": []
      },
      "moa_validity": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "main_line_summary": "",
        "what_was_checked": [],
        "evidence_trail": [],
        "evidence_sources": [],
        "investigation_note": "",
        "why_not_higher": "",
        "uncertain_points": []
      },
      "platform_attractiveness": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "main_line_summary": "",
        "what_was_checked": [],
        "evidence_trail": [],
        "evidence_sources": [],
        "investigation_note": "",
        "why_not_higher": "",
        "uncertain_points": []
      },
      "expansion_potential": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "main_line_summary": "",
        "what_was_checked": [],
        "evidence_trail": [],
        "evidence_sources": [],
        "investigation_note": "",
        "why_not_higher": "",
        "uncertain_points": []
      },
      "data_maturity": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "main_line_summary": "",
        "what_was_checked": [],
        "evidence_trail": [],
        "evidence_sources": [],
        "investigation_note": "",
        "why_not_higher": "",
        "claimed_development_stage": "",
        "expected_data_for_stage": [],
        "visible_asset_specific_data": [],
        "missing_data": [],
        "stage_data_alignment_judgment": "",
        "uncertain_points": []
      },
      "marketability": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "main_line_summary": "Must explicitly summarize A. TAP, B. Unrisked Peak Sales, and C. Obtainable Peak Sales.",
        "what_was_checked": ["TAP", "Unrisked Peak Sales", "Entry-order share assumption", "Competition haircut", "Pricing power", "Expansion capacity"],
        "calculation": {
          "commercial_rationale_status": "established",
          "commercial_rationale_failure_reason": null,
          "A_targetable_addressable_patient": {
            "total_patient_pool": null,
            "diagnosis_rate": null,
            "eligibility_rate": null,
            "biomarker_positive_rate": null,
            "treatable_subgroup_rate": null,
            "formula": "TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate",
            "targetable_addressable_patient": null,
            "evidence_sources": []
          },
          "B_unrisked_peak_sales": {
            "tap": null,
            "annual_net_price": null,
            "peak_penetration": null,
            "treatment_duration_factor": null,
            "sales_unit": "million USD",
            "entry_order_share_assumption": {
              "competitor_count": null,
              "expected_entry_order": null,
              "matrix_share_reference": ""
            },
            "formula": "Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor; output in million USD",
            "unrisked_peak_sales": null,
            "evidence_sources": []
          },
          "C_obtainable_peak_sales": {
            "unrisked_peak_sales": null,
            "competition_haircut": null,
            "pricing_power_adjustment": null,
            "expansion_capacity_adjustment": null,
            "sales_unit": "million USD",
            "formula": "Obtainable Peak Sales = Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment; output in million USD",
            "obtainable_peak_sales": null,
            "evidence_sources": []
          }
        },
        "evidence_trail": [],
        "evidence_sources": [],
        "investigation_note": "",
        "why_not_higher": "",
        "uncertain_points": []
      }
    }
  },
  "competitive_analysis": {
    "similarity_summary": {
      "similar_pipeline_count": 0,
      "high_similarity_count": 0,
      "medium_similarity_count": 0,
      "low_similarity_count": 0,
      "summary": ""
    },
    "competitor_table": [
      {
        "competitor_asset": "",
        "company": "",
        "modality": "",
        "target_or_moa": "",
        "stage": "",
        "similarity_level": "high | medium | low",
        "why_it_matters": "",
        "source_url": ""
      }
    ],
    "similar_pipelines": []
  },
  "validation": {
    "cross_checked_facts": [],
    "uncertain_points": [],
    "source_registry": []
  },
  "final_insight": {
    "one_line_summary": "",
    "recommendation": "Shortlist | Watch | Deprioritize",
    "most_important_diligence_question": ""
  },
  "obsidian": {
    "note_title": "Company Asset",
    "tags": ["pipeline", "skbp"],
    "aliases": []
  }
}
\`\`\``;
}

function buildGptInstructionPromptCompact() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Run Full Scout v3.2 for one biotech/pharma pipeline asset. Produce exactly two fenced code blocks: first markdown, second JSON. Output language: Korean, with English allowed for scientific terms.

Input:
Company: [COMPANY_NAME]
Asset / pipeline: [ASSET_NAME]

Identity Gate:
- First verify whether this is a real biotech/pharma pipeline asset using credible public sources.
- Acceptable sources: official company/pipeline page, clinical trial registry, regulatory source, peer-reviewed paper, company deck/presentation, reputable biotech news, patent/source linking asset to target or indication.
- If asset identity cannot be linked to company + target/MoA + indication/source, stop early as N/A. Do not score, do not build competitor landscape, do not estimate marketability.

Required output:
1. Markdown code block with the report.
2. JSON code block with the same facts, scores, URLs, rationale, and marketability assumptions.
3. No prose outside the two code blocks.
4. JSON must be valid: no comments, no trailing commas.

Markdown report structure:
# [Company] Pipeline Scout Report: **[Asset]**
중요: Start with one sentence explaining the filter/recommendation rationale, e.g. why PASS / REVIEW / FAIL or why stage/ownership/source uncertainty matters.

## 1) Company Profile
Company, legal name/aliases, country, HQ, website, company type/stage, focus areas, platform, financing/partnership, lead pipeline summary.

## 2) Pipeline Snapshot
Company, asset, target, Theme / Cluster, MoA, modality/platform, indication, stage, key data.

## 3) Scorecard Summary
Table: Target Relevance, Competitive Landscape, MoA Validity, Platform Attractiveness, Expansion Potential, Data Maturity, Marketability, Total.

## 4) Criterion Details
For each criterion include: Score, Evidence Type, Main line, What was checked, Evidence trail, Investigation note, Why not higher, Uncertain points, Source URLs.

## 5) Validation Notes
Cross-checked facts, uncertain points, search log.

## 6) Final Take
One-line summary, recommendation, most important diligence question.

## References
Use Markdown reference links with actual URLs.

Scoring v3.2:
- Score each criterion independently as one integer: 0, 1, 2, or 3. No ranges.
- Evidence Type must be one of:
  E0_not_found_or_not_assessable
  E1_company_claim_or_scientific_rationale_only
  E2_indirect_or_class_level_evidence
  E3_asset_specific_preclinical_or_technical_evidence
  E4_asset_specific_clinical_evidence
- PASS: Total >= 14, Target Relevance >= 3, MoA >= 2, Data Maturity >= 2, and no hard blocker.
- REVIEW: Total 9-13, or score looks high but stage / rights / asset identity / source uncertainty remains.
- FAIL: Total <= 8, or Target Relevance <= 1, or no SKBP Theme / Cluster fit.

Criterion intent:
1. Target Relevance: target/disease biology fit to SKBP E/I Balance or Neuroimmune theme. Direct target-level fit matters more than broad CNS label.
2. Competitive Landscape: same indication, same target/MoA competitors, front-runners, differentiation, similarity level.
3. MoA Validity: biological plausibility, functional evidence, class validation, asset-specific validation, human PoC if available.
4. Platform Attractiveness: modality/platform fit, reproducibility, differentiation, data support. Preferred: small molecule, ASO, siRNA.
5. Expansion Potential: adjacent indications, same biology/platform reuse, follow-on pipeline logic.
6. Data Maturity: stage-appropriate asset-specific evidence. Preclinical needs experimental readout; clinical needs safety/efficacy/biomarker evidence.
7. Marketability: show A/B/C and score by obtainable peak sales: 0 weak/not calculable, 1 < USD 1,000M, 2 >= USD 1,000M, 3 >= USD 2,000M plus strong expansion/pricing/differentiation.

Marketability A/B/C:
A. TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate
B. Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor
C. Obtainable Peak Sales = Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment
Sales output unit = million USD. Store JSON sales numbers as numeric million USD values.

Controlled vocabulary for dashboard:
- For an identity-verified asset, use Unknown (never N/A) when country, development stage, modality, main indication, target, or another factual field cannot be established from public sources. N/A is reserved for identity-gate failure, except that Theme and Cluster are both N/A when the asset is confirmed outside SKBP scope.
- company_country: use one canonical label such as China, Republic of Korea, United States, Japan, Europe/UK, Taiwan, Singapore, Canada, Australia, Israel, or Unknown.
- development_stage: Hit discovery, Lead Selection, Lead Optimization, IND-enabling, IND, Phase 1, Phase 1/2, Phase 2, Phase 2/3, Phase 3, Registration, Approved / marketed, Discontinued / inactive, or Unknown.
- modality_platform: Small molecule, Peptide, RNA therapy, Cell therapy, Gene therapy, Antibody, Protein biologic, Other, or Unknown.
- Map synonyms: P1/Ph1/FIH/Phase I -> Phase 1; P2/Ph2/Phase II -> Phase 2; preclinical/IND prep -> IND-enabling when appropriate.
- main_indication: use one canonical disease bucket; put detailed wording in indication.

N/A output:
If identity gate fails, output short markdown and short JSON only. Set source_report.parser_status = "asset_identity_not_verified", hard_filter.status = "FAIL", scoring.total_score = 0, final_insight.recommendation = "Deprioritize".

JSON requirements:
Use this top-level shape and fill all fields. Use [] for missing lists and ""/null for unknown values. Every score criterion must include the same required field names.

\`\`\`json
{
  "meta": {
    "schema_version": "3.2",
    "generated_at": "YYYY-MM-DD",
    "language": "ko",
    "analyst_role": "[OIT] PreC Pipeline Shortlister",
    "output_format": ["markdown_report", "json"],
    "output_filename_base": "Company_Asset_YYYYMMDD",
    "rubric_version": "3.2",
    "rubric_author": "kate"
  },
  "input": {
    "company_input": "[COMPANY_NAME]",
    "asset_input": "[ASSET_NAME]",
    "source_text": null,
    "source_type": "web research",
    "notes": ""
  },
  "source_report": {
    "raw_markdown": "",
    "source_format": "gpt_markdown_report",
    "parser_status": "gpt_structured_output",
    "parser_note": "Markdown report and JSON were generated together from the same evidence set."
  },
  "company_profile": {
    "company_name": "",
    "legal_name": "",
    "aliases": [],
    "country": "",
    "headquarters": "",
    "website": "",
    "company_stage": "",
    "ownership_status": "",
    "focus_areas": [],
    "platform_summary": "",
    "lead_pipeline_summary": "",
    "financing_or_partnership_signals": [],
    "official_source_urls": [],
    "notes": ""
  },
  "json_summary": {
    "company": "",
    "asset_name": "",
    "target": "",
    "theme": "E/I Balance | Neuroimmune | N/A | Unknown",
    "cluster": "",
    "target_relevance_score": 0,
    "one_line_summary": "",
    "company_country": ""
  },
  "structured_table": {
    "company": "",
    "asset_name": "",
    "target": "",
    "moa": "",
    "modality_platform": "",
    "main_indication": "",
    "indication": "",
    "development_stage": "",
    "company_country": "",
    "sources": []
  },
  "hard_filter": {
    "status": "PASS | REVIEW | FAIL",
    "reason": "",
    "flags": []
  },
  "scoring": {
    "total_score": 0,
    "max_score": 21,
    "criteria": {
      "target_relevance": {"score": 0, "evidence_type": "", "evidence_type_reason": "", "main_line_summary": "", "what_was_checked": [], "evidence_trail": [], "evidence_sources": [], "investigation_note": "", "why_not_higher": "", "uncertain_points": []},
      "competitive_landscape": {"score": 0, "evidence_type": "", "evidence_type_reason": "", "main_line_summary": "", "what_was_checked": [], "evidence_trail": [], "evidence_sources": [], "investigation_note": "", "why_not_higher": "", "uncertain_points": []},
      "moa_validity": {"score": 0, "evidence_type": "", "evidence_type_reason": "", "main_line_summary": "", "what_was_checked": [], "evidence_trail": [], "evidence_sources": [], "investigation_note": "", "why_not_higher": "", "uncertain_points": []},
      "platform_attractiveness": {"score": 0, "evidence_type": "", "evidence_type_reason": "", "main_line_summary": "", "what_was_checked": [], "evidence_trail": [], "evidence_sources": [], "investigation_note": "", "why_not_higher": "", "uncertain_points": []},
      "expansion_potential": {"score": 0, "evidence_type": "", "evidence_type_reason": "", "main_line_summary": "", "what_was_checked": [], "evidence_trail": [], "evidence_sources": [], "investigation_note": "", "why_not_higher": "", "uncertain_points": []},
      "data_maturity": {"score": 0, "evidence_type": "", "evidence_type_reason": "", "main_line_summary": "", "what_was_checked": [], "evidence_trail": [], "evidence_sources": [], "investigation_note": "", "why_not_higher": "", "claimed_development_stage": "", "expected_data_for_stage": [], "visible_asset_specific_data": [], "missing_data": [], "stage_data_alignment_judgment": "", "uncertain_points": []},
      "marketability": {"score": 0, "evidence_type": "", "evidence_type_reason": "", "main_line_summary": "", "what_was_checked": ["TAP", "Unrisked Peak Sales", "Obtainable Peak Sales"], "evidence_trail": [], "evidence_sources": [], "investigation_note": "", "why_not_higher": "", "uncertain_points": [], "calculation": {"commercial_rationale_status": "established | not_established", "commercial_rationale_failure_reason": null, "A_targetable_addressable_patient": {"total_patient_pool": null, "diagnosis_rate": null, "eligibility_rate": null, "biomarker_positive_rate": null, "treatable_subgroup_rate": null, "formula": "TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate", "targetable_addressable_patient": null, "evidence_sources": []}, "B_unrisked_peak_sales": {"tap": null, "annual_net_price": null, "peak_penetration": null, "treatment_duration_factor": null, "sales_unit": "million USD", "entry_order_share_assumption": {"competitor_count": null, "expected_entry_order": null, "matrix_share_reference": ""}, "formula": "Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor", "unrisked_peak_sales": null, "evidence_sources": []}, "C_obtainable_peak_sales": {"unrisked_peak_sales": null, "competition_haircut": null, "pricing_power_adjustment": null, "expansion_capacity_adjustment": null, "sales_unit": "million USD", "formula": "Obtainable Peak Sales = Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment x Expansion Capacity Adjustment", "obtainable_peak_sales": null, "evidence_sources": []}}}
    }
  },
  "competitive_analysis": {
    "competitive_density": "",
    "similarity_summary": {"similar_pipeline_count": 0, "high_similarity_count": 0, "medium_similarity_count": 0, "low_similarity_count": 0},
    "similar_pipelines": []
  },
  "validation": {
    "cross_checked_facts": [],
    "uncertain_points": [],
    "source_registry": []
  },
  "final_insight": {
    "one_line_summary": "",
    "recommendation": "Shortlist | Watch | Deprioritize",
    "most_important_diligence_question": ""
  },
  "obsidian": {"note_title": "Company Asset", "tags": ["pipeline", "skbp"], "aliases": []}
}
\`\`\`

Remember: final answer must be only the markdown code block and the JSON code block.`;
}

async function copyPromptToClipboard(kind = 'full') {
  const prompt = kind === 'triage' ? buildTriageInstructionPrompt() : buildGptInstructionPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    setPromptCopyFeedback(kind);
  } catch (error) {
    const scratch = document.createElement('textarea');
    scratch.value = prompt;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    document.execCommand('copy');
    scratch.remove();
    setPromptCopyFeedback(kind);
  }
}

function setPromptCopyFeedback(kind = 'full') {
  if (elements.promptCopyStatus) {
    elements.promptCopyStatus.textContent = kind === 'triage' ? 'Triage 지침 복사 완료' : 'Full Scout 지침 복사 완료';
  }

  const button = kind === 'triage' ? elements.copyTriagePromptTopButton : elements.copyPromptTopButton;
  if (!button) return;

  const label = button.querySelector('b');
  const idleLabel = kind === 'triage' ? '지침 1' : '지침 2';
  const idleTooltip = kind === 'triage' ? TRIAGE_PROMPT_TOOLTIP : 'GPT full scout v3.2 지침을 복사합니다. triage에서 SELECT된 asset을 심층 검토할 때 사용합니다.';
  if (label) {
    label.textContent = '복사됨';
  }
  button.dataset.tooltip = kind === 'triage' ? 'GPT fast triage 지침을 복사했습니다.' : 'GPT full scout v3.2 지침을 복사했습니다.';

  window.clearTimeout(promptCopyFeedbackTimer);
  promptCopyFeedbackTimer = window.setTimeout(() => {
    if (label) {
      label.textContent = idleLabel;
    }
    button.dataset.tooltip = idleTooltip;
  }, 1800);
}

function sortByColumn(key) {
  if (state.sortKey === key) {
    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDirection = [
      'targetScore',
      'moaScore',
      'dataScore',
      'competitiveScore',
      'platformScore',
      'expansionScore',
      'marketScore',
      'totalScore'
    ].includes(key)
      ? 'desc'
      : 'asc';
  }
  renderTable();
}

function setTableMode(mode) {
  const nextMode = mode === 'triage' ? 'triage' : mode === 'focus' ? 'focus' : 'full';
  if (state.tableMode === nextMode) return;
  state.tableMode = nextMode;
  state.pass = 'all';
  state.page = 1;

  if (nextMode === 'triage' && ['filter2', 'competitiveScore', 'platformScore', 'expansionScore', 'marketScore', 'totalScore', 'focusAddedAt', 'focusDueDate'].includes(state.sortKey)) {
    state.sortKey = 'targetScore';
    state.sortDirection = 'desc';
  }
  if (nextMode === 'full' && state.sortKey === 'filter1') {
    state.sortKey = 'totalScore';
    state.sortDirection = 'desc';
  }
  if (nextMode === 'focus') {
    state.sortKey = 'focusAddedAt';
    state.sortDirection = 'desc';
  }
  if (nextMode === 'full' && ['focusAddedAt', 'focusDueDate'].includes(state.sortKey)) {
    state.sortKey = 'totalScore';
    state.sortDirection = 'desc';
  }

  renderFilters();
  renderTableTabs();
  renderTable();
  if (elements.criteriaDrawer.classList.contains('open')) updateCriteriaDrawerScope();
}

function beginColumnResize(event) {
  const handle = event.target.closest('[data-resize-column]');
  if (!handle) return;
  event.preventDefault();
  event.stopPropagation();
  const key = handle.dataset.resizeColumn;
  activeColumnResize = {
    key,
    startX: event.clientX,
    startWidth: columnWidth(key)
  };
  document.body.classList.add('is-resizing-column');
  handle.setPointerCapture?.(event.pointerId);
}

function updateColumnResize(event) {
  if (!activeColumnResize) return;
  const nextWidth = Math.max(
    minColumnWidth(activeColumnResize.key),
    Math.min(MAX_COLUMN_WIDTH, activeColumnResize.startWidth + event.clientX - activeColumnResize.startX)
  );
  activeColumnWidths()[activeColumnResize.key] = Math.round(nextWidth);
  applyColumnWidths();
}

function endColumnResize() {
  if (!activeColumnResize) return;
  persistColumnWidths();
  activeColumnResize = null;
  document.body.classList.remove('is-resizing-column');
}

function resetColumnWidth(event) {
  const handle = event.target.closest('[data-resize-column]');
  if (!handle) return;
  event.preventDefault();
  event.stopPropagation();
  delete activeColumnWidths()[handle.dataset.resizeColumn];
  persistColumnWidths();
  renderTable();
}

elements.searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  state.page = 1;
  renderTable();
});

elements.stageFilter.addEventListener('change', (event) => {
  state.stage = event.target.value;
  state.page = 1;
  renderTable();
});

elements.themeFilter.addEventListener('change', (event) => {
  state.theme = event.target.value;
  state.page = 1;
  renderTable();
});

elements.clusterFilter.addEventListener('change', (event) => {
  state.cluster = event.target.value;
  state.page = 1;
  renderTable();
});

elements.modalityFilter.addEventListener('change', (event) => {
  state.modality = event.target.value;
  state.page = 1;
  renderTable();
});

elements.countryFilter.addEventListener('change', (event) => {
  state.country = event.target.value;
  state.page = 1;
  renderTable();
});

elements.indicationFilter.addEventListener('change', (event) => {
  state.indication = event.target.value;
  state.page = 1;
  renderTable();
});

elements.passFilter.addEventListener('change', (event) => {
  state.pass = event.target.value;
  state.page = 1;
  renderTable();
});

elements.pageSizeSelect?.addEventListener('change', (event) => {
  const nextSize = Number(event.target.value);
  state.pageSize = [10, 30, 50, 100].includes(nextSize) ? nextSize : DEFAULT_PAGE_SIZE;
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(state.pageSize));
  state.page = 1;
  renderTable();
});

elements.prevPage.addEventListener('click', () => {
  state.page = Math.max(1, state.page - 1);
  renderTable();
});

elements.nextPage.addEventListener('click', () => {
  state.page += 1;
  renderTable();
});

elements.pipelineTable.addEventListener('pointerover', (event) => {
  const anchor = event.target.closest('[data-target-context]');
  if (!anchor || anchor.contains(event.relatedTarget)) return;
  showTargetContextTooltip(anchor);
});

elements.pipelineTable.addEventListener('pointerout', (event) => {
  const anchor = event.target.closest('[data-target-context]');
  if (!anchor || anchor.contains(event.relatedTarget)) return;
  hideTargetContextTooltip(anchor);
});

elements.pipelineTable.addEventListener('focusin', (event) => {
  const anchor = event.target.closest('[data-target-context]');
  if (anchor) showTargetContextTooltip(anchor);
});

elements.pipelineTable.addEventListener('focusout', (event) => {
  const anchor = event.target.closest('[data-target-context]');
  if (!anchor || anchor.contains(event.relatedTarget)) return;
  hideTargetContextTooltip(anchor);
});

window.addEventListener('scroll', () => hideTargetContextTooltip(), true);
window.addEventListener('resize', () => hideTargetContextTooltip());

elements.pipelineTable.addEventListener('click', (event) => {
  const rubricRefresh = event.target.closest('[data-rubric-refresh]');
  if (rubricRefresh) {
    recalculateLatestRubric(rubricRefresh);
    return;
  }
  const focusAction = event.target.closest('[data-focus-action]');
  if (focusAction) {
    saveFocusManagement(
      focusAction.dataset.recordId,
      { action: focusAction.dataset.focusAction },
      focusAction
    );
    return;
  }
  if (event.target.closest('input, select, textarea, button, a, label')) return;
  const rowElement = event.target.closest('[data-record-id]');
  if (!rowElement) return;
  const recordId = rowElement.dataset.recordId;
  if (activeTableMode() === 'triage') {
    window.location.href = `/triage-detail?id=${encodeURIComponent(recordId)}`;
    return;
  }
  window.location.href = `/detail?id=${encodeURIComponent(recordId)}&tab=${activeTableMode()}`;
});

elements.pipelineTable.addEventListener('change', (event) => {
  const editSelect = event.target.closest('.table-edit-select, .total-score-edit-circle');
  if (editSelect) {
    saveManualReviewEdit(editSelect);
    return;
  }

  const partnershipSelect = event.target.closest('.partnership-edit-select');
  if (partnershipSelect) {
    const previousValue = partnershipSelect.dataset.previousValue || '';
    const nextValue = partnershipSelect.value || '';
    if (previousValue === nextValue) return;
    saveFocusManagement(
      partnershipSelect.dataset.recordId,
      { action: 'update', field: 'partnership_type', value: nextValue },
      partnershipSelect
    );
    return;
  }

  const partnershipNote = event.target.closest('.partnership-note-input');
  if (partnershipNote) {
    const previousValue = partnershipNote.dataset.previousValue || '';
    const nextValue = partnershipNote.value.trim();
    if (previousValue === nextValue) return;
    saveFocusManagement(
      partnershipNote.dataset.recordId,
      { action: 'update', field: 'partnership_note', value: nextValue },
      partnershipNote
    );
    return;
  }

  const evidenceSelect = event.target.closest('.evidence-edit');
  if (evidenceSelect) {
    const previousValue = evidenceSelect.dataset.previousValue || '';
    const nextValue = evidenceSelect.value || '';
    if (previousValue === nextValue) return;
    const backendField = EVIDENCE_FIELD_TO_BACKEND[evidenceSelect.dataset.evidenceField];
    if (!backendField) return;
    saveFocusManagement(
      evidenceSelect.dataset.recordId,
      { action: 'update', field: backendField, value: nextValue },
      evidenceSelect
    );
    return;
  }

  const dueInput = event.target.closest('.focus-due-input');
  if (dueInput) {
    const previousValue = dueInput.dataset.previousValue || '';
    const nextValue = dueInput.value || '';
    if (previousValue === nextValue) return;
    saveFocusManagement(
      dueInput.dataset.recordId,
      { action: 'update', field: 'due_date', value: nextValue },
      dueInput
    );
    return;
  }

  const checkbox = event.target.closest('.row-select');
  if (!checkbox) return;
  const id = checkbox.dataset.recordId;
  if (!id) return;
  if (checkbox.checked) {
    state.selectedIds.add(id);
  } else {
    state.selectedIds.delete(id);
  }
  checkbox.closest('tr')?.classList.toggle('selected-row', checkbox.checked);
  updateSelectionControls();
});

elements.selectPageRows?.addEventListener('change', (event) => {
  const visibleRows = getVisibleRows();
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  pageRows.forEach((row) => {
    if (event.target.checked) {
      state.selectedIds.add(row.id);
    } else {
      state.selectedIds.delete(row.id);
    }
  });
  renderTable();
});

elements.pipelineTableHead?.addEventListener('click', (event) => {
  if (event.target.closest('[data-resize-column]')) return;
  const button = event.target.closest('button[data-sort]');
  if (!button) return;
  sortByColumn(button.dataset.sort);
});

elements.pipelineTable.addEventListener('keydown', (event) => {
  const input = event.target.closest('.total-score-edit-circle');
  if (!input) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    input.blur();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    input.value = input.dataset.previousValue || '';
    input.blur();
  }
});

elements.pipelineTableHead?.addEventListener('pointerdown', beginColumnResize);
elements.pipelineTableHead?.addEventListener('dblclick', resetColumnWidth);
document.addEventListener('pointermove', updateColumnResize);
document.addEventListener('pointerup', endColumnResize);

elements.pipelineTableHead?.addEventListener('change', (event) => {
  if (event.target.id !== 'selectPageRows') return;
  const visibleRows = getVisibleRows();
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  pageRows.forEach((row) => {
    if (event.target.checked) {
      state.selectedIds.add(row.id);
    } else {
      state.selectedIds.delete(row.id);
    }
  });
  renderTable();
});

elements.refreshButton.addEventListener('click', () => {
  loadRecords().catch((error) => {
    elements.dataStatus.textContent = 'Load failed';
    elements.saveStatus.textContent = error.message;
  });
});

elements.exportExcelButton.addEventListener('click', exportPipelineTable);
elements.deleteSelectedButton.addEventListener('click', deleteSelectedRecords);
function goToRecordDetail(tabOrigin) {
  return (event) => {
    const item = event.target.closest('[data-record-id]');
    if (!item) return;
    if (item.dataset.isTriage) {
      window.location.href = `/triage-detail?id=${encodeURIComponent(item.dataset.recordId)}`;
      return;
    }
    window.location.href = `/detail?id=${encodeURIComponent(item.dataset.recordId)}&tab=${tabOrigin}`;
  };
}
elements.priorityList?.addEventListener('click', goToRecordDetail('full'));
elements.dueDateList?.addEventListener('click', goToRecordDetail('focus'));
elements.columnSettingsButton?.addEventListener('click', () => {
  elements.columnSettingsPanel.hidden = !elements.columnSettingsPanel.hidden;
});
elements.columnSettingsGrid?.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  if (checkbox.checked) {
    state.extraColumns.add(checkbox.value);
  } else {
    state.extraColumns.delete(checkbox.value);
  }
  persistExtraColumns();
  renderTable();
});

elements.pipelineTableTabs?.forEach((tab) => {
  tab.addEventListener('click', () => setTableMode(tab.dataset.tableMode));
});

elements.agentSessionSelect?.addEventListener('change', (event) => {
  state.activeAgentSessionId = event.target.value;
  saveAgentSessions();
  renderAgentMessagesFromSession();
});

elements.agentNewSessionButton?.addEventListener('click', () => {
  startNewAgentSession();
});

elements.agentDeleteSessionButton?.addEventListener('click', deleteActiveAgentSession);

elements.aiDrawerButton.addEventListener('click', openAiDrawer);
elements.aiDrawerClose.addEventListener('click', closeAiDrawer);
elements.aiBackdrop.addEventListener('click', closeAiDrawer);
elements.criteriaDrawerButton.addEventListener('click', openCriteriaDrawer);
elements.criteriaDrawerClose.addEventListener('click', closeCriteriaDrawer);
elements.criteriaBackdrop.addEventListener('click', closeCriteriaDrawer);
elements.reviewerIdentitySubmit?.addEventListener('click', () => {
  const identity = elements.reviewerIdentityInput?.value.trim() || '';
  if (!identity) {
    elements.reviewerIdentityInput?.focus();
    return;
  }
  closeReviewerIdentityModal(identity);
});
elements.reviewerIdentityCancel?.addEventListener('click', () => closeReviewerIdentityModal(null));
elements.reviewerIdentityModal?.addEventListener('click', (event) => {
  if (event.target === elements.reviewerIdentityModal) closeReviewerIdentityModal(null);
});
elements.reviewerIdentityInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    elements.reviewerIdentitySubmit?.click();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeReviewerIdentityModal(null);
  }
});

document.querySelectorAll('[data-agent-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    elements.agentInput.value = button.dataset.agentPrompt;
    elements.agentInput.focus();
  });
});

elements.agentInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  elements.agentForm.requestSubmit();
});

elements.agentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = elements.agentInput.value.trim();
  if (!question) return;
  elements.agentInput.value = '';
  retitleActiveSessionFromQuestion(question);
  addAgentMessage('user', question);
  const submitButton = elements.agentForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '답변 중';
  }
  const responseBubble = addAgentMessage('assistant', '질문 분석 중...', { pending: true });
  try {
    await streamDashboardAgentReply(question, responseBubble);
  } catch (error) {
    updateAgentMessage(responseBubble, `AI 응답 오류: ${error.message}`, { done: true });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '질문';
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.aiDrawer.classList.contains('open')) {
    closeAiDrawer();
  }
  if (event.key === 'Escape' && elements.criteriaDrawer.classList.contains('open')) {
    closeCriteriaDrawer();
  }
});

elements.previewInputButton.addEventListener('click', previewPastedReportParsing);
elements.saveJsonButton.addEventListener('click', saveStructuredJsonInput);
elements.clearJsonButton.addEventListener('click', () => {
  elements.rawReportInput.value = '';
  elements.structuredJsonInput.value = '';
  elements.saveStatus.textContent = '원문 + JSON 입력 대기';
});
if (elements.copyTriagePromptTopButton) {
  elements.copyTriagePromptTopButton.dataset.tooltip = TRIAGE_PROMPT_TOOLTIP;
}
if (elements.copyPromptTopButton) {
  const label = elements.copyPromptTopButton.querySelector('b');
  if (label) label.textContent = '지침 2';
  elements.copyPromptTopButton.dataset.tooltip = 'GPT full scout v3.2 지침을 복사합니다. triage에서 SELECT된 asset을 심층 검토할 때 사용합니다.';
}
elements.copyPromptButton?.addEventListener('click', () => copyPromptToClipboard('full'));
elements.copyTriagePromptTopButton?.addEventListener('click', () => copyPromptToClipboard('triage'));
elements.copyPromptTopButton?.addEventListener('click', () => copyPromptToClipboard('full'));

setupResizableDrawer(elements.aiDrawer, 'skbp.dashboard.aiDrawerWidth', 560);
setupThemeToggle();
initializeAgentSessions();

loadRecords().catch((error) => {
  elements.dataStatus.textContent = 'Load failed';
  elements.saveStatus.textContent = error.message;
});
