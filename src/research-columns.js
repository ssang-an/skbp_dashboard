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
  { key: 'differentiation', label: 'Competitive differentiation', path: 'scoring.criteria.competitive_landscape.main_line_summary', description: '평가 약물의 비교 우위 또는 경쟁상 한계에 대한 판단 근거' }
];

export const FAST_TRIAGE_EXTRA_COLUMN_DEFINITIONS = [
  ...common,
  { key: 'verifiedSourceCount', label: 'Verified source count', path: 'triage.verified_public_source_count', description: '보고서에 검증된 것으로 등록된 공개 출처 수' },
  { key: 'triageWhy', label: 'Screening rationale', path: 'triage.why', description: 'SELECT / REJECT / INSUFFICIENT 판정 이유' },
  { key: 'fullScoutEvidence', label: 'Evidence needed next', path: 'triage.missing_evidence_needed_for_full_scout', description: 'Advanced Research 진행 전에 확보할 근거 전체' }
];

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
  if (column.key === 'peerNames') return [...new Set(peers(record).map(peerName).filter(Boolean))];
  if (column.key === 'peerContext') return peers(record).map((peer) => typeof peer === 'string' ? peer :
    [peerName(peer), peer.stage || peer.development_stage, peer.why_it_matters, peer.source_url].filter(Boolean).join(' | '));
  if (column.key === 'allSources') {
    return [...new Set([
      ...list(record?.validation?.source_registry), ...list(record?.structured_table?.sources)
    ].map(sourceText).filter(Boolean))];
  }
  if (column.key === 'researchSummary') return at(record, column.path) || record?.json_summary?.one_line_summary || '';
  if (column.key === 'recommendation') return at(record, column.path) || record?.scoring?.recommendation || '';
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
    : ['researchSummary', 'recommendation', 'diligenceQuestion', 'moa', 'competitiveDensity', 'similarCount', 'peerNames', 'peerContext', 'uncertainPoints', 'allSources'];
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
