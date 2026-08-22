# 96. Tab 0 Summary Dashboard 접기·펼치기 통일

## 목표

Tab 0의 별도 후보 목록 관리 안내 문구를 제거하고, `Summary Dashboard`를 Tab 1·2·3와 같은 클릭형 접기·펼치기 헤더로 통일한다.

## 범위

1. 후보 목록 관리 안내 행을 제거한다.
2. Summary Dashboard 헤더에 접기·펼치기 상태와 화살표를 표시한다.
3. 진척 현황 카드만 접고 펼친다. 필터·테이블은 영향을 받지 않는다.
4. 접힘 상태를 브라우저별 localStorage에 저장한다.

## 완료 기준

- Summary Dashboard를 누르면 진척 현황 카드가 숨겨지고 다시 누르면 표시된다.
- Tab 1·2·3의 Summary Dashboard와 동일한 버튼·aria-expanded·화살표 패턴을 사용한다.
