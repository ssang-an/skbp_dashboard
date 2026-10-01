# Pipeline Stage 분류와 필터

## 화면 동작

- Simple Research(Tab1)와 Advanced Research(Tab2)의 Pipeline Stage 헤더는 빠른 범위 선택 전용이다. 버튼 선택 후 `적용`을 누른다. 범위 연산자·시작/끝 드롭다운, 포함 단계 미리보기 및 긴 설명은 제거했다. 포함 단계는 버튼 툴팁으로 확인한다. 같은 메뉴의 `Ascending`, `Descending`, `정렬 해제`와 헤더 `↕` 정렬은 기존 단계명 기준을 유지한다.
- 선택지는 전체, 전임상 전체(Hit Discovery~IND-enabling 및 Preclinical unspecified), Lead Opt~IND(Lead Optimization·Preclinical Candidate·IND-enabling), 임상 중 2상 미만(Phase 1·Phase 1/2), 임상 중 2상 이하(Phase 1·Phase 1/2·Phase 2), 3상만(Phase 3)이다. 임상 선택지에는 전임상·IND filed/cleared·Clinical unspecified가 포함되지 않는다. Unknown·개발 중단은 전체 또는 상단 개별 선택으로 표시한다.
- 개별 단계 복수 선택은 상단 Stage 필터에서 한다. 빠른 범위를 적용하면 해당 단계들로 상단 선택을 대체하고 짧은 버튼 라벨로 요약한다. 상단에서 개별 선택을 수정하면 범위 메타데이터를 해제하고 개별 선택으로 전환한다. 따라서 두 Stage 조건이 별도로 겹치지 않는다. 메뉴를 수정하지 않고 정렬/적용하면 상단 개별 선택을 유지한다.
- 같은 Stage 필터의 선택은 OR, TAR·국가 등 다른 필터와는 AND이다. Phase 1과 Phase 2를 선택해도 Phase 1/2는 자동 포함되지 않는다.
- 헤더와 상단 Stage 필터는 동일한 상태를 사용하며 탭별 선택을 기억한다. 해당 탭에 없는 단계를 고르면 결과 0건을 유지한다.
- Tab0는 기존 상단 Stage 복수 선택 필터를 사용하며 Tab1·2와 같은 분류 함수를 사용한다. 표와 필터는 canonical 값으로 표시하고 입력 원문은 셀의 설명에 보존한다. 해석할 수 없는 단계 문장은 별도 필터 항목을 만들지 않고 Unknown으로 묶는다.

## 공통 분류의 경계

기존 canonical 16개를 유지한다. 자산 하나에는 한 값만 부여한다.

| 구분 | 값 및 해석 |
| --- | --- |
| 구체적인 비임상 단계 | Hit Discovery → Lead Optimization → Preclinical Candidate → IND-enabling |
| 비임상 세부 단계 불명 | Preclinical unspecified. 위 네 단계를 모두 포함하는 필터가 아니다. |
| 임상 진입 절차 | IND filed/cleared. IND 제출·승인이지 판매허가가 아니다. |
| 구체적인 임상 단계 | Phase 1, Phase 1/2, Phase 2, Phase 2/3, Phase 3. 결합 임상은 독립 항목이다. |
| 임상 세부 단계 불명 | Clinical unspecified. Phase 1~3 전체를 의미하지 않는다. |
| 판매허가 절차 | Registration → Approved / marketed |
| 개발 중단 | Discontinued / inactive. 기존 설계대로 단계와 별개인 활동 상태를 이 필드에 표현한다. 중단 전 단계는 원문에서 확인한다. |
| 단계 확인 불가 | Unknown |

여러 단계가 함께 기재되면 확인된 진척 단계가 우선한다. `IND approved; Phase 2 ongoing`은 Phase 2, `PCC selected; IND-enabling ongoing`은 IND-enabling이다. 계획·예상·불확실한 단계는 올리지 않는다. `Phase 1 completed; Phase 2 planned`는 Phase 1이다.

`config/category-synonyms.json`의 단계 별칭은 전체 값이 일치할 때 적용한다. 예를 들어 First-in-human과 1상은 Phase 1이다. 문장 일부의 별칭만 보고 미래 계획을 현재 단계로 올리지 않는다. 문장 해석에는 별도의 보수적인 규칙을 적용하므로 새로운 복합 표현은 추가 검토가 필요할 수 있다.

## 2026-09-30 검증

- 서버·화면 정규화 결과를 등록 보고서 216건, Tab0 입력 1,330건, 전체 canonical/사전 별칭 및 계획·결합 임상 회귀 사례에서 비교했다. 등록된 데이터의 canonical 분류 결과는 수정 전과 동일했다. 운영 JSON 파일은 수정하지 않았다.
- 관련 자동 검사 93개 통과. Chromium에서 복수 단계, TAR 조건 결합, 탭별 선택 보존, 결과 0건, 전체 해제, 상단 필터 양방향 연동, Escape 닫기, Tab0 별칭을 검증했다.
- 추가로 실행한 Tab0 메타데이터 검사에는 기존 실패 6건이 있다. 수정 전 단계 함수로도 같은 실패가 재현됐다. 댓글 출처/작성자 명칭, Contact 메모 접두어, 문장에 포함된 웹사이트 URL 추출에 관한 테스트이며 이번 Stage 변경 범위에서는 수정하지 않았다.
