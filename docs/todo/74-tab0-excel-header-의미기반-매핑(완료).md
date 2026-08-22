# 74. Tab 0 Excel Header 의미기반 매핑 (완료)

- 첫 Excel header 행을 exact alias 및 의미 키워드 점수로 Tab 0 입력 필드에 매핑하도록 구현했다.
- 열 순서가 달라도 `Company geography`는 Country, `Company name`은 Company처럼 배정된다.
- 미인식·중복·동점 header는 자동으로 다른 열에 넣지 않고 건너뛰며 붙여넣기 안내에 표시한다.
