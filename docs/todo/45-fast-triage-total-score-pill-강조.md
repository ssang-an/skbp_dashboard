# 45. Fast Triage Total Score Pill 강조

## 목표

- `3-point screening` 헤더의 Total 점수를 각 기준 점수와 어울리는 요약 pill로 표시해 빠르게 인식할 수 있게 한다.

## 작업

1. Total과 `점수 / 9`를 시각적으로 분리한다.
2. 숫자를 크게 표시하되 개별 3점 pill보다 과도하게 강하지 않게 유지한다.
3. 접근성용 Total 점수 라벨을 유지한다.

## 검증

- 점수 렌더링 JS 문법과 Total 점수 aria-label을 확인한다.
