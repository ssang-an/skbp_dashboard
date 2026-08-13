# Tab3 OI Partnership 자동 분류 기준

- Version: 1.3
- Scope: Full Scout records tracked in Tab3
- Evidence priority: Tab3 structured values → Full Scout detailed/raw report → Partner Materials
- No inference: an absent or unclear value remains unknown.

## Target indications

Alzheimer's Disease (AD), Parkinson's Disease (PD), Amyotrophic Lateral Sclerosis (ALS),
Multiple Sclerosis (MS), Neuropathic Pain, and Epilepsy.

Non-target indications are `n_a` with the note `대상 적응증 아님`.

## Classification rules

| Stored value | Display | Rule |
| --- | --- | --- |
| `investment` | 투자 | Target indication + Non-Small Molecule + Stage >= IND-enabling |
| `value_up` | Value Up | Target indication + Small Molecule + Stage < IND-enabling + In Vivo O + In Vitro O + ADMET uploaded and scored |
| `joint_research` | 공동 연구 | Target indication + All Modality + Platform Attractiveness exactly 3 |
| `unknown` | Unknown | Target indication, but at least one required input is missing or unclear |
| `n_a` | N/A | Non-target indication, or all required inputs are known but no rule is satisfied |

If joint research overlaps another category, store `joint_research`. When it also meets
investment, begin the note with `투자 또한 해당`.

## Input interpretation

- Only an explicit `Small Molecule` label is treated as Small Molecule.
- Biologic, Antibody, Peptide, Protein, Gene Therapy, Cell Therapy, RNA, ASO, siRNA,
  mRNA, Vaccine, and oligonucleotide labels are Non-Small Molecule.
- Investment includes `IND-enabling`, `IND filed/cleared`, and Phase 1 or later canonical stages.
- Value Up requires a confirmed pre-IND-enabling canonical stage only: `Hit Discovery`,
  `Lead Optimization`, `Preclinical Candidate`, or `Preclinical unspecified`. `IND-enabling`,
  `IND filed/cleared`, and Phase 1 or later do not satisfy Value Up.
- Value Up requires an uploaded Partner Material categorized as `ADMET` and a numeric ADMET
  score (including 0); the prior `ADMET >=25` threshold does not apply.
- In Vivo/In Vitro `O` requires a stated positive efficacy or activity result.
- A statement that an experiment was performed, without a result, is not `O`.
- ADMET is numeric; 25 is included in the Value Up threshold.
- Joint research applies to all modalities when Platform Attractiveness is exactly 3.

## Human override

Automatic classification stores the final value, note, evidence-source list, source/status,
criteria version, and latest automatic suggestion. A human change sets the final source to
`manual`; subsequent evidence refreshes update the auto suggestion but do not overwrite the
human decision. Selecting `Auto` in the UI removes that precedence and recalculates the final
value using this version.

## Uploaded-document evidence

- PDF는 먼저 PyMuPDF 네이티브 텍스트를, PPTX는 먼저 `python-pptx` 슬라이드 텍스트를 사용한다.
- 네이티브 PDF 텍스트 품질이 부족할 때만 OpenRouter `file-parser`를 사용한다.
- 기본 parser는 `cloudflare-ai`이며, `mistral-ocr`은 네이티브 추출과 기본 parser가 모두
  부족하고 `ENABLE_PAID_OCR=true`인 경우에만 허용한다.
- 네이티브 추출 근거에는 page/slide 번호를 보존한다. Parser가 페이지 위치를 제공하지
  않으면 번호를 추정하지 않고 `page_or_slide: null`로 저장한다.
- DeepSeek 문서 판정은 `true`, `false`, `unknown`만 사용한다. 자료에 명시되지 않은
  내용은 `false`가 아니라 `unknown`이다.
- 문서 자동 판정은 Filter 3 구조화 값을 갱신하지만, 사람이 수정한 값과 최종 OI
  Partnership 결정은 덮어쓰지 않는다.
