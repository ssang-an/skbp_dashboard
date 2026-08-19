# 08. Shortlisting 자료 분류와 Filter 3 정비

## 완료 내용

- 공용 `partner_material_category()`가 filename에서 CDP/NCDP/ADMET를 분류한다. attachment metadata와 focus-management flags가 같은 분류값을 사용한다.
- ADMET parser도 filename substring 대신 이 공용 분류값을 사용한다.
- 파일 업로드 시 Full Scout focus-management의 해당 material flag를 자동 활성화하고 Filter 3 재분류를 대기 상태로 전환한다.
- Filter 3 criteria v1.4에서 IND-enabling, IND filed/cleared, Phase 1 이상을 investment stage로 일관되게 판정한다. Value Up은 `Hit Discovery`·`Lead Optimization`·`Preclinical Candidate`·`Preclinical unspecified`의 확인된 IND-enabling 미만 소분자에만 적용하며 ADMET 파일 업로드 및 숫자 점수가 필요하다.
- 판단 근거와 evidence source 표기는 구조화된 Dashboard 값, Full Scout, Partner Materials를 명확히 구분한다.
- 공동연구는 모든 modality에 적용하고 Platform Attractiveness 3일 때 투자 또는 Value Up과 겹쳐도 공동연구를 우선한다.
- ADMET은 업로드 자료의 canonical Study–Status 행만 사용해 완료 Study 수를 `n / 25`로 표시한다. `Y`·`Complete(d)`·`완료` 계열은 완료로 세고, 부정/예정 상태는 우선 제외하며 Dog Telemetry 등 추가 시험은 점수에 포함하지 않는다. 문서 모델의 비어 있거나 오래된 점수는 이 표 기반 결과를 덮어쓰지 못한다.

## 검증

- CDP/NCDP/ADMET filename 경계와 Filter 3 stage boundary를 Python assertion으로 확인했다.
