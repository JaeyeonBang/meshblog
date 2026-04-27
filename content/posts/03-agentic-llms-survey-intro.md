---
title: "Agentic Large Language Models, a survey, review: Intro"
date: 2025-11-19
tags: [AI Agent, NLP, LLM, ai-agent]
---
[[paper link]](https://arxiv.org/abs/2503.23037)


Agent AI에 발을 담구기에 앞서, 서베이 논문을 읽고자 합니다.


__*아래 내용은 간략하게 논문을 정리한 내용입니다. 정리, 번역, 표현에는 오류가 있을 수 있습니다.*__


# **1. Introduction**

![image.png](image.png)

* **Agentic LLM의 정의 및 역할:** Agentic LLM은 세상과 상호작용(Interact)하며, 새로운 경험적 데이터(empirical data)를 생성합니다.
* 이는 단순히 유용한 애플리케이션을 가능하게 하는 것을 넘어, LLM의 학습 데이터를 추가로 생성할 수 있는 기회를 제공합니다.
* **데이터 부족 문제 해결:** 기존 LLM 학습 데이터의 확장이 한계에 다다르고(plateauing), 학습 비용이 증가함에 따라 Agentic LLM의 중요성이 대두되었습니다.
* 에이전트가 추론, 행동, 상호작용하는 과정에서 생성된 데이터는 모델의 **Pre-training**이나 **Fine-tuning**에 활용되어 성능을 향상시키는 선순환(Virtuous Cycle)을 만듭니다.

![image.png](image%201.png)

* **모델 vs 에이전트:** ***"모델은 예측하는 반면, 에이전트는 추론(reason), 행동(act), 그리고 상호작용(interact)합니다."***.
* **핵심 역량:** 에이전트가 되기 위해서는 새로운 정보를 찾고, 반성(reflect)하고, 의사결정을 내리고, 소통할 수 있는 능력이 필요합니다.
* **자율성 (Autonomy):** 에이전트는 수동적(passive)인 모델과 달리, 환경의 변화를 감지하고 자신의 목표나 의지에 따라 행동할 수 있는 일정 수준의 자율성을 부여받습니다.

_[DEF] Agency: identity와 control에 관한 것이며, 자신의 목표나 의지에 따라 행동할 수 있는 능력을 의미합니다[Epstein and Axtell, 1996, Gilbert, 2019, Barker and Jane, 2016]._


## **1.3. LLM Training Pipeline**

LLM이 Agentic LLM으로 진화하기 위한 기반이 되는 학습 파이프라인은 다음과 같습니다 [Radford et al., 2019, Minaee et al., 2024].

* **데이터 수집 (Acquire Corpus):** 대규모의 일반 텍스트 코퍼스를 수집합니다.
* **사전 학습 (Pretrain):** 수집된 데이터를 바탕으로 모델을 자기 지도 학습(Self-supervised learning)시켜 일반적인 언어 능력을 갖추게 합니다.
* **미세 조정 (Finetune - SFT):** 레이블링된 데이터를 활용하여 특정 태스크(예: 번역, 질문 답변)나 도메인에 맞게 모델을 조정합니다.
* **지시 튜닝 (Instruction Tune):** 사용자의 프롬프트(지시)에 적절히 응답하는 능력을 향상시키기 위해 지도 미세 조정(Supervised Fine-tuning)을 진행합니다.
* **정렬 (Align):** 모델이 유해한 답변을 피하고 사용자의 기대와 사회적 기준에 부합하는 결과를 내도록 RLHF(Reinforcement Learning with Human Feedback)나 DPO(Direct Preference Optimization) 등을 통해 학습합니다.
* **최적화 (Optimize):** LoRA(Low-Rank Adaptation)와 같은 기법을 사용하여 학습 및 추론의 비용 효율성을 높입니다.
* **추론 (Infer):** 학습된 모델에 자연어 프롬프트를 입력하여 결과를 얻습니다. 이 단계에서는 모델의 파라미터가 업데이트되지 않는 **In-context learning**이 주로 일어납니다.

## **1.4. The Need for Agentic LLMs**

기존 LLM이 직면한 네 가지 주요 과제가 Agentic LLM의 등장을 이끌었습니다 

* **프롬프트 엔지니어링 (Prompt Engineering):** 모델은 프롬프트의 미세한 차이에도 민감하게 반응합니다. 사용자가 원하는 결과를 얻기 위해 프롬프트를 수동으로 반복 수정해야 하는 번거로움이 있으며, 이를 자동화할 필요가 있습니다.
* **할루시네이션 (Hallucination):** 그럴듯해 보이지만 사실이 아닌 정보를 생성하는 문제입니다. 이는 모델이 현실 세계에 대한 접지(grounding)가 부족하기 때문에 발생하며, 이를 완화하기 위한 검증 메커니즘이 필요합니다.
* **추론 능력 (Reasoning):** 초기 LLM은 수학 문제와 같은 복잡한 추론에 약했습니다. 이를 해결하기 위해 **시스템 2(System 2)** 사고와 유사한, 의도적이고 느린 단계적 사고 과정이 필요합니다.
* **학습 데이터 (Training Data):** 학습 이후에 발생한 사건이나 비공개 데이터베이스의 정보는 모델에 없습니다. 또한 정적인 데이터 세트만으로는 성능 향상에 한계가 있어, 에이전트의 활동을 통해 새로운 데이터를 생성해야 합니다.

**⇒ 결론적으로 이러한 필요성들이 추론(Reasoning), 도구 사용(Tools), 상호작용(Interaction)을 포함한 Inference-time in-context learning 기술의 발전을 이끌었습니다.**


## **1.5 Taxonomy**

![image.png](image%202.png)

Agentic LLM은 크게 세 가지 카테고리로 분류되며, 각 영역은 상호 보완적입니다.

* **지능적 (Intelligent - Reasoning):** 딥러닝과 상징적 AI(Symbolic AI) 전통을 결합하여 추론 능력을 강화합니다.
* 능동적 (Active - Acting):** 로봇이나 도구(Tools)를 통해 물리적 또는 디지털 세계에서 행동할 수 있게 합니다.
* **사회적 (Social - Interacting):** 다른 에이전트들과의 상호작용 환경에 배치되어 사회적 능력을 학습합니다.



**Reasoning (추론)**

![image.png](image%203.png)

이 카테고리의 목표는 의사결정 능력을 향상시키고, 수학 문제 해결력을 높이며, 최신 정보를 제공하는 것입니다.

**4.2. Acting (행동)**

목표는 현실 세계에서 실제적인 행동을 수행하여 사용자를 보조하는 것입니다.

![image.png](image%204.png)

**4.3. Interacting (상호작용)**

다중 에이전트 시뮬레이션을 통해 사회적 행동과 협력을 연구합니다.

![image.png](image%205.png)

_(이미지: 원본 사이트 참조)_
