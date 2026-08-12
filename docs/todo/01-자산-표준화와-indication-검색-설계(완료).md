# 01. 자산 표준화와 indication 검색 설계

## 목적

현재 canonicalization이 lead indication을 어떻게 결정하는지 확인하고, 불확실한 indication을 `UNKNOWN` 하나로 축약하지 않으면서 여러 indication을 표시·검색하는 기준을 확정한다.

## 검토 결과

### 현재 동작과 근거

- 저장 원본은 `structured_table.indication`(상세 원문)과 `structured_table.main_indication`(필수 단일 dashboard bucket)이다. `json/schema.md`의 120행과 `json/drug-valuation.schema.json`의 `main_indication` 정의가 이를 규정한다.
- 백엔드 `main.py`의 `canonicalize_main_indication()`은 입력된 main indication이 있으면 공유 synonym dictionary로 단일값으로 정규화한다. 비어 있는 legacy 데이터는 상세 원문의 명시적 lead/primary/initial 문구에서 정확히 하나가 매칭될 때만 lead로 정하고, 그렇지 않고 정확히 하나의 canonical indication만 검출될 때만 채운다. 복수 후보·상충 후보는 `Unknown`이다.
- 프런트엔드 `src/app.js`의 동명 함수도 같은 규칙을 적용한다. 행 생성 시 `row.indication`에는 상세 원문을 유지하지만, 표시는 `row.mainIndication`만 하며 tooltip에만 원문을 넣는다.
- 필터 옵션·필터 predicate·적응증 chart도 모두 `row.mainIndication`만 사용한다. 따라서 `"Focal onset seizure; major depressive disorder; pain"`처럼 lead가 확정되지 않은 복수 indication은 화면·필터에서 `Unknown`이 된다. 검색창은 원문도 함께 검색하므로 키워드 검색만 가능하다.
- 현재 `UNKNOWN`은 lead를 확정할 수 없는 경우의 의도된 sentinel이며, 새 Compact v2 GPT 지침도 `main_indication`을 필수로 하고 lead 판단 뒤에만 `Unknown`을 허용한다.

### 확정 정책

1. `main_indication`은 **오직 하나의 lead canonical bucket**으로 유지한다. TR, score 및 기존 대시보드 호환성을 위해 복수값이나 쉼표 문자열을 저장하지 않는다.
2. 새 optional 파생 필드 `structured_table.indication_list`를 추가한다. 값은 source-confirmed indication의 고유 canonical bucket 배열이며, lead가 미확정이어도 모두 보존한다. 원문의 가장 구체적인 disease wording은 계속 `structured_table.indication`에 보존한다.
3. `indication_list`는 입력된 상세 원문에서 dictionary 매칭으로 자동 산출하되, 입력이 명시적으로 제공한 정규화 목록이 있으면 이를 우선 검증한다. 미매칭 원문은 목록에서 임의 추정하지 않으며 원문에만 남긴다.
4. 표의 Main indication 열은 lead가 있으면 lead를 먼저, 그 밖의 목록을 ` · `로 이어 `Lead — additional…` 형식으로 표시한다. lead가 없으면 확인된 목록을 쉼표로 표시하고, 목록도 비어 있을 때만 `Unknown`으로 표시한다. 접근성 tooltip에는 상세 원문을 유지한다.
5. indication 필터는 다중 선택 방식으로 바꾼다. 선택한 항목 중 **하나라도** `indication_list`에 있으면 표시한다(OR). `Unknown`은 `indication_list`가 비어 있고 lead도 `Unknown`인 레코드만 뜻한다. 검색·정렬은 표시 목록 전체를 사용한다.
6. GPT 지침과 입력 안내에는 “lead가 불명확하면 `main_indication: Unknown`으로 두되, `indication`에는 확인된 모든 indication을 세미콜론/쉼표로 적고 `indication_list`에 canonical 목록을 제공”한다는 문구를 넣는다. `Unknown`을 상세 indication 값의 대체값으로 쓰지 않는다.

### 구현 영향과 마이그레이션

- 수정 대상: `main.py`(정규화·검증·API summary), `src/app.js`(행 모델·표시·다중 필터·정렬·GPT 템플릿), `index.html`/`src/styles.css`(다중 선택 UX), `json/drug-valuation.schema.json`, `json/schema.md`, `config/category-synonyms.json`(필요한 synonym만), 관련 unit test이다.
- 기존 JSON은 쓰기 시 `indication_list`를 원문에서 파생해 backfill한다. 원문이 하나의 known indication이면 단일 배열이 되고, 복수 known indication은 모두 보존된다. 원문이 비어 있거나 어떤 canonical 값도 확인되지 않으면 빈 배열로 둔다. 기존 `main_indication` 값은 변경하지 않는다.
- 이 정책은 상위 실행 승인(전체 작업 순차 수행)에 따라 02에서 구현한다. 별도 데이터 삭제·일괄 수동 마이그레이션은 필요하지 않다.

## 검증

- `main.py`, `src/app.js`, schema, category dictionary 및 기존 canonicalization tests의 관련 경로를 대조했다.
- 예시 복수 indication의 현재 `Unknown` 처리와 검색-only 동작을 코드 predicate로 확인했다.
