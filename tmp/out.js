// src/theme.js
var THEME_STORAGE_KEY = "skbp.ui.theme";
function preferredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const label = button.querySelector("[data-theme-label]");
    const icon = button.querySelector("[data-theme-icon]");
    button.setAttribute("aria-pressed", String(nextTheme === "dark"));
    button.setAttribute("aria-label", nextTheme === "dark" ? "\uB77C\uC774\uD2B8 \uBAA8\uB4DC\uB85C \uC804\uD658" : "\uB2E4\uD06C \uBAA8\uB4DC\uB85C \uC804\uD658");
    if (label) label.textContent = nextTheme === "dark" ? "Light" : "Dark";
    if (icon) icon.textContent = nextTheme === "dark" ? "\u2600" : "\u25D0";
  });
}
function setupThemeToggle() {
  applyTheme(document.documentElement.dataset.theme || preferredTheme());
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  });
}

// src/app.js
var API_URL = "/api/records";
var CATEGORY_SYNONYMS_URL = "/api/category-synonyms";
var DEFAULT_PAGE_SIZE = 10;
var PAGE_SIZE_STORAGE_KEY = "skbp.dashboard.pageSize.v1";
var AGENT_SESSION_STORAGE_KEY = "skbp.dashboard.agentSessions.v1";
var AGENT_ACTIVE_SESSION_KEY = "skbp.dashboard.activeAgentSession.v1";
var COLUMN_WIDTH_STORAGE_KEY = "skbp.dashboard.columnWidths.v1";
var DEFAULT_COLUMN_WIDTHS = {
  select: 36,
  company: 128,
  country: 112,
  asset: 92,
  target: 280,
  mainIndication: 180,
  stage: 190,
  filter1: 82,
  filter2: 82,
  targetScore: 52,
  competitiveScore: 58,
  moaScore: 52,
  platformScore: 52,
  expansionScore: 52,
  dataScore: 56,
  marketScore: 64,
  totalScore: 58,
  extra: 180
};
var MIN_COLUMN_WIDTHS = {
  select: 34,
  company: 86,
  country: 82,
  asset: 72,
  target: 180,
  mainIndication: 130,
  stage: 120,
  filter1: 70,
  filter2: 70,
  targetScore: 46,
  competitiveScore: 50,
  moaScore: 46,
  platformScore: 46,
  expansionScore: 46,
  dataScore: 50,
  marketScore: 56,
  totalScore: 52,
  extra: 110
};
var MAX_COLUMN_WIDTH = 720;
var TRIAGE_PROMPT_TOOLTIP = "GPT fast triage \uC9C0\uCE68\uC744 \uBCF5\uC0AC\uD569\uB2C8\uB2E4. \uC5EC\uB7EC asset\uC744 \uBE60\uB974\uAC8C SELECT / REJECT / N/A\uB85C screening\uD560 \uB54C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.";
var state = {
  rawRecords: [],
  rows: [],
  query: "",
  stage: "all",
  theme: "all",
  cluster: "all",
  indication: "all",
  country: "all",
  pass: "all",
  tableMode: "full",
  sortKey: "totalScore",
  sortDirection: "desc",
  page: 1,
  pageSize: Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)) || DEFAULT_PAGE_SIZE,
  selectedIds: /* @__PURE__ */ new Set(),
  extraColumns: new Set(JSON.parse(localStorage.getItem("skbp.dashboard.extraColumns") || "[]")),
  columnWidths: JSON.parse(localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY) || "{}"),
  agentSessions: [],
  activeAgentSessionId: localStorage.getItem(AGENT_ACTIVE_SESSION_KEY) || "",
  categorySynonyms: { country: [], stage: [], indication: [] },
  categorySynonymsLoaded: false
};
var elements = {
  dataStatus: document.querySelector("#dataStatus"),
  refreshButton: document.querySelector("#refreshButton"),
  exportExcelButton: document.querySelector("#exportExcelButton"),
  aiDrawerButton: document.querySelector("#aiDrawerButton"),
  aiDrawer: document.querySelector("#aiDrawer"),
  aiBackdrop: document.querySelector("#aiBackdrop"),
  aiDrawerClose: document.querySelector("#aiDrawerClose"),
  criteriaDrawerButton: document.querySelector("#criteriaDrawerButton"),
  criteriaDrawer: document.querySelector("#criteriaDrawer"),
  criteriaBackdrop: document.querySelector("#criteriaBackdrop"),
  criteriaDrawerClose: document.querySelector("#criteriaDrawerClose"),
  triageReportDrawer: document.querySelector("#triageReportDrawer"),
  triageReportBackdrop: document.querySelector("#triageReportBackdrop"),
  triageReportClose: document.querySelector("#triageReportClose"),
  triageReportTitle: document.querySelector("#triageReportTitle"),
  triageReportMeta: document.querySelector("#triageReportMeta"),
  triageReportBody: document.querySelector("#triageReportBody"),
  agentContextCount: document.querySelector("#agentContextCount"),
  agentMessages: document.querySelector("#agentMessages"),
  agentForm: document.querySelector("#agentForm"),
  agentInput: document.querySelector("#agentInput"),
  agentSessionSelect: document.querySelector("#agentSessionSelect"),
  agentNewSessionButton: document.querySelector("#agentNewSessionButton"),
  agentDeleteSessionButton: document.querySelector("#agentDeleteSessionButton"),
  metricTotal: document.querySelector("#metricTotal"),
  metricPass: document.querySelector("#metricPass"),
  metricScore: document.querySelector("#metricScore"),
  metricTarget: document.querySelector("#metricTarget"),
  metricCountries: document.querySelector("#metricCountries"),
  targetChart: document.querySelector("#targetChart"),
  themeChart: document.querySelector("#themeChart"),
  countryChart: document.querySelector("#countryChart"),
  passDonut: document.querySelector("#passDonut"),
  passLegend: document.querySelector("#passLegend"),
  scoreAverageChart: document.querySelector("#scoreAverageChart"),
  priorityList: document.querySelector("#priorityList"),
  searchInput: document.querySelector("#searchInput"),
  stageFilter: document.querySelector("#stageFilter"),
  themeFilter: document.querySelector("#themeFilter"),
  clusterFilter: document.querySelector("#clusterFilter"),
  countryFilter: document.querySelector("#countryFilter"),
  indicationFilter: document.querySelector("#indicationFilter"),
  passFilter: document.querySelector("#passFilter"),
  tableCount: document.querySelector("#tableCount"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  columnSettingsButton: document.querySelector("#columnSettingsButton"),
  columnSettingsPanel: document.querySelector("#columnSettingsPanel"),
  columnSettingsGrid: document.querySelector("#columnSettingsGrid"),
  pipelineTableTabs: document.querySelectorAll("[data-table-mode]"),
  pipelineTableHead: document.querySelector("#pipelineTableHead"),
  pipelineHeaderRow: document.querySelector("#pipelineHeaderRow"),
  selectPageRows: document.querySelector("#selectPageRows"),
  deleteSelectedButton: document.querySelector("#deleteSelectedButton"),
  pipelineTable: document.querySelector("#pipelineTable"),
  pipelineColGroup: document.querySelector("#pipelineColGroup"),
  pageInfo: document.querySelector("#pageInfo"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  rawReportInput: document.querySelector("#rawReportInput"),
  structuredJsonInput: document.querySelector("#structuredJsonInput"),
  previewInputButton: document.querySelector("#previewInputButton"),
  saveJsonButton: document.querySelector("#saveJsonButton"),
  clearJsonButton: document.querySelector("#clearJsonButton"),
  saveStatus: document.querySelector("#saveStatus"),
  copyTriagePromptTopButton: document.querySelector("#copyTriagePromptTopButton"),
  copyPromptTopButton: document.querySelector("#copyPromptTopButton"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  promptCopyStatus: document.querySelector("#promptCopyStatus")
};
var activeColumnResize = null;
var promptCopyFeedbackTimer = null;
function get(record, path, fallback = "") {
  return path.split(".").reduce((value, key) => value?.[key], record) ?? fallback;
}
function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
function formatMillionUsd(value, unit = "") {
  if (value === null || value === void 0 || value === "") return "-";
  const isMillionUnit = /million\s*usd/i.test(String(unit));
  if (typeof value === "number") {
    const millionValue = isMillionUnit ? value : value / 1e6;
    return `USD ${millionValue.toLocaleString(void 0, { maximumFractionDigits: 1 })}M`;
  }
  const text = String(value).trim();
  const numeric = Number(text.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return text;
  if (/\b(b|bn|billion)\b/i.test(text)) {
    return `USD ${(numeric * 1e3).toLocaleString(void 0, { maximumFractionDigits: 1 })}M`;
  }
  if (/\b(m|mn|million)\b/i.test(text)) {
    return `USD ${numeric.toLocaleString(void 0, { maximumFractionDigits: 1 })}M`;
  }
  if (/usd|dollar|\$/i.test(text) && numeric >= 1e6) {
    return `USD ${(numeric / 1e6).toLocaleString(void 0, { maximumFractionDigits: 1 })}M`;
  }
  return text;
}
function mainIndicationFrom(value) {
  const text = String(value || "").trim();
  if (!text || text === "-") return "-";
  return text.split(/\s*(?:;|\||,|\band\b)\s*/i).map((item) => item.trim()).filter(Boolean)[0] || text;
}
function normalizeCategoryText(value) {
  return String(value || "").trim().toLowerCase().replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ");
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchesDictionaryTerm(normalizedText, term) {
  const normalizedTerm = normalizeCategoryText(term);
  if (!normalizedText || !normalizedTerm) return false;
  if (normalizedText === normalizedTerm) return true;
  const compactTerm = normalizedTerm.replace(/[^a-z0-9]/g, "");
  const isShortToken = compactTerm.length <= 3 && /^[a-z0-9]+$/.test(compactTerm);
  if (isShortToken) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(compactTerm)}([^a-z0-9]|$)`, "i").test(normalizedText.replace(/[^a-z0-9]+/g, " "));
  }
  return normalizedText.includes(normalizedTerm);
}
function orderedDictionaryEntries(kind) {
  const entries = Array.isArray(state.categorySynonyms?.[kind]) ? state.categorySynonyms[kind] : [];
  if (kind !== "stage") return entries;
  const stagePriority = {
    "Discontinued / inactive": 120,
    "Approved / marketed": 110,
    Registration: 100,
    "Phase 3": 90,
    "Phase 2/3": 85,
    "Phase 2": 80,
    "Phase 1/2": 75,
    "Phase 1": 70,
    "IND-enabling": 65,
    IND: 60,
    "Lead Selection": 40,
    "Lead Optimization": 30,
    "Hit discovery": 20
  };
  return [...entries].sort((a, b) => {
    return (stagePriority[b?.canonical] || 0) - (stagePriority[a?.canonical] || 0);
  });
}
function canonicalFromDictionary(kind, value) {
  const text = String(value || "").trim();
  const normalized = normalizeCategoryText(text);
  if (!normalized || normalized === "-") return null;
  for (const entry of orderedDictionaryEntries(kind)) {
    if (!entry?.canonical) continue;
    if (matchesDictionaryTerm(normalized, entry.canonical)) return entry.canonical;
    const synonyms = Array.isArray(entry.synonyms) ? entry.synonyms : [];
    if (synonyms.some((term) => matchesDictionaryTerm(normalized, term))) {
      return entry.canonical;
    }
    const patterns = Array.isArray(entry.patterns) ? entry.patterns : [];
    for (const pattern of patterns) {
      try {
        if (new RegExp(pattern, "i").test(normalized)) return entry.canonical;
      } catch (error) {
        console.warn(`Invalid ${kind} synonym pattern skipped: ${pattern}`, error);
      }
    }
  }
  return null;
}
async function loadCategorySynonyms() {
  if (state.categorySynonymsLoaded) return;
  try {
    const response = await fetch(CATEGORY_SYNONYMS_URL);
    if (!response.ok) throw new Error(await response.text());
    const dictionary = await response.json();
    state.categorySynonyms = {
      country: Array.isArray(dictionary.country) ? dictionary.country : [],
      stage: Array.isArray(dictionary.stage) ? dictionary.stage : [],
      indication: Array.isArray(dictionary.indication) ? dictionary.indication : []
    };
  } catch (error) {
    console.warn("Category synonym dictionary unavailable; using built-in fallback rules.", error);
  } finally {
    state.categorySynonymsLoaded = true;
  }
}
function canonicalDashboardIndication(value) {
  const text = String(value || "").trim();
  const fromDictionary = canonicalFromDictionary("indication", text);
  if (fromDictionary) return fromDictionary;
  const normalized = normalizeCategoryText(text);
  if (!text || text === "-") return "-";
  if (/alzheimer|ad\b/.test(normalized)) return "Alzheimer's disease";
  if (/epilep|seizure|focal onset|partial onset|status epilepticus/.test(normalized)) return "Epilepsy / seizure disorders";
  if (/chronic cough|rcc|ucc|refractory cough|unexplained cough/.test(normalized)) return "Chronic cough";
  if (/multiple sclerosis|\bms\b|neuroinflamm|autoimmune/.test(normalized)) return "Multiple sclerosis / neuroinflammatory disease";
  if (/inflammatory bowel|\bibd\b|crohn|ulcerative colitis/.test(normalized)) return "Inflammatory bowel disease";
  if (/major depressive|depression|\bmdd\b/.test(normalized)) return "Major depressive disorder";
  if (/pain/.test(normalized)) return "Pain";
  if (/acute ischemic stroke|stroke/.test(normalized)) return "Stroke";
  return mainIndicationFrom(text).replace(/[\u2018\u2019\u201A\u201B]/g, "'");
}
function canonicalCountry(value) {
  const text = String(value || "").trim();
  const fromDictionary = canonicalFromDictionary("country", text);
  if (fromDictionary) return fromDictionary;
  const lowered = normalizeCategoryText(text);
  if (!text || text === "-") return "-";
  if (/china|hong kong|prc|mainland/.test(lowered)) return "China";
  if (/korea|republic of korea|south korea/.test(lowered)) return "Republic of Korea";
  if (/united states|usa|u\.s\.|us\b/.test(lowered)) return "United States";
  return text;
}
function canonicalDevelopmentStage(value) {
  const text = String(value || "").trim();
  const fromDictionary = canonicalFromDictionary("stage", text);
  if (fromDictionary) return fromDictionary;
  const normalized = normalizeCategoryText(text);
  if (!text || text === "-") return "-";
  if (/discontinued|terminated|withdrawn|suspended|inactive|dormant/.test(normalized)) return "Discontinued / inactive";
  if (/approved|launched|marketed|commercial/.test(normalized)) return "Approved / marketed";
  if (/nda|bla|maa|registration|filed|under review/.test(normalized)) return "Registration";
  if (/(phase|ph|p)\s*-?\s*(2|ii)\s*\/\s*(3|iii)|\b2\s*\/\s*3\s*상/.test(normalized)) return "Phase 2/3";
  if (/(phase|ph|p)\s*-?\s*(1|i)\s*\/\s*(2|ii)|\b1\s*\/\s*2\s*상/.test(normalized)) return "Phase 1/2";
  if (/(phase|ph|p)\s*-?\s*(3|iii)\b|\b3상/.test(normalized)) return "Phase 3";
  if (/(phase|ph|p)\s*-?\s*(2|ii)\b|\b2상/.test(normalized)) return "Phase 2";
  if (/(phase|ph|p)\s*-?\s*(1|i)\b|\b1상|\bfih\b|first[- ]?in[- ]?human/.test(normalized)) return "Phase 1";
  if (/ind[- ]?enabling|ind preparation|ind-ready|glp tox|candidate selection|candidate selected/.test(normalized)) return "IND-enabling";
  if (/preclinical|pre-clinical|nonclinical|in vivo|in vitro/.test(normalized)) return "Preclinical";
  if (/discovery|lead optimization|lead-op|hit-to-lead|research/.test(normalized)) return "Discovery";
  return text;
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function isPlaceholderRawMarkdown(value) {
  const text = String(value || "").trim();
  return !text || text === "Paste the full Markdown report text here if available." || text === "Markdown report is provided separately in the MD copy box.";
}
function criterion(record, key) {
  const item = get(record, `scoring.criteria.${key}`, {});
  const rubric = get(record, `rubric.${key}`, {});
  const definition = get(record, `criteria_registry.criteria.${key}`, {});
  const appliedRule = item.criteria_reference?.applied_rule_id || item.ai_champion?.rule_applied || (item.score != null ? `${key}:${item.score}` : "-");
  const rationale = item.score_rationale || {};
  const evidenceSources = Array.isArray(item.evidence_sources) ? item.evidence_sources : [];
  const matchingRule = (definition.scoring_rules || []).find((rule) => {
    return rule.rule_id === appliedRule || rule.score === item.score;
  });
  const scoreDefinition = item.score != null ? rubric.score_definitions?.[String(item.score)] : "";
  const mainLineSummary = item.main_line_summary || item.reason || rationale.decision_summary || "-";
  const uncertainPoints = Array.isArray(item.uncertain_points) ? item.uncertain_points : rationale.conflicting_or_missing_evidence || [];
  const sourceSummaries = evidenceSources.map((source) => source.evidence_summary).filter(Boolean);
  return {
    score: number(item.score),
    reason: mainLineSummary,
    mainLineSummary,
    evidenceType: item.evidence_type || "-",
    evidenceTypeReason: item.evidence_type_reason || "-",
    whyNotHigher: item.why_not_higher || "-",
    version: get(record, "meta.rubric_version", item.criteria_reference?.criteria_version || "-"),
    author: get(record, "meta.rubric_author", item.criteria_reference?.criteria_author || "-"),
    rule: appliedRule,
    ruleLabel: matchingRule?.label || (item.score != null ? `${item.score}\uC810 \uAE30\uC900` : "-"),
    ruleCriteria: scoreDefinition || matchingRule?.criteria || "-",
    evidenceExpectation: definition.evidence_expectation || "-",
    appliedScoreDefinition: scoreDefinition || rationale.applied_score_definition || matchingRule?.criteria || "-",
    decisionSummary: mainLineSummary,
    keyJudgmentFactors: rationale.key_judgment_factors || [],
    supportingEvidenceSummary: sourceSummaries.join(" | ") || rationale.supporting_evidence_summary || "-",
    conflictingOrMissingEvidence: uncertainPoints,
    confidence: rationale.confidence || "Unclear",
    investigationNote: item.investigation_note || rationale.reviewer_notes || "-",
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
    ...Array.isArray(hardFilter.flags) ? hardFilter.flags : [],
    ...Array.isArray(hardFilter.fail_reasons) ? hardFilter.fail_reasons : [],
    record.structured_table?.development_stage,
    record.json_summary?.theme,
    record.json_summary?.cluster
  ];
  Object.values(criteria).forEach((item) => {
    if (!item || typeof item !== "object") return;
    notes.push(item.main_line_summary, item.investigation_note);
    if (Array.isArray(item.uncertain_points)) notes.push(...item.uncertain_points);
  });
  return notes.filter(Boolean).join(" | ");
}
function hasNoThemeFit(theme, cluster) {
  const value = `${theme || ""} ${cluster || ""}`.toLowerCase();
  return !value.trim() || /no theme|no cluster|no mapped|none|미해당/.test(value);
}
function computeHardFilter(record, criteria) {
  const summary = record.json_summary || {};
  const scoring = record.scoring || {};
  const total = number(scoring.total_score);
  const targetScore = number(summary.target_relevance_score ?? criteria.target.score);
  const moaScore = number(criteria.moa.score);
  const dataScore = number(criteria.data.score);
  const theme = summary.theme || "";
  const cluster = summary.cluster || "";
  const notes = collectHardFilterNotes(record);
  const reasons = [];
  const noThemeFit = hasNoThemeFit(theme, cluster);
  const failBlocker = /(outside primary|outside.*theme|out of scope|no public target|no.*target\/moa|discontinued|dormant|범위 밖|미해당|중단)/i.test(notes);
  const reviewUncertainty = /(stage|rights?|license|licensed|ownership|asset identity|identity|source|official|registry|unclear|uncertain|not public|not verified|confirmation|confirm|sponsor|단계|권리|출처|공식|불확실|확인|미확인|식별|정체|라이선스|스폰서)/i.test(notes);
  if (Number.isFinite(total) && total <= 8) reasons.push(`Total score ${total} <= 8`);
  if (Number.isFinite(targetScore) && targetScore <= 1) reasons.push(`Target Relevance ${targetScore} <= 1`);
  if (noThemeFit) reasons.push("SKBP Theme/Cluster fit \uC5C6\uC74C");
  if (failBlocker) reasons.push("Hard blocker keyword detected");
  if (reasons.length) {
    return { status: "FAIL", reason: reasons.join("; ") };
  }
  const passScores = total >= 14 && targetScore >= 3 && moaScore >= 2 && dataScore >= 2;
  if (passScores && !reviewUncertainty) {
    return {
      status: "PASS",
      reason: `Total ${total} >= 14, TR ${targetScore} >= 3, MOA ${moaScore} >= 2, Data ${dataScore} >= 2, hard blocker \uC5C6\uC74C`
    };
  }
  if (Number.isFinite(total) && total >= 9 && total <= 13) {
    reasons.push(`Total score ${total} is REVIEW range 9-13`);
  }
  if (!passScores) {
    reasons.push(`PASS score gate \uBBF8\uCDA9\uC871: Total ${total ?? "-"}, TR ${targetScore ?? "-"}, MOA ${moaScore ?? "-"}, Data ${dataScore ?? "-"}`);
  }
  if (reviewUncertainty) {
    reasons.push("stage/rights/asset identity/source \uBD88\uD655\uC2E4\uC131 \uD655\uC778 \uD544\uC694");
  }
  return { status: "REVIEW", reason: reasons.join("; ") || "\uCD94\uAC00 diligence \uD544\uC694" };
}
function normalizeTriageStatus(value) {
  const text = String(value || "").trim().toUpperCase();
  if (["SELECT", "REJECT", "N/A", "NA"].includes(text)) {
    return text === "NA" ? "N/A" : text;
  }
  return "";
}
function isTriageRecord(record) {
  const status = normalizeTriageStatus(record?.hard_filter?.status || record?.triage?.status || record?.triage_status);
  const parserStatus = String(record?.source_report?.parser_status || "").toLowerCase();
  const reviewType = String(record?.meta?.review_type || record?.meta?.workflow || "").toLowerCase();
  return Boolean(status) || parserStatus.includes("triage") || reviewType.includes("triage");
}
function recordFilter1Status(record) {
  const triageRecord = isTriageRecord(record);
  const stage = canonicalDevelopmentStage(record?.structured_table?.development_stage || "");
  if (triageRecord && stage === "Discontinued / inactive") {
    return {
      status: "REJECT",
      reason: "Fast triage auto-reject: discontinued / inactive pipeline"
    };
  }
  const triageStatus = normalizeTriageStatus(record?.hard_filter?.status || record?.triage?.status || record?.triage_status);
  if (triageStatus) {
    return {
      status: triageStatus,
      reason: record?.hard_filter?.reason || record?.triage?.reason || record?.triage_reason || "Fast triage result"
    };
  }
  return { status: "-", reason: "" };
}
function recordFilter2Status(record, computedHardFilter) {
  return isTriageRecord(record) ? { status: "-", reason: "Full Scout v3.1 not run yet" } : computedHardFilter;
}
function flattenRecord(record, index) {
  const summary = record.json_summary || {};
  const table = record.structured_table || {};
  const scoring = record.scoring || {};
  const targetCriterion = get(record, "scoring.criteria.target_relevance", {});
  const champion = targetCriterion.ai_champion || {};
  const criteria = {
    target: criterion(record, "target_relevance"),
    competitive: criterion(record, "competitive_landscape"),
    moa: criterion(record, "moa_validity"),
    platform: criterion(record, "platform_attractiveness"),
    expansion: criterion(record, "expansion_potential"),
    data: criterion(record, "data_maturity"),
    market: criterion(record, "marketability")
  };
  const computedHardFilter = computeHardFilter(record, criteria);
  const filter1Status = recordFilter1Status(record);
  const filter2Status = recordFilter2Status(record, computedHardFilter);
  const filterStatus = filter1Status.status !== "-" ? filter1Status : filter2Status;
  return {
    id: get(record, "meta.output_filename_base", `${summary.company || table.company || "record"}-${index}`),
    company: summary.company || table.company || "-",
    countryRaw: summary.company_country || table.company_country || "-",
    country: canonicalCountry(summary.company_country || table.company_country || "-"),
    asset: summary.asset_name || table.asset_name || "-",
    target: summary.target || table.target || "-",
    theme: summary.theme || get(champion, "matched_theme.name", "-"),
    cluster: summary.cluster || get(champion, "matched_cluster.name", "-"),
    stageRaw: table.development_stage || "-",
    stage: canonicalDevelopmentStage(table.development_stage || "-"),
    indication: table.indication || "-",
    mainIndicationRaw: table.main_indication || table.primary_indication || summary.main_indication || mainIndicationFrom(table.indication),
    mainIndication: canonicalDashboardIndication(table.main_indication || table.primary_indication || summary.main_indication || table.indication),
    modality: table.modality_platform || "-",
    isTriage: isTriageRecord(record),
    filter1: filter1Status.status,
    filter2: filter2Status.status,
    hardFilter: filterStatus.status,
    hardFilterReason: filterStatus.reason,
    targetScore: number(summary.target_relevance_score ?? criteria.target.score ?? champion.score),
    competitiveScore: criteria.competitive.score,
    moaScore: criteria.moa.score,
    platformScore: criteria.platform.score,
    expansionScore: criteria.expansion.score,
    dataScore: criteria.data.score,
    marketScore: criteria.market.score,
    totalScore: number(scoring.total_score),
    maxScore: number(scoring.max_score) || 21,
    competition: get(record, "competitive_analysis.competitive_density", "Unclear"),
    similarPipelineCount: number(get(record, "competitive_analysis.similarity_summary.similar_pipeline_count", 0)),
    highSimilarityCount: number(get(record, "competitive_analysis.similarity_summary.high_similarity_count", 0)),
    summary: get(record, "final_insight.one_line_summary", summary.one_line_summary || "-"),
    criteriaVersion: get(record, "meta.rubric_version", get(record, "scoring.criteria.target_relevance.criteria_reference.criteria_version", "-")),
    criteria,
    raw: record
  };
}
var EXTRA_COLUMN_DEFINITIONS = [
  { key: "moa", label: "MoA", path: "structured_table.moa" },
  { key: "modality", label: "Modality", path: "structured_table.modality_platform" },
  { key: "indication", label: "Indication", path: "structured_table.indication" },
  { key: "headquarters", label: "HQ", path: "company_profile.headquarters" },
  { key: "companyStage", label: "Company stage", path: "company_profile.company_stage" },
  { key: "platformSummary", label: "Platform summary", path: "company_profile.platform_summary" },
  { key: "competitiveDensity", label: "Competition", path: "competitive_analysis.competitive_density" },
  { key: "similarCount", label: "Similar count", path: "competitive_analysis.similarity_summary.similar_pipeline_count" },
  { key: "recommendation", label: "Recommendation", path: "scoring.recommendation" },
  { key: "parserStatus", label: "Parser status", path: "source_report.parser_status" },
  { key: "firstSource", label: "First source URL", path: "structured_table.sources.0.source_url" },
  { key: "uncertainPoints", label: "Uncertain points", path: "validation.uncertain_points" }
];
function formatExtraColumnValue(value) {
  if (value === null || value === void 0 || value === "") return "-";
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).filter(Boolean).slice(0, 3).join(" | ") || "-";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function selectedExtraColumns() {
  return EXTRA_COLUMN_DEFINITIONS.filter((column) => state.extraColumns.has(column.key));
}
function persistExtraColumns() {
  localStorage.setItem("skbp.dashboard.extraColumns", JSON.stringify([...state.extraColumns]));
}
function extraColumnKey(column) {
  return `extra:${column.key}`;
}
function defaultColumnWidth(key) {
  return DEFAULT_COLUMN_WIDTHS[key] || DEFAULT_COLUMN_WIDTHS.extra;
}
function minColumnWidth(key) {
  return MIN_COLUMN_WIDTHS[key] || MIN_COLUMN_WIDTHS.extra;
}
function columnWidth(key) {
  const width = Number(state.columnWidths[key]);
  return Number.isFinite(width) ? Math.max(minColumnWidth(key), Math.min(MAX_COLUMN_WIDTH, width)) : defaultColumnWidth(key);
}
function columnWidthStyle(key) {
  const width = columnWidth(key);
  return `width: ${width}px; min-width: ${width}px; max-width: ${width}px;`;
}
function columnAttrs(key) {
  return `data-col-key="${escapeHtml(key)}" style="${columnWidthStyle(key)}"`;
}
function resizeHandle(key) {
  if (key === "select") return "";
  return `<span class="column-resize-handle" data-resize-column="${escapeHtml(key)}" aria-hidden="true"></span>`;
}
function sortableHeader(label, sortKey, columnKey, attrs = "") {
  return `<th ${attrs} ${columnAttrs(columnKey)}><button data-sort="${escapeHtml(sortKey)}" type="button">${escapeHtml(label)}</button>${resizeHandle(columnKey)}</th>`;
}
function plainHeader(label, columnKey, className = "") {
  const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
  return `<th${classAttr} ${columnAttrs(columnKey)}><span title="${escapeHtml(label)}">${escapeHtml(label)}</span>${resizeHandle(columnKey)}</th>`;
}
function activeTableMode() {
  return state.tableMode === "triage" ? "triage" : "full";
}
function activeFilterKey() {
  return activeTableMode() === "triage" ? "filter1" : "filter2";
}
function activeFilterLabel() {
  return activeTableMode() === "triage" ? "Filter 1" : "Filter 2";
}
function activeScoreColumnKeys() {
  const triageCore = ["targetScore", "moaScore", "dataScore"];
  if (activeTableMode() === "triage") return triageCore;
  return [
    ...triageCore,
    "competitiveScore",
    "platformScore",
    "expansionScore",
    "marketScore",
    "totalScore"
  ];
}
function rowMatchesActiveTableMode(row) {
  if (activeTableMode() === "full") {
    return !row.isTriage;
  }
  const status = row[activeFilterKey()];
  return Boolean(status && status !== "-");
}
function visibleColumnKeys(extraColumns = selectedExtraColumns()) {
  return [
    "select",
    "company",
    "country",
    "asset",
    "target",
    "mainIndication",
    "stage",
    activeFilterKey(),
    ...activeScoreColumnKeys(),
    ...extraColumns.map(extraColumnKey)
  ];
}
function visibleTableWidth(extraColumns = selectedExtraColumns()) {
  return visibleColumnKeys(extraColumns).reduce((sum, key) => sum + columnWidth(key), 0);
}
function persistColumnWidths() {
  localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(state.columnWidths));
}
function applyColumnWidths(extraColumns = selectedExtraColumns()) {
  visibleColumnKeys(extraColumns).forEach((key) => {
    document.querySelectorAll(`[data-col-key="${CSS.escape(key)}"]`).forEach((element) => {
      element.style.width = `${columnWidth(key)}px`;
      element.style.minWidth = `${columnWidth(key)}px`;
      element.style.maxWidth = `${columnWidth(key)}px`;
    });
  });
  const tableElement = elements.pipelineTable?.closest("table");
  if (tableElement) tableElement.style.minWidth = `${visibleTableWidth(extraColumns)}px`;
}
function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}
function formatAverage(value, max) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)} / ${max}`;
}
function countBy(rows, keyGetter) {
  return rows.reduce((acc, row) => {
    const key = keyGetter(row) || "-";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function getVisibleRows() {
  const query = state.query.trim().toLowerCase();
  const filterKey = activeFilterKey();
  return state.rows.filter((row) => {
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
    ].join(" ").toLowerCase();
    return rowMatchesActiveTableMode(row) && (!query || searchable.includes(query)) && (state.stage === "all" || row.stage === state.stage) && (state.theme === "all" || row.theme === state.theme) && (state.cluster === "all" || row.cluster === state.cluster) && (state.indication === "all" || row.mainIndication === state.indication) && (state.country === "all" || row.country === state.country) && (state.pass === "all" || row[filterKey] === state.pass);
  }).sort((a, b) => {
    const av = a[state.sortKey];
    const bv = b[state.sortKey];
    const direction = state.sortDirection === "asc" ? 1 : -1;
    if (typeof av === "number" || typeof bv === "number") {
      return ((av ?? -Infinity) - (bv ?? -Infinity)) * direction;
    }
    return String(av ?? "").localeCompare(String(bv ?? ""), "ko") * direction;
  });
}
function renderFilters() {
  const stages = [...new Set(state.rows.map((row) => row.stage).filter(Boolean))].sort();
  const themes = [...new Set(state.rows.map((row) => row.theme).filter(Boolean))].sort();
  const clusters = [...new Set(state.rows.map((row) => row.cluster).filter(Boolean))].sort();
  const countries = [...new Set(state.rows.map((row) => row.country).filter(Boolean))].sort();
  const indications = [...new Set(state.rows.map((row) => row.mainIndication).filter(Boolean))].sort();
  const filterKey = activeFilterKey();
  const filterStatuses = [...new Set(state.rows.filter(rowMatchesActiveTableMode).map((row) => row[filterKey]).filter((value) => value && value !== "-"))].sort((a, b) => {
    const order = ["SELECT", "PASS", "REVIEW", "REJECT", "FAIL", "N/A"];
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  });
  const option = (value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
  if (state.pass !== "all" && !filterStatuses.includes(state.pass)) {
    state.pass = "all";
  }
  elements.stageFilter.innerHTML = [
    '<option value="all">\uC804\uCCB4</option>',
    ...stages.map(option)
  ].join("");
  elements.themeFilter.innerHTML = [
    '<option value="all">\uC804\uCCB4</option>',
    ...themes.map(option)
  ].join("");
  elements.clusterFilter.innerHTML = [
    '<option value="all">\uC804\uCCB4</option>',
    ...clusters.map(option)
  ].join("");
  elements.countryFilter.innerHTML = [
    '<option value="all">\uC804\uCCB4</option>',
    ...countries.map(option)
  ].join("");
  elements.indicationFilter.innerHTML = [
    '<option value="all">\uC804\uCCB4</option>',
    ...indications.map(option)
  ].join("");
  elements.passFilter.innerHTML = [
    '<option value="all">\uC804\uCCB4</option>',
    ...filterStatuses.map(option)
  ].join("");
  elements.passFilter.value = state.pass;
}
function renderMetrics() {
  const total = state.rows.length;
  const pass = state.rows.filter((row) => row.filter1 === "SELECT" || row.filter2 === "PASS").length;
  const avgTotal = average(state.rows.map((row) => row.totalScore));
  const avgTarget = average(state.rows.map((row) => row.targetScore));
  const maxTotal = state.rows.find((row) => Number.isFinite(row.maxScore))?.maxScore || 21;
  const countries = new Set(state.rows.map((row) => row.country).filter((country) => country && country !== "-"));
  elements.metricTotal.textContent = String(total);
  elements.metricPass.textContent = total ? `${pass} / ${total}` : "-";
  elements.metricScore.textContent = formatAverage(avgTotal, maxTotal);
  elements.metricTarget.textContent = formatAverage(avgTarget, 3);
  elements.metricCountries.textContent = String(countries.size);
}
function chartBar(label, value, max, tone = "") {
  const width = max ? Math.round(value / max * 100) : 0;
  const safeLabel = escapeHtml(label);
  return `
    <div class="bar-row">
      <span title="${safeLabel}">${safeLabel}</span>
      <div class="bar-track"><div class="bar-fill ${tone}" style="width:${width}%"></div></div>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
function renderCharts() {
  const targetCounts = countBy(state.rows, (row) => row.targetScore ? `${row.targetScore}\uC810` : "\uBBF8\uD3C9\uAC00");
  const maxTarget = Math.max(1, ...Object.values(targetCounts));
  elements.targetChart.innerHTML = ["3\uC810", "2\uC810", "1\uC810", "\uBBF8\uD3C9\uAC00"].map((label) => chartBar(label, targetCounts[label] || 0, maxTarget, label === "3\uC810" ? "good" : "")).join("");
  const themeCounts = countBy(state.rows, (row) => row.theme || "N/A");
  const maxTheme = Math.max(1, ...Object.values(themeCounts));
  elements.themeChart.innerHTML = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => chartBar(label, value, maxTheme, "accent")).join("");
  const countryCounts = countBy(state.rows, (row) => row.country || "N/A");
  const maxCountry = Math.max(1, ...Object.values(countryCounts));
  elements.countryChart.innerHTML = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => chartBar(label, value, maxCountry, "country")).join("");
  const total = state.rows.length;
  const pass = state.rows.filter((row) => row.filter1 === "SELECT" || row.filter2 === "PASS").length;
  const passRate = total ? Math.round(pass / total * 100) : 0;
  elements.passDonut.style.setProperty("--pass-rate", `${passRate}%`);
  elements.passDonut.textContent = `${passRate}%`;
  elements.passLegend.innerHTML = `
    <span><b class="legend-dot pass"></b>PASS/SELECT ${pass}</span>
    <span><b class="legend-dot fail"></b>Other ${Math.max(total - pass, 0)}</span>
  `;
  if (elements.scoreAverageChart) {
    const scoreItems = [
      ["TR", average(state.rows.map((row) => row.targetScore))],
      ["MOA", average(state.rows.map((row) => row.moaScore))],
      ["Data", average(state.rows.map((row) => row.dataScore))],
      ["Comp", average(state.rows.map((row) => row.competitiveScore))],
      ["Plat", average(state.rows.map((row) => row.platformScore))],
      ["Exp", average(state.rows.map((row) => row.expansionScore))],
      ["Market", average(state.rows.map((row) => row.marketScore))]
    ];
    elements.scoreAverageChart.innerHTML = scoreItems.map(([label, value]) => chartBar(label, Number.isFinite(value) ? Number(value.toFixed(1)) : 0, 3, value >= 2 ? "good" : "")).join("");
  }
  if (elements.priorityList) {
    const topRows = [...state.rows].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1)).slice(0, 3);
    elements.priorityList.innerHTML = topRows.length ? topRows.map((row) => `
          <button type="button" class="priority-item" data-record-id="${escapeHtml(row.id)}">
            <strong>${escapeHtml(row.asset)}</strong>
            <span>${escapeHtml(row.theme)} \xB7 ${escapeHtml(row.cluster)}</span>
            <b>${row.totalScore ?? "-"} / ${row.maxScore ?? 21}</b>
          </button>
        `).join("") : '<div class="empty-state">No assets loaded</div>';
  }
}
function renderColumnSettings() {
  if (!elements.columnSettingsGrid) return;
  elements.columnSettingsGrid.innerHTML = EXTRA_COLUMN_DEFINITIONS.map((column) => `
    <label class="column-option">
      <input type="checkbox" value="${escapeHtml(column.key)}" ${state.extraColumns.has(column.key) ? "checked" : ""} />
      <span>${escapeHtml(column.label)}</span>
      <small>${escapeHtml(column.path)}</small>
    </label>
  `).join("");
}
function scoreTooltip(label, criterionInfo, max) {
  const meaningfulValue = (value) => {
    if (value === null || value === void 0) return "";
    const text = String(value).trim();
    if (!text || text === "-" || /^null$/i.test(text) || /^undefined$/i.test(text)) return "";
    return text;
  };
  const pushLine = (lines2, lineLabel, value) => {
    const text = meaningfulValue(value);
    if (text) lines2.push(`${lineLabel}: ${text}`);
  };
  const score = meaningfulValue(criterionInfo?.score);
  const lines = [score ? `${label}: ${score} / ${max}` : label];
  const evidenceType = meaningfulValue(criterionInfo?.evidenceType);
  const evidenceReason = meaningfulValue(criterionInfo?.evidenceTypeReason);
  if (evidenceType && evidenceReason) {
    lines.push(`Evidence Type: ${evidenceType} (${evidenceReason})`);
  } else {
    pushLine(lines, "Evidence Type", evidenceType);
  }
  const calc = criterionInfo?.calculation;
  if (calc?.A_targetable_addressable_patient || calc?.B_unrisked_peak_sales || calc?.C_obtainable_peak_sales) {
    const a = calc.A_targetable_addressable_patient || {};
    const b = calc.B_unrisked_peak_sales || {};
    const c = calc.C_obtainable_peak_sales || {};
    const aValue = [meaningfulValue(a.targetable_addressable_patient), meaningfulValue(a.formula)].filter(Boolean).join(" | ");
    const bValue = [meaningfulValue(formatMillionUsd(b.unrisked_peak_sales, b.sales_unit)), meaningfulValue(b.formula)].filter(Boolean).join(" | ");
    const cValue = [meaningfulValue(formatMillionUsd(c.obtainable_peak_sales, c.sales_unit)), meaningfulValue(c.formula)].filter(Boolean).join(" | ");
    pushLine(lines, "A. TAP", aValue);
    pushLine(lines, "B. Unrisked Peak Sales", bValue);
    pushLine(lines, "C. Obtainable Peak Sales", cValue);
  }
  pushLine(lines, "Rubric", criterionInfo?.appliedScoreDefinition || criterionInfo?.ruleCriteria);
  pushLine(lines, "Judgment", criterionInfo?.mainLineSummary || criterionInfo?.decisionSummary || criterionInfo?.reason);
  pushLine(lines, "Why not higher", criterionInfo?.whyNotHigher);
  pushLine(lines, "Investigation note", criterionInfo?.investigationNote);
  pushLine(lines, "Evidence summary", criterionInfo?.supportingEvidenceSummary);
  const sources = (criterionInfo?.evidenceSources || []).slice(0, 3).map((source) => {
    const title = meaningfulValue(source.source_title);
    const url = meaningfulValue(source.source_url);
    if (title && url) return `${title} (${url})`;
    return title || url;
  }).filter(Boolean).join("\n");
  pushLine(lines, "Sources", sources);
  const missing = (criterionInfo?.conflictingOrMissingEvidence || []).map(meaningfulValue).filter(Boolean).slice(0, 2).join("; ");
  pushLine(lines, "Missing or conflicting evidence", missing);
  const versionInfo = [criterionInfo?.version, criterionInfo?.author].map(meaningfulValue).filter(Boolean).join(" / ");
  pushLine(lines, "Rubric version", versionInfo);
  return lines.join("\n");
}
function scoreBadge(score, max = 3, tooltip = "") {
  const className = score >= max ? "score high" : score >= max * 0.6 ? "score mid" : "score low";
  const safeTooltip = escapeHtml(tooltip);
  return `<span class="${className}" data-tooltip="${safeTooltip}" title="${safeTooltip}">${score ?? "-"}</span>`;
}
function pendingScoreBadge(message = "Full Scout v3.1 review not run yet") {
  const safeTooltip = escapeHtml(message);
  return `<span class="score pending" data-tooltip="${safeTooltip}" title="${safeTooltip}">-</span>`;
}
function fullReviewScoreBadge(row, scoreKey, criterionKey, label) {
  if (row.isTriage) return pendingScoreBadge();
  return scoreBadge(row[scoreKey], 3, scoreTooltip(label, row.criteria[criterionKey], 3));
}
function filterToneClass(status) {
  if (!status || status === "-") return "empty";
  if (["PASS", "SELECT"].includes(status)) return "pass select";
  if (status === "FAIL") return "fail";
  if (["REJECT", "N/A"].includes(status)) return "na reject";
  return "review";
}
function renderTable() {
  const visibleRows = getVisibleRows();
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = visibleRows.slice(start, start + state.pageSize);
  const extraColumns = selectedExtraColumns();
  const mode = activeTableMode();
  const filterKey = activeFilterKey();
  const filterLabel = activeFilterLabel();
  const scoreColumns = activeScoreColumnKeys();
  const modeLabel = mode === "triage" ? "Fast Triage" : "Full Scout";
  const scoreLabels = {
    targetScore: "TR",
    moaScore: "MOA",
    dataScore: "Data",
    competitiveScore: "Comp",
    platformScore: "Plat",
    expansionScore: "Exp",
    marketScore: "Market",
    totalScore: "Total"
  };
  if (elements.pipelineColGroup) {
    elements.pipelineColGroup.innerHTML = `
      <col class="pipeline-col-select" data-col-key="select" style="${columnWidthStyle("select")}" />
      <col class="pipeline-col-company" data-col-key="company" style="${columnWidthStyle("company")}" />
      <col class="pipeline-col-country" data-col-key="country" style="${columnWidthStyle("country")}" />
      <col class="pipeline-col-asset" data-col-key="asset" style="${columnWidthStyle("asset")}" />
      <col class="pipeline-col-target" data-col-key="target" style="${columnWidthStyle("target")}" />
      <col class="pipeline-col-indication" data-col-key="mainIndication" style="${columnWidthStyle("mainIndication")}" />
      <col class="pipeline-col-stage" data-col-key="stage" style="${columnWidthStyle("stage")}" />
      <col class="pipeline-col-filter" data-col-key="${filterKey}" style="${columnWidthStyle(filterKey)}" />
      ${scoreColumns.map((key) => `<col class="pipeline-col-score" data-col-key="${escapeHtml(key)}" style="${columnWidthStyle(key)}" />`).join("")}
      ${extraColumns.map((column) => `<col class="pipeline-col-extra" data-col-key="${escapeHtml(extraColumnKey(column))}" style="${columnWidthStyle(extraColumnKey(column))}" />`).join("")}
    `;
  }
  const tableElement = elements.pipelineTable?.closest("table");
  if (tableElement) {
    tableElement.style.minWidth = `${visibleTableWidth(extraColumns)}px`;
  }
  if (elements.pipelineTableHead) {
    elements.pipelineTableHead.innerHTML = `
      <tr id="pipelineHeaderRow" class="pipeline-group-row">
        <th class="select-col" rowspan="2" ${columnAttrs("select")}>
          <input id="selectPageRows" type="checkbox" aria-label="Select visible page rows" />
        </th>
        ${sortableHeader("Company", "company", "company", 'rowspan="2"')}
        ${sortableHeader("Country", "country", "country", 'rowspan="2"')}
        ${sortableHeader("Asset", "asset", "asset", 'rowspan="2"')}
        ${sortableHeader("Target / Theme / Cluster", "target", "target", 'rowspan="2"')}
        ${sortableHeader("Main indication", "mainIndication", "mainIndication", 'rowspan="2"')}
        ${sortableHeader("Stage", "stage", "stage", 'rowspan="2"')}
        ${sortableHeader(filterLabel, filterKey, filterKey, 'rowspan="2"')}
        ${mode === "triage" ? '<th class="score-group-head" colspan="3">Fast Triage Core</th>' : '<th class="score-group-head" colspan="3">Triage Core</th><th class="score-group-head" colspan="5">Full Scout only</th>'}
        ${extraColumns.length ? `<th class="extra-group-head" colspan="${extraColumns.length}">Custom Fields</th>` : ""}
      </tr>
      <tr class="pipeline-score-row">
        ${scoreColumns.map((key) => sortableHeader(scoreLabels[key] || key, key, key)).join("")}
        ${extraColumns.map((column) => plainHeader(column.label, extraColumnKey(column), "extra-column-head")).join("")}
      </tr>
    `;
    elements.pipelineHeaderRow = document.querySelector("#pipelineHeaderRow");
    elements.selectPageRows = document.querySelector("#selectPageRows");
  }
  elements.tableCount.textContent = `${modeLabel}: ${visibleRows.length} items \uCA0C ${state.pageSize} rows/page`;
  elements.pipelineTable.innerHTML = pageRows.length ? pageRows.map((row) => {
    const filterClass = `pill ${filterToneClass(row[filterKey])}`;
    const isSelected = state.selectedIds.has(row.id);
    const checked = isSelected ? "checked" : "";
    const rowTitle = mode === "triage" ? markdownPreviewSnippet(rawMarkdownForRow(row), row.summary) : row.summary;
    return `
            <tr class="clickable-row${mode === "triage" ? " triage-preview-row" : ""}${isSelected ? " selected-row" : ""}" data-record-id="${escapeHtml(row.id)}" title="${escapeHtml(rowTitle)}">
              <td class="select-col">
                <input class="row-select" type="checkbox" data-record-id="${escapeHtml(row.id)}" aria-label="${escapeHtml(row.asset)} select" ${checked} />
              </td>
              <td class="company-cell">${escapeHtml(row.company)}</td>
              <td class="country-cell" title="${escapeHtml(row.countryRaw)}">${escapeHtml(row.country)}</td>
              <td class="asset-cell"><strong>${escapeHtml(row.asset)}</strong></td>
              <td class="target-column-cell">
                <div class="target-cell">
                  <strong>${escapeHtml(row.target)}</strong>
                  <span>Theme: ${escapeHtml(row.theme)}</span>
                  <span>Cluster: ${escapeHtml(row.cluster)}</span>
                </div>
              </td>
              <td class="indication-cell" title="${escapeHtml(row.indication)}">${escapeHtml(row.mainIndication)}</td>
              <td class="stage-cell" title="${escapeHtml(row.stageRaw)}">${escapeHtml(row.stage)}</td>
              <td class="filter-cell"><span class="${filterClass}">${escapeHtml(row[filterKey])}</span></td>
              <td class="score-cell">${scoreBadge(row.targetScore, 3, scoreTooltip("Target Relevance", row.criteria.target, 3))}</td>
              <td class="score-cell">${scoreBadge(row.moaScore, 3, scoreTooltip("MOA Validity", row.criteria.moa, 3))}</td>
              <td class="score-cell">${scoreBadge(row.dataScore, 3, scoreTooltip("Data Maturity", row.criteria.data, 3))}</td>
              ${mode === "full" ? `
                <td class="score-cell">${fullReviewScoreBadge(row, "competitiveScore", "competitive", "Competitive Landscape")}</td>
                <td class="score-cell">${fullReviewScoreBadge(row, "platformScore", "platform", "Platform Attractiveness")}</td>
                <td class="score-cell">${fullReviewScoreBadge(row, "expansionScore", "expansion", "Expansion Potential")}</td>
                <td class="score-cell">${fullReviewScoreBadge(row, "marketScore", "market", "Marketability")}</td>
                <td class="score-cell total-score-cell">${scoreBadge(row.totalScore, row.maxScore, `Total Score: ${row.totalScore ?? "-"} / ${row.maxScore}`)}</td>
              ` : ""}
              ${extraColumns.map((column) => {
      const value = formatExtraColumnValue(get(row.raw, column.path, "-"));
      return `<td class="extra-column-cell" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
    }).join("")}
            </tr>
          `;
  }).join("") : `<tr><td colspan="${8 + scoreColumns.length + extraColumns.length}" class="empty-cell">No matching ${modeLabel} rows.</td></tr>`;
  elements.pageInfo.textContent = `${state.page} / ${pageCount}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  updateSelectionControls(pageRows);
}
function updateSelectionControls(pageRows = null) {
  const visibleRows = pageRows || getVisibleRows().slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
  const selectedCount = state.selectedIds.size;
  if (elements.deleteSelectedButton) {
    elements.deleteSelectedButton.disabled = selectedCount === 0;
    elements.deleteSelectedButton.textContent = selectedCount ? `\uC120\uD0DD \uC0AD\uC81C (${selectedCount})` : "\uC120\uD0DD \uC0AD\uC81C";
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
  const confirmed = window.confirm(`${ids.length}\uAC1C record\uB97C \uC0AD\uC81C\uD560\uAE4C\uC694? \uC774 \uC791\uC5C5\uC740 json/pipeline-records.json\uC5D0\uC11C \uD574\uB2F9 \uB370\uC774\uD130\uB97C \uC81C\uAC70\uD569\uB2C8\uB2E4.`);
  if (!confirmed) return;
  elements.dataStatus.textContent = "Deleting";
  try {
    const response = await fetch(`${API_URL}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    state.selectedIds.clear();
    elements.dataStatus.textContent = `${result.deleted} records deleted`;
    await loadRecords();
  } catch (error) {
    elements.dataStatus.textContent = "Delete failed";
    elements.saveStatus.textContent = error.message;
  }
}
function renderTableTabs() {
  elements.pipelineTableTabs?.forEach((tab) => {
    const isActive = tab.dataset.tableMode === activeTableMode();
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.tabIndex = isActive ? 0 : -1;
  });
}
function render() {
  if (elements.pageSizeSelect) elements.pageSizeSelect.value = String(state.pageSize);
  renderTableTabs();
  renderMetrics();
  renderCharts();
  renderColumnSettings();
  renderTable();
}
function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
function scoreExportFields(row, key) {
  const item = row.criteria[key] || {};
  const sources = (item.evidenceSources || []).map((source) => `${source.source_title || ""}${source.source_url ? ` ${source.source_url}` : ""}`.trim()).filter(Boolean).join(" | ");
  return [
    item.score ?? "",
    item.evidenceType || "",
    item.evidenceTypeReason || "",
    item.rule || "",
    item.ruleLabel || "",
    item.appliedScoreDefinition || item.ruleCriteria || "",
    item.mainLineSummary || item.reason || "",
    item.whyNotHigher || "",
    item.decisionSummary || item.mainLineSummary || "",
    (item.keyJudgmentFactors || []).join(" | "),
    item.supportingEvidenceSummary || "",
    (item.conflictingOrMissingEvidence || []).join(" | "),
    item.confidence || "",
    sources
  ];
}
function exportPipelineTable() {
  const rows = getVisibleRows();
  const extraColumns = selectedExtraColumns();
  const headers = [
    "Company",
    "Country",
    "Asset",
    "Target",
    "Theme",
    "Cluster",
    "Main Indication",
    "Stage",
    "Indication",
    "Modality",
    "Filter 1",
    "Filter 2",
    "Target Relevance Score",
    "Target Relevance Evidence Type",
    "Target Relevance Evidence Type Reason",
    "Target Relevance Rule",
    "Target Relevance Rule Label",
    "Target Relevance Applied Criteria",
    "Target Relevance Reason",
    "Target Relevance Why Not Higher",
    "Target Relevance Decision Summary",
    "Target Relevance Key Factors",
    "Target Relevance Evidence Summary",
    "Target Relevance Missing Evidence",
    "Target Relevance Confidence",
    "Target Relevance Sources",
    "Competitive Score",
    "Competitive Evidence Type",
    "Competitive Evidence Type Reason",
    "Competitive Rule",
    "Competitive Rule Label",
    "Competitive Applied Criteria",
    "Competitive Reason",
    "Competitive Why Not Higher",
    "Competitive Decision Summary",
    "Competitive Key Factors",
    "Competitive Evidence Summary",
    "Competitive Missing Evidence",
    "Competitive Confidence",
    "Competitive Sources",
    "MOA Score",
    "MOA Evidence Type",
    "MOA Evidence Type Reason",
    "MOA Rule",
    "MOA Rule Label",
    "MOA Applied Criteria",
    "MOA Reason",
    "MOA Why Not Higher",
    "MOA Decision Summary",
    "MOA Key Factors",
    "MOA Evidence Summary",
    "MOA Missing Evidence",
    "MOA Confidence",
    "MOA Sources",
    "Platform Score",
    "Platform Evidence Type",
    "Platform Evidence Type Reason",
    "Platform Rule",
    "Platform Rule Label",
    "Platform Applied Criteria",
    "Platform Reason",
    "Platform Why Not Higher",
    "Platform Decision Summary",
    "Platform Key Factors",
    "Platform Evidence Summary",
    "Platform Missing Evidence",
    "Platform Confidence",
    "Platform Sources",
    "Expansion Score",
    "Expansion Evidence Type",
    "Expansion Evidence Type Reason",
    "Expansion Rule",
    "Expansion Rule Label",
    "Expansion Applied Criteria",
    "Expansion Reason",
    "Expansion Why Not Higher",
    "Expansion Decision Summary",
    "Expansion Key Factors",
    "Expansion Evidence Summary",
    "Expansion Missing Evidence",
    "Expansion Confidence",
    "Expansion Sources",
    "Data Score",
    "Data Evidence Type",
    "Data Evidence Type Reason",
    "Data Rule",
    "Data Rule Label",
    "Data Applied Criteria",
    "Data Reason",
    "Data Why Not Higher",
    "Data Decision Summary",
    "Data Key Factors",
    "Data Evidence Summary",
    "Data Missing Evidence",
    "Data Confidence",
    "Data Sources",
    "Market Score",
    "Market Evidence Type",
    "Market Evidence Type Reason",
    "Market Rule",
    "Market Rule Label",
    "Market Applied Criteria",
    "Market Reason",
    "Market Why Not Higher",
    "Market Decision Summary",
    "Market Key Factors",
    "Market Evidence Summary",
    "Market Missing Evidence",
    "Market Confidence",
    "Market Sources",
    "Total Score",
    "Max Score",
    "Similar Pipeline Count",
    "High Similarity Count",
    "One Line Summary",
    "Record ID",
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
    ...scoreExportFields(row, "target"),
    ...scoreExportFields(row, "competitive"),
    ...scoreExportFields(row, "moa"),
    ...scoreExportFields(row, "platform"),
    ...scoreExportFields(row, "expansion"),
    ...scoreExportFields(row, "data"),
    ...scoreExportFields(row, "market"),
    row.totalScore ?? "",
    row.maxScore ?? "",
    row.similarPipelineCount ?? "",
    row.highSimilarityCount ?? "",
    row.summary,
    row.id,
    ...extraColumns.map((column) => formatExtraColumnValue(get(row.raw, column.path, "-")))
  ]);
  const csv = [headers, ...body].map((line) => line.map(csvValue).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replaceAll("-", "");
  const link = document.createElement("a");
  link.href = url;
  link.download = `skbp_pipeline_table_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  elements.dataStatus.textContent = `${rows.length} rows exported`;
}
async function loadRecords() {
  elements.dataStatus.textContent = "Loading";
  await loadCategorySynonyms();
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
    elements.aiDrawer.classList.add("open");
    elements.aiBackdrop.classList.add("open");
    elements.aiDrawer.setAttribute("aria-hidden", "false");
    elements.agentInput.focus();
  });
}
function closeAiDrawer() {
  elements.aiDrawer.classList.remove("open");
  elements.aiBackdrop.classList.remove("open");
  elements.aiDrawer.setAttribute("aria-hidden", "true");
  setTimeout(() => {
    elements.aiDrawer.hidden = true;
    elements.aiBackdrop.hidden = true;
  }, 180);
}
function setupResizableDrawer(drawer, storageKey, defaultWidth = 520) {
  const handle = drawer?.querySelector("[data-resize-drawer]");
  if (!drawer || !handle) return;
  const minWidth = 380;
  const getMaxWidth = () => Math.max(minWidth, Math.min(window.innerWidth - 32, 1080));
  const clampWidth = (value) => Math.max(minWidth, Math.min(value, getMaxWidth()));
  const applyWidth = (value) => {
    const width = clampWidth(value);
    drawer.style.setProperty("--drawer-width", `${width}px`);
    localStorage.setItem(storageKey, String(width));
  };
  const savedWidth = Number(localStorage.getItem(storageKey));
  applyWidth(Number.isFinite(savedWidth) ? savedWidth : defaultWidth);
  const startResize = (event) => {
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    drawer.classList.add("is-resizing");
    const onMove = (moveEvent) => {
      applyWidth(window.innerWidth - moveEvent.clientX);
    };
    const onUp = () => {
      drawer.classList.remove("is-resizing");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  handle.addEventListener("pointerdown", startResize);
  handle.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = Number.parseInt(getComputedStyle(drawer).getPropertyValue("--drawer-width"), 10) || defaultWidth;
    if (event.key === "ArrowLeft") applyWidth(current + 32);
    if (event.key === "ArrowRight") applyWidth(current - 32);
    if (event.key === "Home") applyWidth(minWidth);
    if (event.key === "End") applyWidth(getMaxWidth());
  });
  window.addEventListener("resize", () => {
    const current = Number.parseInt(getComputedStyle(drawer).getPropertyValue("--drawer-width"), 10) || defaultWidth;
    applyWidth(current);
  });
}
function openCriteriaDrawer() {
  elements.criteriaDrawer.hidden = false;
  elements.criteriaBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.criteriaDrawer.classList.add("open");
    elements.criteriaBackdrop.classList.add("open");
    elements.criteriaDrawer.setAttribute("aria-hidden", "false");
  });
}
function closeCriteriaDrawer() {
  elements.criteriaDrawer.classList.remove("open");
  elements.criteriaBackdrop.classList.remove("open");
  elements.criteriaDrawer.setAttribute("aria-hidden", "true");
  setTimeout(() => {
    elements.criteriaDrawer.hidden = true;
    elements.criteriaBackdrop.hidden = true;
  }, 180);
}
function rawMarkdownForRow(row) {
  const markdown = row?.raw?.source_report?.raw_markdown;
  return String(markdown || "").trim();
}
function markdownPreviewSnippet(markdown, fallback = "") {
  const compactSource = String(markdown || fallback || "").split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^```/.test(trimmed)) return false;
    if (/^\|/.test(trimmed)) return false;
    if (/^[-=_]{3,}$/.test(trimmed)) return false;
    const withoutMarkdown = trimmed.replace(/^\s{0,3}#{1,6}\s+/, "").replace(/^[-*]\s+/, "").replace(/[*_`>#]/g, "").trim();
    return Boolean(withoutMarkdown && withoutMarkdown !== "-");
  }).join(" ");
  const text = compactSource.replace(/```[\s\S]*?```/g, " ").replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s*\|.*$/gm, " ").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1").replace(/[*_`>#-]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 520 ? `${text.slice(0, 520)}...` : text;
}
function openTriageReportDrawer(row) {
  if (!elements.triageReportDrawer || !elements.triageReportBackdrop || !elements.triageReportBody) return;
  const markdown = rawMarkdownForRow(row);
  elements.triageReportTitle.textContent = row?.asset || "Markdown report";
  elements.triageReportMeta.textContent = [row?.company, row?.filter1, row?.stage].filter((value) => value && value !== "-").join(" \xB7 ") || "Fast triage markdown";
  elements.triageReportBody.innerHTML = markdown ? renderAgentText(markdown) : '<div class="empty-state">\uC800\uC7A5\uB41C Fast Triage \uC6D0\uBB38 Markdown\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
  elements.triageReportDrawer.hidden = false;
  elements.triageReportBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.triageReportDrawer.classList.add("open");
    elements.triageReportBackdrop.classList.add("open");
    elements.triageReportDrawer.setAttribute("aria-hidden", "false");
  });
}
function closeTriageReportDrawer() {
  if (!elements.triageReportDrawer || !elements.triageReportBackdrop) return;
  elements.triageReportDrawer.classList.remove("open");
  elements.triageReportBackdrop.classList.remove("open");
  elements.triageReportDrawer.setAttribute("aria-hidden", "true");
  setTimeout(() => {
    elements.triageReportDrawer.hidden = true;
    elements.triageReportBackdrop.hidden = true;
  }, 180);
}
function renderAgentInlineMarkdown(text) {
  return escapeHtml(text).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>').replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
}
function renderAgentMarkdownTable(lines, startIndex) {
  const tableLines = [];
  let index = startIndex;
  while (index < lines.length && lines[index].trim().startsWith("|")) {
    tableLines.push(lines[index].trim());
    index += 1;
  }
  const rows = tableLines.filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)).map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  if (!rows.length) return { html: "", nextIndex: index };
  const [head, ...body] = rows;
  const header = `<thead><tr>${head.map((cell) => `<th>${renderAgentInlineMarkdown(cell)}</th>`).join("")}</tr></thead>`;
  const bodyHtml = `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderAgentInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return {
    html: `<div class="agent-md-table-wrap"><table class="agent-md-table">${header}${bodyHtml}</table></div>`,
    nextIndex: index
  };
}
function renderAgentText(text) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(`<pre><span>${escapeHtml(language || "code")}</span><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (line.startsWith("|")) {
      const table = renderAgentMarkdownTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(`<h4>${renderAgentInlineMarkdown(line.slice(4))}</h4>`);
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(`<h3>${renderAgentInlineMarkdown(line.slice(3))}</h3>`);
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(`<h3>${renderAgentInlineMarkdown(line.slice(2))}</h3>`);
      continue;
    }
    if (line.startsWith(">")) {
      blocks.push(`<blockquote>${renderAgentInlineMarkdown(line.replace(/^>\s*/, ""))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderAgentInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, ""))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      index -= 1;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderAgentInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      index -= 1;
      continue;
    }
    blocks.push(`<p>${renderAgentInlineMarkdown(line)}</p>`);
  }
  return blocks.join("");
}
function sourceLabel(path) {
  return String(path || "").split("/").pop().replace(/\.md$/i, "").replaceAll("_", " ");
}
function renderAgentSources(sources = []) {
  if (!Array.isArray(sources) || !sources.length) return "";
  const chips = sources.slice(0, 5).map((source) => {
    const path = escapeHtml(source.path || "");
    const label = escapeHtml(sourceLabel(source.path));
    const score = escapeHtml(source.score ?? "");
    return `<a class="agent-source-chip" href="/wiki-view?path=${encodeURIComponent(source.path || "")}" target="_blank" rel="noreferrer">${label}<span>${score}</span></a>`;
  }).join("");
  return `<div class="agent-sources"><span>Wiki sources</span>${chips}</div>`;
}
function createAgentMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function createAgentSession(title = "\uC0C8 \uB300\uD654") {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: `session_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createAgentMessageId(),
        role: "assistant",
        text: "\uB300\uC2DC\uBCF4\uB4DC JSON\uACFC skbp_pipeline_wiki note\uB97C \uC790\uB3D9\uC73C\uB85C \uAC80\uC0C9\uD574 \uB2F5\uBCC0\uD569\uB2C8\uB2E4. \uD6C4\uBCF4 \uBE44\uAD50, shortlist, evidence gap, \uACBD\uC7C1 \uB9AC\uC2A4\uD06C\uB97C \uC9C8\uBB38\uD574\uBCF4\uC138\uC694.",
        sources: [],
        createdAt: now,
        status: "done"
      }
    ]
  };
}
function loadAgentSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_SESSION_STORAGE_KEY) || "[]");
    state.agentSessions = Array.isArray(parsed) ? parsed.filter((session) => session && session.id) : [];
  } catch {
    state.agentSessions = [];
  }
  if (!state.agentSessions.length) {
    state.agentSessions = [createAgentSession("Pipeline discovery")];
  }
  if (!state.agentSessions.some((session) => session.id === state.activeAgentSessionId)) {
    state.activeAgentSessionId = state.agentSessions[0].id;
  }
  saveAgentSessions();
}
function saveAgentSessions() {
  const trimmed = state.agentSessions.slice(-12).map((session) => ({
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
    session.messages = [...session.messages || [], message];
  }
  session.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveAgentSessions();
  renderAgentSessionControls();
}
function sessionTitleFromQuestion(question) {
  const compact = String(question || "").replace(/\s+/g, " ").trim();
  return compact.length > 34 ? `${compact.slice(0, 34)}...` : compact || "\uC0C8 \uB300\uD654";
}
function renderAgentSessionControls() {
  if (!elements.agentSessionSelect) return;
  elements.agentSessionSelect.innerHTML = state.agentSessions.map((session) => {
    const count = Math.max(0, (session.messages || []).filter((message) => message.role === "user").length);
    return `<option value="${escapeHtml(session.id)}">${escapeHtml(session.title || "\uC0C8 \uB300\uD654")} \xB7 ${count}Q</option>`;
  }).join("");
  elements.agentSessionSelect.value = state.activeAgentSessionId;
  if (elements.agentDeleteSessionButton) {
    elements.agentDeleteSessionButton.disabled = state.agentSessions.length <= 1;
  }
}
function renderAgentMessagesFromSession() {
  const session = activeAgentSession();
  if (!session || !elements.agentMessages) return;
  elements.agentMessages.innerHTML = "";
  (session.messages || []).forEach((message) => {
    addAgentMessage(message.role, message.text, {
      messageId: message.id,
      sources: message.sources || [],
      pending: message.status === "pending",
      persist: false
    });
  });
}
function initializeAgentSessions() {
  loadAgentSessions();
  renderAgentSessionControls();
  renderAgentMessagesFromSession();
}
function startNewAgentSession(title = "\uC0C8 \uB300\uD654") {
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
  const confirmed = window.confirm(`'${current?.title || "\uD604\uC7AC \uB300\uD654"}' \uC138\uC158\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?`);
  if (!confirmed) return;
  state.agentSessions = state.agentSessions.filter((session) => session.id !== state.activeAgentSessionId);
  state.activeAgentSessionId = state.agentSessions[0]?.id || "";
  saveAgentSessions();
  renderAgentSessionControls();
  renderAgentMessagesFromSession();
}
function retitleActiveSessionFromQuestion(question) {
  const session = activeAgentSession();
  if (!session) return;
  const userQuestionCount = (session.messages || []).filter((message) => message.role === "user").length;
  if (userQuestionCount === 0 || /^새 대화|Pipeline discovery$/i.test(session.title || "")) {
    session.title = sessionTitleFromQuestion(question);
    session.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveAgentSessions();
    renderAgentSessionControls();
  }
}
function addAgentMessage(role, text, options = {}) {
  const bubble = document.createElement("div");
  bubble.className = `agent-message ${role}`;
  if (options.pending) bubble.classList.add("pending");
  const messageId = options.messageId || createAgentMessageId();
  bubble.dataset.messageId = messageId;
  bubble.innerHTML = `
    <div class="agent-message-meta">
      <strong>${role === "user" ? "You" : "Pipeline Agent"}</strong>
      ${role === "assistant" ? "<span>JSON + Wiki retrieval</span>" : ""}
    </div>
    <div class="agent-message-text">${renderAgentText(text)}</div>
    ${renderAgentSources(options.sources)}
  `;
  elements.agentMessages.appendChild(bubble);
  elements.agentMessages.scrollTop = elements.agentMessages.scrollHeight;
  if (options.persist !== false) {
    updateAgentSessionMessage({
      id: messageId,
      role,
      text,
      sources: options.sources || [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: options.pending ? "pending" : "done"
    });
  }
  return bubble;
}
function updateAgentMessage(bubble, text, options = {}) {
  const textNode = bubble.querySelector(".agent-message-text");
  if (textNode) textNode.innerHTML = renderAgentText(text);
  if (options.done) bubble.classList.remove("pending");
  if (options.sources) {
    bubble.querySelector(".agent-sources")?.remove();
    bubble.insertAdjacentHTML("beforeend", renderAgentSources(options.sources));
  }
  if (bubble.dataset.messageId) {
    updateAgentSessionMessage({
      id: bubble.dataset.messageId,
      role: bubble.classList.contains("user") ? "user" : "assistant",
      text,
      sources: options.sources || void 0,
      status: options.done ? "done" : bubble.classList.contains("pending") ? "pending" : "done"
    });
  }
  elements.agentMessages.scrollTop = elements.agentMessages.scrollHeight;
}
function buildDashboardAgentContext() {
  const visibleRows = getVisibleRows();
  const topRows = [...visibleRows].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1)).slice(0, 5);
  const summary = topRows.map((row) => [
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
  ].join("; ")).join("\n");
  return [
    "Dashboard visible pipeline context:",
    summary || "- No candidates match the current filters.",
    "",
    "Answer as a SKBP Pipeline Finder dashboard agent. Compare assets using the visible dashboard context and the selected anchor asset JSON context. If source evidence is missing, say what evidence is missing."
  ].join("\n");
}
function getAgentAnchorRecordId(question = "") {
  const visibleRows = getVisibleRows();
  const lowerQuestion = question.toLowerCase();
  if (lowerQuestion.includes("e/i") || lowerQuestion.includes("excitation") || lowerQuestion.includes("inhibition")) {
    const eiRow = visibleRows.filter((row) => String(row.theme).toLowerCase().includes("e/i")).sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))[0];
    if (eiRow) return eiRow.id;
  }
  if (lowerQuestion.includes("neuroimmune")) {
    const neuroimmuneRow = visibleRows.filter((row) => String(row.theme).toLowerCase().includes("neuroimmune")).sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))[0];
    if (neuroimmuneRow) return neuroimmuneRow.id;
  }
  const selectedVisibleRow = visibleRows.find((row) => state.selectedIds.has(row.id));
  if (selectedVisibleRow) return selectedVisibleRow.id;
  const topVisibleRow = [...visibleRows].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))[0];
  return topVisibleRow?.id || state.rows[0]?.id || null;
}
function parseSseEvent(block) {
  const lines = block.split("\n");
  let event = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}
async function streamDashboardAgentReply(question, bubble) {
  const recordId = getAgentAnchorRecordId(question);
  if (!recordId) {
    updateAgentMessage(bubble, "\uBD84\uC11D\uD560 pipeline JSON\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 json \uD3F4\uB354\uC5D0 \uB370\uC774\uD130\uB97C \uCD94\uAC00\uD574 \uC8FC\uC138\uC694.", { done: true });
    return;
  }
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record_id: recordId,
      message: question,
      dashboard_context: buildDashboardAgentContext(),
      allow_draft: false
    })
  });
  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || "stream failed");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let sources = [];
  let completed = false;
  const handleSseBlock = (block) => {
    const parsed = parseSseEvent(block);
    if (!parsed) return;
    if (parsed.event === "sources") {
      sources = parsed.data || [];
      updateAgentMessage(bubble, text || "\uAD00\uB828 wiki note\uB97C \uCC3E\uC558\uC2B5\uB2C8\uB2E4. \uB2F5\uBCC0\uC744 \uC0DD\uC131 \uC911\uC785\uB2C8\uB2E4...", { sources });
    }
    if (parsed.event === "status" && !text) {
      updateAgentMessage(bubble, parsed.data?.message || "\uB2F5\uBCC0 \uC0DD\uC131 \uC911\uC785\uB2C8\uB2E4...", { sources });
    }
    if (parsed.event === "delta") {
      text += parsed.data?.text || "";
      updateAgentMessage(bubble, text, { sources });
    }
    if (parsed.event === "done") {
      completed = true;
      updateAgentMessage(bubble, text || "\uB2F5\uBCC0\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC9C8\uBB38\uD574 \uC8FC\uC138\uC694.", { done: true, sources });
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      handleSseBlock(block);
    }
  }
  if (buffer.trim()) handleSseBlock(buffer);
  if (!completed) updateAgentMessage(bubble, text || "\uB2F5\uBCC0\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC9C8\uBB38\uD574 \uC8FC\uC138\uC694.", { done: true, sources });
}
async function previewPastedReportParsing() {
  const rawText = elements.rawReportInput.value.trim();
  const jsonText = elements.structuredJsonInput.value.trim();
  if (!rawText && !jsonText) {
    elements.saveStatus.textContent = "\uBD99\uC5EC\uB123\uC744 \uC6D0\uBB38 \uB610\uB294 JSON\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
    return;
  }
  const headingCount = (rawText.match(/^#{1,3}\s+/gm) || []).length;
  const tableCount = (rawText.match(/^\|.+\|$/gm) || []).length;
  const hasScore = /(\d+)\s*\/\s*21|Total|Score|점수/i.test(rawText);
  const hasMarketabilitySteps = /A\.\s*TAP|B\.\s*Unrisked|C\.\s*Obtainable/i.test(rawText);
  let jsonStatus = "JSON \uC5C6\uC74C";
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const validCount = records.filter((record) => record && typeof record === "object" && record.structured_table).length;
      jsonStatus = `JSON valid \xB7 ${validCount}/${records.length} records`;
    } catch (error) {
      jsonStatus = `JSON error \xB7 ${error.message}`;
    }
  }
  elements.saveStatus.textContent = `\uC6D0\uBB38 headings ${headingCount}, tables ${tableCount}, score ${hasScore ? "OK" : "missing"}, A/B/C ${hasMarketabilitySteps ? "OK" : "missing"} \xB7 ${jsonStatus}`;
}
async function saveStructuredJsonInput() {
  const rawText = elements.rawReportInput.value.trim();
  const jsonText = elements.structuredJsonInput.value.trim();
  if (!jsonText) {
    elements.saveStatus.textContent = "\uC800\uC7A5\uD560 JSON\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
    return;
  }
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    elements.saveStatus.textContent = `JSON \uD30C\uC2F1 \uC2E4\uD328: ${error.message}`;
    return;
  }
  const records = Array.isArray(payload) ? payload : [payload];
  for (const record of records) {
    if (!record || typeof record !== "object" || !record.structured_table) {
      elements.saveStatus.textContent = "\uC800\uC7A5 \uC2E4\uD328: \uAC01 record\uC5D0\uB294 structured_table\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.";
      return;
    }
    if (rawText) {
      const existingSourceReport = record.source_report && typeof record.source_report === "object" ? record.source_report : {};
      const existingRaw = existingSourceReport.raw_markdown;
      record.source_report = {
        ...existingSourceReport,
        raw_markdown: isPlaceholderRawMarkdown(existingRaw) ? rawText : rawText || existingRaw,
        source_format: existingSourceReport.source_format || "gpt_markdown_report",
        parser_status: existingSourceReport.parser_status || "manual_json_paste",
        parser_note: existingSourceReport.parser_note || "Dashboard input panel\uC5D0\uC11C \uC6D0\uBB38\uACFC JSON\uC744 \uD568\uAED8 \uBD99\uC5EC\uB123\uC5B4 \uC800\uC7A5\uD568."
      };
    }
  }
  elements.saveStatus.textContent = "\uC800\uC7A5 \uC911...";
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Array.isArray(payload) ? records : records[0])
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }
    const result = await response.json();
    elements.saveStatus.textContent = `\uC800\uC7A5 \uC644\uB8CC \xB7 inserted ${result.inserted}, updated ${result.updated}, total ${result.total}`;
    elements.structuredJsonInput.value = JSON.stringify(Array.isArray(payload) ? records : records[0], null, 2);
    await loadRecords();
  } catch (error) {
    elements.saveStatus.textContent = `\uC800\uC7A5 \uC2E4\uD328: ${error.message}`;
  }
}
function buildTriageInstructionPrompt() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Run FAST TRIAGE on biotech/pharma pipeline assets. The purpose is to decide which assets should proceed to the full SKBP Pipeline Finder v3.1 in-depth review.

This is GPT instruction 1: Fast Triage v3.1.
Use GPT instruction 2 only after a candidate receives SELECT and needs full SKBP v3.1 review.

Core rule:
- Do not create a full scout report.
- Do not evaluate all 7 SKBP criteria.
- Do not build a full competitive landscape table.
- Do not calculate marketability.
- Do not estimate peak sales.
- Do not perform full diligence.
- Only perform quick source-aware triage.

Important distinction:
- Triage status is not a final SKBP v3.1 recommendation.
- SELECT means worth sending to Full Scout v3.1.
- REJECT means not worth full review based on current quick evidence.
- N/A means asset identity cannot be verified as a biotech/pharma pipeline asset from public sources.
- A REJECT or N/A can change later if the user provides better target, MoA, data, company, or source evidence.

Input:
The user may provide structured rows copied from Excel/TSV/CSV/plain text or a simple asset list.
Each entry may include asset name, target, MoA, company, therapeutic area, indication, development stage, region/country, notes, and source URL.
The input may contain 1 to 50 entries. If more than 50 entries are provided, process only the first 50 and state this in the markdown block.

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
- If public search results are ambiguous, choose the lower score and explain uncertainty.
- If search results are unrelated SKUs, tools, electronics, finance tickers, or ambiguous non-drug references, classify as N/A.

Early stop rules:
- Apply N/A before scoring if the candidate cannot be verified as a biotech/pharma pipeline asset, or if company/target/indication cannot be credibly linked after a quick identity check. Do not continue deep searching.
- Apply REJECT before scoring if the development stage is Discontinued / inactive, terminated, withdrawn, suspended, dormant, or clearly failed. This means the pipeline is not an active review candidate.
- For N/A or Discontinued / inactive cases, keep the markdown and JSON short. Do not perform full diligence, marketability, competitor landscaping, or extended source chasing.

Triage scoring:
- Use the same scoring direction as Full Scout v3.1, but only for these three matching criteria:
  - Full Scout criterion 1: Target Relevance (TR)
  - Full Scout criterion 3: MoA Validity (MOA)
  - Full Scout criterion 6: Data Maturity (Data)
- Assign preliminary integer scores only: 0, 1, 2, or 3. Do not output ranges such as 1-2.
- Do not assign E0-E4 evidence types, do not write why_not_higher, and do not require full source trails.
- The difference from GPT instruction 2 is depth, not scoring direction: instruction 1 is a fast preliminary read; instruction 2 is the full evidence-based review.
- Quick interpretation:
  - 0 = unclear / not assessable / out of scope
  - 1 = weak or sparse
  - 2 = plausible enough to consider
  - 3 = strong fit or clearly visible maturity

Triage status rule:
- SELECT if asset identity is verified and at least two of TR/MOA/Data are >= 2.
- REJECT if asset identity is verified but SKBP fit, MoA, or Data is too weak for Full Scout priority.
- REJECT if development_stage is Discontinued / inactive, terminated, withdrawn, suspended, dormant, or clearly failed, even if target/MoA look interesting.
- N/A if asset identity is not verified as a biotech/pharma pipeline asset.
- If unsure between SELECT and REJECT, choose REJECT and explain the missing evidence needed.

Controlled vocabulary:
- company_country must use canonical values such as China, Republic of Korea, Japan, United States, Europe/UK, Taiwan, Singapore, Canada, Australia, Israel, Unknown, or N/A.
- development_stage must use one canonical bucket when possible: Hit discovery, Lead Selection, Lead Optimization, IND-enabling, IND, Phase 1, Phase 1/2, Phase 2, Phase 2/3, Phase 3, Registration, Approved / marketed, Discontinued / inactive, Unknown, or N/A.
- main_indication must use one canonical disease bucket when possible: Alzheimer's disease, Parkinson's disease, Epilepsy / seizure disorders, Multiple sclerosis / neuroinflammatory disease, Amyotrophic lateral sclerosis / motor neuron disease, Frontotemporal dementia, Stroke, Pain, Major depressive disorder, Chronic cough, Inflammatory bowel disease, Systemic lupus erythematosus / autoimmune disease, Unknown, or N/A.

Output language:
Korean. English is allowed for scientific terms.

Final output format:
The final answer must contain exactly two fenced code blocks:

\`\`\`markdown
# SKBP Fast Triage Result

\uC911\uC694: \uD55C \uBB38\uC7A5\uC73C\uB85C triage \uACB0\uB860\uACFC filter rationale\uC744 \uBA3C\uC800 \uC501\uB2C8\uB2E4. \uC608: \uACF5\uAC1C \uC790\uB8CC\uC0C1 asset identity\uB294 \uD655\uC778\uB418\uC9C0\uB9CC \uAC1C\uBC1C \uB2E8\uACC4\uAC00 Discontinued / inactive\uB85C \uD655\uC778\uB418\uC5B4 REJECT\uB85C \uCC98\uB9AC\uD569\uB2C8\uB2E4.

| # | Asset | Company | Target/MoA | Main indication | Stage | Country | TR | MOA | Data | Triage | Why | Source |
|---:|---|---|---|---|---|---|---:|---:|---:|---|---|---|
| 1 |  |  |  |  |  |  |  |  |  | SELECT/REJECT/N/A |  |  |

## Notes
- Keep notes short.
- Mention only source uncertainty, duplicate rows, or reason to run Full Scout.
\`\`\`

\`\`\`json
[
  {
    "meta": {
      "schema_version": "3.1",
      "rubric_version": "3.1",
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
      "parser_note": "GPT instruction 1 Fast Triage v3.1 output. Full SKBP v3.1 review has not been run."
    },
    "json_summary": {
      "company": "",
      "asset_name": "",
      "target": "",
      "theme": "E/I Balance | Neuroimmune | No Theme | Unknown",
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
      "modality_platform": "Unknown",
      "main_indication": "",
      "indication": "",
      "development_stage": "",
      "company_country": "",
      "sources": [
        {
          "source_title": "",
          "source_type": "official_company | publication | clinical_trial_registry | regulatory | news | patent | source_url_not_provided | other",
          "source_url": "",
          "reliability": "high | medium | low | unknown",
          "evidence_summary": ""
        }
      ]
    },
    "hard_filter": {
      "status": "SELECT | REJECT | N/A",
      "reason": "",
      "flags": []
    },
    "triage": {
      "instruction_version": "3.1",
      "status": "SELECT | REJECT | N/A",
      "identity_verified": true,
      "why": "",
      "missing_evidence_needed_for_full_scout": []
    },
    "scoring": {
      "total_score": null,
      "max_score": 21,
      "criteria": {
        "target_relevance": {
          "score": 0,
          "evidence_type": "triage_only",
          "main_line_summary": "",
          "evidence_sources": [],
          "uncertain_points": []
        },
        "moa_validity": {
          "score": 0,
          "evidence_type": "triage_only",
          "main_line_summary": "",
          "evidence_sources": [],
          "uncertain_points": []
        },
        "data_maturity": {
          "score": 0,
          "evidence_type": "triage_only",
          "main_line_summary": "",
          "evidence_sources": [],
          "uncertain_points": []
        }
      }
    },
    "validation": {
      "cross_checked_facts": [],
      "uncertain_points": [],
      "source_registry": []
    },
    "final_insight": {
      "one_line_summary": "",
      "recommendation": "Run Full Scout | Do not run Full Scout | N/A",
      "most_important_diligence_question": ""
    }
  }
]
\`\`\`

Remember:
- Output only the two fenced code blocks.
- Do not include prose outside the code blocks.
- For one input entry, output a JSON array with one object.
- Do not include full v3.1 criteria, marketability, competitor tables, or peak sales.`;
}
function buildGptInstructionPrompt() {
  return `You are an expert biotech pipeline scout for SKBP Pipeline Finder.

Mission:
Find and evaluate a pipeline asset by doing the full workflow: company research, source verification, competitor search, SKBP scoring, and evidence tracking. The final answer must include two copyable boxes: first a complete Markdown file code block, then a valid JSON code block that follows the SKBP JSON schema.

Company: [COMPANY_NAME]
Asset / drug / pipeline name: [ASSET_NAME]
Output language: Korean. English is allowed for scientific terms.

Identity Gate / N-A early stop:
- Before writing the full report, first verify whether the input appears to be a real biotech/pharma pipeline asset.
- Use only a short identity check at this gate. Check for at least one credible biotech source type: official company/pipeline page, clinical trial registry, regulatory source, peer-reviewed publication, reputable biotech news, company presentation, patent/source that clearly links the asset to a drug target or indication.
- If the asset cannot be linked to a biotech/pharma company, drug target, modality, indication, or credible pipeline source, stop early. Do not write the full report sections, do not score, do not build competitor tables, and do not estimate marketability.
- If search results are mostly unrelated SKUs, tools, electronics, finance tickers, unrelated abbreviations, or ambiguous non-drug references, classify as N/A unless a credible drug-development source is found.
- In the N/A case, the final answer must still be exactly two fenced code blocks, but both must be short.
- N/A markdown block format:
  - Title: "# N/A Pipeline Scout Result: **[ASSET_NAME]**"
  - One-line conclusion: "Public-source identity check did not verify this as a biotech/pharma pipeline asset."
  - Include only 3 short bullets: what was searched, what was found, what source would be needed to proceed.
  - Include references only for the few sources that explain the non-match or ambiguity.
- N/A JSON block format:
  - Keep it valid JSON.
  - Set meta.schema_version and meta.rubric_version to "3.1".
  - Set source_report.parser_status to "asset_identity_not_verified".
  - Set hard_filter.status to "FAIL".
  - Set hard_filter.reason to "Asset identity not verified from public biotech/pharma sources."
  - Set scoring.total_score to 0 and scoring.max_score to 21.
  - Set final_insight.recommendation to "Deprioritize".
  - Use "N/A" or null for unknown company, target, indication, stage, country, and source URLs. Do not invent placeholders.

Non-negotiable rules:
1. Final answer format must be exactly two fenced code blocks:
   - Box 1: \`\`\`markdown containing either the complete .md report or the short N/A markdown block allowed by the Identity Gate.
   - Box 2: \`\`\`json containing either the complete structured JSON or the short N/A JSON block allowed by the Identity Gate.
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

Controlled vocabulary for dashboard filters:
- Use canonical values for filter-facing fields so the dashboard can group comparable assets.
- json_summary.company_country and structured_table.company_country must use a single canonical country/region label. Examples: China, Republic of Korea, United States, Japan, Europe/UK. Do not write combined labels such as "China / Hong Kong" or "China / United States operations" in these fields; put that nuance in headquarters, company_profile.notes, or validation.uncertain_points.
- structured_table.main_indication is required and must contain one canonical disease bucket. structured_table.indication can contain the full detailed indication wording.
- If the asset has many indications, choose the lead/currently most relevant indication as main_indication and keep the rest in indication.
- structured_table.development_stage must use one canonical stage bucket for dashboard filtering. Put detailed wording such as recruiting status, indication-specific stages, or expected IND timing in source evidence, notes, or validation.uncertain_points.
- Standard development stage buckets include: Hit discovery, Lead Selection, Lead Optimization, IND-enabling, IND, Phase 1, Phase 1/2, Phase 2, Phase 2/3, Phase 3, Registration, Approved / marketed, Discontinued / inactive.
- Map stage synonyms into the same bucket. Examples: P1, Ph1, Phase I, FIH, first-in-human, Phase 1 SAD/MAD, and 1\uC0C1 -> Phase 1; P2, Ph2, Phase II, Phase 2 recruiting, and 2\uC0C1 -> Phase 2; preclinical / IND preparation -> IND-enabling when IND-enabling work is explicitly described.
- Standard indication buckets include:
  - Alzheimer's disease
  - Parkinson's disease
  - Epilepsy / seizure disorders
  - Amyotrophic lateral sclerosis / motor neuron disease
  - Frontotemporal dementia
  - Huntington's disease
  - Chronic cough
  - Multiple sclerosis / neuroinflammatory disease
  - Inflammatory bowel disease
  - Major depressive disorder
  - Schizophrenia / psychosis
  - Bipolar disorder
  - Anxiety disorders
  - Autism spectrum disorder
  - ADHD
  - Migraine / headache disorders
  - Pain
  - Stroke
- Map synonymous or narrower terms into the same bucket. Examples: partial-onset seizure, focal-onset seizure, epilepsy, and status epilepticus -> Epilepsy / seizure disorders; RCC, UCC, refractory chronic cough, and unexplained chronic cough -> Chronic cough; Crohn's disease and ulcerative colitis -> Inflammatory bowel disease.

Expected final answer shape:

\`\`\`markdown
# [Company] Pipeline Scout Report: **[Asset]**
...complete report...
\`\`\`

\`\`\`json
{
  "meta": {
    "schema_version": "3.1"
  }
}
\`\`\`

If the Identity Gate returns N/A:
- Return short N/A markdown + valid compact N/A JSON only.
- In JSON, set source_report.parser_status = "asset_identity_not_verified", hard_filter.status = "FAIL", scoring.total_score = 0, scoring.max_score = 21, final_insight.recommendation = "Deprioritize".
- Use "N/A", null, or [] for unknown company, target, indication, stage, country, sources, and unavailable fields.
- Keep only the sources needed to explain the non-match or ambiguity.

Use this exact report structure inside the markdown code block:

# [Company] Pipeline Scout Report: **[Asset]**

Briefly state that this report is prepared for SKBP Pipeline Finder v3.1 and that URLs are included for auditability.

\uC911\uC694: \uD55C \uBB38\uC7A5\uC73C\uB85C filter/recommendation rationale\uC744 \uBA3C\uC800 \uC501\uB2C8\uB2E4. \uC608: \uACF5\uAC1C \uC790\uB8CC\uC0C1 active asset\uBA85\xB7compound code\xB7\uC784\uC0C1 \uB2E8\uACC4\uAC00 \uBA85\uD655\uD788 \uD655\uC778\uB418\uC9C0 \uC54A\uC544 stage/ownership\uC740 uncertain / REVIEW\uB85C \uCC98\uB9AC\uD569\uB2C8\uB2E4.

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
- E/I Balance: Ion Channel, Inhibitory Tone \uAC15\uD654, Synaptic Transmission, Chloride Homeostasis, Network Modulation
- Neuroimmune: CNS \uC190\uC0C1 \uBA74\uC5ED\uBC18\uC751, \uAD50\uC138\uD3EC \uD5A5\uC0C1\uC131, Cytokine \uC2E0\uACBD\uC870\uC808, \uC190\uC0C1/\uC9C8\uD658 \uBA74\uC5ED\uC870\uC808, \uB9D0\uCD08 \uBA74\uC5ED\uAE30\uAD00 \uC5F0\uACB0

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
- 2\uC810 \uC774\uC0C1\uC774\uBA74 publication or equivalent technical evidence must be visible.

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
- 2\uC810 \uC774\uC0C1\uC774\uBA74 the data supporting differentiation must be explicit.

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
    "schema_version": "3.1",
    "generated_at": "YYYY-MM-DD",
    "language": "ko",
    "analyst_role": "[OIT] PreC Pipeline Shortlister",
    "output_format": ["markdown_report", "json"],
    "output_filename_base": "Company_Asset_YYYYMMDD",
    "rubric_version": "3.1",
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
    "main_indication": "",
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
async function copyPromptToClipboard(kind = "full") {
  const prompt = kind === "triage" ? buildTriageInstructionPrompt() : buildGptInstructionPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
    setPromptCopyFeedback(kind);
  } catch (error) {
    const scratch = document.createElement("textarea");
    scratch.value = prompt;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    document.execCommand("copy");
    scratch.remove();
    setPromptCopyFeedback(kind);
  }
}
function setPromptCopyFeedback(kind = "full") {
  if (elements.promptCopyStatus) {
    elements.promptCopyStatus.textContent = kind === "triage" ? "Triage \uC9C0\uCE68 \uBCF5\uC0AC \uC644\uB8CC" : "Full Scout \uC9C0\uCE68 \uBCF5\uC0AC \uC644\uB8CC";
  }
  const button = kind === "triage" ? elements.copyTriagePromptTopButton : elements.copyPromptTopButton;
  if (!button) return;
  const label = button.querySelector("b");
  const idleLabel = kind === "triage" ? "\uC9C0\uCE68 1" : "\uC9C0\uCE68 2";
  const idleTooltip = kind === "triage" ? TRIAGE_PROMPT_TOOLTIP : "GPT full scout v3.1 \uC9C0\uCE68\uC744 \uBCF5\uC0AC\uD569\uB2C8\uB2E4. triage\uC5D0\uC11C SELECT\uB41C asset\uC744 \uC2EC\uCE35 \uAC80\uD1A0\uD560 \uB54C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.";
  if (label) {
    label.textContent = "\uBCF5\uC0AC\uB428";
  }
  button.dataset.tooltip = kind === "triage" ? "GPT fast triage \uC9C0\uCE68\uC744 \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4." : "GPT full scout v3.1 \uC9C0\uCE68\uC744 \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4.";
  window.clearTimeout(promptCopyFeedbackTimer);
  promptCopyFeedbackTimer = window.setTimeout(() => {
    if (label) {
      label.textContent = idleLabel;
    }
    button.dataset.tooltip = idleTooltip;
  }, 1800);
}
function sortByColumn(key) {
  if (state.sortKey === key) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDirection = [
      "targetScore",
      "moaScore",
      "dataScore",
      "competitiveScore",
      "platformScore",
      "expansionScore",
      "marketScore",
      "totalScore"
    ].includes(key) ? "desc" : "asc";
  }
  renderTable();
}
function setTableMode(mode) {
  const nextMode = mode === "triage" ? "triage" : "full";
  if (state.tableMode === nextMode) return;
  state.tableMode = nextMode;
  state.pass = "all";
  state.page = 1;
  if (nextMode === "triage" && ["filter2", "competitiveScore", "platformScore", "expansionScore", "marketScore", "totalScore"].includes(state.sortKey)) {
    state.sortKey = "targetScore";
    state.sortDirection = "desc";
  }
  if (nextMode === "full" && state.sortKey === "filter1") {
    state.sortKey = "totalScore";
    state.sortDirection = "desc";
  }
  renderFilters();
  renderTableTabs();
  renderTable();
}
function beginColumnResize(event) {
  const handle = event.target.closest("[data-resize-column]");
  if (!handle) return;
  event.preventDefault();
  event.stopPropagation();
  const key = handle.dataset.resizeColumn;
  activeColumnResize = {
    key,
    startX: event.clientX,
    startWidth: columnWidth(key)
  };
  document.body.classList.add("is-resizing-column");
  handle.setPointerCapture?.(event.pointerId);
}
function updateColumnResize(event) {
  if (!activeColumnResize) return;
  const nextWidth = Math.max(
    minColumnWidth(activeColumnResize.key),
    Math.min(MAX_COLUMN_WIDTH, activeColumnResize.startWidth + event.clientX - activeColumnResize.startX)
  );
  state.columnWidths[activeColumnResize.key] = Math.round(nextWidth);
  applyColumnWidths();
}
function endColumnResize() {
  if (!activeColumnResize) return;
  persistColumnWidths();
  activeColumnResize = null;
  document.body.classList.remove("is-resizing-column");
}
function resetColumnWidth(event) {
  const handle = event.target.closest("[data-resize-column]");
  if (!handle) return;
  event.preventDefault();
  event.stopPropagation();
  delete state.columnWidths[handle.dataset.resizeColumn];
  persistColumnWidths();
  renderTable();
}
elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.page = 1;
  renderTable();
});
elements.stageFilter.addEventListener("change", (event) => {
  state.stage = event.target.value;
  state.page = 1;
  renderTable();
});
elements.themeFilter.addEventListener("change", (event) => {
  state.theme = event.target.value;
  state.page = 1;
  renderTable();
});
elements.clusterFilter.addEventListener("change", (event) => {
  state.cluster = event.target.value;
  state.page = 1;
  renderTable();
});
elements.countryFilter.addEventListener("change", (event) => {
  state.country = event.target.value;
  state.page = 1;
  renderTable();
});
elements.indicationFilter.addEventListener("change", (event) => {
  state.indication = event.target.value;
  state.page = 1;
  renderTable();
});
elements.passFilter.addEventListener("change", (event) => {
  state.pass = event.target.value;
  state.page = 1;
  renderTable();
});
elements.pageSizeSelect?.addEventListener("change", (event) => {
  const nextSize = Number(event.target.value);
  state.pageSize = [10, 30, 50, 100].includes(nextSize) ? nextSize : DEFAULT_PAGE_SIZE;
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(state.pageSize));
  state.page = 1;
  renderTable();
});
elements.prevPage.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  renderTable();
});
elements.nextPage.addEventListener("click", () => {
  state.page += 1;
  renderTable();
});
elements.pipelineTable.addEventListener("click", (event) => {
  if (event.target.closest("input, button, a, label")) return;
  const rowElement = event.target.closest("[data-record-id]");
  if (!rowElement) return;
  const recordId = rowElement.dataset.recordId;
  if (activeTableMode() === "triage") {
    const row = state.rows.find((item) => item.id === recordId);
    openTriageReportDrawer(row);
    return;
  }
  window.location.href = `/detail?id=${encodeURIComponent(recordId)}`;
});
elements.pipelineTable.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".row-select");
  if (!checkbox) return;
  const id = checkbox.dataset.recordId;
  if (!id) return;
  if (checkbox.checked) {
    state.selectedIds.add(id);
  } else {
    state.selectedIds.delete(id);
  }
  checkbox.closest("tr")?.classList.toggle("selected-row", checkbox.checked);
  updateSelectionControls();
});
elements.selectPageRows?.addEventListener("change", (event) => {
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
elements.pipelineTableHead?.addEventListener("click", (event) => {
  if (event.target.closest("[data-resize-column]")) return;
  const button = event.target.closest("button[data-sort]");
  if (!button) return;
  sortByColumn(button.dataset.sort);
});
elements.pipelineTableHead?.addEventListener("pointerdown", beginColumnResize);
elements.pipelineTableHead?.addEventListener("dblclick", resetColumnWidth);
document.addEventListener("pointermove", updateColumnResize);
document.addEventListener("pointerup", endColumnResize);
elements.pipelineTableHead?.addEventListener("change", (event) => {
  if (event.target.id !== "selectPageRows") return;
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
elements.refreshButton.addEventListener("click", () => {
  loadRecords().catch((error) => {
    elements.dataStatus.textContent = "Load failed";
    elements.saveStatus.textContent = error.message;
  });
});
elements.exportExcelButton.addEventListener("click", exportPipelineTable);
elements.deleteSelectedButton.addEventListener("click", deleteSelectedRecords);
elements.priorityList?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-record-id]");
  if (!item) return;
  window.location.href = `/detail?id=${encodeURIComponent(item.dataset.recordId)}`;
});
elements.columnSettingsButton?.addEventListener("click", () => {
  elements.columnSettingsPanel.hidden = !elements.columnSettingsPanel.hidden;
});
elements.columnSettingsGrid?.addEventListener("change", (event) => {
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
elements.pipelineTableTabs?.forEach((tab) => {
  tab.addEventListener("click", () => setTableMode(tab.dataset.tableMode));
});
elements.agentSessionSelect?.addEventListener("change", (event) => {
  state.activeAgentSessionId = event.target.value;
  saveAgentSessions();
  renderAgentMessagesFromSession();
});
elements.agentNewSessionButton?.addEventListener("click", () => {
  startNewAgentSession();
});
elements.agentDeleteSessionButton?.addEventListener("click", deleteActiveAgentSession);
elements.aiDrawerButton.addEventListener("click", openAiDrawer);
elements.aiDrawerClose.addEventListener("click", closeAiDrawer);
elements.aiBackdrop.addEventListener("click", closeAiDrawer);
elements.criteriaDrawerButton.addEventListener("click", openCriteriaDrawer);
elements.criteriaDrawerClose.addEventListener("click", closeCriteriaDrawer);
elements.criteriaBackdrop.addEventListener("click", closeCriteriaDrawer);
elements.triageReportClose?.addEventListener("click", closeTriageReportDrawer);
elements.triageReportBackdrop?.addEventListener("click", closeTriageReportDrawer);
document.querySelectorAll("[data-agent-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.agentInput.value = button.dataset.agentPrompt;
    elements.agentInput.focus();
  });
});
elements.agentInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  elements.agentForm.requestSubmit();
});
elements.agentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = elements.agentInput.value.trim();
  if (!question) return;
  elements.agentInput.value = "";
  retitleActiveSessionFromQuestion(question);
  addAgentMessage("user", question);
  const submitButton = elements.agentForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "\uB2F5\uBCC0 \uC911";
  }
  const responseBubble = addAgentMessage("assistant", "\uC9C8\uBB38 \uBD84\uC11D \uC911...", { pending: true });
  try {
    await streamDashboardAgentReply(question, responseBubble);
  } catch (error) {
    updateAgentMessage(responseBubble, `AI \uC751\uB2F5 \uC624\uB958: ${error.message}`, { done: true });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "\uC9C8\uBB38";
    }
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.aiDrawer.classList.contains("open")) {
    closeAiDrawer();
  }
  if (event.key === "Escape" && elements.criteriaDrawer.classList.contains("open")) {
    closeCriteriaDrawer();
  }
  if (event.key === "Escape" && elements.triageReportDrawer?.classList.contains("open")) {
    closeTriageReportDrawer();
  }
});
elements.previewInputButton.addEventListener("click", previewPastedReportParsing);
elements.saveJsonButton.addEventListener("click", saveStructuredJsonInput);
elements.clearJsonButton.addEventListener("click", () => {
  elements.rawReportInput.value = "";
  elements.structuredJsonInput.value = "";
  elements.saveStatus.textContent = "\uC6D0\uBB38 + JSON \uC785\uB825 \uB300\uAE30";
});
if (elements.copyTriagePromptTopButton) {
  elements.copyTriagePromptTopButton.dataset.tooltip = TRIAGE_PROMPT_TOOLTIP;
}
if (elements.copyPromptTopButton) {
  const label = elements.copyPromptTopButton.querySelector("b");
  if (label) label.textContent = "\uC9C0\uCE68 2";
  elements.copyPromptTopButton.dataset.tooltip = "GPT full scout v3.1 \uC9C0\uCE68\uC744 \uBCF5\uC0AC\uD569\uB2C8\uB2E4. triage\uC5D0\uC11C SELECT\uB41C asset\uC744 \uC2EC\uCE35 \uAC80\uD1A0\uD560 \uB54C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.";
}
elements.copyPromptButton?.addEventListener("click", () => copyPromptToClipboard("full"));
elements.copyTriagePromptTopButton?.addEventListener("click", () => copyPromptToClipboard("triage"));
elements.copyPromptTopButton?.addEventListener("click", () => copyPromptToClipboard("full"));
setupResizableDrawer(elements.aiDrawer, "skbp.dashboard.aiDrawerWidth", 560);
setupResizableDrawer(elements.triageReportDrawer, "skbp.dashboard.triageReportDrawerWidth", 620);
setupThemeToggle();
initializeAgentSessions();
loadRecords().catch((error) => {
  elements.dataStatus.textContent = "Load failed";
  elements.saveStatus.textContent = error.message;
});
