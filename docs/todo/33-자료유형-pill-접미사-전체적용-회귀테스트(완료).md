# 33. 자료 유형 pill 접미사 전체 적용 회귀 테스트 (완료)

## 완료 내용

- 자료 보유 pill에서 직접 선택한 NCDP·CDP·ADMET·IR·DD 유형 모두 같은 접미사 보정 함수를 사용한다.
- 파일명에 선택한 유형이 없으면 확장자 앞에 `_NCDP`, `_CDP`, `_ADMET`, `_IR`, `_DD`를 각각 추가한다.
- 원래 파일명에 다른 자료 유형이 있더라도 선택한 유형은 추가되며, 동일 유형이 이미 있으면 중복 추가하지 않는다.
- 서버의 모든 Partner Material 접미사 인식 회귀 사례를 보강했다.

## 검증

- `node --check src/detail.js`
- `python -m unittest tests.test_admet_canonical25 tests.test_dashboard_ia.DashboardInformationArchitectureTests.test_shortlisting_material_pills_upload_multiple_forced_categories`
