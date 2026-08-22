# 64. Shortlisting 우선·보류 상태 별표 작업 로그

- 기존 `is_tracked: true` 레코드는 `priority`로 해석해 이전 노란색 표시와 호환했다.
- `stationary`는 `is_tracked: true`를 유지하므로 Tab 3 Shortlisting 목록에서 제외되지 않는다.
- 제거 시 `tracking_status`를 비워 다음 재등록은 우선 검토 상태부터 시작한다.
