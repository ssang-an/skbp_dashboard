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
const STAGE_LABEL = { listing: 'Listing', fast_triage: 'Fast Triage', full_scout: 'Full Scout', shortlisting: 'Shortlisting' };
const $ = selector => document.querySelector(selector);
const ui = {
  canvas: $('#sgCanvas'), status: $('#sgStatus'), search: $('#sgSearch'), theme: $('#sgTheme'),
  type: $('#sgType'), stage: $('#sgStage'), depth: $('#sgDepth'), view: $('#sgView'), reset: $('#sgReset'),
  nodes: $('#sgNodeCount'), edges: $('#sgEdgeCount'), scope: $('#sgScope'), legend: $('#sgLegend'), inspector: $('#sgInspector'), agentLink: $('#sgAgentLink'), mapPanel: $('#knowledgeMapPanel'),
  noteModal: $('#knowledgeMapNoteModal'), noteModalTitle: $('#knowledgeMapNoteModalTitle'), noteModalBody: $('#knowledgeMapNoteModalBody'), noteModalClose: $('#knowledgeMapNoteModalClose'), noteModalDrag: $('#knowledgeMapNoteModalDrag'),
};

let raw = { nodes: [], edges: [] };
const hiddenLegendFilters = new Set();
let adjacency = new Map();
let stageByAsset = new Map();
let renderer;
let simulation;
let loadPromise;
let noteRequestId = 0;
let activeWikiNote = null;

const clean = value => String(value ?? '').trim();
const escapeHtml = value => clean(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const nodeMap = () => new Map(raw.nodes.map(node => [node.id, node]));
const isDarkTheme = () => document.documentElement.dataset.theme === 'dark';
const graphTypeColor = (type) => (isDarkTheme() ? DARK_TYPE_COLOR : TYPE_COLOR)[type] || (isDarkTheme() ? '#9aa8b9' : '#64748b');
const graphStageColor = (stage) => (isDarkTheme() ? DARK_STAGE_COLOR : STAGE_COLOR)[stage] || (isDarkTheme() ? '#9aaabd' : '#94a3b8');
const graphEdgeColor = () => isDarkTheme() ? '#5c6f8a8c' : '#94a3b855';
const graphMutedNodeColor = () => isDarkTheme() ? '#091322d9' : '#cbd5e140';
const graphMutedEdgeColor = () => isDarkTheme() ? '#26364a80' : '#cbd5e120';
const graphFocusedEdgeColor = () => isDarkTheme() ? '#a9c4e8d6' : '#475569c0';

function agentUrl(prompt = '') {
  return `/?openAgent=1&from=graph${prompt ? `&agentPrompt=${encodeURIComponent(prompt)}` : ''}`;
}

function setAgentPrompt(prompt = '') {
  if (!ui.agentLink) return;
  ui.agentLink.dataset.agentPrompt = prompt;
  if (!ui.mapPanel) ui.agentLink.href = agentUrl(prompt);
  ui.agentLink.title = prompt ? '선택 노드 기반으로 All Pipelines Agent 열기' : 'All Pipelines Agent 열기';
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
  const context = `[선택 노드: ${node.type} · ${label}]\n[직접 연결: ${related}]`;
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
  const context = `[선택 노드: ${node.type} · ${label}]\n[직접 연결: ${related}]\n\n`;
  const typePrompt = {
    asset: `${label}의 개발 단계, 경쟁 환경, 근거 수준을 종합해 우선순위와 다음 검토 액션을 제안해줘.`,
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
  setOptions(ui.theme, raw.nodes.filter(node => node.type === 'theme').map(node => node.label));
  setOptions(ui.type, raw.nodes.map(node => node.type));
  setOptions(ui.stage, Object.values(STAGE_LABEL));
  const setFilterLabel = (element, label) => {
    const caption = element?.closest('label')?.querySelector('span');
    if (caption) caption.textContent = label;
  };
  setFilterLabel(ui.search, '키워드 찾기');
  setFilterLabel(ui.theme, '관심 Theme');
  setFilterLabel(ui.type, '중심 엔터티');
  setFilterLabel(ui.stage, 'Pipeline 단계');
  setFilterLabel(ui.depth, '연결 범위');
  if (ui.search) ui.search.placeholder = 'Pipeline · Company · Target · MoA 검색';
  const stageLegend = Object.keys(STAGE_COLOR).map(key => `<button type="button" class="sg-legend-filter" data-legend-kind="stage" data-legend-value="${key}" aria-pressed="true" title="${STAGE_LABEL[key]} 노드 표시/숨기기"><i style="--c:${graphStageColor(key)}"></i>${STAGE_LABEL[key]}</button>`).join('');
  const typeLegend = [...new Set(raw.nodes.filter(node => node.type !== 'asset').map(node => node.type))].slice(0, 6)
    .map(type => `<button type="button" class="sg-legend-filter" data-legend-kind="type" data-legend-value="${escapeHtml(type)}" aria-pressed="true" title="${escapeHtml(type)} 노드 표시/숨기기"><i style="--c:${graphTypeColor(type)}"></i>${escapeHtml(type)}</button>`).join('');
  ui.legend.innerHTML = `<div class="sg-legend-group"><span>Pipeline 단계 · 색상</span>${stageLegend}</div><div class="sg-legend-group"><span>연결 대상 · 표시</span>${typeLegend}</div>`;
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

function selectedGraph() {
  const query = clean(ui.search.value).toLowerCase();
  const type = ui.type.value;
  const theme = ui.theme.value;
  const stage = ui.stage.value;
  const overview = ui.view?.value === 'overview';
  const hasFilter = Boolean(query || type || theme || stage || overview);
  let roots = raw.nodes.filter(node => {
    const searchable = [node.label, node.tags, node.type].join(' ').toLowerCase();
    const nodeStage = node.type === 'asset' ? STAGE_LABEL[stageByAsset.get(node.id) || 'listing'] : '';
    return isLegendVisible(node) && (!query || searchable.includes(query)) && (!type || node.type === type)
      && isRelatedTo(node, 'theme', theme) && (!stage || nodeStage === stage);
  });
  let ids;
  if (overview && !query && !type && !theme && !stage) {
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
    ids = expandNodeIds(roots.map(node => node.id), Number(ui.depth.value || 1));
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

function clearSelection() {
  renderer.setSetting('nodeReducer', null);
  renderer.setSetting('edgeReducer', null);
  ui.inspector.textContent = '노드를 클릭하면 연결된 노드만 강조됩니다.';
  setAgentPrompt();
  if (ui.mapPanel) window.dispatchEvent(new CustomEvent('skbp:knowledge-node-selected', { detail: null }));
  renderer.refresh();
}

function inspectNode(id) {
  const nodes = nodeMap();
  const node = nodes.get(id);
  const neighbors = [...(adjacency.get(id) || [])].map(key => nodes.get(key)).filter(Boolean);
  const focus = new Set([id, ...neighbors.map(item => item.id)]);
  const prompts = recommendedPrompts(node, neighbors);
  publishActiveKnowledgeNode(node, neighbors, prompts);
  setAgentPrompt(prompts[0].prompt);
  ui.inspector.innerHTML = `<div class="kg-node-title"><i style="--c:${graphTypeColor(node.type)}"></i><div><p>${escapeHtml(node.type)}</p><h3>${escapeHtml(node.label)}</h3></div></div><p class="kg-meta"><span>Connections<b>${neighbors.length}</b></span><span>Score<b>${escapeHtml(node.score || '—')}</b></span></p><p class="kg-tags">${escapeHtml(node.tags || 'No tags')}</p><section class="sg-node-note"><div class="sg-note-loading">Markdown 노트를 불러오는 중입니다…</div></section><section class="sg-connected-nodes"><div class="sg-connected-nodes-head">Connected Nodes <b>${neighbors.length}</b></div><div class="sg-connected-nodes-list">${neighbors.slice(0, 18).map(item => `<button type="button" data-node-id="${escapeHtml(item.id)}"><i style="--c:${graphTypeColor(item.type)}"></i><span>${escapeHtml(item.label)}</span><em>${escapeHtml(item.type)}</em></button>`).join('') || '<p>직접 연결된 노드가 없습니다.</p>'}</div></section>`;
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
}

function buildGraph() {
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
  ui.nodes.textContent = data.nodes.length.toLocaleString();
  ui.edges.textContent = data.edges.length.toLocaleString();
  ui.scope.textContent = data.hasFilter
    ? `${data.rootCount.toLocaleString()}개 필터 결과와 ${ui.depth.value} hop 연결망을 표시합니다.`
    : '물리 배치를 계산 중입니다. 노드를 드래그하면 위치를 고정할 수 있습니다.';
  simulation?.stop();
  renderer?.kill();
  renderer = new Sigma(graph, ui.canvas, {
    renderEdgeLabels: false,
    labelRenderedSizeThreshold: 9,
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
        ? `${data.rootCount.toLocaleString()}개 필터 결과 · ${ui.depth.value} hop 연결망 · ${data.nodes.length.toLocaleString()} nodes / ${data.edges.length.toLocaleString()} links`
        : `물리 배치 완료 · ${data.nodes.length.toLocaleString()}개 노드 / ${data.edges.length.toLocaleString()}개 연결 · 드래그로 노드 고정`;
    });

  let dragged;
  renderer.on('downNode', ({ node, event }) => {
    dragged = positions.get(node);
    if (!dragged) return;
    dragged.fx = dragged.x;
    dragged.fy = dragged.y;
    renderer.getCamera().disable();
    simulation.alphaTarget(0.15).restart();
    event?.preventSigmaDefault?.();
  });
  const mouse = renderer.getMouseCaptor();
  mouse.on('mousemovebody', event => {
    if (!dragged) return;
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
  renderer.on('doubleClickNode', ({ node }) => {
    const item = positions.get(node);
    if (!item) return;
    item.fx = null;
    item.fy = null;
    simulation.alpha(0.25).restart();
    ui.scope.textContent = '노드 고정을 해제했습니다. 주변 연결망을 다시 배치합니다.';
  });
  renderer.on('clickNode', ({ node }) => inspectNode(node));
  renderer.on('clickStage', clearSelection);
}

async function load() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
  const response = await fetch('/wiki/13_Graph_Exports/graph.json');
  if (!response.ok) throw Error('graph.json 파일을 찾을 수 없습니다.');
  raw = await response.json();
  prepare();
  buildGraph();
  if (ui.status) ui.status.textContent = `${raw.nodes.length.toLocaleString()} nodes · WebGL physics`;
  })();
  return loadPromise;
}

[ui.search, ui.theme, ui.type, ui.stage, ui.depth, ui.view].filter(Boolean).forEach(element => element.addEventListener(element === ui.search ? 'input' : 'change', buildGraph));
ui.reset.addEventListener('click', () => {
  ui.search.value = '';
  ui.theme.value = '';
  ui.type.value = '';
  ui.stage.value = '';
  ui.depth.value = '1';
  if (ui.view) ui.view.value = 'overview';
  buildGraph();
});
ui.agentLink?.addEventListener('click', (event) => {
  if (!ui.mapPanel) return;
  event.preventDefault();
  launchAgent(ui.agentLink.dataset.agentPrompt || 'Physics Graph에서 탐색한 Pipeline 지식 관계를 분석해줘.');
});
window.initKnowledgeMap = () => load().catch(error => {
  if (ui.status) ui.status.textContent = 'Unavailable';
  ui.canvas.textContent = error.message;
});
window.restartKnowledgeMapPhysics = () => {
  if (!loadPromise) return window.initKnowledgeMap();
  buildGraph();
  return Promise.resolve();
};
new MutationObserver(() => {
  if (loadPromise && !ui.mapPanel?.hidden) buildGraph();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
setupKnowledgeNoteModal();
if (!ui.mapPanel || !ui.mapPanel.hidden) window.initKnowledgeMap();
