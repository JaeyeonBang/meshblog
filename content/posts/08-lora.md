---
title: "LoRA: Low-Rank Adaptation of Large Language Models"
date: 2025-11-26
tags: [NLP, Fine-tuning, LoRA, neural-network]
---
[[paper link]](https://arxiv.org/abs/2106.09685)


__*아래 내용은 간략하게 논문을 정리한 내용입니다. 정리, 번역, 표현에는 오류가 있을 수 있습니다.*__

한 줄 요약: 싸게싸게 파인튜닝 하고 싶은데? → 기존 신경망 옆에 모듈 하나 붙여서 더해볼까??

# INTRODUCTION

- 자연어 처리(NLP) 분야의 많은 application은 **하나의 대규모 사전 학습(pre-trained) 언어 모델**을 여러 **down-stream application에 적응**시키는 방식에 의존하고 있으며, 
이는 pretrained 모델의 모든 파라미터를 업데이트하는 fine-tuning을 통해 진행됩니다.

- 그러나, 모델이 커지고 파라미터의 수가 늘어남에 따라, fine-tuning은 불편한 방법이 되었습니다.
- **일부 파라미터만 학습**시키거나, **외부 모듈을 활용**하여 operational efficiency를 증대시키기 위한 시도가 있어 왔습니다.
- 하지만 이러한 방법들은 여러 **부작용**들을 보였습니다(e.g. inference latancy를 증가, 모델의 sequence length 감소)

- 본 논문은 모델 적응(adaptation) 과정에서의 가중치 변화 또한 낮은 '**내재적 랭크(intrinsic rank)'**를 가질 것이라는 가설을 세우며 **LoRA(Low-Rank Adaptation)를 제안합니다.**
- LoRA는 **사전 학습된 가중치는 고정**(frozen)한 상태로 유지하면서, 대신 파인튜닝 과정에서 rank decomposition matrices을 최적화함으로써 신경망의 일부 dense layer를 간접적으로 학습할 수 있게 해줍니다.
- GPT-3 175B 모델을 예로 들면, 전체 랭크(즉, $d$)가 12,288에 달할 정도로 높을 때에도 매우 낮은 랭크($r$ = 1 or 2)만으로도 충분함을 보여주며,
- 이는 LoRA를 저장 공간과 연산 측면에서 모두 효율적임을 보여줍니다.

![image.png](/assets/img/LoRA/image.png)

### LoRA의 장점

- **모델 공유 및 전환 효율성**
    - 하나의 사전 학습된 모델을 공유하여 다양한 작은 LoRA 모듈을 만들 수 있습니다.
    - 공유된 모델은 고정(freeze)하고 그림 1의 **행렬 $A$와 $B$만 교체**함으로써 작업을 효율적으로 전환할 수 있습니다
- **학습 효율성 및 진입 장벽 완화**
    - LoRA는 대부분의 파라미터에 대해 gradiant를 계산하거나 옵티마이저 상태(optimizer states)를 유지할 필요가 없기 때문에, **하드웨어 진입 장벽을 최대 3배까지 낮춰줍**니다.
    - 훨씬 작은 low-rank 행렬들에 대해서만 학습을 진행합니다
- **추론 지연 시간 없음 (No Inference Latency)**
    - 구조적으로 전체 파인 튜닝(fully fine-tuned)된 모델과 비교했을 때 **추론 지연 시간**이 전혀 발생하지 않습니다.
- **기존 방법론과의 호환성:**
    - LoRA는 많은 기존 방법론들과 결합하여 사용할 수 있습니다.

- **Terminologies and Conventions**
    - dimension size of Transformer layer: $d_{model}$
    - $W_q, W_k, W_v, W_o$ :  query/key/value/output projection matrices
    - $W$, $W_o$ : pretrained weight
    - $r$: rank of LoRA module

# 2 PROBLEM STATEMENT

- $ P_{\Phi}(y \vert x)$: pre-trained autoregressive language model, parametrized by $\Phi $
- 각 downstream task는 다음과 같이 표현됩니다
 $Z = {\{(x_i, y_i)\}}_{1,\dots,N}$, $x_i, y_i$ : sequence of tokens(x는 input, y는 output)
- Full finetuning 중에는  $\phi_0$을 $\phi_0 + \bigtriangleup\phi$로 업데이트 합니다.
- 다음 목적을 지니고 파라미터를 업데이트 합니다

$$
{max\atop\Phi} \sum\limits_{(x,y) \in Z}\sum\limits_{t=1}^{ \vert y \vert }log(P_\Phi(y_t \vert x,y_{<t}))
$$

 

- $ y_t \vert  x,y_{<t}$ : x와 t이전의 y가 주어졌을 때 , t시점의 y
- $P_\Phi(y_t \vert  x,y_{<t})$ :   x와 t이전의 y가 주어졌을 때 , t시점에 y가 $\Phi$ 파라미터 모델로 인해 나타날 확률

⇒  $\Phi_0$와 크기가 같은 $\bigtriangleup\Phi$를 업데이트 해야 하므로, 비용이 매우 크다

- 본 연구는 parameter-effeicient한 접근 방법을 제시합니다 $\bigtriangleup\Phi$를 $\bigtriangleup\Phi(\Theta)$로 치환
- $ \vert \Theta \vert  <<  \vert \Phi_0 \vert $ ⇒ 비용이 비교적 매우 작습니다

$$
{max\atop\Theta} \sum\limits_{(x,y) \in Z}\sum\limits_{t=1}^{ \vert y \vert }log(p_{\Phi_0 + \bigtriangleup\Phi(\Theta)} (y_t \bar x,y_{<t}))
$$

# 3 AREN'T EXISTING SOLUTIONS GOOD ENOUGH?

- Adapter Layers Introduce Inference Latency
    
    ![image.png](/assets/img/LoRA/image%201.png)
    
    ![image.png](/assets/img/LoRA/image%202.png)
    
    - Adapter layer는 순차적으로 처리되어야 하기 때문에, 지연이 발생
- Directly Optimizing the Prompt is Hard

![image.png](/assets/img/LoRA/image%203.png)

- Prefix Tuning (Li & Liang, 2021)은 학습하기가 까다로움
- 모델 적응(adaptation)을 위해 전체 시퀀스 길이(sequence length)의 일부를 할당해 버리면 필연적으로 다운스트림 작업을 처리할 수 있는 시퀀스 공간이 줄어듭니다.

# 4. OUR METHOD

## 4.1 LOW-RANK-PARAMETRIZED UPDATE MATRICES

- Aghajanyan et al. (2020)은 사전 학습된 언어 모델이 낮은 '내재적 차원(intrinsic dimension)'을 가지며, 더 작은 부분공간(subspace)으로 무작위 투영(random projection)을 하더라도 여전히 효율적으로 학습할 수 있음을 보여주었습니다

→ 이를 통해 attention weight를 downstream task에 adapting하는 데 활용합니다

- $W_0 + \bigtriangleup W = W_0 + BA$로 표현하며 제약을 둡니다.
- ($B \in \mathbb{R}^{d \times r}, A \in \mathbb{R}^{r \times k}$), rank $r << min(d,k)$
- $W_0$은 frozen되고, $W_0$ 과  $\bigtriangleup W = BA$ 는 같은 input을 받습니다.
    
    $$
    h = W_0x + \bigtriangleup W_x = W_0x + BAx
    $$
    
- A는 Gaussian initialization, B는 0으로 초기화
- $\bigtriangleup W$를 $a \over r$로 scale

![image.png](/assets/img/LoRA/image.png)

## 4.2 APPLYING LORA TO TRANSFORMER

- 이 논문에서는 $W_q, W_k, W_v$에 대해서, multihead 대신 single matrix로 적용합니다.
- 오직 어텐션 가중치만을 다운스트림 작업에 적응(adapt)시키고, MLP 모듈은 고정(freeze)

- 고정된 파라미터들에 대해서는 옵티마이저 상태(optimizer states)를 저장할 필요가 없기 때문에, $r \ll d_{model}$이라면 **VRAM 사용량을 최대 2/3까지 줄일 수 있습니다.**
- GPT-3 175B 모델의 경우, 학습 중 VRAM 소모량을 **1.2TB에서 350GB로** 줄였습니다.
- $r=4$이고 쿼리( $W_q$ )와 밸류( $W_v$) 투영 행렬만 적응시킬 경우, 체크포인트 크기는 대략 **10,000배 감소합니다**
- LoRA 가중치만 교체함으로써 훨씬 낮은 비용으로 작업(Task)을 전환

# EMPIRICAL EXPERIMENTS

## Baselines

- Prefix-embedding tuning (PreEmbed)
    - **PreEmbed**는 입력 토큰들 사이에 특수 토큰(special tokens)을 삽입
- Prefix-layer tuning (PreLayer)
    - 단순히 특수 토큰의 워드 임베딩(또는 임베딩 레이어 이후의 활성화값)만 학습하는 대신, **모든 트랜스포머 레이어 직후의 활성화값(activations)을 학습합니다**
- Adapter Tuning (어댑터 튜닝)
    - 셀프 어텐션 모듈(및 MLP 모듈)과 그 뒤에 오는 잔차 연결(residual connection) 사이에 어댑터 레이어를 삽입합니다.

### ROBERTA BASE/LARGE 모델, DEBERTA XXL 모델,

![image.png](/assets/img/LoRA/image%204.png)

### GPT-2 MEDIUM/LARGE

![image.png](/assets/img/LoRA/image%205.png)

### 5.5 SCALING UP TO GPT-3 175B

![image.png](/assets/img/LoRA/image%206.png)

# 7. UNDERSTANDING THE LOW-RANK UPDATES

## 7.1 WHICH WEIGHT MATRICES IN TRANSFORMER SHOULD WE APPLY LORA TO?

![image.png](/assets/img/LoRA/image%207.png)

- 파라미터의 수를 고정하였을 때, 학습 파라미터 분배에 따른  adapting 차이 확인
- $W_q$와 $W_v$를 둘 다 adapting 하는 것이 좋은 결과를 보여주었습니다

## 7.2 WHAT IS THE OPTIMAL RANK r FOR LORA?

![image.png](/assets/img/LoRA/image%208.png)

- $r$을 늘린다고 해서 더 유의미한 부분공간을 포괄하게 되는 것은 아니며, **저랭크 적응 행렬(low-rank adaptation matrix)만으로도 충분할 수 있습니다.**

### Subspace similarity between different r

- $A_{r=8}$ 과 $A_{r=64}$ 에 데해서 SVD(특이값 분해) 진행하여, $U_{A_{r=8}}, U_{A_{r=64}}$ 추출
    - 두 벡터의 차원을 맞출 수 있습니다.
- $A = U\sum V^T$

![image.png](/assets/img/LoRA/image%209.png)

$$
\phi (A_{r=8}, A_{r=64}, i, j) = {{ \vert  \vert  U^{i \top}_{A_{r=8}}U^{j}_{A_{r=64}} \vert  \vert ^2_F} \over {min(i,j)}} \in [0,1]
$$

- Grassmann distance 를 통해 유사도를 계산
    - Grassmann distance : 두 subspace 간 거리  측정
    
    ![image.png](/assets/img/LoRA/image%2010.png)
    
- 최상위 벡터의 경우, 상당히 유사
- dimension 1의 각 $\Delta W_q, \bigtriangleup W_v$ 간 유사도가 0.5 이상

### Subspace similarity between different random seeds.

- 초기화 시드(Seed) 다르게 설정하여 학습
- $\bigtriangleup W_q$ : 유사한 방향으로 학습하려고 합니다.
    - **"내재적 랭크(Intrinsic Rank)"가 높다**고 판단됩니다. (즉, 정보를 표현하기 위해 더 많은 차원이 실제로 사용됨
- $\bigtriangleup W_v$: 다른 방향으로 학습하려고 함

![image.png](/assets/img/LoRA/image%2011.png)

## 7.3 HOW DOES THE ADAPTATION MATRIX W COMPARE TO W?

- LoRA가 학습한 업데이트 tensor( $\Delta W$)가 원래 모델의 가중치( $W$ )와 어떤 관계가 있는가?
- $W$를 $\Delta W$가 형성하는 공간(Subspace)에 Project시켜 비교

![image.png](/assets/img/LoRA/image%2012.png)

$$
\ \vert  U^\top W V^\top \ \vert _F
$$

- U, V는 $_
\Delta W_q, W_q, Random$의 왼쪽/오른쪽 Singular Vector

![image.png](/assets/img/LoRA/image%2013.png)

- $\Delta W$는 무작위 행렬(Random Matrix)보다 $W$와 더 강한 상관관계를 가집니다. (Random = 0.02 vs. $\Delta W_q$ = 0.32)
    - **의미:** LoRA는 아무런 근거 없이 학습하는 것이 아니라, 이미 $W$에 존재하던 어떤 특징(Feature)을 기반으로 학습됩니다.

- **이미 강한 특징을 건드리지 않는다 (Focus on Weak Directions)**
    - 이 부분이 가장 중요한 통찰입니다. $\Delta W$는 $W$의 **상위 특이벡터(Top singular directions)와 겹치지 않습니다. (**$\Delta W_q$ = 0.32 vs. $W_q$ = 21.67**)**
    - $W$에서 이미 중요하게 다루고 있는(값이 큰) 특징을 더 강화하는 게 아니고, **$W$에서는 중요하게 취급되지 않았던(값이 작거나 무시되었던) 방향**을 골라내어 강화합니다.(0.32, 1.90)
- **꽤나 큰 증폭이 발생한다 (Huge Amplification)**
    - LoRA가 찾아낸 방향에 대해, $\Delta W$는 값을 엄청나게 키웁니다.
    - 증폭 계수(Amplification factor)가 약 **21.5배** ($6.91 / 0.32$)에 달합니다 ($r=4$일 때).
    - 사전 학습(Pre-training) 모델에서는 0.32만큼의 미미한 영향력만 있던 특징을, 특정 태스크(Downstream task)를 위해 6.91만큼 중요하게 끄집어 올린다는 뜻입니다.

### reference

[https://simplecode.kr/80](https://simplecode.kr/80)

# [LoRA without regret](https://thinkingmachines.ai/blog/lora/)

**특정 조건**을 만족시키면 전체 파라미터를 튜닝하는 것과 **완전히 동일한 최종 성능**을 낼 수 있다고 합니다

### **모든 레이어에 적용하라 (Apply to All Layers):**

- 과거에는 주로 Attention 레이어($W_q, W_v$)에만 LoRA를 적용했습니다.
- 하지만 실험 결과, **MLP 레이어를 포함한 모든 선형 레이어(All Linear Layers)**에 LoRA를 적용하는 것이 필수적입니다.
- Attention에만 적용하고 Rank를 높이는 것보다, Rank가 낮더라도 모든 레이어에 적용하는 것이 훨씬 성능이 좋습니다.

### **학습률을 과감하게 높여라 (Higher Learning Rate):**

- LoRA의 최적 학습률(Learning Rate)은 전체 미세조정(Full FT)보다 **약 10배 더 높아야** 합니다.
- 파라미터 수가 적기 때문에 더 큰 폭으로 업데이트해야 효과적으로 학습됩니다.

### **데이터 규모에 따른 한계 인식:**

- **성공:** 지시 따르기(Instruction Tuning), RLHF, 특정 도메인 적응 등 대부분의 **'후학습(Post-training)'** 단계에서는 LoRA가 완벽하게 작동합니다.
- **주의:** 사전 학습(Pre-training) 수준의 방대한 지식을 주입해야 할 때는 LoRA의 용량(Capacity) 한계로 인해 Full FT보다 성능이 떨어질 수 있습니다

### 3. RL(강화학습)에서의 효율성

- 특히 **RLHF(인간 피드백 강화학습)**와 같은 상황에서는 학습 신호가 희소(Sparse)하기 때문에, **Rank=1**과 같은 극도로 낮은 랭크에서도 LoRA가 전체 미세조정과 동등한 성능을 발휘한다는 사실을 발견했습니다.

_(이미지: 원본 사이트 참조)_
