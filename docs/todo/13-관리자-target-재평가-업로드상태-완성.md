# 13. 관리자 Target·재평가·업로드 상태 완성

## 목표

Unknown target의 admin edit, rubric refresh의 수동값 처리, 업로드/첨부 작업의 일관된 진행 상태를 완성한다.

## 작업

- Tab2 Unknown target을 admin double-click 편집으로 연결한다.
- stage/score/filter 수동 override와 refresh에서 원복되는 값의 정책을 명시·구현한다.
- refresh context가 원문 메모 및 Partner Materials를 포함하는지 검증한다.
- 업로드·첨부 중 상태와 완료 피드백, Tab0 header count/table style을 정비한다.

## 완료 기준

- admin edit와 user read-only가 UI/API 모두에서 보장된다.
- refresh와 upload 상태가 성공/실패/취소에서 명확하다.
