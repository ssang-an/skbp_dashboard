# 15. ADMET canonical 25 매핑과 회귀 테스트

## 목표

ADMET standard 25-study canonical mapping을 명시하고 format variation·부정 상태·optional study·source separation 회귀를 테스트한다.

## 작업

- 25 standard study aliases를 설정으로 명시하고 study 이름을 canonical key로 정규화한다.
- table/multiline parsing을 canonical key에만 매핑하며 optional/additional study를 별도 보존한다.
- Case A~G 회귀 test를 추가한다.

## 완료 기준

- numerator는 unique canonical standard study 완료 수이고 항상 0~25다.
- ADMET 변경이 In vivo/In vitro 값을 변경하지 않음을 테스트한다.
