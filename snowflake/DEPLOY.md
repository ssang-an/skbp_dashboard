# SKBP 대시보드 SPCS 배포 가이드

대상 계정: `RSB26080` · 역할: `FR_BETA_TESTER` · 위치: `BETA_TEST_DB.DEV`

| 이름 | 값 |
|---|---|
| 이미지 저장소 | `skbp-datalake.registry.snowflakecomputing.com/beta_test_db/dev/skbp_repo` |
| 이미지 | `skbp-dashboard:v1` |
| 서비스 | `BETA_TEST_DB.DEV.SKBP_DASHBOARD` |
| Compute pool | `SKBP_POOL` (관리자 생성, CPU_X64_XS 1대) |
| 영구 디스크 | block volume `app-state` 10Gi → 컨테이너 `/app-state` |

## 0. 구조 요약 (무엇이 바뀌었나)

- 기존 Python / HTML / JS / Dockerfile / .dockerignore 는 **수정하지 않았습니다.**
- 추가 파일: `Dockerfile.spcs`, `Dockerfile.spcs.dockerignore`, `spcs/bootstrap.py`, `spcs/docker-entrypoint.sh`, `snowflake/*`
- 컨테이너가 시작될 때 `spcs/bootstrap.py` 가
  1. 이미지의 **코드**를 영구 디스크의 `/app-state/app` 으로 맞추고 (매 배포마다 최신 코드 반영)
  2. **데이터**는 최초 1회만 복사합니다. 완료 표시(`/app-state/.seed_complete.json`)는 모두 복사된 뒤에만 기록되고,
     중간 실패 시 다음 시작에서 처음부터 다시 시도합니다. 이후 배포에서는 기존 데이터를 **절대 덮어쓰지 않습니다.**
  3. 앱은 `/app-state/app` 에서 기존과 동일하게 `uvicorn main:app` (worker 1개) 으로 실행됩니다.
- 영구 저장 대상 (앱이 실제로 쓰는 경로 전부):
  `json/pipeline-records.json`, `json/candidate-queue.json`, `json/shortlisting-projects.json`,
  `data/` (users.json, chat-history.sqlite3), `attachments/`, `skbp_pipeline_wiki/`, `obsidian/`,
  `config/instruction_warnings.json`
- 비밀값(`OPENROUTER_API_KEY`, `SMTP_USERNAME`, `SMTP_PASSWORD`)은 Snowflake Secret 으로만 주입됩니다.
  `.env` 는 `Dockerfile.spcs.dockerignore` 로 이미지에서 제외됩니다.
- 주의: 최초 데이터(users.json 포함)는 **이미지를 빌드하는 시점의 회사 PC 폴더 내용**입니다.
  사내 서버에서 최신 데이터를 받은 직후에 빌드하세요. users.json(사용자 계정 정보)은 이미지에 포함되어
  Snowflake 이미지 저장소(계정 내부, 암호화)에 보관됩니다.

## 1. 관리자에게 요청 (1회)

아래 문안과 `snowflake/02_admin_request.sql` 을 함께 전달하세요.

> 안녕하세요. 사내에서 쓰던 SKBP 파이프라인 대시보드(FastAPI)를 Snowflake Snowpark Container Services 로 이전하려고 합니다.
> 계정 RSB26080 에서 역할 FR_BETA_TESTER 로 운영하며, 객체는 BETA_TEST_DB.DEV 에 있습니다.
> 첨부한 02_admin_request.sql 실행을 부탁드립니다. 요청 내용은 다음 세 가지입니다.
> 1. 전용 compute pool SKBP_POOL (CPU_X64_XS, 노드 1대, 1시간 미사용 시 자동 중지) 생성과 USAGE/MONITOR/OPERATE 권한
> 2. BIND SERVICE ENDPOINT 권한 (Snowflake 로그인 사용자만 접근 가능한 HTTPS 주소 생성용)
> 3. 외부 접속 통합 SKBP_EAI: 네트워크 규칙 BETA_TEST_DB.DEV.SKBP_EGRESS_RULE 에 등록된 호스트
>    (openrouter.ai:443 — LLM API, 비밀번호 재설정 메일용 SMTP 서버)로만 나가도록 제한
> 예상 비용은 상시 가동 시 하루 약 1.4 크레딧이며, 미사용 시간에는 중지할 예정입니다.
> 추가로, 비용 확인을 위해 가끔 SNOWPARK_CONTAINER_SERVICES_HISTORY 조회(04_operations.sql 의 cost 부분)를 부탁드릴 수 있습니다.

## 2. 비밀값 등록 (본인이 직접, 1회)

1. Snowsight 왼쪽 메뉴 **Projects » Workspaces** 에서 `skbp_dashboard_zip_ready/snowflake/01b_secrets.sql` 을 엽니다.
2. 회사 PC에서 프로젝트 폴더의 `.env` 를 메모장으로 엽니다.
3. SQL 의 `<paste ... here>` 자리에 `.env` 의 값을 붙여넣습니다. (채팅에는 붙여넣지 마세요)
4. SMTP를 쓰면 마지막 `ALTER NETWORK RULE` 줄의 `<SMTP_HOST>:<SMTP_PORT>` 를 `.env` 값으로 바꿉니다. 안 쓰면 그 줄은 지웁니다.
5. 오른쪽 위 역할이 `FR_BETA_TESTER` 인지 확인하고 **Run All** (Ctrl+Shift+Enter) 로 실행합니다.
6. 실행 후 **편집기에서 값을 지우고 저장**하세요. (워크시트에 비밀값이 남지 않도록)
7. 이어서 `snowflake/spec.yaml` 의 `<same value as .env ...>` 항목도 `.env` 의 값으로 바꿔 저장합니다.
   (비밀이 아닌 설정: OPENROUTER_MODEL, SMTP_HOST, SMTP_PORT, SMTP_FROM_EMAIL, SMTP_STARTTLS, SMTP_USE_SSL, ACTION_DATE_REMINDERS_ENABLED)

## 3. 이미지 빌드와 업로드 (회사 PC)

### 3-1. 새 파일을 회사 PC 프로젝트 폴더로 가져오기
Workspace 에서 아래 파일을 각각 우클릭 » **Download** 해서 회사 PC 의
`D:\Storage from C\0 Open Innovation Team\AI 챔피언\AX\code\git\skbp_dashboard` 아래 같은 위치에 둡니다.

| Workspace 파일 | 회사 PC 위치 |
|---|---|
| `skbp_dashboard_zip_ready/Dockerfile.spcs` | `skbp_dashboard\Dockerfile.spcs` |
| `skbp_dashboard_zip_ready/Dockerfile.spcs.dockerignore` | `skbp_dashboard\Dockerfile.spcs.dockerignore` |
| `skbp_dashboard_zip_ready/spcs/bootstrap.py` | `skbp_dashboard\spcs\bootstrap.py` (spcs 폴더 새로 만들기) |
| `skbp_dashboard_zip_ready/spcs/docker-entrypoint.sh` | `skbp_dashboard\spcs\docker-entrypoint.sh` |
| `skbp_dashboard_zip_ready/llm_client.py` (새 파일, Cortex 연결) | `skbp_dashboard\llm_client.py` |
| `skbp_dashboard_zip_ready/main.py` (수정됨) | `skbp_dashboard\main.py` (덮어쓰기) |
| `skbp_dashboard_zip_ready/document_pipeline.py` (수정됨) | `skbp_dashboard\document_pipeline.py` (덮어쓰기) |
| `skbp_dashboard_zip_ready/tests/test_llm_client.py` (새 테스트) | `skbp_dashboard\tests\test_llm_client.py` |

`main.py`·`document_pipeline.py`는 회사 PC의 git 저장소 파일을 덮어쓰므로, 덮어쓴 뒤 `git diff`로 변경 범위를 확인하고
commit/push 해 두면 집 PC와 코드가 맞춰집니다. `LLM_PROVIDER`를 지정하지 않으면(집 PC) 기존 OpenRouter 동작 그대로입니다.

### 3-2. Docker 로그인용 토큰 만들기 (1회)
1. Snowsight 왼쪽 아래 이름 » **Settings » Authentication » Programmatic access tokens » Generate new token**
2. 이름 `skbp-docker`, 역할 `FR_BETA_TESTER`, 만료 기간 선택 → 생성된 토큰을 **바로 복사**해 둡니다(다시 볼 수 없음).

### 3-3. PowerShell 에서 실행
Docker Desktop 을 켠 뒤, PowerShell 에서 한 줄씩 실행합니다.

```powershell
cd "D:\Storage from C\0 Open Innovation Team\AI 챔피언\AX\code\git\skbp_dashboard"

docker login skbp-datalake.registry.snowflakecomputing.com -u joowon.jung@skbp.com
# Password: 에 3-2 토큰을 붙여넣고 Enter (화면에 안 보이는 게 정상)  → "Login Succeeded"

docker build --platform linux/amd64 -f Dockerfile.spcs -t skbp-dashboard:v1 .

docker tag skbp-dashboard:v1 skbp-datalake.registry.snowflakecomputing.com/beta_test_db/dev/skbp_repo/skbp-dashboard:v1
docker push skbp-datalake.registry.snowflakecomputing.com/beta_test_db/dev/skbp_repo/skbp-dashboard:v1
```

빌드 결과에 `.env` 가 들어가지 않았는지 확인 (아무것도 안 나오면 정상):
```powershell
docker run --rm --entrypoint sh skbp-dashboard:v1 -c "ls -a /opt/skbp/image | grep -E '^\.env$' ; true"
```

push 가 끝나면 CoCo 에게 "push 끝났어" 라고 알려주세요.

## 4. 서비스 생성 (CoCo 가 실행)

`snowflake/03_create_service.sql` — 관리자 승인과 2·3 단계가 끝나면 CoCo 가 실행합니다.
첫 시작 때 데이터 복사가 일어나므로 READY 까지 몇 분 걸릴 수 있습니다.
`SHOW ENDPOINTS` 의 `ingress_url` 이 대시보드 주소입니다. 이 주소를 `spec.yaml` 의 `APP_BASE_URL`, `OPENROUTER_SITE_URL` 에 넣고
6장의 업데이트 절차로 반영합니다(비밀번호 재설정 메일 링크용).

접속: 브라우저에서 `https://<ingress_url>` → Snowflake 로그인 → 기존 앱 로그인.
다른 사람에게 열어주기: `GRANT SERVICE ROLE BETA_TEST_DB.DEV.SKBP_DASHBOARD!ALL_ENDPOINTS_USAGE TO ROLE <팀 역할>;`

## 5. 배포 후 확인 항목

| 항목 | 확인 방법 |
|---|---|
| 로그인 | 기존 계정으로 로그인, `/api/auth/me` 정상 |
| 레코드 조회 | 대시보드 목록·상세 화면, 건수가 이전과 동일 |
| 저장·수정 | 레코드 하나 수정 후 새로고침해도 유지 |
| 첨부파일 | 기존 PDF 열기, 새 파일 업로드, PPT → PDF 미리보기(LibreOffice) |
| 위키 export | 위키 export 실행 후 Wiki 화면 갱신 |
| AI 채팅·스트리밍 | 채팅 답변이 글자 단위로 흘러나오는지 |
| 영속성 1 | 테스트 수정 → `SUSPEND` → `RESUME` 후 유지 |
| 영속성 2 | 테스트 수정 → 이미지 v2 로 업데이트 후 유지 |

## 6. 업데이트 (서비스 삭제 없이)

1. 코드 수정 후 회사 PC 에서 **새 태그**로 빌드·push (v2, v3 …):
   ```powershell
   docker build --platform linux/amd64 -f Dockerfile.spcs -t skbp-dashboard:v2 .
   docker tag skbp-dashboard:v2 skbp-datalake.registry.snowflakecomputing.com/beta_test_db/dev/skbp_repo/skbp-dashboard:v2
   docker push skbp-datalake.registry.snowflakecomputing.com/beta_test_db/dev/skbp_repo/skbp-dashboard:v2
   ```
2. `snowflake/spec.yaml` 에서 `image: ...:v1` → `:v2`, `SKBP_IMAGE_TAG: "v2"` 로 바꿔 저장
3. 백업 → 반영 (`04_operations.sql` 의 backup / update 부분):
   `CREATE SNAPSHOT ...` → `COPY FILES INTO @SKBP_SPECS ...` → `ALTER SERVICE SKBP_DASHBOARD FROM @SKBP_SPECS SPECIFICATION_FILE='spec.yaml';`
4. 문제 시 롤백: spec.yaml 의 태그를 이전 값으로 되돌리고 3의 마지막 두 문장을 다시 실행.

코드만 바뀌고 데이터(레코드, 사용자, 첨부, 위키)는 그대로 유지됩니다.
새 이미지에 들어 있는 data/json 내용은 무시됩니다(최초 1회만 사용).

## 7. 백업과 복구

- 백업: `CREATE SNAPSHOT SKBP_BACKUP_YYYYMMDD FROM SERVICE SKBP_DASHBOARD VOLUME "app-state" INSTANCE 0;`
  업데이트 전에는 항상, 평소에는 주 1회 권장. 필요 없는 오래된 스냅샷은 `DROP SNAPSHOT` 으로 정리.
- 복구: `ALTER SERVICE SKBP_DASHBOARD SUSPEND;` → `ALTER SERVICE SKBP_DASHBOARD RESTORE VOLUME "app-state" INSTANCES 0 FROM SNAPSHOT <이름>;`
- **절대 사용 금지** (영구 디스크가 삭제됨):
  `DROP SERVICE SKBP_DASHBOARD FORCE`, `ALTER COMPUTE POOL SKBP_POOL STOP ALL`

## 8. 비용과 중지

- Compute: CPU_X64_XS 노드 1대. Snowflake Service Consumption Table 기준 시간당 약 0.06 크레딧
  → 상시 가동 시 하루 약 1.4, 한 달 약 43 크레딧. 정확한 단가와 크레딧 가격은 계약에 따라 다르니 관리자 확인 필요.
- 저장: block volume 10Gi + 스냅샷 → 클라우드 디스크 수준의 소액 저장 요금. 서비스를 중지해도 계속 부과.
- 이미지 저장소: 이미지 크기만큼 일반 스토리지 요금.
- 외부 호출: OpenRouter 사용료는 별도(OpenRouter 계정 청구).

중지 (데이터 유지):
```sql
ALTER SERVICE BETA_TEST_DB.DEV.SKBP_DASHBOARD SUSPEND;
ALTER COMPUTE POOL SKBP_POOL SUSPEND;   -- 노드까지 중지해야 compute 과금이 멈춤
```
재개:
```sql
ALTER COMPUTE POOL SKBP_POOL RESUME;
ALTER SERVICE BETA_TEST_DB.DEV.SKBP_DASHBOARD RESUME;
```
