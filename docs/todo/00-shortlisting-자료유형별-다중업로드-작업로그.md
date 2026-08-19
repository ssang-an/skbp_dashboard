# Shortlisting 자료 유형별 다중 업로드 작업 로그

## 완료

- Team Review Workspace의 자료 보유 pill을 `IR · CDP · NCDP · ADMET · DD Report` 순서로 확장했다.
- 각 pill은 현재 점등 여부와 무관하게 다시 눌러 해당 카테고리의 파일을 여러 개 선택·업로드할 수 있다.
- pill에서 업로드하면 선택한 카테고리가 Partner Materials에 명시적으로 저장된다.
- 파일명에 자료 유형이 없으면 확장자 앞에 `_IR`, `_CDP`, `_NCDP`, `_ADMET`, `_DD Report`를 덧붙여 저장·표시한다.
- 드래그앤드롭 및 일반 파일 선택은 기존처럼 파일명 기반 자동 분류를 유지한다.

## 검증

- `node --check src/detail.js`
- `python -m py_compile main.py`
- `python -m unittest tests.test_admet_canonical25 tests.test_dashboard_ia.DashboardInformationArchitectureTests.test_shortlisting_material_pills_upload_multiple_forced_categories`
