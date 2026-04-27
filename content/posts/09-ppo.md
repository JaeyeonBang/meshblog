---
title: "PPO 개념 간단 요약"
date: 2025-12-03
tags: [RL, NLP, LLM, neural-network]
category: ai
image: "/meshblog/og/posts/09-ppo.svg"
---
[[paper link]](https://arxiv.org/abs/1707.06347)

# Introduction

- 기존 강화학습 방법론의 한계
    - **Deep Q-learning:** 함수 근사(Function approximation)를 사용할 때 단순한 문제에서도 실패
    - **Vanilla Policy Gradient (기본 정책 그라디언트):** 데이터 효율성이 낮고(데이터가 많이 필요함), 견고성(Robustness)이 떨어짐
    - **TRPO (Trust Region Policy Optimization):** 데이터 효율적이고 안정적이지만, 알고리즘이 복잡, 또한, 노이즈(Dropout 등)를 포함하는 아키텍처나 정책(Policy)과 가치 함수(Value function) 간의 파라미터 공유 모델에는 적용하기 어렵습니다
- PPO의 제안 및 목표 (Proposal)
    - 1차 최적화(First-order optimization)만을 사용
    - **새로운 목적 함수 (Novel Objective):** "클리핑된 확률 비율(Clipped probability ratios)"을 사용
    - 정책 성능의 하한선(Lower bound)을 비관적으로 추정하여, 정책이 과도하게 변하는 것을 방지
    - 정책에서 데이터를 샘플링한 후, 그 데이터를 버리지 않고 여러 에포크(Epoch) 동안 반복해서 최적화를 수행

# 2 Background: Policy Optimization

## 2.1 Policy Gradient Methods

- 정책 그라디언트 방법은 **정책 그라디언트의 추정량(estimator)을 계산하고, 이를 확률적 경사 상승법(Stochastic Gradient Ascent) 알고리즘에 적용**
    - 경사 상승법….? → 강화학습모델에서는 기대 보상을 최대화하는 것이 목표 
    (vs. 딥러닝: 정답과 예측값 사이의 오차를 줄이는 것이 목표)
    
    $$
    \hat{g} = \hat{\mathbb{E}}_t [\nabla_{\theta} \log \pi_{\theta}(a_t | s_t) \hat{A}_t]
    $$
    
- $\pi_{\theta}$ **(확률적 정책):** 현재 상태 $s_t$에서 행동 $a_t$를 할 확률입니다
- $\hat{A}_t$ (어드밴티지 추정량): 선택한 행동 $a_t$가 평균적인 행동보다 얼마나 더 좋은지
- $\hat{\mathbb{E}}_t [...]$ 데이터 샘플 배치에 대한 평균
- 어드벤티지(reward, 보상)이 높은 행동의 확률을 높이는 방향으로 파라미터를 업데이트

- 실제 구현시에는 objective function을 정의하여 사용함

$$
L^{PG}(\theta) = \hat{\mathbb{E}}_t [\log \pi_{\theta}(a_t | s_t) \hat{A}_t]
$$

- 이를 미분하면 $\hat{g}$를 구할 수 있음
- 기존 방식( $L^{PG}$ )대로 데이터를 재사용하여 여러 번 학습을 시키면, 정책이 너무 급격하게 변해서 오히려 학습이 망가지는 현상이 발생한다는 것입니다.

## 2.2 Trust Region Methods

- TRPO는 정책을 업데이트할 때 "너무 많이 변하지 말라"는 제동 장치 설정

$$
\hat{\mathbb{E}}_t \left[ \frac{\pi_{\theta}(a_t | s_t)}{\pi_{\theta_{old}}(a_t | s_t)} \hat{A}_t \right]
$$

정책의 변화량이 $\delta$보다 커지면 안 된다는 제약조건 형성

$$
\hat{\mathbb{E}}_t [\text{KL}[\pi_{\theta_{old}}(\cdot | s_t), \pi_{\theta}(\cdot | s_t)]] \le \delta
$$

- 패널티 항을 뺌으로써 간소화

$$
\text{maximize } \hat{\mathbb{E}}_t \left[ \frac{\pi_{\theta}(a_t | s_t)}{\pi_{\theta_{old}}(a_t | s_t)} \hat{A}_t - \beta \text{KL}[\pi_{\theta_{old}}, \pi_{\theta}] \right]
$$

- $\beta$는 페널티의 강도를 조절하는 계수
- 그러나, 단순히 고정된 $\beta$를 사용하여 SGD로 최적화하는 것만으로는 안정적인 성능을 낼 수 없다

따라서 PPO는 다음과 같은 목표를 가집니다:

1. TRPO처럼 안정적으로 정책이 조금씩만 변하도록 보장하고 싶다. (Monotonic improvement)

2. 하지만 TRPO처럼 복잡한 2차 최적화(Conjugate Gradient)는 쓰기 싫다. (First-order algorithm 선호)

3. $\beta$를 일일이 튜닝하는 것도 피하고 싶다.

# 3 Clipped Surrogate Objective

확률 비률: 

$r_t(\theta) = \frac{\pi_{\theta}(a_t | s_t)}{\pi_{\theta_{old}}(a_t | s_t)}$

- $\pi_{\theta}$: 업데이트하려는 새로운 정책
- $\pi_{\theta_{old}}$: 데이터를 수집할 때 사용했던 이전 정책
- $r_t > 1$이면 이전보다 해당 행동을 할 확률이 높아진 것이고, $r_t < 1$이면 낮아진 것입니다

- 기존 연구 목적함수

$$
L^{CPI}(\theta) = \hat{\mathbb{E}}_t \left[ \frac{\pi_{\theta}(a_t | s_t)}{\pi_{\theta_{old}}(a_t | s_t)} \hat{A}_t \right] = \hat{\mathbb{E}}_t [r_t(\theta)\hat{A}_t]
$$

- **문제점:** 제약 조건 없이 $L^{CPI}$를 최대화하려고 하면, 정책 업데이트가 지나치게 커질 수 있습니다(excessively large policy update).
- 즉, 한 번의 업데이트로 정책이 너무 많이 변해서 학습이 붕괴될 위험이 있습니다.

$$
L^{CLIP}(\theta) = \hat{\mathbb{E}}_t [\min(r_t(\theta)\hat{A}_t, \text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon)\hat{A}_t)]
$$

- (1) 첫 번째 항: $r_t(\theta)\hat{A}_t$
    - 우리가 원래 최적화하려던 $L^{CPI}$입니다.
- (2) 두 번째 항:  $\text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon)\hat{A}_t$
    - **Clipping:** 확률 비율 $r_t$를 $[1-\epsilon, 1+\epsilon]$ 범위 안으로 강제로 자릅니다
    - 보통 $\epsilon$ = 0.2
- (3) `min` 연산 (핵심: 비관적 하한선)
    - 두 항 중 **더 작은 값**
    
    ![image.png](/assets/img/PPO/image.png)
    

⇒ Cliping을 통해서 학습의 안정성을 확보하고자 하였습니다.
⇒ 추후 RLHF논문에서 학습에 활용되는 알고리즘이 PPO 기반이며, 많은 RL 방법론이 PPO에서 파생됩니다.

_(이미지: 원본 사이트 참조)_
