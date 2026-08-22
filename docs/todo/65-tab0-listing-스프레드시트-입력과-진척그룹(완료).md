# 65. Tab 0 Listing 스프레드시트 입력과 진척 그룹 (완료)

- Tab 0 진척 표를 Company·Country·Asset·Modality·Target·Main indication·Stage와 `Evaluation Progress` 6단계 그룹으로 재구성했다.
- 후보 입력은 Excel형 셀 표로 변경했으며 Company와 Asset만 필수이고, 여러 행·열 붙여넣기와 행 추가/삭제를 지원한다.
- Comment/Contact도 Listing 단계와 같은 check/minus pill로 통일했다.
- Listing 보조정보는 `candidate-queue.json`에만 저장하며, Fast Triage·Full Scout의 공식 값, 점수, 근거를 덮어쓰지 않는다.
- GPT 지침 1에는 선택 후보의 보조정보를 사용자 제공 식별 참고값으로 포함하고 독립 검증을 요구한다.

상세 작업 로그: `65-tab0-listing-스프레드시트-입력과-진척그룹-작업로그.md`
