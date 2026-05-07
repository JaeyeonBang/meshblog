---
title: ODQA Wrap-up Report
draft: false
tags:
  - ODQA
  - MRC
  - Retriever
  - Reader
  - KorQuAD
aliases:
  - Open-Domain Question Answering
  - ODQA
published_at: '2026-05-07'
---
# Wrap-up Report

# 팀 구성 및 역할

6명으로 구성된 팀이 retriever / reader / data 세 축으로 나뉘어 작업했다. 대략의 분담:

- **Retriever 라인 (3명)** — BM25 + ElasticSearch 탐색, dense retrieval (Faiss), Qwen LoRA 학습, reranking + LLM-as-judge.
- **Reader 라인 (1명)** — 모델 비교 실험, CNN layer 추가, curriculum learning.
- **Data + 사전학습 라인 (2명)** — 외부 데이터셋 EDA, monoQA, TaPT (task-adaptive pre-training), 데이터 증강, negative sampling, 하이퍼파라미터 튜닝.
- **팀장 (1명, 위 라인과 겹침)** — 모듈화 refactoring + 앙상블 책임.

# 프로젝트 개요

- **프로젝트 전체 기간 (2주)** : 12월 1일 (월) 10:00 ~ 12월 11일 (목) 19:00
- **프로젝트 목적**: 방대한 Wikipidia 문서를 기반으로 Question에 대한 Answer span을 예측하는 Open-Domain Question Answering (ODQA) 모델을 구현하는 것

## Task 이해 및 코드 Refactoring

> Task 분석, 평가지표 분석, Baseline 분석 및 리펙토링

### Task 이해

- 사용자의 질문에 대답을 하는 Task
→ 더욱더 정확한 답변을 얻기 위해서 관련 문서를 찾아서 답변하기
- 일반적인 Open-Domain Question Answering (ODQA) 파이프라인
    1. 사용자의 질문을 바탕으로 지식 베이스(Knowledge Resource)에서 관련 문서들을 탐색
    2. 탐색된 문서들을 바탕으로 MRC Reader 모델이 질문에 맞는 답변을 추출

Retriever가 못하면? → 엉뚱한 문서를 Reader에게 전달하여 답을 찾을 수 없음!

Reader가 못하면? → 제대로된 문서에서도 답을 추출하지 못하여 정답을 내놓을 수 없음!

⇒ 점수 = Retriever 성능 X Reader 성능

***Retriever의 성능과 Reader의 성능을 모두 끌어 올려야 하는 과제로 해석됨. 제한된 자원(제한된 GPU, 2주 간의 대회 기간) 속에서 치뤄지는 점을 고려할 때, Retriever/Reader 간 리소스 분배가 중요***

### 평가 지표 분석

1. **[리더보드 반영 지표] Exact Match (EM)**: 모델의 예측과, 실제 답이 정확하게 일치할 때만 점수가 주어짐 (띄어쓰기 및 '.' 과 같은 문자는 제거 후 채점)

    Encoder 모델
    - Context내 정답의 시작 위치와 끝 위치를 찍어서 가져오기 때문에, 본문을 그대로 가져옴.
    - 정답의 위치를 맞추도록 학습

    Decoder 모델
    - Context를 읽고, 이전까지의 토큰을 기반으로 답을 새로 작성
    - 다음 토큰을 맞추도록 학습

    ***EM은 '토큰 하나 틀리지 않음'을 요구하기 때문에, Encoder모델이 보다 유리할 수 있음. 단, 현재 Encoder 모델에 비해 Decoder 모델의 규모가 매우 커졌으며, 문맥 이해 능력이 뛰어난 모델들이 개발되었기에 이에 대한 실험을 필요로 함***

2. **[보조지표] F1 Score**: EM과 다르게 부분 점수를 제공
(정답은 "Barack Obama"지만 예측이 "Obama" 일 때, EM은 0점이지만, F1 Score는 겹치는 단어의 존재를 점수에 반영함)

    - F1 score가 리더보드의 반영지표는 아니지만, robustness를 나타내는 지표일 수 있음
    - 토큰 단위의 일치도를 평가하기 때문에 모델의 사소한 실수를 고려한 실질적인 정보 추출 능력을 반영
    - EM 상에서는 해당 모델이 아예 엉뚱한 대답을 내놓았는지, 아깝게 틀렸는 지 알 수 없지만, F1 Score를 통해 정답에 근접해가는 능력 파악 가능

### Baseline 분석 및 리펙토링 진행

전달받은 mrc_baseline 코드 구조는 다음과 같다.

```python
mrc_baseline/
│
├── retrieval.py  검색을 구현하는 곳
│       "질문이 들어오면 관련 문서를 찾아주는 역할"
│
├── train.py  Reader가 문서에서 답변을 잘하게 훈련시키는 곳
│       "정답 위치를 맞추는 연습을 시키는 메인 스크립트"
│
├── trainer_qa.py  훈련을 어떻게 시킬지 상세하게 정하는 곳
│       "학습 루프, 평가 방식 등 세부 설정"
│
├── utils_qa.py  모델 출력(숫자)을 사람이 읽을 수 있는 답변(텍스트)으로 바꾸는 곳
│       "logits → '이지은' 변환하는 후처리 담당"
│
├── inference.py  실제로 문제를 푸는 곳 (검색 + 답변 추출)
│       "테스트할 때 retrieval.py와 train.py를 연결해서 실행"
│
└── arguments.py  모든 설정값을 모아둔 곳
        "모델 이름, 최대 길이, top-k 등 하이퍼파라미터"
```

**전달받은 Baseline 코드는 ODQA모델 개발을 위해 전체적인 흐름을 파악할 수 있는 코드로 해석됨**

그러나 해당 코드를 팀 프로젝트에 직접 활용하기에는 몇몇 문제점이 존재

1. 모듈화가 진행되지 않아, 여러 기능의 클래스/함수가 하나의 파일에 섞여 있음
→ 기능을 분업화 하여 구현할 때, 모두가 같은 파일을 수정해야 함, Conflict 확률이 매우 높음
2. 잦은 Nested 함수 활용으로 인해 코드 가시성이 매우 떨어짐
→ 추후 코드 수정 시 오류 발생 가능성 증가
3. 스파게티 코드로 인한, 파일 간 상호 의존성이 지나치게 높음
→ 하나의 기능을 수정하기 위해서는 모든 파일을 수정해야할 정도로 높은 상호 의존성

⇒ 팀프로젝트 효율을 증가시기키 위해서, 모듈화 리펙토링을 진행

1차 리펙토링

- 전체 코드를 기능별로 분리, 독립적이고 재사용 가능한 모듈로 나눠서 사용
- 추상 클래스, 팩토리 클래스, 기능 클래스로 모듈화하여, 개발 시 효율성 증대 노력

```python
|-- data -> /data/ephemeral/home/data
|-- docs
|   `-- git_convention.md
|-- notebooks
|   `-- EDA.ipynb
|-- outputs
|-- scripts
|   `-- train.sh ## 실행파일들
|-- src
|   |-- config
|   |   |-- train.json
|   |-- data
|   |   |-- dataset.py
|   |   |-- postprocessing
|   |   |   |--README.md # 모듈 추가 방법 기술
|   |   |   |--postprocessing_base.py # 추상클래스 관리
|   |   |   |--postprocessing.py # 팩토리 클래스, 모듈 매핑 관리
|   |   |   `--postprocessing_{...}_strategies.py # 실제 기능 클래스
|   |   `-- preprocessing
|   |-- eval.py
|   |-- inference.py
|   |-- models
|   |   |-- qa
|   |   `-- retrieval
|   |-- train.py
|   |-- trainer
|   `-- utils
|-- uv.lock
```

2차 리펙토링

- train.py, inference.py 내 Nested 함수를 제거하여 코드 가시성 확보
- 상호의존성이 높은 클래스/메소드를, 상호의존성이 낮은 클래스/메소드로 변환하여 효율적인 개발 가능성 증대

기존의 꼬여있던 베이스라인 코드를 리펙토링하려니, 실험과 무관한 Input이 과도하게 증가

**⇒ Baseline 코드를 모듈화 하는 방향으로 리펙토링 [X]**

**⇒ 모듈화되어 있는 코드에 Baseline 코드의 아이디어를 적용하는 방식으로 리펙토링 [O]**

프로젝트 도중 .json 파일로 실험관리 하는 것에 비효율성을 느끼고, dataclass와 classmethod를 활용하여 config관리를 하는 방향으로 리펙토링을 시도

그러나, 프로젝트 내 argument 인자 제공 방식을 모두 수정해야 하며, 동시에 다른 팀원들이 모듈개발을 하고 있다는 점을 고려하였을 때 비용이 너무 클 것으로 판단, 해당 branch는 폐기됨

***⇒ 프로젝트 초반 현명한 환경세팅의 중요성을 체감***

## 프로젝트 목적 및 동기

- 프로젝트 시작 전, 팀원 간의 원활한 협업을 위해서 가장 먼저 수행한 작업은 프로젝트에 임하고자 하는 목적을 통일하는 것
    - 멘토님의 조언에 따르면, 팀원들 간 의견 충돌의 주요 원인 중 하나는 서로 다른 목적을 가지고 프로젝트에 임한다는 점이었음
    - 팀 전체가 성능 향상에만 집중할 것인지, 아니면 개인별로 다양한 학습 경험을 얻어가는 것을 목표로 할 것인지에 대한 논의를 진행
- 최종적으로 다음과 같은 팀 전체의 목적을 수립

    > **"성능에 일희일비하지 말고, 꼭 하나라도 얻어가는 것을 만들자!"**
    - 이는 단순히 리더보드 순위에 연연하기보다는, 프로젝트를 통해 각자가 의미 있는 학습 경험과 기술적 성장을 이루는 것을 우선시한다는 의미

## 프로젝트 진행 계획

- 이번 대회는 2주라는 짧은 시간 동안 이루어졌기 때문에, 모든 작업이 거의 동시에 진행되어야 하였고 그에 따라 계획이 수립되며 동시에 실행되었음
- 이번 대회에서 고려해야 할 규칙은 크게 두 가지였음:
    1. KLUE-MRC 데이터셋을 제외한 모든 외부 데이터 사용 허용
    2. KLUE-MRC 데이터로 학습된 Pretrained weight을 사용한 모델을 제외한 모든 오픈소스 모델 사용 가능
- 따라서, 주어진 베이스라인 및 데이터셋 분석과 학습 방법론 탐색 이외에도, 사용 가능한 외부 데이터셋 탐색, 사용할 Pretrained weight 모델 탐색과 같은 목표를 포함하여 프로젝트 계획 수립에 이용함
- 위와 같은 사항들을 통해서 다음과 같이 프로젝트 진행 방향성을 정할 수 있었음
    1. **12/1(월)–12/3(수): 탐색 및 개인 베이스라인 구축**
        - 협업 세팅
        - 전달받은 베이스라인 코드 이해 및 코드 리펙토링
        - 간단한 EDA 및 외부 데이터셋 탐색, 활용 가능성 확인
    2. **12/4(목)–12/6(토): 코드 병합 및 실험 진행 (중간 점검)**
        - 12/4(목): 베이스라인 코드 확정 및 모델 실험 시작
        - 외부 데이터셋 전처리 및 방법론 적용
        - 12/6(토): 중간 점검, 정보 공유 및 2차 베이스라인 코드 병합
    3. **12/7(일)–12/11(목): 성능 향상 및 최종 마무리**
        - 아이디어를 코드로 구현
        - 모델 학습 진행
        - 남는 시간에 코드 정리를 병행
- 실제로는 아래와 같은 타임라인으로 프로젝트가 이루어지게 되었음

    | **기간** | **주요 목표** | **활동 내용** |
    | --- | --- | --- |
    | 12/1(월) – 12/3(수) | 프로젝트 탐색 및 Baseline 분석 | - 협업 환경 설정 (e.g. Github, Notion)\n- 제공된 Baseline 코드 이해\n- Baseline 코드 리팩토링 진행 |
    | 12/1(월) – 12/4(목) | EDA 및 외부 데이터셋 탐색 | - 대회 데이터셋 파악 및 분석\n- 외부 데이터셋 탐색 |
    | 12/4(목) – 12/7(일) | Reader 모델 탐색 및 성능 비교 | - Extractive Reader 모델 성능 비교\n- Generative Model 학습 구현 |
    | 12/4(목) – 12/8(월) | Retriever 모델 탐색 및 성능 비교 | - Sparse/Dense Retriever 구현\n- 각 Retriever 모델 성능 측정\n- Reranker 구현 및 성능 측정 |
    | 12/7(일) – 12/10(수) | 파이프라인 성능 개선 | - Negative Sampling 구현\n- Curriculum Learning 구현\n- Hyperparameter Tuning 진행 |
    | 12/11(목) | Ensemble 진행 및 최종 제출 | - K-fold Validation 수행\n- 최종 모델로 Hard Voting 수행 |

---

# Data

## 1. wikipedia documents

> **wikipedia_documents**

- 약 6만 개의 document 존재
- 이 중 **중복된 document 약 3000개 존재**

Dense embedding을 통해 비교해 보았을 때 유사도가 1.000인 document 약 600개 존재

→ 추후 Negative sampling을 진행할 때 배제하고 Negative sampling 진행

- **토큰 길이: wiki document 평균 token 길이 = `404 tokens`**

    **document 대부분이 BERT max_length(512) 안에 들어옴**

    → 평균 document가 비교적 짧아, BM25가 잘 작동할 가능성이 높음

    → 왜냐하면 BM25는 단어 빈도(tf)와 역문서 빈도(idf)에 매우 민감한 모델이어서, 문서가 길면 혼란스러울 수 있음

    - **BUT 최대 token 길이 = `27,539 tokens`**
        - **sliding-window reader** 사용
        - **긴 문장을 처리하는 모델**을 탐색

            → 최대 4096 토큰 길이를 받을 수 있는 KoBigbird 모델을 사용해봄

            → 최고 성능은 아니었지만 klue/bert-base 성능 대비 `EM + 4%` 향상

## 2. Train, Validation, Test

> **train, val, test**

```json
Train dataset size: 3952
Validation dataset size: 240
Test dataset size: 600
```

> **Context, Question, Answer**

- **Context 토큰 수 분석**

    | Split | Mean | Min | Median | Max |
    | --- | --- | --- | --- | --- |
    | Train | 495 | 239 | 442 | 1172 |
    | Val | 494 | 265 | 434 | 1151 |
    - 평균 토큰 길이가 495–500 → BERT 입력의 한계에 가까움
    - 최대 1172 tokens → reader 모델에 집어넣을 때 처리해야 함을 뜻함

    Context: 매우 길어서 sliding-window reader가 필수일 수 있다!

    → max_length=512 / stride ≈ 64~256

    → **실제로 Context를 잘라서 집어넣는 것보다 stride로 나눠서 넣었을 때 더 정답을 잘 캐치**했으며 stride 64, 128, 256 하이퍼파라미터 튜닝을 진행해보았을 때 대부분 64나 128이 최적의 stride였다.

- **Question 토큰 수 분석**

    | **Split** | **Mean (평균)** | **Min (최소)** | **Median (중앙값)** | **Max (최대)** |
    | --- | --- | --- | --- | --- |
    | **Train** | 16.35 | 1 | ***6*** | 43 |
    | **Val** | 16.35 | 1 | ***6*** | 32 |
    | **Test** | 16.55 | 1 | ***6*** | 33 |

    Question: 매우 짧고, 안정적인 분포 → **Sparse retrieval**이 강력할 수 있다!

- **Question 첫 단어 분석**

    → train, val, test 모두 첫 단어가 유사한 패턴을 가짐

    ```markdown
    Train       Val         Test
    윤치호가(17) 김준연은(2)   윤치호가(4)
    교황(9)     처음으로(1)   여운형이(2)
    미국(8)     스카버러(1)   19세기(2)
    윌리엄(7)   촌락에서(1)   연방군의(2)
    제2차(6)    로타이르가(1) 첫(2)
    요한(6)     의견을(1)     로마의(2)
    현재(6)     1945년(1)   히틀러의(2)
    기원전(5)    징금수는(1)   피아노(2)
    최초의(5)    다른(1)       윤치호는(2)
    일본이(5)    루이(1)       인간에게(2)
    ```

    고유명사 기반 질문이 압도적으로 많음

    → 뭔가 질문을 얼마나 잘 이해하냐보다 retriever가 context를 얼마나 정확히 찾느냐가 더 중요할 것 같다고 생각함

    → retriever 성능 향상에 집중

- **Answer 토큰 수 분석**

    | **Split** | **Mean (평균)** | **Min (최소)** | **Median (중앙값)** | **Max (최대)** |
    | --- | --- | --- | --- | --- |
    | **Train** | **3.52** | 1 | 3 | 49 |
    | **Val** | **3.87** | 1 | 3 | 30 |

    Answer: 매우 짧은 길이 → **Extractive reader**가 효율적일 수 있다!

> **validation이 test 분포를 대표하는가?**

- 길이 분포 → **매우 유사함**
- 질문 유형 분석 → **매우 유사함**

    | Type | Train | Val | Test |
    | --- | --- | --- | --- |
    | **other** | 61.64% | 61.25% | 64.00% |
    | **what** | 15.13% | 16.25% | 13.17% |
    | **who** | 8.58% | 7.92% | 8.17% |
    | **where** | 7.87% | 9.58% | 8.33% |
    | **when** | 5.62% | 4.58% | 4.67% |
    | **amount/how_many** | 0.96% | 0.42% | 1.17% |
    | **why** | 0.20% | 0.00% | 0.50% |

- 그런데!! **BM25 기반 similarity**를 뽑아봤을 때…

    → Retriever가 train/val/test 질문을 얼마나 비슷하게 느낄까?

    - `train → val` (파란색): Train → valid 간 유사도 (*Mean* = 9.74)
    - `test → val` (연한 청록색): Test → valid 간 유사도 (*Mean* = 4.80)

        → validation data가 test를 대표할 수 있는가?

    **train-validation split을 다시 하자!** (내부 지표 재정립)

    - `train → val` (초록색): Train → valid 간 유사도 (*Mean* = 4.69)
    - `test → val` (붉은색): Test → valid 간 유사도 (*Mean* = 4.67)

        ***→** `train → val` **과** `test → val` **분포가 유사해지면서, val의 대표성을 확보***

    |  | 원래의 validation | 다시 split 한 후 |
    | --- | --- | --- |
    | **eval EM** | 72.9167 | 67.0833 |
    | **public score (EM)** | 57.92 | 57.50 |
    | **private score (EM)** | 54.72 | 55.83 |
    - Public Score와의 갭 감소:
        - 원래 갭: 약 15.00%p
        - 재분할 후 갭: **약 9.58%p**

        → 결과: Validation 결과와 Public Score 간의 차이가 **5.42%p 감소**

    - Private Score와의 갭 감소:
        - 원래 갭: 약 18.20%p
        - 재분할 후 갭: **약 11.25%p**

        → 결과: Validation 결과와 Private Score 간의 차이가 **6.95%p 감소**

## 3. 외부 데이터

> 활용 가능한 외부 데이터셋 탐색

- **외부 데이터셋 후보**

    | Dataset | 설명 |
    | --- | --- |
    | [AI Hub 기계독해 데이터셋](https://aihub.or.kr/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=data&dataSetSn=89) | 한국어 뉴스 본문 기반 QA 학습 데이터 셋 |
    | [KorQuAD 1.0](https://korquad.github.io/category/1.0_KOR.html) | KorQuAD 1.0은 한국어 Machine Reading Comprehension을 위해 만든 데이터셋 |
    | [KorQuAD 2.0](https://korquad.github.io/) | KorQuAD 2.0은 KorQuAD 1.0에서 질문답변 20,000+ 쌍을 포함하여 총 100,000+ 쌍으로 구성된 한국어 Machine Reading Comprehension 데이터셋 |
    | [Ko-StrategyQA](https://huggingface.co/datasets/NomaDamas/Ko-StrategyQA) | StrategyQA(오픈 도메인 질의 응답 태스크 분야에서 multi-hop 질문들만을 모아 놓은 데이터셋)의 한국어 버전 |

여러 후보 중 프로젝트의 데이터와 가장 유사한 형태를 가진 KorQuAD 데이터 탐색 진행

**KorQuAD 1.0과 2.0의 차이**

KorQuAD 1.0: wiki 아티클의 문단들을 정제해서 context로 만든 데이터 셋

KorQuAD 2.0: 전체 wiki 아티클을 context로 만든 데이터 셋으로 HTML tag와 같인 wiki 문서 전체의 정보를 모두 가지고 있는 데이터 셋

→ 2.0이 1.0보다 규모가 더 크고 정제되어 있지 않은 context를 포함하고 있음

KorQuAD 1.0가 데이터 구조 및 형식 측면에서 프로젝트의 데이터셋과 더 유사하다고 판단

KorQuAD 2.0의 경우 데이터 규모가 크기 때문에 활용 시, 일부 데이터를 sampling하여 활용하는 것이 현실적이라고 생각함

### KorQuAD 1.0

> KorQuAD 1.0은 한국어 Machine Reading Comprehension을 위해 만든 데이터셋입니다. 모든 질의에 대한 답변은 해당 Wikipedia article 문단의 일부 하위 영역으로 이루어집니다. Stanford Question Answering Dataset(SQuAD) v1.0과 동일한 방식으로 구성되었습니다. [[KorQuAD 1.0](https://korquad.github.io/category/1.0_KOR.html)]

**데이터 구조**

| title | context | question | id | answer |
| --- | --- | --- | --- | --- |
| 파우스트_서곡 | 1839년 바그너는 괴테의 파우스트을 처음 읽고 그 내용에 마음이 끌려 이를 소재로… | 바그너는 괴테의 파우스트를 읽고 무엇을 쓰고자 했는가? | 6566495-0-0 | {'text': '교향곡', 'answer_start': 54} |
| 파우스트_서곡 | 1839년 바그너는 괴테의 파우스트을 처음 읽고 그 내용에 마음이 끌려 이를 소재로… | 바그너는 교향곡 작곡을 어디까지 쓴 뒤에 중단했는가? | 6566495-0-1 | {'text': '1악장', 'answer_start': 421} |
| … | … | .. | … | … |

**길이 분석**

기존 Train, Validation set과 비교 결과

- 기존 Train, Validation 데이터와 전반적으로 유사한 분포를 보이는 것을 확인
    - 다만 Context의 길이의 경우, 기존 데이터 셋에 비해 상대적으로 짧은 경향을 보임
- Train 데이터의 수가 제한적인 상황에서 활용하기 적합한 데이터라고 판단

---

# 방법론

## Retrieval

- **Retrieval 요약**

    > 약 6만개의 위키피디아 데이터셋에서 Query와 가장 유사한 document를 찾아야 함
    - Sparse 방법론인 TF-IDF, BM25, Elastic Search 사용

        → 유의미한 성능 향상

    - Dense Embedding

        → 속도 측면에서는 매우 빠르지만 Sparse보다 더 낮은 성능을 보임

    - Reranker: Sparse 방법론으로 1차 Retrieval 후 2차로 Reranking 적용

        → 유의미한 성능 향상

    - 사용한 모델
        - `dragonkue/bge-reranker-v2-m3-ko`

        https://huggingface.co/dragonkue/bge-reranker-v2-m3-ko

### Sparse Embedding

1. TF-IDF (Term Frequency-Inverse Document Frequency)

    $$
    \text{TF-IDF}(term, doc) = \text{TF}(term, doc) \times \text{IDF}(term)
    $$

    - 특정 단어가 문서 내에서 얼마나 자주 등장하는지와 전체 문서 집합에서는 얼마나 드물게 등장하는지를 결합한 지표 → 전체 Corpus에서 단어 하나가 얼마나 중요한지를 수치적으로 나타낸 가중치
    - TF (Term Frequency)
        - 특정 문서에서 특정 단어의 등장 횟수
        - 길이가 긴 문서일수록 문장 내 단어가 더 많고, 특정 단어 또한 더 자주 등장할 확률이 높기 때문에 특정 단어의 등장 횟수를 문서 내 총 단어 수로 정규화하여 긴 문서로 인한 편향을 방지
        - TF가 높을수록, 특정 단어가 문서 내에서 중요하다고 볼 수 있음
    - IDF (Inverse Document Frequency)
        - 특정 단어가 등장한 문서의 수인 DF(Document Frequency)의 역수를 취한 값
        - 'the', 'a'와 같은 단어는 특정 문서 내에 여러 번 등장할 확률이 높으므로 TF는 높을 수 있지만, 문서를 구분하는데에는 의미가 없기 때문에 이를 보정하기 위해서 사용
        - 여러 문서에 걸쳐서 자주 등장하는 단어는 IDF의 값이 작고, 자주 등장하지 않는 단어는 IDF의 값이 커짐
    - 최종적으로는 각 Query에 대한 TF-IDF 값과 각 문서의 TF-IDF 값을 곱해 유사도를 계산
2. BM25

    $$
    \text{BM25}(D, Q)=\sum^n_{i=1}\text{IDF}(q_i)\cdot\frac{\text{TF}(q_i, D)\cdot (k_1+1)}{\text{TF}(q_i, D)+k_1\cdot(1-b+b\cdot\frac{|D|}{avgdl})}
    $$

    - TF-IDF를 바탕으로 이를 개선한 알고리즘으로, TF와 IDF를 곱해주는 시스템은 같지만, 몇 가지 파라미터를 통해 성능을 개선하였음
    - 단어 빈도가 높아질수록 특정 값으로 수렴하게 되면서 TF의 영향력은 줄어드는 반면, 출현 문서가 많아질수록 패널티를 부여하므로 IDF의 영향력은 커지게 되고, 문서의 평균 길이를 이용함으로써 문서 길이의 영향을 줄임
3. Elasticsearch
    - Elasticsearch는 오픈소스 분산형 검색 및 분석 엔진으로, 대량의 데이터를 거의 실시간으로 저장 및 검색할 수 있는 강력한 도구
    - TF-IDF나 BM25는 벡터 생성이나 유사도 계산에 많은 시간이 소요된다는 문제점이 있었으나, 같은 BM25 기반 검색을 사용하는 Elasticsearch는 약 3~4배 빠른 시간으로 Retrieval이 가능하였음
