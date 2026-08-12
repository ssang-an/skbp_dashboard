# 08. Shortlisting 자료 분류와 Filter 3 정비

## 목적

Shortlisting의 Partner Materials 분류·미리보기와 Filter 3의 단계 기준, 근거 문구, Team Review 태그 삭제 UX를 정비한다.

## 작업

- CDP/NCDP/ADMET 파일명 분류 규칙과 파일 업로드 확인 모달을 구현한다. 분류가 누락되면 재업로드 안내를 제공한다.
- Filter 3에서 자료 보유 상태를 pill로 표시하고, 클릭 시 파일을 미리보기/열기 한다.
- OI Partnership 판단 규칙과 rubric/manifest 참조를 조사하여 `IND-enabling 이상 + IND filed/cleared 또는 Phase 1 이상`으로 승인된 기준을 일관되게 반영한다.
- ‘value-up’ stage 범위가 IND-enabling 이전 전임상 전체라는 점을 stage 정렬/비교 로직에 반영한다.
- 근거 문구를 ‘Full Scout 및 Partner Materials 정보 기반, 미확인 값은 추정하지 않음’으로 교정한다.
- Team Workspace의 자유 태그에 명확한 삭제 버튼을 추가한다.
- 경계 stage, 자료 미보유, 분류되지 않은 파일에 대한 검증을 작성한다.

## 완료 기준

- 파일 종류와 Filter 3 판단이 같은 데이터 기준을 사용한다.
- OI/Value-up 결과가 경계 stage에서도 예측 가능하다.
- 사용자가 보유 자료를 열고 태그를 삭제할 수 있다.
- 단일 목적 Git 커밋을 남긴다.
