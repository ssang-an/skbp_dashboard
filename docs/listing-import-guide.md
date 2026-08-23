# Tab 0 Listing 가져오기·연결 운영 가이드

Tab 0의 Excel 가져오기는 **대표 표기**와 **Listing 관리 정보**를 분리해 처리한다. Fast Triage와 Full Scout의 공식 조사값은 Tab 0 Listing으로 변경하지 않는다.

## 유사 Pipeline 확인 팝업

유사 후보가 있을 때, 사용자가 반드시 고르는 첫 번째 항목은 하나다.

| 선택 | 결과 |
| --- | --- |
| `같은 Pipeline으로 연결` | 하나의 Pipeline으로 관리한다. Comment·Contact History와 Listing 보완 정보가 규칙에 따라 누적된다. |
| `별도 신규 Pipeline으로 추가` | 기존 Pipeline과 어떤 정보도 공유하지 않는 새 Listing을 만든다. |
| `이번 행 제외` | 이번 Excel 행을 저장하지 않으며 기존 Pipeline도 변경하지 않는다. |

`같은 Pipeline으로 연결`한 대상이 **Listing-only**이고 Asset 또는 Company 표기가 다르면, 두 번째로 대표 표기를 선택한다.

| 선택 | 표에서 보이는 Asset·Company명 |
| --- | --- |
| `기존 대표 표기 유지` | 기존 Listing의 Asset·Company명 |
| `새 입력값을 대표 표기로 적용` | 이번 Excel 행의 Asset·Company명 |

이 선택은 **이름 표시만** 정한다. 연결이 확정되면 기존·신규 Asset/Company명은 모두 검색·후속 중복 감지용 별칭 메타데이터에 자동 저장된다. 별칭은 Tab 0 표의 별도 열로 표시하지 않지만 검색창과 다음 Excel 가져오기 판별에 사용된다.

Fast Triage 또는 Full Scout가 있는 대상은 해당 조사 결과의 Asset·Company명이 공식 대표 표기다. 이 경우에는 대표 표기 선택을 열지 않고, 이번 Listing의 이름을 별칭 메타데이터로 자동 보존한다.

## Listing 정보 병합 규칙

같은 Pipeline으로 연결된 **Listing-only** 항목은 대표 이름과 독립적으로 다음 규칙을 적용한다.

1. 기존 값이 비어 있으면 새 값을 채운다.
2. 새 행이 채운 Listing 필드 수가 더 많으면, 충돌하는 Listing 필드를 새 값으로 갱신한다.
3. `Target`, `Modality`, `Main indication`은 같은 수의 필드가 채워졌더라도 새 문구가 더 구체적이면 새 문구를 보존한다. 예: `ASO` → `AAV-delivered ASO, intrathecal`.
4. 새 값이 비어 있으면 기존 값을 지우지 않는다.
5. `Comment`와 `Contact History`는 대표 표기나 Listing 필드 갱신과 관계없이 누적한다. 동일한 본문은 한 번만 유지한다.

즉 `기존 대표 표기 유지`를 선택해도 새 행의 더 상세한 Modality·Target·Indication, 또는 더 풍부한 Listing 행은 병합될 수 있다. 반대로 `새 입력값을 대표 표기로 적용`을 선택해도 기존 Listing의 비어 있지 않은 보완 정보는 지워지지 않는다.

## 공식 조사 결과 보호

Fast Triage 또는 Full Scout가 있는 Pipeline에는 Listing의 Country·Stage·Modality·Target 등으로 공식 조사 필드를 덮어쓰지 않는다. Tab 0에서 가져온 Comment·Contact History·Website·별칭 같은 운영 메타데이터만 해당 Workspace에 동기화한다. Full Scout가 있으면 Full Scout가 동기화의 우선 대상이고, 없으면 Fast Triage가 대상이다.

## 자동 처리와 확인이 필요한 경우

정규화했을 때 개발 코드가 같은 경우(대소문자·공백·하이픈 차이 등)는 자동으로 기존 Pipeline에 연결한다. 괄호 안 코드, 이전 회사명, 일부 이름이 겹치는 경우처럼 관계가 확실하지 않은 후보는 확인 팝업을 연다. 이름이 비슷하더라도 회사와 Asset 관계가 확인되지 않으면 `별도 신규 Pipeline으로 추가`를 선택한다.

## 운영 권장

- Excel에는 가능한 한 가장 최근의 정확한 Asset·Company명을 쓴다.
- 이전 코드나 공동개발사 표기는 괄호·콤마로 함께 남겨도 된다. 연결 확인 후 별칭으로 보존된다.
- 동일 성분이라도 회사가 다르면 자동으로 같은 Pipeline으로 연결하지 않는다.
- 별칭은 검색·중복 감지용이다. Country, Stage, Modality 같은 Filter 2 선택값을 추가하지는 않는다.
