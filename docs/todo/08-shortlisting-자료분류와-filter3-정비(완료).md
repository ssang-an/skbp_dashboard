# 08. Shortlisting 자료 분류와 Filter 3 정비

## 완료 내용

- 공용 `partner_material_category()`가 filename에서 CDP/NCDP/ADMET를 분류한다. attachment metadata와 focus-management flags가 같은 분류값을 사용한다.
- ADMET parser도 filename substring 대신 이 공용 분류값을 사용한다.
- 파일 업로드 시 Full Scout focus-management의 해당 material flag를 자동 활성화하고 Filter 3 재분류를 대기 상태로 전환한다.
- Filter 3 criteria v1.1에서 IND-enabling, IND filed/cleared, Phase 1 이상을 investment stage로 일관되게 판정한다. 전임상 이전 단계는 Value Up 자동 기준으로 승격하지 않는다.

## 검증

- CDP/NCDP/ADMET filename 경계와 Filter 3 stage boundary를 Python assertion으로 확인했다.
