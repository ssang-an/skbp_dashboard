# SKBP Pipeline Dashboard

GPT로 조사한 PreC pipeline shortlisting JSON을 로컬 파일로 저장하고, FastAPI 웹 대시보드에서 한눈에 보는 프로젝트입니다.

## Install

Git clone 직후에는 `.venv`가 없으므로 서버 PC에서 한 번 생성합니다.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Run

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

바로 열기:

```text
http://127.0.0.1:8000
```

브라우저에서 엽니다.

```text
http://localhost:8000
```

## 사내망에서 여러 PC가 함께 접속

이 프로젝트는 저장 API를 FastAPI가 제공하므로 Bun 정적 서버가 아니라, Bun이 Uvicorn을
사내망 모드로 실행합니다. 서버 PC에서 다음 명령을 실행합니다.

1. Bun이 없다면 공식 Windows 설치 스크립트로 한 번 설치하고 터미널을 다시 엽니다.

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

2. 프로젝트 폴더에서 공유 서버를 실행합니다.

```powershell
bun run company
```

기본 포트는 `8011`이며 서버 PC와 같은 사내망의 다른 PC에서는 아래처럼 접속합니다.
실행 직후 터미널에 현재 서버 PC의 `Company:` 주소가 자동으로 표시됩니다.

```text
http://SERVER_PC_IP:8011
```

예를 들어 실행 화면에 `Company: http://192.168.10.25:8011`이 표시되면 다른 PC에서
그 주소를 그대로 엽니다.

```text
http://192.168.10.25:8011
```

다른 포트를 사용하려면 실행 전에 `PORT`를 지정합니다.

```powershell
$env:PORT = "8011"
bun run company
```

주의:

- 서버 터미널을 닫으면 대시보드도 종료됩니다.
- Windows 방화벽에서 TCP 8011 인바운드를 같은 로컬 서브넷에 허용해야 합니다.

## 업로드 문서 문자 추출과 Filter 3 판정

PDF/PPTX 업로드 시 아래 순서로 처리합니다.

1. PDF는 PyMuPDF, PPTX는 `python-pptx`로 네이티브 텍스트를 우선 추출합니다.
2. PPT/PPTX 미리보기 PDF는 LibreOffice가 설치된 환경에서 생성합니다.
3. PDF 네이티브 텍스트 품질이 부족할 때만 기존 OpenRouter 키로 무료
   `cloudflare-ai` file parser를 호출합니다.
4. 추출 텍스트와 page/slide 근거를 기존 `OPENROUTER_MODEL`의 DeepSeek에 전달해
   Filter 3 사실을 `true / false / unknown`으로 판정합니다.
5. Python 규칙이 구조화 판정으로 OI Partnership을 계산합니다. 사람이 수정한 값은
   자동 갱신으로 덮어쓰지 않습니다.

`.env` 운영 설정:

```dotenv
ENABLE_PDF_PARSER_FALLBACK=true
PDF_PARSER_ENGINE=cloudflare-ai
PDF_TEXT_MIN_CHARACTERS=50
ENABLE_PAID_OCR=false
```

`ENABLE_PAID_OCR=true`는 네이티브 추출과 Cloudflare parser가 모두 부족할 때 유료
`mistral-ocr` 폴백을 허용합니다. 별도의 OCR/LLM API 키는 사용하지 않습니다.
- 로그인 기능은 아직 없으므로 회사 내부의 신뢰된 네트워크에서만 사용합니다.
- 여러 사용자의 변경은 같은 `json/pipeline-records.json`에 누적됩니다.

## Where To Put Data

실제 대시보드가 읽고 쓰는 파일은 아래입니다.

```text
json/pipeline-records.json
```

이 파일을 단일 원본(single source of truth)으로 봅니다. Obsidian용 Markdown은 이 JSON에서 생성되는 산출물입니다.

사용 방법은 두 가지입니다.

1. 웹 대시보드 하단의 `JSON 붙여넣기 저장` 영역에 GPT가 만든 JSON을 붙여넣고 저장합니다.
2. 직접 파일을 수정하려면 `json/pipeline-records.json`에 분석 JSON object들을 배열 형태로 넣습니다.

국가 정보는 `json_summary.company_country`에 넣으면 대시보드의 국가별 후보군 차트와 국가 필터에 반영됩니다.

예시:

```json
[
  {
    "meta": {},
    "json_summary": {},
    "structured_table": {},
    "scoring": {}
  }
]
```

참고 파일:

- `json/drug-valuation.schema.json`: JSON Schema
- `json/rubric.v3.json`: scoring rubric 기준
- `json/schema.md`: 구조와 평가 기준 설명

## Dashboard Features

- 전체 약물/파이프라인 테이블
- 10줄 단위 테이블 페이지
- 검색, 개발 단계 필터, Theme 필터, Hard Filter 필터
- 컬럼 정렬
- Target Relevance 점수 분포
- Theme 분포
- Hard Filter PASS 비율
- 웹에서 JSON 붙여넣기 후 `json/pipeline-records.json`에 로컬 저장

## Obsidian Export

Obsidian용 Markdown은 아래 폴더에 생성됩니다.

```text
obsidian/
```

생성 명령:

```powershell
.\.venv\Scripts\python.exe .\scripts\export_obsidian.py
```

생성 구조:

```text
obsidian/
├── Pipeline_Index.md
├── Assets/
├── Companies/
├── Themes/
└── Clusters/
```

원칙:

1. `json/pipeline-records.json`을 먼저 수정합니다.
2. `scripts/export_obsidian.py`를 실행합니다.
3. Obsidian에서는 `obsidian/Pipeline_Index.md`부터 열면 전체 링크를 따라갈 수 있습니다.

## Pipeline Wiki Layer

The advanced Obsidian-ready wiki vault is generated in:

```text
skbp_pipeline_wiki/
```

Generate it from the JSON source of truth:

```powershell
.\.venv\Scripts\python.exe .\scripts\export_pipeline_wiki.py
```

The exporter creates:

- raw report archive in `01_Raw_Reports/`
- entity notes for assets, companies, targets, MoA, modalities, indications, competitors, evidence sources, scorecards, themes, and clusters
- folder-level `CLAUDE.md` rules
- scoring criteria docs in `00_System/`
- dashboard notes in `12_Dashboards/`
- graph exports in `13_Graph_Exports/nodes.csv`, `edges.csv`, and `graph.json`

FastAPI endpoints:

```text
POST /api/wiki/export
POST /api/markdown/export
GET  /wiki/README.md
```

## Git Deploy

GitHub에 올린 뒤 Render, Railway, Fly.io 같은 Python web service에서 실행할 수 있습니다.

### 1. GitHub Push

```powershell
git add .
git commit -m "Initial SKBP pipeline dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_ID/YOUR_REPO.git
git push -u origin main
```

이미 remote가 있다면 `git remote add origin ...` 대신 아래처럼 확인합니다.

```powershell
git remote -v
git push
```

### 2. Render Deploy

이 repo에는 `render.yaml`이 포함되어 있습니다.

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Render에서 `New > Blueprint` 또는 `New > Web Service`로 GitHub repo를 연결하면 됩니다.

주의: 현재 데이터는 로컬 JSON 파일(`json/pipeline-records.json`)에 저장됩니다. Render free 서버의 파일 저장소는 영구 DB가 아니므로, 여러 사람이 계속 데이터를 저장해야 하면 다음 단계에서 SQLite/Postgres로 바꾸는 것이 좋습니다.
