# 15 완료 작업 로그

- ADMET numerator는 25개 canonical study key와 alias에 매핑되는 완료 항목만 unique하게 집계한다.
- optional Dog telemetry 및 정의되지 않은 추가 자료는 numerator에서 제외한다.
- table/multiline 상태, 중복 alias, 미완료, 추가 연구, category, source separation을 검증하는 A~G 테스트를 추가했다.
- 검증: `python -m unittest tests.test_admet_canonical25 -v` (7 passed), `python -m py_compile main.py`를 통과했다.
