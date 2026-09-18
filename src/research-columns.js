// Read-only research views: keep the report's claims distinct from market totals.
const at = (record, path) => path.split('.').reduce((value, key) => value?.[key], record);
const list = (value) => Array.isArray(value) ? value : [];

export function researchText(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(researchText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => `${key}: ${researchText(item)}`).join('; ');
  }
  return String(value);
}

const common = [
  { key: 'researchSummary', label: 'Research summary', path: 'final_insight.one_line_summary', description: '이 약물에 대한 조사 핵심 결론' },
  { key: 'recommendation', label: 'AI assessment', path: 'final_insight.recommendation', description: '보고서의 AI 검토 의견. 사람의 최종 의사결정과 구분됩니다.' },
  { key: 'diligenceQuestion', label: 'Key diligence question', path: 'final_insight.most_important_diligence_question', description: '다음 미팅·자료 요청에서 가장 먼저 확인할 질문' },
  { key: 'moa', label: 'Mechanism of action', path: 'structured_table.moa', description: '약물이 작용하는 방식' },
  { key: 'dataEvidence', label: 'Key data evidence', path: 'scoring.criteria.data_maturity.main_line_summary', description: '데이터 성숙도 판단에 사용된 핵심 연구 결과' },
  { key: 'uncertainPoints', label: 'Evidence gaps', path: 'validation.uncertain_points', description: '확인되지 않았거나 추가 검증이 필요한 정보 전체' }
];

// Detailed evidence remains available in exports without widening the dashboard table.
const exportOnlyColumns = [
  { key: 'allSources', label: 'Research sources' },
  { key: 'peerContext', label: 'Peer comparison evidence' }
];

export const FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS = [
  ...common,
  { key: 'headquarters', label: 'Headquarters', path: 'company_profile.headquarters', description: '회사 본사 소재지' },
  { key: 'companyStage', label: 'Company stage', path: 'company_profile.company_stage', description: '회사 유형·성장 단계' },
  { key: 'platformSummary', label: 'Platform summary', path: 'company_profile.platform_summary', description: '회사의 기술 플랫폼 요약' },
  { key: 'competitiveDensity', label: 'Competition assessment', path: 'competitive_analysis.competitive_density', description: '보고서에서 판단한 경쟁 밀도' },
  { key: 'similarCount', label: 'Peer count in report', path: 'competitive_analysis.similarity_summary.similar_pipeline_count', description: '이번 보고서가 기록한 비교 후보 수. 시장 전체 약물 수 또는 검색 완전성을 뜻하지 않습니다.' },
  { key: 'peerNames', label: 'Peer drugs in report', description: '경쟁 비교표의 약물명·회사. 비교표가 없으면 유사 파이프라인 목록을 표시합니다.' },
  { key: 'differentiation', label: 'Competitive differentiation', path: 'scoring.criteria.competitive_landscape.main_line_summary', description: '평가 약물의 비교 우위 또는 경쟁상 한계에 대한 판단 근거' },
  { key: 'comExpiryYear', label: 'CoM base expiry year', path: 'ip_launch_outlook.com_expiry_year', description: '예상 물질특허 기본 만료연도. PTA/PTE 연장·용도·제형 특허 제외. 국가·근거는 원문 확인.' },
  { key: 'expectedLaunchYear', label: 'Expected launch year', path: 'ip_launch_outlook.expected_launch_year', description: '예상 출시연도. 확정 일정이 아니며 국가·회사 가이던스/외부 전망/내부 추정 여부는 근거에서 확인.' }
];

export const FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS = [
  ...common,
  { key: 'verifiedSourceCount', label: 'Verified source count', path: 'triage.verified_public_source_count', description: '보고서에 검증된 것으로 등록된 공개 출처 수' },
  { key: 'triageWhy', label: 'Screening rationale', path: 'triage.why', description: 'SELECT / REJECT / INSUFFICIENT 판정 이유' },
  { key: 'fullScoutEvidence', label: 'Evidence needed next', path: 'triage.missing_evidence_needed_for_full_scout', description: 'Advanced Research 진행 전에 확보할 근거 전체' }
];

const columnOrders = {
  triage: ['researchSummary', 'triageWhy', 'moa', 'dataEvidence', 'uncertainPoints', 'verifiedSourceCount', 'diligenceQuestion', 'fullScoutEvidence', 'recommendation'],
  full: ['researchSummary', 'moa', 'dataEvidence', 'uncertainPoints', 'differentiation', 'competitiveDensity', 'peerNames', 'similarCount', 'comExpiryYear', 'expectedLaunchYear', 'platformSummary', 'companyStage', 'headquarters', 'diligenceQuestion', 'recommendation']
};
for (const [mode, columns] of [['triage', FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS], ['full', FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS]]) {
  columns.sort((a, b) => columnOrders[mode].indexOf(a.key) - columnOrders[mode].indexOf(b.key));
}

export const RECOMMENDED_RESEARCH_COLUMNS = {
  triage: ['dataEvidence', 'moa', 'diligenceQuestion', 'fullScoutEvidence'],
  full: ['diligenceQuestion', 'moa', 'dataEvidence', 'uncertainPoints', 'researchSummary', 'differentiation']
};

// Original Markdown remains authoritative. Extract only explicitly labelled
// subject-asset fields, never a patent publication year or a competitor's launch.
export function ipLaunchAssessment(record, key) {
  const field = key === 'comExpiryYear' ? 'com_expiry_year' : 'expected_launch_year';
  const original = String(record?.source_report?.raw_markdown || '');
  const markdown = original.split(/^##\s+(?:AI Agent Revision Note|References|Sources|참고문헌|출처)\b/im)[0];
  const com = key === 'comExpiryYear';
  const labelPattern = com
    ? /^(?:Expected\s+)?(?:CoM|Patent)\s+(?:Base\s+)?Expir(?:y|ation)(?:\s+(?:Year|Date))?|^(?:예상\s*)?(?:CoM|물질특허|특허)\s*(?:기본\s*)?만료(?:연도|일)?/i
    : /^(?:Expected|Estimated|Anticipated)\s+(?:Commercial\s+)?Launch\s+(?:Year|Date|Timing)|^(?:예상\s*)?출시\s*(?:예상\s*)?(?:연도|시기|일정)/i;
  const candidates = [];
  let section = '';
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) section = line;
    if (/competitor|competitive|peer|경쟁|비교/i.test(section)) continue;
    if (/^\s*\[\d+\]:/.test(line)) continue;
    const cells = line.replace(/[*`]/g, '').trim().replace(/^\|/, '').split('|').map(v => v.trim());
    const label = cells[0].replace(/^[-#\s]+/, '');
    if (labelPattern.test(label)) {
      candidates.push({ line, label, value: cells.length > 1 ? cells[1] : label.replace(labelPattern, '').replace(/^\s*[:：-]\s*/, '') });
    }
  }
  const inputIssues = list(record?.validation?.uncertain_points).filter(v => typeof v === 'string' && v.startsWith(`ip_launch_outlook.${field}:`));
  const context = candidates.map(item => item.line).join('\n');
  const basis = [context, ...inputIssues].filter(Boolean).join('\n');
  const notResearched = /not\s+(?:researched|assessed)|미조사|조사하지\s*않/i;
  const unknown = /unknown|not\s+(?:identified|established|available|disclosed|assessable|confirmed)|no\s+CoM|확인\s*불가|미확인|미확정|불명|미공개|N\/A/i;
  if (candidates.length && candidates.every(item => notResearched.test(item.value))) {
    return { value: '미조사', basis };
  }
  const outlook = record?.ip_launch_outlook;
  const provided = outlook && typeof outlook === 'object' && !Array.isArray(outlook) && Object.hasOwn(outlook, field);
  const year = provided ? outlook[field] : undefined;
  const validYear = v => (typeof v === 'number' || typeof v === 'string') && /^(?:19|20|21)\d{2}$/.test(String(v).trim());
  const basicComLabel = label => /CoM|물질특허/i.test(label) && /base|기본|excluding|연장\s*제외/i.test(label);
  if (validYear(year)) {
    // Explicit contradicting/missing source assessments must not look confirmed.
    const conflicting = candidates.some(item => {
      const years = [...new Set(item.value.match(/\b(?:19|20|21)\d{2}\b/g) || [])];
      return unknown.test(item.value) || notResearched.test(item.value)
        || years.length !== 1 || Number(years[0]) !== Number(year)
        || (com && !basicComLabel(item.label));
    });
    if (conflicting) return { value: '원문 확인 필요', basis };
    return { value: Number(year), basis: basis || 'JSON에 기재된 연도입니다. 원문에서 대상 국가와 산정 근거를 확인하세요.' };
  }
  if (inputIssues.length || (provided && year !== null)) return { value: '원문 확인 필요', basis: basis || String(year) };
  if (candidates.length) {
    if (candidates.every(item => unknown.test(item.value))) return { value: '확인 불가', basis };
    // A year alone is safe only in the dedicated row. For CoM an older generic
    // expiry/PTE row is deliberately excluded by the strict label above.
    const values = candidates.map(item => {
      if (com && !basicComLabel(item.label)) return null;
      const text = item.value.replace(/\[\d+\]/g, '').trim();
      return validYear(text) ? Number(text) : null;
    });
    if (values.every(v => v !== null) && new Set(values).size === 1) return { value: values[0], basis };
    return { value: '원문 확인 필요', basis };
  }
  if (provided && year === null) return { value: '확인 불가', basis: '보고서의 구조화 결과가 null입니다. 원문에서 조사 근거를 확인하세요.' };
  if (outlook !== undefined) return { value: '조사 항목 누락', basis: '선택 정보가 누락되었거나 형식이 올바르지 않습니다. 원문을 확인하세요.' };
  const version = String(record?.meta?.instruction_version || '').replace(/^v/i, '');
  if (version === '3.9') return { value: '조사 항목 누락', basis: 'v3.9 보고서에서 이 선택 정보가 누락되었습니다.' };
  return { value: '미조사', basis: '원문에 이 항목의 명시적인 조사 결과가 없습니다. 특허·출시 전망을 새로 조사한 것은 아닙니다.' };
}

function peers(record) {
  const competitive = record?.competitive_analysis || {};
  const table = list(competitive.competitor_table);
  return table.length ? table : list(competitive.similar_pipelines);
}

function peerName(peer) {
  if (typeof peer === 'string') return peer;
  return [peer?.competitor_asset || peer?.asset_name || peer?.asset || 'Unknown', peer?.company]
    .filter(Boolean).join(' — ');
}

function sourceText(source) {
  if (typeof source === 'string') return source;
  return [source?.source_title, source?.source_url].filter(Boolean).join(' — ');
}

export function researchColumnValue(record, column) {
  if (['comExpiryYear', 'expectedLaunchYear'].includes(column.key)) return ipLaunchAssessment(record, column.key).value;
  if (column.key === 'peerNames') return [...new Set(peers(record).map(peerName).filter(Boolean))];
  if (column.key === 'peerContext') return peers(record).map((peer) => typeof peer === 'string' ? peer :
    [peerName(peer), peer.stage || peer.development_stage, peer.why_it_matters, peer.source_url].filter(Boolean).join(' | '));
  if (column.key === 'allSources') {
    return [...new Set([
      ...list(record?.validation?.source_registry), ...list(record?.structured_table?.sources)
    ].map(sourceText).filter(Boolean))];
  }
  if (column.key === 'researchSummary') return at(record, column.path) || record?.json_summary?.one_line_summary || '';
  if (column.key === 'recommendation') return String(at(record, column.path) || record?.scoring?.recommendation || '').replace(/Full Scout/gi, 'Advanced Research');
  return column.path ? at(record, column.path) : '';
}

const criterionDefinitions = [
  ['target', 'target_relevance', 'Target relevance'],
  ['moa', 'moa_validity', 'Mechanism validity'],
  ['data', 'data_maturity', 'Data maturity'],
  ['competitive', 'competitive_landscape', 'Competitive landscape'],
  ['platform', 'platform_attractiveness', 'Platform attractiveness'],
  ['expansion', 'expansion_potential', 'Expansion potential'],
  ['market', 'marketability', 'Marketability']
];

export function buildResearchExport(rows, mode, selectedColumns = []) {
  const triage = mode === 'triage';
  const definitions = [
    ...(triage ? FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS : FULL_SCOUT_EXTRA_COLUMN_DEFINITIONS),
    ...exportOnlyColumns.filter((column) => !triage || column.key !== 'peerContext')
  ];
  const coreKeys = triage
    ? ['researchSummary', 'recommendation', 'diligenceQuestion', 'moa', 'verifiedSourceCount', 'fullScoutEvidence', 'uncertainPoints', 'allSources']
    : ['researchSummary', 'recommendation', 'diligenceQuestion', 'moa', 'competitiveDensity', 'similarCount', 'peerNames', 'peerContext', 'comExpiryYear', 'expectedLaunchYear', 'uncertainPoints', 'allSources'];
  const columns = [...new Set([...coreKeys, ...selectedColumns.map((column) => column.key)])]
    .map((key) => definitions.find((column) => column.key === key)).filter(Boolean);
  const criteria = triage ? criterionDefinitions.slice(0, 3) : criterionDefinitions;
  const headers = [
    'Company', 'Asset', 'Location', 'Main indication', 'Pipeline stage', 'Modality', 'Target',
    'Theme', 'Cluster', triage ? 'Screening decision' : 'Advanced Research decision', 'Decision rationale',
    'Research origin', 'Assessment status', ...columns.map((column) => column.label),
    ...criteria.flatMap(([, , label]) => [`${label} score (0–3)`, `${label} rationale`, `${label} evidence gaps`, `${label} research note`, `${label} sources`]),
    ...(triage ? [] : ['Total score (0–21)']),
    'Research date', 'Original rubric version', 'Record ID'
  ];
  const body = rows.map((row) => {
    const record = row.raw || {};
    const registry = list(record.validation?.source_registry);
    return [
      row.company, row.asset, row.country, row.mainIndication, row.stage, row.modality, row.target,
      row.theme, row.cluster, triage ? row.filter1 : row.filter2,
      triage ? record.triage?.why || row.hardFilterReason : record.hard_filter?.reason || row.hardFilterReason,
      row.isVirtualTriage ? 'Advanced Research (shown in Simple Research)' : triage ? 'Simple Research' : 'Advanced Research',
      row.earlyStop ? `Not assessed: ${row.earlyStop.reason}` : 'Assessed',
      ...columns.map((column) => researchColumnValue(record, column)),
      ...criteria.flatMap(([key, id]) => {
        const item = row.criteria?.[key] || {};
        const raw = record.scoring?.criteria?.[id] || {};
        const sources = list(item.evidenceSources).length ? item.evidenceSources :
          [...list(raw.evidence_sources), ...list(raw.source_ids).map((sourceId) =>
            registry.find((source) => source.source_id === sourceId)).filter(Boolean)];
        return [row.earlyStop ? '' : item.score ?? raw.score ?? '',
          item.mainLineSummary || raw.main_line_summary || raw.reason || '',
          [...new Set([item.whyNotHigher || raw.why_not_higher,
            ...list(item.conflictingOrMissingEvidence || raw.uncertain_points)].filter((value) => value && value !== '-'))],
          item.investigationNote || raw.investigation_note || '',
          [...new Set(sources.map(sourceText).filter(Boolean))]];
      }),
      ...(triage ? [] : [row.earlyStop ? '' : row.totalScore ?? '']),
      row.generatedAt || record.meta?.generated_at, row.criteriaVersion || record.meta?.rubric_version, row.id
    ].map(researchText);
  });
  return { headers, body };
}
