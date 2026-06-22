import { setupThemeToggle } from './theme.js';

const API_URL = '/api/records';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_STORAGE_KEY = 'skbp.dashboard.pageSize.v1';
const AGENT_SESSION_STORAGE_KEY = 'skbp.dashboard.agentSessions.v1';
const AGENT_ACTIVE_SESSION_KEY = 'skbp.dashboard.activeAgentSession.v1';
const COLUMN_WIDTH_STORAGE_KEY = 'skbp.dashboard.columnWidths.v1';

const DEFAULT_COLUMN_WIDTHS = {
  select: 36,
  company: 128,
  country: 112,
  asset: 92,
  target: 360,
  stage: 190,
  hardFilter: 82,
  targetScore: 52,
  competitiveScore: 58,
  moaScore: 52,
  platformScore: 52,
  expansionScore: 52,
  dataScore: 56,
  marketScore: 64,
  totalScore: 58,
  extra: 180
};

const MIN_COLUMN_WIDTHS = {
  select: 34,
  company: 86,
  country: 82,
  asset: 72,
  target: 180,
  stage: 120,
  hardFilter: 70,
  targetScore: 46,
  competitiveScore: 50,
  moaScore: 46,
  platformScore: 46,
  expansionScore: 46,
  dataScore: 50,
  marketScore: 56,
  totalScore: 52,
  extra: 110
};

const MAX_COLUMN_WIDTH = 720;
const PROMPT_TOOLTIP =
  'GPT 조사 지침을 클립보드에 복사합니다. 복사한 지침을 ChatGPT에 붙여넣은 뒤, 조사할 회사명과 약물명/파이프라인명을 함께 입력하면 MD 리포트와 JSON Schema 형식으로 결과를 받을 수 있습니다.';

const state = {
  rawRecords: [],
  rows: [],
  query: '',
  stage: 'all',
  theme: 'all',
  country: 'all',
  pass: 'all',
  sortKey: 'totalScore',
  sortDirection: 'desc',
  page: 1,
  pageSize: Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)) || DEFAULT_PAGE_SIZE,
  selectedIds: new Set(),
  extraColumns: new Set(JSON.parse(localStorage.getItem('skbp.dashboard.extraColumns') || '[]')),
  columnWidths: JSON.parse(localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY) || '{}'),
  agentSessions: [],
  activeAgentSessionId: localStorage.getItem(AGENT_ACTIVE_SESSION_KEY) || ''
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
  targetChart: document.querySelector('#targetChart'),
  themeChart: document.querySelector('#themeChart'),
  countryChart: document.querySelector('#countryChart'),
  passDonut: document.querySelector('#passDonut'),
  passLegend: document.querySelector('#passLegend'),
  scoreAverageChart: document.querySelector('#scoreAverageChart'),
  priorityList: document.querySelector('#priorityList'),
  searchInput: document.querySelector('#searchInput'),
  stageFilter: document.querySelector('#stageFilter'),
  themeFilter: document.querySelector('#themeFilter'),
  countryFilter: document.querySelector('#countryFilter'),
  passFilter: document.querySelector('#passFilter'),
  tableCount: document.querySelector('#tableCount'),
  pageSizeSelect: document.querySelector('#pageSizeSelect'),
  columnSettingsButton: document.querySelector('#columnSettingsButton'),
  columnSettingsPanel: document.querySelector('#columnSettingsPanel'),
  columnSettingsGrid: document.querySelector('#columnSettingsGrid'),
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
  copyPromptTopButton: document.querySelector('#copyPromptTopButton'),
  copyPromptButton: document.querySelector('#copyPromptButton'),
  promptCopyStatus: document.querySelector('#promptCopyStatus')
};

let activeColumnResize = null;
let promptCopyFeedbackTimer = null;

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
  return !value.trim() || /no theme|no cluster|no mapped|none|미해당/.test(value);
}

function computeHardFilter(record, criteria) {
  const summary = record.json_summary || {};
  const scoring = record.scoring || {};
  const total = number(scoring.total_score);
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

function flattenRecord(record, index) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const scoring = record.scoring || {};
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

  const computedHardFilter = computeHardFilter(record, criteria);

  return {
    id: get(record, 'meta.output_filename_base', `${summary.company || table.company || 'record'}-${index}`),
    company: summary.company || table.company || '-',
    country: summary.company_country || table.company_country || '-',
    asset: summary.asset_name || table.asset_name || '-',
    target: summary.target || table.target || '-',
    theme: summary.theme || get(champion, 'matched_theme.name', '-'),
    cluster: summary.cluster || get(champion, 'matched_cluster.name', '-'),
    stage: table.development_stage || '-',
    indication: table.indication || '-',
    modality: table.modality_platform || '-',
    hardFilter: computedHardFilter.status,
    hardFilterReason: computedHardFilter.reason,
    targetScore: number(summary.target_relevance_score ?? criteria.target.score ?? champion.score),
    competitiveScore: criteria.competitive.score,
    moaScore: criteria.moa.score,
    platformScore: criteria.platform.score,
    expansionScore: criteria.expansion.score,
    dataScore: criteria.data.score,
    marketScore: criteria.market.score,
    totalScore: number(scoring.total_score),
    maxScore: number(scoring.max_score) || 20,
    competition: get(record, 'competitive_analysis.competitive_density', 'Unclear'),
    similarPipelineCount: number(get(record, 'competitive_analysis.similarity_summary.similar_pipeline_count', 0)),
    highSimilarityCount: number(get(record, 'competitive_analysis.similarity_summary.high_similarity_count', 0)),
    summary: get(record, 'final_insight.one_line_summary', summary.one_line_summary || '-'),
    criteriaVersion: get(record, 'meta.rubric_version', get(record, 'scoring.criteria.target_relevance.criteria_reference.criteria_version', '-')),
    criteria,
    raw: record
  };
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
  { key: 'hardFilterReason', label: 'Filter reason', path: 'hard_filter.reason' },
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
  return EXTRA_COLUMN_DEFINITIONS.filter((column) => state.extraColumns.has(column.key));
}

function persistExtraColumns() {
  localStorage.setItem('skbp.dashboard.extraColumns', JSON.stringify([...state.extraColumns]));
}

function extraColumnKey(column) {
  return `extra:${column.key}`;
}

function defaultColumnWidth(key) {
  return DEFAULT_COLUMN_WIDTHS[key] || DEFAULT_COLUMN_WIDTHS.extra;
}

function minColumnWidth(key) {
  return MIN_COLUMN_WIDTHS[key] || MIN_COLUMN_WIDTHS.extra;
}

function columnWidth(key) {
  const width = Number(state.columnWidths[key]);
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

function plainHeader(label, columnKey, className = '') {
  const classAttr = className ? ` class="${escapeHtml(className)}"` : '';
  return `<th${classAttr} ${columnAttrs(columnKey)}><span title="${escapeHtml(label)}">${escapeHtml(label)}</span>${resizeHandle(columnKey)}</th>`;
}

function visibleColumnKeys(extraColumns = selectedExtraColumns()) {
  return [
    'select',
    'company',
    'country',
    'asset',
    'target',
    'stage',
    'hardFilter',
    'targetScore',
    'competitiveScore',
    'moaScore',
    'platformScore',
    'expansionScore',
    'dataScore',
    'marketScore',
    'totalScore',
    ...extraColumns.map(extraColumnKey)
  ];
}

function visibleTableWidth(extraColumns = selectedExtraColumns()) {
  return visibleColumnKeys(extraColumns).reduce((sum, key) => sum + columnWidth(key), 0);
}

function persistColumnWidths() {
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

function getVisibleRows() {
  const query = state.query.trim().toLowerCase();
  return state.rows
    .filter((row) => {
      const searchable = [
        row.company,
        row.country,
        row.asset,
        row.target,
        row.theme,
        row.cluster,
        row.stage,
        row.indication,
        row.modality
      ]
        .join(' ')
        .toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (state.stage === 'all' || row.stage === state.stage) &&
        (state.theme === 'all' || row.theme === state.theme) &&
        (state.country === 'all' || row.country === state.country) &&
        (state.pass === 'all' || row.hardFilter === state.pass)
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
  const countries = [...new Set(state.rows.map((row) => row.country).filter(Boolean))].sort();

  elements.stageFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...stages.map((stage) => `<option value="${stage}">${stage}</option>`)
  ].join('');
  elements.themeFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...themes.map((theme) => `<option value="${theme}">${theme}</option>`)
  ].join('');
  elements.countryFilter.innerHTML = [
    '<option value="all">전체</option>',
    ...countries.map((country) => `<option value="${country}">${country}</option>`)
  ].join('');
}

function renderMetrics() {
  const total = state.rows.length;
  const pass = state.rows.filter((row) => row.hardFilter === 'PASS').length;
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

function chartBar(label, value, max, tone = '') {
  const width = max ? Math.round((value / max) * 100) : 0;
  const safeLabel = escapeHtml(label);
  return `
    <div class="bar-row">
      <span title="${safeLabel}">${safeLabel}</span>
      <div class="bar-track"><div class="bar-fill ${tone}" style="width:${width}%"></div></div>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderCharts() {
  const targetCounts = countBy(state.rows, (row) => (row.targetScore ? `${row.targetScore}점` : '미평가'));
  const maxTarget = Math.max(1, ...Object.values(targetCounts));
  elements.targetChart.innerHTML = ['3점', '2점', '1점', '미평가']
    .map((label) => chartBar(label, targetCounts[label] || 0, maxTarget, label === '3점' ? 'good' : ''))
    .join('');

  const themeCounts = countBy(state.rows, (row) => row.theme || 'N/A');
  const maxTheme = Math.max(1, ...Object.values(themeCounts));
  elements.themeChart.innerHTML = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => chartBar(label, value, maxTheme, 'accent'))
    .join('');

  const countryCounts = countBy(state.rows, (row) => row.country || 'N/A');
  const maxCountry = Math.max(1, ...Object.values(countryCounts));
  elements.countryChart.innerHTML = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => chartBar(label, value, maxCountry, 'country'))
    .join('');

  const total = state.rows.length;
  const pass = state.rows.filter((row) => row.hardFilter === 'PASS').length;
  const passRate = total ? Math.round((pass / total) * 100) : 0;
  elements.passDonut.style.setProperty('--pass-rate', `${passRate}%`);
  elements.passDonut.textContent = `${passRate}%`;
  elements.passLegend.innerHTML = `
    <span><b class="legend-dot pass"></b>PASS ${pass}</span>
    <span><b class="legend-dot fail"></b>Other ${Math.max(total - pass, 0)}</span>
  `;

  if (elements.scoreAverageChart) {
    const scoreItems = [
      ['TR', average(state.rows.map((row) => row.targetScore))],
      ['Comp', average(state.rows.map((row) => row.competitiveScore))],
      ['MOA', average(state.rows.map((row) => row.moaScore))],
      ['Plat', average(state.rows.map((row) => row.platformScore))],
      ['Exp', average(state.rows.map((row) => row.expansionScore))],
      ['Data', average(state.rows.map((row) => row.dataScore))],
      ['Market', average(state.rows.map((row) => row.marketScore))]
    ];
    elements.scoreAverageChart.innerHTML = scoreItems
      .map(([label, value]) => chartBar(label, Number.isFinite(value) ? Number(value.toFixed(1)) : 0, 3, value >= 2 ? 'good' : ''))
      .join('');
  }

  if (elements.priorityList) {
    const topRows = [...state.rows]
      .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))
      .slice(0, 3);
    elements.priorityList.innerHTML = topRows.length
      ? topRows.map((row) => `
          <button type="button" class="priority-item" data-record-id="${escapeHtml(row.id)}">
            <strong>${escapeHtml(row.asset)}</strong>
            <span>${escapeHtml(row.theme)} · ${escapeHtml(row.cluster)}</span>
            <b>${row.totalScore ?? '-'} / ${row.maxScore ?? 21}</b>
          </button>
        `).join('')
      : '<div class="empty-state">No assets loaded</div>';
  }
}

function renderColumnSettings() {
  if (!elements.columnSettingsGrid) return;
  elements.columnSettingsGrid.innerHTML = EXTRA_COLUMN_DEFINITIONS.map((column) => `
    <label class="column-option">
      <input type="checkbox" value="${escapeHtml(column.key)}" ${state.extraColumns.has(column.key) ? 'checked' : ''} />
      <span>${escapeHtml(column.label)}</span>
      <small>${escapeHtml(column.path)}</small>
    </label>
  `).join('');
}

function scoreTooltip(label, criterionInfo, max) {
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

function scoreBadge(score, max = 3, tooltip = '') {
  const className = score >= max ? 'score high' : score >= max * 0.6 ? 'score mid' : 'score low';
  const safeTooltip = escapeHtml(tooltip);
  return `<span class="${className}" data-tooltip="${safeTooltip}" title="${safeTooltip}">${score ?? '-'}</span>`;
}

function renderTable() {
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
      <col class="pipeline-col-stage" />
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
      <col class="pipeline-col-stage" data-col-key="stage" style="${columnWidthStyle('stage')}" />
      <col class="pipeline-col-filter" data-col-key="hardFilter" style="${columnWidthStyle('hardFilter')}" />
      <col class="pipeline-col-score" data-col-key="targetScore" style="${columnWidthStyle('targetScore')}" />
      <col class="pipeline-col-score" data-col-key="competitiveScore" style="${columnWidthStyle('competitiveScore')}" />
      <col class="pipeline-col-score" data-col-key="moaScore" style="${columnWidthStyle('moaScore')}" />
      <col class="pipeline-col-score" data-col-key="platformScore" style="${columnWidthStyle('platformScore')}" />
      <col class="pipeline-col-score" data-col-key="expansionScore" style="${columnWidthStyle('expansionScore')}" />
      <col class="pipeline-col-score" data-col-key="dataScore" style="${columnWidthStyle('dataScore')}" />
      <col class="pipeline-col-score" data-col-key="marketScore" style="${columnWidthStyle('marketScore')}" />
      <col class="pipeline-col-score" data-col-key="totalScore" style="${columnWidthStyle('totalScore')}" />
      ${extraColumns.map((column) => `<col class="pipeline-col-extra" data-col-key="${escapeHtml(extraColumnKey(column))}" style="${columnWidthStyle(extraColumnKey(column))}" />`).join('')}
    `;
  }
  const tableElement = elements.pipelineTable?.closest('table');
  if (tableElement) {
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
      <th><button data-sort="target" type="button">Target / Theme / Cluster</button></th>
      <th><button data-sort="stage" type="button">Stage</button></th>
      <th><button data-sort="hardFilter" type="button">Filter</button></th>
      <th><button data-sort="targetScore" type="button">TR</button></th>
      <th><button data-sort="competitiveScore" type="button">Comp</button></th>
      <th><button data-sort="moaScore" type="button">MOA</button></th>
      <th><button data-sort="platformScore" type="button">Plat</button></th>
      <th><button data-sort="expansionScore" type="button">Exp</button></th>
      <th><button data-sort="dataScore" type="button">Data</button></th>
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
        <th rowspan="2"><button data-sort="target" type="button">Target / Theme / Cluster</button></th>
        <th rowspan="2"><button data-sort="stage" type="button">Stage</button></th>
        <th rowspan="2"><button data-sort="hardFilter" type="button">Filter</button></th>
        <th class="score-group-head" colspan="8">Scorecard</th>
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
      </tr>
      <tr class="pipeline-score-row">
        <th><button data-sort="targetScore" type="button">TR</button></th>
        <th><button data-sort="competitiveScore" type="button">Comp</button></th>
        <th><button data-sort="moaScore" type="button">MOA</button></th>
        <th><button data-sort="platformScore" type="button">Plat</button></th>
        <th><button data-sort="expansionScore" type="button">Exp</button></th>
        <th><button data-sort="dataScore" type="button">Data</button></th>
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
        ${sortableHeader('Target / Theme / Cluster', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Stage', 'stage', 'stage', 'rowspan="2"')}
        ${sortableHeader('Filter', 'hardFilter', 'hardFilter', 'rowspan="2"')}
        <th class="score-group-head" colspan="8">Scorecard</th>
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
      </tr>
      <tr class="pipeline-score-row">
        ${sortableHeader('TR', 'targetScore', 'targetScore')}
        ${sortableHeader('Comp', 'competitiveScore', 'competitiveScore')}
        ${sortableHeader('MOA', 'moaScore', 'moaScore')}
        ${sortableHeader('Plat', 'platformScore', 'platformScore')}
        ${sortableHeader('Exp', 'expansionScore', 'expansionScore')}
        ${sortableHeader('Data', 'dataScore', 'dataScore')}
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
          const filterClass = row.hardFilter === 'PASS' ? 'pill pass' : row.hardFilter === 'FAIL' ? 'pill fail' : 'pill review';
          const isSelected = state.selectedIds.has(row.id);
          const checked = isSelected ? 'checked' : '';
          return `
            <tr class="clickable-row${isSelected ? ' selected-row' : ''}" data-record-id="${escapeHtml(row.id)}" title="${escapeHtml(row.summary)}">
              <td class="select-col">
                <input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} 선택" ${checked} />
              </td>
              <td class="company-cell">${escapeHtml(row.company)}</td>
              <td class="country-cell">${escapeHtml(row.country)}</td>
              <td class="asset-cell"><strong>${escapeHtml(row.asset)}</strong></td>
              <td class="target-column-cell">
                <div class="target-cell">
                  <strong>${escapeHtml(row.target)}</strong>
                  <span>Theme: ${escapeHtml(row.theme)}</span>
                  <span>Cluster: ${escapeHtml(row.cluster)}</span>
                </div>
              </td>
              <td class="stage-cell">${escapeHtml(row.stage)}</td>
              <td class="filter-cell"><span class="${filterClass}" title="${escapeHtml(row.hardFilterReason)}">${escapeHtml(row.hardFilter)}</span></td>
              <td class="score-cell">${scoreBadge(row.targetScore, 3, scoreTooltip('Target Relevance', row.criteria.target, 3))}</td>
              <td class="score-cell">${scoreBadge(row.competitiveScore, 3, scoreTooltip('Competitive Landscape', row.criteria.competitive, 3))}</td>
              <td class="score-cell">${scoreBadge(row.moaScore, 3, scoreTooltip('MOA Validity', row.criteria.moa, 3))}</td>
              <td class="score-cell">${scoreBadge(row.platformScore, 3, scoreTooltip('Platform Attractiveness', row.criteria.platform, 3))}</td>
              <td class="score-cell">${scoreBadge(row.expansionScore, 3, scoreTooltip('Expansion Potential', row.criteria.expansion, 3))}</td>
              <td class="score-cell">${scoreBadge(row.dataScore, 3, scoreTooltip('Data Maturity', row.criteria.data, 3))}</td>
              <td class="score-cell">${scoreBadge(row.marketScore, 3, scoreTooltip('Marketability', row.criteria.market, 3))}</td>
              <td class="score-cell total-score-cell">${scoreBadge(row.totalScore, row.maxScore, `Total Score: ${row.totalScore ?? '-'} / ${row.maxScore}`)}</td>
              ${extraColumns.map((column) => {
                const value = formatExtraColumnValue(get(row.raw, column.path, '-'));
                return `<td class="extra-column-cell" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
              }).join('')}
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="${15 + extraColumns.length}" class="empty-cell">조건에 맞는 데이터가 없습니다.</td></tr>`;

  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateSelectionControls(pageRows);
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

function render() {
  if (elements.pageSizeSelect) elements.pageSizeSelect.value = String(state.pageSize);
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
    'Stage',
    'Indication',
    'Modality',
    'Hard Filter',
    'Hard Filter Reason',
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
    row.stage,
    row.indication,
    row.modality,
    row.hardFilter,
    row.hardFilterReason,
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

function openCriteriaDrawer() {
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
      `filter=${row.hardFilter}`
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

function buildGptInstructionPrompt() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Find and evaluate a pipeline asset by doing the full workflow: company research, source verification, competitor search, SKBP scoring, and evidence tracking. The final answer must include two copyable boxes: first a complete Markdown file code block, then a valid JSON code block that follows the SKBP JSON schema.

Company: [COMPANY_NAME]
Asset / drug / pipeline name: [ASSET_NAME]
Output language: Korean. English is allowed for scientific terms.

Non-negotiable rules:
1. Final answer format must be exactly two fenced code blocks:
   - Box 1: \`\`\`markdown containing the complete .md report.
   - Box 2: \`\`\`json containing the complete structured JSON.
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

Scoring v3.1 rules:
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

Expected final answer shape:

\`\`\`markdown
# [Company] Pipeline Scout Report: **[Asset]**
...complete report...
\`\`\`

\`\`\`json
{
  "meta": {
    "schema_version": "3.0"
  }
}
\`\`\`

Use this exact report structure inside the markdown code block:

# [Company] Pipeline Scout Report: **[Asset]**

Briefly state that this report is prepared for SKBP Pipeline Finder v3.0 and that URLs are included for auditability.

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
- No Theme

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
    "schema_version": "3.0",
    "generated_at": "YYYY-MM-DD",
    "language": "ko",
    "analyst_role": "[OIT] PreC Pipeline Shortlister",
    "output_format": ["markdown_report", "json"],
    "output_filename_base": "Company_Asset_YYYYMMDD",
    "rubric_version": "3.0",
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
    "theme": "E/I Balance | Neuroimmune | No Theme",
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

async function copyPromptToClipboard() {
  const prompt = buildGptInstructionPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    setPromptCopyFeedback();
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
    setPromptCopyFeedback();
  }
}

function setPromptCopyFeedback() {
  if (elements.promptCopyStatus) {
    elements.promptCopyStatus.textContent = '복사 완료';
  }

  if (!elements.copyPromptTopButton) {
    return;
  }

  const label = elements.copyPromptTopButton.querySelector('b');
  if (label) {
    label.textContent = '복사됨';
  }
  elements.copyPromptTopButton.dataset.tooltip = 'GPT 조사 지침을 클립보드에 복사했습니다.';

  window.clearTimeout(promptCopyFeedbackTimer);
  promptCopyFeedbackTimer = window.setTimeout(() => {
    if (label) {
      label.textContent = '지침';
    }
    elements.copyPromptTopButton.dataset.tooltip = PROMPT_TOOLTIP;
  }, 1800);
}

function sortByColumn(key) {
  if (state.sortKey === key) {
    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDirection = [
      'targetScore',
      'competitiveScore',
      'moaScore',
      'platformScore',
      'expansionScore',
      'dataScore',
      'marketScore',
      'totalScore'
    ].includes(key)
      ? 'desc'
      : 'asc';
  }
  renderTable();
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
  state.columnWidths[activeColumnResize.key] = Math.round(nextWidth);
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
  delete state.columnWidths[handle.dataset.resizeColumn];
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

elements.countryFilter.addEventListener('change', (event) => {
  state.country = event.target.value;
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

elements.pipelineTable.addEventListener('click', (event) => {
  if (event.target.closest('input, button, a, label')) return;
  const row = event.target.closest('[data-record-id]');
  if (!row) return;
  window.location.href = `/detail?id=${encodeURIComponent(row.dataset.recordId)}`;
});

elements.pipelineTable.addEventListener('change', (event) => {
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
elements.priorityList?.addEventListener('click', (event) => {
  const item = event.target.closest('[data-record-id]');
  if (!item) return;
  window.location.href = `/detail?id=${encodeURIComponent(item.dataset.recordId)}`;
});
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
elements.copyPromptButton?.addEventListener('click', copyPromptToClipboard);
elements.copyPromptTopButton?.addEventListener('click', copyPromptToClipboard);

setupResizableDrawer(elements.aiDrawer, 'skbp.dashboard.aiDrawerWidth', 560);
setupThemeToggle();
initializeAgentSessions();

loadRecords().catch((error) => {
  elements.dataStatus.textContent = 'Load failed';
  elements.saveStatus.textContent = error.message;
});
