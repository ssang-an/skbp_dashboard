# Rubric Release Maintenance Guide

SKBP의 Fast Triage와 Full Scout는 rubric, GPT instruction, backend validator/calculator, dashboard judgment guide, schema, regression test가 함께 하나의 운영 계약을 이룬다. 점수 또는 상태의 의미를 바꿀 때 일부 파일만 수정하면 저장·재점수·표시 결과가 서로 달라질 수 있다.

현재 release identity의 단일 기준은 `config/rubric-release.json`이다.

| Workflow | Current rubric/instruction | Current display | Schema |
|---|---:|---:|---:|
| Fast Triage | 3.4 | 3.4 | 3.2 |
| Full Scout | 3.6 | 3.6 | 3.2 |

`rubric_version`과 `instruction_version`은 서로 다른 의미(점수/판정의 의미 vs 그 점수에 도달하는 조사·기록·출력 절차)를 가지지만, **항상 같은 값으로 움직인다** — `main.py`의 manifest loader가 두 값이 다르면 서버 기동 자체를 거부한다(`if workflow["instruction_version"] != workflow["rubric_version"]: raise RuntimeError(...)`). 즉 이 둘을 독립적으로 올리는 것은 설계 의도가 아니라 **실행 불가능**이다. `display_version`만 이 둘과 독립적으로 움직인다.

## 1. 먼저 변경 유형을 결정한다

| 변경 내용 | 올릴 버전 | 예시 |
|---|---|---|
| 점수 정의, threshold, status gate, hard blocker, evidence 인정 조건, canonicalization, 계산식 변경 | `rubric_version` + `instruction_version` (항상 함께) | TR 3점 정의 변경, Platform 3점 조건 변경, PASS/FAIL 변경 |
| GPT에게 요구하는 조사 범위·출력 JSON·source 기록 방식 변경, 또는 조사 순서·검색 범위·evidence 기록 방식 등 **운영 원리**만 변경하고 score/status/canonical value/calculation/JSON contract는 그대로 유지 | `rubric_version` + `instruction_version` (항상 함께 — 아래 참고) | source registry 필드 변경, 경쟁 검색 순서 추가, why-not-higher 기록 방식 명확화 |
| 저장 JSON의 shape, enum, required field, API contract 변경 | `schema_version` 및 관련 rubric/instruction | 새 required JSON field 또는 enum 추가 |
| 화면의 줄바꿈·순서·용어 다듬기처럼 점수/상태/조사 행동이 바뀌지 않는 가독성 변경 | `display_version`만 | 판단근거 문장 축약, 표 헤더 교정 |
| 지침/프롬프트 파일의 기술적 결함(문법 오류, escape 누락, JSON 템플릿 파손 등)으로 실행이 깨지거나 GPT 응답 파싱이 실패하는 **버그 수정**. 조사 범위·점수·출력 계약은 바뀌지 않는다 | 버전 변경 없음 | `src/app.js` 지침 텍스트 안 백틱 escape 누락으로 대시보드 전체가 로드되지 않던 문제 |
| GPT의 반복적인 작성 실수를 막기 위한 **주의사항만 추가** | 버전 변경 없음 — `config/instruction_warnings.json`에 별도로 누적되며 `rubric-release.json` 버전과 무관하게 동작 | “JSON 문법 오류 방지를 위해 모든 필드를 빠짐없이 옮기세요” 같은 자동 caution note |

문구가 가독성 변경인지 애매하면 다음 질문으로 판단한다: **그 문구를 읽은 GPT 또는 사용자가 이전과 다른 score, status, 조사 범위를 선택할 수 있는가?** 그렇다면 rubric/instruction 변경이다. 아니라면 display-only 변경이다. 버그 수정과 주의사항 추가는 이 질문과 별개로, **애초에 조사 범위·점수·출력 계약을 바꾸려는 의도가 없는 경우에만** 해당하며, 실제로 바뀐 것이 있다면 위 표의 다른 행을 따른다.

### 운영 원리 변경도 backend는 그대로일 수 있다

rubric 문서에 적힌 내용을 고친다고 항상 backend까지 바뀌는 것은 아니다. `rubric_version`은 **점수와 최종 판정의 의미**를 고정하고, `instruction_version`은 그 점수에 도달하기 위한 **조사·기록·출력 절차**를 고정한다 — 두 버전 필드는 항상 함께 올라가지만, 이 구분은 **backend(calculator/validator/status derivation)를 함께 고쳐야 하는지**를 가르는 기준으로는 여전히 유효하다.

다음 조건을 모두 만족하면 rubric 문서의 운영 원리 문구를 고치면서도 backend 계산은 건드리지 않는다 (버전은 위 표대로 `rubric_version`+`instruction_version`을 함께 올린다).

- 각 criterion의 0/1/2/3 정의와 PASS/REVIEW/FAIL 또는 SELECT/REJECT/INSUFFICIENT 조건이 동일하다.
- 어떤 evidence가 점수를 올리거나 낮추는지, canonical value를 어떻게 매핑하는지, 계산식이 동일하다.
- backend의 calculator, validator, status derivation이 새 문구와 충돌하지 않는다.
- JSON schema/required field/enum/storage contract가 동일하다.

이 경우 backend 계산을 바꿀 필요는 없다. 다만 GPT가 실제로 따라야 할 조사 행동이 바뀌므로 `src/app.js`의 해당 prompt와 instruction version statement는 반드시 함께 갱신하고, regression test에 새 운영 원리를 확인하는 assertion을 추가한다.

예를 들어 “Platform 3점은 외부 검증을 찾는다”처럼 3점 인정 조건 자체가 달라지면 backend까지 검토해야 한다. 반대로 “동일한 3점 조건을 확인할 때 회사 자료·논문·partner 발표를 이 순서로 탐색한다”처럼 점수 의미를 바꾸지 않는 검색 순서 변경은 backend를 건드리지 않는다 — 다만 버전은 두 필드 모두 함께 올린다.

### 버전 없이 처리하는 두 가지 예외

- **기술적 버그 수정**: 지침/프롬프트 파일 자체의 결함(예: JS 문자열 안 이스케이프 누락, JSON 템플릿의 괄호/쉼표 불일치)으로 대시보드가 로드되지 않거나 GPT 응답 파싱이 실패하는 경우. 조사 범위나 점수 의미는 전혀 바뀌지 않으므로 rubric/instruction/display 버전 중 어느 것도 올리지 않는다. 즉시 수정하고, `node --check` 등으로 검증한 뒤 changelog에만 기록한다.
- **주의사항(caution note) 추가**: GPT가 과거에 반복한 특정 작성 실수를 막기 위한 안내문은 `main.py`의 `append_instruction_warning`/`load_instruction_warnings`가 `config/instruction_warnings.json`에 누적하고, `src/app.js`의 `copyPromptToClipboard`가 지침 1/2 복사 텍스트 끝에 자동으로 붙인다. 이 경로는 의도적으로 버전 체계 밖에 있다 — 점수·조사범위·출력 계약을 바꾸는 게 아니라 “이미 정의된 절차를 지침대로 안 따랐을 때”의 재발 방지 노트이기 때문이다. 점수/조사범위/출력 계약 자체를 바꾸고 싶다면 이 경로 대신 위 표의 해당 행(rubric/instruction 변경)을 따른다.

아직 배포 전이고 저장 결과도 생성되지 않은 작업 묶음은 사용자의 명시적 승인 아래 같은 release version 안에서 통합 수정할 수 있다. 배포 또는 결과 저장 후에는 과거 version 문서를 덮어쓰지 않고 새 instruction/rubric release를 만든다.

## 2. Rubric 변경 체크리스트

Fast 또는 Full의 점수·상태·조사 행동을 바꾸면 아래 항목을 모두 수행한다.

1. 새 versioned rubric 문서를 만든다. 기존 실행 결과의 재현성을 위해 과거 `v*.md`를 덮어쓰지 않는다.
2. `config/rubric-release.json`의 해당 workflow `rubric_version`, `instruction_version`, `rubric_file`을 새 release로 바꾼다. Full은 `display_file`도 현재 rubric을 설명하는 문서인지 확인한다.
3. `main.py`의 calculator, hard-filter derivation, validator, canonical value를 같은 규칙으로 바꾼다. 점수 함수와 save validator가 서로 다른 threshold를 쓰면 안 된다.
4. `src/app.js`의 Fast/Full GPT prompt, Compact JSON template의 version fields, paste validator, status mapping을 갱신한다.
5. `index.html`, `triage_detail.html`, `detail.html`의 판단근거와 점수표를 rubric과 대조한다.
6. `json/drug-valuation.schema.json`과 `json/schema.md`를 확인한다. 저장 contract가 바뀌면 schema version도 올리고 migration/compatibility를 명시한다.
7. 현재 release tests와 fixture를 새 계약으로 갱신한다. 새 rubric의 경계 사례(0/1/2/3, SELECT/REJECT/INSUFFICIENT, PASS/REVIEW/FAIL, early stop)를 최소 하나씩 추가한다.
8. 기존 저장 record를 자동 재점수하지 않는다. 필요하면 별도 rescore workflow와 provenance field를 사용한다.

운영 원리 변경만인 경우에는 위 목록에서 **1–2의 rubric version 변경, 3의 backend 계산 변경, 6의 schema 변경은 수행하지 않는다.** 대신 active rubric 문서의 절차 설명, `src/app.js` prompt, `instruction_version`, 관련 화면 안내가 같은 행동을 설명하는지 대조한다.

## 3. Display-only 변경 체크리스트

점수·status·조사 행동을 바꾸지 않는 판단근거 가독성 수정은 다음만 수행한다.

1. `config/rubric-release.json`의 해당 workflow `display_version`을 올린다. `rubric_version`과 `instruction_version`은 유지한다.
2. Full Scout는 새 display 문서를 만들거나 갱신하고, `display_file`과 문서 제목의 display version을 일치시킨다.
3. 화면 문구를 수정한다. Fast Triage의 display는 현재 `index.html`과 `triage_detail.html`, Full Scout의 display는 `index.html`과 `detail.html`에 있다.
4. 의미가 변하지 않았는지 rubric 문서 및 GPT prompt와 대조한다. score/status/threshold 문구가 달라졌다면 display-only가 아니라 rubric 변경으로 되돌린다.
5. manifest regression test에 새 display version 및 핵심 문구를 추가한다.

## 4. Release 전 필수 검증

PowerShell에서 아래를 실행한다.

```powershell
$env:PYTHONIOENCODING='utf-8'
python -m unittest tests.test_rubric_release_manifest tests.test_rubric_ai_refresh tests.test_rubric_v32_v33
node --check src/app.js
node --check src/triage-detail.js
node --check src/detail.js
python -m py_compile main.py
git diff --check
```

또한 `config/rubric-release.json`의 version/file path, GPT prompt의 version statement와 JSON template, 화면 판단근거의 threshold를 직접 대조한다. `tests/test_rubric_release_manifest.py`는 이 active-release 정합성을 계속 검증해야 한다.

## 5. 변경 기록

### Dashboard-owned derived fields

`scoring.total_score`, `scoring.max_score`, `hard_filter.status`, Fast Triage `triage.status`, and the Fast Triage recommendation are deterministic dashboard-owned fields. The paste validator, AI second-parser response, and server save boundary must calculate the same values from the submitted criterion scores and the active hard-filter rule. A GPT response with an old total or status must be aligned and saved; do not reject otherwise valid research evidence solely for that mismatch.

This is a backend/ingestion consistency change, not automatically a rubric-version change. Bump the rubric/instruction version only when the score definitions, status thresholds, hard-blocker semantics, or research scope change. If only the implementation is fixed so that it faithfully applies the already-released rule, keep the release version and add regression coverage plus a changelog entry.

모든 release, display-only, 버전 없는 버그 수정·주의사항 추가 변경은 `docs/changelog/YYYY/YYYY-MM-DD.md`에 다음을 짧게 남긴다.

- 변경 유형: rubric / instruction / schema / display-only / bug-fix / caution-note
- 영향 workflow: Fast Triage / Full Scout
- 변경한 version과 핵심 규칙 (bug-fix·caution-note는 "버전 변경 없음"으로 명시)
- 실행한 검증
