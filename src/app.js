import { setupThemeToggle } from './theme.js?v=20260802-header-icons-1';
import { initFloatingAgent } from './floating-agent.js?v=20260801-draggable-launcher-1';
import { getCurrentUser, initAuthUI, requireAuth } from './auth.js?v=20260803-personal-group-1';
import {
  expandCompactInputRecord,
  isCompactIngestionRecord,
  isMinimalCompactIngestionRecord
} from './compact-ingestion.js?v=20260806-theme-indication-3';
import { splitAtRecoverableJsonSeparator } from './combined-ingestion.js?v=20260820-url-repair-6';

const API_URL = '/api/records';
const DASHBOARD_SUMMARY_URL = '/api/dashboard-summary';
const CATEGORY_SYNONYMS_URL = '/api/category-synonyms';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_STORAGE_KEY = 'skbp.dashboard.pageSize.v1';
const STEP0_MAX_SELECTED_CANDIDATES = 20;
const STEP0_PAGE_SIZE_OPTIONS = [50, 100, 200, 500];
const STEP0_DEFAULT_PAGE_SIZE = 200;
const STEP0_PAGE_SIZE_STORAGE_KEY = 'skbp.dashboard.step0PageSize.v1';
const BOM_PREFIX = String.fromCharCode(0xfeff);
const AGENT_SESSION_STORAGE_KEY = 'skbp.dashboard.agentSessions.v1';
const AGENT_ACTIVE_SESSION_KEY = 'skbp.dashboard.activeAgentSession.v1';
const COLUMN_WIDTH_STORAGE_KEY = 'skbp.dashboard.columnWidths.v3';
const FOCUS_COLUMN_WIDTH_STORAGE_KEY = 'skbp.dashboard.focusColumnWidths.v5';
const VISUAL_DASHBOARD_HIDDEN_KEY = 'skbp.dashboard.visualDashboardHidden.v1';

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

const DEFAULT_COLUMN_WIDTHS = {
  select: 34,
  company: 108,
  country: 78,
  asset: 86,
  modality: 96,
  target: 220,
  mainIndication: 140,
  stage: 112,
  filter1: 72,
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
  focusAction: 96,
  rubricAction: 68,
  inVivo: 74,
  inVitro: 74,
  admet: 84,
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
  stage: 88,
  filter1: 62,
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
  focusAction: 84,
  rubricAction: 60,
  inVivo: 64,
  inVitro: 64,
  admet: 70,
  focusDueDate: 120,
  focusManage: 70,
  generatedAt: 102,
  extra: 110
};

const FOCUS_DEFAULT_COLUMN_WIDTHS = {
  ...DEFAULT_COLUMN_WIDTHS,
  select: 34,
  company: 94,
  country: 74,
  asset: 86,
  modality: 80,
  target: 200,
  mainIndication: 116,
  stage: 86,
  filter2: 62,
  totalScore: 62,
  filter3: 82,
  inVivo: 56,
  inVitro: 56,
  admet: 60,
  focusDueDate: 108,
  focusManage: 76
};

const FOCUS_MIN_COLUMN_WIDTHS = {
  ...MIN_COLUMN_WIDTHS,
  company: 78,
  country: 62,
  asset: 68,
  modality: 64,
  target: 160,
  mainIndication: 96,
  stage: 72,
  filter2: 54,
  totalScore: 52,
  filter3: 66,
  inVivo: 48,
  inVitro: 48,
  admet: 50,
  focusDueDate: 88,
  focusManage: 62
};

const MAX_COLUMN_WIDTH = 720;
const PROMPT_TOOLTIP =
  'GPT Full Scout v3.4 지침을 복사합니다. Fast Triage에서 SELECT된 단일 asset을 근거 중심으로 심층 조사합니다.';
const TRIAGE_PROMPT_TOOLTIP =
  'GPT Fast Triage v3.3 지침을 복사합니다. 최대 50개 asset을 SELECT / REJECT / UNVERIFIED로 screening합니다.';
const LATEST_TRIAGE_RUBRIC_VERSION = '3.3';
const LATEST_FULL_SCOUT_RUBRIC_VERSION = '3.4';
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
    title: 'Fast Triage 실행 가이드',
    recommendation: 'TAB1 전용 · GPT High · 권장 10–20개/회',
    inputLabel: 'GPT 지침 1 전체 응답',
    placeholder: [
      '새 브라우저 탭에서 GPT를 열고, 오른쪽 Fast Triage 실행 가이드 순서대로 조사를 완료한 뒤 생성된 전체 응답을 그대로 붙여넣으세요.',
      '',
      '이 입력란은 Fast Triage 형식만 검증합니다. 지침 1은 최대 50개까지 처리할 수 있으나 안정적인 조사를 위해 10~20개씩 실행하는 것을 권장합니다.'
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
    title: 'Full Scout 실행 가이드',
    recommendation: 'TAB2 전용 · GPT High · 1개/회',
    inputLabel: 'GPT 지침 2 전체 응답',
    placeholder: [
      '새 브라우저 탭에서 GPT를 열고, 오른쪽 Full Scout 실행 가이드 순서대로 심층조사를 완료한 뒤 생성된 전체 응답을 그대로 붙여넣으세요.',
      '',
      '이 입력란은 Full Scout 형식만 검증합니다. 관련 NCDP 파일이 있다면 GPT 실행 시 GPT 지침 2와 함께 첨부할 수 있습니다.'
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
  'Small molecule',
  'Peptide',
  'RNA therapy',
  'Cell therapy',
  'Gene therapy',
  'Antibody',
  'Protein biologic',
  'Other',
  'Unknown'
];
const requestedTableMode = new URLSearchParams(window.location.search).get('tab');
const initialTableMode = ['triage', 'full', 'focus'].includes(requestedTableMode)
  ? requestedTableMode
  : 'full';
const initialSort = initialTableMode === 'triage'
  ? { key: 'targetScore', direction: 'desc' }
  : initialTableMode === 'focus'
    ? { key: 'focusAddedAt', direction: 'desc' }
    : { key: 'totalScore', direction: 'desc' };

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
  stage: [],
  theme: [],
  cluster: [],
  modality: [],
  indication: [],
  country: [],
  pass: [],
  duePeriod: 'all',
  filtersByMode: {
    triage: { query: '', stage: [], theme: [], cluster: [], modality: [], indication: [], country: [], pass: [] },
    full: { query: '', stage: [], theme: [], cluster: [], modality: [], indication: [], country: [], pass: [] },
    focus: { query: '', stage: [], theme: [], cluster: [], modality: [], indication: [], country: [], pass: [] }
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
  step0Query: '',
  step0SearchTokens: [],
  step0StatusFilterValues: new Set(),
  step0SortKey: null,
  step0SortDirection: null,
  step0Page: 1,
  step0PageSize: storedStep0PageSize(),
  extraColumns: new Set(readStoredJson(
    'skbp.dashboard.extraColumns',
    [],
    (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')
  )),
  columnWidths: readStoredJson(
    COLUMN_WIDTH_STORAGE_KEY,
    {},
    (value) => value && typeof value === 'object' && !Array.isArray(value)
  ),
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
  latestOiPartnershipCriteriaVersion: '1.0'
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
  criteriaDrawerScopeLabel: document.querySelector('#criteriaDrawerScopeLabel'),
  criteriaDrawerVersionBadge: document.querySelector('#criteriaDrawerVersionBadge'),
  criteriaDrawerSubtitle: document.querySelector('#criteriaDrawerSubtitle'),
  agentContextCount: document.querySelector('#agentContextCount'),
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
  operationModal: document.querySelector('#operationModal'),
  operationModalTitle: document.querySelector('#operationModalTitle'),
  operationModalMessage: document.querySelector('#operationModalMessage'),
  operationModalStatus: document.querySelector('#operationModalStatus'),
  operationCancelButton: document.querySelector('#operationCancelButton'),
  step0Panel: document.querySelector('#step0Panel'),
  step0EntryGrid: document.querySelector('#step0EntryGrid'),
  step0EntryGridBody: document.querySelector('#step0EntryGridBody'),
  step0AddEntryRow: document.querySelector('#step0AddEntryRow'),
  step0PasteFeedback: document.querySelector('#step0PasteFeedback'),
  step0ImportButton: document.querySelector('#step0ImportButton'),
  step0ClearButton: document.querySelector('#step0ClearButton'),
  step0ImportSummary: document.querySelector('#step0ImportSummary'),
  step0SaveStatus: document.querySelector('#step0SaveStatus'),
  step0GuideSteps: document.querySelector('#step0GuideSteps'),
  step0StatPending: document.querySelector('#step0StatPending'),
  step0StatFastTriage: document.querySelector('#step0StatFastTriage'),
  step0StatFullScout: document.querySelector('#step0StatFullScout'),
  step0StatShortlisted: document.querySelector('#step0StatShortlisted'),
  step0StatFilterButtons: document.querySelectorAll('[data-step0-stat-filter]'),
  step0RecentPending: document.querySelector('#step0RecentPending'),
  step0RecentFastTriage: document.querySelector('#step0RecentFastTriage'),
  step0RecentFullScout: document.querySelector('#step0RecentFullScout'),
  step0RecentShortlisted: document.querySelector('#step0RecentShortlisted'),
  step0SearchInput: document.querySelector('#step0SearchInput'),
  step0AddSearchTokenButton: document.querySelector('#step0AddSearchTokenButton'),
  step0SearchTokens: document.querySelector('#step0SearchTokens'),
  step0StatusToggleButtons: document.querySelectorAll('.step0-status-toggle'),
  step0ResetFiltersButton: document.querySelector('#step0ResetFiltersButton'),
  step0TableCount: document.querySelector('#step0TableCount'),
  step0PageSizeSelect: document.querySelector('#step0PageSizeSelect'),
  step0SelectAllRows: document.querySelector('#step0SelectAllRows'),
  step0ProgressTableBody: document.querySelector('#step0ProgressTableBody'),
  step0SelectedCount: document.querySelector('#step0SelectedCount'),
  step0CopyInstructionsButton: document.querySelector('#step0CopyInstructionsButton'),
  step0ExportExcelButton: document.querySelector('#step0ExportExcelButton'),
  step0PrevPage: document.querySelector('#step0PrevPage'),
  step0PageInfo: document.querySelector('#step0PageInfo'),
  step0NextPage: document.querySelector('#step0NextPage'),
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
let activeStep0MetadataPopover = null;
let activeStep0LockedEditMode = null;
const focusSaveQueues = new Map();
let dataReuploadResolve = null;
let activeDataReuploadMatches = [];
let activeDataReuploadDecisions = new Map();
let activeBlockingOperation = null;
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
  try {
    return await operation(blockingOperation.signal);
  } catch (error) {
    if (blockingOperation.signal.aborted || error?.name === 'AbortError') return OPERATION_CANCELLED;
    throw error;
  } finally {
    closeBlockingOperation(blockingOperation.token);
  }
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

const GENERIC_ASSET_WORDS = new Set(['therapy', 'drug', 'treatment', 'research', 'project', 'program', 'pipeline', 'disease', 'disorder', 'candidate', 'for', 'of', 'the', 'and']);
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
    .filter((word) => !GENERIC_ASSET_WORDS.has(word)));
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  return [...leftTokens].some((token) => rightTokens.has(token));
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

function findDataReuploadMatches(records) {
  return records.flatMap((incomingRecord, incomingIndex) => {
    const incomingIdentity = dataUploadRecordIdentity(incomingRecord);
    if (!incomingIdentity.normalizedAsset) return [];
    const incomingRecordId = recordIdentifier(incomingRecord);
    const candidates = state.rawRecords
      .filter((existingRecord) => {
        const existingIdentity = dataUploadRecordIdentity(existingRecord);
        if (existingIdentity.mode !== incomingIdentity.mode || !existingIdentity.normalizedAsset) return false;
        return comparePipelineAssets(incomingIdentity, existingIdentity);
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

function renderDataReuploadComparisonColumn(title, asset, company, stage) {
  return `
    <section class="data-reupload-comparison-column">
      <p>${escapeHtml(title)}</p>
      <dl>
        <div><dt>Asset</dt><dd>${escapeHtml(asset || 'Unknown asset')}</dd></div>
        <div><dt>Company</dt><dd>${escapeHtml(company || 'Unknown company')}</dd></div>
        <div><dt>Stage</dt><dd>${escapeHtml(stage || 'Unknown')}</dd></div>
      </dl>
    </section>
  `;
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
                  <button type="button" class="identity-modal-cancel" data-reupload-action="skip" data-match-key="${escapeHtml(match.decisionKey)}">이번 업로드 제외</button>
                </div>
              </section>
            `;
          }).join('')}
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
      skipIncoming: action === 'skip'
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
  if (/epilep|seizure|focal onset|partial onset|status epilepticus/.test(normalized)) return 'Epilepsy / seizure disorders';
  if (/chronic cough|rcc|ucc|refractory cough|unexplained cough/.test(normalized)) return 'Chronic cough';
  if (/multiple sclerosis|\bms\b|neuroinflamm|autoimmune/.test(normalized)) return 'Multiple sclerosis / neuroinflammatory disease';
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
  if (primary && !/^(?:-|unknown|not known|n\/?a)$/i.test(primary)) {
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

function indicationDisplay(row) {
  const values = row.indicationList || [];
  if (!values.length) return 'Unknown';
  return row.mainIndication !== 'Unknown' ? [row.mainIndication, ...values.filter((value) => value !== row.mainIndication)].join(', ') : values.join(', ');
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

  const inactiveMatch = text.match(/\b(?:discontinued|inactive|terminated|withdrawn|suspended|dormant|clearly failed)\b|중단|종료|철회|휴면/);
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
  if (/^(?:approved|marketed|commercial(?:ized|ised))$|\b(?:nda|bla|maa)\s+(?:approved|approval)\b|\b(?:approved|marketed|commercial(?:ized|ised))\s+(?:drug|medicine|product|therapy|therapeutic|asset)\b|\b(?:drug|medicine|product|therapy|therapeutic|asset)\s+(?:approved|marketed|commercial(?:ized|ised))\b|\b(?:marketed|commercial(?:ized|ised))\b|(?:품목\s*)?허가\s*(?:승인|완료)?|시판/.test(text)) {
    return 'Approved / marketed';
  }

  const phasePatterns = [
    ['Phase 2/3', /\b(?:phase\s*(?:ii\s*\/\s*iii|2\s*\/\s*3)|p2\s*\/\s*p?3)\b/],
    ['Phase 1/2', /\b(?:phase\s*(?:i\s*\/\s*ii|1\s*\/\s*2)|p1\s*\/\s*p?2)\b/],
    ['Phase 3', /\b(?:phase\s*(?:iii|3)(?!\s*\/)|p3)\b/],
    ['Phase 2', /\b(?:phase\s*(?:ii|2)(?:a|b)?|p2(?:a|b)?)\b/],
    ['Phase 1', /\b(?:phase\s*(?:i|1)(?:a|b)?|p1(?:a|b)?|fih|sad\s*\/\s*mad)\b/]
  ];
  for (const [canonical, pattern] of phasePatterns) {
    const phaseMatch = text.match(pattern);
    if (phaseMatch && !matchIsPlanned(phaseMatch) && !matchIsUncertain(phaseMatch)) return canonical;
  }

  if (/\b(?:unclear|uncertain|not\s+(?:confirmed|verified|established))\b|불명확|불확실|미확인/.test(text)) {
    return 'Unknown';
  }

  if (/\b(?:development\s+candidate|preclinical\s+candidate)\s+(?:selected|nominated)\b|\bcandidate\s+nominated\b|개발\s*후보(?:물질)?\s*(?:선정|지명)/.test(text)) {
    return 'Preclinical Candidate';
  }
  const leadMatch = text.match(/\b(?:candidate|lead)\s+selection\s+(?:ongoing|underway|in progress)\b|\blead\s+optimization\b|리드\s*최적화/);
  if (leadMatch && !matchIsPlanned(leadMatch)) return 'Lead Optimization';
  const hitMatch = text.match(/\b(?:hit\s+discovery|hit\s+identification|early\s+screening)\b|히트\s*(?:발굴|탐색)/);
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
  if (/small[\s-]?molecule|\bsm\b|oral compound|chemical compound/.test(normalized)) return 'Small molecule';
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

function hasAffirmedLifecycleBlocker(values) {
  const blockerPattern = /\b(?:inactive|discontinued|terminated|withdrawn|suspended|dormant|clearly[\s_-]+failed|hard[\s_-]*blocker)\b|(?:개발|프로그램|임상)\s*(?:이\s*)?(?:중단|종료|철회|휴면|비활성)/gi;
  const items = Array.isArray(values) ? values : [values];
  return items.some((value) => {
    const text = String(value || '');
    blockerPattern.lastIndex = 0;
    let match;
    while ((match = blockerPattern.exec(text)) !== null) {
      const prefix = text.slice(Math.max(0, match.index - 28), match.index);
      const suffix = text.slice(match.index + match[0].length, match.index + match[0].length + 20);
      if (/\b(?:not|without|never|no)\b[^|.;\n]{0,20}$|(?:아니|없)는?\s*$/i.test(prefix)) continue;
      if (/^\s*(?:없(?:음|다)?|아님|아니|not\b|false\b)/i.test(suffix)) continue;
      return true;
    }
    return false;
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

  const failBlocker = record.hard_filter?.hard_blocker === true || hasAffirmedHardBlocker(notes);
  const reviewUncertainty = record.hard_filter?.decision_uncertainty === true
    || hasScopedFullScoutReviewUncertainty(notes);

  if (Number.isFinite(total) && total <= 8) reasons.push(`Total score ${total} <= 8`);
  if (Number.isFinite(targetScore) && targetScore <= 1) reasons.push(`Target Area Relevance ${targetScore} <= 1`);
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
  if (['SELECT', 'REJECT', 'UNVERIFIED'].includes(text)) {
    return text;
  }
  if (['N/A', 'NA'].includes(text)) {
    return 'UNVERIFIED';
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
    || triageStatus === 'UNVERIFIED'
    || Object.values(criteria).some((item) => item && typeof item === 'object' && 'evidence_basis' in item);
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
    return { status: '-', reason: `Full Scout v${LATEST_FULL_SCOUT_RUBRIC_VERSION} not run yet` };
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

function flattenRecord(record, index) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const scoring = record.scoring || {};
  const focusManagement = get(record, 'meta.focus_management', {});
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
  const identityUnverified = isTriage && (
    record?.triage?.identity_verified === false
    || filter1Status.status === 'UNVERIFIED'
    || /asset_identity_not_verified/i.test(String(record?.source_report?.parser_status || ''))
  );
  const rawTheme = summary.theme || get(champion, 'matched_theme.name', '-');
  const theme = identityUnverified ? 'Unknown' : canonicalTheme(rawTheme);

  return {
    id: recordIdentifier(record, index),
    company: summary.company || table.company || '-',
    countryRaw: summary.company_country || table.company_country || '-',
    country: canonicalCountry(summary.company_country || table.company_country || '-'),
    asset: summary.asset_name || table.asset_name || '-',
    target: summary.target || table.target || '-',
    theme,
    cluster: identityUnverified
      ? 'Unknown'
      : canonicalCluster(summary.cluster || get(champion, 'matched_cluster.name', '-'), theme),
    stageRaw: table.development_stage || '-',
    stage: canonicalDevelopmentStage(table.development_stage || '-'),
    indication: table.indication || '-',
    mainIndicationRaw: table.main_indication || table.primary_indication || summary.main_indication || mainIndicationFrom(table.indication),
    mainIndication: canonicalMainIndication(
      table.main_indication || table.primary_indication || summary.main_indication,
      table.indication
    ),
    indicationList: canonicalIndicationList(table.indication_list, table.indication, table.main_indication || table.primary_indication || summary.main_indication),
    modality: canonicalModality(table.modality_platform),
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
    focusComment: String(focusManagement?.user_comment || ''),
    focusDueDate: String(focusManagement?.due_date || ''),
    focusOwner: String(focusManagement?.owner_name || ''),
    focusActionPlan: String(focusManagement?.action_plan || ''),
    focusAddedAt: String(focusManagement?.added_at || ''),
    teamCommentCount: teamComments.length,
    latestTeamComment: String(latestTeamComment?.body || ''),
    latestTeamCommentAuthor: String(latestTeamComment?.author || ''),
    isTriage,
    filter1: filter1Status.status,
    filter2: filter2Status.status,
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
  { key: 'activeAsset', label: 'Active asset', path: 'triage.active_asset' },
  { key: 'verifiedSourceCount', label: 'Verified sources', path: 'triage.verified_public_source_count' },
  { key: 'triageWhy', label: 'Triage rationale', path: 'triage.why' },
  { key: 'fullScoutEvidence', label: 'Full Scout evidence needed', path: 'triage.missing_evidence_needed_for_full_scout' },
  { key: 'firstSource', label: 'First source URL', path: 'structured_table.sources.0.source_url' },
  { key: 'uncertainPoints', label: 'Uncertain points', path: 'validation.uncertain_points' }
];

function activeExtraColumnDefinitions() {
  if (activeTableMode() === 'triage') return FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS;
  if (activeTableMode() === 'full') return FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS;
  return [];
}

function formatExtraColumnValue(value, column = null) {
  if (column?.key === 'activeAsset') {
    if (value === true) return 'Confirmed active';
    if (value === false) return 'Inactive';
    return 'Unconfirmed';
  }
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
  return `<th ${attrs} ${columnAttrs(columnKey)}><button data-sort="${escapeHtml(sortKey)}" type="button">${escapeHtml(label)}</button>${resizeHandle(columnKey)}</th>`;
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
  if (isStep0Visible) return state.step0Rows.length;
  return state.rows.filter(rowMatchesActiveTableMode).length;
}

function updateHeaderRecordCount() {
  if (!elements.dataStatus) return;
  elements.dataStatus.textContent = `총 ${currentTabRecordCount()}건 로드됨`;
}

function recordDetailHref(row, mode = activeTableMode()) {
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
  'select',
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

function cloneFilterValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

function closeMultiFilters(except = null) {
  MULTI_FILTER_KEYS.forEach((key) => {
    const filter = elements[`${key}Filter`];
    if (!filter || filter === except) return;
    filter.classList.remove('is-open');
    filter.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
    const menu = filter.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = true;
  });
}

function getVisibleRows(includeQuery = true) {
  const query = includeQuery ? state.query.trim().toLowerCase() : '';
  const filterKey = activeFilterKey();
  const rows = state.rows.filter((row) => {
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
        selectedFilterMatches(state.theme, row.theme) &&
        selectedFilterMatches(state.cluster, row.cluster) &&
        selectedFilterMatches(state.modality, row.modality) &&
        (selectedFilterValues(state.indication).length === 0 || selectedFilterValues(state.indication).some((value) => row.indicationList.includes(value) || (value === 'Unknown' && !row.indicationList.length))) &&
        selectedFilterMatches(state.country, row.country) &&
        selectedFilterMatches(state.stage, canonicalDevelopmentStage(row.stage)) &&
        selectedFilterMatches(state.pass, row[filterKey])
      );
    });

  if (!state.sortKey || !state.sortDirection) return rows;

  return rows.sort((a, b) => {
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
  const modeRows = state.rows.filter(rowMatchesActiveTableMode);
  if (elements.searchInput) elements.searchInput.value = state.query;
  const themes = [...new Set(modeRows.map((row) => row.theme).filter(Boolean))].sort();
  const clusters = [...new Set(modeRows.map((row) => row.cluster).filter(Boolean))].sort();
  const modalities = [...new Set(modeRows.map((row) => row.modality).filter(Boolean))].sort();
  const countries = [...new Set(modeRows.map((row) => row.country).filter(Boolean))].sort();
  const indications = [...new Set(modeRows.flatMap((row) => row.indicationList.length ? row.indicationList : ['Unknown']))].sort();
  const stages = [...new Set(modeRows.map((row) => canonicalDevelopmentStage(row.stage)).filter(Boolean))]
    .sort((a, b) => {
      const aIndex = CANONICAL_DEVELOPMENT_STAGES.indexOf(a);
      const bIndex = CANONICAL_DEVELOPMENT_STAGES.indexOf(b);
      const aRank = aIndex < 0 ? CANONICAL_DEVELOPMENT_STAGES.length : aIndex;
      const bRank = bIndex < 0 ? CANONICAL_DEVELOPMENT_STAGES.length : bIndex;
      return aRank - bRank || a.localeCompare(b, 'en');
    });
  const filterStatuses = activeTableMode() === 'triage'
    ? [
        { value: 'SELECT', label: 'SELECT' },
        { value: 'REJECT', label: 'REJECT' },
        { value: 'UNVERIFIED', label: 'UNVERIFIED' }
      ]
    : activeTableMode() === 'focus'
      ? [
          { value: 'investment', label: '투자' },
          { value: 'value_up', label: 'Value Up' },
          { value: 'joint_research', label: '공동연구' },
          { value: 'unknown', label: 'Unknown' },
          { value: 'n_a', label: 'N/A' }
        ]
      : [
          { value: 'PASS', label: 'PASS' },
          { value: 'REVIEW', label: 'REVIEW' },
          { value: 'FAIL', label: 'FAIL' }
        ];
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

function renderMultiFilter(element, key, values) {
  if (!element) return;
  const options = values.map((value) => typeof value === 'string' ? { value, label: value } : value);
  const selected = selectedFilterValues(state[key]);
  const summary = element.querySelector('[data-multi-filter-summary]');
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
  const allSelected = selected.length === 0;
  menu.innerHTML = [
    `<button type="button" class="filter-multiselect-option${allSelected ? ' is-selected' : ''}" data-multi-filter-value="all" role="option" aria-selected="${allSelected}"><span class="filter-multiselect-check" aria-hidden="true">${allSelected ? '✓' : ''}</span><span>전체</span></button>`,
    ...options.map((option) => {
      const isSelected = selected.includes(option.value);
      return `<button type="button" class="filter-multiselect-option${isSelected ? ' is-selected' : ''}" data-multi-filter-value="${escapeHtml(option.value)}" role="option" aria-selected="${isSelected}"><span class="filter-multiselect-check" aria-hidden="true">${isSelected ? '✓' : ''}</span><span>${escapeHtml(option.label)}</span></button>`;
    })
  ].join('');
}

const WORKFLOW_COPY = {
  triage: {
    stage: '1차 스크리닝',
    description: '관심 적응증과 공개 근거를 기준으로 Full Scout 검토 후보를 빠르게 선별합니다.',
    filterLabel: 'Filter 1',
    priorityTitle: 'Full Scout 대기 후보',
    prioritySubtitle: 'SELECT 후보 · Stage 분포'
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
    description: '즐겨찾기로 등록한 Full Scout 후보의 OI Partnership Type과 후속 Action을 관리합니다.',
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
  if (/amyotrophic lateral sclerosis|motor neuron disease|\bals\b/.test(text)) return 'Amyotrophic lateral sclerosis';
  if (/multiple sclerosis|neuroinflamm|\bms\b/.test(text)) return 'Multiple sclerosis';
  if (/neuropathic pain|neuralgia|peripheral neuropath/.test(text)) return 'Neuropathic pain';
  if (/epilep|seizure/.test(text)) return 'Epilepsy';
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
    'Amyotrophic lateral sclerosis',
    'Multiple sclerosis',
    'Neuropathic pain',
    'Epilepsy',
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
        unverified: triageRows.filter((row) => row.filter1 === 'UNVERIFIED').length,
        average_total_score: average(triageRows.map(fastTriageRowTotal)),
        max_score: 9
      },
      distribution_population: {
        scope: hasFilteredRows ? 'filtered_rows' : 'active_tab',
        assets: triageRows.length
      },
      status_distribution: fallbackDistribution(triageRows, (row) => row.filter1, ['SELECT', 'REJECT', 'UNVERIFIED']),
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
        const actionStatus = days < 0 ? 'OVERDUE' : days <= 30 ? 'WITHIN_30_DAYS' : 'SCHEDULED';
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
        ['metricTotal', { label: 'Fast Triage Assets', value: kpis.assets ?? 0, icon: 'assets', tone: 'blue' }],
        ['metricPass', { label: 'SELECT', value: kpis.select ?? 0, icon: 'check', tone: 'green' }],
        ['metricScore', { label: 'REJECT', value: kpis.reject ?? 0, icon: 'reject', tone: 'red' }],
        ['metricTarget', { label: 'UNVERIFIED', value: kpis.unverified ?? 0, icon: 'question', tone: 'gray' }],
        ['metricCountries', { label: '평균 총점 / 9', value: scoreValue, icon: 'score', tone: 'blue', hidden: true }]
      ]
    : mode === 'focus'
      ? [
          ['metricTotal', { label: 'Shortlisting Pipelines', value: kpis.pipelines ?? 0, icon: 'assets', tone: 'purple' }],
          ['metricPass', { label: '투자', value: kpis.investment ?? 0, icon: 'investment', tone: 'green' }],
          ['metricScore', { label: 'Value Up', value: kpis.value_up ?? 0, icon: 'value', tone: 'blue' }],
          ['metricTarget', { label: '공동연구', value: kpis.joint_research ?? 0, icon: 'research', tone: 'purple' }],
          ['metricCountries', { label: '평균 총점 / 21', value: scoreValue, icon: 'score', tone: 'blue', hidden: true }]
        ]
      : [
          ['metricTotal', { label: 'Full Scout Assets', value: kpis.assets ?? 0, icon: 'assets', tone: 'blue' }],
          ['metricPass', { label: 'PASS', value: kpis.pass ?? 0, icon: 'check', tone: 'green' }],
          ['metricScore', { label: 'REVIEW', value: kpis.review ?? 0, icon: 'review', tone: 'amber' }],
          ['metricTarget', { label: 'FAIL', value: kpis.fail ?? 0, icon: 'reject', tone: 'red' }],
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
    return 'Shortlisting 후 OI Partnership 분류가 아직 이루어지지 않은 그룹입니다.';
  }
  if ((kind === 'modality' || kind === 'modality-summary') && value === 'CGT') {
    return 'Cell Therapy와 Gene Therapy를 합산한 차트 전용 분류입니다.';
  }
  if (value === 'Others') {
    if (kind === 'interest-indication') {
      return 'SKBP 우선 관심 적응증 6개에 포함되지 않은 적응증과 Unknown을 합산한 그룹입니다.';
    }
    if (kind === 'modality-summary') {
      return '상위 6개 외 Modality와 Other·Unknown·N/A를 합산한 Summary 차트 전용 그룹입니다.';
    }
    if (kind === 'theme') {
      return 'E/I Balance·Neuroimmune·Protein Homeostasis 외 Theme와 Unknown·N/A를 합산한 차트 전용 그룹입니다.';
    }
    if (kind === 'country') {
      return '상위 3개 국가를 제외한 국가와 Unknown·N/A를 합산한 차트 전용 그룹입니다.';
    }
    return '빈도 상위 5개에 포함되지 않은 항목과 Other·Unknown·N/A를 합산한 그룹입니다.';
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
  const semanticDonutColors = {
    SELECT: '#168b67',
    PASS: '#168b67',
    REJECT: '#b84f5f',
    FAIL: '#b84f5f',
    REVIEW: '#b47c25',
    UNVERIFIED: 'var(--chart-other)',
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
          <em>${value}</em>
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
        <b class="distribution-bar-count">${value}</b>
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
  const counts = countBy(rows, (row) => row.country || 'Unknown');
  const isOtherCountry = (label) => /^(unknown|n\/?a|others?|-)?$/i.test(String(label).trim());
  const knownCountries = Object.entries(counts)
    .filter(([label]) => !isOtherCountry(label))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const visibleTotal = knownCountries.reduce((sum, [, count]) => sum + count, 0);
  const othersTotal = rows.length - visibleTotal;
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
    ? '현재 Full Scout 대기 후보가 없습니다.'
    : mode === 'focus'
      ? '현재 확인이 필요한 Action이 없습니다.'
      : '현재 표시할 Priority Pipeline이 없습니다.';

  elements.workflowPriorityList.classList.toggle('is-stage-distribution', mode === 'triage');
  if (mode === 'triage') {
    elements.workflowPriorityList.innerHTML = rows.length
      ? barChart(workflowStageDistribution(rows), 'stage')
      : `<div class="empty-state workflow-empty-state"><span aria-hidden="true">○</span><p>${escapeHtml(emptyMessage)}</p></div>`;
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
          const actionLabels = {
            OVERDUE: 'Overdue',
            WITHIN_30_DAYS: '30일 이내',
            SCHEDULED: '예정'
          };
          const actionTone = item.action_status === 'OVERDUE' ? 'fail' : item.action_status === 'WITHIN_30_DAYS' ? 'review' : 'neutral';
          return `
            <button type="button" class="priority-item workflow-priority-item" data-record-id="${escapeHtml(recordId)}">
              <span class="workflow-priority-main"><strong>${escapeHtml(asset)}</strong><small>${escapeHtml(company)}</small></span>
              <span class="workflow-priority-context">${escapeHtml(PARTNERSHIP_LABELS[item.partnership_type] || item.partnership_label || 'Unknown')} · ${escapeHtml(item.action_date)}</span>
              <span class="workflow-priority-badges">
                ${workflowListBadge(actionLabels[item.action_status] || '확인 필요', actionTone)}
                ${item.human_override || item.partnership_source === 'manual' ? workflowListBadge('HUMAN', 'human') : ''}
              </span>
            </button>
          `;
        }
        const decision = String(item.filter2 || 'REVIEW').toUpperCase();
        return `
          <button type="button" class="priority-item workflow-priority-item" data-record-id="${escapeHtml(recordId)}">
            <span class="workflow-priority-main"><strong>${escapeHtml(asset)}</strong><small>${escapeHtml(company)}</small></span>
            <span class="workflow-priority-context">${escapeHtml(item.main_indication || indication)} · Data ${item.data_maturity ?? '-'} · TR ${item.target_relevance ?? '-'}</span>
            <span class="workflow-priority-badges">${workflowListBadge(decision, decision.toLowerCase())}<b class="workflow-total-score">${item.total_score ?? '-'} / ${item.max_score ?? 21}</b></span>
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

function renderWorkflowMode(summary = activeTabSummary()) {
  const mode = activeTableMode();
  if (elements.agentInput) {
    elements.agentInput.dataset.workflowMode = mode;
    elements.agentInput.placeholder = AGENT_INPUT_PLACEHOLDERS[mode] || FULL_SCOUT_AGENT_INPUT_PLACEHOLDER;
    elements.agentInput.rows = 2;
  }
  renderDataUploadGuide(mode);
  if (elements.dataUploadShortcutButton) {
    elements.dataUploadShortcutButton.hidden = mode === 'focus';
  }
  if (elements.copyTriagePromptTopButton) {
    elements.copyTriagePromptTopButton.hidden = mode !== 'triage';
  }
  if (elements.copyPromptTopButton) {
    elements.copyPromptTopButton.hidden = mode !== 'full';
  }
  const topDataActions = elements.dataUploadShortcutButton?.closest('.top-data-actions');
  if (topDataActions) {
    topDataActions.hidden = mode === 'focus';
  }
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
    elements.summaryScopeNote.textContent = '현재 Tab·Filter 기준';
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

function renderCharts() {
  const summary = activeTabSummary();
  const indicationEntries = summaryDistributionPairs(summary.indication_distribution)
    .sort((a, b) => b[1] - a[1]
      || Number(/^Others$/i.test(a[0])) - Number(/^Others$/i.test(b[0]))
      || a[0].localeCompare(b[0], 'ko'));
  elements.indicationChart.innerHTML = donutChart(indicationEntries, 'interest-indication');
  wireDonutHover(elements.indicationChart);

  const modalityEntries = summaryDistributionPairs(summary.modality_distribution);
  elements.modalityChart.innerHTML = donutChart(modalityEntries, 'modality-summary');
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

function selectOption(value, currentValue, label = value) {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(currentValue) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function statusEditSelect(row, filterKey) {
  const value = row[filterKey];
  const options = row.isTriage ? ['SELECT', 'REJECT', 'UNVERIFIED'] : ['PASS', 'REVIEW', 'FAIL'];
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
const ADMET_TOTAL_ITEMS = 25;
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
  if (source === 'manual') return '수동 입력';
  if (source === 'study_status') return '업로드 ADMET Study·Status 표 기반';
  return '자동 판단 (GPT 원문 리포트 + 첨부파일 키워드 기반, 실험 데이터 확인 필요)';
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

function stageEditSelect(row) {
  const user = getCurrentUser();
  const isManual = hasManualTableFieldEdit(row.raw, 'development_stage');
  if (!user?.is_admin) return `<span class="table-manual-text${isManual ? ' is-human' : ''}" title="${escapeHtml(row.stageRaw)}">${escapeHtml(row.stage)}</span>`;
  return `<select class="table-edit-select stage-edit${isManual ? ' is-human' : ''}" data-record-id="${escapeHtml(row.id)}" data-edit-kind="stage" data-previous-value="${escapeHtml(row.stage)}" aria-label="${escapeHtml(row.asset)} stage">${CANONICAL_DEVELOPMENT_STAGES.map((stage) => selectOption(stage, row.stage, stage)).join('')}</select>`;
}

function modalityEditValue(row) {
  const isManual = hasManualTableFieldEdit(row.raw, 'modality_platform');
  const editable = row.modality === 'Unknown' && Boolean(getCurrentUser()?.is_admin);
  const className = `single-line-cell table-manual-text${isManual ? ' is-human' : ''}${editable ? ' is-editable modality-editable' : ''}`;
  const attributes = editable
    ? ` data-table-modality-edit data-record-id="${escapeHtml(row.id)}" data-previous-value="${escapeHtml(row.modality)}" role="button" tabindex="0" aria-label="Double-click to select modality"`
    : '';
  return `<span class="${className}"${attributes} title="${escapeHtml(editable ? '관리자: 더블클릭하여 Modality 선택' : row.modality)}">${escapeHtml(row.modality)}</span>`;
}

function tableTextEditValue(row, kind, value, { title = '', strong = false, className = '' } = {}) {
  const field = kind === 'asset' ? 'asset_name' : kind;
  const isManual = hasManualTableFieldEdit(row.raw, field);
  const editable = Boolean(getCurrentUser()?.is_admin);
  const classes = `table-manual-text${isManual ? ' is-human' : ''}${editable ? ' is-editable' : ''}${className ? ` ${className}` : ''}`;
  const attributes = editable
    ? ` data-table-text-edit data-record-id="${escapeHtml(row.id)}" data-edit-kind="${escapeHtml(kind)}" data-previous-value="${escapeHtml(value)}"`
    : '';
  const content = escapeHtml(value || '-');
  return `<span class="${classes}"${attributes} title="${escapeHtml(title || value || '')}"${editable ? ' role="button" tabindex="0" aria-label="Double-click to edit"' : ''}>${strong ? `<strong>${content}</strong>` : content}</span>`;
}

function pendingScoreBadge(message = `Full Scout v${LATEST_FULL_SCOUT_RUBRIC_VERSION} review not run yet`) {
  const safeTooltip = escapeHtml(message);
  return `<span class="score pending" tabindex="0" aria-label="${safeTooltip}" data-tooltip="${safeTooltip}" title="${safeTooltip}">-</span>`;
}

function fullReviewScoreBadge(row, scoreKey, criterionKey, label) {
  if (row.isTriage) return pendingScoreBadge();
  return scoreBadge(row[scoreKey], 3, scoreTooltip(label, row.criteria[criterionKey], 3));
}

function filterToneClass(status) {
  if (!status || status === '-') return 'empty';
  if (['PASS', 'SELECT'].includes(status)) return 'pass select';
  if (status === 'FAIL') return 'fail';
  if (['REJECT', 'UNVERIFIED', 'N/A'].includes(status)) return 'na reject';
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
              <td class="country-cell" title="${escapeHtml(row.countryRaw)}">${countryDisplayMarkup(row.countryRaw || row.country)}</td>
              <td class="asset-cell"><a href="${escapeHtml(recordDetailHref(row, row.isTriage ? 'triage' : 'full'))}"><strong>${escapeHtml(row.asset)}</strong></a></td>
              <td class="target-column-cell">
                <div class="target-cell">
                  <strong>${escapeHtml(row.target)}</strong>
                  <span>Modality: ${escapeHtml(row.modality)}</span>
                  <span>Theme: ${escapeHtml(row.theme)}</span>
                  <span>Cluster: ${escapeHtml(row.cluster)}</span>
                </div>
              </td>
              <td class="indication-cell" title="${escapeHtml(row.indication)}">${escapeHtml(indicationDisplay(row))}</td>
              <td class="stage-cell" title="${escapeHtml(row.stageRaw)}">${stageEditSelect(row)}</td>
              <td class="filter-cell"><span class="${filter1Class}">${escapeHtml(row.filter1)}</span></td>
              <td class="filter-cell"><span class="${filter2Class}">${escapeHtml(row.filter2)}</span></td>
              <td class="score-cell">${scoreBadge(row.targetScore, 3, scoreTooltip('Target Area Relevance', row.criteria.target, 3))}</td>
              <td class="score-cell">${scoreBadge(row.moaScore, 3, scoreTooltip('MOA Validity', row.criteria.moa, 3))}</td>
              <td class="score-cell">${scoreBadge(row.dataScore, 3, scoreTooltip('Data Maturity', row.criteria.data, 3))}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'competitiveScore', 'competitive', 'Competitive Landscape')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'platformScore', 'platform', 'Platform Attractiveness')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'expansionScore', 'expansion', 'Expansion Potential')}</td>
              <td class="score-cell">${fullReviewScoreBadge(row, 'marketScore', 'market', 'Marketability')}</td>
              <td class="score-cell total-score-cell">${row.isTriage ? pendingScoreBadge('Full Scout total score not available for triage rows') : totalScoreEditCircle(row)}</td>
              ${extraColumns.map((column) => {
                const value = formatExtraColumnValue(get(row.raw, column.path, '-'), column);
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
  const trackingStatus = row.focusTrackingStatus || (isTracked ? 'priority' : 'untracked');
  const statusCopy = {
    untracked: {
      action: 'add',
      title: 'Shortlisting 미등록 · 클릭하여 우선 검토 대상으로 추가',
      ariaLabel: 'Shortlisting에 우선 검토 대상으로 추가'
    },
    priority: {
      action: 'stationary',
      title: 'Shortlisted · Priority review · 클릭하여 Stationary로 변경',
      ariaLabel: '우선 검토 Shortlisting 상태 · 클릭하여 Stationary로 변경'
    },
    stationary: {
      action: 'remove',
      title: 'Shortlisted · Stationary (보류 모니터링) · 클릭하여 Shortlisting에서 제거',
      ariaLabel: 'Stationary 보류 모니터링 상태 · 클릭하여 Shortlisting에서 제거'
    }
  }[trackingStatus];
  return `
    <button
      type="button"
      class="focus-action-button icon-only ${trackingStatus === 'priority' ? 'remove priority' : trackingStatus === 'stationary' ? 'stationary' : 'add'}"
      data-focus-action="${statusCopy.action}"
      data-record-id="${escapeHtml(row.id)}"
      data-tracking-status="${trackingStatus}"
      title="${escapeHtml(statusCopy.title)}"
      aria-label="${escapeHtml(statusCopy.ariaLabel)}"
    >
      <span aria-hidden="true">${isTracked ? '★' : '☆'}</span>
    </button>
  `;
}

function fullScoutRowActions(row) {
  return `
    <div class="full-scout-row-actions">
      ${rubricReevaluationButton(row)}
      ${pipelineWebsiteRowButton(row)}
      ${focusActionButton(row, 'full')}
    </div>
  `;
}

function pipelineWebsiteRowButton(row) {
  const url = String(get(row?.raw, 'meta.pipeline_metadata.website', '') || '').trim();
  if (!/^https?:\/\//i.test(url)) return '';
  return `
    <button
      type="button"
      class="focus-action-button icon-only pipeline-website-row-button"
      data-pipeline-website
      data-record-id="${escapeHtml(row.id)}"
      data-website-url="${escapeHtml(url)}"
      title="Pipeline Website · 한 번 클릭하여 열기, 두 번 클릭하여 주소 수정"
      aria-label="${escapeHtml(`${row.asset} Pipeline Website 열기`)}"
    ><svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14 14 10M8.5 7.5H7a3 3 0 0 0-3 3V17a3 3 0 0 0 3-3v-1.5M13 4h7v7M20 4l-9 9"/></svg></button>
  `;
}

function triageFullScoutCopyButton(row) {
  const title = `GPT 지침 2와 ${row.asset} / ${row.company} Fast Triage 리서치 내용을 함께 복사합니다.`;
  return `
    <button
      type="button"
      class="focus-action-button icon-only triage-full-copy-button"
      data-triage-full-copy
      data-record-id="${escapeHtml(row.id)}"
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(`${row.asset} Full Scout 지침 복사`)}"
    ><svg class="pipeline-row-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/></svg></button>
  `;
}

function rubricReevaluationButton(row) {
  const isTriage = row.isTriage;
  const workflowLabel = isTriage ? 'Fast Triage' : 'Full Scout';
  const latestVersion = isTriage ? LATEST_TRIAGE_RUBRIC_VERSION : LATEST_FULL_SCOUT_RUBRIC_VERSION;
  const appliedVersion = String(
    get(row.raw, 'meta.rubric_reviewed_version', '')
    || get(row.raw, 'meta.rescored_rubric_version', '')
    || get(row.raw, 'meta.rubric_recalculation.version', row.criteriaVersion || '-')
  );
  const evaluatedAt = get(
    row.raw,
    'meta.rubric_reviewed_at',
    get(row.raw, 'meta.rubric_recalculation.recalculated_at', row.generatedAt || '-')
  );
  const hasManualScoreOverride = Object.keys(humanReviewOverrides(row.raw)?.scores || {}).length > 0
    || hasManualTotalScoreOverride(row.raw);
  const isCurrent = !hasManualScoreOverride && appliedVersion.replace(/^v/i, '') === latestVersion;
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
  return `<div class="full-scout-row-actions">${rubricReevaluationButton(row)}${pipelineWebsiteRowButton(row)}${triageFullScoutCopyButton(row)}</div>`;
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
      title="최신 OI Partnership v${escapeHtml(latestVersion)} 기준으로 Filter 3와 OI Note를 다시 자동 분류합니다. 수동 Filter 3·Note와 붉은 표시는 자동 결과로 초기화되며, In-vivo·In-vitro·ADMET 입력과 업로드 자료는 유지됩니다. 현재 표시 버전: v${escapeHtml(currentVersion)}"
      aria-label="${escapeHtml(row.asset)} 최신 OI Partnership v${escapeHtml(latestVersion)} 재분류"
    >
      <span aria-hidden="true">↻</span>
    </button>
  `;
}

function focusRowActions(row) {
  return `
    <div class="full-scout-row-actions">
      ${oiPartnershipRefreshButton(row)}
      ${focusActionButton(row, 'focus')}
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
  const displayLabel = countryTableCode(label);
  return `<span class="country-cell-content" aria-label="${escapeHtml(label)}">${countryFlagSvg(label)}<span>${escapeHtml(displayLabel)}</span></span>`;
}

function renderFocusTable() {
  const visibleRows = getVisibleRows();
  const allModeRows = state.rows.filter(rowMatchesActiveTableMode);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  const tableElement = elements.pipelineTable?.closest('table');

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
        <th class="select-col" rowspan="2" ${columnAttrs('select')}>
          <input id="selectPageRows" type="checkbox" aria-label="현재 페이지 전체 선택" />
        </th>
        ${sortableHeader('Company', 'company', 'company', 'rowspan="2"')}
        ${sortableHeader('Country', 'country', 'country', 'rowspan="2"')}
        ${sortableHeader('Asset', 'asset', 'asset', 'rowspan="2"')}
        ${sortableHeader('Modality', 'modality', 'modality', 'rowspan="2"')}
        ${sortableHeader('Target', 'target', 'target', 'rowspan="2"')}
        ${sortableHeader('Main indication', 'mainIndication', 'mainIndication', 'rowspan="2"')}
        ${sortableHeader('Stage', 'stage', 'stage', 'rowspan="2"')}
        <th class="score-group-head focus-group-head" colspan="2">Full Scout</th>
        <th class="score-group-head focus-group-head" colspan="5">Shortlisting</th>
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
    elements.selectPageRows = document.querySelector('#selectPageRows');
  }

  elements.tableCount.textContent = `검색 결과 ${uniqueAssetCount(visibleRows)} / 전체 ${uniqueAssetCount(allModeRows)} assets`;
  if (elements.exportExcelButton) elements.exportExcelButton.disabled = visibleRows.length === 0;
  elements.pipelineTable.innerHTML = pageRows.length
    ? pageRows.map((row) => {
        const isSelected = state.selectedIds.has(row.id);
        const checked = isSelected ? 'checked' : '';
        return `
        <tr class="clickable-row focus-management-row${isSelected ? ' selected-row' : ''}" data-record-id="${escapeHtml(row.id)}" title="${escapeHtml(rowHoverTitle(row))}">
          <td class="select-col">
            <input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} 선택" ${checked} />
          </td>
          <td class="company-cell">${escapeHtml(row.company)}</td>
          <td class="country-cell" title="${escapeHtml(row.countryRaw)}">${countryDisplayMarkup(row.countryRaw || row.country)}</td>
          <td class="asset-cell"><a href="${escapeHtml(recordDetailHref(row, 'focus'))}"><strong>${escapeHtml(row.asset)}</strong></a></td>
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
            <span
              class="target-single-line${row.target === 'Unknown' && getCurrentUser()?.is_admin ? ' target-unknown-edit' : ''}"
              ${row.target === 'Unknown' && getCurrentUser()?.is_admin ? `data-unknown-target-edit data-record-id="${escapeHtml(row.id)}" title="관리자: 더블클릭하여 Target 입력"` : ''}
            >${escapeHtml(row.target)}</span>
            <span class="target-context-indicator" aria-hidden="true">i</span>
          </td>
          <td class="indication-cell" title="${escapeHtml(row.indication)}">${escapeHtml(indicationDisplay(row))}</td>
          <td class="stage-cell" title="${escapeHtml(row.stageRaw)}">${stageEditSelect(row)}</td>
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
          <td class="focus-action-cell">${focusRowActions(row)}</td>
        </tr>
      `;
      }).join('')
    : `
      <tr>
        <td colspan="16" class="empty-cell focus-empty-state">
          <strong>${allModeRows.length ? '현재 조건에 맞는 Shortlisting asset이 없습니다.' : '아직 Shortlisting에 추가된 약물이 없습니다.'}</strong>
          <span>${allModeRows.length ? '필터를 조정하거나 초기화해 주세요.' : 'TAB2 Full Scout의 오른쪽 ‘즐겨찾기’ 버튼으로 관리 대상을 추가하세요.'}</span>
        </td>
      </tr>
    `;

  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateSelectionControls(pageRows);
  updateFrozenColumnOffsets();
  updateSortIndicators();
}

function renderTable() {
  updateHeaderRecordCount();
  hideTargetContextTooltip();
  fitColumnWidthsToTable();
  const mode = activeTableMode();
  elements.pipelineTable
    ?.closest('.table-wrap')
    ?.classList.toggle('focus-management-table-wrap', mode === 'focus');
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
        ${mode === 'triage' ? plainHeader('재평가', 'rubricAction', 'focus-action-head', 'rowspan="2"') : ''}
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
              ${mode === 'triage' ? `title="${escapeHtml(rowTitle)}"` : ''}
            >
              <td class="select-col">
                <input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} select" ${checked} />
              </td>
              <td class="company-cell">${tableTextEditValue(row, 'company', row.company)}</td>
              <td class="country-cell" title="${escapeHtml(row.countryRaw)}">${countryDisplayMarkup(row.countryRaw || row.country)}</td>
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
              <td class="indication-cell">${tableTextEditValue(row, 'main_indication', row.mainIndication, { title: row.indication })}</td>
              <td class="stage-cell" title="${escapeHtml(row.stageRaw)}">${stageEditSelect(row)}</td>
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

  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateSelectionControls(pageRows);
  updateFrozenColumnOffsets();
  updateSortIndicators();
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
  renderAgentIdentity();
}

function renderAgentIdentity() {
  const isAvailable = activeTableMode() !== 'triage';
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
    hasSelectedFilterValues(state.modality),
    hasSelectedFilterValues(state.theme),
    hasSelectedFilterValues(state.cluster),
    hasSelectedFilterValues(state.country),
    hasSelectedFilterValues(state.indication),
    hasSelectedFilterValues(state.stage),
    hasSelectedFilterValues(state.pass)
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
    hasSelectedFilterValues(state.pass)
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

async function loadRecords({ signal } = {}) {
  elements.dataStatus.textContent = 'Loading';
  await loadCategorySynonyms(signal);
  const [response] = await Promise.all([
    fetch(API_URL, { cache: 'no-store', signal }),
    refreshDashboardSummary(signal)
  ]);
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  state.latestOiPartnershipCriteriaVersion = String(
    data.oi_partnership_criteria_version || state.latestOiPartnershipCriteriaVersion
  );
  state.rawRecords = Array.isArray(data.records) ? data.records : [];
  state.rows = state.rawRecords.map(flattenRecord);
  const availableIds = new Set(state.rows.map((row) => row.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => availableIds.has(id)));
  state.page = 1;
  renderFilters();
  render();
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
  if (!recordId || !['status', 'score', 'total_score', 'modality', 'stage', 'target'].includes(kind)) return;
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
    await refreshDashboardSummary();
    renderFilters();
    render();
    updateHeaderRecordCount();
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
    const response = await fetch(`/api/records/${encodeURIComponent(recordId)}/manual-review`, {
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
    const response = await fetch(`/api/records/${encodeURIComponent(recordId)}/manual-review`, {
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
  const rowIndex = state.rows.findIndex((row) => row.id === recordId);
  if (rowIndex < 0 || !record) return;
  state.rawRecords[rowIndex] = record;
  state.rows = state.rawRecords.map(flattenRecord);
  state.dashboardSummary = null;
}

async function recalculateLatestRubric(button) {
  const recordId = button?.dataset.recordId;
  if (!recordId) return;
  const isTriage = button.dataset.reviewType === 'triage';
  const workflowLabel = isTriage ? 'Fast Triage' : 'Full Scout';
  const latestVersion = isTriage ? LATEST_TRIAGE_RUBRIC_VERSION : LATEST_FULL_SCOUT_RUBRIC_VERSION;
  button.disabled = true;
  button.classList.add('is-saving');
  elements.dataStatus.textContent = `${workflowLabel} 지침 v${latestVersion} 재평가 중`;

  try {
    const data = await runBlockingOperation({
      title: '최신 루브릭으로 재평가 중',
      message: `${workflowLabel} 원문 리포트와 첨부 자료를 기준으로 점수를 다시 계산하고 있습니다.`,
      status: '점수와 판단 근거를 갱신하고 있습니다.'
    }, async (signal) => {
      const response = await fetch(
        `/api/records/${encodeURIComponent(recordId)}/refresh-rubric`,
        { method: 'POST', signal }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || `HTTP ${response.status}`);
      return result;
    });
    if (data === OPERATION_CANCELLED) {
      updateHeaderRecordCount();
      return;
    }
    if (!data.record || ['error', 'conflict'].includes(data.status)) {
      updateHeaderRecordCount();
      return;
    }
    replaceRecordFromApi(recordId, data.record);
    await refreshDashboardSummary();
    renderFilters();
    render();
    updateHeaderRecordCount();
  } catch (error) {
    elements.dataStatus.textContent = `${workflowLabel} 재평가 실패: ${error.message}`;
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
  elements.dataStatus.textContent = `${row.asset} Full Scout 지침 복사 중`;

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
  button.disabled = true;
  button.classList.add('is-saving');
  const latestVersion = state.latestOiPartnershipCriteriaVersion;
  elements.dataStatus.textContent = `OI Partnership v${latestVersion} 재분류 중`;

  try {
    const data = await runBlockingOperation({
      title: 'Filter 3 분류를 갱신하고 있습니다',
      message: '현재 Shortlisting 판단 기준으로 파이프라인을 다시 분류하고 있습니다.',
      status: 'OI Partnership 결과를 계산하고 있습니다.'
    }, async (signal) => {
      const response = await fetch(
        `/api/records/${encodeURIComponent(recordId)}/recalculate-oi-partnership`,
        { method: 'POST', signal }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || `HTTP ${response.status}`);
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

let floatingAgentController = null;

const CRITERIA_DRAWER_SCOPE_LABELS = {
  triage: 'TAB 1 · FAST TRIAGE · SCORING GUIDE',
  full: 'TAB 2 · FULL SCOUT · SCORING GUIDE',
  focus: 'TAB 3 · SHORTLISTING · DECISION GUIDE'
};

const CRITERIA_DRAWER_SUBTITLES = {
  triage: 'Full Scout 검토 후보를 선별하기 위한 3-point screening 기준',
  full: '과학성·차별성·개발성·사업성을 평가하는 Full Scout 기준',
  focus: 'Shortlisted 후보의 OI Partnership Type 자동분류 및 후속 관리 기준'
};

function updateCriteriaDrawerScope() {
  const mode = activeTableMode();
  if (elements.criteriaDrawerScopeLabel) {
    elements.criteriaDrawerScopeLabel.textContent = CRITERIA_DRAWER_SCOPE_LABELS[mode] || '';
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
    elements.criteriaDrawerSubtitle.textContent = CRITERIA_DRAWER_SUBTITLES[mode] || '';
  }
  if (elements.criteriaDrawer) elements.criteriaDrawer.dataset.activeCriteriaTab = mode;
  document.querySelectorAll('[data-criteria-tab]').forEach((section) => {
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
    'Obsidian mock: 관련 note alias/tags를 확인하고, Agentic Search mock은 target, modality, front runner, marketability 근거를 보강하는 흐름으로 구성됩니다.'
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
        `TR=${row.targetScore}`,
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
const INPUT_TRIAGE_STATUSES = new Set(['SELECT', 'REJECT', 'UNVERIFIED']);
const INPUT_FULL_STATUSES = new Set(['PASS', 'REVIEW', 'FAIL']);
const INPUT_MODALITIES = new Set([
  'Small molecule',
  'Peptide',
  'RNA therapy',
  'Cell therapy',
  'Gene therapy',
  'Antibody',
  'Protein biologic',
  'Other',
  'Unknown'
]);
const INPUT_INDICATIONS = new Set([
  "Alzheimer's disease",
  "Parkinson's disease",
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
  'Systemic lupus erythematosus / autoimmune disease',
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
    addInputIssue(errors, 'error', `${recordPath}.structured_table.development_stage`, `"${stage}"는 허용된 canonical 개발단계가 아닙니다.`);
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
  table.modality_platform = canonicalModality(table.modality_platform);
  table.development_stage = canonicalDevelopmentStage(table.development_stage);
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
  const records = split.records.map((record) => (
    isInputObject(record)
      ? normalizeExpandedInputFilterFields(expandCompactInputRecord(record, lockedMode))
      : record
  ));

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
        addInputIssue(errors, 'error', `${recordPath}.hard_filter.status`, `Fast Triage v${LATEST_TRIAGE_RUBRIC_VERSION} 판정은 SELECT, REJECT, UNVERIFIED 중 하나여야 합니다.`);
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
      const activeAsset = record.triage?.active_asset;
      if (typeof identityVerified !== 'boolean') {
        addInputIssue(errors, 'error', `${recordPath}.triage.identity_verified`, 'true 또는 false가 필요합니다.');
      }
      if (!isInputObject(record.triage) || !Object.prototype.hasOwnProperty.call(record.triage, 'active_asset')) {
        addInputIssue(errors, 'error', `${recordPath}.triage.active_asset`, '필수 필드입니다. true, false, null 중 하나가 필요합니다.');
      } else if (activeAsset !== null && typeof activeAsset !== 'boolean') {
        addInputIssue(errors, 'error', `${recordPath}.triage.active_asset`, 'true, false, null 중 하나가 필요합니다.');
      }
      const trScore = criteria.target_relevance?.score;
      const moaScore = criteria.moa_validity?.score;
      const dataScore = criteria.data_maturity?.score;
      const hasHardBlocker = activeAsset === false
        || canonicalDevelopmentStage(record.structured_table?.development_stage) === 'Discontinued / inactive'
        || hasAffirmedLifecycleBlocker(record.hard_filter?.flags || []);
      const expectedStatus = identityVerified !== true
        ? 'UNVERIFIED'
        : activeAsset !== true || hasHardBlocker
          ? 'REJECT'
          : trScore >= 2 && (moaScore >= 2 || dataScore >= 2)
            ? 'SELECT'
            : 'REJECT';
      if (INPUT_TRIAGE_STATUSES.has(status) && status !== expectedStatus) {
        addInputIssue(
          errors,
          'error',
          `${recordPath}.triage.status`,
          `identity/activity/TR/MoA/Data 산식에 따른 status는 ${expectedStatus}여야 합니다. 현재 값: ${status}`
        );
      }
      const expectedRecommendation = {
        SELECT: 'Run Full Scout',
        REJECT: 'Do not run Full Scout',
        UNVERIFIED: 'Verify asset identity'
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
          addInputIssue(errors, 'error', `${recordPath}.scoring.total_score`, `TR/MoA/Data 합계 ${expectedTotal}와 일치해야 합니다.`);
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
          addInputIssue(errors, 'error', `Markdown.Triage[${index}]`, `Fast Triage v${LATEST_TRIAGE_RUBRIC_VERSION}에서는 legacy N/A 대신 UNVERIFIED를 사용해야 합니다.`);
          return;
        }
        if (!INPUT_TRIAGE_STATUSES.has(row.status)) {
          addInputIssue(errors, 'error', `Markdown.Triage[${index}]`, 'SELECT, REJECT, UNVERIFIED 중 하나만 사용해야 합니다.');
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

function renderInputValidation(result, { savedMessage = '' } = {}) {
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
  elements.previewInputButton.disabled = false;
  elements.saveJsonButton.disabled = !result.canSave;
  if (elements.aiReparseButton) {
    elements.aiReparseButton.disabled = !(result.rawMarkdown && result.errors.length > 0);
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
    if (correctedCount > 0 || data.new_warning) {
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
      elements.aiReparseButton.disabled = false;
      return;
    }
    const failed = validateCombinedInput(elements.gptResponseInput.value, expectedMode);
    addInputIssue(failed.errors, 'error', 'AI 2차 파싱', formatAiReparseFailure(error));
    renderInputValidation(failed);
    setDataUploadStatus('error', failed.errors.length);
    elements.aiReparseButton.disabled = false;
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
  if (!recordsToSave.length) {
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
        existing_record_id: decision.existingRecordId
      }))
  };

  elements.saveJsonButton.disabled = true;
  setDataUploadStatus('validating');
  try {
    const result = await runBlockingOperation({
      title: '파이프라인을 저장하고 있습니다',
      message: '업로드한 리포트와 구조화 데이터를 저장하고 대시보드를 갱신합니다.',
      status: '저장이 완료될 때까지 잠시만 기다려 주세요.'
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
    renderInputValidation(validation, { savedMessage: '저장 완료' });
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

Use the most specific confirmed indication wording for Target Relevance. Neuropathic pain and explicit neuropathic subtypes/synonyms are interest indications. If only generic Pain is confirmed, the subtype is unknown, or the pain is acute, postoperative, or non-neuropathic, apply the TR 1 rule.

Shared TR / MoA / Data scoring rubric (use the same direction in Fast Triage v3.3 and Full Scout v3.4):
- For Target Relevance, always evaluate in descending order: 3, then 2, then 1, then 0. If more than one rule appears applicable, assign only the single highest applicable score.
- Target Relevance 0: insufficient information to judge SKBP relevance, or confirmed indication is outside the SKBP-related disease scope.
- Target Relevance 1: neurologic, neuroimmune, neurodegenerative, or pain-related disease outside the six interest indications; also use 1 when a claimed interest indication clearly contradicts the verified target/MoA.
- Target Relevance 2: a confirmed detailed indication is one of the six interest indications, even if target/MoA is undisclosed or direct biology fit is not established.
- Target Relevance 3: a confirmed interest indication plus a verified target/MoA directly linked to that disease biology or an SKBP Theme/Cluster. Undisclosed target/MoA is not a contradiction.
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

const SHARED_CANONICAL_STAGE_RULE = `Canonical Development Stage — structured_table.development_stage must be exactly one of:
Hit Discovery; Lead Optimization; Preclinical Candidate; IND-enabling; Preclinical unspecified; IND filed/cleared; Phase 1; Phase 1/2; Phase 2; Phase 2/3; Phase 3; Registration; Approved / marketed; Discontinued / inactive; Unknown.

Canonicalize only an explicitly confirmed current stage or a completed/started milestone. Do not promote stage from plans, expectations, targets, financing, hiring, or adjacent programs. Generic preclinical -> Preclinical unspecified. Candidate nominated/selected -> Preclinical Candidate. Ongoing GLP tox, IND-directed CMC, or explicit IND-enabling work -> IND-enabling. IND/CTA submitted, filed, accepted, effective, or cleared -> IND filed/cleared. Planned IND submission alone does not establish IND filed/cleared; "preclinical; IND planned" remains Preclinical unspecified. For multi-indication assets, use the lead/currently most advanced confirmed stage as the single dashboard value and move indication-specific status detail to evidence or notes; for example, "FOS Phase II recruiting; pain stage unclear" -> Phase 2. Do not map speculative wording such as "likely preclinical or dormant" or a different historical alias marked discontinued to the current asset's Discontinued / inactive status. Use Unknown only when the relevant current stage itself is unresolved or conflicting.`;

const SHARED_CANONICAL_MODALITY_RULE = `Canonical Modality — structured_table.modality_platform must be exactly one of: Small molecule, Peptide, RNA therapy, Cell therapy, Gene therapy, Antibody, Protein biologic, Other, or Unknown.
Normalize route, dosage-form, and technical qualifiers into that single label. Examples: "Oral small molecule", "oral small-molecule / tablet", and "small-molecule CNS discovery platform" -> Small molecule; "IV antibody" -> Antibody; "topical peptide" -> Peptide. Put oral/IV/topical route, tablet/formulation, delivery system, and platform detail in MoA, source evidence, company_profile.platform_summary, or notes. Never combine multiple labels or retain route/formulation text in modality_platform.`;

const SHARED_CANONICAL_INDICATION_RULE = `Canonical Main Indication — structured_table.main_indication must be exactly one of: Alzheimer's disease; Parkinson's disease; Epilepsy / seizure disorders; Multiple sclerosis / neuroinflammatory disease; Amyotrophic lateral sclerosis / motor neuron disease; Frontotemporal dementia; Huntington's disease; Stroke; Migraine / headache disorders; Pain; Major depressive disorder; Schizophrenia / psychosis; Bipolar disorder; Anxiety disorders; Autism spectrum disorder; ADHD; Sleep / wake disorders; Chronic cough; Inflammatory bowel disease; Systemic lupus erythematosus / autoimmune disease; or Unknown.
main_indication is mandatory. Never omit the key and never use null, an empty string, N/A, or an unnormalized disease phrase. If the lead can be determined, always write its canonical dashboard bucket. Use Unknown only when the lead genuinely cannot be distinguished after the following priority.
When several indications are confirmed, retain every confirmed disease wording in structured_table.indication and provide structured_table.indication_list as its canonical array; do not replace confirmed indications with Unknown.
Lead-indication selection priority: (1) use an indication explicitly identified as lead, primary, initial, or the sole current indication for the assessed asset on an official company pipeline page or current official company material; (2) if no official lead is designated, use the indication targeted by the single most advanced confirmed active clinical program, comparing only registered, started, recruiting, ongoing, or dosed programs; (3) if no lead can still be established but one or more confirmed indications are listed, set main_indication to the first canonical indication in the source's textual/listed order and preserve every canonical indication in indication_list. Use Unknown only when no confirmed canonical indication is available. Exclude planned/expected indications, competitor programs, historical or discontinued programs, and platform-expansion claims.
Keep complete disease wording and all secondary indications in structured_table.indication and Markdown. In Markdown state the source-based reason for the selected lead or source-order fallback. Examples: "Lead disclosed indication: inflammatory bowel disease; expansion potential for MS" -> Inflammatory bowel disease; "FOS Phase 2 recruiting; MDD planned; pain stage unclear" -> Epilepsy / seizure disorders; "CNS hypotheses include stroke and status epilepticus; no official lead or active trial" -> Stroke with indication_list also containing Epilepsy / seizure disorders.`;

const SHARED_CANONICAL_THEME_RULE = `Canonical R&D Theme — json_summary.theme must be exactly one of E/I Balance, Neuroimmune, Protein Homeostasis, Others, or Unknown. Determine Theme from researched evidence for the assessed asset's target and MoA, not from disease association alone.
Use Protein Homeostasis only when the target/MoA directly modulates proteostasis, such as protein folding or chaperone function, ubiquitin-proteasome activity, autophagy-lysosome function, ER stress/UPR, or pathogenic protein aggregate clearance. The mere presence of protein aggregates in a disease does not establish this Theme. Use Others only when the identified target/MoA is confirmed outside all three R&D Themes, and Unknown when target/MoA evidence is insufficient. Because no Protein Homeostasis sub-cluster taxonomy is approved yet, use cluster="Unknown" for this Theme. Never use N/A or No Theme.`;

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
      "status": "UNVERIFIED",
      "reason": "",
      "flags": [],
      "decision_uncertainty": false
    },
    "triage": {
      "status": "UNVERIFIED",
      "identity_verified": false,
      "active_asset": null,
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
Run FAST TRIAGE on biotech/pharma pipeline assets. The purpose is to decide which assets should proceed to the full SKBP Pipeline Finder v3.3 in-depth review.

This is GPT instruction 1: Fast Triage v3.3.
Use GPT instruction 2 only after a candidate receives SELECT and needs Full Scout v3.4 review.

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
- SELECT means worth sending to Full Scout v3.4.
- REJECT means not worth full review based on current quick evidence.
- UNVERIFIED means asset identity itself cannot be verified as a biotech/pharma pipeline asset from credible public sources.
- A REJECT or UNVERIFIED can change later if better identity, target, MoA, data, company, or source evidence becomes available.

Input:
The user may provide structured rows copied from Excel/TSV/CSV/plain text or a simple asset list.
Each entry may include asset name, target, MoA, company, therapeutic area, indication, development stage, region/country, notes, and source URL.
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
- When evidence is ambiguous, apply each criterion's exact rule and record unresolved factual conflicts as Unknown. Do not lower a confirmed interest indication below TR 2 solely because direct target/MoA biology is missing or weak; only a verified contradiction triggers the TR 1 rule.
- If credible public sources cannot verify the named item as a specific biotech/pharma pipeline asset, classify it as UNVERIFIED.

Early stop rules:
- Apply UNVERIFIED before scoring only when the asset identity itself cannot be verified as a biotech/pharma pipeline asset. Missing target, MoA, indication, or stage alone does not make an asset UNVERIFIED; use Unknown and continue scoring.
- Apply REJECT before scoring if the development stage is Discontinued / inactive, terminated, withdrawn, suspended, dormant, or clearly failed. This means the pipeline is not an active review candidate.
- For UNVERIFIED or Discontinued / inactive cases, keep the markdown and research depth short. Do not perform full diligence, marketability, competitor landscaping, or extended source chasing.
- Early stop never shortens the required dashboard JSON contract: every record must still contain all three TR/MoA/Data criterion score objects. Put evidence basis, score rationale, sources, and limitations in the Markdown table/notes, not in duplicated JSON fields. An inactive asset remains REJECT because of the lifecycle hard blocker regardless of otherwise available preliminary scores.

Triage scoring:
- Use the same scoring direction as Full Scout v3.4, but only for these three matching criteria:
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
- triage.verified_public_source_count must exactly equal the unique verified public URL count after removing duplicates and trailing-slash variants. It is retained only for the Quick Summary card; source count itself does not determine the score.
- Copy the exact user/company identifiers into input.company_input and input.asset_input. These two aliases are used only to join the Fast Triage and Full Scout rows for the same asset. When the user appended relevant free-text context, copy it faithfully into input.user_context; otherwise keep user_context as an empty string.

Summary rule:
- In the Markdown table/notes, each criterion judgment must be a non-empty 1–2 sentence explanation containing the confirmed asset-specific fact, why it maps to the selected score, and the key limitation.
- State the single score once in a criterion-labelled prefix (for example, "TR 2 points:") and never use a score range. The score prefix must match the JSON score; scientific/clinical numbers in the rest of the sentence are evidence, not scores.
- General disease biology alone cannot explain an asset score. For user_input_only, do not introduce facts absent from the user input.

Triage status rule:
- active_asset is required and must be true, false, or null: true only when current activity is confirmed, false when inactivity is confirmed, and null when activity cannot be established.
- SELECT only if identity_verified=true, active_asset=true, TR >= 2, and either MoA >= 2 or Data >= 2.
- REJECT if asset identity is verified but active_asset is false/null, or SKBP fit, MoA, or Data is too weak for Full Scout priority.
- REJECT if development_stage is Discontinued / inactive, terminated, withdrawn, suspended, dormant, or clearly failed, even if target/MoA look interesting.
- UNVERIFIED if asset identity itself is not verified as a biotech/pharma pipeline asset.
- If unsure between SELECT and REJECT, choose REJECT and explain the missing evidence needed.

Controlled vocabulary:
- For an identity-verified asset, use Unknown when country, development stage, modality, main indication, target, or another factual field cannot be established. UNVERIFIED is reserved for failure of asset identity itself.
- company_country must use exactly one canonical value such as China, Republic of Korea, Japan, United States, Europe/UK, Taiwan, Singapore, Canada, Australia, Israel, or Unknown. Use the assessed company's primary legal domicile/headquarters; for example, "China / United States operations" -> China. Keep secondary offices and operating regions in Markdown notes, not company_country.
${SHARED_CANONICAL_STAGE_RULE}
${SHARED_CANONICAL_MODALITY_RULE}
${SHARED_CANONICAL_INDICATION_RULE}
- structured_table.indication must preserve the most specific confirmed wording (for example, diabetic peripheral neuropathic pain). Use that detailed indication—not the broader main_indication bucket—for TR and the neuropathic-pain rule.
${SHARED_CANONICAL_THEME_RULE}

Output language:
Korean. English is allowed for scientific terms.

Final output format:
The final answer must contain exactly one copyable fenced code block. Inside that single block, put the Markdown report first, then the single separator line shown in the template below, then the raw JSON array. Do not create inner Markdown or JSON fences.
The TAB1 importer splits on that exact separator and parses the entire suffix once. Therefore the JSON suffix must be one complete top-level array, not several JSON objects or partial fragments.

\`\`\`text
# SKBP Fast Triage Result

> Version statement: This result was researched and scored with GPT instruction 1 — Fast Triage v3.3. Full Scout v3.4 has not been run.

중요: 한 문장으로 triage 결론과 filter rationale을 먼저 씁니다. 예: 공개 자료상 asset identity는 확인되지만 개발 단계가 Discontinued / inactive로 확인되어 REJECT로 처리합니다.

| # | Asset | Company | Target/MoA | Modality | Main indication | Stage | Country | TR | MOA | Data | Triage | Why | Source |
|---:|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| 1 |  |  |  |  |  |  |  |  |  |  | SELECT/REJECT/UNVERIFIED |  |  |

## Notes
- Keep notes short.
- Mention only source uncertainty, duplicate rows, or reason to run Full Scout.

--- JSON DATA ---

[
  {
    "meta": {
      "schema_version": "3.2",
      "instruction_version": "3.3",
      "rubric_version": "3.3",
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
    "parser_note": "GPT instruction 1 Fast Triage v3.3 output. Full Scout v3.4 review has not been run."
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
      "status": "UNVERIFIED",
      "reason": "Asset identity has not yet been verified from credible public sources.",
      "flags": []
    },
    "triage": {
      "instruction_version": "3.3",
      "status": "UNVERIFIED",
      "identity_verified": false,
      "active_asset": null,
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
      "version_statement": "Researched and scored with GPT instruction 1 — Fast Triage v3.3; Full Scout v3.4 not run.",
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
- Do not leave pipe-delimited template choices such as "SELECT | REJECT | UNVERIFIED" in the final JSON; choose exactly one allowed value.
- Recommendation mapping is exact: SELECT -> "Run Full Scout"; REJECT -> "Do not run Full Scout"; UNVERIFIED -> "Verify asset identity".
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

This is GPT instruction 2: Full Scout v3.4. State v3.4 in the Markdown report. In compact JSON, do not repeat schema/instruction/rubric version fields; the dashboard adds schema 3.2 and instruction/rubric 3.4 during deterministic expansion.

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

For Target Relevance, generic, acute, postoperative, or otherwise unverified-as-neuropathic pain is related disease only (score 1), not a six-interest indication.

${SHARED_CANONICAL_STAGE_RULE}

Company: [COMPANY_NAME]
Asset / drug / pipeline name: [ASSET_NAME]
Output language: Korean. English is allowed for scientific terms.

Identity Gate / identity-not-verified early stop:
- Before writing the full report, first verify whether the input appears to be a real biotech/pharma pipeline asset.
- Use only a short identity check at this gate. Check for at least one credible biotech source type: official company/pipeline page, clinical trial registry, regulatory source, peer-reviewed publication, reputable biotech news, company presentation, patent/source that clearly links the asset to a drug target or indication.
- Fail this gate only when the named asset itself cannot be verified as a specific biotech/pharma pipeline asset from credible public sources. Missing target, MoA, modality, indication, stage, country, or ownership does not fail the gate; write Unknown for that factual field, record the uncertainty, and continue the full review and scoring.
- If search results are mostly unrelated SKUs, tools, electronics, finance tickers, unrelated abbreviations, or ambiguous non-drug references and no credible source verifies a specific drug-development asset, classify it as identity not verified.
- If the asset identity is not verified, stop Full Scout and return FAIL / Deprioritize. Also return FAIL regardless of score when a credible source confirms the lifecycle as Discontinued, Terminated, Withdrawn, Inactive, or Clearly failed.
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
11. Hard Filter is canonical: PASS when Total >= 14, Target Relevance >= 3, MoA Validity >= 2, Data Maturity >= 2, asset identity is verified, an active development program is confirmed, and no hard blocker/decision-critical uncertainty remains. REVIEW when Total is 9-13; or a PASS gate is missed without a FAIL rule; or active status, key evidence, source, rights, or stage uncertainty prevents a firm conclusion. FAIL when Total <= 8, Target Relevance <= 1, asset identity is unverified, or a lifecycle FAIL condition is confirmed.
11a. Set hard_filter.hard_blocker=true only for a confirmed FAIL blocker. Set hard_filter.decision_uncertainty=true only when stage, rights/license/ownership, asset identity, source/registry, sponsor, or active-program uncertainty prevents an otherwise firm decision. These booleans keep Filter 2 deterministic after research prose stays in Markdown.
11b. Copy the exact assessed company and asset identifiers into input.company_input and input.asset_input. These two aliases are used only to join the Fast Triage and Full Scout rows for the same asset. When the user appended relevant free-text context, copy it faithfully into input.user_context; otherwise keep user_context as an empty string.
12. If the latest stage, ownership, financing, or trial status is unclear, mark it as uncertain and state what source is needed.
13. Do not invent URLs. If a URL cannot be verified, describe the missing source in Markdown and validation.uncertain_points.
14. Work out commercial_rationale_status, method, A/B/C/D, and any external forecast in Markdown. Put the resulting 0–3 score and the minimal A/B/C/D output projection shown in the Compact v2 template in JSON.
15. The JSON template defaults Marketability to score 0. A reliable calculation or asset-specific external forecast may support scores 1–3; document the complete method and numbers in Markdown.
16. Keep source_report.raw_markdown as an empty string because the dashboard inserts the Markdown portion. Do not add keys not present in the Compact v2 template; research details already present in Markdown must not be duplicated in JSON.

Scoring v3.3 rules:
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
- Target Relevance — 0: insufficient SKBP-relevance evidence or confirmed indication outside the relevant disease scope; 1: neurologic/neuroimmune/neurodegenerative/pain disease outside the six SKBP interests; 2: one six-interest indication is specifically confirmed; 3: score-2 indication plus verified target/MoA directly linked to its disease biology or an SKBP Theme/Cluster.
- MoA Validity — 0: target or MoA unconfirmed; 1: company claim or theoretical rationale only; 2: functional evidence or independent same-target/class validation; 3: assessed-asset target engagement, mechanism-linked PD/biomarker, or direct functional validation.
- Data Maturity — 0: no asset-specific result in public sources or readable attachments; 1: qualitative claim or fragmentary result only; 2: at least one asset-specific quantitative evidence domain appropriate to the current stage; 3: at least two complementary quantitative domains addressing different development questions, with at least one directly supporting program progression. Source count, endpoint count, and repeated presentations of one experiment do not create extra domains.
- Competitive Landscape evaluates competitive position and differentiation only; patient counts, price, market size, and peak sales belong only to Marketability. Similarity is High for same indication + same target/MoA + similar modality; Medium for same indication + same pathway/biology; Low for same indication only. Score 0: search scope/evidence insufficient to judge a direct competitor set; 1: competitors found but differentiation is claim/concept only with no asset-specific quantitative comparison; 2: asset-specific quantitative differentiation versus an appropriate comparator or realistic entry space; 3: sufficient search completed, high-similarity competitors are limited, and strong quantitative differentiation or a leading position is verified. Never award 3 merely because no competitor was found or by competitor count alone. Search at minimum: asset name/aliases; same indication + target/MoA; same indication + pathway/biology; approved, Phase 3, clinical, and major preclinical competitors; trial registries; and recent review, official-pipeline, or patent sources. Separate direct/high-similarity from broader competitors and record scope and limitations.
- Platform Attractiveness evaluates a reusable technical system whose common principles/design/manufacturing/delivery can generate multiple candidates/programs or improve performance. Score 0: no reusable structure or verifiable technical advantage; 1: reusable structure with plausible rationale but claim/concept-level differentiation; 2: at least one quantitative result showing technical advantage versus an appropriate comparator; 3: score 2 plus repeated quantitative advantage across multiple conditions or multiple platform-derived assets, or a platform-derived asset has reached First Patient Dosed. FPD alone is insufficient without score-2 quantitative evidence. Do not award points merely for preferred modality, indication expansion, multiple assets, or pipeline breadth.
- Expansion Potential evaluates only additional indications for the assessed asset beyond its main indication. Score 0: none confirmed; 1: additional indication with biological rationale only; 2: asset-specific early quantitative data in at least one additional indication; 3: at least two distinct additional indications, at least one confirmed as an active asset-specific program, and asset-specific quantitative efficacy, PD, or biomarker data in that additional indication. An active program may be separately listed on the official pipeline or be in preclinical, IND-enabling, trial registration/authorization, or dosing; it is not limited to clinical development. Future opportunity, possible/planned evaluation, an indication list, platform-level expansion not tied to the asset, wording variants of one disease, and patient subgroups are not separate programs/indications. Do not award points for platform reuse, multiple platform assets, or platform breadth.

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
- For an identity-verified asset, use Unknown (never N/A) when country, development stage, modality, main indication, target, or another factual field cannot be established from public sources.
${SHARED_CANONICAL_THEME_RULE}
- json_summary.company_country and structured_table.company_country must use a single canonical country/region label based on the assessed company's primary legal domicile/headquarters. Examples: China, Republic of Korea, United States, Japan, Europe/UK. For example, "China / United States operations" -> China. Do not write combined labels in these fields; put secondary offices and operating-region nuance in headquarters, company_profile.notes, or validation.uncertain_points.
${SHARED_CANONICAL_INDICATION_RULE}
- structured_table.development_stage must follow the Canonical Development Stage rule above. Put exact raw wording, trial status, indication-specific stage, and future milestone timing in source evidence, notes, or validation.uncertain_points.
- Map clinical synonyms conservatively: P1/Ph1/Phase I/FIH -> Phase 1 and P2/Ph2/Phase II -> Phase 2 only when the phase is current or started. A future plan must not be promoted to current stage.
${SHARED_CANONICAL_MODALITY_RULE}
- Map synonymous or narrower terms into the same bucket. Examples: partial-onset seizure, focal-onset seizure, epilepsy, and status epilepticus -> Epilepsy / seizure disorders; RCC, UCC, refractory chronic cough, and unexplained chronic cough -> Chronic cough; Crohn's disease and ulcerative colitis -> Inflammatory bowel disease.

Use this exact report structure inside the Markdown portion of the single combined code block:

# [Company] Pipeline Scout Report: **[Asset]**

 Briefly state that this report was researched and scored with GPT instruction 2 — Full Scout v3.4 (schema v3.2), and that URLs are included for auditability.

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
- Protein Homeostasis
- Others (identity-verified asset confirmed outside E/I Balance, Neuroimmune, and Protein Homeostasis)
- Unknown (target or MoA evidence insufficient to map)

Allowed clusters:
- E/I Balance: Ion Channel, Inhibitory Tone 강화, Synaptic Transmission, Chloride Homeostasis, Network Modulation
- Neuroimmune: CNS 손상 면역반응, 교세포 향상성, Cytokine 신경조절, 손상/질환 면역조절, 말초 면역기관 연결
- Protein Homeostasis: Unknown (no approved sub-cluster taxonomy yet)

---

## 3) Scorecard Summary

| Criterion | Score (maximum 3 points each) | One-line judgment | Evidence used |
|---|---:|---|---|
| Target Relevance | [single score]점 |  | URL/source |
| Competitive Landscape | [single score]점 |  | URL/source |
| MoA Validity | [single score]점 |  | URL/source |
| Platform Attractiveness | [single score]점 |  | URL/source |
| Expansion Potential | [single score]점 |  | URL/source |
| Data Maturity | [single score]점 |  | URL/source |
| Marketability | [single score]점 | State method, score basis, and assessed global peak sales | URL/source |
| **Total** | **[total]점** | Maximum total: 21점 |  |

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
- Is the underlying technical system reusable across candidates, programs, or conditions?

Evidence trail:
- Cite platform page, paper, patent, data page, or company technical material.

Investigation note:
- 2점 이상이면 the data supporting differentiation must be explicit.

Platform vs Data Maturity separation:
- Platform Attractiveness evaluates platform-level technical advantage and may use evidence from other assets officially linked to the same platform.
- Data Maturity evaluates only the assessed asset's stage-appropriate development evidence.
- A 2-point Platform score requires at least one quantitative experimental result directly testing the claimed technical advantage against an appropriate comparator.
- A 3-point Platform score requires the 2-point evidence plus repeated quantitative advantage across multiple conditions/assets, or First Patient Dosed for an officially linked platform asset.
- First Patient Dosed alone is insufficient without the 2-point quantitative technical evidence.
- IND clearance, trial registration, financing, patent, MOU, or partnership announcement alone is insufficient for 3 points.
- The same endpoint must not be double-counted in Platform Attractiveness and Data Maturity.

### 4.5 Expansion Potential
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

End the Markdown portion after References. The next line in this template is the sole separator; after it, write the raw JSON object with no inner JSON fence. Fill it with the same facts, scores, reasons, source URLs, competitor evidence, and Marketability assumptions used in the Markdown report. The user will copy this one combined block and paste it once into the dashboard, which will automatically split the Markdown and JSON portions. Do not add any prose outside the single block.

--- JSON DATA ---

{
  "meta": {
    "schema_version": "3.2",
    "instruction_version": "3.4",
    "review_type": "full_scout",
    "generated_at": "YYYY-MM-DD",
    "language": "ko",
    "analyst_role": "[OIT] PreC Pipeline Shortlister",
    "output_format": ["markdown_report", "json"],
    "output_filename_base": "Company_Asset_YYYYMMDD",
    "rubric_version": "3.4",
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
    "parser_note": "GPT instruction 2 Full Scout v3.4 output using schema v3.2; Markdown report and JSON were generated together from the same evidence set."
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
- Keep the Markdown version statement at instruction/rubric 3.3. The dashboard deterministically adds JSON schema 3.2 and instruction/rubric 3.3.
- Internally verify that the seven integer criterion scores sum correctly; the dashboard derives total_score and max_score.
- Apply PASS >= 14 plus TR >= 3, MoA >= 2, Data >= 2, verified identity, confirmed active program, and no hard blocker/decision-critical uncertainty; apply identity and lifecycle FAIL rules.
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

async function copyPromptToClipboard(kind = 'full') {
  const basePrompt = kind === 'triage' ? buildTriageInstructionPrompt() : buildGptInstructionPrompt();
  const warningsStore = await fetchInstructionWarnings();
  const prompt = appendInstructionWarnings(basePrompt, kind === 'triage' ? warningsStore.triage : warningsStore.full);
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
  const idleTooltip = kind === 'triage' ? TRIAGE_PROMPT_TOOLTIP : `GPT Full Scout v${LATEST_FULL_SCOUT_RUBRIC_VERSION} 지침을 복사합니다. Triage에서 SELECT된 asset을 심층 검토할 때 사용합니다.`;
  if (label) {
    label.textContent = '복사됨';
  }
  button.dataset.tooltip = kind === 'triage'
    ? `GPT Fast Triage v${LATEST_TRIAGE_RUBRIC_VERSION} 지침을 복사했습니다.`
    : `GPT Full Scout v${LATEST_FULL_SCOUT_RUBRIC_VERSION} 지침을 복사했습니다.`;

  window.clearTimeout(promptCopyFeedbackTimer);
  promptCopyFeedbackTimer = window.setTimeout(() => {
    if (label) {
      label.textContent = idleLabel;
    }
    button.dataset.tooltip = idleTooltip;
  }, 1800);
}

// --- Step 0 진척 현황 (independent panel, not a real tableMode) ---

const STEP0_GUIDE_STEPS = [
  {
    title: '표의 각 칸에 Listing 정보를 입력',
    body: 'Company와 Asset은 필수입니다. Country · Modality · Target · Main indication · Stage · Comment · Contact는 선택 입력이며, 아래 표의 첫 칸에서 Excel 열을 그대로 붙여넣을 수 있습니다. Contact는 O·날짜·연락 메모를 입력하면 체크되며, X·-·빈칸은 연락 이력 없음으로 표시됩니다.',
    example: 'AddPharma\tKR\tAD-302\tSmall molecule\tTarget X\tALS\tPreclinical\tBD 검토 필요\t8/20 담당자 연락'
  },
  {
    title: 'Excel처럼 여러 행·열을 한 번에 붙여넣기',
    body: '행과 열의 순서가 Company · Country · Asset · Modality · Target · Main indication · Stage · Comment · Contact와 같으면 각 셀로 바로 나뉩니다. 필요한 행은 + 행 추가로 더 만들 수 있습니다.'
  },
  {
    title: '가져오기',
    body: '새 후보를 Listing에 추가합니다. Tab 0의 보조 정보는 Listing 관리용이며, Fast Triage·Full Scout의 공식 조사 값이나 점수를 변경하지 않습니다.'
  },
  {
    title: 'Listing 항목 선택 후 지침 복사',
    body: 'Listing 중인 파이프라인을 여러 개 선택한 뒤 {{copy}}를 누르세요. 선택한 후보 목록과 입력된 Modality·Target 등의 보조 정보가 Fast Triage 지침 1에 함께 포함됩니다.',
    actions: [
      { token: 'copy', kind: 'copy-instructions', icon: 'clipboard', label: 'GPT 지침 복사' }
    ]
  }
];

const STEP0_GUIDE_STEP_ICONS = ['file-text', 'clipboard', 'save', 'clipboard'];

function step0GuideBodyMarkup(step) {
  let markup = escapeHtml(step.body || '');
  (Array.isArray(step.actions) ? step.actions : []).forEach((action) => {
    const token = `{{${action.token}}}`;
    const title = action.kind === 'copy-instructions'
      ? '선택한 Listing 항목을 포함해 GPT Fast Triage 지침 1을 복사합니다.'
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

function renderStep0Guide() {
  if (!elements.step0GuideSteps) return;
  elements.step0GuideSteps.innerHTML = STEP0_GUIDE_STEPS.map((step, index) => `
    <li>
      <span class="data-upload-step-icon" aria-hidden="true">${dataUploadIconMarkup(STEP0_GUIDE_STEP_ICONS[index] || 'file-text')}</span>
      <div class="data-upload-step-copy">
        <strong>${escapeHtml(step.title)}</strong>
        <p>${step0GuideBodyMarkup(step)}</p>
        ${step.example ? `<pre><span>${dataUploadIconMarkup('code')}입력 형식 예시</span>${escapeHtml(step.example)}</pre>` : ''}
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
  if (elements.pipelineContent) elements.pipelineContent.style.display = show ? 'none' : '';
  if (elements.step0Panel) {
    elements.step0Panel.hidden = !show;
    elements.step0Panel.style.display = show ? '' : 'none';
  }
}

function updateStep0HeaderCount() {
  updateHeaderRecordCount();
}

function activateStep0Panel() {
  elements.pipelineTableTabs?.forEach((tab) => {
    const isActive = tab.dataset.tableMode === 'step0';
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
  });
  showStep0Panel(true);
  renderStep0Guide();
  updateStep0HeaderCount();
  loadStep0Progress();
}

function deactivateStep0Panel() {
  showStep0Panel(false);
  renderTableTabs();
}

function renderStep0ImportSummary(result) {
  if (!elements.step0ImportSummary || !result) return;
  const unparsedCount = result.unparsed_lines?.length || 0;
  elements.step0ImportSummary.hidden = false;
  const badgeClass = unparsedCount ? 'warning' : '';
  const badgeText = unparsedCount ? '일부 제외' : '가져오기 완료';
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
    }] : [])
  ];
  elements.step0ImportSummary.innerHTML = `
    <div class="input-validation-summary">
      <span class="input-validation-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      <strong>후보 목록 업로드</strong>
      <span>${result.parsed}줄 파싱 · 신규 ${result.added} · 제외 ${result.already_researched_skipped} · 중복 ${result.duplicate_in_queue_skipped}</span>
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

const STEP0_ENTRY_FIELDS = [
  { key: 'company_input', label: 'Company', required: true },
  { key: 'country', label: 'Country' },
  { key: 'asset_input', label: 'Asset', required: true },
  { key: 'modality', label: 'Modality' },
  { key: 'target', label: 'Target' },
  { key: 'main_indication', label: 'Main indication' },
  { key: 'stage', label: 'Stage' },
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
  `).join('')}<td class="step0-entry-remove-cell"><button type="button" data-step0-remove-entry-row aria-label="행 삭제" title="행 삭제">×</button></td></tr>`;
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
  const incomplete = [];
  elements.step0EntryGridBody?.querySelectorAll('tr').forEach((tr, index) => {
    const row = {};
    tr.querySelectorAll('[data-step0-entry-field]').forEach((input) => {
      row[input.dataset.step0EntryField] = input.value.trim();
    });
    if (!Object.values(row).some(Boolean)) return;
    if (!row.company_input || !row.asset_input) {
      incomplete.push(index + 1);
      return;
    }
    rows.push(row);
  });
  return { rows, incomplete };
}

const STEP0_HEADER_ALIASES = {
  company_input: ['company', 'company name', '회사', '회사명', '기업'],
  country: ['country', '국가'],
  asset_input: ['asset', 'asset name', 'pipeline', 'pipeline name', '자산', '파이프라인', '약물명'],
  modality: ['modality', 'modality platform', '모달리티'],
  target: ['target', '타깃', '표적'],
  main_indication: ['main indication', 'indication', '주요 적응증', '적응증'],
  stage: ['stage', 'development stage', '개발 단계', '진행 단계'],
  comment: ['comment', 'comments', 'priority', 'reason for priority', 'priority reason', 'next step', '코멘트', '비고', '의견'],
  contact: ['contact', 'meeting history', 'history', '담당자', '연락처', '미팅 이력', '연락 이력'],
  website: ['website', 'website url', 'company website', 'official website', 'homepage', 'home page', 'url', '웹사이트', '홈페이지']
};

// A spreadsheet can legitimately carry more than one note/contact context column.
// These fields concatenate per row; factual identity fields remain one-to-one.
const STEP0_MULTI_VALUE_HEADER_FIELDS = new Set(['comment', 'contact']);

const STEP0_HEADER_KEYWORD_RULES = {
  company_input: [
    ['company name', 12], ['company', 5], ['organization', 8], ['organisation', 8], ['corporate', 6], ['sponsor', 6], ['developer', 5], ['manufacturer', 5], ['회사명', 12], ['회사', 5], ['기업', 7]
  ],
  country: [
    ['company geography', 14], ['geography', 11], ['geographic', 11], ['country', 10], ['location', 8], ['region', 7], ['headquarters', 8], ['headquarter', 8], ['hq', 7], ['nation', 8], ['국가', 10], ['지역', 7], ['소재지', 9], ['본사', 8]
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
    recognized: targets.filter(Boolean).length,
    ignored: matches.filter((match, index) => !targets[index] && String(cells[index] || '').trim()).length,
    duplicateCount: matches.filter((match, index) => match.field && !targets[index]).length
  };
}

function step0HeaderField(value) {
  return step0HeaderMatch(value).field;
}

function showStep0PasteFeedback(message, tone = 'info') {
  if (!elements.step0PasteFeedback) return;
  elements.step0PasteFeedback.hidden = !message;
  elements.step0PasteFeedback.dataset.tone = tone;
  elements.step0PasteFeedback.textContent = message || '';
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

function pasteIntoStep0EntryGrid(event) {
  const input = event.target.closest('[data-step0-entry-field]');
  const clipboardText = event.clipboardData?.getData('text/plain') || '';
  if (!input || !clipboardText || (!clipboardText.includes('\t') && !clipboardText.includes('\n'))) return;
  event.preventDefault();
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
  const availableColumns = firstRowIsHeader ? headerMapping.targets.length : STEP0_ENTRY_FIELDS.length - startColumn;
  const overflowingRow = dataMatrix.find((cells) => cells.length > availableColumns && cells.slice(availableColumns).some((value) => String(value).trim()));
  if (overflowingRow) {
    showStep0PasteFeedback(`붙여넣기 범위가 ${availableColumns}개 입력 열을 넘습니다. 초과 값이 사라지는 것을 막기 위해 붙여넣지 않았습니다.`, 'error');
    return;
  }
  while (elements.step0EntryGridBody.querySelectorAll('tr').length < startRow + dataMatrix.length) appendStep0EntryRows();
  const tableRows = [...elements.step0EntryGridBody.querySelectorAll('tr')];
  dataMatrix.forEach((cells, rowOffset) => {
    const inputs = [...tableRows[startRow + rowOffset].querySelectorAll('[data-step0-entry-field]')];
    const assignedFields = new Set();
    cells.forEach((value, columnOffset) => {
      const field = firstRowIsHeader ? headerMapping.targets[columnOffset] : STEP0_ENTRY_FIELDS[startColumn + columnOffset]?.key;
      const target = field ? inputs[STEP0_ENTRY_FIELDS.findIndex((candidate) => candidate.key === field)] : null;
      if (!target) return;
      const incoming = value.trim();
      if (STEP0_MULTI_VALUE_HEADER_FIELDS.has(field) && assignedFields.has(field) && incoming) {
        const current = target.value.trim();
        const existingLines = current.split('\n').map((line) => line.trim()).filter(Boolean);
        target.value = existingLines.includes(incoming) ? current : [current, incoming].filter(Boolean).join('\n');
      } else {
        target.value = incoming;
      }
      assignedFields.add(field);
    });
  });
  elements.step0EntryGridBody.querySelectorAll('textarea[data-step0-entry-field]').forEach(resizeStep0CommentCell);
  const labels = firstRowIsHeader
    ? [...new Set(headerMapping.targets.filter(Boolean))].map((key) => STEP0_ENTRY_FIELDS.find((field) => field.key === key)?.label).filter(Boolean).join(' · ')
    : STEP0_ENTRY_FIELDS.slice(startColumn, Math.min(STEP0_ENTRY_FIELDS.length, startColumn + Math.max(...dataMatrix.map((cells) => cells.length)))).map((field) => field.label).join(' · ');
  const blankRows = dataMatrix.filter((cells) => cells.every((value) => value === '')).length;
  const headerNote = firstRowIsHeader
    ? ` 열 제목 행을 ${headerMapping.recognized}개 열로 매핑했습니다.${headerMapping.ignored ? ` 인식하지 못했거나 중복된 header ${headerMapping.ignored}개는 건너뛰었습니다.` : ''}`
    : '';
  showStep0PasteFeedback(`${dataMatrix.length}행 × ${Math.max(...dataMatrix.map((cells) => cells.length))}열을 ${labels}에 입력했습니다.${headerNote}${blankRows ? ` 빈 행 ${blankRows}개도 유지했습니다.` : ''}`, headerMapping.ignored ? 'warning' : 'success');
}

async function importStep0Candidates() {
  const { rows, incomplete } = collectStep0EntryRows();
  if (incomplete.length) {
    showStep0Message(`${incomplete.join(', ')}행에는 Company와 Asset이 모두 필요합니다.`, 'warning');
    return;
  }
  if (!rows.length) {
    showStep0Message('입력된 Listing 항목이 없습니다.', 'warning');
    return;
  }
  if (elements.step0ImportButton) elements.step0ImportButton.disabled = true;
  setStep0SaveStatus('validating');
  try {
    const result = await runBlockingOperation({
      title: '후보 목록을 가져오고 있습니다',
      message: '붙여 넣은 후보 목록과 내부 Comment/Contact 정보를 확인해 Listing에 반영하고 있습니다.',
      status: '처리 중에는 다른 화면으로 이동할 수 없습니다.'
    }, async (signal) => {
      const response = await fetch('/api/candidate-queue/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
        signal
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    });
    if (result === OPERATION_CANCELLED) {
      setStep0SaveStatus('waiting');
      return;
    }
    renderStep0ImportSummary(result);
    renderStep0EntryGrid();
    showStep0PasteFeedback('');
    setStep0SaveStatus('saved');
    await loadStep0Progress();
  } catch (error) {
    showStep0Message(`가져오기 실패: ${error.message}`, 'error');
    setStep0SaveStatus('error');
  } finally {
    if (elements.step0ImportButton) elements.step0ImportButton.disabled = false;
  }
}

async function loadStep0Progress() {
  try {
    const response = await fetch('/api/candidate-queue/progress');
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    state.step0Rows = Array.isArray(data.rows) ? data.rows : [];
    state.step0Stats = data.stats || { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 };
    state.step0RecentStats = data.recent_15_days || { pending: 0, fast_triage: 0, full_scout: 0, shortlisted: 0 };
    const pendingIds = new Set(
      state.step0Rows.filter((row) => row.pending?.queue_id).map((row) => row.pending.queue_id)
    );
    [...state.step0SelectedPendingIds].forEach((id) => {
      if (!pendingIds.has(id)) state.step0SelectedPendingIds.delete(id);
    });
    state.step0Loaded = true;
    updateStep0HeaderCount();
    renderStep0StatStrip();
    renderStep0ProgressTable();
    renderStep0SelectedCount();
  } catch (error) {
    if (elements.step0ProgressTableBody) {
      elements.step0ProgressTableBody.innerHTML =
        `<tr><td colspan="14" class="step0-empty-state">진척 현황을 불러오지 못했습니다: ${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

function renderStep0StatStrip() {
  if (elements.step0StatPending) elements.step0StatPending.textContent = String(state.step0Stats.pending ?? 0);
  if (elements.step0StatFastTriage) elements.step0StatFastTriage.textContent = String(state.step0Stats.fast_triage ?? 0);
  if (elements.step0StatFullScout) elements.step0StatFullScout.textContent = String(state.step0Stats.full_scout ?? 0);
  if (elements.step0StatShortlisted) elements.step0StatShortlisted.textContent = String(state.step0Stats.shortlisted ?? 0);
  const recent = state.step0RecentStats || {};
  const recentBadges = [
    ['pending', elements.step0RecentPending],
    ['fast_triage', elements.step0RecentFastTriage],
    ['full_scout', elements.step0RecentFullScout],
    ['shortlisted', elements.step0RecentShortlisted]
  ];
  recentBadges.forEach(([key, badge]) => {
    if (!badge) return;
    const count = Number(recent[key] || 0);
    badge.hidden = count <= 0;
    badge.textContent = `▲ +${count}`;
    badge.setAttribute('aria-label', `최근 15일 신규 업로드 ${count}건`);
  });
}

const STEP0_STAGE_LABELS = {
  pending: 'Listing',
  fast_triage: 'Fast Triage',
  full_scout: 'Full Scout',
  shortlisting: 'Shortlisting'
};

function step0StageCellHtml(stage, cell) {
  const done = Boolean(cell?.done);
  const tone = done ? 'pass' : 'empty';
  const stageLabel = STEP0_STAGE_LABELS[stage] || stage;
  const label = done ? '<span aria-hidden="true">✓</span>' : '-';
  const title = done ? ` title="${escapeHtml(`${stageLabel} 완료 · 상세 보기`)}"` : '';
  if (stage === 'pending' || !done || !cell?.record_id) {
    return `<span class="pill ${tone}"${title}>${label}</span>`;
  }
  const mode = stage === 'fast_triage' ? 'triage' : stage === 'full_scout' ? 'full' : 'focus';
  const href = recordDetailHref({ id: cell.record_id, isTriage: stage === 'fast_triage' }, mode);
  return `<a class="pill ${tone}" href="${escapeHtml(href)}"${title}>${label}</a>`;
}

function step0CommentFeed(row) {
  const entries = Array.isArray(row?.comment_feed) ? row.comment_feed : [];
  if (entries.length) return entries.filter((entry) => entry && String(entry.body || '').trim());
  const fallback = String(row?.metadata?.comment || '').trim();
  return fallback ? [{ source: 'Tab 0 Team Review · Listing Comment', author: 'Tab 0 Team Review', created_at: '', body: fallback }] : [];
}

function step0MetadataCellHtml(row, field) {
  const value = String(row.metadata?.[field] || '').trim();
  const commentFeed = field === 'comment' ? step0CommentFeed(row) : [];
  const owner = row.metadata_owner || {};
  const label = field === 'comment' ? 'Comment' : 'Contact';
  const hasContactHistory = field !== 'contact' || !/^(?:x|[-–—]+)$/i.test(value);
  const hasValue = field === 'comment' ? commentFeed.length > 0 : Boolean(value) && hasContactHistory;
  if (!owner.type) return '<span class="pill empty step0-metadata-empty">-</span>';
  if (field === 'contact' && !hasValue) {
    return '<span class="pill empty step0-metadata-empty" aria-label="Contact history not recorded">-</span>';
  }
  const ownerId = owner.type === 'queue' ? owner.queue_id : owner.record_id;
  const title = hasValue ? `${label} 확인 · 두 번 클릭하여 수정` : `${label} 없음 · 두 번 클릭하여 입력`;
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
  const raw = String(row?.listing_details?.website || row?.metadata?.website || '').trim();
  const queueId = String(row?.pending?.queue_id || '');
  const researchMode = step0ResearchEditMode(row);
  const admin = Boolean(getCurrentUser()?.is_admin);
  if (!/^https?:\/\//i.test(raw)) return '<span class="pill empty step0-website-empty" aria-label="Website not recorded">-</span>';
  let safeUrl = '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeUrl = parsed.href;
  } catch (_) {
    safeUrl = '';
  }
  if (!safeUrl) return '<span class="pill empty step0-website-empty" aria-label="Website not recorded">-</span>';
  const editAttributes = queueId && admin && !researchMode
    ? ` data-step0-listing-edit data-queue-id="${escapeHtml(queueId)}" data-step0-field="website" data-previous-value="${escapeHtml(raw)}"`
    : researchMode
      ? ` data-step0-metadata data-step0-metadata-field="website" data-step0-row-identity="${escapeHtml(row.identity || '')}"`
      : '';
  return `<a class="pill pass step0-website-link"${editAttributes} href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" title="Website · 한 번 클릭하여 열기, 두 번 클릭하여 주소 수정" aria-label="Open website in a new tab">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14 14 10M8.5 7.5H7a3 3 0 0 0-3 3V17a3 3 0 0 0 3 3h6.5a3 3 0 0 0 3-3v-1.5M13 4h7v7M20 4l-9 9" /></svg>
  </a>`;
}

function step0DashboardFieldDisplay(row) {
  const details = row?.listing_details || {};
  const rawCountry = String(details.country || '').trim();
  const rawModality = String(details.modality || '').trim();
  const rawIndication = String(details.main_indication || '').trim();
  const rawStage = String(details.stage || '').trim();
  const indicationList = rawIndication
    ? canonicalIndicationList([], rawIndication, '')
    : [];

  return {
    country: rawCountry ? canonicalCountry(rawCountry) : '-',
    countryRaw: rawCountry,
    modality: rawModality ? canonicalModality(rawModality) : '-',
    modalityRaw: rawModality,
    indication: rawIndication
      ? (indicationList.length ? indicationList.join(', ') : canonicalMainIndication('', rawIndication))
      : '-',
    indicationRaw: rawIndication,
    stage: rawStage ? canonicalDevelopmentStage(rawStage) : '-',
    stageRaw: rawStage
  };
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
}

function openStep0EditLockedModal(mode) {
  const targetMode = mode === 'full' ? 'full' : 'triage';
  const label = targetMode === 'full' ? 'Tab 2 · Full Scout' : 'Tab 1 · Fast Triage';
  activeStep0LockedEditMode = targetMode;
  if (elements.step0EditLockedTitle) elements.step0EditLockedTitle.textContent = `${label}에서 수정하세요`;
  if (elements.step0EditLockedMessage) {
    elements.step0EditLockedMessage.textContent = `이미 수행된 ${targetMode === 'full' ? 'Full Scout' : 'Fast Triage'}의 공식 조사값이 Tab 0에 표시되고 있습니다. 원본 조사값 수정은 ${label} Pipeline Table에서 진행합니다.`;
  }
  if (elements.step0EditLockedGo) elements.step0EditLockedGo.textContent = `${label}로 이동`;
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
  const desiredLeft = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
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

async function saveStep0Metadata(row, field, value, status) {
  const owner = row?.metadata_owner || {};
  const payload = {
    owner_type: owner.type,
    field,
    value: String(value || '').trim()
  };
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
  showStep0Message(`${savedLabel}를 저장했습니다.`, 'success');
}

function openStep0MetadataPopover(anchor, row, field, { editing = false } = {}) {
  closeStep0MetadataPopover();
  const owner = row?.metadata_owner || {};
  if (!owner.type) return;
  const label = field === 'comment' ? 'Comment' : field === 'contact' ? 'Contact' : 'Website';
  const value = step0MetadataValue(row, field);
  const commentFeed = field === 'comment' ? step0CommentFeed(row) : [];
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
      <footer><button type="button" class="is-primary" data-step0-metadata-edit>수정</button></footer>
    `;
  if (!editing && field === 'comment') {
    const commentCards = commentFeed.length
      ? commentFeed.map((entry) => {
        const source = escapeHtml(String(entry.source || 'Comment'));
        const author = escapeHtml(String(entry.author || ''));
        const createdAt = escapeHtml(String(entry.created_at || ''));
        const body = escapeHtml(String(entry.body || '')).replaceAll('\n', '<br>');
        const byline = [author, createdAt].filter(Boolean).join(' · ');
        return `<article class="step0-comment-feed-item"><small>${source}${byline ? ` · ${byline}` : ''}</small><p>${body}</p></article>`;
      }).join('')
      : '<p class="step0-metadata-value is-empty">No comments recorded.</p>';
    popover.innerHTML = `
      <header><strong>Comment</strong><button type="button" class="step0-metadata-close" aria-label="Close">×</button></header>
      <div class="step0-comment-feed">${commentCards}</div>
      <footer><button type="button" class="is-primary" data-step0-metadata-edit>Listing Comment edit</button></footer>
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
  const query = (state.step0Query || '').trim().toLowerCase();
  const searchTerms = [...state.step0SearchTokens, query]
    .map((term) => String(term || '').trim().toLowerCase())
    .filter(Boolean);
  const statusFilters = state.step0StatusFilterValues;

  let rows = state.step0Rows.filter((row) => {
    if (searchTerms.length) {
      const details = row.listing_details || {};
      const display = step0DashboardFieldDisplay(row);
      const commentFeed = (row.comment_feed || []).map((entry) => entry?.body || '').join(' ');
      const haystack = `${row.asset || ''} ${row.company || ''} ${details.country || ''} ${display.country} ${details.modality || ''} ${display.modality} ${details.target || ''} ${details.main_indication || ''} ${display.indication} ${details.stage || ''} ${display.stage} ${details.website || ''} ${row.metadata?.website || ''} ${row.metadata?.comment || ''} ${commentFeed} ${row.metadata?.contact || ''}`.toLowerCase();
      if (!searchTerms.some((term) => haystack.includes(term))) return false;
    }
    if (statusFilters.size && ![...statusFilters].some((status) => row[status]?.done)) return false;
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

function addStep0SearchToken() {
  const value = String(elements.step0SearchInput?.value || '').trim();
  if (!value) {
    elements.step0SearchInput?.focus();
    return;
  }
  const normalized = value.toLocaleLowerCase('ko');
  const exists = state.step0SearchTokens.some((token) => token.toLocaleLowerCase('ko') === normalized);
  if (!exists) state.step0SearchTokens.push(value);
  if (elements.step0SearchInput) elements.step0SearchInput.value = '';
  state.step0Query = '';
  renderStep0SearchTokens();
  renderStep0ProgressTable();
  elements.step0SearchInput?.focus();
}

function removeStep0SearchToken(token) {
  const normalized = String(token || '').toLocaleLowerCase('ko');
  state.step0SearchTokens = state.step0SearchTokens.filter((item) => item.toLocaleLowerCase('ko') !== normalized);
  renderStep0SearchTokens();
  renderStep0ProgressTable();
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
        const checked = isPending && state.step0SelectedPendingIds.has(queueId) ? 'checked' : '';
        const display = step0DashboardFieldDisplay(row);
        const checkboxCell = isPending
          ? `<input type="checkbox" class="step0-row-select" data-queue-id="${escapeHtml(queueId)}" ${checked} aria-label="${escapeHtml(row.asset)} 선택" />`
          : '';
        return `<tr>
          <td class="select-col">${checkboxCell}</td>
          <td class="step0-company-cell">${step0ListingFieldMarkup(row, 'company', row.company, { className: 'single-line-cell' })}</td>
          <td>${step0ListingFieldMarkup(row, 'country', display.countryRaw, { html: display.country === '-' ? '-' : countryDisplayMarkup(display.country), title: display.countryRaw && display.countryRaw !== display.country ? display.countryRaw : display.country })}</td>
          <td class="step0-asset-cell">${step0ListingFieldMarkup(row, 'asset', row.asset, { className: 'single-line-cell' })}</td>
          <td>${step0ListingFieldMarkup(row, 'modality', display.modalityRaw, { html: escapeHtml(display.modality), title: display.modalityRaw && display.modalityRaw !== display.modality ? display.modalityRaw : display.modality, className: 'single-line-cell' })}</td>
          <td class="step0-target-cell">${step0ListingFieldMarkup(row, 'target', row.listing_details?.target || '')}</td>
          <td>${step0ListingFieldMarkup(row, 'main_indication', display.indicationRaw, { html: escapeHtml(display.indication), title: display.indicationRaw && display.indicationRaw !== display.indication ? display.indicationRaw : display.indication })}</td>
          <td>${step0ListingFieldMarkup(row, 'stage', display.stageRaw, { html: escapeHtml(display.stage), title: display.stageRaw && display.stageRaw !== display.stage ? display.stageRaw : display.stage })}</td>
          <td>${step0StageCellHtml('pending', row.pending)}</td>
          <td>${step0StageCellHtml('fast_triage', row.fast_triage)}</td>
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
  if (elements.step0PrevPage) elements.step0PrevPage.disabled = state.step0Page <= 1;
  if (elements.step0NextPage) elements.step0NextPage.disabled = state.step0Page >= pageCount;
  updateStep0SelectAllState();
}

function exportStep0Table() {
  const rows = step0FilteredSortedRows();
  const headers = ['Company', 'Country', 'Asset', 'Modality', 'Target', 'Main indication', 'Stage', 'Listing', 'Fast Triage', 'Full Scout', 'Shortlisting', 'Comment', 'Contact', 'Website'];
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
    if (checkbox.dataset.queueId === queueId) checkbox.checked = selected;
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
  step0DragSelection = null;
  elements.step0ProgressTableBody?.classList.remove('is-selection-dragging');
}

function resetStep0Filters() {
  state.step0Query = '';
  state.step0SearchTokens = [];
  state.step0StatusFilterValues.clear();
  if (elements.step0SearchInput) elements.step0SearchInput.value = '';
  renderStep0SearchTokens();
  renderStep0StatusFilterControls();
  state.step0Page = 1;
  renderStep0ProgressTable();
}

function renderStep0StatusFilterControls() {
  const selected = state.step0StatusFilterValues;
  const syncButtons = (buttons, attribute) => buttons?.forEach((button) => {
    const isActive = selected.has(button.dataset[attribute]);
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  syncButtons(elements.step0StatusToggleButtons, 'step0Status');
  syncButtons(elements.step0StatFilterButtons, 'step0StatFilter');
}

function toggleStep0StatusFilter(status, button) {
  if (!status) return;
  if (state.step0StatusFilterValues.has(status)) {
    state.step0StatusFilterValues.delete(status);
  } else {
    state.step0StatusFilterValues.add(status);
  }
  state.step0Page = 1;
  renderStep0StatusFilterControls();
  renderStep0ProgressTable();
}

function buildTriageInstructionPromptWithCandidates(pairs) {
  const base = buildTriageInstructionPrompt();
  if (!Array.isArray(pairs) || !pairs.length) return base;
  const listLines = pairs.map((pair) => {
    const details = pair.listing_details || {};
    const context = [
      ['Country', details.country],
      ['Modality', details.modality],
      ['Target', details.target],
      ['Main indication', details.main_indication],
      ['Stage', details.stage],
      ['Website', details.website]
    ].filter(([, value]) => String(value || '').trim()).map(([label, value]) => `${label}: ${String(value).trim()}`).join('; ');
    return `${pair.asset}\t${pair.company}${context ? `\tListing context: ${context}` : ''}`;
  }).join('\n');
  return `${base}\n\nCandidates to triage now (Asset<TAB>Company<TAB>optional Listing context):\n${listLines}\n\nUse optional Listing context only to identify and retrieve the correct pipeline. Treat it as user-provided context, independently verify it, and do not treat it as rubric evidence unless confirmed by a source.`;
}

async function copyTriagePromptWithSelectedCandidates() {
  const pairs = state.step0Rows
    .filter((row) => row.pending?.queue_id && state.step0SelectedPendingIds.has(row.pending.queue_id))
    .map((row) => ({ asset: row.asset, company: row.company, listing_details: row.listing_details || {} }));
  const warningsStore = await fetchInstructionWarnings();
  const prompt = appendInstructionWarnings(buildTriageInstructionPromptWithCandidates(pairs), warningsStore.triage);
  try {
    await navigator.clipboard.writeText(prompt);
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
  }
  showStep0Message(
    pairs.length ? `${pairs.length}개 후보 포함 지침 1 복사 완료` : '선택된 후보 없이 지침 1을 복사했습니다.'
  );
  const label = elements.step0CopyInstructionsButton?.querySelector('b');
  if (label) {
    const idleLabel = label.textContent;
    label.textContent = '복사됨';
    window.setTimeout(() => { label.textContent = idleLabel; }, 1800);
  }
}

elements.step0ImportButton?.addEventListener('click', importStep0Candidates);
elements.step0ClearButton?.addEventListener('click', () => {
  renderStep0EntryGrid();
  showStep0PasteFeedback('');
  setStep0SaveStatus('waiting');
});
elements.step0AddEntryRow?.addEventListener('click', () => appendStep0EntryRows());
elements.step0EntryGridBody?.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-step0-remove-entry-row]');
  if (!removeButton) return;
  const row = removeButton.closest('tr');
  if (elements.step0EntryGridBody.querySelectorAll('tr').length <= 1) {
    row.querySelectorAll('input').forEach((input) => { input.value = ''; });
  } else {
    row.remove();
  }
});
elements.step0EntryGridBody?.addEventListener('paste', pasteIntoStep0EntryGrid);
elements.step0EntryGridBody?.addEventListener('input', (event) => {
  if (event.target.matches('textarea[data-step0-entry-field]')) resizeStep0CommentCell(event.target);
});
elements.step0CopyInstructionsButton?.addEventListener('click', copyTriagePromptWithSelectedCandidates);
elements.step0ExportExcelButton?.addEventListener('click', exportStep0Table);
elements.step0PageSizeSelect?.addEventListener('change', (event) => {
  const nextSize = Number(event.target.value);
  state.step0PageSize = STEP0_PAGE_SIZE_OPTIONS.includes(nextSize) ? nextSize : STEP0_DEFAULT_PAGE_SIZE;
  localStorage.setItem(STEP0_PAGE_SIZE_STORAGE_KEY, String(state.step0PageSize));
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
elements.step0SearchInput?.addEventListener('input', (event) => {
  state.step0Query = event.target.value;
  state.step0Page = 1;
  renderStep0ProgressTable();
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
elements.step0StatusToggleButtons?.forEach((button) => {
  button.addEventListener('click', () => toggleStep0StatusFilter(button.dataset.step0Status, button));
});
elements.step0StatFilterButtons?.forEach((button) => {
  button.addEventListener('click', () => toggleStep0StatusFilter(button.dataset.step0StatFilter, button));
});
elements.step0ResetFiltersButton?.addEventListener('click', resetStep0Filters);
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
  const queueId = checkbox.dataset.queueId;
  if (!queueId) return;
  const changed = setStep0PendingSelection(queueId, checkbox.checked);
  checkbox.checked = changed && state.step0SelectedPendingIds.has(queueId);
  renderStep0SelectedCount();
});
elements.step0ProgressTableBody?.addEventListener('click', (event) => {
  const indicator = event.target.closest('[data-step0-metadata]');
  if (indicator) {
    const field = indicator.dataset.step0MetadataField;
    const row = state.step0Rows.find((candidate) => candidate.identity === indicator.dataset.step0RowIdentity);
    if (!row || !field) return;
    event.preventDefault();
    openStep0MetadataPopover(indicator, row, field, { editing: field === 'comment' ? false : !step0MetadataValue(row, field) });
    return;
  }
  const locked = event.target.closest('[data-step0-research-locked]');
  if (locked) {
    event.preventDefault();
    openStep0EditLockedModal(locked.dataset.step0Mode);
  }
});
elements.step0ProgressTableBody?.addEventListener('dblclick', (event) => {
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
  closeStep0EditLockedModal();
  if (!mode) return;
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
  'totalScore'
]);

function sortByColumn(key) {
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
    'filter3',
    'inVivoStatus',
    'inVitroStatus',
    'admetCompleted',
    'focusDueDate',
    'focusAddedAt'
  ])
};

function normalizeSortForMode(mode) {
  if (!state.sortKey) return;
  if (SORT_KEYS_BY_MODE[mode]?.has(state.sortKey)) return;
  state.sortKey = mode === 'triage' ? 'targetScore' : mode === 'focus' ? 'focusAddedAt' : 'totalScore';
  state.sortDirection = 'desc';
}

const TABLE_FILTER_STATE_KEYS = ['query', 'stage', 'theme', 'cluster', 'modality', 'indication', 'country', 'pass'];

function captureModeFilters(mode = activeTableMode()) {
  state.filtersByMode[mode] = Object.fromEntries(
    TABLE_FILTER_STATE_KEYS.map((key) => [key, cloneFilterValue(state[key])])
  );
}

function restoreModeFilters(mode) {
  Object.assign(state, state.filtersByMode[mode] || {});
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

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('tab', nextMode);
  window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);

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

function handleMultiFilterControlsClick(event) {
  const trigger = event.target.closest('.filter-multiselect-trigger');
  if (trigger) {
    const filter = trigger.closest('.filter-multiselect');
    const willOpen = !filter.classList.contains('is-open');
    closeMultiFilters(filter);
    filter.classList.toggle('is-open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    const menu = filter.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = !willOpen;
    return;
  }

  const option = event.target.closest('.filter-multiselect-option');
  if (!option) return;
  const filter = option.closest('.filter-multiselect');
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
  if (!event.target.closest('.filter-multiselect')) closeMultiFilters();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeMultiFilters();
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
window.addEventListener('resize', () => {
  hideTargetContextTooltip();
  applyColumnWidths();
});

let dashboardWebsiteOpenTimer = null;

elements.pipelineTable.addEventListener('click', (event) => {
  const pipelineWebsite = event.target.closest('[data-pipeline-website]');
  if (pipelineWebsite) {
    const url = String(pipelineWebsite.dataset.websiteUrl || '');
    if (!url) return;
    if (dashboardWebsiteOpenTimer) window.clearTimeout(dashboardWebsiteOpenTimer);
    dashboardWebsiteOpenTimer = window.setTimeout(() => {
      dashboardWebsiteOpenTimer = null;
      window.open(url, '_blank', 'noopener,noreferrer');
    }, 220);
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
  const focusAction = event.target.closest('[data-focus-action]');
  if (focusAction) {
    saveFocusManagement(
      focusAction.dataset.recordId,
      { action: focusAction.dataset.focusAction },
      focusAction
    );
    return;
  }
  if (event.target.closest('[data-table-text-edit], [data-table-modality-edit]')) return;
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

elements.pipelineTable.addEventListener('dblclick', (event) => {
  const pipelineWebsite = event.target.closest('[data-pipeline-website]');
  if (!pipelineWebsite || !getCurrentUser()?.is_admin) return;
  event.preventDefault();
  if (dashboardWebsiteOpenTimer) window.clearTimeout(dashboardWebsiteOpenTimer);
  dashboardWebsiteOpenTimer = null;
  const recordId = String(pipelineWebsite.dataset.recordId || '');
  const row = state.rows.find((candidate) => candidate.id === recordId);
  if (!row) return;
  openStep0MetadataPopover(pipelineWebsite, {
    asset: row.asset,
    metadata: get(row.raw, 'meta.pipeline_metadata', {}),
    metadata_owner: { type: 'record', record_id: row.id }
  }, 'website', { editing: true });
});

elements.pipelineTable.addEventListener('dblclick', (event) => {
  const textEdit = event.target.closest('[data-table-text-edit]');
  if (textEdit) {
    event.preventDefault();
    event.stopPropagation();
    openManualTableTextEdit(textEdit);
    return;
  }
  const modalityEdit = event.target.closest('[data-table-modality-edit]');
  if (modalityEdit) {
    event.preventDefault();
    event.stopPropagation();
    openManualTableModalityEdit(modalityEdit);
  }
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
  renderFilteredDashboard();
});

elements.refreshButton.addEventListener('click', () => {
  runBlockingOperation({
    title: '대시보드를 새로고침하고 있습니다',
    message: '최신 파이프라인과 요약 정보를 불러오고 있습니다.',
    status: '불러오기가 끝날 때까지 잠시만 기다려 주세요.'
  }, (signal) => loadRecords({ signal })).then((result) => {
    if (result === OPERATION_CANCELLED) elements.dataStatus.textContent = '새로고침 취소 요청됨';
  }).catch((error) => {
    elements.dataStatus.textContent = 'Load failed';
    elements.saveStatus.textContent = error.message;
  });
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

applyVisualDashboardHidden(localStorage.getItem(VISUAL_DASHBOARD_HIDDEN_KEY) === 'true');

elements.visualDashboardToggleButton?.addEventListener('click', () => {
  const hidden = !elements.visualGrid?.classList.contains('is-collapsed');
  applyVisualDashboardHidden(hidden);
  localStorage.setItem(VISUAL_DASHBOARD_HIDDEN_KEY, String(hidden));
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
  state.modality = [];
  state.theme = [];
  state.cluster = [];
  state.country = [];
  state.indication = [];
  state.stage = [];
  state.pass = [];
  state.page = 1;
  elements.searchInput.value = '';
  captureModeFilters();
  renderFilters();
  renderFilteredDashboard();
});

function activatePipelineTab(mode) {
  if (mode === 'step0') {
    activateStep0Panel();
    return;
  }
  if (elements.step0Panel && !elements.step0Panel.hidden) deactivateStep0Panel();
  setTableMode(mode);
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
  } else if (button.dataset.reuploadAction === 'skip') {
    const current = dataReuploadDecisionFor(decisionKey);
    activeDataReuploadDecisions.set(decisionKey, {
      action: current.action === 'skip' ? 'pending' : 'skip'
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

elements.operationCancelButton?.addEventListener('click', () => {
  const operation = activeBlockingOperation;
  if (!operation) return;
  if (elements.operationModalStatus) {
    elements.operationModalStatus.textContent = '실행 취소를 요청했습니다. 서버 저장이 이미 시작된 경우에는 결과가 반영될 수 있습니다.';
  }
  if (elements.operationCancelButton) elements.operationCancelButton.disabled = true;
  operation.controller.abort();
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
  if (activeTableMode() === 'triage') return;
  const question = elements.agentInput.value.trim();
  if (!question) return;
  elements.agentInput.value = '';
  retitleActiveSessionFromQuestion(question);
  addAgentMessage('user', question);
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

  const fromLabel = currentMode === 'triage' ? 'TAB1 Fast Triage' : 'TAB2 Full Scout';
  const toLabel = detectedMode === 'triage' ? 'TAB1 Fast Triage' : 'TAB2 Full Scout';
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
elements.dataUploadGuideSteps?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-upload-guide-action]');
  if (!button) return;
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
  const kind = button.dataset.promptKind === 'triage' ? 'triage' : 'full';
  const label = button.querySelector('b');
  const idleLabel = kind === 'triage' ? '지침 1' : '지침 2';
  button.disabled = true;
  await copyPromptToClipboard(kind);
  button.classList.add('is-copied');
  if (label) label.textContent = '복사됨';
  window.setTimeout(() => {
    button.disabled = false;
    button.classList.remove('is-copied');
    if (label) label.textContent = idleLabel;
  }, 1800);
});

document.querySelectorAll('.controls').forEach((controls) => {
  controls.addEventListener('click', handleMultiFilterControlsClick);
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
if (elements.copyTriagePromptTopButton) {
  elements.copyTriagePromptTopButton.dataset.tooltip = TRIAGE_PROMPT_TOOLTIP;
}
if (elements.copyPromptTopButton) {
  const label = elements.copyPromptTopButton.querySelector('b');
  if (label) label.textContent = '지침 2';
  elements.copyPromptTopButton.dataset.tooltip = PROMPT_TOOLTIP;
}
elements.copyPromptButton?.addEventListener('click', () => copyPromptToClipboard('full'));
elements.copyTriagePromptTopButton?.addEventListener('click', () => copyPromptToClipboard('triage'));
elements.copyPromptTopButton?.addEventListener('click', () => copyPromptToClipboard('full'));

floatingAgentController = initFloatingAgent({
  launcher: elements.aiDrawerButton,
  panel: elements.aiDrawer,
  closeButton: elements.aiDrawerClose,
  minimizeButton: elements.aiDrawer.querySelector('[data-floating-agent-minimize]'),
  maximizeButton: elements.aiDrawer.querySelector('[data-floating-agent-maximize]'),
  dragHandle: elements.aiDrawer.querySelector('[data-floating-agent-drag]'),
  resizeHandle: elements.aiDrawer.querySelector('[data-floating-agent-resize]'),
  storageKey: 'skbp.dashboard.floatingAgentGeometry.v1',
  initialWidth: 560,
  initialHeight: 680,
  focusTarget: elements.agentInput
});
renderAgentIdentity();
setupThemeToggle();
initAuthUI();
initializeAgentSessions();
renderStep0EntryGrid();

loadRecords().catch((error) => {
  elements.dataStatus.textContent = 'Load failed';
  elements.saveStatus.textContent = error.message;
});
