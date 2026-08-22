# 67. Tab 0 Comment 셀 내 줄바꿈 붙여넣기

## 목표

Excel에서 복사한 Comment 셀 안의 줄바꿈이 다음 Pipeline 행으로 오인되지 않도록 Tab 0 Listing 입력을 보완한다.

## 작업 범위

1. Excel의 quoted TSV 셀 안에 포함된 줄바꿈을 하나의 Comment 값으로 파싱한다.
2. Comment를 여러 줄 입력·표시가 가능한 textarea 셀로 변경한다.
3. 붙여넣기 및 직접 입력 시 Comment 셀 높이를 내용에 맞춰 제한 범위에서 확장한다.
4. 전체 표 붙여넣기와 열 제목 행 건너뛰기 동작을 유지한다.
