# 73. Tab 0 정규화 표시와 다중 Indication 확장

## 목표

Tab 0 진척 현황 표의 Company·Country·Asset·Modality·Target·Main indication·Stage를 Tab 1·2와 같은 Dashboard 표시 규칙으로 통일한다.

## 작업 범위

1. Country는 Tab 1·2와 같은 canonical country 및 국기·국가 코드 표시를 사용한다.
2. Modality와 Stage는 canonical dashboard 값으로 표시한다.
3. Main indication은 canonical indication library의 전체 확인 목록을 순서대로 표시한다.
4. 원문이 canonical 표시와 다른 경우 tooltip에서 원문을 보존한다.
5. Tab 0 Excel export도 같은 canonical 표시값을 내보낸다.

## NeuShen 확인

- 저장 원문: `Focal onset seizure; major depressive disorder; pain`
- Dashboard 표시: `Epilepsy / seizure disorders, Major depressive disorder, Pain`
- 전체 Stage: 확인된 가장 높은 활성 단계인 `Phase 2` (FOS)로 표시한다. MDD·Pain의 indication-specific 세부 단계는 tooltip 원문에 보존한다.

## 완료 기준

- Tab 0에서 다중 indication이 단일 `Unknown` 또는 첫 적응증만으로 축약되지 않는다.
- Country/Modality/Stage는 Tab 1·2와 동일한 canonical vocabulary를 사용한다.
