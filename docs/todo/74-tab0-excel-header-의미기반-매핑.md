# 74. Tab 0 Excel Header 의미기반 매핑

## 목표

Excel 표의 첫 행에 열 제목이 포함되어 있을 때, Tab 0 입력표와 열 순서가 달라도 header 의미에 맞는 입력 칸으로 값을 배정한다.

## 작업 범위

1. 기존 정확한 header 별칭 매칭을 유지한다.
2. Company, Country, Asset, Modality, Target, Main indication, Stage, Comment, Contact의 의미 키워드 점수로 변형 header를 매핑한다.
3. 예: `Company geography` → Country, `Company name` → Company, `Pipeline stage` → Stage.
4. 같은 대상 열이 중복되거나 서로 다른 대상이 동점인 header는 임의 배정하지 않고 건너뛴다.
5. 붙여넣기 결과에 인식·건너뜀 열 수를 안내한다.

## 완료 기준

- 첫 header 행이 있으면 데이터 열 순서와 무관하게 Tab 0 열에 맞춰 저장된다.
- 미인식/중복 header는 다른 열을 밀거나 덮어쓰지 않는다.
- header가 없는 기존 positional 붙여넣기는 유지된다.
