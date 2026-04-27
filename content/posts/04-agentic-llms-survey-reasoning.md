---
title: "Agentic Large Language Models, a survey, review: Reasoning"
date: 2025-11-19
tags: [AI Agent, NLP, LLM, ai-agent]
category: ai
image: "/meshblog/og/posts/04-agentic-llms-survey-reasoning.svg"
---
[[paper link]](https://arxiv.org/abs/2503.23037)

Intro에 이어 Reasoning 파트를 정리하고자 합니다.

특정 내용에 대해 자세하게 다루기보다, "이러한 개념이 현재 활용되고 있구나"에 초점을 맞추어 리뷰합니다.

__*아래 내용은 간략하게 논문을 정리한 내용입니다. 정리, 번역, 표현에는 오류가 있을 수 있습니다.*__


# Reasoning

## 2.1 Multi Step Reasoning

### 2.1.1 CHAIN OF THOUGHT STEP-BY-STEP

![image.png](image%206.png)

- **CoT의 효과:** LLM에게 답변을 내놓기 전에 질문의 정보를 재구성하여 중간 추론 단계를 거치도록 프롬프트하면, 중간 단계 없이 바로 답을 하도록 했을 때보다 수학 문제 해결 등에서 훨씬 더 좋은 성능을 보였습니다.
- **Zero-shot CoT:** "단계별로 생각해보자(Let's think step-by-step)"라는 간단한 문구를 프롬프트에 추가하는 것만으로도 성능이 크게 향상됩니다.
- **할루시네이션 문제:** 그러나 추론 단계가 길어질수록 오류가 누적되어 할루시네이션(Hallucination)이 증가하는 문제가 발생합니다.
- **검증 방법 (Self Consistency):** 오류 누적을 방지하기 위한 검증 방법이 필요하며, 대표적인 접근법이 Self Consistency입니다.
- **Self Consistency의 원리:** 이는 앙상블(ensemble) 접근 방식으로, 다양한 추론 경로를 샘플링하고 이를 평가한 뒤, 다수결 투표(majority voting)를 통해 가장 일관된 답변을 선택합니다. 이 방법은 벤치마크 테스트에서 CoT의 성능을 10-20% 향상시킵니다.

### 2.1.2. INTERPRETER AND DEBUGGER

- **형식 언어로의 변환:** 수학적 또는 형식적 추론이 필요한 문제를 해결할 때는 문제를 수학 수식이나 프로그래밍 언어로 재구성하는 것이 유리할 때가 많습니다.
- **PoT와 PAL:** Program of Thought (PoT) 와 Program Aided Language (PAL) 은 형식 언어를 사용하는 대표적인 접근법입니다[Chen et al., 2022][Gao et al., 2023b]. 두 방식 모두 Python 코드를 생성하고 Python 인터프리터를 사용하여 결과를 평가합니다.
- **Self Debugging:** 생성된 코드에 피드백을 제공하기 위해 디버거(Debugger)를 활용할 수 있습니다. Self Debugging는 LLM에게 자신이 생성한 프로그램 코드를 디버깅하도록 가르치며, 코드 생성, 실행, 설명의 단계를 거칩니다 .
- **자동화된 코드 최적화:** 인간의 피드백 없이 특정 문제를 해결하기 위해 코드를 자동으로 생성하고 튜닝하는 연구들도 있습니다.
  - **FunSearch:** 유전 알고리즘(Genetic Algorithm)을 사용하여 수학적 추론과 코드 생성을 향상시키는 접근법입니다.
  - **LLaMEA:** 진화 연산(Evolutionary Computation)을 활용하여 최적화 알고리즘을 자동으로 생성합니다.
  - **PDDL Planning:** 블록 쌓기(Blocksworld)와 같은 계획 수립 문제에서 PDDL(Planning Domain Definition Language)을 벤치마크로 사용하여 LLM의 계획 능력을 연구합니다.

    
    ![image.png](image%207.png)
    

### 2.1.3 SEARCH TREE

- **탐색의 필요성:** Chain of Thought는 단일 단계만 고려하는 탐욕적(greedy) 방법입니다. 다음 단계에 대한 가능성이 여러 개일 때는 최적의 경로를 선택하기 어렵습니다.
- **Tree of Thoughts (ToT):** 이 방식은 외부 제어 알고리즘을 사용하여 LLM이 추론 단계의 트리(tree)를 따라가도록 합니다. 너비 우선 탐색(BFS)이나 깊이 우선 탐색(DFS)을 통해 추론 경로를 체계적으로 탐색하고 백트래킹(backtracking)을 수행합니다.
      
      ![image.png](image%208.png)
- **다양한 탐색 기법:** 계획 수립 및 트리 탐색 기법, 유전 알고리즘 등을 활용하여 가능한 추론 단계의 조합을 탐색합니다.
- **Graph of Thoughts:** 트리 구조를 넘어 더 복잡한 추론 단계 간의 관계(그래프 구조)를 허용하는 접근 방식입니다.
- **Stream of Search (SoS):** 외부 탐색 알고리즘의 결과를 학습 데이터로 사용하여, LLM이 외부 루프 없이도 내부적으로 탐색 과정을 수행하도록 학습시키는 방법입니다.

## 2.2 Self Reflection

- **개요:** 단계별 문제 해결 방식에서 영감을 받아, 명시적인 계획 수립(planning-like) 방법론을 통해 미래를 예측하고 피드백을 검증에 활용합니다.
- **자기 성찰의 정의:** 이러한 프롬프트 개선 루프는 모델이 자신의 결과를 평가하고 개선한다는 점에서 자기 성찰(self reflection)의 형태를 띱니다.
- **작동 방식:** 외부 알고리즘이 LLM을 사용하여 자신의 예측을 평가하고, 더 나은 답변을 도출하기 위해 새로운 프롬프트를 생성합니다. 이 개선 루프는 LLM 외부의 메모리를 사용하여 상태를 추적합니다 .

### 2.2.1 PROMPT-IMPROVEMENT

- **Progressive Hint Prompting (PHP):** 대화형으로 프롬프트를 개선하기 위한 강화학습 접근 방식입니다.
- **과정:** (1) 질문(프롬프트)이 주어지면 LLM이 기본 답변을 제공하고, (2) 질문과 답변을 결합하여 다시 LLM에 쿼리하여 후속 답변을 얻습니다. (3) 답변이 안정화(converge)될 때까지 이 작업(2)을 반복합니다 .

### 2.2.2 USING LLMS FOR SELF REFLECTION

- **인간의 성찰 모방:** 추론 시간에 프롬프트를 반복적으로 최적화하는 과정은 인간의 자기 성찰과 유사합니다.
      
      ![image.png](image%209.png)
      
      ![image.png](image%2010.png)
- **Self Refine:** LLM으로부터 피드백을 획득하여 답변을 반복적으로 개선하는 방식입니다[Madaan et al., 2023].
- **3단계 프롬프트:** Self-refine은 (0) 초기 생성(initial generation), (1) 피드백(feedback), (2) 정제(refinement)의 세 가지 방식으로 반복하며 개선합니다

**Reflexion**

- **ReAct와 발전:** ReAct  접근법을 기반으로 하며, 이를 더욱 발전시킨 것이 Reflexion 입니다.
- **목표:** 인간처럼 실패를 반성(reflect)함으로써 결과를 향상시키는 에이전트를 만드는 것입니다.
- **구조:** Reflexion은 (1) 텍스트와 행동을 생성하는 **Actor**, (2) Actor의 출력을 점수 매기는 **Evaluator**, (3) Actor가 스스로 개선할 수 있도록 언어적 강화 신호를 생성하는 **Self-Reflection Model**로 구성됩니다 .

![image.png](image%2011.png)

- **Self Discover:** 에이전트가 문제를 분석하고, 어떤 프롬프트가 가장 효과적인지 스스로 발견(discover)하여 문제에 맞게 프롬프트를 조정하고 정제하는 방식입니다[Zhou et al., 2024a]. 이 과정에서 PromptBreeder와 같은 데이터셋을 활용합니다.
- **기타 접근법:** 메타 러닝(Meta-learning) 접근법[Huisman et al., 2021] , 생각의 버퍼를 활용하는 **Buffer of Thoughts** , 그리고 **Meta Chain of Thought** [Xiang et al., 2025] 등이 있습니다.

**Intrinsic Reasoning (내재적 추론)**

- **외부 vs 내부:** 모델 외부에 있는 명시적인 추론 알고리즘과 달리, 내재적 추론은 모델 자체가 훈련된 아키텍처 내에 통합된 추론 능력을 갖추는 것을 의미합니다.
- **DeepSeek-R1:** DeepSeek-R1 개발 과정에서 제안된 방식이 대표적입니다.
- **특징:** 이 방법은 모델이 스스로 생성한 추론 단계(self-generated reasoning steps)를 강조하며, 강화학습을 통해 데이터 생성과 훈련을 하나의 루프로 통합합니다.
- **GRPO:** DeepSeek는 GRPO(Group Relative Policy Optimization)를 사용하여 별도의 Critic 모델 없이 그룹 기반 점수 산정으로 이점을 계산합니다[Shao et al., 2024].
- DeepSeek 접근법의 핵심 특징 중 하나는 정교한 추론 행동의 emergence입니다. 예를 들어, 반성(reflection)이나 대안적 문제 해결 방법 탐색과 같은 행동이 강화학습 과정에서 자연스럽게 나타납니다.

## 2.3 Retrieval Augmentation

- **최신 정보의 부재 해결:** LLM은 학습 데이터에 포함되지 않은 최신 정보나 전문적인 정보를 알지 못합니다. 검색 증강(Retrieval Augmentation)은 추론 시점에 외부 정보를 검색하여 모델을 보강합니다.
- **RAG (Retrieval Augmented Generation):** 외부 지식 베이스의 데이터를 사전 학습된 언어 모델의 파라미터에 저장된 지식과 통합하는 방법입니다.
- **데이터 소스:** 대부분의 RAG 접근 방식은 비정형 텍스트 데이터 소스를 다루며, 이를 인덱싱하여 효율적으로 접근합니다.
- **쿼리 최적화:** 데이터베이스 스타일의 쿼리 최적화가 수행되기도 하며, 복잡한 쿼리를 하위 쿼리로 분할하거나 확장합니다.
- **Adaptive Retrieval:** LLM이 언제 정보를 검색해야 할지 스스로 판단하게 하는 적응형 검색 방법입니다. 이는 자기 성찰(Self Reflection)과 연관되어 추론 시점에 검색 필요성을 판단합니다.

## 2.4 Discussion

### 2.4.1 THINKING, FAST AND SLOW

- **시스템 1 vs 시스템 2:** 추론 시점의 순수 LLM은 직관적이고 빠른 사고(System 1)를 합니다. 여기에 추론 시점의 단계별 방법론을 추가하면 **의도적이고 느린 사고(System 2)**를 구현할 수 있습니다 .
- **토큰 예측으로서의 추론:** 연구자들이 LLM을 의인화하기도 하지만, LLM은 단지 다음 토큰을 예측할 뿐입니다. 단계별 추론(Reasoning)을 통해 답변을 생성하는 토큰 경로가 길어지는데, 이는 정답을 향해 작은 단계들을 거쳐 가면서 정답의 생성 확률을 높이는 과정으로 해석할 수 있습니다.

### 2.4.3 INTERPRETABILITY

- **블랙박스 해석:** 신경망 아키텍처 내부의 **블랙박스를 여는 것**은 중요한 연구 주제입니다. 수십억 개의 뉴런이 어떻게 표현을 임베딩하고 추론하며 결론에 도달하는지 이해하고자 합니다.
- **정적 분석 방법:** 입력 이미지가 출력 클래스로 매핑되는 과정을 설명하기 위해 Feature maps 을 사용하거나, 구조화된 데이터에 대해 Counterfactual analysis , LIME , SHAP  등을 사용하여 입출력 관계를 설명합니다.
- **동적 분석 (Mechanistic Interpretability):** 최근에는 모델이 동적으로 결론에 도달하는 메커니즘을 밝히려는 기계적 해석가능성(Mechanistic Interpretability) 연구가 활발합니다. 여기에는 Sparse Autoencoders, Neural Lenses, Circuit Discovery 등의 방법이 사용됩니다[Nanda et al., 2023, Bereska and Gavves, 2024, Ferrando et al., 2024, Rai et al., 2024].

### 2.4.4 USE CASE: BENCHMARKS

- **Agentic LLM의 기반:** Agentic LLM은 트랜스포머 기반 LLM의 강력한 성능 위에 Chain of Thought와 같은 다단계 추론 방법을 결합하여 구축됩니다.
- **두 가지 핵심 기술:**
  1. **강화학습과 자기 성찰:** 에이전트가 피드백 루프를 통해 자신의 행동으로부터 학습하는 강화학습의 도입은 LLM의 자기 성찰(Self Reflection)에 영감을 주었습니다. 자기 성찰은 프롬프트를 개선하고 할루시네이션을 줄입니다.
  2. **도구 사용과 검색 증강:** 검색 증강(Retrieval Augmentation)과 도구(Tools)의 도입은 LLM이 최신 정보를 다루고 오류를 확인하는 능력을 향상시켜, 단순한 의사결정을 넘어 실제 세계에서 행동하는 에이전트로 나아가는 다리가 됩니다.
     """

# In my opinion

- Agent의 Reasoning과 관련하여, 최신 연구 동향과 흐름을 살펴볼 수 있었습니다.
- 모델 스스로 reflect하고 교정할 수 있는 방식을 강화학습을 통해 LLM에게 학습시킬 수 있다는 것은, LLM이 그 자체로 진화할 수 있는 분기점 중 하나로 여겨질 수 있다고 생각했습니다.
- CoT와 관련하여, "실제로 LLM이 생각을 하여 답변하는 것인가?"와 관련한 여러 논의가 있는 것 같습니다.
- LLM은 이전의 분포를 토대로 다음 토큰을 predict하며, 그럴듯한 결과물을 도출하기 때문입니다.
  <br><br>
- 심리학을 공부한 입장에서 생각해 보았을 때, 인간이 생각하는 과정도 이전의 분포를 토대로 다음을 결정하는 과정과 동일하다고 볼 수 있지 않을까? 라는 생각이 들었습니다.
- 인간도 인생을 살아오면서 겪어온 경험을 통해 schema를 형성하게되고, 자신이 지니고 있는 schema에 따라 행동을 하게 됩니다.
- 인간의 이성적인 판단도 사전 확률 분포에 의존하여 이후의 결과물을 산출하는 것으로 볼 수 있으며,
- 이 과정을 '생각'이라고 지칭한다면, LLM이 답변을 내놓은 과정 또한 '생각'이라고 볼 수 있지 않을까요?

_(이미지: 원본 사이트 참조)_
