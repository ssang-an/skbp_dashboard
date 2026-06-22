import { setupThemeToggle } from './theme.js';

const params = new URLSearchParams(window.location.search);
const recordId = params.get('id');
const DETAIL_CHAT_SESSION_PREFIX = 'skbp.detail.chatSessions.v1';
const DETAIL_CHAT_ACTIVE_PREFIX = 'skbp.detail.activeChatSession.v1';

const elements = {
  title: document.querySelector('#detailTitle'),
  status: document.querySelector('#detailStatus'),
  subtitle: document.querySelector('#detailSubtitle'),
  sourceReportViewer: document.querySelector('#sourceReportViewer'),
  detailOutlineList: document.querySelector('#detailOutlineList'),
  scoreEvidenceSubtitle: document.querySelector('#scoreEvidenceSubtitle'),
  scoreEvidenceStatus: document.querySelector('#scoreEvidenceStatus'),
  scoreEvidenceViewer: document.querySelector('#scoreEvidenceViewer'),
  detailAiButton: document.querySelector('#detailAiButton'),
  criteriaDrawerButton: document.querySelector('#criteriaDrawerButton'),
  criteriaDrawer: document.querySelector('#criteriaDrawer'),
  criteriaBackdrop: document.querySelector('#criteriaBackdrop'),
  criteriaDrawerClose: document.querySelector('#criteriaDrawerClose'),
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

let currentRecord = null;
let currentRecordId = recordId;
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
  return !value.trim() || /no theme|no cluster|no mapped|none|미해당/.test(value);
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
    return '<div class="empty-evidence">연결된 출처 링크가 없습니다. 원문 리포트 또는 evidence_sources에 URL을 추가하면 여기에 표시됩니다.</div>';
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

function renderCompanyProfile(profile = {}) {
  const officialSources = Array.isArray(profile.official_source_urls) ? profile.official_source_urls : [];
  const focusAreas = Array.isArray(profile.focus_areas) && profile.focus_areas.length ? profile.focus_areas.join(', ') : '-';
  const aliases = Array.isArray(profile.aliases) && profile.aliases.length ? profile.aliases.join(', ') : '-';
  const signals = Array.isArray(profile.financing_or_partnership_signals) && profile.financing_or_partnership_signals.length
    ? profile.financing_or_partnership_signals
        .map((signal) => `<li>${escapeHtml(signal.summary || signal.title || JSON.stringify(signal))}</li>`)
        .join('')
    : '<li>확인된 financing / partnership signal 없음</li>';

  return `
    <section class="company-profile-card">
      <div class="score-card-header">
        <div>
          <span>Company Profile</span>
          <h3>${escapeHtml(profile.company_name || '-')}</h3>
        </div>
        ${profile.website ? `<strong><a href="${escapeHtml(profile.website)}" target="_blank" rel="noreferrer">Official website</a></strong>` : '<strong>Official website 필요</strong>'}
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
            <h4>출처 / 웹페이지 링크</h4>
            ${renderSourceList(item.evidence_sources)}
          </div>
        </article>
      `;
    })
    .join('');

  return `
    ${renderCompanyProfile(record.company_profile || {})}
    <div class="score-evidence-summary">
      <div><span>Total Score</span><strong>${escapeHtml(formatScore(scoring.total_score))} / ${escapeHtml(formatScore(scoring.max_score || 21))}</strong></div>
      <div><span>Hard Filter</span><strong title="${escapeHtml(hardFilter.reason)}">${escapeHtml(hardFilter.status)}</strong></div>
      <div><span>Filter Reason</span><strong>${escapeHtml(hardFilter.reason)}</strong></div>
      <div><span>Rubric</span><strong>${escapeHtml(record.meta?.rubric_version || '1.0')} · ${escapeHtml(record.meta?.rubric_author || 'kate')}</strong></div>
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
  const sourceReport = record.source_report || {};
  const rawMarkdown = isPlaceholderRawMarkdown(sourceReport.raw_markdown) ? '' : sourceReport.raw_markdown;
  elements.sourceReportViewer.innerHTML = rawMarkdown
    ? renderMarkdown(sourceReport.raw_markdown)
    : renderMarkdown(buildReadableSourceReport(record));
  renderDetailOutline();
  elements.scoreEvidenceViewer.innerHTML = renderScoreEvidence(record);
  elements.scoreEvidenceStatus.textContent = 'Loaded';
  elements.scoreEvidenceSubtitle.textContent = `${scoringLabels.target_relevance}부터 Marketability까지 점수별 근거를 표시합니다.`;
}

function buildReadableSourceReport(record) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const scoring = record.scoring || {};
  const finalInsight = record.final_insight || {};
  return `## ${summary.company || table.company || 'Company'} Lead Pipeline 분석: **${summary.asset_name || table.asset_name || 'Asset'}**

## 1. 한 줄 결론

**${finalInsight.one_line_summary || summary.one_line_summary || '-'}**

제 판단상 Shortlist 관점 점수는 **${scoring.total_score ?? '-'} / ${scoring.max_score ?? 21}점**입니다.

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
| Theme fit | ${summary.theme || table.theme || '-'} |
| Cluster | ${summary.cluster || table.cluster || '-'} |

## 3. 핵심 과학적 포인트

${table.moa || '-'}

## 4. SKBP Theme / Cluster 적합성

Theme: **${summary.theme || table.theme || '-'}**  
Cluster: **${summary.cluster || table.cluster || '-'}**

## 5. SKBP Pipeline Finder식 점수

| Criteria | Score | 판단 |
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
  if (!changes.length) return '변경 항목 없음';
  return changes.map((change) => `• ${change}`).join('\n');
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
  return summary.asset_name || table.asset_name || currentRecordId || '이 asset';
}

function defaultDetailChatText() {
  return `${currentAssetLabel()} record를 불러왔습니다. 점수 근거, 리스크, 시장성, 경쟁 상황에 대해 질문할 수 있습니다.`;
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
      <strong>근거 수정 초안</strong>
      <pre>${escapeHtml(summarizeDraftChanges(options.draftChanges))}</pre>
      <div class="draft-actions">
        <button type="button" data-action="apply-draft">초안 적용</button>
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
      <button type="button" data-action="apply-ai-reply">이 답변을 JSON에 반영</button>
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
  if (userQuestionCount === 0 || /^새 대화|Asset evidence$/i.test(session.title || '')) {
    session.title = sessionTitleFromQuestion(question);
    session.updatedAt = new Date().toISOString();
    saveChatSessions();
    renderChatSessionControls();
  }
}

function createAiReplyJsonDraft(button) {
  if (!currentRecord) return;
  const bubble = button.closest('.agent-message');
  const replyText = bubble?.querySelector('.agent-message-text')?.innerText?.trim();
  if (!replyText) return;

  const nextRecord = structuredClone(currentRecord);
  nextRecord.ai_revision_draft = {
    created_at: new Date().toISOString(),
    source: 'detail_ai_chat',
    instruction: 'Review this AI answer and selectively merge validated updates into the canonical schema fields.',
    answer_markdown: replyText
  };
  pendingDraftRecord = nextRecord;
  reviewPendingDraft();
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
  const nextUrl = `/detail?id=${encodeURIComponent(currentRecordId)}`;
  window.history.replaceState(null, '', nextUrl);
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
  const confirmed = window.confirm(`${asset} · ${company} record를 삭제할까요?\n\njson/pipeline-records.json에서 제거되고 Obsidian MD도 재생성됩니다.`);
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
    window.location.href = '/';
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
    elements.editStatus.textContent = '포맷 완료';
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
    addMessage('assistant', '수정 초안을 JSON 원본에 저장했습니다. 왼쪽 JSON 보기와 메인 대시보드 점수도 이 값 기준으로 갱신됩니다.');
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
      updateMessage(bubble, text || '관련 wiki note를 찾았습니다. 답변을 생성 중입니다...', { sources });
    }
    if (parsed.event === 'status' && !text) {
      updateMessage(bubble, parsed.data?.message || '답변 생성 중입니다...', { sources });
    }
    if (parsed.event === 'delta') {
      text += parsed.data?.text || '';
      updateMessage(bubble, text, { sources });
    }
    if (parsed.event === 'done') {
      completed = true;
      updateMessage(bubble, text || '답변이 비어 있습니다. 다시 질문해 주세요.', { done: true, sources });
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
  if (!completed) updateMessage(bubble, text || '답변이 비어 있습니다. 다시 질문해 주세요.', { done: true, sources });
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
    submitButton.textContent = '답변 중';
  }
  const responseBubble = addMessage('assistant', '질문 분석 중...', { pending: true });

  try {
    await streamDetailChatReply(message, responseBubble);
  } catch (error) {
    updateMessage(responseBubble, `채팅 응답 오류: ${error.message}`, { done: true });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '질문';
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

loadRecord().catch((error) => {
  elements.status.textContent = 'Load failed';
  elements.sourceReportViewer.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  elements.scoreEvidenceViewer.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  elements.scoreEvidenceStatus.textContent = 'Failed';
});
