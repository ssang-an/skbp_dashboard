# Tab 0 Summary 필터 연동 카운트·컬러

## 목표

Tab 0 하단 필터 조건에 맞춰 Summary Dashboard의 단계별 숫자, 최근 15일 수치, DOT 그래프와 시각적 강조를 함께 갱신한다.

## 작업

- [x] 필터 결과 행에서 Listing·Fast Triage·Full Scout·Shortlisting별 수치와 최근 15일 수치를 재계산한다.
- [x] 필터 변경 시 카운트업 애니메이션과 DOT 그래프를 함께 다시 표시한다.
- [x] 진행 단계 단일 선택은 해당 단계 DOT 색상으로 Summary 전체를 은은하게 강조하고, 다른 필터는 공통 accent를 적용한다.
- [x] API 행에 단계 완료 시각을 포함해 필터링된 최근 업로드 수를 정확히 계산한다.
