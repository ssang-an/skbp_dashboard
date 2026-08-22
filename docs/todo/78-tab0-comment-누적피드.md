# 78. Tab0 Comment 누적 피드

## 목표

Excel의 복수 Comment 열은 한 Listing Comment로 줄바꿈 보존하고, Tab1/Tab2에서 사람이 남긴 운영 의견도 Tab0에서 확인한다.

## 범위

1. 복수 Comment 헤더의 같은 행 값을 줄바꿈으로 누적하는 기존 붙여넣기 규칙을 회귀 검증한다.
2. Tab0 Comment pill의 상세 보기에 Listing Comment, 사람의 Final Comment, 사람의 정성평가 의견을 출처·작성자·시각과 함께 누적 표시한다.
3. AI 정성평가 답변과 GPT 원문/근거/점수는 Comment 피드에서 제외한다.
4. Tab0에서 연구 결과를 직접 수정하지 않고, 연구된 행은 Tab1/Tab2의 공식 값을 우선 표시하는 기존 권한·우선순위를 유지한다.

## 완료 기준

- 사람의 Tab1/Tab2 의견이 Tab0 Comment에서 누적 확인된다.
- 동일 입력 행의 복수 Comment 열이 줄바꿈으로 보존된다.
- AI 답변·루브릭·GPT 원문은 운영 Comment와 분리된다.
