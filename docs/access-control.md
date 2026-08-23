# 역할 및 접근 권한

대시보드 내부 권한은 `user < admin < developer` 순서로 상속됩니다. `developer`는 모든 관리자 권한을 포함합니다. 이 문서는 애플리케이션 역할 기준이며, Git 저장소·서버 운영체제 권한과는 별도입니다.

| 기능 | 사용자 (user) | 관리자 (admin) | 개발자 (developer) |
| --- | --- | --- | --- |
| Dashboard, GPT 원문리포트, Partner Materials 열람 | 가능 | 가능 | 가능 |
| Comments, Contact History, 정성평가 의견 작성 | 가능 | 가능 | 가능 |
| 본인이 작성한 일반 Comments·Contact History·정성평가 의견 수정/삭제 | 가능 | 가능 | 가능 |
| GPT 원문리포트 Topic 메모 추가·수정·삭제 | 불가 | 본인 작성 메모만 가능 | 본인 작성 메모만 가능 |
| Partner Materials 및 DD Report 업로드·삭제 | 불가 | 가능 | 가능 |
| Tab 0 Listing 입력/수정, Pipeline 업로드·삭제, 점수·Filter·구조화 정보 수동 수정, Rubric/재평가 | 불가 | 가능 | 가능 |
| 사용자 관리 페이지, 계정 활성화/비활성화, 역할 변경, 비밀번호 재설정 | 불가 | 불가 | 가능 |

## 적용 원칙

- 읽기와 팀 협업 의견 작성은 로그인 사용자에게 열어 둡니다.
- 조사 근거를 바꾸거나 AI 답변의 근거로 사용되는 자료(Partner Materials/DD Report), GPT 원문에 붙는 Topic 메모, Pipeline 공식 데이터 변경은 관리자 이상으로 제한합니다.
- 화면에서 버튼을 숨기는 것과 별도로, 해당 저장 API도 같은 권한을 서버에서 확인합니다.
- 초기 관리자·개발자 자동 배정은 `main.py`의 승인된 이름과 `@sk.com`/`@skbp.com` 이메일이 모두 일치할 때만 이루어집니다. 이후 역할 변경은 개발자 전용 사용자 관리 화면에서 수행합니다.
