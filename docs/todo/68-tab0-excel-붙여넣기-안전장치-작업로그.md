# 68. Tab 0 Excel 붙여넣기 안전장치 작업 로그

- 열 제목 인식 별칭은 Company/회사, Country/국가, Asset/자산·파이프라인, Modality/모달리티, Target/타깃·표적, Indication/적응증, Stage/개발 단계, Comment/코멘트·비고·의견, Contact/담당자·연락처를 포함한다.
- 전체 행이 완전히 비어 있는 중간 행도 붙여넣기 행 수에 포함한다. 마지막 줄바꿈은 Excel clipboard의 종결자로 처리한다.
- 큰따옴표 없이 임의 텍스트에 넣은 줄바꿈은 실제 행 경계와 구분할 수 없으므로, Excel 직접 복사 또는 셀 직접 입력이 안전하다.
