# SKBP Pipeline Finder — GPT 이미지 생성용 페이지별 프롬프트

목표: PPT를 직접 만들지 않고, 각 페이지를 **16:9 완성 이미지 한 장**으로 생성한다.  
공통 스타일: dark navy executive biotech dashboard, teal / violet / amber accent, high-end enterprise presentation, Korean corporate seminar, clean typography, no real company logos.

## 공통 네거티브 프롬프트

아래 내용은 모든 페이지 생성 프롬프트 끝에 붙인다.

```text
Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 01 — Cover / Big Idea

```text
Create a polished 16:9 corporate keynote cover image for an internal company seminar.

Topic: “SKBP Pipeline Finder” — a biotech PreC pipeline shortlisting intelligence dashboard.

Visual concept:
- Deep navy background with subtle radial glow from the right side.
- Center-right: a futuristic abstract “pipeline intelligence cockpit” — glassmorphism dashboard panels, small bar charts, donut chart, candidate table blocks, evidence network nodes, molecular structure lines.
- Left side must remain clean for title text.
- Premium enterprise look, not cartoon, not overly sci-fi.
- Palette: #050B18 deep navy, #2DD4BF teal, #8BA8FF blue-violet, #FBBF24 amber.

Exact Korean/English text to render clearly:
Top small label: “SKBP Pipeline Finder”
Main title: “PreC Pipeline Shortlisting Dashboard”
Subtitle: “GPT 조사 결과를 JSON 단일 원본으로 모아 후보 비교·근거 검토·Wiki 재사용까지 지원”
Small footer tag: “전사 설명회 · 7분”

Layout:
- Text block on left 55% area.
- Visual cockpit on right 45% area.
- Include four small KPI chips below subtitle: “32 records”, “13/32 PASS·SELECT”, “2.1/3 TR”, “477 graph nodes”.
- Large title should be bold and very readable.

Style keywords: executive biotech, dark mode dashboard, AI evidence graph, molecule network, clean Korean typography, premium internal strategy deck.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 02 — Why We Built It

```text
Create a 16:9 Korean corporate presentation image explaining why the SKBP Pipeline Finder was built.

Visual concept:
- Problem-to-solution composition.
- Left side: scattered unstructured research reports, source links, and score notes floating as abstract document cards.
- Middle: a narrowing transformation bridge labeled with standardization / rubric / JSON.
- Right side: organized dashboard and evidence graph, clean and confident.
- Dark navy background, teal highlights for the solution, amber for the “Need” section, soft red for pain points.

Exact title text:
“왜 만들었나: 후보 검토의 병목을 줄이는 도구”

Three large cards across the middle:
1. Header: “Before”
   Body: “리포트·출처·점수가 흩어져 후보 비교가 느림”
2. Header: “Need”
   Body: “같은 기준으로 빠르게 선별하고 점수 근거를 추적”
3. Header: “After”
   Body: “JSON 기반 대시보드에서 비교·필터·근거 확인”

Bottom takeaway ribbon:
“문서 읽기 중심의 후보 탐색을 데이터 기반 의사결정으로 전환”

Layout:
- Use 3 large rounded cards in a horizontal flow.
- Add arrow or energy flow from Before → Need → After.
- Add subtle icons: document stack, rubric checklist, dashboard grid, evidence network.

Style: dark executive, glass panels, clean Korean typography, biotech intelligence, minimal and high contrast.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 03 — Creation Process / Workflow

```text
Create a 16:9 process infographic image for a Korean internal seminar.

Topic: How SKBP Pipeline Finder is created and operated.

Exact title text:
“제작 과정: GPT 결과를 운영 가능한 파이프라인으로 구조화”

Main visual:
A left-to-right five-step workflow with large numbered modules connected by glowing teal arrows.

Five steps, exact text:
1. “GPT 1 Fast Triage”
   Subtext: “SELECT / REJECT / N/A 1차 선별”
2. “GPT 2 Full Scout”
   Subtext: “v3.1 Rubric 심층 조사”
3. “JSON Schema”
   Subtext: “pipeline-records.json 단일 원본”
4. “Dashboard”
   Subtext: “필터·정렬·차트·상세 검토”
5. “Wiki Export”
   Subtext: “Obsidian Markdown note와 graph 생성”

Bottom principle bar:
“운영 원칙: JSON이 Single Source of Truth, Dashboard와 Wiki는 재생성 가능한 산출물”

Visual elements:
- Step 1: funnel icon.
- Step 2: magnifying glass over molecule.
- Step 3: structured braces / data blocks.
- Step 4: dashboard panels.
- Step 5: connected knowledge graph nodes.
- Use subtle biotech molecule motif in background.

Style: technical schematic + premium dark mode, high readability, clean Korean typography, no unnecessary decoration.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 04 — System Architecture

```text
Create a 16:9 technical architecture infographic image for an executive audience.

Exact title text:
“어떻게 돌아가나: 단순하지만 확장 가능한 구조”

Main architecture diagram:
Five connected blocks arranged left-to-right and one AI block underneath.

Blocks and exact labels:
- “Browser UI”
  Subtext: “index · detail · wiki_view”
- “FastAPI Backend”
  Subtext: “main.py · REST endpoints”
- “JSON Store”
  Subtext: “pipeline-records.json · schema · rubric”
- “Markdown / Wiki Export”
  Subtext: “obsidian/ · skbp_pipeline_wiki/”
- “AI Evidence Agent” placed below JSON/Wiki bridge
  Subtext: “Dashboard JSON + Wiki retrieval”

Add three endpoint callouts near the backend:
“GET /api/records”
“POST /api/wiki/export”
“POST /api/chat/stream”

Visual style:
- Dark blueprint / technical schematic.
- Use glowing connectors, minimal icons, subtle code/data particles.
- The AI Evidence Agent block should visually connect both JSON Store and Wiki Export.
- Use teal for data flow, amber for storage, violet for AI/retrieval.

Audience: non-engineering executives should understand the flow quickly.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 05 — Dashboard Overview

```text
Create a 16:9 full-page generated illustration of the SKBP Pipeline Finder dashboard, not a screenshot.

Exact title text:
“대시보드 한눈에 보기: 후보군을 숫자와 차트로 즉시 파악”

Visual concept:
- A clean abstract dark-mode dashboard UI mockup occupying the left 70% of the image.
- Right 30%: explanatory feature cards.
- The dashboard should look like a biotech candidate shortlisting cockpit, with KPI cards, charts, priority list, filters, and a table.
- Do not copy a real screenshot. Generate a stylized, clean, presentation-ready dashboard illustration.

Dashboard labels to render:
KPI cards: “총 분석 건수 32”, “PASS/SELECT 13/32”, “평균 총점 12.1/21”, “평균 TR 2.1/3”, “국가 수 5”
Chart titles: “Target Relevance”, “Theme 분포”, “국가별 후보군”, “Pipeline Filter”, “Score Profile”, “Priority Watch”
Filter labels: “Stage”, “Theme”, “Cluster”, “Country”, “Indication”

Right feature cards exact text:
- “KPI 요약”
- “분포 차트”
- “Priority Watch”
- “필터·정렬·Excel export”

Style:
- Premium dark mode SaaS dashboard.
- Glassmorphism panels, crisp chart shapes, teal/violet highlights.
- Corporate Korean typography, readable at 16:9.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 06 — Data Snapshot / Insights

```text
Create a 16:9 data-rich infographic image for an internal biotech strategy presentation.

Exact title text:
“현재 데이터: 32개 후보를 5개 관점으로 비교”

Main content:
Show a generated analytics dashboard summary with the following exact figures:
- “32 records”
- “13/32 PASS·SELECT”
- “평균 총점 12.1/21”
- “평균 TR 2.1/3”
- “Graph 477 nodes · 782 edges”

Charts:
1. Theme distribution bar chart:
   - “E/I Balance 17”
   - “Neuroimmune 11”
   - “No Theme 2”
   - “Unknown 2”
2. Country distribution bar chart:
   - “China 14”
   - “United States 8”
   - “Republic of Korea 7”
   - “Europe/UK 2”
   - “Canada 1”
3. Cluster callouts:
   - “Ion Channel”
   - “Cytokine 신경조절”
   - “교세포 향상성”
   - “Network Modulation”

Visual concept:
- Dark analytics wall with four KPI tiles and two clear bar charts.
- Highlight insight: E/I Balance and Neuroimmune are the main themes.
- Use molecule/network background but keep data legible.

Bottom insight ribbon exact text:
“핵심 포인트: Theme·국가·Cluster 기준으로 후보군을 즉시 재분류하고 우선순위를 조정”

Style: premium data visualization, executive dashboard, clean Korean labels, teal/amber/violet palette.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 07 — Scoring Rubric & Hard Filter

```text
Create a 16:9 visual explanation image for a scoring rubric used in biotech pipeline shortlisting.

Exact title text:
“판단 기준: 점수만이 아니라 ‘왜 그 점수인가’를 남김”

Main layout:
- Top area: seven scoring criteria cards arranged in a clean grid.
- Bottom area: two large explanation panels: PASS/REVIEW/FAIL gate and Audit label.

Seven cards exact labels:
1. “Target Relevance”
2. “Competitive Landscape”
3. “MoA Validity”
4. “Platform Attractiveness”
5. “Expansion Potential”
6. “Data Maturity”
7. “Marketability”
Each card includes small text: “0–3점 + Evidence Type”

Bottom left panel exact text:
Header: “PASS / REVIEW / FAIL 게이트”
Body: “Total ≥14, TR ≥3, MOA ≥2, Data ≥2 + hard blocker 없음 → PASS 후보”

Bottom right panel exact text:
Header: “Audit label”
Body: “E0–E4 evidence type · why_not_higher · investigation_note · source URL 보존”

Visual metaphor:
- Criteria cards feed into a decision gate with three outputs: PASS, REVIEW, FAIL.
- Evidence trail nodes connect to source documents.
- Use green/teal for PASS, amber for REVIEW, red for FAIL.

Style: dark technical infographic, clean high contrast, rigorous audit/compliance feeling, biotech strategy.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 08 — Detail View & AI Evidence Agent

```text
Create a 16:9 generated interface concept image for the SKBP Pipeline Finder detail page and AI Evidence Agent.

Exact title text:
“상세 화면: 원문 리포트와 Score 근거를 같은 화면에서 검토”

Visual concept:
- Left 65%: stylized detail page layout with three sections:
  1. “Mini TOC” sidebar
  2. “GPT 원문 리포트” main document viewer
  3. “Score 판단근거” evidence panel
- Right 35%: AI drawer panel titled “Asset Evidence Agent” with abstract chat bubbles and evidence graph links.
- Use one example asset label: “ILM01 / GAIA-Aβ” and score label “16 / 21”.
- Do not make this a screenshot; make it a clean generated product concept image.

Labels to render:
- “Mini TOC”
- “GPT 원문 리포트”
- “Score 판단근거”
- “Asset Evidence Agent”
- “Target fit”
- “Marketability”
- “Evidence gap”
- “Competitor risk”

Right side feature list as small callout cards:
- “원문과 구조화 JSON 동시 검토”
- “점수별 근거·출처 확인”
- “현재 asset 맥락으로 AI 질의”

Style:
- Dark mode enterprise SaaS, high-end, readable Korean UI labels.
- Teal glow around evidence connections; violet graph nodes; amber score chips.
- Clear separation between report, score evidence, and AI agent.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 09 — Wiki / Obsidian Knowledge Layer

```text
Create a 16:9 infographic image explaining the Wiki/Obsidian knowledge layer of SKBP Pipeline Finder.

Exact title text:
“Wiki/Obsidian 레이어: Dashboard 밖 지식베이스”

Visual concept:
- Center: a glowing knowledge graph with nodes and links.
- Left: generated Markdown note cards for Asset, Company, Target, Indication, Scorecard.
- Right: dashboard note cards and graph export cards.
- Bottom: one-line operating rule.

Exact text labels:
Node groups:
- “Assets”
- “Companies”
- “Targets”
- “Indications”
- “Scorecards”
- “Themes / Clusters”
Dashboard notes:
- “Asset Index”
- “By Target”
- “By Theme”
- “Evidence Gaps”
Graph export:
- “nodes.csv”
- “edges.csv”
- “graph.json”
Metric callout:
- “477 nodes · 782 edges”
Bottom rule:
- “JSON 수정 → Wiki 재생성 → Obsidian에서 연결 지식으로 활용”

Style:
- Dark navy knowledge graph, elegant enterprise data product, teal node glow, violet links, amber metric callout.
- Make it feel like a reusable research intelligence layer, not a simple folder diagram.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 10 — 7-Minute Talk Flow

```text
Create a 16:9 agenda / run-of-show image for a 7-minute internal presentation.

Exact title text:
“전사 데모 7분 구성안”

Main layout:
- A clean vertical timeline or horizontal winding roadmap with seven time blocks.
- Each block has time, section title, and short focus text.

Exact agenda text:
1. “0:00–0:40 문제 정의 — 후보 검토 병목”
2. “0:40–1:30 제작 과정 — GPT1/2, JSON, rubric”
3. “1:30–3:10 Dashboard Demo — KPI·차트·필터·Priority Watch”
4. “3:10–4:40 Detail Demo — 원문·점수근거·AI Agent”
5. “4:40–5:40 Wiki Layer — Obsidian export·graph”
6. “5:40–6:40 운영/확장 — 데이터 갱신·배포·DB 전환”
7. “6:40–7:00 마무리 — 속도·근거·재사용성”

Visual elements:
- Small icons for problem, workflow, dashboard, evidence, graph, deployment, closing.
- Use teal for completed flow line, amber highlights for demo parts.
- Keep text large enough and aligned.

Style: polished executive agenda, dark background, high contrast, Korean typography.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```

---

## Page 11 — Closing / Core Value

```text
Create a 16:9 closing slide image for a Korean corporate seminar.

Exact title text:
“마무리: 이 대시보드의 핵심 특징”

Main layout:
- Three large premium cards across the center.
- Under them, one strong summary sentence.
- Background: dark navy with subtle dashboard/evidence graph/molecule motif.

Three cards exact text:
1. Header: “비교 가능성”
   Body: “후보를 같은 점수체계와 필터로 비교”
2. Header: “감사 가능성”
   Body: “점수·근거·출처·불확실성까지 보존”
3. Header: “확장 가능성”
   Body: “JSON → Dashboard → Wiki → Agent로 재사용”

Summary sentence exact text:
“흩어진 GPT 조사 결과를 전사 공유 가능한 pipeline intelligence cockpit으로 전환”

Bottom center:
“Q&A”

Visual style:
- Executive closing image, minimal but premium.
- The three cards should feel like pillars.
- Use teal, amber, and violet accent colors respectively.
- Clean Korean typography, high contrast.

Negative constraints: Do not use real corporate logos. Do not show screenshots or browser chrome. Do not render random unreadable pseudo text outside the specified labels. Avoid clutter. Avoid tiny dense paragraphs. Avoid cartoonish style. Avoid low contrast. Avoid photorealistic people. No watermark. No PowerPoint UI. No slide thumbnails. No mock app window borders unless explicitly requested. Korean text must be clean and legible; if any Korean text is uncertain, leave that area as clean abstract visual space rather than inventing broken text.
```
