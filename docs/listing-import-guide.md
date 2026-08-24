# Tab 0 Listing 가져오기 운영 가이드

> 적용 범위: Tab 0의 Excel/표 붙여넣기 → `가져오기`.
> 이 기능은 **Listing 운영 정보**를 등록·보완하는 기능입니다. Fast Triage와 Full Scout의 공식 조사값·점수·GPT 원문을 Listing 값으로 변경하지 않습니다.

## 1. 가져오기 전에 알아둘 점

### 필수 입력과 인식 방식

| 구분 | 규칙 |
| --- | --- |
| 필수 열 | Company: `Company`, `Company Name`, `Organization` 등 / Asset: `Asset`, `Asset Name`, `Pipeline`, `Pipeline Code`, `Drug`, `Drug Name` 등 |
| 보조 Listing 정보 | Country, Modality, Target, Main indication, Stage, Website |
| 운영 메모 | `Comment`, `Priority`, `Reason for Priority`, `Next Step` 등 Comment 성격 열은 줄바꿈으로 누적 |
| Contact | `Meeting History`, `Contact History` 등은 Contact History로 누적 |
| Website | `https://`, `http://`, `www.`, 또는 일반 도메인 형식만 활성 링크로 저장. 표시명만 있는 Excel 하이퍼링크는 일반 붙여넣기에서 URL을 읽을 수 없음 |
| 원문 보존 | 붙여넣은 상세 문구는 Listing 원문으로 보존. Dashboard/Filter의 Canonical 표기는 별도 규칙으로 변환될 수 있음 |

빈 Comment·Contact·Website 셀은 기존 값을 지우지 않습니다. Contact에 `O`, 날짜, 담당자·이메일·미팅 내용 또는 별도 상세 문구가 있으면 Contact History가 있는 것으로 처리합니다. 명시적 `X`, `-`, `–`, `—`만 “기록 없음”으로 처리합니다. 단, Contact 셀이 `X: 사유`처럼 `X` 뒤에 문구를 함께 포함하면 그 문구는 Contact History로 저장하지 않고 Comment에 다음 줄로 누적합니다.

화면의 `Pipeline Stage`는 Asset의 개발 단계(예: Lead Optimization, Phase 1)를 뜻합니다. `Listing`, `Fast Triage`, `Full Scout`, `Shortlisting`은 개발 단계가 아니라 별도의 `조사 진행 단계`입니다. Excel 열 이름은 기존 호환성을 위해 `Stage`도 계속 인식합니다.

`Others`는 원문 값이 확인되었지만 해당 필드의 Canonical Library에 아직 없는 경우의 분류값입니다. 원문은 계속 보존되어 검색·상세 확인에 사용할 수 있습니다. `Unknown`은 원문에도 판단 근거가 없거나 미공개인 경우에만 사용합니다.

Main indication은 Tab 0~3 Pipeline Table에서 하나의 Canonical 대표값으로 표시합니다. Excel·조사 원문(`indication`)은 보존되며, 해당 셀에 마우스를 올리면 그대로 확인할 수 있습니다. 여러 적응증은 필터·검색에서 계속 인식되지만 테이블의 기본 표기에는 나열하지 않습니다. Library에 아직 없는 확인된 원문만 예외적으로 기본 표기에 남기며, 원문이 없는 경우에만 `Unknown`을 표시합니다.

### Modality Canonical Library

Modality의 원문은 `modality_source`에 보존하고, Pipeline Table·Modality 필터·Summary에는 Canonical 값을 사용합니다. 현재 Library는 `Targeted protein degrader`, `Oncolytic virus`, `Small molecule`, `Peptide`, `RNA therapy`, `Cell therapy`, `Gene therapy`, `Antibody`, `Protein biologic`, `Microbiome therapy`, `Vaccine`, `Radiopharmaceutical`, `Others`, `Unknown`입니다.

- `TPD`, `PROTAC`, `molecular glue degrader`, `SNIPER`, `AUTOTAC`, `LYTAC`은 모두 `Targeted protein degrader`로 표시·집계됩니다. 원문 표현은 hover와 상세 데이터에서 확인할 수 있습니다.
- Antibody-targeted degrader처럼 원문이 복합 포맷을 명시하면 `Antibody`와 `Targeted protein degrader`를 Canonical 태그로 함께 보존하여 두 필터에서 모두 찾을 수 있습니다. `TPD` 같은 원문 자체는 필터 선택지로 저장하지 않습니다.
- `Others`는 확인된 원문이 Library에 없을 때만, `Unknown`은 modality 근거가 없거나 미공개일 때만 사용합니다.

Canonical Library는 반복 비교·집계할 상위 치료 플랫폼만 포함합니다. `PROTAC`, `molecular glue`, `ADC`, `bispecific`, `CAR-T`, `LNP`, `BBB shuttle`, 투여경로, 제형, brain-penetrant, covalent inhibitor 같은 하위 형식·전달기술·특성은 독립 드롭다운 값으로 늘리지 않고 원문·MoA·platform summary에 보존합니다. `Others` 원문은 검색과 hover에서 확인할 수 있으며, 동일한 원문이 서로 다른 3개 이상 Pipeline에서 확인되거나 운영상 별도 집계가 필요할 때만 Canonical 승격을 검토합니다.

## 2. 전체 흐름

1. Excel 표를 붙여넣고 `가져오기`를 누릅니다.
2. 시스템이 Asset·Company를 기준으로 기존 Listing, Fast Triage, Full Scout와 비교합니다.
3. 정확히 같은 항목은 자동 처리합니다.
4. 유사하지만 동일 여부가 확실하지 않은 항목은 **유사 Pipeline 확인** 팝업에서 사용자가 결정합니다.
5. 저장 중에는 대기 모달이 표시되며, 완료 뒤 Tab 0 Pipeline Table과 Summary가 갱신됩니다.

## 3. 자동 처리와 사용자 선택

| 판정 | 예시 | 사용자 선택 | 처리 |
| --- | --- | --- | --- |
| 정확한 동일 Pipeline | `ABL-206` / `ABL206`, 대소문자·공백·하이픈·선행 0만 차이 | 없음 | 기존 Pipeline에 자동 연결 |
| 기존 Listing과 정확히 일치 | 같은 Asset·Company가 Listing queue에 존재 | 없음 | Listing 한 건을 유지하고 보완 규칙 적용 |
| 유사 Pipeline | 같은 회사의 유사 코드, 괄호 안 이전 코드, 의미가 겹치는 descriptive Asset | 필요 | 아래 3가지 중 하나 선택 |
| 무관한 신규 Pipeline | Asset·Company 관계가 확인되지 않음 | 없음 | 새로운 Listing 등록 |
| 입력 불가 | Company/Asset 누락, Asset이 빈 값·`-`·`X` | 없음 | 해당 행을 제외하고 오류 표시 |

### 유사 Pipeline 확인 팝업의 필수 선택

| 선택 | 언제 선택할까 | 결과 |
| --- | --- | --- |
| `같은 Pipeline으로 연결` | 같은 프로그램의 코드 변경·이전 회사명·별칭이라고 확인했을 때 | 하나의 Pipeline으로 관리. Comment·Contact는 누적하고, Listing-only 정보는 보완 규칙 적용 |
| `별도 신규 Pipeline으로 추가` | 동일 성분처럼 보여도 회사·권리·프로그램이 다른 경우 | 기존 항목과 정보 공유 없이 새 Listing 생성 |
| `등록하지 않기` | 중복 행이거나 이번 업로드에서 제외할 때 | 새 행을 저장하지 않으며 기존 항목도 바꾸지 않음 |

`같은 Pipeline으로 연결`을 선택한 뒤, **기존 대상이 Listing-only이고 Asset/Company 표기가 다를 때만** 대표 표기를 추가로 선택합니다.

| 대표 표기 선택 | Tab 0 표에 보이는 Asset·Company |
| --- | --- |
| `기존 대표 표기 유지` | 기존 Listing의 Asset·Company |
| `새 입력값을 대표 표기로 적용` | 이번 Excel의 Asset·Company |

이 대표 표기 선택은 **이름 표시만** 정합니다. Comment·Contact와 Listing 보완 규칙에는 영향을 주지 않습니다.

## 4. 이름·별칭 규칙

### Fast Triage 또는 Full Scout가 이미 있는 경우

| 항목 | 처리 |
| --- | --- |
| 공식 Asset·Company 표시 | Fast Triage보다 Full Scout를 우선하는 공식 조사 표기를 유지 |
| Excel Asset·Company | `meta.pipeline_metadata.asset_aliases` / `company_aliases`에 자동 누적 |
| 별칭 활용 | Tab 0~2 검색, 후속 Excel 가져오기 중복 감지·연결 |
| 공식 조사값·점수·원문 | 변경하지 않음 |

따라서 공식 표기가 `NEOK001` / `NEOK Bio`여도 Excel에 `ABL206` / `ABL Bio`가 들어오면 표의 대표 이름은 공식 표기를 유지하고, `ABL206`, `ABL Bio`로도 검색할 수 있습니다.

### Listing-only끼리 연결하는 경우

기존·신규 Asset/Company 이름은 검색용 별칭 메타데이터로 자동 보존합니다. 대표 이름은 위의 두 선택지 중 하나만 표에 표시됩니다.

별칭은 Filter 드롭다운의 별도 값으로 추가되지는 않습니다. 검색창 및 다음 가져오기 비교에만 사용됩니다.

### 검색용 식별자 정규화와 사용자 판단

Tab 0~3 Pipeline Table 검색과 Tab 4 Knowledge Wiki Map 키워드 검색은 **저장값을 바꾸거나 Pipeline을 연결하지 않는 발견용 기능**입니다. 다음의 표기 차이만 자동으로 같은 검색어로 취급합니다.

| 자동으로 같은 검색어로 보는 규칙 | 예시 |
| --- | --- |
| 앞뒤 공백 제거 및 대소문자 무시 | `meta01` = `META01` |
| Unicode 전각/반각 정규화 | `Ｍｅｔａ０１` = `Meta01` |
| 공백·하이픈·밑줄·슬래시·점·괄호 등 구분 기호 무시 | `Meta-01` = `Meta 01` = `Meta_01` |
| 영문 접두어 뒤 숫자의 선행 0 무시 | `ABL-001` = `ABL1` |
| 저장된 Asset·Company 별칭도 함께 검색 | 공식명 `NEOK001`과 저장 별칭 `ABL206` 모두 검색 가능 |

숫자 순서 변경, 다른 코드·약어의 의미 추정, 같은 Company라는 이유만의 연결, 유사 성분명, 과거 권리/회사 관계는 자동 동치가 아닙니다. 예를 들어 `Anlong-APP`와 `Anlong-KCNT`, `ABC12`와 `ABC21`은 서로 다른 검색어입니다. 이런 후보는 가져오기에서만 **유사 Pipeline 확인** 팝업을 열어 사용자가 연결 여부를 결정합니다. 검색 결과에 노드·행으로 나타나는 것만으로 충분하며, 검색 자체는 데이터 저장·병합·별칭 추가를 수행하지 않습니다.

## 5. Listing 보조정보 보완 규칙

이 규칙은 **Fast Triage/Full Scout가 없는 Listing-only 항목**에만 적용됩니다.

비교 대상 6개 필드:

1. Country
2. Modality
3. Target
4. Main indication
5. Stage
6. Website (유효 URL만 값으로 계산)

| 기존 입력 수 | 신규 입력 수 | 충돌값 처리 | 빈칸 처리 |
| --- | --- | --- | --- |
| 신규가 더 많음 | 예: 기존 4개, 신규 5개 | **신규에 실제 입력된 값만** 기존 값을 갱신 | 신규가 비워 둔 필드는 기존값을 유지 |
| 같음 | 예: 기존 4개, 신규 4개 | 기존값 유지 | 기존의 빈칸만 신규값으로 채움 |
| 신규가 더 적음 | 예: 기존 5개, 신규 3개 | 기존값 유지 | 기존의 빈칸만 신규값으로 채움 |

즉, “더 풍부함”은 **6개 필드의 비어 있지 않은 값 개수가 기존보다 엄격히 많은지**로 판단합니다. 문장이 더 길거나 Stage가 더 고급 단계처럼 보인다는 이유만으로 우선하지 않습니다.

예시:

| 기존 Listing | 신규 Listing | 결과 |
| --- | --- | --- |
| Country, Target, Stage, Website = 4개 | Country, Modality, Target, Main indication, Stage = 5개 | 신규의 Country·Modality·Target·Main indication·Stage 적용, 기존 Website는 유지 |
| Stage=`Preclinical`, 신규 Stage=`Phase 2 planned`, 총 입력 수 동일 | 동일 | 기존 Stage 유지 |
| 기존 Target이 비어 있음, 신규 Target 있음 | 신규 입력 수가 같거나 적음 | 신규 Target만 보완 |

## 6. Comment·Contact·Website 규칙

| 정보 | 같은 Pipeline으로 연결 시 처리 |
| --- | --- |
| Comment | 동일 본문이 아니면 누적. Bulk Excel은 `Team` 작성자로 기록 |
| Contact History | 동일 본문이 아니면 누적 |
| Website | 유효한 신규 URL이 있을 때만 반영. 빈 셀은 기존 URL 유지 |
| Fast Triage만 존재 | Tab 1 상세 Workspace로 동기화 |
| Full Scout 존재 | Tab 2 상세 Workspace로 우선 동기화 |
| Fast Triage와 Full Scout 모두 존재 | Full Scout가 공식 Workspace. Tab 1 운영 메모도 Tab 2로 동기화 |

Comment와 Contact History는 같은 Pipeline으로 **연결한 경우에만** 서로 누적됩니다. `별도 신규 Pipeline으로 추가`와 `등록하지 않기`는 기존 Pipeline으로 어떤 메모도 이동시키지 않습니다.

Contact 열의 `O`, 날짜, 담당자·이메일·미팅 내용은 Contact History가 있음을 뜻하며 Tab 0의 Contact 표식이 활성화됩니다. `O`가 없어도 상세 문구가 있으면 동일하게 Contact History로 기록합니다. `X`, `-`, `–`, `—`만 있는 셀은 **이번 Listing Contact 정보 없음**이라는 명시값으로, Excel에서 온 Contact 요약값만 비웁니다. `X` 뒤에 메모가 있으면 Contact History를 만들지 않고 그 메모를 Comment에 다음 줄로 누적합니다. 이미 Tab 1·2에 사람이 작성한 Contact History 글이나 일반 Comment를 지우거나 다른 분류로 옮기지는 않습니다.

Contact History의 기준 Workspace는 Full Scout가 있으면 Tab 2, 없으면 Tab 1입니다. Tab 0 Excel Contact와 Tab 1 Contact History 글은 기준 Workspace의 Contact History에도 출처와 작성자를 유지한 채 동기화됩니다. Tab 2의 기준 Workspace 글은 Tab 1에 역복제하지 않으며, Tab 1 표와 상세 이동은 Tab 2 기준 화면으로 연결됩니다.

## 7. 공식 조사 결과 보호 원칙

| 기존 Pipeline 상태 | Tab 0 Excel 가져오기 결과 |
| --- | --- |
| Listing만 존재 | 위 Listing 보완 규칙 적용 |
| Fast Triage 완료 | 공식 조사 결과·점수·원문 유지. Listing 운영 정보, Comment, Contact, Website, 검색용 별칭만 반영 |
| Full Scout 완료 | 공식 조사 결과·점수·원문 유지. Listing 운영 정보, Comment, Contact, Website, 검색용 별칭만 반영 |
| Full Scout와 Fast Triage 모두 완료 | Full Scout가 공식 표시·상세페이지 우선. Listing 메모·별칭은 두 기록에 동기화 |

## 8. 운영 권장

- 같은 개발 코드라면 Asset을 가능한 한 일관되게 적습니다.
- 이전 코드·인수 코드가 있으면 `NEOK001 (ABL206)`처럼 함께 적어 두면 검색과 다음 중복 확인에 도움이 됩니다.
- 공동개발사·이전 회사명은 대표 Company를 억지로 통일하지 않아도 됩니다. 같은 Pipeline으로 연결하면 양쪽 이름이 검색용 별칭으로 남습니다.
- 동일 성분이라도 회사·권리·프로그램이 다르면 `별도 신규 Pipeline으로 추가`를 선택합니다.
- Stage의 계획·예정 표현은 현재 단계보다 앞선 단계로 자동 승격하지 않습니다. 조사 원문에는 표현을 남기고, Dashboard 단계는 확인된 현재 상태를 따릅니다.
- `Phase 2 planned` 또는 `Phase 2/3 planned`처럼 계획만 명시된 경우에는 해당 임상 단계로 승격하지 않습니다. 이미 확인된 이전 현재 단계가 있으면 그 단계를 유지하고, 없으면 Dashboard Canonical Stage는 `Unknown`으로 표시합니다. 원문 표현은 Listing 원문으로 유지됩니다.
- `pre-PCC`는 PCC(Preclinical Candidate) 선정 이전을 뜻하므로 Dashboard Canonical Stage에서는 `Lead Optimization`으로 분류합니다. `Listing`은 개발단계가 아니라 Tab 0의 조사 워크플로 상태입니다.
- `PCC`, `PCC completion`, `PCC selected`는 Dashboard Canonical Stage에서 `Preclinical Candidate`로 분류합니다.
- 시작·진행 중인 임상/피보탈/registrational trial인데 phase가 명시되지 않은 경우에는 `Clinical unspecified`으로 분류합니다. `pivotal` 또는 `registrational`이라는 단어만으로 `Phase 3`로 올리지 않습니다.
- 명시적으로 확인된 `discontinued`, `terminated`, `withdrawn`, `inactive`, `dormant`, `abandoned`만 Dashboard Canonical Stage에서 `Discontinued / inactive`로 분류합니다. `suspended`, `halted`는 일시 중단일 수 있으므로 기존에 확인된 Stage는 유지하고, 원문·중단 사유는 운영 메모/Flag에 남깁니다. Fast Triage에서는 영구 비활성이 독립 확인되기 전까지 `active_asset`을 `null`로 둡니다.
- 같은 Company명 또는 Asset의 Company 접두어만 겹치는 경우에는 유사 Pipeline 확인 대상으로 올리지 않습니다. 예: `Anlong-APP`와 `Anlong-KCNT`는 별도 Pipeline입니다.

## 9. 빠른 판단 예시

| 들어온 행 | 기존 항목 | 권장 선택 |
| --- | --- | --- |
| `ABL-206` / `ABL Bio` | `ABL206` / `ABL Bio` | 자동 연결 |
| `NEOK001 (ABL206)` / `NEOK Bio` | `ABL206` / `ABL Bio` | 같은 Pipeline으로 연결 → Listing-only라면 대표 표기 선택 |
| `Meloxicam` / `Company A` | `Meloxicam` / `Company B` | 별도 신규 Pipeline으로 추가 |
| 이미 올린 같은 행 | 같은 Asset·Company | 자동 연결 또는 등록하지 않기 |
| 검증되지 않은 유사 명칭 | 유사하지만 회사·코드 관계 불명 | 별도 신규 Pipeline으로 추가 또는 등록하지 않기 |

## 10. 데이터 보호 요약

- Listing 가져오기는 GPT 원문, 근거, 점수, Fast Triage/Full Scout 공식 필드를 덮어쓰지 않습니다.
- 사용자 판단이 필요한 유사 항목은 저장 전에 팝업에서 반드시 결정합니다.
- 모든 별칭·Comment·Contact·운영 메타데이터는 연구 근거나 GPT 원문에 섞이지 않습니다.
- 가져오기 취소 또는 팝업 닫기 전에는 어떤 데이터도 저장되지 않습니다.
