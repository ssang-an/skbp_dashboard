# 106. Tab 0 Summary 접기와 세로 간격 정비

## 목표

Tab 0의 Listing 안내·Summary Dashboard·진척 카드 사이 간격을 workflow 공통 화면처럼 압축하고, Summary Dashboard의 접기 동작은 그래프만 숨기도록 바꾼다.

## 작업 범위

1. Tab 0 전용 workflow 안내의 중복 하단 margin을 제거하고 panel gap을 공통 밀도로 조정한다.
2. 접기 시 Listing·Fast Triage·Full Scout·Shortlisting의 수치/필터 button은 유지한다.
3. 접기 시 각 단계의 G6 node graph canvas만 숨기고, 카드 높이를 header 높이로 축소한다.
4. 회귀 테스트와 JS 문법을 확인한다.

## 완료 기준

- 접기 상태에서도 네 단계 수치와 필터 버튼을 누를 수 있다.
- G6 그래프만 사라지고 Summary Dashboard heading은 유지된다.
- Tab 0의 세로 여백이 다른 workflow dashboard와 비슷한 밀도로 보인다.
