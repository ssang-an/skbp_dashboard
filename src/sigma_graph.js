const TYPE_COLOR = {
  asset: '#6366f1', review: '#14b8a6', company: '#60a5fa', target: '#f59e0b',
  moa: '#f472b6', modality: '#a78bfa', indication: '#22d3ee', theme: '#4ade80',
  cluster: '#a3e635', competitor: '#fb7185', source: '#94a3b8', scorecard: '#c084fc', workflow: '#94a3b8',
};
const STAGE_COLOR = { listing: '#94a3b8', fast_triage: '#38bdf8', full_scout: '#8b5cf6', shortlisting: '#f59e0b' };
const DARK_TYPE_COLOR = {
  asset: '#93a4bb', review: '#58c7bb', company: '#7eaeff', target: '#f0b96a',
  moa: '#e88abb', modality: '#b29aff', indication: '#5bc9df', theme: '#70d39a',
  cluster: '#afcf76', competitor: '#ea909e', source: '#9aa8b9', scorecard: '#c29af3', workflow: '#9aa8b9',
};
const DARK_STAGE_COLOR = { listing: '#9aaabd', fast_triage: '#63bfe5', full_scout: '#a78bfa', shortlisting: '#efb45a' };
const STAGE_LABEL = { listing: 'Listing', fast_triage: 'Simple', full_scout: 'Advanced', shortlisting: 'Custom' };
const TYPE_LEGEND_LABEL = {
  review: '조사 기록', company: 'company', target: 'target', moa: 'MoA', modality: 'modality'
};
const TYPE_FILTER_LABEL = {
  asset: 'Asset', review: '조사 기록', company: 'Company', target: 'Target', moa: 'MoA', modality: 'Modality',
  indication: 'Main indication', theme: 'Theme', cluster: 'Cluster', competitor: 'Competitor', source: 'Source', scorecard: 'Scorecard', workflow: '조사 진행 단계'
};
const STAGE_LEGEND_TOOLTIP = {
  listing: 'Tab 0에 등록된 후보입니다. 클릭하면 Listing Asset을 그래프에서만 숨기거나 다시 표시합니다.',
  fast_triage: 'Simple Research 1차 조사가 완료된 후보입니다. 클릭하면 해당 Asset을 그래프에서만 숨기거나 다시 표시합니다.',
  full_scout: 'Advanced Research 심층 조사가 완료된 후보입니다. 클릭하면 해당 Asset을 그래프에서만 숨기거나 다시 표시합니다.',
  shortlisting: '우선 검토 대상으로 관리 중인 후보입니다. 클릭하면 해당 Asset을 그래프에서만 숨기거나 다시 표시합니다.'
};
const TYPE_LEGEND_TOOLTIP = {
  review: 'Simple Research 또는 Advanced Research가 수행된 개별 조사 기록입니다. 클릭하면 조사 기록 노드를 그래프에서만 숨기거나 다시 표시합니다.',
  company: 'Pipeline을 개발·보유하거나 권리를 가진 회사입니다. 클릭하면 회사 노드를 그래프에서만 숨기거나 다시 표시합니다.',
  target: 'Pipeline이 직접 겨냥하는 생물학적 표적입니다. 클릭하면 Target 노드를 그래프에서만 숨기거나 다시 표시합니다.',
  moa: 'Pipeline이 표적에 작용하는 기전입니다. 클릭하면 MoA 노드를 그래프에서만 숨기거나 다시 표시합니다.',
  modality: '치료 플랫폼의 Canonical 분류입니다. 클릭하면 Modality 노드를 그래프에서만 숨기거나 다시 표시합니다.'
};
const CANONICAL_INDICATIONS = [
  "Alzheimer's disease",
  "Parkinson's disease",
  "Lewy body dementia",
  "Vascular dementia",
  "Epilepsy / seizure disorders",
  "Multiple sclerosis / neuroinflammatory disease",
  "Amyotrophic lateral sclerosis / motor neuron disease",
  "Frontotemporal dementia",
  "Progressive supranuclear palsy / atypical parkinsonism",
  "Huntington's disease",
  "Stroke",
  "Migraine / headache disorders",
  "Pain",
  "Major depressive disorder",
  "Schizophrenia / psychosis",
  "Bipolar disorder",
  "Anxiety disorders",
  "Autism spectrum disorder",
  "ADHD",
  "Sleep / wake disorders",
  "Chronic cough",
  "Inflammatory bowel disease",
  "Systemic lupus erythematosus",
  "Other autoimmune / inflammatory disease",
  "Spinal cord injury",
  "Spinal muscular atrophy",
  "Charcot-Marie-Tooth disease / hereditary neuropathy",
  "Ataxia (spinocerebellar / Friedreich)",
  "Unknown"
];
const $ = selector => document.querySelector(selector);
const ui = {
  canvas: $('#sgCanvas'), status: $('#sgStatus'), search: $('#sgSearch'), theme: $('#sgThemeFilter'),
  type: $('#sgTypeFilter'), indication: $('#sgIndicationFilter'), stage: $('#sgStageFilter'), depth: $('#sgDepthFilter'), view: $('#sgView'), reset: $('#sgReset'),
  searchAdd: $('#sgSearchAdd'), keywordPills: $('#sgKeywordPills'),
  nodes: $('#sgNodeCount'), edges: $('#sgEdgeCount'), scope: $('#sgScope'), legend: $('#sgLegend'), inspector: $('#sgInspector'), inspectorPanel: $('#sgInspectorPanel'), inspectorDrag: $('#sgInspectorDrag'), inspectorBack: $('#sgInspectorBack'), agentLink: $('#sgAgentLink'), mapPanel: $('#knowledgeMapPanel'),
  noteModal: $('#knowledgeMapNoteModal'), noteModalTitle: $('#knowledgeMapNoteModalTitle'), noteModalBody: $('#knowledgeMapNoteModalBody'), noteModalClose: $('#knowledgeMapNoteModalClose'), noteModalDrag: $('#knowledgeMapNoteModalDrag'),
};

let raw = { nodes: [], edges: [] };
const hiddenLegendFilters = new Set();
let adjacency = new Map();
let stageByAsset = new Map();
let renderer;
let cameraAnimationFrame = null;
let simulation;
let loadPromise;
let wikiRefreshPromise;
let noteRequestId = 0;
let activeWikiNote = null;
const selectedIndications = new Set();
let indicationQuery = '';
const selectedThemes = new Set();
const selectedTypes = new Set();
const selectedStages = new Set();
const multiFilterQueries = { theme: '', type: '', stage: '' };
let depthValue = '1';
const searchKeywords = [];

const clean = value => String(value ?? '').trim();
const escapeHtml = value => clean(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function syncMapResetButton() {
  if (!ui.reset) return;
  const hasActiveFilters = Boolean(
    searchKeywords.length
    || selectedIndications.size
    || selectedThemes.size
    || selectedTypes.size
    || selectedStages.size
    || hiddenLegendFilters.size
    || depthValue !== '1'
    || ui.view?.value !== 'overview'
  );
  ui.reset.disabled = !hasActiveFilters;
}

function syncExplorerViewTooltip() {
  if (!ui.view) return;
  const tooltip = 'Node 선택 편의성을 위해 핵심 연결만 보며 관심 영역을 좁히세요. 더 많은 Node를 보려면 전체 지식 맵 · 넓게 보기를 선택하세요.';
  const tooltipHost = ui.view.closest('.sg-explorer-view');
  if (tooltipHost) tooltipHost.dataset.tooltip = tooltip;
  ui.view.removeAttribute('title');
}
const nodeMap = () => new Map(raw.nodes.map(node => [node.id, node]));
const isDarkTheme = () => document.documentElement.dataset.theme === 'dark';
const graphTypeColor = (type) => (isDarkTheme() ? DARK_TYPE_COLOR : TYPE_COLOR)[type] || (isDarkTheme() ? '#9aa8b9' : '#64748b');
const graphStageColor = (stage) => (isDarkTheme() ? DARK_STAGE_COLOR : STAGE_COLOR)[stage] || (isDarkTheme() ? '#9aaabd' : '#94a3b8');
const graphEdgeColor = () => isDarkTheme() ? '#5c6f8a8c' : '#94a3b855';
const graphMutedNodeColor = () => isDarkTheme() ? '#091322d9' : '#cbd5e140';
const graphMutedEdgeColor = () => isDarkTheme() ? '#26364a80' : '#cbd5e120';
const graphFocusedEdgeColor = () => isDarkTheme() ? '#a9c4e8d6' : '#475569c0';

function normalizedSearchKeyword(value) {
  return clean(value)
    .normalize('NFKC')
    .toLocaleLowerCase('ko')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/(?<=[a-z])0+(?=\d)/g, '');
}

function renderSearchKeywordPills() {
  if (!ui.keywordPills) return;
  ui.keywordPills.hidden = searchKeywords.length === 0;
  ui.keywordPills.innerHTML = searchKeywords.map((keyword, index) => `
    <button type="button" class="step0-search-token help-tooltip" data-sg-keyword-remove="${index}" data-tooltip="클릭하여 이 검색 조건을 제거" aria-label="${escapeHtml(keyword)} 검색 조건 제거">
      <span>${escapeHtml(keyword)}</span><b aria-hidden="true">−</b>
    </button>
  `).join('');
}

function addSearchKeyword() {
  const value = clean(ui.search?.value);
  const normalized = normalizedSearchKeyword(value);
  if (!normalized) return;
  if (!searchKeywords.some(keyword => normalizedSearchKeyword(keyword) === normalized)) searchKeywords.push(value);
  ui.search.value = '';
  renderSearchKeywordPills();
  buildGraph();
  ui.search.focus();
}

function nodeSearchContext(node) {
  const nodes = nodeMap();
  const values = [node.label, node.tags, node.type];
  for (const id of adjacency.get(node.id) || []) {
    const neighbor = nodes.get(id);
    if (neighbor) values.push(neighbor.label, neighbor.tags, neighbor.type);
  }
  return values.map(normalizedSearchKeyword).join(' ');
}

function agentUrl(prompt = '') {
  return `/?openAgent=1&from=graph${prompt ? `&agentPrompt=${encodeURIComponent(prompt)}` : ''}`;
}

function setAgentPrompt(prompt = '') {
  if (!ui.agentLink) return;
  ui.agentLink.dataset.agentPrompt = prompt;
  if (!ui.mapPanel) ui.agentLink.href = agentUrl(prompt);
  const label = prompt ? '선택 노드 맥락으로 All Pipelines Agent에 질문하기' : 'All Pipelines Agent에 질문하기';
  ui.agentLink.title = label;
  ui.agentLink.setAttribute('aria-label', label);
  ui.agentLink.dataset.tooltip = prompt ? '선택 노드와 직접 연결된 맥락을 함께 전달합니다.' : '노드를 선택하면 해당 연결 맥락을 함께 전달합니다.';
}

function activeMapFilterContext() {
  const parts = [`탐색 시작점: ${ui.view?.value === 'all' ? '전체 지식 맵' : 'Overview · 핵심 연결'}`];
  if (searchKeywords.length) parts.push(`키워드: ${searchKeywords.join(', ')}`);
  if (selectedThemes.size) parts.push(`Theme: ${[...selectedThemes].join(', ')}`);
  if (selectedIndications.size) parts.push(`Main indication: ${[...selectedIndications].join(', ')}`);
  if (selectedTypes.size) parts.push(`표시할 항목: ${[...selectedTypes].map(type => TYPE_FILTER_LABEL[type] || type).join(', ')}`);
  if (selectedStages.size) parts.push(`조사 진행 단계: ${[...selectedStages].map(stage => STAGE_LABEL[stage] || stage).join(', ')}`);
  parts.push(`Node 연결 범위: ${depthValue} hop`);
  return `[Knowledge Wiki Map 필터: ${parts.join(' · ')}]\n`;
}

function launchAgent(prompt = '') {
  if (ui.mapPanel) {
    window.dispatchEvent(new CustomEvent('skbp:open-agent', { detail: { prompt } }));
    return;
  }
  window.location.assign(agentUrl(prompt));
}

function publishActiveKnowledgeNode(node, neighbors, prompts = []) {
  if (!ui.mapPanel) return;
  const label = clean(node.label) || node.id;
  const related = neighbors.slice(0, 8).map(item => clean(item.label)).filter(Boolean).join(', ') || '직접 연결된 노드 없음';
  const context = `${activeMapFilterContext()}[선택 노드: ${node.type} · ${label}]\n[직접 연결: ${related}]`;
  window.dispatchEvent(new CustomEvent('skbp:knowledge-node-selected', {
    detail: { label, type: node.type, neighborCount: neighbors.length, context, prompts }
  }));
}

function renderNoteInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => `<span class="sg-wikilink">${label || target}</span>`);
}

function renderNoteMarkdown(markdown) {
  const body = String(markdown || '').replace(/^---[\s\S]*?\n---\s*/, '').trim();
  const lines = body.split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^#{1,3}\s/.test(line)) {
      const level = Math.min(4, line.match(/^#+/)[0].length + 1);
      blocks.push(`<h${level}>${renderNoteInline(line.replace(/^#+\s*/, ''))}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderNoteInline(lines[index].trim().replace(/^[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      index -= 1;
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (line.startsWith('|')) continue;
    blocks.push(`<p>${renderNoteInline(line)}</p>`);
  }
  return blocks.join('') || '<p>표시할 노트 본문이 없습니다.</p>';
}

function openKnowledgeNoteModal() {
  if (!activeWikiNote || !ui.noteModal || !ui.noteModalTitle || !ui.noteModalBody) return;
  ui.noteModalTitle.textContent = activeWikiNote.title;
  ui.noteModalBody.innerHTML = renderNoteMarkdown(activeWikiNote.markdown);
  ui.noteModal.hidden = false;
}

function setupKnowledgeNoteModal() {
  if (!ui.noteModal || !ui.noteModalDrag) return;
  ui.noteModalClose?.addEventListener('click', () => { ui.noteModal.hidden = true; });
  ui.noteModalDrag.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const rect = ui.noteModal.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { left: rect.left, top: rect.top };
    const move = (moveEvent) => {
      const width = ui.noteModal.offsetWidth;
      const height = ui.noteModal.offsetHeight;
      ui.noteModal.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, origin.left + moveEvent.clientX - startX))}px`;
      ui.noteModal.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, origin.top + moveEvent.clientY - startY))}px`;
      ui.noteModal.style.right = 'auto';
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
  });
}

function setupInspectorPopover() {
  if (!ui.inspectorPanel || !ui.inspectorDrag) return;
  ui.inspectorDrag.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const stage = ui.inspectorPanel.closest('.atlas-graph-stage');
    if (!stage) return;
    const panelRect = ui.inspectorPanel.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { left: panelRect.left - stageRect.left, top: panelRect.top - stageRect.top };
    ui.inspectorDrag.setPointerCapture?.(event.pointerId);
    ui.inspectorPanel.classList.add('is-dragging');
    const move = (moveEvent) => {
      const width = ui.inspectorPanel.offsetWidth;
      const height = ui.inspectorPanel.offsetHeight;
      const left = Math.max(10, Math.min(stage.clientWidth - width - 10, origin.left + moveEvent.clientX - startX));
      const top = Math.max(10, Math.min(stage.clientHeight - height - 10, origin.top + moveEvent.clientY - startY));
      ui.inspectorPanel.style.left = `${left}px`;
      ui.inspectorPanel.style.top = `${top}px`;
      ui.inspectorPanel.style.right = 'auto';
    };
    const end = () => {
      ui.inspectorPanel.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
  });
}

async function renderSelectedNodeNote(node, container) {
  const requestId = ++noteRequestId;
  const notePath = clean(node.title || node.label);
  if (!notePath || !container) return;
  try {
    const response = await fetch(`/api/wiki-note?path=${encodeURIComponent(notePath.endsWith('.md') ? notePath : `${notePath}.md`)}`);
    const data = await response.json();
    if (!response.ok) throw Error(data.detail || '노트를 찾을 수 없습니다.');
    if (requestId !== noteRequestId) return;
    const wikiPath = String(data.path || '');
    activeWikiNote = { title: data.title || node.label, path: wikiPath, markdown: data.markdown || '' };
    container.innerHTML = `<div class="sg-note-head"><span>Knowledge Note</span><button type="button" data-open-knowledge-note>전체 보기 ↗</button></div><article class="sg-note-body">${renderNoteMarkdown(data.markdown)}</article>`;
    container.querySelector('[data-open-knowledge-note]')?.addEventListener('click', openKnowledgeNoteModal);
  } catch (error) {
    if (requestId !== noteRequestId) return;
    container.innerHTML = `<div class="sg-note-empty">이 노드에 연결된 Markdown 노트를 불러올 수 없습니다.<small>${escapeHtml(error.message)}</small></div>`;
  }
}

function recommendedPrompts(node, neighbors) {
  const label = clean(node.label) || node.id;
  const related = neighbors.slice(0, 8).map(item => clean(item.label)).filter(Boolean).join(', ') || '직접 연결된 노드';
  const context = `${activeMapFilterContext()}[선택 노드: ${node.type} · ${label}]\n[직접 연결: ${related}]\n\n`;
  const typePrompt = {
    asset: `${label}의 Pipeline Stage, 경쟁 환경, 근거 수준을 종합해 우선순위와 다음 검토 액션을 제안해줘.`,
    company: `${label}의 연결 파이프라인을 비교해 회사의 핵심 강점과 포트폴리오 리스크를 설명해줘.`,
    target: `${label} 타깃의 작용 기전, 적응증 연결성, 경쟁 리스크를 정리해줘.`,
    moa: `${label} 기전의 차별성, 검증 근거, translational risk를 평가해줘.`,
    indication: `${label} 적응증에서 연결된 후보들의 미충족 수요와 상업적 차별점을 비교해줘.`,
  };
  return [
    '이 노드와 직접 연결된 노드의 관계와 핵심 인사이트를 분석해줘.',
    `${label}에 대해 현재 지식 그래프에 있는 근거, 리스크, 추가 확인 포인트를 설명해줘.`,
    typePrompt[node.type] || `${label}을 중심으로 연결된 지식의 의미와 다음 검토 액션을 제안해줘.`,
  ].map(question => ({ label: question, prompt: context + question }));
}

function setOptions(element, values) {
  const options = [...new Set(values.filter(Boolean))].sort();
  element.innerHTML = '<option value="">전체</option>' + options
    .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
}

function mapIndicationOptions() {
  const options = [...new Set(raw.nodes.filter(node => node.type === 'indication').map(node => clean(node.label)).filter(Boolean))]
    .map(value => ({ value, label: value }));
  // Match the dashboard's search identity rule here too. The node label is
  // retained as the selected value, while only case/spacing/punctuation form
  // differences determine its Canonical-Library placement.
  const byNormalizedValue = new Map(options.map(option => [normalizedSearchKeyword(option.value), option]));
  const canonical = CANONICAL_INDICATIONS
    .map(value => byNormalizedValue.get(normalizedSearchKeyword(value)))
    .filter(Boolean);
  const canonicalValues = new Set(CANONICAL_INDICATIONS.map(normalizedSearchKeyword));
  const other = options
    .filter(option => !canonicalValues.has(normalizedSearchKeyword(option.value)))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  return { canonical, other };
}

function filterMapIndicationOptions(menu, query = '') {
  const term = normalizedSearchKeyword(query);
  menu?.querySelectorAll('[data-sg-indication-option]').forEach(option => {
    option.hidden = Boolean(term) && !normalizedSearchKeyword(option.textContent).includes(term);
  });
  menu?.querySelectorAll('[data-sg-indication-group]').forEach(group => {
    group.hidden = [...group.querySelectorAll('[data-sg-indication-option]')].every(option => option.hidden);
  });
}

function renderMapIndicationFilter() {
  const filter = ui.indication;
  if (!filter) return;
  const menu = filter.querySelector('.filter-multiselect-menu');
  const trigger = filter.querySelector('.filter-multiselect-trigger');
  const summary = filter.querySelector('[data-sg-indication-summary]');
  if (!menu || !trigger || !summary) return;
  const { canonical, other } = mapIndicationOptions();
  const option = (item, canonicalItem) => `<button type="button" class="filter-multiselect-option${selectedIndications.has(item.value) ? ' is-selected' : ''}${canonicalItem ? ' is-canonical' : ''}" data-sg-indication-option data-sg-indication-value="${escapeHtml(item.value)}" role="option" aria-selected="${selectedIndications.has(item.value)}"><span class="filter-multiselect-check" aria-hidden="true">${selectedIndications.has(item.value) ? '✓' : ''}</span><span>${escapeHtml(item.label)}</span></button>`;
  const group = (label, items, canonicalItem) => items.length ? `<div class="filter-multiselect-option-group" data-sg-indication-group><p>${label}</p>${items.map(item => option(item, canonicalItem)).join('')}</div>` : '';
  summary.textContent = selectedIndications.size === 0 ? '전체' : selectedIndications.size === 1 ? [...selectedIndications][0] : `${selectedIndications.size}개 선택`;
  filter.classList.toggle('has-selection', selectedIndications.size > 0);
  menu.innerHTML = [
    `<div class="filter-multiselect-menu-topbar"><button type="button" class="filter-multiselect-option filter-multiselect-all-option${selectedIndications.size === 0 ? ' is-selected' : ''}" data-sg-indication-value="all" role="option" aria-selected="${selectedIndications.size === 0}"><span class="filter-multiselect-check" aria-hidden="true">${selectedIndications.size === 0 ? '✓' : ''}</span><span>전체</span></button><label class="filter-multiselect-menu-search"><span class="sr-only">Indication 검색</span><input type="search" data-sg-indication-search value="${escapeHtml(indicationQuery)}" placeholder="검색" autocomplete="off" /></label></div>`,
    group('Canonical Library', canonical, true), group('Source values', other, false),
    '<div class="filter-multiselect-menu-actions"><button type="button" class="filter-multiselect-done" data-sg-indication-done>완료</button></div>'
  ].join('');
  filterMapIndicationOptions(menu, indicationQuery);
}

const MAP_MULTI_FILTERS = {
  theme: {
    canonical: ['E/I Balance', 'Neuroimmune', 'Protein Homeostasis', 'Others', 'Unknown'],
    selected: selectedThemes,
    values: () => raw.nodes.filter(node => node.type === 'theme').map(node => node.label)
  },
  type: {
    canonical: [],
    selected: selectedTypes,
    values: () => raw.nodes.map(node => node.type)
  },
  stage: {
    canonical: Object.values(STAGE_LABEL),
    selected: selectedStages,
    values: () => Object.values(STAGE_LABEL)
  }
};

function mapMultiFilterOptions(key) {
  const config = MAP_MULTI_FILTERS[key];
  if (!config) return { canonical: [], other: [], hasCanonical: false };
  const options = [...new Set(config.values().map(clean).filter(Boolean))]
    .map(value => ({ value, label: key === 'type' ? (TYPE_FILTER_LABEL[value] || value) : value }));
  const canonicalValues = new Set(config.canonical.map(normalizedSearchKeyword));
  const byNormalizedValue = new Map(options.map(option => [normalizedSearchKeyword(option.value), option]));
  const canonical = config.canonical.map(value => byNormalizedValue.get(normalizedSearchKeyword(value))).filter(Boolean);
  const other = options
    .filter(option => !canonicalValues.has(normalizedSearchKeyword(option.value)))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  return { canonical, other, hasCanonical: config.canonical.length > 0 };
}

function filterMapMultiOptions(menu, key, query = '') {
  const term = normalizedSearchKeyword(query);
  menu?.querySelectorAll(`[data-sg-multi-option="${key}"]`).forEach(option => {
    option.hidden = Boolean(term) && !normalizedSearchKeyword(option.textContent).includes(term);
  });
  menu?.querySelectorAll(`[data-sg-multi-group="${key}"]`).forEach(group => {
    group.hidden = [...group.querySelectorAll(`[data-sg-multi-option="${key}"]`)].every(option => option.hidden);
  });
}

function renderMapMultiFilter(key) {
  const config = MAP_MULTI_FILTERS[key];
  const filter = ui[key];
  if (!config || !filter) return;
  const menu = filter.querySelector('.filter-multiselect-menu');
  const summary = filter.querySelector(`[data-sg-${key}-summary]`);
  if (!menu || !summary) return;
  const { canonical, other, hasCanonical } = mapMultiFilterOptions(key);
  const selected = config.selected;
  const option = (item, canonicalItem) => `<button type="button" class="filter-multiselect-option${selected.has(item.value) ? ' is-selected' : ''}${canonicalItem ? ' is-canonical' : ''}" data-sg-multi-option="${key}" data-sg-multi-value="${escapeHtml(item.value)}" role="option" aria-selected="${selected.has(item.value)}"><span class="filter-multiselect-check" aria-hidden="true">${selected.has(item.value) ? '✓' : ''}</span><span>${escapeHtml(item.label)}</span></button>`;
  const group = (label, items, canonicalItem) => items.length ? `<div class="filter-multiselect-option-group" data-sg-multi-group="${key}"><p>${label}</p>${items.map(item => option(item, canonicalItem)).join('')}</div>` : '';
  summary.textContent = selected.size === 0
    ? '전체'
    : selected.size === 1
      ? (key === 'type' ? (TYPE_FILTER_LABEL[[...selected][0]] || [...selected][0]) : [...selected][0])
      : `${selected.size}개 선택`;
  filter.classList.toggle('has-selection', selected.size > 0);
  menu.innerHTML = [
    `<div class="filter-multiselect-menu-topbar"><button type="button" class="filter-multiselect-option filter-multiselect-all-option${selected.size === 0 ? ' is-selected' : ''}" data-sg-multi-all="${key}" role="option" aria-selected="${selected.size === 0}"><span class="filter-multiselect-check" aria-hidden="true">${selected.size === 0 ? '✓' : ''}</span><span>전체</span></button><label class="filter-multiselect-menu-search"><span class="sr-only">${escapeHtml(key)} 검색</span><input type="search" data-sg-multi-search="${key}" value="${escapeHtml(multiFilterQueries[key])}" placeholder="검색" autocomplete="off" /></label></div>`,
    group(hasCanonical ? 'Canonical Library' : 'Available values', canonical, hasCanonical),
    group('Source values', other, false),
    `<div class="filter-multiselect-menu-actions"><button type="button" class="filter-multiselect-done" data-sg-multi-done="${key}">완료</button></div>`
  ].join('');
  filterMapMultiOptions(menu, key, multiFilterQueries[key]);
}

function closeMapMultiFilter(key) {
  const filter = ui[key];
  if (!filter) return;
  filter.classList.remove('is-open');
  filter.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
  const menu = filter.querySelector('.filter-multiselect-menu');
  if (menu) menu.hidden = true;
  multiFilterQueries[key] = '';
}

function renderMapDepthFilter() {
  const filter = ui.depth;
  if (!filter) return;
  const summary = filter.querySelector('[data-sg-depth-summary]');
  const menu = filter.querySelector('.filter-multiselect-menu');
  if (!summary || !menu) return;
  summary.textContent = `${depthValue} hop`;
  menu.innerHTML = ['1', '2', '3'].map(value => `<button type="button" class="filter-multiselect-option${depthValue === value ? ' is-selected' : ''}" data-sg-depth-value="${value}" role="radio" aria-checked="${depthValue === value}"><span class="filter-multiselect-check" aria-hidden="true">${depthValue === value ? '✓' : ''}</span><span>${value} hop</span></button>`).join('');
}

function closeMapDepthFilter() {
  if (!ui.depth) return;
  ui.depth.classList.remove('is-open');
  ui.depth.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
  const menu = ui.depth.querySelector('.filter-multiselect-menu');
  if (menu) menu.hidden = true;
}

function expandNodeIds(ids, depth) {
  const expanded = new Set(ids);
  const queue = [...ids].map(id => [id, 0]);
  while (queue.length) {
    const [id, level] = queue.shift();
    if (level >= depth) continue;
    for (const next of adjacency.get(id) || []) {
      if (!expanded.has(next)) {
        expanded.add(next);
        queue.push([next, level + 1]);
      }
    }
  }
  return expanded;
}

function overviewCoreNodeIds() {
  const rootIds = new Set(raw.nodes
    .filter(node => node.type === 'asset')
    .sort((a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0))
    .slice(0, 36)
    .map(node => node.id));
  let ids = expandNodeIds(rootIds, 1);
  if (ids.size > 500) {
    ids = new Set([...ids]
      .sort((a, b) => (rootIds.has(b) ? 1 : 0) - (rootIds.has(a) ? 1 : 0)
        || (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0))
      .slice(0, 500));
  }
  return ids;
}

function assetStage(assetId) {
  const nodes = nodeMap();
  const asset = nodes.get(assetId);
  if (clean(asset?.recommendation).toLowerCase() === 'shortlist') return 'shortlisting';
  const directReviews = [...(adjacency.get(assetId) || [])].map(id => nodes.get(id)).filter(node => node?.type === 'review');
  const reviewStages = directReviews.map(node => clean(node.workflow_stage).toLowerCase());
  if (reviewStages.includes('full scout')) return 'full_scout';
  if (reviewStages.includes('fast triage')) return 'fast_triage';
  return 'listing';
}

function prepare() {
  adjacency = new Map(raw.nodes.map(node => [node.id, new Set()]));
  raw.edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  stageByAsset = new Map(raw.nodes.filter(node => node.type === 'asset').map(node => [node.id, assetStage(node.id)]));
  renderMapIndicationFilter();
  Object.keys(MAP_MULTI_FILTERS).forEach(renderMapMultiFilter);
  renderMapDepthFilter();
  const setFilterLabel = (element, label) => {
    const caption = element?.closest('label')?.querySelector('span');
    if (caption) caption.textContent = label;
  };
  setFilterLabel(ui.search, '검색');
  setFilterLabel(ui.theme, 'Theme');
  setFilterLabel(ui.type, '표시할 항목');
  setFilterLabel(ui.stage, '조사 진행 단계');
  syncExplorerViewTooltip();
  if (ui.search) ui.search.placeholder = 'Company · Asset · Target · MoA 등 검색';
  const stageLegend = Object.keys(STAGE_COLOR).map(key => `<button type="button" class="sg-legend-filter help-tooltip" data-legend-kind="stage" data-legend-value="${key}" aria-pressed="true" aria-label="${STAGE_LABEL[key]} 노드 표시 또는 숨기기" data-tooltip="${STAGE_LEGEND_TOOLTIP[key]}"><i style="--c:${graphStageColor(key)}"></i>${STAGE_LABEL[key]}</button>`).join('');
  const featuredConnectionTypes = ['review', 'company', 'target', 'moa', 'modality'];
  const typeLegend = featuredConnectionTypes.filter(type => raw.nodes.some(node => node.type === type))
    .map(type => {
      const label = TYPE_LEGEND_LABEL[type] || type;
      const tooltip = TYPE_LEGEND_TOOLTIP[type] || `${label} 노드 표시/숨기기`;
      return `<button type="button" class="sg-legend-filter help-tooltip" data-legend-kind="type" data-legend-value="${escapeHtml(type)}" aria-pressed="true" aria-label="${escapeHtml(label)} 노드 표시 또는 숨기기" data-tooltip="${escapeHtml(tooltip)}"><i style="--c:${graphTypeColor(type)}"></i>${escapeHtml(label)}</button>`;
    }).join('');
  ui.legend.innerHTML = `<div class="sg-legend-group"><span class="sg-legend-heading help-tooltip" tabindex="0" data-tooltip="Asset의 조사 진행 상태를 색으로 보여줍니다. 아래 상태를 클릭하면 해당 Asset을 그래프에서만 숨기거나 다시 표시합니다.">조사 진행 단계 · 색상/표시</span><div class="sg-legend-options">${stageLegend}</div></div><div class="sg-legend-group"><span class="sg-legend-heading help-tooltip" tabindex="0" data-tooltip="그래프 노드 종류의 색상 안내입니다. 아래 항목을 클릭하면 해당 종류의 노드를 그래프에서만 숨기거나 다시 표시합니다.">연결 대상 · 표시</span><div class="sg-legend-options">${typeLegend}</div></div>`;
  ui.legend.querySelectorAll('.sg-legend-filter').forEach(button => button.addEventListener('click', () => {
    const key = `${button.dataset.legendKind}:${button.dataset.legendValue}`;
    if (hiddenLegendFilters.has(key)) hiddenLegendFilters.delete(key);
    else hiddenLegendFilters.add(key);
    button.classList.toggle('is-hidden', hiddenLegendFilters.has(key));
    button.setAttribute('aria-pressed', String(!hiddenLegendFilters.has(key)));
    buildGraph();
  }));
}

function isLegendVisible(node) {
  if (node.type === 'asset') return !hiddenLegendFilters.has(`stage:${stageByAsset.get(node.id) || 'listing'}`);
  return !hiddenLegendFilters.has(`type:${node.type}`);
}

function isRelatedTo(node, type, label) {
  if (!label) return true;
  if (node.type === type && node.label === label) return true;
  const nodes = nodeMap();
  return [...(adjacency.get(node.id) || [])].some(id => {
    const neighbor = nodes.get(id);
    return neighbor?.type === type && neighbor.label === label;
  });
}

function isRelatedToAny(node, type, labels) {
  return !labels.size || [...labels].some(label => isRelatedTo(node, type, label));
}

function selectedGraph() {
  const keywords = searchKeywords.map(normalizedSearchKeyword).filter(Boolean);
  const type = selectedTypes;
  const theme = selectedThemes;
  const stage = selectedStages;
  const indication = selectedIndications;
  const overview = ui.view?.value === 'overview';
  const hasCriteria = Boolean(keywords.length || type.size || theme.size || stage.size || indication.size);
  const hasFilter = Boolean(hasCriteria || overview);
  const overviewScopeIds = overview && hasCriteria ? overviewCoreNodeIds() : null;
  let roots = raw.nodes.filter(node => {
    const searchable = nodeSearchContext(node);
    const nodeStage = node.type === 'asset' ? STAGE_LABEL[stageByAsset.get(node.id) || 'listing'] : '';
    return (!overviewScopeIds || overviewScopeIds.has(node.id)) && isLegendVisible(node)
      && keywords.every(keyword => searchable.includes(keyword)) && (!type.size || type.has(node.type))
      && isRelatedToAny(node, 'theme', theme) && isRelatedToAny(node, 'indication', indication) && (!stage.size || stage.has(nodeStage));
  });
  let ids;
  if (overview && !hasCriteria) {
    roots = roots.filter(node => node.type === 'asset')
      .sort((a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0))
      .slice(0, 36);
    ids = expandNodeIds(roots.map(node => node.id), 1);
    if (ids.size > 500) {
      const rootIds = new Set(roots.map(node => node.id));
      ids = new Set([...ids].sort((a, b) => (rootIds.has(b) ? 1 : 0) - (rootIds.has(a) ? 1 : 0)
        || (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0)).slice(0, 500));
    }
  } else if (hasFilter) {
    ids = expandNodeIds(roots.map(node => node.id), Number(depthValue || 1));
    if (overviewScopeIds) ids = new Set([...ids].filter(id => overviewScopeIds.has(id)));
    if (ids.size > 1100) {
      const rootIds = new Set(roots.map(node => node.id));
      ids = new Set([...ids].sort((a, b) => (rootIds.has(b) ? 1 : 0) - (rootIds.has(a) ? 1 : 0)
        || (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0)).slice(0, 1100));
    }
  } else {
    roots = [...roots].sort((a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0)).slice(0, 1250);
    ids = new Set(roots.map(node => node.id));
  }
  const nodes = raw.nodes.filter(node => ids.has(node.id) && isLegendVisible(node));
  const visibleIds = new Set(nodes.map(node => node.id));
  return {
    nodes,
    edges: raw.edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    rootCount: roots.length,
    hasFilter,
  };
}

function seedNodes(nodes) {
  const types = [...new Set(nodes.map(node => node.type))];
  const typeIndex = new Map(types.map((type, index) => [type, index]));
  const buckets = new Map(types.map(type => [type, []]));
  nodes.forEach(node => buckets.get(node.type).push(node));
  return nodes.map(node => {
    const bucket = buckets.get(node.type);
    const index = bucket.indexOf(node);
    const angle = (index / bucket.length) * Math.PI * 2 + typeIndex.get(node.type) * 0.71;
    const radius = 80 + typeIndex.get(node.type) * 38;
    return { id: node.id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r: Math.min(14, 3 + Math.sqrt(adjacency.get(node.id)?.size || 0)), raw: node };
  });
}

function stopCameraAnimation() {
  if (cameraAnimationFrame !== null) cancelAnimationFrame(cameraAnimationFrame);
  cameraAnimationFrame = null;
}

function moveMapCamera(nodeId = null) {
  stopCameraAnimation();
  if (!renderer) return;
  const activeRenderer = renderer;
  const camera = renderer.getCamera();
  const start = camera.getState();
  const focusing = nodeId !== null;
  const destination = () => {
    const node = focusing ? activeRenderer.getNodeDisplayData(nodeId) : null;
    if (focusing && (!node || node.hidden)) return null;
    return { x: node?.x ?? 0.5, y: node?.y ?? 0.5, ratio: focusing ? 0.42 : 1.15, angle: 0 };
  };
  const target = destination();
  if (!target) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    camera.setState(target);
    return;
  }
  const duration = focusing ? 900 : 550;
  const peakRatio = Math.max(start.ratio, target.ratio) * 1.28;
  const startedAt = performance.now();
  const ease = value => value * value * (3 - 2 * value);
  const frame = now => {
    cameraAnimationFrame = null;
    if (renderer !== activeRenderer) return;
    // Read the latest normalized position while the force layout is settling.
    const end = destination();
    if (!end) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const pan = ease(progress);
    const ratio = !focusing
      ? start.ratio + (end.ratio - start.ratio) * pan
      : progress < 0.35
        ? start.ratio + (peakRatio - start.ratio) * ease(progress / 0.35)
        : peakRatio + (end.ratio - peakRatio) * ease((progress - 0.35) / 0.65);
    camera.setState({
      x: start.x + (end.x - start.x) * pan,
      y: start.y + (end.y - start.y) * pan,
      angle: start.angle * (1 - pan),
      ratio,
    });
    if (progress < 1) cameraAnimationFrame = requestAnimationFrame(frame);
  };
  cameraAnimationFrame = requestAnimationFrame(frame);
}

function clearSelection() {
  stopCameraAnimation();
  renderer?.setSetting('nodeReducer', null);
  renderer?.setSetting('edgeReducer', null);
  ui.inspector.textContent = '노드를 클릭하면 연결된 노드만 강조됩니다.';
  if (ui.inspectorPanel) ui.inspectorPanel.hidden = true;
  if (ui.noteModal) ui.noteModal.hidden = true;
  if (ui.inspector) ui.inspector.scrollTop = 0;
  setAgentPrompt();
  if (ui.mapPanel) window.dispatchEvent(new CustomEvent('skbp:knowledge-node-selected', { detail: null }));
  renderer?.refresh();
}

function inspectNode(id) {
  const nodes = nodeMap();
  const node = nodes.get(id);
  const neighbors = [...(adjacency.get(id) || [])].map(key => nodes.get(key)).filter(Boolean);
  const focus = new Set([id, ...neighbors.map(item => item.id)]);
  const prompts = recommendedPrompts(node, neighbors);
  publishActiveKnowledgeNode(node, neighbors, prompts);
  setAgentPrompt(prompts[0].prompt);
  if (ui.inspectorPanel) ui.inspectorPanel.hidden = false;
  ui.inspector.innerHTML = `<div class="kg-node-title"><i style="--c:${graphTypeColor(node.type)}"></i><div><p>${escapeHtml(node.type)}</p><h3>${escapeHtml(node.label)}</h3></div></div><p class="kg-meta"><span>Connections<b>${neighbors.length}</b></span><span>Score<b>${escapeHtml(node.score || '—')}</b></span></p><p class="kg-tags">${escapeHtml(node.tags || 'No tags')}</p><section class="sg-node-note"><div class="sg-note-loading">Markdown 노트를 불러오는 중입니다…</div></section><section class="sg-connected-nodes"><div class="sg-connected-nodes-head">Connected Nodes <b>${neighbors.length}</b></div><div class="sg-connected-nodes-list">${neighbors.slice(0, 18).map(item => `<button type="button" data-node-id="${escapeHtml(item.id)}"><i style="--c:${graphTypeColor(item.type)}"></i><span>${escapeHtml(item.label)}</span><em>${escapeHtml(item.type)}</em></button>`).join('') || '<p>직접 연결된 노드가 없습니다.</p>'}</div></section>`;
  ui.inspector.scrollTop = 0;
  ui.inspector.querySelectorAll('[data-node-id]').forEach(button => button.addEventListener('click', () => inspectNode(button.dataset.nodeId)));
  renderSelectedNodeNote(node, ui.inspector.querySelector('.sg-node-note'));
  renderer.setSetting('nodeReducer', (key, attributes) => ({
    ...attributes,
    color: key === id ? '#f6c453' : focus.has(key) ? attributes.color : graphMutedNodeColor(),
    zIndex: focus.has(key) ? 10 : 0,
    label: focus.has(key) ? attributes.label : '',
  }));
  renderer.setSetting('edgeReducer', (edge, attributes) => {
    const [source, target] = renderer.getGraph().extremities(edge);
    const connected = focus.has(source) && focus.has(target);
    return { ...attributes, color: connected ? graphFocusedEdgeColor() : graphMutedEdgeColor(), size: connected ? 1.35 : 0.25 };
  });
  renderer.refresh();
  moveMapCamera(id);
}

function buildGraph() {
  stopCameraAnimation();
  syncMapResetButton();
  const data = selectedGraph();
  const layout = seedNodes(data.nodes);
  const positions = new Map(layout.map(node => [node.id, node]));
  const graph = new graphology.MultiGraph();
  layout.forEach(node => graph.addNode(node.id, {
    label: node.raw.label, x: node.x, y: node.y, size: node.r,
    color: node.raw.type === 'asset' ? graphStageColor(stageByAsset.get(node.id) || 'listing') : graphTypeColor(node.raw.type),
    zIndex: node.raw.type === 'asset' ? 2 : 1,
  }));
  data.edges.forEach((edge, index) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) graph.addEdgeWithKey(`edge-${index}`, edge.source, edge.target, { size: 0.34, color: graphEdgeColor() });
  });
  if (ui.nodes) ui.nodes.textContent = data.nodes.length.toLocaleString();
  if (ui.edges) ui.edges.textContent = data.edges.length.toLocaleString();
  ui.scope.textContent = data.hasFilter
    ? `${data.rootCount.toLocaleString()}개 필터 결과와 ${depthValue} hop 연결망을 표시합니다.`
    : '물리 배치를 계산 중입니다. 노드를 드래그하면 위치를 고정할 수 있습니다.';
  simulation?.stop();
  renderer?.kill();
  renderer = new Sigma(graph, ui.canvas, {
    renderEdgeLabels: false,
    labelRenderedSizeThreshold: 9,
    labelFont: getComputedStyle(document.body).fontFamily,
    labelColor: { color: isDarkTheme() ? '#dce7f4' : '#17202c' },
    labelWeight: '600',
    zIndex: true,
  });

  let ticks = 0;
  const physicsEdges = data.edges.map(edge => ({ source: edge.source, target: edge.target }));
  simulation = d3.forceSimulation(layout)
    .force('link', d3.forceLink(physicsEdges).id(node => node.id).distance(22).strength(0.13))
    .force('charge', d3.forceManyBody().strength(-13).distanceMax(190))
    .force('collide', d3.forceCollide().radius(node => node.r + 2).strength(0.55))
    .force('center', d3.forceCenter(0, 0)).alphaDecay(0.032)
    .on('tick', () => { layout.forEach(node => graph.mergeNodeAttributes(node.id, { x: node.x, y: node.y })); if (++ticks % 3 === 0) renderer.refresh(); })
    .on('end', () => {
      renderer.refresh();
      ui.scope.textContent = data.hasFilter
        ? `${data.rootCount.toLocaleString()}개 필터 결과 · ${depthValue} hop 연결망 · ${data.nodes.length.toLocaleString()} nodes / ${data.edges.length.toLocaleString()} links`
        : `물리 배치 완료 · ${data.nodes.length.toLocaleString()}개 노드 / ${data.edges.length.toLocaleString()}개 연결 · 드래그로 노드 고정`;
    });

  let dragged;
  let didDrag = false;
  renderer.on('downNode', ({ node, event }) => {
    stopCameraAnimation();
    didDrag = false;
    dragged = positions.get(node);
    if (!dragged) return;
    dragged.fx = dragged.x;
    dragged.fy = dragged.y;
    renderer.getCamera().disable();
    simulation.alphaTarget(0.15).restart();
    event?.preventSigmaDefault?.();
  });
  const mouse = renderer.getMouseCaptor();
  mouse.on('mousedown', stopCameraAnimation);
  mouse.on('wheel', stopCameraAnimation);
  mouse.on('mousemovebody', event => {
    if (!dragged) return;
    didDrag = true;
    const point = renderer.viewportToGraph(event);
    dragged.fx = point.x;
    dragged.fy = point.y;
    graph.mergeNodeAttributes(dragged.id, { x: point.x, y: point.y });
    event.preventSigmaDefault?.();
    event.original?.preventDefault?.();
    event.original?.stopPropagation?.();
    renderer.refresh();
  });
  mouse.on('mouseup', () => {
    if (!dragged) return;
    simulation.alphaTarget(0);
    dragged = null;
    renderer.getCamera().enable();
  });
  renderer.on('doubleClickNode', ({ node, event }) => {
    event.preventSigmaDefault();
    stopCameraAnimation();
    const item = positions.get(node);
    if (!item) return;
    item.fx = null;
    item.fy = null;
    simulation.alpha(0.25).restart();
    ui.scope.textContent = '노드 고정을 해제했습니다. 주변 연결망을 다시 배치합니다.';
  });
  renderer.on('clickNode', ({ node }) => {
    if (!didDrag) inspectNode(node);
    didDrag = false;
  });
  renderer.on('clickStage', clearSelection);
  renderer.on('doubleClickStage', ({ event }) => {
    event.preventSigmaDefault();
    clearSelection();
    moveMapCamera();
  });
}

async function refreshWikiStatus() {
  try {
    const response = await fetch('/api/wiki/status', { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    if (!ui.status) return;
    const base = `${raw.nodes.length.toLocaleString()} nodes · WebGL physics`;
    ui.status.textContent = status.stale
      ? `${base} · 저장 후 최신화 필요 · 상단 새로고침`
      : `${base} · 최신화됨`;
  } catch (_error) {
    // The graph remains usable even when the optional freshness indicator is unavailable.
  }
}

async function load({ force = false } = {}) {
  if (force) loadPromise = null;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
  const response = await fetch('/wiki/13_Graph_Exports/graph.json', { cache: 'no-store' });
  if (!response.ok) throw Error('graph.json 파일을 찾을 수 없습니다.');
  raw = await response.json();
  prepare();
  buildGraph();
  await refreshWikiStatus();
  })();
  try {
    return await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

ui.view?.addEventListener('change', () => {
  syncExplorerViewTooltip();
  buildGraph();
});
ui.search?.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addSearchKeyword();
});
ui.searchAdd?.addEventListener('click', addSearchKeyword);
ui.keywordPills?.addEventListener('click', event => {
  const button = event.target.closest('[data-sg-keyword-remove]');
  if (!button) return;
  const index = Number(button.dataset.sgKeywordRemove);
  if (!Number.isInteger(index) || index < 0 || index >= searchKeywords.length) return;
  searchKeywords.splice(index, 1);
  renderSearchKeywordPills();
  buildGraph();
});
ui.indication?.addEventListener('click', event => {
  const trigger = event.target.closest('.filter-multiselect-trigger');
  if (trigger) {
    const willOpen = !ui.indication.classList.contains('is-open');
    indicationQuery = '';
    ui.indication.classList.toggle('is-open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    const menu = ui.indication.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = !willOpen;
    if (willOpen) requestAnimationFrame(() => menu?.querySelector('[data-sg-indication-search]')?.focus());
    return;
  }
  if (event.target.closest('[data-sg-indication-done]')) {
    ui.indication.classList.remove('is-open');
    ui.indication.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
    const menu = ui.indication.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = true;
    indicationQuery = '';
    ui.indication.querySelector('.filter-multiselect-trigger')?.focus();
    return;
  }
  const option = event.target.closest('[data-sg-indication-value]');
  if (!option) return;
  const value = option.dataset.sgIndicationValue;
  if (value === 'all') selectedIndications.clear();
  else if (selectedIndications.has(value)) selectedIndications.delete(value);
  else selectedIndications.add(value);
  renderMapIndicationFilter();
  buildGraph();
});
ui.indication?.addEventListener('input', event => {
  const input = event.target.closest('[data-sg-indication-search]');
  if (!input) return;
  indicationQuery = input.value;
  filterMapIndicationOptions(ui.indication.querySelector('.filter-multiselect-menu'), indicationQuery);
});
Object.keys(MAP_MULTI_FILTERS).forEach(key => {
  const filter = ui[key];
  if (!filter) return;
  filter.addEventListener('click', event => {
    const trigger = event.target.closest('.filter-multiselect-trigger');
    if (trigger) {
      const willOpen = !filter.classList.contains('is-open');
      Object.keys(MAP_MULTI_FILTERS).filter(otherKey => otherKey !== key).forEach(closeMapMultiFilter);
      if (ui.indication?.classList.contains('is-open')) {
        ui.indication.classList.remove('is-open');
        ui.indication.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
        const indicationMenu = ui.indication.querySelector('.filter-multiselect-menu');
        if (indicationMenu) indicationMenu.hidden = true;
      }
      multiFilterQueries[key] = '';
      filter.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
      const menu = filter.querySelector('.filter-multiselect-menu');
      if (menu) menu.hidden = !willOpen;
      if (willOpen) requestAnimationFrame(() => menu?.querySelector(`[data-sg-multi-search="${key}"]`)?.focus());
      return;
    }
    if (event.target.closest(`[data-sg-multi-done="${key}"]`)) {
      closeMapMultiFilter(key);
      filter.querySelector('.filter-multiselect-trigger')?.focus();
      return;
    }
    const all = event.target.closest(`[data-sg-multi-all="${key}"]`);
    const option = event.target.closest(`[data-sg-multi-option="${key}"]`);
    if (!all && !option) return;
    const selected = MAP_MULTI_FILTERS[key].selected;
    if (all) selected.clear();
    else {
      const value = option.dataset.sgMultiValue;
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
    }
    renderMapMultiFilter(key);
    buildGraph();
  });
  filter.addEventListener('input', event => {
    const input = event.target.closest(`[data-sg-multi-search="${key}"]`);
    if (!input) return;
    multiFilterQueries[key] = input.value;
    filterMapMultiOptions(filter.querySelector('.filter-multiselect-menu'), key, input.value);
  });
});
ui.depth?.addEventListener('click', event => {
  const trigger = event.target.closest('.filter-multiselect-trigger');
  if (trigger) {
    const willOpen = !ui.depth.classList.contains('is-open');
    Object.keys(MAP_MULTI_FILTERS).forEach(closeMapMultiFilter);
    if (ui.indication?.classList.contains('is-open')) {
      ui.indication.classList.remove('is-open');
      ui.indication.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
      const indicationMenu = ui.indication.querySelector('.filter-multiselect-menu');
      if (indicationMenu) indicationMenu.hidden = true;
    }
    ui.depth.classList.toggle('is-open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    const menu = ui.depth.querySelector('.filter-multiselect-menu');
    if (menu) menu.hidden = !willOpen;
    return;
  }
  const option = event.target.closest('[data-sg-depth-value]');
  if (!option) return;
  depthValue = option.dataset.sgDepthValue;
  renderMapDepthFilter();
  closeMapDepthFilter();
  buildGraph();
});
document.addEventListener('click', event => {
  if (event.target.closest('#sgIndicationFilter')) return;
  if (!ui.indication?.classList.contains('is-open')) return;
  ui.indication.classList.remove('is-open');
  ui.indication.querySelector('.filter-multiselect-trigger')?.setAttribute('aria-expanded', 'false');
  const menu = ui.indication.querySelector('.filter-multiselect-menu');
  if (menu) menu.hidden = true;
  indicationQuery = '';
});
document.addEventListener('click', event => {
  if (ui.depth?.classList.contains('is-open') && !ui.depth.contains(event.target)) closeMapDepthFilter();
});
document.addEventListener('click', event => {
  Object.keys(MAP_MULTI_FILTERS).forEach(key => {
    const filter = ui[key];
    if (!filter?.classList.contains('is-open') || filter.contains(event.target)) return;
    closeMapMultiFilter(key);
  });
});
ui.reset.addEventListener('click', () => {
  ui.search.value = '';
  searchKeywords.length = 0;
  selectedThemes.clear();
  selectedTypes.clear();
  selectedStages.clear();
  hiddenLegendFilters.clear();
  depthValue = '1';
  if (ui.view) ui.view.value = 'overview';
  syncExplorerViewTooltip();
  selectedIndications.clear();
  indicationQuery = '';
  renderSearchKeywordPills();
  renderMapIndicationFilter();
  Object.keys(MAP_MULTI_FILTERS).forEach(renderMapMultiFilter);
  renderMapDepthFilter();
  buildGraph();
  clearSelection();
});
ui.inspectorBack?.addEventListener('click', clearSelection);
ui.agentLink?.addEventListener('click', (event) => {
  if (!ui.mapPanel) return;
  event.preventDefault();
  launchAgent(ui.agentLink.dataset.agentPrompt || 'Atlas에서 확인할 Pipeline 관계와 우선순위를 제안해줘.');
});
window.initKnowledgeMap = () => load().catch(error => {
  if (ui.status) ui.status.textContent = 'Unavailable';
  ui.canvas.textContent = error.message;
});
window.refreshKnowledgeMap = ({ signal } = {}) => {
  if (wikiRefreshPromise) return wikiRefreshPromise;
  wikiRefreshPromise = (async () => {
    if (ui.scope) ui.scope.textContent = '저장된 Pipeline으로 Knowledge Wiki Map을 최신화하고 있습니다.';
    const response = await fetch('/api/wiki/export', { method: 'POST', signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.detail || 'Knowledge Wiki Map 최신화에 실패했습니다.');
    await load({ force: true });
    if (ui.scope) ui.scope.textContent = '최신 저장 데이터를 반영했습니다.';
    return data;
  })();
  return wikiRefreshPromise.finally(() => { wikiRefreshPromise = null; });
};
window.restartKnowledgeMapPhysics = () => {
  if (!loadPromise) return window.initKnowledgeMap();
  buildGraph();
  return Promise.resolve();
};
new MutationObserver(() => {
  if (loadPromise && !ui.mapPanel?.hidden) buildGraph();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
setupKnowledgeNoteModal();
setupInspectorPopover();
if (!ui.mapPanel || !ui.mapPanel.hidden) window.initKnowledgeMap();
