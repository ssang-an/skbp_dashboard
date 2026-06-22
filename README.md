# SKBP Pipeline Dashboard

GPT로 조사한 PreC pipeline shortlisting JSON을 로컬 파일로 저장하고, FastAPI 웹 대시보드에서 한눈에 보는 프로젝트입니다.

## Install

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run

```powershell
uvicorn main:app --reload --port 8000
```

브라우저에서 엽니다.

```text
http://localhost:8000
```

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
