---
title: "Agent AI 논문 리스트 — 카테고리별 정리와 핵심 기여"
date: 2025-11-19
tags: [agent-ai, llm, survey, paper-review, machine-learning]
image: "/meshblog/og/posts/02-agent-ai-paper-list.svg"
---

2025년 가을, AI 에이전트 분야는 이제 "실험적 가능성"을 넘어 "운영 가능한 시스템"으로 이동하는 변곡점을 지나고 있다. GPT-4와 Claude 3가 등장하면서 LLM의 지식 압축 능력은 어느 정도 증명됐지만, 단일 추론 호출 하나로는 해결할 수 없는 복잡한 태스크들이 산적해 있다. 웹 브라우저를 열고, 코드를 작성하고, 결과를 확인하고, 계획을 수정하는 — 이 일련의 루프를 자율적으로 수행하는 에이전트가 본격적으로 연구 의제의 중심에 올라선 것이다.

이 논문 리스트는 2025년 11월 기준으로, masamasa59의 [ai-agent-papers](https://github.com/masamasa59/ai-agent-papers) 큐레이션과 Reddit의 LLMDevs 커뮤니티 추천 목록을 바탕으로 정리한 것이다. 시점이 중요하다. o1 발표 이후 추론 능력의 스케일링이 재조명되고, GUI 에이전트·소프트웨어 에이전트·리서치 에이전트가 각자의 서브필드로 분화된 직후 스냅샷이다. 이전에는 "에이전트"라는 단어가 ReAct 프레임워크 정도를 의미했다면, 이제는 플래닝, 메모리, 툴 사용, 자기교정, 다중 에이전트 협조, 심지어 에이전트 자체를 설계하는 메타-에이전트까지 수십 개의 하위 토픽이 존재한다.

이 글에서 독자가 얻을 것은 크게 세 가지다. 첫째, 각 카테고리가 왜 독립적인 연구 주제로 분리됐는지 — 공통된 문제 의식을 한 단락으로 짚는다. 둘째, 카테고리별 대표 논문 한두 편의 핵심 기여를 풀어서 설명한다. 셋째, 나머지 논문들은 한 줄 요약과 링크 형태로 정리해, 관심 있는 영역으로 빠르게 진입할 수 있도록 한다. 논문별 링크는 원본 리포지토리에서 수집했으며, 아직 링크가 확보되지 않은 항목은 제목 검색으로 찾을 수 있도록 연도와 제목을 그대로 보존했다.

---

아이콘 범례:
- 🔥 masamasa59 추천
- 📖 서베이 논문
- ⚖️ 벤치마크 논문

---

## Planning

에이전트가 복잡한 목표를 달성하려면 단순한 다음 토큰 예측을 넘어서 "지금 무엇을 해야 하는가"를 미리 설계하는 능력이 필요하다. 플래닝 연구는 LLM이 목표를 서브태스크로 분해하고, 실현 가능성을 검증하며, 계획 실패 시 재조정할 수 있는지를 다룬다. o1 모델의 등장은 이 분야에 새로운 질문을 던졌다 — 장시간 내부 추론(chain-of-thought)이 플래닝 능력을 실질적으로 개선하는가?

- 🔥 [Oct 2024] "On The Planning Abilities of OpenAI's o1 Models: Feasibility, Optimality, and Generalizability" — o1의 내부 추론이 고전적 플래닝 태스크(Blocksworld, Traveling Salesman 등)에서 얼마나 통하는지 체계적으로 평가. 단순 실현 가능성(feasibility)뿐 아니라 최적성(optimality)과 일반화(generalizability)를 삼중으로 검증한다는 점에서 o1 시대 플래닝 벤치마크의 기준선이 됐다.

---

## Reasoning

추론 능력은 에이전트의 인지적 토대다. Chain-of-Thought(CoT)가 만능처럼 여겨지던 시기에 이 논문은 냉정한 경험적 질문을 던진다 — CoT는 언제 실제로 도움이 되는가?

- 🔥 [Sep 2024] "To CoT or not to CoT? Chain-of-thought helps mainly on math and symbolic reasoning" — CoT의 효과가 수학·기호 추론 태스크에 집중되며, 상식 추론이나 지식 검색 태스크에서는 오히려 노이즈를 만들 수 있다는 것을 실증한다. "CoT는 항상 좋다"는 통념을 뒤집는 핵심 결과로, 에이전트 파이프라인에서 추론 전략을 언제 켜고 끌지 결정하는 기준이 된다.

---

## Profile (Persona)

에이전트가 다양한 맥락에서 유용하려면 특정 관점이나 전문성을 가진 "페르소나"를 시뮬레이션할 수 있어야 한다. 이 카테고리는 합성 데이터 생성과 페르소나 다양성 확보 문제를 다룬다.

- 🔥 [Jun 2024] "Scaling Synthetic Data Creation with 1,000,000,000 Personas" — 10억 개의 다양한 페르소나를 활용해 합성 데이터를 대규모로 생성하는 방법론을 제안. 단순 증강을 넘어서 분포 다양성을 보장하는 페르소나 기반 접근법은 이후 에이전트 튜닝 데이터셋 구축에 광범위하게 인용됐다.

---

## Tool Use

LLM 단독으로는 인터넷 검색, 코드 실행, 데이터베이스 조회가 불가능하다. 툴 사용 연구는 언어 모델이 외부 API나 도구를 언제, 어떻게 호출할지 학습하는 문제를 다룬다. Toolformer는 이 분야의 시초 격 논문이며, GTA는 범용 툴 에이전트를 위한 평가 기준을 제시한다.

- ! [Feb 2023] [Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761) — 스스로 API 호출을 삽입하는 방식으로 자기지도 학습을 통해 툴 사용을 익히는 방법론. 외부 주석 없이 언제 도구를 써야 하는지 파악하는 능력을 LLM에 부여한 선구적 연구다.
- 🔥 ⚖️ [Jul 2024] "GTA: A Benchmark for General Tool Agents" — 실세계 파일·웹·코드 실행 등 다양한 도구 타입을 아우르는 종합 벤치마크. 단순 API 호출 정확도를 넘어 순차적 툴 체이닝 시나리오를 평가한다.

---

## Self-Correction

에이전트의 첫 출력이 항상 정확하지는 않다. 자기교정 연구는 에이전트가 자신의 실수를 인식하고, 반성하며, 더 나은 답으로 수렴하는 능력을 다룬다. 단순한 재시도와 달리, 진정한 자기교정은 이전 오류의 원인을 분석하는 메타인지를 요구한다.

- ! [Jul 2024] "Recursive Introspection: Teaching Language Model Agents How to Self-Improve" — 에이전트가 과거 실수를 재귀적으로 분석해 자기 개선 루프를 형성하는 방법론. RL 신호 없이도 내성(introspection) 프롬프팅만으로 반복적 개선이 가능함을 보인다.
- 🔥 ⚖️ [Oct 2024] "Reflection-Bench: Probing AI Intelligence with Reflection" — 반성(reflection) 능력을 체계적으로 측정하는 벤치마크. 단순 QA 정확도가 아닌 "오류 인식 → 원인 분석 → 수정"의 파이프라인 각 단계를 평가한다.

---

## Self-Evolution (Self-Improvement)

자기교정이 단일 세션 내 오류 수정이라면, 자기진화는 에이전트가 새로운 경험을 누적해 장기적으로 능력 자체를 향상시키는 문제다. 에이전트 설계를 에이전트 스스로 자동화하는 ADAS, 그리고 경험 기반 학습의 대표 사례 ExpeL이 이 카테고리의 핵심이다.

- 🔥 [Aug 2024] "Automated Design of Agentic Systems" (ADAS) — 메타-에이전트가 프로그래밍 방식으로 새로운 에이전트를 설계하고 테스트하는 루프를 구축. 수작업 프롬프트 엔지니어링 없이도 태스크에 맞는 에이전트 아키텍처를 자동 탐색한다는 아이디어가 인상적이다.
- ! [Dec 2024] "ExpeL: LLM Agents Are Experiential Learners" — 에이전트가 성공·실패 경험을 저장하고 검색해 새로운 태스크에 재적용하는 경험 학습 프레임워크. 파인튜닝 없이도 경험 축적만으로 성능이 올라간다는 실험 결과가 주목받았다.

---

## Safety

에이전트가 자율적으로 행동할수록 보안 위협과 개인정보 침해, 윤리 문제의 표면적이 커진다. 이 카테고리는 LLM 기반 에이전트가 악의적 입력, 프롬프트 인젝션, 데이터 유출에 어떻게 노출되는지와 그 대응 전략을 다룬다.

- 🔥 📖 [Nov 2024] "Navigating the Risks: A Survey of Security, Privacy, and Ethics Threats in LLM-Based Agents" — 에이전트 고유의 위협 표면(툴 남용, 메모리 오염, 다단계 공격 등)을 체계적으로 분류한 서베이. 기존 LLM 안전성 연구와 에이전트 특화 리스크의 차이를 명확히 구분한다.

---

## Agent Tuning

범용 LLM을 에이전트로 만들려면 지식 활용 방식 자체를 바꿔야 한다. 이 카테고리는 LLM이 저장된 지식을 어떻게 접근, 편집, 추론에 통합하는지 — 즉 지식 메커니즘 — 를 분석한다.

- 🔥 [Jul 2024] "Knowledge Mechanisms in Large Language Models: A Survey and Perspective" — LLM 내 지식의 저장, 검색, 수정 메커니즘을 체계적으로 정리한 서베이. 에이전트 파인튜닝 시 어떤 레이어에 어떤 종류의 지식이 인코딩되는지 이해하는 데 기초 자료로 활용된다.

---

## Agent Evaluation

에이전트를 제대로 평가하지 못하면 진보를 측정할 수 없다. 단일 태스크 정확도를 넘어 계획 수립, 도구 활용, 메모리 관리, 다중 도메인 일반화를 동시에 평가하는 홀리스틱 벤치마크가 필요하다.

- 🔥 ⚖️ [Jul 2024] "MMAU: A Holistic Benchmark of Agent Capabilities Across Diverse Domains" — 수학, 코딩, 웹, 일상 태스크 등 다양한 도메인을 아우르는 종합 에이전트 평가 스위트. 단일 능력이 아닌 "에이전트다운 행동"을 종합적으로 측정한다.

---

## Agent Frameworks

에이전트 아키텍처와 거버넌스를 다루는 가장 큰 카테고리다. 단일 에이전트의 루프 설계부터 다중 에이전트 협업, 메모리 시스템, 운영/UX/비즈니스 고려사항까지 폭넓게 걸친다.

### Single-Agent

단일 에이전트의 핵심은 관찰-추론-행동 루프를 어떻게 설계하느냐다. ReAct는 이 루프의 원형을 제시했고, 이후 서베이들은 이를 AGI 로드맵과 연결지었다.

- ! [Oct 2022] [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — 추론(Reasoning)과 행동(Acting)을 교차 수행하는 ReAct 패러다임의 시초. 생각-행동-관찰 트리플렛 구조는 이후 거의 모든 에이전트 프레임워크의 기초가 됐다.
- 🔥 📖 [Nov 2023] "Levels of AGI for Operationalizing Progress on the Path to AGI" — AGI 진척도를 측정 가능한 수준으로 조작화하는 프레임워크 제안. "에이전트가 어디쯤 있는가"를 논의하는 공통 언어를 제공한다.
- 🔥 📖 [Dec 2023] "Practices for Governing Agentic AI Systems" — 자율 에이전트를 조직 내에서 안전하게 운영하기 위한 거버넌스 원칙들을 정리. 기술적 아키텍처보다 정책·책임 구조를 다룬다는 점에서 독특하다.
- 🔥 📖 [Apr 2024] "AI Agent Architectures for Reasoning, Planning, and Tool Calling: A Survey" — 추론·플래닝·툴 호출을 통합하는 에이전트 아키텍처를 분류 체계별로 정리한 서베이.
- 🔥 📖 [Mar 2025] "A Survey of Frontiers in LLM Reasoning: Inference Scaling, Learning to Reason, and Agentic Systems" — 추론 확장, 학습된 추론, 에이전트 시스템을 하나의 프레임으로 묶은 최신 서베이.
- 🔥 📖 [Mar 2025] [Agentic Large Language Models, a survey](https://arxiv.org/abs/2503.23037) — 에이전트 LLM의 현재를 넓게 커버하는 서베이.
- [Apr 2025] "Weak-for-Strong: Training Weak Meta-Agent to Harness Strong Executors" — 약한 메타-에이전트가 강한 실행 에이전트를 오케스트레이션하는 비대칭 설계.
- 🔥 📖 [Apr 2025] "Advances and Challenges in Foundation Agents: From Brain-Inspired Intelligence" — 뇌과학에서 영감 받은 파운데이션 에이전트의 진척과 과제를 망라한 서베이.

### Multi-Agent

여러 에이전트가 역할을 분담하고 협력할 때 나타나는 창발적 행동과 사회적 시뮬레이션이 이 서브필드의 주제다.

- ! [Apr 2023] [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) — 25개의 LLM 기반 에이전트가 가상 마을에서 자율적으로 사회적 행동을 형성하는 실험. 다중 에이전트 시뮬레이션 분야의 랜드마크 논문.
- ! [Feb 2025] "AgentSociety: Large-Scale Simulation of LLM-Driven Generative Agents Advances Understanding of Human Behaviors and Society" — Generative Agents의 규모를 사회 전반의 행동 이해로 확장. 대규모 사회적 시뮬레이션의 가능성을 탐색한다.

### Memory

에이전트가 장기적으로 유용하려면 과거 대화와 경험을 선택적으로 저장하고 검색할 수 있어야 한다. 단순 컨텍스트 윈도우를 넘어선 구조적 메모리 시스템이 이 서브필드의 핵심이다.

- ! [Feb 2025] "A-MEM: Agentic Memory for LLM Agents" — 에이전트가 필요에 따라 능동적으로 메모리를 생성, 편집, 연결하는 자율 메모리 시스템. 검색 증강(RAG)과 달리 메모리 구조 자체를 에이전트가 관리한다.

### Agent Ops & UX & Business

에이전트가 실제 프로덕션 환경에 배포될 때 필요한 관찰 가능성(observability), 사람-에이전트 소통, 노동시장 영향까지 다루는 실용적 서브필드다.

- 🔥 [Nov 2024] "A Taxonomy of AgentOps for Enabling Observability of Foundation Model based Agents" — 에이전트 운영을 위한 모니터링·디버깅·로깅 분류 체계. MLOps에서 AgentOps로의 전환점을 개념화한다.
- 🔥 [Dec 2024] "Challenges in Human-Agent Communication" — 사람과 에이전트가 의도를 주고받을 때 발생하는 소통 단절과 신뢰 문제를 분석.
- 🔥 [Jun 2025] "Future of Work with AI Agents: Auditing Automation and Augmentation Potential across the U.S. Workforce" — 미국 전체 직군을 대상으로 에이전트가 자동화하거나 증강할 수 있는 업무를 체계적으로 감사. 정책 입안자와 조직 리더를 위한 실용적 프레임워크를 제공한다.

---

## Digital Agents

실제 컴퓨터 화면, 웹 브라우저, 모바일 앱을 직접 조작하는 에이전트 분야다. 텍스트 API가 아닌 UI를 인터페이스로 삼는다는 점에서 멀티모달 인식과 행동 계획이 동시에 요구된다.

### GUI Agents

- 🔥 ⚖️ [Apr 2024] "OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer" — 실제 운영체제 환경에서 오픈엔디드 태스크를 수행하는 멀티모달 에이전트 벤치마크. 스크린샷 + 접근성 트리를 결합한 평가 환경이 이후 GUI 에이전트 연구의 표준이 됐다.
- 🔥 📖 [Nov 2024] "Large Language Model-Brained GUI Agents: A Survey" — GUI 에이전트의 지각·계획·행동 파이프라인과 주요 벤치마크를 정리한 서베이.

### Web Agents

- 🔥 [Jul 2024] "Tree Search for Language Model Agents" — 웹 탐색을 트리 탐색 문제로 재정의해 MCTS류 전략을 에이전트에 적용. 단순 그리디 탐색 대비 복잡한 멀티-스텝 웹 태스크에서 유의미한 성능 향상을 보인다.
- 🔥 [Jul 2025] "Agentic Web: Weaving the Next Web with AI Agents" — AI 에이전트가 웹의 구조와 경험 자체를 재편하는 미래상을 그린다. 기술 논문이라기보다 비전 페이퍼에 가깝지만, 웹 에이전트 연구의 방향성을 이해하는 데 유용하다.

### Mobile Agents

- 🔥 📖 [Nov 2024] "Foundations and Recent Trends in Multimodal Mobile Agents: A Survey" — 모바일 UI 조작을 위한 멀티모달 에이전트의 기반 기술과 최근 트렌드를 총정리.

---

## Software Agents

코드 생성·디버깅·테스트·리팩터링 등 소프트웨어 개발 생명주기 전반을 자동화하는 에이전트다. GitHub Copilot의 자동 완성에서 한 걸음 더 나아가, 이슈를 받아 PR을 완성하는 에이전트까지 포함된다.

- 🔥 📖 [Sep 2024] "Large Language Model-Based Agents for Software Engineering: A Survey" — 요구사항 분석부터 배포까지 SE 파이프라인 각 단계에서 LLM 에이전트의 현황을 정리. SWE-bench 같은 평가 데이터셋과의 연계도 다룬다.

---

## Data Agents

정형 데이터 분석, 시각화, 자연어 질의 응답을 수행하는 에이전트다. 데이터 사이언티스트의 반복 작업을 자동화하는 동시에, 비전문가도 데이터 인사이트에 접근할 수 있게 하는 것이 목표다.

- 🔥 [Sep 2024] "Data Analysis in the Era of Generative AI" — 생성 AI가 데이터 분석 워크플로우를 어떻게 바꾸는지를 체계적으로 분석. 코드 생성, 자연어 SQL, 자동 시각화 등 주요 패턴과 한계를 다룬다.

---

## Research Agents

과학적 가설 수립, 실험 설계, 결과 해석까지 연구 프로세스 자체를 자동화하려는 에이전트 분야다. AI Scientist 논문은 이 방향의 가장 야심찬 시도 중 하나다.

- 🔥 [Aug 2024] "The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery" — 주제 선정부터 실험 실행, 논문 초안 작성까지 전 과정을 자동화하는 AI 과학자 프레임워크. 아직 도메인이 제한적이지만, 연구 자동화의 가능성을 가장 구체적으로 보여준다.
- 🔥 📖 [May 2025] "From Reasoning to Learning: A Survey on Hypothesis Discovery and Rule Learning with Large Language Models" — LLM이 귀납적으로 규칙과 가설을 발견하는 능력을 다루는 서베이. 리서치 에이전트의 핵심 인지 능력에 해당한다.
- 🔥 [Oct 2024] "Agentic Information Retrieval" — 정보 검색을 단순 쿼리-응답이 아닌 능동적 탐색 과정으로 재정의. 에이전트가 검색 전략 자체를 설계한다.

---

## API Agents

문서화된 API를 이해하고 올바르게 호출하는 에이전트다. 실세계 소프트웨어 시스템의 대부분은 API로 연결되어 있어, 에이전트의 실용적 활용 범위를 결정하는 핵심 능력이다.

- ! [May 2023] [Gorilla: Large Language Model Connected with Massive APIs](https://arxiv.org/abs/2305.15334) — 1600개 이상의 API를 정확하게 호출하도록 파인튜닝된 LLM. 환각(hallucination) 감소를 위해 검색 증강 파인튜닝 방식을 적용한 초기 대표작.
- ! [Oct 2024] "Beyond Browsing: API-Based Web Agents" — 웹 브라우저 대신 REST API를 직접 호출하는 웹 에이전트. 브라우저 기반보다 효율적이지만 API 문서 이해 능력이 전제된다.
- 🔥 [Nov 2024] "WorkflowLLM: Enhancing Workflow Orchestration Capability of Large Language Models" — 복잡한 멀티-스텝 워크플로우를 LLM이 오케스트레이션하도록 능력을 강화하는 방법론.

---

## Agentic AI Systems

개인 보조 에이전트처럼 사용자의 디바이스, 일정, 개인 데이터에 접근하는 에이전트 시스템의 능력·효율성·보안을 다루는 카테고리다.

- 🔥 📖 [Feb 2024] "Personal LLM Agents: Insights and Survey about the Capability, Efficiency and Security" — 개인용 LLM 에이전트의 세 가지 핵심 축(능력·효율·보안)을 균형 있게 다루는 서베이. 스마트폰, 노트북, 스마트홈 등 실 사용 환경의 제약도 포함한다.

---

## Multi-Agents (별도 카테고리)

Agent Frameworks의 Multi-Agent 서브섹션과 별도로, 다중 에이전트 협업 자체를 독립 연구 주제로 다루는 서베이다.

- 🔥 📖 [Feb 2024] "Large Language Model based Multi-Agents: A Survey of Progress and Challenges" — 협업 구조(중앙집중·분산·계층), 소통 프로토콜, 역할 분담, 평가 방법론 등 다중 에이전트 시스템의 전반을 정리한 서베이.

---

## 마무리하며

이 리스트를 훑으면 에이전트 AI 연구의 진화 경로가 보인다. 2022~2023년은 ReAct, Toolformer, Gorilla처럼 "에이전트가 무언가를 할 수 있다"를 증명하는 시기였다. 2024년부터는 벤치마크(GTA, MMAU, OSWorld, Reflection-Bench)가 쏟아지고, 서베이 논문이 하위 필드를 정식 분과로 경계 짓기 시작했다. 2025년은 "자율 설계"와 "장기 진화"로 관심이 이동하는 중이다 — ADAS의 메타-에이전트, ExpeL의 경험 학습, AI Scientist의 연구 자동화가 그 방향을 가리킨다.

다음 읽을 거리로 두 편을 추천한다. 하나는 [SWE-bench](https://arxiv.org/abs/2310.06770) (2023) — 실제 GitHub 이슈를 해결하는 소프트웨어 에이전트를 평가하는 벤치마크로, 소프트웨어 에이전트 분야에서 가장 많이 인용되는 기준선이다. 다른 하나는 [AutoGen](https://arxiv.org/abs/2308.08155) (2023) — 다중 에이전트 대화 프레임워크로, 실제로 에이전트 시스템을 구현해보려는 독자에게 가장 빠른 입문 경로를 제공한다.

개인적으로 이 리스트를 정리하면서 가장 흥미로웠던 지점은 "자기 자신을 설계하는 에이전트"라는 개념이 2024년부터 구체적인 논문으로 나타나기 시작했다는 점이다. ADAS처럼 메타-에이전트가 하위 에이전트를 설계하고, ExpeL처럼 경험으로 행동 패턴을 업데이트하는 루프 — 이것은 단순한 툴 사용과는 질적으로 다른 무언가다. 아직 일반화 능력이 제한적이지만, 이 방향이 에이전트 AI의 다음 변곡점이 될 것으로 본다.

---

**참조 및 출처**

- [masamasa59/ai-agent-papers](https://github.com/masamasa59/ai-agent-papers)
- [Reddit r/LLMDevs: 10 Must-Read Papers on AI Agents from January 2025](https://www.reddit.com/r/LLMDevs/comments/1ifjs6n/10_mustread_papers_on_ai_agents_from_january_2025/)
