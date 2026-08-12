# 14 완료 작업 로그

- 업로드 전 파일명에서 CDP, NCDP, ADMET category를 감지하고, native confirmation에서 확인한 경우에만 업로드한다.
- category를 감지할 수 없는 파일은 업로드하지 않고 파일명에 category를 포함하도록 안내한다.
- 확정된 category는 서버에 저장되어 첨부 목록 pill 및 Shortlisting material flag에 같은 값으로 반영된다.
- Topic 없는 정성 Team Review 의견은 작성자 본인 또는 관리자만 삭제할 수 있다.
- 검증: `python -m py_compile main.py`, `node --check src/detail.js`, partner-material category 단위 확인을 통과했다.
