import { setupThemeToggle } from './theme.js?v=20260802-header-icons-1';
import { initFloatingAgent } from './floating-agent.js?v=20260801-draggable-launcher-1';
import { initPageJumpControls } from './page-jump.js?v=20260823-page-jump-1';
import { initPipelineHeaderFreeze } from './table-header-freeze.js?v=20260830-1';
import { getCurrentUser, initAuthUI, requireAuth } from './auth.js?v=20260831-password-reset-2';
import {
  expandCompactInputRecord,
  isCompactIngestionRecord,
  isMinimalCompactIngestionRecord
} from './compact-ingestion.js?v=20260904-triage-v3-7-1';
import { splitAtRecoverableJsonSeparator } from './combined-ingestion.js?v=20260820-url-repair-6';
import { ENGLISH_CRITERIA_DRAWER_CHROME, englishCriteriaGuideMarkup } from './criteria-guide-i18n.js?v=20260904-triage-v3-7-1';

const API_URL = '/api/records';
const DASHBOARD_SUMMARY_URL = '/api/dashboard-summary';
const CATEGORY_SYNONYMS_URL = '/api/category-synonyms';
const SHORTLISTING_PROJECTS_URL = '/api/shortlisting/projects';
const USER_DIRECTORY_URL = '/api/users/directory';
const DEFAULT_SHORTLISTING_PROJECT_ID = 'oic_default';
const SHORTLISTING_PROJECT_STORAGE_KEY = 'skbp.dashboard.activeShortlistingProjectId.v1';
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_STORAGE_KEY = 'skbp.dashboard.pageSize.v1';
const STEP0_MAX_SELECTED_CANDIDATES = 20;
const STEP0_PAGE_SIZE_OPTIONS = [50, 100, 200, 500];
const STEP0_DEFAULT_PAGE_SIZE = 200;
const STEP0_PAGE_SIZE_STORAGE_KEY = 'skbp.dashboard.step0PageSize.v1';
// Last-known Step 0 stat-strip totals, kept across page loads/navigations so the
// count-up animation can start instantly on the next visit (no network round-trip),
// then get corrected once the real fetch resolves. Deliberately not scoped per-tab
// or invalidated on a timer — showing last time's numbers for an instant is better
// UX than showing zeros, and it's replaced within a second regardless.
const STEP0_STATS_CACHE_KEY = 'skbp.dashboard.step0StatsCache.v1';
const BOM_PREFIX = String.fromCharCode(0xfeff);
const AGENT_SESSION_STORAGE_KEY = 'skbp.dashboard.agentSessions.v1';
const AGENT_ACTIVE_SESSION_KEY = 'skbp.dashboard.activeAgentSession.v1';
const COLUMN_WIDTH_STORAGE_KEY = 'skbp.dashboard.columnWidths.v4';
const FOCUS_COLUMN_WIDTH_STORAGE_KEY = 'skbp.dashboard.focusColumnWidths.v9';
const CRITERIA_GUIDE_LANGUAGE_STORAGE_KEY = 'skbp.dashboard.criteriaGuideLanguage.v1';
const PIPELINE_RETURN_FOCUS_STORAGE_KEY = 'skbp.pipeline.return-focus.v1';
const PIPELINE_ROW_HIGHLIGHT_MS = 1800;
const RUBRIC_REFRESH_OUTCOME_DURATION_MS = 3000;

function encodeRecordIdForPath(recordId) {
  return encodeURIComponent(String(recordId ?? ''))
    .replace(/%2F/gi, '%252F')
    .replace(/%5C/gi, '%255C');
}

function readStoredJson(key, fallback, validator) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return validator(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function storedPageSize() {
  const value = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  return [10, 30, 50, 100].includes(value) ? value : DEFAULT_PAGE_SIZE;
}

function storedStep0PageSize() {
  const value = Number(localStorage.getItem(STEP0_PAGE_SIZE_STORAGE_KEY));
  return STEP0_PAGE_SIZE_OPTIONS.includes(value) ? value : STEP0_DEFAULT_PAGE_SIZE;
}

function readStep0StatsCache() {
  const cached = readStoredJson(
    STEP0_STATS_CACHE_KEY,
    null,
    (value) => value && typeof value === 'object' && value.stats && typeof value.stats === 'object'
  );
  if (!cached) return null;
  return {
    stats: cached.stats,
    recent_15_days: cached.recent_15_days && typeof cached.recent_15_days === 'object'
      ? cached.recent_15_days
      : { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 }
  };
}

function writeStep0StatsCache(stats, recentStats) {
  try {
    localStorage.setItem(STEP0_STATS_CACHE_KEY, JSON.stringify({ stats, recent_15_days: recentStats }));
  } catch {
    // Storage full/unavailable — the cache is a nice-to-have, not required.
  }
}

const DEFAULT_COLUMN_WIDTHS = {
  select: 34,
  company: 100,
  country: 70,
  asset: 80,
  modality: 84,
  target: 180,
  mainIndication: 120,
  stage: 94,
  // Leave room for the full INSUFFICIENT pill after the cell and pill padding.
  filter1: 104,
  filter2: 72,
  filter3: 72,
  filter3Note: 280,
  targetScore: 48,
  competitiveScore: 52,
  moaScore: 48,
  platformScore: 48,
  expansionScore: 48,
  dataScore: 50,
  marketScore: 56,
  totalScore: 52,
  focusAction: 106,
  rubricAction: 106,
  inVivo: 74,
  inVitro: 74,
  admet: 84,
  dd: 46,
  diseaseLinkage: 54,
  focusDueDate: 140,
  focusManage: 90,
  generatedAt: 116,
  extra: 180
};

const MIN_COLUMN_WIDTHS = {
  select: 32,
  company: 78,
  country: 64,
  asset: 68,
  modality: 76,
  target: 170,
  mainIndication: 105,
  stage: 86,
  // This minimum also upgrades older widths saved in localStorage on the next render.
  filter1: 102,
  filter2: 62,
  filter3: 62,
  filter3Note: 210,
  targetScore: 42,
  competitiveScore: 46,
  moaScore: 42,
  platformScore: 42,
  expansionScore: 42,
  dataScore: 44,
  marketScore: 48,
  totalScore: 46,
  focusAction: 96,
  rubricAction: 96,
  inVivo: 64,
  inVitro: 64,
  admet: 70,
  dd: 40,
  diseaseLinkage: 44,
  focusDueDate: 120,
  focusManage: 70,
  generatedAt: 102,
  extra: 110
};

const FOCUS_DEFAULT_COLUMN_WIDTHS = {
  ...DEFAULT_COLUMN_WIDTHS,
  select: 34,
  company: 90,
  country: 68,
  asset: 78,
  modality: 70,
  target: 170,
  mainIndication: 108,
  stage: 92,
  totalScore30: 64,
  filter2: 82,
  totalScore: 64,
  filter3: 82,
  inVivo: 56,
  inVitro: 56,
  admet: 60,
  dd: 42,
  diseaseLinkage: 58,
  focusDueDate: 108,
  customScore: 64,
  focusManage: 106
};

const FOCUS_MIN_COLUMN_WIDTHS = {
  ...MIN_COLUMN_WIDTHS,
  company: 78,
  country: 62,
  asset: 68,
  modality: 64,
  target: 160,
  mainIndication: 96,
  stage: 84,
  totalScore30: 52,
  filter2: 68,
  totalScore: 52,
  filter3: 66,
  inVivo: 48,
  inVitro: 48,
  admet: 50,
  dd: 38,
  diseaseLinkage: 46,
  focusDueDate: 88,
  customScore: 52,
  focusManage: 62
};

const MAX_COLUMN_WIDTH = 720;
const PROMPT_TOOLTIP =
  'GPT Advanced Research v3.8 지침을 복사합니다. Simple Research에서 SELECT된 단일 asset을 근거 중심으로 심층 조사합니다.';
const TRIAGE_PROMPT_TOOLTIP =
  'GPT Simple Research v3.7 지침을 복사합니다. 최대 50개 asset을 SELECT / REJECT / INSUFFICIENT로 screening합니다.';
const LATEST_TRIAGE_RUBRIC_VERSION = '3.7';
const LATEST_FULL_SCOUT_RUBRIC_VERSION = '3.8';
const LATEST_FULL_SCOUT_RUBRIC_DEFINITION_REVISION = 'v3-8-moa-expansion-investigation-notes-2026-09-01';
const FAST_TRIAGE_SCHEMA_VERSION = '3.2';
const FULL_SCOUT_SCHEMA_VERSION = '3.2';
const FULL_SCOUT_AGENT_INPUT_PLACEHOLDER =
  '예: E/I balance 후보 중 platform attractiveness가 가장 높은 Pipeline 두 개의 장단점을 비교해줘.';
const SHORTLISTING_AGENT_INPUT_PLACEHOLDER =
  '예: Shortlisted 후보 중 F/U Action이 필요한 Pipeline을 우선순위대로 알려줘.';
const AGENT_INPUT_PLACEHOLDERS = {
  full: FULL_SCOUT_AGENT_INPUT_PLACEHOLDER,
  focus: SHORTLISTING_AGENT_INPUT_PLACEHOLDER
};
const DATA_UPLOAD_GUIDES = {
  triage: {
    title: 'Simple Research 실행 가이드',
    recommendation: 'TAB1 전용 · GPT High · 권장 10–20개/회',
    inputLabel: 'GPT 지침 1 전체 응답',
    placeholder: [
      '새 브라우저 탭에서 GPT를 열고, 오른쪽 Simple Research 실행 가이드 순서대로 조사를 완료한 뒤 생성된 전체 응답을 그대로 붙여넣으세요.',
      '',
      '이 입력란은 Simple Research 형식만 검증합니다. 지침 1은 최대 50개까지 처리할 수 있으나 안정적인 조사를 위해 10~20개씩 실행하는 것을 권장합니다.'
    ].join('\n'),
    steps: [
      {
        title: '새 GPT 창 열기 및 모드 선택',
        body: '새 브라우저 탭에서 GPT를 열고 High 이상의 추론 모드를 선택합니다.'
      },
      {
        title: '지침 및 대상 입력',
        body: '{{prompt}} 입력 후, 조사할 Asset명과 회사명이 각각 구분되도록 입력합니다.',
        actions: [
          { token: 'prompt', kind: 'copy-prompt', promptKind: 'triage', icon: 'GPT', label: '지침 1' }
        ],
        example: 'XEN1101, Asset B, Asset C …\n\n또는\n\nXenon Pharmaceuticals · XEN1101\nCompany B · Asset B'
      },
      {
        title: '전체 응답 붙여넣기',
        body: 'GPT가 출력한 Markdown + 구분선 + Compact JSON 배열 전체를 수정하지 않고 {{input}}에 붙여넣습니다. 저장 시 기존 대시보드 구조로 자동 확장됩니다.',
        actions: [
          { token: 'input', kind: 'focus-input', icon: 'clipboard', label: 'GPT 지침 1 전체 응답' }
        ]
      },
      {
        title: '검토 후 저장',
        body: '{{review}}를 누른 뒤, 오류가 없으면 {{save}}을 누릅니다.',
        actions: [
          { token: 'review', kind: 'review', icon: '✓', label: '입력 검토' },
          { token: 'save', kind: 'save', icon: '＋', label: '검증 후 저장' }
        ]
      }
    ]
  },
  full: {
    title: 'Advanced Research 실행 가이드',
    recommendation: 'TAB2 전용 · GPT High · 1개/회',
    inputLabel: 'GPT 지침 2 전체 응답',
    placeholder: [
      '새 브라우저 탭에서 GPT를 열고, 오른쪽 Advanced Research 실행 가이드 순서대로 심층조사를 완료한 뒤 생성된 전체 응답을 그대로 붙여넣으세요.',
      '',
      '이 입력란은 Advanced Research 형식만 검증합니다. 관련 NCDP 파일이 있다면 GPT 실행 시 GPT 지침 2와 함께 첨부할 수 있습니다.'
    ].join('\n'),
    steps: [
      {
        title: '새 GPT 창 열기 및 모드 선택',
        body: '새 브라우저 탭에서 GPT를 열고 High 이상의 추론 모드를 선택합니다.'
      },
      {
        title: '지침 및 대상 입력',
        body: '{{prompt}} 입력 후, 심층 검토할 Asset명을 1개 입력합니다. 회사명을 함께 입력하면 더 좋습니다.',
        actions: [
          { token: 'prompt', kind: 'copy-prompt', promptKind: 'full', icon: 'GPT', label: '지침 2' }
        ],
        example: 'XEN1101 · Xenon Pharmaceuticals'
      },
      {
        title: '필요 시 NCDP 첨부',
        body: '관련 NCDP 파일이 있으면 GPT 실행 시 함께 첨부합니다.'
      },
      {
        title: '전체 응답 붙여넣기 및 저장',
        body: `GPT가 출력한 Markdown + 구분선 + Compact JSON 객체 전체를 {{input}}에 붙여넣습니다. 저장 시 기존 대시보드 구조로 자동 확장되며, {{review}} 후 오류가 없으면 {{save}}을 누릅니다.`,
        actions: [
          { token: 'input', kind: 'focus-input', icon: 'clipboard', label: 'GPT 지침 2 전체 응답' },
          { token: 'review', kind: 'review', icon: '✓', label: '입력 검토' },
          { token: 'save', kind: 'save', icon: '＋', label: '검증 후 저장' }
        ]
      }
    ]
  }
};
const CANONICAL_DEVELOPMENT_STAGES = [
  'Hit Discovery',
  'Lead Optimization',
  'Preclinical Candidate',
  'IND-enabling',
  'Preclinical unspecified',
  'IND filed/cleared',
  'Clinical unspecified',
  'Phase 1',
  'Phase 1/2',
  'Phase 2',
  'Phase 2/3',
  'Phase 3',
  'Registration',
  'Approved / marketed',
  'Discontinued / inactive',
  'Unknown'
];
const CANONICAL_MODALITIES = [
  'Targeted protein degrader',
  'Oncolytic virus',
  'Small molecule',
  'Peptide',
  'RNA therapy',
  'Cell therapy',
  'Gene therapy',
  'Antibody',
  'Protein biologic',
  'Microbiome therapy',
  'Vaccine',
  'Radiopharmaceutical',
  'Natural product',
  'Exosome / EV Therapy',
  'Others',
  'Unknown'
];
const CANONICAL_COUNTRIES = [
  'China',
  'Republic of Korea',
  'Japan',
  'United States',
  'Europe/UK',
  'Taiwan',
  'Singapore',
  'Canada',
  'Australia',
  'Israel',
  'Unknown'
];
const requestedTableMode = new URLSearchParams(window.location.search).get('tab');
// With no explicit ?tab=, land on Tab 0 진척 현황.
const initialViewMode = ['step0', 'triage', 'full', 'focus', 'map'].includes(requestedTableMode)
  ? requestedTableMode
  : 'focus';
const initialTableMode = ['step0', 'map'].includes(initialViewMode) ? 'full' : initialViewMode;
const initialSort = initialTableMode === 'triage'
  ? { key: 'targetScore', direction: 'desc' }
  : initialTableMode === 'focus'
    ? { key: 'focusPriority', direction: 'desc' }
    : { key: 'totalScore', direction: 'desc' };

function storedMainColumnWidths() {
  const widths = readStoredJson(
    COLUMN_WIDTH_STORAGE_KEY,
    {},
    (value) => value && typeof value === 'object' && !Array.isArray(value)
  );
  // Guarantee Stage is wide enough to wrap long labels (e.g. "Preclinical unspecified")
  // onto two lines, even for a narrower width saved under an older, smaller default.
  if (Number.isFinite(Number(widths.stage)) && Number(widths.stage) < DEFAULT_COLUMN_WIDTHS.stage) {
    widths.stage = DEFAULT_COLUMN_WIDTHS.stage;
  }
  return widths;
}

const state = {
  rawRecords: [],
  rows: [],
  dashboardSummary: null,
  dashboardSummaryRequestId: 0,
  dataUploadGuideMode: null,
  dataUploadReview: null,
  dataUploadDrafts: { triage: '', full: '' },
  dataUploadLlmReparseFields: null,
  query: '',
  searchTokens: [],
  stage: [],
  theme: [],
  cluster: [],
  modality: [],
  indication: [],
  country: [],
  pass: [],
  scoreFilters: { targetScore: [], moaScore: [], dataScore: [], competitiveScore: [], platformScore: [], expansionScore: [], marketScore: [] },
  focusFilters: emptyFocusFilters(),
  duePeriod: 'all',
  filtersByMode: {
    triage: { query: '', searchTokens: [], stage: [], theme: [], cluster: [], modality: [], indication: [], country: [], pass: [], scoreFilters: { targetScore: [], moaScore: [], dataScore: [], competitiveScore: [], platformScore: [], expansionScore: [], marketScore: [] }, focusFilters: emptyFocusFilters() },
    full: { query: '', searchTokens: [], stage: [], theme: [], cluster: [], modality: [], indication: [], country: [], pass: [], scoreFilters: { targetScore: [], moaScore: [], dataScore: [], competitiveScore: [], platformScore: [], expansionScore: [], marketScore: [] }, focusFilters: emptyFocusFilters() },
    focus: { query: '', searchTokens: [], stage: [], theme: [], cluster: [], modality: [], indication: [], country: [], pass: [], scoreFilters: { targetScore: [], moaScore: [], dataScore: [], competitiveScore: [], platformScore: [], expansionScore: [], marketScore: [] }, focusFilters: emptyFocusFilters() }
  },
  tableMode: initialTableMode,
  sortKey: initialSort.key,
  sortDirection: initialSort.direction,
  page: 1,
  pageSize: storedPageSize(),
  selectedIds: new Set(),
  step0SelectedPendingIds: new Set(),
  step0Rows: [],
  step0Stats: { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 },
  step0RecentStats: { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 },
  step0Loaded: false,
  step0ProgressLoadRequestId: 0,
  step0ProgressSnapshot: '',
  step0Query: '',
  step0SearchTokens: [],
  step0StatusFilterValues: new Set(),
  step0EvaluationFilterValues: new Set(),
  step0Filters: { country: [], modality: [], theme: [], cluster: [], indication: [], stage: [] },
  step0ColorByFilter: '',
  step0FilterSelectionOrder: [],
  step0SortKey: null,
  step0SortDirection: null,
  step0Page: 1,
  step0PageSize: storedStep0PageSize(),
  extraColumns: new Set(readStoredJson(
    'skbp.dashboard.extraColumns',
    [],
    (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')
  )),
  columnWidths: storedMainColumnWidths(),
  focusColumnWidths: readStoredJson(
    FOCUS_COLUMN_WIDTH_STORAGE_KEY,
    {},
    (value) => value && typeof value === 'object' && !Array.isArray(value)
  ),
  fittedColumnWidths: {},
  agentSessions: [],
  activeAgentSessionId: localStorage.getItem(AGENT_ACTIVE_SESSION_KEY) || '',
  categorySynonyms: { country: [], stage: [], modality: [], theme: [], indication: [] },
  categorySynonymsLoaded: false,
  latestOiPartnershipCriteriaVersion: '1.0',
  shortlistingProjects: [],
  activeShortlistingProjectId: localStorage.getItem(SHORTLISTING_PROJECT_STORAGE_KEY) || DEFAULT_SHORTLISTING_PROJECT_ID,
  settingsModalProjectId: null,
  userDirectory: [],
  userDirectoryLoaded: false
};

const elements = {
  dataStatus: document.querySelector('#dataStatus'),
  refreshButton: document.querySelector('#refreshButton'),
  dataUploadShortcutButton: document.querySelector('#dataUploadShortcutButton'),
  exportExcelButton: document.querySelector('#exportExcelButton'),
  aiDrawerButton: document.querySelector('#aiDrawerButton'),
  aiDrawer: document.querySelector('#aiDrawer'),
  aiDrawerTitle: document.querySelector('#aiDrawerTitle'),
  aiDrawerClose: document.querySelector('#aiDrawerClose'),
  criteriaDrawerButton: document.querySelector('#criteriaDrawerButton'),
  criteriaDrawer: document.querySelector('#criteriaDrawer'),
  criteriaBackdrop: document.querySelector('#criteriaBackdrop'),
  criteriaDrawerClose: document.querySelector('#criteriaDrawerClose'),
  criteriaDrawerBody: document.querySelector('#criteriaDrawer .criteria-drawer-body'),
  criteriaLanguageToggle: document.querySelector('#criteriaLanguageToggle'),
  criteriaDrawerScopeLabel: document.querySelector('#criteriaDrawerScopeLabel'),
  criteriaDrawerVersionBadge: document.querySelector('#criteriaDrawerVersionBadge'),
  criteriaDrawerSubtitle: document.querySelector('#criteriaDrawerSubtitle'),
  agentContextCount: document.querySelector('#agentContextCount'),
  agentKnowledgeNodeContext: document.querySelector('#agentKnowledgeNodeContext'),
  agentKnowledgeNodeLabel: document.querySelector('#agentKnowledgeNodeLabel'),
  agentSuggestions: document.querySelector('#agentSuggestions'),
  agentMessages: document.querySelector('#agentMessages'),
  agentForm: document.querySelector('#agentForm'),
  agentInput: document.querySelector('#agentInput'),
  agentSessionSelect: document.querySelector('#agentSessionSelect'),
  agentNewSessionButton: document.querySelector('#agentNewSessionButton'),
  agentDeleteSessionButton: document.querySelector('#agentDeleteSessionButton'),
  agentResponseModal: document.querySelector('#agentResponseModal'),
  agentResponseModalBody: document.querySelector('#agentResponseModalBody'),
  agentResponseModalClose: document.querySelector('#agentResponseModalClose'),
  agentResponseModalCopy: document.querySelector('#agentResponseModalCopy'),
  agentResponseModalStatus: document.querySelector('#agentResponseModalStatus'),
  metricTotal: document.querySelector('#metricTotal'),
  metricTotalCard: document.querySelector('#metricTotalCard'),
  metricTotalLabel: document.querySelector('#metricTotalLabel'),
  metricTotalIcon: document.querySelector('#metricTotalIcon'),
  metricPass: document.querySelector('#metricPass'),
  metricPassCard: document.querySelector('#metricPassCard'),
  metricPassLabel: document.querySelector('#metricPassLabel'),
  metricPassIcon: document.querySelector('#metricPassIcon'),
  metricScore: document.querySelector('#metricScore'),
  metricScoreCard: document.querySelector('#metricScoreCard'),
  metricScoreLabel: document.querySelector('#metricScoreLabel'),
  metricScoreIcon: document.querySelector('#metricScoreIcon'),
  metricTarget: document.querySelector('#metricTarget'),
  metricTargetCard: document.querySelector('#metricTargetCard'),
  metricTargetLabel: document.querySelector('#metricTargetLabel'),
  metricTargetIcon: document.querySelector('#metricTargetIcon'),
  metricCountries: document.querySelector('#metricCountries'),
  metricCountriesCard: document.querySelector('#metricCountriesCard'),
  metricCountriesLabel: document.querySelector('#metricCountriesLabel'),
  metricCountriesIcon: document.querySelector('#metricCountriesIcon'),
  workflowModeDescription: document.querySelector('#workflowModeDescription'),
  pipelineContent: document.querySelector('#pipelineContent'),
  visualGrid: document.querySelector('#visualGrid'),
  visualDashboardToggleButton: document.querySelector('#visualDashboardToggleButton'),
  visualDashboardToggleLabel: document.querySelector('#visualDashboardToggleLabel'),
  summaryAverageScore: document.querySelector('#summaryAverageScore'),
  summaryScopeNote: document.querySelector('#summaryScopeNote'),
  indicationChart: document.querySelector('#indicationChart'),
  indicationSummaryTitle: document.querySelector('#indicationSummaryTitle'),
  indicationSummarySubtitle: document.querySelector('#indicationSummarySubtitle'),
  modalityChart: document.querySelector('#modalityChart'),
  modalitySummaryTitle: document.querySelector('#modalitySummaryTitle'),
  modalitySummarySubtitle: document.querySelector('#modalitySummarySubtitle'),
  passRatePanel: document.querySelector('#passRatePanel'),
  passRateChart: document.querySelector('#passRateChart'),
  passRateSubtitle: document.querySelector('#passRateSubtitle'),
  workflowStatusTitle: document.querySelector('#workflowStatusTitle'),
  workflowPriorityTitle: document.querySelector('#workflowPriorityTitle'),
  workflowPrioritySubtitle: document.querySelector('#workflowPrioritySubtitle'),
  workflowPriorityList: document.querySelector('#workflowPriorityList'),
  searchInput: document.querySelector('#searchInput'),
  addSearchTokenButton: document.querySelector('#addSearchTokenButton'),
  searchTokens: document.querySelector('#searchTokens'),
  themeFilter: document.querySelector('#themeFilter'),
  clusterFilter: document.querySelector('#clusterFilter'),
  modalityFilter: document.querySelector('#modalityFilter'),
  countryFilter: document.querySelector('#countryFilter'),
  indicationFilter: document.querySelector('#indicationFilter'),
  stageFilter: document.querySelector('#stageFilter'),
  passFilter: document.querySelector('#passFilter'),
  passFilterLabel: document.querySelector('#passFilterLabel'),
  resetFiltersButton: document.querySelector('#resetFiltersButton'),
  tableCount: document.querySelector('#tableCount'),
  pageSizeSelect: document.querySelector('#pageSizeSelect'),
  columnSettingsButton: document.querySelector('#columnSettingsButton'),
  columnSettingsPanel: document.querySelector('#columnSettingsPanel'),
  columnSettingsGrid: document.querySelector('#columnSettingsGrid'),
  topShortlistingActions: document.querySelector('.top-shortlisting-actions'),
  shortlistingProjectSwitchButton: document.querySelector('#shortlistingProjectSwitchButton'),
  shortlistingProjectSwitchLabel: document.querySelector('#shortlistingProjectSwitchLabel'),
  shortlistingProjectSwitchMenu: document.querySelector('#shortlistingProjectSwitchMenu'),
  addShortlistingProjectButton: document.querySelector('#addShortlistingProjectButton'),
  shortlistingProjectModal: document.querySelector('#shortlistingProjectModal'),
  shortlistingProjectNameInput: document.querySelector('#shortlistingProjectNameInput'),
  shortlistingProjectDescriptionInput: document.querySelector('#shortlistingProjectDescriptionInput'),
  shortlistingProjectModalStatus: document.querySelector('#shortlistingProjectModalStatus'),
  shortlistingProjectModalCancel: document.querySelector('#shortlistingProjectModalCancel'),
  shortlistingProjectModalSave: document.querySelector('#shortlistingProjectModalSave'),
  shortlistingMetricModal: document.querySelector('#shortlistingMetricModal'),
  shortlistingMetricModalTitle: document.querySelector('#shortlistingMetricModalTitle'),
  shortlistingSettingsMembersTab: document.querySelector('#shortlistingSettingsMembersTab'),
  shortlistingSettingsMetricsTab: document.querySelector('#shortlistingSettingsMetricsTab'),
  shortlistingSettingsMembersPane: document.querySelector('#shortlistingSettingsMembersPane'),
  shortlistingSettingsMetricsPane: document.querySelector('#shortlistingSettingsMetricsPane'),
  shortlistingMemberManagerBody: document.querySelector('#shortlistingMemberManagerBody'),
  shortlistingMemberSearchInput: document.querySelector('#shortlistingMemberSearchInput'),
  shortlistingMemberPickerList: document.querySelector('#shortlistingMemberPickerList'),
  shortlistingMemberRoleSelect: document.querySelector('#shortlistingMemberRoleSelect'),
  shortlistingMemberAddButton: document.querySelector('#shortlistingMemberAddButton'),
  shortlistingMemberModalStatus: document.querySelector('#shortlistingMemberModalStatus'),
  shortlistingMetricManagerBody: document.querySelector('#shortlistingMetricManagerBody'),
  shortlistingMetricLabelInput: document.querySelector('#shortlistingMetricLabelInput'),
  shortlistingMetricDescriptionInput: document.querySelector('#shortlistingMetricDescriptionInput'),
  shortlistingMetricReturnTypeSelect: document.querySelector('#shortlistingMetricReturnTypeSelect'),
  shortlistingMetricListOptionsInput: document.querySelector('#shortlistingMetricListOptionsInput'),
  shortlistingMetricMaxValueInput: document.querySelector('#shortlistingMetricMaxValueInput'),
  shortlistingMetricModalStatus: document.querySelector('#shortlistingMetricModalStatus'),
  shortlistingMetricModalCancel: document.querySelector('#shortlistingMetricModalCancel'),
  shortlistingMetricModalSave: document.querySelector('#shortlistingMetricModalSave'),
  shortlistingMetricLockedNote: document.querySelector('#shortlistingMetricLockedNote'),
  shortlistingMetricAddRow: document.querySelector('#shortlistingMetricAddRow'),
  pipelineTableTabs: document.querySelectorAll('[data-table-mode]'),
  knowledgeMapTab: document.querySelector('#knowledgeMapTab'),
  knowledgeMapPanel: document.querySelector('#knowledgeMapPanel'),
  focusTabCount: document.querySelector('#focusTabCount'),
  pipelineTableHead: document.querySelector('#pipelineTableHead'),
  pipelineHeaderRow: document.querySelector('#pipelineHeaderRow'),
  selectPageRows: document.querySelector('#selectPageRows'),
  deleteSelectedButton: document.querySelector('#deleteSelectedButton'),
  pipelineTable: document.querySelector('#pipelineTable'),
  pipelineColGroup: document.querySelector('#pipelineColGroup'),
  pageInfo: document.querySelector('#pageInfo'),
  firstPage: document.querySelector('#firstPage'),
  prevPage: document.querySelector('#prevPage'),
  nextPage: document.querySelector('#nextPage'),
  lastPage: document.querySelector('#lastPage'),
  gptResponseInput: document.querySelector('#gptResponseInput'),
  dataUploadPanel: document.querySelector('#dataUploadPanel'),
  dataUploadInputLabel: document.querySelector('#dataUploadInputLabel'),
  dataUploadGuideTitle: document.querySelector('#dataUploadGuideTitle'),
  dataUploadRecommendation: document.querySelector('#dataUploadRecommendation'),
  dataUploadGuideSteps: document.querySelector('#dataUploadGuideSteps'),
  inputValidationResults: document.querySelector('#inputValidationResults'),
  previewInputButton: document.querySelector('#previewInputButton'),
  aiReparseButton: document.querySelector('#aiReparseButton'),
  saveJsonButton: document.querySelector('#saveJsonButton'),
  clearJsonButton: document.querySelector('#clearJsonButton'),
  saveStatus: document.querySelector('#saveStatus'),
  copyTriagePromptTopButton: document.querySelector('#copyTriagePromptTopButton'),
  copyPromptTopButton: document.querySelector('#copyPromptTopButton'),
  copyPromptButton: document.querySelector('#copyPromptButton'),
  promptCopyStatus: document.querySelector('#promptCopyStatus'),
  dataReuploadModal: document.querySelector('#dataReuploadModal'),
  dataReuploadTitle: document.querySelector('#dataReuploadTitle'),
  dataReuploadSummary: document.querySelector('#dataReuploadSummary'),
  dataReuploadList: document.querySelector('#dataReuploadList'),
  dataReuploadCancel: document.querySelector('#dataReuploadCancel'),
  dataReuploadContinue: document.querySelector('#dataReuploadContinue'),
  dataReuploadApply: document.querySelector('#dataReuploadApply'),
  step0ImportReviewModal: document.querySelector('#step0ImportReviewModal'),
  step0ImportReviewSummary: document.querySelector('#step0ImportReviewSummary'),
  step0ImportReviewList: document.querySelector('#step0ImportReviewList'),
  step0ImportReviewCancel: document.querySelector('#step0ImportReviewCancel'),
  step0ImportReviewApply: document.querySelector('#step0ImportReviewApply'),
  operationModal: document.querySelector('#operationModal'),
  operationModalTitle: document.querySelector('#operationModalTitle'),
  operationModalMessage: document.querySelector('#operationModalMessage'),
  operationModalStatus: document.querySelector('#operationModalStatus'),
  operationCancelButton: document.querySelector('#operationCancelButton'),
  step0PasteProcessingModal: document.querySelector('#step0PasteProcessingModal'),
  step0PasteProcessingDialog: document.querySelector('#step0PasteProcessingDialog'),
  step0PasteProcessingStatus: document.querySelector('#step0PasteProcessingStatus'),
  step0EntryGridMappingStatus: document.querySelector('#step0EntryGridMappingStatus'),
  pipelineWebsiteModal: document.querySelector('#pipelineWebsiteModal'),
  pipelineWebsiteModalInput: document.querySelector('#pipelineWebsiteModalInput'),
  pipelineWebsiteModalStatus: document.querySelector('#pipelineWebsiteModalStatus'),
  pipelineWebsiteModalCancel: document.querySelector('#pipelineWebsiteModalCancel'),
  pipelineWebsiteModalSave: document.querySelector('#pipelineWebsiteModalSave'),
  step0Panel: document.querySelector('#step0Panel'),
  step0EntryGrid: document.querySelector('#step0EntryGrid'),
  step0EntryGridBody: document.querySelector('#step0EntryGridBody'),
  step0AddEntryRow: document.querySelector('#step0AddEntryRow'),
  step0PasteFeedback: document.querySelector('#step0PasteFeedback'),
  step0ImportButton: document.querySelector('#step0ImportButton'),
  step0ClearButton: document.querySelector('#step0ClearButton'),
  step0ClearBottomButton: document.querySelector('#step0ClearBottomButton'),
  step0ImportSummary: document.querySelector('#step0ImportSummary'),
  step0SaveStatus: document.querySelector('#step0SaveStatus'),
  step0GuideSteps: document.querySelector('#step0GuideSteps'),
  step0SummaryDashboard: document.querySelector('.step0-summary-dashboard'),
  step0SummaryCards: document.querySelector('#step0SummaryCards'),
  step0SummaryDashboardToggleButton: document.querySelector('#step0SummaryDashboardToggleButton'),
  step0SummaryDashboardToggleLabel: document.querySelector('#step0SummaryDashboardToggleLabel'),
  step0SummaryScopeNote: document.querySelector('#step0SummaryScopeNote'),
  step0SummaryRecentUpload: document.querySelector('#step0SummaryRecentUpload'),
  step0WorkflowCardCanvases: document.querySelectorAll('.step0-workflow-card-canvas'),
  step0WorkflowStatColumns: document.querySelectorAll('.step0-stat-column'),
  step0StatPending: document.querySelector('#step0StatPending'),
  step0StatFastTriage: document.querySelector('#step0StatFastTriage'),
  step0StatFullScout: document.querySelector('#step0StatFullScout'),
  step0StatShortlisted: document.querySelector('#step0StatShortlisted'),
  step0StatFilterButtons: document.querySelectorAll('[data-step0-stat-filter]'),
  step0RecentPending: document.querySelector('#step0RecentPending'),
  step0RecentFastTriage: document.querySelector('#step0RecentFastTriage'),
  step0RecentFullScout: document.querySelector('#step0RecentFullScout'),
  step0RecentShortlisted: document.querySelector('#step0RecentShortlisted'),
  step0WorkflowMap: document.querySelector('[data-step0-workflow-map="pending"]'),
  step0WorkflowMaps: document.querySelectorAll('[data-step0-workflow-map]'),
  step0SearchInput: document.querySelector('#step0SearchInput'),
  step0AddSearchTokenButton: document.querySelector('#step0AddSearchTokenButton'),
  step0SearchTokens: document.querySelector('#step0SearchTokens'),
  step0FilterControls: document.querySelector('#step0Panel .control-panel .controls'),
  step0CountryFilter: document.querySelector('#step0CountryFilter'),
  step0ModalityFilter: document.querySelector('#step0ModalityFilter'),
  step0ThemeFilter: document.querySelector('#step0ThemeFilter'),
  step0ClusterFilter: document.querySelector('#step0ClusterFilter'),
  step0IndicationFilter: document.querySelector('#step0IndicationFilter'),
  step0StageFilter: document.querySelector('#step0StageFilter'),
  step0ProgressFilter: document.querySelector('#step0ProgressFilter'),
  step0ResetFiltersButton: document.querySelector('#step0ResetFiltersButton'),
  step0TableCount: document.querySelector('#step0TableCount'),
  step0PageSizeSelect: document.querySelector('#step0PageSizeSelect'),
  step0SelectAllRows: document.querySelector('#step0SelectAllRows'),
  step0ProgressTableBody: document.querySelector('#step0ProgressTableBody'),
  step0SelectedCount: document.querySelector('#step0SelectedCount'),
  step0CopyInstructionsButton: document.querySelector('#step0CopyInstructionsButton'),
  step0ExportExcelButton: document.querySelector('#step0ExportExcelButton'),
  step0FirstPage: document.querySelector('#step0FirstPage'),
  step0PrevPage: document.querySelector('#step0PrevPage'),
  step0PageInfo: document.querySelector('#step0PageInfo'),
  step0NextPage: document.querySelector('#step0NextPage'),
  step0LastPage: document.querySelector('#step0LastPage'),
  step0EditLockedModal: document.querySelector('#step0EditLockedModal'),
  step0EditLockedTitle: document.querySelector('#step0EditLockedTitle'),
  step0EditLockedMessage: document.querySelector('#step0EditLockedMessage'),
  step0EditLockedClose: document.querySelector('#step0EditLockedClose'),
  step0EditLockedGo: document.querySelector('#step0EditLockedGo')
};

let activeColumnResize = null;
let promptCopyFeedbackTimer = null;
let targetContextTooltip = null;
let targetContextAnchor = null;
let step0DragSelection = null;
let pipelineDragSelection = null;
let activeStep0MetadataPopover = null;
let activeStep0LockedEditMode = null;
let activeStep0LockedRecordId = null;
let step0WorkflowG6Graphs = [];
let step0WorkflowG6RenderTimers = [];
let step0WorkflowG6RetryTimer = null;
let step0WorkflowG6AnimationFrames = [];
let step0StatAnimationFrames = [];
let step0StatAnimationTimers = [];
// Lets renderStep0StatStrip() skip resetting to 0 and replaying the count-up when
// called again with the exact same totals it just showed — expected now that a
// render can be triggered up to three times in quick succession (cache, the fast
// stats-only endpoint, the full progress table) and they usually all agree.
let step0StatStripLastRenderKey = null;
let dashboardDonutAnimationFrames = [];
let dashboardDonutAnimationTimers = [];
const focusSaveQueues = new Map();
const shortlistingProjectSaveQueues = new Map();
let dataReuploadResolve = null;
let activeDataReuploadMatches = [];
let activeDataReuploadDecisions = new Map();
let step0ImportReviewResolve = null;
let activeStep0ImportReviewMatches = [];
let activeStep0ImportReviewDecisions = new Map();
let activeBlockingOperation = null;
let activePipelineWebsiteEditor = null;
let pipelineWebsiteOpenTimer = null;
const OPERATION_CANCELLED = Symbol('operation-cancelled');

function openBlockingOperation({
  title = '잠시만 기다려 주세요',
  message = '작업이 끝날 때까지 다른 화면으로 이동하지 마세요.',
  status = '요청을 처리하고 있습니다.'
} = {}) {
  const controller = new AbortController();
  const token = Symbol('blocking-operation');
  activeBlockingOperation = { token, controller };
  if (elements.operationModalTitle) elements.operationModalTitle.textContent = title;
  if (elements.operationModalMessage) elements.operationModalMessage.textContent = message;
  if (elements.operationModalStatus) elements.operationModalStatus.textContent = status;
  if (elements.operationCancelButton) {
    elements.operationCancelButton.disabled = false;
    elements.operationCancelButton.textContent = '실행 취소';
  }
  if (elements.operationModal) elements.operationModal.hidden = false;
  document.body.classList.add('operation-modal-open');
  window.setTimeout(() => elements.operationCancelButton?.focus(), 0);
  return { token, signal: controller.signal };
}

function closeBlockingOperation(token) {
  if (!activeBlockingOperation || activeBlockingOperation.token !== token) return;
  activeBlockingOperation = null;
  if (elements.operationModal) elements.operationModal.hidden = true;
  document.body.classList.remove('operation-modal-open');
}

async function runBlockingOperation(options, operation) {
  const blockingOperation = openBlockingOperation(options);
  const startedAt = performance.now();
  // A local JSON request can finish before the browser gets a chance to paint
  // the overlay. Yielding two frames makes the shared hourglass feedback
  // visible for quick saves as well as slower server operations.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    return await operation(blockingOperation.signal);
  } catch (error) {
    if (blockingOperation.signal.aborted || error?.name === 'AbortError') return OPERATION_CANCELLED;
    throw error;
  } finally {
    if (elements.operationCancelButton) elements.operationCancelButton.disabled = true;
    const minimumVisibleMs = Number(options?.minimumVisibleMs ?? 360);
    const remainingMs = Math.max(0, minimumVisibleMs - (performance.now() - startedAt));
    if (remainingMs) await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
    closeBlockingOperation(blockingOperation.token);
  }
}

function showRubricRefreshFailureDialog(title, message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'operation-modal-backdrop listing-import-error-backdrop';
    backdrop.innerHTML = `
      <section class="operation-modal listing-import-error-modal" role="dialog" aria-modal="true" aria-labelledby="rubricRefreshErrorTitle" aria-describedby="rubricRefreshErrorMessage">
        <header class="operation-modal-header">
          <span class="operation-modal-mark listing-import-error-mark" aria-hidden="true">!</span>
          <div><p class="operation-modal-eyebrow">SCORE REFRESH</p><h2 id="rubricRefreshErrorTitle">${escapeHtml(title)}</h2></div>
        </header>
        <p class="operation-modal-copy" id="rubricRefreshErrorMessage">${escapeHtml(message)}</p>
        <footer class="operation-modal-actions operation-confirm-actions">
          <button type="button" class="operation-modal-confirm" data-rubric-refresh-error-close>확인</button>
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
    backdrop.querySelector('[data-rubric-refresh-error-close]')?.addEventListener('click', close);
    document.body.appendChild(backdrop);
    document.body.classList.add('operation-modal-open');
    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('[data-rubric-refresh-error-close]')?.focus();
  });
}

function showRubricRefreshOutcomeToast(title, message, eyebrow = 'FILTER 2') {
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

function rubricRefreshOutcomeCopy(data, workflowLabel, latestVersion) {
  const appliedVersion = data.rubric_version || latestVersion;
  const cleared = Array.isArray(data.cleared_manual_scoring_override_fields)
    ? data.cleared_manual_scoring_override_fields
    : [];
  const filterLabel = workflowLabel === 'Simple Research' ? 'Filter 1' : 'Filter 2';
  if (data.status === 'updated') {
    return {
      title: `${filterLabel} AI 재평가 완료`,
      message: `${workflowLabel} v${appliedVersion} 기준으로 GPT 원문 리포트와 첨부 자료를 다시 평가했습니다. criterion 점수, Total Score, ${filterLabel} 결과를 갱신했고 변경 이력에 기록했습니다.`
    };
  }
  if (['no_evidence', 'no_score_changes'].includes(data.status)) {
    return {
      title: `${filterLabel} AI 재평가 완료 · 점수 유지`,
      message: `${workflowLabel} v${appliedVersion} 기준으로 GPT 원문 리포트와 첨부 자료를 검토했습니다. 변경을 뒷받침할 근거가 없어 기존 criterion 점수와 ${filterLabel} 결과를 유지했고 변경 이력에 기록했습니다.`
    };
  }
  if (data.status === 'recalculated') {
    return {
      title: `${filterLabel} 재계산 완료`,
      message: `${workflowLabel} v${appliedVersion} 기준을 적용했습니다. 저장된 criterion 점수는 유지하고 Total Score와 ${filterLabel} 결과를 다시 계산했으며, 변경 이력에 기록했습니다.`
    };
  }
  if (cleared.length && data.official_recalculation_applied === true) {
    const resetItems = [
      cleared.includes('scores') ? '수동 기준별 점수' : '',
      cleared.includes('total_score') ? '수동 Total Score' : ''
    ].filter(Boolean).join(' 및 ') || '수동 점수 설정';
    return {
      title: '최신 Score 기준 갱신 완료',
      message: `${workflowLabel} v${appliedVersion} 기준을 적용했습니다. ${resetItems}는 해제되고 GPT 원문에 저장된 공식 점수로 Total과 Filter를 다시 계산했습니다.`
    };
  }
  if (data.status === 'manual_override_reset' || cleared.length) {
    const resetItems = [
      cleared.includes('scores') ? '수동 기준별 점수' : '',
      cleared.includes('total_score') ? '수동 Total Score' : ''
    ].filter(Boolean).join(' 및 ') || '수동 점수 설정';
    return {
      title: '수동 점수 오버라이드 해제 완료',
      message: `${workflowLabel} v${appliedVersion}은 이미 적용되어 있어 ${resetItems}만 해제했습니다. GPT 원문에 저장된 공식 점수로 복원했고, 변경 이력에 기록했습니다.`
    };
  }
  if (data.status === 'already_current' || data.changed === false) {
    return {
      title: `이미 최신 ${workflowLabel} 기준입니다`,
      message: `${workflowLabel} v${appliedVersion} 기준과 현재 점수·Filter 결과가 이미 적용되어 있습니다. 변경 사항이 없어 변경 이력은 추가하지 않았습니다.`
    };
  }
  return {
    title: 'Score 기준 재계산 완료',
    message: `${workflowLabel} Score 기준 v${appliedVersion} 재계산을 완료했고, 변경 이력에 기록했습니다.`
  };
}

async function ensureDashboardActorName() {
  const user = getCurrentUser() || await requireAuth();
  const actorName = String(user?.name || '').trim();
  return actorName || null;
}

function normalizedPipelineIdentityText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizedPipelineAssetIdentity(value) {
  return normalizedPipelineIdentityText(value).replace(/(?<=[a-z])0+(?=\d)/g, '');
}

// Search treats code punctuation, spacing, case, and Unicode-width variants as
// non-semantic, so Meta01 and Meta-01 resolve to the same dashboard result.
function normalizedDashboardSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    // Match the safe code-only import equivalence: ABL-001 and ABL1 have
    // the same alphabetic prefix and numeric core. This does not reorder or
    // fuzzy-match digits, words, aliases, or company names.
    .replace(/(?<=[a-z])0+(?=\d)/g, '');
}

// Descriptive Listing names often share formulation scaffolding.  These words
// do not identify the program itself, so descriptive names need two meaningful
// asset terms in common before they create a review match.
const GENERIC_ASSET_WORDS = new Set([
  'therapy', 'therapies', 'drug', 'drugs', 'treatment', 'treatments',
  'research', 'project', 'program', 'pipeline', 'disease', 'diseases',
  'disorder', 'disorders', 'candidate', 'small', 'molecule', 'molecules',
  'inhibit', 'inhibits', 'inhibiting', 'inhibition', 'inhibitor', 'inhibitors',
  'target', 'targets', 'targeting', 'to', 'for', 'of', 'the', 'and', 'a', 'an'
]);
const HIGH_CONFIDENCE_ASSET_ALIASES = new Map([
  ['ad', 'alzheimer'], ['alzheimers', 'alzheimer'],
  ['pd', 'parkinson'], ['parkinsons', 'parkinson']
]);

function assetWords(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en')
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function normalizedCodePart(part) {
  return /^\d+$/.test(part) ? (part.replace(/^0+(?=\d)/, '') || '0') : part;
}

function pipelineAssetArchetype(value) {
  const raw = String(value || '').trim();
  if (/^\d+$/.test(raw)) return 'numeric';
  if (/^[a-z0-9]+(?:[-_/][a-z0-9]+)*$/i.test(raw) && /[a-z]/i.test(raw) && /\d/.test(raw)) return 'code';
  if (/^[\p{L}]+$/u.test(raw)) return 'named';
  return 'descriptive';
}

function pipelineAssetCodeSignature(value) {
  if (pipelineAssetArchetype(value) !== 'code') return [];
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en')
    .match(/[a-z]+|\d+/g)?.map(normalizedCodePart) || [];
}

function pipelineAssetNumericCore(value) {
  const archetype = pipelineAssetArchetype(value);
  if (archetype === 'numeric') return [normalizedCodePart(String(value).trim())];
  if (archetype !== 'code') return [];
  return pipelineAssetCodeSignature(value).filter((part) => /^\d+$/.test(part));
}

function sameParts(left, right) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function isSimpleCodeWithPrefixAndNumber(value) {
  const signature = pipelineAssetCodeSignature(value);
  return signature.length === 2 && /^[a-z]+$/.test(signature[0]) && /^\d+$/.test(signature[1]);
}

function descriptiveAssetsSemanticallyOverlap(left, right) {
  const meaningfulTokens = (value) => new Set(assetWords(value)
    .map((word) => HIGH_CONFIDENCE_ASSET_ALIASES.get(word) || word)
    .filter((word) => word.length > 1 && !GENERIC_ASSET_WORDS.has(word)));
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  return [...leftTokens].filter((token) => rightTokens.has(token)).length >= 2;
}

function comparePipelineAssets(leftIdentity, rightIdentity) {
  const left = leftIdentity.asset;
  const right = rightIdentity.asset;
  const sameCompany = Boolean(leftIdentity.normalizedCompany)
    && leftIdentity.normalizedCompany === rightIdentity.normalizedCompany;
  const leftType = pipelineAssetArchetype(left);
  const rightType = pipelineAssetArchetype(right);
  if (!leftIdentity.normalizedAsset || !rightIdentity.normalizedAsset) return false;
  if (leftType === 'code' && rightType === 'code') {
    if (leftIdentity.normalizedAsset === rightIdentity.normalizedAsset) return true;
    if (sameParts(pipelineAssetCodeSignature(left), pipelineAssetCodeSignature(right))) return true;
    return sameCompany
      && isSimpleCodeWithPrefixAndNumber(left)
      && isSimpleCodeWithPrefixAndNumber(right)
      && sameParts(pipelineAssetNumericCore(left), pipelineAssetNumericCore(right));
  }
  if ((leftType === 'code' && rightType === 'numeric') || (leftType === 'numeric' && rightType === 'code')) {
    return sameCompany && sameParts(pipelineAssetNumericCore(left), pipelineAssetNumericCore(right));
  }
  if (leftType === 'named' && rightType === 'named') {
    return leftIdentity.normalizedAsset === rightIdentity.normalizedAsset;
  }
  if (leftType === 'descriptive' && rightType === 'descriptive' && sameCompany) {
    return leftIdentity.normalizedAsset === rightIdentity.normalizedAsset
      || descriptiveAssetsSemanticallyOverlap(left, right);
  }
  return false;
}

function editDistance(left, right) {
  const a = String(left || ''); const b = String(right || '');
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function dataUploadRecordIdentity(record) {
  const table = isInputObject(record?.structured_table) ? record.structured_table : {};
  const summary = isInputObject(record?.json_summary) ? record.json_summary : {};
  const mode = detectInputRecordMode(record).mode;
  const company = String(table.company || summary.company || '').trim();
  const asset = String(table.asset_name || summary.asset_name || '').trim();
  return {
    mode,
    company,
    asset,
    normalizedCompany: normalizedPipelineIdentityText(company),
    normalizedAsset: normalizedPipelineAssetIdentity(asset)
  };
}

function dataUploadRecordRecency(record) {
  const meta = isInputObject(record?.meta) ? record.meta : {};
  const parsed = Date.parse(meta.generated_at || meta.completed_at || '');
  if (Number.isFinite(parsed)) return parsed;
  const idDate = String(meta.output_filename_base || '').match(/(20\d{6})(?!.*20\d{6})/)?.[1];
  return idDate ? Date.parse(`${idDate.slice(0, 4)}-${idDate.slice(4, 6)}-${idDate.slice(6, 8)}`) || 0 : 0;
}

function parentheticalPipelineAliases(value) {
  return new Set(String(value || '').normalize('NFKC')
    .split(/\s*(?:[()\[\]]|\/|\||;|,)\s*/u)
    .map((part) => normalizedPipelineIdentityText(part))
    .filter(Boolean));
}

function hasConfirmedPipelineAliasOverlap(leftIdentity, rightIdentity) {
  if (leftIdentity.mode !== rightIdentity.mode) return false;
  const rightAssetAliases = parentheticalPipelineAliases(rightIdentity.asset);
  const rightCompanyAliases = parentheticalPipelineAliases(rightIdentity.company);
  return [...parentheticalPipelineAliases(leftIdentity.asset)].some((alias) => rightAssetAliases.has(alias))
    && [...parentheticalPipelineAliases(leftIdentity.company)].some((alias) => rightCompanyAliases.has(alias));
}

function findDataReuploadMatches(records) {
  return records.flatMap((incomingRecord, incomingIndex) => {
    const incomingIdentity = dataUploadRecordIdentity(incomingRecord);
    if (!incomingIdentity.normalizedAsset) return [];
    const incomingRecordId = recordIdentifier(incomingRecord);
    const candidates = state.rawRecords
      .filter((existingRecord) => {
        const existingIdentity = dataUploadRecordIdentity(existingRecord);
        if (existingIdentity.mode !== incomingIdentity.mode || !existingIdentity.normalizedAsset) return false;
        return comparePipelineAssets(incomingIdentity, existingIdentity)
          || hasConfirmedPipelineAliasOverlap(incomingIdentity, existingIdentity);
      })
      .sort((a, b) => {
        const identityA = dataUploadRecordIdentity(a);
        const identityB = dataUploadRecordIdentity(b);
        const exactA = Number(identityA.normalizedAsset === incomingIdentity.normalizedAsset);
        const exactB = Number(identityB.normalizedAsset === incomingIdentity.normalizedAsset);
        const sameCompanyA = Number(identityA.normalizedCompany === incomingIdentity.normalizedCompany);
        const sameCompanyB = Number(identityB.normalizedCompany === incomingIdentity.normalizedCompany);
        return exactB - exactA || sameCompanyB - sameCompanyA || dataUploadRecordRecency(b) - dataUploadRecordRecency(a);
      });
    if (!candidates.length) return [];
    return [{
      kind: 'existing-record',
      decisionKey: `existing:${incomingIndex}`,
      incomingIndex,
      incomingRecordId,
      mode: incomingIdentity.mode,
      company: incomingIdentity.company,
      asset: incomingIdentity.asset,
      stage: String(incomingRecord?.structured_table?.development_stage || 'Unknown'),
      candidates: candidates.map((candidate) => {
        const identity = dataUploadRecordIdentity(candidate);
        const exactAsset = identity.normalizedAsset === incomingIdentity.normalizedAsset;
        const sameCompany = Boolean(incomingIdentity.normalizedCompany)
          && identity.normalizedCompany === incomingIdentity.normalizedCompany;
        return {
          id: recordIdentifier(candidate),
          asset: identity.asset,
          company: identity.company,
          stage: String(candidate?.structured_table?.development_stage || 'Unknown'),
          matchType: exactAsset ? 'exact' : 'similar',
          similarity: exactAsset ? '정규화 자산명 일치' : '유사 자산명',
          sameCompany
        };
      })
    }];
  });
}

function findIncomingDuplicateMatches(records, duplicateGroups = []) {
  return duplicateGroups.flatMap((group, groupIndex) => {
    const indexes = Array.isArray(group?.indexes)
      ? group.indexes.filter((index) => Number.isInteger(index) && records[index])
      : [];
    if (indexes.length < 2) return [];
    const candidates = indexes.map((incomingIndex) => {
      const record = records[incomingIndex];
      const identity = dataUploadRecordIdentity(record);
      return {
        incomingIndex,
        id: String(group.record_id || recordIdentifier(record)),
        asset: identity.asset,
        company: identity.company,
        stage: String(record?.structured_table?.development_stage || 'Unknown')
      };
    });
    const first = candidates[0];
    return [{
      kind: 'incoming-duplicate',
      decisionKey: `incoming-duplicate:${groupIndex}`,
      incomingRecordId: String(group.record_id || first.id),
      incomingIndexes: indexes,
      asset: first.asset,
      company: first.company,
      stage: first.stage,
      candidates
    }];
  });
}

function dataReuploadDecisionFor(decisionKey) {
  return activeDataReuploadDecisions.get(decisionKey) || { action: 'pending' };
}

function renderDataReuploadComparisonColumn(title, asset, company, stageOrDetails) {
  const stage = typeof stageOrDetails === 'object' && stageOrDetails !== null
    ? stageOrDetails.stage
    : stageOrDetails;
  const fields = [
    ['Asset', asset || 'Unknown asset'],
    ['Company', company || 'Unknown company'],
    ['Pipeline Stage', stage || 'Unknown']
  ];
  return `
    <section class="data-reupload-comparison-column">
      <p>${escapeHtml(title)}</p>
      <dl>
        ${fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
      </dl>
    </section>
  `;
}

function step0ListingValuesConflict(match, candidate) {
  if (String(match.asset || '').trim() !== String(candidate.asset || '').trim()
    || String(match.company || '').trim() !== String(candidate.company || '').trim()) {
    return true;
  }
  const incomingDetails = match.listing_details || {};
  const existingDetails = candidate.listing_details || {};
  return ['country', 'modality', 'target', 'main_indication', 'stage', 'website'].some((field) => {
    const incomingValue = String(incomingDetails[field] || '').trim();
    const existingValue = String(existingDetails[field] || '').trim();
    return incomingValue && existingValue && incomingValue !== existingValue;
  });
}

function renderDataReuploadReviewList() {
  if (!elements.dataReuploadList) return;
  elements.dataReuploadList.innerHTML = activeDataReuploadMatches.map((match) => {
    const decision = dataReuploadDecisionFor(match.decisionKey);
    if (match.kind === 'incoming-duplicate') {
      const selectedIndex = Number.isInteger(decision.selectedIncomingIndex)
        ? decision.selectedIncomingIndex
        : null;
      return `
        <article class="data-reupload-review-card" data-reupload-incoming="${escapeHtml(match.decisionKey)}">
          <header class="data-reupload-review-card-header">
            <div><strong>${escapeHtml(match.asset || 'Unknown asset')}</strong><span>이번 업로드 안에서 동일 Pipeline으로 인식된 항목</span></div>
            <span class="data-reupload-review-state" data-state="${selectedIndex === null ? 'pending' : 'replace'}">${selectedIndex === null ? '선택 필요' : '업로드 항목 선택'}</span>
          </header>
          <div class="data-reupload-candidate-stack">
            ${(match.candidates || []).map((candidate) => {
              const selected = candidate.incomingIndex === selectedIndex;
              return `
                <section class="data-reupload-candidate${selected ? ' is-selected' : ''}" data-candidate-id="${escapeHtml(String(candidate.incomingIndex))}">
                  <div class="data-reupload-candidate-heading">
                    <span class="data-reupload-match-badge exact">입력 ${candidate.incomingIndex + 1}번</span>
                    <span class="data-reupload-company-match">${escapeHtml(candidate.company || 'Unknown company')} · ${escapeHtml(candidate.stage || 'Unknown')}</span>
                  </div>
                  <div class="data-reupload-comparison-scroll" tabindex="0" aria-label="동일 Pipeline으로 인식된 이번 업로드 후보 비교">
                    <div class="data-reupload-comparison-grid">
                      ${renderDataReuploadComparisonColumn('이번 업로드 후보', candidate.asset, candidate.company, candidate.stage)}
                      ${renderDataReuploadComparisonColumn('검토 안내', '동일 Pipeline 후보', '한 항목만 업로드', '검토 후 한 항목 유지')}
                    </div>
                  </div>
                  <div class="data-reupload-candidate-actions">
                    <button type="button" class="identity-modal-submit" data-reupload-action="keep-incoming" data-match-key="${escapeHtml(match.decisionKey)}" data-incoming-index="${candidate.incomingIndex}">이 항목 유지</button>
                  </div>
                </section>
              `;
            }).join('')}
          </div>
        </article>
      `;
    }
    const isSkipped = decision.action === 'skip';
    return `
      <article class="data-reupload-review-card${isSkipped ? ' is-skipped' : ''}" data-reupload-incoming="${escapeHtml(match.decisionKey)}">
        <header class="data-reupload-review-card-header">
          <div><strong>${escapeHtml(match.asset || 'Unknown asset')}</strong><span>${escapeHtml(match.company || 'Unknown company')} · ${escapeHtml(match.stage || 'Unknown')}</span></div>
          <span class="data-reupload-review-state" data-state="${escapeHtml(decision.action)}">${decision.action === 'replace' ? '덮어쓰기 선택' : isSkipped ? '이번 업로드 제외' : '검토 필요'}</span>
        </header>
        <div class="data-reupload-candidate-stack">
          ${(match.candidates || []).map((candidate) => {
            const selected = decision.action === 'replace' && decision.existingRecordId === candidate.id;
            return `
              <section class="data-reupload-candidate${selected ? ' is-selected' : ''}" data-candidate-id="${escapeHtml(candidate.id)}">
                <div class="data-reupload-candidate-heading">
                  <span class="data-reupload-match-badge ${escapeHtml(candidate.matchType)}">${candidate.matchType === 'exact' ? '정규화 일치' : '유사 이름'}</span>
                  <span class="data-reupload-company-match">${candidate.sameCompany ? '회사 일치' : '회사 다름 · 확인 필요'}</span>
                </div>
                <div class="data-reupload-comparison-scroll" tabindex="0" aria-label="새 업로드와 기존 Pipeline 비교">
                  <div class="data-reupload-comparison-grid">
                    ${renderDataReuploadComparisonColumn('새로 업로드', match.asset, match.company, match.stage)}
                    ${renderDataReuploadComparisonColumn('기존 Pipeline', candidate.asset, candidate.company, candidate.stage)}
                  </div>
                </div>
                <div class="data-reupload-candidate-actions">
                  <button type="button" class="identity-modal-submit" data-reupload-action="replace" data-match-key="${escapeHtml(match.decisionKey)}" data-existing-id="${escapeHtml(candidate.id)}">덮어쓰기</button>
                  <button type="button" class="identity-modal-cancel" data-reupload-action="skip" data-match-key="${escapeHtml(match.decisionKey)}" data-existing-id="${escapeHtml(candidate.id)}">이번 업로드 제외</button>
                </div>
              </section>
            `;
          }).join('')}
          ${['replace', 'skip'].includes(decision.action) ? `
            <div class="step0-import-alias-guidance">
              <span>기존·변경 Asset/Company 이름을 검색용 메타데이터로 함께 저장할 수 있습니다.</span>
              <button type="button" class="identity-modal-cancel${decision.preserveAssetAliases ? ' is-active' : ''}" data-reupload-action="preserve-aliases" data-match-key="${escapeHtml(match.decisionKey)}">${decision.preserveAssetAliases ? '유사 Asset / Company 이름 저장됨' : '유사 Asset / Company 이름도 함께 저장'}</button>
            </div>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function reviewedDataReuploadDecisions(defaultAction = 'continue', applyToAll = false) {
  return activeDataReuploadMatches.map((match) => {
    const decision = dataReuploadDecisionFor(match.decisionKey);
    if (match.kind === 'incoming-duplicate') {
      const selectedIncomingIndex = Number.isInteger(decision.selectedIncomingIndex)
        ? decision.selectedIncomingIndex
        : null;
      return {
        ...match,
        selectedIncomingIndex,
        unresolved: selectedIncomingIndex === null,
        skipIncomingIndexes: selectedIncomingIndex === null
          ? []
          : match.incomingIndexes.filter((index) => index !== selectedIncomingIndex)
      };
    }
    const action = applyToAll || decision.action === 'pending' ? defaultAction : decision.action;
    return {
      ...match,
      existingRecordId: decision.existingRecordId || null,
      replaceExisting: action === 'replace',
      skipIncoming: action === 'skip',
      preserveAssetAliases: decision.preserveAssetAliases === true
    };
  });
}

function closeDataReuploadModal(decisions = null) {
  if (elements.dataReuploadModal) elements.dataReuploadModal.hidden = true;
  if (elements.dataReuploadContinue) elements.dataReuploadContinue.hidden = false;
  const resolve = dataReuploadResolve;
  dataReuploadResolve = null;
  if (resolve) resolve(decisions);
  activeDataReuploadMatches = [];
  activeDataReuploadDecisions = new Map();
}

function openDataReuploadModal(matches) {
  if (!elements.dataReuploadModal) return Promise.resolve(null);
  return new Promise((resolve) => {
    dataReuploadResolve = resolve;
    activeDataReuploadMatches = matches;
    activeDataReuploadDecisions = new Map();
    const incomingDuplicateMatches = matches.filter((match) => match.kind === 'incoming-duplicate');
    const existingMatches = matches.filter((match) => match.kind !== 'incoming-duplicate');
    const candidateCount = matches.reduce((count, match) => count + (match.candidates || []).length, 0);
    elements.dataReuploadTitle.textContent = incomingDuplicateMatches.length
      ? `이번 업로드 안에 동일 Pipeline 후보가 ${incomingDuplicateMatches.length}건 있습니다.`
      : `유사한 기존 Pipeline이 ${existingMatches.length}건 있습니다.`;
    if (elements.dataReuploadSummary) {
      elements.dataReuploadSummary.innerHTML = incomingDuplicateMatches.length
        ? `동일 Pipeline으로 인식된 조사 결과는 자동 병합하지 않습니다. 각 항목에서 <span class="data-reupload-inline-action is-replace"><svg viewBox="0 0 24" focusable="false" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5" /></svg>이 항목 유지</span>를 하나 선택하면 나머지는 이번 업로드에서 제외됩니다.`
        : `비교 후 각 항목별로 <span class="data-reupload-inline-action is-replace"><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>덮어쓰기</span>를 선택한 뒤 <span class="data-reupload-inline-action is-apply"><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5" /></svg>선택 적용</span>하면 반영됩니다.`;
    }
    if (elements.dataReuploadContinue) elements.dataReuploadContinue.hidden = incomingDuplicateMatches.length > 0;
    renderDataReuploadReviewList();
    elements.dataReuploadModal.hidden = false;
    elements.dataReuploadApply?.focus();
  });
}

async function reviewDataReuploadMatches(matches) {
  return openDataReuploadModal(matches);
}

function step0ListingIdentity(asset, company) {
  return {
    asset: String(asset || '').trim(),
    company: String(company || '').trim(),
    normalizedAsset: normalizedPipelineAssetIdentity(asset),
    normalizedCompany: normalizedPipelineIdentityText(company)
  };
}

function sameStep0ListingIdentity(leftAsset, leftCompany, rightAsset, rightCompany) {
  const left = step0ListingIdentity(leftAsset, leftCompany);
  const right = step0ListingIdentity(rightAsset, rightCompany);
  return Boolean(
    left.normalizedAsset
    && left.normalizedCompany
    && left.normalizedAsset === right.normalizedAsset
    && left.normalizedCompany === right.normalizedCompany
  );
}

function reciprocalStep0MergeSelections(rowIndex, selectedTarget = '') {
  const current = activeStep0ImportReviewMatches.find((match) => match.row_index === rowIndex);
  if (!current) return [];
  const selectedCandidates = selectedTarget
    ? (current.candidates || []).filter((candidate) => candidate.target === selectedTarget)
    : (current.candidates || []);
  if (!selectedCandidates.length) return [];

  // Two pasted Listing rows can be reciprocal aliases of two already-separate
  // queue rows (for example BMD-001 ↔ BIOK-001). They have no shared target
  // yet, so group the direct reverse pair and apply one merge decision to both.
  return activeStep0ImportReviewMatches.flatMap((other) => {
    if (other.row_index === rowIndex) return [];
    // A reciprocal decision must use the exact incoming/candidate identities,
    // not the broader human-review similarity rule. This makes the reverse
    // pair deterministic even when a descriptive-name review was surfaced.
    const selectedCandidateIsOtherRow = selectedCandidates.some((selectedCandidate) => sameStep0ListingIdentity(
      selectedCandidate.asset,
      selectedCandidate.company,
      other.asset,
      other.company
    ));
    if (!selectedCandidateIsOtherRow) return [];
    const reverseCandidate = (other.candidates || []).find((candidate) => sameStep0ListingIdentity(
      candidate.asset,
      candidate.company,
      current.asset,
      current.company
    ));
    return reverseCandidate ? [{ rowIndex: other.row_index, target: reverseCandidate.target }] : [];
  });
}

function reciprocalStep0DefaultSelections(rowIndex, selectedTarget = '') {
  // The first pasted row is the template row. Its decision can prefill a
  // later reciprocal row, but a later row never writes back to the template.
  return reciprocalStep0MergeSelections(rowIndex, selectedTarget)
    .filter((linked) => rowIndex < linked.rowIndex);
}

function step0ManualReviewDecision(current, updates) {
  const { reciprocal_auto_from: _autoFrom, ...manualDecision } = current || {};
  return { ...manualDecision, ...updates };
}

function shouldApplyStep0ReciprocalDefault(decision, templateRowIndex) {
  return !decision
    || decision.action === 'pending'
    || decision.reciprocal_auto_from === templateRowIndex;
}

function renderStep0ImportReviewList() {
  if (!elements.step0ImportReviewList) return;
  elements.step0ImportReviewList.innerHTML = activeStep0ImportReviewMatches.map((match) => {
    const decision = activeStep0ImportReviewDecisions.get(match.row_index) || { action: 'pending' };
    const isNew = decision.action === 'new';
    const isSkipped = decision.action === 'skip';
    const hasSelection = decision.action !== 'pending';
    const isReciprocalDefault = Number.isInteger(decision.reciprocal_auto_from)
      && decision.reciprocal_auto_from < match.row_index;
    return `
      <article class="data-reupload-review-card${isNew || isSkipped ? ' is-skipped' : ''}">
        <header class="data-reupload-review-card-header">
          <div><strong>${escapeHtml(match.asset || 'Unknown asset')}</strong><span>${escapeHtml(match.company || 'Unknown company')} · ${escapeHtml(match.stage || 'Unknown')}</span></div>
          <span class="data-reupload-review-state" data-state="${escapeHtml(decision.action)}">${decision.action === 'merge' ? '같은 Pipeline으로 연결' : isNew ? '별도 신규 Pipeline' : isSkipped ? '등록하지 않음' : '선택 필요'}</span>
        </header>
        ${isReciprocalDefault ? '<p class="step0-import-reciprocal-default-note">위 행의 선택이 적용되었습니다. 이 행에서 변경하면 개별 선택으로 유지됩니다.</p>' : ''}
        <div class="data-reupload-candidate-stack">
          ${(match.candidates || []).map((candidate) => {
            const selected = decision.action === 'merge' && decision.target === candidate.target;
            const mergeChoiceClass = selected
              ? ' is-choice-selected'
              : hasSelection ? ' is-choice-muted' : '';
            const canChooseRepresentative = selected
              && candidate.target_type === 'queue'
              && step0ListingValuesConflict(match, candidate);
            const representative = decision.representative === 'existing' ? 'existing' : 'incoming';
            return `
              <section class="data-reupload-candidate${selected ? ' is-selected' : ''}">
                <div class="data-reupload-candidate-heading">
                  <span class="data-reupload-match-badge similar">유사 후보</span>
                  <span class="data-reupload-company-match">${escapeHtml(candidate.workflow || 'Listing')} · ${escapeHtml(candidate.reason || '유사한 이름')}</span>
                </div>
                <div class="data-reupload-comparison-scroll" tabindex="0">
                  <div class="data-reupload-comparison-grid">
                    ${renderDataReuploadComparisonColumn('이번 가져오기', match.asset, match.company, match.listing_details || match.stage)}
                    ${renderDataReuploadComparisonColumn('기존 Pipeline', candidate.asset, candidate.company, candidate.listing_details || candidate.stage)}
                  </div>
                </div>
                <div class="data-reupload-candidate-actions">
                  <button type="button" class="identity-modal-submit${mergeChoiceClass}" data-step0-import-review-action="merge" data-row-index="${match.row_index}" data-target="${escapeHtml(candidate.target)}" aria-pressed="${selected}">같은 Pipeline으로 연결</button>
                </div>
                ${canChooseRepresentative ? `
                  <fieldset class="step0-import-representative-choice">
                    <legend>충돌 시 우선 표시할 Listing 값</legend>
                    <p>선택한 쪽의 Asset·Company·Stage·Target 등은 유지하고, 빈 칸·Unknown·N/A·Not Available·- 표기만 반대쪽 값으로 보완합니다. Comment·Contact·이름 별칭은 함께 보존됩니다.</p>
                    <div>
                      <button type="button" class="identity-modal-cancel step0-import-representative-incoming${representative === 'incoming' ? ' is-active' : ''}" data-step0-import-review-action="representative" data-row-index="${match.row_index}" data-representative="incoming">새 입력 Listing 값 우선</button>
                      <button type="button" class="identity-modal-cancel step0-import-representative-existing${representative === 'existing' ? ' is-active' : ''}" data-step0-import-review-action="representative" data-row-index="${match.row_index}" data-representative="existing">기존 Listing 값 우선</button>
                    </div>
                  </fieldset>` : selected && candidate.target_type === 'record' ? `
                  <p class="step0-import-alias-guidance">Simple Research·Advanced Research의 공식 Asset·Company 표기는 유지됩니다. 이번 Listing의 이름은 검색용 별칭으로 자동 보존됩니다.</p>` : ''}
              </section>
            `;
          }).join('')}
          <div class="data-reupload-candidate-actions">
            <button type="button" class="identity-modal-cancel${isNew ? ' is-choice-selected' : hasSelection ? ' is-choice-muted' : ''}" data-step0-import-review-action="new" data-row-index="${match.row_index}" aria-pressed="${isNew}">별도 신규 Pipeline으로 추가</button>
            <button type="button" class="identity-modal-cancel${isSkipped ? ' is-choice-selected' : hasSelection ? ' is-choice-muted' : ''}" data-step0-import-review-action="skip" data-row-index="${match.row_index}" aria-pressed="${isSkipped}">등록하지 않기</button>
          </div>
          ${decision.action === 'merge' ? `
            <div class="step0-import-alias-guidance">
              <span>기존·신규 Asset/Company명은 검색·후속 중복 감지용 별칭 메타데이터에 자동 보존됩니다.</span>
            </div>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function closeStep0ImportReviewModal(decisions = null) {
  if (elements.step0ImportReviewModal) elements.step0ImportReviewModal.hidden = true;
  const resolve = step0ImportReviewResolve;
  step0ImportReviewResolve = null;
  activeStep0ImportReviewMatches = [];
  activeStep0ImportReviewDecisions = new Map();
  if (resolve) resolve(decisions);
}

function openStep0ImportReviewModal(matches) {
  if (!elements.step0ImportReviewModal) return Promise.resolve(null);
  return new Promise((resolve) => {
    step0ImportReviewResolve = resolve;
    activeStep0ImportReviewMatches = matches;
    activeStep0ImportReviewDecisions = new Map();
    if (elements.step0ImportReviewSummary) {
      elements.step0ImportReviewSummary.textContent = `${matches.length}개 Listing이 기존 Pipeline과 유사합니다. 선택 전에는 어떤 데이터도 저장되지 않습니다.`;
    }
    renderStep0ImportReviewList();
    elements.step0ImportReviewModal.hidden = false;
    elements.step0ImportReviewApply?.focus();
  });
}

function reviewedStep0ImportDecisions() {
  return activeStep0ImportReviewMatches.map((match) => {
    const decision = activeStep0ImportReviewDecisions.get(match.row_index) || { action: 'pending' };
    return { row_index: match.row_index, action: decision.action, target: decision.target || '', representative: decision.representative === 'existing' ? 'existing' : 'incoming' };
  });
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

function dictionaryEntryMatchIndex(normalizedText, entry) {
  const indices = [];
  const terms = [entry?.canonical, ...(Array.isArray(entry?.synonyms) ? entry.synonyms : [])];
  terms.filter(Boolean).forEach((term) => {
    const normalizedTerm = normalizeCategoryText(term);
    const compactTerm = normalizedTerm.replace(/[^a-z0-9]/g, '');
    const isShortToken = compactTerm.length <= 3 && /^[a-z0-9]+$/.test(compactTerm);
    if (isShortToken) {
      const compactText = normalizedText.replace(/[^a-z0-9]+/g, ' ');
      const match = new RegExp(`(^|[^a-z0-9])${escapeRegExp(compactTerm)}([^a-z0-9]|$)`, 'i').exec(compactText);
      if (match) indices.push(match.index);
      return;
    }
    const index = normalizedText.indexOf(normalizedTerm);
    if (index >= 0) indices.push(index);
  });
  (Array.isArray(entry?.patterns) ? entry.patterns : []).forEach((pattern) => {
    try {
      const match = new RegExp(pattern, 'i').exec(normalizedText);
      if (match) indices.push(match.index);
    } catch (error) {
      console.warn(`Invalid category synonym pattern skipped: ${pattern}`, error);
    }
  });
  return indices.length ? Math.min(...indices) : -1;
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
    'Clinical unspecified': 68,
    'IND filed/cleared': 65,
    'IND-enabling': 60,
    'Preclinical Candidate': 55,
    'Preclinical unspecified': 50,
    'Lead Optimization': 40,
    'Hit Discovery': 30,
    Unknown: 0
  };

  return [...entries].sort((a, b) => {
    return (stagePriority[b?.canonical] || 0) - (stagePriority[a?.canonical] || 0);
  });
}

function canonicalFromDictionary(kind, value) {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  if (!normalized || normalized === '-') return null;

  const entries = orderedDictionaryEntries(kind);
  if (['country', 'indication'].includes(kind)) {
    const matches = entries
      .map((entry, order) => ({ entry, order, index: dictionaryEntryMatchIndex(normalized, entry) }))
      .filter((match) => match.index >= 0)
      .sort((a, b) => a.index - b.index || a.order - b.order);
    return matches[0]?.entry?.canonical || null;
  }

  for (const entry of entries) {
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

async function loadCategorySynonyms(signal) {
  if (state.categorySynonymsLoaded) return;
  let shouldMarkLoaded = true;
  try {
    const response = await fetch(CATEGORY_SYNONYMS_URL, { signal });
    if (!response.ok) throw new Error(await response.text());
    const dictionary = await response.json();
    state.categorySynonyms = {
      country: Array.isArray(dictionary.country) ? dictionary.country : [],
      stage: Array.isArray(dictionary.stage) ? dictionary.stage : [],
      modality: Array.isArray(dictionary.modality) ? dictionary.modality : [],
      theme: Array.isArray(dictionary.theme) ? dictionary.theme : [],
      indication: Array.isArray(dictionary.indication) ? dictionary.indication : []
    };
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') {
      shouldMarkLoaded = false;
      throw error;
    }
    console.warn('Category synonym dictionary unavailable; using built-in fallback rules.', error);
  } finally {
    if (shouldMarkLoaded) state.categorySynonymsLoaded = true;
  }
}

function canonicalDashboardIndication(value) {
  const text = String(value || '').trim();
  const fromDictionary = canonicalFromDictionary('indication', text);
  if (fromDictionary) return fromDictionary;

  const normalized = normalizeCategoryText(text);
  if (!text || text === '-' || /^n\/?a$/i.test(text)) return 'Unknown';
  if (/alzheimer|ad\b/.test(normalized)) return "Alzheimer's disease";
  if (/lewy body|\bdlb\b/.test(normalized)) return 'Lewy body dementia';
  if (/epilep|seizure|focal onset|partial onset|status epilepticus/.test(normalized)) return 'Epilepsy / seizure disorders';
  if (/chronic cough|rcc|ucc|refractory cough|unexplained cough/.test(normalized)) return 'Chronic cough';
  if (/multiple sclerosis|\bms\b|neuroinflamm/.test(normalized)) return 'Multiple sclerosis / neuroinflammatory disease';
  if (/lupus|\bsle\b/.test(normalized)) return 'Systemic lupus erythematosus';
  if (/autoimmune|inflammatory disease/.test(normalized)) return 'Other autoimmune / inflammatory disease';
  if (/inflammatory bowel|\bibd\b|crohn|ulcerative colitis/.test(normalized)) return 'Inflammatory bowel disease';
  if (/major depressive|depression|\bmdd\b/.test(normalized)) return 'Major depressive disorder';
  if (/pain/.test(normalized)) return 'Pain';
  if (/acute ischemic stroke|stroke/.test(normalized)) return 'Stroke';
  return mainIndicationFrom(text).replace(/[\u2018\u2019\u201A\u201B]/g, "'");
}

function canonicalIndicationMatches(value) {
  const normalized = normalizeCategoryText(value);
  if (!normalized) return [];
  const matches = (state.categorySynonyms.indication || [])
    .map((entry, order) => ({ entry, order, index: dictionaryEntryMatchIndex(normalized, entry) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index || a.order - b.order);
  return [...new Set(matches.map((match) => match.entry.canonical).filter(Boolean))];
}

function explicitLegacyLeadIndication(value) {
  const leadMarker = /\b(?:lead|primary|initial|first)\s+(?:disclosed\s+|target(?:ed)?\s+)?indication\b|\bindication\s+(?:is|was)\s+(?:explicitly\s+)?(?:lead|primary|initial)\b|(?:대표|주요|주|초기)\s*적응증/i;
  const clauses = String(value || '').split(/[;\n]|(?<=[.!?])\s+/);
  for (const clause of clauses) {
    if (!leadMarker.test(clause)) continue;
    const matches = canonicalIndicationMatches(clause);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function canonicalMainIndication(mainIndication, detailedIndication = '') {
  const primary = String(mainIndication || '').trim();
  if (primary && !/^(?:-|unknown|not known|not available|not disclosed|undisclosed|n\/?a|\?+|정보\s*없음)$/i.test(primary)) {
    const canonical = canonicalFromDictionary('indication', primary);
    if (canonical) return canonical;
  }
  const explicitLead = explicitLegacyLeadIndication(detailedIndication);
  if (explicitLead) return explicitLead;
  const matches = canonicalIndicationMatches(detailedIndication);
  // When multiple confirmed indications have no declared lead, use the first
  // source-ordered canonical indication for the table's primary display.
  // indicationList retains every matching canonical value for OR filtering.
  return matches[0] || 'Unknown';
}

function confirmDashboardDelete({
  title = '삭제하시겠습니까?',
  message = '삭제한 내용은 복구할 수 없습니다.',
  confirmLabel = '삭제'
} = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'operation-modal-backdrop operation-confirm-backdrop';
    backdrop.innerHTML = `
      <section class="operation-modal operation-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="operationConfirmTitle">
        <header class="operation-modal-header">
          <span class="operation-modal-mark operation-confirm-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6.5 7l.7 13h9.6l.7-13" /></svg>
          </span>
          <div><p class="operation-modal-eyebrow">CONFIRM</p><h2 id="operationConfirmTitle">${escapeHtml(title)}</h2></div>
        </header>
        <p class="operation-modal-copy">${escapeHtml(message)}</p>
        <footer class="operation-modal-actions operation-confirm-actions">
          <button type="button" class="operation-modal-cancel" data-operation-confirm-cancel>취소</button>
          <button type="button" class="operation-modal-confirm" data-operation-confirm-accept>${escapeHtml(confirmLabel)}</button>
        </footer>
      </section>`;
    const finish = (confirmed) => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      document.body.classList.remove('operation-modal-open');
      resolve(confirmed);
    };
    const onKeydown = (event) => { if (event.key === 'Escape') finish(false); };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) finish(false); });
    backdrop.querySelector('[data-operation-confirm-cancel]')?.addEventListener('click', () => finish(false));
    backdrop.querySelector('[data-operation-confirm-accept]')?.addEventListener('click', () => finish(true));
    document.body.appendChild(backdrop);
    document.body.classList.add('operation-modal-open');
    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('[data-operation-confirm-accept]')?.focus();
  });
}

function pipelineWebsiteCandidates(value) {
  return String(value || '').match(/https?:\/\/[^\s<>'\"]+/gi) || [];
}

function closePipelineWebsiteEditor() {
  activePipelineWebsiteEditor = null;
  if (elements.pipelineWebsiteModal) elements.pipelineWebsiteModal.hidden = true;
  document.body.classList.remove('pipeline-website-modal-open');
}

function setPipelineWebsiteEditorStatus(message = '', isError = false) {
  if (!elements.pipelineWebsiteModalStatus) return;
  elements.pipelineWebsiteModalStatus.textContent = message;
  elements.pipelineWebsiteModalStatus.classList.toggle('is-error', isError);
}

function openPipelineWebsiteEditor(trigger) {
  const ownerType = String(trigger?.dataset.ownerType || 'record');
  const ownerId = String(trigger?.dataset.ownerId || trigger?.dataset.recordId || '').trim();
  if (!ownerId || !['record', 'queue'].includes(ownerType)) return;
  activePipelineWebsiteEditor = {
    ownerType,
    ownerId,
    asset: String(trigger.dataset.pipelineAsset || '').trim(),
  };
  if (elements.pipelineWebsiteModalInput) {
    elements.pipelineWebsiteModalInput.value = String(trigger.dataset.websiteUrl || '').trim();
  }
  setPipelineWebsiteEditorStatus();
  if (elements.pipelineWebsiteModal) elements.pipelineWebsiteModal.hidden = false;
  document.body.classList.add('pipeline-website-modal-open');
  window.setTimeout(() => {
    elements.pipelineWebsiteModalInput?.focus();
    elements.pipelineWebsiteModalInput?.select();
  }, 0);
}

function openPipelineWebsiteLink(trigger) {
  const url = String(trigger?.dataset.websiteUrl || '').trim();
  if (!url) return;
  window.clearTimeout(pipelineWebsiteOpenTimer);
  pipelineWebsiteOpenTimer = window.setTimeout(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
    pipelineWebsiteOpenTimer = null;
  }, 220);
}

async function savePipelineWebsiteEditor() {
  const context = activePipelineWebsiteEditor;
  if (!context) return;
  const value = String(elements.pipelineWebsiteModalInput?.value || '').trim();
  const candidates = pipelineWebsiteCandidates(value);
  if (candidates.length > 1) {
    setPipelineWebsiteEditorStatus('Website는 하나만 입력할 수 있습니다. 한 개의 HTTP(S) 주소만 남겨 주세요.', true);
    elements.pipelineWebsiteModalInput?.focus();
    return;
  }
  if (value) {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch (_) {
      setPipelineWebsiteEditorStatus('http:// 또는 https://로 시작하는 주소를 입력해 주세요.', true);
      elements.pipelineWebsiteModalInput?.focus();
      return;
    }
  }
  const payload = {
    owner_type: context.ownerType,
    field: 'website',
    value,
    [context.ownerType === 'queue' ? 'queue_id' : 'record_id']: context.ownerId,
  };
  const saveButton = elements.pipelineWebsiteModalSave;
  if (saveButton) saveButton.disabled = true;
  setPipelineWebsiteEditorStatus('저장 중입니다…');
  try {
    const response = await fetch('/api/candidate-queue/metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || 'Website를 저장하지 못했습니다.');
    closePipelineWebsiteEditor();
    await Promise.all([loadRecords(), loadStep0Progress()]);
  } catch (error) {
    setPipelineWebsiteEditorStatus(error.message || 'Website를 저장하지 못했습니다.', true);
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

function canonicalIndicationList(values, detailedIndication = '', mainIndication = '') {
  const list = canonicalIndicationMatches(detailedIndication);
  (Array.isArray(values) ? values : [])
    .map((value) => canonicalFromDictionary('indication', value))
    .filter(Boolean)
    .forEach((value) => { if (!list.includes(value)) list.push(value); });
  const lead = canonicalMainIndication(mainIndication, detailedIndication);
  return lead !== 'Unknown'
    ? [lead, ...list.filter((value) => value !== lead)]
    : [...new Set(list)];
}

function indicationFilterValues(rawValue, canonicalValues = []) {
  const raw = String(rawValue || '').trim();
  const canonical = canonicalIndicationList(canonicalValues, raw, '');
  if (!raw) return canonical.length ? canonical : ['Unknown'];

  // Preserve source-only disease wording as an explicit filter option. This
  // keeps a non-library indication searchable without pretending that it is
  // the generic Unknown bucket, and mirrors the Listing-table behavior.
  const sourceValues = raw
    .split(/\s*(?:;|\||,|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => (
      part
      && !isExplicitUnknownListingValue(part)
      && canonicalIndicationMatches(part).length === 0
    ));
  const values = [...new Set([...canonical, ...sourceValues])];
  return values.length ? values : ['Unknown'];
}

function dashboardIndicationFilterValues(row) {
  return indicationFilterValues(
    row?.indication || row?.mainIndicationRaw || '',
    Array.isArray(row?.indicationList) ? row.indicationList : []
  );
}

function indicationDisplay(row) {
  const canonical = String(row?.mainIndication || '').trim() || 'Unknown';
  // The table is a comparison surface, so it shows one concise canonical
  // lead indication. The full researched/source wording remains in the cell
  // title and record detail; preserve a confirmed non-library source value
  // only when the canonicalizer genuinely cannot classify it yet.
  return canonicalDisplayWithRawFallback(
    row?.indication || row?.mainIndicationRaw || '',
    canonical,
    ['Unknown']
  );
}

function sourceFieldHoverTitle(label, rawValue, fallback = '') {
  const raw = String(rawValue || fallback || '').trim();
  return `${label} 원문: ${raw || '확인 불가'}`;
}

function indicationFullHoverTitle(row, fallback = '') {
  // Filters can match a secondary indication that is intentionally omitted
  // from the concise Main indication cell. Preserve the entire source wording
  // in the native hover title across the dashboard tables.
  return sourceFieldHoverTitle('Indication 전체', row?.indication || row?.mainIndicationRaw, fallback);
}

function modalityFullHoverTitle(row, fallback = '') {
  return sourceFieldHoverTitle('Modality', row?.modalityRaw, fallback || row?.modality);
}

function pipelineStageFullHoverTitle(row, fallback = '') {
  return sourceFieldHoverTitle('Pipeline Stage', row?.stageRaw, fallback || row?.stage);
}

function canonicalCountry(value) {
  const text = String(value || '').trim();
  return canonicalCountryValues(text).join(' / ');
}

function isExplicitCountryInputPart(value) {
  return /^(?:china|prc|hong kong|(?:republic of |south )?korea|rok|kor|japan|jp|united states(?: of america)?|usa|u\.?s\.?|europe(?:an union)?|united kingdom|u\.?k\.?|taiwan|tw|singapore|sg|canada|ca|australia|au|israel|il)$/i
    .test(String(value || '').trim());
}

function canonicalCountryValues(value) {
  const text = String(value || '').trim();
  if (!text || /^(?:-|unknown|not known|not available|not disclosed|undisclosed|n\/?a|\?+|정보\s*없음)$/i.test(text)) return ['Unknown'];
  const entries = orderedDictionaryEntries('country');
  const commaParts = text.split(',').map((part) => part.trim()).filter(Boolean);
  // In an address such as "Cambridge, UK", the right-most exact country
  // component is authoritative. A slash-separated phrase means multiple
  // explicitly stated operating countries and therefore retains all matches.
  if (commaParts.length > 1 && !/[\/;&]/.test(text) && !commaParts.every(isExplicitCountryInputPart)) {
    const rightMost = normalizeCategoryText(commaParts[commaParts.length - 1]);
    const direct = entries.find((entry) => [entry?.canonical, ...(entry?.synonyms || [])]
      .some((term) => normalizeCategoryText(term) === rightMost));
    if (direct?.canonical) return [direct.canonical];
  }
  const matches = entries
    .map((entry, order) => ({ entry, order, index: dictionaryEntryMatchIndex(normalizeCategoryText(text), entry) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index || a.order - b.order)
    .map((match) => match.entry.canonical)
    .filter((country, index, countries) => countries.indexOf(country) === index);
  return matches.length ? matches.slice(0, 2) : [text];
}

function countryDisplayLabel(country) {
  const value = String(country || 'Unknown').trim() || 'Unknown';
  const labels = [
    [/^(?:republic of korea|south korea|korea)$/i, 'Korea'],
    [/^(?:united states(?: of america)?|usa|u\.s\.?|us)$/i, 'US'],
    [/^china$/i, 'CN'],
    [/^japan$/i, 'JP'],
    [/^canada$/i, 'CA'],
    [/^singapore$/i, 'SG'],
    [/^taiwan$/i, 'TW'],
    [/^australia$/i, 'AU'],
    [/^israel$/i, 'IL'],
    [/^(?:united kingdom|uk)$/i, 'UK'],
    [/^europe(?:\s*\/\s*uk)?$/i, 'EU']
  ];
  return labels.find(([pattern]) => pattern.test(value))?.[1] || value;
}

function countryTableCode(country) {
  const value = String(country || 'Unknown').trim() || 'Unknown';
  const codes = [
    [/^china\s*\/\s*hong kong$/i, 'CN/HK'],
    [/^china\s*\/\s*united states(?: operations)?$/i, 'CN/US'],
    [/^europe\s*\/\s*(?:united kingdom|uk)$/i, 'EU/GB'],
    [/^(?:republic of korea|south korea|korea)$/i, 'KR'],
    [/^(?:united states(?: of america)?|usa|u\.s\.?|us)$/i, 'US'],
    [/^china$/i, 'CN'],
    [/^hong kong$/i, 'HK'],
    [/^japan$/i, 'JP'],
    [/^canada$/i, 'CA'],
    [/^singapore$/i, 'SG'],
    [/^taiwan$/i, 'TW'],
    [/^australia$/i, 'AU'],
    [/^israel$/i, 'IL'],
    [/^(?:united kingdom|uk)$/i, 'GB'],
    [/^europe$/i, 'EU'],
    [/^(?:unknown|n\/?a|-)$/i, 'N/A']
  ];
  if (/^[a-z]{2}(?:\/[a-z]{2})*$/i.test(value)) return value.toUpperCase();
  return codes.find(([pattern]) => pattern.test(value))?.[1] || value;
}

function canonicalDevelopmentStage(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '-' || /^n\/?a$/i.test(raw)) return 'Unknown';
  const exact = CANONICAL_DEVELOPMENT_STAGES.find((stage) => stage.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const text = raw.toLowerCase().replace(/[_–—]+/g, '-').replace(/\s+/g, ' ').trim();
  if (/\b(?:conflict(?:ing|ed)?|inconsistent|discrepan(?:t|cy)|unresolved)\b|상충|불일치|해소할\s*수\s*없/.test(text)) {
    return 'Unknown';
  }

  const matchClause = (match) => {
    const separators = [';', '.', '\n', ',', ':'];
    const left = Math.max(...separators.map((separator) => text.lastIndexOf(separator, match.index)));
    const matchEnd = match.index + match[0].length;
    const rightCandidates = separators
      .map((separator) => text.indexOf(separator, matchEnd))
      .filter((position) => position >= 0);
    const right = rightCandidates.length ? Math.min(...rightCandidates) : text.length;
    return text.slice(left + 1, right);
  };
  const matchIsUncertain = (match) => /\b(?:unclear|uncertain|not\s+(?:confirmed|verified|established))\b|불명확|불확실|미확인/.test(matchClause(match));

  const matchIsPlanned = (match) => {
    const separators = [';', '.', '\n', ',', ':'];
    const left = Math.max(...separators.map((separator) => text.lastIndexOf(separator, match.index)));
    const matchEnd = match.index + match[0].length;
    const rightCandidates = separators
      .map((separator) => text.indexOf(separator, matchEnd))
      .filter((position) => position >= 0);
    const right = rightCandidates.length ? Math.min(...rightCandidates) : text.length;
    const before = text.slice(Math.max(left + 1, match.index - 64), match.index);
    const after = text.slice(matchEnd, Math.min(right, matchEnd + 64));
    const plannedBefore = /(?:\b(?:plan(?:s|ned|ning)?|expect(?:s|ed|ing)?|target(?:s|ed|ing)?|aim(?:s|ed|ing)?|intend(?:s|ed|ing)?|project(?:s|ed|ing)?|anticipat(?:e|es|ed|ing)|propos(?:e|es|ed|ing)|schedul(?:e|es|ed|ing)|will|would)\b(?:\s+(?:to|for))?(?:\s+(?:enter|start|begin|initiate|advance\s+to))?\s*$|(?:예정|계획|목표|전망)(?:인|된|으로)?\s*$)/.test(before);
    const plannedAfter = /^\s*(?:(?:trial|study|studies|program|development|submission|initiation)\s+)?(?:(?:is|are|was|were|to\s+be)\s+)?(?:plan(?:s|ned|ning)?|expect(?:s|ed|ing)?|target(?:s|ed|ing)?|aim(?:s|ed|ing)?|intend(?:s|ed|ing)?|project(?:s|ed|ing)?|anticipat(?:e|es|ed|ing)|propos(?:e|es|ed|ing)|schedul(?:e|es|ed|ing)|next\s+year|future)\b|^\s*(?:will|would)\s+(?:enter|start|begin|initiate|advance\s+to)\b|^\s*(?:trial|study|studies|program|development)?\s*to\s+(?:enter|start|begin|initiate)(?:\s+in)?\s+(?:next\s+year|the\s+future)\b|^\s*(?:(?:진입|시작|착수|개시)\s*)?(?:시험|연구|개발|제출|착수)?\s*(?:이|가|은|는)?\s*(?:예정|계획|목표|전망)/.test(after);
    return plannedBefore || plannedAfter;
  };

  const inactiveMatch = text.match(/\b(?:discontinued|inactive|terminated|withdrawn|dormant|abandoned|clearly failed)\b|종료|철회|휴면|포기/);
  if (inactiveMatch) {
    const prefix = text.slice(Math.max(0, inactiveMatch.index - 16), inactiveMatch.index);
    const speculativeOrHistorical = /\b(?:likely|possibly|possible|may|might|could\s+be|historical|former|legacy)\b|추정|가능성|과거|이전/.test(matchClause(inactiveMatch));
    if (!speculativeOrHistorical && !/\b(?:not|isn't|is not|never)\s*$|아니|않/.test(prefix)) return 'Discontinued / inactive';
  }

  if (/\b(?:ind|cta)\s*(?:submitted|filed|accepted|effective|cleared|approved|approval)\b|\b(?:submitted|filed|accepted|effective|cleared|approved)\s+(?:an?\s+)?(?:ind|cta)\b|(?:ind|cta)\s*(?:제출|승인|수리|효력)/.test(text)) {
    return 'IND filed/cleared';
  }
  if (/\b(?:registration|nda|bla|maa)\s+(?:submitted|filed|accepted|review|under review)\b|\b(?:submitted|filed|accepted)\s+(?:an?\s+)?(?:nda|bla|maa)\b|허가\s*(?:신청|제출|심사)/.test(text)) {
    return 'Registration';
  }
  if (/^(?:approved|marketed|commercial(?:ized|ised))$|\b(?:fda|ema|nmpa)\s+approved\b|\b(?:nda|bla|maa)\s+(?:approved|approval)\b|\b(?:approved|marketed|commercial(?:ized|ised))\s+(?:drug|medicine|product|therapy|therapeutic|asset)\b|\b(?:drug|medicine|product|therapy|therapeutic|asset)\s+(?:approved|marketed|commercial(?:ized|ised))\b|\b(?:marketed|commercial(?:ized|ised))\b|(?:품목\s*)?허가\s*(?:승인|완료)?|시판/.test(text)) {
    return 'Approved / marketed';
  }

  const phasePatterns = [
    ['Phase 2/3', /\b(?:ph(?:ase)?\s*(?:ii|2)(?:a|b)?\s*\/\s*(?:iii|3)(?:a|b)?|p2(?:a|b)?\s*\/\s*p?3(?:a|b)?)\b/],
    ['Phase 1/2', /\b(?:ph(?:ase)?\s*(?:i|1)(?:a|b)?\s*\/\s*(?:ii|2)(?:a|b)?|p1(?:a|b)?\s*\/\s*p?2(?:a|b)?)\b/],
    ['Phase 3', /\b(?:ph(?:ase)?\s*(?:iii|3)(?!\s*\/)|p3)\b/],
    ['Phase 2', /\b(?:ph(?:ase)?\s*(?:ii|2)(?:a|b)?(?!\s*\/)|p2(?:a|b)?(?!\s*\/))\b/],
    ['Phase 1', /\b(?:ph(?:ase)?\s*(?:i|1)(?:a|b)?(?!\s*\/)|p1(?:a|b)?(?!\s*\/)|fih|sad\s*\/\s*mad)\b/]
  ];
  for (const [canonical, pattern] of phasePatterns) {
    const phaseMatch = text.match(pattern);
    if (phaseMatch && !matchIsPlanned(phaseMatch) && !matchIsUncertain(phaseMatch)) return canonical;
  }
  const clinicalMatch = text.match(/\b(?:clinical development|clinical[- ]stage|clinical trial|clinical study|pivotal(?: trial| study)?|registrational(?: trial| study)?)\b/);
  if (clinicalMatch && !matchIsPlanned(clinicalMatch) && !matchIsUncertain(clinicalMatch)) return 'Clinical unspecified';
  if (/\b(?:unclear|uncertain|not\s+(?:confirmed|verified|established))\b|불명확|불확실|미확인/.test(text)) {
    return 'Unknown';
  }

  const prePccMatch = text.match(/\bpre[-\s]?pcc\b/);
  if (prePccMatch && !matchIsPlanned(prePccMatch)) return 'Lead Optimization';
  if (/\b(?:development\s+candidate|preclinical\s+candidate)\s+(?:selected|nominated)\b|\bcandidate\s+nominated\b|\b(?:pcc|dc)(?:\s+(?:selected|nominated|completion|completed))?\b|개발\s*후보(?:물질)?\s*(?:선정|지명)/.test(text)) {
    return 'Preclinical Candidate';
  }
  const leadMatch = text.match(/\b(?:candidate|lead)\s+selection\s+(?:ongoing|underway|in progress)\b|\blead\s+optimization\b|리드\s*최적화/);
  if (leadMatch && !matchIsPlanned(leadMatch)) return 'Lead Optimization';
  const hitMatch = text.match(/\b(?:hit\s+discovery|hit\s+identification|hit\s*id|early\s+screening|research\s+(?:program|project)|discovery\s+(?:program|project))\b|(?:히트\s*(?:발굴|탐색)|연구\s*(?:프로그램|프로젝트))/);
  if (hitMatch && !matchIsPlanned(hitMatch)) return 'Hit Discovery';
  const indEnablingMatch = text.match(/\bind[- ]?enabling(?:\s+stud(?:y|ies))?\b|\bglp\s+(?:toxicology|tox)\b|\bind[- ]directed\s+cmc\b|\bind\s+preparation\b|\bpreparing\s+(?:an?\s+)?ind\b|ind\s*준비|glp\s*독성/);
  if (indEnablingMatch && !matchIsPlanned(indEnablingMatch)) return 'IND-enabling';
  const preclinicalMatch = text.match(/\bpreclinical\b|비임상/);
  if (preclinicalMatch && !matchIsPlanned(preclinicalMatch)) return 'Preclinical unspecified';
  return 'Unknown';
}

function stageSummaryGroup(stage) {
  const canonical = canonicalDevelopmentStage(stage);
  return [
    'Hit Discovery',
    'Lead Optimization',
    'Preclinical Candidate',
    'IND-enabling',
    'Preclinical unspecified'
  ].includes(canonical)
    ? 'Preclinical'
    : canonical;
}

function canonicalModality(value) {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  const fromDictionary = canonicalFromDictionary('modality', text);
  if (fromDictionary) return fromDictionary;
  if (!text || text === '-' || /^(unknown|not known|not available|not disclosed|n\/a)$/i.test(text)) return 'Unknown';
  if (/targeted protein degrad|\btpd\b|\bprotac\b|proteolysis[\s-]?targeting chimera|molecular[\s-]?glue|\bsniper\b|\bautotac\b|\blytac\b/.test(normalized)) return 'Targeted protein degrader';
  if (/oncolytic (?:virus|viral|virotherapy)/.test(normalized)) return 'Oncolytic virus';
  if (/small[\s-]?molecule|\bsm\b|oral compound|chemical compound/.test(normalized)) return 'Small molecule';
  if (/peptide/.test(normalized)) return 'Peptide';
  if (/rna|oligonucleotide|antisense|\baso\b|sirna|mirna|mrna/.test(normalized)) return 'RNA therapy';
  if (/car[- ]?t|tcr[- ]?t|cell therapy|cellular therapy|stem cell/.test(normalized)) return 'Cell therapy';
  if (/gene therapy|aav|lentiviral|gene editing|crispr/.test(normalized)) return 'Gene therapy';
  if (/antibody|antibody drug conjugate|\badc\b|bispecific/.test(normalized)) return 'Antibody';
  if (/protein biologic|recombinant protein|fusion protein|enzyme replacement/.test(normalized)) return 'Protein biologic';
  if (/microbiome|live biotherapeutic|\blbp\b|microbial consorti|fecal microbiota|\bfmt\b/.test(normalized)) return 'Microbiome therapy';
  if (/\bvaccine\b|immunization/.test(normalized)) return 'Vaccine';
  if (/radiopharmaceutical|radioligand|radioisotope|radiotherapeutic/.test(normalized)) return 'Radiopharmaceutical';
  return 'Others';
}

function canonicalModalityTags(value, primary = '') {
  const text = String(value || '').trim();
  if (!text || /^(unknown|not known|not available|not disclosed|n\/?a|-)$/i.test(text)) return [];
  const normalized = normalizeCategoryText(text);
  const values = (state.categorySynonyms.modality || [])
    .filter((entry) => dictionaryEntryMatchIndex(normalized, entry) >= 0)
    .map((entry) => entry.canonical)
    .filter((value) => value && !['Others', 'Unknown'].includes(value));
  const patterns = [
    ['Targeted protein degrader', /targeted protein degrad|\btpd\b|\bprotac\b|proteolysis[\s-]?targeting chimera|molecular[\s-]?glue|\bsniper\b|\bautotac\b|\blytac\b/],
    ['Oncolytic virus', /oncolytic (?:virus|viral|virotherapy)/],
    ['Small molecule', /small[\s-]?molecule|\bsm\b|oral compound|chemical compound/],
    ['Peptide', /peptide/],
    ['RNA therapy', /rna|oligonucleotide|antisense|\baso\b|sirna|mirna|mrna/],
    ['Cell therapy', /car[- ]?t|tcr[- ]?t|cell therapy|cellular therapy|stem cell/],
    ['Gene therapy', /gene therapy|aav|lentiviral|gene editing|crispr/],
    ['Antibody', /antibody|antibody drug conjugate|\badc\b|bispecific/],
    ['Protein biologic', /protein biologic|recombinant protein|fusion protein|enzyme replacement/],
    ['Microbiome therapy', /microbiome|live biotherapeutic|\blbp\b|microbial consorti|fecal microbiota|\bfmt\b/],
    ['Vaccine', /\bvaccine\b|immunization/],
    ['Radiopharmaceutical', /radiopharmaceutical|radioligand|radioisotope|radiotherapeutic/]
  ];
  patterns.forEach(([label, pattern]) => { if (pattern.test(normalized)) values.push(label); });
  const resolvedPrimary = primary || canonicalModality(text);
  if (!['Others', 'Unknown'].includes(resolvedPrimary)) values.unshift(resolvedPrimary);
  return [...new Set(values)];
}

function canonicalDisplayWithRawFallback(rawValue, canonicalValue, fallbackValues = ['Unknown']) {
  const raw = String(rawValue || '').trim();
  if (!raw) return canonicalValue || 'Unknown';
  if (fallbackValues.includes(canonicalValue) && !/^(?:-|unknown|not known|not available|not disclosed|n\/?a)$/i.test(raw)) return raw;
  return canonicalValue || raw;
}

function canonicalTheme(value) {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  const fromDictionary = canonicalFromDictionary('theme', text);
  if (fromDictionary) return fromDictionary;
  if (!text || text === '-' || /^(unknown|not known|n\/?a)$/i.test(text)) return 'Unknown';
  if (/e\s*\/\s*i\s*balance|excitation.*inhibition/.test(normalized)) return 'E/I Balance';
  if (/neuro[\s-]*immune/.test(normalized)) return 'Neuroimmune';
  if (/protein homeostasis|proteostasis/.test(normalized)) return 'Protein Homeostasis';
  return 'Others';
}

function canonicalCluster(value, theme = '') {
  const text = String(value || '').trim();
  const normalized = normalizeCategoryText(text);
  if (!text || text === '-' || /^(unknown|not known)$/i.test(text)) return 'Unknown';
  if (/^n\/?a$/.test(normalized)) return theme === 'Others' ? 'Others' : 'Unknown';
  if (/^others?$|no cluster|no mapped|no fit|out of scope|none/.test(normalized)) {
    return theme === 'Others' ? 'Others' : 'Unknown';
  }
  return text;
}

function recordIdentifier(record, index = 0) {
  const explicit = String(record?.meta?.output_filename_base || '').trim();
  if (explicit) return explicit;
  const table = record?.structured_table || {};
  const summary = record?.json_summary || {};
  const company = String(table.company || summary.company || 'unknown').trim() || 'unknown';
  const asset = String(table.asset_name || summary.asset_name || `asset-${index + 1}`).trim() || `asset-${index + 1}`;
  return `${company}_${asset}`;
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

function evidenceSourceUrl(source) {
  if (typeof source === 'string') return source.trim();
  if (!source || typeof source !== 'object') return '';
  return String(source.source_url || source.url || source.href || '').trim();
}

function criterionEvidenceSources(criterion, record = null) {
  if (!criterion || typeof criterion !== 'object') return [];
  if (Array.isArray(criterion.verified_evidence_sources) && criterion.verified_evidence_sources.length) {
    return criterion.verified_evidence_sources;
  }
  if (Array.isArray(criterion.evidence_sources) && criterion.evidence_sources.length) {
    return criterion.evidence_sources;
  }
  if (!Array.isArray(criterion.source_ids)) return [];
  const registry = Array.isArray(record?.validation?.source_registry)
    ? record.validation.source_registry
    : [];
  const byId = new Map(registry.flatMap((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
    const sourceId = String(source.source_id || '').trim();
    return sourceId ? [[sourceId, source]] : [];
  }));
  return criterion.source_ids
    .map((sourceId) => byId.get(String(sourceId ?? '').trim()))
    .filter(Boolean);
}

function verifiedPublicSourceUrls(criterionOrSources, { requireExplicitVerification = false } = {}) {
  const explicitVerifiedList = !Array.isArray(criterionOrSources)
    && Array.isArray(criterionOrSources?.verified_evidence_sources);
  const sources = Array.isArray(criterionOrSources)
    ? criterionOrSources
    : criterionEvidenceSources(criterionOrSources);
  const unique = new Set();
  sources.forEach((source) => {
    if (source && typeof source === 'object') {
      if (source.verified === false) return;
      if (requireExplicitVerification && !explicitVerifiedList && source.verified !== true) return;
    } else if (requireExplicitVerification && !explicitVerifiedList) {
      return;
    }
    const rawUrl = evidenceSourceUrl(source);
    if (!rawUrl || /^(unknown|n\/?a|null|source_url_not_provided)$/i.test(rawUrl)) return;
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      if (!parsed.hostname || ['localhost', '127.0.0.1'].includes(parsed.hostname.toLowerCase())) return;
      parsed.hash = '';
      unique.add(parsed.href.replace(/\/$/, ''));
    } catch {
      // A descriptive citation without a public URL is not a verified public source.
    }
  });
  return [...unique];
}

function evidenceBasisLabel(value, verifiedSourceCount = 0) {
  return ({
    user_input_only: '사용자 입력정보 기반 · 공개자료 미확인',
    public_source: `공개자료 ${verifiedSourceCount}건 확인`,
    user_input_and_public_source: `사용자 입력정보 + 공개자료 ${verifiedSourceCount}건 확인`,
    no_supporting_basis: '확인된 판단근거 없음'
  })[String(value || '').trim()] || '-';
}

function safeCriterionText(...values) {
  for (const value of values) {
    if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '-';
}

function safeCriterionTextList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function criterion(record, key) {
  const rawItem = get(record, `scoring.criteria.${key}`, {});
  const rawRubric = get(record, `rubric.${key}`, {});
  const rawDefinition = get(record, `criteria_registry.criteria.${key}`, {});
  const item = rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem) ? rawItem : {};
  const rubric = rawRubric && typeof rawRubric === 'object' && !Array.isArray(rawRubric) ? rawRubric : {};
  const definition = rawDefinition && typeof rawDefinition === 'object' && !Array.isArray(rawDefinition)
    ? rawDefinition
    : {};
  const appliedRule = safeCriterionText(
    item.criteria_reference?.applied_rule_id,
    item.ai_champion?.rule_applied,
    item.score != null ? `${key}:${item.score}` : '-'
  );
  const rationale = item.score_rationale && typeof item.score_rationale === 'object' && !Array.isArray(item.score_rationale)
    ? item.score_rationale
    : {};
  const evidenceSources = criterionEvidenceSources(item, record);
  const hasDirectEvidenceList = (Array.isArray(item.verified_evidence_sources)
      && item.verified_evidence_sources.length > 0)
    || (Array.isArray(item.evidence_sources) && item.evidence_sources.length > 0);
  const verifiedSourceUrls = verifiedPublicSourceUrls(hasDirectEvidenceList ? item : evidenceSources, {
    requireExplicitVerification: isCurrentFastTriageContract(record)
  });
  const matchingRule = (Array.isArray(definition.scoring_rules) ? definition.scoring_rules : []).find((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return false;
    return rule.rule_id === appliedRule || rule.score === item.score;
  });
  const scoreDefinitions = rubric.score_definitions && typeof rubric.score_definitions === 'object'
    ? rubric.score_definitions
    : {};
  const scoreDefinition = item.score != null ? scoreDefinitions[String(item.score)] : '';
  const mainLineSummary = safeCriterionText(
    item.main_line_summary,
    item.reason,
    rationale.decision_summary
  );
  const uncertainPoints = safeCriterionTextList(
    Array.isArray(item.uncertain_points)
      ? item.uncertain_points
      : rationale.conflicting_or_missing_evidence
  );
  const sourceSummaries = evidenceSources
    .map((source) => source && typeof source === 'object'
      ? safeCriterionText(source.evidence_summary, source.claim_supported, source.source_title)
      : '')
    .filter((value) => value && value !== '-');

  return {
    score: number(item.score),
    reason: mainLineSummary,
    mainLineSummary,
    evidenceType: safeCriterionText(item.evidence_type),
    evidenceTypeReason: safeCriterionText(item.evidence_type_reason),
    evidenceBasis: safeCriterionText(item.evidence_basis, ''),
    evidenceBasisLabel: evidenceBasisLabel(item.evidence_basis, verifiedSourceUrls.length),
    verifiedPublicSourceCount: verifiedSourceUrls.length,
    verifiedPublicSourceUrls: verifiedSourceUrls,
    whyNotHigher: safeCriterionText(item.why_not_higher),
    version: safeCriterionText(get(record, 'meta.rubric_version', item.criteria_reference?.criteria_version || '-')),
    author: safeCriterionText(get(record, 'meta.rubric_author', item.criteria_reference?.criteria_author || '-')),
    rule: appliedRule,
    ruleLabel: safeCriterionText(matchingRule?.label, item.score != null ? `${item.score}점 기준` : '-'),
    ruleCriteria: safeCriterionText(scoreDefinition, matchingRule?.criteria),
    evidenceExpectation: safeCriterionText(definition.evidence_expectation),
    appliedScoreDefinition: safeCriterionText(scoreDefinition, rationale.applied_score_definition, matchingRule?.criteria),
    decisionSummary: mainLineSummary,
    keyJudgmentFactors: safeCriterionTextList(rationale.key_judgment_factors),
    supportingEvidenceSummary: safeCriterionText(sourceSummaries.join(' | '), rationale.supporting_evidence_summary),
    conflictingOrMissingEvidence: uncertainPoints,
    confidence: safeCriterionText(rationale.confidence, 'Unclear'),
    investigationNote: safeCriterionText(item.investigation_note, rationale.reviewer_notes),
    calculation: item.calculation && typeof item.calculation === 'object' && !Array.isArray(item.calculation)
      ? item.calculation
      : null,
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

function hasAffirmedHardBlocker(notes) {
  const blockerPattern = /(\boutside\s+(?:the\s+)?(?:primary\s+)?(?:therapeutic\s+area|indication|disease)\s+scope\b|\bout\s+of\s+(?:therapeutic|indication|disease)\s+scope\b|\bno\s+public\s+target\b|\bno\b[^|.;\n]{0,48}\btarget\s*\/\s*moa\b|\basset\s+identity\s+(?:is\s+)?(?:not\s+verified|unverified)\b|\b(?:discontinued|terminated|withdrawn|dormant|inactive|abandoned|clearly\s+failed)\b|(?:관심\s*)?(?:질환|적응증|치료\s*영역)\s*범위\s*밖|자산\s*식별\s*불가|(?:개발|프로그램|임상)\s*(?:이\s*)?(?:종료|철회|휴면|비활성|포기))/i;
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
  const targetScore = number(criteria.target.score ?? summary.target_relevance_score);
  const moaScore = number(criteria.moa.score);
  const dataScore = number(criteria.data.score);
  const notes = collectHardFilterNotes(record);
  const reasons = [];

  const developmentStage = canonicalDevelopmentStage(record.structured_table?.development_stage);
  const nonLifecycleNotes = String(notes || '').replace(
    /\b(?:discontinued|terminated|withdrawn|suspended|dormant|inactive|abandoned|clearly\s+failed)\b|(?:개발|프로그램|임상)\s*(?:이\s*)?(?:종료|철회|휴면|비활성|포기)/gi,
    ''
  );
  const failBlocker = record.hard_filter?.hard_blocker === true || hasAffirmedHardBlocker(nonLifecycleNotes);
  if (developmentStage === 'Discontinued / inactive') reasons.push('Development stage = Discontinued / inactive');
  if (Number.isFinite(total) && total <= 8) reasons.push(`Total score ${total} <= 8`);
  [['Target Area Relevance', targetScore], ['MoA Validity', moaScore], ['Data Maturity', dataScore]]
    .filter(([, score]) => score === 0)
    .forEach(([label]) => reasons.push(`${label} = 0`));
  if (failBlocker) reasons.push('Hard blocker keyword detected');

  if (reasons.length) {
    return { status: 'FAIL', reason: reasons.join('; ') };
  }

  const passScores = total >= 14 && targetScore >= 3 && moaScore === 3 && dataScore === 3;
  if (passScores) {
    return {
      status: 'PASS',
      reason: `Total ${total} >= 14, TAR ${targetScore} >= 3, MOA ${moaScore} = 3, Data ${dataScore} = 3`
    };
  }

  if (Number.isFinite(total) && total >= 9 && total <= 13) {
    reasons.push(`Total score ${total} is MONITOR range 9-13`);
  }
  if (!passScores) {
    reasons.push(`PASS score gate 미충족: Total ${total ?? '-'}, TAR ${targetScore ?? '-'}, MOA ${moaScore ?? '-'}, Data ${dataScore ?? '-'}`);
  }
  return { status: 'REVIEW', reason: reasons.join('; ') || '추가 diligence 필요' };
}

function synchronizeDashboardOwnedInputFields(record) {
  // GPT owns research scores and evidence. Totals and Filter 2/triage labels are
  // deterministic dashboard fields, so normalize them before client validation
  // and let the server repeat the same normalization at its save boundary.
  if (!isInputObject(record) || !isInputObject(record.scoring) || !isInputObject(record.hard_filter)) return [];
  const criteria = isInputObject(record.scoring.criteria) ? record.scoring.criteria : {};
  const adjustments = [];
  const synchronize = (container, field, value, path) => {
    if (!isInputObject(container) || container[field] === value) return;
    adjustments.push({ path, previous: container[field], current: value });
    container[field] = value;
  };
  const isScore = (value) => Number.isInteger(value) && value >= 0 && value <= 3;
  const triageMode = detectInputRecordMode(record).mode === 'triage';

  if (triageMode) {
    const triage = isInputObject(record.triage) ? record.triage : null;
    const scores = ['target_relevance', 'moa_validity', 'data_maturity']
      .map((criterionId) => criteria[criterionId]?.score);
    if (!triage || !scores.every(isScore)
      || typeof triage.identity_verified !== 'boolean') {
      return adjustments;
    }
    synchronize(record.scoring, 'total_score', scores.reduce((sum, score) => sum + score, 0), 'scoring.total_score');
    synchronize(record.scoring, 'max_score', 9, 'scoring.max_score');
    // v3.5: development_stage is the sole activity gate (active_asset and the
    // hard_filter.flags keyword scan were dropped as redundant/ambiguous).
    const developmentStage = canonicalDevelopmentStage(record.structured_table?.development_stage);
    const status = triage.identity_verified !== true || developmentStage === 'Discontinued / inactive'
      ? 'INSUFFICIENT'
      : Math.min(...scores) === 0
        ? 'INSUFFICIENT'
        : scores[0] >= 3 && scores[1] >= 1 && scores[2] >= 2
          ? 'SELECT'
          : 'REJECT';
    synchronize(record.hard_filter, 'status', status, 'hard_filter.status');
    synchronize(triage, 'status', status, 'triage.status');
    if (isInputObject(record.final_insight)) {
      synchronize(
        record.final_insight,
        'recommendation',
        {
          SELECT: 'Run Full Scout',
          REJECT: 'Monitor / gather more evidence',
          INSUFFICIENT: 'Do not run Full Scout'
        }[status],
        'final_insight.recommendation'
      );
    }
    return adjustments;
  }

  const scores = INPUT_FULL_CRITERIA.map((criterionId) => criteria[criterionId]?.score);
  if (!scores.every(isScore)) return adjustments;
  synchronize(record.scoring, 'total_score', scores.reduce((sum, score) => sum + score, 0), 'scoring.total_score');
  synchronize(record.scoring, 'max_score', 21, 'scoring.max_score');
  const filter = computeHardFilter(record, {
    target: criteria.target_relevance,
    competitive: criteria.competitive_landscape,
    moa: criteria.moa_validity,
    platform: criteria.platform_attractiveness,
    expansion: criteria.expansion_potential,
    data: criteria.data_maturity,
    market: criteria.marketability
  });
  synchronize(record.hard_filter, 'status', filter.status, 'hard_filter.status');
  return adjustments;
}

function normalizeTriageStatus(value) {
  const text = String(value || '').trim().toUpperCase();
  if (['SELECT', 'REJECT', 'INSUFFICIENT'].includes(text)) {
    return text;
  }
  if (['UNVERIFIED', 'N/A', 'NA'].includes(text)) return 'INSUFFICIENT';
  return '';
}

function normalizeFullStatus(value) {
  const text = String(value || '').trim().toUpperCase();
  return ['PASS', 'REVIEW', 'FAIL'].includes(text) ? text : '';
}

function earlyStopInfo(record) {
  const triageRecord = isTriageRecord(record);
  const table = record?.structured_table || {};
  const stage = canonicalDevelopmentStage(table.development_stage || table.development_stage_source || '');
  const reason = String(
    record?.hard_filter?.reason
    || record?.triage?.reason
    || record?.triage_reason
    || ''
  );
  const parserStatus = String(record?.source_report?.parser_status || '');

  if (triageRecord && record?.triage?.identity_verified === false) {
    return {
      type: 'identity',
      reason: 'Asset identity를 확인하지 못해 점수 평가를 수행하지 않았습니다.'
    };
  }
  if (!triageRecord && /asset[\s_-]*identity[^\n]*not[\s_-]*verified|identity[^\n]*not[\s_-]*verified/i.test(`${reason}\n${parserStatus}`)) {
    return {
      type: 'identity',
      reason: 'Asset identity를 확인하지 못해 Advanced Research를 조기 종료했습니다.'
    };
  }
  if (stage === 'Discontinued / inactive') {
    return {
      type: 'lifecycle',
      reason: 'Pipeline 전체의 영구 중단이 확인되어 조사를 조기 종료했습니다.'
    };
  }
  return null;
}

function humanReviewOverrides(record) {
  const overrides = get(record, 'meta.human_review.overrides', {});
  return overrides && typeof overrides === 'object' ? overrides : {};
}

function hasManualTableFieldEdit(record, field) {
  const history = get(record, 'meta.human_review.history', []);
  const fieldKey = `structured_table.${field}`;
  return Array.isArray(history) && history.some((entry) => entry?.field === fieldKey);
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

function isCurrentFastTriageContract(record) {
  if (!isTriageRecord(record)) return false;
  const meta = record?.meta || {};
  const schemaVersion = String(meta.schema_version || '').trim().replace(/^v/i, '');
  const instructionVersion = String(meta.instruction_version || '').trim().replace(/^v/i, '');
  const triageStatus = String(record?.triage?.status || '').trim().toUpperCase();
  const criteria = record?.scoring?.criteria || {};
  return schemaVersion === FAST_TRIAGE_SCHEMA_VERSION
    || instructionVersion === LATEST_TRIAGE_RUBRIC_VERSION
    || triageStatus === 'INSUFFICIENT'
    || Object.values(criteria).some((item) => item && typeof item === 'object' && 'evidence_basis' in item);
}

function recordFilterStatus(record, computedHardFilter) {
  const triageRecord = isTriageRecord(record);
  const stage = canonicalDevelopmentStage(record?.structured_table?.development_stage || '');
  if (triageRecord && stage === 'Discontinued / inactive') {
    return {
      status: 'INSUFFICIENT',
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
      status: 'INSUFFICIENT',
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

const FILTER1_SORT_RANK = { SELECT: 0, REJECT: 1, INSUFFICIENT: 2 };
const FILTER2_SORT_RANK = { PASS: 0, REVIEW: 1, FAIL: 2 };
// Display-only relabel: the stored/derived hard_filter.status values stay PASS/REVIEW/FAIL
// everywhere (schema, sorting, tone classes, GPT contract) — only the text shown to a
// reviewer changes, so nothing downstream of this label needs to change.
const FILTER2_STATUS_LABELS = { REVIEW: 'MONITOR', FAIL: 'T·Down' };
function filter2StatusLabel(value) {
  return FILTER2_STATUS_LABELS[value] || value;
}

function recordFilter2Status(record, computedHardFilter) {
  if (isTriageRecord(record)) {
    return { status: '-', reason: `Advanced Research v${LATEST_FULL_SCOUT_RUBRIC_VERSION} not run yet` };
  }
  const manualStatus = normalizeFullStatus(humanReviewOverrides(record).filter_status);
  return manualStatus
    ? { status: manualStatus, reason: 'Human reviewer override from dashboard table' }
    : computedHardFilter;
}

function latestSourceReportEdit(record) {
  const history = Array.isArray(record?.meta?.edit_history) ? record.meta.edit_history : [];
  return [...history]
    .reverse()
    .find((entry) => entry?.field === 'source_report.raw_markdown') || null;
}

function sourceRevisionActorLabel(entry) {
  if (!entry) return '';
  if (['dashboard_rubric_refresh', 'dashboard_tab2_rubric_recalculation'].includes(entry.source)) {
    const rubricVersion = String(entry.new_value || '').match(/rubric\s+v([^\s]+)/i)?.[1];
    return rubricVersion ? `Rubric v${rubricVersion}` : `Rubric v${LATEST_FULL_SCOUT_RUBRIC_VERSION}`;
  }
  if (entry.actor_name) return String(entry.actor_name);
  if (['127.0.0.1', '::1', 'localhost'].includes(String(entry.actor_ip || '').toLowerCase())) {
    return 'Local workspace';
  }
  return String(entry.actor_ip || '');
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

function hasDueDiligenceAttachment(record) {
  const attachments = get(record, 'meta.attachments', []);
  return Array.isArray(attachments) && attachments.some((attachment) => (
    attachment
    && typeof attachment === 'object'
    && (
      String(attachment.source || '').toLowerCase() === 'due_diligence'
      || String(attachment.partner_material_category || '').toLowerCase() === 'dd_report'
    )
  ));
}

function flattenRecord(record, index) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const scoring = record.scoring || {};
  const focusManagement = get(record, 'meta.focus_management', {});
  const shortlistingProjectsState = get(record, 'meta.shortlisting_projects', {});
  const storedPartnershipType = String(focusManagement?.partnership_type || '').trim();
  const storedPartnershipSource = String(focusManagement?.partnership_classification_source || 'auto').trim().toLowerCase();
  const autoPartnershipType = String(focusManagement?.partnership_auto_suggestion || '').trim();
  const hasHumanPartnership = storedPartnershipSource === 'manual' && storedPartnershipType;
  const effectivePartnershipType = hasHumanPartnership
    ? storedPartnershipType
    : autoPartnershipType || storedPartnershipType || 'unknown';
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
  const hasCriterionOverride = Object.keys(humanReviewOverrides(record).scores || {}).some((criterionId) =>
    ['target_relevance', 'competitive_landscape', 'moa_validity', 'platform_attractiveness', 'expansion_potential', 'data_maturity', 'marketability'].includes(criterionId)
  );
  const effectiveCriterionScores = [
    targetScore,
    competitiveScore,
    moaScore,
    platformScore,
    expansionScore,
    dataScore,
    marketScore
  ];
  const derivedTotalScore = effectiveCriterionScores.every((score) => Number.isInteger(score) && score >= 0 && score <= 3)
    ? effectiveCriterionScores.reduce((sum, score) => sum + score, 0)
    : null;
  const storedTotalScore = number(scoring.total_score);
  const effectiveTotalScore = Number.isInteger(totalScoreOverride)
    && totalScoreOverride >= 0
    && totalScoreOverride <= 21
    ? totalScoreOverride
    : hasCriterionOverride && derivedTotalScore !== null
      ? derivedTotalScore
      : storedTotalScore;
  const sourceReportEdit = latestSourceReportEdit(record);

  const computedHardFilter = computeHardFilter(record, criteria);
  const filter1Status = recordFilter1Status(record);
  const filter2Status = recordFilter2Status(record, computedHardFilter);
  const filterStatus = filter1Status.status !== '-' ? filter1Status : filter2Status;
  const earlyStop = earlyStopInfo(record);
  const identityUnverified = isTriage && (
    record?.triage?.identity_verified === false
    || filter1Status.status === 'INSUFFICIENT'
    || /asset_identity_not_verified/i.test(String(record?.source_report?.parser_status || ''))
  );
  const rawTheme = summary.theme || get(champion, 'matched_theme.name', '-');
  const theme = identityUnverified ? 'Unknown' : canonicalTheme(rawTheme);

  return {
    id: recordIdentifier(record, index),
    company: summary.company || table.company || '-',
    companyAliases: String(get(record, 'meta.pipeline_metadata.company_aliases', '')),
    countryRaw: summary.company_country || table.company_country || '-',
    country: canonicalCountry(summary.company_country || table.company_country || '-'),
    asset: summary.asset_name || table.asset_name || '-',
    assetAliases: String(get(record, 'meta.pipeline_metadata.asset_aliases', '')),
    target: summary.target || table.target || '-',
    theme,
    cluster: identityUnverified
      ? 'Unknown'
      : canonicalCluster(summary.cluster || get(champion, 'matched_cluster.name', '-'), theme),
    stageRaw: table.development_stage_source || table.development_stage || '-',
    stage: canonicalDisplayWithRawFallback(
      table.development_stage_source || table.development_stage || '-',
      canonicalDevelopmentStage(table.development_stage_source || table.development_stage || '-'),
    ),
    indication: table.indication || '-',
    mainIndicationRaw: table.main_indication || table.primary_indication || summary.main_indication || mainIndicationFrom(table.indication),
    mainIndication: canonicalMainIndication(
      table.main_indication || table.primary_indication || summary.main_indication,
      table.indication
    ),
    indicationList: canonicalIndicationList(table.indication_list, table.indication, table.main_indication || table.primary_indication || summary.main_indication),
    modalityRaw: table.modality_source || table.modality_platform || '-',
    modalityCanonical: canonicalModality(table.modality_source || table.modality_platform),
    modality: canonicalDisplayWithRawFallback(
      table.modality_source || table.modality_platform || '-',
      canonicalModality(table.modality_source || table.modality_platform),
      ['Others', 'Unknown']
    ),
    modalityTags: canonicalModalityTags(table.modality_source || table.modality_platform, canonicalModality(table.modality_source || table.modality_platform)),
    targetDescription: String(
      summary.target_description
      || targetCriterion.main_line_summary
      || targetCriterion.investigation_note
      || get(record, 'final_insight.one_line_summary', summary.one_line_summary || '-')
    ),
    focusTracked: focusManagement?.is_tracked === true,
    focusTrackingStatus: focusManagement?.is_tracked === true && focusManagement?.tracking_status === 'stationary'
      ? 'stationary'
      : focusManagement?.is_tracked === true
        ? 'priority'
        : 'untracked',
    focusPriorityRank: focusManagement?.is_tracked === true && focusManagement?.tracking_status === 'stationary'
      ? 1
      : 0,
    focusComment: String(focusManagement?.user_comment || ''),
    focusDueDate: String(focusManagement?.due_date || ''),
    focusOwner: String(focusManagement?.owner_name || ''),
    focusActionPlan: String(focusManagement?.action_plan || ''),
    focusAddedAt: String(focusManagement?.added_at || ''),
    shortlistingProjectTracked: Object.fromEntries(
      Object.entries(shortlistingProjectsState || {}).map(([projectId, projectState]) => [projectId, projectState?.is_tracked === true])
    ),
    shortlistingProjectTrackingStatus: Object.fromEntries(
      Object.entries(shortlistingProjectsState || {}).map(([projectId, projectState]) => [
        projectId,
        projectState?.is_tracked === true && projectState?.tracking_status === 'stationary' ? 'stationary'
          : projectState?.is_tracked === true ? 'priority'
          : 'untracked'
      ])
    ),
    teamCommentCount: teamComments.length,
    latestTeamComment: String(latestTeamComment?.body || ''),
    latestTeamCommentAuthor: String(latestTeamComment?.author || ''),
    isTriage,
    filter1: filter1Status.status,
    filter2: filter2Status.status,
    earlyStop,
    filter3: effectivePartnershipType,
    filter3Note: String(focusManagement?.partnership_note || ''),
    filter3Source: hasHumanPartnership ? 'manual' : 'auto',
    filter3CriteriaVersion: String(focusManagement?.partnership_classification_criteria_version || ''),
    filter3EvidenceSources: Array.isArray(focusManagement?.partnership_evidence_sources)
      ? focusManagement.partnership_evidence_sources.map(String)
      : [],
    inVivoStatus: String(focusManagement?.in_vivo_status || 'N/A'),
    inVivoSource: String(focusManagement?.in_vivo_status_source || 'auto'),
    inVitroStatus: String(focusManagement?.in_vitro_status || 'N/A'),
    inVitroSource: String(focusManagement?.in_vitro_status_source || 'auto'),
    admetCompleted: Number.isFinite(focusManagement?.admet_completed) ? focusManagement.admet_completed : null,
    admetSource: String(focusManagement?.admet_completed_source || 'auto'),
    ddStatus: hasDueDiligenceAttachment(record) ? 'O' : 'X',
    diseaseLinkageStatus: focusManagement?.disease_linkage_status ?? null,
    diseaseLinkageScoreUsed: focusManagement?.disease_linkage_score_used ?? null,
    diseaseLinkageSource: String(focusManagement?.disease_linkage_status_source || 'auto'),
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
    lastEditedAt: sourceReportEdit?.changed_at || '',
    lastEditedBy: sourceRevisionActorLabel(sourceReportEdit),
    lastEditedLabel: sourceReportEditLabel(sourceReportEdit),
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
    lines.push(`${row.lastEditedLabel || 'GPT 원문 갱신일'}: ${formatDateTimeKo(row.lastEditedAt)} · ${row.lastEditedBy || 'unknown'}`);
  }
  return lines.join('\n');
}

function rowHoverTitle(row, baseText = row.summary) {
  return [baseText, metaTooltipSuffix(row)].filter(Boolean).join('\n\n');
}

function triageRowHoverTitle(row) {
  return [
    `GPT 검색일: ${row.generatedAt || '-'}`,
    `스코어링 지침: v${row.criteriaVersion || '-'}`
  ].join('\n');
}

const FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS = [
  { key: 'moa', label: 'MoA', path: 'structured_table.moa' },
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

const FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS = [
  { key: 'moa', label: 'MoA', path: 'structured_table.moa' },
  { key: 'verifiedSourceCount', label: 'Verified sources', path: 'triage.verified_public_source_count' },
  { key: 'triageWhy', label: 'Triage rationale', path: 'triage.why' },
  { key: 'fullScoutEvidence', label: 'Advanced Research evidence needed', path: 'triage.missing_evidence_needed_for_full_scout' },
  { key: 'firstSource', label: 'First source URL', path: 'structured_table.sources.0.source_url' },
  { key: 'uncertainPoints', label: 'Uncertain points', path: 'validation.uncertain_points' }
];

function activeExtraColumnDefinitions() {
  if (activeTableMode() === 'triage') return FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS;
  if (activeTableMode() === 'full') return FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS;
  return [];
}

function formatExtraColumnValue(value, column = null) {
  if (column?.key === 'verifiedSourceCount') {
    const count = Number(value);
    return Number.isFinite(count) ? `${count} verified` : '-';
  }
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
  return activeExtraColumnDefinitions().filter((column) => state.extraColumns.has(column.key));
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

function rawColumnWidth(key) {
  const width = Number(activeColumnWidths()[key]);
  return Number.isFinite(width)
    ? Math.max(minColumnWidth(key), Math.min(MAX_COLUMN_WIDTH, width))
    : defaultColumnWidth(key);
}

function columnWidth(key) {
  return state.fittedColumnWidths[key] || rawColumnWidth(key);
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
  return `<th ${attrs} ${columnAttrs(columnKey)}><button data-sort="${escapeHtml(sortKey)}" data-sort-label="${escapeHtml(label)}" type="button">${escapeHtml(label)}</button>${resizeHandle(columnKey)}</th>`;
}

function scoreFilterHeader(label, sortKey, columnKey, filterKey = sortKey, extraClass = '') {
  const definition = SCORE_HEADER_FILTERS[filterKey];
  if (!definition) return sortableHeader(label, sortKey, columnKey, extraClass ? `class="${extraClass}"` : '');
  const summary = scoreFilterSummary(filterKey);
  const hasSelection = Boolean(summary);
  return `<th class="score-filter-header${hasSelection ? ' has-score-filter' : ''}${extraClass ? ` ${extraClass}` : ''}" ${columnAttrs(columnKey)}>
    <div class="score-filter-header-controls">
      <button
        class="score-filter-header-trigger"
        type="button"
        data-score-filter-trigger="${escapeHtml(filterKey)}"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-label="${escapeHtml(`${definition.criterion} 점수 필터${summary ? `: ${summary}` : ''}`)}"
        title="${escapeHtml(summary ? `${definition.criterion}: ${summary}` : `${definition.criterion} 점수 필터`)}"
      >${escapeHtml(label)}<span class="score-filter-header-dot" aria-hidden="true"></span></button>
      <button class="table-score-sort-button" data-sort="${escapeHtml(sortKey)}" data-sort-label="${escapeHtml(label)}" type="button" aria-label="${escapeHtml(`${label} sort`)}" title="${escapeHtml(`${label} sort`)}"><span class="score-sort-glyph" aria-hidden="true"></span></button>
    </div>${resizeHandle(columnKey)}</th>`;
}

function focusFilterHeader(label, filterKey, columnKey, sortKey = filterKey === 'admet' ? 'admetCompleted' : `${filterKey}Status`) {
  const definition = FOCUS_HEADER_FILTERS[filterKey];
  if (!definition) return sortableHeader(label, filterKey, columnKey);
  const summary = focusFilterSummary(filterKey);
  const baseDescription = definition.description || `${definition.label} filter`;
  return `<th class="score-filter-header${summary ? ' has-score-filter' : ''}" ${columnAttrs(columnKey)}>
    <div class="score-filter-header-controls">
      <button
        class="score-filter-header-trigger"
        type="button"
        data-focus-filter-trigger="${escapeHtml(filterKey)}"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-label="${escapeHtml(summary ? `${baseDescription}: ${summary}` : baseDescription)}"
        title="${escapeHtml(summary ? `${baseDescription}: ${summary}` : baseDescription)}"
      >${escapeHtml(label)}<span class="score-filter-header-dot" aria-hidden="true"></span></button>
      <button class="table-score-sort-button" data-sort="${escapeHtml(sortKey)}" data-sort-label="${escapeHtml(label)}" type="button" aria-label="${escapeHtml(`${label} sort`)}" title="${escapeHtml(`${label} sort`)}"><span class="score-sort-glyph" aria-hidden="true"></span></button>
    </div>${resizeHandle(columnKey)}</th>`;
}

function updateSortIndicators() {
  elements.pipelineTableHead?.querySelectorAll('button[data-sort]').forEach((button) => {
    const isActive = Boolean(
      state.sortKey &&
      state.sortDirection &&
      button.dataset.sort === state.sortKey
    );
    const direction = state.sortDirection === 'asc' ? '오름차순' : '내림차순';
    button.classList.toggle('sort-active', isActive);
    button.dataset.sortDirection = isActive ? state.sortDirection : '';
    button.title = isActive
      ? `${direction} 정렬 중 · 계속 클릭하면 반대 순서 또는 원본 순서로 전환됩니다.`
      : '클릭하여 정렬 · 오름차순/내림차순/원본 순서로 전환됩니다.';
    button.setAttribute(
      'aria-label',
      `${button.textContent.trim()} 정렬${isActive ? `, 현재 ${direction}` : ', 현재 원본 순서'}`
    );
    if (button.dataset.sortLabel) {
      button.setAttribute(
        'aria-label',
        `${button.dataset.sortLabel} 정렬${isActive ? `, 현재 ${direction}` : ', 현재 원본 순서'}`
      );
    }
    const glyph = button.querySelector('.score-sort-glyph');
    if (glyph) glyph.textContent = isActive ? (state.sortDirection === 'asc' ? '↑' : '↓') : '';
    const header = button.closest('th');
    if (header) header.setAttribute('aria-sort', isActive ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
  });
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

function currentTabRecordCount() {
  const isStep0Visible = Boolean(elements.step0Panel && !elements.step0Panel.hidden);
  const isKnowledgeMapVisible = Boolean(elements.knowledgeMapPanel && !elements.knowledgeMapPanel.hidden);
  // Atlas is a cross-workflow view, so its header count must retain the
  // Pipeline Table's global total rather than the workflow tab visited before it.
  if (isStep0Visible || isKnowledgeMapVisible) {
    return state.step0Loaded ? state.step0Rows.length : state.rawRecords.length;
  }
  return state.rows.filter(rowMatchesActiveTableMode).length;
}

function updateHeaderRecordCount() {
  if (!elements.dataStatus) return;
  elements.dataStatus.textContent = `전체 ${currentTabRecordCount()}건 로드됨`;
}

function recordDetailHref(row, mode = activeTableMode()) {
  if (row.isVirtualTriage) return `/detail?id=${encodeURIComponent(row.id)}&tab=full`;
  if (row.isTriage) return `/triage-detail?id=${encodeURIComponent(row.id)}`;
  return `/detail?id=${encodeURIComponent(row.id)}&tab=${encodeURIComponent(mode)}`;
}

function activeFilterKey() {
  if (activeTableMode() === 'triage') return 'filter1';
  if (activeTableMode() === 'focus') return 'filter3';
  return 'filter2';
}

function activeFilterLabel() {
  if (activeTableMode() === 'triage') return 'Filter 1';
  if (activeTableMode() === 'focus') return 'Filter 3';
  return 'Filter 2';
}

// Whichever of Filter 1/2/3 is currently visible+editable via the top "Filter N" multiselect
// (state.pass, keyed by activeFilterKey()) — shared by that multiselect and the header-click
// filter popover on the same column, so both surfaces always agree.
function activeStatusFilterOptions() {
  if (activeTableMode() === 'triage') {
    return [
      { value: 'SELECT', label: 'SELECT' },
      { value: 'REJECT', label: 'REJECT' },
      { value: 'INSUFFICIENT', label: 'INSUFFICIENT' }
    ];
  }
  if (activeTableMode() === 'focus') {
    return [
      { value: 'investment', label: '투자' },
      { value: 'value_up', label: 'Value Up' },
      { value: 'joint_research', label: '공동연구' },
      { value: 'unknown', label: 'Unknown' },
      { value: 'n_a', label: 'N/A' }
    ];
  }
  return [
    { value: 'PASS', label: 'PASS' },
    { value: 'REVIEW', label: filter2StatusLabel('REVIEW') },
    { value: 'FAIL', label: filter2StatusLabel('FAIL') }
  ];
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
    if (state.activeShortlistingProjectId === DEFAULT_SHORTLISTING_PROJECT_ID) {
      return !row.isTriage && row.focusTracked;
    }
    return !row.isTriage && row.shortlistingProjectTracked?.[state.activeShortlistingProjectId] === true;
  }
  if (activeTableMode() === 'full') {
    return !row.isTriage;
  }
  const status = row[activeFilterKey()];
  return Boolean(row.isVirtualTriage || (status && status !== '-'));
}

const FOCUS_TABLE_FIXED_LEFT_COLUMN_KEYS = [
  'select',
  'company',
  'country',
  'asset',
  'modality',
  'target',
  'mainIndication',
  'stage',
  'filter2',
  'totalScore'
];
// 'dd' (Due Diligence) intentionally omitted from the OIC default Project's
// visible columns for now — hidden from the Custom Review table per request.
const FOCUS_TABLE_OIC_METRIC_COLUMN_KEYS = ['filter3', 'inVivo', 'inVitro', 'admet', 'diseaseLinkage'];

const FOCUS_TABLE_COLUMN_KEYS = [
  ...FOCUS_TABLE_FIXED_LEFT_COLUMN_KEYS,
  ...FOCUS_TABLE_OIC_METRIC_COLUMN_KEYS,
  'focusDueDate',
  'customScore',
  'totalScore30',
  'focusManage'
];

function activeShortlistingMetricColumns() {
  if (state.activeShortlistingProjectId === DEFAULT_SHORTLISTING_PROJECT_ID) return [];
  return activeShortlistingProject()?.metric_columns || [];
}

function focusTableColumnKeys() {
  if (state.activeShortlistingProjectId === DEFAULT_SHORTLISTING_PROJECT_ID) return FOCUS_TABLE_COLUMN_KEYS;
  return [
    ...FOCUS_TABLE_FIXED_LEFT_COLUMN_KEYS,
    ...activeShortlistingMetricColumns().map((column) => `metric:${column.id}`),
    'focusDueDate',
    'customScore',
    'totalScore30',
    'focusManage'
  ];
}

function recomputeShortlistingScoreFields() {
  const projectId = state.activeShortlistingProjectId;
  const isDefaultProject = projectId === DEFAULT_SHORTLISTING_PROJECT_ID;
  for (const row of state.rows) {
    const rawCustomScore = isDefaultProject
      ? get(row.raw, 'meta.focus_management.custom_score', 0)
      : get(row.raw, `meta.shortlisting_projects.${projectId}.custom_score`, 0);
    const customScore = Number.isFinite(rawCustomScore) ? rawCustomScore : 0;
    row.customScore = customScore;
    row.totalScore30 = Number.isFinite(row.totalScore) ? row.totalScore + customScore : null;
    row.focusDueDate = String(
      (isDefaultProject
        ? get(row.raw, 'meta.focus_management.due_date', '')
        : get(row.raw, `meta.shortlisting_projects.${projectId}.due_date`, '')) || ''
    );
  }
}

function visibleColumnKeys(extraColumns = selectedExtraColumns()) {
  if (activeTableMode() === 'focus') return focusTableColumnKeys();
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
    ...(activeTableMode() === 'triage' ? ['rubricAction'] : []),
    ...extraColumns.map(extraColumnKey)
  ];
  if (activeTableMode() === 'full') keys.push('focusAction');
  return keys;
}

function fitColumnWidthsToTable(extraColumns = selectedExtraColumns()) {
  const keys = visibleColumnKeys(extraColumns);
  const wrapper = elements.pipelineTable?.closest('.table-wrap');
  const availableWidth = Math.floor(wrapper?.clientWidth || 0);
  const rawWidths = Object.fromEntries(keys.map((key) => [key, rawColumnWidth(key)]));
  const rawTotal = keys.reduce((sum, key) => sum + rawWidths[key], 0);
  const minimumTotal = keys.reduce((sum, key) => sum + minColumnWidth(key), 0);

  state.fittedColumnWidths = { ...rawWidths };
  if (!availableWidth || rawTotal <= availableWidth) return;

  if (availableWidth < minimumTotal) {
    if (activeTableMode() !== 'focus') return;
    const scale = availableWidth / minimumTotal;
    keys.forEach((key) => {
      state.fittedColumnWidths[key] = Math.max(1, Math.floor(minColumnWidth(key) * scale));
    });
    let remaining = availableWidth - keys.reduce((sum, key) => sum + state.fittedColumnWidths[key], 0);
    for (let index = 0; remaining > 0; index = (index + 1) % keys.length) {
      state.fittedColumnWidths[keys[index]] += 1;
      remaining -= 1;
    }
    return;
  }

  const compressible = rawTotal - minimumTotal;
  const targetReduction = rawTotal - availableWidth;
  keys.forEach((key) => {
    const minimum = minColumnWidth(key);
    const reducible = rawWidths[key] - minimum;
    const reduction = compressible > 0 ? targetReduction * (reducible / compressible) : 0;
    state.fittedColumnWidths[key] = Math.max(minimum, Math.floor(rawWidths[key] - reduction));
  });

  let remaining = availableWidth - keys.reduce((sum, key) => sum + state.fittedColumnWidths[key], 0);
  for (let index = 0; remaining > 0; index = (index + 1) % keys.length) {
    const key = keys[index];
    if (state.fittedColumnWidths[key] >= rawWidths[key]) continue;
    state.fittedColumnWidths[key] += 1;
    remaining -= 1;
  }
}

function updateFrozenColumnOffsets() {
  const tableElement = elements.pipelineTable?.closest('table');
  if (!tableElement) return;
  let offset = columnWidth('select');
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
  fitColumnWidthsToTable(extraColumns);
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

function fastTriageRowTotal(row) {
  const scores = [row.targetScore, row.moaScore, row.dataScore];
  return scores.every((score) => typeof score === 'number' && Number.isFinite(score))
    ? scores.reduce((sum, score) => sum + score, 0)
    : null;
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

function dueHalfPeriod(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) return '';
  return `${year}-${month <= 6 ? '1H' : '2H'}`;
}

function dueHalfOrder(period) {
  const match = String(period || '').match(/^(\d{4})-(1H|2H)$/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 2 + (match[2] === '2H' ? 1 : 0);
}

function currentDueHalfOrder(now = new Date()) {
  return now.getFullYear() * 2 + (now.getMonth() >= 6 ? 1 : 0);
}

function dueHalfLabel(period) {
  const match = String(period || '').match(/^(\d{4})-(1H|2H)$/);
  return match ? `${match[1]} ${match[2]}` : period;
}

const MULTI_FILTER_KEYS = ['theme', 'cluster', 'modality', 'country', 'indication', 'stage', 'pass'];
const SCORE_HEADER_FILTERS = {
  targetScore: { label: 'TAR', criterion: 'Target Area Relevance' },
  moaScore: { label: 'MoA', criterion: 'MoA Validity' },
  dataScore: { label: 'Data', criterion: 'Data Maturity' },
  competitiveScore: { label: 'Comp', criterion: 'Competitive Landscape' },
  platformScore: { label: 'Plat', criterion: 'Platform Attractiveness' },
  expansionScore: { label: 'Exp', criterion: 'Expansion Potential' },
  marketScore: { label: 'Market', criterion: 'Marketability' },
  totalScore: { label: 'Total Score', criterion: 'Total Score (0–21)' }
};
const SCORE_FILTER_OPTIONS = [
  { value: 'gte:1', label: '≥ 1점' },
  { value: 'gte:2', label: '≥ 2점' },
  { value: 'gte:3', label: '≥ 3점' },
  { value: 'eq:0', label: '= 0점' },
  { value: 'eq:1', label: '= 1점' },
  { value: 'eq:2', label: '= 2점' },
  { value: 'eq:3', label: '= 3점' }
];
// Total Score spans 0-21 (vs. 0-3 for the criteria above), so listing every value would be
// unusable — instead offer just the three tiers that also drive the score circle's color
// (Filter 2's PASS/REVIEW/FAIL total_score cutoffs, json/schema.md).
const TOTAL_SCORE_FILTER_OPTIONS = [
  { value: 'gte:14', label: 'Total Score ≥ 14' },
  { value: 'range:9:13', label: 'Total Score 9–13' },
  { value: 'lte:8', label: 'Total Score ≤ 8' }
];
function scoreFilterOptionsFor(key) {
  return key === 'totalScore' ? TOTAL_SCORE_FILTER_OPTIONS : SCORE_FILTER_OPTIONS;
}
const FOCUS_HEADER_FILTERS = {
  admet: { label: 'ADMET', kind: 'numeric', description: 'Completed studies (out of 25)' },
  inVivo: { label: 'In-vivo', kind: 'status', description: 'In-vivo efficacy evidence' },
  inVitro: { label: 'In-vitro', kind: 'status', description: 'In-vitro efficacy evidence' },
  dd: { label: 'DD', kind: 'status', description: 'Due Diligence file uploaded' },
  diseaseLinkage: { label: 'D·Link', kind: 'status', description: 'MoA가 실제 질환 병리·기능과 연결됐는지 표시' },
  filter2: {
    label: 'Filter 2',
    kind: 'status',
    description: 'Advanced Research 최종 판정',
    options: [
      { value: 'PASS', label: 'PASS' },
      { value: 'REVIEW', label: filter2StatusLabel('REVIEW') },
      { value: 'FAIL', label: filter2StatusLabel('FAIL') }
    ]
  }
};
const FOCUS_STATUS_FILTER_OPTIONS = [
  { value: 'O', label: 'O' },
  { value: 'X', label: 'X' }
];

function emptyFocusFilters() {
  return { admet: [], inVivo: [], inVitro: [], dd: [], diseaseLinkage: [], filter2: [] };
}

function normalizeAdmetFilterExpression(value) {
  const input = String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '')
    .replace(/^=</, '<=')
    .replace(/^=>/, '>=');
  if (!input) return '';
  const match = input.match(/^(>=|<=|>|<|=)?(\d{1,2})(이상|이하)?$/);
  if (!match) return '';
  const rawOperator = match[1] || '';
  const valueNumber = Number(match[2]);
  if (!Number.isInteger(valueNumber) || valueNumber < 0 || valueNumber > ADMET_TOTAL_ITEMS) return '';
  const operator = match[3] === '이상' ? '>='
    : match[3] === '이하' ? '<='
      : rawOperator;
  if (operator === '>') return valueNumber < ADMET_TOTAL_ITEMS ? `gte:${valueNumber + 1}` : '';
  if (operator === '<') return valueNumber > 0 ? `lte:${valueNumber - 1}` : '';
  if (operator === '>=') return `gte:${valueNumber}`;
  if (operator === '<=') return `lte:${valueNumber}`;
  return `eq:${valueNumber}`;
}

function focusFilterSelections(key) {
  const values = state.focusFilters?.[key];
  if (!Array.isArray(values)) return [];
  if (FOCUS_HEADER_FILTERS[key]?.kind === 'status') {
    const options = FOCUS_HEADER_FILTERS[key]?.options || FOCUS_STATUS_FILTER_OPTIONS;
    return [...new Set(values.filter((value) => options.some((option) => option.value === value)))];
  }
  return [...new Set(values.filter((value) => /^(gte|lte|eq):(?:[0-9]|1\d|2[0-5])$/.test(value)))];
}

function focusFilterLabel(value) {
  const [operator, rawValue] = String(value).split(':');
  const prefix = operator === 'gte' ? '≥ ' : operator === 'lte' ? '≤ ' : '= ';
  return `${prefix}${rawValue}`;
}

function focusFilterSummary(key) {
  const selected = focusFilterSelections(key);
  if (!selected.length) return '';
  const options = FOCUS_HEADER_FILTERS[key]?.options;
  const labels = selected.map((value) => (
    FOCUS_HEADER_FILTERS[key]?.kind === 'numeric'
      ? focusFilterLabel(value)
      : options?.find((option) => option.value === value)?.label || value
  ));
  return labels.length === 1 ? labels[0] : `${labels.length} conditions`;
}

function focusFilterMatches(row) {
  if (activeTableMode() !== 'focus') return true;
  const admetSelections = focusFilterSelections('admet');
  const admetMatches = !admetSelections.length || (
    Number.isInteger(row.admetCompleted) && admetSelections.some((selection) => {
      const [operator, rawValue] = selection.split(':');
      const value = Number(rawValue);
      return operator === 'gte' ? row.admetCompleted >= value
        : operator === 'lte' ? row.admetCompleted <= value
          : row.admetCompleted === value;
    })
  );
  const statusMatches = (key, value) => {
    const selected = focusFilterSelections(key);
    return !selected.length || selected.includes(value);
  };
  return admetMatches
    && statusMatches('inVivo', row.inVivoStatus)
    && statusMatches('inVitro', row.inVitroStatus)
    && statusMatches('dd', row.ddStatus)
    && statusMatches('diseaseLinkage', row.diseaseLinkageStatus)
    && statusMatches('filter2', row.filter2);
}

function scoreFilterSelections(key) {
  const values = state.scoreFilters?.[key];
  const options = scoreFilterOptionsFor(key);
  return Array.isArray(values)
    ? [...new Set(values.filter((value) => options.some((option) => option.value === value)))]
    : [];
}

function scoreFilterMatches(key, score) {
  const selections = scoreFilterSelections(key);
  if (!selections.length) return true;
  if (!Number.isInteger(score)) return false;
  return selections.some((selection) => {
    const [operator, a, b] = selection.split(':');
    if (operator === 'gte') return score >= Number(a);
    if (operator === 'lte') return score <= Number(a);
    if (operator === 'range') return score >= Number(a) && score <= Number(b);
    return score === Number(a);
  });
}

function scoreFilterSummary(key) {
  const selected = scoreFilterSelections(key);
  if (!selected.length) return '';
  const options = scoreFilterOptionsFor(key);
  const labels = selected
    .map((value) => options.find((option) => option.value === value)?.label || value);
  return labels.length === 1 ? labels[0] : `${labels.length}개 조건`;
}

function parseScoreFilterExpression(value) {
  const input = String(value || '').trim().toLowerCase().replaceAll(' ', '');
  if (!input) return '';
  const match = input.match(/(>=|≥|>|=)?([0-3])(?:점)?(?:이상|\+)?$/);
  if (!match) return '';
  const operator = match[1] || '';
  const score = Number(match[2]);
  const isThreshold = operator === '>=' || operator === '≥' || input.includes('이상') || input.endsWith('+');
  if (operator === '>') return score < 3 ? `gte:${score + 1}` : '';
  return isThreshold ? `gte:${score}` : `eq:${score}`;
}

function selectedFilterValues(value) {
  if (Array.isArray(value)) return [...new Set(value.filter(Boolean))];
  return value && value !== 'all' ? [value] : [];
}

function hasSelectedFilterValues(value) {
  return selectedFilterValues(value).length > 0;
}

function selectedFilterMatches(value, candidate) {
  const selected = selectedFilterValues(value);
  return !selected.length || selected.includes(candidate);
}

function selectedCountryFilterMatches(value, candidate) {
  const selected = selectedFilterValues(value);
  const countries = canonicalCountryValues(candidate);
  return !selected.length || selected.some((country) => countries.includes(country));
}

function cloneFilterValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

function closeMultiFilters(except = null) {
  MULTI_FILTER_KEYS.forEach((key) => {
    const filter = elements[`${key}Filter`];
    if (!filter || filter === except) return;
    filter.classList.remove('is-open');
    delete filter.dataset.filterSearchQuery;
    filter.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
    const menu = filter.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = true;
  });
}

let activeScoreHeaderFilter = null;

function scoreFilterPopoverElement() {
  let element = document.querySelector('#tableScoreFilterPopover');
  if (element) return element;
  element = document.createElement('div');
  element.id = 'tableScoreFilterPopover';
  element.className = 'table-score-filter-popover';
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'false');
  document.body.append(element);
  return element;
}

function closeScoreHeaderFilter() {
  if (activeScoreHeaderFilter?.trigger?.isConnected) {
    activeScoreHeaderFilter.trigger.setAttribute('aria-expanded', 'false');
  }
  activeScoreHeaderFilter = null;
  const popover = document.querySelector('#tableScoreFilterPopover');
  if (popover) {
    popover.hidden = true;
    popover.innerHTML = '';
  }
}

function positionScoreHeaderFilterPopover() {
  const popover = document.querySelector('#tableScoreFilterPopover');
  const trigger = activeScoreHeaderFilter?.trigger;
  if (!popover || popover.hidden || !trigger?.isConnected) return;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(292, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  const height = Math.min(popover.offsetHeight || 360, window.innerHeight - 24);
  popover.style.top = `${Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12))}px`;
}

function renderScoreHeaderFilterPopover({ focusExpression = false } = {}) {
  const active = activeScoreHeaderFilter;
  if (!active) return;
  const definition = SCORE_HEADER_FILTERS[active.key];
  if (!definition) return;
  const popover = scoreFilterPopoverElement();
  const selected = active.selected;
  const optionButton = (option) => `
    <button type="button" class="table-score-filter-option${selected.has(option.value) ? ' is-selected' : ''}" data-score-filter-option="${escapeHtml(option.value)}" role="option" aria-selected="${selected.has(option.value) ? 'true' : 'false'}">
      <span class="table-score-filter-dot" aria-hidden="true"></span><span>${escapeHtml(option.label)}</span>
    </button>`;
  const allButton = `<button type="button" class="table-score-filter-all${selected.size === 0 ? ' is-selected' : ''}" data-score-filter-all aria-pressed="${selected.size === 0 ? 'true' : 'false'}">전체</button>`;
  // Total Score spans 0-21, too wide to list every value like the 0-3 criteria below —
  // just the three tiers that also drive the score circle's color.
  const body = active.key === 'totalScore'
    ? `
      <div class="table-score-filter-expression-row">${allButton}</div>
      <p class="table-score-filter-group-label">표시 범위 · 복수 선택 가능</p>
      <div class="table-score-filter-option-grid" role="listbox" aria-label="${escapeHtml(definition.label)} range" aria-multiselectable="true">
        ${TOTAL_SCORE_FILTER_OPTIONS.map(optionButton).join('')}
      </div>`
    : `
      <div class="table-score-filter-expression-row">
        ${allButton}
        <label><span class="sr-only">Score expression</span><input type="search" data-score-filter-expression value="${escapeHtml(active.expression || '')}" placeholder="≥2, >1, =2" autocomplete="off" /></label>
        <button type="button" class="table-score-filter-add" data-score-filter-expression-add>추가</button>
      </div>
      <p class="table-score-filter-group-label">점수 이상</p>
      <div class="table-score-filter-option-grid" role="listbox" aria-label="${escapeHtml(definition.label)} minimum score" aria-multiselectable="true">
        ${SCORE_FILTER_OPTIONS.filter((option) => option.value.startsWith('gte:')).map(optionButton).join('')}
      </div>
      <p class="table-score-filter-group-label">정확한 점수 · 복수 선택 가능</p>
      <div class="table-score-filter-option-grid" role="listbox" aria-label="${escapeHtml(definition.label)} exact score" aria-multiselectable="true">
        ${SCORE_FILTER_OPTIONS.filter((option) => option.value.startsWith('eq:')).map(optionButton).join('')}
      </div>`;
  popover.innerHTML = `
    <div class="table-score-filter-popover-heading">
      <div><strong>${escapeHtml(definition.label)} 점수</strong><span>${escapeHtml(definition.criterion)}</span></div>
      <button type="button" class="table-score-filter-close" data-score-filter-close aria-label="점수 필터 닫기">×</button>
    </div>
    ${body}
    <p class="table-score-filter-helper">한 기준 안의 여러 조건은 OR, TAR·MoA·Data 등 기준 간 조건은 AND로 적용됩니다.</p>
    <div class="table-score-filter-actions"><button type="button" data-score-filter-done>완료</button></div>`;
  popover.hidden = false;
  positionScoreHeaderFilterPopover();
  if (focusExpression && active.key !== 'totalScore') {
    window.requestAnimationFrame(() => popover.querySelector('[data-score-filter-expression]')?.focus());
  }
}

function toggleScoreHeaderFilter(trigger) {
  const key = trigger?.dataset.scoreFilterTrigger;
  if (!SCORE_HEADER_FILTERS[key]) return;
  if (activeScoreHeaderFilter?.key === key) {
    closeScoreHeaderFilter();
    return;
  }
  closeMultiFilters();
  closeScoreHeaderFilter();
  activeScoreHeaderFilter = {
    key,
    trigger,
    selected: new Set(scoreFilterSelections(key)),
    expression: ''
  };
  trigger.setAttribute('aria-expanded', 'true');
  renderScoreHeaderFilterPopover({ focusExpression: true });
}

function addScoreHeaderFilterExpression() {
  const active = activeScoreHeaderFilter;
  const input = document.querySelector('#tableScoreFilterPopover [data-score-filter-expression]');
  if (!active || !input) return;
  const parsed = parseScoreFilterExpression(input.value);
  if (!parsed) {
    input.setCustomValidity('Use ≥2, >1, =2, or 2점 이상.');
    input.reportValidity();
    return;
  }
  active.selected.add(parsed);
  active.expression = '';
  renderScoreHeaderFilterPopover({ focusExpression: true });
}

function commitScoreHeaderFilter() {
  const active = activeScoreHeaderFilter;
  if (!active) return;
  state.scoreFilters = {
    ...state.scoreFilters,
    [active.key]: [...active.selected]
  };
  state.page = 1;
  captureModeFilters();
  closeScoreHeaderFilter();
  renderFilteredDashboard();
}

// Header-click filter for whichever of Filter 1/2/3 is visible in the active tab (Filter 1 in
// Fast Triage, Filter 2 in Full Scout, Filter 3/OI Partnership in Shortlisting). Same popover
// style as the DD/ADMET/etc. status filters, but backed by state.pass so it stays in sync with
// the existing "Filter N" multiselect above the table rather than tracking a second copy of the
// same selection. (Shortlisting's own Filter 2 column is separate — see FOCUS_HEADER_FILTERS.filter2 —
// because state.pass there is already spoken for by Filter 3.)
let activePassHeaderFilter = null;

function passFilterPopoverElement() {
  let element = document.querySelector('#passTableFilterPopover');
  if (element) return element;
  element = document.createElement('div');
  element.id = 'passTableFilterPopover';
  element.className = 'table-score-filter-popover';
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'false');
  document.body.append(element);
  return element;
}

function closePassHeaderFilter() {
  if (activePassHeaderFilter?.trigger?.isConnected) {
    activePassHeaderFilter.trigger.setAttribute('aria-expanded', 'false');
  }
  activePassHeaderFilter = null;
  const popover = document.querySelector('#passTableFilterPopover');
  if (popover) {
    popover.hidden = true;
    popover.innerHTML = '';
  }
}

function positionPassHeaderFilterPopover() {
  const popover = document.querySelector('#passTableFilterPopover');
  const trigger = activePassHeaderFilter?.trigger;
  if (!popover || popover.hidden || !trigger?.isConnected) return;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(292, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  const height = Math.min(popover.offsetHeight || 280, window.innerHeight - 24);
  popover.style.top = `${Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12))}px`;
}

function passFilterSummary() {
  const selected = selectedFilterValues(state.pass);
  if (!selected.length) return '';
  const options = activeStatusFilterOptions();
  const labels = selected.map((value) => options.find((option) => option.value === value)?.label || value);
  return labels.length === 1 ? labels[0] : `${labels.length} conditions`;
}

function renderPassHeaderFilterPopover() {
  const active = activePassHeaderFilter;
  if (!active) return;
  const popover = passFilterPopoverElement();
  const selected = active.selected;
  const options = activeStatusFilterOptions();
  const label = activeFilterLabel();
  const optionButton = (option) => `
    <button type="button" class="table-score-filter-option${selected.has(option.value) ? ' is-selected' : ''}" data-pass-filter-option="${escapeHtml(option.value)}" role="option" aria-selected="${selected.has(option.value) ? 'true' : 'false'}">
      <span class="table-score-filter-dot" aria-hidden="true"></span><span>${escapeHtml(option.label)}</span>
    </button>`;
  popover.innerHTML = `
    <div class="table-score-filter-popover-heading">
      <div><strong>${escapeHtml(label)} filter</strong><span>판정 상태</span></div>
      <button type="button" class="table-score-filter-close" data-pass-filter-close aria-label="Filter close">×</button>
    </div>
    <div class="table-score-filter-expression-row"><button type="button" class="table-score-filter-all${selected.size === 0 ? ' is-selected' : ''}" data-pass-filter-all aria-pressed="${selected.size === 0 ? 'true' : 'false'}">전체</button></div>
    <p class="table-score-filter-group-label">표시 상태 · 복수 선택 가능</p>
    <div class="table-score-filter-option-grid focus-status-filter-options" role="listbox" aria-label="${escapeHtml(label)} status" aria-multiselectable="true">
      ${options.map(optionButton).join('')}
    </div>
    <p class="table-score-filter-helper">기준 간 조건은 AND로 적용됩니다.</p>
    <div class="table-score-filter-actions"><button type="button" data-pass-filter-done>완료</button></div>`;
  popover.hidden = false;
  positionPassHeaderFilterPopover();
}

function togglePassHeaderFilter(trigger) {
  if (activePassHeaderFilter?.trigger === trigger) {
    closePassHeaderFilter();
    return;
  }
  closeMultiFilters();
  closeFocusHeaderFilter();
  closeScoreHeaderFilter();
  closePassHeaderFilter();
  activePassHeaderFilter = {
    trigger,
    selected: new Set(selectedFilterValues(state.pass))
  };
  trigger.setAttribute('aria-expanded', 'true');
  renderPassHeaderFilterPopover();
}

function commitPassHeaderFilter() {
  const active = activePassHeaderFilter;
  if (!active) return;
  state.pass = [...active.selected];
  state.page = 1;
  captureModeFilters();
  closePassHeaderFilter();
  renderFilters();
  renderFilteredDashboard();
}

function passFilterHeader(label, sortKey, columnKey, attrs = '') {
  const summary = passFilterSummary();
  const hasSelection = Boolean(summary);
  const filterLabel = activeFilterLabel();
  return `<th ${attrs} class="score-filter-header${hasSelection ? ' has-score-filter' : ''}" ${columnAttrs(columnKey)}>
    <div class="score-filter-header-controls">
      <button
        class="score-filter-header-trigger"
        type="button"
        data-pass-filter-trigger
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-label="${escapeHtml(`${filterLabel} 필터${summary ? `: ${summary}` : ''}`)}"
        title="${escapeHtml(summary ? `${filterLabel}: ${summary}` : `${filterLabel} 필터`)}"
      >${escapeHtml(label)}<span class="score-filter-header-dot" aria-hidden="true"></span></button>
      <button class="table-score-sort-button" data-sort="${escapeHtml(sortKey)}" data-sort-label="${escapeHtml(label)}" type="button" aria-label="${escapeHtml(`${label} sort`)}" title="${escapeHtml(`${label} sort`)}"><span class="score-sort-glyph" aria-hidden="true"></span></button>
    </div>${resizeHandle(columnKey)}</th>`;
}

let activeFocusHeaderFilter = null;

function focusFilterPopoverElement() {
  let element = document.querySelector('#focusTableFilterPopover');
  if (element) return element;
  element = document.createElement('div');
  element.id = 'focusTableFilterPopover';
  element.className = 'table-score-filter-popover';
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'false');
  document.body.append(element);
  return element;
}

function closeFocusHeaderFilter() {
  if (activeFocusHeaderFilter?.trigger?.isConnected) {
    activeFocusHeaderFilter.trigger.setAttribute('aria-expanded', 'false');
  }
  activeFocusHeaderFilter = null;
  const popover = document.querySelector('#focusTableFilterPopover');
  if (popover) {
    popover.hidden = true;
    popover.innerHTML = '';
  }
}

function positionFocusHeaderFilterPopover() {
  const popover = document.querySelector('#focusTableFilterPopover');
  const trigger = activeFocusHeaderFilter?.trigger;
  if (!popover || popover.hidden || !trigger?.isConnected) return;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(292, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  const height = Math.min(popover.offsetHeight || 280, window.innerHeight - 24);
  popover.style.top = `${Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12))}px`;
}

function renderFocusHeaderFilterPopover({ focusExpression = false } = {}) {
  const active = activeFocusHeaderFilter;
  if (!active) return;
  const definition = FOCUS_HEADER_FILTERS[active.key];
  if (!definition) return;
  const popover = focusFilterPopoverElement();
  const selected = active.selected;
  const allButton = `<button type="button" class="table-score-filter-all${selected.size === 0 ? ' is-selected' : ''}" data-focus-filter-all aria-pressed="${selected.size === 0 ? 'true' : 'false'}">전체</button>`;
  const optionButton = (option) => `
    <button type="button" class="table-score-filter-option${selected.has(option.value) ? ' is-selected' : ''}" data-focus-filter-option="${escapeHtml(option.value)}" role="option" aria-selected="${selected.has(option.value) ? 'true' : 'false'}">
      <span class="table-score-filter-dot" aria-hidden="true"></span><span>${escapeHtml(option.label)}</span>
    </button>`;
  const body = definition.kind === 'numeric'
    ? `
      <div class="table-score-filter-expression-row">
        ${allButton}
        <label><span class="sr-only">ADMET score expression</span><input type="search" data-focus-filter-expression value="${escapeHtml(active.expression || '')}" placeholder=">=15, <=10, =10" autocomplete="off" /></label>
        <button type="button" class="table-score-filter-add" data-focus-filter-expression-add>추가</button>
      </div>
      <p class="table-score-filter-helper">예: ≥15는 15점 이상, ≤10 또는 =<10은 10점 이하입니다. 여러 조건은 OR로 적용됩니다.</p>`
    : `
      <div class="table-score-filter-expression-row">${allButton}</div>
      <p class="table-score-filter-group-label">표시 상태 · 복수 선택 가능</p>
      <div class="table-score-filter-option-grid focus-status-filter-options" role="listbox" aria-label="${escapeHtml(definition.label)} status" aria-multiselectable="true">
        ${(definition.options || FOCUS_STATUS_FILTER_OPTIONS).map(optionButton).join('')}
      </div>`;
  popover.innerHTML = `
    <div class="table-score-filter-popover-heading">
      <div><strong>${escapeHtml(definition.label)} filter</strong><span>${escapeHtml(definition.description)}</span></div>
      <button type="button" class="table-score-filter-close" data-focus-filter-close aria-label="Filter close">×</button>
    </div>
    ${body}
    <p class="table-score-filter-helper">기준 간 조건은 AND로 적용됩니다.</p>
    <div class="table-score-filter-actions"><button type="button" data-focus-filter-done>완료</button></div>`;
  popover.hidden = false;
  positionFocusHeaderFilterPopover();
  if (focusExpression && definition.kind === 'numeric') {
    window.requestAnimationFrame(() => popover.querySelector('[data-focus-filter-expression]')?.focus());
  }
}

function toggleFocusHeaderFilter(trigger) {
  const key = trigger?.dataset.focusFilterTrigger;
  if (!FOCUS_HEADER_FILTERS[key]) return;
  if (activeFocusHeaderFilter?.key === key) {
    closeFocusHeaderFilter();
    return;
  }
  closeMultiFilters();
  closeFocusHeaderFilter();
  closeScoreHeaderFilter();
  closeFocusHeaderFilter();
  activeFocusHeaderFilter = {
    key,
    trigger,
    selected: new Set(focusFilterSelections(key)),
    expression: ''
  };
  trigger.setAttribute('aria-expanded', 'true');
  renderFocusHeaderFilterPopover({ focusExpression: FOCUS_HEADER_FILTERS[key].kind === 'numeric' });
}

function addFocusHeaderFilterExpression() {
  const active = activeFocusHeaderFilter;
  const input = document.querySelector('#focusTableFilterPopover [data-focus-filter-expression]');
  if (!active || !input) return;
  const parsed = normalizeAdmetFilterExpression(input.value);
  if (!parsed) {
    input.setCustomValidity('Use >=15, <=10, =<10, =10, 15 이상, or 10 이하.');
    input.reportValidity();
    return;
  }
  active.selected.add(parsed);
  active.expression = '';
  renderFocusHeaderFilterPopover({ focusExpression: true });
}

function commitFocusHeaderFilter() {
  const active = activeFocusHeaderFilter;
  if (!active) return;
  state.focusFilters = { ...state.focusFilters, [active.key]: [...active.selected] };
  state.page = 1;
  captureModeFilters();
  closeFocusHeaderFilter();
  renderFilteredDashboard();
}

function getVisibleRows(includeQuery = true) {
  const query = includeQuery ? state.query.trim() : '';
  const searchTerms = [...(state.searchTokens || []), query]
    .map(normalizedDashboardSearchText)
    .filter(Boolean);
  const filterKey = activeFilterKey();
  const rows = state.rows.filter((row) => {
      const searchable = [
        row.company,
        row.companyAliases,
        row.country,
        row.countryRaw,
        row.asset,
        row.assetAliases,
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
        .map(normalizedDashboardSearchText)
        .join(' ');

      return (
        rowMatchesActiveTableMode(row) &&
        searchTerms.every((term) => searchable.includes(term)) &&
        selectedFilterMatches(state.theme, row.theme) &&
        selectedFilterMatches(state.cluster, row.cluster) &&
        (selectedFilterValues(state.modality).length === 0 || selectedFilterValues(state.modality).some((value) => (
          row.modalityTags?.includes(value) || row.modalityCanonical === value
        ))) &&
        (selectedFilterValues(state.indication).length === 0 || selectedFilterValues(state.indication).some((value) => dashboardIndicationFilterValues(row).includes(value))) &&
        selectedCountryFilterMatches(state.country, row.country) &&
        selectedFilterMatches(state.stage, row.stage) &&
        selectedFilterMatches(state.pass, row[filterKey]) &&
        scoreFilterMatches('targetScore', row.targetScore) &&
        scoreFilterMatches('moaScore', row.moaScore) &&
        scoreFilterMatches('dataScore', row.dataScore) &&
        scoreFilterMatches('competitiveScore', row.competitiveScore) &&
        scoreFilterMatches('platformScore', row.platformScore) &&
        scoreFilterMatches('expansionScore', row.expansionScore) &&
        scoreFilterMatches('marketScore', row.marketScore) &&
        scoreFilterMatches('totalScore', row.totalScore) &&
        focusFilterMatches(row)
      );
    });

  if (!state.sortKey || !state.sortDirection) return rows;

  return rows.sort((a, b) => {
      const av = a[state.sortKey];
      const bv = b[state.sortKey];
      const direction = state.sortDirection === 'asc' ? 1 : -1;

      if (state.sortKey === 'focusPriority') {
        const sign = state.sortDirection === 'asc' ? -1 : 1;
        const rankDiff = ((a.focusPriorityRank ?? 0) - (b.focusPriorityRank ?? 0)) * sign;
        if (rankDiff !== 0) return rankDiff;
        return ((b.focusTotalScore ?? -Infinity) - (a.focusTotalScore ?? -Infinity)) * sign;
      }

      if (state.sortKey === 'filter1' || state.sortKey === 'filter2') {
        const rankMap = state.sortKey === 'filter1' ? FILTER1_SORT_RANK : FILTER2_SORT_RANK;
        const aRank = rankMap[av] ?? Number.MAX_SAFE_INTEGER;
        const bRank = rankMap[bv] ?? Number.MAX_SAFE_INTEGER;
        return (aRank - bRank) * direction;
      }

      if (typeof av === 'number' || typeof bv === 'number') {
        return ((av ?? -Infinity) - (bv ?? -Infinity)) * direction;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'ko') * direction;
    });
}

function renderFilters() {
  const modeRows = state.rows.filter(rowMatchesActiveTableMode);
  if (elements.searchInput) elements.searchInput.value = state.query;
  renderSearchTokens();
  const themes = [...new Set(modeRows.map((row) => row.theme).filter(Boolean))].sort();
  const clusters = [...new Set(modeRows.map((row) => row.cluster).filter(Boolean))].sort();
  const modalities = [...new Set(modeRows.flatMap((row) => row.modalityTags?.length ? row.modalityTags : [row.modalityCanonical]).filter(Boolean))].sort();
  const countries = [...new Set(modeRows.flatMap((row) => canonicalCountryValues(row.country)).filter(Boolean))].sort();
  const indications = [...new Set(modeRows.flatMap((row) => dashboardIndicationFilterValues(row)))].sort();
  const stages = [...new Set(modeRows.map((row) => row.stage).filter(Boolean))]
    .sort((a, b) => {
      const aIndex = CANONICAL_DEVELOPMENT_STAGES.indexOf(a);
      const bIndex = CANONICAL_DEVELOPMENT_STAGES.indexOf(b);
      const aRank = aIndex < 0 ? CANONICAL_DEVELOPMENT_STAGES.length : aIndex;
      const bRank = bIndex < 0 ? CANONICAL_DEVELOPMENT_STAGES.length : bIndex;
      return aRank - bRank || a.localeCompare(b, 'en');
    });
  const filterStatuses = activeStatusFilterOptions();
  const resetInvalidSelections = (key, values) => {
    state[key] = selectedFilterValues(state[key]).filter((value) => values.includes(value));
  };
  resetInvalidSelections('theme', themes);
  resetInvalidSelections('cluster', clusters);
  resetInvalidSelections('modality', modalities);
  resetInvalidSelections('country', countries);
  resetInvalidSelections('indication', indications);
  resetInvalidSelections('stage', stages);
  resetInvalidSelections('pass', filterStatuses.map((item) => item.value));

  renderMultiFilter(elements.themeFilter, 'theme', themes);
  renderMultiFilter(elements.clusterFilter, 'cluster', clusters);
  renderMultiFilter(elements.modalityFilter, 'modality', modalities);
  renderMultiFilter(elements.countryFilter, 'country', countries);
  renderMultiFilter(elements.indicationFilter, 'indication', indications);
  renderMultiFilter(elements.stageFilter, 'stage', stages);
  renderMultiFilter(elements.passFilter, 'pass', filterStatuses);
  if (elements.passFilterLabel) elements.passFilterLabel.textContent = activeFilterLabel();
}

function canonicalFilterOrder(key) {
  const dictionaryValues = (state.categorySynonyms?.[key] || [])
    .map((entry) => String(entry?.canonical || '').trim())
    .filter(Boolean);
  if (key === 'indication') return [...new Set([...dictionaryValues, ...INPUT_INDICATIONS])];
  return [...new Set(dictionaryValues)];
}

function multiFilterMenuMarkup(key, options, selected, valueAttribute, query = '') {
  const byValue = new Map(options.map((option) => [option.value, option]));
  const canonicalOrder = canonicalFilterOrder(key);
  const canonicalValues = new Set(canonicalOrder);
  const hasCanonicalLibrary = canonicalOrder.length > 0;
  const canonicalOptions = hasCanonicalLibrary
    ? canonicalOrder.map((value) => byValue.get(value)).filter(Boolean)
    : options;
  const additionalOptions = options
    .filter((option) => !canonicalValues.has(option.value))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  const optionMarkup = (option, isCanonical) => {
    const isSelected = selected.includes(option.value);
    return `<button type="button" class="filter-multiselect-option${isSelected ? ' is-selected' : ''}${isCanonical ? ' is-canonical' : ''}" ${valueAttribute}="${escapeHtml(option.value)}" data-filter-menu-option role="option" aria-selected="${isSelected}"><span class="filter-multiselect-check" aria-hidden="true">${isSelected ? '✓' : ''}</span><span>${escapeHtml(option.label)}</span></button>`;
  };
  const groupMarkup = (label, group, isCanonical) => group.length
    ? `<div class="filter-multiselect-option-group" data-filter-menu-group><p>${label}</p>${group.map((option) => optionMarkup(option, isCanonical)).join('')}</div>`
    : '';
  return [
    `<div class="filter-multiselect-menu-topbar"><button type="button" class="filter-multiselect-option filter-multiselect-all-option${selected.length === 0 ? ' is-selected' : ''}" ${valueAttribute}="all" role="option" aria-selected="${selected.length === 0}"><span class="filter-multiselect-check" aria-hidden="true">${selected.length === 0 ? '✓' : ''}</span><span>전체</span></button><label class="filter-multiselect-menu-search"><span class="sr-only">${escapeHtml(key)} 검색</span><input type="search" data-filter-menu-search value="${escapeHtml(query)}" placeholder="검색" autocomplete="off" /></label></div>`,
    groupMarkup(hasCanonicalLibrary ? 'Canonical Library' : 'Available values', canonicalOptions, hasCanonicalLibrary),
    groupMarkup('Others', additionalOptions, false)
  ];
}

function filterMultiMenuOptions(menu, query = '') {
  if (!menu) return;
  const normalized = normalizedDashboardSearchText(query);
  menu.querySelectorAll('[data-filter-menu-option]').forEach((option) => {
    option.hidden = Boolean(normalized) && !normalizedDashboardSearchText(option.textContent).includes(normalized);
  });
  menu.querySelectorAll('[data-filter-menu-group]').forEach((group) => {
    group.hidden = [...group.querySelectorAll('[data-filter-menu-option]')].every((option) => option.hidden);
  });
}

function handleMultiMenuSearch(event) {
  const input = event.target.closest?.('[data-filter-menu-search]');
  if (!input) return;
  const filter = input.closest('.filter-multiselect');
  if (!filter) return;
  filter.dataset.filterSearchQuery = input.value;
  filterMultiMenuOptions(filter.querySelector('.filter-multiselect-menu'), input.value);
}

function renderMultiFilter(element, key, values) {
  if (!element) return;
  const options = values.map((value) => typeof value === 'string' ? { value, label: value } : value);
  const selected = selectedFilterValues(state[key]);
  const summary = element.querySelector('[data-multi-filter-summary]');
  const trigger = element.querySelector('.filter-multiselect-trigger');
  const menu = element.querySelector('.filter-multiselect-menu');
  if (!summary || !trigger || !menu) return;
  const isOpen = element.classList.contains('is-open');

  summary.textContent = selected.length === 0
    ? '전체'
    : selected.length === 1
      ? (options.find((option) => option.value === selected[0])?.label || selected[0])
      : `${selected.length}개 선택`;
  trigger.setAttribute('aria-label', `${element.querySelector('.filter-multiselect-label')?.textContent || key}: ${summary.textContent}`);
  element.classList.toggle('has-selection', selected.length > 0);
  const searchQuery = element.dataset.filterSearchQuery || '';
  menu.innerHTML = [
    ...multiFilterMenuMarkup(key, options, selected, 'data-multi-filter-value', searchQuery),
    '<div class="filter-multiselect-menu-actions"><button type="button" class="filter-multiselect-done" data-multi-filter-done>완료</button></div>'
  ].join('');
  filterMultiMenuOptions(menu, searchQuery);
  menu.hidden = !isOpen;
  trigger.setAttribute('aria-expanded', String(isOpen));
}

const WORKFLOW_COPY = {
  triage: {
    stage: '1차 스크리닝',
    description: '관심 적응증과 공개 근거를 기준으로 Advanced Research 검토 후보를 빠르게 선별합니다.',
    filterLabel: 'Filter 1',
    priorityTitle: 'Advanced Research 대기 후보',
    prioritySubtitle: 'SELECT 후보 · Pipeline Stage 분포'
  },
  full: {
    stage: '2차 정밀 분석',
    description: '선별된 후보를 과학성·차별성·개발성·사업성 관점에서 심층 평가합니다.',
    filterLabel: 'Filter 2',
    priorityTitle: 'Priority Pipeline',
    prioritySubtitle: '최대 10개 · Total score · 동점 시 최신 조사 순'
  },
  focus: {
    stage: '3차 집중 관리',
    description: '즐겨찾기로 등록한 Advanced Research 후보의 OI Partnership Type과 후속 Action을 관리합니다.',
    filterLabel: 'Filter 3',
    priorityTitle: 'F/U Action',
    prioritySubtitle: 'Action date 설정 항목 · 임박 순'
  }
};

const PARTNERSHIP_LABELS = {
  investment: '투자',
  value_up: 'Value Up',
  joint_research: '공동연구',
  tbd: 'TBD',
  unknown: 'Unknown',
  n_a: 'N/A',
  '': 'Unknown'
};

function actionDateSummaryStatus(daysUntilDue) {
  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue === 0) return 'TODAY';
  if (daysUntilDue <= 7) return 'WITHIN_7_DAYS';
  if (daysUntilDue <= 30) return 'WITHIN_30_DAYS';
  if (daysUntilDue <= 90) return 'WITHIN_90_DAYS';
  return 'LONG_TERM';
}

const ACTION_DATE_SUMMARY_DETAILS = {
  OVERDUE: { label: 'Overdue', tone: 'fail' },
  TODAY: { label: 'Today', tone: 'urgent' },
  WITHIN_7_DAYS: { label: '7일 이내', tone: 'review' },
  WITHIN_30_DAYS: { label: '30일 이내', tone: 'review' },
  WITHIN_90_DAYS: { label: '90일 이내', tone: 'neutral' },
  LONG_TERM: { label: '중장기', tone: 'neutral' }
};

function uniqueAssetKey(row) {
  return `${String(row.company || '').trim().toLowerCase()}::${String(row.asset || '').trim().toLowerCase()}`;
}

function uniqueAssetRows(rows) {
  return [...new Map(rows.map((row) => [uniqueAssetKey(row), row])).values()];
}

function dashboardAssetIdentity(row) {
  return state.dashboardSummary?.record_asset_identities?.[row.id] || uniqueAssetKey(row);
}

function uniqueAssetCount(rows) {
  return new Set(rows.map(dashboardAssetIdentity)).size;
}

function fallbackInterestIndicationLabel(value) {
  const text = String(value || '').toLowerCase();
  if (/alzheimer|\bad\b/.test(text)) return "Alzheimer's disease";
  if (/parkinson|\bpd\b/.test(text)) return "Parkinson's disease";
  if (/amyotrophic lateral sclerosis|motor neuron disease|\bals\b/.test(text)) return 'Amyotrophic lateral sclerosis / motor neuron disease';
  if (/multiple sclerosis|neuroinflamm|\bms\b/.test(text)) return 'Multiple sclerosis / neuroinflammatory disease';
  if (/neuropathic pain|neuralgia|peripheral neuropath/.test(text)) return 'Neuropathic pain';
  if (/epilep|seizure/.test(text)) return 'Epilepsy / seizure disorders';
  return 'Others';
}

function fallbackDistribution(rows, valueGetter, orderedLabels) {
  const counts = countBy(rows, valueGetter);
  return orderedLabels.map((label) => ({
    key: label,
    label,
    count: Number(counts[label] || 0)
  }));
}

function fallbackModalityDistribution(rows) {
  const counts = countBy(rows, (row) => modalitySummaryGroup(
    String(row.modality || 'Unknown').trim() || 'Unknown'
  ));
  let othersCount = 0;
  const known = [];
  Object.entries(counts).forEach(([label, count]) => {
    if (/^(unknown|n\/?a|others?|-)$/i.test(label)) {
      othersCount += count;
      return;
    }
    known.push([label, count]);
  });
  known.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  const top = known.slice(0, 6);
  othersCount += known.slice(6).reduce((sum, [, count]) => sum + count, 0);
  return [
    ...top.map(([label, count]) => ({ key: label, label, count })),
    { key: 'others', label: 'Others', count: othersCount }
  ];
}

function fallbackCommonListItem(row) {
  return {
    record_id: row.id,
    company: row.company,
    asset: row.asset,
    country: row.country,
    main_indication: row.mainIndication,
    detailed_indication: row.indication,
    development_stage: row.stage,
    completed_at: row.completedAt || row.generatedAt || '',
    generated_at: row.generatedAt || ''
  };
}

function fallbackTabSummary(mode, filteredRows = null) {
  const allTriageRows = uniqueAssetRows(state.rows.filter((row) => row.isTriage));
  const allFullRows = uniqueAssetRows(state.rows.filter((row) => !row.isTriage));
  const hasFilteredRows = Array.isArray(filteredRows);
  const filteredAssetRows = hasFilteredRows ? uniqueAssetRows(filteredRows) : [];
  const triageRows = hasFilteredRows && mode === 'triage' ? filteredAssetRows : allTriageRows;
  const fullRows = hasFilteredRows && mode !== 'triage' ? filteredAssetRows : allFullRows;
  const focusRows = hasFilteredRows && mode === 'focus'
    ? fullRows
    : fullRows.filter((row) => row.focusTracked);
  const interestLabels = [
    "Alzheimer's disease",
    "Parkinson's disease",
    'Amyotrophic lateral sclerosis / motor neuron disease',
    'Multiple sclerosis / neuroinflammatory disease',
    'Neuropathic pain',
    'Epilepsy / seizure disorders',
    'Others'
  ];
  const indicationDistribution = (rows) => fallbackDistribution(
    rows,
    (row) => fallbackInterestIndicationLabel(row.mainIndication || row.indication),
    interestLabels
  );
  if (mode === 'triage') {
    const fullKeys = new Set(fullRows.map(uniqueAssetKey));
    const awaiting = triageRows
      .filter((row) => row.filter1 === 'SELECT' && !fullKeys.has(uniqueAssetKey(row)))
      .sort((a, b) => (b.dataScore - a.dataScore) || (b.moaScore - a.moaScore) || String(b.generatedAt).localeCompare(String(a.generatedAt)))
      .map((row) => ({
        ...fallbackCommonListItem(row),
        filter1: row.filter1,
        completed_at: row.generatedAt,
        target_relevance: row.targetScore,
        moa_validity: row.moaScore,
        data_maturity: row.dataScore
      }));
    return {
      kpis: {
        assets: triageRows.length,
        select: triageRows.filter((row) => row.filter1 === 'SELECT').length,
        reject: triageRows.filter((row) => row.filter1 === 'REJECT').length,
        insufficient: triageRows.filter((row) => row.filter1 === 'INSUFFICIENT').length,
        average_total_score: average(triageRows.map(fastTriageRowTotal)),
        max_score: 9
      },
      distribution_population: {
        scope: hasFilteredRows ? 'filtered_rows' : 'active_tab',
        assets: triageRows.length
      },
      status_distribution: fallbackDistribution(triageRows, (row) => row.filter1, ['SELECT', 'REJECT', 'INSUFFICIENT']),
      indication_distribution: indicationDistribution(triageRows),
      modality_distribution: fallbackModalityDistribution(triageRows),
      awaiting_full_scout: awaiting
    };
  }
  if (mode === 'focus') {
    const ongoingPartnershipTypes = ['investment', 'value_up', 'joint_research'];
    const ongoingFocusRows = focusRows.filter((row) => ongoingPartnershipTypes.includes(row.filter3));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const actionRows = focusRows
      .filter((row) => {
        if (!row.focusDueDate) return false;
        return !Number.isNaN(new Date(`${row.focusDueDate}T00:00:00`).getTime());
      })
      .map((row) => {
        const due = new Date(`${row.focusDueDate}T00:00:00`);
        const days = Math.ceil((due - now) / 86400000);
        const actionStatus = actionDateSummaryStatus(days);
        return {
          ...fallbackCommonListItem(row),
          filter2: row.filter2,
          total_score: row.totalScore,
          partnership_type: row.filter3 || 'unknown',
          partnership_label: PARTNERSHIP_LABELS[row.filter3] || row.filter3,
          partnership_source: row.filter3Source,
          human_override: row.filter3Source === 'manual',
          action_date: row.focusDueDate,
          days_until_due: days,
          action_status: actionStatus,
          action_due_at: due.getTime(),
          action_updated_at: row.lastEditedAt || row.generatedAt || ''
        };
      })
      .sort((a, b) => (
        Number(a.action_due_at) - Number(b.action_due_at)
        || (Date.parse(b.action_updated_at || '') || 0) - (Date.parse(a.action_updated_at || '') || 0)
        || String(a.asset || '').localeCompare(String(b.asset || ''), 'en')
      ));
    return {
      kpis: {
        pipelines: focusRows.length,
        ongoing: ongoingFocusRows.length,
        investment: focusRows.filter((row) => row.filter3 === 'investment').length,
        value_up: focusRows.filter((row) => row.filter3 === 'value_up').length,
        joint_research: focusRows.filter((row) => row.filter3 === 'joint_research').length,
        unknown: focusRows.filter((row) => !row.filter3 || row.filter3 === 'unknown').length,
        average_total_score: average(focusRows.map((row) => row.totalScore)),
        max_score: 21
      },
      distribution_population: {
        scope: hasFilteredRows ? 'filtered_rows' : 'shortlisted_pool',
        assets: focusRows.length
      },
      partnership_distribution: fallbackDistribution(
        focusRows,
        (row) => ongoingPartnershipTypes.includes(row.filter3) ? row.filter3 : 'tbd',
        [...ongoingPartnershipTypes, 'tbd']
      )
        .map((item) => ({ ...item, label: PARTNERSHIP_LABELS[item.key] })),
      indication_distribution: indicationDistribution(focusRows),
      modality_distribution: fallbackModalityDistribution(focusRows),
      action_required: actionRows
    };
  }
  const priority = fullRows
    .filter((row) => row.filter2 !== 'FAIL')
    .sort((a, b) => {
      const scoreDifference = Number(b.totalScore ?? -1) - Number(a.totalScore ?? -1);
      const bDate = Date.parse(b.completedAt || b.generatedAt || '') || 0;
      const aDate = Date.parse(a.completedAt || a.generatedAt || '') || 0;
      return scoreDifference || bDate - aDate || String(a.asset || '').localeCompare(String(b.asset || ''), 'en');
    })
    .map((row) => ({
      ...fallbackCommonListItem(row),
      filter2: row.filter2,
      total_score: row.totalScore,
      max_score: row.maxScore,
      data_maturity: row.dataScore,
      target_relevance: row.targetScore
    }));
  return {
    kpis: {
      assets: fullRows.length,
      pass: fullRows.filter((row) => row.filter2 === 'PASS').length,
      review: fullRows.filter((row) => row.filter2 === 'REVIEW').length,
      fail: fullRows.filter((row) => row.filter2 === 'FAIL').length,
      average_total_score: average(fullRows.map((row) => row.totalScore)),
      max_score: 21
    },
    distribution_population: {
      scope: hasFilteredRows ? 'filtered_rows' : 'active_tab',
      assets: fullRows.length
    },
    status_distribution: fallbackDistribution(fullRows, (row) => row.filter2, ['PASS', 'REVIEW', 'FAIL']),
    indication_distribution: indicationDistribution(fullRows),
    modality_distribution: fallbackModalityDistribution(fullRows),
    priority_pipelines: priority
  };
}

function activeTabSummary() {
  const mode = activeTableMode();
  if (activeSummaryFilterCount() > 0) {
    return fallbackTabSummary(mode, getVisibleRows(false));
  }
  const key = mode === 'triage'
    ? 'fast_triage'
    : mode === 'focus'
      ? 'shortlisting'
      : 'full_scout';
  return state.dashboardSummary?.tabs?.[key] || fallbackTabSummary(mode);
}

async function refreshDashboardSummary(signal) {
  const requestId = ++state.dashboardSummaryRequestId;
  try {
    const response = await fetch(DASHBOARD_SUMMARY_URL, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const summary = await response.json();
    if (requestId !== state.dashboardSummaryRequestId) return false;
    state.dashboardSummary = summary;
    return true;
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    if (requestId !== state.dashboardSummaryRequestId) return false;
    console.warn('Dashboard summary refresh failed; using current table data.', error);
    state.dashboardSummary = null;
    return false;
  }
}

function workflowIconMarkup(name) {
  const paths = {
    assets: '<path d="M4 7.5h16M6 4h12v16H6z"/><path d="M9 11h6M9 15h6"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>',
    reject: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.5 2.5 0 0 1 4.8 1c0 2-2.6 2-2.6 4M12 17h.01"/>',
    review: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    score: '<path d="M5 20V9m7 11V4m7 16v-7"/>',
    investment: '<path d="M4 19h16M6 16V9m4 7V9m4 7V9m4 7V9M4 7l8-4 8 4z"/>',
    value: '<path d="M5 17 10 12l3 3 6-8"/><path d="M14 7h5v5"/>',
    research: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/>'
  };
  return `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">${paths[name] || paths.assets}</svg>`;
}

function setMetricSlot(slot, { label, value, icon, tone = 'neutral', hidden = false }) {
  const card = elements[`${slot}Card`];
  const labelElement = elements[`${slot}Label`];
  const valueElement = elements[slot];
  const iconElement = elements[`${slot}Icon`];
  if (!card || !labelElement || !valueElement || !iconElement) return;
  card.hidden = hidden;
  card.classList.remove('tone-green', 'tone-red', 'tone-gray', 'tone-blue', 'tone-purple', 'tone-amber');
  card.classList.add(`tone-${tone}`);
  labelElement.textContent = label;
  valueElement.textContent = value === null || value === undefined || value === '' ? '-' : String(value);
  iconElement.innerHTML = workflowIconMarkup(icon);
}

function renderMetrics() {
  const mode = activeTableMode();
  const summary = activeTabSummary();
  const kpis = summary.kpis || {};
  const scoreValue = kpis.average_total_score !== null
    && kpis.average_total_score !== undefined
    && Number.isFinite(Number(kpis.average_total_score))
    ? Number(kpis.average_total_score).toFixed(1)
    : '-';
  if (elements.summaryAverageScore) {
    const scoreMaximum = mode === 'triage' ? 9 : 21;
    elements.summaryAverageScore.textContent = scoreValue === '-' ? '평균 -' : `평균 ${scoreValue}점`;
    elements.summaryAverageScore.title = `현재 탭에 포함된 asset의 총점 평균 (${scoreMaximum}점 만점)`;
    elements.summaryAverageScore.setAttribute(
      'aria-label',
      scoreValue === '-'
        ? '현재 탭의 평균 총점 없음'
        : `현재 탭의 평균 총점 ${scoreValue}점, ${scoreMaximum}점 만점`
    );
  }
  const slots = mode === 'triage'
    ? [
        ['metricTotal', { label: 'Simple Assets', value: kpis.assets ?? 0, icon: 'assets', tone: 'blue' }],
        ['metricPass', { label: 'SELECT', value: kpis.select ?? 0, icon: 'check', tone: 'green' }],
        ['metricScore', { label: 'REJECT', value: kpis.reject ?? 0, icon: 'reject', tone: 'red' }],
        ['metricTarget', { label: 'INSUFFICIENT', value: kpis.insufficient ?? 0, icon: 'question', tone: 'gray' }],
        ['metricCountries', { label: '평균 총점 / 9', value: scoreValue, icon: 'score', tone: 'blue', hidden: true }]
      ]
    : mode === 'focus'
      ? [
          ['metricTotal', { label: 'Custom Pipelines', value: kpis.pipelines ?? 0, icon: 'assets', tone: 'purple' }],
          ['metricPass', { label: '투자', value: kpis.investment ?? 0, icon: 'investment', tone: 'green' }],
          ['metricScore', { label: 'Value Up', value: kpis.value_up ?? 0, icon: 'value', tone: 'blue' }],
          ['metricTarget', { label: '공동연구', value: kpis.joint_research ?? 0, icon: 'research', tone: 'purple' }],
          ['metricCountries', { label: '평균 총점 / 21', value: scoreValue, icon: 'score', tone: 'blue', hidden: true }]
        ]
      : [
          ['metricTotal', { label: 'Advanced Assets', value: kpis.assets ?? 0, icon: 'assets', tone: 'blue' }],
          ['metricPass', { label: 'PASS', value: kpis.pass ?? 0, icon: 'check', tone: 'green' }],
          ['metricScore', { label: filter2StatusLabel('REVIEW'), value: kpis.review ?? 0, icon: 'review', tone: 'amber' }],
          ['metricTarget', { label: filter2StatusLabel('FAIL'), value: kpis.fail ?? 0, icon: 'reject', tone: 'red' }],
          ['metricCountries', { label: '평균 총점 / 21', value: scoreValue, icon: 'score', tone: 'blue', hidden: true }]
        ];
  slots.forEach(([slot, config]) => setMetricSlot(slot, config));
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
  if (kind === 'status') return filter2StatusLabel(value);
  if (kind === 'interest-indication') {
    if (/alzheimer/i.test(value)) return 'AD';
    if (/parkinson/i.test(value)) return 'PD';
    if (/amyotrophic lateral sclerosis|motor neuron disease|\bals\b/i.test(value)) return 'ALS';
    if (/multiple sclerosis|neuroinflammatory|\bms\b/i.test(value)) return 'MS';
    if (/neuropathic pain|\bnp\b/i.test(value)) return 'NP';
    if (/epilepsy|seizure|\bep\b/i.test(value)) return 'EP';
    if (/other|unknown|미확인/i.test(value)) return 'Others';
    return value;
  }
  if (kind === 'country') return countryDisplayLabel(value);
  if (kind === 'modality' || kind === 'modality-summary') {
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
  if (kind === 'partnership' && /^TBD$/i.test(value)) {
    return 'Custom Review 후 OI Partnership 분류가 아직 이루어지지 않은 그룹입니다.';
  }
  if ((kind === 'modality' || kind === 'modality-summary') && value === 'CGT') {
    return 'Cell Therapy와 Gene Therapy를 합산한 차트 전용 분류입니다.';
  }
  if (value === 'Others') {
    if (kind === 'interest-indication') {
      return 'SKBP 우선 관심 적응증 6개에 포함되지 않은 적응증과 Unknown을 합산한 그룹입니다.';
    }
    if (kind === 'modality-summary') {
      return '상위 6개 외 Modality와 Others·Unknown·N/A를 합산한 Summary 차트 전용 그룹입니다.';
    }
    if (kind === 'theme') {
      return 'E/I Balance·Neuroimmune·Protein Homeostasis 외 Theme와 Unknown·N/A를 합산한 차트 전용 그룹입니다.';
    }
    if (kind === 'country') {
      return '상위 3개 국가를 제외한 국가와 Unknown·N/A를 합산한 차트 전용 그룹입니다.';
    }
    return '빈도 상위 5개에 포함되지 않은 항목과 Others·Unknown·N/A를 합산한 그룹입니다.';
  }
  if (value === 'Unknown') {
    return kind === 'theme'
      ? '공개자료의 Target 또는 MoA 근거가 부족해 SKBP Theme/Cluster를 확정하지 못한 경우입니다.'
      : '공개자료가 부족해 해당 항목을 확정하지 못한 경우입니다.';
  }
  if (value === 'N/A') {
    return kind === 'theme'
      ? '파이프라인은 확인됐지만 SKBP 관심 Theme/Cluster 범위에 부합하지 않는 것으로 확인된 경우입니다.'
      : '해당 항목이 적용되지 않거나, Simple Research에서 파이프라인 identity를 확인하지 못한 경우입니다.';
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
  const semanticDonutColors = {
    SELECT: '#168b67',
    PASS: '#168b67',
    REJECT: '#b84f5f',
    FAIL: '#b84f5f',
    REVIEW: '#b47c25',
    INSUFFICIENT: 'var(--chart-other)',
    투자: '#2f73c9',
    'Value Up': '#7657c9',
    공동연구: '#0f9f8f'
  };
  const isNeutralDonutLabel = (label) => /^(others?|unknown|n\/?a|other\s*\/\s*unknown|기타\s*\/\s*미확인)$/i.test(String(label).trim());
  const segmentColor = (label, index) => {
    if (kind === 'partnership' && /^TBD$/i.test(String(label).trim())) {
      return DONUT_OTHERS_COLOR;
    }
    return semanticDonutColors[label]
      || (isNeutralDonutLabel(label) ? DONUT_OTHERS_COLOR : DONUT_PALETTE[index % DONUT_PALETTE.length]);
  };
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
          aria-hidden="true"
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
          <span class="donut-legend-copy">
            <b class="legend-dot" style="background:${segmentColor(label, index)}"></b>
            <span class="donut-legend-text">${escapeHtml(displayLabel)}</span>
          </span>
          <em data-donut-legend-value="${value}">${value}</em>
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
  container._chartHoverController?.abort();
  const controller = new AbortController();
  container._chartHoverController = controller;
  const listenerOptions = { signal: controller.signal };
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
    valueEl.textContent = `${activeSegment.dataset.pct}%`;
    donut.classList.add('is-hovering');
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
    donut.classList.remove('is-hovering');
    segments.forEach((segment) => segment.classList.remove('is-active', 'is-dimmed'));
    legendItems.forEach((item) => item.classList.remove('is-active', 'is-dimmed'));
  };

  container.addEventListener('pointerover', (event) => {
    const item = event.target.closest('[data-donut-index]');
    if (!item || !container.contains(item)) return;
    activateIndex(item.dataset.donutIndex);
  }, listenerOptions);

  container.addEventListener('pointerout', (event) => {
    const item = event.target.closest('[data-donut-index]');
    if (!item) return;
    const nextItem = event.relatedTarget?.closest?.('[data-donut-index]');
    if (nextItem && container.contains(nextItem)) {
      activateIndex(nextItem.dataset.donutIndex);
      return;
    }
    resetCenter();
  }, listenerOptions);

  container.addEventListener('focusin', (event) => {
    const item = event.target.closest('[data-donut-index]');
    if (item) activateIndex(item.dataset.donutIndex);
  }, listenerOptions);

  container.addEventListener('focusout', (event) => {
    const nextItem = event.relatedTarget?.closest?.('[data-donut-index]');
    if (nextItem && container.contains(nextItem)) {
      activateIndex(nextItem.dataset.donutIndex);
      return;
    }
    resetCenter();
  }, listenerOptions);
}

function barChart(entries, kind) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return '<div class="empty-state">데이터 없음</div>';

  const maxValue = Math.max(...entries.map(([, value]) => value), 1);
  const isNeutralLabel = (label) => /^(others?|unknown|n\/?a|other\s*\/\s*unknown|기타\s*\/\s*미확인)$/i.test(String(label).trim());
  const barColor = (label, index) => (
    isNeutralLabel(label) ? DONUT_OTHERS_COLOR : DONUT_PALETTE[index % DONUT_PALETTE.length]
  );

  const rows = entries.map(([label, value], index) => {
    const pct = Math.round((value / total) * 100);
    const relativeWidth = value > 0 ? Math.max(4, (value / maxValue) * 100) : 0;
    const displayLabel = distributionDisplayLabel(kind, label);
    const description = distributionDescription(kind, label);
    const fullNameNote = displayLabel !== label ? `${displayLabel}: ${label}` : label;
    const tooltip = [fullNameNote, description].filter(Boolean).join(' · ');
    return `
      <div
        class="distribution-bar-item${value === 0 ? ' is-zero' : ''}"
        data-bar-index="${index}"
        tabindex="0"
        title="${escapeHtml(tooltip)}"
        aria-label="${escapeHtml(displayLabel)} ${value}건, ${pct}%"
      >
        <span class="distribution-bar-label">${escapeHtml(displayLabel)}</span>
        <span
          class="distribution-bar-track"
          style="--bar-width:${relativeWidth}%; --bar-color:${barColor(label, index)}"
          aria-hidden="true"
        >
          <span class="distribution-bar-fill"></span>
          <strong class="distribution-bar-percent">${pct}%</strong>
        </span>
        <b class="distribution-bar-count" data-bar-count-value="${value}">${value}</b>
      </div>
    `;
  }).join('');

  return `<div class="distribution-bars">${rows}</div>`;
}

function wireBarHover(container) {
  container._chartHoverController?.abort();
  const controller = new AbortController();
  container._chartHoverController = controller;
  const listenerOptions = { signal: controller.signal };
  const items = [...container.querySelectorAll('[data-bar-index]')];
  if (!items.length) return;

  const activateIndex = (index) => {
    items.forEach((item) => {
      const isActive = item.dataset.barIndex === String(index);
      item.classList.toggle('is-active', isActive);
      item.classList.toggle('is-dimmed', !isActive);
    });
  };

  const resetBars = () => {
    items.forEach((item) => item.classList.remove('is-active', 'is-dimmed'));
  };

  container.addEventListener('pointerover', (event) => {
    const item = event.target.closest('[data-bar-index]');
    if (item && container.contains(item)) activateIndex(item.dataset.barIndex);
  }, listenerOptions);

  container.addEventListener('pointerout', (event) => {
    const item = event.target.closest('[data-bar-index]');
    if (!item) return;
    const nextItem = event.relatedTarget?.closest?.('[data-bar-index]');
    if (nextItem && container.contains(nextItem)) {
      activateIndex(nextItem.dataset.barIndex);
      return;
    }
    resetBars();
  }, listenerOptions);

  container.addEventListener('focusin', (event) => {
    const item = event.target.closest('[data-bar-index]');
    if (item) activateIndex(item.dataset.barIndex);
  }, listenerOptions);

  container.addEventListener('focusout', (event) => {
    const nextItem = event.relatedTarget?.closest?.('[data-bar-index]');
    if (nextItem && container.contains(nextItem)) {
      activateIndex(nextItem.dataset.barIndex);
      return;
    }
    resetBars();
  }, listenerOptions);
}

function animateWorkflowBars(container, delay = 0) {
  if (!container || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
  const items = [...container.querySelectorAll('[data-bar-index]')];
  items.forEach((item, index) => {
    const track = item.querySelector('.distribution-bar-track');
    const fill = item.querySelector('.distribution-bar-fill');
    const countElement = item.querySelector('[data-bar-count-value]');
    if (!track || !fill || !countElement) return;
    const targetWidth = track.style.getPropertyValue('--bar-width') || '0%';
    const targetCount = Math.max(0, Number(countElement.dataset.barCountValue || 0));
    fill.style.transition = 'none';
    fill.style.minWidth = '0';
    fill.style.width = '0%';
    countElement.textContent = '0';
    const timer = setTimeout(() => {
      const startedAt = performance.now();
      const duration = 680;
      fill.style.transition = 'width 680ms cubic-bezier(.2, .78, .25, 1)';
      requestAnimationFrame(() => { fill.style.width = targetWidth; });
      const tick = (now) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        countElement.textContent = String(Math.round(targetCount * eased));
        if (progress < 1) dashboardDonutAnimationFrames.push(requestAnimationFrame(tick));
      };
      dashboardDonutAnimationFrames.push(requestAnimationFrame(tick));
    }, delay + index * 105);
    dashboardDonutAnimationTimers.push(timer);
  });
}

function workflowIdentityKeys(row) {
  const splitAliases = (value) => String(value || '').split(/[\n,;|]+/).map((item) => item.trim()).filter(Boolean);
  const companies = [...new Set([row.company, ...splitAliases(row.companyAliases)])];
  const assets = [...new Set([row.asset, ...splitAliases(row.assetAliases)])];
  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return new Set(companies.flatMap((company) => assets.map((asset) => `${normalize(company)}::${normalize(asset)}`)));
}

function fullScoutTriageAlias(row) {
  const earlyStop = row.earlyStop;
  const status = earlyStop ? 'INSUFFICIENT' : 'SELECT';
  return {
    ...row,
    isTriage: true,
    isVirtualTriage: true,
    filter1: status,
    hardFilter: status,
    hardFilterReason: earlyStop?.reason || 'Advanced Research 완료로 Simple Research 공통 기준(TAR, MOA, Data)을 충족한 것으로 표시됩니다.'
  };
}

function buildDashboardRows(records) {
  const rows = records.map(flattenRecord);
  const fullScoutIdentities = new Set(rows.filter((row) => !row.isTriage).flatMap((row) => [...workflowIdentityKeys(row)]));
  // Once a Full Scout exists, its shared TAR/MoA/Data assessment is the
  // canonical Fast Triage view as well.  Keep no competing Tab 1 detail row.
  const triageRows = rows.filter((row) => !row.isTriage || ![...workflowIdentityKeys(row)].some((identity) => fullScoutIdentities.has(identity)));
  const fullScoutAliases = rows
    .filter((row) => !row.isTriage)
    .map(fullScoutTriageAlias);
  return [...triageRows, ...fullScoutAliases];
}

function modalityDistributionGroup(value) {
  const modality = String(value || 'N/A');
  return /^(cell therapy|gene therapy)$/i.test(modality) ? 'CGT' : modality;
}

function modalitySummaryGroup(value) {
  const modality = modalityDistributionGroup(value);
  if (/^small molecule$/i.test(modality)) return 'Small molecule';
  if (/^peptide$/i.test(modality)) return 'Peptide';
  if (/^rna therapy$/i.test(modality)) return 'RNA therapy';
  if (/^cgt$/i.test(modality)) return 'CGT';
  if (/^antibody$/i.test(modality)) return 'Antibody';
  if (/^protein biologic$/i.test(modality)) return 'Protein biologic';
  return 'Others';
}

function themeDistributionEntries(rows) {
  const counts = countBy(rows, (row) => {
    const theme = String(row.theme || '').trim();
    if (/^e\s*\/\s*i\s*balance$/i.test(theme)) return 'E/I Balance';
    if (/^neuro[\s-]*immune$/i.test(theme)) return 'Neuroimmune';
    if (/^protein[\s-]*homeostasis$/i.test(theme)) return 'Protein Homeostasis';
    return 'Others';
  });
  return ['E/I Balance', 'Neuroimmune', 'Protein Homeostasis', 'Others']
    .map((label) => [label, counts[label] || 0])
    .filter(([, count]) => count > 0);
}

function countryDistributionEntries(rows) {
  const counts = countBy(rows.flatMap((row) => canonicalCountryValues(row.country)), (country) => country || 'Unknown');
  const isOtherCountry = (label) => /^(unknown|n\/?a|others?|-)?$/i.test(String(label).trim());
  const knownCountries = Object.entries(counts)
    .filter(([label]) => !isOtherCountry(label))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const visibleTotal = knownCountries.reduce((sum, [, count]) => sum + count, 0);
  const othersTotal = Object.values(counts).reduce((sum, count) => sum + count, 0) - visibleTotal;
  if (othersTotal > 0) knownCountries.push(['Others', othersTotal]);
  return knownCountries;
}

function summaryDistributionPairs(entries = [], kind = '') {
  return entries.map((item) => {
    const label = kind === 'partnership'
      ? PARTNERSHIP_LABELS[item.key] || item.label || item.key || 'Unknown'
      : item.label || item.key || 'Unknown';
    return [label, Number(item.count || 0)];
  });
}

function partnershipSummaryDistribution(entries = []) {
  const keys = ['investment', 'value_up', 'joint_research', 'tbd'];
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  entries.forEach((item) => {
    const key = keys.slice(0, 3).includes(item?.key) ? item.key : 'tbd';
    counts[key] += Number(item?.count || 0);
  });
  return keys.map((key) => ({ key, label: PARTNERSHIP_LABELS[key], count: counts[key] }));
}

function workflowListBadge(label, tone = '') {
  return `<span class="workflow-list-badge ${escapeHtml(tone)}">${escapeHtml(label || '-')}</span>`;
}

function workflowStageDistribution(rows) {
  const counts = countBy(rows, (item) => stageSummaryGroup(item.development_stage || 'Unknown'));
  const order = [
    'Preclinical',
    'IND filed/cleared',
    'Phase 1',
    'Phase 1/2',
    'Phase 2',
    'Phase 2/3',
    'Phase 3',
    'Registration',
    'Approved / marketed',
    'Discontinued / inactive',
    'Unknown'
  ];
  return Object.entries(counts).sort((a, b) => {
    const aIndex = order.indexOf(a[0]);
    const bIndex = order.indexOf(b[0]);
    const aRank = aIndex < 0 ? order.length : aIndex;
    const bRank = bIndex < 0 ? order.length : bIndex;
    return aRank - bRank || a[0].localeCompare(b[0], 'en');
  });
}

function renderWorkflowPriorityList(summary) {
  const mode = activeTableMode();
  const rows = mode === 'triage'
    ? summary.awaiting_full_scout || []
    : mode === 'focus'
      ? summary.action_required || []
      : summary.priority_pipelines || [];
  const emptyMessage = mode === 'triage'
    ? '현재 Advanced Research 대기 후보가 없습니다.'
    : mode === 'focus'
      ? '현재 확인이 필요한 Action이 없습니다.'
      : '현재 표시할 Priority Pipeline이 없습니다.';

  elements.workflowPriorityList.classList.toggle('is-stage-distribution', mode === 'triage');
  if (mode === 'triage') {
    elements.workflowPriorityList.innerHTML = rows.length
      ? barChart(workflowStageDistribution(rows), 'stage')
      : `<div class="empty-state workflow-empty-state"><span aria-hidden="true">○</span><p>${escapeHtml(emptyMessage)}</p></div>`;
    animateWorkflowBars(elements.workflowPriorityList, 220);
    wireBarHover(elements.workflowPriorityList);
    return;
  }

  const visibleRows = mode === 'full'
    ? [...rows].sort((a, b) => {
        const bDate = Date.parse(b.completed_at || b.generated_at || '') || 0;
        const aDate = Date.parse(a.completed_at || a.generated_at || '') || 0;
        const scoreDifference = Number(b.total_score ?? -1) - Number(a.total_score ?? -1);
        return scoreDifference || bDate - aDate || String(a.asset || '').localeCompare(String(b.asset || ''), 'en');
      })
    : mode === 'focus'
      ? [...rows].sort((a, b) => {
          const dueDifference = (Date.parse(a.action_date || '') || Number.MAX_SAFE_INTEGER)
            - (Date.parse(b.action_date || '') || Number.MAX_SAFE_INTEGER);
          const bDate = Date.parse(b.action_updated_at || b.completed_at || '') || 0;
          const aDate = Date.parse(a.action_updated_at || a.completed_at || '') || 0;
          return dueDifference || bDate - aDate || String(a.asset || '').localeCompare(String(b.asset || ''), 'en');
        })
      : rows;

  elements.workflowPriorityList.innerHTML = visibleRows.length
    ? visibleRows.slice(0, 10).map((item) => {
        const recordId = item.record_id || '';
        const asset = item.asset || item.asset_identity || 'Unknown asset';
        const company = item.company || 'Unknown company';
        const indication = item.detailed_indication || item.main_indication || 'Unknown';
        if (mode === 'focus') {
          const actionDetail = ACTION_DATE_SUMMARY_DETAILS[item.action_status] || { label: '확인 필요', tone: 'neutral' };
          return `
            <button type="button" class="priority-item workflow-priority-item" data-record-id="${escapeHtml(recordId)}">
              <span class="workflow-priority-main"><strong>${escapeHtml(asset)}</strong><small>${escapeHtml(company)}</small></span>
              <span class="workflow-priority-context">${escapeHtml(PARTNERSHIP_LABELS[item.partnership_type] || item.partnership_label || 'Unknown')} · ${escapeHtml(item.action_date)}</span>
              <span class="workflow-priority-badges">
                ${workflowListBadge(actionDetail.label, actionDetail.tone)}
                ${item.human_override || item.partnership_source === 'manual' ? workflowListBadge('HUMAN', 'human') : ''}
              </span>
            </button>
          `;
        }
        const decision = String(item.filter2 || 'REVIEW').toUpperCase();
        return `
          <button type="button" class="priority-item workflow-priority-item" data-record-id="${escapeHtml(recordId)}">
            <span class="workflow-priority-main"><strong>${escapeHtml(asset)}</strong><small>${escapeHtml(company)}</small></span>
            <span class="workflow-priority-context">${escapeHtml(item.main_indication || indication)} · Data ${item.data_maturity ?? '-'} · TAR ${item.target_relevance ?? '-'}</span>
            <span class="workflow-priority-badges">${workflowListBadge(filter2StatusLabel(decision), decision.toLowerCase())}<b class="workflow-total-score">${item.total_score ?? '-'} / ${item.max_score ?? 21}</b></span>
          </button>
        `;
      }).join('')
    : `<div class="empty-state workflow-empty-state"><span aria-hidden="true">○</span><p>${escapeHtml(emptyMessage)}</p></div>`;
}

function dataUploadIconMarkup(name) {
  const paths = {
    sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"></path><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"></path>',
    'external-link': '<path d="M14 4h6v6M20 4l-9 9"></path><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"></path>',
    'file-text': '<path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v5h4M9 12h6M9 16h6"></path>',
    clipboard: '<path d="M8 5.5h8M9 3h6v4H9z"></path><path d="M7 5H5.5A1.5 1.5 0 0 0 4 6.5v13A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18.5 5H17"></path>',
    paperclip: '<path d="m9.5 12.5 5.8-5.8a3 3 0 0 1 4.2 4.2l-7.7 7.7a5 5 0 0 1-7.1-7.1l7.1-7.1"></path>',
    'shield-check': '<path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"></path><path d="m9 12 2 2 4-4"></path>',
    save: '<path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6"></path>',
    code: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4M13 6l-2 12"></path>',
    waiting: '<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="2"></circle>',
    review: '<path d="M8 5.5h8M9 3h6v4H9z"></path><path d="M7 5H5.5A1.5 1.5 0 0 0 4 6.5v13A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18.5 5H17"></path><path d="m9 14 2 2 4-4"></path>',
    loader: '<path d="M12 3a9 9 0 1 1-7.8 4.5"></path>',
    check: '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path>',
    alert: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v6M12 17h.01"></path>',
    saved: '<path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"></path><path d="m9 12 2 2 4-4"></path>'
  };
  return `<svg class="data-upload-icon data-upload-icon-${escapeHtml(name)}" viewBox="0 0 24 24" focusable="false" aria-hidden="true">${paths[name] || paths.waiting}</svg>`;
}

function setDataUploadStatus(status, errorCount = 0) {
  if (!elements.saveStatus) return;
  const labels = {
    waiting: '응답 붙여넣기 대기',
    'review-needed': '입력 검토 필요',
    validating: '검증 중',
    'ai-reparsing': 'AI 재파싱 중 · LLM 호출 진행 중...',
    valid: '검증 완료 · 저장 가능',
    error: `수정 필요 · 오류 ${Math.max(0, Number(errorCount) || 0)}개`,
    saved: '저장 완료'
  };
  const nextStatus = Object.prototype.hasOwnProperty.call(labels, status) ? status : 'waiting';
  const statusIcons = {
    waiting: 'waiting',
    'review-needed': 'review',
    validating: 'loader',
    'ai-reparsing': 'loader',
    valid: 'check',
    error: 'alert',
    saved: 'saved'
  };
  elements.saveStatus.dataset.state = nextStatus;
  elements.saveStatus.setAttribute('aria-busy', String(nextStatus === 'validating' || nextStatus === 'ai-reparsing'));
  elements.saveStatus.innerHTML = `${dataUploadIconMarkup(statusIcons[nextStatus])}<span>${escapeHtml(labels[nextStatus])}</span>`;
}

function resetDataUploadValidationState() {
  const hasInput = Boolean(elements.gptResponseInput?.value.trim());
  state.dataUploadReview = null;
  state.dataUploadLlmReparseFields = null;
  if (elements.previewInputButton) elements.previewInputButton.disabled = !hasInput;
  if (elements.aiReparseButton) elements.aiReparseButton.disabled = true;
  if (elements.saveJsonButton) elements.saveJsonButton.disabled = true;
  if (elements.inputValidationResults) {
    elements.inputValidationResults.hidden = true;
    elements.inputValidationResults.innerHTML = '';
  }
  setDataUploadStatus(hasInput ? 'review-needed' : 'waiting');
}

function dataUploadStepBodyMarkup(step) {
  let markup = escapeHtml(step.body || '');
  const actions = Array.isArray(step.actions) ? step.actions : [];
  actions.forEach((action) => {
    const token = `{{${action.token}}}`;
    const title = action.kind === 'copy-prompt'
      ? `클릭하여 GPT ${action.label} 복사`
      : action.kind === 'focus-input'
        ? `${action.label} 입력창으로 이동`
      : action.kind === 'review'
        ? '붙여넣은 입력 검토 실행'
        : '검증을 통과한 입력 저장';
    const actionIcon = action.kind === 'copy-prompt'
      ? escapeHtml(action.icon)
      : dataUploadIconMarkup(action.kind === 'focus-input' ? (action.icon || 'clipboard') : action.kind === 'review' ? 'shield-check' : 'save');
    const chip = `<button
      type="button"
      class="data-upload-prompt-chip data-upload-guide-action-chip"
      data-upload-guide-action="${escapeHtml(action.kind)}"
      ${action.promptKind ? `data-prompt-kind="${escapeHtml(action.promptKind)}"` : ''}
      aria-label="${escapeHtml(title)}"
      title="${escapeHtml(title)}"
    ><span class="${action.kind === 'copy-prompt' ? '' : 'data-upload-action-icon'}" aria-hidden="true">${actionIcon}</span><b>${escapeHtml(action.label)}</b></button>`;
    markup = markup.replaceAll(token, chip);
  });
  return markup;
}

function renderDataUploadGuide(mode = activeTableMode()) {
  if (!elements.dataUploadPanel) return;
  const isFocusMode = mode === 'focus';
  elements.dataUploadPanel.hidden = isFocusMode;
  if (state.dataUploadGuideMode === mode) return;
  const previousMode = state.dataUploadGuideMode;
  if (['triage', 'full'].includes(previousMode) && elements.gptResponseInput) {
    state.dataUploadDrafts[previousMode] = elements.gptResponseInput.value;
  }
  state.dataUploadGuideMode = mode;
  if (['triage', 'full'].includes(mode) && elements.gptResponseInput) {
    elements.gptResponseInput.value = state.dataUploadDrafts[mode] || '';
  }
  resetDataUploadValidationState();
  if (isFocusMode) return;

  const guide = DATA_UPLOAD_GUIDES[mode === 'triage' ? 'triage' : 'full'];
  if (elements.dataUploadInputLabel) elements.dataUploadInputLabel.textContent = guide.inputLabel;
  if (elements.gptResponseInput) elements.gptResponseInput.placeholder = guide.placeholder;
  if (elements.dataUploadGuideTitle) elements.dataUploadGuideTitle.textContent = guide.title;
  if (elements.dataUploadRecommendation) {
    elements.dataUploadRecommendation.innerHTML = `${dataUploadIconMarkup('sparkles')}<span>${escapeHtml(guide.recommendation)}</span>`;
    elements.dataUploadRecommendation.setAttribute('aria-label', guide.recommendation);
  }
  if (elements.dataUploadGuideSteps) {
    const stepIcons = mode === 'triage'
      ? ['external-link', 'file-text', 'clipboard', 'shield-check']
      : ['external-link', 'file-text', 'paperclip', 'shield-check'];
    elements.dataUploadGuideSteps.innerHTML = guide.steps.map((step, index) => `
      <li>
        <span class="data-upload-step-icon" aria-hidden="true">${dataUploadIconMarkup(stepIcons[index] || 'file-text')}</span>
        <div class="data-upload-step-copy">
          <strong>${escapeHtml(step.title)}</strong>
          <p>${dataUploadStepBodyMarkup(step)}</p>
          ${step.example ? `<pre><span>${dataUploadIconMarkup('code')}입력 형식 예시</span>${escapeHtml(step.example)}</pre>` : ''}
        </div>
      </li>
    `).join('');
  }
}

function setDataUploadShortcutVisibility(visible) {
  const shouldShow = Boolean(visible);
  if (elements.dataUploadShortcutButton) {
    elements.dataUploadShortcutButton.hidden = !shouldShow;
  }
  const topDataActions = elements.dataUploadShortcutButton?.closest('.top-data-actions');
  if (topDataActions) {
    topDataActions.hidden = !shouldShow;
  }
}

function setTopPromptShortcutVisibility({ triage = false, full = false } = {}) {
  if (elements.copyTriagePromptTopButton) {
    elements.copyTriagePromptTopButton.hidden = !triage;
  }
  if (elements.copyPromptTopButton) {
    elements.copyPromptTopButton.hidden = !full;
  }
}

function syncTopDataActionsForVisibleTab() {
  const isKnowledgeMapVisible = Boolean(elements.knowledgeMapPanel && !elements.knowledgeMapPanel.hidden);
  // Atlas is an exploration workspace, not a research-input workflow. Do not
  // inherit the last table tab's upload or GPT-instruction actions on entry.
  if (isKnowledgeMapVisible) {
    if (elements.refreshButton) {
      elements.refreshButton.hidden = false;
      elements.refreshButton.dataset.tooltip = '저장된 Pipeline으로 Knowledge Wiki Map을 최신화합니다.';
      elements.refreshButton.setAttribute('aria-label', 'Knowledge Wiki Map 최신화');
    }
    setDataUploadShortcutVisibility(false);
    setTopPromptShortcutVisibility();
    return;
  }

  // Outside Knowledge Map, this button was just an alias for a browser reload
  // (see the click handler) — remove it rather than keep a no-op control.
  if (elements.refreshButton) elements.refreshButton.hidden = true;

  const isStep0Visible = Boolean(elements.step0Panel && !elements.step0Panel.hidden);
  if (isStep0Visible) {
    setDataUploadShortcutVisibility(true);
    // Listing has its own selected-candidate prompt action; the global Fast
    // Triage and Full Scout shortcuts belong to their respective workflow tabs.
    setTopPromptShortcutVisibility();
    return;
  }

  const mode = activeTableMode();
  setDataUploadShortcutVisibility(mode !== 'focus');
  setTopPromptShortcutVisibility({ triage: mode === 'triage', full: mode === 'full' });
}

function renderWorkflowMode(summary = activeTabSummary()) {
  const mode = activeTableMode();
  if (elements.agentInput) {
    elements.agentInput.dataset.workflowMode = mode;
    elements.agentInput.placeholder = AGENT_INPUT_PLACEHOLDERS[mode] || FULL_SCOUT_AGENT_INPUT_PLACEHOLDER;
    elements.agentInput.rows = 2;
  }
  renderDataUploadGuide(mode);
  syncTopDataActionsForVisibleTab();
  updateHeaderRecordCount();
  const copy = WORKFLOW_COPY[mode];
  const distributionAssets = Number(summary?.distribution_population?.assets) || 0;
  if (elements.workflowModeDescription) {
    elements.workflowModeDescription.dataset.workflowMode = mode;
    elements.workflowModeDescription.innerHTML = `
      <span class="workflow-description-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 10.75v5.5M12 7.75h.01"></path>
        </svg>
      </span>
      <span class="workflow-description-copy">
        <strong>${escapeHtml(copy.stage)}<span class="workflow-description-separator" aria-hidden="true">·</span></strong>
        <span>${escapeHtml(copy.description)}</span>
      </span>
      <span class="workflow-description-filter">${escapeHtml(copy.filterLabel)}</span>`;
  }
  if (elements.summaryScopeNote) {
    elements.summaryScopeNote.textContent = activeSummaryFilterCount() > 0
      ? `Filter 결과 ${distributionAssets}개`
      : '현재 Tab·Filter 기준';
  }
  if (elements.indicationSummarySubtitle) {
    elements.indicationSummarySubtitle.textContent = activeSummaryFilterCount() > 0
      ? `Filter 결과 ${distributionAssets}개 · 적응증 6개 · Others`
      : '현재 탭 전체 asset · 적응증 6개 · Others';
  }
  if (elements.modalitySummarySubtitle) {
    elements.modalitySummarySubtitle.textContent = activeSummaryFilterCount() > 0
      ? `Filter 결과 ${distributionAssets}개 · 상위 6개와 Others`
      : mode === 'focus'
        ? `Shortlisted Pool ${distributionAssets}개 · 상위 6개와 Others`
        : '상위 6개 · 나머지와 Unknown은 Others';
  }
  if (elements.passRatePanel) elements.passRatePanel.hidden = false;
  if (elements.workflowPriorityTitle) elements.workflowPriorityTitle.textContent = copy.priorityTitle;
  if (elements.workflowPrioritySubtitle) elements.workflowPrioritySubtitle.textContent = copy.prioritySubtitle;
  if (elements.pipelineContent) {
    const activeTab = [...elements.pipelineTableTabs].find((tab) => tab.dataset.tableMode === mode);
    if (activeTab) elements.pipelineContent.setAttribute('aria-labelledby', activeTab.id);
  }
  document.documentElement.dataset.workflowMode = mode;
}

let dataUploadHighlightTimer = 0;

function scrollToDataUpload(event) {
  event?.preventDefault();
  const isStep0Visible = Boolean(elements.step0Panel && !elements.step0Panel.hidden);
  const mode = activeTableMode();
  if (!isStep0Visible && mode === 'focus') return;
  if (!isStep0Visible) renderDataUploadGuide(mode);

  const panelSelector = isStep0Visible ? '#step0UploadPanel' : '#dataUploadPanel';
  const inputSelector = isStep0Visible ? '#step0EntryGridBody input[data-step0-entry-field]' : '#gptResponseInput';
  const panel = document.querySelector(panelSelector);
  const input = panel?.querySelector(inputSelector);
  if (!panel || !input) return;
  panel.hidden = false;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.clearTimeout(dataUploadHighlightTimer);
  const moveToUpload = () => {
    panel.classList.remove('is-shortcut-highlighted');
    void panel.offsetWidth;
    panel.classList.add('is-shortcut-highlighted');
    panel.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
    // Tab 0 lives in its own panel and the sticky header can make scrollIntoView
    // appear to do nothing. Align the document viewport explicitly as well.
    const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0;
    const targetTop = Math.max(0, window.scrollY + panel.getBoundingClientRect().top - topbarBottom - 16);
    window.scrollTo({
      top: targetTop,
      behavior: reducedMotion ? 'auto' : 'smooth'
    });
    window.setTimeout(() => {
      input.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 420);
    dataUploadHighlightTimer = window.setTimeout(() => {
      panel.classList.remove('is-shortcut-highlighted');
    }, 1800);
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(moveToUpload);
  } else {
    moveToUpload();
  }
}

function cancelDashboardDonutAnimations() {
  dashboardDonutAnimationTimers.forEach((timer) => clearTimeout(timer));
  dashboardDonutAnimationTimers = [];
  dashboardDonutAnimationFrames.forEach((frame) => cancelAnimationFrame(frame));
  dashboardDonutAnimationFrames = [];
}

function animateDashboardDonut(container, delay = 0) {
  if (!container || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
  const donut = container.querySelector('.donut');
  const valueElement = donut?.querySelector('.donut-value');
  if (!donut || !valueElement) return;
  const segments = [...donut.querySelectorAll('.donut-segment')];
  const legendValues = [...container.querySelectorAll('[data-donut-legend-value]')];
  const defaultValue = String(donut.dataset.defaultValue || valueElement.textContent || '');
  const centerMatch = defaultValue.match(/^(\d+)(%)?$/);
  const animationDuration = 760;

  segments.forEach((segment, index) => {
    const finalDasharray = segment.getAttribute('stroke-dasharray');
    if (!finalDasharray || typeof segment.animate !== 'function') return;
    const segmentAnimation = segment.animate([
      { strokeDasharray: `0 ${DONUT_CIRCUMFERENCE}`, opacity: 0.35 },
      { strokeDasharray: finalDasharray, opacity: 1 }
    ], {
      duration: 620,
      delay: delay + index * 70,
      easing: 'cubic-bezier(.2, .78, .25, 1)',
      fill: 'both'
    });
    segmentAnimation.finished?.then(() => segmentAnimation.cancel()).catch(() => {});
  });

  const animateNumber = (element, target, suffix = '', startDelay = delay, duration = animationDuration) => {
    if (!element || !Number.isFinite(target)) return;
    element.textContent = `0${suffix}`;
    const timer = setTimeout(() => {
      const startedAt = performance.now();
      const tick = (now) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = `${Math.round(target * eased)}${suffix}`;
        if (progress < 1) dashboardDonutAnimationFrames.push(requestAnimationFrame(tick));
      };
      dashboardDonutAnimationFrames.push(requestAnimationFrame(tick));
    }, startDelay);
    dashboardDonutAnimationTimers.push(timer);
  };

  if (centerMatch) animateNumber(valueElement, Number(centerMatch[1]), centerMatch[2] || '');
  legendValues.forEach((element, index) => {
    animateNumber(element, Number(element.dataset.donutLegendValue || 0), '', delay + index * 70, 520);
  });
}

const STEP0_FILTER_KEYS = ['country', 'modality', 'theme', 'cluster', 'indication', 'stage', 'progress'];
const STEP0_PROGRESS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Listing' },
  { value: 'investigation_pending', label: '조사 대기' },
  { value: 'fast_triage', label: 'Simple' },
  { value: 'full_scout', label: 'Advanced' },
  { value: 'shortlisting', label: 'Custom' }
];
const STEP0_EVALUATION_FILTER_KEYS = ['pending', 'fast_triage', 'full_scout', 'shortlisting', 'comment', 'contact'];

function closeStep0MultiFilters(except = null) {
  STEP0_FILTER_KEYS.forEach((key) => {
    const filter = elements[`step0${key[0].toUpperCase()}${key.slice(1)}Filter`];
    if (!filter || filter === except) return;
    filter.classList.remove('is-open');
    delete filter.dataset.filterSearchQuery;
    filter.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
    const menu = filter.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = true;
  });
}

function renderCharts() {
  cancelDashboardDonutAnimations();
  const summary = activeTabSummary();
  const indicationEntries = summaryDistributionPairs(summary.indication_distribution)
    .sort((a, b) => b[1] - a[1]
      || Number(/^Others$/i.test(a[0])) - Number(/^Others$/i.test(b[0]))
      || a[0].localeCompare(b[0], 'ko'));
  elements.indicationChart.innerHTML = donutChart(indicationEntries, 'interest-indication');
  animateDashboardDonut(elements.indicationChart, 0);
  wireDonutHover(elements.indicationChart);

  const modalityEntries = summaryDistributionPairs(summary.modality_distribution);
  elements.modalityChart.innerHTML = donutChart(modalityEntries, 'modality-summary');
  animateDashboardDonut(elements.modalityChart, 90);
  wireDonutHover(elements.modalityChart);

  if (elements.passRateChart) {
    const mode = activeTableMode();
    const sourceDistribution = mode === 'focus'
      ? partnershipSummaryDistribution(summary.partnership_distribution)
      : summary.status_distribution;
    const distributionKind = mode === 'focus' ? 'partnership' : 'status';
    const statusEntries = summaryDistributionPairs(sourceDistribution, distributionKind);
    const total = statusEntries.reduce((sum, [, value]) => sum + value, 0);
    const leadLabel = mode === 'triage' ? 'SELECT' : mode === 'full' ? 'PASS' : '';
    const leadCount = leadLabel
      ? statusEntries.find(([label]) => label === leadLabel)?.[1] || 0
      : 0;
    const ongoingCount = mode === 'focus'
      ? statusEntries
          .filter(([label]) => label !== 'TBD')
          .reduce((sum, [, value]) => sum + value, 0)
      : leadCount;
    const leadRate = total ? Math.round((ongoingCount / total) * 100) : 0;
    elements.passRateChart.innerHTML = donutChart(statusEntries, distributionKind);
    const donut = elements.passRateChart.querySelector('.donut');
    const value = elements.passRateChart.querySelector('.donut-value');
    const center = elements.passRateChart.querySelector('.donut-center');
    if (donut && value) {
      const defaultValue = mode === 'focus' ? String(ongoingCount) : `${leadRate}%`;
      donut.dataset.defaultValue = defaultValue;
      value.textContent = defaultValue;
    }
    if (center) center.insertAdjacentHTML('beforeend', `<small>${mode === 'focus' ? 'ONGOING' : leadLabel}</small>`);
    animateDashboardDonut(elements.passRateChart, 180);
    if (elements.workflowStatusTitle) {
      elements.workflowStatusTitle.textContent = mode === 'triage'
        ? 'SELECT Rate'
        : mode === 'focus'
          ? 'OI Partnership 분포'
          : 'PASS Rate';
    }
    if (elements.passRateSubtitle) {
      elements.passRateSubtitle.textContent = mode === 'focus'
        ? `Ongoing ${ongoingCount} / Shortlisted ${total} · ${leadRate}%`
        : `${leadLabel} ${leadCount} / ${total} · ${leadRate}%`;
    }
    wireDonutHover(elements.passRateChart);
  }

  renderWorkflowPriorityList(summary);
  renderWorkflowMode(summary);
}

function renderColumnSettings() {
  if (!elements.columnSettingsGrid) return;
  elements.columnSettingsGrid.innerHTML = activeExtraColumnDefinitions().map((column) => {
    return `
      <label class="column-option is-compact">
        <input
          type="checkbox"
          value="${escapeHtml(column.key)}"
          ${state.extraColumns.has(column.key) ? 'checked' : ''}
        />
        <span>${escapeHtml(column.label)}</span>
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
    `Evidence basis: ${criterionInfo?.evidenceBasisLabel || '-'}`,
    `Verified public sources: ${criterionInfo?.verifiedPublicSourceCount ?? 0}`,
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
    const d = calc.D_global_obtainable_peak_sales || {};
    lines.splice(
      3,
      0,
      `A. TAP: ${a.targetable_addressable_patient ?? '-'} (${a.formula || '-'})`,
      `B. Unrisked Peak Sales: ${formatMillionUsd(b.unrisked_peak_sales, b.sales_unit)} (${b.formula || '-'})`,
      `C. US Obtainable Peak Sales: ${formatMillionUsd(c.obtainable_peak_sales, c.sales_unit)} (${c.formula || '-'})`,
      `D. Global Obtainable Peak Sales: ${formatMillionUsd(d.global_obtainable_peak_sales, d.sales_unit)} (${d.formula || '-'})`
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
  const scoreLineCount = lines.length;
  const evidenceType = meaningfulValue(criterionInfo?.evidenceType);
  const evidenceReason = meaningfulValue(criterionInfo?.evidenceTypeReason);
  if (evidenceType && evidenceReason) {
    lines.push(`Evidence Type: ${evidenceType} (${evidenceReason})`);
  } else {
    pushLine(lines, 'Evidence Type', evidenceType);
  }
  pushLine(lines, 'Evidence basis', criterionInfo?.evidenceBasisLabel);
  if (criterionInfo?.evidenceBasis) {
    lines.push(`Verified public sources: ${criterionInfo?.verifiedPublicSourceCount ?? 0}`);
  }

  const calc = criterionInfo?.calculation;
  if (calc?.A_targetable_addressable_patient || calc?.B_unrisked_peak_sales || calc?.C_obtainable_peak_sales) {
    const a = calc.A_targetable_addressable_patient || {};
    const b = calc.B_unrisked_peak_sales || {};
    const c = calc.C_obtainable_peak_sales || {};
    const d = calc.D_global_obtainable_peak_sales || {};
    const aValue = [meaningfulValue(a.targetable_addressable_patient), meaningfulValue(a.formula)].filter(Boolean).join(' | ');
    const bValue = [meaningfulValue(formatMillionUsd(b.unrisked_peak_sales, b.sales_unit)), meaningfulValue(b.formula)].filter(Boolean).join(' | ');
    const cValue = [meaningfulValue(formatMillionUsd(c.obtainable_peak_sales, c.sales_unit)), meaningfulValue(c.formula)].filter(Boolean).join(' | ');
    const dValue = [meaningfulValue(formatMillionUsd(d.global_obtainable_peak_sales, d.sales_unit)), meaningfulValue(d.formula)].filter(Boolean).join(' | ');
    pushLine(lines, 'A. TAP', aValue);
    pushLine(lines, 'B. Unrisked Peak Sales', bValue);
    pushLine(lines, 'C. US Obtainable Peak Sales', cValue);
    pushLine(lines, 'D. Global Obtainable Peak Sales', dValue);
  }

  pushLine(lines, 'Rubric', criterionInfo?.appliedScoreDefinition || criterionInfo?.ruleCriteria);
  pushLine(lines, 'Judgment', criterionInfo?.mainLineSummary || criterionInfo?.decisionSummary || criterionInfo?.reason);
  pushLine(lines, 'Why not higher', criterionInfo?.whyNotHigher);
  pushLine(lines, 'Investigation note', criterionInfo?.investigationNote);
  pushLine(lines, 'Evidence summary', criterionInfo?.supportingEvidenceSummary);

  const sources = (criterionInfo?.evidenceSources || [])
    .slice(0, 3)
    .map((source) => {
      const title = meaningfulValue(typeof source === 'object' ? source.source_title : '');
      const url = meaningfulValue(evidenceSourceUrl(source));
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

  if (lines.length === scoreLineCount) {
    lines.push('상세 판단근거는 GPT ORIGINAL REPORT에서 확인하세요.');
  }

  const versionInfo = [criterionInfo?.version, criterionInfo?.author].map(meaningfulValue).filter(Boolean).join(' / ');
  pushLine(lines, 'Rubric version', versionInfo);
  return lines.join('\n');
}

function scoreBadge(score, max = 3, tooltip = '', extraClass = '') {
  const tone = score >= max ? 'high' : score >= max * 0.6 ? 'mid' : 'low';
  const className = `score ${tone}${extraClass ? ` ${extraClass}` : ''}`;
  const safeTooltip = escapeHtml(tooltip);
  return `<span class="${className}" tabindex="0" aria-label="${safeTooltip}" data-tooltip="${safeTooltip}" title="${safeTooltip}">${score ?? '-'}</span>`;
}

function earlyStopScoreBadge(row) {
  const tooltip = row?.earlyStop?.reason || '조기 종료되어 점수 평가를 수행하지 않았습니다.';
  const safeTooltip = escapeHtml(tooltip);
  return `<span class="table-edit-select status-edit na is-readonly early-stop-score" tabindex="0" aria-label="${safeTooltip}" data-tooltip="${safeTooltip}" title="${safeTooltip}">—</span>`;
}

function pipelineScoreBadge(row, score, max = 3, tooltip = '') {
  return row?.earlyStop ? earlyStopScoreBadge(row) : scoreBadge(score, max, tooltip);
}

function selectOption(value, currentValue, label = value) {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(currentValue) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function statusEditSelect(row, filterKey) {
  const value = row[filterKey];
  if (row.isVirtualTriage) {
    const title = row.earlyStop?.reason || 'Advanced Research 완료로 표시된 Simple Research 상태입니다. Tab 2 결과를 엽니다.';
    return `<span class="table-edit-select status-edit ${filterToneClass(value)} is-readonly" title="${escapeHtml(title)}">${escapeHtml(filter2StatusLabel(value))}</span>`;
  }
  const options = row.isTriage ? ['SELECT', 'REJECT', 'INSUFFICIENT'] : ['PASS', 'REVIEW', 'FAIL'];
  const isManual = Object.prototype.hasOwnProperty.call(humanReviewOverrides(row.raw), 'filter_status');
  const title = row.earlyStop?.reason || 'AI initial status; editable by a human reviewer';
  return `
    <select
      class="table-edit-select status-edit ${filterToneClass(value)} ${isManual ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-edit-kind="status"
      data-previous-value="${escapeHtml(value)}"
      aria-label="${escapeHtml(row.asset)} reviewer status"
      title="${escapeHtml(title)}"
    >
      ${options.map((option) => selectOption(option, value, filter2StatusLabel(option))).join('')}
    </select>
  `;
}

const PARTNERSHIP_TYPE_OPTIONS = [
  { value: '', label: '↻ Auto' },
  { value: 'investment', label: '투자' },
  { value: 'value_up', label: 'Value Up' },
  { value: 'joint_research', label: '공동연구' },
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
    `분류 기준: ${isManual
      ? 'HUMAN · 담당자 수동 분류'
      : `AUTO · OI Partnership v${row.filter3CriteriaVersion || state.latestOiPartnershipCriteriaVersion}`}`
  ].join('\n');
  const disabledAttr = shortlistingRoleFor(DEFAULT_SHORTLISTING_PROJECT_ID) === 'read' ? ' disabled' : '';
  return `
    <select
      class="partnership-edit-select ${partnershipToneClass(value)} ${isManual ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-previous-value="${escapeHtml(value)}"
      aria-label="${escapeHtml(row.asset)} filter 3 (partnership type)"
      title="${escapeHtml(hoverText)}"${disabledAttr}
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
const ADMET_TOTAL_ITEMS = 25;
const EVIDENCE_FIELD_TO_BACKEND = {
  inVivoStatus: 'in_vivo_status',
  inVitroStatus: 'in_vitro_status',
  admetCompleted: 'admet_completed',
  diseaseLinkageStatus: 'disease_linkage_status'
};

function evidenceToneClass(value) {
  if (value === 'O') return 'pass';
  if (value === 'X') return 'fail';
  return 'na';
}

function evidenceSourceLabel(source) {
  if (source === 'manual') return '수동 입력';
  if (source === 'study_status') return '업로드 ADMET Study·Status 표 기반';
  return '자동 판단 (GPT 원문 리포트 + 첨부파일 키워드 기반, 실험 데이터 확인 필요)';
}

function evidenceStatusMeaning(value) {
  if (value === 'O') return 'asset-specific efficacy 근거 확인';
  if (value === 'X') return '검토 가능한 자료에서는 해당 근거 없음';
  return '자료·분석 근거 부족으로 O/X 판정 불가';
}

function evidenceEditSelect(row, field, sourceField, label) {
  const value = row[field] || 'N/A';
  const source = row[sourceField];
  const tooltip = evidenceStatusMeaning(value);
  const disabledAttr = shortlistingRoleFor(DEFAULT_SHORTLISTING_PROJECT_ID) === 'read' ? ' disabled' : '';
  return `
    <span class="evidence-tooltip help-tooltip" data-tooltip="${escapeHtml(tooltip)}">
      <select
        class="evidence-edit ${evidenceToneClass(value)} ${source === 'manual' ? 'is-human' : 'is-auto'}"
        data-record-id="${escapeHtml(row.id)}"
        data-evidence-field="${escapeHtml(field)}"
        data-previous-value="${escapeHtml(value)}"
        aria-label="${escapeHtml(`${row.asset} ${label}: ${tooltip}`)}"${disabledAttr}
      >
        ${EVIDENCE_STATUS_OPTIONS.map((option) => selectOption(option, value)).join('')}
      </select>
    </span>
  `;
}

function dueDiligenceStatusBadge(row) {
  const value = row.ddStatus === 'O' ? 'O' : 'X';
  const tone = value === 'O' ? 'high' : 'low';
  if (value !== 'O') return `<span class="total-score-edit-circle dd-status-circle ${tone}" aria-label="DD Report 없음">${value}</span>`;
  const tooltip = 'DD Report가 상세 페이지에 업로드 되었음';
  const href = `/detail?id=${encodeURIComponent(row.id)}&tab=focus&open=dd`;
  return `<a class="total-score-edit-circle dd-status-circle dd-status-link ${tone} help-tooltip" href="${escapeHtml(href)}" data-tooltip="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">${value}</a>`;
}

const DISEASE_LINKAGE_STATUS_OPTIONS = [
  { value: 'O', label: 'O', title: 'O: 확인됨 — MoA 근거가 실제 질환 병리·기능(disease phenotype·biomarker)과의 연결까지 확인됨' },
  { value: 'X', label: 'X', title: 'X: 미확인 — MoA 근거가 실제 질환 병리·기능과의 연결까지는 확인되지 않음' },
  { value: 'NA', label: 'N/A', title: 'N/A: 판단 불가 — 정보 부족으로 연결 여부를 판단할 수 없음' }
];

function diseaseLinkageStatusMeaning(value) {
  if (value === 'O') return 'O: 확인됨 — MoA 근거가 실제 질환 병리·기능(disease phenotype·biomarker)과의 연결까지 확인됨';
  if (value === 'X') return 'X: 미확인 — MoA 근거가 실제 질환 병리·기능과의 연결까지는 확인되지 않음';
  return 'N/A: 판단 불가 — 정보 부족으로 연결 여부를 판단할 수 없음. 더블클릭하면 GPT 원문의 MoA Validity 근거로 이동합니다';
}

// Single click opens this native dropdown (same as ADMET/In-vivo/In-vitro) so a reviewer can
// manually override the AI verdict; picking a value marks it 'manual' and the background
// auto-classifier (scheduleDiseaseLinkageClassification) then leaves it alone permanently,
// mirroring in_vivo_status/in_vitro_status/admet_completed. Double-click jumps to the source
// investigation_note (wired in the shared dblclick handler below).
function diseaseLinkageEditSelect(row) {
  const value = row.diseaseLinkageStatus === 'O' || row.diseaseLinkageStatus === 'X' ? row.diseaseLinkageStatus : 'NA';
  const tooltip = diseaseLinkageStatusMeaning(value);
  const disabledAttr = shortlistingRoleFor(DEFAULT_SHORTLISTING_PROJECT_ID) === 'read' ? ' disabled' : '';
  return `
    <span class="evidence-tooltip help-tooltip" data-tooltip="${escapeHtml(tooltip)}">
      <select
        class="evidence-edit ${evidenceToneClass(value)} ${row.diseaseLinkageSource === 'manual' ? 'is-human' : 'is-auto'}"
        data-record-id="${escapeHtml(row.id)}"
        data-evidence-field="diseaseLinkageStatus"
        data-disease-linkage-jump="${escapeHtml(row.id)}"
        data-previous-value="${escapeHtml(value)}"
        aria-label="${escapeHtml(`${row.asset} Disease Linkage: ${tooltip}`)}"${disabledAttr}
      >
        ${DISEASE_LINKAGE_STATUS_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" title="${escapeHtml(option.title)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </span>
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
  const disabledAttr = shortlistingRoleFor(DEFAULT_SHORTLISTING_PROJECT_ID) === 'read' ? ' disabled' : '';
  return `
    <select
      class="evidence-edit ${admetToneClass(value)} ${row.admetSource === 'manual' ? 'is-human' : 'is-auto'}"
      data-record-id="${escapeHtml(row.id)}"
      data-evidence-field="admetCompleted"
      data-previous-value="${escapeHtml(currentValue)}"
      aria-label="${escapeHtml(row.asset)} ADMET completed"
      title="${escapeHtml(`ADMET: ${evidenceSourceLabel(row.admetSource)}`)}"${disabledAttr}
    >
      ${options.map((option) => selectOption(option.value, currentValue, option.label)).join('')}
    </select>
  `;
}

function scoreEditSelect(row, scoreKey, criterionId, label) {
  if (row.earlyStop) return earlyStopScoreBadge(row);
  const value = row[scoreKey];
  if (row.isVirtualTriage) {
    const tone = value >= 3 ? 'high' : value >= 2 ? 'mid' : 'low';
    const tooltip = `${label}: Tab 2 Advanced Research 결과에서 가져온 읽기 전용 점수`;
    return `<span class="table-edit-select score-edit ${tone} is-readonly" title="${escapeHtml(tooltip)}">${escapeHtml(value ?? '-')}</span>`;
  }
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
      title="${escapeHtml(`수동으로 0–3점 수정할 수 있습니다.\n${tooltip}`)}"
    >
      ${[0, 1, 2, 3].map((score) => selectOption(score, value)).join('')}
    </select>
  `;
}

function hasManualTotalScoreOverride(record) {
  return Object.prototype.hasOwnProperty.call(humanReviewOverrides(record), 'total_score');
}

function totalScoreEditCircle(row) {
  if (row.earlyStop) return earlyStopScoreBadge(row);
  const isManual = hasManualTotalScoreOverride(row.raw);
  const displayValue = row.totalScore ?? '';
  // Mirrors the Filter 2 (hard_filter.status) PASS/REVIEW/FAIL total_score cutoffs
  // (>=14 / 9-13 / <=8, json/schema.md) so the circle's color matches what Filter 2
  // would derive from this score alone. Filter 2 itself can diverge after a manual
  // override — that's expected and not something this circle needs to track.
  const tone = displayValue >= 14
    ? 'high'
    : displayValue >= 9
      ? 'mid'
      : 'low';
  const title = isManual
    ? `HUMAN · 담당자가 Tab2 Total Score를 ${displayValue}점으로 수정했습니다.`
    : `AUTO · 원본 Advanced Research Total Score ${displayValue}점. Tab2에서 독립적으로 수정할 수 있습니다.`;
  return `
    <span
      class="total-score-edit-circle ${tone} ${isManual ? 'is-human' : 'is-auto'}"
      aria-label="${escapeHtml(row.asset)} Tab2 Total Score"
      title="${escapeHtml(title)}"
    >${escapeHtml(displayValue)}</span>
  `;
}

function stageEditSelect(row) {
  const user = getCurrentUser();
  const isManual = hasManualTableFieldEdit(row.raw, 'development_stage');
  const stageTitle = pipelineStageFullHoverTitle(row);
  if (row.isVirtualTriage) return `<span class="table-manual-text" title="${escapeHtml(`${stageTitle}\nTab 2 Advanced Research 결과에서 가져온 값`)}">${escapeHtml(row.stage)}</span>`;
  if (!user?.is_admin) return `<span class="table-manual-text${isManual ? ' is-human' : ''}" title="${escapeHtml(stageTitle)}">${escapeHtml(row.stage)}</span>`;
  return `<span
    class="table-manual-text${isManual ? ' is-human' : ''} is-editable"
    data-table-stage-edit
    data-record-id="${escapeHtml(row.id)}"
    data-previous-value="${escapeHtml(row.stage)}"
    role="button"
    tabindex="0"
    title="${escapeHtml(stageTitle)} (더블클릭하여 Pipeline Stage 선택)"
    aria-label="${escapeHtml(row.asset)} Pipeline Stage: double-click to edit"
  >${escapeHtml(row.stage)}</span>`;
}

function modalityEditValue(row) {
  const isManual = hasManualTableFieldEdit(row.raw, 'modality_platform');
  const editable = !row.isVirtualTriage && row.modality === 'Unknown' && Boolean(getCurrentUser()?.is_admin);
  const className = `single-line-cell table-manual-text${isManual ? ' is-human' : ''}${editable ? ' is-editable modality-editable' : ''}`;
  const tags = Array.isArray(row.modalityTags) ? row.modalityTags.filter((tag) => tag && tag !== row.modalityCanonical) : [];
  const source = String(row.modalityRaw || '').trim();
  const label = [
    modalityFullHoverTitle(row),
    `Canonical: ${row.modalityCanonical || row.modality}`,
    source && normalizedDashboardSearchText(source) !== normalizedDashboardSearchText(row.modalityCanonical || row.modality) ? `Source: ${source}` : '',
    tags.length ? `Tags: ${tags.join(', ')}` : ''
  ].filter(Boolean).join(' · ');
  const attributes = editable
    ? ` data-table-modality-edit data-record-id="${escapeHtml(row.id)}" data-previous-value="${escapeHtml(row.modality)}" role="button" tabindex="0" aria-label="Double-click to select modality"`
    : '';
  return `<span class="${className}"${attributes} title="${escapeHtml(editable ? '관리자: 더블클릭하여 Modality 선택' : label)}">${escapeHtml(row.modality)}</span>`;
}

function countryEditValue(row) {
  const isManual = hasManualTableFieldEdit(row.raw, 'company_country');
  const editable = !row.isVirtualTriage && Boolean(getCurrentUser()?.is_admin);
  const value = row.country || 'Unknown';
  const classes = `table-manual-text country-cell-content${isManual ? ' is-human' : ''}${editable ? ' is-editable' : ''}`;
  const attributes = editable
    ? ` data-table-country-edit data-record-id="${escapeHtml(row.id)}" data-previous-value="${escapeHtml(value)}" role="button" tabindex="0" aria-label="Double-click to edit Location"`
    : '';
  return `<span class="${classes}"${attributes} title="${escapeHtml(editable ? '관리자: 더블클릭하여 Location 입력' : row.countryRaw || value)}">${countryDisplayMarkup(value)}</span>`;
}

function focusOfficialFieldValue(row, value, label, { html = '', className = '', title = '' } = {}) {
  const editable = Boolean(getCurrentUser()?.is_admin);
  const classes = ['table-manual-text', 'focus-official-field', className, editable ? 'is-research-locked' : '']
    .filter(Boolean)
    .join(' ');
  const attributes = editable
    ? ` data-focus-official-locked data-record-id="${escapeHtml(row.id)}" role="button" tabindex="0" aria-label="${escapeHtml(label)}: open Advanced Research editing guidance"`
    : '';
  const tooltip = editable
    ? `더블클릭하여 Tab 2 · Advanced Research에서 ${label} 수정 안내 보기`
    : (title || value || '');
  // Keep a field's source tooltip visible to administrators as well as the
  // edit guidance. This is especially important for Main indication, whose
  // concise canonical value can differ from the filtered source wording.
  const finalTooltip = title && editable ? `${title}\n${tooltip}` : tooltip;
  return `<span class="${classes}"${attributes} title="${escapeHtml(finalTooltip)}">${html || escapeHtml(value || '-')}</span>`;
}

function tableTextEditValue(row, kind, value, { title = '', strong = false, className = '' } = {}) {
  const field = kind === 'asset' ? 'asset_name' : kind;
  const isManual = hasManualTableFieldEdit(row.raw, field);
  const editable = !row.isVirtualTriage && Boolean(getCurrentUser()?.is_admin);
  const classes = `table-manual-text${isManual ? ' is-human' : ''}${editable ? ' is-editable' : ''}${className ? ` ${className}` : ''}`;
  const attributes = editable
    ? ` data-table-text-edit data-record-id="${escapeHtml(row.id)}" data-edit-kind="${escapeHtml(kind)}" data-previous-value="${escapeHtml(value)}"`
    : '';
  const content = escapeHtml(value || '-');
  return `<span class="${classes}"${attributes} title="${escapeHtml(title || value || '')}"${editable ? ' role="button" tabindex="0" aria-label="Double-click to edit"' : ''}>${strong ? `<strong>${content}</strong>` : content}</span>`;
}

function pendingScoreBadge(message = `Advanced Research v${LATEST_FULL_SCOUT_RUBRIC_VERSION} review not run yet`) {
  const safeTooltip = escapeHtml(message);
  return `<span class="score pending" tabindex="0" aria-label="${safeTooltip}" data-tooltip="${safeTooltip}" title="${safeTooltip}">-</span>`;
}

function fullReviewScoreBadge(row, scoreKey, criterionKey, label) {
  if (row.isTriage) return pendingScoreBadge();
  return pipelineScoreBadge(row, row[scoreKey], 3, scoreTooltip(label, row.criteria[criterionKey], 3));
}

function filterToneClass(status) {
  if (!status || status === '-') return 'empty';
  if (['PASS', 'SELECT'].includes(status)) return 'pass select';
  if (status === 'FAIL') return 'fail';
  if (['INSUFFICIENT', 'N/A'].includes(status)) return 'na reject';
  return 'review';
}

function updatePipelinePagination(pageCount) {
  if (elements.pageInfo) elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  if (elements.firstPage) elements.firstPage.disabled = state.page <= 1;
  if (elements.prevPage) elements.prevPage.disabled = state.page <= 1;
  if (elements.nextPage) elements.nextPage.disabled = state.page >= pageCount;
  if (elements.lastPage) elements.lastPage.disabled = state.page >= pageCount;
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
      <th><button data-sort="country" type="button">Location</button></th>
      <th><button data-sort="asset" type="button">Asset</button></th>
      <th><button data-sort="target" type="button">Target / Modality / Theme / Cluster</button></th>
      <th><button data-sort="mainIndication" type="button">Main indication</button></th>
      <th><button data-sort="stage" type="button">Pipeline Stage</button></th>
      <th><button data-sort="filter1" type="button">Filter 1</button></th>
      <th><button data-sort="filter2" type="button">Filter 2</button></th>
      <th><button data-sort="targetScore" type="button">TAR</button></th>
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
        <th rowspan="2"><button data-sort="country" type="button">Location</button></th>
        <th rowspan="2"><button data-sort="asset" type="button">Asset</button></th>
        <th rowspan="2"><button data-sort="target" type="button">Target / Modality / Theme / Cluster</button></th>
        <th rowspan="2"><button data-sort="mainIndication" type="button">Main indication</button></th>
        <th rowspan="2"><button data-sort="stage" type="button">Pipeline Stage</button></th>
        <th rowspan="2"><button data-sort="filter1" type="button">Filter 1</button></th>
        <th rowspan="2"><button data-sort="filter2" type="button">Filter 2</button></th>
        <th class="score-group-head" colspan="3">Simple Research</th>
        <th class="score-group-head" colspan="5">Advanced Research only</th>
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
      </tr>
      <tr class="pipeline-score-row">
        <th><button data-sort="targetScore" type="button">TAR</button></th>
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
        ${sortableHeader('Location', 'country', 'country', 'rowspan="2"')}
        ${sortableHeader('Asset', 'asset', 'asset', 'rowspan="2"')}
        ${sortableHeader('Target / Modality / Theme / Cluster', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Main indication', 'mainIndication', 'mainIndication', 'rowspan="2"')}
        ${sortableHeader('Pipeline Stage', 'stage', 'stage', 'rowspan="2"')}
        ${passFilterHeader('Filter 1', 'filter1', 'filter1', 'rowspan="2"')}
        ${passFilterHeader('Filter 2', 'filter2', 'filter2', 'rowspan="2"')}
        <th class="score-group-head" colspan="3">Simple Research</th>
        <th class="score-group-head" colspan="5">Advanced Research only</th>
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
      </tr>
      <tr class="pipeline-score-row">
        ${sortableHeader('TAR', 'targetScore', 'targetScore')}
        ${sortableHeader('MOA', 'moaScore', 'moaScore')}
        ${sortableHeader('Data', 'dataScore', 'dataScore')}
        ${sortableHeader('Comp', 'competitiveScore', 'competitiveScore')}
        ${sortableHeader('Plat', 'platformScore', 'platformScore')}
        ${sortableHeader('Exp', 'expansionScore', 'expansionScore')}
        ${sortableHeader('Market', 'marketScore', 'marketScore')}
        ${scoreFilterHeader('Total', 'totalScore', 'totalScore')}
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
              <td class="country-cell">${countryEditValue(row)}</td>
              <td class="asset-cell"><a href="${escapeHtml(recordDetailHref(row, row.isTriage ? 'triage' : 'full'))}"><strong>${escapeHtml(row.asset)}</strong></a></td>
              <td class="target-column-cell">
                <div class="target-cell">
                  <strong>${escapeHtml(row.target)}</strong>
                  <span>Modality: ${escapeHtml(row.modality)}</span>
                  <span>Theme: ${escapeHtml(row.theme)}</span>
                  <span>Cluster: ${escapeHtml(row.cluster)}</span>
                </div>
              </td>
              <td class="indication-cell" title="${escapeHtml(indicationFullHoverTitle(row))}">${escapeHtml(indicationDisplay(row))}</td>
              <td class="stage-cell" title="${escapeHtml(pipelineStageFullHoverTitle(row))}">${stageEditSelect(row)}</td>
              <td class="filter-cell"><span class="${filter1Class}">${escapeHtml(row.filter1)}</span></td>
              <td class="filter-cell"><span class="${filter2Class}">${escapeHtml(filter2StatusLabel(row.filter2))}</span></td>
              <td class="score-cell">${pipelineScoreBadge(row, row.targetScore, 3, scoreTooltip('Target Area Relevance', row.criteria.target, 3))}</td>
              <td class="score-cell">${pipelineScoreBadge(row, row.moaScore, 3, scoreTooltip('MOA Validity', row.criteria.moa, 3))}</td>
              <td class="score-cell">${pipelineScoreBadge(row, row.dataScore, 3, scoreTooltip('Data Maturity', row.criteria.data, 3))}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'competitiveScore', 'competitive', 'Competitive Landscape')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'platformScore', 'platform', 'Platform Attractiveness')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'expansionScore', 'expansion', 'Expansion Potential')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'marketScore', 'market', 'Marketability')}</td>
              <td class="score-cell total-score-cell">${row.isTriage ? pendingScoreBadge('Advanced Research total score not available for triage rows') : totalScoreEditCircle(row)}</td>
              ${extraColumns.map((column) => {
                const value = formatExtraColumnValue(get(row.raw, column.path, '-'), column);
                return `<td class="extra-column-cell" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
              }).join('')}
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="${17 + extraColumns.length}" class="empty-cell">조건에 맞는 데이터가 없습니다.</td></tr>`;

  updatePipelinePagination(pageCount);
  updateSelectionControls(pageRows);
}

function canWriteFocusProject(projectId) {
  // oic_default now also carries a real members[]/current_user_role from the
  // backend (site admins auto-owner, others via explicit membership), so the
  // same read/write/owner check applies uniformly to every Project.
  return shortlistingRoleFor(projectId) !== 'read';
}

function writableFocusProjectOptions() {
  const projects = state.shortlistingProjects.length
    ? state.shortlistingProjects
    : [{ id: DEFAULT_SHORTLISTING_PROJECT_ID, name: 'Open Innovation Center' }];
  return projects.filter((project) => canWriteFocusProject(project.id));
}

function isRowTrackedInProject(row, projectId) {
  return projectId === DEFAULT_SHORTLISTING_PROJECT_ID
    ? Boolean(row.focusTracked)
    : row.shortlistingProjectTracked?.[projectId] === true;
}

function focusProjectPickerButton(row, writableProjects) {
  const isTrackedAnywhere = writableProjects.some((project) => isRowTrackedInProject(row, project.id));
  return `
    <button
      type="button"
      class="focus-action-button icon-only ${isTrackedAnywhere ? 'remove priority' : 'add'}"
      data-focus-project-picker-trigger
      data-record-id="${escapeHtml(row.id)}"
      aria-haspopup="menu"
      aria-expanded="false"
      title="Custom Review에 추가/제거할 Project 선택"
      aria-label="Custom Review에 추가/제거할 Project 선택"
    >
      <span aria-hidden="true">${isTrackedAnywhere ? '★' : '☆'}</span>
    </button>
  `;
}

function focusActionButton(row, location = 'full', projectId = state.activeShortlistingProjectId) {
  if (location === 'full') {
    const writableProjects = writableFocusProjectOptions();
    // No Project this account can write to: nothing to add the record to, so
    // don't show a star that would just 403 on click.
    if (writableProjects.length === 0) return '';
    if (writableProjects.length > 1) return focusProjectPickerButton(row, writableProjects);
    // Exactly one writable Project — target it directly rather than whatever
    // Project happens to be selected in the Custom Review tab's switcher,
    // which the user may only have read access to.
    projectId = writableProjects[0].id;
  }
  const isDefaultProject = projectId === DEFAULT_SHORTLISTING_PROJECT_ID;
  const isTracked = isDefaultProject ? row.focusTracked : row.shortlistingProjectTracked?.[projectId] === true;
  const trackingStatus = isDefaultProject
    ? (row.focusTrackingStatus || (isTracked ? 'priority' : 'untracked'))
    : (row.shortlistingProjectTrackingStatus?.[projectId] || (isTracked ? 'priority' : 'untracked'));
  const statusCopy = {
    untracked: {
      action: 'add',
      title: 'Custom Review 미등록 · 클릭하여 우선 검토 대상으로 추가',
      ariaLabel: 'Custom Review에 우선 검토 대상으로 추가'
    },
    priority: {
      action: 'stationary',
      title: 'Custom Review 대상 · Priority review · 클릭하여 Stationary로 변경',
      ariaLabel: '우선 검토 Custom Review 상태 · 클릭하여 Stationary로 변경'
    },
    stationary: {
      action: 'remove',
      title: 'Custom Review에는 적절하나, 현재 Partnership 검토를 보류할 제약이 있습니다. 클릭하여 Custom Review에서 제거',
      ariaLabel: 'Custom Review 유지 · Partnership 검토 보류 상태 · 클릭하여 Custom Review에서 제거'
    }
  }[trackingStatus];
  const canWrite = canWriteFocusProject(projectId);
  return `
    <button
      type="button"
      class="focus-action-button icon-only ${trackingStatus === 'priority' ? 'remove priority' : trackingStatus === 'stationary' ? 'stationary' : 'add'}"
      data-focus-action="${statusCopy.action}"
      data-record-id="${escapeHtml(row.id)}"
      data-project-id="${escapeHtml(projectId)}"
      data-tracking-status="${trackingStatus}"
      title="${canWrite ? escapeHtml(statusCopy.title) : '이 Project에 대한 write 권한이 없습니다.'}"
      aria-label="${canWrite ? escapeHtml(statusCopy.ariaLabel) : 'write 권한이 없어 비활성화됨'}"
      ${canWrite ? '' : 'disabled'}
    >
      <span aria-hidden="true">${isTracked ? '★' : '☆'}</span>
    </button>
  `;
}

function fullScoutRowActions(row) {
  return `
    <div class="full-scout-row-actions">
      ${rubricReevaluationButton(row)}
      ${focusActionButton(row, 'full')}
      ${pipelineWebsiteRowButton(row)}
    </div>
  `;
}

function pipelineWebsiteRowButton(row) {
  const url = String(get(row?.raw, 'meta.pipeline_metadata.website', '') || '').trim();
  const hasUrl = /^https?:\/\//i.test(url);
  return `
    <button
      type="button"
      class="focus-action-button icon-only pipeline-website-row-button${hasUrl ? '' : ' is-unavailable'}"
      data-pipeline-website
      data-record-id="${escapeHtml(row.id)}"
      data-owner-type="record"
      data-owner-id="${escapeHtml(row.id)}"
      data-pipeline-asset="${escapeHtml(row.asset)}"
      data-website-url="${escapeHtml(hasUrl ? url : '')}"
      title="${escapeHtml(hasUrl ? 'Pipeline Website · Tab 0 Listing에서 관리 · 클릭하여 열기' : 'Pipeline Website 미등록 · Tab 0 Listing에서 등록')}"
      aria-label="${escapeHtml(`${row.asset} Pipeline Website ${hasUrl ? '열기' : '미등록'}`)}"
      aria-disabled="${hasUrl ? 'false' : 'true'}"
    ><svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14 14 10M8.5 7.5H7a3 3 0 0 0-3 3V17a3 3 0 0 0 3-3v-1.5M13 4h7v7M20 4l-9 9"/></svg></button>
  `;
}

function triageFullScoutCopyButton(row) {
  const title = `GPT 지침 2와 ${row.asset} / ${row.company} Simple Research 내용을 함께 복사합니다.`;
  return `
    <button
      type="button"
      class="focus-action-button icon-only triage-full-copy-button"
      data-triage-full-copy
      data-record-id="${escapeHtml(row.id)}"
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(`${row.asset} Advanced Research 지침 복사`)}"
    ><svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/></svg></button>
  `;
}

function rubricReevaluationButton(row) {
  const isTriage = row.isTriage;
  const workflowLabel = isTriage ? 'Simple Research' : 'Advanced Research';
  const latestVersion = isTriage ? LATEST_TRIAGE_RUBRIC_VERSION : LATEST_FULL_SCOUT_RUBRIC_VERSION;
  const appliedCandidates = [
    { version: get(row.raw, 'meta.rubric_reviewed_version', ''), at: get(row.raw, 'meta.rubric_reviewed_at', '') },
    { version: get(row.raw, 'meta.rescored_rubric_version', ''), at: get(row.raw, 'meta.rescored_at', '') },
    { version: get(row.raw, 'meta.rubric_recalculation.version', ''), at: get(row.raw, 'meta.rubric_recalculation.recalculated_at', '') },
    { version: row.criteriaVersion || '-', at: row.generatedAt || '' }
  ].filter((candidate) => String(candidate.version || '').trim());
  const appliedRubric = appliedCandidates.reduce((latest, candidate) => {
    const latestTime = Date.parse(latest.at || '') || 0;
    const candidateTime = Date.parse(candidate.at || '') || 0;
    return candidateTime > latestTime ? candidate : latest;
  }, appliedCandidates[0] || { version: '-', at: '' });
  const appliedVersion = String(appliedRubric.version || '-');
  const evaluatedAt = appliedRubric.at || row.generatedAt || '-';
  const hasManualScoreOverride = Object.keys(humanReviewOverrides(row.raw)?.scores || {}).length > 0
    || hasManualTotalScoreOverride(row.raw);
  const hasCurrentDefinition = isTriage
    || get(row.raw, 'meta.full_scout_rubric_definition_revision', '')
      === LATEST_FULL_SCOUT_RUBRIC_DEFINITION_REVISION;
  const aiReassessmentHistory = get(row.raw, 'meta.rubric_refresh_history', []);
  const hasCurrentAiReassessment = String(get(row.raw, 'meta.rescored_rubric_version', '')).replace(/^v/i, '')
    === latestVersion
    || (Array.isArray(aiReassessmentHistory) && aiReassessmentHistory.some((entry) => (
      String(entry?.version || '').replace(/^v/i, '') === latestVersion
      && ['updated', 'no_change', 'no_score_changes'].includes(String(entry?.result || ''))
    )));
  const isCurrent = !hasManualScoreOverride
    && hasCurrentAiReassessment
    && hasCurrentDefinition;
  const title = [
    isTriage
      ? `최신 ${workflowLabel} Rubric으로 배치 GPT 원문을 AI 재채점`
      : `최신 ${workflowLabel} Rubric으로 GPT 원문과 파트너사 자료를 AI 재채점`,
    hasManualScoreOverride
      ? '수동 점수는 저장된 GPT 공식 점수로 복원되고, 변경 이력에는 남습니다.'
      : '',
    `적용 지침: v${appliedVersion}`,
    `평가 날짜: ${formatDateTimeKo(evaluatedAt)}`
  ].join('\n');
  return `
    <button
      type="button"
      class="focus-action-button icon-only rubric-refresh-button ${isCurrent ? 'is-current' : ''}"
      data-rubric-refresh
      data-review-type="${isTriage ? 'triage' : 'full'}"
      data-record-id="${escapeHtml(row.id)}"
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(`${row.asset} ${workflowLabel} 최신 지침으로 재평가`)}"
    ><svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg></button>
  `;
}

function rubricReevaluationCell(row) {
  if (row.isVirtualTriage) {
    return `<div class="full-scout-row-actions">${pipelineWebsiteRowButton(row)}</div>`;
  }
  return `<div class="full-scout-row-actions">${rubricReevaluationButton(row)}${triageFullScoutCopyButton(row)}${pipelineWebsiteRowButton(row)}</div>`;
}

function oiPartnershipRefreshButton(row) {
  const latestVersion = state.latestOiPartnershipCriteriaVersion;
  const currentVersion = row.filter3CriteriaVersion || '-';
  const isCurrent = row.filter3Source !== 'manual' && currentVersion === latestVersion;
  return `
    <button
      type="button"
      class="focus-action-button icon-only rubric-refresh-button oi-partnership-refresh-button ${isCurrent ? 'is-current' : ''}"
      data-oi-partnership-refresh
      data-record-id="${escapeHtml(row.id)}"
      title="최신 OI Partnership v${escapeHtml(latestVersion)} 기준으로 Filter 3 분류를 다시 계산합니다. 수동 Filter 3 분류와 붉은 표시는 자동 결과로 초기화됩니다. 사람이 입력한 OI Note는 유지하고, 자동 생성 rationale은 최신 근거로 갱신합니다. In-vivo·In-vitro·ADMET 입력과 업로드 자료는 유지됩니다. 현재 표시 버전: v${escapeHtml(currentVersion)}"
      aria-label="${escapeHtml(row.asset)} 최신 OI Partnership v${escapeHtml(latestVersion)} 재분류"
    >
      <span aria-hidden="true">↻</span>
    </button>
  `;
}

function focusRowActions(row) {
  const isDefaultProject = state.activeShortlistingProjectId === DEFAULT_SHORTLISTING_PROJECT_ID;
  return `
    <div class="full-scout-row-actions">
      ${isDefaultProject ? oiPartnershipRefreshButton(row) : ''}
      ${focusActionButton(row, 'focus')}
      ${pipelineWebsiteRowButton(row)}
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

function countryFlagSvg(country) {
  const value = String(country || '').trim().toLowerCase();
  const frame = (content) => `<svg class="country-flag" viewBox="0 0 24 16" aria-hidden="true" focusable="false"><rect x=".5" y=".5" width="23" height="15" rx="2" fill="#fff" stroke="rgba(15,23,42,.18)"/>${content}</svg>`;
  if (/korea/.test(value)) {
    return frame('<path d="M12 4a4 4 0 0 1 0 8 2 2 0 0 0 0-4 2 2 0 0 1 0-4Z" fill="#d9485f"/><path d="M12 12a4 4 0 0 1 0-8 2 2 0 0 0 0 4 2 2 0 0 1 0 4Z" fill="#3157a4"/>');
  }
  if (/united states|\busa?\b|america/.test(value)) {
    return frame('<path d="M1 1h22v2H1zm0 4h22v2H1zm0 4h22v2H1zm0 4h22v2H1z" fill="#c63f50"/><rect x="1" y="1" width="10" height="8" fill="#3157a4"/><path d="m3 3 .4 1.1h1.2l-1 .7.4 1.2-1-.7-1 .7.4-1.2-1-.7h1.2z" fill="#fff"/>');
  }
  if (/canada/.test(value)) {
    return frame('<path d="M1 1h5v14H1zm17 0h5v14h-5z" fill="#cf334a"/><path d="m12 4 1 2 2-.5-1 2 1.4 1-2.4.8.4 2.2h-2.8l.4-2.2-2.4-.8 1.4-1-1-2 2 .5z" fill="#cf334a"/>');
  }
  if (/china/.test(value)) {
    return frame('<rect x="1" y="1" width="22" height="14" rx="1.5" fill="#d63845"/><path d="m5 3 .6 1.7h1.8l-1.5 1 .6 1.8L5 6.4 3.5 7.5l.6-1.8-1.5-1h1.8z" fill="#ffd34d"/>');
  }
  if (/japan/.test(value)) {
    return frame('<circle cx="12" cy="8" r="3.6" fill="#cf334a"/>');
  }
  if (/singapore/.test(value)) {
    return frame('<path d="M1 1h22v7H1z" fill="#d63845"/><path d="M5.8 2.3a2.5 2.5 0 1 0 0 4 2 2 0 1 1 0-4Z" fill="#fff"/>');
  }
  if (/israel/.test(value)) {
    return frame('<path d="M1 3h22v2H1zm0 8h22v2H1z" fill="#3157a4"/><path d="m12 5 2 3.5h-4zm0 6-2-3.5h4z" fill="none" stroke="#3157a4" stroke-width=".8"/>');
  }
  if (/taiwan/.test(value)) {
    return frame('<rect x="1" y="1" width="22" height="14" rx="1.5" fill="#d63845"/><rect x="1" y="1" width="10" height="7" fill="#3157a4"/><circle cx="6" cy="4.5" r="1.7" fill="#fff"/>');
  }
  if (/australia/.test(value)) {
    return frame('<rect x="1" y="1" width="22" height="14" rx="1.5" fill="#25467f"/><path d="m17 5 .5 1.2 1.3.1-1 .8.3 1.3-1.1-.7-1.1.7.3-1.3-1-.8 1.3-.1z" fill="#fff"/>');
  }
  if (/europe|united kingdom|\buk\b/.test(value)) {
    return frame('<rect x="1" y="1" width="22" height="14" rx="1.5" fill="#3157a4"/><path d="M1 6.5h22v3H1zM10.5 1h3v14h-3z" fill="#fff"/><path d="M1 7h22v2H1zM11 1h2v14h-2z" fill="#cf334a"/>');
  }
  return '<svg class="country-globe" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16"/></svg>';
}

function countryDisplayMarkup(country) {
  const label = String(country || 'Unknown').trim() || 'Unknown';
  const countries = canonicalCountryValues(label).slice(0, 2);
  const displayLabel = countryTableCode(countries.join(' / '));
  return `<span class="country-cell-content" aria-label="${escapeHtml(countries.join(' / '))}">${countryFlagSvg(countries[0])}<span>${escapeHtml(displayLabel)}</span></span>`;
}

let pipelineHeaderFreezeController = null;

function refreshPipelineHeaderFreeze() {
  // Header markup and column widths are rebuilt on every table render. Refresh
  // the viewport mirror after that work completes instead of relying only on
  // MutationObserver timing, which could leave the header blank after a rerender.
  window.requestAnimationFrame(() => pipelineHeaderFreezeController?.refresh());
}

async function loadShortlistingProjects(signal) {
  try {
    const response = await fetch(SHORTLISTING_PROJECTS_URL, { cache: 'no-store', signal });
    if (!response.ok) return;
    const data = await response.json();
    state.shortlistingProjects = Array.isArray(data.projects)
      ? data.projects.filter((project) => project && !project.archived)
      : [];
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') return;
    // Non-fatal: Shortlisting still renders the OIC default project from hardcoded logic.
    console.warn('Failed to load shortlisting projects', error);
  }
}

function activeShortlistingProject() {
  return (
    state.shortlistingProjects.find((project) => project.id === state.activeShortlistingProjectId)
    || state.shortlistingProjects.find((project) => project.id === DEFAULT_SHORTLISTING_PROJECT_ID)
    || null
  );
}

function settingsModalProject() {
  return state.shortlistingProjects.find((project) => project.id === state.settingsModalProjectId) || null;
}

function setActiveShortlistingProjectId(projectId) {
  state.activeShortlistingProjectId = projectId;
  localStorage.setItem(SHORTLISTING_PROJECT_STORAGE_KEY, projectId);
  state.page = 1;
  renderShortlistingProjectControl();
  renderTable();
}

function openShortlistingProjectSwitchMenu() {
  if (!elements.shortlistingProjectSwitchMenu) return;
  elements.shortlistingProjectSwitchMenu.hidden = false;
  elements.shortlistingProjectSwitchButton?.setAttribute('aria-expanded', 'true');
}

function closeShortlistingProjectSwitchMenu() {
  if (!elements.shortlistingProjectSwitchMenu) return;
  elements.shortlistingProjectSwitchMenu.hidden = true;
  elements.shortlistingProjectSwitchButton?.setAttribute('aria-expanded', 'false');
}

function renderShortlistingProjectControl() {
  // state.tableMode only tracks the last-selected Fast Triage/Full Scout/Shortlisting
  // table tab and is untouched when switching to the separate Step0/Knowledge Map
  // panels, so activeTableMode() alone can't tell those apart — check panel
  // visibility directly too, or this header group leaks into those panels.
  const isStep0Visible = Boolean(elements.step0Panel && !elements.step0Panel.hidden);
  const isKnowledgeMapVisible = Boolean(elements.knowledgeMapPanel && !elements.knowledgeMapPanel.hidden);
  const isFocusMode = !isStep0Visible && !isKnowledgeMapVisible && activeTableMode() === 'focus';
  if (elements.topShortlistingActions) elements.topShortlistingActions.hidden = !isFocusMode;
  if (!isFocusMode) return;
  const projects = state.shortlistingProjects.length
    ? state.shortlistingProjects
    : [{ id: DEFAULT_SHORTLISTING_PROJECT_ID, name: 'Open Innovation Center' }];
  if (!projects.some((project) => project.id === state.activeShortlistingProjectId)) {
    state.activeShortlistingProjectId = DEFAULT_SHORTLISTING_PROJECT_ID;
    localStorage.setItem(SHORTLISTING_PROJECT_STORAGE_KEY, DEFAULT_SHORTLISTING_PROJECT_ID);
  }
  const activeProject = projects.find((project) => project.id === state.activeShortlistingProjectId);
  if (elements.shortlistingProjectSwitchLabel) {
    elements.shortlistingProjectSwitchLabel.textContent = activeProject?.name || 'Open Innovation Center';
  }
  if (elements.shortlistingProjectSwitchMenu) {
    elements.shortlistingProjectSwitchMenu.innerHTML = projects
      .map((project) => `
        <div class="shortlisting-project-switch-row">
          <button
            type="button"
            class="shortlisting-project-switch-option${project.id === state.activeShortlistingProjectId ? ' is-active' : ''}"
            role="option"
            aria-selected="${project.id === state.activeShortlistingProjectId}"
            data-project-id="${escapeHtml(project.id)}"
          >${escapeHtml(project.name)}</button>
          ${project.current_user_role === 'owner' ? `
            <button
              type="button"
              class="shortlisting-project-settings-button"
              data-project-settings-id="${escapeHtml(project.id)}"
              title="${escapeHtml(project.name)} 설정"
              aria-label="${escapeHtml(project.name)} 설정"
            ><span aria-hidden="true">⚙</span></button>
          ` : ''}
        </div>
      `)
      .join('');
  }
}

function shortlistingRoleFor(projectId) {
  return state.shortlistingProjects.find((project) => project.id === projectId)?.current_user_role || 'read';
}

let activeFocusProjectPicker = null;

function focusProjectPickerPopoverElement() {
  let element = document.querySelector('#tableFocusProjectPicker');
  if (element) return element;
  element = document.createElement('div');
  element.id = 'tableFocusProjectPicker';
  element.className = 'table-focus-project-picker';
  element.hidden = true;
  element.setAttribute('role', 'menu');
  document.body.append(element);
  return element;
}

function closeFocusProjectPicker() {
  if (activeFocusProjectPicker?.trigger?.isConnected) {
    activeFocusProjectPicker.trigger.setAttribute('aria-expanded', 'false');
  }
  activeFocusProjectPicker = null;
  const popover = document.querySelector('#tableFocusProjectPicker');
  if (popover) {
    popover.hidden = true;
    popover.innerHTML = '';
  }
}

function positionFocusProjectPickerPopover() {
  const popover = document.querySelector('#tableFocusProjectPicker');
  const trigger = activeFocusProjectPicker?.trigger;
  if (!popover || popover.hidden || !trigger?.isConnected) return;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(240, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  const height = Math.min(popover.offsetHeight || 240, window.innerHeight - 24);
  popover.style.top = `${Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12))}px`;
}

function renderFocusProjectPickerPopover(row) {
  const active = activeFocusProjectPicker;
  if (!active) return;
  const popover = focusProjectPickerPopoverElement();
  const projects = writableFocusProjectOptions();
  popover.innerHTML = `
    <div class="table-focus-project-picker-heading">Custom Review Project 선택</div>
    <div class="table-focus-project-picker-list" role="none">
      ${projects.map((project) => {
        const isTracked = isRowTrackedInProject(row, project.id);
        return `
          <button
            type="button"
            class="table-focus-project-picker-option${isTracked ? ' is-tracked' : ''}"
            role="menuitemcheckbox"
            aria-checked="${isTracked ? 'true' : 'false'}"
            data-focus-project-pick="${escapeHtml(project.id)}"
          >
            <span class="table-focus-project-picker-star" aria-hidden="true">${isTracked ? '★' : '☆'}</span>
            <span>${escapeHtml(project.name)}</span>
          </button>`;
      }).join('')}
    </div>
  `;
  popover.hidden = false;
  positionFocusProjectPickerPopover();
}

function toggleFocusProjectPicker(trigger) {
  const recordId = trigger?.dataset.recordId;
  if (!recordId) return;
  if (activeFocusProjectPicker?.recordId === recordId) {
    closeFocusProjectPicker();
    return;
  }
  const row = state.rows.find((item) => item.id === recordId);
  if (!row) return;
  closeMultiFilters();
  closeScoreHeaderFilter();
  closeFocusHeaderFilter();
  closePassHeaderFilter();
  closeFocusProjectPicker();
  activeFocusProjectPicker = { recordId, trigger };
  trigger.setAttribute('aria-expanded', 'true');
  renderFocusProjectPickerPopover(row);
}

function pickFocusProjectFromPicker(projectId) {
  const active = activeFocusProjectPicker;
  if (!active) return;
  const row = state.rows.find((item) => item.id === active.recordId);
  if (!row) {
    closeFocusProjectPicker();
    return;
  }
  const action = isRowTrackedInProject(row, projectId) ? 'remove' : 'add';
  if (projectId === DEFAULT_SHORTLISTING_PROJECT_ID) {
    saveFocusManagement(active.recordId, { action });
  } else {
    saveShortlistingProjectField(active.recordId, projectId, { action });
  }
  closeFocusProjectPicker();
}

function openShortlistingProjectModal() {
  if (!elements.shortlistingProjectModal) return;
  if (elements.shortlistingProjectNameInput) elements.shortlistingProjectNameInput.value = '';
  if (elements.shortlistingProjectDescriptionInput) elements.shortlistingProjectDescriptionInput.value = '';
  if (elements.shortlistingProjectModalStatus) elements.shortlistingProjectModalStatus.textContent = '';
  elements.shortlistingProjectModal.hidden = false;
  elements.shortlistingProjectNameInput?.focus();
}

function closeShortlistingProjectModal() {
  if (elements.shortlistingProjectModal) elements.shortlistingProjectModal.hidden = true;
}

async function submitShortlistingProjectModal() {
  const name = elements.shortlistingProjectNameInput?.value.trim() || '';
  const description = elements.shortlistingProjectDescriptionInput?.value.trim() || '';
  if (!name) {
    if (elements.shortlistingProjectModalStatus) {
      elements.shortlistingProjectModalStatus.textContent = 'Project 이름을 입력하세요.';
      elements.shortlistingProjectModalStatus.classList.add('is-error');
    }
    return;
  }
  if (elements.shortlistingProjectModalSave) elements.shortlistingProjectModalSave.disabled = true;
  try {
    const response = await fetch(SHORTLISTING_PROJECTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Project 생성에 실패했습니다.');
    state.shortlistingProjects.push(data.project);
    closeShortlistingProjectModal();
    setActiveShortlistingProjectId(data.project.id);
  } catch (error) {
    if (elements.shortlistingProjectModalStatus) {
      elements.shortlistingProjectModalStatus.textContent = error.message || 'Project 생성에 실패했습니다.';
      elements.shortlistingProjectModalStatus.classList.add('is-error');
    }
  } finally {
    if (elements.shortlistingProjectModalSave) elements.shortlistingProjectModalSave.disabled = false;
  }
}

const SHORTLISTING_METRIC_RETURN_TYPE_LABELS = {
  boolean: 'True/False',
  list: 'List',
  number: 'Number',
  date: 'Date',
  text: 'Text'
};

function shortlistingMetricReturnTypeSummary(column) {
  const label = SHORTLISTING_METRIC_RETURN_TYPE_LABELS[column.return_type] || column.return_type;
  if (column.return_type === 'list' && Array.isArray(column.options)) {
    return `${label}: ${column.options.join(', ')}`;
  }
  if (column.return_type === 'number' && Number.isFinite(column.max_value)) {
    return `${label} (최대 ${column.max_value})`;
  }
  return label;
}

function updateShortlistingMetricModalConditionalFields() {
  const returnType = elements.shortlistingMetricReturnTypeSelect?.value || 'boolean';
  if (elements.shortlistingMetricListOptionsInput) elements.shortlistingMetricListOptionsInput.hidden = returnType !== 'list';
  if (elements.shortlistingMetricMaxValueInput) elements.shortlistingMetricMaxValueInput.hidden = returnType !== 'number';
}

function renderShortlistingMetricManagerTable() {
  if (!elements.shortlistingMetricManagerBody) return;
  const project = settingsModalProject();
  const customColumns = (project?.metric_columns || []).filter((column) => !column.is_builtin);
  elements.shortlistingMetricManagerBody.innerHTML = customColumns.length
    ? customColumns.map((column) => `
      <tr data-metric-id="${escapeHtml(column.id)}">
        <td>${escapeHtml(column.label)}</td>
        <td>${escapeHtml(column.description || '-')}</td>
        <td>${escapeHtml(shortlistingMetricReturnTypeSummary(column))}</td>
        <td><button type="button" class="shortlisting-metric-manager-delete-button" data-delete-metric-id="${escapeHtml(column.id)}">삭제</button></td>
      </tr>
    `).join('')
    : `<tr class="shortlisting-metric-manager-empty-row"><td colspan="4">등록된 커스텀 지표가 없습니다.</td></tr>`;
}

function resetShortlistingMetricAddForm() {
  if (elements.shortlistingMetricLabelInput) elements.shortlistingMetricLabelInput.value = '';
  if (elements.shortlistingMetricDescriptionInput) elements.shortlistingMetricDescriptionInput.value = '';
  if (elements.shortlistingMetricReturnTypeSelect) elements.shortlistingMetricReturnTypeSelect.value = 'boolean';
  if (elements.shortlistingMetricListOptionsInput) elements.shortlistingMetricListOptionsInput.value = '';
  if (elements.shortlistingMetricMaxValueInput) elements.shortlistingMetricMaxValueInput.value = '';
  if (elements.shortlistingMetricModalStatus) {
    elements.shortlistingMetricModalStatus.textContent = '';
    elements.shortlistingMetricModalStatus.classList.remove('is-error');
  }
  updateShortlistingMetricModalConditionalFields();
  const isOic = state.settingsModalProjectId === DEFAULT_SHORTLISTING_PROJECT_ID;
  if (elements.shortlistingMetricLockedNote) elements.shortlistingMetricLockedNote.hidden = !isOic;
  if (elements.shortlistingMetricAddRow) elements.shortlistingMetricAddRow.hidden = isOic;
}

function switchShortlistingSettingsTab(tabName) {
  const isMembers = tabName !== 'metrics';
  elements.shortlistingSettingsMembersTab?.classList.toggle('is-active', isMembers);
  elements.shortlistingSettingsMembersTab?.setAttribute('aria-selected', String(isMembers));
  elements.shortlistingSettingsMetricsTab?.classList.toggle('is-active', !isMembers);
  elements.shortlistingSettingsMetricsTab?.setAttribute('aria-selected', String(!isMembers));
  if (elements.shortlistingSettingsMembersPane) elements.shortlistingSettingsMembersPane.hidden = !isMembers;
  if (elements.shortlistingSettingsMetricsPane) elements.shortlistingSettingsMetricsPane.hidden = isMembers;
  if (isMembers) {
    renderShortlistingMemberManagerTable();
    renderShortlistingMemberPicker();
  } else {
    resetShortlistingMetricAddForm();
    renderShortlistingMetricManagerTable();
  }
}

async function loadUserDirectory() {
  if (state.userDirectoryLoaded) return;
  try {
    const response = await fetch(USER_DIRECTORY_URL, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    state.userDirectory = Array.isArray(data.users) ? data.users : [];
    state.userDirectoryLoaded = true;
  } catch (error) {
    console.warn('Failed to load user directory', error);
  }
}

function userDirectoryNameFor(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return state.userDirectory.find((user) => user.email === normalized)?.name || '';
}

function renderShortlistingMemberPicker() {
  if (!elements.shortlistingMemberPickerList) return;
  const existingEmails = new Set((settingsModalProject()?.members || []).map((member) => member.email));
  const searchTerm = (elements.shortlistingMemberSearchInput?.value || '').trim().toLowerCase();
  const candidates = state.userDirectory
    .filter((user) => !existingEmails.has(user.email))
    .filter((user) => !searchTerm || `${user.name} ${user.email}`.toLowerCase().includes(searchTerm));
  elements.shortlistingMemberPickerList.innerHTML = candidates.length
    ? candidates.map((user) => `
      <label class="shortlisting-member-picker-row">
        <input type="checkbox" value="${escapeHtml(user.email)}" data-member-picker-checkbox />
        <span>${escapeHtml(user.name || user.email)}</span>
        <span class="shortlisting-member-picker-email">${escapeHtml(user.email)}</span>
      </label>
    `).join('')
    : `<p class="shortlisting-member-picker-empty">${searchTerm ? '검색 결과가 없습니다.' : '추가할 수 있는 계정이 없습니다.'}</p>`;
}

function openShortlistingProjectSettingsModal(projectId) {
  if (!elements.shortlistingMetricModal) return;
  state.settingsModalProjectId = projectId;
  const project = settingsModalProject();
  if (elements.shortlistingMetricModalTitle) {
    elements.shortlistingMetricModalTitle.textContent = project ? `Project 설정 · ${project.name}` : 'Project 설정';
  }
  if (elements.shortlistingMemberModalStatus) {
    elements.shortlistingMemberModalStatus.textContent = '';
    elements.shortlistingMemberModalStatus.classList.remove('is-error');
  }
  if (elements.shortlistingMemberRoleSelect) elements.shortlistingMemberRoleSelect.value = 'write';
  if (elements.shortlistingMemberSearchInput) elements.shortlistingMemberSearchInput.value = '';
  loadUserDirectory().then(() => {
    renderShortlistingMemberPicker();
    renderShortlistingMemberManagerTable();
  });
  switchShortlistingSettingsTab('members');
  elements.shortlistingMetricModal.hidden = false;
}

function closeShortlistingProjectSettingsModal() {
  if (elements.shortlistingMetricModal) elements.shortlistingMetricModal.hidden = true;
  state.settingsModalProjectId = null;
}

function renderShortlistingMemberManagerTable() {
  if (!elements.shortlistingMemberManagerBody) return;
  const members = settingsModalProject()?.members || [];
  elements.shortlistingMemberManagerBody.innerHTML = members.length
    ? members.map((member) => `
      <tr data-member-email="${escapeHtml(member.email)}">
        <td>${escapeHtml(userDirectoryNameFor(member.email) || '-')}</td>
        <td>${escapeHtml(member.email)}</td>
        <td>${escapeHtml(member.role)}</td>
        <td><button type="button" class="shortlisting-metric-manager-delete-button" data-delete-member-email="${escapeHtml(member.email)}">삭제</button></td>
      </tr>
    `).join('')
    : `<tr class="shortlisting-metric-manager-empty-row"><td colspan="4">등록된 멤버가 없습니다 (owner 제외 모두 읽기 전용).</td></tr>`;
}

function setShortlistingMemberStatus(message, isError) {
  if (!elements.shortlistingMemberModalStatus) return;
  elements.shortlistingMemberModalStatus.textContent = message || '';
  elements.shortlistingMemberModalStatus.classList.toggle('is-error', Boolean(isError));
}

function applyShortlistingProjectUpdate(project) {
  if (!project) return;
  const index = state.shortlistingProjects.findIndex((entry) => entry.id === project.id);
  if (index >= 0) {
    state.shortlistingProjects[index] = project;
  } else {
    state.shortlistingProjects.push(project);
  }
  renderShortlistingProjectControl();
}

async function addShortlistingMember(projectId, email, role) {
  const response = await fetch(`${SHORTLISTING_PROJECTS_URL}/${encodeURIComponent(projectId)}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `${email} 추가에 실패했습니다.`);
  return data.project;
}

async function submitShortlistingMemberAdd() {
  const projectId = state.settingsModalProjectId;
  if (!projectId) return;
  const role = elements.shortlistingMemberRoleSelect?.value || 'write';
  const checkedEmails = Array.from(
    elements.shortlistingMemberPickerList?.querySelectorAll('[data-member-picker-checkbox]:checked') || []
  ).map((checkbox) => checkbox.value);
  if (!checkedEmails.length) {
    setShortlistingMemberStatus('추가할 계정을 하나 이상 선택하세요.', true);
    return;
  }
  if (elements.shortlistingMemberAddButton) elements.shortlistingMemberAddButton.disabled = true;
  const failures = [];
  let latestProject = null;
  for (const email of checkedEmails) {
    try {
      latestProject = await addShortlistingMember(projectId, email, role);
    } catch (error) {
      failures.push(error.message || email);
    }
  }
  if (latestProject) applyShortlistingProjectUpdate(latestProject);
  renderShortlistingMemberManagerTable();
  renderShortlistingMemberPicker();
  if (failures.length) {
    setShortlistingMemberStatus(`일부 추가 실패: ${failures.join(', ')}`, true);
  } else {
    setShortlistingMemberStatus(`${checkedEmails.length}명을 추가했습니다.`);
  }
  if (elements.shortlistingMemberAddButton) elements.shortlistingMemberAddButton.disabled = false;
}

async function deleteShortlistingMember(email) {
  const projectId = state.settingsModalProjectId;
  if (!projectId || !email) return;
  if (!window.confirm(`${email} 멤버를 삭제하시겠습니까?`)) return;
  try {
    const response = await fetch(`${SHORTLISTING_PROJECTS_URL}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(email)}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '멤버 삭제에 실패했습니다.');
    applyShortlistingProjectUpdate(data.project);
    setShortlistingMemberStatus('');
    renderShortlistingMemberManagerTable();
  } catch (error) {
    setShortlistingMemberStatus(error.message || '멤버 삭제에 실패했습니다.', true);
  }
}

async function submitShortlistingMetricModal() {
  const projectId = state.settingsModalProjectId;
  if (!projectId || projectId === DEFAULT_SHORTLISTING_PROJECT_ID) return;
  const label = elements.shortlistingMetricLabelInput?.value.trim() || '';
  const description = elements.shortlistingMetricDescriptionInput?.value.trim() || '';
  const returnType = elements.shortlistingMetricReturnTypeSelect?.value || 'boolean';
  const setStatus = (message) => {
    if (elements.shortlistingMetricModalStatus) {
      elements.shortlistingMetricModalStatus.textContent = message;
      elements.shortlistingMetricModalStatus.classList.add('is-error');
    }
  };
  if (!label) {
    setStatus('지표 이름을 입력하세요.');
    return;
  }
  const payload = { label, description, return_type: returnType };
  if (returnType === 'list') {
    const options = (elements.shortlistingMetricListOptionsInput?.value || '')
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);
    if (!options.length) {
      setStatus('최소 1개의 선택지를 입력하세요.');
      return;
    }
    payload.options = options;
  } else if (returnType === 'number') {
    const rawMaxValue = elements.shortlistingMetricMaxValueInput?.value || '';
    if (rawMaxValue.trim()) {
      const maxValue = Number(rawMaxValue);
      if (!Number.isFinite(maxValue) || maxValue < 1) {
        setStatus('최대값은 1 이상의 숫자로 입력하세요.');
        return;
      }
      payload.max_value = Math.round(maxValue);
    }
  }
  if (elements.shortlistingMetricModalSave) elements.shortlistingMetricModalSave.disabled = true;
  try {
    const response = await fetch(`${SHORTLISTING_PROJECTS_URL}/${encodeURIComponent(projectId)}/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '지표 추가에 실패했습니다.');
    applyShortlistingProjectUpdate(data.project);
    resetShortlistingMetricAddForm();
    renderShortlistingMetricManagerTable();
    renderTable();
  } catch (error) {
    setStatus(error.message || '지표 추가에 실패했습니다.');
  } finally {
    if (elements.shortlistingMetricModalSave) elements.shortlistingMetricModalSave.disabled = false;
  }
}

async function deleteShortlistingMetricColumn(columnId) {
  const projectId = state.settingsModalProjectId;
  if (!projectId || projectId === DEFAULT_SHORTLISTING_PROJECT_ID || !columnId) return;
  if (!window.confirm('이 지표를 삭제하시겠습니까? 이미 입력된 값도 더 이상 표시되지 않습니다.')) return;
  try {
    const response = await fetch(`${SHORTLISTING_PROJECTS_URL}/${encodeURIComponent(projectId)}/columns/${encodeURIComponent(columnId)}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || '지표 삭제에 실패했습니다.');
    applyShortlistingProjectUpdate(data.project);
    renderShortlistingMetricManagerTable();
    renderTable();
  } catch (error) {
    if (elements.shortlistingMetricModalStatus) {
      elements.shortlistingMetricModalStatus.textContent = error.message || '지표 삭제에 실패했습니다.';
      elements.shortlistingMetricModalStatus.classList.add('is-error');
    }
  }
}

function shortlistingTotalScoreBadge(row) {
  const score = row.totalScore30;
  if (!Number.isFinite(score)) return `<span class="total-score-edit-circle low">-</span>`;
  const tone = score >= 20 ? 'high' : score >= 13 ? 'mid' : 'low';
  const title = `Score (Advanced) ${row.totalScore ?? '-'} + Score (Custom) ${row.customScore ?? 0} = Total Score ${score} / 30`;
  return `<span class="total-score-edit-circle ${tone}" title="${escapeHtml(title)}">${escapeHtml(String(score))}</span>`;
}

function customScoreCircle(row) {
  const projectId = state.activeShortlistingProjectId;
  const value = Number.isFinite(row.customScore) ? row.customScore : 0;
  const tone = value >= 7 ? 'high' : value >= 4 ? 'mid' : 'low';
  const canWrite = shortlistingRoleFor(projectId) !== 'read';
  if (!canWrite) {
    return `<span class="total-score-edit-circle ${tone}" title="Score (Custom): ${escapeHtml(String(value))} · 읽기 전용">${escapeHtml(String(value))}</span>`;
  }
  return `<span
    class="total-score-edit-circle ${tone}"
    data-custom-score-edit
    data-record-id="${escapeHtml(row.id)}"
    data-project-id="${escapeHtml(projectId)}"
    data-previous-value="${escapeHtml(String(value))}"
    role="button"
    tabindex="0"
    title="Score (Custom): ${escapeHtml(String(value))} · 더블클릭하여 0~9 입력"
    aria-label="${escapeHtml(row.asset)} Score (Custom): double-click to edit"
  >${escapeHtml(String(value))}</span>`;
}

function actionDateCell(row) {
  const projectId = state.activeShortlistingProjectId;
  const disabledAttr = shortlistingRoleFor(projectId) === 'read' ? ' disabled' : '';
  return `
    <td class="focus-due-cell ${focusDueState(row.focusDueDate)}">
      <input
        class="focus-due-input"
        type="date"
        data-record-id="${escapeHtml(row.id)}"
        data-project-id="${escapeHtml(projectId)}"
        data-focus-field="due_date"
        data-previous-value="${escapeHtml(row.focusDueDate)}"
        value="${escapeHtml(row.focusDueDate)}"
        aria-label="${escapeHtml(row.asset)} action date"${disabledAttr}
      />
      ${focusDueState(row.focusDueDate) === 'overdue' ? '<span class="due-label">Overdue</span>' : ''}
      ${focusDueState(row.focusDueDate) === 'due-today' ? '<span class="due-label">Today</span>' : ''}
    </td>
  `;
}

function shortlistingMetricValue(row, metricId) {
  return get(row.raw, `meta.shortlisting_projects.${state.activeShortlistingProjectId}.metric_values.${metricId}`, undefined);
}

function shortlistingMetricEditControl(row, column) {
  const projectId = state.activeShortlistingProjectId;
  const rawValue = shortlistingMetricValue(row, column.id);
  const disabledAttr = shortlistingRoleFor(projectId) === 'read' ? ' disabled' : '';
  const baseAttrs = `data-record-id="${escapeHtml(row.id)}" data-project-id="${escapeHtml(projectId)}" data-metric-id="${escapeHtml(column.id)}" data-return-type="${escapeHtml(column.return_type)}"${disabledAttr}`;
  if (column.return_type === 'boolean') {
    const current = rawValue === true ? 'true' : rawValue === false ? 'false' : '';
    return `
      <select class="evidence-edit metric-value-edit" ${baseAttrs} data-previous-value="${escapeHtml(current)}">
        <option value="" ${current === '' ? 'selected' : ''}>-</option>
        <option value="true" ${current === 'true' ? 'selected' : ''}>Pass</option>
        <option value="false" ${current === 'false' ? 'selected' : ''}>Fail</option>
      </select>`;
  }
  if (column.return_type === 'list') {
    const options = Array.isArray(column.options) ? column.options : [];
    const current = typeof rawValue === 'string' ? rawValue : '';
    return `
      <select class="evidence-edit metric-value-edit" ${baseAttrs} data-previous-value="${escapeHtml(current)}">
        <option value="" ${current === '' ? 'selected' : ''}>-</option>
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === current ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>`;
  }
  if (column.return_type === 'number') {
    const current = typeof rawValue === 'number' ? rawValue : '';
    const boundsAttrs = Number.isFinite(column.max_value) ? ` min="0" max="${column.max_value}"` : '';
    return `<input type="number" class="focus-due-input metric-value-edit" step="any"${boundsAttrs} ${baseAttrs} data-previous-value="${escapeHtml(String(current))}" value="${escapeHtml(String(current))}" />`;
  }
  if (column.return_type === 'date') {
    const current = typeof rawValue === 'string' ? rawValue : '';
    return `<input type="date" class="focus-due-input metric-value-edit" ${baseAttrs} data-previous-value="${escapeHtml(current)}" value="${escapeHtml(current)}" />`;
  }
  const current = typeof rawValue === 'string' ? rawValue : '';
  return `<input type="text" class="focus-due-input metric-value-edit" maxlength="2000" ${baseAttrs} data-previous-value="${escapeHtml(current)}" value="${escapeHtml(current)}" />`;
}

function renderFocusTable() {
  recomputeShortlistingScoreFields();
  const visibleRows = getVisibleRows();
  const allModeRows = state.rows.filter(rowMatchesActiveTableMode);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  const tableElement = elements.pipelineTable?.closest('table');
  const isDefaultProject = state.activeShortlistingProjectId === DEFAULT_SHORTLISTING_PROJECT_ID;
  const metricColumns = activeShortlistingMetricColumns();
  const columnCount = focusTableColumnKeys().length;

  if (tableElement) {
    tableElement.classList.add('focus-management-table');
    tableElement.classList.remove('triage-table');
    tableElement.style.minWidth = `${visibleTableWidth()}px`;
  }
  if (elements.deleteSelectedButton) elements.deleteSelectedButton.hidden = true;
  if (elements.columnSettingsButton) elements.columnSettingsButton.hidden = true;
  if (elements.columnSettingsPanel) elements.columnSettingsPanel.hidden = true;
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
      <col class="pipeline-col-filter" data-col-key="filter2" style="${columnWidthStyle('filter2')}" />
      <col class="pipeline-col-score score-subtotal-col" data-col-key="totalScore" style="${columnWidthStyle('totalScore')}" />
      ${isDefaultProject ? `
      <col class="pipeline-col-filter" data-col-key="filter3" style="${columnWidthStyle('filter3')}" />
      <col class="pipeline-col-filter" data-col-key="inVivo" style="${columnWidthStyle('inVivo')}" />
      <col class="pipeline-col-filter" data-col-key="inVitro" style="${columnWidthStyle('inVitro')}" />
      <col class="pipeline-col-filter" data-col-key="admet" style="${columnWidthStyle('admet')}" />
      <col class="pipeline-col-filter" data-col-key="diseaseLinkage" style="${columnWidthStyle('diseaseLinkage')}" />
      ` : metricColumns.map((column) => `<col class="pipeline-col-filter" data-col-key="metric:${escapeHtml(column.id)}" style="${columnWidthStyle(`metric:${column.id}`)}" />`).join('')}
      <col data-col-key="focusDueDate" style="${columnWidthStyle('focusDueDate')}" />
      <col class="pipeline-col-score score-subtotal-col" data-col-key="customScore" style="${columnWidthStyle('customScore')}" />
      <col class="pipeline-col-score score-grandtotal-col" data-col-key="totalScore30" style="${columnWidthStyle('totalScore30')}" />
      <col data-col-key="focusManage" style="${columnWidthStyle('focusManage')}" />
    `;
  }
  if (elements.pipelineTableHead) {
    const metricHeaderCells = isDefaultProject
      ? `
        ${passFilterHeader('Filter 3', 'filter3', 'filter3')}
        ${focusFilterHeader('In-vivo', 'inVivo', 'inVivo')}
        ${focusFilterHeader('In-vitro', 'inVitro', 'inVitro')}
        ${focusFilterHeader('ADMET', 'admet', 'admet')}
        ${focusFilterHeader('D·Link', 'diseaseLinkage', 'diseaseLinkage')}
      `
      : metricColumns.map((column) => plainHeader(column.label, `metric:${column.id}`, 'extra-column-head')).join('');
    const shortlistingGroupColspan = (isDefaultProject ? 5 : metricColumns.length) + 2;
    elements.pipelineTableHead.innerHTML = `
      <tr id="pipelineHeaderRow" class="pipeline-group-row focus-pipeline-group-row">
        <th class="select-col" rowspan="2" ${columnAttrs('select')}>
          <input id="selectPageRows" type="checkbox" aria-label="현재 페이지 전체 선택" />
        </th>
        ${sortableHeader('Company', 'company', 'company', 'rowspan="2"')}
        ${sortableHeader('Location', 'country', 'country', 'rowspan="2"')}
        ${sortableHeader('Asset', 'asset', 'asset', 'rowspan="2"')}
        ${sortableHeader('Modality', 'modality', 'modality', 'rowspan="2"')}
        ${sortableHeader('Target', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Main indication', 'mainIndication', 'mainIndication', 'rowspan="2"')}
        ${sortableHeader('Pipeline Stage', 'stage', 'stage', 'rowspan="2"')}
        <th class="score-group-head focus-group-head" colspan="2">Advanced Research</th>
        <th class="score-group-head focus-group-head" colspan="${shortlistingGroupColspan}">Custom Review</th>
        <th class="score-group-head focus-group-head score-grandtotal-col" rowspan="2" ${columnAttrs('totalScore30')}>
          <button data-sort="totalScore30" data-sort-label="Total Score" type="button">Total<br />Score</button>${resizeHandle('totalScore30')}
        </th>
        ${plainHeader('관리', 'focusManage', 'focus-action-head', 'rowspan="2"')}
      </tr>
      <tr class="pipeline-score-row focus-column-label-row">
        ${focusFilterHeader('Filter 2', 'filter2', 'filter2', 'focusPriority')}
        ${scoreFilterHeader('Score', 'focusTotalScore', 'totalScore', 'totalScore', 'score-subtotal-col')}
        ${metricHeaderCells}
        ${sortableHeader('Action date', 'focusDueDate', 'focusDueDate')}
        ${sortableHeader('Score', 'customScore', 'customScore', 'class="score-subtotal-col"')}
      </tr>
    `;
    elements.pipelineHeaderRow = document.querySelector('#pipelineHeaderRow');
    elements.selectPageRows = document.querySelector('#selectPageRows');
  }

  elements.tableCount.textContent = `검색 결과 ${uniqueAssetCount(visibleRows)} / 전체 ${uniqueAssetCount(allModeRows)} assets`;
  if (elements.exportExcelButton) elements.exportExcelButton.disabled = visibleRows.length === 0;
  elements.pipelineTable.innerHTML = pageRows.length
    ? pageRows.map((row) => {
        const isSelected = state.selectedIds.has(row.id);
        const checked = isSelected ? 'checked' : '';
        const metricCells = isDefaultProject
          ? `
          <td class="focus-status-cell">${partnershipEditSelect(row)}</td>
          <td class="focus-status-cell">${evidenceEditSelect(row, 'inVivoStatus', 'inVivoSource', 'In-vivo efficacy')}</td>
          <td class="focus-status-cell">${evidenceEditSelect(row, 'inVitroStatus', 'inVitroSource', 'In-vitro efficacy')}</td>
          <td class="focus-status-cell">${admetEditSelect(row)}</td>
          <td class="focus-status-cell disease-linkage-cell">${diseaseLinkageEditSelect(row)}</td>
          `
          : metricColumns.map((column) => `<td class="focus-status-cell">${shortlistingMetricEditControl(row, column)}</td>`).join('');
        return `
        <tr class="clickable-row focus-management-row${isSelected ? ' selected-row' : ''}" data-record-id="${escapeHtml(row.id)}" title="${escapeHtml(rowHoverTitle(row))}">
          <td class="select-col">
            <input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} 선택" ${checked} />
          </td>
          <td class="company-cell">${focusOfficialFieldValue(row, row.company, 'Company')}</td>
          <td class="country-cell">${focusOfficialFieldValue(row, row.countryRaw || row.country, 'Location', { html: countryDisplayMarkup(row.countryRaw || row.country) })}</td>
          <td class="asset-cell">${focusOfficialFieldValue(row, row.asset, 'Asset', { html: `<strong>${escapeHtml(row.asset)}</strong>` })}</td>
          <td
            class="modality-column-cell"
            tabindex="0"
            data-target-context
            data-theme="${escapeHtml(row.theme)}"
            data-cluster="${escapeHtml(row.cluster)}"
            data-description="${escapeHtml(row.targetDescription)}"
            aria-label="${escapeHtml(`${row.modality}. Theme ${row.theme}. Cluster ${row.cluster}. Description ${row.targetDescription}`)}"
          >
            ${focusOfficialFieldValue(row, row.modality, 'Modality', { className: 'single-line-cell', title: modalityFullHoverTitle(row) })}
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
            ${focusOfficialFieldValue(row, row.target, 'Target', { className: 'target-single-line' })}
            <span class="target-context-indicator" aria-hidden="true">i</span>
          </td>
          <td class="indication-cell">${focusOfficialFieldValue(row, indicationDisplay(row), 'Main indication', { title: indicationFullHoverTitle(row) })}</td>
          <td class="stage-cell">${focusOfficialFieldValue(row, row.stage, 'Pipeline Stage', { title: pipelineStageFullHoverTitle(row) })}</td>
          <td class="filter-cell">${statusEditSelect(row, 'filter2')}</td>
          <td class="score-cell total-score-cell score-subtotal-col">${totalScoreEditCircle(row)}</td>
          ${metricCells}
          ${actionDateCell(row)}
          <td class="score-cell total-score-cell score-subtotal-col">${customScoreCircle(row)}</td>
          <td class="score-cell total-score-cell score-grandtotal-col">${shortlistingTotalScoreBadge(row)}</td>
          <td class="focus-action-cell">${focusRowActions(row)}</td>
        </tr>
      `;
      }).join('')
    : `
      <tr>
        <td colspan="${columnCount}" class="empty-cell focus-empty-state">
          <strong>${allModeRows.length ? '현재 조건에 맞는 Custom Review asset이 없습니다.' : '아직 Custom Review에 추가된 약물이 없습니다.'}</strong>
          <span>${allModeRows.length ? '필터를 조정하거나 초기화해 주세요.' : 'TAB2 Advanced Research의 오른쪽 ‘즐겨찾기’ 버튼으로 관리 대상을 추가하세요.'}</span>
        </td>
      </tr>
    `;

  updatePipelinePagination(pageCount);
  updateSelectionControls(pageRows);
  updateFrozenColumnOffsets();
  updateSortIndicators();
  refreshPipelineHeaderFreeze();
  void scheduleDiseaseLinkageClassification(pageRows);
}

function renderTable() {
  updateHeaderRecordCount();
  hideTargetContextTooltip();
  fitColumnWidthsToTable();
  const mode = activeTableMode();
  elements.pipelineTable
    ?.closest('.table-wrap')
    ?.classList.toggle('focus-management-table-wrap', mode === 'focus');
  renderShortlistingProjectControl();
  if (mode === 'focus') {
    renderFocusTable();
    return;
  }
  if (elements.deleteSelectedButton) elements.deleteSelectedButton.hidden = false;
  if (elements.columnSettingsButton) elements.columnSettingsButton.hidden = false;

  const visibleRows = getVisibleRows();
  const allModeRows = state.rows.filter(rowMatchesActiveTableMode);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  const extraColumns = selectedExtraColumns();
  const filterKey = activeFilterKey();
  const filterLabel = activeFilterLabel();
  const scoreColumns = activeScoreColumnKeys();
  const modeLabel = mode === 'triage' ? 'Simple Research' : 'Advanced Research';
  const scoreLabels = {
    targetScore: 'TAR',
    moaScore: 'MoA',
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
      ${mode === 'triage' ? `<col class="pipeline-col-focus-action" data-col-key="rubricAction" style="${columnWidthStyle('rubricAction')}" />` : ''}
      ${extraColumns.map((column) => `<col class="pipeline-col-extra" data-col-key="${escapeHtml(extraColumnKey(column))}" style="${columnWidthStyle(extraColumnKey(column))}" />`).join('')}
      ${mode === 'full' ? `<col class="pipeline-col-focus-action" data-col-key="focusAction" style="${columnWidthStyle('focusAction')}" />` : ''}
    `;
  }

  const tableElement = elements.pipelineTable?.closest('table');
  if (tableElement) {
    tableElement.classList.remove('focus-management-table');
    tableElement.classList.toggle('triage-table', mode === 'triage');
    tableElement.style.minWidth = `${visibleTableWidth(extraColumns)}px`;
  }

  if (elements.pipelineTableHead) {
    elements.pipelineTableHead.innerHTML = `
      <tr id="pipelineHeaderRow" class="pipeline-group-row">
        <th class="select-col" rowspan="2" ${columnAttrs('select')}>
          <input id="selectPageRows" type="checkbox" aria-label="Select visible page rows" />
        </th>
        ${sortableHeader('Company', 'company', 'company', 'rowspan="2"')}
        ${sortableHeader('Location', 'country', 'country', 'rowspan="2"')}
        ${sortableHeader('Asset', 'asset', 'asset', 'rowspan="2"')}
        ${sortableHeader('Modality', 'modality', 'modality', 'rowspan="2"')}
        ${sortableHeader('Target', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Main indication', 'mainIndication', 'mainIndication', 'rowspan="2"')}
        ${sortableHeader('Pipeline Stage', 'stage', 'stage', 'rowspan="2"')}
        ${passFilterHeader(filterLabel, filterKey, filterKey, 'rowspan="2"')}
        ${mode === 'triage'
          ? '<th class="score-group-head" colspan="3">Simple Research</th>'
          : '<th class="score-group-head" colspan="3">Simple Research</th><th class="score-group-head" colspan="5">Advanced Research only</th>'}
        ${mode === 'triage' ? plainHeader('재평가', 'rubricAction', 'focus-action-head', 'rowspan="2"') : ''}
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ''}
        ${mode === 'full' ? plainHeader('관리', 'focusAction', 'focus-action-head', 'rowspan="2"') : ''}
      </tr>
      <tr class="pipeline-score-row">
        ${scoreColumns.map((key) => scoreFilterHeader(scoreLabels[key] || key, key, key)).join('')}
        ${extraColumns.map((column) => plainHeader(column.label, extraColumnKey(column), 'extra-column-head')).join('')}
      </tr>
    `;
    elements.pipelineHeaderRow = document.querySelector('#pipelineHeaderRow');
    elements.selectPageRows = document.querySelector('#selectPageRows');
  }

  elements.tableCount.textContent = `검색 결과 ${uniqueAssetCount(visibleRows)} / 전체 ${uniqueAssetCount(allModeRows)} assets`;
  if (elements.exportExcelButton) elements.exportExcelButton.disabled = visibleRows.length === 0;
  elements.pipelineTable.innerHTML = pageRows.length
    ? pageRows
        .map((row) => {
          const isSelected = state.selectedIds.has(row.id);
          const checked = isSelected ? 'checked' : '';
          const rowTitle = mode === 'triage' ? triageRowHoverTitle(row) : rowHoverTitle(row);
          return `
            <tr
              class="clickable-row${mode === 'triage' ? ' triage-preview-row' : ''}${isSelected ? ' selected-row' : ''}"
              data-record-id="${escapeHtml(row.id)}"
              ${row.isVirtualTriage ? 'data-full-scout-alias="true"' : ''}
              ${mode === 'triage' ? `title="${escapeHtml(rowTitle)}"` : ''}
            >
              <td class="select-col">${row.isVirtualTriage ? '' : `<input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} select" ${checked} />`}</td>
              <td class="company-cell">${tableTextEditValue(row, 'company', row.company)}</td>
              <td class="country-cell">${countryEditValue(row)}</td>
              <td class="asset-cell">${tableTextEditValue(row, 'asset', row.asset, { strong: true })}</td>
              <td
                class="modality-column-cell"
                tabindex="0"
                data-target-context
                data-theme="${escapeHtml(row.theme)}"
                data-cluster="${escapeHtml(row.cluster)}"
                data-description="${escapeHtml(row.targetDescription)}"
                aria-label="${escapeHtml(`${row.modality}. Theme ${row.theme}. Cluster ${row.cluster}. Description ${row.targetDescription}`)}"
              >
                ${modalityEditValue(row)}
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
                ${tableTextEditValue(row, 'target', row.target, { className: 'target-single-line' })}
                <span class="target-context-indicator" aria-hidden="true">i</span>
              </td>
              <td class="indication-cell">${tableTextEditValue(row, 'main_indication', row.mainIndication, { title: indicationFullHoverTitle(row) })}</td>
              <td class="stage-cell" title="${escapeHtml(pipelineStageFullHoverTitle(row))}">${stageEditSelect(row)}</td>
              <td class="filter-cell">${statusEditSelect(row, filterKey)}</td>
              <td class="score-cell">${mode === 'full' || mode === 'triage'
                ? scoreEditSelect(row, 'targetScore', 'target_relevance', 'Target Area Relevance')
                : scoreBadge(row.targetScore, 3, scoreTooltip('Target Area Relevance', row.criteria.target, 3))}</td>
              <td class="score-cell">${mode === 'full' || mode === 'triage'
                ? scoreEditSelect(row, 'moaScore', 'moa_validity', 'MOA Validity')
                : scoreBadge(row.moaScore, 3, scoreTooltip('MOA Validity', row.criteria.moa, 3))}</td>
              <td class="score-cell">${mode === 'full' || mode === 'triage'
                ? scoreEditSelect(row, 'dataScore', 'data_maturity', 'Data Maturity')
                : scoreBadge(row.dataScore, 3, scoreTooltip('Data Maturity', row.criteria.data, 3))}</td>
              ${mode === 'full' ? `
                <td class="score-cell">${scoreEditSelect(row, 'competitiveScore', 'competitive_landscape', 'Competitive Landscape')}</td>
                <td class="score-cell">${scoreEditSelect(row, 'platformScore', 'platform_attractiveness', 'Platform Attractiveness')}</td>
                <td class="score-cell">${scoreEditSelect(row, 'expansionScore', 'expansion_potential', 'Expansion Potential')}</td>
                <td class="score-cell">${scoreEditSelect(row, 'marketScore', 'marketability', 'Marketability')}</td>
                <td class="score-cell total-score-cell">${totalScoreEditCircle(row)}</td>
              ` : ''}
              ${mode === 'triage' ? `<td class="focus-action-cell">${rubricReevaluationCell(row)}</td>` : ''}
              ${extraColumns.map((column) => {
                const value = formatExtraColumnValue(get(row.raw, column.path, '-'), column);
                return `<td class="extra-column-cell" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
              }).join('')}
              ${mode === 'full' ? `<td class="focus-action-cell">${fullScoutRowActions(row)}</td>` : ''}
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="${10 + scoreColumns.length + extraColumns.length}" class="empty-cell">현재 조건에 맞는 ${modeLabel} asset이 없습니다. 필터를 조정하거나 초기화해 주세요.</td></tr>`;

  updatePipelinePagination(pageCount);
  updateSelectionControls(pageRows);
  updateFrozenColumnOffsets();
  updateSortIndicators();
  refreshPipelineHeaderFreeze();
}

function updateSelectionControls(pageRows = null) {
  const visibleRows = (pageRows || getVisibleRows().slice((state.page - 1) * state.pageSize, state.page * state.pageSize))
    .filter((row) => !row.isVirtualTriage);
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

function applyPipelineDragSelection(id) {
  if (!pipelineDragSelection || !id || pipelineDragSelection.visitedIds.has(id)) return;
  pipelineDragSelection.visitedIds.add(id);
  if (pipelineDragSelection.shouldSelect) {
    state.selectedIds.add(id);
  } else {
    state.selectedIds.delete(id);
  }
  const checkbox = elements.pipelineTable.querySelector(`.row-select[data-record-id="${CSS.escape(id)}"]`);
  if (checkbox) {
    checkbox.checked = pipelineDragSelection.shouldSelect;
    checkbox.closest('tr')?.classList.toggle('selected-row', pipelineDragSelection.shouldSelect);
    // A checkbox still fires its native click/change after pointerdown's
    // preventDefault(), flipping `checked` back before `change` sees it.
    // Flag this element so the change handler below skips its own
    // (stale, would-cancel-this-toggle) update for this interaction.
    checkbox.dataset.pointerHandled = 'true';
  }
  updateSelectionControls();
}

function endPipelineDragSelection() {
  if (!pipelineDragSelection) return;
  const visitedIds = pipelineDragSelection.visitedIds;
  pipelineDragSelection = null;
  elements.pipelineTable.classList.remove('is-selection-dragging');
  // Native checkbox click/change events follow pointerup. Keep the guard for
  // that event sequence, then clear it before the next user interaction.
  window.setTimeout(() => {
    elements.pipelineTable.querySelectorAll('.row-select').forEach((checkbox) => {
      if (visitedIds.has(checkbox.dataset.recordId)) delete checkbox.dataset.pointerHandled;
    });
  }, 0);
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

function currentDisplayedTabMode() {
  if (elements.knowledgeMapPanel && !elements.knowledgeMapPanel.hidden) return 'map';
  if (elements.step0Panel && !elements.step0Panel.hidden) return 'step0';
  return activeTableMode();
}

function syncKnowledgeMapTabState(isActive = currentDisplayedTabMode() === 'map') {
  elements.knowledgeMapTab?.classList.toggle('active', isActive);
  elements.knowledgeMapTab?.setAttribute('aria-selected', isActive ? 'true' : 'false');
}

function renderTableTabs() {
  if (elements.focusTabCount) {
    elements.focusTabCount.textContent = String(state.rows.filter((row) => !row.isTriage && row.focusTracked).length);
  }
  elements.pipelineTableTabs?.forEach((tab) => {
    const isActive = tab.dataset.tableMode === currentDisplayedTabMode();
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
  });
  syncKnowledgeMapTabState();
  renderAgentIdentity();
}

function renderAgentIdentity() {
  // The All Pipelines Agent is a workspace-level tool, so its launcher stays
  // available in the same place across Listing, Fast Triage, Full Scout, and Shortlisting.
  const isAvailable = true;
  const title = 'All Pipelines Agent';
  if (elements.aiDrawerButton) {
    elements.aiDrawerButton.hidden = !isAvailable;
    elements.aiDrawerButton.setAttribute('aria-hidden', String(!isAvailable));
  }
  if (!isAvailable) {
    if (elements.aiDrawer?.classList.contains('open')) floatingAgentController?.close();
    if (elements.aiDrawer) {
      elements.aiDrawer.classList.remove('open', 'is-minimized');
      elements.aiDrawer.hidden = true;
      elements.aiDrawer.setAttribute('aria-hidden', 'true');
    }
    closeAgentResponseModal();
  }
  if (elements.aiDrawerTitle) elements.aiDrawerTitle.textContent = title;
  if (elements.aiDrawer) elements.aiDrawer.setAttribute('aria-label', title);
}

function activeFilterCount() {
  return [
    state.query.trim(),
    (state.searchTokens || []).length,
    hasSelectedFilterValues(state.modality),
    hasSelectedFilterValues(state.theme),
    hasSelectedFilterValues(state.cluster),
    hasSelectedFilterValues(state.country),
    hasSelectedFilterValues(state.indication),
    hasSelectedFilterValues(state.stage),
    hasSelectedFilterValues(state.pass),
    ...Object.keys(SCORE_HEADER_FILTERS).map((key) => scoreFilterSelections(key).length > 0),
    ...Object.keys(FOCUS_HEADER_FILTERS).map((key) => focusFilterSelections(key).length > 0)
  ].filter(Boolean).length;
}

function activeSummaryFilterCount() {
  return [
    hasSelectedFilterValues(state.modality),
    hasSelectedFilterValues(state.theme),
    hasSelectedFilterValues(state.cluster),
    hasSelectedFilterValues(state.country),
    hasSelectedFilterValues(state.indication),
    hasSelectedFilterValues(state.stage),
    hasSelectedFilterValues(state.pass),
    ...Object.keys(SCORE_HEADER_FILTERS).map((key) => scoreFilterSelections(key).length > 0),
    ...Object.keys(FOCUS_HEADER_FILTERS).map((key) => focusFilterSelections(key).length > 0)
  ].filter(Boolean).length;
}

function renderFilterSummary() {
  const count = activeFilterCount();
  if (elements.resetFiltersButton) elements.resetFiltersButton.disabled = count === 0;
}

function renderFilteredDashboard() {
  renderFilterSummary();
  renderMetrics();
  renderCharts();
  renderTable();
}

function render() {
  if (elements.pageSizeSelect) elements.pageSizeSelect.value = String(state.pageSize);
  renderTableTabs();
  renderFilterSummary();
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
  const sources = (Array.isArray(item.evidenceSources) ? item.evidenceSources : [])
    .map((source) => source && typeof source === 'object'
      ? `${source.source_title || ''}${source.source_url ? ` ${source.source_url}` : ''}`.trim()
      : String(source || '').trim())
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
    (Array.isArray(item.keyJudgmentFactors) ? item.keyJudgmentFactors : []).join(' | '),
    item.supportingEvidenceSummary || '',
    (Array.isArray(item.conflictingOrMissingEvidence) ? item.conflictingOrMissingEvidence : []).join(' | '),
    item.confidence || '',
    sources
  ];
}

function exportPipelineTable() {
  const rows = getVisibleRows();
  const extraColumns = selectedExtraColumns();
  const headers = [
    'Company',
    'Location',
    'Asset',
    'Target',
    'Theme',
    'Cluster',
    'Main Indication',
    'Pipeline Stage',
    'Indication',
    'Modality',
    'Filter 1',
    'Filter 2',
    'Filter 3',
    'Filter 3 Source',
    'In-vivo',
    'In-vitro',
    'ADMET Completed',
    'Action Date',
    'Target Area Relevance Score',
    'Target Area Relevance Evidence Type',
    'Target Area Relevance Evidence Type Reason',
    'Target Area Relevance Rule',
    'Target Area Relevance Rule Label',
    'Target Area Relevance Applied Criteria',
    'Target Area Relevance Reason',
    'Target Area Relevance Why Not Higher',
    'Target Area Relevance Decision Summary',
    'Target Area Relevance Key Factors',
    'Target Area Relevance Evidence Summary',
    'Target Area Relevance Missing Evidence',
    'Target Area Relevance Confidence',
    'Target Area Relevance Sources',
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
    'Direct Competitor Count',
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
    row.filter3,
    row.filter3Source,
    row.inVivoStatus,
    row.inVitroStatus,
    row.admetCompleted ?? '',
    row.focusDueDate,
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
    ...extraColumns.map((column) => formatExtraColumnValue(get(row.raw, column.path, '-'), column))
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
  updateHeaderRecordCount();
}

function setStep0SummaryLoading(isLoading) {
  const dashboard = elements.step0SummaryDashboard;
  if (!dashboard) return;
  dashboard.classList.toggle('is-loading', isLoading);
  dashboard.setAttribute('aria-busy', String(isLoading));
}

// Separate from setStep0SummaryLoading: that one also dims the workflow-card-canvas
// graph, which genuinely does need the full progress table. The stat numbers
// themselves can go visible as soon as ANY source has them — a cached value or the
// fast stats-only endpoint — well before that full fetch finishes.
function setStep0StatsLoading(isLoading) {
  elements.step0SummaryDashboard?.classList.toggle('is-stats-loading', isLoading);
}

// Jumps the Pipeline Table to whichever page currently contains recordId (its
// sort position can move after a rubric re-score or a data refresh) and gives
// the row a brief, soft highlight so the user can find it again without
// re-scanning the whole table. Returns false if the row isn't visible under
// the current filters.
function scrollAndHighlightPipelineRow(recordId) {
  if (!recordId) return false;
  const visibleRows = getVisibleRows();
  const rowIndex = visibleRows.findIndex((row) => row.id === recordId);
  if (rowIndex === -1) return false;
  const targetPage = Math.floor(rowIndex / state.pageSize) + 1;
  if (state.page !== targetPage) {
    state.page = targetPage;
    renderTable();
  }
  const rowElement = elements.pipelineTable?.querySelector(`tr[data-record-id="${CSS.escape(recordId)}"]`);
  if (!rowElement) return false;
  rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  rowElement.classList.remove('pipeline-row-return-highlight');
  // Force reflow so re-adding the class restarts the fade if it's still running
  // (e.g. two rescores of the same row in quick succession).
  void rowElement.offsetWidth;
  rowElement.classList.add('pipeline-row-return-highlight');
  window.setTimeout(() => rowElement.classList.remove('pipeline-row-return-highlight'), PIPELINE_ROW_HIGHLIGHT_MS);
  return true;
}

// Pairs with the sessionStorage write in the Pipeline Table row click handler:
// when a row is opened into its detail page, we remember which record and
// which tab it was opened from so that coming back via the detail page's
// "Fast Triage 목록" / "Full Scout" link lands on the same page and row
// instead of resetting to page 1.
function restorePendingPipelineReturnFocus() {
  let target;
  try {
    target = JSON.parse(sessionStorage.getItem(PIPELINE_RETURN_FOCUS_STORAGE_KEY) || 'null');
  } catch {
    target = null;
  }
  sessionStorage.removeItem(PIPELINE_RETURN_FOCUS_STORAGE_KEY);
  const recordId = String(target?.recordId || '').trim();
  const mode = String(target?.mode || '').trim();
  if (!recordId || !mode) return;
  if (mode !== activeTableMode()) setTableMode(mode);
  window.requestAnimationFrame(() => scrollAndHighlightPipelineRow(recordId));
}

async function loadRecords({ signal } = {}) {
  elements.dataStatus.textContent = 'Loading';
  try {
    // The Summary Dashboard's KPI cards/donuts only need refreshDashboardSummary's
    // (small, fast) response, not the full records list below — paint them the moment
    // it resolves instead of waiting on whichever of the two happens to be slower.
    const summaryPromise = refreshDashboardSummary(signal).then((ok) => {
      if (ok) {
        renderMetrics();
        renderCharts();
      }
    });
    const synonymsPromise = loadCategorySynonyms(signal);
    const shortlistingProjectsPromise = loadShortlistingProjects(signal).then(() => {
      renderShortlistingProjectControl();
    });
    const [response] = await Promise.all([
      fetch(API_URL, { cache: 'no-store', signal }),
      summaryPromise,
      synonymsPromise,
      shortlistingProjectsPromise
    ]);
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    state.latestOiPartnershipCriteriaVersion = String(
      data.oi_partnership_criteria_version || state.latestOiPartnershipCriteriaVersion
    );
    state.rawRecords = Array.isArray(data.records) ? data.records : [];
    state.rows = buildDashboardRows(state.rawRecords);
    const availableIds = new Set(state.rows.map((row) => row.id));
    state.selectedIds = new Set([...state.selectedIds].filter((id) => availableIds.has(id)));
    state.page = 1;
    renderFilters();
    render();
    restorePendingPipelineReturnFocus();
    elements.agentContextCount.textContent = `${state.rows.length} pipelines`;
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') return;
    throw error;
  }
}

async function saveManualReviewEdit(select) {
  const recordId = select.dataset.recordId;
  const kind = select.dataset.editKind;
  const previousValue = select.dataset.previousValue;
  if (kind === 'country' && String(select.value || '').trim() === String(previousValue || '').trim()) {
    renderTable();
    return;
  }
  if (kind === 'total_score' && select.value.trim() === '') {
    select.value = previousValue;
    elements.dataStatus.textContent = 'Total Score는 0~21 정수로 입력해주세요';
    return;
  }
  const value = ['score', 'total_score'].includes(kind) ? Number(select.value) : select.value;
  if (!recordId || !['status', 'score', 'total_score', 'modality', 'stage', 'country', 'target'].includes(kind)) return;
  const actorName = await ensureDashboardActorName();
  if (!actorName) {
    select.value = previousValue;
    elements.dataStatus.textContent = '로그인 사용자 정보를 확인할 수 없어 변경하지 않았습니다';
    return;
  }

  const payload = {
    kind,
    value,
    previous_value: ['score', 'total_score'].includes(kind) && previousValue !== ''
      ? Number(previousValue)
      : previousValue
  };
  if (kind === 'score') payload.criterion = select.dataset.criterion;

  select.disabled = true;
  select.classList.add('is-saving');
  elements.dataStatus.textContent = 'Saving human review';

  try {
    const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/manual-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);

    if (data.record) replaceRecordFromApi(recordId, data.record);
    await refreshDashboardSummary();
    renderFilters();
    render();
    updateHeaderRecordCount();
    if (kind === 'score') {
      const updates = Array.isArray(data.derived_score_updates) ? data.derived_score_updates : [];
      const synchronized = updates.map((item) => item.label || (item.field === 'total_score' ? 'Total Score' : 'Filter 1/2')).join(' · ');
      const row = state.rows.find((item) => item.id === recordId);
      const filterLabel = row?.isTriage ? 'FILTER 1' : 'FILTER 2';
      const message = synchronized
        ? `수동 점수 변경에 따라 ${synchronized}을(를) 자동 동기화하고 변경 이력에 기록했습니다.`
        : '수동 점수 변경을 변경 이력에 기록했습니다.';
      elements.dataStatus.textContent = message;
      void showRubricRefreshOutcomeToast('수동 점수를 반영했습니다', message, filterLabel);
    }
  } catch (error) {
    select.value = previousValue;
    select.disabled = false;
    select.classList.remove('is-saving');
    elements.dataStatus.textContent = `Human review save failed: ${error.message}`;
  }
}

async function saveManualTableTextEdit(input) {
  const recordId = input?.dataset.recordId;
  const kind = input?.dataset.editKind;
  const previousValue = String(input?.dataset.previousValue || '').trim();
  const value = String(input?.value || '').trim();
  if (!recordId || !['company', 'asset', 'main_indication', 'target'].includes(kind)) return;
  if (!value || value === previousValue) {
    renderTable();
    return;
  }
  if (value.length > 250) {
    elements.dataStatus.textContent = 'Company, Asset, Target, and Main indication must be 250 characters or fewer.';
    input.focus();
    return;
  }

  const actorName = await ensureDashboardActorName();
  if (!actorName) {
    renderTable();
    return;
  }

  input.dataset.saving = 'true';
  input.disabled = true;
  input.classList.add('is-saving');
  elements.dataStatus.textContent = 'Saving human review';
  try {
    const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/manual-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, value, previous_value: previousValue })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    replaceRecordFromApi(recordId, data.record);
    await refreshDashboardSummary();
    renderFilters();
    render();
    updateHeaderRecordCount();
  } catch (error) {
    input.disabled = false;
    input.dataset.saving = '';
    input.classList.remove('is-saving');
    elements.dataStatus.textContent = `Human review save failed: ${error.message}`;
    input.focus();
  }
}

function openManualTableTextEdit(anchor) {
  if (!anchor || !getCurrentUser()?.is_admin || anchor.dataset.editing === 'true') return;
  const recordId = anchor.dataset.recordId;
  const kind = anchor.dataset.editKind;
  const previousValue = String(anchor.dataset.previousValue || '').trim();
  if (!recordId || !['company', 'asset', 'main_indication', 'target'].includes(kind)) return;

  anchor.dataset.editing = 'true';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 250;
  input.className = 'table-manual-text-input';
  input.value = previousValue;
  input.dataset.recordId = recordId;
  input.dataset.editKind = kind;
  input.dataset.previousValue = previousValue;
  input.setAttribute('aria-label', `${kind} edit`);
  input.title = kind === 'main_indication'
    ? 'Enter a dashboard indication or Unknown.'
    : 'Press Enter to save or Escape to cancel.';
  anchor.replaceWith(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveManualTableTextEdit(input);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      input.dataset.cancelled = 'true';
      renderTable();
    }
  });
  input.addEventListener('blur', () => {
    if (input.dataset.saving === 'true' || input.dataset.cancelled === 'true') return;
    saveManualTableTextEdit(input);
  }, { once: true });
}

function openManualTableModalityEdit(anchor) {
  if (!anchor || !getCurrentUser()?.is_admin || anchor.dataset.editing === 'true') return;
  const recordId = anchor.dataset.recordId;
  const previousValue = String(anchor.dataset.previousValue || '').trim();
  if (!recordId || previousValue !== 'Unknown') return;

  anchor.dataset.editing = 'true';
  const select = document.createElement('select');
  select.className = 'table-edit-select stage-edit table-manual-modality-select';
  select.dataset.recordId = recordId;
  select.dataset.editKind = 'modality';
  select.dataset.previousValue = previousValue;
  select.setAttribute('aria-label', 'Modality select');
  select.innerHTML = CANONICAL_MODALITIES.map((value) => selectOption(value, previousValue)).join('');
  anchor.replaceWith(select);
  select.focus();

  select.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    select.dataset.cancelled = 'true';
    renderTable();
  });
  select.addEventListener('blur', () => {
    if (select.classList.contains('is-saving') || select.dataset.cancelled === 'true') return;
    renderTable();
  }, { once: true });
}

function openManualTableStageEdit(anchor) {
  if (!anchor || !getCurrentUser()?.is_admin || anchor.dataset.editing === 'true') return;
  const recordId = anchor.dataset.recordId;
  const previousValue = String(anchor.dataset.previousValue || '').trim();
  if (!recordId) return;

  anchor.dataset.editing = 'true';
  const select = document.createElement('select');
  select.className = 'table-edit-select stage-edit';
  select.dataset.recordId = recordId;
  select.dataset.editKind = 'stage';
  select.dataset.previousValue = previousValue;
  select.setAttribute('aria-label', 'Pipeline Stage select');
  select.innerHTML = CANONICAL_DEVELOPMENT_STAGES.map((stage) => selectOption(stage, previousValue, stage)).join('');
  anchor.replaceWith(select);
  select.focus();

  select.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    select.dataset.cancelled = 'true';
    renderTable();
  });
  select.addEventListener('blur', () => {
    if (select.classList.contains('is-saving') || select.dataset.cancelled === 'true') return;
    renderTable();
  }, { once: true });
}

async function saveUnknownTargetEdit(anchor) {
  const recordId = anchor?.dataset.recordId;
  const previousValue = String(anchor?.textContent || '').trim();
  if (!recordId || previousValue !== 'Unknown' || !getCurrentUser()?.is_admin) return;

  const value = window.prompt('Target 이름을 입력하세요.', '');
  const nextValue = String(value || '').trim();
  if (!nextValue) return;
  if (nextValue.length > 250) {
    elements.dataStatus.textContent = 'Target은 250자 이하로 입력하세요.';
    return;
  }

  const actorName = await ensureDashboardActorName();
  if (!actorName) return;
  anchor.classList.add('is-saving');
  elements.dataStatus.textContent = 'Target human review 저장 중';
  try {
    const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/manual-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'target', value: nextValue, previous_value: previousValue })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    replaceRecordFromApi(recordId, data.record);
    await refreshDashboardSummary();
    renderFilters();
    render();
    updateHeaderRecordCount();
  } catch (error) {
    elements.dataStatus.textContent = `Target 저장 실패: ${error.message}`;
    anchor.classList.remove('is-saving');
  }
}

function replaceRecordFromApi(recordId, record) {
  if (!record) return false;
  // `state.rows` can contain a Full Scout-derived, read-only Fast Triage
  // alias and therefore does not share the persisted-record array's indexes.
  // Always replace by the stable record ID, never the rendered table index.
  const rawIndex = state.rawRecords.findIndex((candidate, index) =>
    recordIdentifier(candidate, index) === recordId
  );
  if (rawIndex < 0) return false;
  state.rawRecords[rawIndex] = record;
  state.rows = buildDashboardRows(state.rawRecords);
  state.dashboardSummary = null;
  return true;
}

const diseaseLinkageInFlight = new Set();

// Shortlisting-only, background, no blocking modal: each call classifies one small
// investigation_note field (a few hundred tokens in, a single verdict out), so it is cheap
// enough to fire quietly per visible row and just fill the badge in once the result lands.
// A row only re-fires when never classified yet, or when a manual MoA Validity score override
// (row.moaScore, which already reflects human_review.overrides) has moved since the cached
// disease_linkage_score_used was recorded — the backend re-checks eligibility and re-classifies
// (or clears the badge) in that case instead of keeping a now-stale cached O/X/NA forever.
async function scheduleDiseaseLinkageClassification(pageRows) {
  const candidates = pageRows.filter((row) =>
    !row.isTriage
    && !row.isVirtualTriage
    && row.diseaseLinkageSource !== 'manual'
    && (row.diseaseLinkageStatus == null || row.diseaseLinkageScoreUsed !== row.moaScore)
    && !diseaseLinkageInFlight.has(row.id)
  );
  if (!candidates.length) return;
  candidates.forEach((row) => diseaseLinkageInFlight.add(row.id));

  const outcomes = await Promise.allSettled(
    candidates.map((row) =>
      fetch(`/api/records/${encodeRecordIdForPath(row.id)}/disease-linkage-classify`, { method: 'POST' })
        .then((response) => response.json().catch(() => ({})))
        .then((data) => ({ id: row.id, data }))
    )
  );

  let anyChanged = false;
  outcomes.forEach((outcome) => {
    if (outcome.status !== 'fulfilled') return;
    const { id, data } = outcome.value;
    diseaseLinkageInFlight.delete(id);
    if (data?.record && replaceRecordFromApi(id, data.record)) anyChanged = true;
  });
  candidates.forEach((row) => diseaseLinkageInFlight.delete(row.id));

  if (anyChanged && activeTableMode() === 'focus') render();
}

async function recalculateLatestRubric(button) {
  const recordId = button?.dataset.recordId;
  if (!recordId) return;
  const user = await requireAuth();
  if (!user?.is_admin && !user?.is_developer) {
    const message = 'Score 기준 갱신은 Developer 또는 관리자 권한이 필요합니다. 로그인한 계정의 권한을 확인해 주세요.';
    elements.dataStatus.textContent = message;
    await showRubricRefreshFailureDialog('Score 기준 갱신을 실행할 수 없습니다', message);
    return;
  }
  const isTriage = button.dataset.reviewType === 'triage';
  const workflowLabel = isTriage ? 'Simple Research' : 'Advanced Research';
  const latestVersion = isTriage ? LATEST_TRIAGE_RUBRIC_VERSION : LATEST_FULL_SCOUT_RUBRIC_VERSION;
  button.disabled = true;
  button.classList.add('is-saving');
  elements.dataStatus.textContent = `${workflowLabel} 지침 v${latestVersion} 재평가 중`;
  let failureShown = false;

  try {
    const data = await runBlockingOperation({
      title: '최신 루브릭으로 재평가 중',
      message: `${workflowLabel} 원문 리포트와 첨부 자료를 기준으로 점수를 다시 계산하고 있습니다.`,
      status: '점수와 판단 근거를 갱신하고 있습니다.'
    }, async (signal) => {
      const response = await fetch(
        `/api/records/${encodeRecordIdForPath(recordId)}/reassess-rubric`,
        { method: 'POST', signal }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result.detail || `HTTP ${response.status}`;
        const failureMessage = `${message}\n\n저장하지 못했으며 기존 점수와 변경 이력은 유지됩니다. 잠시 후 새로고침을 다시 눌러주세요.`;
        failureShown = true;
        await showRubricRefreshFailureDialog('Score 기준 갱신에 실패했습니다', failureMessage);
        throw new Error(message);
      }
      return result;
    });
    if (data === OPERATION_CANCELLED) {
      updateHeaderRecordCount();
      return;
    }
    if (!data.record || ['error', 'conflict'].includes(data.status)) {
      const message = data.message || data.reason || `${workflowLabel} 재평가를 완료하지 못했습니다.`;
      failureShown = true;
      await showRubricRefreshFailureDialog(
        'Score 기준 갱신에 실패했습니다',
        `${message}\n\n저장하지 못했으며 기존 점수와 변경 이력은 유지됩니다. 잠시 후 새로고침을 다시 눌러주세요.`
      );
      throw new Error(message);
    }
    replaceRecordFromApi(recordId, data.record);
    await refreshDashboardSummary();
    renderFilters();
    render();
    scrollAndHighlightPipelineRow(recordId);
    updateHeaderRecordCount();
    const outcome = rubricRefreshOutcomeCopy(data, workflowLabel, latestVersion);
    elements.dataStatus.textContent = outcome.message;
    void showRubricRefreshOutcomeToast(outcome.title, outcome.message, isTriage ? 'FILTER 1' : 'FILTER 2');
  } catch (error) {
    const message = error.message || '예상하지 못한 오류가 발생했습니다.';
    elements.dataStatus.textContent = `${workflowLabel} 재평가 실패: ${message}`;
    if (!failureShown) {
      await showRubricRefreshFailureDialog(
        'Score 기준 갱신에 실패했습니다',
        `${message}\n\n저장하지 못했으며 기존 점수와 변경 이력은 유지됩니다. 잠시 후 새로고침을 다시 눌러주세요.`
      );
    }
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
  }
}

function triageSourceReportText(record) {
  const rawMarkdown = String(get(record, 'source_report.raw_markdown', '') || '').trim();
  if (rawMarkdown) return rawMarkdown;
  const triageWhy = String(get(record, 'triage.why', '') || '').trim();
  if (triageWhy) return triageWhy;
  return 'Fast Triage 조사 내용 없음';
}

async function copyTriageFullScoutPrompt(button) {
  const recordId = button?.dataset.recordId;
  if (!recordId) return;
  const row = state.rows.find((candidate) => candidate.id === recordId && candidate.isTriage);
  if (!row) return;

  button.disabled = true;
  button.classList.add('is-saving');
  elements.dataStatus.textContent = `${row.asset} Advanced Research 지침 복사 중`;

  const buildCopyText = (promptText) => [
    promptText,
    '',
    `Asset name: ${row.asset}`,
    `Company name: ${row.company}`,
    '',
    'Fast Triage researched content:',
    triageSourceReportText(row.raw)
  ].join('\n');

  try {
    const warningsStore = await fetchInstructionWarnings();
    const fullPrompt = appendInstructionWarnings(buildGptInstructionPrompt(), warningsStore.full);
    await navigator.clipboard.writeText(buildCopyText(fullPrompt));
    updateHeaderRecordCount();
  } catch (error) {
    const scratch = document.createElement('textarea');
    scratch.value = buildCopyText(buildGptInstructionPrompt());
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    document.execCommand('copy');
    document.body.removeChild(scratch);
    updateHeaderRecordCount();
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
  }
}

async function recalculateLatestOiPartnership(button) {
  const recordId = button?.dataset.recordId;
  if (!recordId) return;
  const user = await requireAuth();
  if (!user?.is_admin && !user?.is_developer) {
    const message = 'Filter 3 기준 갱신은 Developer 또는 관리자 권한이 필요합니다. 로그인한 계정의 권한을 확인해 주세요.';
    elements.dataStatus.textContent = message;
    await showRubricRefreshFailureDialog('Filter 3 기준 갱신을 실행할 수 없습니다', message);
    return;
  }
  button.disabled = true;
  button.classList.add('is-saving');
  const latestVersion = state.latestOiPartnershipCriteriaVersion;
  elements.dataStatus.textContent = `OI Partnership v${latestVersion} 재분류 중`;

  try {
    const data = await runBlockingOperation({
      title: 'Filter 3 분류를 갱신하고 있습니다',
      message: '현재 Custom Review 판단 기준으로 파이프라인을 다시 분류하고 있습니다.',
      status: 'OI Partnership 결과를 계산하고 있습니다.'
    }, async (signal) => {
      const response = await fetch(
        `/api/records/${encodeRecordIdForPath(recordId)}/recalculate-oi-partnership`,
        { method: 'POST', signal }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result.detail || `HTTP ${response.status}`;
        await showRubricRefreshFailureDialog('Filter 3 기준 갱신에 실패했습니다', message);
        throw new Error(message);
      }
      return result;
    });
    if (data === OPERATION_CANCELLED) {
      updateHeaderRecordCount();
      return;
    }
    replaceRecordFromApi(recordId, data.record);
    renderFilters();
    render();
    updateHeaderRecordCount();
    const appliedVersion = data.oi_partnership_criteria_version || latestVersion;
    const changed = data.changed === true;
    const manualClassificationReset = data.manual_classification_reset === true;
    const oiNoteAction = String(data.oi_note_action || '');
    const oiNoteMessage = oiNoteAction === 'human_note_retained'
      ? '사람이 입력한 OI Note는 그대로 보존했습니다.'
      : oiNoteAction === 'auto_rationale_updated'
        ? '자동 생성 OI rationale도 최신 기준으로 함께 갱신했습니다.'
        : oiNoteAction === 'auto_rationale_current'
          ? '자동 생성 OI rationale도 이미 최신 기준입니다.'
          : '';
    const title = manualClassificationReset
      ? '수동 Filter 3 분류 초기화 완료'
      : changed ? 'Filter 3 기준 갱신 완료' : '이미 최신 Filter 3 기준입니다';
    const message = manualClassificationReset
      ? `수동으로 조정한 Filter 3 분류를 OI Partnership v${appliedVersion} 자동 분류로 초기화했습니다. ${oiNoteMessage} 변경 이력에 기록했습니다.`
      : changed
      ? `OI Partnership v${appliedVersion} 기준으로 분류를 갱신했습니다. ${oiNoteMessage} 변경 사항을 Team Review 변경 이력에 기록했습니다.`
      : `OI Partnership v${appliedVersion} 기준과 현재 분류 결과가 이미 적용되어 있습니다. ${oiNoteMessage} 변경 사항이 없어 변경 이력은 추가하지 않았습니다.`;
    elements.dataStatus.textContent = message;
    void showRubricRefreshOutcomeToast(title, message, 'FILTER 3');
  } catch (error) {
    elements.dataStatus.textContent = `Filter 3 재분류 실패: ${error.message}`;
  } finally {
    button.disabled = false;
    button.classList.remove('is-saving');
  }
}

async function performFocusManagementSave(recordId, payload, control = null) {
  if (!recordId) return false;
  const actorName = await ensureDashboardActorName();
  if (!actorName) {
    elements.dataStatus.textContent = '로그인 사용자 정보를 확인할 수 없어 변경하지 않았습니다';
    return false;
  }
  if (!payload.actor_name) payload = { ...payload, actor_name: actorName };
  if (control) {
    control.disabled = true;
    control.classList.add('is-saving');
  }
  elements.dataStatus.textContent = 'Saving TAB3';

  try {
    const response = await fetch(`/api/records/${encodeRecordIdForPath(recordId)}/focus-management`, {
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
        renderFilters();
      }
      renderTableTabs();
      renderTable();
    } else {
      renderFilters();
      render();
    }
    updateHeaderRecordCount();
    return true;
  } catch (error) {
    if (control) {
      control.disabled = false;
      control.classList.remove('is-saving');
      if ('value' in control && control.dataset.previousValue !== undefined) {
        control.value = control.dataset.previousValue;
      }
    }
    renderTable();
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

async function performShortlistingProjectSave(recordId, projectId, payload, control = null) {
  if (!recordId || !projectId) return false;
  const actorName = await ensureDashboardActorName();
  if (!actorName) {
    elements.dataStatus.textContent = '로그인 사용자 정보를 확인할 수 없어 변경하지 않았습니다';
    return false;
  }
  if (!payload.actor_name) payload = { ...payload, actor_name: actorName };
  if (control) {
    control.disabled = true;
    control.classList.add('is-saving');
  }
  elements.dataStatus.textContent = 'Saving Custom Review Project';

  try {
    const response = await fetch(
      `/api/records/${encodeRecordIdForPath(recordId)}/shortlisting-projects/${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    replaceRecordFromApi(recordId, data.record);
    if (payload.action === 'update') {
      if (control) {
        control.disabled = false;
        control.classList.remove('is-saving');
        control.dataset.previousValue = String(payload.value ?? '');
      }
      renderTableTabs();
      renderTable();
    } else {
      renderFilters();
      render();
    }
    updateHeaderRecordCount();
    return true;
  } catch (error) {
    if (control) {
      control.disabled = false;
      control.classList.remove('is-saving');
      if ('value' in control && control.dataset.previousValue !== undefined) {
        control.value = control.dataset.previousValue;
      }
    }
    renderTable();
    elements.dataStatus.textContent = `Custom Review Project 저장 실패: ${error.message}`;
    return false;
  }
}

function saveShortlistingProjectField(recordId, projectId, payload, control = null) {
  const queueKey = `${recordId}::${projectId}`;
  const previous = shortlistingProjectSaveQueues.get(queueKey) || Promise.resolve();
  const next = previous
    .catch(() => false)
    .then(() => performShortlistingProjectSave(recordId, projectId, payload, control));
  shortlistingProjectSaveQueues.set(queueKey, next);
  next.finally(() => {
    if (shortlistingProjectSaveQueues.get(queueKey) === next) shortlistingProjectSaveQueues.delete(queueKey);
  });
  return next;
}

let floatingAgentController = null;
let activeKnowledgeMapNodeContext = null;
const defaultAgentSuggestionsMarkup = document.querySelector('#agentSuggestions')?.innerHTML || '';

const CRITERIA_DRAWER_SCOPE_LABELS = {
  triage: 'TAB 1 · SIMPLE RESEARCH · SCORING GUIDE',
  full: 'TAB 2 · ADVANCED RESEARCH · SCORING GUIDE',
  focus: 'TAB 3 · CUSTOM REVIEW · DECISION GUIDE'
};

const CRITERIA_DRAWER_SUBTITLES = {
  triage: 'Advanced Research 검토 후보를 선별하기 위한 3-point screening 기준',
  full: '과학성·차별성·개발성·사업성을 평가하는 Advanced Research 기준',
  focus: 'Custom Review 후보의 OI Partnership Type 자동분류 및 후속 관리 기준'
};

const criteriaGuideKoreanMarkup = elements.criteriaDrawerBody?.innerHTML || '';
let criteriaGuideLanguage = localStorage.getItem(CRITERIA_GUIDE_LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'ko';

function criteriaGuideChrome() {
  if (criteriaGuideLanguage !== 'en') {
    return {
      title: '판단근거',
      close: '닫기',
      closeAriaLabel: '판단근거 닫기',
      scopes: CRITERIA_DRAWER_SCOPE_LABELS,
      subtitles: CRITERIA_DRAWER_SUBTITLES
    };
  }
  return ENGLISH_CRITERIA_DRAWER_CHROME;
}

function updateCriteriaGuideLanguageControls() {
  elements.criteriaLanguageToggle?.querySelectorAll('[data-criteria-language]').forEach((button) => {
    const selected = button.dataset.criteriaLanguage === criteriaGuideLanguage;
    button.setAttribute('aria-pressed', String(selected));
  });
}

function applyCriteriaGuideLanguage(language) {
  const nextLanguage = language === 'en' ? 'en' : 'ko';
  criteriaGuideLanguage = nextLanguage;
  if (elements.criteriaDrawerBody) {
    elements.criteriaDrawerBody.innerHTML = nextLanguage === 'en'
      ? englishCriteriaGuideMarkup()
      : criteriaGuideKoreanMarkup;
    elements.criteriaDrawerBody.lang = nextLanguage;
  }
  const title = elements.criteriaDrawer?.querySelector('.criteria-drawer-title-row h2');
  if (title) title.textContent = criteriaGuideChrome().title;
  if (elements.criteriaDrawerClose) {
    elements.criteriaDrawerClose.setAttribute('aria-label', criteriaGuideChrome().closeAriaLabel);
    const closeLabel = elements.criteriaDrawerClose.querySelector('span');
    if (closeLabel) closeLabel.textContent = criteriaGuideChrome().close;
  }
  updateCriteriaGuideLanguageControls();
  localStorage.setItem(CRITERIA_GUIDE_LANGUAGE_STORAGE_KEY, nextLanguage);
  updateCriteriaDrawerScope();
}

function updateCriteriaDrawerScope() {
  const mode = activeTableMode();
  const chrome = criteriaGuideChrome();
  if (elements.criteriaDrawerScopeLabel) {
    elements.criteriaDrawerScopeLabel.textContent = chrome.scopes[mode] || '';
  }
  if (elements.criteriaDrawerVersionBadge) {
    const version = mode === 'triage'
      ? LATEST_TRIAGE_RUBRIC_VERSION
      : mode === 'full'
        ? LATEST_FULL_SCOUT_RUBRIC_VERSION
        : state.latestOiPartnershipCriteriaVersion;
    elements.criteriaDrawerVersionBadge.textContent = `v${version}`;
  }
  if (elements.criteriaDrawerSubtitle) {
    elements.criteriaDrawerSubtitle.textContent = chrome.subtitles[mode] || '';
  }
  if (elements.criteriaDrawer) elements.criteriaDrawer.dataset.activeCriteriaTab = mode;
  elements.criteriaDrawerBody?.querySelectorAll('[data-criteria-tab]').forEach((section) => {
    const scopes = section.dataset.criteriaTab.split(' ');
    section.hidden = !scopes.includes(mode);
  });
}

function openCriteriaDrawer() {
  updateCriteriaDrawerScope();
  elements.criteriaDrawer.hidden = false;
  elements.criteriaBackdrop.hidden = false;
  document.body.classList.add('criteria-modal-open');
  requestAnimationFrame(() => {
    elements.criteriaDrawer.classList.add('open');
    elements.criteriaBackdrop.classList.add('open');
    elements.criteriaDrawer.setAttribute('aria-hidden', 'false');
    elements.criteriaDrawerClose.focus();
  });
}

function closeCriteriaDrawer() {
  elements.criteriaDrawer.classList.remove('open');
  elements.criteriaBackdrop.classList.remove('open');
  elements.criteriaDrawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    elements.criteriaDrawer.hidden = true;
    elements.criteriaBackdrop.hidden = true;
    document.body.classList.remove('criteria-modal-open');
    elements.criteriaDrawerButton.focus();
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
      <div class="agent-message-meta-labels">
        <strong>${role === 'user' ? 'You' : 'All Pipelines Agent'}</strong>
        ${role === 'assistant' ? '<span>JSON + Wiki retrieval</span>' : ''}
      </div>
    </div>
    <div class="agent-message-text">${renderAgentText(text)}</div>
    ${renderAgentSources(options.sources)}
    ${role === 'assistant' ? '<div class="agent-message-actions"><button type="button" class="help-tooltip" data-agent-action="copy" data-tooltip="복사" aria-label="복사"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg></button><button type="button" class="help-tooltip" data-agent-action="expand" data-tooltip="전체보기" aria-label="전체보기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"></path></svg></button></div>' : ''}
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

let activeAgentResponseText = '';
let agentResponseModalPreviousFocus = null;

function agentMessageText(bubble) {
  const messageId = bubble?.dataset.messageId;
  const sessionMessage = activeAgentSession()?.messages?.find((message) => message.id === messageId);
  return String(sessionMessage?.text ?? bubble?.querySelector('.agent-message-text')?.textContent ?? '').trim();
}

async function copyAgentResponse(text, feedbackButton = null) {
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
  if (feedbackButton) {
    const originalHtml = feedbackButton.innerHTML;
    const originalTooltip = feedbackButton.dataset.tooltip || '복사';
    const originalAriaLabel = feedbackButton.getAttribute('aria-label') || '복사';
    feedbackButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>';
    feedbackButton.dataset.tooltip = '복사됨';
    feedbackButton.setAttribute('aria-label', '복사됨');
    window.setTimeout(() => {
      feedbackButton.innerHTML = originalHtml;
      feedbackButton.dataset.tooltip = originalTooltip;
      feedbackButton.setAttribute('aria-label', originalAriaLabel);
    }, 1400);
  }
}

function openAgentResponseModal(text, trigger) {
  if (!elements.agentResponseModal || !elements.agentResponseModalBody) return;
  activeAgentResponseText = text;
  agentResponseModalPreviousFocus = trigger || document.activeElement;
  elements.agentResponseModalBody.innerHTML = renderAgentText(text);
  elements.agentResponseModalStatus.textContent = '';
  elements.agentResponseModal.hidden = false;
  document.body.classList.add('agent-response-modal-open');
  elements.agentResponseModalClose?.focus();
}

function closeAgentResponseModal() {
  if (!elements.agentResponseModal || elements.agentResponseModal.hidden) return;
  elements.agentResponseModal.hidden = true;
  document.body.classList.remove('agent-response-modal-open');
  activeAgentResponseText = '';
  agentResponseModalPreviousFocus?.focus?.();
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
    'Obsidian mock: 관련 note alias/tags를 확인하고, Agentic Search mock은 target, modality, direct competitor, marketability 근거를 보강하는 흐름으로 구성됩니다.'
  ].join('\n');
}

function buildDashboardAgentContext() {
  const visibleRows = getVisibleRows();
  const mode = activeTableMode();
  const scopeRows = [...visibleRows]
    .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
  const summary = scopeRows
    .map((row) => {
      const fields = [
        `- ${row.asset} (${row.company}, ${row.country})`,
        `theme=${row.theme}`,
        `cluster=${row.cluster}`,
        `stage=${row.stage}`,
        `scores=${row.totalScore}/${row.maxScore}`,
        `TAR=${row.targetScore}`,
        `Data=${row.dataScore}`,
        `Market=${row.marketScore}`,
        `filter1=${row.filter1}`,
        `filter2=${row.filter2}`
      ];
      if (mode === 'focus') {
        fields.push(
          `oi_partnership=${row.filter3}`,
          `in_vivo=${row.inVivoStatus}`,
          `in_vitro=${row.inVitroStatus}`,
          `admet_completed=${row.admetCompleted ?? 'N/A'}`,
          `owner=${row.focusOwner || '-'}`,
          `action_date=${row.focusDueDate || '-'}`,
          `action_plan=${String(row.focusActionPlan || '').replace(/\s+/g, ' ').slice(0, 300) || '-'}`,
          `focus_note=${String(row.focusComment || '').replace(/\s+/g, ' ').slice(0, 500) || '-'}`,
          `team_review_count=${row.teamCommentCount}`,
          `latest_team_review=${String(row.latestTeamComment || '').replace(/\s+/g, ' ').slice(0, 500) || '-'}`,
          `latest_team_review_author=${row.latestTeamCommentAuthor || '-'}`
        );
      }
      return fields.join('; ');
    })
    .join('\n');

  return [
    `Dashboard current ${mode === 'focus' ? 'Shortlisting' : 'Tab/filter'} scope: ${scopeRows.length} pipelines.`,
    summary || '- No candidates match the current filters.',
    '',
    'Answer as a SKBP Pipeline Finder dashboard agent. Compare assets using the visible dashboard context and the selected anchor asset JSON context. If source evidence is missing, say what evidence is missing.'
  ].join('\n');
}

function dashboardAgentCandidateRecordIds() {
  return [...new Set(getVisibleRows().map((row) => row.id).filter(Boolean))];
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
  return topVisibleRow?.id || null;
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
      candidate_record_ids: dashboardAgentCandidateRecordIds(),
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
      candidate_record_ids: dashboardAgentCandidateRecordIds(),
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

const INPUT_FULL_CRITERIA = [
  'target_relevance',
  'competitive_landscape',
  'moa_validity',
  'platform_attractiveness',
  'expansion_potential',
  'data_maturity',
  'marketability'
];
const INPUT_TRIAGE_CRITERIA = ['target_relevance', 'moa_validity', 'data_maturity'];
const INPUT_EVIDENCE_TYPES = new Set([
  'E0_not_found_or_not_assessable',
  'E1_company_claim_or_scientific_rationale_only',
  'E2_indirect_or_class_level_evidence',
  'E3_asset_specific_preclinical_or_technical_evidence',
  'E4_asset_specific_clinical_evidence'
]);
const INPUT_MARKETABILITY_STATUSES = new Set([
  'evidence_based',
  'assumption_based',
  'assumption_based_scenario',
  'insufficient_evidence',
  'established',
  'not_established'
]);
const INPUT_TRIAGE_STATUSES = new Set(['SELECT', 'REJECT', 'INSUFFICIENT']);
const INPUT_FULL_STATUSES = new Set(['PASS', 'REVIEW', 'FAIL']);
// Keep manual-entry validation on the same Canonical Modality Library used by
// imports, tables, and filters. Raw source wording is preserved separately.
const INPUT_MODALITIES = new Set(CANONICAL_MODALITIES);
const INPUT_INDICATIONS = new Set([
  "Alzheimer's disease",
  "Parkinson's disease",
  'Lewy body dementia',
  'Epilepsy / seizure disorders',
  'Multiple sclerosis / neuroinflammatory disease',
  'Amyotrophic lateral sclerosis / motor neuron disease',
  'Frontotemporal dementia',
  "Huntington's disease",
  'Stroke',
  'Migraine / headache disorders',
  'Pain',
  'Major depressive disorder',
  'Schizophrenia / psychosis',
  'Bipolar disorder',
  'Anxiety disorders',
  'Autism spectrum disorder',
  'ADHD',
  'Sleep / wake disorders',
  'Chronic cough',
  'Inflammatory bowel disease',
  'Systemic lupus erythematosus',
  'Other autoimmune / inflammatory disease',
  'Unknown'
]);
const INPUT_STAGES = new Set(CANONICAL_DEVELOPMENT_STAGES);
const INPUT_EVIDENCE_BASES = new Set([
  'user_input_only',
  'public_source',
  'user_input_and_public_source',
  'no_supporting_basis'
]);
const INPUT_THEMES = new Set(['E/I Balance', 'Neuroimmune', 'Protein Homeostasis', 'Others', 'Unknown']);

function isInputObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeGptOriginalReport(value) {
  const source = String(value || '');
  const citationMatches = source.match(/[ \t]*:contentReference\[[^\]\r\n]*\]\{[^}\r\n]*\}|[ \t]*\[?oaicite:[^\]\s}]+\]?/gi) || [];
  const htmlBreakMatches = source.match(/(?:<|&lt;)\s*br\s*\/?\s*(?:>|&gt;)/gi) || [];
  return {
    text: source
      .replace(/[ \t]*:contentReference\[[^\]\r\n]*\]\{[^}\r\n]*\}/gi, '')
      .replace(/[ \t]*\[?oaicite:[^\]\s}]+\]?/gi, '')
      .replace(/(?:<|&lt;)\s*br\s*\/?\s*(?:>|&gt;)/gi, '\n'),
    citationCount: citationMatches.length,
    htmlBreakCount: htmlBreakMatches.length
  };
}

function addInputIssue(issues, level, path, message) {
  issues.push({ level, path, message });
}

function fencedResponseBlocks(text) {
  const blocks = [];
  const pattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    blocks.push({
      language: String(match[1] || '').trim().toLowerCase(),
      content: String(match[2] || '').replace(/^\uFEFF/, '').trim(),
      start: match.index,
      end: pattern.lastIndex
    });
  }
  return blocks;
}

function parseJsonCandidate(text) {
  const cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return null;
  return { text: cleaned, payload: JSON.parse(cleaned) };
}

function jsonSyntaxIssue(error, jsonText) {
  const message = String(error?.message || error || 'Unknown JSON syntax error');
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  const positionMatch = message.match(/position\s+(\d+)/i);
  let line = lineColumnMatch ? Number(lineColumnMatch[1]) : null;
  let column = lineColumnMatch ? Number(lineColumnMatch[2]) : null;

  if ((!line || !column) && positionMatch) {
    const position = Math.max(0, Number(positionMatch[1]) || 0);
    const before = String(jsonText || '').slice(0, position);
    line = before.split(/\r?\n/).length;
    column = position - Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  }

  const location = line && column ? ` (${line}행 ${column}열)` : '';
  const sourceLine = line ? String(jsonText || '').split(/\r?\n/)[line - 1]?.trim() : '';
  const excerpt = sourceLine ? ` · 문제 줄: ${sourceLine.slice(0, 140)}` : '';
  return `최상위 JSON 문법 오류${location}: ${message}${excerpt}`;
}

function normalizeInputRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (isInputObject(payload) && Array.isArray(payload.records)) return payload.records;
  if (isInputObject(payload)) return [payload];
  return [];
}

function splitCombinedGptResponse(value) {
  const text = String(value || '').replace(/^\uFEFF/, '').trim();
  const errors = [];
  const warnings = [];
  if (!text) {
    addInputIssue(errors, 'error', 'input', 'GPT 전체 응답을 붙여넣어 주세요.');
    return { rawMarkdown: '', jsonText: '', payload: null, records: [], errors, warnings, fenceCount: 0 };
  }

  const blocks = fencedResponseBlocks(text);
  const separatorPattern = /^--- JSON DATA ---[ \t]*$/gm;
  const combinedBlocks = blocks.filter((block) => (
    ['', 'text', 'markdown', 'md'].includes(block.language)
    && /^--- JSON DATA ---[ \t]*$/m.test(block.content)
  ));
  let recovered;
  try {
    recovered = splitAtRecoverableJsonSeparator(text);
  } catch (error) {
    addInputIssue(errors, 'error', '입력 형식', String(error?.message || error));
    return {
      rawMarkdown: '',
      jsonText: '',
      payload: null,
      records: [],
      errors,
      warnings,
      fenceCount: blocks.length,
      inputFormat: 'separator'
    };
  }
  const primarySource = recovered.source;
  const separators = recovered.separators;

  if (separators.length) {
    const parsedSuffix = recovered.parsedSuffix;
    const selectedSeparator = recovered.separator;
    const lastParseError = recovered.lastError;
    if (combinedBlocks.length > 1 || separators.length > 1) {
      addInputIssue(
        parsedSuffix ? warnings : errors,
        parsedSuffix ? 'warning' : 'error',
        '입력 형식',
        parsedSuffix
          ? `--- JSON DATA --- 구분선이 ${separators.length}회 감지되어 유효한 최종 JSON 경계를 사용했습니다.`
          : '--- JSON DATA --- 구분선은 전체 응답에 정확히 한 번만 있어야 합니다.'
      );
    }
    const separator = selectedSeparator || separators[separators.length - 1];
    const rawMarkdownResult = normalizeGptOriginalReport(primarySource.slice(0, separator.index));
    const rawMarkdown = rawMarkdownResult.text.trim();
    const jsonText = parsedSuffix?.text || primarySource.slice(separator.index + separator[0].length).trim();
    const payload = parsedSuffix?.payload ?? null;
    if (!jsonText) {
      addInputIssue(errors, 'error', 'JSON', '--- JSON DATA --- 아래에 구조화 JSON이 없습니다.');
    } else if (!parsedSuffix) {
      addInputIssue(errors, 'error', 'JSON', jsonSyntaxIssue(lastParseError, jsonText));
    }
    if (parsedSuffix?.ignoredLeading) {
      addInputIssue(warnings, 'warning', 'JSON', 'JSON 앞의 설명 또는 내부 fence를 무시하고 최상위 JSON 객체/배열부터 읽었습니다.');
    }
    if (parsedSuffix?.ignoredTrailing) {
      addInputIssue(warnings, 'warning', 'JSON', '최상위 JSON 뒤의 설명 문구를 저장 대상에서 제외했습니다.');
    }
    if (parsedSuffix?.repairActions?.length) {
      addInputIssue(
        warnings,
        'warning',
        'JSON 자동 복구',
        `의미를 바꾸지 않는 문법 보정만 적용했습니다: ${parsedSuffix.repairActions.join(', ')}.`
      );
    }
    if (!rawMarkdown || !/^#{1,6}\s+/m.test(rawMarkdown)) {
      addInputIssue(errors, 'error', 'Markdown', '구분선 위에서 제목이 포함된 Markdown 원문을 찾지 못했습니다.');
    }
    if (rawMarkdownResult.citationCount || rawMarkdownResult.htmlBreakCount) {
      const cleanedParts = [];
      if (rawMarkdownResult.citationCount) cleanedParts.push(`내부 인용 표기 ${rawMarkdownResult.citationCount}개 제거`);
      if (rawMarkdownResult.htmlBreakCount) cleanedParts.push(`HTML 줄바꿈 ${rawMarkdownResult.htmlBreakCount}개를 Markdown 줄바꿈으로 변환`);
      addInputIssue(
        warnings,
        'warning',
        '원문 가독성 정리',
        `${cleanedParts.join(', ')}했습니다. 실제 URL 기반 References와 조사 내용은 유지됩니다.`
      );
    }
    const records = payload === null ? [] : normalizeInputRecords(payload);
    if (payload !== null && !records.length) {
      addInputIssue(errors, 'error', 'JSON', 'JSON 최상위에는 record 객체, record 배열 또는 {"records": [...]}가 필요합니다.');
    }
    return {
      rawMarkdown,
      jsonText,
      payload,
      records,
      errors,
      warnings,
      fenceCount: blocks.length,
      inputFormat: 'separator'
    };
  }

  const explicitJsonBlocks = blocks.filter((block) => block.language === 'json');
  const markdownBlocks = blocks.filter((block) => ['markdown', 'md'].includes(block.language));
  const parsedJsonBlocks = [];

  explicitJsonBlocks.forEach((block) => {
    try {
      parsedJsonBlocks.push({ ...block, ...parseJsonCandidate(block.content) });
    } catch (error) {
      addInputIssue(errors, 'error', 'JSON', `JSON 블록 문법 오류: ${error.message}`);
    }
  });

  if (!explicitJsonBlocks.length) {
    blocks.forEach((block) => {
      try {
        const parsed = parseJsonCandidate(block.content);
        if (parsed) parsedJsonBlocks.push({ ...block, ...parsed });
      } catch (_error) {
        // A non-JSON fenced block is expected to be the Markdown report.
      }
    });
  }

  if (parsedJsonBlocks.length > 1) {
    addInputIssue(errors, 'error', 'JSON', `레거시 JSON 코드블록이 ${parsedJsonBlocks.length}개 감지되었습니다. JSON 코드블록은 하나만 있어야 합니다.`);
  }

  const jsonBlock = parsedJsonBlocks[0] || null;
  let rawMarkdown = markdownBlocks[0]?.content || '';
  if (markdownBlocks.length > 1) {
    addInputIssue(warnings, 'warning', 'Markdown', `Markdown 블록이 ${markdownBlocks.length}개입니다. 첫 번째 블록을 원문으로 사용합니다.`);
  }

  if (!rawMarkdown) {
    const nonJsonBlock = blocks.find((block) => !explicitJsonBlocks.includes(block));
    if (nonJsonBlock) {
      rawMarkdown = nonJsonBlock.content;
    }
  }

  if (!rawMarkdown && jsonBlock) {
    rawMarkdown = `${text.slice(0, jsonBlock.start)}\n${text.slice(jsonBlock.end)}`.trim();
  }
  rawMarkdown = rawMarkdown
    .replace(/^```(?:markdown|md|text)?\s*/i, '')
    .replace(/\n?--- JSON DATA ---\s*$/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const legacyRawMarkdownResult = normalizeGptOriginalReport(rawMarkdown);
  rawMarkdown = legacyRawMarkdownResult.text.trim();

  if (!rawMarkdown || !/^#{1,6}\s+/m.test(rawMarkdown)) {
    addInputIssue(errors, 'error', 'Markdown', 'Markdown 원문 블록을 찾지 못했습니다. GPT의 전체 응답을 그대로 붙여넣어 주세요.');
  }
  if (legacyRawMarkdownResult.citationCount || legacyRawMarkdownResult.htmlBreakCount) {
    const cleanedParts = [];
    if (legacyRawMarkdownResult.citationCount) cleanedParts.push(`내부 인용 표기 ${legacyRawMarkdownResult.citationCount}개 제거`);
    if (legacyRawMarkdownResult.htmlBreakCount) cleanedParts.push(`HTML 줄바꿈 ${legacyRawMarkdownResult.htmlBreakCount}개를 Markdown 줄바꿈으로 변환`);
    addInputIssue(
      warnings,
      'warning',
      '원문 가독성 정리',
      `${cleanedParts.join(', ')}했습니다. 실제 URL 기반 References와 조사 내용은 유지됩니다.`
    );
  }
  if (!jsonBlock) {
    addInputIssue(errors, 'error', 'JSON', '--- JSON DATA --- 구분선 뒤의 JSON을 찾지 못했습니다. 이전 형식은 Markdown 코드블록 1개와 JSON 코드블록 1개만 지원합니다.');
  }

  const records = jsonBlock ? normalizeInputRecords(jsonBlock.payload) : [];
  if (jsonBlock && !records.length) {
    addInputIssue(errors, 'error', 'JSON', 'JSON 최상위에는 record 객체, record 배열 또는 {"records": [...]}가 필요합니다.');
  }

  return {
    rawMarkdown,
    jsonText: jsonBlock?.text || '',
    payload: jsonBlock?.payload || null,
    records,
    errors,
    warnings,
    fenceCount: blocks.length,
    inputFormat: 'legacy_fences'
  };
}

function fastTriageMarkdownStatusRows(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  for (let headerIndex = 0; headerIndex < lines.length; headerIndex += 1) {
    const line = lines[headerIndex];
    if (!/^\s*\|.*\|\s*$/.test(line)) continue;
    const headers = line.trim().replace(/^\||\|$/g, '').split('|')
      .map((cell) => cell.replace(/[*_`]/g, '').trim().toLowerCase());
    const statusIndex = headers.findIndex((header) => ['triage', 'status', 'final status', '판정'].includes(header));
    if (statusIndex < 0) continue;
    const assetIndex = headers.findIndex((header) => header === 'asset');
    const rows = [];
    for (let rowIndex = headerIndex + 1; rowIndex < lines.length; rowIndex += 1) {
      const rowLine = lines[rowIndex];
      if (!/^\s*\|.*\|\s*$/.test(rowLine)) {
        if (rows.length) break;
        continue;
      }
      const cells = rowLine.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      if (cells.length && cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      if (statusIndex >= cells.length) continue;
      rows.push({
        asset: assetIndex >= 0 && assetIndex < cells.length ? cells[assetIndex].replace(/[*_`]/g, '').trim() : '',
        status: cells[statusIndex].replace(/[*_`]/g, '').trim().toUpperCase()
      });
    }
    return rows;
  }
  return [];
}

function detectInputRecordMode(record) {
  if (!isInputObject(record)) return { mode: 'unknown', conflict: false };
  const meta = isInputObject(record.meta) ? record.meta : {};
  const sourceReport = isInputObject(record.source_report) ? record.source_report : {};
  const criteria = isInputObject(record.scoring?.criteria) ? record.scoring.criteria : {};
  const reviewType = String(meta.review_type || meta.workflow || '').trim().toLowerCase();
  const parserStatus = String(sourceReport.parser_status || '').toLowerCase();
  const sourceFormat = String(sourceReport.source_format || '').toLowerCase();
  const status = String(record.hard_filter?.status || record.triage?.status || '').trim().toUpperCase();

  const triageSignal = (
    reviewType.includes('triage')
    || parserStatus.includes('triage')
    || sourceFormat.includes('triage')
    || isInputObject(record.triage)
    || INPUT_TRIAGE_STATUSES.has(status)
  );
  const fullSignal = (
    reviewType.includes('full')
    || INPUT_FULL_CRITERIA.every((criterionId) => isInputObject(criteria[criterionId]))
    || INPUT_FULL_STATUSES.has(status)
  );

  if (triageSignal && fullSignal) return { mode: 'unknown', conflict: true };
  if (triageSignal) return { mode: 'triage', conflict: false };
  if (fullSignal) return { mode: 'full', conflict: false };
  return { mode: 'unknown', conflict: false };
}

function fastTriageSummaryHasSingleScore(summaryValue, criterionId, expectedScore) {
  const summary = String(summaryValue || '').trim();
  if (!summary || !Number.isInteger(expectedScore) || expectedScore < 0 || expectedScore > 3) return false;
  const labels = {
    target_relevance: '(?:TR|Target\\s+(?:Area\\s+)?Relevance)',
    moa_validity: '(?:MoA|Mechanism(?:\\s+of\\s+Action)?(?:\\s+Validity)?)',
    data_maturity: '(?:Data(?:\\s+Maturity)?)'
  };
  const normalized = summary.replace(/[*_`]/g, '');
  const hasSemanticScoreRange = Object.values(labels).some((label) => {
    const pattern = new RegExp(`\\b${label}\\b\\s*(?:score\\s*)?(?:is|=|:)?\\s*[0-3]\\s*(?:점|points?\\b)\\s*(?:\\/|~|–|—|-|to)\\s*[0-3]\\s*(?:점|points?\\b)`, 'i');
    return pattern.test(normalized);
  });
  if (hasSemanticScoreRange) return false;
  const references = [];
  Object.entries(labels).forEach(([referenceId, label]) => {
    const pattern = new RegExp(`\\b${label}\\b\\s*(?:score\\s*)?(?:is|=|:)?\\s*([0-3])\\s*(?:점|points?\\b)`, 'gi');
    for (const match of normalized.matchAll(pattern)) {
      references.push({ index: match.index, criterionId: referenceId, score: Number(match[1]) });
    }
  });
  references.sort((left, right) => left.index - right.index);
  const selected = references.filter((reference) => reference.criterionId === criterionId);
  return selected.length === 1
    && selected[0].score === expectedScore
    && references.length === 1;
}

function validateInputScoreCriterion(
  criterion,
  criterionId,
  recordPath,
  issues,
  { full = false, minimal = false } = {}
) {
  const path = `${recordPath}.scoring.criteria.${criterionId}`;
  if (!isInputObject(criterion)) {
    addInputIssue(issues, 'error', path, '필수 criterion 객체가 누락되었습니다.');
    return;
  }
  if (!Number.isInteger(criterion.score) || criterion.score < 0 || criterion.score > 3) {
    addInputIssue(issues, 'error', `${path}.score`, `0, 1, 2, 3 중 하나의 정수가 필요합니다. 현재 값: ${JSON.stringify(criterion.score)}`);
  }

  if (minimal) {
    const allowedKeys = new Set([
      'score',
      'evidence_type',
      'evidence_type_reason',
      'evidence_basis',
      'main_line_summary',
      'why_not_higher',
      'investigation_note',
      'uncertain_points',
      'source_ids',
      'calculation'
    ]);
    const extraKeys = Object.keys(criterion).filter((key) => !allowedKeys.has(key));
    if (extraKeys.length) {
      addInputIssue(
        issues,
        'error',
        path,
        `Compact v2 criterion에 허용되지 않는 key가 있습니다: ${extraKeys.join(', ')}`
      );
    }
    const requiredStringFields = [
      'evidence_type',
      'evidence_type_reason',
      'evidence_basis',
      'main_line_summary',
      'why_not_higher',
      'investigation_note'
    ];
    requiredStringFields.forEach((field) => {
      if (!(field in criterion) || typeof criterion[field] !== 'string') {
        addInputIssue(issues, 'error', `${path}.${field}`, 'Compact v2 표시용 문자열 필드가 필요합니다.');
      }
    });
    for (const field of ['uncertain_points', 'source_ids']) {
      if (!Array.isArray(criterion[field])) {
        addInputIssue(issues, 'error', `${path}.${field}`, 'Compact v2 표시/출처 필드는 배열이어야 합니다.');
      }
    }
    if (full) {
      if (!INPUT_EVIDENCE_TYPES.has(criterion.evidence_type)) {
        addInputIssue(issues, 'error', `${path}.evidence_type`, 'E0~E4의 허용된 Evidence Type이 필요합니다.');
      }
    } else {
      if (criterion.evidence_type !== 'triage_only') {
        addInputIssue(issues, 'error', `${path}.evidence_type`, 'Fast Triage Compact v2는 triage_only를 사용해야 합니다.');
      }
      if (!INPUT_EVIDENCE_BASES.has(String(criterion.evidence_basis || '').trim())) {
        addInputIssue(issues, 'error', `${path}.evidence_basis`, '허용된 Fast Triage evidence_basis가 필요합니다.');
      }
    }
    return;
  }

  if (full) {
    if (!INPUT_EVIDENCE_TYPES.has(criterion.evidence_type)) {
      addInputIssue(issues, 'error', `${path}.evidence_type`, 'E0~E4의 허용된 Evidence Type이 필요합니다.');
    }
    if (!('main_line_summary' in criterion) && !('reason' in criterion)) {
      addInputIssue(issues, 'error', `${path}.main_line_summary`, 'main_line_summary 또는 reason이 필요합니다.');
    }
    if (!('why_not_higher' in criterion)) {
      addInputIssue(issues, 'error', `${path}.why_not_higher`, '한 단계 높은 점수가 아닌 이유가 필요합니다.');
    }
    if (!('uncertain_points' in criterion)) {
      addInputIssue(issues, 'error', `${path}.uncertain_points`, '필수 배열이 누락되었습니다. 값이 없으면 []를 사용하세요.');
    }
  } else {
    const evidenceBasis = String(criterion.evidence_basis || '').trim();
    const summary = String(criterion.main_line_summary || '').trim();
    if (!summary) {
      addInputIssue(issues, 'error', `${path}.main_line_summary`, `Fast Triage v${LATEST_TRIAGE_RUBRIC_VERSION}에는 비어 있지 않은 main_line_summary가 필요합니다.`);
    } else if (Number.isInteger(criterion.score)
      && criterion.score >= 0
      && criterion.score <= 3
      && !fastTriageSummaryHasSingleScore(summary, criterionId, criterion.score)) {
      addInputIssue(issues, 'error', `${path}.main_line_summary`, `범위 없이 선택한 단일 점수 ${criterion.score}점만 summary에 명시해야 합니다.`);
    }
    if (!Array.isArray(criterion.uncertain_points)) {
      addInputIssue(issues, 'error', `${path}.uncertain_points`, 'Fast Triage uncertain_points는 배열이어야 합니다. 값이 없으면 []를 사용하세요.');
    }
    if (!INPUT_EVIDENCE_BASES.has(evidenceBasis)) {
      addInputIssue(
        issues,
        'error',
        `${path}.evidence_basis`,
        'user_input_only, public_source, user_input_and_public_source, no_supporting_basis 중 하나가 필요합니다.'
      );
    }
    if (!Array.isArray(criterion.evidence_sources)) {
      addInputIssue(issues, 'error', `${path}.evidence_sources`, 'Fast Triage evidence_sources는 배열이어야 합니다. 값이 없으면 []를 사용하세요.');
    } else {
      const verifiedCount = verifiedPublicSourceUrls(criterion, { requireExplicitVerification: true }).length;
      ['verified_source_count', 'verified_public_source_count'].forEach((countField) => {
        if (!(countField in criterion)) return;
        const declaredCount = criterion[countField];
        if (!Number.isInteger(declaredCount) || declaredCount < 0 || declaredCount !== verifiedCount) {
          addInputIssue(
            issues,
            'error',
            `${path}.${countField}`,
            `고유한 verified public URL 수 ${verifiedCount}와 일치하는 0 이상의 정수여야 합니다.`
          );
        }
      });
      if (['public_source', 'user_input_and_public_source'].includes(evidenceBasis) && verifiedCount < 1) {
        addInputIssue(
          issues,
          'error',
          `${path}.evidence_sources`,
          `${evidenceBasis}는 실제로 인용한 유효한 public source_url이 1개 이상 필요합니다.`
        );
      }
      if (['user_input_only', 'no_supporting_basis'].includes(evidenceBasis) && verifiedCount > 0) {
        addInputIssue(
          issues,
          'error',
          `${path}.evidence_basis`,
          `유효한 public URL ${verifiedCount}개가 있으므로 ${evidenceBasis}와 일치하지 않습니다.`
        );
      }
      if (criterion.score >= 2 && evidenceBasis === 'no_supporting_basis') {
        addInputIssue(issues, 'error', `${path}.evidence_basis`, 'score >= 2에는 no_supporting_basis를 사용할 수 없습니다.');
      }
      if (['moa_validity', 'data_maturity'].includes(criterionId) && criterion.score >= 2 && verifiedCount < 1) {
        addInputIssue(
          issues,
          'error',
          `${path}.evidence_sources`,
          `${criterionId} 2점 이상에는 실제 확인한 public technical/source URL이 1개 이상 필요합니다.`
        );
      }
    }
  }

  ['what_was_checked', 'evidence_trail', 'evidence_sources', 'verified_evidence_sources', 'source_ids', 'uncertain_points'].forEach((field) => {
    if (field in criterion && !Array.isArray(criterion[field])) {
      addInputIssue(issues, 'error', `${path}.${field}`, '배열이어야 합니다.');
    }
  });
}

function validateInputFilterFields(record, recordPath, errors, warnings) {
  const table = record.structured_table;
  if (!isInputObject(table)) {
    addInputIssue(errors, 'error', `${recordPath}.structured_table`, '필수 structured_table 객체가 누락되었습니다.');
    return;
  }

  const asset = String(table.asset_name || record.json_summary?.asset_name || '').trim();
  if (!asset) {
    addInputIssue(errors, 'error', `${recordPath}.structured_table.asset_name`, 'Asset 이름이 필요합니다.');
  }

  const modality = String(table.modality_platform || '').trim();
  if (modality && !INPUT_MODALITIES.has(modality)) {
    addInputIssue(warnings, 'warning', `${recordPath}.structured_table.modality_platform`, `"${modality}"는 표준 Modality가 아닙니다. 짧은 canonical label을 확인하세요.`);
  }
  const stage = String(table.development_stage || '').trim();
  if (!stage) {
    addInputIssue(errors, 'error', `${recordPath}.structured_table.development_stage`, 'canonical development_stage가 필요합니다. 확인할 수 없으면 Unknown을 사용하세요.');
  } else if (!INPUT_STAGES.has(stage)) {
    addInputIssue(errors, 'error', `${recordPath}.structured_table.development_stage`, `"${stage}"는 허용된 canonical Pipeline Stage가 아닙니다.`);
  }
  const theme = String(record.json_summary?.theme || '').trim();
  if (theme && !INPUT_THEMES.has(theme)) {
    addInputIssue(warnings, 'warning', `${recordPath}.json_summary.theme`, `"${theme}"는 E/I Balance, Neuroimmune, Protein Homeostasis, Others, Unknown 중 하나여야 합니다.`);
  }
}

function validateInputMarketability(criterion, recordPath, issues, { requireCompactSources = false } = {}) {
  const path = `${recordPath}.scoring.criteria.marketability`;
  if (!isInputObject(criterion)) return;
  const allowedMethods = new Set(['calculation', 'external_forecast', 'both', 'insufficient_evidence']);
  const method = String(criterion.assessment_method || '').trim();
  if (!allowedMethods.has(method)) {
    addInputIssue(issues, 'error', `${path}.assessment_method`, 'calculation, external_forecast, both, insufficient_evidence 중 하나가 필요합니다.');
  }
  const hasCalculation = ['calculation', 'both'].includes(method);
  const hasExternalForecast = ['external_forecast', 'both'].includes(method);
  const expectedBasisType = method === 'both' ? 'calculation' : method;
  if (allowedMethods.has(method) && criterion.score_basis_type !== expectedBasisType) {
    addInputIssue(
      issues,
      'error',
      `${path}.score_basis_type`,
      `${method} 방식의 score_basis_type은 ${expectedBasisType}이어야 합니다.`
    );
  }
  const expectedCalculationStatus = hasCalculation ? 'performed' : 'not_performed';
  if (allowedMethods.has(method) && criterion.calculation_status !== expectedCalculationStatus) {
    addInputIssue(
      issues,
      'error',
      `${path}.calculation_status`,
      `${method} 방식의 calculation_status는 ${expectedCalculationStatus}이어야 합니다.`
    );
  }
  if (requireCompactSources && hasExternalForecast && (!Array.isArray(criterion.external_forecast_source_ids)
    || !criterion.external_forecast_source_ids.some((value) => String(value || '').trim()))) {
    addInputIssue(issues, 'error', `${path}.external_forecast_source_ids`, 'external_forecast 또는 both 방식에는 검증된 forecast source_id가 1개 이상 필요합니다.');
  }
  const calculation = criterion.calculation;
  if (!isInputObject(calculation)) {
    addInputIssue(issues, 'error', `${path}.calculation`, 'Marketability A/B/C calculation 객체가 필요합니다.');
    return;
  }

  const status = calculation.commercial_rationale_status;
  if (!INPUT_MARKETABILITY_STATUSES.has(status)) {
    addInputIssue(issues, 'error', `${path}.calculation.commercial_rationale_status`, `허용값이 아닙니다. 현재 값: ${JSON.stringify(status)}`);
    return;
  }
  const insufficientStatuses = ['insufficient_evidence', 'not_established'];
  if (method === 'insufficient_evidence' && !insufficientStatuses.includes(status)) {
    addInputIssue(issues, 'error', `${path}.calculation.commercial_rationale_status`, 'insufficient_evidence 방식에는 insufficient_evidence 또는 not_established 상태가 필요합니다.');
  }
  if (method && method !== 'insufficient_evidence' && insufficientStatuses.includes(status)) {
    addInputIssue(issues, 'error', `${path}.calculation.commercial_rationale_status`, `${method} 방식과 ${status} 상태가 상충합니다.`);
  }

  const steps = [
    ['A_targetable_addressable_patient', 'targetable_addressable_patient'],
    ['B_unrisked_peak_sales', 'unrisked_peak_sales'],
    ['C_obtainable_peak_sales', 'obtainable_peak_sales']
  ];
  steps.forEach(([stepName]) => {
    if (!isInputObject(calculation[stepName])) {
      addInputIssue(issues, 'error', `${path}.calculation.${stepName}`, '필수 계산 단계 객체가 누락되었습니다.');
    }
  });

  if (insufficientStatuses.includes(status)) {
    if (criterion.score !== 0 || method !== 'insufficient_evidence') {
      addInputIssue(issues, 'error', `${path}.score`, `${status}일 때 Marketability 점수는 0이어야 합니다.`);
    }
    if (!String(calculation.commercial_rationale_failure_reason || '').trim()) {
      addInputIssue(issues, 'error', `${path}.calculation.commercial_rationale_failure_reason`, `${status}의 구체적인 실패 사유가 필요합니다.`);
    }
    steps.forEach(([stepName, outputName]) => {
      const output = calculation[stepName]?.[outputName];
      if (output !== null && output !== undefined) {
        addInputIssue(issues, 'error', `${path}.calculation.${stepName}.${outputName}`, `${status}일 때 결과값은 null이어야 합니다.`);
      }
    });
  } else {
    if (['assumption_based', 'assumption_based_scenario'].includes(status)
      && !String(calculation.commercial_rationale_basis || '').trim()) {
      addInputIssue(issues, 'error', `${path}.calculation.commercial_rationale_basis`, `${status}에 사용한 가정 근거가 필요합니다.`);
    }
    steps.forEach(([stepName, outputName]) => {
      const output = calculation[stepName]?.[outputName];
      if (hasCalculation) {
        if (output === null || output === undefined || output === '') {
          addInputIssue(issues, 'error', `${path}.calculation.${stepName}.${outputName}`, `${method} 방식에는 숫자 결과값이 필요합니다.`);
        } else if (typeof output !== 'number' || !Number.isFinite(output)) {
          addInputIssue(issues, 'error', `${path}.calculation.${stepName}.${outputName}`, 'million USD 단위의 숫자여야 합니다. 숫자를 따옴표로 감싸지 마세요.');
        }
      } else if (output !== null && output !== undefined) {
        addInputIssue(issues, 'error', `${path}.calculation.${stepName}.${outputName}`, `${method} 방식에서 수행하지 않은 A/B/C 결과는 null이어야 합니다.`);
      }
    });
  }

  const numericField = (field, required) => {
    const value = criterion[field];
    if (required && (typeof value !== 'number' || !Number.isFinite(value))) {
      addInputIssue(issues, 'error', `${path}.${field}`, 'million USD 단위의 숫자가 필요합니다. 숫자를 따옴표로 감싸지 마세요.');
    } else if (!required && value !== null && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      addInputIssue(issues, 'error', `${path}.${field}`, '값이 있으면 million USD 단위 숫자여야 합니다.');
    }
  };
  numericField('calculated_global_obtainable_peak_sales_musd', hasCalculation);
  numericField('external_normalized_global_peak_sales_musd', hasExternalForecast);
  numericField('assessed_global_peak_sales_musd', method !== 'insufficient_evidence');

  const validateComponent = (stepName, field, { minimum = 0, maximum = null } = {}) => {
    const value = calculation[stepName]?.[field];
    const componentPath = `${path}.calculation.${stepName}.${field}`;
    if (!hasCalculation) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      addInputIssue(issues, 'error', componentPath, 'calculation 방식에서는 유한한 JSON 숫자가 필요합니다.');
      return;
    }
    if (value < minimum || (maximum !== null && value > maximum)) {
      addInputIssue(issues, 'error', componentPath, `${minimum}${maximum === null ? ' 이상' : `~${maximum}`} 범위여야 합니다.`);
    }
  };
  [
    ['A_targetable_addressable_patient', 'total_patient_pool', { minimum: 0 }],
    ['A_targetable_addressable_patient', 'diagnosis_rate', { minimum: 0, maximum: 1 }],
    ['A_targetable_addressable_patient', 'eligibility_rate', { minimum: 0, maximum: 1 }],
    ['A_targetable_addressable_patient', 'treatable_subgroup_rate', { minimum: 0, maximum: 1 }],
    ['B_unrisked_peak_sales', 'tap', { minimum: 0 }],
    ['B_unrisked_peak_sales', 'annual_net_price', { minimum: 0 }],
    ['B_unrisked_peak_sales', 'peak_penetration', { minimum: 0, maximum: 1 }],
    ['B_unrisked_peak_sales', 'treatment_duration_factor', { minimum: 0 }],
    ['C_obtainable_peak_sales', 'unrisked_peak_sales', { minimum: 0 }],
    ['C_obtainable_peak_sales', 'competition_haircut', { minimum: 0, maximum: 1 }],
    ['C_obtainable_peak_sales', 'pricing_power_adjustment', { minimum: 0 }]
  ].forEach(([stepName, field, bounds]) => validateComponent(stepName, field, bounds));

  const assessed = criterion.assessed_global_peak_sales_musd;
  if (method === 'insufficient_evidence') {
    if (criterion.score !== 0 || assessed !== null) {
      addInputIssue(issues, 'error', path, 'insufficient_evidence이면 score=0이고 assessed_global_peak_sales_musd=null이어야 합니다.');
    }
  } else if (typeof assessed === 'number' && Number.isFinite(assessed)) {
    const expectedScore = assessed >= 2000 ? 3 : assessed >= 1000 ? 2 : 1;
    if (criterion.score !== expectedScore) {
      addInputIssue(issues, 'error', `${path}.score`, `assessed_global_peak_sales_musd ${assessed}에 따른 점수는 ${expectedScore}점이어야 합니다.`);
    }
  }
}

function normalizeExpandedInputFilterFields(record) {
  if (!isInputObject(record?.structured_table)) return record;
  const table = record.structured_table;
  const rawModality = String(table.modality_source || table.modality_platform || '').trim();
  const rawStage = String(table.development_stage_source || table.development_stage || '').trim();
  table.modality_source = rawModality;
  table.modality_platform = canonicalModality(rawModality);
  table.modality_tags = canonicalModalityTags(rawModality, table.modality_platform);
  table.development_stage_source = rawStage;
  table.development_stage = canonicalDevelopmentStage(rawStage);
  table.company_country = canonicalCountry(table.company_country);
  const canonicalIndication = canonicalMainIndication(table.main_indication, table.indication);
  const indicationVocabulary = new Set([
    ...INPUT_INDICATIONS,
    ...(state.categorySynonyms.indication || []).map((entry) => entry?.canonical).filter(Boolean)
  ]);
  table.main_indication = indicationVocabulary.has(canonicalIndication) ? canonicalIndication : 'Unknown';
  if (isInputObject(record.json_summary)) {
    const theme = canonicalTheme(record.json_summary.theme);
    record.json_summary.theme = theme;
    record.json_summary.cluster = canonicalCluster(record.json_summary.cluster, theme);
    if (Object.prototype.hasOwnProperty.call(record.json_summary, 'company_country')) {
      record.json_summary.company_country = table.company_country;
    }
  }
  return record;
}

function validateInputFullScoutStructures(record, recordPath, issues) {
  const companyProfile = record.company_profile;
  const companyFields = [
    'company_name',
    'legal_name',
    'aliases',
    'country',
    'headquarters',
    'website',
    'founded_year',
    'company_stage',
    'ownership_status',
    'focus_areas',
    'platform_summary',
    'lead_pipeline_summary',
    'financing_or_partnership_signals',
    'official_source_urls',
    'notes'
  ];
  if (!isInputObject(companyProfile)) {
    addInputIssue(issues, 'error', `${recordPath}.company_profile`, 'Full Scout 필수 객체가 누락되었습니다.');
  } else {
    companyFields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(companyProfile, field)) {
        addInputIssue(issues, 'error', `${recordPath}.company_profile.${field}`, 'JSON Schema 필수 필드가 누락되었습니다.');
      }
    });
    ['aliases', 'focus_areas', 'financing_or_partnership_signals', 'official_source_urls'].forEach((field) => {
      if (field in companyProfile && !Array.isArray(companyProfile[field])) {
        addInputIssue(issues, 'error', `${recordPath}.company_profile.${field}`, '배열이어야 합니다.');
      }
    });
  }

  const competitive = record.competitive_analysis;
  if (!isInputObject(competitive)) {
    addInputIssue(issues, 'error', `${recordPath}.competitive_analysis`, 'Full Scout 경쟁사 분석 객체가 누락되었습니다.');
    return;
  }
  const requiredCompetitiveFields = [
    'competitive_density',
    'competitor_table',
    'similarity_summary',
    'similar_pipelines',
    'differentiation_points',
    'analysis_summary'
  ];
  requiredCompetitiveFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(competitive, field)) {
      addInputIssue(issues, 'error', `${recordPath}.competitive_analysis.${field}`, 'JSON Schema 필수 필드가 누락되었습니다.');
    }
  });
  ['competitor_table', 'similar_pipelines', 'differentiation_points'].forEach((field) => {
    if (field in competitive && !Array.isArray(competitive[field])) {
      addInputIssue(issues, 'error', `${recordPath}.competitive_analysis.${field}`, '배열이어야 합니다.');
    }
  });
  if ('similarity_summary' in competitive && !isInputObject(competitive.similarity_summary)) {
    addInputIssue(issues, 'error', `${recordPath}.competitive_analysis.similarity_summary`, '객체여야 합니다.');
  }
}

function validateCompactSourceReferences(record, recordPath, issues) {
  if (!isCompactIngestionRecord(record)) return;
  const registry = Array.isArray(record.validation?.source_registry)
    ? record.validation.source_registry
    : [];
  const sourceIds = new Set();
  registry.forEach((source, index) => {
    const sourceId = String(source?.source_id || '').trim();
    const path = `${recordPath}.validation.source_registry[${index}].source_id`;
    if (!sourceId) {
      addInputIssue(issues, 'error', path, 'Compact source에는 비어 있지 않은 source_id가 필요합니다.');
    } else if (sourceIds.has(sourceId)) {
      addInputIssue(issues, 'error', path, `중복 source_id ${sourceId}를 사용할 수 없습니다.`);
    } else {
      sourceIds.add(sourceId);
    }
  });

  const visit = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isInputObject(value)) return;
    Object.entries(value).forEach(([key, child]) => {
      const childPath = `${path}.${key}`;
      if (key === 'source_ids' || key === 'external_forecast_source_ids') {
        if (!Array.isArray(child)) {
          addInputIssue(issues, 'error', childPath, 'source reference는 배열이어야 합니다.');
          return;
        }
        child.forEach((sourceId, index) => {
          const normalized = String(sourceId || '').trim();
          if (!normalized || !sourceIds.has(normalized)) {
            addInputIssue(
              issues,
              'error',
              `${childPath}[${index}]`,
              `source_registry에 없는 source_id ${JSON.stringify(sourceId)}를 참조합니다.`
            );
          }
        });
        return;
      }
      visit(child, childPath);
    });
  };
  visit(record, recordPath);
}

function validateCompactInputTypes(record, recordPath, issues) {
  if (!isCompactIngestionRecord(record)) return;
  const objectPaths = [
    ['meta'], ['structured_table'], ['hard_filter'], ['scoring'], ['scoring', 'criteria'],
    ['validation'], ['final_insight']
  ];
  objectPaths.forEach((parts) => {
    let value = record;
    for (const part of parts) value = value?.[part];
    if (!isInputObject(value)) {
      addInputIssue(issues, 'error', `${recordPath}.${parts.join('.')}`, 'Compact JSON에서 객체여야 합니다.');
    }
  });
  for (const optionalObject of ['company_profile', 'competitive_analysis', 'json_summary', 'triage']) {
    if (optionalObject in record && !isInputObject(record[optionalObject])) {
      addInputIssue(issues, 'error', `${recordPath}.${optionalObject}`, '값을 제공하면 객체여야 합니다.');
    }
  }


  if (isMinimalCompactIngestionRecord(record)) {
    if (!isInputObject(record.input)) {
      addInputIssue(issues, 'error', `${recordPath}.input`, 'Compact v2에서 input은 객체여야 합니다.');
    }
    ['company_input', 'asset_input'].forEach((field) => {
      if (!String(record.input?.[field] || '').trim()) {
        addInputIssue(
          issues,
          'error',
          `${recordPath}.input.${field}`,
          'Fast Triage와 Full Scout를 같은 자산으로 연결할 식별값이 필요합니다.'
        );
      }
    });
    if (Object.prototype.hasOwnProperty.call(record.input || {}, 'user_context')
      && typeof record.input.user_context !== 'string') {
      addInputIssue(issues, 'error', `${recordPath}.input.user_context`, 'User context must be a string.');
    }
    const rawMainIndication = record.structured_table?.main_indication;
    if (typeof rawMainIndication !== 'string' || !rawMainIndication.trim()) {
      addInputIssue(
        issues,
        'error',
        `${recordPath}.structured_table.main_indication`,
        'Compact v2에서는 main_indication을 생략하거나 비워둘 수 없습니다. 확인할 수 없으면 Unknown을 명시하세요.'
      );
    }
    for (const [path, value] of [
      ['structured_table.sources', record.structured_table?.sources],
      ['validation.uncertain_points', record.validation?.uncertain_points],
      ['validation.cross_checked_facts', record.validation?.cross_checked_facts],
      ['validation.source_registry', record.validation?.source_registry]
    ]) {
      if (!Array.isArray(value)) {
        addInputIssue(issues, 'error', `${recordPath}.${path}`, 'Compact v2 필드는 배열이어야 합니다.');
      }
    }
    if (Array.isArray(record.structured_table?.sources) && record.structured_table.sources.length > 1) {
      addInputIssue(
        issues,
        'error',
        `${recordPath}.structured_table.sources`,
        '대시보드 Source 열에는 대표 출처를 최대 1개만 넣어야 합니다.'
      );
    }
  } else {
    if (Object.prototype.hasOwnProperty.call(record, 'input') && !isInputObject(record.input)) {
      addInputIssue(issues, 'error', `${recordPath}.input`, '값을 제공하면 객체여야 합니다.');
    }
    const legacyCompany = String(
      record.input?.company_input
      || record.structured_table?.company
      || record.company_profile?.company_name
      || ''
    ).trim();
    const legacyAsset = String(
      record.input?.asset_input
      || record.structured_table?.asset_name
      || ''
    ).trim();
    if (!legacyCompany) {
      addInputIssue(
        issues,
        'error',
        `${recordPath}.structured_table.company`,
        'Legacy Compact v1의 input을 복구할 회사명이 필요합니다.'
      );
    }
    if (!legacyAsset) {
      addInputIssue(
        issues,
        'error',
        `${recordPath}.structured_table.asset_name`,
        'Legacy Compact v1의 input을 복구할 Asset명이 필요합니다.'
      );
    }
  }

  const criteria = isInputObject(record.scoring?.criteria) ? record.scoring.criteria : {};
  Object.entries(criteria).forEach(([criterionId, criterion]) => {
    const path = `${recordPath}.scoring.criteria.${criterionId}`;
    if (!isInputObject(criterion)) {
      addInputIssue(issues, 'error', path, 'criterion은 객체여야 합니다.');
      return;
    }
    const rawScore = criterion.score;
    const normalizedScore = typeof rawScore === 'string' && /^\s*[0-3]\s*$/.test(rawScore)
      ? Number(rawScore)
      : rawScore;
    if (!Number.isInteger(normalizedScore) || normalizedScore < 0 || normalizedScore > 3) {
      addInputIssue(issues, 'error', `${path}.score`, '0~3의 정수 또는 순수 숫자 문자열이어야 합니다.');
    }
    ['source_ids', 'uncertain_points', 'what_was_checked'].forEach((field) => {
      if (field in criterion && !Array.isArray(criterion[field])) {
        addInputIssue(issues, 'error', `${path}.${field}`, '값을 제공하면 배열이어야 합니다.');
      }
    });
    if (!isMinimalCompactIngestionRecord(record)
      && criterionId === 'marketability'
      && !isInputObject(criterion.calculation)) {
      addInputIssue(issues, 'error', `${path}.calculation`, 'Marketability calculation은 객체여야 합니다.');
    }
  });

  const similarity = record.competitive_analysis?.similarity_summary;
  if (similarity !== undefined && !isInputObject(similarity)) {
    addInputIssue(issues, 'error', `${recordPath}.competitive_analysis.similarity_summary`, '값을 제공하면 객체여야 합니다.');
  } else if (isInputObject(similarity)) {
    ['similar_pipeline_count', 'high_similarity_count', 'medium_similarity_count', 'low_similarity_count']
      .forEach((field) => {
        if (!(field in similarity)) return;
        const raw = similarity[field];
        const numeric = typeof raw === 'string' && /^\s*\d+\s*$/.test(raw) ? Number(raw) : raw;
        if (!Number.isInteger(numeric) || numeric < 0) {
          addInputIssue(issues, 'error', `${recordPath}.competitive_analysis.similarity_summary.${field}`, '0 이상의 정수여야 합니다.');
        }
      });
  }

  if (isMinimalCompactIngestionRecord(record) && record.triage) {
    const rawCount = record.triage.verified_public_source_count;
    const sourceCount = typeof rawCount === 'string' && /^\s*\d+\s*$/.test(rawCount)
      ? Number(rawCount)
      : rawCount;
    if (!Number.isInteger(sourceCount) || sourceCount < 0) {
      addInputIssue(
        issues,
        'error',
        `${recordPath}.triage.verified_public_source_count`,
        'Quick Summary source count는 0 이상의 정수여야 합니다.'
      );
    }
    if (typeof record.triage.why !== 'string') {
      addInputIssue(issues, 'error', `${recordPath}.triage.why`, 'Fast Triage 판단 요약 문자열이 필요합니다.');
    }
    if (!Array.isArray(record.triage.missing_evidence_needed_for_full_scout)) {
      addInputIssue(
        issues,
        'error',
        `${recordPath}.triage.missing_evidence_needed_for_full_scout`,
        'Full Scout 전 확인할 근거 목록은 배열이어야 합니다.'
      );
    }
  }

  if (isMinimalCompactIngestionRecord(record) && !record.triage) {
    for (const field of ['competitor_table', 'similar_pipelines']) {
      if (!Array.isArray(record.competitive_analysis?.[field])) {
        addInputIssue(
          issues,
          'error',
          `${recordPath}.competitive_analysis.${field}`,
          'Full Scout 경쟁/유사 파이프라인 데이터는 배열이어야 합니다.'
        );
      }
    }
  }
}

function hasMarketabilityAbcdExplanation(markdown) {
  const text = String(markdown || '');
  const geography = '(?:(?:US|U\\.S\\.|Global)\\s+)?';
  return [
    new RegExp(`\\bA\\.\\s*${geography}TAP\\b`, 'i'),
    new RegExp(`\\bB\\.\\s*${geography}Unrisked(?:\\s+Peak\\s+Sales)?\\b`, 'i'),
    new RegExp(`\\bC\\.\\s*${geography}Obtainable(?:\\s+Peak\\s+Sales)?\\b`, 'i'),
    /\bD\.\s*Global\s+Obtainable(?:\s+Peak\s+Sales)?\b/i
  ].every((pattern) => pattern.test(text));
}

function validateCombinedInput(value, expectedMode = '') {
  const split = splitCombinedGptResponse(value);
  const errors = [...split.errors];
  const warnings = [...split.warnings];
  const modes = [];
  const lockedMode = ['triage', 'full'].includes(expectedMode) ? expectedMode : '';
  const compactInput = split.records.some((record) => isInputObject(record) && isCompactIngestionRecord(record));
  const derivedFieldAdjustments = [];
  const records = split.records.map((record, index) => {
    if (!isInputObject(record)) return record;
    const expanded = normalizeExpandedInputFilterFields(expandCompactInputRecord(record, lockedMode));
    synchronizeDashboardOwnedInputFields(expanded).forEach((adjustment) => {
      derivedFieldAdjustments.push({ recordIndex: index, ...adjustment });
    });
    return expanded;
  });

  derivedFieldAdjustments.forEach((adjustment) => {
    const before = adjustment.previous === undefined || adjustment.previous === ''
      ? '미입력'
      : String(adjustment.previous);
    addInputIssue(
      warnings,
      'warning',
      `record[${adjustment.recordIndex}].${adjustment.path}`,
      `대시보드 저장 규칙으로 자동 정렬: ${before} → ${String(adjustment.current)}`
    );
  });

  if (split.payload !== null && lockedMode === 'triage' && !Array.isArray(split.payload)) {
    addInputIssue(errors, 'error', 'JSON 최상위', 'TAB1 Fast Triage는 여러 후보를 일관되게 처리하기 위해 최상위 JSON 배열 [...]이 필요합니다.');
  }
  if (split.payload !== null && lockedMode === 'full' && Array.isArray(split.payload) && split.payload.length === 1) {
    addInputIssue(warnings, 'warning', 'JSON 최상위', 'TAB2 권장 형식은 단일 JSON 객체 {...}입니다. 1개짜리 배열은 호환 입력으로 저장할 수 있습니다.');
  }

  records.forEach((record, index) => {
    const recordPath = `record[${index}]`;
    if (!isInputObject(record)) {
      addInputIssue(errors, 'error', recordPath, '각 record는 JSON 객체여야 합니다.');
      modes.push('unknown');
      return;
    }

    const detected = detectInputRecordMode(record);
    const validationMode = lockedMode || detected.mode;
    const minimalCompactInput = isMinimalCompactIngestionRecord(split.records[index]);
    modes.push(validationMode);
    if (detected.conflict) {
      addInputIssue(errors, 'error', recordPath, 'Fast Triage와 Full Scout 신호가 한 record에 섞여 있습니다.');
      return;
    }

    validateCompactInputTypes(split.records[index], recordPath, errors);
    validateCompactSourceReferences(minimalCompactInput ? record : split.records[index], recordPath, errors);
    if (String(split.records[index]?.meta?.ingestion_format || '').trim().toLowerCase() === 'compact_v1'
      && !Object.prototype.hasOwnProperty.call(split.records[index], 'input')) {
      addInputIssue(
        warnings,
        'warning',
        `${recordPath}.input`,
        'Legacy Compact v1 입력을 감지해 회사명과 Asset명으로 input을 자동 복구했습니다.'
      );
    }
    if (lockedMode && detected.mode !== 'unknown' && detected.mode !== lockedMode) {
      const currentTab = lockedMode === 'triage' ? 'TAB1 Fast Triage' : 'TAB2 Full Scout';
      const pastedMode = detected.mode === 'triage' ? 'Fast Triage' : 'Full Scout';
      addInputIssue(errors, 'error', recordPath, `${currentTab} 입력란에는 ${pastedMode} 결과를 저장할 수 없습니다. 올바른 탭으로 이동해 붙여넣어 주세요.`);
      return;
    }
    if (!lockedMode && detected.mode === 'unknown') {
      addInputIssue(errors, 'error', recordPath, '분석 모드를 판별할 수 없습니다. meta.review_type과 scoring 구조를 확인하세요.');
      return;
    }
    if (lockedMode && detected.mode === 'unknown') {
      addInputIssue(
        errors,
        'error',
        recordPath,
        `${lockedMode === 'triage' ? 'Fast Triage' : 'Full Scout'} 필수 모드 신호를 확인할 수 없습니다. meta.review_type과 scoring 구조를 확인하세요.`
      );
    }

    validateInputFilterFields(record, recordPath, errors, warnings);
    const criteria = isInputObject(record.scoring?.criteria) ? record.scoring.criteria : {};

    if (validationMode === 'triage') {
      const hardStatus = String(record.hard_filter?.status || '').trim().toUpperCase();
      const triageStatus = String(record.triage?.status || '').trim().toUpperCase();
      const status = hardStatus || triageStatus;
      if (!INPUT_TRIAGE_STATUSES.has(status)) {
        addInputIssue(errors, 'error', `${recordPath}.hard_filter.status`, `Fast Triage v${LATEST_TRIAGE_RUBRIC_VERSION} 판정은 SELECT, REJECT, INSUFFICIENT 중 하나여야 합니다.`);
      }
      if (hardStatus && triageStatus && hardStatus !== triageStatus) {
        addInputIssue(errors, 'error', `${recordPath}.triage.status`, `hard_filter.status(${hardStatus})와 triage.status(${triageStatus})가 일치해야 합니다.`);
      }
      INPUT_TRIAGE_CRITERIA.forEach((criterionId) => {
        validateInputScoreCriterion(
          criteria[criterionId],
          criterionId,
          recordPath,
          errors,
          { minimal: minimalCompactInput }
        );
      });

      const expectedVersions = {
        'meta.schema_version': [record.meta?.schema_version, FAST_TRIAGE_SCHEMA_VERSION],
        'meta.instruction_version': [record.meta?.instruction_version, LATEST_TRIAGE_RUBRIC_VERSION],
        'meta.rubric_version': [record.meta?.rubric_version, LATEST_TRIAGE_RUBRIC_VERSION],
        'triage.instruction_version': [record.triage?.instruction_version, LATEST_TRIAGE_RUBRIC_VERSION]
      };
      Object.entries(expectedVersions).forEach(([field, [actual, expected]]) => {
        if (String(actual || '').trim().replace(/^v/i, '') !== expected) {
          addInputIssue(errors, 'error', `${recordPath}.${field}`, `Fast Triage v${LATEST_TRIAGE_RUBRIC_VERSION}에서는 ${field}=${expected}가 필요합니다.`);
        }
      });

      const identityVerified = record.triage?.identity_verified;
      if (typeof identityVerified !== 'boolean') {
        addInputIssue(errors, 'error', `${recordPath}.triage.identity_verified`, 'true 또는 false가 필요합니다.');
      }
      const trScore = criteria.target_relevance?.score;
      const moaScore = criteria.moa_validity?.score;
      const dataScore = criteria.data_maturity?.score;
      // v3.5: development_stage is the sole activity gate (active_asset and the
      // hard_filter.flags keyword scan were dropped as redundant/ambiguous).
      const developmentStage = canonicalDevelopmentStage(record.structured_table?.development_stage);
      const expectedStatus = identityVerified !== true || developmentStage === 'Discontinued / inactive'
        ? 'INSUFFICIENT'
        : Math.min(trScore, moaScore, dataScore) === 0
          ? 'INSUFFICIENT'
          : trScore >= 3 && moaScore >= 1 && dataScore >= 2
            ? 'SELECT'
            : 'REJECT';
      if (INPUT_TRIAGE_STATUSES.has(status) && status !== expectedStatus) {
        addInputIssue(
          errors,
          'error',
          `${recordPath}.triage.status`,
          `identity/activity/TAR/MoA/Data 산식에 따른 status는 ${expectedStatus}여야 합니다. 현재 값: ${status}`
        );
      }
      const expectedRecommendation = {
        SELECT: 'Run Full Scout',
        REJECT: 'Monitor / gather more evidence',
        INSUFFICIENT: 'Do not run Full Scout'
      }[status];
      if (expectedRecommendation && record.final_insight?.recommendation !== expectedRecommendation) {
        addInputIssue(
          errors,
          'error',
          `${recordPath}.final_insight.recommendation`,
          `${status} status에는 recommendation을 정확히 "${expectedRecommendation}"로 써야 합니다.`
        );
      }

      const totalScore = record.scoring?.total_score;
      const maxScore = record.scoring?.max_score;
      if (totalScore === null || totalScore === undefined) {
        if (maxScore !== null && maxScore !== undefined) {
          addInputIssue(errors, 'error', `${recordPath}.scoring.max_score`, 'Fast Triage total_score가 null이면 max_score도 null이어야 합니다.');
        }
      } else {
        const expectedTotal = trScore + moaScore + dataScore;
        if (!Number.isInteger(totalScore) || totalScore !== expectedTotal) {
          addInputIssue(errors, 'error', `${recordPath}.scoring.total_score`, `TAR/MoA/Data 합계 ${expectedTotal}와 일치해야 합니다.`);
        }
        if (maxScore !== 9) {
          addInputIssue(errors, 'error', `${recordPath}.scoring.max_score`, 'Fast Triage total_score를 사용하면 max_score는 9여야 합니다.');
        }
      }
      return;
    }

    const status = String(record.hard_filter?.status || '').trim().toUpperCase();
    if (!INPUT_FULL_STATUSES.has(status)) {
      addInputIssue(errors, 'error', `${recordPath}.hard_filter.status`, 'Full Scout 판정은 PASS, REVIEW, FAIL 중 하나여야 합니다.');
    }
    INPUT_FULL_CRITERIA.forEach((criterionId) => {
      validateInputScoreCriterion(
        criteria[criterionId],
        criterionId,
        recordPath,
        errors,
        { full: true, minimal: minimalCompactInput }
      );
    });
    if (!minimalCompactInput) {
      validateInputMarketability(criteria.marketability, recordPath, errors, {
        requireCompactSources: String(record.meta?.ingestion_format || '').toLowerCase() === 'compact_v1'
      });
      validateInputFullScoutStructures(record, recordPath, errors);
    }

    const scoreValues = INPUT_FULL_CRITERIA.map((criterionId) => criteria[criterionId]?.score);
    if (scoreValues.every((score) => Number.isInteger(score) && score >= 0 && score <= 3)) {
      const sum = scoreValues.reduce((total, score) => total + score, 0);
      if (record.scoring?.total_score !== sum) {
        addInputIssue(errors, 'error', `${recordPath}.scoring.total_score`, `7개 점수 합계 ${sum}와 total_score ${JSON.stringify(record.scoring?.total_score)}가 일치해야 합니다.`);
      }
    }
    if (record.scoring?.max_score !== 21) {
      addInputIssue(errors, 'error', `${recordPath}.scoring.max_score`, 'Full Scout max_score는 21이어야 합니다.');
    }
    if (scoreValues.every((score) => Number.isInteger(score) && score >= 0 && score <= 3)
      && record.scoring?.total_score === scoreValues.reduce((total, score) => total + score, 0)
      && INPUT_FULL_STATUSES.has(status)) {
      const expectedFilter = computeHardFilter(record, {
        target: criteria.target_relevance,
        competitive: criteria.competitive_landscape,
        moa: criteria.moa_validity,
        platform: criteria.platform_attractiveness,
        expansion: criteria.expansion_potential,
        data: criteria.data_maturity,
        market: criteria.marketability
      });
      if (status !== expectedFilter.status) {
        addInputIssue(
          errors,
          'error',
          `${recordPath}.hard_filter.status`,
          `Full Scout v${LATEST_FULL_SCOUT_RUBRIC_VERSION} threshold에 따른 status는 ${expectedFilter.status}여야 합니다. 현재 값: ${status}`
        );
      }
    }
    const fullSchemaVersion = String(record.meta?.schema_version || '').replace(/^v/i, '');
    const fullRubricVersion = String(record.meta?.rubric_version || '').replace(/^v/i, '');
    const fullInstructionVersion = String(record.meta?.instruction_version || '').replace(/^v/i, '');
    if (fullSchemaVersion !== FULL_SCOUT_SCHEMA_VERSION) {
      addInputIssue(errors, 'error', `${recordPath}.meta.schema_version`, `Full Scout schema_version은 ${FULL_SCOUT_SCHEMA_VERSION}를 유지해야 합니다.`);
    }
    if (fullRubricVersion !== LATEST_FULL_SCOUT_RUBRIC_VERSION) {
      addInputIssue(errors, 'error', `${recordPath}.meta.rubric_version`, `Full Scout rubric_version은 ${LATEST_FULL_SCOUT_RUBRIC_VERSION}이어야 합니다.`);
    }
    if (fullInstructionVersion !== LATEST_FULL_SCOUT_RUBRIC_VERSION) {
      addInputIssue(errors, 'error', `${recordPath}.meta.instruction_version`, `Full Scout instruction_version은 ${LATEST_FULL_SCOUT_RUBRIC_VERSION}이어야 합니다.`);
    }
  });

  const knownModes = [...new Set(modes.filter((mode) => mode !== 'unknown'))];
  if (knownModes.length > 1) {
    addInputIssue(errors, 'error', 'records', '한 번의 입력에 Fast Triage와 Full Scout record를 섞을 수 없습니다.');
  }
  const mode = lockedMode || knownModes[0] || 'unknown';
  if (mode === 'triage' && records.length > 50) {
    addInputIssue(errors, 'error', 'records', `Fast Triage는 한 번에 최대 50개까지 처리할 수 있습니다. 현재 ${records.length}개입니다.`);
  }
  if (mode === 'full' && records.length > 1) {
    addInputIssue(errors, 'error', 'records', `Full Scout는 한 번에 한 asset만 입력합니다. 현재 ${records.length}개입니다.`);
  }

  const headingCount = (split.rawMarkdown.match(/^#{1,6}\s+/gm) || []).length;
  const tableCount = (split.rawMarkdown.match(/^\|.+\|$/gm) || []).length;
  if (split.rawMarkdown && !headingCount) {
    addInputIssue(warnings, 'warning', 'Markdown', 'Markdown 제목을 찾지 못했습니다.');
  }
  if (mode === 'triage' && split.rawMarkdown) {
    const markdownRows = fastTriageMarkdownStatusRows(split.rawMarkdown);
    if (!markdownRows.length) {
      addInputIssue(errors, 'error', 'Markdown.Triage', 'Fast Triage 표의 Triage 상태 열을 찾지 못했습니다.');
    } else {
      if (markdownRows.length !== records.length) {
        addInputIssue(
          errors,
          'error',
          'Markdown.Triage',
          `Markdown status row ${markdownRows.length}개와 JSON record ${records.length}개가 일치해야 합니다.`
        );
      }
      markdownRows.forEach((row, index) => {
        if (['N/A', 'NA'].includes(row.status)) {
          addInputIssue(errors, 'error', `Markdown.Triage[${index}]`, `Fast Triage v${LATEST_TRIAGE_RUBRIC_VERSION}에서는 legacy N/A 대신 INSUFFICIENT를 사용해야 합니다.`);
          return;
        }
        if (!INPUT_TRIAGE_STATUSES.has(row.status)) {
          addInputIssue(errors, 'error', `Markdown.Triage[${index}]`, 'SELECT, REJECT, INSUFFICIENT 중 하나만 사용해야 합니다.');
          return;
        }
        const record = records[index];
        const jsonStatus = String(record?.hard_filter?.status || record?.triage?.status || '').trim().toUpperCase();
        if (record && row.status !== jsonStatus) {
          addInputIssue(
            errors,
            'error',
            `Markdown.Triage[${index}]`,
            `Markdown 상태 ${row.status}와 JSON 상태 ${jsonStatus || '(blank)'}가 일치해야 합니다.`
          );
        }
      });
    }
  }
  if (mode === 'full' && split.rawMarkdown && !hasMarketabilityAbcdExplanation(split.rawMarkdown)) {
    addInputIssue(warnings, 'warning', 'Markdown', 'Full Scout 원문에서 Marketability A/B/C/D 설명을 찾지 못했습니다.');
  }

  return {
    ...split,
    records,
    errors,
    warnings,
    mode,
    expectedMode: lockedMode || null,
    compactInput,
    headingCount,
    tableCount,
    canSave: errors.length === 0
  };
}

function renderInputValidation(result, { savedMessage = '', wikiExportDeferred = false } = {}) {
  if (!elements.inputValidationResults) return;
  elements.inputValidationResults.hidden = false;
  const modeLabel = result.mode === 'triage'
    ? `Fast Triage · Rubric v${LATEST_TRIAGE_RUBRIC_VERSION}`
    : result.mode === 'full'
      ? `Full Scout · Rubric v${LATEST_FULL_SCOUT_RUBRIC_VERSION}`
      : '모드 판별 대기';
  const badgeClass = result.errors.length ? 'error' : result.warnings.length ? 'warning' : '';
  const badgeText = savedMessage || (result.errors.length ? '저장 불가' : result.warnings.length ? '경고 확인' : '저장 가능');
  const rows = [
    {
      level: 'ok',
      label: '고정',
      path: result.expectedMode === 'triage' ? 'TAB1 입력 계약' : 'TAB2 입력 계약',
      message: result.expectedMode === 'triage'
        ? 'Fast Triage 전용 · 최상위 JSON 배열'
        : 'Full Scout 전용 · 최상위 JSON 객체'
    },
    {
      level: result.rawMarkdown ? 'ok' : 'error',
      label: result.rawMarkdown ? '완료' : '오류',
      path: 'Markdown',
      message: result.rawMarkdown
        ? `원문 추출 · headings ${result.headingCount} · table rows ${result.tableCount}`
        : '원문을 추출하지 못했습니다.'
    },
    {
      level: result.payload ? 'ok' : 'error',
      label: result.payload ? '완료' : '오류',
      path: 'JSON',
      message: result.payload
        ? `구조화 데이터 추출 · ${result.records.length} record · ${result.compactInput ? 'Compact JSON → 대시보드 호환 구조 자동 확장' : result.inputFormat === 'separator' ? '기존 전체 JSON 형식' : '레거시 코드블록 형식'}`
        : 'JSON을 추출하지 못했습니다.'
    },
    ...result.errors.map((issue) => ({ ...issue, label: '차단' })),
    ...result.warnings.map((issue) => ({ ...issue, label: '경고' })),
    ...(Array.isArray(result.reuploadDecisions) ? result.reuploadDecisions.map((decision) => ({
      level: decision.skipIncoming || decision.replaceExisting ? 'warning' : 'ok',
      label: decision.skipIncoming ? '제외' : decision.replaceExisting ? '갱신' : '신규',
      path: `${decision.mode === 'triage' ? 'Fast Triage' : 'Full Scout'} · ${decision.company} · ${decision.asset}`,
      message: decision.skipIncoming
        ? '이번 업로드에서 제외합니다. 기존 레코드는 변경하지 않습니다.'
        : decision.replaceExisting
        ? '기존 GPT 원문과 공식 점수를 이번 조사 결과로 갱신합니다.'
        : '기존 조사 결과를 유지하고 신규 레코드로 추가합니다.'
    })) : [])
  ];

  elements.inputValidationResults.innerHTML = `
    <div class="input-validation-summary">
      <span class="input-validation-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      <strong>${escapeHtml(modeLabel)}</strong>
      <span>${result.records.length}건 · 오류 ${result.errors.length} · 경고 ${result.warnings.length}</span>
      ${wikiExportDeferred ? '<span>Wiki Map은 Wiki Map 탭에서 새로고침하면 최신화됩니다</span>' : ''}
    </div>
    <ul class="input-validation-list">
      ${rows.map((row) => `
        <li class="${escapeHtml(row.level || '')}">
          <b>${escapeHtml(row.label || '')}</b>
          <span><strong>${escapeHtml(row.path || '')}</strong>${row.path ? ' · ' : ''}${escapeHtml(row.message || '')}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function canRunAiReparse(validation) {
  return Boolean(
    validation
    && validation.rawMarkdown
    && Array.isArray(validation.errors)
    && validation.errors.length > 0
  );
}

async function previewPastedReportParsing() {
  setDataUploadStatus('validating');
  elements.previewInputButton.disabled = true;
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  const expectedMode = activeTableMode() === 'triage' ? 'triage' : 'full';
  const result = validateCombinedInput(elements.gptResponseInput.value, expectedMode);
  if (result.canSave) {
    try {
      const response = await fetch('/api/records/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: result.records })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'FastAPI 최종 검증에 실패했습니다.');
      result.incomingDuplicateGroups = Array.isArray(data.duplicate_record_ids)
        ? data.duplicate_record_ids
        : [];
    } catch (error) {
      addInputIssue(result.errors, 'error', 'FastAPI 최종 검증', String(error?.message || error));
      result.canSave = false;
    }
  }
  if (result.canSave) {
    const matches = [
      ...findIncomingDuplicateMatches(result.records, result.incomingDuplicateGroups),
      ...findDataReuploadMatches(result.records)
    ];
    if (matches.length) {
      const decisions = await reviewDataReuploadMatches(matches);
      if (decisions === null) {
        result.canSave = false;
        result.warnings.push({
          level: 'warning',
          path: '기존 레코드 확인',
          message: '갱신 여부를 확인해야 저장할 수 있습니다.'
        });
      } else {
        result.reuploadDecisions = decisions;
      }
    }
  }
  state.dataUploadReview = result.canSave
    ? {
        input: elements.gptResponseInput.value,
        reuploadDecisions: result.reuploadDecisions || []
      }
    : null;
  renderInputValidation(result);
  // Once validation passes, the next available action is saving. Editing the
  // input re-enables review and resets this state through the input handler.
  elements.previewInputButton.disabled = result.canSave;
  elements.saveJsonButton.disabled = !result.canSave;
  if (elements.aiReparseButton) {
    // AI recovery is intentionally available only for a blocking validation
    // error. Warnings are safe to save and must not consume OpenRouter tokens.
    elements.aiReparseButton.disabled = !canRunAiReparse(result);
  }
  setDataUploadStatus(result.canSave ? 'valid' : 'error', result.errors.length);
  return result;
}

function getNestedValue(obj, path) {
  const parts = String(path || '').split('.').filter(Boolean);
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function formatDiffValue(value) {
  if (value === undefined) return '(없음)';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.trim() ? value : '(빈 문자열)';
  try {
    const text = JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  } catch {
    return String(value);
  }
}

function renderAiReparseDiffPanel(beforeRecords, afterRecords, fieldsByIndex) {
  const entries = Object.entries(fieldsByIndex || {});
  const rows = entries.flatMap(([indexKey, paths]) => {
    const index = Number(indexKey);
    const before = beforeRecords?.[index];
    const after = afterRecords?.[index];
    return (Array.isArray(paths) ? paths : []).map((path) => {
      const oldValue = formatDiffValue(getNestedValue(before, path));
      const newValue = formatDiffValue(getNestedValue(after, path));
      return `<li class="ai-reparse-diff-row">
        <span class="ai-reparse-diff-path">${escapeHtml(path)}</span>
        <span class="ai-reparse-diff-old">${escapeHtml(oldValue)}</span>
        <span class="ai-reparse-diff-arrow" aria-hidden="true">→</span>
        <span class="ai-reparse-diff-new">${escapeHtml(newValue)}</span>
      </li>`;
    });
  });
  if (!rows.length) return '';
  return `<div class="ai-reparse-diff-panel">
    <div class="ai-reparse-diff-title">AI가 수정한 필드 (${rows.length}개)</div>
    <ul class="ai-reparse-diff-list">${rows.join('')}</ul>
  </div>`;
}

function formatAiReparseFailure(error) {
  const detail = String(error?.message || error || '').trim();
  const lowered = detail.toLowerCase();
  if (/finish_reason=length|출력 한도|16,000-token/.test(detail)) return `출력 한도 · ${detail}`;
  if (/json|record 배열|record 수|status row|markdown/.test(lowered)) return `JSON 구조 확인 필요 · ${detail}`;
  if (/스키마|schema|validation/.test(lowered)) return `저장 형식 확인 필요 · ${detail}`;
  if (/api.?key|\b401\b|\b403\b|인증|권한/.test(lowered)) return `OpenRouter 인증/권한 · ${detail}`;
  if (/rate.?limit|too many requests|\b429\b/.test(lowered)) return `OpenRouter 요청 한도 · ${detail}`;
  if (/provider|\b5\d\d\b|temporarily unavailable|network|fetch/.test(lowered)) return `AI 제공자 일시 오류 · ${detail}`;
  return `AI 재파싱 실패 · ${detail || '응답을 처리하지 못했습니다.'}`;
}

async function runAiReparse() {
  if (!elements.aiReparseButton) return;
  const expectedMode = activeTableMode() === 'triage' ? 'triage' : 'full';
  const currentInput = elements.gptResponseInput.value;
  const currentValidation = validateCombinedInput(currentInput, expectedMode);
  if (!canRunAiReparse(currentValidation)) {
    // Keep the client-side guard even if a click is triggered programmatically.
    // This prevents normal/warning-only results from spending a reparse request.
    elements.aiReparseButton.disabled = true;
    return;
  }
  const split = splitCombinedGptResponse(currentInput);
  const rawMarkdown = (split.rawMarkdown || currentInput || '').trim();
  if (!rawMarkdown) {
    addInputIssue(currentValidation.errors, 'error', 'AI 2차 파싱', 'Markdown 원문을 찾지 못해 AI 재파싱을 실행할 수 없습니다.');
    renderInputValidation(currentValidation);
    return;
  }

  const buttonLabel = elements.aiReparseButton.querySelector('b');
  const originalButtonLabel = buttonLabel ? buttonLabel.textContent : '';
  elements.aiReparseButton.disabled = true;
  elements.aiReparseButton.setAttribute('aria-busy', 'true');
  if (buttonLabel) buttonLabel.textContent = 'AI 재파싱 중...';
  elements.gptResponseInput.disabled = true;
  setDataUploadStatus('ai-reparsing');
  const blockingOperation = openBlockingOperation({
    title: 'AI 2차 파싱 중',
    message: '업로드한 원문과 구조화 데이터를 비교해 보완하고 있습니다.',
    status: '업로드 준비를 위해 잠시만 기다려 주세요.'
  });

  let streamedText = '';
  const renderStreamProgress = () => {
    if (!elements.inputValidationResults) return;
    elements.inputValidationResults.hidden = false;
    elements.inputValidationResults.innerHTML =
      '<div class="input-validation-progress" role="status" aria-live="polite">AI(OpenRouter)가 실시간으로 응답을 생성하고 있습니다. 완료되면 입력창이 다시 열립니다...</div>' +
      `<pre class="input-validation-stream">${escapeHtml(streamedText)}</pre>`;
    const streamBox = elements.inputValidationResults.querySelector('.input-validation-stream');
    if (streamBox) streamBox.scrollTop = streamBox.scrollHeight;
  };
  renderStreamProgress();

  const restoreInputState = () => {
    elements.gptResponseInput.disabled = false;
    elements.aiReparseButton.removeAttribute('aria-busy');
    if (buttonLabel) buttonLabel.textContent = originalButtonLabel || 'AI 2차 파싱';
  };

  try {
    const response = await fetch('/api/records/llm-reparse/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: blockingOperation.signal,
      body: JSON.stringify({
        raw_markdown: rawMarkdown,
        json_text: split.jsonText || '',
        mode: expectedMode,
        issues: [...currentValidation.errors, ...currentValidation.warnings]
      })
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let data = null;
    let streamError = null;

    const handleBlock = (block) => {
      const parsed = parseSseEvent(block);
      if (!parsed) return;
      if (parsed.event === 'delta') {
        streamedText += parsed.data?.text || '';
        renderStreamProgress();
      } else if (parsed.event === 'retry') {
        streamedText = '';
        renderStreamProgress();
        if (elements.inputValidationResults) {
          const progress = elements.inputValidationResults.querySelector('.input-validation-progress');
          if (progress) progress.textContent = parsed.data?.message || 'AI 재파싱을 한 번 더 보완하고 있습니다.';
        }
      } else if (parsed.event === 'status') {
        if (elements.inputValidationResults) {
          const progress = elements.inputValidationResults.querySelector('.input-validation-progress');
          if (progress) progress.textContent = parsed.data?.message || 'AI 재파싱을 준비하고 있습니다.';
        }
      } else if (parsed.event === 'error') {
        streamError = parsed.data?.message || 'AI 재파싱 실패';
      } else if (parsed.event === 'done') {
        data = parsed.data;
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) handleBlock(block);
    }
    if (buffer.trim()) handleBlock(buffer);

    if (streamError) throw new Error(streamError);
    if (!data || !Array.isArray(data.records) || !data.records.length) {
      throw new Error('AI가 유효한 record를 반환하지 않았습니다.');
    }

    const correctedJsonValue = expectedMode === 'triage' ? data.records : data.records[0];
    const combinedText = `${rawMarkdown}\n\n--- JSON DATA ---\n${JSON.stringify(correctedJsonValue, null, 2)}\n`;
    elements.gptResponseInput.value = combinedText;
    if (['triage', 'full'].includes(expectedMode)) {
      state.dataUploadDrafts[expectedMode] = combinedText;
    }
    state.dataUploadLlmReparseFields = {
      input: combinedText,
      fieldsByIndex: (data.corrected_fields && typeof data.corrected_fields === 'object') ? data.corrected_fields : {}
    };

    closeBlockingOperation(blockingOperation.token);
    const result = await previewPastedReportParsing();
    const correctedCount = Object.values(state.dataUploadLlmReparseFields.fieldsByIndex)
      .reduce((total, fields) => total + (Array.isArray(fields) ? fields.length : 0), 0);
    const serverDerivedCount = Array.isArray(data.server_derived_adjustments)
      ? data.server_derived_adjustments.length
      : 0;
    if (correctedCount > 0) {
      result.warnings.push({
        level: 'warning',
        path: 'AI 2차 파싱',
        message: `AI가 원문 Markdown 기반으로 ${correctedCount}개 필드를 보완했습니다. 저장 시 원문 하단에 부정확할 수 있다는 안내가 자동으로 추가됩니다.`
      });
    }
    if (data.new_warning) {
      result.warnings.push({
        level: 'warning',
        path: 'AI 2차 파싱',
        message: `이번에 발견된 실수 패턴을 GPT 지침 ${expectedMode === 'triage' ? '1' : '2'} 하단 주의사항에 추가했습니다: "${data.new_warning}"`
      });
    }
    if (serverDerivedCount > 0) {
      result.warnings.push({
        level: 'warning',
        path: '대시보드 저장 규칙',
        message: `AI 재파싱 결과의 총점·판정 ${serverDerivedCount}개를 현재 대시보드 기준으로 자동 정렬했습니다.`
      });
    }
    if (correctedCount > 0 || data.new_warning || serverDerivedCount > 0) {
      renderInputValidation(result);
    }
    if (correctedCount > 0 && elements.inputValidationResults) {
      const diffHtml = renderAiReparseDiffPanel(split.records, data.records, state.dataUploadLlmReparseFields.fieldsByIndex);
      if (diffHtml) {
        elements.inputValidationResults.insertAdjacentHTML('beforeend', diffHtml);
      }
    }
  } catch (error) {
    closeBlockingOperation(blockingOperation.token);
    restoreInputState();
    if (blockingOperation.signal.aborted || error?.name === 'AbortError') {
      setDataUploadStatus('waiting');
      elements.aiReparseButton.disabled = !canRunAiReparse(validateCombinedInput(elements.gptResponseInput.value, expectedMode));
      return;
    }
    const failed = validateCombinedInput(elements.gptResponseInput.value, expectedMode);
    addInputIssue(failed.errors, 'error', 'AI 2차 파싱', formatAiReparseFailure(error));
    renderInputValidation(failed);
    setDataUploadStatus('error', failed.errors.length);
    elements.aiReparseButton.disabled = !canRunAiReparse(failed);
    return;
  }
  closeBlockingOperation(blockingOperation.token);
  restoreInputState();
}

async function saveStructuredJsonInput() {
  const expectedMode = activeTableMode() === 'triage' ? 'triage' : 'full';
  const validation = validateCombinedInput(elements.gptResponseInput.value, expectedMode);
  const reviewed = state.dataUploadReview?.input === elements.gptResponseInput.value
    ? state.dataUploadReview
    : null;
  validation.reuploadDecisions = reviewed?.reuploadDecisions || [];
  renderInputValidation(validation);
  if (!validation.canSave || !reviewed) {
    elements.saveJsonButton.disabled = true;
    if (elements.aiReparseButton) elements.aiReparseButton.disabled = !canRunAiReparse(validation);
    setDataUploadStatus(validation.canSave ? 'review-needed' : 'error', validation.errors.length);
    return;
  }

  const skippedIncomingIndexes = new Set(validation.reuploadDecisions.flatMap((decision) => {
    if (Array.isArray(decision.skipIncomingIndexes)) return decision.skipIncomingIndexes;
    return decision.skipIncoming && Number.isInteger(decision.incomingIndex) ? [decision.incomingIndex] : [];
  }));
  const recordsToSave = validation.records
    .map((record, inputIndex) => ({ record, inputIndex }))
    .filter(({ inputIndex }) => !skippedIncomingIndexes.has(inputIndex));
  const preservedAliases = validation.reuploadDecisions
    .filter((decision) => decision.skipIncoming && decision.preserveAssetAliases && decision.existingRecordId)
    .map((decision) => ({
      existing_record_id: decision.existingRecordId,
      asset: decision.asset || '',
      company: decision.company || '',
      preserve_asset_aliases: true
    }));
  const hasSkippedReupload = validation.reuploadDecisions.some((decision) => decision.skipIncoming);
  if (!recordsToSave.length && !preservedAliases.length) {
    elements.saveJsonButton.disabled = true;
    setDataUploadStatus('review-needed');
    return;
  }
  const llmReparseFields = state.dataUploadLlmReparseFields?.input === elements.gptResponseInput.value
    ? state.dataUploadLlmReparseFields.fieldsByIndex || {}
    : {};
  recordsToSave.forEach(({ record, inputIndex }) => {
    const existingSourceReport = isInputObject(record.source_report) ? record.source_report : {};
    const existingRaw = existingSourceReport.raw_markdown;
    const triage = detectInputRecordMode(record).mode === 'triage';
    const reparsedFields = llmReparseFields[String(inputIndex)];
    record.source_report = {
      ...existingSourceReport,
      raw_markdown: isPlaceholderRawMarkdown(existingRaw)
        ? validation.rawMarkdown
        : validation.rawMarkdown || existingRaw,
      source_format: existingSourceReport.source_format || (triage ? 'fast_triage_markdown' : 'gpt_markdown_report'),
      parser_status: existingSourceReport.parser_status || (triage ? 'fast_triage' : 'gpt_structured_output'),
      parser_note: existingSourceReport.parser_note || 'Dashboard unified GPT response input에서 Markdown과 JSON을 자동 분리해 저장함.',
      ...(Array.isArray(reparsedFields) && reparsedFields.length ? { llm_reparse_fields: reparsedFields } : {})
    };
  });

  const payload = {
    records: recordsToSave.map(({ record }) => record),
    confirmed_replacements: validation.reuploadDecisions
      .filter((decision) => decision.replaceExisting && !skippedIncomingIndexes.has(decision.incomingIndex))
      .map((decision) => ({
        incoming_record_id: decision.incomingRecordId,
        existing_record_id: decision.existingRecordId,
        preserve_asset_aliases: decision.preserveAssetAliases === true
      })),
    preserved_aliases: preservedAliases
  };

  elements.saveJsonButton.disabled = true;
  setDataUploadStatus('validating');
  try {
    const result = await runBlockingOperation({
      title: '파이프라인을 저장하고 있습니다',
      message: '업로드한 리포트와 구조화 데이터를 저장하고 대시보드를 갱신합니다.',
      status: '저장 뒤 Knowledge Wiki Map은 해당 탭의 새로고침으로 최신화할 수 있습니다.',
      ...(payload.confirmed_replacements.length ? {
        title: '기존 Pipeline을 덮어쓰고 있습니다',
        message: '웹 서칭 조사 내용을 최신 내용으로 덮어쓰기하는 중입니다.',
        status: '기존에 업로드된 파일과 Comments·Contact History 기록은 그대로 유지됩니다. Tab 0의 Comment·Contact History는 Advanced Research가 있으면 Tab 2, 없으면 Tab 1에 추가됩니다.'
      } : hasSkippedReupload ? {
        title: '기존 Pipeline을 유지하고 있습니다',
        message: '이번 조사 결과는 저장하지 않고, 선택한 기존 Pipeline을 유지합니다.',
        status: `${payload.preserved_aliases.length ? '유사 Asset·Company 이름은 검색용 메타데이터로 저장됩니다. ' : ''}Tab 0의 Comment·Contact History는 Advanced Research가 있으면 Tab 2, 없으면 Tab 1에 추가됩니다.`
      } : {})
    }, async (signal) => {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      });
      if (!response.ok) {
        const detailText = await response.text();
        let message = detailText || `HTTP ${response.status}`;
        try {
          message = JSON.parse(detailText).detail || message;
        } catch (_error) {
          // Keep the raw server response when it is not JSON.
        }
        throw new Error(message);
      }
      return response.json();
    });
    if (result === OPERATION_CANCELLED) {
      elements.saveJsonButton.disabled = false;
      setDataUploadStatus('review-needed');
      return;
    }
    const savedMessage = '저장 완료';
    renderInputValidation(validation, { savedMessage, wikiExportDeferred: Boolean(result?.exports?.deferred) });
    setDataUploadStatus('saved');
    state.dataUploadReview = null;
    state.dataUploadLlmReparseFields = null;
    state.dataUploadDrafts[expectedMode] = '';
    elements.gptResponseInput.value = '';
    elements.previewInputButton.disabled = true;
    if (elements.aiReparseButton) elements.aiReparseButton.disabled = true;
    elements.saveJsonButton.disabled = true;
    await loadRecords();
  } catch (error) {
    const failed = {
      ...validation,
      errors: [...validation.errors, { level: 'error', path: '서버 저장', message: error.message }],
      canSave: false
    };
    renderInputValidation(failed);
    setDataUploadStatus('error', failed.errors.length);
  }
}

const SHARED_EVIDENCE_DISCIPLINE = `Use only asset-specific facts explicitly provided by the user or verified from credible public sources.

Additional user context: the user may append meeting notes, hypotheses, internal observations, or a research request after the candidate list / company-and-asset input. Treat that text as user-provided context (Evidence Origin: user_text), not as verified public evidence. Consider it when choosing what to investigate and when interpreting directly stated facts, but do not treat it as independently confirmed, fabricate a URL, or let it override contradictory verified evidence. If user context is used, preserve it faithfully in input.user_context, add a readable Markdown note labelled "Source: User input (not independently verified)", and use user_input_only or user_input_and_public_source as appropriate. Do not put user input into validation.source_registry or criterion source_ids; those remain reserved for checked public URLs.

Canonicalize confirmed facts into approved dashboard values, but do not infer unconfirmed facts or completed/current status from plans, expectations, financing, hiring activity, adjacent programs, class assumptions, or general scientific knowledge.

General scientific knowledge may only be used to map confirmed facts to the scoring rubric. If a fact cannot be established or conflicting sources cannot be resolved, use Unknown and record the uncertainty.

Report readability and citations: never output ChatGPT/OpenAI internal citation tokens such as :contentReference[…], [oaicite:…], browser IDs, or HTML tags such as <br>. Use plain Markdown and actual http(s) URLs only. Put checked public sources in a readable References section using Markdown links or reference links; never substitute an internal citation marker for a URL.`;

const SHARED_INTEREST_AND_CORE_RUBRIC = `SKBP Interest Indications:
- Alzheimer's disease
- Parkinson's disease
- Amyotrophic lateral sclerosis / motor neuron disease
- Multiple sclerosis / neuroinflammatory disease
- Neuropathic pain
- Epilepsy / seizure disorders

Use the most specific confirmed indication wording for Target Relevance. Neuropathic pain and explicit neuropathic subtypes/synonyms are one of the six interest indications and receive TR 3. Generic Pain, acute pain, postoperative pain, and non-neuropathic pain are within the broad SKBP pain scope but outside the six priority indications and receive TR 2.

Shared TR / MoA / Data scoring rubric (use the same direction in Fast Triage v3.7 and Full Scout v3.8):
- For Target Relevance, always evaluate in descending order: 3, then 2, then 1, then 0. If more than one rule appears applicable, assign only the single highest applicable score.
- Target Relevance 0: asset identity is verified, but there is still insufficient indication/relevance information to assess strategic scope. Asset identity not verified is an INSUFFICIENT early stop, not a completed TR 0.
- Target Relevance 1: a verified asset's confirmed indication is outside the broad SKBP neurologic, psychiatric, neuroimmune, neurodegenerative, or pain scope.
- Target Relevance 2: a verified asset's confirmed indication is within that broad SKBP scope but outside the six priority interest indications.
- Target Relevance 3: a verified asset's confirmed indication is one of the six priority interest indications. Target/MoA disease-biology fit and Theme/Cluster are not TR score bases.
- MoA Validity 0: target or MoA cannot be confirmed.
- MoA Validity 1: mechanism description exists but is supported only by a company claim or theoretical rationale.
- MoA Validity 2: functional evidence shows the mechanism works, or independent same-target/class validation exists.
- MoA Validity 3: the assessed asset has target engagement, mechanism-linked PD/biomarker, or direct functional MoA validation. General clinical efficacy alone is not MoA 3.
- Data Maturity 0: no public asset-specific result.
- Data Maturity 1: only a qualitative claim or fragmentary result, insufficient for the confirmed stage.
- Data Maturity 2: at least one interpretable, quantitative, stage-appropriate evidence domain for the assessed asset.
- Data Maturity 3: at least two complementary, quantitative, stage-appropriate evidence domains, with at least one directly supporting program progression.

MoA evidence definitions:
- Functional evidence: an experiment shows the expected functional or downstream biological effect after the target or pathway is modulated.
- Same target/class validation: the target or mechanism is validated by another drug, an independent study, or the same class rather than by the assessed asset itself.
- Asset-specific validation: the assessed asset itself shows target engagement, a mechanism-linked PD/biomarker, or a direct functional effect.
- Generic clinical efficacy is not sufficient for MoA 3. Clinical evidence counts toward MoA 3 only when it is a mechanism-linked clinical PoC tied to the proposed mechanism.

Evidence domains answer different development questions, such as in vitro activity/selectivity, target engagement/PD, in vivo efficacy, PK/PD, safety/tolerability, or clinical outcome. Endpoints, doses, figures, or repeated sources from the same underlying experiment count as one domain. Potency and selectivity count as one in vitro characterization domain. One source may support two domains when it reports distinct development questions, such as in vivo efficacy and PK/PD. Human data are not required.`;

const SHARED_CANONICAL_STAGE_RULE = `Canonical Pipeline Stage — structured_table.development_stage must be exactly one of:
Hit Discovery; Lead Optimization; Preclinical Candidate; IND-enabling; Preclinical unspecified; IND filed/cleared; Clinical unspecified; Phase 1; Phase 1/2; Phase 2; Phase 2/3; Phase 3; Registration; Approved / marketed; Discontinued / inactive; Unknown.

Canonicalize only an explicitly confirmed current stage or a completed/started milestone. Do not promote stage from plans, expectations, targets, financing, hiring, or adjacent programs. Generic preclinical -> Preclinical unspecified. Candidate nominated/selected -> Preclinical Candidate. Ongoing GLP tox, IND-directed CMC, or explicit IND-enabling work -> IND-enabling. IND/CTA submitted, filed, accepted, effective, or cleared -> IND filed/cleared. An explicitly ongoing clinical/pivotal/registrational trial with no phase -> Clinical unspecified; never infer Phase 3 from "pivotal" or "registrational" alone. Hit ID/hit identification, an explicit research program/project, or an explicit discovery program/project -> Hit Discovery; FIH, Ph1, Ph1a, or Ph1b -> Phase 1; a confirmed Ph1b/2a -> Phase 1/2; FDA/EMA/NMPA approved -> Approved / marketed. Planned IND submission alone does not establish IND filed/cleared; "preclinical; IND planned" remains Preclinical unspecified. A planned Phase 2 or Phase 2/3 trial does not establish that phase: retain an explicitly confirmed earlier current phase, otherwise use Unknown. For multi-indication assets, use the lead/currently most advanced confirmed stage as the single dashboard value and move indication-specific status detail to evidence or notes; for example, "FOS Phase II recruiting; pain stage unclear" -> Phase 2. Map only explicitly confirmed discontinued, terminated, withdrawn, inactive, dormant, or abandoned programs to Discontinued / inactive. A suspended or halted program is not automatically terminal: retain the confirmed stage when available and record the pause in hard_filter.flags/notes; do not map it to Discontinued / inactive unless inactivity is independently confirmed. Do not map speculative wording such as "likely preclinical or dormant" or a different historical alias marked discontinued to the current asset's Discontinued / inactive status. Use Unknown only when the relevant current stage itself is unresolved or conflicting.`;

const SHARED_CANONICAL_MODALITY_RULE = `Canonical Modality — structured_table.modality_platform must be exactly one of: Targeted protein degrader, Oncolytic virus, Small molecule, Peptide, RNA therapy, Cell therapy, Gene therapy, Antibody, Protein biologic, Microbiome therapy, Vaccine, Radiopharmaceutical, Natural product, Exosome / EV Therapy, Others, or Unknown.
Preserve the researched wording in structured_table.modality_source and use the canonical label in modality_platform. Examples: "TPD", "PROTAC", "molecular glue degrader", "SNIPER", "AUTOTAC", and "LYTAC" -> Targeted protein degrader; "oral small molecule" -> Small molecule; "oral small-molecule / tablet" and "small-molecule CNS discovery platform" -> Small molecule; "IV antibody" -> Antibody; "topical peptide" -> Peptide; "live biotherapeutic product" -> Microbiome therapy. Route, dosage form, and technical qualifiers belong in MoA, source evidence, company_profile.platform_summary, or notes. modality_tags may contain multiple supported canonical labels only when the source explicitly evidences a hybrid format (for example, an antibody-targeted degrader can carry Antibody and Targeted protein degrader); never place raw labels such as TPD or PROTAC in modality_tags.`;

const SHARED_CANONICAL_INDICATION_RULE = `Canonical Main Indication — structured_table.main_indication must be exactly one of: Alzheimer's disease; Parkinson's disease; Lewy body dementia; Epilepsy / seizure disorders; Multiple sclerosis / neuroinflammatory disease; Amyotrophic lateral sclerosis / motor neuron disease; Frontotemporal dementia; Huntington's disease; Stroke; Migraine / headache disorders; Pain; Major depressive disorder; Schizophrenia / psychosis; Bipolar disorder; Anxiety disorders; Autism spectrum disorder; ADHD; Sleep / wake disorders; Chronic cough; Inflammatory bowel disease; Systemic lupus erythematosus; Other autoimmune / inflammatory disease; Spinal cord injury; Spinal muscular atrophy; or Unknown.
main_indication is mandatory. Never omit the key and never use null, an empty string, N/A, or an unnormalized disease phrase. If the lead can be determined, always write its canonical dashboard bucket. Use Unknown only when the lead genuinely cannot be distinguished after the following priority.
When several indications are confirmed, retain every confirmed disease wording in structured_table.indication and provide structured_table.indication_list as its canonical array; do not replace confirmed indications with Unknown.
Lead-indication selection priority: (1) use an indication explicitly identified as lead, primary, initial, or the sole current indication for the assessed asset on an official company pipeline page or current official company material; (2) if no official lead is designated, use the indication targeted by the single most advanced confirmed active clinical program, comparing only registered, started, recruiting, ongoing, or dosed programs; (3) if no lead can still be established but one or more confirmed indications are listed, set main_indication to the first canonical indication in the source's textual/listed order and preserve every canonical indication in indication_list. Never select an indication merely because it appears first before applying this priority. Use Unknown only when no confirmed canonical indication is available. Exclude planned/expected indications, competitor programs, historical or discontinued programs, and platform-expansion claims.
Keep complete disease wording and all secondary indications in structured_table.indication and Markdown. In Markdown state the source-based reason for the selected lead or source-order fallback. Examples: "Lead disclosed indication: inflammatory bowel disease; expansion potential for MS" -> Inflammatory bowel disease; "FOS Phase 2 recruiting; MDD planned; pain stage unclear" -> Epilepsy / seizure disorders; "CNS hypotheses include stroke and status epilepticus; no official lead or active trial" -> Unknown.`;

const SHARED_CANONICAL_THEME_RULE = `Canonical R&D Theme — json_summary.theme must be exactly one of E/I Balance, Neuroimmune, Protein Homeostasis, Others, or Unknown. Determine Theme from researched evidence for the assessed asset's target and MoA, not from disease association alone.
Use Protein Homeostasis only when the target/MoA directly modulates proteostasis, such as protein folding or chaperone function, ubiquitin-proteasome activity, autophagy-lysosome function, ER stress/UPR, or pathogenic protein aggregate clearance. The mere presence of protein aggregates in a disease does not establish this Theme. Use Others only when the identified target/MoA is confirmed outside all three R&D Themes, and Unknown when target/MoA evidence is insufficient. Because no Protein Homeostasis sub-cluster taxonomy is approved yet, use cluster="Unknown" for this Theme. Never use N/A or No Theme.
When Theme is Others, cluster must also be Others. When Theme is Unknown, cluster must also be Unknown.`;

const SHARED_CANONICAL_CLUSTER_RULE = `Allowed Theme values:
- E/I Balance
- Neuroimmune
- Protein Homeostasis
- Others (identity-verified asset confirmed outside E/I Balance, Neuroimmune, and Protein Homeostasis)
- Unknown (target or MoA evidence insufficient to map)

Allowed clusters:
- E/I Balance: Ion Channel, Inhibitory Tone 강화, Synaptic Transmission, Chloride Homeostasis, Network Modulation
- Neuroimmune: CNS 손상 면역반응, 교세포 향상성, Cytokine 신경조절, 손상/질환 면역조절, 말초 면역기관 연결
- Protein Homeostasis: Unknown (no approved sub-cluster taxonomy yet)`;

const COMPACT_TRIAGE_JSON_TEMPLATE = `[
  {
    "meta": {
      "ingestion_format": "compact_v2",
      "review_type": "fast_triage"
    },
    "input": {
      "company_input": "Unknown",
      "asset_input": "",
      "user_context": ""
    },
    "json_summary": {
      "theme": "Unknown",
      "cluster": "Unknown",
      "target_description": ""
    },
    "structured_table": {
      "company": "Unknown",
      "asset_name": "",
      "target": "Unknown",
      "moa": "Unknown",
      "modality_platform": "Unknown",
      "main_indication": "Unknown",
      "indication": "Unknown",
      "development_stage": "Unknown",
      "company_country": "Unknown",
      "sources": []
    },
    "hard_filter": {
      "status": "INSUFFICIENT",
      "reason": "",
      "flags": [],
      "decision_uncertainty": false
    },
    "triage": {
      "status": "INSUFFICIENT",
      "identity_verified": false,
      "verified_public_source_count": 0,
      "why": "Asset identity has not yet been verified from credible public sources.",
      "missing_evidence_needed_for_full_scout": []
    },
    "scoring": {
      "criteria": {
        "target_relevance": {
          "score": 0,
          "evidence_type": "triage_only",
          "evidence_type_reason": "",
          "evidence_basis": "no_supporting_basis",
          "main_line_summary": "TR 0 points: asset-specific evidence has not been established.",
          "why_not_higher": "",
          "investigation_note": "",
          "uncertain_points": [],
          "source_ids": []
        },
        "moa_validity": {
          "score": 0,
          "evidence_type": "triage_only",
          "evidence_type_reason": "",
          "evidence_basis": "no_supporting_basis",
          "main_line_summary": "MOA 0 points: asset-specific mechanism evidence has not been established.",
          "why_not_higher": "",
          "investigation_note": "",
          "uncertain_points": [],
          "source_ids": []
        },
        "data_maturity": {
          "score": 0,
          "evidence_type": "triage_only",
          "evidence_type_reason": "",
          "evidence_basis": "no_supporting_basis",
          "main_line_summary": "Data 0 points: no asset-specific result has been established.",
          "why_not_higher": "",
          "investigation_note": "",
          "uncertain_points": [],
          "source_ids": []
        }
      }
    },
    "validation": {
      "uncertain_points": [],
      "cross_checked_facts": [],
      "source_registry": []
    },
    "final_insight": {
      "one_line_summary": "",
      "recommendation": "Verify asset identity",
      "most_important_diligence_question": ""
    }
  }
]`;

const COMPACT_FULL_SCOUT_JSON_TEMPLATE = `{
  "meta": {
    "ingestion_format": "compact_v2",
    "review_type": "full_scout"
  },
  "input": {
    "company_input": "Unknown",
    "asset_input": "",
    "user_context": ""
  },
  "company_profile": {
    "headquarters": "",
    "company_stage": "",
    "platform_summary": ""
  },
  "json_summary": {
    "theme": "Unknown",
    "cluster": "Unknown",
    "target_description": ""
  },
  "structured_table": {
    "company": "Unknown",
    "asset_name": "",
    "target": "Unknown",
    "moa": "Unknown",
    "modality_platform": "Unknown",
    "main_indication": "Unknown",
    "indication": "Unknown",
    "development_stage": "Unknown",
    "company_country": "Unknown",
    "sources": []
  },
  "hard_filter": {
    "status": "FAIL",
    "reason": "",
    "flags": [],
    "hard_blocker": false,
    "decision_uncertainty": false
  },
  "scoring": {
    "criteria": {
      "target_relevance": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "evidence_basis": "",
        "main_line_summary": "",
        "why_not_higher": "",
        "investigation_note": "",
        "uncertain_points": [],
        "source_ids": []
      },
      "moa_validity": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "evidence_basis": "",
        "main_line_summary": "",
        "why_not_higher": "",
        "investigation_note": "",
        "uncertain_points": [],
        "source_ids": []
      },
      "data_maturity": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "evidence_basis": "",
        "main_line_summary": "",
        "why_not_higher": "",
        "investigation_note": "",
        "uncertain_points": [],
        "source_ids": []
      },
      "competitive_landscape": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "evidence_basis": "",
        "main_line_summary": "",
        "why_not_higher": "",
        "investigation_note": "",
        "uncertain_points": [],
        "source_ids": []
      },
      "platform_attractiveness": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "evidence_basis": "",
        "main_line_summary": "",
        "why_not_higher": "",
        "investigation_note": "",
        "uncertain_points": [],
        "source_ids": []
      },
      "expansion_potential": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "evidence_basis": "",
        "main_line_summary": "",
        "why_not_higher": "",
        "investigation_note": "",
        "uncertain_points": [],
        "source_ids": []
      },
      "marketability": {
        "score": 0,
        "evidence_type": "E0_not_found_or_not_assessable",
        "evidence_type_reason": "",
        "evidence_basis": "",
        "main_line_summary": "",
        "why_not_higher": "",
        "investigation_note": "",
        "uncertain_points": [],
        "source_ids": [],
        "calculation": {
          "commercial_rationale_status": "insufficient_evidence",
          "commercial_rationale_failure_reason": "",
          "A_targetable_addressable_patient": {
            "targetable_addressable_patient": null,
            "formula": "US TAP = US Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate"
          },
          "B_unrisked_peak_sales": {
            "unrisked_peak_sales": null,
            "sales_unit": "million USD",
            "formula": "US Unrisked Peak Sales = US TAP x Benchmark Annualized Net Price x Peak Penetration x Treatment Duration Factor"
          },
          "C_obtainable_peak_sales": {
            "obtainable_peak_sales": null,
            "sales_unit": "million USD",
            "formula": "US Obtainable Peak Sales = US Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment"
          },
          "D_global_obtainable_peak_sales": {
            "source_geography": "US",
            "global_multiplier": 1.5,
            "global_obtainable_peak_sales": null,
            "sales_unit": "million USD",
            "formula": "Global Obtainable Peak Sales = US Obtainable Peak Sales x 1.5"
          }
        }
      }
    }
  },
  "competitive_analysis": {
    "competitive_density": "Unknown",
    "similarity_summary": {
      "similar_pipeline_count": 0,
      "high_similarity_count": 0,
      "medium_similarity_count": 0,
      "low_similarity_count": 0
    },
    "competitor_table": [],
    "similar_pipelines": []
  },
  "validation": {
    "uncertain_points": [],
    "cross_checked_facts": [],
    "source_registry": []
  },
  "final_insight": {
    "one_line_summary": "",
    "recommendation": "Deprioritize",
    "most_important_diligence_question": ""
  }
}`;

function replaceInstructionJsonTemplate(prompt, compactTemplate, finalMarker) {
  const templateEnd = prompt.lastIndexOf(finalMarker);
  const templateStart = prompt.lastIndexOf('\n--- JSON DATA ---', templateEnd);
  if (templateStart < 0 || templateEnd < 0 || templateStart >= templateEnd) return prompt;
  return `${prompt.slice(0, templateStart)}\n--- JSON DATA ---\n\n${compactTemplate}\n\`\`\`${prompt.slice(templateEnd)}`;
}

function buildTriageInstructionPromptLegacy() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Run FAST TRIAGE on biotech/pharma pipeline assets. The purpose is to decide which assets should proceed to the full SKBP Pipeline Finder v3.8 in-depth review.

This is GPT instruction 1: Fast Triage v3.7.
Use GPT instruction 2 only after a candidate receives SELECT and needs Full Scout v3.8 review.

Evidence Discipline (apply to every factual field and every score):
${SHARED_EVIDENCE_DISCIPLINE}

Keep user-provided facts separate from facts actually verified in public sources. A URL is not verified merely because it was supplied or appeared in search results; count it only after checking the source content and confirming that it supports the assessed asset and claim.

Core rule:
- Do not create a full scout report.
- Do not evaluate all 7 SKBP criteria.
- Do not build a full competitive landscape table.
- Do not calculate marketability.
- Do not estimate peak sales.
- Do not perform full diligence.
- Only perform quick source-aware triage.

Important distinction:
- Triage status is not a final Full Scout recommendation.
- SELECT means worth sending to Full Scout v3.8.
- REJECT means the asset is identified but does not currently meet the SELECT gate; monitor or gather more evidence.
- INSUFFICIENT means identity/lifecycle caused an early stop, or one of TR, MoA, or Data received 0 after identity was confirmed.
- A REJECT or INSUFFICIENT result can change later if better identity, target, MoA, data, company, or source evidence becomes available.

Input:
The user may provide structured rows copied from Excel/TSV/CSV/plain text or a simple asset list.
Each entry may include asset name, target, MoA, company, therapeutic area, indication, Pipeline Stage, region/country, notes, and source URL.
The input may contain 1 to 50 entries. If more than 50 entries are provided, process only the first 50 and state this in the markdown block.
If no candidate entry is provided, ask for an asset list and do not invent records.

Common Asset + Company list format:
- Treat every non-empty line as one independent candidate.
- The asset/product name normally comes first and the company name comes last.
- A tab or two-or-more spaces may separate Asset from Company.
- Preserve spaces inside multi-word asset and company names.
- If repeated spaces collapse to one space, infer the company from the rightmost organization-like phrase (for example Inc, Corp, Ltd, Therapeutics, Pharmaceutical, Pharma, Biotech, Biology) and verify it during the quick search.
- A comma inside the asset field can represent an alias and must not create a new row. Example: "IBSM01,ibiome    Ibiome Biology" is one candidate.
- If a line contains only an asset name, keep company as Unknown at input and search that asset independently to identify the company.
- Never merge adjacent lines, even when company names repeat.
- Return exactly one Markdown table row and one JSON record per parsed candidate, in the original order.

Examples of valid input:
Drug to Inhibit Tau for Alzheimer’s Disease    Hyper Corp Inc
MDR-652    Hyper Corp Inc
Drug to Inhibit IL1B for Alzheimer's Disease    Hyper Corp Inc
HBW-015    Hyperway Pharmaceutical
HBW-3-20    Hyperway Pharmaceutical
IBNI10    Ibiome Biology
IBSM01,ibiome    Ibiome Biology

Asset-only input is also valid:
MDR-652
HBW-015
IBNI10

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
- When evidence is ambiguous, apply each criterion's exact rule and record unresolved factual conflicts as Unknown.
- If credible public sources cannot verify the named item as a specific biotech/pharma pipeline asset, classify it as INSUFFICIENT.

Early stop rules:
- Apply INSUFFICIENT before scoring only when the asset identity itself cannot be verified as a biotech/pharma pipeline asset, or a terminal lifecycle is confirmed. Missing target, MoA, indication, or stage alone does not make an asset identity unverified; use Unknown and continue scoring.
- A suspended or halted program needs a pause-status note and active-status confirmation; it is not an automatic early stop.
- For identity or terminal-lifecycle early stops, keep the markdown and research depth short. Do not perform additional target/MoA/data research, full diligence, marketability, competitor landscaping, or extended source chasing.
- For an identity early stop, set hard_filter.reason and triage.why exactly to "Asset identity not verified from public biotech/pharma sources." For a lifecycle early stop, set hard_filter.reason and triage.why to a short "Lifecycle stopped: ..." statement with the confirmed status and source.
- In the Markdown table, write \`—\` for TR, MoA, and Data for either early-stop case. Early stop never shortens the required dashboard JSON contract: every record must still contain all three TR/MoA/Data criterion score objects. Use score 0 only as a schema placeholder with no_supporting_basis, keep scoring.total_score and max_score null, and do not describe the placeholder as a completed zero-score evaluation. The status is INSUFFICIENT.

Triage scoring:
- Use the same scoring direction as Full Scout v3.8, but only for these three matching criteria:
  - Full Scout criterion 1: Target Relevance (TR)
  - Full Scout criterion 3: MoA Validity (MOA)
  - Full Scout criterion 6: Data Maturity (Data)
- Assign preliminary integer scores only: 0, 1, 2, or 3. Do not output ranges such as 1-2.
- Use evidence_type="triage_only". Do not assign E0-E4 or require Full Scout-length source trails.
- The difference from GPT instruction 2 is depth, not scoring direction: instruction 1 is a fast preliminary read; instruction 2 is the full evidence-based review.

${SHARED_INTEREST_AND_CORE_RUBRIC}

Criterion Evidence Basis:
- For each TR/MoA/Data judgment, identify one evidence basis in the Markdown reasoning: user_input_only, public_source, user_input_and_public_source, or no_supporting_basis.
- user_input_only: only facts explicitly present in the user's row/input were used. Do not add an unprovided target, cell type, MoA, or data claim to main_line_summary.
- public_source: only public sources that you actually opened and verified were used.
- user_input_and_public_source: both explicit user input and actually verified public sources were used.
- no_supporting_basis: neither user input nor verified public sources support the score.
- Put complete citations and evidence detail in Markdown. Compact v2 JSON keeps a concise audit projection: put each actually checked source once in validation.source_registry using source_id, source_title, source_url, source_type, and verified; criterion objects reference those entries with source_ids and must not duplicate evidence_sources. Keep structured_table.sources as []; the dashboard derives its Source column from validation.source_registry. source_url_not_provided, Unknown, blank/null, or an unchecked URL do not count as verified public URLs.
- public_source and user_input_and_public_source require at least one unique verified http(s) URL. user_input_only and no_supporting_basis must contain zero verified public URLs.
- score >= 2 cannot use no_supporting_basis. MoA >= 2 and Data >= 2 each require at least one citable, verified public technical/source URL for that criterion. TR may preliminarily score from explicit user input.
- Each Compact v2 criterion keeps score, evidence_type="triage_only", evidence_type_reason, evidence_basis, a one-sentence main_line_summary, why_not_higher, investigation_note, uncertain_points, and source_ids. Begin main_line_summary with exactly one matching score label: "TR N points:", "MoA N points:", or "Data N points:" (N must equal that JSON criterion's score). Keep detailed quantitative evidence (percentages, ratios, sample sizes, phases, and asset codes) in Markdown reasoning or investigation_note whenever possible; never state another criterion's score in main_line_summary.
- MoA score 2 or 3 only: write at most one sentence in that criterion's investigation_note stating whether evidence already identified while scoring connects to a disease-relevant phenotype, efficacy, or biomarker, or remains limited to proximal evidence such as a cellular-signaling marker. Omit this sentence for MoA score 0 or 1. If existing evidence cannot distinguish this, write "확인 불가". Do not infer or perform a new search for this note; it records context only and does not change the score.
- triage.verified_public_source_count must exactly equal the unique verified public URL count after removing duplicates and trailing-slash variants. It is retained only for the Quick Summary card; source count itself does not determine the score.
- Copy the exact user/company identifiers into input.company_input and input.asset_input. These two aliases are used only to join the Fast Triage and Full Scout rows for the same asset. When the user appended relevant free-text context, copy it faithfully into input.user_context; otherwise keep user_context as an empty string.

Summary rule:
- In the Markdown table/notes, each criterion judgment must be a non-empty 1–2 sentence explanation containing the confirmed asset-specific fact, why it maps to the selected score, and the key limitation.
- State the single score once in a criterion-labelled prefix (for example, "TR 2 points:") and never use a score range. The score prefix must match the JSON score; scientific/clinical numbers in the rest of the sentence are evidence, not scores.
- General disease biology alone cannot explain an asset score. For user_input_only, do not introduce facts absent from the user input.

Triage status rule:
- There is no separate active/inactive field. structured_table.development_stage is the sole activity signal: Discontinued / inactive is a confirmed early stop; every other canonical stage value, including Unknown, proceeds to normal TR/MoA/Data scoring.
- SELECT only if identity_verified=true, development_stage is not Discontinued / inactive, TR >= 3, MoA >= 1, and Data >= 2.
- INSUFFICIENT if asset identity is not verified, development_stage is confirmed Discontinued / inactive, or any of TR, MoA, or Data is 0 after identity is confirmed.
- REJECT for every remaining identity-verified, non-terminal candidate that does not meet SELECT.
- If unsure between SELECT and REJECT, choose REJECT and explain the missing evidence needed.

Controlled vocabulary:
- For an identity-verified asset, use Unknown when country, Pipeline Stage, modality, main indication, target, or another factual field cannot be established. INSUFFICIENT is reserved for the defined early stops or a completed core-criterion score of 0.
- company_country is the company's HQ / official company location, never the drug, sales, market, trial, or launch geography. Use the documented HQ where a single country is required; for example, "China / United States operations" -> China. It may otherwise retain up to two explicitly stated canonical countries, separated by \` / \`. If no canonical country can be identified, retain the original wording rather than replacing it with Unknown.
${SHARED_CANONICAL_INDICATION_RULE}
${SHARED_CANONICAL_STAGE_RULE}
${SHARED_CANONICAL_MODALITY_RULE}
${SHARED_CANONICAL_INDICATION_RULE}
- structured_table.indication must preserve the most specific confirmed wording (for example, diabetic peripheral neuropathic pain). Use that detailed indication—not the broader main_indication bucket—for TR and the neuropathic-pain rule.
${SHARED_CANONICAL_THEME_RULE}
${SHARED_CANONICAL_CLUSTER_RULE}

Output language:
Korean. English is allowed for scientific terms.

Final output format:
The final answer must contain exactly one copyable fenced code block. Inside that single block, put the Markdown report first, then the single separator line shown in the template below, then the raw JSON array. Do not create inner Markdown or JSON fences.
The TAB1 importer splits on that exact separator and parses the entire suffix once. Therefore the JSON suffix must be one complete top-level array, not several JSON objects or partial fragments.

\`\`\`text
# SKBP Fast Triage Result

> Version statement: This result was researched and scored with GPT instruction 1 — Fast Triage v3.7. Full Scout v3.8 has not been run.

중요: 한 문장으로 triage 결론과 filter rationale을 먼저 씁니다. 예: 공개 자료상 asset identity는 확인되지만 개발 단계가 Discontinued / inactive로 확인되어 INSUFFICIENT로 처리합니다.

| # | Asset | Company | Target/MoA | Modality | Main indication | Pipeline Stage | Location | TR | MOA | Data | Triage | Why | Source |
|---:|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| 1 |  |  |  |  |  |  |  |  |  |  | SELECT/REJECT/INSUFFICIENT |  |  |

## Notes
- Keep notes short.
- Mention only source uncertainty, duplicate rows, or reason to run Full Scout.

--- JSON DATA ---

[
  {
    "meta": {
      "schema_version": "3.2",
      "instruction_version": "3.7",
      "rubric_version": "3.7",
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
    "parser_note": "GPT instruction 1 Fast Triage v3.7 output. Full Scout v3.8 review has not been run."
    },
    "json_summary": {
      "company": "Unknown",
      "asset_name": "",
      "target": "Unknown",
      "theme": "Unknown",
      "cluster": "Unknown",
      "target_relevance_score": 0,
      "one_line_summary": "Asset-specific evidence has not yet been established.",
      "company_country": "Unknown"
    },
    "structured_table": {
      "company": "Unknown",
      "asset_name": "",
      "target": "Unknown",
      "moa": "Unknown",
      "modality_platform": "Unknown",
      "main_indication": "Unknown",
      "indication": "Unknown",
      "development_stage": "Unknown",
      "company_country": "Unknown",
      "sources": []
    },
    "hard_filter": {
      "status": "INSUFFICIENT",
      "reason": "Asset identity has not yet been verified from credible public sources.",
      "flags": []
    },
    "triage": {
      "instruction_version": "3.7",
      "status": "INSUFFICIENT",
      "identity_verified": false,
      "why": "Asset identity has not yet been verified from credible public sources.",
      "missing_evidence_needed_for_full_scout": []
    },
    "scoring": {
      "total_score": null,
      "max_score": null,
      "criteria": {
        "target_relevance": {
          "score": 0,
          "evidence_type": "triage_only",
          "evidence_basis": "no_supporting_basis",
          "main_line_summary": "TR 0점: asset identity and indication evidence have not been established.",
          "evidence_sources": [],
          "verified_public_source_count": 0,
          "uncertain_points": []
        },
        "moa_validity": {
          "score": 0,
          "evidence_type": "triage_only",
          "evidence_basis": "no_supporting_basis",
          "main_line_summary": "MOA 0점: asset-specific target or mechanism evidence has not been established.",
          "evidence_sources": [],
          "verified_public_source_count": 0,
          "uncertain_points": []
        },
        "data_maturity": {
          "score": 0,
          "evidence_type": "triage_only",
          "evidence_basis": "no_supporting_basis",
          "main_line_summary": "Data 0점: no public asset-specific result has been established.",
          "evidence_sources": [],
          "verified_public_source_count": 0,
          "uncertain_points": []
        }
      }
    },
    "validation": {
      "instruction_version": "3.2",
      "version_statement": "Researched and scored with GPT instruction 1 — Fast Triage v3.7; Full Scout v3.8 not run.",
      "cross_checked_facts": [],
      "uncertain_points": [],
      "source_registry": []
    },
    "final_insight": {
      "one_line_summary": "Asset identity must be verified before Full Scout.",
      "recommendation": "Verify asset identity",
      "most_important_diligence_question": ""
    }
  }
]
\`\`\`

Remember:
- Output only the single fenced code block described above containing both sections.
- Keep Markdown first and JSON second inside that same block, using the template separator exactly once.
- Do not include prose outside the single code block and do not add nested fences.
- The separator must appear exactly once on its own line.
- The JSON suffix must start with [ and end with ]. Use 2-space indentation; do not minify it.
- Before answering, parse-check the complete JSON suffix: matched braces/brackets, double-quoted keys and strings, escaped line breaks inside strings, no comments, no trailing commas, no placeholder alternatives, and no truncation.
- Every URL is a JSON string: write "source_url": "https://example.com/path". Never write an unquoted URL such as "source_url": https://example.com/path.
- Write score/count fields as JSON numbers, never quoted numeric strings. Escape any double quote, backslash, or line break that appears inside a JSON string value.
- Keep source_report.raw_markdown as an empty string because the dashboard inserts the Markdown portion. Keep JSON summaries concise and do not duplicate full Markdown paragraphs across multiple fields.
- For one input entry, output a JSON array with one object.
- For multiple input entries, output one JSON array item per candidate in the original order, up to 50.
- Do not leave pipe-delimited template choices such as "SELECT | REJECT | INSUFFICIENT" in the final JSON; choose exactly one allowed value.
- Recommendation mapping is exact: SELECT -> "Run Full Scout"; REJECT -> "Monitor / gather more evidence"; INSUFFICIENT -> "Do not run Full Scout".
- Keep hard_filter.decision_uncertainty=false for Fast Triage; its status is determined by identity, activity, and the three scores.
- The user will copy this one combined block and paste it once into the dashboard; the dashboard will split the Markdown and JSON automatically.
- Do not include Full Scout-only criteria, marketability, competitor tables, or peak sales.`;
}

function buildTriageInstructionPrompt() {
  const prompt = buildTriageInstructionPromptLegacy();
  return replaceInstructionJsonTemplate(prompt, COMPACT_TRIAGE_JSON_TEMPLATE, '\nRemember:')
    .replace(
      'Keep source_report.raw_markdown as an empty string because the dashboard inserts the Markdown portion.',
      'Use meta.ingestion_format="compact_v2". JSON contains dashboard columns, chart/filter values, scores, concise hover/audit fields, and source-ID references; full research narrative stays in Markdown. Put each checked source once in validation.source_registry, reference it from criteria with source_ids, never duplicate evidence_sources, and keep structured_table.sources as []. The dashboard derives the Source column, inserts the Markdown, and derives totals/version boilerplate. json_summary.target_description is the one short target-card description used by the dashboard; do not copy full research paragraphs into JSON.'
    );
}

function buildGptInstructionPromptLegacy() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Evaluate exactly one biotech/pharma pipeline asset through company research, attachment review, public-source verification, competitor search, seven-criterion scoring, and evidence tracking. Return exactly one copyable fenced code block containing the Markdown report first and the valid JSON second.

This is GPT instruction 2: Full Scout v3.8. State v3.8 in the Markdown report as the original-report provenance, not as a later dashboard score-recalculation notice. In compact JSON, do not repeat schema/instruction/rubric version fields; the dashboard adds schema 3.2 and instruction/rubric 3.8 during deterministic expansion.

Evidence Discipline (apply to every factual field and every scoring criterion):
${SHARED_EVIDENCE_DISCIPLINE}

Required input: Company name and Asset name.
Optional input: user-provided or company-supplied PDF, PPT, Excel, or text attachments. Review readable attachment content first and cross-check with public web sources when needed. Unread or unchecked file regions are not evidence.

Evidence has independent dimensions:
- Evidence Type (content level): E0_not_found_or_not_assessable; E1_company_claim_or_scientific_rationale_only; E2_indirect_or_class_level_evidence; E3_asset_specific_preclinical_or_technical_evidence; E4_asset_specific_clinical_evidence.
- Evidence Origin: public_web; user_uploaded_file; user_text.
- Optional source_nature: company_generated; independent; regulatory; clinical_registry; analyst_generated; unknown.

Judge Evidence Type by content, not origin. Asset-specific quantitative PK/efficacy in a company deck may be E3 and asset-specific clinical PK/PD/efficacy may be E4; an independent paper covering only the same target/class is E2; a user estimate is an analyst assumption, not evidence. Company material is never independent evidence. Attachment evidence may support any of the seven criteria or Marketability when its content directly meets that criterion's rule. For file evidence record file_name; page, slide, sheet, or section; evidence_summary; supported_criterion; evidence_type; evidence_origin; and source_nature.

Do not treat a URL as verified unless you opened it and confirmed that it supports the assessed asset and claim. Separate user-provided facts, company claims, independent/class evidence, asset-specific evidence, and analyst assumptions throughout.

SKBP Interest Indications:
- Alzheimer's disease
- Parkinson's disease
- Amyotrophic lateral sclerosis / motor neuron disease
- Multiple sclerosis / neuroinflammatory disease
- Neuropathic pain
- Epilepsy / seizure disorders

For Target Relevance, score 0 only when identity is verified but indication/relevance information remains insufficient; score 1 for a confirmed asset outside the broader SKBP neurological/psychiatric/neuroimmune/neurodegenerative/pain scope; score 2 for that broader scope but outside the six priority indications; and score 3 for one of the six priority indications. Generic Pain, acute pain, postoperative pain, and non-neuropathic pain are broad-scope TR 2, while neuropathic pain is priority TR 3. Identity-not-verified is an INSUFFICIENT early stop, not a completed TR score.

${SHARED_CANONICAL_STAGE_RULE}

Company: [COMPANY_NAME]
Asset / drug / pipeline name: [ASSET_NAME]
Output language: Korean. English is allowed for scientific terms.

Identity Gate / identity-not-verified early stop:
- Before writing the full report, first verify whether the input appears to be a real biotech/pharma pipeline asset.
- Use only a short identity check at this gate. Check for at least one credible biotech source type: official company/pipeline page, clinical trial registry, regulatory source, peer-reviewed publication, reputable biotech news, company presentation, patent/source that clearly links the asset to a drug target or indication.
- Fail this gate only when the named asset itself cannot be verified as a specific biotech/pharma pipeline asset from credible public sources. Missing target, MoA, modality, indication, stage, country, or ownership does not fail the gate; write Unknown for that factual field, record the uncertainty, and continue the full review and scoring.
- If search results are mostly unrelated SKUs, tools, electronics, finance tickers, unrelated abbreviations, or ambiguous non-drug references and no credible source verifies a specific drug-development asset, classify it as identity not verified.
- If the asset identity is not verified, stop Full Scout and return FAIL / Deprioritize. Set hard_filter.reason exactly to "Asset identity not verified from public biotech/pharma sources." A confirmed terminal lifecycle must be represented only by structured_table.development_stage="Discontinued / inactive"; that canonical stage is the sole lifecycle status gate. Suspended or Halted alone is a pause signal, not a terminal lifecycle conclusion.
- Lifecycle-confirmed early stop: after verifying the asset identity and one credible terminal lifecycle source, set structured_table.development_stage="Discontinued / inactive" and stop the Full Scout. Keep the Markdown short: state the confirmed inactive status, source, and any known stop reason/date. Do not perform additional target/MoA/data research, competitive landscaping, marketability, expansion, or extended source chasing. Set hard_filter.reason to a short "Lifecycle stopped: ..." statement. Keep the required Compact v2 JSON contract with hard_filter.status="FAIL", hard_filter.hard_blocker=true, final_insight.recommendation="Deprioritize", and concise zero-score/uncertainty entries where deeper diligence was intentionally skipped. In either early-stop case, show \`—\` for every score in Markdown; JSON score 0 values are schema placeholders only, not completed zero-score evaluations. For a suspended/halted program, retain a confirmed stage where available, otherwise use Unknown; continue the completed assessment and document the pause.
- Uncertain rights or exact stage alone is REVIEW, not automatic FAIL.
- In the identity-not-verified case, the final answer must still be exactly one combined fenced code block, but both the Markdown and JSON portions must be short.
- Identity-not-verified markdown block format:
  - Title: "# Pipeline Scout Result — Asset Identity Not Verified: **[ASSET_NAME]**"
  - One-line conclusion: "Public-source identity check did not verify this as a biotech/pharma pipeline asset."
  - Include only 3 short bullets: what was searched, what was found, what source would be needed to proceed.
  - Include references only for the few sources that explain the non-match or ambiguity.
- Identity-not-verified JSON block format:
  - Keep the complete compact_v2 structure shown in the single final JSON template; it contains only dashboard-visible values and scores.
  - Keep meta.ingestion_format="compact_v2" and meta.review_type="full_scout"; the dashboard adds version, total, and source-report fields deterministically.
  - Set hard_filter.status to "FAIL".
  - Set hard_filter.reason to "Asset identity not verified from public biotech/pharma sources."
  - Include all seven scoring.criteria objects with score 0 and the Compact v2 hover/audit fields. Use E0, concise gap/why-not-higher text, empty source_ids when nothing was verified, and keep the full explanation in Markdown.
  - For Marketability, keep the JSON score at 0 and explain insufficient evidence plus any unavailable A/B/C/D inputs in Markdown.
  - Set final_insight.recommendation to "Deprioritize".
  - structured_table.development_stage must be "Unknown" when stage is not established; never use null, an empty string, or N/A for that field. Use "Unknown", null, or [] as appropriate for other unknown factual fields and sources. Do not invent placeholders.

Non-negotiable rules:
1. Final answer format must be exactly one \`\`\`text fenced code block. Inside it, place either the complete Markdown report or the short identity-not-verified Markdown first, then the single separator line shown immediately before the final JSON template below, then the corresponding structured JSON object. Do not create inner Markdown or JSON fences.
2. Do not write any report prose outside the single combined code block.
3. The TAB2 importer splits on the exact separator and parses the complete suffix once. The JSON portion must be exactly one complete top-level object beginning with { and ending with }: no comments, no trailing commas, no extra object, and no Markdown outside JSON string values.
4. Every factual claim used for scoring must include a checked public source URL, an explicit "Source: User input (not independently verified)" label, or a clear uncertainty note.
5. Include actual URLs in Markdown reference-link format at the end of the Markdown block. Do not emit :contentReference[…], [oaicite:…], browser citation IDs, or HTML tags; internal citation tokens are not usable sources. In Compact v2 JSON, put each checked source once in validation.source_registry with source_id, source_title, source_url, source_type, and verified. Reference it from criteria and competitor rows with source_ids. Do not emit evidence_sources or duplicate source objects. Keep structured_table.sources as []; the dashboard derives its Source column from validation.source_registry.
6. Distinguish official company sources, peer-reviewed papers, regulatory/clinical trial sources, market sources, and news/financing sources.
7. For every criterion, Compact v2 JSON contains the integer score plus only these concise display/audit fields: evidence_type, evidence_type_reason, evidence_basis, main_line_summary, why_not_higher, investigation_note, uncertain_points, and source_ids. Keep each string short and keep the complete evidence discussion in Markdown.
8. Competitive Landscape Markdown must include the complete search and analysis. JSON keeps competitive_density, the four similarity counts, competitor_table rows needed by the competitor graph, and similar_pipelines needed by the existing comparison view. competitor_table row keys are competitor_asset, company, modality, target_or_moa, stage, similarity_level, why_it_matters, source_url, and source_ids. similar_pipelines row keys are company, asset_name, similarity_score, matched_dimensions, and shared_data_points.
9. Marketability may use an internal calculation, an external forecast, both, or insufficient evidence. Show A/B/C/D when calculation is performed; show external forecast references when used.
10. Express every sales output in million USD in Markdown. JSON keeps the final Marketability score plus only the minimal A/B/C/D output projection used for score audit and detail display; complete inputs and rationale stay in Markdown.
11. Hard Filter is canonical: PASS when Total >= 14, Target Relevance >= 3, MoA Validity = 3, and Data Maturity = 3. FAIL when Total <= 8 or any of Target Relevance, MoA Validity, or Data Maturity is 0. REVIEW is every completed assessment that meets neither PASS nor FAIL. Asset identity not verified and a confirmed terminal lifecycle are early-stop cases, not completed score assessments.
11a. Set hard_filter.hard_blocker=true only for a confirmed FAIL blocker. Set hard_filter.decision_uncertainty=true only when stage, rights/license/ownership, asset identity, source/registry, sponsor, or active-program uncertainty prevents an otherwise firm decision. These booleans keep Filter 2 deterministic after research prose stays in Markdown.
11b. Copy the exact assessed company and asset identifiers into input.company_input and input.asset_input. These two aliases are used only to join the Fast Triage and Full Scout rows for the same asset. When the user appended relevant free-text context, copy it faithfully into input.user_context; otherwise keep user_context as an empty string.
12. If the latest stage, ownership, financing, or trial status is unclear, mark it as uncertain and state what source is needed.
13. Do not invent URLs. If a URL cannot be verified, describe the missing source in Markdown and validation.uncertain_points.
14. Work out commercial_rationale_status, method, A/B/C/D, and any external forecast in Markdown. Put the resulting 0–3 score and the minimal A/B/C/D output projection shown in the Compact v2 template in JSON.
15. The JSON template defaults Marketability to score 0. A reliable calculation or asset-specific external forecast may support scores 1–3; document the complete method and numbers in Markdown.
16. Keep source_report.raw_markdown as an empty string because the dashboard inserts the Markdown portion. Do not add keys not present in the Compact v2 template; research details already present in Markdown must not be duplicated in JSON.

Scoring v3.8 rules:
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
- Explain in Markdown why the score was not one point higher.
- Clearly distinguish company claims, indirect/class-level evidence, and asset-specific evidence.
- Do not output score ranges such as 0-1, 1-2, or 2-3.
- If evidence is ambiguous, select the single closest score and explain uncertainty in Markdown plus validation.uncertain_points when it affects the dashboard decision.

Criterion-specific scoring (canonical; do not replace with a universal evidence ladder):
- Target Relevance — 0: asset identity is verified but indication/relevance information remains insufficient; 1: confirmed indication outside the broad SKBP neurologic/psychiatric/neuroimmune/neurodegenerative/pain scope; 2: confirmed indication within that broad scope but outside the six priority interests; 3: confirmed indication is one of the six priority interests. Generic Pain, acute pain, postoperative pain, and non-neuropathic pain are TR 2; neuropathic pain is TR 3. Target/MoA disease-biology fit and Theme/Cluster are classification or MoA information, not TR score bases.
- MoA Validity — 0: target or MoA unconfirmed; 1: company claim or theoretical rationale only; 2: functional evidence or independent same-target/class validation; 3: assessed-asset target engagement, mechanism-linked PD/biomarker, or direct functional validation.
- Data Maturity — 0: no asset-specific result in public sources or readable attachments; 1: qualitative claim or fragmentary result only; 2: at least one asset-specific quantitative evidence domain appropriate to the current stage; 3: at least two complementary quantitative domains addressing different development questions, with at least one directly supporting program progression. Source count, endpoint count, and repeated presentations of one experiment do not create extra domains.
- Competitive Landscape evaluates competitive position and differentiation only; patient counts, price, market size, and peak sales belong only to Marketability. Record broader/reference competitors separately from direct competitors: a direct competitor has substantially aligned intended indication, target/pathway intervention, and therapeutic effector mechanism. This classification and competitor count do not determine the score. Score 0: search scope/evidence insufficient to judge appropriate comparators and the competitive context; 1: competitors found but differentiation is claim/concept only with no asset-specific quantitative comparison; 2: asset-specific quantitative differentiation versus an appropriate benchmark comparator, or a realistic entry space supported by a clear unresolved need in current care and asset-specific target/MoA, route, safety, or access evidence; unmet need, market size, or company positioning claim alone is insufficient. Score 3: Score-2 evidence plus assessed-asset direct head-to-head quantitative comparison against an appropriate comparator in matched or comparable preclinical or clinical conditions confirms material advantage. Material advantage is a quantitatively meaningful difference that is decision-relevant against that comparator; do not treat a trivial numerical difference as material. Never award 3 from a cross-study comparison, claim, no-competitor finding, or competitor count alone. Search at minimum: asset name/aliases; same indication + target/MoA; same indication + pathway/biology; approved, Phase 3, clinical, and major preclinical competitors; trial registries; and recent review, official-pipeline, or patent sources. Record search scope and limitations.
- Platform Attractiveness evaluates a reusable technical system whose common principles/design/manufacturing/delivery can generate multiple candidates/programs or improve performance. Score 0: no reusable structure or verifiable technical advantage; 1: reusable structure with plausible rationale but claim/concept-level differentiation; 2: at least one quantitative result showing technical advantage versus an appropriate comparator, normally limited to a single condition or platform-derived asset; 3: score-2 evidence plus either (a) the same quantitative advantage reproduced across multiple independent conditions (for example, model, species, or dose) or officially linked platform-derived assets, or (b) an officially linked platform-derived asset has reached First Patient Dosed. FPD alone is insufficient without score-2 quantitative evidence. Do not award points merely for preferred modality, indication expansion, multiple assets, or pipeline breadth.
- Expansion Potential evaluates only additional indications for the assessed asset beyond its main indication. Score 0: none confirmed; 1: additional indication with biological rationale only and no asset-specific data or official development program; 2: asset-specific early quantitative efficacy, PD, or biomarker data in at least one additional indication; 3: asset-specific early quantitative efficacy, PD, or biomarker data and an official preclinical, IND-enabling, or clinical assessed-asset program are both confirmed in the same additional indication. Multiple additional indications are not required for Score 3. An official program may be separately listed on the official pipeline or be confirmed as active preclinical, IND-enabling, trial registration/authorization, or dosing; it is not limited to clinical development. Future opportunity, possible/planned evaluation, an indication list, platform-level expansion not tied to the asset, wording variants of one disease, and patient subgroups are not separate programs/indications. Do not award points for platform reuse, multiple platform assets, or platform breadth.

Investigation-note requirements (use only the evidence already identified while scoring; do not perform a new search for these notes):
- MoA score 2 or 3: in that criterion's investigation_note, use at most one sentence to state whether the verified scoring evidence connects to a disease-relevant phenotype, efficacy, or biomarker, or remains limited to proximal evidence such as a cellular-signaling marker. Omit this statement for MoA score 0 or 1. If the distinction cannot be assessed from existing evidence, write '확인 불가'; do not infer.
- Expansion Potential score 1, 2, or 3: in that criterion's investigation_note, state whether the confirmed additional indication(s) are single or multiple and briefly give each indication's assessed-asset program/data status. If unavailable from existing scoring evidence, write '확인 불가'; do not infer.

Marketability method and score (document complete inputs in Markdown; JSON keeps the score and minimal A/B/C/D outputs):
- assessment_method is exactly calculation, external_forecast, both, or insufficient_evidence. Do not force A/B/C/D when no reliable internal calculation exists.
- score_basis_type must equal calculation for assessment_method calculation or both, external_forecast for external_forecast, and insufficient_evidence for insufficient_evidence. When both exist, calculation is the primary score basis and external forecast is a cross-check.
- calculation_status is performed for calculation or both, and not_performed for external_forecast or insufficient_evidence.
- assessed global peak sales determines score: 0 only when neither a reliable calculation nor external forecast exists; 1 when < 1000; 2 when >= 1000 and < 2000; 3 when >= 2000 million USD. Do not use weak-market language, expansion strength, or mandatory A/B/C/D completeness as alternate thresholds.
- Internal calculation covers one lead/main indication and uses the United States base: A. US TAP = US Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate; choose prevalence or annual incidence appropriately and state why. B. US Unrisked Peak Sales = US TAP x Benchmark Annualized Net Price x Peak Penetration x Treatment Duration Factor. Annualize benchmark net price by therapy type (chronic annual price; short course price x annual courses; episodic administration price x annual administrations; one-time net price). Use annual incidence or peak-year treatable cohort for one-time therapy when appropriate. Treatment Duration Factor defaults to 1.0 unless persistence/discontinuation/actual duration evidence supports adjustment. C. US Obtainable Peak Sales = US Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment. Benchmark price is the unadjusted price of the closest approved therapy/standard of care; apply asset-specific efficacy, safety, convenience, frequency, monitoring, or modality premium/discount only in Pricing Power Adjustment, never twice. Competition Haircut reflects competitor count, lead, expected entry order, and asset differentiation.
- D. Global Obtainable Peak Sales = completed C. US Obtainable Peak Sales x 1.5. This is a user-defined screening policy applied once, never to TAP, price, penetration, or another factor.
- Remove Expansion Capacity Adjustment from the formula. If schema compatibility requires the field, fix it at 1.0, mark it deprecated, and never use it in the score. Do not run sensitivity analysis.
- Record reliable asset-specific external peak-sales forecasts from independent analysts, consensus databases, reputable market research, or a company forecast containing a concrete number. Non-quantitative “blockbuster potential” is not a score basis. In Markdown state source name/type/date, geography, forecast year, peak sales or range, URL, confidence, and normalized Global value. Normalize a US forecast x 1.5 and leave a Global forecast unchanged. For a range, score the midpoint and retain low/high. Explain a material calculation/forecast gap in one sentence.
- Write every sales value in Markdown as numeric million USD. External-only assessment may state that A/B/C/D was not performed.
- For calculation or both, show the complete A/B/C/D inputs, formulas, units, sources, and outputs in Markdown. Rates and competition haircut must be between 0 and 1. Compact v2 JSON emits only the four output values and formulas shown in its minimal calculation object; do not duplicate full calculation inputs there.

For every criterion rationale state compactly: criterion definition, selected score, core selected-score rule, why the asset meets it, key evidence, and key gap/why not higher. Platform technical advantage and assessed-asset Data Maturity are separate; do not double-count one fact with the same meaning.

Controlled vocabulary for dashboard filters:
- Use canonical values for filter-facing fields so the dashboard can group comparable assets.
- For an identity-verified asset, use Unknown (never N/A) when country, Pipeline Stage, modality, main indication, target, or another factual field cannot be established from public sources.
${SHARED_CANONICAL_THEME_RULE}
- json_summary.company_country and structured_table.company_country mean the company's HQ / official company location, not a drug, sales, market, trial, or launch geography. Use the documented HQ where a single country is required; for example, "China / United States operations" -> China. They may otherwise retain up to two explicitly stated canonical countries/regions, separated by \` / \`. Examples: China, Republic of Korea, United States, Japan, Europe/UK. Preserve unrecognized country wording rather than replacing it with Unknown.
${SHARED_CANONICAL_INDICATION_RULE}
- structured_table.development_stage must follow the Canonical Pipeline Stage rule above. Put exact raw wording, trial status, indication-specific stage, and future milestone timing in source evidence, notes, or validation.uncertain_points.
- Map clinical synonyms conservatively: P1/Ph1/Phase I/FIH -> Phase 1 and P2/Ph2/Phase II -> Phase 2 only when the phase is current or started. A future plan must not be promoted to current stage.
${SHARED_CANONICAL_MODALITY_RULE}
- Map synonymous or narrower terms into the same bucket. Examples: partial-onset seizure, focal-onset seizure, epilepsy, and status epilepticus -> Epilepsy / seizure disorders; RCC, UCC, refractory chronic cough, and unexplained chronic cough -> Chronic cough; Crohn's disease and ulcerative colitis -> Inflammatory bowel disease.

Use this exact report structure inside the Markdown portion of the single combined code block:

# [Company] Pipeline Scout Report: **[Asset]**

Include this short provenance statement near the top: "Original report provenance: researched and scored with GPT instruction 2 — Full Scout v3.8 (schema v3.2); URLs are included for auditability." Do not add later recalculation dates or revision history to the original report; the dashboard records those separately in change history.

중요: 한 문장으로 filter/recommendation rationale을 먼저 씁니다. 예: 공개 자료상 active asset명·compound code·임상 단계가 명확히 확인되지 않아 stage/ownership은 uncertain / REVIEW로 처리합니다.

## 1) Company Profile

| Field | Content | Evidence |
|---|---|---|
| Company |  | Official company site URL |
| Legal name / aliases |  | Official company site or registry |
| Location (company HQ) |  | Official company site / company profile |
| Headquarters |  | Official company site / company profile |
| Website |  | URL |
| Company type / stage | private/public, biotech stage | company page, financing, news |
| Focus areas |  | official company description |
| Platform summary |  | platform page / publication |
| Financing / partnership signals |  | press release / investor news |
| Lead pipeline summary |  | official pipeline page |

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
| Pipeline Stage |  | official pipeline page, clinical trial registry, company deck, or uncertainty note |
| Key data |  | paper / abstract / poster / company page URL |

${SHARED_CANONICAL_CLUSTER_RULE}

## 3) Scorecard Summary

| Criterion | Score (maximum 3 points each) | One-line judgment | Evidence used |
|---|---:|---|---|
| Target Relevance | [single score]점 |  | URL/source |
| MoA Validity | [single score]점 |  | URL/source |
| Data Maturity | [single score]점 |  | URL/source |
| Competitive Landscape | [single score]점 |  | URL/source |
| Platform Attractiveness | [single score]점 |  | URL/source |
| Expansion Potential | [single score]점 |  | URL/source |
| Marketability | [single score]점 | State method, score basis, and assessed global peak sales | URL/source |
| **Total** | **[total]점** | Maximum total: 21점 |  |

## 4) Criterion Detail Pages

### 4.1 Target Relevance
Score:
Main line:

What was checked:
- Target identity
- Disease/biology relevance
- General neurodegeneration / neuroinflammation / epilepsy relevance

Evidence trail:
- Include specific facts and URLs.

Investigation note:
- Explain why this score was selected instead of adjacent scores.

### 4.2 MoA Validity
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
- Score 2 or 3: in one sentence, state whether the evidence already used for scoring connects to a disease-relevant phenotype, efficacy, or biomarker, or remains limited to a proximal measure such as a cellular-signaling marker. If that distinction is not supported by existing evidence, write '확인 불가'; do not infer or search anew for this note. Do not write this distinction for Score 0 or 1.

### 4.3 Data Maturity
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

### 4.4 Competitive Landscape
Score:
Main line:

What was checked:
- Appropriate benchmark comparators
- Direct competitors and broader/reference competitors
- Comparator stage, model, dose, route, and endpoint compatibility
- Approved / Phase 3 / clinical / preclinical status

Competitor table:

| Competitor | Company | Modality | Target / MoA | Pipeline Stage | Why it matters | Source |
|---|---|---|---|---|---|---|

Investigation note:
- Record search scope and distinguish direct competitors from broader/reference competitors; competitor count alone does not determine the score.
- For Score 3, document the matched or comparable head-to-head conditions, the compared quantitative result, and why the observed difference is material.

### 4.5 Platform Attractiveness
Score:
Main line:

What was checked:
- Is the platform real and reproducible?
- Is differentiation supported by data?
- Is the underlying technical system reusable across candidates, programs, or conditions?
- Is the same quantitative advantage reproduced across multiple independent conditions (for example, model, species, or dose) or officially linked platform-derived assets?

Evidence trail:
- Cite platform page, paper, patent, data page, or company technical material.

Investigation note:
- 2점 이상이면 the data supporting differentiation must be explicit.

Platform vs Data Maturity separation:
- Platform Attractiveness evaluates platform-level technical advantage and may use evidence from other assets officially linked to the same platform.
- Data Maturity evaluates only the assessed asset's stage-appropriate development evidence.
- A 2-point Platform score requires at least one quantitative experimental result directly testing the claimed technical advantage against an appropriate comparator, normally in a single condition or platform-derived asset.
- A 3-point Platform score first requires the 2-point evidence and then either the same advantage reproduced across multiple independent conditions/officially linked platform-derived assets, or First Patient Dosed for an officially linked platform asset.
- First Patient Dosed alone is insufficient without the 2-point quantitative technical evidence.
- IND clearance, trial registration, financing, patent, MOU, or partnership announcement alone is insufficient for 3 points.
- The same endpoint must not be double-counted in Platform Attractiveness and Data Maturity.

### 4.6 Expansion Potential
Score:
Main line:

What was checked:
- Expansion beyond main indication
- Asset-specific quantitative data in additional indications
- Confirmed asset-specific preclinical, IND-enabling, or clinical development programs

Evidence trail:
- Cite pipeline page, platform page, company deck, publication, or press release.

Investigation note:
- Adjacent indication means outside the main indication, not merely a different wording of the same disease.
- Future/planned opportunities, indication lists, platform-wide expansion, and patient subgroups are not separate active programs or indications.
- Score 1, 2, or 3: state whether confirmed additional indications are single or multiple and briefly give each indication's assessed-asset program/data status. Use only evidence already identified for this score; if insufficient, write '확인 불가' without inference or a new search.

### 4.7 Marketability
Score:
Main line:
Assessment method: calculation / external_forecast / both / insufficient_evidence
Score basis type:
Assessed global peak sales (million USD):

What was checked:
- Internal A/B/C/D calculation, if performed
- Reliable asset-specific external peak-sales forecast, if available
- Competition haircut and pricing power without double counting

Worksheet:

| Step | What to fill | Evidence / assumption |
|---|---|---|
| A. US TAP (calculation only) | US Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate | epidemiology source and prevalence/incidence rationale |
| B. US Unrisked Peak Sales (calculation only) | US TAP x Benchmark Annualized Net Price x Peak Penetration x Treatment Duration Factor | price source and assumptions |
| C. US Obtainable Peak Sales (calculation only) | US Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment | competition and asset-specific pricing evidence |
| D. Global Obtainable Peak Sales (calculation only) | C. US Obtainable Peak Sales x 1.5 once | user-defined screening policy |
| External Peak Sales Reference | source, date, geography, year, value/range, normalized global value, confidence | source URL |
| Final score basis | 0 no reliable method; 1 < 1000; 2 >= 1000 and < 2000; 3 >= 2000 million USD | assessed global value |

Investigation note:
- Marketability is based on obtainable peak sales, not rNPV.
- Show A/B/C/D only when calculation was performed; do not fabricate unavailable analysis.
- When both methods exist, use calculation as the primary score basis and external forecast as a cross-check.
- All sales outputs must be in million USD.

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

## 6) Final Take

One-line summary:

Recommendation:
- Shortlist / Watch / Deprioritize

Most important diligence question:

## References

Use Markdown reference links:
[1]: https://example.com "Source title"

End the Markdown portion after References. The next line in this template is the sole separator; after it, write the raw JSON object with no inner JSON fence. Fill it with the same facts, scores, reasons, source URLs, competitor evidence, and Marketability assumptions used in the Markdown report. The user will copy this one combined block and paste it once into the dashboard, which will automatically split the Markdown and JSON portions. Do not add any prose outside the single block.

--- JSON DATA ---

{
  "meta": {
    "schema_version": "3.2",
    "instruction_version": "3.8",
    "review_type": "full_scout",
    "generated_at": "YYYY-MM-DD",
    "language": "ko",
    "analyst_role": "[OIT] PreC Pipeline Shortlister",
    "output_format": ["markdown_report", "json"],
    "output_filename_base": "Company_Asset_YYYYMMDD",
    "rubric_version": "3.8",
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
    "parser_note": "GPT instruction 2 Full Scout v3.8 output using schema v3.2; Markdown report and JSON were generated together from the same evidence set."
  },
  "company_profile": {
    "company_name": "",
    "legal_name": "",
    "aliases": [],
    "country": "",
    "headquarters": "",
    "website": "",
    "founded_year": null,
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
    "company": "Unknown",
    "asset_name": "",
    "target": "Unknown",
    "theme": "Unknown",
    "cluster": "Unknown",
    "target_relevance_score": 0,
    "one_line_summary": "Asset-specific evidence has not yet been established.",
    "company_country": "Unknown"
  },
  "structured_table": {
    "company": "Unknown",
    "asset_name": "",
    "target": "Unknown",
    "moa": "Unknown",
    "modality_platform": "Unknown",
    "main_indication": "Unknown",
    "indication": "Unknown",
    "development_stage": "Unknown",
    "company_country": "Unknown",
    "sources": []
  },
  "hard_filter": {
    "status": "FAIL",
    "reason": "Default template state: replace with the evidence-based Full Scout decision.",
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
        "main_line_summary": "State the assessment method, score basis, and assessed global peak sales.",
        "what_was_checked": ["Internal calculation", "External peak-sales forecast", "Competition haircut", "Pricing power"],
        "assessment_method": "insufficient_evidence",
        "score_basis_type": "insufficient_evidence",
        "assessed_global_peak_sales_musd": null,
        "calculation_status": "not_performed",
        "calculated_global_obtainable_peak_sales_musd": null,
        "external_peak_sales_references": [],
        "external_normalized_global_peak_sales_musd": null,
        "calculation": {
          "commercial_rationale_status": "insufficient_evidence",
          "commercial_rationale_failure_reason": "No reliable internal calculation or asset-specific external peak-sales forecast was established.",
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
            "expansion_capacity_adjustment": 1.0,
            "expansion_capacity_adjustment_status": "deprecated_fixed_at_1.0_not_used",
            "sales_unit": "million USD",
            "formula": "US Obtainable Peak Sales = US Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment; output in million USD",
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
    "competitive_density": "Unknown",
    "competitive_search_complete": false,
    "search_scope_checked": [],
    "search_limitations": [],
    "direct_competitors": [],
    "broader_competitors": [],
    "similarity_summary": {
      "similar_pipeline_count": 0,
      "high_similarity_count": 0,
      "medium_similarity_count": 0,
      "low_similarity_count": 0,
      "summary": ""
    },
    "competitor_table": [],
    "similar_pipelines": [],
    "differentiation_points": [],
    "analysis_summary": ""
  },
  "validation": {
    "cross_checked_facts": [],
    "uncertain_points": [],
    "attachment_evidence_registry": [],
    "source_registry": []
  },
  "final_insight": {
    "one_line_summary": "",
    "recommendation": "Deprioritize",
    "most_important_diligence_question": ""
  },
  "obsidian": {
    "note_title": "Company Asset",
    "tags": ["pipeline", "skbp"],
    "aliases": []
  }
}

Final validation before output:
- Keep the Markdown version statement at instruction/rubric 3.8. The dashboard deterministically adds JSON schema 3.2 and instruction/rubric 3.8.
- Internally verify that the seven integer criterion scores sum correctly; the dashboard derives total_score and max_score.
- Apply PASS >= 14 plus TR >= 3, MoA = 3, and Data = 3. Apply FAIL for Total <= 8 or any TR/MoA/Data score of 0. Apply identity and terminal-lifecycle early-stop rules before completing the scorecard.
- Do not infer Competitive Landscape 3 from no competitors; record search sufficiency, scope, and limitations.
- Keep Platform and Expansion separate; accept preclinical, IND-enabling, or clinical programs for Expansion 3, but not plans or indication lists.
- Permit Marketability from calculation or a reliable external forecast alone. Do not double-count benchmark price and pricing power inputs.
- Exclude Expansion Capacity and sensitivity from calculation. Apply x1.5 exactly once to completed US calculation or US external forecast, never to an already-Global forecast.
- Markdown and JSON use identical seven criterion scores. Complete methods, numeric calculations, evidence, and rationale remain in Markdown; JSON retains only the concise criterion hover/audit projection and canonical source references shown in the Compact v2 template.
- No conflicting legacy rule or unresolved template placeholder remains.

Remember:
- Output only one \`\`\`text fenced code block, with no prose outside it.
- Keep Markdown first and JSON second inside that same block, using the template separator exactly once.
- Do not add nested Markdown or JSON fences.
- The separator must appear exactly once on its own line.
- The JSON suffix must start with { and end with }. Use 2-space indentation; do not minify it.
- Before answering, parse-check the complete JSON suffix: matched braces/brackets, double-quoted keys and strings, escaped line breaks inside strings, no comments, no trailing commas, no unresolved placeholders, no extra text after the final }, and no truncation.
- Every URL is a JSON string: write "source_url": "https://example.com/path". Never write an unquoted URL such as "source_url": https://example.com/path.
- Write every score, count, patient, rate, adjustment, and sales field as a JSON number, never a quoted numeric string. Escape any double quote, backslash, or line break inside JSON string values.
- Cross-check Marketability in Markdown before output: method, score basis, calculation status, A/B/C/D or external forecast, assessed value, and the 0/1/2/3 score threshold must agree with the JSON score.
- The dashboard accepts the entire combined response in the single "GPT 지침 2 전체 응답" input and splits both portions automatically.`;
}

function buildGptInstructionPrompt() {
  const prompt = buildGptInstructionPromptLegacy();
  return replaceInstructionJsonTemplate(prompt, COMPACT_FULL_SCOUT_JSON_TEMPLATE, '\nFinal validation before output:')
    .replace(
      'Keep source_report.raw_markdown as an empty string because the dashboard inserts the Markdown portion.',
      'Use meta.ingestion_format="compact_v2". JSON contains dashboard columns, chart/filter values, seven scores, concise hover/audit fields, canonical source references, and the minimal competitor/similar-pipeline rows used by visuals. Complete evidence, calculations, and rationale stay in Markdown. Put each checked source once in validation.source_registry, reference it with source_ids, never duplicate evidence_sources, and keep structured_table.sources as []. The dashboard derives the Source column, inserts the Markdown, and derives totals/version boilerplate. json_summary.target_description is the one short target-card description used by the dashboard; do not copy full research paragraphs into JSON.'
    );
}

function buildGptInstructionPromptCompact() {
  return buildGptInstructionPrompt();
}
async function fetchInstructionWarnings() {
  try {
    const response = await fetch('/api/instruction-warnings');
    if (!response.ok) return { triage: [], full: [] };
    const data = await response.json();
    return {
      triage: Array.isArray(data.triage) ? data.triage : [],
      full: Array.isArray(data.full) ? data.full : []
    };
  } catch (error) {
    return { triage: [], full: [] };
  }
}

function appendInstructionWarnings(prompt, warnings) {
  if (!Array.isArray(warnings) || !warnings.length) return prompt;
  const lines = warnings.map((text) => `- ${text}`).join('\n');
  return `${prompt}\n\n## 반복 방지 주의사항 (자동 누적 — 과거 AI 2차 파싱에서 발견된 오류 패턴)\n아래는 과거 붙여넣기에서 실제로 발생했던 단순 파싱/구조 실수입니다. 이번 응답에서 같은 실수를 반복하지 마세요:\n${lines}`;
}

let instructionWarningsCache = { triage: [], full: [] };
let instructionWarningsRequest = null;

function refreshInstructionWarnings() {
  if (instructionWarningsRequest) return instructionWarningsRequest;
  instructionWarningsRequest = fetchInstructionWarnings()
    .then((warnings) => {
      instructionWarningsCache = warnings;
      return warnings;
    })
    .finally(() => { instructionWarningsRequest = null; });
  return instructionWarningsRequest;
}

async function copyTextDuringUserGesture(text) {
  try {
    // This call is deliberately made before awaiting any network request.
    await navigator.clipboard.writeText(text);
    return;
  } catch (clipboardError) {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    try {
      scratch.select();
      const copied = document.execCommand('copy');
      if (!copied) throw clipboardError;
    } finally {
      scratch.remove();
    }
  }
}

async function copyPromptToClipboard(kind = 'full') {
  const button = kind === 'triage' ? elements.copyTriagePromptTopButton : elements.copyPromptTopButton;
  const idleLabel = kind === 'triage' ? '지침 1' : '지침 2';
  const label = button?.querySelector('b');
  if (label) label.textContent = '복사 중…';
  try {
    const basePrompt = kind === 'triage' ? buildTriageInstructionPrompt() : buildGptInstructionPrompt();
    const prompt = appendInstructionWarnings(basePrompt, kind === 'triage' ? instructionWarningsCache.triage : instructionWarningsCache.full);
    await copyTextDuringUserGesture(prompt);
    setPromptCopyFeedback(kind);
    void refreshInstructionWarnings();
    return true;
  } catch (error) {
    if (label) label.textContent = '복사 실패';
    if (elements.promptCopyStatus) elements.promptCopyStatus.textContent = '지침 복사 실패';
    window.setTimeout(() => {
      if (label) label.textContent = idleLabel;
    }, 3000);
    return false;
  }
}

function setPromptCopyFeedback(kind = 'full') {
  if (elements.promptCopyStatus) {
    elements.promptCopyStatus.textContent = kind === 'triage' ? 'Simple Research 지침 복사 완료' : 'Advanced Research 지침 복사 완료';
  }

  const button = kind === 'triage' ? elements.copyTriagePromptTopButton : elements.copyPromptTopButton;
  if (!button) return;

  const label = button.querySelector('b');
  const idleLabel = kind === 'triage' ? '지침 1' : '지침 2';
  const idleTooltip = kind === 'triage' ? TRIAGE_PROMPT_TOOLTIP : `GPT Advanced Research v${LATEST_FULL_SCOUT_RUBRIC_VERSION} 지침을 복사합니다. Simple Research에서 SELECT된 asset을 심층 검토할 때 사용합니다.`;
  if (label) {
    label.textContent = '복사됨';
  }
  button.dataset.tooltip = kind === 'triage'
    ? `GPT Simple Research v${LATEST_TRIAGE_RUBRIC_VERSION} 지침을 복사했습니다.`
    : `GPT Advanced Research v${LATEST_FULL_SCOUT_RUBRIC_VERSION} 지침을 복사했습니다.`;

  window.clearTimeout(promptCopyFeedbackTimer);
  promptCopyFeedbackTimer = window.setTimeout(() => {
    if (label) {
      label.textContent = idleLabel;
    }
    button.dataset.tooltip = idleTooltip;
  }, 3000);
}

// --- Step 0 진척 현황 (independent panel, not a real tableMode) ---

const STEP0_GUIDE_STEPS = [
  {
    title: 'Listing input 관련 정보 Collect',
    body: 'Company와 Asset은 필수입니다. 그 외 추가 정보가 있다면 엑셀 표에 정리해 주세요.',
    example: 'AddPharma\tKR\tAD-302\tSmall molecule\tTarget X\tALS\tPreclinical\tBD 검토 필요\t8/20 담당자 연락',
    afterExample: 'Contact의 경우 O, 날짜가 있을 경우 체크되며, X·-·빈칸은 연락 이력 없음으로 표시됩니다.'
  },
  {
    title: 'Listing Input 관련 Excel 정보 여러 행·열을 한 번에 붙여넣기',
    intro: '엑셀 표 첫 행은 Listing input table의 Column Title 내용을 포함해 주세요. (예: Company, Location, Asset, Modality 등)',
    outro: '엑셀 표 첫 행(Column Title)과 함께 Pipeline list 표 전체를 그대로 복사 붙여넣기 하면, Listing input의 각 셀에 맞는 정보로 매칭됩니다.',
    excelIllustration: true,
    headerMappings: [
      ['Drug Name / Pipeline Code', 'Asset'],
      ['Company Geography / Location / Country', 'Location'],
      ['Drug Geography / Sales Geography', '제외'],
      ['Company Name / Organization', 'Company'],
      ['Pipeline / Drug / Asset name', 'Asset'],
      ['Development Stage', 'Stage']
    ]
  },
  {
    title: '가져오기',
    body: '신규 Pipeline을 Listing 합니다. 가져오는 중 특정 Pipeline이 이미 Simple Research나 Advanced Research가 수행되었다면, 기존 서칭 기록을 유지합니다. Comment·Contact History는 따로 추가됩니다.'
  },
  {
    title: '조사 대기 항목 GPT 1 Simple Research 웹서칭 준비',
    body: '조사 대기중인 파이프라인을 여러 개 선택한 뒤 {{copy}}를 누르세요. 선택한 후보 목록과 입력된 Modality·Target 등의 보조 정보가 Simple Research 지침 1에 함께 포함됩니다.',
    actions: [
      { token: 'copy', kind: 'copy-instructions', icon: 'clipboard', label: 'GPT 지침 복사' }
    ]
  }
];

const STEP0_GUIDE_STEP_ICONS = ['file-text', 'clipboard', 'save', 'clipboard'];

function step0GuideBodyMarkup(step) {
  let markup = escapeHtml(step.body || '').replaceAll('\n', '<br>');
  (Array.isArray(step.actions) ? step.actions : []).forEach((action) => {
    const token = `{{${action.token}}}`;
    const title = action.kind === 'copy-instructions'
      ? '선택한 Listing 항목을 포함해 GPT Simple Research 지침 1을 복사합니다.'
      : action.label;
    const pill = `<button
      type="button"
      class="data-upload-prompt-chip data-upload-guide-action-chip"
      data-step0-guide-action="${escapeHtml(action.kind)}"
      aria-label="${escapeHtml(title)}"
      title="${escapeHtml(title)}"
    ><span class="data-upload-action-icon" aria-hidden="true">${dataUploadIconMarkup(action.icon || 'clipboard')}</span><b>${escapeHtml(action.label)}</b></button>`;
    markup = markup.replaceAll(token, pill);
  });
  return markup;
}

function step0GuideExcelIllustrationMarkup() {
  return `
    <div class="step0-guide-excel-illustration" aria-label="Excel 표를 드래그하여 Listing Input에 붙여넣는 예시">
      <div class="step0-guide-sheet">
        <span class="step0-guide-sheet-label">Excel</span>
        <div class="step0-guide-sheet-selection">
          <div><b>Company</b><b>Asset</b><b>Location</b><b>Modality</b></div>
          <div><span>Example Bio</span><span>EX-101</span><span>KR</span><span>ASO</span></div>
          <div><span>Next Pharma</span><span>NP-02</span><span>US</span><span>Small molecule</span></div>
        </div>
      </div>
      <span class="step0-guide-copy-flow" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h12M13 7l5 5-5 5" /></svg>
        <em>drag · copy · paste</em>
      </span>
      <div class="step0-guide-input-preview">
        <span>Listing Input</span>
        <i>Company&nbsp;&nbsp;Asset&nbsp;&nbsp;Location&nbsp;&nbsp;Modality</i>
      </div>
    </div>
  `;
}

function step0GuideHeaderMappingsMarkup(mappings) {
  if (!Array.isArray(mappings) || !mappings.length) return '';
  return `<div class="step0-guide-header-mappings" aria-label="Excel header 매핑 예시">
    <span class="step0-guide-mapping-caption">대표 Header 매핑 예시</span>
    ${mappings.map(([source, destination]) => `<div><code>${escapeHtml(source)}</code><span aria-hidden="true">→</span><b>${escapeHtml(destination)}</b></div>`).join('')}
  </div>`;
}

function renderStep0Guide() {
  if (!elements.step0GuideSteps) return;
  elements.step0GuideSteps.innerHTML = STEP0_GUIDE_STEPS.map((step, index) => `
    <li>
      <span class="data-upload-step-icon" aria-hidden="true">${dataUploadIconMarkup(STEP0_GUIDE_STEP_ICONS[index] || 'file-text')}</span>
      <div class="data-upload-step-copy">
        <strong>${escapeHtml(step.title)}</strong>
        ${step.excelIllustration
          ? `<p>${escapeHtml(step.intro || '')}</p>${step0GuideExcelIllustrationMarkup()}<p class="step0-guide-outro">${escapeHtml(step.outro || '')}</p>${step0GuideHeaderMappingsMarkup(step.headerMappings)}`
          : `<p>${step0GuideBodyMarkup(step)}</p>`}
        ${step.example ? `<pre><span>${dataUploadIconMarkup('code')}입력 형식 예시</span>${escapeHtml(step.example)}</pre>` : ''}
        ${step.afterExample ? `<p class="step0-guide-example-note">${escapeHtml(step.afterExample)}</p>` : ''}
      </div>
    </li>
  `).join('');
}

function setStep0SaveStatus(status) {
  if (!elements.step0SaveStatus) return;
  const labels = {
    waiting: '붙여넣기 대기',
    validating: '가져오는 중',
    saved: '가져오기 완료',
    error: '가져오기 실패'
  };
  const icons = { waiting: 'waiting', validating: 'loader', saved: 'saved', error: 'alert' };
  const nextStatus = Object.prototype.hasOwnProperty.call(labels, status) ? status : 'waiting';
  elements.step0SaveStatus.dataset.state = nextStatus;
  elements.step0SaveStatus.innerHTML = `${dataUploadIconMarkup(icons[nextStatus])}<span>${escapeHtml(labels[nextStatus])}</span>`;
}

function showStep0Panel(show) {
  if (elements.pipelineContent) {
    elements.pipelineContent.hidden = show;
    elements.pipelineContent.style.display = show ? 'none' : '';
  }
  if (elements.step0Panel) {
    elements.step0Panel.hidden = !show;
    elements.step0Panel.style.display = show ? '' : 'none';
  }
}

function showKnowledgeMapPanel(show) {
  if (!elements.knowledgeMapPanel) return;
  elements.knowledgeMapPanel.hidden = !show;
  elements.knowledgeMapPanel.style.display = show ? '' : 'none';
}

function activateKnowledgeMapPanel() {
  showStep0Panel(false);
  if (elements.pipelineContent) {
    elements.pipelineContent.hidden = true;
    elements.pipelineContent.style.display = 'none';
  }
  showKnowledgeMapPanel(true);
  syncTopDataActionsForVisibleTab();
  renderShortlistingProjectControl();
  updateHeaderRecordCount();
  elements.pipelineTableTabs?.forEach((tab) => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
  });
  syncKnowledgeMapTabState(true);
  requestAnimationFrame(() => window.restartKnowledgeMapPhysics?.());
  renderAgentIdentity();
}

function updateStep0HeaderCount() {
  updateHeaderRecordCount();
}

function activateStep0Panel() {
  showKnowledgeMapPanel(false);
  syncKnowledgeMapTabState(false);
  elements.pipelineTableTabs?.forEach((tab) => {
    const isActive = tab.dataset.tableMode === 'step0';
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
  });
  showStep0Panel(true);
  // Reapply the visible-tab contract immediately; this prevents a prior tab
  // or delayed dashboard render from leaking its header state into Listing.
  syncTopDataActionsForVisibleTab();
  renderShortlistingProjectControl();
  renderStep0Guide();
  updateStep0HeaderCount();
  if (state.step0Loaded) {
    // Rebuild the cached graph synchronously after the panel becomes visible.
    // The refresh below only repaints when data actually changed, preventing the
    // previous static graph from flashing before the left-to-right entry motion.
    // Force both the dot cloud and the count-up to replay on this re-entry — they
    // otherwise skip replaying when nothing has actually changed since their last
    // render, which is exactly true here (nothing changed while on a different tab)
    // but re-entry is meant to replay anyway, same as the first-ever load.
    step0WorkflowMapLastCountsKey = null;
    renderStep0FilterControls();
    renderStep0ProgressTable();
    step0StatStripLastRenderKey = null;
    renderStep0StatStrip();
    renderStep0SelectedCount();
    loadStep0Progress({ renderOnlyWhenChanged: true });
    return;
  }
  // Paint last-known numbers instantly — zero network wait — from a small localStorage
  // cache while the real fetch is still in flight below, so the count-up animation
  // always starts right away regardless of how fast the network/server happen to be
  // right now. renderStep0StatStrip() already prefers state.step0Stats over the (still
  // nonexistent) row list whenever state.step0Loaded is false, so this just seeds that.
  const cachedStats = readStep0StatsCache();
  if (cachedStats) {
    state.step0Stats = cachedStats.stats;
    state.step0RecentStats = cachedStats.recent_15_days;
    setStep0StatsLoading(false);
    renderStep0StatStrip();
    renderStep0WorkflowMapPlaceholder(cachedStats.stats);
  } else {
    setStep0StatsLoading(true);
  }
  loadStep0Progress();
}

function deactivateStep0Panel() {
  showStep0Panel(false);
  syncTopDataActionsForVisibleTab();
  renderTableTabs();
}

function renderStep0ImportSummary(result, { skippedRequiredRows = [] } = {}) {
  if (!elements.step0ImportSummary || !result) return;
  const unparsedCount = result.unparsed_lines?.length || 0;
  const skippedRequiredCount = skippedRequiredRows.length;
  elements.step0ImportSummary.hidden = false;
  const badgeClass = unparsedCount || skippedRequiredCount ? 'warning' : '';
  const badgeText = unparsedCount || skippedRequiredCount ? '일부 제외' : '가져오기 완료';
  const rows = [
    {
      level: 'ok',
      label: '신규',
      path: '신규 추가',
      message: `${result.added}건을 Listing에 새로 추가했습니다.`
    },
    {
      level: 'ok',
      label: '제외',
      path: '이미 조사됨',
      message: `${result.already_researched_skipped}건은 기존 조사 결과와 일치했습니다. 입력된 Comment/Contact는 빈 값이 아닌 경우에만 보완했습니다.`
    },
    {
      level: 'ok',
      label: '제외',
      path: '대기열 중복',
      message: `${result.duplicate_in_queue_skipped}건은 이미 Listing에 있어 제외했습니다.`
    },
    ...(result.duplicate_in_queue_enriched ? [{
      level: 'ok',
      label: '보완',
      path: '대기열 중복',
      message: `기존 빈 필드 ${result.duplicate_in_queue_enriched}건을 새 입력값으로 보완했습니다.`
    }] : []),
    ...(result.duplicate_in_queue_richer_replaced ? [{
      level: 'ok',
      label: '갱신',
      path: '대기열 중복',
      message: `새 행의 입력 항목이 더 많은 ${result.duplicate_in_queue_richer_replaced}건은 Listing 정보로 갱신했습니다.`
    }] : []),
    ...(result.duplicate_in_queue_representative_applied ? [{
      level: 'ok',
      label: '선택 적용',
      path: '유사 Pipeline 연결',
      message: `${result.duplicate_in_queue_representative_applied}건은 선택한 Listing 값을 우선 적용하고 빈 칸을 보완했습니다.`
    }] : []),
    ...(result.metadata_updated ? [{
      level: 'ok',
      label: '메모',
      path: '운영 정보',
      message: `Comment·Contact·Website ${result.metadata_updated}건을 누적 또는 보완했습니다.`
    }] : []),
    ...(unparsedCount ? [{
      level: 'warning',
      label: '경고',
      path: '파싱 실패',
      message: `${unparsedCount}줄을 파싱하지 못했습니다.`
    }] : []),
    ...(skippedRequiredCount ? [{
      level: 'warning',
      label: '제외',
      path: '필수값 누락',
      message: `${skippedRequiredRows.map(({ row, reason }) => `${row}행(${reason})`).join(', ')}은 등록하지 않았습니다. 나머지 행은 계속 가져왔습니다.`
    }] : [])
  ];
  elements.step0ImportSummary.innerHTML = `
    <div class="input-validation-summary">
      <span class="input-validation-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      <strong>후보 목록 업로드</strong>
      <span>${result.parsed}줄 파싱 · 신규 ${result.added} · 제외 ${result.already_researched_skipped} · 중복 ${result.duplicate_in_queue_skipped}${skippedRequiredCount ? ` · 필수값 누락 ${skippedRequiredCount}` : ''}</span>
    </div>
    <ul class="input-validation-list">
      ${rows.map((row) => `
        <li class="${escapeHtml(row.level || '')}">
          <b>${escapeHtml(row.label || '')}</b>
          <span><strong>${escapeHtml(row.path || '')}</strong>${row.path ? ' · ' : ''}${escapeHtml(row.message || '')}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function showStep0Message(text, level = 'ok') {
  if (!elements.step0ImportSummary) return;
  elements.step0ImportSummary.hidden = false;
  const badgeClass = level === 'error' ? 'error' : level === 'warning' ? 'warning' : '';
  const badgeText = level === 'error' ? '처리 실패' : level === 'warning' ? '확인 필요' : '완료';
  elements.step0ImportSummary.innerHTML = `
    <div class="input-validation-summary">
      <span class="input-validation-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

let step0ActionNoticeTimer = null;
function showStep0ActionNotice(text, level = 'success') {
  document.querySelector('.step0-action-notice')?.remove();
  if (step0ActionNoticeTimer) window.clearTimeout(step0ActionNoticeTimer);
  const notice = document.createElement('div');
  notice.className = `step0-action-notice is-${level}`;
  notice.setAttribute('role', 'status');
  notice.innerHTML = `<span aria-hidden="true">${level === 'success' ? '✓' : '!'}</span><p>${escapeHtml(text)}</p>`;
  document.body.appendChild(notice);
  step0ActionNoticeTimer = window.setTimeout(() => notice.remove(), 4200);
}

const STEP0_ENTRY_FIELDS = [
  { key: 'company_input', label: 'Company', required: true },
  { key: 'country', label: 'Location' },
  { key: 'asset_input', label: 'Asset', required: true },
  { key: 'modality', label: 'Modality' },
  { key: 'target', label: 'Target' },
  { key: 'main_indication', label: 'Main indication' },
  { key: 'stage', label: 'Pipeline Stage' },
  { key: 'comment', label: 'Comment', multiline: true },
  { key: 'contact', label: 'Contact' },
  { key: 'website', label: 'Website' }
];

function step0EntryRowMarkup(values = {}) {
  return `<tr>${STEP0_ENTRY_FIELDS.map((field) => `
    <td>${field.multiline
      ? `<textarea rows="1" data-step0-entry-field="${field.key}" aria-label="${field.label}">${escapeHtml(values[field.key] || '')}</textarea>`
      : `<input type="text" data-step0-entry-field="${field.key}" value="${escapeHtml(values[field.key] || '')}" aria-label="${field.label}" />`}
    </td>
  `).join('')}</tr>`;
}

function resizeStep0CommentCell(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 36), 150)}px`;
}

function renderStep0EntryGrid(rows = []) {
  if (!elements.step0EntryGridBody) return;
  const safeRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
  const visibleRows = safeRows.length ? safeRows : Array.from({ length: 6 }, () => ({}));
  elements.step0EntryGridBody.innerHTML = visibleRows.map((row) => step0EntryRowMarkup(row)).join('');
  elements.step0EntryGridBody.querySelectorAll('textarea[data-step0-entry-field]').forEach(resizeStep0CommentCell);
}

function appendStep0EntryRows(count = 1) {
  if (!elements.step0EntryGridBody) return;
  elements.step0EntryGridBody.insertAdjacentHTML('beforeend', Array.from({ length: Math.max(1, count) }, () => step0EntryRowMarkup()).join(''));
}

function collectStep0EntryRows() {
  const rows = [];
  const skippedRequiredRows = [];
  elements.step0EntryGridBody?.querySelectorAll('tr').forEach((tr, index) => {
    const row = {};
    tr.querySelectorAll('[data-step0-entry-field]').forEach((input) => {
      row[input.dataset.step0EntryField] = input.value.trim();
    });
    if (!Object.values(row).some(Boolean)) return;
    const missingCompany = !row.company_input;
    const invalidAsset = !row.asset_input || isStep0InvalidAsset(row.asset_input);
    if (missingCompany || invalidAsset) {
      const reason = [
        missingCompany ? 'Company 없음' : '',
        invalidAsset ? (row.asset_input ? 'Pipeline(Asset) X/- 표식' : 'Pipeline(Asset) 없음') : ''
      ].filter(Boolean).join(', ');
      skippedRequiredRows.push({ row: index + 1, reason });
      return;
    }
    rows.push(row);
  });
  return { rows, skippedRequiredRows };
}

function isStep0AssetPlaceholder(value) {
  return /^(?:-|x|×)$/i.test(String(value || '').trim());
}

function isStep0InvalidAsset(value) {
  return /^(?:-|x|\u00d7|\ud69e)$/i.test(String(value || '').trim());
}

const STEP0_HEADER_ALIASES = {
  company_input: ['company', 'company name', '회사', '회사명', '기업'],
  country: ['location', 'country', 'company country', 'company geography', 'company location', 'co location', 'hq', 'headquarters', 'headquarter', '국가', '회사 국가', '회사 소재지', '본사 소재지'],
  asset_input: ['asset', 'asset name', 'pipeline', 'pipeline name', '자산', '파이프라인', '약물명'],
  modality: ['modality', 'modality platform', '모달리티'],
  target: ['target', '타깃', '표적'],
  main_indication: ['main indication', 'indication', '주요 적응증', '적응증'],
  stage: ['stage', 'development stage', '개발 단계', '진행 단계'],
  comment: ['comment', 'comments', 'priority', 'reason for priority', 'priority reason', 'next step', '코멘트', '비고', '의견'],
  contact: ['contact', 'meeting history', 'history', '담당자', '연락처', '미팅 이력', '연락 이력'],
  website: ['website', 'website url', 'company website', 'official website', 'homepage', 'home page', 'url', '웹사이트', '홈페이지']
};

// Exact aliases are deliberately broad for external pipeline spreadsheets.
// Keyword rules below still handle longer headers such as "Lead Organization".
STEP0_HEADER_ALIASES.company_input.push('organization', 'organisation', 'corporate', 'sponsor', 'developer', 'manufacturer');
STEP0_HEADER_ALIASES.asset_input.push(
  'pipeline code', 'drug', 'drug name', 'drug name / pipeline code',
  'program', 'program name', 'candidate', 'compound', 'compound name',
  'product', 'product name', 'molecule'
);

// A spreadsheet can legitimately carry more than one note/contact context column.
// These fields concatenate per row; factual identity fields remain one-to-one.
const STEP0_MULTI_VALUE_HEADER_FIELDS = new Set(['comment', 'contact']);

// `country` is the company HQ / official company location field. A drug's
// geography or a sales/market geography is not a company location and must
// never be imported into it merely because it contains a geography keyword.
function isStep0ExcludedCountryHeader(value) {
  const normalized = normalizeStep0Header(value);
  return /(?:drug|asset|pipeline|product|sales|commercial|market|launch|patient|trial|clinical)(?:geography|geographic|location|region|country)/.test(normalized)
    || /(?:drug|sales)(?:geo|location|region|country)/.test(normalized);
}

const STEP0_HEADER_KEYWORD_RULES = {
  company_input: [
    ['company name', 12], ['company', 5], ['organization', 8], ['organisation', 8], ['corporate', 6], ['sponsor', 6], ['developer', 5], ['manufacturer', 5], ['회사명', 12], ['회사', 5], ['기업', 7]
  ],
  country: [
    ['company geography', 15], ['company geographic', 15], ['company location', 15], ['company country', 15], ['company hq', 15], ['headquarters', 10], ['headquarter', 10], ['hq', 9], ['company', 5], ['location', 10], ['country', 10], ['nation', 8], ['회사 국가', 15], ['회사 소재지', 15], ['본사 소재지', 15], ['국가', 10], ['소재지', 9], ['본사', 9]
  ],
  asset_input: [
    ['asset name', 13], ['pipeline name', 13], ['drug name', 12], ['program name', 11], ['asset', 8], ['pipeline', 8], ['drug', 8], ['candidate', 7], ['compound', 7], ['product', 6], ['program', 6], ['자산명', 13], ['파이프라인명', 13], ['후보물질', 9], ['자산', 8], ['파이프라인', 8]
  ],
  modality: [
    ['modality platform', 13], ['modality', 10], ['drug type', 8], ['therapy type', 8], ['platform', 5], ['모달리티', 10], ['약물 유형', 8], ['치료 유형', 8]
  ],
  target: [
    ['target moa', 13], ['target', 10], ['gene', 7], ['protein', 7], ['receptor', 7], ['mechanism', 5], ['moa', 7], ['타깃', 10], ['표적', 10], ['유전자', 7], ['수용체', 7], ['기전', 5]
  ],
  main_indication: [
    ['main indication', 13], ['primary indication', 13], ['therapeutic area', 11], ['disease area', 11], ['indication', 10], ['disease', 7], ['condition', 7], ['disorder', 7], ['주요 적응증', 13], ['적응증', 10], ['질환 영역', 11], ['치료 영역', 11], ['질환', 7]
  ],
  stage: [
    ['development stage', 13], ['clinical stage', 13], ['development status', 11], ['pipeline stage', 11], ['stage', 9], ['phase', 8], ['개발 단계', 13], ['임상 단계', 13], ['진행 단계', 11], ['단계', 9]
  ],
  comment: [
    ['reason for priority', 14], ['priority reason', 14], ['priority rationale', 13], ['next step', 12], ['internal comment', 13], ['review note', 12], ['comment', 9], ['comments', 9], ['priority', 7], ['note', 7], ['notes', 7], ['memo', 7], ['remark', 7], ['remarks', 7], ['rationale', 6], ['코멘트', 9], ['비고', 7], ['의견', 7], ['메모', 7]
  ],
  contact: [
    ['meeting history', 14], ['meeting date', 13], ['contact history', 13], ['contact date', 13], ['interaction history', 12], ['meeting', 9], ['history', 7], ['contact', 10], ['outreach', 9], ['communication', 8], ['owner', 7], ['email', 7], ['phone', 7], ['담당자', 9], ['미팅 이력', 14], ['연락 이력', 13], ['연락일', 13], ['연락처', 10], ['접촉', 8]
  ],
  website: [
    ['company website', 14], ['official website', 14], ['website url', 13], ['homepage', 12], ['home page', 12], ['website', 10], ['url', 7], ['웹사이트', 10], ['홈페이지', 12]
  ]
};

function normalizeStep0Header(value) {
  return String(value || '').toLocaleLowerCase('ko').replace(/[\s_.()\-]/g, '');
}

function step0HeaderMatch(value) {
  const normalized = normalizeStep0Header(value);
  if (!normalized) return { field: null, score: 0, reason: 'empty' };
  if (isStep0ExcludedCountryHeader(value)) return { field: null, score: 0, reason: 'excluded-company-location' };
  if (/^(?:moa|mechanismofaction|기전)$/.test(normalized)) {
    return { field: 'comment', score: 110, reason: 'moa-comment', prefix: 'MoA: ' };
  }
  const exactField = STEP0_ENTRY_FIELDS.find((field) => (STEP0_HEADER_ALIASES[field.key] || [field.label])
    .some((alias) => normalizeStep0Header(alias) === normalized));
  if (exactField) return { field: exactField.key, score: 100, reason: 'exact' };
  const candidates = STEP0_ENTRY_FIELDS.map((field) => {
    const score = (STEP0_HEADER_KEYWORD_RULES[field.key] || []).reduce((total, [keyword, weight]) => (
      normalized.includes(normalizeStep0Header(keyword)) ? total + weight : total
    ), 0);
    return { field: field.key, score };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
  if (!candidates.length) return { field: null, score: 0, reason: 'unrecognized' };
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    return { field: null, score: candidates[0].score, reason: 'ambiguous' };
  }
  return { ...candidates[0], reason: 'keyword' };
}

function step0HeaderMappings(cells) {
  const matches = cells.map(step0HeaderMatch);
  const winners = new Map();
  matches.forEach((match, index) => {
    if (!match.field) return;
    if (STEP0_MULTI_VALUE_HEADER_FIELDS.has(match.field)) return;
    const current = winners.get(match.field);
    if (!current || match.score > current.score) winners.set(match.field, { ...match, index });
  });
  const targets = matches.map((match, index) => (
    match.field && (STEP0_MULTI_VALUE_HEADER_FIELDS.has(match.field) || winners.get(match.field)?.index === index) ? match.field : null
  ));
  return {
    targets,
    transforms: matches.map((match, index) => (targets[index] ? { field: targets[index], prefix: match.prefix || '' } : null)),
    recognized: targets.filter(Boolean).length,
    ignored: matches.filter((match, index) => !targets[index] && String(cells[index] || '').trim()).length,
    duplicateCount: matches.filter((match, index) => match.field && !targets[index]).length
  };
}

function step0HeaderField(value) {
  return step0HeaderMatch(value).field;
}

function renderStep0PasteFeedback(rows, { summary = '' } = {}) {
  if (!elements.step0PasteFeedback) return;
  if (!rows.length) {
    elements.step0PasteFeedback.hidden = true;
    elements.step0PasteFeedback.innerHTML = '';
    return;
  }
  elements.step0PasteFeedback.hidden = false;
  const hasError = rows.some((row) => row.level === 'error');
  const hasWarning = rows.some((row) => row.level === 'warning');
  const badgeClass = hasError ? 'error' : hasWarning ? 'warning' : '';
  const badgeText = hasError ? '입력 실패' : hasWarning ? '일부 확인 필요' : '입력 완료';
  elements.step0PasteFeedback.innerHTML = `
    <div class="input-validation-summary">
      <span class="input-validation-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      ${summary ? `<span>${escapeHtml(summary)}</span>` : ''}
    </div>
    <ul class="input-validation-list">
      ${rows.map((row) => `
        <li class="${escapeHtml(row.level || '')}">
          <b>${escapeHtml(row.label || '')}</b>
          <span>${row.path ? `<strong>${escapeHtml(row.path)}</strong> · ` : ''}${escapeHtml(row.message || '')}</span>
        </li>
      `).join('')}
    </ul>
  `;
  window.requestAnimationFrame(() => {
    elements.step0PasteFeedback?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  });
}

function showStep0PasteFeedback(message, tone = 'info') {
  if (!message) {
    renderStep0PasteFeedback([]);
    return;
  }
  const level = tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'ok';
  const label = tone === 'error' ? '오류' : tone === 'warning' ? '경고' : '완료';
  renderStep0PasteFeedback([{ level, label, message }]);
}

function parseStep0ClipboardTable(clipboardText) {
  const text = String(clipboardText || '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (inQuotes && (index + 1 === text.length || ['\t', '\n'].includes(text[index + 1]))) {
        inQuotes = !inQuotes;
      } else if (!inQuotes && cell.length === 0) {
        inQuotes = true;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '\t' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (character === '\n' && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += character;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // A final line break is a clipboard terminator, not an additional selected Excel row.
  if (text.endsWith('\n') && rows[rows.length - 1]?.every((value) => value === '')) rows.pop();
  return { rows, unclosedQuote: inQuotes };
}

const STEP0_PASTE_PROCESSING_DELAY_MS = 0;
const STEP0_PASTE_PROCESSING_MINIMUM_VISIBLE_MS = 260;
let step0PasteProcessingToken = null;
let step0PasteProcessingTimer = null;
let step0PasteProcessingReturnFocus = null;
let step0PasteProcessingShownAt = 0;

function setStep0EntryGridMappingStatus(message = '', active = false) {
  const status = elements.step0EntryGridMappingStatus;
  if (!status) return;
  status.hidden = !active;
  const label = status.querySelector('span');
  if (label) label.textContent = message;
}

function beginStep0PasteProcessing() {
  const token = Symbol('step0-paste-processing');
  step0PasteProcessingToken = token;
  step0PasteProcessingReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  elements.step0EntryGrid?.setAttribute('aria-busy', 'true');
  setStep0EntryGridMappingStatus('엑셀 데이터를 Listing 표에 매핑하고 있습니다. 잠시만 기다려 주세요.', true);
  const showProcessingModal = () => {
    if (step0PasteProcessingToken !== token) return;
    if (elements.step0PasteProcessingModal) elements.step0PasteProcessingModal.hidden = false;
    document.body.classList.add('operation-modal-open');
    elements.step0PasteProcessingDialog?.focus();
    step0PasteProcessingShownAt = performance.now();
  };
  if (STEP0_PASTE_PROCESSING_DELAY_MS === 0) {
    showProcessingModal();
  } else {
    step0PasteProcessingTimer = window.setTimeout(showProcessingModal, STEP0_PASTE_PROCESSING_DELAY_MS);
  }
  return token;
}

function setStep0PasteProcessingStatus(token, message) {
  if (step0PasteProcessingToken !== token) return;
  if (elements.step0PasteProcessingStatus) elements.step0PasteProcessingStatus.textContent = message;
  setStep0EntryGridMappingStatus(message, true);
}

async function endStep0PasteProcessing(token) {
  if (step0PasteProcessingToken !== token) return;
  window.clearTimeout(step0PasteProcessingTimer);
  step0PasteProcessingTimer = null;
  const remainingVisibleMs = step0PasteProcessingShownAt
    ? Math.max(0, STEP0_PASTE_PROCESSING_MINIMUM_VISIBLE_MS - (performance.now() - step0PasteProcessingShownAt))
    : 0;
  if (remainingVisibleMs) await new Promise((resolve) => window.setTimeout(resolve, remainingVisibleMs));
  if (step0PasteProcessingToken !== token) return;
  step0PasteProcessingToken = null;
  step0PasteProcessingShownAt = 0;
  elements.step0EntryGrid?.setAttribute('aria-busy', 'false');
  setStep0EntryGridMappingStatus('', false);
  if (elements.step0PasteProcessingModal) elements.step0PasteProcessingModal.hidden = true;
  if (elements.operationModal?.hidden !== false) document.body.classList.remove('operation-modal-open');
  const returnFocus = step0PasteProcessingReturnFocus;
  step0PasteProcessingReturnFocus = null;
  if (returnFocus?.isConnected) returnFocus.focus();
}

function yieldStep0PasteWork() {
  return new Promise((resolve) => {
    window.setTimeout(() => window.requestAnimationFrame(resolve), 0);
  });
}

async function pasteIntoStep0EntryGrid(event) {
  const input = event.target.closest('[data-step0-entry-field]');
  const clipboardText = event.clipboardData?.getData('text/plain') || '';
  if (!input || !clipboardText || (!clipboardText.includes('\t') && !clipboardText.includes('\n'))) return;
  event.preventDefault();
  if (step0PasteProcessingToken) return;
  const processingToken = beginStep0PasteProcessing();
  try {
    // Two frames guarantee the immediate feedback is painted before clipboard
    // parsing and potentially large DOM updates begin.
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    // Yield once through the task queue as well. This gives slower remote/VDI
    // browsers a paint opportunity before a large clipboard parse starts.
    await yieldStep0PasteWork();
  const inputRows = [...elements.step0EntryGridBody.querySelectorAll('tr')];
  const startRow = Math.max(0, inputRows.indexOf(input.closest('tr')));
  const startColumn = Math.max(0, STEP0_ENTRY_FIELDS.findIndex((field) => field.key === input.dataset.step0EntryField));
  const parsed = parseStep0ClipboardTable(clipboardText);
  if (parsed.unclosedQuote) {
    showStep0PasteFeedback('닫히지 않은 큰따옴표가 있어 Excel 셀 경계를 확인할 수 없습니다. 붙여넣지 않았습니다.', 'error');
    return;
  }
  const matrix = parsed.rows;
  const headerMapping = step0HeaderMappings(matrix[0] || []);
  const firstRowIsHeader = headerMapping.recognized >= 2
    || (matrix[0]?.length === 1 && headerMapping.recognized === 1);
  const dataMatrix = firstRowIsHeader ? matrix.slice(1) : matrix;
  if (!dataMatrix.length) return;
  setStep0PasteProcessingStatus(processingToken, `${dataMatrix.length}개 행을 읽고 있습니다.`);
  const availableColumns = firstRowIsHeader ? headerMapping.targets.length : STEP0_ENTRY_FIELDS.length - startColumn;
  const overflowingRow = dataMatrix.find((cells) => cells.length > availableColumns && cells.slice(availableColumns).some((value) => String(value).trim()));
  if (overflowingRow) {
    showStep0PasteFeedback(`붙여넣기 범위가 ${availableColumns}개 입력 열을 넘습니다. 초과 값이 사라지는 것을 막기 위해 붙여넣지 않았습니다.`, 'error');
    return;
  }
  while (elements.step0EntryGridBody.querySelectorAll('tr').length < startRow + dataMatrix.length) {
    const remaining = startRow + dataMatrix.length - elements.step0EntryGridBody.querySelectorAll('tr').length;
    appendStep0EntryRows(Math.min(48, remaining));
    if (remaining > 48) await yieldStep0PasteWork();
  }
  const tableRows = [...elements.step0EntryGridBody.querySelectorAll('tr')];
  for (let rowOffset = 0; rowOffset < dataMatrix.length; rowOffset += 1) {
    const cells = dataMatrix[rowOffset];
    const inputs = [...tableRows[startRow + rowOffset].querySelectorAll('[data-step0-entry-field]')];
    const assignedFields = new Set();
    cells.forEach((value, columnOffset) => {
      const mapping = firstRowIsHeader ? headerMapping.transforms?.[columnOffset] : null;
      const field = mapping?.field || (firstRowIsHeader ? headerMapping.targets[columnOffset] : STEP0_ENTRY_FIELDS[startColumn + columnOffset]?.key);
      const target = field ? inputs[STEP0_ENTRY_FIELDS.findIndex((candidate) => candidate.key === field)] : null;
      if (!target) return;
      const rawIncoming = value.trim();
      const incoming = rawIncoming && mapping?.prefix ? `${mapping.prefix}${rawIncoming}` : rawIncoming;
      if (STEP0_MULTI_VALUE_HEADER_FIELDS.has(field) && assignedFields.has(field)) {
        // Repeated Comment/Contact headers are intentionally one logical field.
        // Later empty spreadsheet cells must never erase an earlier comment.
        if (incoming) target.value = [target.value.trim(), incoming].filter(Boolean).join('\n');
        return;
      }
      target.value = incoming;
      assignedFields.add(field);
    });
    if ((rowOffset + 1) % 24 === 0 && rowOffset + 1 < dataMatrix.length) {
      setStep0PasteProcessingStatus(processingToken, `${dataMatrix.length}개 행 중 ${rowOffset + 1}개 행을 표에 반영했습니다.`);
      await yieldStep0PasteWork();
    }
  }
  elements.step0EntryGridBody.querySelectorAll('textarea[data-step0-entry-field]').forEach(resizeStep0CommentCell);
  const labels = firstRowIsHeader
    ? [...new Set(headerMapping.targets.filter(Boolean))].map((key) => STEP0_ENTRY_FIELDS.find((field) => field.key === key)?.label).filter(Boolean).join(' · ')
    : STEP0_ENTRY_FIELDS.slice(startColumn, Math.min(STEP0_ENTRY_FIELDS.length, startColumn + Math.max(...dataMatrix.map((cells) => cells.length)))).map((field) => field.label).join(' · ');
  const blankRows = dataMatrix.filter((cells) => cells.every((value) => value === '')).length;
  const columnCount = Math.max(...dataMatrix.map((cells) => cells.length));
  const rows = [
    {
      level: 'ok',
      label: '입력',
      path: `${dataMatrix.length}행 × ${columnCount}열`,
      message: `${labels}에 입력했습니다.`
    },
    ...(firstRowIsHeader ? [{
      level: 'ok',
      label: '매핑',
      path: '헤더 인식',
      message: `열 제목 행을 ${headerMapping.recognized}개 열로 매핑했습니다.`
    }] : []),
    ...(firstRowIsHeader && headerMapping.ignored ? [{
      level: 'warning',
      label: '제외',
      path: '헤더 건너뜀',
      message: `인식하지 못했거나 중복된 header ${headerMapping.ignored}개를 건너뛰었습니다.`
    }] : []),
    ...(blankRows ? [{
      level: 'ok',
      label: '유지',
      path: '빈 행',
      message: `빈 행 ${blankRows}개도 유지했습니다.`
    }] : [])
  ];
  renderStep0PasteFeedback(rows, {
    summary: `${dataMatrix.length}행 · ${columnCount}열 · 필드 ${firstRowIsHeader ? headerMapping.recognized : columnCount}개`
  });
  } catch (error) {
    console.error('Listing Excel paste failed:', error);
    showStep0PasteFeedback('엑셀 데이터를 표에 반영하는 중 문제가 발생했습니다. 내용을 확인한 뒤 다시 붙여넣어 주세요.', 'error');
  } finally {
    await endStep0PasteProcessing(processingToken);
  }
}

async function listingImportJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload && typeof payload === 'object' && payload.ok === true) return payload;
  if (response.ok) {
    const error = new Error('서버가 Listing 저장 결과를 확인할 수 없는 형식으로 반환했습니다. Pipeline Table을 새로고침하여 반영 여부를 확인해 주세요.');
    error.status = 502;
    throw error;
  }
  const error = new Error(String(payload?.detail || payload?.message || `HTTP ${response.status}`));
  error.status = response.status;
  throw error;
}

function listingImportFailureCopy(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim();
  if (status === 401 || status === 403) {
    return {
      title: '가져오기 권한이 없습니다',
      message: '저장하지 않았습니다. 관리자 계정으로 로그인한 뒤 다시 시도해 주세요.',
      status: '로그인 또는 관리자 권한을 확인해 주세요.'
    };
  }
  if (status === 409 && /similar Listing|no longer available|review decision|Select an action/i.test(message)) {
    return {
      title: 'Listing 목록이 변경되어 다시 확인이 필요합니다',
      message: '다른 사용자의 저장 또는 삭제로 방금 선택한 연결 대상이 달라졌습니다. 현재 Pipeline Table을 새로고침한 뒤 다시 선택해 주세요.',
      status: '입력한 Listing은 이번 요청으로 저장되지 않았습니다.',
      action: 'refresh',
      actionLabel: '목록 새로고침'
    };
  }
  if (error?.name === 'TypeError' || /failed to fetch|networkerror|network request failed/i.test(message)) {
    return {
      title: '서버에 연결할 수 없습니다',
      message: '서버 연결 또는 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      status: '연결이 끊긴 경우 저장 결과를 바로 확인할 수 없습니다. 먼저 Pipeline Table에서 저장 여부를 새로 확인해 주세요.',
      action: 'refresh',
      actionLabel: '저장 여부 새로고침'
    };
  }
  if (status >= 500 || /permission denied|access is denied|write_json|json.*(?:write|save)|disk|read-only/i.test(message)) {
    return {
      title: '데이터 파일을 저장하지 못했습니다',
      message: '서버의 JSON 파일 쓰기 권한 또는 저장 공간을 확인한 뒤 다시 시도해 주세요.',
      status: '문제가 반복되면 관리자에게 아래 오류 정보를 전달해 주세요.',
      action: 'retry',
      actionLabel: '다시 시도'
    };
  }
  return {
    title: '가져오기에 실패했습니다',
    message: '저장하지 않았습니다. 입력 내용 또는 현재 Pipeline 상태를 확인한 뒤 다시 시도해 주세요.',
    status: message || '예기치 않은 저장 오류가 발생했습니다.',
    action: 'retry',
    actionLabel: '다시 시도'
  };
}

function showListingImportFailureDialog(error) {
  const copy = listingImportFailureCopy(error);
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'operation-modal-backdrop listing-import-error-backdrop';
    backdrop.innerHTML = `
      <section class="operation-modal listing-import-error-modal" role="dialog" aria-modal="true" aria-labelledby="listingImportErrorTitle" aria-describedby="listingImportErrorMessage">
        <header class="operation-modal-header">
          <span class="operation-modal-mark listing-import-error-mark" aria-hidden="true">!</span>
          <div><p class="operation-modal-eyebrow">IMPORT ERROR</p><h2 id="listingImportErrorTitle">${escapeHtml(copy.title)}</h2></div>
        </header>
        <p class="operation-modal-copy" id="listingImportErrorMessage">${escapeHtml(copy.message)}</p>
        <p class="operation-modal-status">${escapeHtml(copy.status)}</p>
        <footer class="operation-modal-actions operation-confirm-actions">
          <button type="button" class="operation-modal-cancel" data-listing-import-error-close>확인</button>
          <button type="button" class="operation-modal-confirm listing-import-error-retry" data-listing-import-error-action>${escapeHtml(copy.actionLabel || '다시 시도')}</button>
        </footer>
      </section>`;
    const finish = (action = 'close') => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      document.body.classList.remove('operation-modal-open');
      resolve(action);
    };
    const onKeydown = (event) => { if (event.key === 'Escape') finish(); };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) finish(); });
    backdrop.querySelector('[data-listing-import-error-close]')?.addEventListener('click', () => finish());
    backdrop.querySelector('[data-listing-import-error-action]')?.addEventListener('click', () => finish(copy.action || 'retry'));
    document.body.appendChild(backdrop);
    document.body.classList.add('operation-modal-open');
    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('[data-listing-import-error-retry]')?.focus();
  });
}

function showListingImportRefreshDialog({ title, message, status, actionLabel = '목록 새로고침' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'operation-modal-backdrop listing-import-error-backdrop';
    backdrop.innerHTML = `
      <section class="operation-modal listing-import-error-modal" role="dialog" aria-modal="true" aria-labelledby="listingImportRefreshTitle" aria-describedby="listingImportRefreshMessage">
        <header class="operation-modal-header">
          <span class="operation-modal-mark listing-import-error-mark" aria-hidden="true">!</span>
          <div><p class="operation-modal-eyebrow">LISTING STATUS</p><h2 id="listingImportRefreshTitle">${escapeHtml(title)}</h2></div>
        </header>
        <p class="operation-modal-copy" id="listingImportRefreshMessage">${escapeHtml(message)}</p>
        <p class="operation-modal-status">${escapeHtml(status)}</p>
        <footer class="operation-modal-actions operation-confirm-actions">
          <button type="button" class="operation-modal-cancel" data-listing-refresh-close>나중에 확인</button>
          <button type="button" class="operation-modal-confirm listing-import-error-retry" data-listing-refresh-action>${escapeHtml(actionLabel)}</button>
        </footer>
      </section>`;
    const finish = (action = 'close') => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      document.body.classList.remove('operation-modal-open');
      resolve(action);
    };
    const onKeydown = (event) => { if (event.key === 'Escape') finish(); };
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) finish(); });
    backdrop.querySelector('[data-listing-refresh-close]')?.addEventListener('click', () => finish());
    backdrop.querySelector('[data-listing-refresh-action]')?.addEventListener('click', () => finish('refresh'));
    document.body.appendChild(backdrop);
    document.body.classList.add('operation-modal-open');
    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('[data-listing-refresh-action]')?.focus();
  });
}

async function refreshListingProgressAfterSave({ successMessage = '', failureMessage = '' } = {}) {
  try {
    await loadStep0Progress({ throwOnError: true });
    if (successMessage) {
      showStep0Message(successMessage, 'warning');
      showStep0ActionNotice(successMessage, 'warning');
    }
    return true;
  } catch (_error) {
    const message = failureMessage || 'Pipeline Table을 불러오지 못했습니다. 네트워크를 확인한 뒤 페이지를 새로고침해 주세요.';
    showStep0Message(message, 'warning');
    showStep0ActionNotice(message, 'warning');
    return false;
  }
}

async function importStep0Candidates() {
  if (!getCurrentUser()?.is_admin) {
    showStep0Message('가져오기 권한이 없습니다. 안내창의 내용을 확인해 주세요.', 'warning');
    const action = await showListingImportFailureDialog(Object.assign(new Error('Administrator access is required.'), { status: 403 }));
    if (action === 'retry') window.setTimeout(() => importStep0Candidates(), 0);
    return;
  }
  const { rows, skippedRequiredRows } = collectStep0EntryRows();
  if (!rows.length) {
    showStep0Message(skippedRequiredRows.length
      ? `${skippedRequiredRows.length}개 Pipeline은 Company 또는 Pipeline(Asset) 필수값 누락으로 등록하지 않았습니다. Company와 Pipeline(Asset)을 입력한 뒤 다시 시도해 주세요.`
      : '입력된 Listing 항목이 없습니다.', 'warning');
    return;
  }
  if (elements.step0ImportButton) elements.step0ImportButton.disabled = true;
  setStep0SaveStatus('validating');
  try {
    const preview = await runBlockingOperation({
      title: '가져오기 항목을 확인하고 있습니다',
      message: '정확한 Pipeline 일치 여부와 유사한 Asset·Company 표기를 먼저 점검합니다.',
      status: '확인 단계에서는 아직 어떤 Listing도 저장되지 않습니다.'
    }, async (signal) => {
      const response = await fetch('/api/candidate-queue/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
        signal
      });
      return listingImportJsonResponse(response);
    });
    if (preview === OPERATION_CANCELLED) {
      setStep0SaveStatus('waiting');
      return;
    }
    let reviewDecisions = [];
    if (Array.isArray(preview.review_matches) && preview.review_matches.length) {
      reviewDecisions = await openStep0ImportReviewModal(preview.review_matches);
      if (!reviewDecisions) {
        setStep0SaveStatus('waiting');
        return;
      }
      if (reviewDecisions.some((decision) => decision.action === 'pending')) {
        showStep0Message('유사한 Pipeline마다 기존 항목 덮어쓰기 또는 별도 신규 Pipeline 추가 중 하나를 선택해 주세요.', 'warning');
        setStep0SaveStatus('waiting');
        return;
      }
    }
    const result = await runBlockingOperation({
      title: '후보 목록을 가져오고 있습니다',
      message: '붙여 넣은 후보 목록과 내부 Comment/Contact 정보를 확인해 Listing에 반영하고 있습니다.',
      status: '처리 중에는 다른 화면으로 이동할 수 없습니다.'
    }, async (signal) => {
      const response = await fetch('/api/candidate-queue/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, review_decisions: reviewDecisions }),
        signal
      });
      return listingImportJsonResponse(response);
    });
    if (result === OPERATION_CANCELLED) {
      setStep0SaveStatus('waiting');
      const action = await showListingImportRefreshDialog({
        title: '저장 취소를 요청했습니다',
        message: '브라우저 요청은 중단했지만 서버 저장이 이미 시작되었다면 일부 또는 전체가 반영됐을 수 있습니다.',
        status: '목록을 새로고침해 실제 저장 결과를 확인해 주세요.',
        actionLabel: '저장 결과 확인'
      });
      if (action === 'refresh') {
        await refreshListingProgressAfterSave({
          successMessage: '취소 요청 뒤 최신 Pipeline Table을 불러왔습니다. 방금 입력한 Listing의 반영 여부를 확인해 주세요.',
          failureMessage: '취소 요청 후 저장 결과를 확인하려 했지만 Pipeline Table을 불러오지 못했습니다. 네트워크를 확인한 뒤 페이지를 새로고침해 주세요.'
        });
      }
      return;
    }
    renderStep0ImportSummary(result, { skippedRequiredRows });
    renderStep0EntryGrid();
    showStep0PasteFeedback('');
    setStep0SaveStatus('saved');
    const savedMessage = `Listing 저장이 완료되었습니다. 신규 ${result.added}건, 기존 Pipeline 연결·보완 ${result.metadata_updated}건을 반영했습니다.`;
    showStep0ActionNotice(savedMessage, 'success');
    const refreshed = await refreshListingProgressAfterSave({
      failureMessage: 'Listing 저장은 완료되었지만 Pipeline Table을 불러오지 못했습니다. 네트워크를 확인한 뒤 페이지를 새로고침해 주세요.'
    });
    if (!refreshed) {
      const action = await showListingImportRefreshDialog({
        title: 'Listing 저장은 완료되었습니다',
        message: '그러나 Pipeline Table을 새로 불러오지 못해 화면에 바로 표시되지 않을 수 있습니다.',
        status: '저장 자체는 완료됐습니다. 목록을 다시 불러오거나 페이지를 새로고침해 결과를 확인해 주세요.'
      });
      if (action === 'refresh') await refreshListingProgressAfterSave();
    }
  } catch (error) {
    const failureCopy = listingImportFailureCopy(error);
    const failureMessage = `${failureCopy.title}: ${failureCopy.status}`;
    showStep0Message(failureMessage, 'error');
    setStep0SaveStatus('error');
    const action = await showListingImportFailureDialog(error);
    if (action === 'close') showStep0ActionNotice(failureMessage, 'error');
    if (action === 'refresh') {
      await refreshListingProgressAfterSave({
        successMessage: 'Pipeline Table을 새로 불러왔습니다. 앞선 요청의 저장 여부를 확인해 주세요.',
        failureMessage: 'Pipeline Table을 새로 불러오지 못했습니다. 서버 연결을 확인한 뒤 다시 시도해 주세요.'
      });
    } else if (action === 'retry') {
      window.setTimeout(() => importStep0Candidates(), 0);
    }
  } finally {
    if (elements.step0ImportButton) elements.step0ImportButton.disabled = false;
  }
}

function step0ProgressSnapshot(rows, stats, recentStats) {
  return JSON.stringify({ rows, stats, recentStats });
}

async function loadStep0Progress({ renderOnlyWhenChanged = false, throwOnError = false } = {}) {
  const requestId = (state.step0ProgressLoadRequestId || 0) + 1;
  state.step0ProgressLoadRequestId = requestId;
  // Only show the loading skeleton on the true first load — a background refresh
  // (renderOnlyWhenChanged) already has real numbers on screen and shouldn't flash back
  // to a loading state while it quietly checks for changes.
  const showLoadingState = !state.step0Loaded;
  if (showLoadingState) {
    setStep0SummaryLoading(true);
    // The full progress table below (currently ~1,300+ Listing rows) is the slow part;
    // the stat-strip counts don't need any of that per-row detail. Fetch the small,
    // fast stats-only endpoint in parallel so the dot/count-up animation can start
    // immediately instead of waiting on the full table fetch below. If the full fetch
    // (still in flight) beats this back, state.step0Loaded is already true by the time
    // this resolves and it's a no-op — the real, filter-aware numbers win.
    fetch('/api/candidate-queue/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.stats) writeStep0StatsCache(data.stats, data.recent_15_days || state.step0RecentStats);
        if (requestId !== state.step0ProgressLoadRequestId || state.step0Loaded) return;
        state.step0Stats = data.stats || state.step0Stats;
        state.step0RecentStats = data.recent_15_days || state.step0RecentStats;
        setStep0StatsLoading(false);
        renderStep0StatStrip();
        renderStep0WorkflowMapPlaceholder(state.step0Stats);
      })
      .catch(() => {});
  }
  try {
    const response = await fetch('/api/candidate-queue/progress');
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    if (requestId !== state.step0ProgressLoadRequestId) return;
    const nextRows = Array.isArray(data.rows) ? data.rows : [];
    const nextStats = data.stats || { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 };
    const nextRecentStats = data.recent_15_days || { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 };
    writeStep0StatsCache(nextStats, nextRecentStats);
    setStep0StatsLoading(false);
    const nextSnapshot = step0ProgressSnapshot(nextRows, nextStats, nextRecentStats);
    const hasChanged = !state.step0Loaded || nextSnapshot !== state.step0ProgressSnapshot;
    state.step0Rows = nextRows;
    state.step0Stats = nextStats;
    state.step0RecentStats = nextRecentStats;
    state.step0ProgressSnapshot = nextSnapshot;
    const pendingIds = new Set(
      state.step0Rows.filter((row) => row.pending?.queue_id).map((row) => row.pending.queue_id)
    );
    [...state.step0SelectedPendingIds].forEach((id) => {
      if (!pendingIds.has(id)) state.step0SelectedPendingIds.delete(id);
    });
    state.step0Loaded = true;
    updateStep0HeaderCount();
    if (renderOnlyWhenChanged && !hasChanged) return;
    renderStep0FilterControls();
    renderStep0ProgressTable();
    renderStep0StatStrip();
    renderStep0SelectedCount();
    restorePendingStep0MetadataTarget();
  } catch (error) {
    // A quiet re-entry refresh must not replace the cached dashboard with an
    // error state when the user already has usable progress data on screen.
    if (renderOnlyWhenChanged && state.step0Loaded) return;
    if (elements.step0ProgressTableBody) {
      elements.step0ProgressTableBody.innerHTML =
        `<tr><td colspan="14" class="step0-empty-state">진척 현황을 불러오지 못했습니다: ${escapeHtml(error.message)}</td></tr>`;
    }
    if (throwOnError) throw error;
  } finally {
    if (showLoadingState) setStep0SummaryLoading(false);
  }
}

function step0IsRecentCompletion(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) && timestamp >= (Date.now() - (15 * 24 * 60 * 60 * 1000)) && timestamp <= Date.now();
}

function step0FilteredStageStats(rows = step0FilteredSortedRows()) {
  const stats = { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 };
  const recent = { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 };
  const stages = [
    ['pending', 'pending'],
    ['fast_triage', 'fast_triage'],
    ['full_scout', 'full_scout'],
    ['shortlisted', 'shortlisting']
  ];
  rows.forEach((row) => {
    stages.forEach(([statKey, rowKey]) => {
      const cell = row?.[rowKey];
      if (!cell?.done) return;
      // The Listing card shows every pipeline currently in the table
      // (Fast Triage/Full Scout/Shortlisting completion included). Clicking
      // it still filters down to the "조사 대기" subset separately.
      stats[statKey] += 1;
      if (step0IsRecentCompletion(cell.completed_at)) recent[statKey] += 1;
    });
  });
  return { stats, recent };
}

function renderStep0StatStrip() {
  step0StatAnimationTimers.forEach((timer) => clearTimeout(timer));
  step0StatAnimationTimers = [];
  step0StatAnimationFrames.forEach((frame) => cancelAnimationFrame(frame));
  step0StatAnimationFrames = [];
  if (elements.step0SummaryScopeNote) {
    elements.step0SummaryScopeNote.textContent = '현재 Tab·Filter 기준';
  }
  const statEntries = [
    ['pending', elements.step0StatPending, elements.step0RecentPending],
    ['fast_triage', elements.step0StatFastTriage, elements.step0RecentFastTriage],
    ['full_scout', elements.step0StatFullScout, elements.step0RecentFullScout],
    ['shortlisted', elements.step0StatShortlisted, elements.step0RecentShortlisted]
  ];
  // Before the full progress table has loaded, there's nothing to filter yet — show the
  // fast stats-only endpoint's raw totals so the count-up animation can start immediately.
  // Once state.step0Rows arrives, this always recomputes from the (possibly filtered) rows,
  // same as before.
  const filteredRows = state.step0Loaded ? step0FilteredSortedRows() : [];
  const { stats, recent } = state.step0Loaded
    ? step0FilteredStageStats(filteredRows)
    : { stats: state.step0Stats, recent: state.step0RecentStats };
  // Compare on `stats` only, not `recent`: the backend's recent_15_days aggregate
  // (used verbatim before rows load) and step0FilteredStageStats()'s own per-row
  // "recent" scan (used once rows are in) are computed by genuinely different logic
  // and routinely disagree by a little even when the 4 headline numbers are byte-
  // identical — comparing both was defeating the skip on the very case it was meant
  // for (the fast-stats render and the full-progress render agreeing on `stats`).
  const statsRenderKey = JSON.stringify(stats);
  const isFirstRender = step0StatStripLastRenderKey === null;
  const skipReplay = statsRenderKey === step0StatStripLastRenderKey;
  step0StatStripLastRenderKey = statsRenderKey;
  const recentPipelineCount = filteredRows.filter((row) => [
    row?.pending,
    row?.fast_triage,
    row?.full_scout,
    row?.shortlisting
  ].some((cell) => cell?.done && step0IsRecentCompletion(cell.completed_at))).length;
  if (elements.step0SummaryRecentUpload) {
    elements.step0SummaryRecentUpload.hidden = recentPipelineCount === 0;
    elements.step0SummaryRecentUpload.textContent = '▲ 최근 15일간 0 증가';
    elements.step0SummaryRecentUpload.setAttribute('aria-label', `현재 Tab Filter 기준 최근 15일 신규 Pipeline ${recentPipelineCount}건`);
    if (recentPipelineCount > 0) {
      const recentTimer = setTimeout(() => {
        const startedAt = performance.now();
        const duration = isFirstRender ? 2600 : 500;
        const tick = (now) => {
          const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
          const eased = 1 - Math.pow(1 - progress, 3);
          elements.step0SummaryRecentUpload.textContent = `▲ 최근 15일간 ${Math.round(recentPipelineCount * eased)} 증가`;
          if (progress < 1) step0StatAnimationFrames.push(requestAnimationFrame(tick));
        };
        step0StatAnimationFrames.push(requestAnimationFrame(tick));
      }, 220);
      step0StatAnimationTimers.push(recentTimer);
    }
  }
  statEntries.forEach(([key, statElement, badge], index) => {
    const total = Math.max(0, Number(stats[key] || 0));
    const recentCount = Math.max(0, Number(recent[key] || 0));
    if (skipReplay) {
      // Same totals as the last render (cache → fast stats → full progress typically
      // all agree) — leave the number where it already settled instead of resetting
      // to 0 and replaying the count-up for no visible reason.
      if (statElement) statElement.textContent = String(total);
      if (badge) {
        badge.hidden = recentCount === 0;
        if (recentCount > 0) {
          badge.textContent = `▲ ${recentCount}`;
          badge.setAttribute('aria-label', `최근 15일 신규 업로드 ${recentCount}건`);
        }
      }
      return;
    }
    if (statElement) statElement.textContent = '0';
    if (badge) {
      badge.hidden = true;
      badge.textContent = '▲ 0';
    }
    // Start after this card's first dot wave has entered; the count then grows
    // alongside the staggered 720ms dot arrival instead of preceding it.
    const startDelay = index * STEP0_WORKFLOW_STAGE_STAGGER_MS + 220;
    const timer = setTimeout(() => {
      const startedAt = performance.now();
      // Slower and more leisurely on the very first render only — that's the number
      // the user watches while the full table loads behind it, so it shouldn't finish
      // counting and then just sit there waiting. A later correction (the rare case
      // where a subsequent fetch actually disagrees with what's already on screen)
      // should just snap into place quickly instead of replaying the same slow climb.
      const duration = isFirstRender ? 2600 : 500;
      const tick = (now) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        if (statElement) statElement.textContent = String(Math.round(total * eased));
        if (badge && recentCount > 0) {
          badge.hidden = false;
          badge.textContent = `▲ ${Math.round(recentCount * eased)}`;
          badge.setAttribute('aria-label', `최근 15일 신규 업로드 ${recentCount}건`);
        }
        if (progress < 1) step0StatAnimationFrames.push(requestAnimationFrame(tick));
      };
      step0StatAnimationFrames.push(requestAnimationFrame(tick));
    }, startDelay);
    step0StatAnimationTimers.push(timer);
  });
}

const STEP0_STAGE_LABELS = {
  pending: 'Listing',
  fast_triage: 'Simple Research',
  full_scout: 'Advanced Research',
  shortlisting: 'Custom Review'
};

function step0StageCellHtml(stage, cell, fullScoutCell = null) {
  const done = Boolean(cell?.done);
  const isInvestigationPending = stage === 'pending' && step0IsInvestigationPending(cell?.row);
  const tone = isInvestigationPending ? 'waiting' : done ? 'pass' : 'empty';
  const stageLabel = STEP0_STAGE_LABELS[stage] || stage;
  const label = isInvestigationPending ? '<span aria-hidden="true">✓</span>' : done ? '<span aria-hidden="true">✓</span>' : '-';
  const fullScoutCoversFastTriage = stage === 'fast_triage' && Boolean(fullScoutCell?.done);
  if (fullScoutCoversFastTriage) {
    return `<span class="pill pass" title="Advanced Research 완료 · Simple Research는 완료 표시만 제공합니다. Tab 1 행을 선택하면 Advanced Research 상세를 엽니다.">${label}</span>`;
  }
  const title = isInvestigationPending
    ? ` title="${escapeHtml('조사 대기 중 · Simple Research 및 Advanced Research 미수행')}"`
    : done ? ` title="${escapeHtml(`${stageLabel} 완료 · 상세 보기`)}"` : '';
  if (stage === 'pending' || !done || !cell?.record_id) {
    return `<span class="pill ${tone}"${title}>${label}</span>`;
  }
  const fullScoutRedirect = stage === 'fast_triage' && fullScoutCell?.done && fullScoutCell?.record_id;
  const mode = fullScoutRedirect ? 'full' : stage === 'fast_triage' ? 'triage' : stage === 'full_scout' ? 'full' : 'focus';
  const href = recordDetailHref({ id: fullScoutRedirect ? fullScoutCell.record_id : cell.record_id, isTriage: stage === 'fast_triage' && !fullScoutRedirect }, mode);
  return `<a class="pill ${tone}" href="${escapeHtml(href)}"${title}>${label}</a>`;
}

function step0CommentFeed(row) {
  const entries = Array.isArray(row?.comment_feed) ? row.comment_feed : [];
  if (entries.length) return entries.filter((entry) => entry && String(entry.body || '').trim() && !/contact/i.test(String(entry.source || '')));
  const fallback = String(row?.metadata?.comment || '').trim();
  if (fallback) {
    const author = String(row?.metadata?.comment_author || 'Team');
    const isBulkImport = row?.metadata?.comment_source === 'team_review_import';
    const source = isBulkImport
      ? '일괄 업로드: Tab 0 · Comment'
      : 'Tab 0 · Comment';
    return [{
      source,
      author: isBulkImport ? 'Team' : author,
      created_at: String(row?.metadata?.comment_updated_at || row?.metadata?.comment_created_at || ''),
      body: fallback
    }];
  }
  return [];
}

function step0ContactFeed(row) {
  const entries = Array.isArray(row?.comment_feed) ? row.comment_feed : [];
  const contactEntries = entries.filter((entry) => entry && String(entry.body || '').trim() && /contact/i.test(String(entry.source || '')));
  if (contactEntries.length) return contactEntries;
  const fallback = String(row?.metadata?.contact || '').trim();
  if (!fallback || /^(?:x|[-–—]+)$/i.test(fallback)) return [];
  return [{
    source: 'Tab 0 · Contact History',
    author: String(row?.metadata?.contact_author || 'Team'),
    created_at: String(row?.metadata?.contact_updated_at || row?.metadata?.updated_at || ''),
    body: fallback
  }];
}

function step0MetadataOwnedByCurrentUser(metadata, prefix, user) {
  const authorId = String(metadata?.[`${prefix}_author_user_id`] || '').trim();
  const userId = String(user?.id || '').trim();
  if (authorId) return Boolean(userId) && authorId === userId;
  const authorEmail = String(metadata?.[`${prefix}_author_email`] || '').trim().toLowerCase();
  const userEmail = String(user?.email || '').trim().toLowerCase();
  if (authorEmail) return Boolean(userEmail) && authorEmail === userEmail;
  // Legacy posts predate stored account identity. New posts use ID/email above.
  const author = String(metadata?.[`${prefix}_author`] || '').trim().toLocaleLowerCase('ko');
  const actor = String(user?.name || user?.email || '').trim().toLocaleLowerCase('ko');
  return Boolean(author) && author === actor;
}

const STEP0_METADATA_TARGET_STORAGE_KEY = 'skbp.step0.metadata-target.v1';

function restorePendingStep0MetadataTarget() {
  let target;
  try {
    target = JSON.parse(sessionStorage.getItem(STEP0_METADATA_TARGET_STORAGE_KEY) || 'null');
  } catch {
    sessionStorage.removeItem(STEP0_METADATA_TARGET_STORAGE_KEY);
    return;
  }
  const field = target?.field === 'contact' ? 'contact' : target?.field === 'comment' ? 'comment' : '';
  const recordId = String(target?.recordId || '').trim();
  if (!field || !recordId) return;
  const row = state.step0Rows.find((candidate) => [
    candidate?.metadata_owner?.record_id,
    candidate?.fast_triage?.record_id,
    candidate?.full_scout?.record_id
  ].some((id) => String(id || '') === recordId));
  if (!row) return;

  state.step0Query = '';
  state.step0Filters = { country: [], modality: [], theme: [], cluster: [], indication: [], stage: [] };
  const rows = step0FilteredSortedRows();
  const rowIndex = Math.max(0, rows.indexOf(row));
  state.step0Page = Math.floor(rowIndex / state.step0PageSize) + 1;
  renderStep0FilterControls();
  renderStep0ProgressTable();
  sessionStorage.removeItem(STEP0_METADATA_TARGET_STORAGE_KEY);

  window.requestAnimationFrame(() => {
    const selector = `[data-step0-metadata][data-step0-row-identity="${CSS.escape(String(row.identity || ''))}"][data-step0-metadata-field="${field}"]`;
    const anchor = elements.step0ProgressTableBody?.querySelector(selector);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    openStep0MetadataPopover(anchor, row, field, { editing: false });
  });
}

function step0ListingCommentCanEdit(row) {
  const user = getCurrentUser();
  if (!user?.is_admin) return false;
  const metadata = row?.metadata || {};
  const comment = String(metadata.comment || '').trim();
  if (!comment) return true;
  const source = String(metadata.comment_source || '').trim();
  // Imported and pre-provenance Listing comments are shared Tab 0 content.
  // Any administrator can correct or remove them; direct posts stay author-owned.
  if (source === 'team_review_import' || !source) return true;
  if (source !== 'admin_listing_post') return false;
  return step0MetadataOwnedByCurrentUser(metadata, 'comment', user);
}

function step0ContactHistoryCanEdit(row) {
  const user = getCurrentUser();
  if (!user?.is_admin) return false;
  const metadata = row?.metadata || {};
  const contact = String(metadata.contact || '').trim();
  if (!contact) return true;
  const source = String(metadata.contact_source || '').trim();
  if (source === 'team_review_import') return Boolean(user?.is_developer);
  if (source !== 'admin_contact_post') return false;
  return step0MetadataOwnedByCurrentUser(metadata, 'contact', user);
}

function step0MetadataCellHtml(row, field) {
  const value = String(row.metadata?.[field] || '').trim();
  const metadataFeed = field === 'comment' ? step0CommentFeed(row) : field === 'contact' ? step0ContactFeed(row) : [];
  const owner = row.metadata_owner || {};
  const label = field === 'comment' ? 'Comment' : 'Contact';
  const hasContactHistory = field !== 'contact' || !/^(?:x|[-–—]+)$/i.test(value);
  const hasValue = field === 'comment' || field === 'contact' ? metadataFeed.length > 0 : Boolean(value) && hasContactHistory;
  if (!owner.type) return '<span class="pill empty step0-metadata-empty">-</span>';
  const ownerId = owner.type === 'queue' ? owner.queue_id : owner.record_id;
  const datedImportHistory = field === 'comment' && Array.isArray(row?.metadata?.comment_entries) && row.metadata.comment_entries.length > 1;
  const title = hasValue
    ? datedImportHistory ? `${label} 확인 · 일괄 업로드별 기록 보기` : `${label} 확인 · 두 번 클릭하여 수정`
    : `${label} 없음 · 두 번 클릭하여 입력`;
  return `<button
    type="button"
    class="pill ${hasValue ? 'pass has-value' : 'empty is-empty'} step0-metadata-indicator"
    data-step0-metadata
    data-step0-metadata-field="${escapeHtml(field)}"
    data-step0-row-identity="${escapeHtml(row.identity || '')}"
    data-owner-type="${escapeHtml(owner.type)}"
    data-owner-id="${escapeHtml(ownerId || '')}"
    aria-label="${escapeHtml(title)}"
    title="${escapeHtml(title)}"
  >${hasValue ? '<span aria-hidden="true">✓</span>' : '-'}</button>`;
}

function step0WebsiteCellHtml(row) {
  const raw = String(row?.metadata?.website || row?.listing_details?.website || '').trim();
  const owner = row?.metadata_owner || {};
  const ownerType = String(owner.type || '');
  const ownerId = String(owner.record_id || owner.queue_id || '');
  const attributes = ` data-pipeline-website data-owner-type="${escapeHtml(ownerType)}" data-owner-id="${escapeHtml(ownerId)}" data-pipeline-asset="${escapeHtml(row.asset || '')}"`;
  if (!/^https?:\/\//i.test(raw)) return `<button type="button" class="focus-action-button icon-only pipeline-website-row-button is-unavailable step0-website-empty"${attributes} data-website-url="" title="Pipeline Website 미등록 · 두 번 클릭하여 주소 등록" aria-label="Pipeline Website 등록" aria-disabled="true"><svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14 14 10M8.5 7.5H7a3 3 0 0 0-3 3V17a3 3 0 0 0 3-3v-1.5M13 4h7v7M20 4l-9 9"/></svg></button>`;
  let safeUrl = '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeUrl = parsed.href;
  } catch (_) {
    safeUrl = '';
  }
  if (!safeUrl) return `<button type="button" class="focus-action-button icon-only pipeline-website-row-button is-unavailable step0-website-empty"${attributes} data-website-url="" title="Pipeline Website 미등록 · 두 번 클릭하여 주소 등록" aria-label="Pipeline Website 등록" aria-disabled="true"><svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14 14 10M8.5 7.5H7a3 3 0 0 0-3 3V17a3 3 0 0 0 3-3v-1.5M13 4h7v7M20 4l-9 9"/></svg></button>`;
  const editAttributes = `${attributes} data-website-url="${escapeHtml(safeUrl)}"`;
  return `<a class="focus-action-button icon-only pipeline-website-row-button step0-website-link"${editAttributes} href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" title="Website · 한 번 클릭하여 열기, 두 번 클릭하여 주소 수정" aria-label="Open website in a new tab" aria-disabled="false">
    <svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14 14 10M8.5 7.5H7a3 3 0 0 0-3 3V17a3 3 0 0 0 3-3v-1.5M13 4h7v7M20 4l-9 9"/></svg>
  </a>`;
}

function openManualTableCountryEdit(anchor) {
  if (!anchor || !getCurrentUser()?.is_admin || anchor.dataset.editing === 'true') return;
  const recordId = anchor.dataset.recordId;
  const previousValue = String(anchor.dataset.previousValue || '').trim() || 'Unknown';
  if (!recordId) return;

  anchor.dataset.editing = 'true';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 250;
  input.className = 'table-manual-text-input table-edit-select country-edit';
  input.value = previousValue;
  input.dataset.recordId = recordId;
  input.dataset.editKind = 'country';
  input.dataset.previousValue = previousValue;
  input.setAttribute('aria-label', 'Location edit');
  input.title = 'Enter to save. Known countries are canonicalized; unrecognized wording is retained.';
  anchor.replaceWith(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveManualReviewEdit(input);
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault();
    input.dataset.cancelled = 'true';
    renderTable();
  });
  input.addEventListener('blur', () => {
    if (input.classList.contains('is-saving') || input.dataset.cancelled === 'true') return;
    saveManualReviewEdit(input);
  }, { once: true });
}

function saveCustomScoreEdit(input) {
  const previousValue = input.dataset.previousValue ?? '0';
  const nextRaw = input.value ?? '';
  if (previousValue === nextRaw) {
    renderTable();
    return;
  }
  const numeric = Number(nextRaw);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 9) {
    elements.dataStatus.textContent = 'Score는 0~9 정수로 입력해주세요';
    renderTable();
    return;
  }
  const projectId = input.dataset.projectId;
  const payload = { action: 'update', field: 'custom_score', value: Math.round(numeric) };
  if (projectId === DEFAULT_SHORTLISTING_PROJECT_ID) {
    saveFocusManagement(input.dataset.recordId, payload, input);
  } else {
    saveShortlistingProjectField(input.dataset.recordId, projectId, payload, input);
  }
}

function openCustomScoreEdit(anchor) {
  if (!anchor || anchor.dataset.editing === 'true') return;
  const recordId = anchor.dataset.recordId;
  const projectId = anchor.dataset.projectId;
  const previousValue = String(anchor.dataset.previousValue || '0');
  if (!recordId || !projectId) return;
  if (shortlistingRoleFor(projectId) === 'read') return;

  anchor.dataset.editing = 'true';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '9';
  input.step = '1';
  input.className = 'focus-due-input custom-score-input';
  input.value = previousValue;
  input.dataset.recordId = recordId;
  input.dataset.projectId = projectId;
  input.dataset.previousValue = previousValue;
  input.setAttribute('aria-label', 'Score (Custom) edit');
  input.title = 'Score (Custom) 0~9. Enter to save, Escape to cancel.';
  anchor.replaceWith(input);
  input.focus();
  input.select();

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCustomScoreEdit(input);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      input.dataset.cancelled = 'true';
      renderTable();
    }
  });
  input.addEventListener('blur', () => {
    if (input.classList.contains('is-saving') || input.dataset.cancelled === 'true') return;
    saveCustomScoreEdit(input);
  }, { once: true });
}

function isExplicitUnknownListingValue(value) {
  return /^(?:-|unknown|not known|not available|not disclosed|n\/?a)$/i.test(String(value || '').trim());
}

function step0CanonicalDisplay(rawValue, canonicalValue, fallbackValues = []) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '-';
  if (fallbackValues.includes(canonicalValue) && !isExplicitUnknownListingValue(raw)) return raw;
  return canonicalValue || raw;
}

function canonicalListingCountry(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';
  return canonicalCountry(raw);
}

function step0ListingIndicationValues(value) {
  return indicationFilterValues(value, []);
}

function step0DashboardFieldDisplay(row) {
  const details = row?.listing_details || {};
  const rawCountry = String(details.country || '').trim();
  const rawModality = String(details.modality || '').trim();
  const rawIndication = String(details.main_indication || '').trim();
  const rawStage = String(details.stage || '').trim();
  const canonicalIndication = canonicalMainIndication('', rawIndication);

  return {
    country: rawCountry ? canonicalListingCountry(rawCountry) : '-',
    countryRaw: rawCountry,
    modality: rawModality
      ? step0CanonicalDisplay(rawModality, canonicalModality(rawModality), ['Others', 'Unknown'])
      : '-',
    modalityRaw: rawModality,
    indication: rawIndication
      ? step0CanonicalDisplay(rawIndication, canonicalIndication, ['Unknown'])
      : '-',
    indicationRaw: rawIndication,
    stage: rawStage
      ? step0CanonicalDisplay(rawStage, canonicalDevelopmentStage(rawStage), ['Unknown'])
      : '-',
    stageRaw: rawStage
  };
}

function step0FilterValue(value) {
  const normalized = String(value || '').trim();
  return normalized && normalized !== '-' ? normalized : 'Unknown';
}

function step0IndicationValues(row) {
  const display = step0DashboardFieldDisplay(row);
  const values = step0ListingIndicationValues(display.indicationRaw);
  return values.length ? values : [step0FilterValue(display.indication)];
}

function step0RowFilterValues(row, key) {
  const display = step0DashboardFieldDisplay(row);
  if (key === 'country') return canonicalCountryValues(display.country).map(step0FilterValue);
  if (key === 'modality') return [step0FilterValue(display.modality)];
  if (key === 'theme') return [step0FilterValue(row?.theme)];
  if (key === 'cluster') return [step0FilterValue(row?.cluster)];
  if (key === 'indication') return step0IndicationValues(row);
  if (key === 'stage') return [step0FilterValue(display.stage)];
  if (key === 'progress') {
    const values = STEP0_PROGRESS_FILTER_OPTIONS
      .filter((option) => option.value !== 'investigation_pending' && row?.[option.value]?.done)
      .map((option) => option.value);
    if (step0IsInvestigationPending(row)) values.splice(values.indexOf('pending') + 1, 0, 'investigation_pending');
    return values;
  }
  return [];
}

function step0IsInvestigationPending(row) {
  return Boolean(row?.pending?.done && !row?.fast_triage?.done && !row?.full_scout?.done);
}

function step0RowHasEvaluationProgress(row, key) {
  if (['pending', 'fast_triage', 'full_scout', 'shortlisting'].includes(key)) {
    return Boolean(row?.[key]?.done);
  }
  if (key === 'comment') return step0CommentFeed(row).length > 0;
  if (key === 'contact') return step0ContactFeed(row).length > 0;
  return false;
}

function renderStep0EvaluationProgressFilters() {
  const selected = state.step0EvaluationFilterValues || new Set();
  document.querySelectorAll('[data-step0-evaluation-filter]').forEach((button) => {
    const active = selected.has(button.dataset.step0EvaluationFilter);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function step0FilterOptions(key) {
  if (key === 'progress') return STEP0_PROGRESS_FILTER_OPTIONS;
  const values = [...new Set(state.step0Rows.flatMap((row) => step0RowFilterValues(row, key)))];
  if (key === 'stage') {
    return values.sort((a, b) => {
      const aIndex = CANONICAL_DEVELOPMENT_STAGES.indexOf(a);
      const bIndex = CANONICAL_DEVELOPMENT_STAGES.indexOf(b);
      const aRank = aIndex < 0 ? CANONICAL_DEVELOPMENT_STAGES.length : aIndex;
      const bRank = bIndex < 0 ? CANONICAL_DEVELOPMENT_STAGES.length : bIndex;
      return aRank - bRank || a.localeCompare(b, 'en');
    });
  }
  return values.sort((a, b) => a.localeCompare(b, 'ko'));
}

function step0SelectedFilterValues(key) {
  return key === 'progress'
    ? [...state.step0StatusFilterValues]
    : selectedFilterValues(state.step0Filters?.[key]);
}

function renderStep0MultiFilter(element, key, values) {
  if (!element) return;
  const options = values.map((value) => typeof value === 'string' ? { value, label: value } : value);
  const selected = step0SelectedFilterValues(key);
  const summary = element.querySelector('[data-step0-multi-filter-summary]');
  const trigger = element.querySelector('.filter-multiselect-trigger');
  const menu = element.querySelector('.filter-multiselect-menu');
  if (!summary || !trigger || !menu) return;
  summary.textContent = selected.length === 0
    ? '전체'
    : selected.length === 1
      ? (options.find((option) => option.value === selected[0])?.label || selected[0])
      : `${selected.length}개 선택`;
  trigger.setAttribute('aria-label', `${element.querySelector('.filter-multiselect-label')?.textContent || key}: ${summary.textContent}`);
  element.classList.toggle('has-selection', selected.length > 0);
  const searchQuery = element.dataset.filterSearchQuery || '';
  menu.innerHTML = [
    ...multiFilterMenuMarkup(key, options, selected, 'data-step0-multi-filter-value', searchQuery),
    '<div class="filter-multiselect-menu-actions"><button type="button" class="filter-multiselect-done" data-step0-multi-filter-done>완료</button></div>'
  ].join('');
  filterMultiMenuOptions(menu, searchQuery);
}

function renderStep0FilterControls() {
  const selected = state.step0StatusFilterValues;
  elements.step0StatFilterButtons?.forEach((button) => {
    const statKey = button.dataset.step0StatFilter;
    // The pending stat card filters to 'investigation_pending', not 'pending' — match that stored value.
    const isActive = selected.has(statKey === 'pending' ? 'investigation_pending' : statKey);
    button.classList.toggle('active', isActive);
    button.closest('.step0-stat-column')?.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    if (statKey === 'pending') {
      const labelEl = button.querySelector('.step0-stat-label');
      if (labelEl) labelEl.textContent = isActive ? '조사 대기' : 'Listing';
      button.setAttribute('data-tooltip', isActive
        ? '클릭 시 현재 Tab0에 업로드된 모든 Pipeline List 수를 나타냅니다.'
        : '클릭 시 Listing 완료된 Pipeline List 중 조사 대기 중인 Pipeline을 표시합니다.');
    }
  });
  STEP0_FILTER_KEYS.forEach((key) => {
    const element = elements[`step0${key[0].toUpperCase()}${key.slice(1)}Filter`];
    const options = step0FilterOptions(key);
    if (key !== 'progress') {
      state.step0Filters[key] = selectedFilterValues(state.step0Filters[key])
        .filter((value) => options.includes(value));
    }
    renderStep0MultiFilter(element, key, options);
  });
  renderStep0EvaluationProgressFilters();
}

const STEP0_WORKFLOW_MAP_STAGES = [
  { key: 'pending', label: 'Listing', index: 0 },
  { key: 'fast_triage', label: 'Simple Research', index: 1 },
  { key: 'full_scout', label: 'Advanced Research', index: 2 },
  { key: 'shortlisting', label: 'Custom Review', index: 3 }
];

const STEP0_WORKFLOW_STAGE_STAGGER_MS = 420;

const STEP0_WORKFLOW_NODE_STYLES = {
  pending: { color: '#c7d0dc', size: 4 },
  fast_triage: { color: '#2a78d6', size: 7 },
  full_scout: { color: '#1baf7a', size: 13 },
  shortlisting: { color: '#b7791f', size: 22 }
};

const STEP0_WORKFLOW_STAGE_COLOR_VARIABLES = {
  pending: '--chart-other',
  fast_triage: '--chart-1',
  full_scout: '--chart-3',
  shortlisting: '--chart-5'
};

const STEP0_WORKFLOW_NODE_SIZE_RANGES = {
  pending: { referenceCount: 450, min: 3, max: 7 },
  fast_triage: { referenceCount: 100, min: 4, max: 11 },
  full_scout: { referenceCount: 20, min: 8, max: 20 },
  shortlisting: { referenceCount: 8, min: 12, max: 28 }
};

const STEP0_WORKFLOW_FILTER_COLOR_VARIABLES = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];
const STEP0_WORKFLOW_FILTER_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7', '#b7791f', '#8b5cf6'];
const STEP0_FILTER_COLOR_KEYS = ['indication', 'theme', 'cluster', 'modality', 'country', 'stage', 'progress'];

function step0WorkflowThemeColor(variable, fallback) {
  const value = typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
    : '';
  return value || fallback;
}

function step0WorkflowFilterColors() {
  return STEP0_WORKFLOW_FILTER_COLOR_VARIABLES.map((variable, index) => (
    step0WorkflowThemeColor(variable, STEP0_WORKFLOW_FILTER_COLORS[index])
  ));
}

function step0FilterHasSelection(key) {
  return key === 'progress'
    ? Boolean(state.step0StatusFilterValues?.size)
    : step0SelectedFilterValues(key).length > 0;
}

function rememberStep0FilterSelection(key, { colorAllCategories = false } = {}) {
  const order = (state.step0FilterSelectionOrder || []).filter((item) => item !== key);
  if (step0FilterHasSelection(key) || colorAllCategories) order.push(key);
  state.step0FilterSelectionOrder = order;
  state.step0ColorByFilter = order[order.length - 1] || '';
}

function step0ActiveColorFilter() {
  const orderedActive = [...(state.step0FilterSelectionOrder || [])]
    .reverse()
    .find((key) => STEP0_FILTER_COLOR_KEYS.includes(key) && (step0FilterHasSelection(key) || state.step0ColorByFilter === key));
  if (orderedActive) return orderedActive;
  const requested = String(state.step0ColorByFilter || '');
  if (STEP0_FILTER_COLOR_KEYS.includes(requested)) return requested;
  return STEP0_FILTER_COLOR_KEYS.find((key) => step0FilterHasSelection(key)) || '';
}

const STEP0_COLOR_FILTER_LABELS = {
  country: 'Location',
  modality: 'Modality',
  theme: 'Theme',
  cluster: 'Cluster',
  indication: 'Indication',
  stage: 'Pipeline Stage',
  progress: '진척 현황'
};

function step0SummaryColorScopeLabel() {
  const colorFilter = step0ActiveColorFilter();
  if (!colorFilter || colorFilter === 'progress') {
    const progressValues = step0SelectedFilterValues('progress');
    return progressValues.length
      ? `조사 진행 단계 색상 · ${progressValues.length === 1 ? progressValues[0] : `${progressValues.length}개 Filter`} 선택`
      : '조사 진행 단계 색상';
  }
  const label = STEP0_COLOR_FILTER_LABELS[colorFilter] || colorFilter;
  const selected = step0SelectedFilterValues(colorFilter);
  if (!selected.length) return `${label} 색상 · 전체`;
  return `${label} 색상 · ${selected.length === 1 ? selected[0] : `${selected.length}개 선택`}`;
}

function step0WorkflowNodeColor(row, stageKey, defaultColor) {
  const filterKey = step0ActiveColorFilter();
  if (!filterKey || filterKey === 'progress') return defaultColor;
  const values = step0RowFilterValues(row, filterKey);
  const selected = step0SelectedFilterValues(filterKey);
  const category = selected.find((value) => values.includes(value)) || values[0] || stageKey;
  if (/^(?:unknown|others?|n\/?a)$/i.test(String(category).trim())) {
    return step0WorkflowThemeColor('--chart-other', '#c7d0dc');
  }
  const colors = step0WorkflowFilterColors();
  const colorIndex = Math.floor(step0WorkflowSeededUnit(`${filterKey}:${category}`) * colors.length);
  return colors[Math.min(colors.length - 1, colorIndex)];
}

function step0WorkflowGridShape(nodeCount, width, height) {
  const aspectRatio = Math.max(width / Math.max(height, 1), 0.5);
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(nodeCount, 1) * aspectRatio)));
  return { cols, rows: Math.max(1, Math.ceil(nodeCount / cols)) };
}

function step0WorkflowNodeSize(stageKey, nodeCount) {
  const base = STEP0_WORKFLOW_NODE_STYLES[stageKey]?.size || 6;
  const range = STEP0_WORKFLOW_NODE_SIZE_RANGES[stageKey] || { referenceCount: 50, min: 4, max: 12 };
  const count = Math.max(1, Number(nodeCount) || 1);
  const scale = Math.pow(range.referenceCount / count, 0.22);
  const size = Math.max(range.min, Math.min(range.max, base * scale));
  return Math.round(size * 10) / 10;
}

function step0WorkflowNodeVariantSize(stageKey, sharedSize, seed) {
  const range = STEP0_WORKFLOW_NODE_SIZE_RANGES[stageKey] || { min: 4, max: 12 };
  // Keep the cloud visually layered without turning neighboring nodes into a noisy bubble chart.
  const variation = 0.86 + step0WorkflowSeededUnit(`${seed}:size`) * 0.28;
  const size = Math.max(range.min, Math.min(range.max, sharedSize * variation));
  return Math.round(size * 10) / 10;
}

function step0WorkflowSeededUnit(seed) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  value += value << 13;
  value ^= value >>> 7;
  value += value << 3;
  value ^= value >>> 17;
  value += value << 5;
  return (value >>> 0) / 4294967296;
}

function step0WorkflowIrregularPosition(index, nodeCount, width, height, size, seed) {
  const grid = step0WorkflowGridShape(nodeCount, width, height);
  const slotWidth = width / grid.cols;
  const slotHeight = height / grid.rows;
  const col = index % grid.cols;
  const row = Math.floor(index / grid.cols);
  const inset = Math.max(size / 2 + 1, 2);
  const jitterX = (step0WorkflowSeededUnit(`${seed}:x`) - 0.5) * slotWidth * 0.76;
  const jitterY = (step0WorkflowSeededUnit(`${seed}:y`) - 0.5) * slotHeight * 0.76;
  const x = slotWidth * (col + 0.5) + jitterX;
  const y = slotHeight * (row + 0.5) + jitterY;
  return {
    x: Math.max(inset, Math.min(width - inset, x)),
    y: Math.max(inset, Math.min(height - inset, y))
  };
}

function step0WorkflowEntryPosition(target, width, height, size, seed) {
  const inset = Math.max(size / 2 + 1, 2);
  const leftSpread = Math.max(width * 0.05, size * 3);
  const x = inset + step0WorkflowSeededUnit(`${seed}:entry-x`) * leftSpread;
  const yJitter = (step0WorkflowSeededUnit(`${seed}:entry-y`) - 0.5) * height * 0.18;
  return {
    x: Math.max(inset, Math.min(width - inset, x)),
    y: Math.max(inset, Math.min(height - inset, target.y + yJitter))
  };
}

function step0WorkflowMotionProgress(progress) {
  const eased = 1 - Math.pow(1 - progress, 3);
  const rebound = Math.sin(progress * Math.PI * 2.15) * (1 - progress) * 0.09;
  return Math.min(1.075, eased + rebound);
}

function animateStep0WorkflowDots(graph, nodes, stageIndex) {
  const timer = setTimeout(() => {
    const startedAt = performance.now();
    const duration = 720;
    const maxEntryDelay = 720;
    const maxSettleDuration = 60000;
    const tick = (now) => {
      const elapsed = now - startedAt;
      graph.updateNodeData(nodes.map((node) => {
        const progress = Math.max(0, Math.min(1, (elapsed - node.data.entryDelay) / duration));
        const entryReveal = Math.max(0, Math.min(1, (elapsed - node.data.entryDelay) / 170));
        const motion = step0WorkflowMotionProgress(progress);
        const arc = Math.sin(progress * Math.PI) * (1 - progress * 0.12);
        const settleProgress = Math.max(0, Math.min(1, (elapsed - node.data.entryDelay - duration) / node.data.settleDuration));
        const settleRamp = Math.sin(Math.min(1, settleProgress * 2.4) * Math.PI / 2);
        const settleFade = settleRamp * Math.pow(1 - settleProgress, 1.18);
        const settleTime = settleProgress * Math.PI * 3.25 + node.data.settlePhase;
        const settleOvershoot = Math.sin(settleProgress * Math.PI) * (1 - settleProgress * 0.32) * node.data.settleOvershoot;
        const ambientTime = elapsed * 0.00115 + node.data.settlePhase;
        const ambientX = Math.sin(ambientTime) * Math.min(width * 0.0035, 1.8);
        const ambientY = Math.cos(ambientTime * 0.9) * Math.min(height * 0.006, 2.2);
        return {
          id: node.id,
          style: {
            x: node.data.entryX + (node.data.targetX - node.data.entryX) * motion + node.data.arcX * arc + node.data.settleDirectionX * settleOvershoot + Math.sin(settleTime) * node.data.settleX * settleFade + ambientX,
            y: node.data.entryY + (node.data.targetY - node.data.entryY) * motion + node.data.arcY * arc + node.data.settleDirectionY * settleOvershoot + Math.cos(settleTime * 1.11) * node.data.settleY * settleFade + ambientY,
            opacity: entryReveal
          }
        };
      }));
      graph.draw?.();
      if (elapsed < duration + maxEntryDelay + maxSettleDuration) {
        step0WorkflowG6AnimationFrames.push(requestAnimationFrame(tick));
      }
    };
    step0WorkflowG6AnimationFrames.push(requestAnimationFrame(tick));
  }, stageIndex * STEP0_WORKFLOW_STAGE_STAGGER_MS);
  step0WorkflowG6RenderTimers.push(timer);
}

function destroyStep0WorkflowGraph() {
  step0WorkflowG6RenderTimers.forEach((timer) => clearTimeout(timer));
  step0WorkflowG6RenderTimers = [];
  step0WorkflowG6AnimationFrames.forEach((frame) => cancelAnimationFrame(frame));
  step0WorkflowG6AnimationFrames = [];
  step0WorkflowG6Graphs.forEach((graph) => graph?.destroy?.());
  step0WorkflowG6Graphs = [];
}

function step0WorkflowMapFor(stageKey) {
  return [...(elements.step0WorkflowMaps || [])]
    .find((element) => element.dataset.step0WorkflowMap === stageKey) || null;
}

function renderStep0WorkflowMapFallback(message) {
  [...(elements.step0WorkflowMaps || [])].forEach((element) => {
    element.innerHTML = `<p class="step0-workflow-map-empty">${escapeHtml(message)}</p>`;
  });
}

function renderStep0WorkflowDotCloud(groups) {
  STEP0_WORKFLOW_MAP_STAGES.forEach((stage) => {
    const mapElement = step0WorkflowMapFor(stage.key);
    if (!mapElement) return;
    const stageRows = groups.get(stage.key) || [];
    const style = STEP0_WORKFLOW_NODE_STYLES[stage.key];
    const sharedSize = step0WorkflowNodeSize(stage.key, stageRows.length);
    const stageColor = step0WorkflowThemeColor(STEP0_WORKFLOW_STAGE_COLOR_VARIABLES[stage.key], style.color);
    const dots = stageRows.map((row, rowIndex) => {
      const asset = String(row?.asset || 'Unnamed pipeline').trim() || 'Unnamed pipeline';
      const company = String(row?.company || '-').trim() || '-';
      const display = step0DashboardFieldDisplay(row);
      const dotColor = step0WorkflowNodeColor(row, stage.key, stageColor);
      const seed = `${stage.key}:${asset}:${company}:${display.stage}:${row?.target || ''}:${rowIndex}`;
      const size = step0WorkflowNodeVariantSize(stage.key, sharedSize, seed);
      const position = step0WorkflowIrregularPosition(rowIndex, stageRows.length, 100, 100, 0, seed);
      const title = `${asset} · ${company} · ${stage.label}${display.stage !== '-' ? ` · ${display.stage}` : ''}`;
      // Match the v0.7 graph motion: each stage starts in sequence, each dot
      // arrives over 720ms, then settles once for an individually varied 1.5–5s.
      const entryPosition = step0WorkflowEntryPosition(position, 100, 100, 0, seed);
      const entryDelay = stage.index * STEP0_WORKFLOW_STAGE_STAGGER_MS
        + Math.floor(step0WorkflowSeededUnit(`${seed}:entry`) * 721);
      const settleDelay = entryDelay + 720;
      const settleDuration = 1500 + Math.floor(step0WorkflowSeededUnit(`${seed}:settle-duration`) * 3501);
      const settleDirectionX = Math.sign(position.x - entryPosition.x) || 1;
      const settleDirectionY = Math.sign(position.y - entryPosition.y) || 1;
      const settleX = (settleDirectionX * (step0WorkflowSeededUnit(`${seed}:settle-x`) + 0.2) * 3.5).toFixed(2);
      const settleY = (settleDirectionY * (step0WorkflowSeededUnit(`${seed}:settle-y`) + 0.2) * 4.5).toFixed(2);
      const settleReturnX = (-Number(settleX) * 0.42).toFixed(2);
      const settleReturnY = (-Number(settleY) * 0.42).toFixed(2);
      const settleFinalX = (Number(settleX) * 0.18).toFixed(2);
      const settleFinalY = (Number(settleY) * 0.18).toFixed(2);
      return `<button class="step0-workflow-dot" type="button" tabindex="0" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" style="--step0-dot-x:${position.x.toFixed(2)}%;--step0-dot-y:${position.y.toFixed(2)}%;--step0-dot-entry-x:${entryPosition.x.toFixed(2)}%;--step0-dot-entry-y:${entryPosition.y.toFixed(2)}%;--step0-dot-size:${size}px;--step0-dot-color:${dotColor};--step0-dot-entry-delay:${entryDelay}ms;--step0-dot-settle-delay:${settleDelay}ms;--step0-dot-settle-duration:${settleDuration}ms;--step0-dot-settle-x:${settleX}px;--step0-dot-settle-y:${settleY}px;--step0-dot-settle-return-x:${settleReturnX}px;--step0-dot-settle-return-y:${settleReturnY}px;--step0-dot-settle-final-x:${settleFinalX}px;--step0-dot-settle-final-y:${settleFinalY}px"></button>`;
    }).join('');
    mapElement.innerHTML = `<div class="step0-workflow-dot-cloud" aria-label="${escapeHtml(stage.label)} Pipeline 점 분포">${dots}</div>`;
  });
}

// Maps a workflow-map stage key to its counterpart in the {pending, fast_triage,
// full_scout, shortlisted} stats object — everything lines up except this one.
const STEP0_STAGE_STATS_KEY = { pending: 'pending', fast_triage: 'fast_triage', full_scout: 'full_scout', shortlisting: 'shortlisted' };

// Every render of the dot cloud (placeholder or real) tears down and rebuilds the whole
// thing, which restarts every dot's entrance animation from scratch — each dot sits
// invisible (opacity 0) until its own staggered entry delay elapses, so an unnecessary
// rebuild reads as "the dots all disappeared, then faded back in". Skip the rebuild
// entirely when the per-stage counts haven't changed since the last render: going from
// the placeholder (generic rows) to the real progress table (actual named rows) is
// exactly that case whenever the totals agree, and per earlier feedback nobody reads an
// individual dot's tooltip anyway, so leaving the placeholder dots in place rather than
// replacing them with identically-sized "real" ones is not a loss.
let step0WorkflowMapLastCountsKey = null;

function step0WorkflowStageCounts(groups) {
  return STEP0_WORKFLOW_MAP_STAGES.map((stage) => (groups.get(stage.key) || []).length);
}

// Ends the placeholder cloud's dim, endlessly-wobbling "still loading" look: removing
// this class lets each dot's settle animation finish its current cycle and hold at
// rest instead of looping, while opacity/filter transition up to the sharp, final
// look — the visible "becomes clear and finds its place" signal that loading is done.
function step0WorkflowMapFinalizeDots() {
  document.querySelectorAll('.step0-workflow-dot.is-placeholder')
    .forEach((dot) => dot.classList.remove('is-placeholder'));
}

// Draws the dot cloud from just the stat counts (cache or the fast stats-only
// endpoint), before the full progress table — and each row's actual asset/company —
// has loaded. Nobody reads an individual dot's tooltip; what matters is the cloud
// existing and roughly the right size immediately. renderStep0WorkflowMap() replaces
// this with the real, correctly-labeled dots the moment full rows are available.
function renderStep0WorkflowMapPlaceholder(stats) {
  if (!elements.step0WorkflowMaps?.length) return;
  const total = STEP0_WORKFLOW_MAP_STAGES.reduce(
    (sum, stage) => sum + Math.max(0, Number(stats?.[STEP0_STAGE_STATS_KEY[stage.key]]) || 0),
    0
  );
  if (elements.step0WorkflowMap) {
    elements.step0WorkflowMap.setAttribute('aria-label', `Pipeline Workflow Map · 집계 ${total}건 (상세 정보 로딩 중)`);
  }
  if (!total) {
    destroyStep0WorkflowGraph();
    renderStep0WorkflowMapFallback('진척 현황을 불러오는 중입니다.');
    return;
  }
  const groups = new Map(STEP0_WORKFLOW_MAP_STAGES.map((stage) => {
    const count = Math.max(0, Number(stats?.[STEP0_STAGE_STATS_KEY[stage.key]]) || 0);
    return [stage.key, Array.from({ length: count }, () => ({}))];
  }));
  const countsKey = JSON.stringify(step0WorkflowStageCounts(groups));
  if (countsKey === step0WorkflowMapLastCountsKey) return;
  step0WorkflowMapLastCountsKey = countsKey;
  destroyStep0WorkflowGraph();
  renderStep0WorkflowDotCloud(groups);
  document.querySelectorAll('.step0-workflow-dot').forEach((dot) => dot.classList.add('is-placeholder'));
}

function renderStep0WorkflowMap() {
  if (!elements.step0WorkflowMaps?.length) return;
  const rows = step0FilteredSortedRows();
  elements.step0WorkflowMap.setAttribute('aria-label', `Pipeline Workflow Map · 현재 필터 결과 ${rows.length}건`);
  const groups = new Map(STEP0_WORKFLOW_MAP_STAGES.map((stage) => [stage.key, []]));
  rows.forEach((row) => {
    STEP0_WORKFLOW_MAP_STAGES.forEach((stage) => {
      if (stage.key === 'pending' || row?.[stage.key]?.done) groups.get(stage.key).push(row);
    });
  });
  if (!rows.length) {
    destroyStep0WorkflowGraph();
    renderStep0WorkflowMapFallback('현재 필터 조건에 맞는 Pipeline이 없습니다.');
    return;
  }
  const countsKey = JSON.stringify(step0WorkflowStageCounts(groups));
  if (countsKey === step0WorkflowMapLastCountsKey) {
    // Same per-stage counts as last render — the common case is the placeholder cloud
    // already showing exactly this many dots. Leave the existing dots in place (no
    // rebuild/re-entrance) and just end their "still loading" wobble.
    step0WorkflowMapFinalizeDots();
    return;
  }
  step0WorkflowMapLastCountsKey = countsKey;
  destroyStep0WorkflowGraph();
  // Render with regular DOM nodes, rather than depending on an externally loaded
  // chart library. This is the original dot-field interaction and remains visible
  // even when a corporate network blocks the G6 CDN.
  renderStep0WorkflowDotCloud(groups);
  return;
  if (!globalThis.G6?.Graph) {
    window.clearTimeout(step0WorkflowG6RetryTimer);
    step0WorkflowG6RetryTimer = window.setTimeout(renderStep0WorkflowMap, 350);
    renderStep0WorkflowMapFallback('Workflow Map을 불러오는 중입니다. 잠시 후 다시 확인해 주세요.');
    return;
  }

  window.clearTimeout(step0WorkflowG6RetryTimer);
  step0WorkflowG6RetryTimer = null;
  STEP0_WORKFLOW_MAP_STAGES.forEach((stage) => {
    const mapElement = step0WorkflowMapFor(stage.key);
    if (!mapElement) return;
    const enterDelay = stage.index * STEP0_WORKFLOW_STAGE_STAGGER_MS;
    mapElement.innerHTML = `<div class="step0-workflow-g6-shell is-entering" data-workflow-stage="${stage.key}" style="--step0-workflow-enter-delay:${enterDelay}ms"><div class="step0-workflow-g6" aria-label="${stage.label} Pipeline node 그래프"></div><div class="step0-workflow-tooltip" hidden></div></div>`;
  });

  for (const stage of STEP0_WORKFLOW_MAP_STAGES) {
    const mapElement = step0WorkflowMapFor(stage.key);
    const shell = mapElement?.querySelector(`.step0-workflow-g6-shell[data-workflow-stage="${stage.key}"]`);
    const container = shell?.querySelector('.step0-workflow-g6');
    const tooltip = shell?.querySelector('.step0-workflow-tooltip');
    if (!container) continue;
    const stageRows = groups.get(stage.key) || [];
    const style = STEP0_WORKFLOW_NODE_STYLES[stage.key];
    const sharedNodeSize = step0WorkflowNodeSize(stage.key, stageRows.length);
    const stageColor = step0WorkflowThemeColor(STEP0_WORKFLOW_STAGE_COLOR_VARIABLES[stage.key], style.color);
    const bounds = shell.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    const nodeById = new Map();
    const nodes = stageRows.map((row, rowIndex) => {
      const asset = String(row?.asset || 'Unnamed pipeline').trim() || 'Unnamed pipeline';
      const company = String(row?.company || '-').trim() || '-';
      const display = step0DashboardFieldDisplay(row);
      const id = `pipeline-${stage.key}-${rowIndex}`;
      const nodeSize = step0WorkflowNodeVariantSize(
        stage.key,
        sharedNodeSize,
        `${stage.key}:${asset}:${company}:${display.stage}:${row?.target || ''}`
      );
      const position = step0WorkflowIrregularPosition(rowIndex, stageRows.length, width, height, nodeSize, id);
      const entryPosition = step0WorkflowEntryPosition(position, width, height, nodeSize, id);
      const title = `${asset} · ${company} · ${stage.label}${display.stage !== '-' ? ` · ${display.stage}` : ''}`;
      nodeById.set(id, title);
      return {
        id,
        data: {
          stage: stage.key,
          size: nodeSize,
          targetX: position.x,
          targetY: position.y,
          entryX: entryPosition.x,
          entryY: entryPosition.y,
          entryDelay: Math.floor(step0WorkflowSeededUnit(`${id}:stagger`) * 721),
          arcX: (step0WorkflowSeededUnit(`${id}:arc-x`) - 0.5) * Math.min(width * 0.06, 20),
          arcY: (step0WorkflowSeededUnit(`${id}:arc-y`) - 0.5) * Math.min(height * 0.18, 28),
          settleDuration: 1500 + Math.floor(step0WorkflowSeededUnit(`${id}:settle-duration`) * 3501),
          settleX: (step0WorkflowSeededUnit(`${id}:settle-x`) + 0.2) * Math.min(width * 0.009, 4),
          settleY: (step0WorkflowSeededUnit(`${id}:settle-y`) + 0.2) * Math.min(height * 0.024, 5),
          settleOvershoot: (step0WorkflowSeededUnit(`${id}:settle-overshoot`) + 0.32) * Math.min(width * 0.009, 4),
          settleDirectionX: Math.sign(position.x - entryPosition.x) || 1,
          settleDirectionY: Math.sign(position.y - entryPosition.y),
          settlePhase: step0WorkflowSeededUnit(`${id}:settle-phase`) * Math.PI * 2
        },
        style: {
          size: nodeSize,
          fill: step0WorkflowNodeColor(row, stage.key, stageColor),
          opacity: 0,
          stroke: 'transparent',
          lineWidth: 0,
          x: entryPosition.x,
          y: entryPosition.y,
          cursor: 'pointer'
        }
      };
    });
    try {
      const graph = new globalThis.G6.Graph({
        container,
        width,
        height,
        autoResize: true,
        autoFit: false,
        animation: false,
        data: { nodes, edges: [] },
        node: { type: 'circle' },
      behaviors: ['drag-element']
      });
      step0WorkflowG6Graphs.push(graph);
      graph.render();
      animateStep0WorkflowDots(graph, nodes, stage.index);
      graph.on?.('node:pointerenter', (event) => {
      const title = nodeById.get(event?.target?.id);
      if (!title || !tooltip) return;
      tooltip.textContent = title;
      tooltip.hidden = false;
    });
      graph.on?.('node:pointerleave', () => {
      if (tooltip) tooltip.hidden = true;
    });
      graph.on?.('canvas:pointerleave', () => {
      if (tooltip) tooltip.hidden = true;
    });
    } catch (error) {
      console.warn(`G6 ${stage.label} Workflow Map render failed.`, error);
      destroyStep0WorkflowGraph();
      renderStep0WorkflowMapFallback('Workflow Map을 표시하지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }
  }
}

function updateStep0MultiFilter(key, value) {
  const options = step0FilterOptions(key);
  if (value === 'all') {
    if (key === 'progress') state.step0StatusFilterValues.clear();
    else state.step0Filters[key] = [];
  } else if (key === 'progress') {
    if (state.step0StatusFilterValues.has(value)) state.step0StatusFilterValues.delete(value);
    else state.step0StatusFilterValues.add(value);
  } else {
    const selected = new Set(step0SelectedFilterValues(key));
    if (selected.has(value)) selected.delete(value);
    else if (options.includes(value)) selected.add(value);
    state.step0Filters[key] = [...selected];
  }
  if (value === 'all' && key === 'progress') {
    state.step0FilterSelectionOrder = [];
    state.step0ColorByFilter = '';
  } else {
    rememberStep0FilterSelection(key, { colorAllCategories: value === 'all' });
  }
  state.step0Page = 1;
  renderStep0FilterControls();
  renderStep0FilteredResults();
}

function toggleStep0EvaluationProgressFilter(key) {
  if (!STEP0_EVALUATION_FILTER_KEYS.includes(key)) return;
  if (state.step0EvaluationFilterValues.has(key)) state.step0EvaluationFilterValues.delete(key);
  else state.step0EvaluationFilterValues.add(key);
  state.step0Page = 1;
  renderStep0EvaluationProgressFilters();
  renderStep0FilteredResults();
}

function renderStep0FilteredResults() {
  renderStep0ProgressTable();
  renderStep0StatStrip();
}

function step0FieldTitle(rawValue, displayValue) {
  const raw = String(rawValue || '').trim();
  const display = String(displayValue || '').trim();
  return raw && raw !== display ? ` title="${escapeHtml(raw)}"` : '';
}

function step0ResearchEditMode(row) {
  if (row?.full_scout?.done) return 'full';
  if (row?.fast_triage?.done) return 'triage';
  return null;
}

function step0ListingFieldMarkup(row, field, value, { html = '', title = '', className = '' } = {}) {
  const queueId = String(row?.pending?.queue_id || '');
  const isManual = Boolean(row?.listing_manual_fields?.[field]);
  const researchMode = step0ResearchEditMode(row);
  const admin = Boolean(getCurrentUser()?.is_admin);
  const editable = Boolean(queueId && admin && !researchMode);
  const locked = Boolean(researchMode && admin);
  const classes = [
    'step0-table-value',
    'table-manual-text',
    isManual ? 'is-human' : '',
    editable ? 'is-editable' : '',
    locked ? 'is-research-locked' : '',
    className
  ].filter(Boolean).join(' ');
  const attributes = editable
    ? ` data-step0-listing-edit data-queue-id="${escapeHtml(queueId)}" data-step0-field="${escapeHtml(field)}" data-previous-value="${escapeHtml(value || '')}" role="button" tabindex="0" aria-label="Double-click to edit ${escapeHtml(field)}"`
    : locked
      ? ` data-step0-research-locked data-step0-mode="${escapeHtml(researchMode)}" role="button" tabindex="0" aria-label="Open ${researchMode} Dashboard editing guidance"`
      : '';
  const manualTitle = isManual ? 'Human manual edit' : '';
  const safeTitle = title || manualTitle || String(value || '');
  return `<span class="${classes}"${attributes}${safeTitle ? ` title="${escapeHtml(safeTitle)}"` : ''}>${html || escapeHtml(value || '-')}</span>`;
}

function closeStep0EditLockedModal() {
  if (elements.step0EditLockedModal) elements.step0EditLockedModal.hidden = true;
  activeStep0LockedEditMode = null;
  activeStep0LockedRecordId = null;
}

function openStep0EditLockedModal(mode, { commentWorkspace = false, recordId = '', shortlisting = false, fullScoutAlias = false } = {}) {
  const targetMode = mode === 'full' ? 'full' : 'triage';
  const label = targetMode === 'full' ? 'Tab 2 · Advanced Research' : 'Tab 1 · Simple Research';
  activeStep0LockedEditMode = targetMode;
  activeStep0LockedRecordId = String(recordId || '');
  if (elements.step0EditLockedTitle) {
    elements.step0EditLockedTitle.textContent = fullScoutAlias
      ? 'Advanced Research 원문 리포트는 Tab 2에서 확인합니다'
      : shortlisting
      ? `${label}에서 수정하세요`
      : commentWorkspace
      ? `${label} Team Workspace에서 수정하세요`
      : `${label}에서 수정하세요`;
  }
  if (elements.step0EditLockedMessage) {
    elements.step0EditLockedMessage.textContent = fullScoutAlias
      ? '이 asset은 Advanced Research 조사가 완료되어 Simple Research에도 함께 표시되고 있습니다.'
      : shortlisting
      ? 'Custom Review에는 Advanced Research의 공식 Pipeline 정보가 읽기 전용으로 표시됩니다. Company·Location·Asset·Modality·Target·Main indication·Pipeline Stage 수정은 Tab 2 · Advanced Research에서 진행합니다.'
      : commentWorkspace
      ? `Tab 0에는 원본 Team Workspace 코멘트가 읽기 전용으로 표시됩니다. 이 코멘트의 수정 및 삭제는 ${label} Team Workspace에서 진행합니다.`
      : `이미 수행된 ${targetMode === 'full' ? 'Advanced Research' : 'Simple Research'}의 공식 조사값이 Tab 0에 표시되고 있습니다. 원본 조사값 수정은 ${label} Pipeline Table에서 진행합니다.`;
  }
  if (elements.step0EditLockedGo) elements.step0EditLockedGo.textContent = commentWorkspace || shortlisting || fullScoutAlias ? `Tab ${targetMode === 'full' ? '2' : '1'} 상세 페이지로 이동` : `${label}로 이동`;
  if (elements.step0EditLockedModal) elements.step0EditLockedModal.hidden = false;
  elements.step0EditLockedGo?.focus();
}

async function saveStep0ListingFieldEdit(input) {
  const queueId = String(input?.dataset.queueId || '');
  const field = String(input?.dataset.step0Field || '');
  const previousValue = String(input?.dataset.previousValue || '').trim();
  const value = String(input?.value || '').trim();
  if (!queueId || !['company', 'asset', 'country', 'modality', 'target', 'main_indication', 'stage', 'website'].includes(field)) return;
  if (value === previousValue) {
    renderStep0ProgressTable();
    return;
  }
  if ((field === 'company' || field === 'asset') && !value) {
    showStep0Message('Company와 Asset은 필수 항목입니다.', 'warning');
    input.focus();
    return;
  }
  input.dataset.saving = 'true';
  input.disabled = true;
  try {
    const response = await fetch('/api/candidate-queue/listing-details', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId, field, value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    await loadStep0Progress();
    showStep0Message(`${field.replaceAll('_', ' ')}를 수정했습니다.`, 'success');
  } catch (error) {
    input.disabled = false;
    input.dataset.saving = '';
    showStep0Message(`수정하지 못했습니다: ${error.message}`, 'error');
    input.focus();
  }
}

function openStep0ListingFieldEdit(anchor) {
  if (!anchor || !getCurrentUser()?.is_admin || anchor.dataset.editing === 'true') return;
  const queueId = String(anchor.dataset.queueId || '');
  const field = String(anchor.dataset.step0Field || '');
  const previousValue = String(anchor.dataset.previousValue || '').trim();
  if (!queueId || !['company', 'asset', 'country', 'modality', 'target', 'main_indication', 'stage', 'website'].includes(field)) return;
  anchor.dataset.editing = 'true';
  const isStage = field === 'stage';
  const input = document.createElement(isStage ? 'select' : 'input');
  input.className = isStage ? 'table-edit-select stage-edit step0-listing-edit-select' : 'table-manual-text-input step0-listing-edit-input';
  if (!isStage) {
    input.type = 'text';
    input.maxLength = 5000;
    input.value = previousValue;
  } else {
    input.innerHTML = CANONICAL_DEVELOPMENT_STAGES.map((stage) => selectOption(stage, canonicalDevelopmentStage(previousValue) || 'Unknown', stage)).join('');
  }
  input.dataset.queueId = queueId;
  input.dataset.step0Field = field;
  input.dataset.previousValue = previousValue;
  input.setAttribute('aria-label', `${field} edit`);
  anchor.replaceWith(input);
  input.focus();
  if (!isStage) input.select();
  const cancel = () => renderStep0ProgressTable();
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      input.dataset.cancelled = 'true';
      cancel();
    }
    if (!isStage && event.key === 'Enter') {
      event.preventDefault();
      saveStep0ListingFieldEdit(input);
    }
  });
  if (isStage) input.addEventListener('change', () => saveStep0ListingFieldEdit(input), { once: true });
  else input.addEventListener('blur', () => {
    if (input.dataset.saving === 'true' || input.dataset.cancelled === 'true') return;
    saveStep0ListingFieldEdit(input);
  }, { once: true });
}

function closeStep0MetadataPopover() {
  activeStep0MetadataPopover?.remove();
  activeStep0MetadataPopover = null;
}

function positionStep0MetadataPopover(popover, anchor) {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(360, Math.max(260, window.innerWidth - 24));
  popover.style.width = `${width}px`;
  // Start at the Comment pill itself, so the editor stays with the row rather than jumping to the viewport edge.
  const desiredLeft = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  popover.style.left = `${desiredLeft}px`;
  popover.style.top = `${Math.min(window.innerHeight - 18, rect.bottom + 8)}px`;
  const popoverHeight = popover.getBoundingClientRect().height;
  if (rect.bottom + 8 + popoverHeight > window.innerHeight - 12 && rect.top - popoverHeight - 8 > 12) {
    popover.style.top = `${rect.top - popoverHeight - 8}px`;
  }
}

function step0MetadataValue(row, field) {
  return String(row?.metadata?.[field] || '').trim();
}

async function saveStep0Metadata(row, field, value, status, { deleting = false } = {}) {
  const owner = row?.metadata_owner || {};
  const payload = {
    owner_type: owner.type,
    field,
    value: String(value || '').trim()
  };
  if (deleting) payload.delete = true;
  if (owner.type === 'queue') payload.queue_id = owner.queue_id;
  if (owner.type === 'record') payload.record_id = owner.record_id;
  if (!payload.owner_type || (!payload.queue_id && !payload.record_id)) {
    throw new Error('저장할 Listing 항목을 찾지 못했습니다.');
  }
  if (status) status.textContent = '저장 중…';
  const response = await fetch('/api/candidate-queue/metadata', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Comment 또는 Contact 저장에 실패했습니다.');
  row.metadata = { ...(row.metadata || {}), [field]: payload.value, ...(data.metadata || {}) };
  closeStep0MetadataPopover();
  await loadStep0Progress();
  const savedLabel = field === 'comment' ? 'Comment' : field === 'contact' ? 'Contact' : 'Website';
  const wasDeleted = !String(payload.value || '').trim();
  const successMessage = wasDeleted && field === 'contact'
    ? 'Contact History를 삭제했습니다. Pipeline Table과 연결된 Team Review 표시에 반영했습니다.'
    : wasDeleted
      ? `${savedLabel}를 삭제했습니다. Pipeline Table과 연결된 Team Review 표시에 반영했습니다.`
      : `${savedLabel}를 저장했습니다.`;
  showStep0Message(successMessage, 'success');
  showStep0ActionNotice(successMessage, 'success');
}

function openStep0MetadataPopover(anchor, row, field, { editing = false } = {}) {
  closeStep0MetadataPopover();
  const owner = row?.metadata_owner || {};
  if (!owner.type) return;
  const admin = Boolean(getCurrentUser()?.is_admin);
  if (editing && !admin) return;
  if (editing && field === 'comment' && !step0ListingCommentCanEdit(row)) return;
  const label = field === 'comment' ? 'Comment' : field === 'contact' ? 'Contact History' : 'Website';
  const value = step0MetadataValue(row, field);
  const commentFeed = field === 'comment' ? step0CommentFeed(row) : field === 'contact' ? step0ContactFeed(row) : [];
  const popover = document.createElement('section');
  popover.className = 'step0-metadata-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', `${row.asset || 'Pipeline'} ${label}`);
  popover.innerHTML = editing
    ? `
      <header><strong>${label}</strong><button type="button" class="step0-metadata-close" aria-label="닫기">×</button></header>
      <form data-step0-metadata-form>
        <textarea rows="4" maxlength="5000" aria-label="${label} 입력" placeholder="${label}을 입력하세요.">${escapeHtml(value)}</textarea>
        <p class="step0-metadata-status" aria-live="polite"></p>
        <footer><button type="button" data-step0-metadata-cancel>취소</button><button type="submit" class="is-primary">저장</button></footer>
      </form>
    `
    : `
      <header><strong>${label}</strong><button type="button" class="step0-metadata-close" aria-label="닫기">×</button></header>
      <p class="step0-metadata-value${value ? '' : ' is-empty'}">${value ? escapeHtml(value).replaceAll('\n', '<br>') : `저장된 ${label}이 없습니다.`}</p>
      ${admin ? '<footer><button type="button" class="is-primary" data-step0-metadata-edit>수정</button></footer>' : ''}
    `;
  if (!editing && (field === 'comment' || field === 'contact')) {
    const isContactHistory = field === 'contact';
    const postLabel = isContactHistory ? 'Contact History' : 'Comment';
    const canEditListingComment = isContactHistory ? step0ContactHistoryCanEdit(row) : step0ListingCommentCanEdit(row);
    // Import events are deliberately kept as separate audit cards.  Editing a
    // single aggregate field would otherwise silently collapse several dated
    // Tab 0 import comments back into one card.
    const canEditSingleListingComment = canEditListingComment && commentFeed.length <= 1;
    const commentCards = commentFeed.length
      ? commentFeed.map((entry) => {
        const source = escapeHtml(String(entry.source || 'Comment'));
        const author = escapeHtml(String(entry.author || ''));
        const createdAt = escapeHtml(formatDateTimeKo(entry.created_at));
        const body = escapeHtml(String(entry.body || '')).replaceAll('\n', '<br>');
        const byline = [author, createdAt].filter(Boolean).join(' · ');
        const sourceText = String(entry.source || '');
        const isEditableListingComment = canEditSingleListingComment && sourceText.includes(isContactHistory ? 'Tab 0 · Contact History' : 'Tab 0 · Comment');
        const sourceWorkspaceMode = sourceText.includes('Tab 2') && sourceText.includes('Full Scout')
          ? 'full'
          : sourceText.includes('Tab 1') && sourceText.includes('Fast Triage')
            ? 'triage'
            : '';
        const workspaceMode = sourceWorkspaceMode;
        const workspaceRecordId = workspaceMode === 'full'
          ? String(row?.full_scout?.record_id || '')
          : workspaceMode === 'triage'
            ? String(row?.fast_triage?.record_id || '')
            : '';
        const interaction = isEditableListingComment
          ? ` data-step0-comment-edit data-step0-comment-field="${field}" title="두 번 클릭하여 수정"`
          : workspaceMode
            ? ` data-step0-comment-workspace data-step0-mode="${workspaceMode}" data-step0-record-id="${escapeHtml(workspaceRecordId)}" role="button" tabindex="0" title="두 번 클릭하여 원본 Team Workspace로 이동"`
            : '';
        return `<article class="step0-comment-feed-item${isEditableListingComment ? ' is-editable' : ''}${workspaceMode ? ' is-workspace-comment' : ''}"${interaction}><header><small>${source}${byline ? ` · ${byline}` : ''}</small>${isEditableListingComment ? `<button type="button" class="step0-comment-delete" data-step0-comment-delete aria-label="${postLabel} 삭제" title="삭제">×</button>` : ''}</header><p>${body}</p></article>`;
      }).join('')
      : '<p class="step0-metadata-value is-empty">No comments recorded.</p>';
    popover.innerHTML = `
      <header><strong>${postLabel}</strong><button type="button" class="step0-metadata-close" aria-label="Close">×</button></header>
      <div class="step0-comment-feed">${commentCards}</div>
      ${canEditSingleListingComment ? `<footer><button type="button" class="is-primary" data-step0-metadata-edit>${postLabel}</button></footer>` : ''}
    `;
  }
  document.body.appendChild(popover);
  activeStep0MetadataPopover = popover;
  positionStep0MetadataPopover(popover, anchor);
  const close = () => closeStep0MetadataPopover();
  popover.querySelector('.step0-metadata-close')?.addEventListener('click', close);
  popover.querySelector('[data-step0-metadata-cancel]')?.addEventListener('click', close);
  popover.querySelector('[data-step0-metadata-edit]')?.addEventListener('click', () => {
    openStep0MetadataPopover(anchor, row, field, { editing: true });
  });
  popover.querySelector('[data-step0-comment-edit]')?.addEventListener('dblclick', (event) => {
    if (event.target.closest('[data-step0-comment-delete]')) return;
    event.preventDefault();
    openStep0MetadataPopover(anchor, row, event.currentTarget.dataset.step0CommentField || field, { editing: true });
  });
  popover.querySelectorAll('[data-step0-comment-workspace]').forEach((card) => {
    const openWorkspaceGuidance = (event) => {
      event.preventDefault();
      openStep0EditLockedModal(card.dataset.step0Mode, { commentWorkspace: true, recordId: card.dataset.step0RecordId });
    };
    card.addEventListener('dblclick', openWorkspaceGuidance);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') openWorkspaceGuidance(event);
    });
  });
  popover.querySelector('[data-step0-comment-delete]')?.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const postLabel = field === 'contact' ? 'Contact History' : 'Listing Comment';
    if (!await confirmDashboardDelete({ title: `${postLabel}를 삭제할까요?`, message: `삭제한 ${postLabel}는 복구할 수 없습니다.` })) return;
    const button = event.currentTarget;
    button.disabled = true;
    button.classList.add('is-deleting');
    button.setAttribute('aria-label', `${postLabel} 삭제 중`);
    button.title = '삭제 중';
    button.textContent = '…';
    try {
      showStep0ActionNotice(`${postLabel}를 삭제하고 있습니다.`, 'success');
      await saveStep0Metadata(row, field, '', null, { deleting: true });
    } catch (error) {
      button.disabled = false;
      button.classList.remove('is-deleting');
      button.setAttribute('aria-label', `${postLabel} 삭제`);
      button.title = '삭제';
      button.textContent = '×';
      showStep0Message(error.message || `${postLabel}를 삭제하지 못했습니다.`, 'warning');
      showStep0ActionNotice(error.message || `${postLabel}를 삭제하지 못했습니다.`, 'error');
    }
  });
  popover.querySelector('[data-step0-metadata-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const textarea = form.querySelector('textarea');
    const status = form.querySelector('.step0-metadata-status');
    form.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    try {
      await saveStep0Metadata(row, field, textarea?.value || '', status);
    } catch (error) {
      if (status) status.textContent = error.message;
      form.querySelectorAll('button').forEach((button) => { button.disabled = false; });
    }
  });
  if (editing) popover.querySelector('textarea')?.focus();
}

function step0FilteredSortedRows() {
  const query = (state.step0Query || '').trim();
  const searchTerms = [...state.step0SearchTokens, query]
    .map(normalizedDashboardSearchText)
    .filter(Boolean);
  const statusFilters = state.step0StatusFilterValues;
  const evaluationFilters = state.step0EvaluationFilterValues;

  let rows = state.step0Rows.filter((row) => {
    if (searchTerms.length) {
      const details = row.listing_details || {};
      const display = step0DashboardFieldDisplay(row);
      const haystack = [
        row.asset, row.assetAliases, row.company, row.companyAliases,
        details.country, display.country, details.modality, display.modality,
        details.target, details.main_indication, display.indication,
        details.stage, display.stage, row.theme, row.cluster,
        details.website, row.metadata?.website, row.metadata?.contact,
        row.metadata?.asset_aliases, row.metadata?.company_aliases
      ].map(normalizedDashboardSearchText).join(' ');
      if (!searchTerms.every((term) => haystack.includes(term))) return false;
    }
    if (statusFilters.size && ![...statusFilters].some((status) => step0RowFilterValues(row, 'progress').includes(status))) return false;
    // Evaluation Progress headers are requirements, not alternative workflow
    // states: selecting Comment + Contact means a pipeline must have both.
    if (evaluationFilters.size && ![...evaluationFilters].every((key) => step0RowHasEvaluationProgress(row, key))) return false;
    if (['country', 'modality', 'theme', 'cluster', 'indication', 'stage'].some((key) => {
      const selected = step0SelectedFilterValues(key);
      return selected.length > 0 && !selected.some((value) => step0RowFilterValues(row, key).includes(value));
    })) return false;
    return true;
  });

  const { step0SortKey: sortKey, step0SortDirection: sortDirection } = state;
  if (sortKey && sortDirection) {
    const direction = sortDirection === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sortKey === 'asset' || sortKey === 'company') {
        return String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'ko') * direction;
      }
      const aDone = a[sortKey]?.done ? 1 : 0;
      const bDone = b[sortKey]?.done ? 1 : 0;
      return (aDone - bDone) * direction;
    });
  } else {
    // Keep completed investigations together, followed immediately by the
    // yellow investigation-waiting queue so it is easy to spot on Tab 0.
    rows = [...rows].sort((a, b) => {
      const rank = (row) => step0IsInvestigationPending(row) ? 1 : 0;
      return rank(a) - rank(b);
    });
  }
  return rows;
}

function renderStep0SearchTokens() {
  if (!elements.step0SearchTokens) return;
  const tokens = state.step0SearchTokens || [];
  elements.step0SearchTokens.hidden = tokens.length === 0;
  elements.step0SearchTokens.innerHTML = tokens.map((token) => `
    <button type="button" class="step0-search-token" data-step0-remove-search-token="${escapeHtml(token)}" aria-label="Remove ${escapeHtml(token)} search condition">
      <span>${escapeHtml(token)}</span><b aria-hidden="true">&minus;</b>
    </button>
  `).join('');
}

function renderSearchTokens() {
  if (!elements.searchTokens) return;
  const tokens = state.searchTokens || [];
  elements.searchTokens.hidden = tokens.length === 0;
  elements.searchTokens.innerHTML = tokens.map((token) => `
    <button type="button" class="step0-search-token" data-remove-search-token="${escapeHtml(token)}" aria-label="Remove ${escapeHtml(token)} search condition">
      <span>${escapeHtml(token)}</span><b aria-hidden="true">&minus;</b>
    </button>
  `).join('');
}

function placeSearchTokenRows() {
  const rows = [
    [elements.step0FilterControls, elements.step0SearchTokens],
    [elements.searchInput?.closest('.controls'), elements.searchTokens]
  ];
  rows.forEach(([controls, tokens]) => {
    if (!controls || !tokens) return;
    tokens.classList.add('is-controls-token-row');
    controls.appendChild(tokens);
  });
}

function addSearchToken() {
  const value = String(elements.searchInput?.value || '').trim();
  if (!value) {
    elements.searchInput?.focus();
    return;
  }
  const normalized = normalizedDashboardSearchText(value);
  const exists = state.searchTokens.some((token) => normalizedDashboardSearchText(token) === normalized);
  if (!exists) state.searchTokens.push(value);
  state.query = '';
  if (elements.searchInput) elements.searchInput.value = '';
  state.page = 1;
  captureModeFilters();
  renderSearchTokens();
  renderFilteredDashboard();
  elements.searchInput?.focus();
}

function removeSearchToken(token) {
  const normalized = normalizedDashboardSearchText(token);
  state.searchTokens = state.searchTokens.filter((item) => normalizedDashboardSearchText(item) !== normalized);
  state.page = 1;
  captureModeFilters();
  renderSearchTokens();
  renderFilteredDashboard();
}

function addStep0SearchToken() {
  const value = String(elements.step0SearchInput?.value || '').trim();
  if (!value) {
    elements.step0SearchInput?.focus();
    return;
  }
  const normalized = normalizedDashboardSearchText(value);
  const exists = state.step0SearchTokens.some((token) => normalizedDashboardSearchText(token) === normalized);
  if (!exists) state.step0SearchTokens.push(value);
  if (elements.step0SearchInput) elements.step0SearchInput.value = '';
  state.step0Query = '';
  renderStep0SearchTokens();
  renderStep0FilteredResults();
  elements.step0SearchInput?.focus();
}

function removeStep0SearchToken(token) {
  const normalized = normalizedDashboardSearchText(token);
  state.step0SearchTokens = state.step0SearchTokens.filter((item) => normalizedDashboardSearchText(item) !== normalized);
  renderStep0SearchTokens();
  renderStep0FilteredResults();
}

function updateStep0SortIndicators() {
  document.querySelectorAll('button[data-step0-sort]').forEach((button) => {
    const isActive = Boolean(state.step0SortKey && state.step0SortDirection && button.dataset.step0Sort === state.step0SortKey);
    button.classList.toggle('sort-active', isActive);
    button.dataset.sortDirection = isActive ? state.step0SortDirection : '';
  });
}

function sortStep0Column(key) {
  if (state.step0SortKey !== key || !state.step0SortDirection) {
    state.step0SortKey = key;
    state.step0SortDirection = 'asc';
  } else if (state.step0SortDirection === 'asc') {
    state.step0SortDirection = 'desc';
  } else {
    state.step0SortKey = null;
    state.step0SortDirection = null;
  }
  state.step0Page = 1;
  updateStep0SortIndicators();
  renderStep0ProgressTable();
}

function renderStep0ProgressTable() {
  if (!elements.step0ProgressTableBody) return;
  if (elements.step0PageSizeSelect) elements.step0PageSizeSelect.value = String(state.step0PageSize);
  const rows = step0FilteredSortedRows();
  const pageCount = Math.max(1, Math.ceil(rows.length / state.step0PageSize));
  state.step0Page = Math.min(state.step0Page, pageCount);
  const start = (state.step0Page - 1) * state.step0PageSize;
  const pageRows = rows.slice(start, start + state.step0PageSize);
  if (elements.step0TableCount) {
    elements.step0TableCount.textContent = `검색 결과 ${rows.length} / 전체 ${state.step0Rows.length} assets`;
  }
  if (elements.step0ExportExcelButton) elements.step0ExportExcelButton.disabled = rows.length === 0;
  state.step0VisiblePendingIds = pageRows
    .filter((row) => row.pending?.done && row.pending?.queue_id)
    .map((row) => row.pending.queue_id);
  if (!pageRows.length) {
    elements.step0ProgressTableBody.innerHTML = state.step0Rows.length
      ? '<tr><td colspan="15" class="step0-empty-state">현재 필터/검색 조건에 맞는 항목이 없습니다.</td></tr>'
      : '<tr><td colspan="15" class="step0-empty-state">진척 현황 데이터가 없습니다. 아래에서 후보 목록을 입력해 시작하세요.</td></tr>';
  } else {
    elements.step0ProgressTableBody.innerHTML = pageRows
      .map((row) => {
        const queueId = row.pending?.queue_id;
        const isPending = Boolean(row.pending?.done && queueId);
        const isRowSelected = isPending && state.step0SelectedPendingIds.has(queueId);
        const checked = isRowSelected ? 'checked' : '';
        const display = step0DashboardFieldDisplay(row);
        const checkboxCell = isPending
          ? `<input type="checkbox" class="step0-row-select" data-queue-id="${escapeHtml(queueId)}" ${checked} aria-label="${escapeHtml(row.asset)} 선택" />`
          : '';
        return `<tr class="${isRowSelected ? 'selected-row' : ''}">
          <td class="select-col">${checkboxCell}</td>
          <td class="step0-company-cell">${step0ListingFieldMarkup(row, 'company', row.company, { className: 'single-line-cell' })}</td>
          <td>${step0ListingFieldMarkup(row, 'country', display.countryRaw, { html: display.country === '-' ? '-' : countryDisplayMarkup(display.country), title: display.countryRaw && display.countryRaw !== display.country ? display.countryRaw : display.country })}</td>
          <td class="step0-asset-cell">${step0ListingFieldMarkup(row, 'asset', row.asset, { className: 'single-line-cell' })}</td>
          <td>${step0ListingFieldMarkup(row, 'modality', display.modalityRaw, { html: escapeHtml(display.modality), title: modalityFullHoverTitle({ modalityRaw: display.modalityRaw, modality: display.modality }), className: 'single-line-cell' })}</td>
          <td class="step0-target-cell">${step0ListingFieldMarkup(row, 'target', row.listing_details?.target || '', { className: 'target-single-line' })}</td>
          <td>${step0ListingFieldMarkup(row, 'main_indication', display.indicationRaw, { html: escapeHtml(display.indication), title: indicationFullHoverTitle({ indication: display.indicationRaw }, display.indication) })}</td>
          <td>${step0ListingFieldMarkup(row, 'stage', display.stageRaw, { html: escapeHtml(display.stage), title: pipelineStageFullHoverTitle({ stageRaw: display.stageRaw, stage: display.stage })})}</td>
          <td>${step0StageCellHtml('pending', { ...row.pending, row })}</td>
          <td>${step0StageCellHtml('fast_triage', row.fast_triage, row.full_scout)}</td>
          <td>${step0StageCellHtml('full_scout', row.full_scout)}</td>
          <td>${step0StageCellHtml('shortlisting', row.shortlisting)}</td>
          <td class="step0-metadata-cell">${step0MetadataCellHtml(row, 'comment')}</td>
          <td class="step0-metadata-cell">${step0MetadataCellHtml(row, 'contact')}</td>
          <td class="step0-website-cell">${step0WebsiteCellHtml(row)}</td>
        </tr>`;
      })
      .join('');
  }
  if (elements.step0PageInfo) elements.step0PageInfo.textContent = `${state.step0Page} / ${pageCount}`;
  if (elements.step0FirstPage) elements.step0FirstPage.disabled = state.step0Page <= 1;
  if (elements.step0PrevPage) elements.step0PrevPage.disabled = state.step0Page <= 1;
  if (elements.step0NextPage) elements.step0NextPage.disabled = state.step0Page >= pageCount;
  if (elements.step0LastPage) elements.step0LastPage.disabled = state.step0Page >= pageCount;
  updateStep0SelectAllState();
  renderStep0WorkflowMap();
}

function exportStep0Table() {
  const rows = step0FilteredSortedRows();
  const headers = ['Company', 'Location', 'Asset', 'Modality', 'Target', 'Main indication', 'Pipeline Stage', 'Listing', 'Simple Research', 'Advanced Research', 'Custom Review', 'Comment', 'Contact', 'Website'];
  const body = rows.map((row) => {
    const display = step0DashboardFieldDisplay(row);
    return [
      row.company,
      display.country === '-' ? '' : display.country,
      row.asset,
      display.modality === '-' ? '' : display.modality,
      row.listing_details?.target || '',
      display.indication === '-' ? '' : display.indication,
      display.stage === '-' ? '' : display.stage,
      row.pending?.done ? '✓' : '',
      row.fast_triage?.done ? '완료' : '',
      row.full_scout?.done ? '완료' : '',
      row.shortlisting?.done ? '완료' : '',
      row.metadata?.comment || '',
      row.metadata?.contact || '',
      row.listing_details?.website || row.metadata?.website || ''
    ];
  });
  const csv = [headers, ...body].map((line) => line.map(csvValue).join(',')).join('\r\n');
  const blob = new Blob([BOM_PREFIX + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const link = document.createElement('a');
  link.href = url;
  link.download = `skbp_step0_progress_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStep0Message(`${rows.length} rows exported`);
}

function updateStep0SelectAllState() {
  if (!elements.step0SelectAllRows) return;
  const visibleIds = state.step0VisiblePendingIds || [];
  const checkedCount = visibleIds.filter((id) => state.step0SelectedPendingIds.has(id)).length;
  const selectAll = elements.step0SelectAllRows;
  selectAll.checked = visibleIds.length > 0 && checkedCount === visibleIds.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < visibleIds.length;
  selectAll.disabled = visibleIds.length === 0;
  const selectionLabel = selectAll.indeterminate
    ? `현재 페이지에서 선택된 ${checkedCount}개 Listing 항목 해제`
    : selectAll.checked
      ? '현재 페이지의 Listing 항목 전체 선택 해제'
      : `현재 페이지의 Listing 항목 전체 선택 (최대 ${STEP0_MAX_SELECTED_CANDIDATES}개)`;
  selectAll.setAttribute('aria-label', selectionLabel);
  selectAll.title = selectionLabel;
}

function renderStep0SelectedCount() {
  if (elements.step0SelectedCount) {
    elements.step0SelectedCount.textContent = `${state.step0SelectedPendingIds.size}/${STEP0_MAX_SELECTED_CANDIDATES} 선택됨`;
  }
  updateStep0SelectAllState();
}

function setStep0PendingSelection(queueId, shouldSelect, { notifyLimit = true } = {}) {
  if (!queueId) return false;
  const isSelected = state.step0SelectedPendingIds.has(queueId);
  if (shouldSelect) {
    if (isSelected) return true;
    if (state.step0SelectedPendingIds.size >= STEP0_MAX_SELECTED_CANDIDATES) {
      if (notifyLimit) showStep0Message(`최대 ${STEP0_MAX_SELECTED_CANDIDATES}개까지 선택할 수 있습니다.`, 'warning');
      return false;
    }
    state.step0SelectedPendingIds.add(queueId);
    return true;
  }
  if (!isSelected) return true;
  state.step0SelectedPendingIds.delete(queueId);
  return true;
}

function syncStep0RowCheckbox(queueId, selected) {
  elements.step0ProgressTableBody?.querySelectorAll('.step0-row-select').forEach((checkbox) => {
    if (checkbox.dataset.queueId !== queueId) return;
    checkbox.checked = selected;
    checkbox.closest('tr')?.classList.toggle('selected-row', selected);
    // A checkbox still fires its native click/change after pointerdown's
    // preventDefault(), flipping `checked` back before `change` sees it.
    // Flag this element so the change handler skips its own (stale,
    // would-cancel-this-toggle) update for this interaction.
    checkbox.dataset.pointerHandled = 'true';
  });
}

function applyStep0DragSelection(queueId) {
  if (!step0DragSelection || !queueId || step0DragSelection.visitedIds.has(queueId)) return;
  step0DragSelection.visitedIds.add(queueId);
  const changed = setStep0PendingSelection(queueId, step0DragSelection.shouldSelect, {
    notifyLimit: !step0DragSelection.limitNotified
  });
  if (!changed) step0DragSelection.limitNotified = true;
  syncStep0RowCheckbox(queueId, state.step0SelectedPendingIds.has(queueId));
  renderStep0SelectedCount();
}

function endStep0DragSelection() {
  if (!step0DragSelection) return;
  const visitedIds = step0DragSelection.visitedIds;
  step0DragSelection = null;
  elements.step0ProgressTableBody?.classList.remove('is-selection-dragging');
  // Native checkbox click/change events follow pointerup. Keep the guard for
  // that event sequence, then clear it before the next user interaction.
  window.setTimeout(() => {
    elements.step0ProgressTableBody?.querySelectorAll('.step0-row-select').forEach((checkbox) => {
      if (visitedIds.has(checkbox.dataset.queueId)) delete checkbox.dataset.pointerHandled;
    });
  }, 0);
}

function resetStep0Filters() {
  state.step0Query = '';
  state.step0SearchTokens = [];
  state.step0StatusFilterValues.clear();
  state.step0EvaluationFilterValues.clear();
  state.step0Filters = { country: [], modality: [], theme: [], cluster: [], indication: [], stage: [] };
  state.step0ColorByFilter = '';
  state.step0FilterSelectionOrder = [];
  if (elements.step0SearchInput) elements.step0SearchInput.value = '';
  renderStep0SearchTokens();
  renderStep0FilterControls();
  state.step0Page = 1;
  renderStep0FilteredResults();
}

function toggleStep0StatusFilter(status) {
  if (!status) return;
  if (state.step0StatusFilterValues.has(status)) {
    state.step0StatusFilterValues.delete(status);
  } else {
    state.step0StatusFilterValues.add(status);
  }
  rememberStep0FilterSelection('progress');
  state.step0Page = 1;
  renderStep0FilterControls();
  renderStep0FilteredResults();
}

function applyStep0SummaryStageFilter(status) {
  // A Summary card represents one workflow state. Keep all dimensional
  // filters (including multiple indications) and replace only this stage.
  const filterValue = status === 'pending' ? 'investigation_pending' : status;
  // Clicking the already-active pending card again clears the filter back to Listing (all pipelines).
  const isAlreadyActive = filterValue
    && state.step0StatusFilterValues.size === 1
    && state.step0StatusFilterValues.has(filterValue);
  state.step0StatusFilterValues = new Set((filterValue && !isAlreadyActive) ? [filterValue] : []);
  rememberStep0FilterSelection('progress');
  state.step0Page = 1;
  renderStep0FilterControls();
  renderStep0FilteredResults();
}

function buildTriageInstructionPromptWithCandidates(pairs) {
  const base = buildTriageInstructionPrompt();
  if (!Array.isArray(pairs) || !pairs.length) return base;
  const listLines = pairs.map((pair) => {
    const details = pair.listing_details || {};
    const context = [
      ['Location', details.country],
      ['Modality', details.modality],
      ['Target', details.target],
      ['Main indication', details.main_indication],
      ['Pipeline Stage', details.stage],
      ['Website', details.website]
    ].filter(([, value]) => String(value || '').trim()).map(([label, value]) => `${label}: ${String(value).trim()}`).join('; ');
    return `${pair.asset}\t${pair.company}${context ? `\tListing context: ${context}` : ''}`;
  }).join('\n');
  return `${base}\n\nCandidates to triage now (Asset<TAB>Company<TAB>optional Listing context):\n${listLines}\n\nUse optional Listing context only to identify and retrieve the correct pipeline. Treat it as user-provided context, independently verify it, and do not treat it as rubric evidence unless confirmed by a source.`;
}

async function copyTriagePromptWithSelectedCandidates() {
  const button = elements.step0CopyInstructionsButton;
  const label = button?.querySelector('b');
  const idleLabel = label?.textContent || '지침 1 복사';
  if (label) label.textContent = '복사 중…';
  try {
    const pairs = state.step0Rows
      .filter((row) => row.pending?.queue_id && state.step0SelectedPendingIds.has(row.pending.queue_id))
      .map((row) => ({ asset: row.asset, company: row.company, listing_details: row.listing_details || {} }));
    const prompt = appendInstructionWarnings(buildTriageInstructionPromptWithCandidates(pairs), instructionWarningsCache.triage);
    await copyTextDuringUserGesture(prompt);
    showStep0Message(
      pairs.length ? `${pairs.length}개 후보 포함 지침 1 복사 완료` : '선택된 후보 없이 지침 1을 복사했습니다.'
    );
    if (label) {
      label.textContent = '복사됨';
      window.setTimeout(() => { label.textContent = idleLabel; }, 3000);
    }
    void refreshInstructionWarnings();
    return true;
  } catch (error) {
    showStep0Message('지침 복사 실패');
    if (label) {
      label.textContent = '복사 실패';
      window.setTimeout(() => { label.textContent = idleLabel; }, 3000);
    }
    return false;
  }
}

elements.step0ImportButton?.addEventListener('click', importStep0Candidates);
function clearStep0ListingInput() {
  renderStep0EntryGrid();
  showStep0PasteFeedback('');
  setStep0SaveStatus('waiting');
}
elements.step0ClearButton?.addEventListener('click', clearStep0ListingInput);
elements.step0ClearBottomButton?.addEventListener('click', clearStep0ListingInput);
elements.step0AddEntryRow?.addEventListener('click', () => appendStep0EntryRows());
elements.step0EntryGridBody?.addEventListener('paste', pasteIntoStep0EntryGrid);
elements.step0EntryGridBody?.addEventListener('input', (event) => {
  if (event.target.matches('textarea[data-step0-entry-field]')) resizeStep0CommentCell(event.target);
});
bindClipboardCopyGesture(elements.step0CopyInstructionsButton, copyTriagePromptWithSelectedCandidates);
elements.step0ExportExcelButton?.addEventListener('click', exportStep0Table);
elements.step0PageSizeSelect?.addEventListener('change', (event) => {
  const nextSize = Number(event.target.value);
  state.step0PageSize = STEP0_PAGE_SIZE_OPTIONS.includes(nextSize) ? nextSize : STEP0_DEFAULT_PAGE_SIZE;
  localStorage.setItem(STEP0_PAGE_SIZE_STORAGE_KEY, String(state.step0PageSize));
  state.step0Page = 1;
  renderStep0ProgressTable();
});
elements.step0FirstPage?.addEventListener('click', () => {
  state.step0Page = 1;
  renderStep0ProgressTable();
});
elements.step0PrevPage?.addEventListener('click', () => {
  state.step0Page = Math.max(1, state.step0Page - 1);
  renderStep0ProgressTable();
});
elements.step0NextPage?.addEventListener('click', () => {
  state.step0Page += 1;
  renderStep0ProgressTable();
});
elements.step0LastPage?.addEventListener('click', () => {
  const pageCount = Math.max(1, Math.ceil(step0FilteredSortedRows().length / state.step0PageSize));
  state.step0Page = pageCount;
  renderStep0ProgressTable();
});
elements.step0SearchInput?.addEventListener('input', (event) => {
  state.step0Query = event.target.value;
  state.step0Page = 1;
  renderStep0FilteredResults();
});
elements.step0SearchInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  addStep0SearchToken();
});
elements.step0AddSearchTokenButton?.addEventListener('click', addStep0SearchToken);
elements.step0SearchTokens?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-step0-remove-search-token]');
  if (button) removeStep0SearchToken(button.dataset.step0RemoveSearchToken);
});
elements.step0FilterControls?.addEventListener('click', (event) => {
  const trigger = event.target.closest('.step0-filter-multiselect .filter-multiselect-trigger');
  if (trigger) {
    const filter = trigger.closest('.step0-filter-multiselect');
    const willOpen = !filter.classList.contains('is-open');
    closeMultiFilters();
    closeStep0MultiFilters(filter);
    if (willOpen) delete filter.dataset.filterSearchQuery;
    filter.classList.toggle('is-open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    const menu = filter.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = !willOpen;
    if (willOpen) requestAnimationFrame(() => menu?.querySelector('[data-filter-menu-search]')?.focus());
    return;
  }
  const doneButton = event.target.closest('[data-step0-multi-filter-done]');
  if (doneButton) {
    const filter = doneButton.closest('.step0-filter-multiselect');
    event.stopPropagation();
    closeStep0MultiFilters();
    filter?.querySelector('.filter-multiselect-trigger')?.focus();
    return;
  }
  const option = event.target.closest('.step0-filter-multiselect .filter-multiselect-option');
  if (!option) return;
  const filter = option.closest('.step0-filter-multiselect');
  const key = filter?.dataset.step0FilterKey;
  const value = option.dataset.step0MultiFilterValue;
  if (key && value) updateStep0MultiFilter(key, value);
});
elements.step0FilterControls?.addEventListener('input', handleMultiMenuSearch);
elements.step0StatFilterButtons?.forEach((button) => {
  button.addEventListener('click', () => applyStep0SummaryStageFilter(button.dataset.step0StatFilter));
});
elements.step0WorkflowStatColumns?.forEach((column) => {
  column.addEventListener('click', (event) => {
    // The metric itself keeps its normal button behavior; dots retain hover-only
    // inspection. A click on the open canvas remains a convenient stage filter.
    if (event.target.closest('[data-step0-stat-filter], .step0-workflow-dot')) return;
    applyStep0SummaryStageFilter(column.dataset.workflowStage);
  });
});
elements.step0ResetFiltersButton?.addEventListener('click', resetStep0Filters);
document.querySelectorAll('[data-step0-evaluation-filter]').forEach((button) => {
  button.addEventListener('click', () => toggleStep0EvaluationProgressFilter(button.dataset.step0EvaluationFilter));
});
document.querySelectorAll('button[data-step0-sort]').forEach((button) => {
  button.addEventListener('click', () => sortStep0Column(button.dataset.step0Sort));
});
elements.step0SelectAllRows?.addEventListener('change', (event) => {
  const visibleIds = state.step0VisiblePendingIds || [];
  const clearPartialSelection = event.target.dataset.clearPartialSelection === 'true';
  delete event.target.dataset.clearPartialSelection;
  if (event.target.checked && !clearPartialSelection) {
    const toAdd = visibleIds.filter((id) => !state.step0SelectedPendingIds.has(id));
    const room = Math.max(0, STEP0_MAX_SELECTED_CANDIDATES - state.step0SelectedPendingIds.size);
    toAdd.slice(0, room).forEach((id) => state.step0SelectedPendingIds.add(id));
    if (toAdd.length > room) showStep0Message(`최대 ${STEP0_MAX_SELECTED_CANDIDATES}개까지 선택할 수 있습니다.`, 'warning');
  } else {
    visibleIds.forEach((id) => state.step0SelectedPendingIds.delete(id));
  }
  renderStep0ProgressTable();
  renderStep0SelectedCount();
});
elements.step0SelectAllRows?.addEventListener('pointerdown', (event) => {
  event.currentTarget.dataset.clearPartialSelection = String(event.currentTarget.indeterminate);
});
elements.step0SelectAllRows?.addEventListener('keydown', (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    event.currentTarget.dataset.clearPartialSelection = String(event.currentTarget.indeterminate);
  }
});
elements.step0ProgressTableBody?.addEventListener('change', (event) => {
  const checkbox = event.target.closest('.step0-row-select');
  if (!checkbox) return;
  if (checkbox.dataset.pointerHandled === 'true') {
    delete checkbox.dataset.pointerHandled;
    const selected = state.step0SelectedPendingIds.has(checkbox.dataset.queueId);
    checkbox.checked = selected;
    checkbox.closest('tr')?.classList.toggle('selected-row', selected);
    return;
  }
  const queueId = checkbox.dataset.queueId;
  if (!queueId) return;
  const changed = setStep0PendingSelection(queueId, checkbox.checked);
  checkbox.checked = changed && state.step0SelectedPendingIds.has(queueId);
  checkbox.closest('tr')?.classList.toggle('selected-row', checkbox.checked);
  renderStep0SelectedCount();
});
elements.step0ProgressTableBody?.addEventListener('click', (event) => {
  const pipelineWebsite = event.target.closest('[data-pipeline-website]');
  if (pipelineWebsite) {
    event.preventDefault();
    openPipelineWebsiteLink(pipelineWebsite);
    return;
  }
  const indicator = event.target.closest('[data-step0-metadata]');
  if (indicator) {
    const field = indicator.dataset.step0MetadataField;
    const row = state.step0Rows.find((candidate) => candidate.identity === indicator.dataset.step0RowIdentity);
    if (!row || !field) return;
    event.preventDefault();
    openStep0MetadataPopover(indicator, row, field, { editing: false });
    return;
  }
  const locked = event.target.closest('[data-step0-research-locked]');
  if (locked) {
    event.preventDefault();
    openStep0EditLockedModal(locked.dataset.step0Mode);
  }
});
elements.step0ProgressTableBody?.addEventListener('dblclick', (event) => {
  const pipelineWebsite = event.target.closest('[data-pipeline-website]');
  if (pipelineWebsite) {
    event.preventDefault();
    window.clearTimeout(pipelineWebsiteOpenTimer);
    pipelineWebsiteOpenTimer = null;
    openPipelineWebsiteEditor(pipelineWebsite);
    return;
  }
  const website = event.target.closest('.step0-website-link');
  if (website) {
    if (website.matches('[data-step0-listing-edit]')) {
      event.preventDefault();
      openStep0ListingFieldEdit(website);
      return;
    }
    const indicator = website.closest('[data-step0-metadata]');
    if (indicator) {
      const field = indicator.dataset.step0MetadataField;
      const row = state.step0Rows.find((candidate) => candidate.identity === indicator.dataset.step0RowIdentity);
      if (row && field) {
        event.preventDefault();
        openStep0MetadataPopover(indicator, row, field, { editing: true });
      }
    }
    return;
  }
  const indicator = event.target.closest('[data-step0-metadata]');
  if (indicator) {
    const field = indicator.dataset.step0MetadataField;
    const row = state.step0Rows.find((candidate) => candidate.identity === indicator.dataset.step0RowIdentity);
    if (!row || !field) return;
    event.preventDefault();
    openStep0MetadataPopover(indicator, row, field, { editing: true });
    return;
  }
  const editable = event.target.closest('[data-step0-listing-edit]');
  if (editable) {
    event.preventDefault();
    openStep0ListingFieldEdit(editable);
  }
});
elements.step0ProgressTableBody?.addEventListener('keydown', (event) => {
  const editable = event.target.closest('[data-step0-listing-edit]');
  const locked = event.target.closest('[data-step0-research-locked]');
  if (!editable && !locked) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  if (editable) openStep0ListingFieldEdit(editable);
  else openStep0EditLockedModal(locked.dataset.step0Mode);
});
elements.step0EditLockedClose?.addEventListener('click', closeStep0EditLockedModal);
elements.step0EditLockedGo?.addEventListener('click', () => {
  const mode = activeStep0LockedEditMode;
  const recordId = activeStep0LockedRecordId;
  closeStep0EditLockedModal();
  if (!mode) return;
  if (recordId) {
    window.location.href = recordDetailHref({ id: recordId, isTriage: mode === 'triage' }, mode);
    return;
  }
  activatePipelineTab(mode);
  document.querySelector('#pipelineContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
elements.step0EditLockedModal?.addEventListener('click', (event) => {
  if (event.target === elements.step0EditLockedModal) closeStep0EditLockedModal();
});
elements.step0ProgressTableBody?.addEventListener('pointerdown', (event) => {
  if (event.target.closest('[data-step0-metadata]')) return;
  const checkbox = event.target.closest('.step0-row-select');
  if (!checkbox || event.button !== 0) return;
  const queueId = checkbox.dataset.queueId;
  if (!queueId) return;
  event.preventDefault();
  checkbox.focus({ preventScroll: true });
  step0DragSelection = {
    shouldSelect: !state.step0SelectedPendingIds.has(queueId),
    visitedIds: new Set(),
    limitNotified: false
  };
  elements.step0ProgressTableBody.classList.add('is-selection-dragging');
  applyStep0DragSelection(queueId);
});
elements.step0ProgressTableBody?.addEventListener('pointerover', (event) => {
  if (!step0DragSelection || !(event.buttons & 1)) return;
  const row = event.target.closest('tr');
  const checkbox = row?.querySelector('.step0-row-select');
  if (checkbox) applyStep0DragSelection(checkbox.dataset.queueId);
});
window.addEventListener('pointerup', endStep0DragSelection);
window.addEventListener('pointercancel', endStep0DragSelection);
window.addEventListener('blur', endStep0DragSelection);
elements.pipelineTable.addEventListener('pointerdown', (event) => {
  const checkbox = event.target.closest('.row-select');
  if (!checkbox || event.button !== 0) return;
  const id = checkbox.dataset.recordId;
  if (!id) return;
  event.preventDefault();
  checkbox.focus({ preventScroll: true });
  pipelineDragSelection = {
    shouldSelect: !state.selectedIds.has(id),
    visitedIds: new Set()
  };
  elements.pipelineTable.classList.add('is-selection-dragging');
  applyPipelineDragSelection(id);
});
elements.pipelineTable.addEventListener('pointerover', (event) => {
  if (!pipelineDragSelection || !(event.buttons & 1)) return;
  const row = event.target.closest('tr');
  const checkbox = row?.querySelector('.row-select');
  if (checkbox) applyPipelineDragSelection(checkbox.dataset.recordId);
});
window.addEventListener('pointerup', endPipelineDragSelection);
window.addEventListener('pointercancel', endPipelineDragSelection);
window.addEventListener('blur', endPipelineDragSelection);
document.addEventListener('pointerdown', (event) => {
  if (!activeStep0MetadataPopover) return;
  if (activeStep0MetadataPopover.contains(event.target) || event.target.closest('[data-step0-metadata]')) return;
  closeStep0MetadataPopover();
});
window.addEventListener('resize', closeStep0MetadataPopover);
window.addEventListener('scroll', closeStep0MetadataPopover, true);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeStep0MetadataPopover();
    closeStep0EditLockedModal();
  }
});

const DESCENDING_FIRST_SORT_KEYS = new Set([
  'targetScore',
  'moaScore',
  'dataScore',
  'competitiveScore',
  'platformScore',
  'expansionScore',
  'marketScore',
  'totalScore',
  'focusPriority'
]);

function sortByColumn(key) {
  closeScoreHeaderFilter();
  closeFocusHeaderFilter();
  const firstDirection = DESCENDING_FIRST_SORT_KEYS.has(key) ? 'desc' : 'asc';

  if (state.sortKey !== key || !state.sortDirection) {
    state.sortKey = key;
    state.sortDirection = firstDirection;
  } else if (state.sortDirection === firstDirection) {
    state.sortDirection = firstDirection === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = null;
    state.sortDirection = null;
  }
  state.page = 1;
  renderTable();
}

const COMMON_SORT_KEYS = ['company', 'country', 'asset', 'modality', 'target', 'mainIndication', 'stage'];
const SORT_KEYS_BY_MODE = {
  triage: new Set([...COMMON_SORT_KEYS, 'filter1', 'targetScore', 'moaScore', 'dataScore', 'generatedAt']),
  full: new Set([
    ...COMMON_SORT_KEYS,
    'filter2',
    'targetScore',
    'competitiveScore',
    'moaScore',
    'platformScore',
    'expansionScore',
    'dataScore',
    'marketScore',
    'totalScore'
  ]),
  focus: new Set([
    ...COMMON_SORT_KEYS,
    'filter2',
    'focusTotalScore',
    'totalScore30',
    'customScore',
    'filter3',
    'inVivoStatus',
  'inVitroStatus',
  'admetCompleted',
    'ddStatus',
    'focusDueDate',
    'focusAddedAt',
    'focusPriority'
  ])
};

function normalizeSortForMode(mode) {
  if (!state.sortKey) return;
  if (SORT_KEYS_BY_MODE[mode]?.has(state.sortKey)) return;
  state.sortKey = mode === 'triage' ? 'targetScore' : mode === 'focus' ? 'focusPriority' : 'totalScore';
  state.sortDirection = 'desc';
}

const TABLE_FILTER_STATE_KEYS = ['query', 'searchTokens', 'stage', 'theme', 'cluster', 'modality', 'indication', 'country', 'pass', 'scoreFilters', 'focusFilters'];

function captureModeFilters(mode = activeTableMode()) {
  state.filtersByMode[mode] = Object.fromEntries(
    TABLE_FILTER_STATE_KEYS.map((key) => [
      key,
      key === 'scoreFilters'
        ? Object.fromEntries(Object.keys(SCORE_HEADER_FILTERS).map((scoreKey) => [scoreKey, scoreFilterSelections(scoreKey)]))
        : key === 'focusFilters'
          ? Object.fromEntries(Object.keys(FOCUS_HEADER_FILTERS).map((focusKey) => [focusKey, focusFilterSelections(focusKey)]))
        : cloneFilterValue(state[key])
    ])
  );
}

function restoreModeFilters(mode) {
  Object.assign(state, state.filtersByMode[mode] || {});
  state.scoreFilters = Object.fromEntries(Object.keys(SCORE_HEADER_FILTERS).map((key) => [
    key,
    Array.isArray(state.scoreFilters?.[key]) ? state.scoreFilters[key] : []
  ]));
  state.focusFilters = Object.fromEntries(Object.keys(FOCUS_HEADER_FILTERS).map((key) => [
    key,
    Array.isArray(state.focusFilters?.[key]) ? state.focusFilters[key] : []
  ]));
  if (elements.searchInput) elements.searchInput.value = state.query;
}

function setTableMode(mode) {
  const nextMode = mode === 'triage' ? 'triage' : mode === 'focus' ? 'focus' : 'full';
  if (state.tableMode === nextMode) return;
  captureModeFilters(activeTableMode());
  state.tableMode = nextMode;
  restoreModeFilters(nextMode);
  state.page = 1;
  state.selectedIds.clear();
  normalizeSortForMode(nextMode);

  // Deliberately does not rewrite the URL to ?tab=<mode>: this used to make a
  // plain page refresh reopen whatever tab was last clicked instead of the
  // intended default landing tab (Shortlisting). Explicit ?tab= deep links
  // (e.g. a detail page's back link) still work since those set the initial
  // tab directly from the URL at load time, before any tab click happens.
  renderFilters();
  render();
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
  renderFilteredDashboard();
});
elements.searchInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  addSearchToken();
});
elements.addSearchTokenButton?.addEventListener('click', addSearchToken);
elements.searchTokens?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-search-token]');
  if (button) removeSearchToken(button.dataset.removeSearchToken);
});

function handleMultiFilterControlsClick(event) {
  const trigger = event.target.closest('.filter-multiselect-trigger');
  if (trigger) {
    const filter = trigger.closest('.filter-multiselect');
    if (filter?.dataset.step0FilterKey) return;
    event.stopPropagation();
    const willOpen = !filter.classList.contains('is-open');
    closeMultiFilters(filter);
    if (willOpen) delete filter.dataset.filterSearchQuery;
    filter.classList.toggle('is-open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    const menu = filter.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = !willOpen;
    if (willOpen) requestAnimationFrame(() => menu?.querySelector('[data-filter-menu-search]')?.focus());
    return;
  }

  const doneButton = event.target.closest('[data-multi-filter-done]');
  if (doneButton) {
    const filter = doneButton.closest('.filter-multiselect');
    if (filter?.dataset.step0FilterKey) return;
    event.stopPropagation();
    closeMultiFilters();
    filter?.querySelector('.filter-multiselect-trigger')?.focus();
    return;
  }

  const option = event.target.closest('.filter-multiselect-option');
  if (!option) return;
  const filter = option.closest('.filter-multiselect');
  if (filter?.dataset.step0FilterKey) return;
  event.stopPropagation();
  const key = filter?.dataset.filterKey;
  if (!key) return;
  const value = option.dataset.multiFilterValue;
  const selected = new Set(selectedFilterValues(state[key]));
  if (value === 'all') {
    selected.clear();
  } else if (selected.has(value)) {
    selected.delete(value);
  } else {
    selected.add(value);
  }
  state[key] = [...selected];
  state.page = 1;
  captureModeFilters();
  renderFilters();
  renderFilteredDashboard();
}

document.addEventListener('click', (event) => {
  const focusPopover = event.target.closest('#focusTableFilterPopover');
  if (focusPopover && activeFocusHeaderFilter) {
    const option = event.target.closest('[data-focus-filter-option]');
    if (option) {
      const value = option.dataset.focusFilterOption;
      if (activeFocusHeaderFilter.selected.has(value)) {
        activeFocusHeaderFilter.selected.delete(value);
      } else {
        activeFocusHeaderFilter.selected.add(value);
      }
      renderFocusHeaderFilterPopover();
      return;
    }
    if (event.target.closest('[data-focus-filter-all]')) {
      activeFocusHeaderFilter.selected.clear();
      activeFocusHeaderFilter.expression = '';
      renderFocusHeaderFilterPopover();
      return;
    }
    if (event.target.closest('[data-focus-filter-expression-add]')) {
      addFocusHeaderFilterExpression();
      return;
    }
    if (event.target.closest('[data-focus-filter-done]')) {
      commitFocusHeaderFilter();
      return;
    }
    if (event.target.closest('[data-focus-filter-close]')) {
      closeFocusHeaderFilter();
      return;
    }
    return;
  }
  const scorePopover = event.target.closest('#tableScoreFilterPopover');
  if (scorePopover && activeScoreHeaderFilter) {
    const option = event.target.closest('[data-score-filter-option]');
    if (option) {
      const value = option.dataset.scoreFilterOption;
      if (activeScoreHeaderFilter.selected.has(value)) {
        activeScoreHeaderFilter.selected.delete(value);
      } else {
        activeScoreHeaderFilter.selected.add(value);
      }
      renderScoreHeaderFilterPopover();
      return;
    }
    if (event.target.closest('[data-score-filter-all]')) {
      activeScoreHeaderFilter.selected.clear();
      activeScoreHeaderFilter.expression = '';
      renderScoreHeaderFilterPopover();
      return;
    }
    if (event.target.closest('[data-score-filter-expression-add]')) {
      addScoreHeaderFilterExpression();
      return;
    }
    if (event.target.closest('[data-score-filter-done]')) {
      commitScoreHeaderFilter();
      return;
    }
    if (event.target.closest('[data-score-filter-close]')) {
      closeScoreHeaderFilter();
      return;
    }
    return;
  }
  const passPopover = event.target.closest('#passTableFilterPopover');
  if (passPopover && activePassHeaderFilter) {
    const option = event.target.closest('[data-pass-filter-option]');
    if (option) {
      const value = option.dataset.passFilterOption;
      if (activePassHeaderFilter.selected.has(value)) {
        activePassHeaderFilter.selected.delete(value);
      } else {
        activePassHeaderFilter.selected.add(value);
      }
      renderPassHeaderFilterPopover();
      return;
    }
    if (event.target.closest('[data-pass-filter-all]')) {
      activePassHeaderFilter.selected.clear();
      renderPassHeaderFilterPopover();
      return;
    }
    if (event.target.closest('[data-pass-filter-done]')) {
      commitPassHeaderFilter();
      return;
    }
    if (event.target.closest('[data-pass-filter-close]')) {
      closePassHeaderFilter();
      return;
    }
    return;
  }
  const projectPickerPopover = event.target.closest('#tableFocusProjectPicker');
  if (projectPickerPopover && activeFocusProjectPicker) {
    const option = event.target.closest('[data-focus-project-pick]');
    if (option) {
      pickFocusProjectFromPicker(option.dataset.focusProjectPick);
      return;
    }
    return;
  }
  if (event.target.closest('[data-score-filter-trigger], [data-focus-filter-trigger], [data-pass-filter-trigger], [data-focus-project-picker-trigger]')) return;
  if (!event.target.closest('.filter-multiselect')) {
    closeMultiFilters();
    closeStep0MultiFilters();
  }
  closeScoreHeaderFilter();
  closeFocusHeaderFilter();
  closePassHeaderFilter();
  closeFocusProjectPicker();
});

document.addEventListener('keydown', (event) => {
  const focusExpressionInput = event.target.closest?.('[data-focus-filter-expression]');
  if (focusExpressionInput && event.key === 'Enter') {
    event.preventDefault();
    addFocusHeaderFilterExpression();
    return;
  }
  const expressionInput = event.target.closest?.('[data-score-filter-expression]');
  if (expressionInput && event.key === 'Enter') {
    event.preventDefault();
    addScoreHeaderFilterExpression();
    return;
  }
  if (event.key !== 'Escape') return;
  closeMultiFilters();
  closeStep0MultiFilters();
  closeScoreHeaderFilter();
  closeFocusHeaderFilter();
  closeFocusProjectPicker();
});

document.addEventListener('input', (event) => {
  const focusExpressionInput = event.target.closest?.('[data-focus-filter-expression]');
  if (focusExpressionInput && activeFocusHeaderFilter) {
    activeFocusHeaderFilter.expression = focusExpressionInput.value;
    focusExpressionInput.setCustomValidity('');
    return;
  }
  const expressionInput = event.target.closest?.('[data-score-filter-expression]');
  if (!expressionInput || !activeScoreHeaderFilter) return;
  activeScoreHeaderFilter.expression = expressionInput.value;
  expressionInput.setCustomValidity('');
});

elements.pageSizeSelect?.addEventListener('change', (event) => {
  const nextSize = Number(event.target.value);
  state.pageSize = [10, 30, 50, 100].includes(nextSize) ? nextSize : DEFAULT_PAGE_SIZE;
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(state.pageSize));
  state.page = 1;
  renderTable();
});

elements.firstPage?.addEventListener('click', () => {
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
elements.lastPage?.addEventListener('click', () => {
  const pageCount = Math.max(1, Math.ceil(getVisibleRows().length / state.pageSize));
  state.page = pageCount;
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
window.addEventListener('resize', () => {
  hideTargetContextTooltip();
  applyColumnWidths();
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) restorePendingPipelineReturnFocus();
});

elements.pipelineTable.addEventListener('click', (event) => {
  const pipelineWebsite = event.target.closest('[data-pipeline-website]');
  if (pipelineWebsite) {
    event.preventDefault();
    openPipelineWebsiteLink(pipelineWebsite);
    return;
  }
  const rubricRefresh = event.target.closest('[data-rubric-refresh]');
  if (rubricRefresh) {
    recalculateLatestRubric(rubricRefresh);
    return;
  }
  const triageFullCopy = event.target.closest('[data-triage-full-copy]');
  if (triageFullCopy) {
    copyTriageFullScoutPrompt(triageFullCopy);
    return;
  }
  const oiPartnershipRefresh = event.target.closest('[data-oi-partnership-refresh]');
  if (oiPartnershipRefresh) {
    recalculateLatestOiPartnership(oiPartnershipRefresh);
    return;
  }
  const projectPickerTrigger = event.target.closest('[data-focus-project-picker-trigger]');
  if (projectPickerTrigger) {
    toggleFocusProjectPicker(projectPickerTrigger);
    return;
  }
  const focusAction = event.target.closest('[data-focus-action]');
  if (focusAction) {
    const focusActionProjectId = focusAction.dataset.projectId || DEFAULT_SHORTLISTING_PROJECT_ID;
    if (focusActionProjectId === DEFAULT_SHORTLISTING_PROJECT_ID) {
      saveFocusManagement(
        focusAction.dataset.recordId,
        { action: focusAction.dataset.focusAction },
        focusAction
      );
    } else {
      saveShortlistingProjectField(
        focusAction.dataset.recordId,
        focusActionProjectId,
        { action: focusAction.dataset.focusAction },
        focusAction
      );
    }
    return;
  }
  if (event.target.closest('[data-table-text-edit], [data-table-modality-edit], [data-table-stage-edit], [data-table-country-edit], [data-focus-official-locked], [data-custom-score-edit]')) return;
  if (event.target.closest('input, select, textarea, button, a, label')) return;
  const rowElement = event.target.closest('[data-record-id]');
  if (!rowElement) return;
  const recordId = rowElement.dataset.recordId;
  if (rowElement.dataset.fullScoutAlias === 'true') {
    openStep0EditLockedModal('full', { recordId, fullScoutAlias: true });
    return;
  }
  try {
    sessionStorage.setItem(
      PIPELINE_RETURN_FOCUS_STORAGE_KEY,
      JSON.stringify({ recordId, mode: activeTableMode() })
    );
  } catch (_) {}
  if (activeTableMode() === 'triage') {
    window.location.href = `/triage-detail?id=${encodeURIComponent(recordId)}`;
    return;
  }
  window.location.href = `/detail?id=${encodeURIComponent(recordId)}&tab=${activeTableMode()}`;
});

elements.pipelineTable.addEventListener('dblclick', (event) => {
  const diseaseLinkageJump = event.target.closest('[data-disease-linkage-jump]');
  if (diseaseLinkageJump) {
    event.preventDefault();
    event.stopPropagation();
    const recordId = diseaseLinkageJump.dataset.diseaseLinkageJump;
    if (recordId) window.location.href = `/detail?id=${encodeURIComponent(recordId)}&tab=focus&open=moa-note`;
    return;
  }
  const pipelineWebsite = event.target.closest('[data-pipeline-website]');
  if (pipelineWebsite) {
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(pipelineWebsiteOpenTimer);
    pipelineWebsiteOpenTimer = null;
    openPipelineWebsiteEditor(pipelineWebsite);
    return;
  }
  const textEdit = event.target.closest('[data-table-text-edit]');
  if (textEdit) {
    event.preventDefault();
    event.stopPropagation();
    openManualTableTextEdit(textEdit);
    return;
  }
  const customScoreEdit = event.target.closest('[data-custom-score-edit]');
  if (customScoreEdit) {
    event.preventDefault();
    event.stopPropagation();
    openCustomScoreEdit(customScoreEdit);
    return;
  }
  const modalityEdit = event.target.closest('[data-table-modality-edit]');
  if (modalityEdit) {
    event.preventDefault();
    event.stopPropagation();
    openManualTableModalityEdit(modalityEdit);
    return;
  }
  const stageEdit = event.target.closest('[data-table-stage-edit]');
  if (stageEdit) {
    event.preventDefault();
    event.stopPropagation();
    openManualTableStageEdit(stageEdit);
    return;
  }
  const countryEdit = event.target.closest('[data-table-country-edit]');
  if (countryEdit) {
    event.preventDefault();
    event.stopPropagation();
    openManualTableCountryEdit(countryEdit);
    return;
  }
  const focusOfficialField = event.target.closest('[data-focus-official-locked]');
  if (focusOfficialField) {
    event.preventDefault();
    event.stopPropagation();
    openStep0EditLockedModal('full', {
      recordId: focusOfficialField.dataset.recordId,
      shortlisting: true
    });
  }
});

elements.pipelineTable.addEventListener('change', (event) => {
  // Checked before .evidence-edit/.focus-due-input below: metric-value-edit controls
  // reuse those classes for shared styling, so this branch must win the match first.
  const metricValueEdit = event.target.closest('.metric-value-edit');
  if (metricValueEdit) {
    const previousValue = metricValueEdit.dataset.previousValue ?? '';
    const nextRaw = metricValueEdit.value ?? '';
    if (previousValue === nextRaw) return;
    const returnType = metricValueEdit.dataset.returnType;
    if (nextRaw === '' && returnType !== 'text' && returnType !== 'date') return;
    const value = returnType === 'boolean'
      ? nextRaw === 'true'
      : returnType === 'number'
        ? Number(nextRaw)
        : nextRaw;
    saveShortlistingProjectField(
      metricValueEdit.dataset.recordId,
      metricValueEdit.dataset.projectId,
      { action: 'update', field: 'metric_value', metric_id: metricValueEdit.dataset.metricId, value },
      metricValueEdit
    );
    return;
  }

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
    const dueProjectId = dueInput.dataset.projectId;
    if (!dueProjectId || dueProjectId === DEFAULT_SHORTLISTING_PROJECT_ID) {
      saveFocusManagement(
        dueInput.dataset.recordId,
        { action: 'update', field: 'due_date', value: nextValue },
        dueInput
      );
    } else {
      saveShortlistingProjectField(
        dueInput.dataset.recordId,
        dueProjectId,
        { action: 'update', field: 'due_date', value: nextValue },
        dueInput
      );
    }
    return;
  }

  const checkbox = event.target.closest('.row-select');
  if (!checkbox) return;
  if (checkbox.dataset.pointerHandled === 'true') {
    delete checkbox.dataset.pointerHandled;
    const selected = state.selectedIds.has(checkbox.dataset.recordId);
    checkbox.checked = selected;
    checkbox.closest('tr')?.classList.toggle('selected-row', selected);
    return;
  }
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
  pageRows.filter((row) => !row.isVirtualTriage).forEach((row) => {
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
  const scoreFilterTrigger = event.target.closest('[data-score-filter-trigger]');
  if (scoreFilterTrigger) {
    event.preventDefault();
    toggleScoreHeaderFilter(scoreFilterTrigger);
    return;
  }
  const focusFilterTrigger = event.target.closest('[data-focus-filter-trigger]');
  if (focusFilterTrigger) {
    event.preventDefault();
    toggleFocusHeaderFilter(focusFilterTrigger);
    return;
  }
  const passFilterTrigger = event.target.closest('[data-pass-filter-trigger]');
  if (passFilterTrigger) {
    event.preventDefault();
    togglePassHeaderFilter(passFilterTrigger);
    return;
  }
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
window.addEventListener('resize', () => {
  positionScoreHeaderFilterPopover();
  positionFocusHeaderFilterPopover();
  positionFocusProjectPickerPopover();
});
window.addEventListener('scroll', () => {
  positionScoreHeaderFilterPopover();
  positionFocusHeaderFilterPopover();
  positionFocusProjectPickerPopover();
}, true);

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
  renderFilteredDashboard();
});

elements.refreshButton.addEventListener('click', () => {
  const isKnowledgeMapVisible = Boolean(elements.knowledgeMapPanel && !elements.knowledgeMapPanel.hidden);
  if (isKnowledgeMapVisible && typeof window.refreshKnowledgeMap === 'function') {
    runBlockingOperation({
      title: 'Knowledge Wiki Map을 최신화하고 있습니다',
      message: '저장된 Pipeline을 기준으로 연결 노트와 그래프를 다시 만들고 있습니다.',
      status: '최신화가 끝나면 현재 필터를 유지한 채 그래프를 다시 표시합니다.'
    }, (signal) => window.refreshKnowledgeMap({ signal })).catch((error) => {
      elements.dataStatus.textContent = 'Wiki Map 최신화 실패';
      elements.saveStatus.textContent = error.message;
    });
    return;
  }
  window.location.reload();
});

elements.dataUploadShortcutButton?.addEventListener('click', scrollToDataUpload);

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

elements.workflowPriorityList?.addEventListener('click', (event) => {
  const mode = activeTableMode();
  goToRecordDetail(mode)(event);
});
elements.columnSettingsButton?.addEventListener('click', () => {
  elements.columnSettingsPanel.hidden = !elements.columnSettingsPanel.hidden;
});

elements.shortlistingProjectSwitchButton?.addEventListener('click', () => {
  const isOpen = !elements.shortlistingProjectSwitchMenu?.hidden;
  closeShortlistingProjectSwitchMenu();
  if (!isOpen) openShortlistingProjectSwitchMenu();
});
elements.shortlistingProjectSwitchMenu?.addEventListener('click', (event) => {
  const settingsButton = event.target.closest('[data-project-settings-id]');
  if (settingsButton) {
    event.preventDefault();
    event.stopPropagation();
    closeShortlistingProjectSwitchMenu();
    openShortlistingProjectSettingsModal(settingsButton.dataset.projectSettingsId);
    return;
  }
  const option = event.target.closest('.shortlisting-project-switch-option');
  if (!option) return;
  closeShortlistingProjectSwitchMenu();
  if (option.dataset.projectId !== state.activeShortlistingProjectId) {
    setActiveShortlistingProjectId(option.dataset.projectId);
  }
});
document.addEventListener('click', (event) => {
  if (elements.shortlistingProjectSwitchMenu?.hidden) return;
  if (event.target.closest('.shortlisting-project-switcher')) return;
  closeShortlistingProjectSwitchMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.shortlistingProjectSwitchMenu?.hidden) {
    closeShortlistingProjectSwitchMenu();
  }
});
elements.addShortlistingProjectButton?.addEventListener('click', openShortlistingProjectModal);
elements.shortlistingProjectModalCancel?.addEventListener('click', closeShortlistingProjectModal);
elements.shortlistingProjectModalSave?.addEventListener('click', submitShortlistingProjectModal);
elements.shortlistingProjectModal?.addEventListener('click', (event) => {
  if (event.target === elements.shortlistingProjectModal) closeShortlistingProjectModal();
});
elements.shortlistingProjectModal?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeShortlistingProjectModal();
  }
});

elements.shortlistingSettingsMembersTab?.addEventListener('click', () => switchShortlistingSettingsTab('members'));
elements.shortlistingSettingsMetricsTab?.addEventListener('click', () => switchShortlistingSettingsTab('metrics'));
elements.shortlistingMetricReturnTypeSelect?.addEventListener('change', updateShortlistingMetricModalConditionalFields);
elements.shortlistingMetricModalCancel?.addEventListener('click', closeShortlistingProjectSettingsModal);
elements.shortlistingMetricModalSave?.addEventListener('click', submitShortlistingMetricModal);
elements.shortlistingMetricManagerBody?.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete-metric-id]');
  if (!deleteButton) return;
  deleteShortlistingMetricColumn(deleteButton.dataset.deleteMetricId);
});
elements.shortlistingMemberAddButton?.addEventListener('click', submitShortlistingMemberAdd);
elements.shortlistingMemberSearchInput?.addEventListener('input', renderShortlistingMemberPicker);
elements.shortlistingMemberManagerBody?.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete-member-email]');
  if (!deleteButton) return;
  deleteShortlistingMember(deleteButton.dataset.deleteMemberEmail);
});
elements.shortlistingMetricModal?.addEventListener('click', (event) => {
  if (event.target === elements.shortlistingMetricModal) closeShortlistingProjectSettingsModal();
});
elements.shortlistingMetricModal?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeShortlistingProjectSettingsModal();
  }
});

function applyVisualDashboardHidden(hidden) {
  if (elements.visualGrid) elements.visualGrid.classList.toggle('is-collapsed', hidden);
  if (elements.visualDashboardToggleButton) {
    elements.visualDashboardToggleButton.setAttribute('aria-expanded', String(!hidden));
    elements.visualDashboardToggleButton.setAttribute(
      'aria-label',
      hidden ? '시각화 대시보드 펼치기' : '시각화 대시보드 접기'
    );
  }
  if (elements.visualDashboardToggleLabel) {
    elements.visualDashboardToggleLabel.textContent = hidden ? '펼치기' : '접기';
  }
}

function applyStep0SummaryDashboardHidden(hidden) {
  [...(elements.step0WorkflowCardCanvases || [])].forEach((canvas) => {
    canvas.classList.toggle('is-collapsed', hidden);
  });
  [...(elements.step0WorkflowStatColumns || [])].forEach((column) => {
    column.classList.toggle('is-graph-collapsed', hidden);
  });
  if (elements.step0SummaryDashboardToggleButton) {
    elements.step0SummaryDashboardToggleButton.setAttribute('aria-expanded', String(!hidden));
    elements.step0SummaryDashboardToggleButton.setAttribute(
      'aria-label',
      hidden ? '진척 현황 Summary Dashboard 펼치기' : '진척 현황 Summary Dashboard 접기'
    );
  }
  if (elements.step0SummaryDashboardToggleLabel) {
    elements.step0SummaryDashboardToggleLabel.textContent = hidden ? '펼치기' : '접기';
  }
}

// Always start expanded on every load/tab, regardless of any prior session's
// toggle choice — a collapsed default was surprising users landing here fresh.
applyVisualDashboardHidden(false);
applyStep0SummaryDashboardHidden(false);

elements.visualDashboardToggleButton?.addEventListener('click', () => {
  const hidden = !elements.visualGrid?.classList.contains('is-collapsed');
  applyVisualDashboardHidden(hidden);
});
elements.step0SummaryDashboardToggleButton?.addEventListener('click', () => {
  const hidden = !elements.step0WorkflowCardCanvases?.[0]?.classList.contains('is-collapsed');
  applyStep0SummaryDashboardHidden(hidden);
  if (!hidden) {
    // Rebuild from scratch so re-expanding replays the same staggered
    // entry animation as the first Tab 0 load, instead of resuming
    // whatever mid-flight animation state the graphs were left in.
    renderStep0WorkflowMap();
    renderStep0StatStrip();
  }
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

elements.resetFiltersButton?.addEventListener('click', () => {
  state.query = '';
  state.searchTokens = [];
  state.modality = [];
  state.theme = [];
  state.cluster = [];
  state.country = [];
  state.indication = [];
  state.stage = [];
  state.pass = [];
  state.scoreFilters = { targetScore: [], moaScore: [], dataScore: [], competitiveScore: [], platformScore: [], expansionScore: [], marketScore: [] };
  state.focusFilters = emptyFocusFilters();
  state.page = 1;
  elements.searchInput.value = '';
  captureModeFilters();
  renderFilters();
  renderFilteredDashboard();
});

function activatePipelineTab(mode) {
  if (mode === 'map') {
    activateKnowledgeMapPanel();
    return;
  }
  const wasKnowledgeMapVisible = Boolean(elements.knowledgeMapPanel && !elements.knowledgeMapPanel.hidden);
  showKnowledgeMapPanel(false);
  syncKnowledgeMapTabState(false);
  if (mode === 'step0') {
    activateStep0Panel();
    return;
  }
  if (wasKnowledgeMapVisible && elements.pipelineContent) {
    elements.pipelineContent.hidden = false;
    elements.pipelineContent.style.display = '';
  }
  if (elements.step0Panel && !elements.step0Panel.hidden) deactivateStep0Panel();
  setTableMode(mode);
  if (wasKnowledgeMapVisible) renderTableTabs();
  // setTableMode() no-ops (skips its render() call) when mode matches the
  // already-active table mode, e.g. leaving Knowledge Map back to the same
  // Fast Triage/Full Scout/Shortlisting tab that was active before it — but
  // the header controls below still need to be resynced against the panel
  // that's newly visible now, so refresh them unconditionally here too.
  syncTopDataActionsForVisibleTab();
  renderShortlistingProjectControl();
}

elements.pipelineTableTabs?.forEach((tab) => {
  tab.addEventListener('click', () => activatePipelineTab(tab.dataset.tableMode));
  tab.addEventListener('keydown', (event) => {
    const tabs = [...elements.pipelineTableTabs];
    const currentIndex = tabs.indexOf(tab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    activatePipelineTab(nextTab.dataset.tableMode);
    nextTab.focus();
  });
});

elements.knowledgeMapTab?.addEventListener('click', (event) => {
  event.preventDefault();
  activatePipelineTab('map');
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

elements.agentMessages?.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-agent-action]');
  if (!actionButton) return;
  const bubble = actionButton.closest('.agent-message.assistant');
  const text = agentMessageText(bubble);
  if (actionButton.dataset.agentAction === 'copy') copyAgentResponse(text, actionButton);
  if (actionButton.dataset.agentAction === 'expand') openAgentResponseModal(text, actionButton);
});

elements.agentResponseModalClose?.addEventListener('click', closeAgentResponseModal);
elements.agentResponseModal?.addEventListener('click', (event) => {
  if (event.target === elements.agentResponseModal) closeAgentResponseModal();
});
elements.agentResponseModalCopy?.addEventListener('click', async () => {
  await copyAgentResponse(activeAgentResponseText, elements.agentResponseModalCopy);
  elements.agentResponseModalStatus.textContent = '클립보드에 복사했습니다.';
});
document.addEventListener('keydown', (event) => {
  if (elements.agentResponseModal?.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeAgentResponseModal();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...elements.agentResponseModal.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hidden && element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

elements.criteriaDrawerButton.addEventListener('click', openCriteriaDrawer);
elements.criteriaDrawerClose.addEventListener('click', closeCriteriaDrawer);
elements.criteriaBackdrop.addEventListener('click', closeCriteriaDrawer);
elements.criteriaLanguageToggle?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-criteria-language]');
  if (!button) return;
  applyCriteriaGuideLanguage(button.dataset.criteriaLanguage);
});
applyCriteriaGuideLanguage(criteriaGuideLanguage);
elements.dataReuploadList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-reupload-action]');
  if (!button) return;
  const decisionKey = button.dataset.matchKey;
  if (!decisionKey) return;
  if (button.dataset.reuploadAction === 'keep-incoming') {
    const incomingIndex = Number(button.dataset.incomingIndex);
    if (!Number.isInteger(incomingIndex)) return;
    activeDataReuploadDecisions.set(decisionKey, {
      action: 'keep-incoming',
      selectedIncomingIndex: incomingIndex
    });
  } else if (button.dataset.reuploadAction === 'replace') {
    activeDataReuploadDecisions.set(decisionKey, {
      action: 'replace',
      existingRecordId: button.dataset.existingId || null
    });
  } else if (button.dataset.reuploadAction === 'preserve-aliases') {
    const current = dataReuploadDecisionFor(decisionKey);
    if (!['replace', 'skip'].includes(current.action)) return;
    activeDataReuploadDecisions.set(decisionKey, {
      ...current,
      preserveAssetAliases: !current.preserveAssetAliases
    });
  } else if (button.dataset.reuploadAction === 'skip') {
    const current = dataReuploadDecisionFor(decisionKey);
    activeDataReuploadDecisions.set(decisionKey, {
      action: current.action === 'skip' ? 'pending' : 'skip',
      existingRecordId: button.dataset.existingId || current.existingRecordId || null,
      preserveAssetAliases: current.action === 'skip' ? false : current.preserveAssetAliases === true
    });
  }
  renderDataReuploadReviewList();
});
elements.dataReuploadApply?.addEventListener('click', () => {
  const decisions = reviewedDataReuploadDecisions();
  if (decisions.some((decision) => decision.unresolved)) {
    if (elements.dataReuploadSummary) {
      elements.dataReuploadSummary.textContent = '이번 업로드에서 유지할 조사 결과를 각 항목별로 하나씩 선택해 주세요.';
    }
    return;
  }
  closeDataReuploadModal(decisions);
});
elements.dataReuploadContinue?.addEventListener('click', () => closeDataReuploadModal(reviewedDataReuploadDecisions('continue', true)));
elements.dataReuploadCancel?.addEventListener('click', () => closeDataReuploadModal(null));
elements.dataReuploadModal?.addEventListener('click', (event) => {
  if (event.target === elements.dataReuploadModal) closeDataReuploadModal(null);
});
elements.dataReuploadModal?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDataReuploadModal(null);
  }
});

elements.step0ImportReviewList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-step0-import-review-action]');
  if (!button) return;
  const rowIndex = Number(button.dataset.rowIndex);
  if (!Number.isInteger(rowIndex)) return;
  if (button.dataset.step0ImportReviewAction === 'representative') {
    const current = activeStep0ImportReviewDecisions.get(rowIndex) || { action: 'pending', target: '' };
    if (current.action !== 'merge') return;
    const representative = button.dataset.representative === 'incoming' ? 'incoming' : 'existing';
    activeStep0ImportReviewDecisions.set(rowIndex, step0ManualReviewDecision(current, { representative }));
    reciprocalStep0DefaultSelections(rowIndex, current.target).forEach((linked) => {
      const linkedDecision = activeStep0ImportReviewDecisions.get(linked.rowIndex);
      if (linkedDecision?.action !== 'merge' || linkedDecision.target !== linked.target) return;
      if (linkedDecision.reciprocal_auto_from !== rowIndex) return;
      activeStep0ImportReviewDecisions.set(linked.rowIndex, {
        ...linkedDecision,
        representative
      });
    });
    renderStep0ImportReviewList();
    return;
  }
  const requestedAction = button.dataset.step0ImportReviewAction === 'merge'
    ? 'merge'
    : button.dataset.step0ImportReviewAction === 'skip' ? 'skip' : 'new';
  const requestedTarget = button.dataset.target || '';
  const current = activeStep0ImportReviewDecisions.get(rowIndex) || { action: 'pending', target: '' };
  const isSameChoice = current.action === requestedAction
    && (requestedAction !== 'merge' || current.target === requestedTarget);
  if (isSameChoice) {
    activeStep0ImportReviewDecisions.delete(rowIndex);
    reciprocalStep0DefaultSelections(rowIndex, requestedAction === 'merge' ? requestedTarget : '').forEach((linked) => {
      const linkedDecision = activeStep0ImportReviewDecisions.get(linked.rowIndex);
      const isMatchingAction = linkedDecision?.action === requestedAction
        && (requestedAction !== 'merge' || linkedDecision.target === linked.target);
      if (isMatchingAction && linkedDecision.reciprocal_auto_from === rowIndex) {
        activeStep0ImportReviewDecisions.delete(linked.rowIndex);
      }
    });
    renderStep0ImportReviewList();
    return;
  }
  const representative = current.representative === 'existing' ? 'existing' : 'incoming';
  activeStep0ImportReviewDecisions.set(rowIndex, step0ManualReviewDecision(current, {
    action: requestedAction,
    target: requestedTarget,
    representative
  }));
  reciprocalStep0DefaultSelections(rowIndex, requestedAction === 'merge' ? requestedTarget : '').forEach((linked) => {
    const linkedDecision = activeStep0ImportReviewDecisions.get(linked.rowIndex);
    if (!shouldApplyStep0ReciprocalDefault(linkedDecision, rowIndex)) return;
    activeStep0ImportReviewDecisions.set(linked.rowIndex, {
      action: requestedAction,
      target: requestedAction === 'merge' ? linked.target : '',
      representative,
      reciprocal_auto_from: rowIndex
    });
  });
  renderStep0ImportReviewList();
});
elements.step0ImportReviewApply?.addEventListener('click', () => {
  const decisions = reviewedStep0ImportDecisions();
  if (decisions.some((decision) => decision.action === 'pending')) {
    if (elements.step0ImportReviewSummary) elements.step0ImportReviewSummary.textContent = '각 유사 Pipeline에서 연결, 별도 신규 추가 또는 등록하지 않기 중 하나를 선택해 주세요.';
    return;
  }
  closeStep0ImportReviewModal(decisions);
});
elements.step0ImportReviewCancel?.addEventListener('click', () => closeStep0ImportReviewModal(null));
elements.step0ImportReviewModal?.addEventListener('click', (event) => {
  if (event.target === elements.step0ImportReviewModal) closeStep0ImportReviewModal(null);
});
elements.step0ImportReviewModal?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeStep0ImportReviewModal(null);
  }
});

elements.operationCancelButton?.addEventListener('click', () => {
  const operation = activeBlockingOperation;
  if (!operation) return;
  if (elements.operationModalStatus) {
    elements.operationModalStatus.textContent = '실행 취소를 요청했습니다. 서버 저장이 이미 시작된 경우에는 결과가 반영될 수 있습니다.';
  }
  if (elements.operationCancelButton) elements.operationCancelButton.disabled = true;
  operation.controller.abort();
});

elements.pipelineWebsiteModalCancel?.addEventListener('click', closePipelineWebsiteEditor);
elements.pipelineWebsiteModalSave?.addEventListener('click', savePipelineWebsiteEditor);
elements.pipelineWebsiteModal?.addEventListener('click', (event) => {
  if (event.target === elements.pipelineWebsiteModal) closePipelineWebsiteEditor();
});
elements.pipelineWebsiteModalInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePipelineWebsiteEditor();
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    savePipelineWebsiteEditor();
  }
});

elements.agentSuggestions?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-agent-prompt]');
  if (!button) return;
  elements.agentInput.value = button.dataset.agentPrompt;
  elements.agentInput.focus();
});

elements.agentInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  elements.agentForm.requestSubmit();
});

elements.agentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (activeTableMode() === 'triage') return;
  const userQuestion = elements.agentInput.value.trim();
  if (!userQuestion) return;
  const question = activeKnowledgeMapNodeContext?.context && !userQuestion.includes('[선택 노드:')
    ? `${activeKnowledgeMapNodeContext.context}\n\n[사용자 질문]\n${userQuestion}`
    : userQuestion;
  elements.agentInput.value = '';
  retitleActiveSessionFromQuestion(userQuestion);
  addAgentMessage('user', userQuestion);
  const submitButton = elements.agentForm.querySelector('button[type="submit"]');
  const submitButtonContent = submitButton?.innerHTML;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.setAttribute('aria-label', '답변 생성 중');
    submitButton.innerHTML = '<svg class="agent-send-progress" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" /></svg>';
  }
  const responseBubble = addAgentMessage('assistant', '질문 분석 중...', { pending: true });
  try {
    await streamDashboardAgentReply(question, responseBubble);
  } catch (error) {
    updateAgentMessage(responseBubble, `AI 응답 오류: ${error.message}`, { done: true });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.setAttribute('aria-label', '질문 전송');
      submitButton.innerHTML = submitButtonContent;
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.criteriaDrawer.classList.contains('open')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeCriteriaDrawer();
  }
});

elements.previewInputButton.addEventListener('click', previewPastedReportParsing);
elements.aiReparseButton?.addEventListener('click', runAiReparse);
elements.saveJsonButton.addEventListener('click', saveStructuredJsonInput);
elements.clearJsonButton.addEventListener('click', () => {
  elements.gptResponseInput.value = '';
  const mode = activeTableMode();
  if (['triage', 'full'].includes(mode)) state.dataUploadDrafts[mode] = '';
  state.dataUploadReview = null;
  state.dataUploadLlmReparseFields = null;
  elements.previewInputButton.disabled = true;
  if (elements.aiReparseButton) elements.aiReparseButton.disabled = true;
  elements.saveJsonButton.disabled = true;
  setDataUploadStatus('waiting');
  if (elements.inputValidationResults) {
    elements.inputValidationResults.hidden = true;
    elements.inputValidationResults.innerHTML = '';
  }
});
function detectPastedInputMode(rawText) {
  const split = splitCombinedGptResponse(rawText);
  if (split.payload === null) return null;
  if (Array.isArray(split.payload)) {
    if (split.payload.length === 1 && isInputObject(split.payload[0])) {
      const detected = detectInputRecordMode(split.payload[0]);
      return detected.mode === 'triage' || detected.mode === 'full' ? detected.mode : null;
    }
    return split.payload.length > 1 ? 'triage' : null;
  }
  if (isInputObject(split.payload)) {
    const detected = detectInputRecordMode(split.payload);
    return detected.mode === 'triage' ? 'triage' : 'full';
  }
  return null;
}

function autoRouteDataUploadTab() {
  if (!elements.gptResponseInput) return null;
  const currentMode = activeTableMode();
  if (currentMode !== 'triage' && currentMode !== 'full') return null;
  const rawText = elements.gptResponseInput.value;
  const detectedMode = detectPastedInputMode(rawText);
  if (!detectedMode || detectedMode === currentMode) return null;

  const previousDraft = state.dataUploadDrafts[currentMode];
  state.dataUploadDrafts[detectedMode] = rawText;
  setTableMode(detectedMode);
  state.dataUploadDrafts[currentMode] = previousDraft;
  elements.gptResponseInput.value = rawText;

  const fromLabel = currentMode === 'triage' ? 'TAB1 Simple Research' : 'TAB2 Advanced Research';
  const toLabel = detectedMode === 'triage' ? 'TAB1 Simple Research' : 'TAB2 Advanced Research';
  return `붙여넣은 내용이 ${toLabel} 형식으로 보여 ${fromLabel}에서 ${toLabel} 탭으로 자동 전환했습니다.`;
}

elements.gptResponseInput?.addEventListener('input', () => {
  const switchNotice = autoRouteDataUploadTab();
  const mode = activeTableMode();
  if (['triage', 'full'].includes(mode)) state.dataUploadDrafts[mode] = elements.gptResponseInput.value;
  const hasInput = Boolean(elements.gptResponseInput.value.trim());
  state.dataUploadReview = null;
  state.dataUploadLlmReparseFields = null;
  elements.previewInputButton.disabled = !hasInput;
  if (elements.aiReparseButton) elements.aiReparseButton.disabled = true;
  elements.saveJsonButton.disabled = true;
  setDataUploadStatus(hasInput ? 'review-needed' : 'waiting');
  if (elements.inputValidationResults) {
    if (switchNotice) {
      elements.inputValidationResults.hidden = false;
      elements.inputValidationResults.innerHTML = `<div class="input-validation-progress" role="status" aria-live="polite">${escapeHtml(switchNotice)}</div>`;
    } else {
      elements.inputValidationResults.hidden = true;
      elements.inputValidationResults.innerHTML = '';
    }
  }
});
async function copyDataUploadGuidePrompt(button) {
  const kind = button.dataset.promptKind === 'triage' ? 'triage' : 'full';
  const label = button.querySelector('b');
  const idleLabel = kind === 'triage' ? '지침 1' : '지침 2';
  button.disabled = true;
  if (label) label.textContent = '복사 중…';
  const copied = await copyPromptToClipboard(kind);
  if (label) label.textContent = copied ? '복사됨' : '복사 실패';
  window.setTimeout(() => {
    button.disabled = false;
    if (label) label.textContent = idleLabel;
  }, 3000);
}

elements.dataUploadGuideSteps?.addEventListener('pointerup', (event) => {
  const button = event.target.closest('[data-upload-guide-action="copy-prompt"]');
  if (!button || event.button !== 0) return;
  button.dataset.pointerCopyHandled = 'true';
  void copyDataUploadGuidePrompt(button);
});
elements.dataUploadGuideSteps?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-upload-guide-action]');
  if (!button) return;
  if (button.dataset.pointerCopyHandled === 'true') {
    delete button.dataset.pointerCopyHandled;
    return;
  }
  const action = button.dataset.uploadGuideAction;
  if (action === 'focus-input') {
    scrollToDataUpload();
    return;
  }
  if (action === 'review') {
    if (elements.previewInputButton.disabled) {
      elements.gptResponseInput.focus();
      return;
    }
    elements.previewInputButton.click();
    return;
  }
  if (action === 'save') {
    if (elements.saveJsonButton.disabled) {
      (elements.previewInputButton.disabled ? elements.gptResponseInput : elements.previewInputButton).focus();
      return;
    }
    elements.saveJsonButton.click();
    return;
  }
  await copyDataUploadGuidePrompt(button);
});

document.querySelectorAll('.controls').forEach((controls) => {
  controls.addEventListener('click', handleMultiFilterControlsClick);
  controls.addEventListener('input', handleMultiMenuSearch);
});
elements.step0GuideSteps?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-step0-guide-action="copy-instructions"]');
  if (!button || !elements.step0CopyInstructionsButton) return;
  if (elements.step0CopyInstructionsButton.disabled) {
    elements.step0SelectedCount?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  elements.step0CopyInstructionsButton.click();
});
const step0CopyInstructionsLabel = elements.step0CopyInstructionsButton?.querySelector('b');
if (step0CopyInstructionsLabel) step0CopyInstructionsLabel.textContent = '지침 1 복사';
if (elements.copyTriagePromptTopButton) {
  elements.copyTriagePromptTopButton.dataset.tooltip = TRIAGE_PROMPT_TOOLTIP;
}
if (elements.copyPromptTopButton) {
  const label = elements.copyPromptTopButton.querySelector('b');
  if (label) label.textContent = '지침 2';
  elements.copyPromptTopButton.dataset.tooltip = PROMPT_TOOLTIP;
}
function bindClipboardCopyGesture(button, action) {
  if (!button) return;
  let handledByPointer = false;
  button.addEventListener('pointerdown', () => {
    // A docked DevTools pane or a remote-desktop focus transition can leave
    // the page unfocused until after the pointer event. Restore it before the
    // pointerup copy gesture runs.
    if (!document.hasFocus()) window.focus();
  });
  button.addEventListener('pointerup', (event) => {
    if (event.button !== 0) return;
    // The browser has focused the document by pointerup, while this is still
    // a trusted user gesture for Clipboard API permission purposes.
    handledByPointer = true;
    void action();
    window.setTimeout(() => { handledByPointer = false; }, 0);
  });
  button.addEventListener('click', () => {
    if (handledByPointer) return;
    // Keyboard activation (Enter/Space) has no pointerup event.
    void action();
  });
}

bindClipboardCopyGesture(elements.copyPromptButton, () => copyPromptToClipboard('full'));
bindClipboardCopyGesture(elements.copyTriagePromptTopButton, () => copyPromptToClipboard('triage'));
bindClipboardCopyGesture(elements.copyPromptTopButton, () => copyPromptToClipboard('full'));

floatingAgentController = initFloatingAgent({
  launcher: elements.aiDrawerButton,
  panel: elements.aiDrawer,
  closeButton: elements.aiDrawerClose,
  minimizeButton: elements.aiDrawer.querySelector('[data-floating-agent-minimize]'),
  maximizeButton: elements.aiDrawer.querySelector('[data-floating-agent-maximize]'),
  dragHandle: elements.aiDrawer.querySelector('[data-floating-agent-drag]'),
  resizeHandle: elements.aiDrawer.querySelector('[data-floating-agent-resize]'),
  storageKey: 'skbp.dashboard.floatingAgentGeometry.v3',
  initialWidth: 560,
  initialHeight: 680,
  focusTarget: elements.agentInput
  });
  syncKnowledgeMapTabState();
  renderAgentIdentity();
setupThemeToggle();
initPageJumpControls();
pipelineHeaderFreezeController = initPipelineHeaderFreeze();
initAuthUI();
initializeAgentSessions();
function renderActiveKnowledgeNodeContext() {
  const context = activeKnowledgeMapNodeContext;
  if (!elements.agentKnowledgeNodeContext || !elements.agentKnowledgeNodeLabel) return;
  elements.agentKnowledgeNodeContext.hidden = !context;
  elements.agentKnowledgeNodeLabel.textContent = context
    ? `${context.type} · ${context.label} · 연결 ${context.neighborCount}개`
    : '';
}

function renderAgentSuggestions() {
  if (!elements.agentSuggestions) return;
  const prompts = activeKnowledgeMapNodeContext?.prompts || [];
  if (!prompts.length) {
    elements.agentSuggestions.innerHTML = defaultAgentSuggestionsMarkup;
    return;
  }
  elements.agentSuggestions.replaceChildren(...prompts.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.agentPrompt = item.prompt;
    button.textContent = item.label;
    return button;
  }));
}
window.addEventListener('skbp:knowledge-node-selected', (event) => {
  const detail = event.detail;
  activeKnowledgeMapNodeContext = detail?.label ? {
    label: String(detail.label), type: String(detail.type || 'node'), neighborCount: Number(detail.neighborCount || 0), context: String(detail.context || ''),
    prompts: Array.isArray(detail.prompts) ? detail.prompts.filter((item) => item?.label && item?.prompt).slice(0, 3) : []
  } : null;
  renderActiveKnowledgeNodeContext();
  renderAgentSuggestions();
});
window.addEventListener('skbp:open-agent', (event) => {
  const prompt = String(event.detail?.prompt || '').trim();
  if (prompt && elements.agentInput) elements.agentInput.value = prompt;
  renderActiveKnowledgeNodeContext();
  floatingAgentController?.open();
});
const agentLaunchParams = new URLSearchParams(window.location.search);
if (agentLaunchParams.get('openAgent') === '1') {
  const graphPrompt = 'Physics Graph에서 탐색한 Pipeline 지식 관계를 분석해줘.';
  if (elements.agentInput && !elements.agentInput.value.trim()) {
    elements.agentInput.value = agentLaunchParams.get('agentPrompt') || graphPrompt;
  }
  floatingAgentController?.open();
}
placeSearchTokenRows();
renderStep0EntryGrid();
void refreshInstructionWarnings();

if (initialViewMode === 'map') {
  activateKnowledgeMapPanel();
} else if (initialViewMode === 'step0') {
  activatePipelineTab('step0');
} else if (elements.step0Panel && !elements.step0Panel.hidden) {
  deactivateStep0Panel();
}

window.__skbpAppModuleReady = true;

loadRecords().catch((error) => {
  elements.dataStatus.textContent = 'Load failed';
  elements.saveStatus.textContent = error.message;
});
