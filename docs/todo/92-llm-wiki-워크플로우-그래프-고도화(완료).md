# 92. LLM Wiki 워크플로우 그래프 고도화

## 목표

`skbp_pipeline_wiki`가 과학 관계뿐 아니라 Listing → Fast Triage → Full Scout → Shortlisting의 실제 운영 흐름을 함께 표현하도록 확장한다. Tab 3의 OI Partnership 분류와 운영 메타데이터도 Asset별로 확인할 수 있게 한다.

## 범위

1. `candidate-queue.json`의 Listing 후보를 위키 입력으로 포함한다.
2. Fast Triage, Full Scout, Listing, Shortlisting을 안정적인 파이프라인 정체성 기준으로 연결한다.
3. Asset/조사 이력/운영 상태를 그래프 node·edge와 Obsidian frontmatter에 분리해 기록한다.
4. 실제 Filter 3 Shortlisting과 점수 추천(`recommendation = Shortlist`)을 별도 대시보드로 분리한다.
5. Comment·Contact·Website·자료 보유·favorite/stationary는 그래프를 과도하게 늘리지 않고 운영 속성으로 노출한다.
6. 같은 asset/date의 조사본이 Scorecard 파일을 덮어쓰지 않도록 record ID를 포함한 파일명을 사용한다.
7. exporter 단위 테스트와 생성 결과 검증을 추가한다.

## 설계 원칙

- 기존 JSON 데이터를 변경하거나 자동 병합하지 않는다.
- Listing과 조사 결과의 연결은 대시보드와 동일한 정규화 identity 규칙을 사용한다.
- Comment 본문은 그래프 노드로 만들지 않고 Asset/운영 이력 노트에서만 확인한다.
- 기존 `Dashboard__Shortlist`는 추천 결과용 이름으로 바꾸고, Tab 3 실제 분류는 별도 OI Shortlisting 대시보드에 표시한다.
- 생성물은 exporter로 재생성하며 직접 수정하지 않는다.

## 검증

- Listing-only 후보와 Fast Triage/Full Scout/Shortlisting 연결 fixture를 사용해 node·edge·dashboard 생성 여부를 검증한다.
- 기존 exporter의 markdown 생성과 graph CSV/JSON 유효성을 확인한다.
- 실제 vault 재생성은 사용자 작업 중인 생성 파일을 덮어쓰지 않도록 테스트용 임시 경로에서 수행한다.

## 완료 기준

- 그래프 CSV/JSON에서 workflow 단계와 OI 분류가 별도 타입으로 확인된다.
- Obsidian 대시보드에서 Listing, Fast Triage, Full Scout, OI Shortlisting, 추천 Shortlist를 구분해 볼 수 있다.
- 동일 Asset의 서로 다른 조사본이 독립 Scorecard로 유지된다.
