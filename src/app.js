const API_URL = '/api/records';
const PAGE_SIZE = 10;

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
  selectedIds: new Set()
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
  searchInput: document.querySelector('#searchInput'),
  stageFilter: document.querySelector('#stageFilter'),
  themeFilter: document.querySelector('#themeFilter'),
  countryFilter: document.querySelector('#countryFilter'),
  passFilter: document.querySelector('#passFilter'),
  tableCount: document.querySelector('#tableCount'),
  selectPageRows: document.querySelector('#selectPageRows'),
  deleteSelectedButton: document.querySelector('#deleteSelectedButton'),
  pipelineTable: document.querySelector('#pipelineTable'),
  pageInfo: document.querySelector('#pageInfo'),
  prevPage: document.querySelector('#prevPage'),
  nextPage: document.querySelector('#nextPage'),
  rawReportInput: document.querySelector('#rawReportInput'),
  structuredJsonInput: document.querySelector('#structuredJsonInput'),
  previewInputButton: document.querySelector('#previewInputButton'),
  saveJsonButton: document.querySelector('#saveJsonButton'),
  clearJsonButton: document.querySelector('#clearJsonButton'),
  saveStatus: document.querySelector('#saveStatus'),
  copyPromptButton: document.querySelector('#copyPromptButton'),
  promptCopyStatus: document.querySelector('#promptCopyStatus')
};

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
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill ${tone}" style="width:${width}%"></div></div>
      <strong>${value}</strong>
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
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * PAGE_SIZE;
  const pageRows = visibleRows.slice(start, start + PAGE_SIZE);

  elements.tableCount.textContent = `${visibleRows.length} items · 10 rows/page`;
  elements.pipelineTable.innerHTML = pageRows.length
    ? pageRows
        .map((row) => {
          const filterClass = row.hardFilter === 'PASS' ? 'pill pass' : row.hardFilter === 'FAIL' ? 'pill fail' : 'pill review';
          const checked = state.selectedIds.has(row.id) ? 'checked' : '';
          return `
            <tr class="clickable-row" data-record-id="${escapeHtml(row.id)}" title="${escapeHtml(row.summary)}">
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
            </tr>
          `;
        })
        .join('')
    : '<tr><td colspan="15" class="empty-cell">조건에 맞는 데이터가 없습니다.</td></tr>';

  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateSelectionControls(pageRows);
}

function updateSelectionControls(pageRows = null) {
  const visibleRows = pageRows || getVisibleRows().slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
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
  renderMetrics();
  renderCharts();
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
    'Record ID'
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
    row.id
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

function addAgentMessage(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `agent-message ${role}`;
  bubble.innerHTML = `
    <strong>${role === 'user' ? 'You' : 'AI Agent'}</strong>
    <p>${escapeHtml(text)}</p>
  `;
  elements.agentMessages.appendChild(bubble);
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
    elements.promptCopyStatus.textContent = '복사 완료';
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
    elements.promptCopyStatus.textContent = '복사 완료';
  }
}

document.querySelectorAll('[data-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
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
  });
});

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
  updateSelectionControls();
});

elements.selectPageRows.addEventListener('change', (event) => {
  const visibleRows = getVisibleRows();
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * PAGE_SIZE;
  const pageRows = visibleRows.slice(start, start + PAGE_SIZE);
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

elements.agentForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = elements.agentInput.value.trim();
  if (!question) return;
  elements.agentInput.value = '';
  addAgentMessage('user', question);
  addAgentMessage('assistant', mockAgentReply(question));
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
elements.copyPromptButton.addEventListener('click', copyPromptToClipboard);

loadRecords().catch((error) => {
  elements.dataStatus.textContent = 'Load failed';
  elements.saveStatus.textContent = error.message;
});
