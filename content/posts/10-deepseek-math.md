---
title: "DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models"
date: 2026-01-03
tags: [RL, NLP, LLM, neural-network]
image: "/meshblog/og/posts/10-deepseek-math.svg"
---
[[paper link]](https://arxiv.org/abs/2402.03300)

### 한 줄 설명

Common Crawl에서 정교하게 마이닝한 **120B 토큰의 수학 말뭉치**와, PPO의 메모리 비용을 획기적으로 줄인 강화학습 기법 **GRPO**를 통해 7B 파라미터 모델로 GPT-4급의 수학적 추론 성능을 달성

### 연구 목표

기존 PPO(Proximal Policy Optimization)가 거대한 비평가(Critic/Value) 모델을 필요로 하여 메모리 비효율적인 문제를 해결하고, 수학적 추론에 특화된 강화학습 알고리즘을 개발하는 것을 목표

### 기존 연구의 한계

- **데이터 품질 및 규모 부족:** 기존의 수학 말뭉치(MathPile, OpenWebMath 등)는 규모가 작거나 다양성이 부족하여 모델의 잠재력을 충분히 끌어내지 못함
- **PPO의 자원 소모:** 표준 PPO 알고리즘은 정책 모델(Policy Model)과 거의 동일한 크기의 가치 모델(Value Model; critic model)을 학습시켜야 하므로 메모리와 연산 비용이 매우 큼

### 데이터셋

- DeepSeekMath Corpus:  **120B 토큰** 규모의 고품질 수학 말뭉치

### 방법론

- **Supervised Fine-Tuning (SFT):** Chain-of-Thought(CoT), Program-of-Thought(PoT), 도구 사용(Tool-integrated reasoning) 데이터를 포함한 776K 개의 샘플로 미세 조정을 수행
- GRPO (Group Relative Policy Optimization)
    
    ![image.png](/assets/img/DeepSeekMath/image.png)
    
    - PPO와 달리 가치 함수(Value Function)를 근사하는 별도의 모델을 사용하지 않음
    - 대신, 동일한 질문 q에 대해 G개의 출력 그룹 ${o_1, o_2, ..., o_G}$을 샘플링
    - 그룹 내 출력들의 보상 평균과 표준편차를 사용하여 각 출력의 이점(Advantage)을 계산
    
    ![image.png](/assets/img/DeepSeekMath/image%201.png)
    
    - Reward: reference model과의 비교를 통해 reward를 제한함
    
    ![image.png](/assets/img/DeepSeekMath/image%202.png)
    
    - Advantage = normalized reward
    
    ![image.png](/assets/img/DeepSeekMath/image%203.png)
    
    - GRPO Object
    
    ![image.png](/assets/img/DeepSeekMath/image%204.png)
    

### 사용한 평가 지표, 벤치마크

- GSM8K, MATH, MMLU-STEM, SAT, OCW Courses.

### 인사이트

- **코드 학습이 수학을 돕는다:** 코드 데이터로 사전 학습을 하는 것이 일반 텍스트로만 학습하는 것보다 수학적 추론 능력을 크게 향상. 이는 코딩의 논리적 구조가 수학적 사고와 연결됨을 시사.
- **ArXiv 논문은 만능이 아니다:** ArXiv 논문 데이터만으로는 수학적 추론 능력 향상에 큰 효과가 없음. 오히려 웹에서 정제된 비공식적이고 설명적인 수학 텍스트가 더 유용,
- **RL의 역할 (Maj@K vs Pass@K):** 강화학습(RL)은 모델의 근본적인 지식 총량(Pass@K)을 늘리기보다는, 모델이 정답을 일관되게 출력하도록 **출력 분포를 견고하게 만드는 역할(Maj@K 향상)**

![image.png](/assets/img/DeepSeekMath/image%205.png)

- **GRPO의 효율성:** 비평가 모델 없이 그룹 샘플링만으로 베이스라인을 추정하는 GRPO는 **메모리 제약이 있는 환경에서 고성능 모델을 튜닝하는 데 매우 유용한 대안**

_(이미지: 원본 사이트 참조)_
