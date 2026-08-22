# 63. Tab 0 Listing 메타데이터와 단계 표시

## 목표

Tab 0 후보 목록에 `Comment`, `Contact`를 함께 입력·보존하고, Listing부터 Fast Triage·Full Scout·Shortlisting까지의 진행 단계를 한 행에서 확인한다.

## 작업 범위

1. Excel 탭 붙여넣기 `Asset | Company | Comment | Contact`와 기존 2열 입력을 모두 지원한다.
2. 대기 목록과 조사 완료 레코드에 내부 메타데이터를 영속 저장하고, 빈 입력값은 기존 정보를 지우지 않도록 한다.
3. Tab 0 표에 `Listing → Fast Triage → Full Scout → Shortlisting → Comment → Contact` 열을 두고 완료는 체크, 미완료는 `−`로 표시한다.
4. Comment/Contact 표시를 클릭·더블클릭하여 조회·수정·삭제(빈 값 저장)할 수 있게 한다.
5. 동일 identity의 Fast Triage/Full Scout 상세 화면에서 읽기 전용으로 표시하고, GPT 원문·점수·루브릭에는 영향을 주지 않게 한다.
6. Tab 0 검색·CSV 내보내기에 Comment/Contact를 포함하고, 스키마/문서 및 회귀 테스트를 갱신한다.

## 검증

- 2열/4열/빈 셀/멀티라인 Comment 파싱
- 빈 재업로드 비파괴 병합과 명시적 삭제
- Listing 메타데이터의 Fast Triage/Full Scout 승격
- Python/JavaScript 문법 및 기존 Tab 0 최근 업로드 회귀 테스트
