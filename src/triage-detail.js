import { setupThemeToggle } from './theme.js';

const params = new URLSearchParams(window.location.search);
const recordId = params.get('id');

const elements = {
  title: document.querySelector('#triageDetailTitle'),
  subtitle: document.querySelector('#triageDetailSubtitle'),
  loadStatus: document.querySelector('#triageDetailLoadStatus'),
  decisionHero: document.querySelector('#triageDecisionHero'),
  identityGrid: document.querySelector('#triageIdentityGrid'),
  scoreGrid: document.querySelector('#triageScoreGrid'),
  sourceList: document.querySelector('#triageSourceList'),
  diligence: document.querySelector('#triageDiligence'),
  quickSummary: document.querySelector('#triageQuickSummary'),
  rawReport: document.querySelector('#triageRawReport')
};

const scoreDefinitions = [
  {
    key: 'target_relevance',
    shortLabel: 'TR',
    label: 'Target Relevance',
    description: 'SKBP 관심 Theme·Cluster와 표적 생물학의 직접 연결성'
  },
  {
    key: 'moa_validity',
    shortLabel: 'MoA',
    label: 'MoA Validity',
    description: '작용기전의 과학적·임상적 타당성과 검증 수준'
  },
  {
    key: 'data_maturity',
    shortLabel: 'Data',
    label: 'Data Maturity',
    description: '공개된 정량 데이터와 개발 근거의 성숙도'
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

function listValues(value) {
  return Array.isArray(value) ? value.map((item) => displayValue(item, '')).filter(Boolean) : [];
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

function renderInlineMarkdown(value) {
  return escapeHtml(repairMojibake(value))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>');
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
  const lines = repairMojibake(markdown).replace(/\r\n/g, '\n').split('\n');
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
  const baseline = override || record?.hard_filter?.status || record?.triage?.status || 'N/A';
  const status = String(baseline).trim().toUpperCase();
  return ['SELECT', 'REJECT', 'N/A'].includes(status) ? status : 'N/A';
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
      <span>${triage.identity_verified === true ? 'Asset identity verified' : 'Asset identity 확인 필요'}</span>
    </div>
    <h2>${escapeHtml(headline)}</h2>
    <p>${escapeHtml(reason)}</p>
  `;
}

function identityFields(record) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
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
    ['Theme', summary.theme],
    ['Cluster', summary.cluster]
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

function criterionSources(criterion) {
  const sources = Array.isArray(criterion?.evidence_sources) ? criterion.evidence_sources : [];
  return sources
    .map((source) => typeof source === 'string' ? source : source?.source_url)
    .map(safeHttpUrl)
    .filter(Boolean);
}

function renderScores(record) {
  elements.scoreGrid.innerHTML = scoreDefinitions.map((definition) => {
    const criterion = record?.scoring?.criteria?.[definition.key] || {};
    const score = scoreFor(record, definition.key);
    const evidenceSources = criterionSources(criterion);
    const uncertainties = listValues(criterion.uncertain_points);
    return `
      <article class="triage-score-card score-${score ?? 'unknown'}">
        <div class="triage-score-card-header">
          <div>
            <span>${definition.shortLabel}</span>
            <h3>${definition.label}</h3>
          </div>
          <strong>${score ?? '-'}<small>/3</small></strong>
        </div>
        <div class="triage-score-track" aria-label="${definition.label} ${score ?? 'Unknown'} out of 3">
          ${[1, 2, 3].map((step) => `<i class="${score >= step ? 'filled' : ''}"></i>`).join('')}
        </div>
        <p class="triage-score-definition">${definition.description}</p>
        <p class="triage-score-judgment">${escapeHtml(displayValue(criterion.main_line_summary || criterion.reason, '판단 요약 없음'))}</p>
        <div class="triage-score-meta">
          <span>${escapeHtml(displayValue(criterion.evidence_type, 'Evidence type unknown'))}</span>
          <span>${evidenceSources.length} sources</span>
        </div>
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
      </article>
    `;
  }).join('');
}

function collectSources(record) {
  const sources = [];
  const add = (source) => {
    if (!source) return;
    if (typeof source === 'string') {
      const url = safeHttpUrl(source);
      if (url) sources.push({ source_url: url });
      return;
    }
    const url = safeHttpUrl(source.source_url || source.url);
    if (url) sources.push({ ...source, source_url: url });
  };

  (record?.structured_table?.sources || []).forEach(add);
  (record?.validation?.source_registry || []).forEach(add);
  Object.values(record?.scoring?.criteria || {}).forEach((criterion) => {
    (criterion?.evidence_sources || []).forEach(add);
  });

  const deduplicated = new Map();
  sources.forEach((source) => {
    const existing = deduplicated.get(source.source_url) || {};
    deduplicated.set(source.source_url, { ...existing, ...source });
  });
  return [...deduplicated.values()];
}

function renderSources(record) {
  const sources = collectSources(record);
  if (!sources.length) {
    elements.sourceList.innerHTML = '<div class="triage-empty">연결된 공개 출처가 없습니다.</div>';
    return;
  }
  elements.sourceList.innerHTML = sources.map((source, index) => {
    const url = source.source_url;
    const title = displayValue(source.source_title, hostnameFor(url));
    const sourceType = displayValue(source.source_type, 'public source');
    const reliability = displayValue(source.reliability, 'reliability unknown');
    const summary = displayValue(source.evidence_summary, '출처 링크에서 세부 내용을 확인하세요.');
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
  const triage = record.triage || {};
  const validation = record.validation || {};
  const finalInsight = record.final_insight || {};
  const missing = listValues(triage.missing_evidence_needed_for_full_scout);
  const verified = listValues(validation.cross_checked_facts);
  const uncertain = listValues(validation.uncertain_points);
  const question = displayValue(finalInsight.most_important_diligence_question, '');
  const recommendation = displayValue(finalInsight.recommendation, '');
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
      ? '<div class="triage-empty">추가 diligence 항목이 기록되지 않았습니다.</div>'
      : ''}
  `;
}

function renderQuickSummary(record) {
  const meta = record.meta || {};
  const sourceReport = record.source_report || {};
  const triage = record.triage || {};
  const status = reviewStatus(record);
  const sources = collectSources(record);
  const flags = listValues(record.hard_filter?.flags);
  const lastEditedAt = meta.last_edited_at ? formatTimestamp(meta.last_edited_at) : null;
  const rows = [
    ['Triage status', status],
    ['Rubric version', meta.rubric_version || triage.instruction_version || meta.schema_version],
    ['Generated at', meta.generated_at],
    ['Identity verified', triage.identity_verified === true ? 'Yes' : 'Needs review'],
    ['Parser status', sourceReport.parser_status],
    ['Public sources', String(sources.length)]
  ];
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
    ${flags.length ? `
      <div class="triage-flag-list">
        <span>Flags</span>
        <div>${flags.map((flag) => `<b>${escapeHtml(flag.replaceAll('_', ' '))}</b>`).join('')}</div>
      </div>
    ` : ''}
    ${renderEditHistoryBlock(record)}
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
      const who = entry?.actor_ip || 'unknown';
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
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const asset = displayValue(summary.asset_name || table.asset_name, 'Pipeline');
  const company = displayValue(summary.company || table.company, 'Company unknown');
  elements.title.textContent = `Fast Triage : ${asset}`;
  elements.subtitle.textContent = `${company} · ${displayValue(table.development_stage)} · ${displayValue(summary.theme)} / ${displayValue(summary.cluster)}`;
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

async function loadRecord() {
  if (!recordId) throw new Error('Fast Triage record id가 없습니다.');
  const response = await fetch(`/api/records/${encodeURIComponent(recordId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  renderRecord(data.record);
  elements.loadStatus.textContent = 'Loaded';
}

setupThemeToggle();
loadRecord().catch((error) => {
  elements.loadStatus.textContent = 'Load failed';
  elements.title.textContent = 'Fast Triage : Load failed';
  elements.subtitle.textContent = error.message;
  elements.decisionHero.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
