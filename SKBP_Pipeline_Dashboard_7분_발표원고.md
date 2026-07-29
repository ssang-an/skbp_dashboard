# SKBP Pipeline Dashboard 7분 발표 원고 초안

## 1. 오프닝 (0:00–0:40)
안녕하세요. 오늘은 SKBP Pipeline Finder, 즉 PreC pipeline 후보를 빠르게 선별하고 근거까지 추적할 수 있도록 만든 내부 대시보드를 소개드리겠습니다. 이 프로젝트의 목적은 GPT로 조사한 후보 리포트를 단순 문서로 끝내지 않고, 같은 기준으로 비교 가능한 데이터 자산으로 전환하는 것입니다. 현재 JSON 기준으로 총 32개 후보가 들어 있고, PASS 또는 SELECT로 볼 수 있는 후보는 14개입니다.

## 2. 제작 배경과 문제 (0:40–1:30)
기존에는 회사별·asset별 GPT 리포트가 각각 존재해 후보 간 비교가 어렵고, 점수의 근거와 출처를 다시 찾는 시간이 많이 들었습니다. 그래서 세 가지를 해결하려고 했습니다. 첫째, 후보를 같은 rubric으로 비교할 것. 둘째, 왜 그 점수가 나왔는지 evidence trail을 남길 것. 셋째, 대시보드와 Wiki로 공유 가능한 형태를 만들 것입니다.

## 3. 제작 과정 (1:30–2:20)
흐름은 GPT 1 Fast Triage, GPT 2 Full Scout, JSON Schema 저장, Dashboard 표시, Wiki Export 순서입니다. GPT 1은 여러 asset을 SELECT, REJECT, N/A로 빠르게 선별합니다. SELECT 후보는 GPT 2에서 Target Relevance, MoA Validity, Data Maturity, Marketability 등 7개 기준으로 심층 조사합니다. 결과는 `json/pipeline-records.json`에 저장되고, 이 JSON이 단일 원본입니다.

## 4. 대시보드 소개 (2:20–3:40)
메인 화면에서는 총 분석 건수, PASS/SELECT 비율, 평균 Target Relevance, 국가 수 같은 KPI를 먼저 보여줍니다. 아래에는 Target Relevance 분포, Theme 분포, 국가별 후보군, Pipeline Filter, Score Profile, Priority Watch가 있습니다. 필터는 Stage, Theme, Cluster, 국가, indication, Pipeline Filter 기준으로 걸 수 있고, 테이블은 정렬·컬럼 설정·Excel export가 가능합니다. 즉 회의 중에도 “Neuroimmune 중에서 한국 회사 후보만 보자” 같은 질문에 바로 대응할 수 있습니다.

## 5. 평가 기준과 Hard Filter (3:40–4:40)
점수 체계는 7개 criteria 각각 0~3점입니다. 단순 총점만 보는 것이 아니라 Target Relevance, MoA, Data Maturity 같은 핵심 게이트와 hard blocker를 함께 봅니다. 예를 들어 Total 14점 이상, TR 3점, MoA 2점 이상, Data 2점 이상이고 명확한 blocker가 없으면 PASS 후보로 볼 수 있습니다. 또 각 점수에는 evidence type, why_not_higher, investigation note, source URL이 함께 남아 사후 검증이 가능합니다.

## 6. 상세 화면과 AI Agent (4:40–5:40)
후보 하나를 클릭하면 상세 화면으로 들어갑니다. 좌측에는 긴 리포트의 Mini TOC, 중앙에는 GPT 원문 리포트, 우측에는 score별 판단 근거와 출처가 나옵니다. 또한 Asset Evidence Agent가 있어서 현재 asset의 JSON과 Wiki note를 맥락으로 Target fit, Marketability, Evidence gap, Competitor risk를 질문할 수 있습니다. 이 기능은 단순 채팅이 아니라 현재 후보 데이터와 Wiki 검색 결과를 함께 참고하도록 설계되어 있습니다.

## 7. Wiki/Obsidian 레이어 (5:40–6:25)
대시보드와 별도로 `skbp_pipeline_wiki`가 자동 생성됩니다. 여기에는 asset, company, target, indication, competitor, scorecard, theme, cluster별 note가 있고, dashboard note와 graph export도 포함됩니다. 현재 Wiki README 기준 graph nodes는 477개, edges는 782개입니다. 따라서 대시보드에서 본 내용을 Obsidian 같은 지식베이스에서도 연결 관계로 볼 수 있습니다.

## 8. 운영 방식과 확장 (6:25–6:50)
운영은 간단합니다. JSON을 저장하고, 필요하면 Markdown/Wiki export를 다시 실행합니다. 현재는 로컬 JSON 파일 기반이지만 FastAPI 구조라 Render, Railway 같은 Python web service로 올릴 수 있고, 여러 명이 동시에 쓰려면 다음 단계에서 SQLite나 Postgres로 전환하면 됩니다.

## 9. 클로징 (6:50–7:00)
정리하면 이 대시보드는 GPT 조사 결과를 전사적으로 공유 가능한 pipeline intelligence cockpit으로 바꾼 프로젝트입니다. 후보 비교 속도를 높이고, 점수의 근거를 남기며, Wiki와 AI Agent로 재사용성을 확보한 것이 핵심 특징입니다. 감사합니다.
