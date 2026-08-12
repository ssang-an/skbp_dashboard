** 아래 모든 지침사항을 읽고 수행할 것. 
1. 한 번에 모든 작업을 수행하지 않고, 일단 작업 범위 분할 작업을 수행한다.
2. docs folder에 ‘todo’ 폴더를 생성하고. 분리한 작업 범위 하나 당 상세한 플랜을  [[작업순서(숫자)-할 일.md]] 파일 이름으로 할 일 파일을 여러 개 생성한다. EX) 01-xxxx.md, 02-xxxxx.md ….. 이런식으로 작성
3. codex 혹은 claude는 한 번의 하나의 md file 만 읽고 작업을 수행하고, 그 작업이 모두 완료되면 01-xxxx(완료).md , 02.xxxx.md(완료) 이런식으로 파일을 생성해 어떤 작업을 완료했는지 로그를 남긴다.
4. 한 작업이 끝나면 다음 md 지침을 열고 순차적으로 작업을 수행한다. 아래 모든 지침을 참고해서 어떤 순서로 작업하는지 가장 좋을지 작업 순서워 범위를 정한 후, 최종 승인이 떨어지면 작업을 시작한다.
   — 아래 지시 사항 중 코드 변경 작업이 아닌, 단순 피드백에 대해서는 별도로 MD FILE을 생성해, 피드백 내용 COMMENT 남겨줄 것.
   — 아래 내용을 수행하되 대시보드 최고 달인으로서, UX 를 개선할 수 있는 방향에 대해서는 알아서 수행하길 바람. 
5. 각 todo list 수행 후 git commit 를 진행해 코드 변경이력도 추적 가능하게 해줘 
========================


Asset 조사하다 보면 indication이 여럿 나올 때가 있는데, 
현재 canonization이 있으면, 지금으로 충분한건가? 

현재 지침으로 lead indication을 잘 찾는 것인지, 궁금해. (예: 현재 올라와 있는 data) 
>> lead indication 이라는 확신이 없을 때(명확하지 않을 때 & 여러가지 Indication이 존재할 때), UNKNOWN으로 입력하지 않고 LIST 형태로 여러 Indication을 comma로 연결해서 표시해주고, 소팅할 때는 여러 약물을 필터링 할 때 동시에 소팅이 가능하도록 개선해줘. 하나의 indication 이 아니라 여러 개인 경우는 그 중에서 lead indication이라고 판단 되는 것을 가장 앞에 오도록 하고, 그 이 후 후보 indication을 comma로 연결
>> 추가로 table sorting 작업을 할 때 해당 keyword 포함의 경우 소팅되도록 변경하면 될 듯.
>> 지침에 가능하면 ‘UNKNOWN’ 표시는 지양하도록 가이드 추가 


-----
< 단순 UI 개선> 
현재 Tab1,2,Shortlisting에 보이는 맨 오른쪽  summary dashboard 박스에 Priority Pipeline이랑 F/U action말이야, 이거에 스크롤이 생겼으면 좋겠어. 
최대 10개 보이게끔 해두었는데, 현재 짤리는데 스크롤이 없어. summary dashboard의 스크롤은 Priority pipeline에만 필요
-----


파이프라인 자산을 새로 업로드할 때, 같은 자산이 표기 방식만 다르게(예: IL01, IL001, IL-01처럼 숫자/하이픈 표기가 다른 경우) 여러 번 등록되면서 상세페이지가 중복 생성되는 문제가 있어. 새 리포트를 업로드하기 전에, 이미 저장된 리스트에 유사한 자산이 있는지 확인해서 사용자에게 "새로 생성할지 / 기존 항목에 덮어쓸지" 선택하게 하는 확인 팝업을 만들고 싶어.
>> 벡터유사도까지 가지 말고, 단순히 언어 유사도 find similar 기능 써서 유사도 스코어가 특정 임계치 이상일 경우 해당 회사 + 약물과 같은 약물인지 유저에게 확인하는 로직 구현. 
>> 언어 유사도 구할 때는 ‘회사명 - 약물명’ 이렇게 구조화해서 한 번에 비교하는게 좋을 것 같은데 어떨지. 단순 단어 비교라서 이정도로 충분히 잘 가려낼 수 있을 듯함..
>> ai가 판단해보고 스스로 더 나은 방법으로 try 할 것.

구현 전에 먼저 나한테 확인/제안해줬으면 하는 것:
유사 매칭 기준을 뭘로 잡을지 제안해줘. 예: 같은 회사명이면서 자산명에서 하이픈/공백/leading zero를 제거하고 비교했을 때 일치하거나 편집 거리(edit distance)가 매우 가까운 경우만 "유사"로 판단하는 식. 적당히 느슨하게 잡아서 잼재적 덮어쓰기 대상이 보일 수 있도록 해줘. 확정하기 전에 기준안을 먼저 보여줘. 

"덮어쓰기"를 선택했을 때 정확히 뭐가 어떻게 되는지 옵션을 정리해줘. 새 리포트 내용(원문 리포트, 점수, structured_table 등)으로 교체하되, 다음 세 가지는 반드시 그대로 보존해줘 — 파트너사 자료(첨부파일), 원문 리포트에 첨부한 메모, 오른쪽 Team Review Workspace 내용. 이게 지금 데이터 구조상 자연스럽게 구현 가능한지, 혹시 구조적으로 어려운 부분이 있으면 짚어줘.
>> 비슷한 후보 물질이 있어 유저 피드백을 받을때 2step으로 구현함. 1step 어떤 회사명, 약물명 으로 선택할지 선택하는 창, 내용을 덮어쓰는걸 어떻게 할지 피드백 받을 것. 2step으로 구현 
1) 회사 명 & 약물 명 둘 중 하나 선택할 것. 기존 거 vs 새로운 약물 명  
2) 원문 리포트를 이번에 조사한 내용에 덮어쓸지, 아니면 새로 조사한 파일을 버리고 기존 원문 md 조사 내용을 유지할지.

팝업 UI는 지금 대시보드의 기존 모달/팝업 스타일과 톤을 그대로 따라줘. 새로운 디자인 언어를 만들지 말고, 기존에 쓰이는 버튼 스타일, 색상, 여백 규칙을 재사용해줘. 팝업에는 최소한 이런 정보가 나란히 비교되면 좋겠어: 덮어쓰려는 파이프라인이 맞는지 보려는 목적이야. tab0,1의 경우 덮어쓰기 대상이 많을 수 있으니 스크롤 가능한 asset list로 보이게 하고, 상세 정보도 필요하니까 asset name, company name, stage정도는 보이게 해줘. 덮어쓰기 와 건너뛰기가 있어야 할거같아.  건너뛰기를 누르면 기존 데이터에 덮어쓰지 않고 내용 올리지 않는거고 덮어쓰기 누르면 그대로 엎어지는거. 다만 덮어쓸/건너뛰기 할 asset이름이 뜰때 asset이름이 유사한것들은 다 업로드가 되어야할거같아. 그 유사이름이 있는 경우에는 더 주의해서 봐야하니까 완전 asset이름이 같은게 아니라 유사한거로서 뜨게 되면 highlight부탁해 highlight은 초록색계열이나 현재 UI에 자연스러운 색으로. 




 ---------
  

대시보드에 역할 기반 접근 제어(권한 체계)를 도입하고 싶어. 크게 세 종류의 권한이 필요해: 일반 사용자(비로그인 또는 미승인 계정), 관리자(Open Innovation Team 소속, 정주원 포함 총 7인), 개발자(정주원, 관리자 권한 전부를 포함한 최상위 권한).
 
1. 권한 없이도(비관리자도) 가능해야 하는 기능 — 아래 네 가지만:
 
GPT 원문 리포트에 메모 추가
AI Agent(chat mode) 사용
Team Review Workspace에 의견 남기기 (정성평가 코멘트만 해당, 점수나 구조화된 데이터 수정은 아님)
TAB1/TAB2 파이프라인 업로드 기능 (업로드 시 유사 자산 발견되면 신규생성/덮어쓰기 선택 팝업 포함)
 
2. 그 외 모든 수정/정정 기능은 관리자만 가능해야 함. 예를 들면 (실제 목록은 코드베이스 보고 판단해줘): structured_table 값 수동 보정, 점수 수정, 레코드 삭제, 지침/스키마 설정 변경 등.
 
3. 관리자 계정 목록 (Open Innovation Team, 정주원 포함 총 7인 — 이름과 이메일 모두 일치해야 자동 승인):
 
이름     허용 이메일 (둘 중 하나)         비고
주연주  yeonjoo@skbp.com 또는 yeonjoo@sk.com      관리자
허정환  jeonghwan.hur@skbp.com 또는 jeonghwan.hur@sk.com         관리자
이정태  jeongtae_lee@skbp.com 또는 jeongtae_lee@sk.com    관리자
유택상  taegsang.you@skbp.com 또는 taegsang.you@sk.com   관리자
서지영  jiyoungseO@skbp.com 또는 jiyoungseO@sk.com        관리자
정영찬  alex_jeong@skbp.com 또는 alex_jeong@sk.com          관리자
정주원  joowon.jung@skbp.com 또는 joowon.jung@sk.com     관리자 + 개발자 (둘 다)
 
가입 시 이름 입력값과 이메일이 위 표와 정확히 일치하는 경우에만 자동으로 해당 권한을 부여해줘. 이름만 일치하고 이메일이 다르면 절대 권한을 주지 말고, 일반 사용자로 가입 처리해줘. 이메일 로컬 파트(@ 앞부분)는 대소문자 구분 없이 비교해줘.
 
4. 개발자 권한 (정주원 전용, 관리자 권한 포함):
 
정주원은 관리자가 할 수 있는 모든 것에 더해, 개발자 전용 추가 권한을 가져야 해. 원문 리포트 화면에서 JSON 보기 버튼이 지금 관리자에게만 보이도록 되어 있는 기존 로직은 그대로 유지하고, 이 버튼이 정주원(개발자) 계정에도 계속 보이는지 확인해줘. 그 외에 개발자만 필요로 할 만한 기능(예: 스키마/지침 설정 변경, 백엔드 디버그 정보 열람 등)이 코드베이스에 이미 있다면 그것도 개발자 전용으로 분류해서 알려줘.

    ++ 사용자 관리 페이지 밑에  members table 생성 (지금 현재 개발자 페이지에서 멤버스 같이 볼 수 있게 구현 - 활동 로그 볼 수 있는 페이지에 >> 사용자 관리)
  >> 추가로, 개발자는 현재 가입된 계정과 이름,이메일을 확인할 수 있는 members table를 하나 만들어주고, 여기서 각 회원에 대한 권한을 수정하고 부여할 수 있게 해줘.

권한 체계는 3단계 구조로 만들어줘: user < admin < developer. developer는 admin이 가진 모든 권한을 자동으로 포함하는 상위 개념으로 구현해줘(정주원 계정에 admin과 developer 권한을 별도로 두 번 부여하는 게 아니라, developer role 하나가 admin 권한을 상속받는 방식을 권장하지만, 코드 구조상 더 적합한 방식이 있으면 제안해줘).
  
(로그인 환경 UI)
5. 로그인 시 비밀번호 찾기 버튼 누르면 앞에 3글자 힌트로 주는 것으로,
 - 만약 그래도 찾기 힘들 시 > ‘개발자’에게 문의하세요 띄워주고, 개발자가 비밀번호를 확인할 수 있게 
 - 개발자는 members page에서 비밀번호를 확인할 수 있게



Tab 1,2,3에서 (fast triage, full scout, shortlisting) 관리자가 할 수 있는 기능으로서, “score”를 dropdown으로 수정할 수 있는 것처럼 stage도 drop down menu로 수정할 수 있게 해줘. 
현재 canonized된 stage가 hit discovery, lead optimization, ind-enabling, preclinical unspecified, IND, P1, P2, P3, 등등 있는거 같은데 맞아? 한번 더 recap해줘. 그 메뉴 중 drop down 메뉴에서 관리자가 수정할 수 있게끔. 
물론 이 부분도 (다른 score 수정 기능과 마찬가지로) 새로고침을 누르면 신규 rubric/지침 version으로 자동 분류되도록 해줘. 이 말은 즉, home dashboard에서 관리자가 수정할 수 있는 각 pipeline의 score/filter1,2 결과 와 별개로, 새로고침을 누르면 다시 원래대로 돌아와야해.  → 물론 tab2 full scout에서 filter 2 결과나 아니면 stage를 수정할 경우 그 점이 그대로 tab3 shortlsting 부분에도 업데이트 되는걸로 알고있음 .그렇게 되어야 하고. 맞지? tab2와 tab3은 같이 pair로 가져감. (즐겨찾기만 할 경우 그게 tab3로오는 것, recap위해 남김.) 
Tab2에서 Target의 경우 Unknown이면 Unknown을 더블 클릭하면, Target 이름 수정할 수 있는 권한도 줘. 이것도 관리자가 할수있는 기능이겠지.
- 그리고 예를들어서, target이 현 정보 기준으로 unknown인데, 나중에 GPT원문리포트에 메모 추가 (현재 사용자가 모두 할 수 있게끔 되어있음) "메모 추가" 눌러서 메모가 추가할 수 있을거야. 그럼 homedashboard에서 새로고침 버튼을 누르면, 업데이트 된 GPT 원문리포트 (메모 포함), Partner Materials 업로드된 파일을 기반으로, home dashboard에 있는 tab1, 2, 3의 score를 다시 fill up할 수 있게 끔 하면 좋을듯. 현재 상태로서는 새로고침 버튼을 누른다면, 최신 rubric에 맞추어서 score 및 home dashboard의 score가 업데이트 되는 걸로 알고 있는데. 최신 가장 업데이트 된 gpt 원문리포트(메모 포함) 및 Partner Materials를 기반으로 해주면 좋을듯. 새로고침 누르면 그럼 시간이 걸리는 동안 새로고침 버튼 현재 있는 것이 아이콘이 뱅글뱅글 돌아가다가 완료되면 원위치로 돌아오게끔 해도 좋을 것 같아. 
그리고 파이프라인 업로드 / 후보 목록 업로드 저장이 완료되면, 예를 들어, "지침 1" 복사 버튼에 복사가 되면 "지침1 복사됨" 이렇게 pill icon이 바뀌듯이, “검증 후 저장” 버튼이 “저장 완료” 로 바뀔 수 있게 해줘. 그걸로 저장이 잘 됐다는걸 확인할 수 있게. 
그 로딩 팝업 창에서 -> 만약 덮어쓰기 대상이면 바로 또 다른 팝업창이 뜨겠지. 덮어쓰기 혹은 건너뛰기를 눌러야 할꺼야. 덮어쓰기 누르면 또 덮어쓰는데 시간이 걸리면 로딩 “업로드 중입니다” 팝업창이 뜰거고. 저장이 완료되면, 업로드 중입니다 라는 걸 알리는 팝업창은 없어지면서, 내가아까 말한 pill 아이콘이 저장완료로 뜰거고. 그렇게 진행하는것으로 이해했는데 고수로서 내 지침은 참고로 해서 잘 반영해줘. 
그리고 또 로딩할때 필요한 경우가 Team Review Workspace에서 파일 올리면 "파일 업로드 중"이라는 버튼이 너무 작게 보이고, 파일이 업로드 중에는  파일 업로드 아이콘이 나와서 “업로드 중입니다. “ 뜨게 해줘. 이거는 완료 되면 바로 partner materials부분에 파일 아이콘이 올라갈테니 따로 pill 아이콘 표시가 필요한 상황은 아님.  업로드에 맞는 아이콘 활용해서 대시보드 통일된 UI로 잘 구현해줘. 
그리고 맨위 header SKBP Pipeline Finder옆에 tab0 인데도, “총 57건 로드됨”이라고 되어있는데 이거는 tab1의 결과이니, 여기서 총 XX건 로드됨 이 어구에 표현되어야 하는 XX는 진척현황 table에 있는 총 파이프라인 개수이어야 해. 진척현황 table은 pipeline table라고 tab1,2에서 쓰인대로 통일해줘. 그리고 이 Pipeline Table의 표 가장 윗 행보면 tab1,2와 비슷한 폰트랑 디자인으로 부탁해. 
------------------------------------------------------------

[system]
서버 다운 되거나 git pull하고 나면 이메일 회원가입 다시해야 하는지? (반복해서 가입하지 않게 하는 방법?)
한 사람이 서버 하나 이용하고 있으면 두번쨰 사람은 같은 서버 못 이용하는지? (동일 번호 접속 동시 불가) 

------------------------------------------------------------

[Shortlisting] 
Shortlisting에서 Team Review Workspace에 Filter 3 dropdown menu + 의견 요약 칸 밑에 “자료 보유-cdp,ncdp,admet 불들어오는 pill menu”에 사용자가 눌르면 켜질 수 있게 했는데, 켜지게 할때 파일을 올릴 수 있게끔 해줘. 
그리고 파일 드래그/파일 업로드 할때 PARTNER MATERIALS 밑에 +파일 올릴 때 "파일명이 NCDP, CDP, ADMET 등 자료 Category 이름을 포함하고 있나요?" 라는 느낌의 글귀 안내 팝업 창이 올라왔으면 좋겠어 (더 좋은 글귀 있음 추천 가능). 그러면 이전 팝업창에서 덮어쓰기 or 건너뛰기를 선택할 수 있었던 것처럼, 그 질문을 보고 "Yes, 업로드 진행" or  “No, 파일 재업로드” 버튼을 하나 더해서, 만약 파일 이름이 그 파일의 type문구를 포함하지 않으면, 다시 파일 올릴 수 있는 팝업창을 생성해서 다시 업로드 진행하고, 업로드 하면 그때 다시 해당 팝업 창 다시 올라오게 해서 yes를 누르면 올라가게 해줘. 
Shortlisting 판단 근거에 보면 Filter 3의 첫 category가 "투자" 인데 현재는 stage 가 IND-enabling으로 되어 있음. 판단근거에 “IND-enabling 이상” + “IND filed/cleared 및 Phase 1 이상 포함” 으로 수정해줘
그리고 value up은 stage가 미기입되어 있는데, stage는 ind-enabling 미만이어야 함, 미만이라 함은 preclinical 전체 단계에서 ind enabling단계 보다 더 전단계 stage인 asset을 말하는거야. 
Filter 3 판단 근거에 대해서는 (모든 지침을 Manifest로 관리하고 있는 걸로 아는데) 지침 · 화면 · Rubric 기준 도 모두 업데이트 해야할 대상인지 판단해서 알아서, 필요한 부분 업데이트 해줘. Filter 3 그러니까  tab 3 filter 3(Shortlisting)의  rubric과 판단근거(Filter 3 — OI Partnership 자동 분류 · v1.0 기준→ v 1.1로 업글?)는 확실히 필요할거 같은데 진행해줘.   
그리고 tab3 shortlisting 판단근거에 “ 확인된 정보 사용 : 구조화된 Dashboard 값과 확인된 Full Scout 정보를 사용하며, 확인되지 않은 값은 임의로 추정하지 않습니다.” 문구가 있어. 이 문구에서 부분적으로 수정할게 있는데, "Full Scout 및 Partner Materials 정보를 사용하며”로 수정하면 좋을거 같아. 
마지막으로 Shortlisting된 piepline의 상세페이지에 보면 Team workspace밑에 정성평가 아래 Efficacy, Commercial, Risk 칸 아래에 있는 ”그냥 댓글 (topicless) 의견 입력란”에 의견 입력하면, 의견 오른쪽 상단 위에 "x" 삭제버튼이 없는데 삭제버튼 추가해줘. 




Tab3 Home Dashboard — ADMET Score 산정 및 In vivo / In vitro Indicator 로직 수정 요청
Tab3의 Home Dashboard에서 ADMET Score와 기존 In vivo / In vitro indicator가 서로 독립적으로 정상 표시되도록 아래와 같이 수정해주세요. 홈대시보드 현재 코딩 상황을 잘 모르긴 하나 아래 내용을 통해 상황을 파악하고 수정할 것 정리해서 알려줘 
1. In vivo / In vitro indicator — 기존 Full Scout report 기반 유지
In vivo / In vitro indicator는 기존 GPT Full Scout 원문 report 및 Partner Materials에 업로드된 CDP, NCDP, IR자료 등을 기반으로 판정 
ADMET 파일 업로드 이후 기존에 표시되던 In vivo / In vitro sign이 사라지는 현상이 있었으므로 regression/error 여부를 확인해주세요. (ADMET 파일의 업로드 여부나 ADMET parsing 결과가 이 ADMET 외의 indicator에 영향을 주면 안 됩니다.)
특히 아래 사항을 확인해주세요.
ADMET 파일 업로드 시 기존 Full Scout-derived field가 overwrite/reset되는지
ADMET parser와 In vivo/In vitro parser가 동일 state/key를 공유하고 있는지
새 파일 업로드 시 기존 Full Scout 분석 결과가 초기화되는지
최종적으로 다음 두 데이터 source는 완전히 분리되어야 합니다.
In vivo / In vitro indicator → GPT Full Scout 원문 report / Partner Materials에 업로드 된 NCDP/CDP 내용 
ADMET Score → 사용자가 업로드한 ADMET 파일
2. ADMET Score — 업로드된 ADMET 파일의 Study + Status 기반
ADMET 파일이 업로드되면 표의 Study와 해당 Study의 Status를 연결하여 읽고, 수행 완료된 Study 수를 계산해주세요.
Home Dashboard 표기 형식:
ADMET: 완료 Study 수 / 25
예:
ADMET: 10 / 25
중요: ADMET 총점의 denominator는 항상 25
ADMET standard study는 총 25개이며, Dashboard score의 denominator는 항상 25로 고정합니다.
만약 25개 외 추가 실험이 있을 경우 Count하지 않습니다. 
즉:
Standard ADMET studies = 25
Dog Telemetry = optional / additional study
Dog Telemetry가 수행완료, Y, Completed 등으로 표시되어 있더라도 ADMET 완료 개수 numerator에 포함하지 않음
denominator에도 포함하지 않음
예:
Standard 25개 중 10개 완료 + Dog Telemetry 완료 → 10 / 25
Standard 25개 중 18개 완료 + Dog Telemetry 미완료 → 18 / 25
Dog Telemetry 결과는 별도 additional study 정보로 보존할 수 있습니다 (예시임). 단, ADMET Score에는 반영하지 않습니다.
3. Study 완료 판정 규칙
각 Study에 대응되는 Status 또는 상태를 나타내는 cell에서 아래 값이 확인되면 해당 Study를 Completed로 판정해주세요.
Completed로 인정
Y
단, Status cell 자체가 Y인 경우
다른 문장 내 일반 알파벳 y를 잘못 인식하면 안 됨
Complete
Completed
완료라는 단어가 포함된 경우
수행완료
수행 완료
시험완료
시험 완료
완료
기타 완료 substring 포함
영어 표현은 case-insensitive하게 처리해주세요.
예:
Completed → 완료
COMPLETE → 완료
complete → 완료
Y → 완료
수행완료 → 완료
시험 완료. 보고서 작성 중 → 완료
Completed로 인정하지 않음
예:
N
계획 (2026)
계획 (2027)
필요시
진행예정
진행 예정
blank
Not completed
기타 명확한 완료 표현이 없는 값
주의: Not Completed, Incomplete와 같이 complete/completed 문자열이 포함되어도 부정 표현이면 완료로 판정하면 안 됩니다.
따라서 단순 substring match보다 negative expression을 우선 체크하는 방식으로 구현해주세요. → 인식 체계는 알아서 스마트하게! 
4. ADMET 표 format 차이를 허용하도록 parsing
ADMET 파일마다 표 형식이 조금 다를 수 있습니다.
예시 Format A:
Category | Study | Status
예시 Format B:
Category | Study | Status | 비고
또한 merged cell이나 Category 위치가 다를 수 있습니다.
따라서 특정 row/column 좌표를 hard-code하지 말고, 가능한 한 다음 semantic relationship을 기반으로 parsing해주세요.
Study name ↔ 해당 Study의 Status
예를 들어:
Mouse PK (IV&PO) ↔ 수행완료
Rat PK (IV&PO) ↔ Y
Brain tissue binding ↔ N
Hepatocyte clearance ↔ 계획 (2026)
Category 또는 subsection은 Study로 count하지 않습니다.
아래와 같은 항목은 category/header이며 Study가 아님:
DMPK
Absorption
Distribution
Metabolism
DDI
SnT
General Toxicity
Genotoxicity
CV Safety
실제 개별 시험명만 Study로 인식해주세요.
5. ADMET Score의 canonical 25-study 기준
Dashboard의 ADMET Score는 파일에서 발견되는 아무 row나 25개를 세는 방식이 아니라, ADMET standard study 25개를 기준으로 완료 여부를 mapping하는 구조가 바람직합니다.
동일 Study가 format 차이, 줄바꿈, 괄호, 약간의 wording variation 때문에 중복 count되지 않도록 normalize해주세요.
예:
Metabolite PF/in vitro Met ID (M/R/D/P/H)
처럼 줄바꿈이 포함되어 있어도 하나의 Study로 인식해야 합니다.
또한 한 Study의 비고에 시험완료가 있고 Status가 Y인 경우에도 1개 Study를 2회 count하면 안 됩니다.
최종 numerator는 unique standard ADMET study 중 Completed로 판정된 개수입니다.
0 <= completed_admet_studies <= 25
6. Tab3 Home Dashboard 표시
Tab3 Home Dashboard에서 다음 두 정보를 동시에 유지해주세요.
In vivo / In vitro indicator
Source: 기존 GPT Full Scout 원문 report / CDP / NCDP
기존 로직이 뭔지 모르겠지만 유지하거나 위 필요 사항을 반영한 방식으로 수행 
ADMET upload와 독립
ADMET score
Source: 업로드된 ADMET file
Study + Status 기반
Completed / Y / Complete / 완료 포함 시 완료 판정
완료 standard Study 개수 / 25 형태로 표시
예시 UI:
In vitro: ✓
In vivo: ✓
ADMET: 10 / 25
7. ADMET 파일이 없는 경우
ADMET 파일이 업로드되지 않은 asset에 대해서는 임의로 Full Scout report에서 ADMET score를 추정하지 말아주세요.
예:
ADMET: -
또는 현재 Dashboard의 missing-data convention에 맞는 표시를 사용해주세요.
반면 ADMET 파일이 없어도 기존 Full Scout report가 존재하면 In vivo / In vitro indicator는 계속 정상 표시되어야 합니다.
8. Regression 확인 필수 (아래는 예시)
이번 수정 시 아래 regression test를 반드시 확인해주세요.
Case A — Full Scout만 존재
In vivo/In vitro indicator 정상 표시
ADMET score는 missing 상태
Case B — Full Scout + ADMET 파일
기존 In vivo/In vitro indicator 유지
ADMET score 신규 표시
두 기능이 서로 overwrite하지 않음
Case C — ADMET 파일만 교체/재업로드
ADMET score만 재계산
In vivo/In vitro indicator 변화 없음
Case D — Format A
Category / Study / Status
정상 parsing
Case E — Format B
Category / Study / Status / 비고
정상 parsing
Case F — Dog Telemetry 수행완료
Dog Telemetry는 결과 자체는 읽을 수 있음
numerator 및 denominator에는 반영하지 않음
Case G — 부정 표현
Not Completed, N, 계획, 필요시, blank 등을 Completed로 오인하지 않음
최종 기대 동작
Tab3 Home Dashboard에서:
In vivo / In vitro = GPT Full Scout 원문 report 기반 / CDP, NCDP 등 Partner Materials 참고 (ADMET로 인식되는 자료 외)
ADMET = 업로드된 ADMET table 기반
두 parser/state를 독립적으로 유지
다양한 ADMET table format에서도 Study ↔ Status를 semantic하게 mapping
Completed, Complete, Y, 완료 포함 시 완료 판정
중복 Study count 방지
Dog Telemetry는 additional study로 간주하여 score에서 제외
ADMET score = completed standard ADMET studies / 25
ADMET 파일 추가/교체가 기존 In vivo/In vitro sign을 삭제하거나 변경하지 않도록 regression 수정
구현 후에는 어떤 field/state가 각각 In vivo/In vitro와 ADMET score의 source of truth인지도 확인할 수 있도록 정리해주세요. → 이거는 구현가능할지 모르겠는데 피드백줘 
invivo, invitro 표시가 들어왔다가 admet파일을 올리면 안됨. 문제 있음. 

----


