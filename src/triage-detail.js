import { setupThemeToggle } from './theme.js';

import { getCurrentUser, initAuthUI } from './auth.js?v=20260802-required-login-1';

const params = new URLSearchParams(window.location.search);
const recordId = params.get('id');
let currentRecord = null;

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
  deleteRecordButton: document.querySelector('#triageDeleteRecordButton')
};

const scoreDefinitions = [
  {
    key: 'target_relevance',
    shortLabel: 'TR',
    label: 'Target Area Relevance',
    description: 'SKBP 우선 관심 적응증 및 R&D Theme/Cluster와의 적합성'
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
  const baseline = override || record?.hard_filter?.status || record?.triage?.status || 'UNVERIFIED';
  const status = String(baseline).trim().toUpperCase();
  if (status === 'N/A') return 'UNVERIFIED';
  return ['SELECT', 'REJECT', 'UNVERIFIED'].includes(status) ? status : 'UNVERIFIED';
}

function identityIsVerified(record) {
  const parserStatus = String(record?.source_report?.parser_status || '');
  return record?.triage?.identity_verified !== false
    && reviewStatus(record) !== 'UNVERIFIED'
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
  return Boolean(user?.is_admin && note?.author_id && String(note.author_id) === String(user.id || ''));
}

function canDeleteFinalComment(record) {
  const user = getCurrentUser();
  const ownerId = textValue(objectValue(objectValue(record?.meta).human_review).final_comment_author_id, '');
  return Boolean(user?.is_admin && ownerId && ownerId === String(user.id || ''));
}

function renderDecision(record) {
  const status = reviewStatus(record);
  const triage = record.triage || {};
  const summary = record.json_summary || {};
  const finalInsight = record.final_insight || {};
  const headline = displayValue(
    finalInsight.one_line_summary || summary.one_line_summary || triage.why,
    'Fast Triage 판단 요약이 없습니다.'
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
    || triageStatus === 'UNVERIFIED'
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
        <article class="triage-score-note">
          ${currentUserCanDeleteNote(note) ? `<button type="button" class="triage-note-delete" data-triage-score-note-delete data-note-id="${escapeHtml(note.id)}" aria-label="내 코멘트 삭제" title="내 코멘트 삭제">×</button>` : ''}
          <p>${escapeHtml(note.body || '')}</p>
          <small>${escapeHtml(note.author_name || 'Team member')} · ${escapeHtml(formatTimestamp(note.updated_at || note.created_at))}</small>
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
  const canManage = currentUserIsAdmin();
  if (!finalComment && !canManage) return '';
  return `
    <section class="triage-final-comment${finalComment ? ' has-comment' : ''}" aria-label="최종 코멘트">
      ${finalComment ? `<article class="triage-score-note triage-final-comment-note">
        ${canDeleteFinalComment(record) ? '<button type="button" class="triage-note-delete" data-triage-final-comment-delete aria-label="내 최종 코멘트 삭제" title="내 최종 코멘트 삭제">×</button>' : ''}
        <p>${escapeHtml(finalComment)}</p>
        <small>${escapeHtml(authorName)}${updatedAt ? ` · ${escapeHtml(formatTimestamp(updatedAt))}` : ''}</small>
      </article>` : ''}
      ${canManage ? `
        <button type="button" class="triage-note-trigger" data-triage-final-comment-open>${finalComment ? '최종 코멘트 수정' : '＋ 최종 코멘트 입력'}</button>
        <form class="triage-inline-note-form" data-triage-final-comment-form hidden>
          <textarea rows="3" maxlength="4000" placeholder="최종 판단에 대한 관리자 의견을 남겨주세요." aria-label="최종 코멘트">${escapeHtml(finalComment)}</textarea>
          <div><span data-triage-final-comment-status></span><button type="button" data-triage-final-comment-cancel>취소</button><button type="submit">저장</button></div>
        </form>
      ` : ''}
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
    ${renderListBlock('Full Scout에서 추가할 근거', missing, 'missing')}
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
  const rescoredAt = meta.rescored_at ? formatTimestamp(meta.rescored_at) : null;
  const reviewedAt = meta.rubric_reviewed_at ? formatTimestamp(meta.rubric_reviewed_at) : null;
  const rows = [
    ['Triage status', status],
    ['Rubric version', meta.rubric_version || triage.instruction_version || meta.schema_version],
    ['Generated at', meta.generated_at],
    ['Identity verified', identityIsVerified(record) ? 'Yes' : 'Needs review'],
    ['Parser status', sourceReport.parser_status],
    [
      'Verified public sources',
      String(Number.isInteger(triage.verified_public_source_count)
        ? triage.verified_public_source_count
        : verifiedCriterionUrls.size)
    ]
  ];
  if (rescoredAt && meta.rescored_rubric_version) {
    rows.push(
      ['Recalculated at', rescoredAt],
      ['Rubric used to recalculate', meta.rescored_rubric_version]
    );
  } else if (reviewedAt && meta.rubric_reviewed_version) {
    rows.push(
      ['Latest rubric reviewed at', reviewedAt],
      ['Rubric used for review', meta.rubric_reviewed_version],
      ['Review result', meta.rubric_review_result === 'no_change' ? 'No score change' : 'No applicable score change']
    );
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
    ${renderTriageReviewHistory(record)}
  `;
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
  const resetSuffix = triageRubricResetSuffix(record, entry);
  const labels = {
    'scores.target_relevance': 'TR 점수',
    'scores.moa_validity': 'MoA 점수',
    'scores.data_maturity': 'Data 점수',
    total_score: 'Total score',
    final_comment: entry?.source === 'detail_final_comment_delete' ? '최종 코멘트 삭제' : '최종 코멘트'
  };
  if (labels[field]) return resetSuffix ? `${labels[field]} · ${resetSuffix}` : labels[field];
  if (field.startsWith('topic_notes.triage-score-')) {
    return entry?.source === 'detail_topic_note_delete' ? '기준별 코멘트 삭제' : '기준별 코멘트 입력';
  }
  if (field === 'filter_status') return resetSuffix ? `Triage status · ${resetSuffix}` : 'Triage status';
  return field || 'Fast Triage 검토';
}

function triageHistoryValue(value) {
  if (value === null || value === undefined || value === '') return 'Auto';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function renderTriageReviewHistory(record) {
  const history = arrayValue(objectValue(record?.meta).edit_history);
  if (!history.length) return '';
  const items = history
    .slice(-20)
    .reverse()
    .map((entry) => {
      const when = formatTimestamp(entry?.changed_at);
      const who = entry?.actor_name || entry?.actor_ip || 'Local workspace';
      const label = triageHistoryLabel(record, entry);
      const change = `${triageHistoryValue(entry?.previous_value)} → ${triageHistoryValue(entry?.new_value)}`;
      return `<li${entry?.actor_name ? ' class="is-human"' : ''}>
        <span>${escapeHtml(when)}</span>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(who)} · ${escapeHtml(change)}</small>
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
  elements.title.textContent = `Fast Triage : ${asset}`;
  elements.subtitle.textContent = `${company} · ${displayValue(table.development_stage)} · ${theme} / ${cluster}`;
  document.title = `${asset} · Fast Triage`;
  renderDecision(record);
  renderIdentity(record);
  renderScores(record);
  renderSources(record);
  renderDiligence(record);
  renderQuickSummary(record);

  const rawMarkdown = String(record?.source_report?.raw_markdown || '').trim();
  elements.rawReport.innerHTML = rawMarkdown
    ? renderMarkdown(rawMarkdown)
    : '<div class="triage-empty">저장된 Fast Triage 원본 Markdown이 없습니다.</div>';
}

async function updateTriageManualReview(payload) {
  const response = await fetch(`/api/records/${encodeURIComponent(recordId)}/manual-review`, {
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

async function saveTriageScore(select) {
  const criterion = String(select.dataset.criterion || '');
  const value = Number(select.value);
  const previousValue = scoreFor(currentRecord, criterion);
  if (!criterion || !Number.isInteger(value)) return;
  select.disabled = true;
  try {
    await updateTriageManualReview({ kind: 'score', criterion, value, previous_value: previousValue });
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

async function saveTriageScoreNote(panel, body) {
  const response = await fetch(`/api/records/${encodeURIComponent(recordId)}/topic-notes`, {
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
  if (!response.ok) throw new Error(data.detail || '코멘트를 저장하지 못했습니다.');
  currentRecord = data.record;
  renderRecord(currentRecord);
}

async function deleteTriageScoreNote(noteId) {
  const response = await fetch(`/api/records/${encodeURIComponent(recordId)}/topic-notes/${encodeURIComponent(noteId)}`, {
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
    const triageSections = [...dashboardBody.children]
      .filter((section) => section.dataset.criteriaTab === 'triage');
    if (!triageSections.length) throw new Error('Dashboard Tab 1 판단근거가 비어 있습니다.');
    const fragment = document.createDocumentFragment();
    triageSections.forEach((section) => fragment.append(section.cloneNode(true)));
    elements.criteriaDrawerBody.replaceChildren(fragment);
    elements.criteriaDrawer.dataset.activeCriteriaTab = 'triage';
  })().catch((error) => {
    criteriaDrawerSyncPromise = null;
    throw error;
  });
  return criteriaDrawerSyncPromise;
}

async function openCriteriaDrawer() {
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
    `${asset} · ${company} Fast Triage record를 삭제할까요?\n\n저장된 대시보드 레코드와 연결된 Obsidian 문서가 함께 갱신됩니다.`
  );
  if (!confirmed) return;

  elements.loadStatus.textContent = 'Deleting';
  elements.deleteRecordButton.disabled = true;
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(recordId)}`, {
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

async function loadRecord() {
  if (!recordId) throw new Error('Fast Triage record id가 없습니다.');
  const response = await fetch(`/api/records/${encodeURIComponent(recordId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  renderRecord(data.record);
  elements.loadStatus.textContent = 'Loaded';
}

elements.criteriaDrawerButton?.addEventListener('click', openCriteriaDrawer);
elements.criteriaDrawerClose?.addEventListener('click', closeCriteriaDrawer);
elements.criteriaBackdrop?.addEventListener('click', closeCriteriaDrawer);
elements.deleteRecordButton?.addEventListener('click', deleteCurrentRecord);
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
    openTriageInlineForm(panel.querySelector('[data-triage-score-note-form]'));
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
    if (!noteId || !window.confirm('이 코멘트를 삭제할까요?')) return;
    deleteTriageScoreNote(noteId).catch((error) => window.alert(error.message));
  }
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
    await saveTriageScoreNote(panel, body);
  } catch (error) {
    if (status) status.textContent = error.message;
  } finally {
    if (submit) submit.disabled = false;
  }
});
elements.quickSummary?.addEventListener('click', (event) => {
  if (event.target.closest('[data-triage-final-comment-open]')) {
    openTriageInlineForm(elements.quickSummary.querySelector('[data-triage-final-comment-form]'));
    return;
  }
  if (event.target.closest('[data-triage-final-comment-cancel]')) {
    const form = elements.quickSummary.querySelector('[data-triage-final-comment-form]');
    if (form) form.hidden = true;
  }
  if (event.target.closest('[data-triage-final-comment-delete]')) {
    if (!window.confirm('최종 코멘트를 삭제할까요?')) return;
    updateTriageManualReview({ kind: 'final_comment_delete' }).catch((error) => window.alert(error.message));
  }
});
elements.quickSummary?.addEventListener('submit', async (event) => {
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
    await updateTriageManualReview({ kind: 'final_comment', value });
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
initAuthUI();
syncCriteriaDrawerFromDashboard().catch((error) => {
  console.warn('Dashboard 판단근거 사전 로드 실패:', error);
});
loadRecord().catch((error) => {
  elements.loadStatus.textContent = 'Load failed';
  elements.title.textContent = 'Fast Triage : Load failed';
  elements.subtitle.textContent = error.message;
  elements.decisionHero.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
