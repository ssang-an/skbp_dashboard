# 34. 자료 유형 pill 삭제 상태 동기화 (완료)

## 완료 내용

- 서버가 첨부 삭제 후 남아 있는 Partner Materials를 기준으로 upload-derived pill 상태를 정리한다.
- 마지막 NCDP·CDP·ADMET·IR·DD 파일을 삭제하면 해당 pill이 꺼진다.
- 같은 유형 파일이 남아 있으면 pill은 계속 켜져 있으며, 과거의 명시적 수동 override는 보존한다.

## 검증

- `python -m unittest tests.test_admet_canonical25`
- `python -m unittest tests.test_dashboard_ia.DashboardInformationArchitectureTests.test_shortlisting_material_pills_upload_multiple_forced_categories`
