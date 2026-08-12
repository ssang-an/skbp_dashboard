# 14. Shortlisting 첨부 확인과 topicless 삭제

## 목표

Partner Materials 업로드 전 파일명 category 확인/재선택 UX, material pill 파일 열기, topicless 의견 삭제를 구현한다.

## 작업

- CDP/NCDP/ADMET category 포함 여부를 업로드 전 모달에서 확인한다.
- category가 없으면 저장하지 않고 파일 재선택을 유도한다.
- material pill은 실제 첨부 파일을 열며, topicless Team Review 의견은 작성자 정책에 맞는 삭제 control을 제공한다.

## 완료 기준

- category 없는 파일이 확인 전 저장되지 않는다.
- 첨부와 의견 삭제의 성공/실패 feedback이 있다.
