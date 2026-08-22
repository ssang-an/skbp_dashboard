# Tab 0 Flex 순서 표시 정정

## 목적

Tab 0의 HTML 순서와 화면 표시 순서가 달라지는 문제를 해결한다. 공통 workflow flex cascade 때문에 Summary Dashboard가 Listing 안내보다 먼저 렌더링되지 않도록 Tab 0 전용 순서를 명시한다.

## 작업 순서

1. Listing 안내와 Summary Dashboard의 flex order 충돌을 확인한다.
2. Tab 0 전용 CSS로 Listing 안내를 1, Summary Dashboard를 2로 고정한다.
3. 구조 테스트와 JavaScript 문법 검사를 실행한다.
