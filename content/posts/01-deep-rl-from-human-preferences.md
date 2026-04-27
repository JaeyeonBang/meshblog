---
title: "Deep Reinforcement Learning from Human Preferences"
date: 2025-11-18
tags: [RL, NLP, LLM, neural-network]
image: "/meshblog/og/posts/01-deep-rl-from-human-preferences.svg"
---
RLHF: [**Deep reinforcement learning from human preferences**](https://arxiv.org/abs/1706.03741)

Instruct GPT: T[**raining language models to follow instructions with human feedback**](https://arxiv.org/abs/2203.02155)

# Introduction

- 특정 게임이나 바둑과 같이 **보상함수가 명확하게 정의**된 영역에서 강화학습은 성공을 거두었습니다.
- 그러나, **현실 세계의 복잡한 문제**들은 일반화된 보상함수로 정의되지 않습니다.(e.g. 테이블을 깨끗이 치우는 로봇을 훈련시키기 위한 보상함수는 어떻게…?; NLP 측면에서는… 고정관념이 덜한 모델을 훈련시키기 위한 보상함수를 어떻게 정의…?)

  => 논문 제시 방향: **인간이 시스템의 행동에 피드백**을 주고, 이 **피드백을 바탕으로 task**를 정의
- Specific한 reward function을 정의할 수 없는 상황에서, **Human feedback으로부터 reward function/model을 배우고** 최적화함

  - 행동을 설명(demonstrate)할 수는 없더라도, **인식할 수 있는 과제**를 해결,
  - **non-expert** user에 의해 에이전트가 학습
  - 큰 문제로 확장 가능
  - 사용자 피드백을 **효율적(경제적)**으로 사용한다.

## Preliminaries

- observation: $o_t\in O$ from environment; 환경으로부터의 관측을 의미합니다.
- action: $a_t\in A$ to environment; 환경에 대한 행동을 의미합니다.
- trajectory segment (궤적 구간?)
  $\sigma = ((o_0, a_0), (o_1, a_1), \dots, (o_{k-1}, a_{k-1})) \in (O \times A)^k$
  관측과 행동의 연속을 의미합니다.
- $\sigma^1 \succ \sigma^2$: 사람이  $\sigma^1$ 를  $\sigma^2$보다 선호한다는 것을 의미합니다.
- Agent는 사람이 선호하는 **$\sigma^1$ 를 생성하는 것을 목표로 하고 있습니다.**

<br>

**알고리즘의 행동에 대해 평가하는 방식**으로는 두 가지가 있습니다.

- 양적 평가

  - 정량적으로 평가할 수 있는 보상함수가 있는 경우
  - 이러한 선호 "$\succ$"가 $r : O \times A \to \mathbb{R}$ 이라는 reward function에 의해서 결정된다면

    $r(o_0^1, a_0^1), r(o_1^1, a_1^1), \dots, r(o_{k-1}^1, a_{k-1}^1) > r(o_0^2, a_0^2), r(o_1^2, a_1^2), \dots, r(o_{k-1}^2, a_{k-1}^2)$

    일때,

    $((o_0^1, a_0^1), (o_1^1, a_1^1), \dots, (o_{k-1}^1, a_{k-1}^1)) \succ ((o_0^2, a_0^2), (o_1^2, a_1^2), \dots, (o_{k-1}^2, a_{k-1}^2))$

    이다
- 질적 평가

  - 행동을 정량적으로 평가할 수 있는 보상 함수가 없는 경우
    (논문의 접근 방식이 실용적으로 유용한 상황).
  - 이러한 경우, 에이전트가 인간의 선호도를 얼마나 잘 만족시키는지를 정성적으로 평가
  - 자연어로 표현된 목표에서 시작하여, 인간에게 에이전트의 비디오를 보며, 행동을 평가

# Method

- Policy  $\pi : O \to A$  (e.g. LLM 모델) ; 관측으로부터 행동을 도출하는 모델, 정책을 의미합니다.
- reward function estimate $\hat{r} : O \times A \to \mathbb{R}$ (Reward Model) ; 보상 함수는 관측과 행동을 바탕으로 실수 범위의 보상을 도출합니다.

  ![image.png](image.png)

**Process**

1. $\pi$는 환경과 상호작용하며,  trajectory { ${\tau^1, \tau^2, \tau^3 ...}$}를 생성합니다.
   $\pi$는 $\hat{r}$ 극대화를 위해, 전**통적인 강화학습 알고리즘을 통해 학습합니다다**
2. 그 다음, trajectory { ${\tau^1, \tau^2, \tau^3 ...}$}로부터 $(\sigma^1,  \sigma^2)$ 쌍을 추출, **Human 평가자**에게 제시합니다.
   Human 평가자는 메뉴얼에 따라 평가를 진행합니다.
3. **Human의 feedback을 바탕으로 $\hat{r}$이 최적화**됩니다.

- 이 프로세스는 비동기적으로 작동, 1→2 , 2→3, 3→1 <br>

<details markdown="1">

<summary>InstructGPT 에서는 어떻게 이러한 아이디어가 반영되었을까?</summary>

![image.png](image-1.png)

- **1단계: 시연(demonstration) 데이터를 수집하고, 지도 학습 정책(supervised policy)을 훈련**

  - 레이블러(labeler)들은 입력 프롬프트 분포에 대해 원하는 행동의 시연을 제공
  - 이 데이터를 사용하여 사전 훈련된 GPT-3 모델을 지도 학습(supervised learning)을 통해 fine-tune.
- **2단계: 비교 데이터를 수집, 보상 모델(reward model)을 훈련.**

  - 모델 출력 간의 비교 데이터셋을 수집,
  - 레이블러들은 주어진 입력에 대해 어느 출력을 선호하는지 표시
  - 인간이 선호하는 출력을 예측하도록 보상 모델을 훈련합니다.
- **3단계: PPO를 사용하여 보상 모델에 대해 정책을 최적화합니다.**

  - 보상 모델(RM)의 출력을 스칼라(scalar) 보상으로 사용
  - PPO 알고리즘(Schulman et al., 2017)을 사용하여, 보상을 최적화하도록 (1단계의) 지도 학습된 policy를 fine-tune.

</details>

<br><br>

- Optimizing the Policy ← **기존 강화학습 알고리즘**을 통해 업데이트

  - Atari games: advantage actor-critic
  - robotics tasks: region policy optimization (TRPO; Schulman et al., 2015)
  - <details markdown="1">
    <summary>Instruct GPT에서의 강화학습 알고리즘</summary>

    - InstructGPT에서는 **PPO-ptx**라는 알고리즘을 통해 강화학습을 진행합니다.

    $$
    objective(ϕ)=E_{(x,y)∼D_π{_ϕ}RL}[r_θ(x,y)−βlog(π^{RL}_ϕ(y∣x)/π^{SFT}(y∣x))]+γE_{x∼D_{pretrain}}[log(π^{RL}_ϕ(x))

    $$

    - $E_{(x,y)∼D_π{_ϕ}RL}$ :  ϕ를 가진 강화 학습 모델에 x라인 입력 문장을 넣었을 때 y가 나온 상황에서의 기대값
    - $r_θ(x,y)$: 학습된 reward model
    - $βlog(π^{RL}_ϕ(y∣x)/π^{SFT}(y∣x))]$ : Supervised fine-tune된 모델과 강화학습 모델간의 차이 → 이 차이가 너무 크면 학습이 되지 않도록 하는 제약 항 (0.8~1.2 일때만 학습)
    - $γE_{x∼D_{pretrain}}[log(π^{RL}_ϕ(x))$ : 강화학습 모델에서 x가 나올 확률

    </details>
    <br>
    <br>
- **Preference Elicitation**

  - 평가자들은 1-2초 간의 trajectory segment을 전달받습니다.
  - $D$(Database)에 $(\sigma^1, \sigma^2, \mu)$ 저장합니다 - $\mu$: {1,2}에 대한 분포
  - **InstructGPT**- 평가자들은 K = 4 ~ 9 사이의 비교군을 전달받고,
    - $_kC_2$의 비교 segment(prompt)를 진행하여, 이를 모델에 학습시킴
      <br><br>
- **Fitting the Reward Function**

  ![image.png](image-2.png)

  - $\hat{P}[\sigma^1 \succ \sigma^2]$ : $\sigma^1$을 $\sigma^2$에 비해 선호할 확률

  ![image.png](image-3.png)

  - **cross-entropy loss를 줄이는 것을 목표로 $\hat{r}$를 업데이트합니다.**
  - **InstructGPT**

    $loss(θ)=−1/(_kC_2)E_{(x,y_w,y_l)∼D}[log(σ(r_θ(x,y_w)−r_θ(x,y_l)))]$

    - $(x,y_w,y_l)∼D:$  $(x,y_w,y_l)$를 데이터 분포에서 추출,
      input: x ; output = w , l
    - $(r_θ(x,y_w)−r_θ(x,y_l))$: 는 두 출력 문장의 reward 차이
      <br>
  - **Reward prediction Models:**

    - Robotics:  two layer neural network with 64 hidden units each, using leaky ReLUs
    - Atari: 4 convolutional layers
    - **InstructGPT: Fine-tuned GPT**
  - 앙상블 활용
  - L2 정규화 사용, drop out 활용
  - 소프트맥스(softmax)를 직접 적용하는 대신, 우리는 인간이 10%의 확률로 무작위로 균등하게 응답한다고 가정합니다
- **Selecting Queries**

  **앙상블 모델들 간 편차가 큰 쌍**을 인간 평가자에게 제시하여 피드백을 받습니다.

  → 모델이 모르는 부분에 대한 피드백을 받을 수 있습니다.
- **Contractor**

  - 전문가가 아닌 **일반인**
  - 1-2초 길이의 비디오 클립을 비교합니다.
    <br><br>

# Results

- 조건 1: Agent가 true reward 없이, **human feedback**만으로 학습한 조건
- 조건 2: **컴퓨터(Orcale)이 두** trajectory segment**의 'true reward'에 접근, 비교**하여, 점수가 더 높은 쪽을 "선호"한다고 응답 → 실수가 없는 인간이 feedback을 주는 것을 가정한 조건
- 조건 3: **실제 강화학습 reward**를 활용한 방식 ← Gold standard
  <br>

### Simulated Robotics

![image.png](image-4.png)

- 단 700개의 **인간 피드백** 만으로 훈련된 에이전트가 실제 보상으로 훈련된 **RL 기준선에 거의 근접**하는 성능을 달성했습니다. 이는 인간의 피드백의 정보 밀도가 높음을 시사합니다.
- 1400개의 가상 피드백으로 학습한 경우, 일부 태스크에서는 실제 보상으로 직접 학습한 기준선보다 오히려 약간 더 높은 성능
- 보상 함수보다 더 '잘 형성된(better-shaped)' 형태를 가질 수 있음을 암시,
  예를 들어, 최종 목표 달성에 도움이 되는 **중간 단계의 행동들에도 긍정적인 보상**을 할당함으로써, **학습 과정을 더 원활하게 진행합니다.**
- 인간 피드백이 가상 피드백을 능가하는 이례적인 결과를 보이기도 합니다.
  <br>

### Atari

![image.png](image-5.png)

- 가상 피드백을 사용한 학습이 기준선 RL 성능에 근접
- 실제 인간 피드백은 동일한 수의 가상 피드백보다 **다소 낮은** 성능을 보입니다.
- 'Enduro':
  - 이 게임은 **무작위 서치**만으로는 다른 차를 추월하는 **성공적인 경험을 하기가 매우 어려워**, 기준 RL 알고리즘(A3C)이 학습에 어려움을 겪습니다.
  - 하지만 인간 평가자는 에이전트가 다른 차를 추월하려는 **'시도'만 보여도 긍정적인 피드백**을 주는 경향이 있다.
  - 이러한 인간의 의도 기반 평가는 효과적인 보상 형성으로 작용하여, **희소한 보상 신호 문제를 해결**하고 에이전트가 기준선을 능가하는 성능을 보이도록 도움을 줍니다

    ![image.png](image-6.png)

    <br><br>

# Novel behaviors

**backflip**

- **보상** 함수를 수동으로 설계하려면, 수많은 변수를 정교하게 조합해야 하지만, **인간은 이를 직관적으로 선택**할 수 있어 간단한 피드백만으로 충분하였습니다
- Ablation Studies

  - random queries: 쿼리를 무작위로 균등하게 선택
  - no ensemble
  - **no online queries**: 훈련 전반에 걸쳐 수집하는 대신, **훈련 시작 시에만 수집된 쿼리**로 훈련
  - no regularization: L2 정규화 제거
  - target: 비교하여 $\hat{r}$ 을 학습시키는 대신, MSE를 사용하여 학습시킴

  ![image.png](image-7.png)

  ![image.png](image-8.png)

  - '온라인 쿼리 없음(no online queries)' 조건이 **크게 실패하였습니다.**
  - 무작위적으로 초기화 된 초기 상태 공간과, 어느 정도 학습이 진행된 상태 공간이 매우 다름을 의미할 수 있으며,

    → 보상 모델과 정책이 반드시 **상호작용적으로(interactively)**, 함께 진화해야 한다는 것을 시사합니다.


# In My opinion


- 강화학습과 관련하여 처음 읽은 논문이었습니다.
- 인간의 주관을 강화학습에 활용하였을 때, 복잡한 task에 대한 학습이 잘 된다는 것이 흥미로웠습니다.


<br>references

[https://taeyuplab.tistory.com/10](https://taeyuplab.tistory.com/10)

_(이미지: 원본 사이트 참조)_
