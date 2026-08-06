const FULL_CRITERIA = [
  'target_relevance',
  'competitive_landscape',
  'moa_validity',
  'platform_attractiveness',
  'expansion_potential',
  'data_maturity',
  'marketability'
];
const TRIAGE_CRITERIA = ['target_relevance', 'moa_validity', 'data_maturity'];

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function listValue(value) {
  return Array.isArray(value) ? value : [];
}

function textListValue(value) {
  return listValue(value)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTextValues(...values) {
  return [...new Set(values.flatMap((value) => textListValue(value)))];
}

function textValue(...values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) || '';
}

function numericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().replace(/,/g, '');
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized) ? Number(normalized) : value;
}

function normalizeNumericFields(object, fields) {
  fields.forEach((field) => {
    if (field in object) object[field] = numericValue(object[field]);
  });
  return object;
}

function compactSourceId(source) {
  return textValue(source?.source_id, source?.id, source?.ref_id);
}

function compactV2Source(source, fallbackId = '') {
  if (typeof source === 'string') {
    const value = source.trim();
    if (!value) return null;
    source = {
      source_id: fallbackId,
      source_title: value,
      source_url: /^https?:\/\//i.test(value) ? value : ''
    };
  }
  const raw = objectValue(source);
  if (raw !== source) return null;
  const sourceId = textValue(compactSourceId(raw), fallbackId);
  const sourceTitle = textValue(raw.source_title, raw.title, raw.name, raw.source_name);
  const sourceUrl = textValue(raw.source_url, raw.url, raw.href);
  if (!sourceId || (!sourceTitle && !sourceUrl)) return null;
  const normalized = {
    source_id: sourceId,
    source_title: sourceTitle || sourceUrl || sourceId,
    source_url: sourceUrl
  };
  for (const [field, aliases] of Object.entries({
    source_type: ['source_type', 'type'],
    reliability: ['reliability'],
    evidence_summary: ['evidence_summary', 'claim_supported']
  })) {
    const value = textValue(...aliases.map((alias) => raw[alias]));
    if (value) normalized[field] = value;
  }
  if (typeof raw.verified === 'boolean') normalized.verified = raw.verified;
  return normalized;
}

function compactV2SourceRegistry(record) {
  const directCandidates = [...sourceRegistry(record)];
  const evidenceCandidates = [];
  const criteria = objectValue(objectValue(record.scoring).criteria);
  Object.values(criteria).forEach((criterion) => {
    evidenceCandidates.push(...listValue(objectValue(criterion).evidence_sources));
    evidenceCandidates.push(...listValue(objectValue(criterion).verified_evidence_sources));
  });
  const competitive = objectValue(record.competitive_analysis);
  for (const row of listValue(competitive.competitor_table)) {
    evidenceCandidates.push(...listValue(objectValue(row).evidence_sources));
  }

  const normalized = directCandidates
    .map((candidate, index) => compactV2Source(candidate, `SRC_AUTO_${index + 1}`))
    .filter(Boolean);
  const byId = new Map();
  normalized.forEach((source) => {
    if (!byId.has(source.source_id)) byId.set(source.source_id, source);
  });
  evidenceCandidates.forEach((candidate, index) => {
    const source = compactV2Source(candidate, `SRC_AUTO_EVIDENCE_${index + 1}`);
    if (!source) return;
    const existing = byId.get(source.source_id);
    if (existing) {
      for (const [field, value] of Object.entries(source)) {
        if (value !== '' && value !== null && value !== undefined && !existing[field]) {
          existing[field] = value;
        }
      }
      return;
    }
    byId.set(source.source_id, source);
    normalized.push(source);
  });
  return normalized;
}

function compactV2TableSources(value, lookup) {
  const normalized = [];
  for (const candidate of listValue(value)) {
    const linked = typeof candidate === 'string'
      ? lookup.get(candidate.trim()) || (/^https?:\/\//i.test(candidate.trim()) ? candidate : null)
      : candidate;
    const source = compactV2Source(linked, 'TABLE_SOURCE');
    if (!source) continue;
    normalized.push({ source_title: source.source_title, source_url: source.source_url });
    break;
  }
  return normalized;
}

function compactV2FactSources(value, lookup) {
  const sources = [];
  for (const candidate of listValue(value)) {
    if (typeof candidate === 'string') {
      const normalized = candidate.trim();
      if (!normalized) continue;
      const linked = lookup.get(normalized);
      sources.push(textValue(linked?.source_url, linked?.source_title, normalized));
      continue;
    }
    const source = compactV2Source(candidate);
    if (source) sources.push(textValue(source.source_url, source.source_title, source.source_id));
  }
  return [...new Set(sources.filter(Boolean))];
}

function compactV2CrossCheckedFacts(value, lookup) {
  return listValue(value).flatMap((candidate) => {
    if (typeof candidate === 'string') {
      const fact = candidate.trim();
      return fact ? [fact] : [];
    }
    const raw = objectValue(candidate);
    const fact = textValue(raw.fact);
    if (!fact) return [];
    return [{
      fact,
      sources: compactV2FactSources(
        [...listValue(raw.sources), ...listValue(raw.source_ids)],
        lookup
      )
    }];
  });
}

function sourceRegistry(record) {
  const validation = objectValue(record.validation);
  return listValue(validation.source_registry).filter((source) => objectValue(source) === source);
}

function sourceLookup(record) {
  return new Map(sourceRegistry(record).flatMap((source) => {
    const sourceId = compactSourceId(source);
    return sourceId ? [[sourceId, source]] : [];
  }));
}

function resolvedSources(value, lookup) {
  if (Array.isArray(value?.evidence_sources) && value.evidence_sources.length) {
    return value.evidence_sources;
  }
  return listValue(value?.source_ids)
    .map((sourceId) => lookup.get(String(sourceId)))
    .filter(Boolean)
    .map((source) => ({ ...source }));
}

function expandCriterion(value, lookup) {
  const criterion = { ...objectValue(value) };
  criterion.score = numericValue(criterion.score);
  const evidenceSources = resolvedSources(criterion, lookup);
  const summaries = evidenceSources
    .map((source) => textValue(source.evidence_summary, source.claim_supported, source.source_title))
    .filter(Boolean);
  criterion.source_ids = listValue(criterion.source_ids);
  criterion.evidence_sources = evidenceSources;
  criterion.uncertain_points = listValue(criterion.uncertain_points);
  criterion.evidence_type_reason = textValue(criterion.evidence_type_reason, criterion.main_line_summary);
  criterion.what_was_checked = listValue(criterion.what_was_checked);
  criterion.evidence_trail = listValue(criterion.evidence_trail).length
    ? criterion.evidence_trail
    : summaries;
  criterion.investigation_note = textValue(criterion.investigation_note, criterion.why_not_higher);
  return criterion;
}

function expandHybridCriterion(value, _lookup, { triage = false } = {}) {
  const source = objectValue(value);
  const sourceIds = uniqueTextValues(
    source.source_ids,
    listValue(source.evidence_sources).map((item) => compactSourceId(item)),
    listValue(source.verified_evidence_sources).map((item) => compactSourceId(item))
  );
  const criterion = {
    score: numericValue(source.score),
    evidence_type: textValue(source.evidence_type, triage ? 'triage_only' : ''),
    evidence_type_reason: textValue(source.evidence_type_reason),
    evidence_basis: textValue(source.evidence_basis),
    main_line_summary: textValue(source.main_line_summary, source.reason),
    why_not_higher: textValue(source.why_not_higher),
    investigation_note: textValue(source.investigation_note),
    uncertain_points: textListValue(source.uncertain_points),
    source_ids: sourceIds
  };
  if (objectValue(source.calculation) === source.calculation) {
    criterion.calculation = { ...source.calculation };
  }
  return criterion;
}

function marketabilityStepIsUs(step) {
  const geography = textValue(step?.geography, step?.market_geography, step?.source_geography).toLowerCase();
  if (['us', 'u.s.', 'u.s', 'united states', 'united states of america'].includes(geography)) return true;
  return /\b(?:US|U\.S\.|United States)\b/i.test(textValue(step?.formula));
}

function marketabilityStepIsMillionUsd(step) {
  const unit = textValue(step?.sales_unit).toLowerCase().replace(/[^a-z]/g, '');
  return ['millionusd', 'usdmillion', 'musd', 'usdmm'].includes(unit);
}

function backfillMarketabilityGlobalConversion(value) {
  const criterion = value && typeof value === 'object' ? value : {};
  const calculation = { ...objectValue(criterion.calculation) };
  const stepC = { ...objectValue(calculation.C_obtainable_peak_sales) };
  const usValue = numericValue(stepC.obtainable_peak_sales);
  if (!Number.isFinite(usValue) || !marketabilityStepIsUs(stepC) || !marketabilityStepIsMillionUsd(stepC)) {
    return criterion;
  }
  const globalValue = Number((usValue * 1.5).toFixed(6));
  const stepD = { ...objectValue(calculation.D_global_obtainable_peak_sales) };
  stepD.source_geography = 'US';
  stepD.global_multiplier = 1.5;
  stepD.global_obtainable_peak_sales = globalValue;
  stepD.sales_unit = 'million USD';
  stepD.formula = 'Global Obtainable Peak Sales = US Obtainable Peak Sales x 1.5';
  calculation.C_obtainable_peak_sales = stepC;
  calculation.D_global_obtainable_peak_sales = stepD;
  criterion.calculation = calculation;
  return criterion;
}

function expandHybridCompetitorRow(value, lookup) {
  const source = objectValue(value);
  const sourceIds = uniqueTextValues(
    source.source_ids,
    listValue(source.evidence_sources).map((item) => compactSourceId(item))
  );
  const linkedSource = sourceIds.map((sourceId) => lookup.get(sourceId)).find(Boolean);
  return {
    competitor_asset: textValue(
      source.competitor_asset,
      source.asset,
      source.competitor_name,
      source.competitor,
      'Unknown Competitor'
    ),
    company: textValue(source.company, 'Unknown Company'),
    modality: textValue(source.modality),
    target_or_moa: textValue(source.target_or_moa, source.target_moa, source.target, source.moa),
    stage: textValue(source.stage, source.stage_status, source.development_stage),
    similarity_level: textValue(source.similarity_level, source.similarity, 'Unknown'),
    why_it_matters: textValue(source.why_it_matters, source.relevance_to_asset),
    source_url: textValue(source.source_url, linkedSource?.source_url),
    source_ids: sourceIds
  };
}

function expandHybridSimilarPipeline(value) {
  const source = objectValue(value);
  return {
    company: textValue(source.company),
    asset_name: textValue(source.asset_name, source.asset),
    similarity_score: numericValue(source.similarity_score),
    matched_dimensions: textListValue(source.matched_dimensions),
    shared_data_points: textListValue(source.shared_data_points)
  };
}

function expandMarketability(value, lookup) {
  const criterion = expandCriterion(value, lookup);
  normalizeNumericFields(criterion, [
    'assessed_global_peak_sales_musd',
    'calculated_global_obtainable_peak_sales_musd',
    'external_normalized_global_peak_sales_musd'
  ]);
  if (!Array.isArray(criterion.external_peak_sales_references) || !criterion.external_peak_sales_references.length) {
    criterion.external_peak_sales_references = listValue(criterion.external_forecast_source_ids)
      .map((sourceId) => lookup.get(String(sourceId)))
      .filter(Boolean)
      .map((source) => ({ ...source }));
  }
  const calculation = { ...objectValue(criterion.calculation) };
  const stepA = { ...objectValue(calculation.A_targetable_addressable_patient) };
  const stepB = { ...objectValue(calculation.B_unrisked_peak_sales) };
  const stepC = { ...objectValue(calculation.C_obtainable_peak_sales) };
  normalizeNumericFields(stepA, [
    'total_patient_pool', 'diagnosis_rate', 'eligibility_rate',
    'treatable_subgroup_rate', 'targetable_addressable_patient'
  ]);
  normalizeNumericFields(stepB, [
    'tap', 'annual_net_price', 'peak_penetration',
    'treatment_duration_factor', 'unrisked_peak_sales'
  ]);
  normalizeNumericFields(stepC, [
    'unrisked_peak_sales', 'competition_haircut',
    'pricing_power_adjustment', 'obtainable_peak_sales'
  ]);
  stepA.evidence_sources = resolvedSources(stepA, lookup);
  stepB.evidence_sources = resolvedSources(stepB, lookup);
  stepC.evidence_sources = resolvedSources(stepC, lookup);
  stepA.formula ||= 'TAP = Total Patient Pool x Diagnosis Rate x Eligibility Rate x Treatable Subgroup Rate';
  stepB.sales_unit ||= 'million USD';
  stepB.formula ||= 'Unrisked Peak Sales = TAP x Annual Net Price x Peak Penetration x Treatment Duration Factor; output in million USD';
  stepC.sales_unit ||= 'million USD';
  stepC.formula ||= 'US Obtainable Peak Sales = US Unrisked Peak Sales x Competition Haircut x Pricing Power Adjustment; output in million USD';
  calculation.A_targetable_addressable_patient = stepA;
  calculation.B_unrisked_peak_sales = stepB;
  calculation.C_obtainable_peak_sales = stepC;
  criterion.calculation = calculation;
  return backfillMarketabilityGlobalConversion(criterion);
}

function expandedMeta(record, mode) {
  const meta = { ...objectValue(record.meta) };
  const triage = mode === 'triage';
  meta.schema_version ||= '3.2';
  meta.instruction_version ||= triage ? '3.2' : '3.3';
  meta.rubric_version ||= triage ? '3.2' : '3.3';
  meta.review_type ||= triage ? 'fast_triage' : 'full_scout';
  meta.language ||= 'ko';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(textValue(meta.generated_at)) || /Y{4}/i.test(textValue(meta.generated_at))) {
    meta.generated_at = new Date().toISOString().slice(0, 10);
  }
  return meta;
}

function expandedCompanyProfile(record, company, country) {
  const profile = { ...objectValue(record.company_profile) };
  return {
    company_name: textValue(profile.company_name, company, 'Unknown'),
    legal_name: textValue(profile.legal_name),
    aliases: listValue(profile.aliases),
    country: textValue(profile.country, country, 'Unknown'),
    headquarters: textValue(profile.headquarters),
    website: textValue(profile.website),
    founded_year: profile.founded_year ?? null,
    company_stage: textValue(profile.company_stage),
    ownership_status: textValue(profile.ownership_status),
    focus_areas: listValue(profile.focus_areas),
    platform_summary: textValue(profile.platform_summary),
    lead_pipeline_summary: textValue(profile.lead_pipeline_summary),
    financing_or_partnership_signals: listValue(profile.financing_or_partnership_signals),
    official_source_urls: listValue(profile.official_source_urls),
    notes: textValue(profile.notes)
  };
}

function expandedSourceLinkedRows(value, lookup) {
  return listValue(value).map((item) => {
    if (objectValue(item) !== item) return item;
    const sources = resolvedSources(item, lookup);
    const firstSource = sources[0] || {};
    return {
      ...item,
      evidence_sources: sources,
      source_url: textValue(item.source_url, firstSource.source_url),
      source_title: textValue(item.source_title, firstSource.source_title)
    };
  });
}

function expandedCompetitiveAnalysis(record, lookup) {
  const competitive = { ...objectValue(record.competitive_analysis) };
  const similarity = { ...objectValue(competitive.similarity_summary) };
  return {
    ...competitive,
    competitive_density: textValue(competitive.competitive_density, 'Unknown'),
    competitive_search_complete: competitive.competitive_search_complete === true,
    search_scope_checked: listValue(competitive.search_scope_checked),
    search_limitations: listValue(competitive.search_limitations),
    direct_competitors: expandedSourceLinkedRows(competitive.direct_competitors, lookup),
    broader_competitors: expandedSourceLinkedRows(competitive.broader_competitors, lookup),
    similarity_summary: {
      similar_pipeline_count: Number(similarity.similar_pipeline_count) || 0,
      high_similarity_count: Number(similarity.high_similarity_count) || 0,
      medium_similarity_count: Number(similarity.medium_similarity_count) || 0,
      low_similarity_count: Number(similarity.low_similarity_count) || 0,
      summary: textValue(similarity.summary)
    },
    competitor_table: expandedSourceLinkedRows(competitive.competitor_table, lookup),
    similar_pipelines: expandedSourceLinkedRows(competitive.similar_pipelines, lookup),
    differentiation_points: listValue(competitive.differentiation_points),
    analysis_summary: textValue(competitive.analysis_summary)
  };
}

export function isCompactIngestionRecord(record) {
  return ['compact_v1', 'compact_v2'].includes(textValue(record?.meta?.ingestion_format).toLowerCase());
}

export function isMinimalCompactIngestionRecord(record) {
  return textValue(record?.meta?.ingestion_format).toLowerCase() === 'compact_v2';
}

function expandMinimalCompactInputRecord(inputRecord, requestedMode = '') {
  const record = JSON.parse(JSON.stringify(inputRecord));
  const metaMode = textValue(record.meta?.review_type).toLowerCase();
  const mode = requestedMode === 'triage' || requestedMode === 'full'
    ? requestedMode
    : metaMode.includes('triage') ? 'triage' : 'full';
  const triage = mode === 'triage';
  record.meta = expandedMeta(record, mode);
  const compactRegistry = compactV2SourceRegistry(record);
  const lookup = new Map(compactRegistry.map((source) => [source.source_id, source]));

  record.input = {
    company_input: textValue(record.input?.company_input, record.structured_table?.company, 'Unknown'),
    asset_input: textValue(record.input?.asset_input, record.structured_table?.asset_name, 'Unknown')
  };

  const inputTable = objectValue(record.structured_table);
  const table = {
    company: textValue(inputTable.company, 'Unknown'),
    asset_name: textValue(inputTable.asset_name, 'Unknown'),
    target: textValue(inputTable.target, 'Unknown'),
    moa: textValue(inputTable.moa, 'Unknown'),
    modality_platform: textValue(inputTable.modality_platform, 'Unknown'),
    main_indication: textValue(inputTable.main_indication, 'Unknown'),
    indication: textValue(inputTable.indication, inputTable.main_indication, 'Unknown'),
    development_stage: textValue(inputTable.development_stage, 'Unknown'),
    company_country: textValue(inputTable.company_country, 'Unknown'),
    sources: compactV2TableSources(inputTable.sources, lookup)
  };
  record.structured_table = table;

  record.source_report = {
    raw_markdown: '',
    source_format: triage ? 'fast_triage_markdown' : 'gpt_markdown_report',
    parser_status: triage ? 'fast_triage' : 'gpt_structured_output',
    parser_note: `Dashboard Compact JSON v2 expanded for ${triage ? 'Fast Triage' : 'Full Scout'}.`
  };

  const inputScoring = objectValue(record.scoring);
  const inputCriteria = objectValue(inputScoring.criteria);
  const criteria = {};
  const criterionIds = triage ? TRIAGE_CRITERIA : FULL_CRITERIA;
  criterionIds.forEach((criterionId) => {
    criteria[criterionId] = expandHybridCriterion(inputCriteria[criterionId], lookup, { triage });
    if (criterionId === 'marketability') {
      criteria[criterionId] = backfillMarketabilityGlobalConversion(criteria[criterionId]);
    }
  });
  const scores = criterionIds.map((criterionId) => criteria[criterionId]?.score);
  const scoreSum = scores.every((score) => Number.isInteger(score))
    ? scores.reduce((total, score) => total + score, 0)
    : null;
  record.scoring = {
    criteria,
    total_score: scoreSum,
    max_score: scoreSum === null ? null : triage ? 9 : 21
  };

  record.json_summary = {
    theme: textValue(record.json_summary?.theme, 'Unknown'),
    cluster: textValue(record.json_summary?.cluster, 'Unknown'),
    target_description: textValue(record.json_summary?.target_description)
  };
  record.hard_filter = {
    status: textValue(record.hard_filter?.status),
    reason: textValue(record.hard_filter?.reason),
    flags: textListValue(record.hard_filter?.flags),
    hard_blocker: record.hard_filter?.hard_blocker === true,
    decision_uncertainty: record.hard_filter?.decision_uncertainty === true
  };
  record.validation = {
    uncertain_points: textListValue(record.validation?.uncertain_points),
    cross_checked_facts: compactV2CrossCheckedFacts(record.validation?.cross_checked_facts, lookup),
    source_registry: compactRegistry
  };
  record.final_insight = {
    one_line_summary: textValue(record.final_insight?.one_line_summary),
    recommendation: textValue(
      record.final_insight?.recommendation,
      triage ? 'Verify asset identity' : 'Deprioritize'
    ),
    most_important_diligence_question: textValue(
      record.final_insight?.most_important_diligence_question
    )
  };

  if (triage) {
    record.triage = {
      instruction_version: '3.2',
      status: textValue(record.triage?.status, record.hard_filter.status),
      identity_verified: record.triage?.identity_verified === true,
      active_asset: typeof record.triage?.active_asset === 'boolean'
        ? record.triage.active_asset
        : null,
      verified_public_source_count: numericValue(record.triage?.verified_public_source_count ?? 0),
      why: textValue(record.triage?.why),
      missing_evidence_needed_for_full_scout: textListValue(
        record.triage?.missing_evidence_needed_for_full_scout
      )
    };
  } else {
    const profile = objectValue(record.company_profile);
    record.company_profile = {
      headquarters: textValue(profile.headquarters),
      company_stage: textValue(profile.company_stage),
      platform_summary: textValue(profile.platform_summary)
    };
    const competitive = objectValue(record.competitive_analysis);
    const similarity = objectValue(competitive.similarity_summary);
    record.competitive_analysis = {
      competitive_density: textValue(competitive.competitive_density, 'Unknown'),
      similarity_summary: {
        similar_pipeline_count: Number(similarity.similar_pipeline_count) || 0,
        high_similarity_count: Number(similarity.high_similarity_count) || 0,
        medium_similarity_count: Number(similarity.medium_similarity_count) || 0,
        low_similarity_count: Number(similarity.low_similarity_count) || 0
      },
      competitor_table: listValue(competitive.competitor_table)
        .map((row) => expandHybridCompetitorRow(row, lookup)),
      similar_pipelines: listValue(competitive.similar_pipelines)
        .map((row) => expandHybridSimilarPipeline(row))
    };
  }
  const allowedMetaFields = [
    'ingestion_format', 'review_type', 'schema_version', 'instruction_version',
    'rubric_version', 'generated_at', 'language', 'output_filename_base'
  ];
  record.meta = Object.fromEntries(
    allowedMetaFields
      .filter((field) => Object.prototype.hasOwnProperty.call(record.meta, field))
      .map((field) => [field, record.meta[field]])
  );
  const normalized = {
    meta: record.meta,
    source_report: record.source_report,
    input: record.input,
    json_summary: record.json_summary,
    structured_table: record.structured_table,
    hard_filter: record.hard_filter,
    scoring: record.scoring,
    validation: record.validation,
    final_insight: record.final_insight
  };
  if (triage) {
    normalized.triage = record.triage;
  } else {
    normalized.company_profile = record.company_profile;
    normalized.competitive_analysis = record.competitive_analysis;
  }
  return normalized;
}

export function expandCompactInputRecord(inputRecord, requestedMode = '') {
  if (!isCompactIngestionRecord(inputRecord)) return inputRecord;
  if (isMinimalCompactIngestionRecord(inputRecord)) {
    return expandMinimalCompactInputRecord(inputRecord, requestedMode);
  }
  const record = JSON.parse(JSON.stringify(inputRecord));
  const metaMode = textValue(record.meta?.review_type).toLowerCase();
  const mode = requestedMode === 'triage' || requestedMode === 'full'
    ? requestedMode
    : metaMode.includes('triage') ? 'triage' : 'full';
  const triage = mode === 'triage';
  record.meta = expandedMeta(record, mode);

  const table = { ...objectValue(record.structured_table) };
  table.company = textValue(table.company, record.company_profile?.company_name, 'Unknown');
  table.asset_name = textValue(table.asset_name, 'Unknown');
  table.target = textValue(table.target, 'Unknown');
  table.moa = textValue(table.moa, 'Unknown');
  table.modality_platform = textValue(table.modality_platform, 'Unknown');
  table.main_indication = textValue(table.main_indication, 'Unknown');
  table.indication = textValue(table.indication, table.main_indication, 'Unknown');
  table.development_stage = textValue(table.development_stage, 'Unknown');
  table.company_country = textValue(table.company_country, record.company_profile?.country, 'Unknown');
  const registry = sourceRegistry(record);
  table.sources = listValue(table.sources).length ? table.sources : registry.map((source) => ({ ...source }));
  record.structured_table = table;

  record.input = {
    company_input: table.company,
    asset_input: table.asset_name,
    source_type: triage ? 'fast triage' : 'web research',
    notes: '',
    ...objectValue(record.input)
  };
  record.source_report = {
    raw_markdown: '',
    source_format: triage ? 'fast_triage_markdown' : 'gpt_markdown_report',
    parser_status: triage ? 'fast_triage' : 'gpt_structured_output',
    parser_note: `Dashboard Compact JSON v1 expanded for ${triage ? 'Fast Triage' : 'Full Scout'}.`,
    ...objectValue(record.source_report)
  };
  record.source_report.raw_markdown = '';

  const lookup = sourceLookup(record);
  const scoring = { ...objectValue(record.scoring) };
  const criteria = { ...objectValue(scoring.criteria) };
  const criterionIds = triage ? TRIAGE_CRITERIA : FULL_CRITERIA;
  criterionIds.forEach((criterionId) => {
    criteria[criterionId] = criterionId === 'marketability'
      ? expandMarketability(criteria[criterionId], lookup)
      : expandCriterion(criteria[criterionId], lookup);
  });
  const scores = criterionIds.map((criterionId) => criteria[criterionId]?.score);
  const scoreSum = scores.every((score) => Number.isInteger(score))
    ? scores.reduce((total, score) => total + score, 0)
    : null;
  scoring.criteria = criteria;
  if (scoring.total_score === undefined) scoring.total_score = scoreSum;
  if (scoring.max_score === undefined) scoring.max_score = scoreSum === null ? null : triage ? 9 : 21;
  record.scoring = scoring;

  const targetCriterion = objectValue(criteria.target_relevance);
  record.json_summary = {
    company: table.company,
    asset_name: table.asset_name,
    target: table.target,
    theme: 'Unknown',
    cluster: 'Unknown',
    target_relevance_score: targetCriterion.score ?? 0,
    one_line_summary: textValue(record.final_insight?.one_line_summary, targetCriterion.main_line_summary),
    company_country: table.company_country,
    ...objectValue(record.json_summary)
  };
  record.hard_filter = {
    status: '',
    reason: '',
    flags: [],
    ...objectValue(record.hard_filter)
  };
  record.validation = {
    cross_checked_facts: [],
    uncertain_points: [],
    attachment_evidence_registry: [],
    source_registry: registry,
    ...objectValue(record.validation)
  };
  record.final_insight = {
    one_line_summary: '',
    recommendation: triage ? 'Verify asset identity' : 'Deprioritize',
    most_important_diligence_question: '',
    ...objectValue(record.final_insight)
  };

  if (triage) {
    record.triage = {
      instruction_version: '3.2',
      identity_verified: false,
      active_asset: null,
      missing_evidence_needed_for_full_scout: [],
      ...objectValue(record.triage)
    };
  } else {
    record.company_profile = expandedCompanyProfile(record, table.company, table.company_country);
    record.competitive_analysis = expandedCompetitiveAnalysis(record, lookup);
    record.obsidian = {
      note_title: `${table.company} ${table.asset_name}`.trim(),
      tags: ['pipeline', 'skbp'],
      aliases: [],
      ...objectValue(record.obsidian)
    };
  }
  return record;
}
