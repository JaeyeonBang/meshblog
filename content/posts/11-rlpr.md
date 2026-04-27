---
title: "RLPR: EXTRAPOLATING RLVR TO GENERAL DO MAINS WITHOUT VERIFIERS"
date: 2026-01-03
tags: [RL, NLP, LLM, neural-network]
category: ai
image: "/meshblog/og/posts/11-rlpr.svg"
---
[[paper link]](https://arxiv.org/pdf/2506.18254)

### 한 줄 설명

**정답인지 아닌지 규칙으로 판정하지 않고 모델이 reference answer를 얼마나 높은 확률로 예측하는지를 모델의 확신으로 보고 강화학습 reward로 사용한다.** 

[[Git]](https://github.com/OpenBMB/RLPR)

### 기존 연구의 한계

- Verifiable Rewards를 활용한 Reinforcement Learning(RLVR)은 LLM의 추론 능력을 향상시키는 데 큰 역할을 하고 있음
    
    ![image.png](/assets/img/RLPR/image.png)
    
    → BUT 이건 여전히 수학, 코드 도메인에 제한되어있음
    - 기존 RLVR 방법들이 reward를 얻기 위해 domain-specific verifier에 크게 의존하기 때문
    - 때문에 이러한 rule-based reward system을 새로운 모델이나 도메인으로 확장하는 데에는 일반적으로 과도한 heuristic engineering이 요구됨
    - free-form answer를 갖는 일반 도메인 추론의 경우 자연어의 높은 다양성과 복잡성 때문에 rule-based verifier를 설계하는 것 자체가 사실상 불가능
    
    
    
    - 일반적인 reward evaluation을 위해 LLM을 학습시키면 되지 않나?
    
    - 그러나 일반적인 reward evaluation은 쉽지 않고 방대한 데이터 annotation을 필요로 함
    - 실제로는 만족스럽지 못한 reward quality로 이어지는 경우가 많음음
    

### 연구 목표

- RL을 보다 넓은 일반 도메인으로 확장할 수 있는 Reward framwork를 만드는 것
- 정답인지 아닌지 규칙으로 판정하지 않고 모델이 reference answer를 얼마나 높은 확률로 예측하는지를 모델의 확신으로 보고 강화학습 reward로 사용

### 방법론

- **Reinforcement Learning from Verifiable Reward(RLVR)**
    - rule-based verifier가 각 생성된 응답에 대해 scalar reward score를 부여하는 일반적인 post-training 패러다임
    - 프롬프트 x가 주어지면 policy $\pi_θ​$ 는 reasoning content z와 최종 답변 y를 구성
        
        → 이후 기대 verifier score $J(θ​)$를 최적화함
        
        ![image.png](/assets/img/RLPR/image%201.png)
        
        → 즉 verifier가 YES라고 말할 확률을 높이도록 모델 파라미터 𝜃를 업데이트한다는 의미
        
        - $f_{verifier​}$: 생성된 답변 $y$가 GT $y*$로 정의된 test를 통과하는지 검사하는 task-specific, rule-based verifier
            
            → RLVR의 큰 한계: 수학, 코드처럼 명확한 규칙이 있는 분야는 괜찮지만 글쓰기, 요약, 창의적 추론 같은 분야로는 확장하기 어렵다.
            
**RLPR**

- **외부 verifier 없이 일반 도메인 RLVR을 확장하는 RLPR(Reinforcement Learning with Reference Probability Reward) 프레임워크를 제안**
- reference answer에 대한 LLM 자체의 token probability score를 reward signal로 사용
    
    - 즉, LLM이 생성할 intrinsic probability 자체가, 해당 추론 과정이 얼마나 잘 정답에 도달했는지를 나타내는 reasoning reward로 활용, 생성된 답변에 대한 모델 자신의 평가를 직접적으로 반영한다는 점

![image.png](/assets/img/RLPR/image%202.png)

**보상**

- 질문에 대한 응답을 $o = (o_0, ..., o_N)$이라고 할 때 (o는 각 토큰 단위)
    - 모델이 생성한 추론 $z$와 답변 $y$ 중 답변 $y$를 버리고 GT $y*$를 대신 넣는다.
        
        → 이 reasoning을 했을 때, 모델은 진짜 정답을 얼마나 그럴듯하게 생각하는가?
        
    - reasoning을 주고 그 다음에 정답이 나올 확률은 어떻게 되는지
        
        ```markdown
        y* = "New York City"
        
        p₁ = P("New"  | 앞 문맥)
        p₂ = P("York" | 앞 문맥 + "New")
        p₃ = P("City"| 앞 문맥 + "New York")
        ```
        
        - 이를 하나의 점수로 ⇒ Probability reward
            
            ![image.png](/assets/img/RLPR/image%203.png)
            
            = 정답 토큰 평균 확률
            
            - reasoning z를 잘 쓰면, 이후 토큰 probability가 증가, reward 증가
            - reasoning z를 못 쓰면, 이후 토큰 probability가 증가, → reward 감소소
        - $f_{seq}$: per-token probability를 하나의 scalar reward로 모으는 함수
        
            - mean probability을 활용함함
                
                ![image.png](/assets/img/RLPR/image%204.png)
                
                - 더 robust한 reward signal을 제공
                
                → 채택
                

**추론의 순수한 기여만 보상해야 한다.** 

- 문제가 쉬웠을 수도 있고, 정답이 흔한 표현일 수 있고… 등등 추론과 무관한 요인들이 보상에 섞여있음
- SO, 추론이 없이 정답만 decoding했을 때 계산한 probability reward를 baseline reward로 두고
    
    ![image.png](/assets/img/RLPR/image%205.png)
    
    ![image.png](/assets/img/RLPR/image%206.png)
    
    - $r$: 추론 포함 상태에서의 reward
    - $r^′$: 추론 없이도 얻는 기본 reward

**최종 objective function에 대한 gradient estimator**

![image.png](/assets/img/RLPR/image%207.png)

- debiased reward $\hat r$가 큰 응답 $o$가 더 자주 나오도록 $\pi_θ​$를 업데이트

**너무 쉽거나 어려운 문제들은 필터링한다.** 

- 하지만 reward가 0~1 사이 연속값이기 때문에 threshold를 정하기 어렵고…
    
    → 한 prompt에 대해 reward들의 분산(standard deviation)을 보면 그 문제가 쉬운지/어려운지 알 수 있다!
    
    - reward의 표준편차가 낮은 경우 -> 문제가 너무 쉽거나 어려움
- reward의 standard deviation이 작은 prompt는 버린다.
    - 하지만 학습 초반, 중반, 후반에 따라 reward 분포가 계속 변하기 때문에 동적 threshold + EMA 적용
        

### 실험 결과
![image.png](/assets/img/RLPR/image%208.png)


## 코드 분석 요약
- 해당 git 에서는 reward manager 안 prob.py에서 관리
- score a와 같이 forward를 통한 확률계산은 trainer 내부의 rollout을 통해 계산됨

- Score B를 계산하는 과정
```python
def compute_scoreB(self, old_log_probs, ground_truth_mask):
        """
        모델이 생성한 정답 토큰들의 로그 확률을 바탕으로 scoreB(r) 값을 계산함.
        로그 확률을 실제 확률로 변환하거나 평균을 내는 등 다양한 수치적 변환을 수행.
        Score B -> z가 있을 때 ground truth가 나올 확률 관련 점수 (논문에서 r)
        """
        # 정답 토큰이 마스킹 상에 존재하지 않으면 점수는 0
        if ground_truth_mask.sum() == 0:
            scoreB = 0
        else:
            # 1. 정답(Ground Truth) 위치에 해당하는 로그 확률값들만 필터링하여 추출
            # 
            old_log_probs_in_gt = old_log_probs[ground_truth_mask.bool()]
            
            # 2. 마지막 토큰 확률 조정(Clipping) 로직
            # 마지막 정답 토큰의 확률이 너무 높을 때 발생할 수 있는 보상 폭주를 방지하기 위해 최대치를 ln(0.5)로 제한
            if self.gt_tokens_one_more and self.gt_tokens_one_more_adjusted:
                old_log_probs_in_gt[-1] = min(old_log_probs_in_gt[-1], np.log(0.5))
            
            # 3. 고정밀도 계산을 위해 float32(BF32 수준)로 변환
            old_log_probs_in_gt = old_log_probs_in_gt.to(torch.float32)
            
            # 4. 설정된 계산 방식(compute_score_name)에 따른 수치 산출
            # 방식 A: 각 토큰 확률(exp)의 산술 평균 (가장 일반적인 RLPR 방식)
            if self.compute_score_name == 'mean_exp_log_softmax':
                scoreB = torch.mean(torch.exp(old_log_probs_in_gt)).item()
            
            # 방식 B: 로그 확률값 자체의 산술 평균
            elif self.compute_score_name == 'mean_log_softmax':
                scoreB = torch.mean(old_log_probs_in_gt).item()
            
            # 방식 C: 모든 토큰 확률의 곱 (전체 시퀀스가 한 번에 나올 확률)
            elif self.compute_score_name == 'exp_sum_log_softmax':
                scoreB = torch.exp(torch.sum(old_log_probs_in_gt)).item()
            
            # 방식 D: 기하 평균 (확률 곱의 n제곱근과 유사한 효과)
            elif self.compute_score_name == 'exp_mean_log_softmax':
                scoreB = torch.exp(torch.mean(old_log_probs_in_gt)).item() 
            else:
                raise ValueError
            
            # 5. 최종 결과를 학습 환경에 맞는 데이터 타입(BF16)으로 다시 변환하여 저장
            scoreB = torch.tensor(scoreB, dtype=torch.bfloat16).item()

        return scoreB

    def compute_scoreA_scoreB_and_extracted_answer(self, data_item, valid_response_ids):
        """
        데이터 소스와 설정에 따라 VR(실제 채점) 또는 PR(확률 기반 채점)을 분기하여 수행.
        결과적으로 scoreA(r'), scoreB(r), 그리고 추출된 정답 텍스트를 반환함.
        """
        data_source = data_item.non_tensor_batch['data_source']
        
        # --- 분기 1: 실제 정답 검증(VR)을 함께 사용하는 경우 (수학 문제 위주) ---
        # reward_type이 'pr+vr'이고, 데이터 소스가 지정된 수학 데이터셋 리스트에 포함되어 있을 때 실행
        if self.reward_type == 'pr+vr' and (any(dataset_name in data_source for dataset_name in [
            "numina_cn_k12", "numina_synthetic_math", "numina_olympiads", 
            "numina_synthetic_amc", "numina_aops_forum", "numina_amc_aime",
            "Math-500", "AIME2024", "AMC2023", "DAPO-Math-17k",
            "OlympiadBench", "Minerva", "simplelr_deepscaler"
        ])):

            # 데이터 아이템에서 정답(GT) 텍스트를 가져옴
            ground_truth = data_item.non_tensor_batch['reward_model']['ground_truth']

            # 모델이 생성한 응답을 텍스트로 변환 (특수 토큰 제외)
            solution_str = self.tokenizer.decode(valid_response_ids, skip_special_tokens=True),
            
            # 외부 수학 채점 모듈(prime_math)을 호출하여 실제 정답 여부 판단
            res = prime_math.compute_score(solution_str, ground_truth)
            scoreB = float(res[0]) # 채점 결과 (맞으면 1.0, 틀리면 0.0 등)
            scoreA = 0 # VR 모드에서는 기저 점수(A)를 보통 0으로 처리
            extracted_answer = res[1] # 채점 과정에서 파싱된 정답 텍스트
            
        # --- 분기 2: 순수 확률 기반 보상(PR)을 사용하는 경우 ---
        else:
            # 1. 모델 내부 로그 확률을 사용하여 scoreB(r) 계산
            """Score B : reasoning z가 있을 때 ground truth가 나올 확률 관련 점수"""
            scoreB = self.compute_scoreB(data_item.batch['old_log_probs_pr'], data_item.batch['ground_truth_mask_pr']) 
            
            # 2. 미리 계산되어 저장되어 있는 기저 점수 scoreA(r')를 가져옴 (없으면 0.0)
           """Score A : reasoning z가 없을 때 ground truth가 나올 확률 관련 점수""" 
     
            scoreA = data_item.non_tensor_batch['reward_model'].get('scoreA', 0.0)

            # 3. 모델의 전체 응답 텍스트에서 <answer> 태그 사이의 정답을 정규표현식으로 추출
            predict_str = self.tokenizer.decode(valid_response_ids) 
            match = re.search(r'<answer>(.*?)</answer>', predict_str, re.DOTALL)
            extracted_answer = match.group(1).strip() if match else ""
            
        return scoreA, scoreB, extracted_answer
``` 

- 계산된 score들을 기반으로 최종 보상을 합산하는 부분

```python
def __call__(self, data: DataProto):
        """데이터셋 가용성에 따라 점진적으로 확장될 보상 계산 메인 함수.
        배치 데이터를 받아 각 샘플에 대한 보상을 계산함.
        """

        # 1. 이미 외부 보상 모델(RM)로부터 계산된 점수가 배치에 포함되어 있다면 즉시 반환
        if 'rm_scores' in data.batch.keys():
            return data.batch['rm_scores']

        # 2. 결과 저장을 위한 각 항목별 텐서 초기화 (응답 시퀀스와 동일한 크기)
        reward_tensor = torch.zeros_like(data.batch['responses'], dtype=torch.float32) # 최종 통합 보상
        extracted_answer_list = [] # 추출된 텍스트 정답 리스트
        format_reward_tensor = torch.zeros_like(data.batch['responses'], dtype=torch.float32) # 형식(태그) 준수 점수
        scoreA_tensor = torch.zeros_like(data.batch['responses'], dtype=torch.float32) # 기저 점수 (Reference Prob without CoT)
        scoreB_tensor = torch.zeros_like(data.batch['responses'], dtype=torch.float32) # 대상 점수 (Reference Prob with CoT)

        already_print_data_sources = {} # 디버깅용 출력 카운트 관리용 딕셔너리

        # 3. 데이터 배치 내의 각 개별 샘플(DataProtoItem)을 순회
        for i in range(len(data)):
            data_item = data[i]  # 배치 내 i번째 아이템

            # --- 프롬프트(질문) 영역 처리 ---
            prompt_ids = data_item.batch['prompts']
            prompt_length = prompt_ids.shape[-1] # 고정된 최대 프롬프트 길이

            # 패딩을 제외한 실제 유효한 프롬프트 토큰만 추출 (attention_mask 활용)
            valid_prompt_length = data_item.batch['attention_mask'][:prompt_length].sum()
            valid_prompt_ids = prompt_ids[-valid_prompt_length:]

            # --- 응답(모델 답변) 영역 처리 ---
            response_ids = data_item.batch['responses'] # 모델이 생성한 응답 IDs (예: 길이 1024)
            # 패딩을 제외한 실제 유효한 응답 토큰 길이 계산 (예: 329)
            valid_response_length = data_item.batch['attention_mask'][prompt_length:].sum() 
            valid_response_ids = response_ids[:valid_response_length] 

            # --- 디코딩 (ID -> Text) ---
            sequences = torch.cat((valid_prompt_ids, valid_response_ids))
            sequences_str = self.tokenizer.decode(sequences) 

            # 질문 영역만 디코딩
            prompt_str = self.tokenizer.decode(valid_prompt_ids) 
            # 모델이 생성한 답변 영역만 디코딩
            predict_str = self.tokenizer.decode(valid_response_ids) 
            
            # 4. 형식 보상 계산: <think>, <answer> 태그가 규격에 맞게 포함되었는지 검사
            format_score = format_reward(predict_str=predict_str, format_mode=self.format_mode)

            # 5. RLPR 핵심 수치 계산: scoreB(r), scoreA(r') 및 추출된 정답 텍스트 획득
            scoreA, scoreB, extracted_answer = self.compute_scoreA_scoreB_and_extracted_answer(data_item, valid_response_ids=valid_response_ids)
            
            # 6. 보상 델타 계산 및 변형: Delta = Shaping(scoreB - scoreA)
            score_delta = scoreB - scoreA
            score_delta = self.shaping_function(score_delta) # 시그모이드 등 적용
            
            # 7. 이산화(Discrete Binning) 처리: 필요한 경우 연속적인 점수를 구간별로 나눔
            if self.discrete_function_name is not None and self.discrete_function_name != 'identity':
                if self.discrete_function_name.startswith('bin_'):
                    num_bins = int(self.discrete_function_name.split('_')[1])
                    score_delta = self.map_to_bins(score_delta, num_bins)

            # 8. 최종 보상 합산 로직
            if self.format_coefficient == -1:
                # 계수가 -1인 경우: 형식이 틀리면(format_score != 1) 무조건 -1점, 맞으면 델타 점수 부여
                score = score_delta if format_score == 1 else -1
            else:
                # 일반적인 경우: (1 - k) * 확률보상 + k * 형식보상 비율로 가중 합산
                score = (1 - self.format_coefficient) * (
```

_(이미지: 원본 사이트 참조)_
