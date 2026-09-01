// English-only presentation of the Dashboard judgment guide. The Korean markup
// remains the canonical on-page source and is restored by the KR toggle.

const scoreHeader = `
  <thead>
    <tr><th>Criterion</th><th>0</th><th>1</th><th>2</th><th>3</th></tr>
  </thead>`;

export function englishCriteriaGuideMarkup() {
  return `
    <section class="criteria-rule criteria-triage-rule" data-criteria-tab="triage">
      <h3>GPT Instruction 1 — Fast Triage · v3.5</h3>
      <p>Fast Triage rapidly identifies candidates that merit Full Scout review. It independently assesses Target Area Relevance, MoA Validity, and Data Maturity, then assigns SELECT, REJECT, or INSUFFICIENT.</p>
    </section>

    <section class="criteria-pass-grid triage-status-grid criteria-guide-section" aria-label="SELECT REJECT INSUFFICIENT triage criteria" data-criteria-tab="triage">
      <div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">1</span><span class="criteria-guide-section-copy"><h3>Final Status</h3><p>Decision rules for SELECT, REJECT, and INSUFFICIENT</p></span></div>
      <article class="criteria-status-card" data-triage-status="select"><div class="criteria-status-heading"><h3>SELECT</h3></div><p class="criteria-status-subtitle">Eligible for in-depth Full Scout review; this is not a final BD recommendation.</p><ul><li>TAR ≥ 3</li><li>MoA ≥ 1 and Data ≥ 2</li></ul></article>
      <article class="criteria-status-card" data-triage-status="reject"><div class="criteria-status-heading"><h3>REJECT</h3></div><p class="criteria-status-subtitle">Current public evidence does not justify Full Scout, but the candidate may be reassessed when new evidence is available.</p><ul><li>Asset identity is verified, but SELECT criteria are not met</li><li>TAR, MoA, and Data are all at least 1</li></ul></article>
      <article class="criteria-status-card" data-triage-status="insufficient"><div class="criteria-status-heading"><h3>INSUFFICIENT</h3></div><p class="criteria-status-subtitle">A valid assessment cannot be completed because of an early-stop reason or missing minimum evidence.</p><ul><li>Asset identity cannot be verified, or permanent discontinuation is confirmed</li><li>After identity verification, any of TAR, MoA, or Data is 0</li></ul></article>
    </section>

    <section class="criteria-scoring-section criteria-guide-section" data-criteria-tab="triage">
      <div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">2</span><span class="criteria-guide-section-copy"><h3>Scoring Table</h3><p>0–3 score definitions for TAR, MoA, and Data</p></span></div>
      <div class="criteria-table-wrap"><table class="criteria-table">${scoreHeader}<tbody>
        <tr><th>TAR — Target Area Relevance</th><td>Identity is verified, but indication/relevance remains insufficiently known</td><td>Verified asset is outside the neurologic, psychiatric, neuroimmune, neurodegenerative, or pain scope</td><td>Within the neurologic, psychiatric, neuroimmune, neurodegenerative, or pain scope, but outside the six priority indications</td><td>One of the <strong>six SKBP priority indications</strong></td></tr>
        <tr><th>MoA — MoA Validity</th><td>Target or MoA cannot be confirmed</td><td>Company claim or theoretical rationale only</td><td><strong>Target/pathway functional evidence or independent same-target/class validation</strong></td><td><strong>Direct asset-specific evidence relevant to the proposed MoA</strong><br />(target engagement, mechanism-linked PD/biomarker, or direct functional effect)</td></tr>
        <tr><th>Data — Data Maturity</th><td>No public asset-specific result</td><td>Qualitative claim or fragmentary result only; insufficient for stage</td><td><strong>At least one interpretable, quantitative, stage-appropriate evidence domain</strong></td><td><strong>At least two complementary, stage-appropriate quantitative domains</strong>, including one that directly supports program progression</td></tr>
      </tbody></table></div>
      <ul class="criteria-table-footnote"><li>INSUFFICIENT applies to identity/discontinuation early stops, or to a completed assessment with TAR, MoA, or Data at 0.</li><li>A zero score after identity verification is an actual evaluated score, not a dash.</li></ul>
    </section>

    <section class="criteria-parameter-guide triage-parameter-guide criteria-guide-section" data-criteria-tab="triage">
      <div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">3</span><span class="criteria-guide-section-copy"><h3>Parameter Guide</h3><p>What each Fast Triage criterion evaluates</p></span></div>
      <div class="criteria-detail-grid compact-criteria-detail-grid triage-parameter-grid">
        <article class="parameter-card-wide target-parameter-card parameter-breakdown-card"><div class="criteria-parameter-heading criteria-parameter-title-row"><h3><b>TAR</b><span>Target Area Relevance</span></h3></div><p>Assesses whether the verified asset indication fits SKBP strategic scope. Theme/Cluster and disease-biology linkage are classification and MoA inputs, not TAR score bases.</p><ul class="parameter-evidence-list"><li><strong>Priority indications</strong><span>Alzheimer's disease; Parkinson's disease; ALS/MND; multiple sclerosis/neuroinflammatory disease; neuropathic pain; epilepsy/seizure disorders</span></li><li><strong>Broad SKBP scope</strong><span>Neurological, psychiatric, neuroimmune, neurodegenerative, and pain conditions</span></li></ul></article>
        <article><div class="criteria-parameter-heading criteria-parameter-title-row"><h3><b>MoA</b><span>MoA Validity</span></h3></div><p>Assesses how specifically the target and proposed mechanism are defined and validated by functional, independent, or asset-specific evidence.</p></article>
        <article><div class="criteria-parameter-heading criteria-parameter-title-row"><h3><b>Data</b><span>Data Maturity</span></h3></div><p>Assesses whether public quantitative data for the assessed asset are sufficient, complementary, and interpretable for its development stage.</p></article>
      </div>
    </section>

    <section class="criteria-rule triage-evidence-note criteria-guide-section" data-criteria-tab="triage">
      <div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">4</span><span class="criteria-guide-section-copy"><h3>Evidence Level</h3><p>Evidence and source rules used for scoring</p></span></div>
      <p class="criteria-evidence-intro">Use only confirmed user-provided facts or credible public sources. Record unconfirmed fields as <code>Unknown</code>; source count alone never determines a score.</p>
      <dl class="criteria-evidence-definitions">
        <div><dt><span class="criteria-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 12a4 4 0 1 0 0-8ZM5 21a7 7 0 0 1 14 0" /><path d="m17 13 1.5 1.5L21 12" /></svg></span><span>User-provided information</span></dt><dd><ul><li>Facts supplied by the user</li><li>Eligible for TAR assessment</li></ul></dd></div>
        <div><dt><span class="criteria-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4M4 11h14M11 4a11 11 0 0 1 0 14M11 4a11 11 0 0 0 0 14" /></svg></span><span>Public sources</span></dt><dd><ul><li>Facts directly verified from credible public materials</li><li>Record the source and key fact used for the decision</li></ul></dd></div>
        <div><dt><span class="criteria-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg></span><span>Scoring rule</span></dt><dd><ul><li>TAR may use user-provided information and public sources</li><li>MoA and Data scores of 2 or higher require public, asset-specific evidence</li></ul></dd></div>
      </dl>
    </section>

    <section class="criteria-rule criteria-full-rule" data-criteria-tab="full">
      <h3>GPT Instruction 2 — Full Scout · v3.7</h3>
      <p>Full Scout conducts an in-depth assessment of SELECT candidates across all seven criteria: Target Area Relevance, MoA Validity, Data Maturity, Competitive Landscape, Platform Attractiveness, Expansion Potential, and Marketability.</p>
    </section>

    <section class="criteria-rule criteria-other-card" data-criteria-tab="full"><h3>Evidence Type</h3><div class="criteria-table-wrap"><table class="criteria-table evidence-type-table"><thead><tr><th>Type</th><th>Meaning</th></tr></thead><tbody><tr><td>E0</td><td>Not found / not assessable</td></tr><tr><td>E1</td><td>Company claim or scientific rationale only</td></tr><tr><td>E2</td><td>Indirect or class-level evidence</td></tr><tr><td>E3</td><td>Asset-specific preclinical or technical evidence</td></tr><tr><td>E4</td><td>Asset-specific clinical evidence</td></tr></tbody></table></div></section>

    <section class="criteria-pass-grid full-status-grid criteria-guide-section" aria-label="PASS REVIEW FAIL criteria" data-criteria-tab="full">
      <div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">1</span><span class="criteria-guide-section-copy"><h3>Final Status</h3><p>Decision rules for PASS, REVIEW, and FAIL</p></span></div>
      <article class="criteria-status-card" data-full-status="pass"><div class="criteria-status-heading"><h3>PASS</h3></div><div class="criteria-full-status-summary-slot"><p class="criteria-full-status-summary">Candidate meeting all Full Scout total-score and required-score gates for follow-up BD review.</p></div><ul><li>Total Score ≥ 14</li><li>Target Area Relevance ≥ 3</li><li>MoA Validity = 3 and Data Maturity = 3</li></ul></article>
      <article class="criteria-status-card" data-full-status="review"><div class="criteria-status-heading"><h3>REVIEW</h3></div><div class="criteria-full-status-summary-slot"><p class="criteria-full-status-summary">A completed assessment that is neither PASS nor FAIL; reassess after new public evidence or internal monitoring.</p></div><ul><li>Does not meet PASS or FAIL</li><li>For example, Total Score 9–13 or a PASS required-score gate is not met</li></ul></article>
      <article class="criteria-status-card" data-full-status="fail"><div class="criteria-status-heading"><h3>FAIL</h3></div><div class="criteria-full-status-summary-slot"><p class="criteria-full-status-summary">Core information is insufficient, or the development state or scores fall below Full Scout passing requirements.</p></div><ul><li>Total Score ≤ 8</li><li>Or any of TAR, MoA, or Data = 0</li></ul></article>
    </section>

    <section class="criteria-scoring-section criteria-guide-section" data-criteria-tab="full">
      <div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">2</span><span class="criteria-guide-section-copy"><h3>Scoring Table</h3><p>0–3 score definitions for all seven criteria</p></span></div>
      <div class="criteria-table-wrap"><table class="criteria-table">${scoreHeader}<tbody>
        <tr><th>Target Area Relevance</th><td>Identity is verified, but indication/relevance remains insufficiently known</td><td>Verified asset is outside the neurologic, psychiatric, neuroimmune, neurodegenerative, or pain scope</td><td>Within the neurologic, psychiatric, neuroimmune, neurodegenerative, or pain scope but outside six priorities</td><td>One of <strong>six SKBP priority indications</strong></td></tr>
        <tr><th>MoA Validity</th><td>Target or MoA cannot be confirmed</td><td>Company claim or theoretical rationale only</td><td><strong>Target/pathway functional evidence or independent same-target/class validation</strong></td><td><strong>Direct asset-specific evidence relevant to the proposed MoA</strong><br />(target engagement, mechanism-linked PD/biomarker, or direct functional effect)</td></tr>
        <tr><th>Data Maturity</th><td>No public asset-specific result</td><td>Qualitative claim or fragmentary result only</td><td><strong>At least one interpretable, quantitative, stage-appropriate evidence domain</strong></td><td><strong>At least two complementary, stage-appropriate quantitative domains</strong>, including one that directly supports program progression</td></tr>
        <tr><th>Competitive Landscape</th><td>Search evidence is insufficient to assess direct competitors</td><td>Competitors found, but differentiation is claim/concept only</td><td>Asset-specific quantitative differentiation, or entry space supported by a clear unresolved treatment need and asset-specific evidence</td><td>Limited high-similarity competitors plus direct head-to-head quantitative evidence of a material advantage/leading position</td></tr>
        <tr><th>Platform Attractiveness</th><td>No reusable platform or verifiable technical advantage</td><td>Reusable concept with rationale only</td><td>At least one quantitative technical advantage versus an appropriate comparator</td><td>Score-2 evidence plus reproducibility across conditions/assets and independent/external validation or use, or an officially linked platform-derived asset has reached First Patient Dosed</td></tr>
        <tr><th>Expansion Potential</th><td>No additional indication confirmed</td><td>Additional-indication rationale only</td><td>Asset-specific early quantitative data in at least one additional indication</td><td>Multiple additional indications, at least one official preclinical/IND-enabling/clinical program, and asset-specific quantitative data in at least one additional indication</td></tr>
        <tr><th>Marketability</th><td>No credible commercial hypothesis or peak-sales estimate</td><td>Assessed global peak sales &lt; USD 1B</td><td>Assessed global peak sales ≥ USD 1B and &lt; USD 2B</td><td>Assessed global peak sales ≥ USD 2B</td></tr>
      </tbody></table></div>
    </section>

    <section class="criteria-parameter-guide full-parameter-guide criteria-guide-section" data-criteria-tab="full">
      <div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">3</span><span class="criteria-guide-section-copy"><h3>Parameter Guide</h3><p>What each Full Scout criterion evaluates</p></span></div>
      <div class="criteria-detail-grid compact-criteria-detail-grid full-parameter-grid">
        <article class="target-parameter-card full-parameter-card"><div class="criteria-parameter-heading criteria-parameter-title-row"><h3><b>TAR</b><span>Target Area Relevance</span></h3></div><p>Assesses whether the verified asset indication fits SKBP strategic scope. Theme/Cluster and disease-biology linkage are classification and MoA inputs, not TAR score bases.</p><ul class="parameter-evidence-list"><li><strong>Priority indications</strong><span>Alzheimer's disease; Parkinson's disease; ALS/MND; multiple sclerosis/neuroinflammatory disease; neuropathic pain; epilepsy/seizure disorders</span></li><li><strong>Broad SKBP scope</strong><span>Neurological, psychiatric, neuroimmune, neurodegenerative, and pain conditions</span></li></ul></article>
        <article class="full-parameter-card"><h3>MoA Validity</h3><p>Specificity and validation of the proposed mechanism. Generic clinical efficacy alone is not MoA 3.</p></article>
        <article class="full-parameter-card"><h3>Data Maturity</h3><p>Sufficiency and interpretability of public, stage-appropriate, asset-specific evidence domains.</p></article>
        <article class="full-parameter-card"><h3>Competitive Landscape</h3><p>Direct competitive position and verified differentiation. High similarity requires aligned indication, target/pathway intervention, and therapeutic effector mechanism; Score 3 also requires direct head-to-head quantitative evidence.</p></article>
        <article class="full-parameter-card"><h3>Platform Attractiveness</h3><p>Reusable technical advantage in modality, delivery, chemistry, manufacturing, or another underlying platform property.</p></article>
        <article class="full-parameter-card"><h3>Expansion Potential</h3><p>Confirmed expansion of the assessed asset beyond its main indication, not merely class-level biological plausibility.</p></article>
        <article class="marketability-parameter-card full-parameter-card"><h3>Marketability</h3><p>Credible product hypothesis and obtainable peak sales. Global obtainable sales equal US obtainable sales × 1.5, applied once only.</p></article>
      </div>
    </section>

    <section class="criteria-rule criteria-other-card" data-criteria-tab="full"><h3>Evidence and Record Discipline</h3><ul class="criteria-subbullet-list"><li><strong>Confirmed facts only</strong><span>Do not infer asset-specific status, stage, target, MoA, or data from plans, financing, or scientific generalities.</span></li><li><strong>Criterion record</strong><span>For each score, retain the decision, evidence, source trail, investigation note, why-not-higher, and uncertainty.</span></li><li><strong>Compact JSON</strong><span>Store only dashboard fields and source IDs; retain detailed diligence in the Markdown report.</span></li></ul></section>

    <section class="criteria-rule criteria-focus-rule" data-criteria-tab="focus"><h3>Filter 3 — OI Partnership Classification · v1.4</h3><p>Classifies shortlisted Full Scout candidates as Investment, Value Up, Joint Research, Unknown, or N/A from verified structured values and confirmed source materials.</p></section>
    <section class="criteria-focus-section criteria-guide-section" data-criteria-tab="focus"><div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">1</span><span class="criteria-guide-section-copy"><h3>Eligibility and Input Basis</h3><p>Verified information used for automated classification</p></span></div><div class="criteria-focus-grid criteria-focus-input-grid"><article class="criteria-focus-info-card"><h4>Eligible candidates</h4><p>Only pipelines placed on the Full Scout shortlisting are classified.</p></article><article class="criteria-focus-info-card"><h4>SKBP priority indications</h4><p>Alzheimer's disease, Parkinson's disease, ALS, multiple sclerosis, neuropathic pain, and epilepsy.</p></article><article class="criteria-focus-info-card"><h4>Confirmed inputs only</h4><p>Do not infer missing structured values or source facts.</p></article></div></section>
    <section class="criteria-focus-section criteria-guide-section" data-criteria-tab="focus"><div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">2</span><span class="criteria-guide-section-copy"><h3>Partnership Type</h3><p>Classification gates</p></span></div><div class="criteria-focus-grid criteria-focus-decision-grid"><article class="criteria-focus-decision-card" data-focus-decision="investment"><h4>Investment</h4><p>Non-small-molecule asset at IND-enabling stage or later.</p></article><article class="criteria-focus-decision-card" data-focus-decision="value-up"><h4>Value Up</h4><p>Small-molecule asset before IND-enabling with in-vivo and in-vitro evidence and completed, scored ADMET data.</p></article><article class="criteria-focus-decision-card" data-focus-decision="joint-research"><h4>Joint Research</h4><p>Any modality with Platform Attractiveness = 3.</p></article></div></section>
    <section class="criteria-focus-section criteria-guide-section" data-criteria-tab="focus"><div class="criteria-guide-section-heading"><span class="criteria-guide-step-number" aria-hidden="true">3</span><span class="criteria-guide-section-copy"><h3>Priority and Exceptions</h3><p>How overlaps and missing information are handled</p></span></div><div class="criteria-focus-grid criteria-focus-exception-grid"><article class="criteria-focus-info-card"><h4>Priority</h4><p>Joint Research takes precedence over Investment and Value Up when their conditions overlap.</p></article><article class="criteria-focus-info-card"><h4>Unknown</h4><p>Priority indication candidate with missing modality, ADMET, or platform information needed for classification.</p></article><article class="criteria-focus-info-card"><h4>N/A</h4><p>Not a priority-indication candidate, or verified values do not meet any classification gate.</p></article></div></section>`;
}

export const ENGLISH_CRITERIA_DRAWER_CHROME = {
  title: 'Scoring Guide',
  close: 'Close',
  closeAriaLabel: 'Close scoring guide',
  scopes: {
    triage: 'TAB 1 · FAST TRIAGE · SCORING GUIDE',
    full: 'TAB 2 · FULL SCOUT · SCORING GUIDE',
    focus: 'TAB 3 · OI PARTNERSHIP · SCORING GUIDE'
  },
  subtitles: {
    triage: 'Three-criterion screen for candidates that may proceed to Full Scout',
    full: 'Seven-criterion assessment for scientific, development, and commercial fit',
    focus: 'Automated OI partnership classification and follow-up guide for shortlisted candidates'
  }
};
