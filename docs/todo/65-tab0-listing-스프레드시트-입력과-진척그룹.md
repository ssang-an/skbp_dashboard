# 65. Tab 0 Listing 스프레드시트 입력과 진척 그룹

## 목표

Tab 0 후보 목록을 Listing 관리용 스프레드시트형 입력·진척 표로 정리하고, 선택 후보의 식별 보조정보를 Fast Triage 지침 1에 안전하게 전달한다.

## 작업 범위

1. 진척 표를 `Company · Country · Asset · Modality · Target · Main indication · Stage`와 `Evaluation Progress` 그룹으로 재배치한다.
2. `Evaluation Progress`에는 Listing, Fast Triage, Full Scout, Shortlisting, Comment, Contact를 같은 check/minus pill 형식으로 표시한다.
3. Tab 0 입력을 Excel처럼 셀 단위로 입력·복수행 붙여넣기 가능한 표로 변경한다.
4. Company와 Asset만 필수로 검증하고 나머지 입력칸은 선택으로 둔다.
5. Country·Modality·Target·Main indication·Stage는 미조사 Listing 대기열 전용 보조정보로 저장하며, 조사 결과 레코드·점수·루브릭을 덮어쓰지 않는다.
6. 선택된 Listing 후보의 보조정보는 GPT 지침 1에 사용자 제공 식별 참고값으로만 포함하고, 독립 검증을 명시한다.
7. API 회귀 테스트·JavaScript 문법 검증을 수행하고 작업 로그와 변경 이력을 남긴다.
