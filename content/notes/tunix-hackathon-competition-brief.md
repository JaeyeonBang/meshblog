---
title: Tunix Hackathon Competition Brief
draft: false
tags:
  - LLM
aliases: []
published_at: '2026-05-07'
---
# Google Tunix Hackathon

## Overview

**오픈소스 [[fixture-rag-overview|LLM]]의 추론 과정(reasoning trace)을 명시적으로 생성하도록 모델을 훈련하는 대회**

**핵심 과제**: Google의 JAX 기반 post-training 라이브러리 Tunix, Gemma2(2B) 또는 Gemma3(1B)를 사용하여 TPU 환경에서 reasoning model을 직접 fine-tuning하는 것

- 별도의 데이터셋 제공 X
- 참가자: 김차미, Minwoo Kang, 호준 이, Jaeyeon Bang, 대민 김

## Timeline

- **시작**: 2025년 11월 11일
- **마감**: 2026년 1월 12일
- **심사**: 1/13–1/23
- **결과 발표**: 1/26

## 대회 목적

다음 2가지를 동시에 충족하는 모델을 만드는 것:

1. **모델이 문제를 정확히 해결할 것**
   - `<answer>` 블록에 최종 정답 출력

2. **사고 과정을 투명하게 보여줄 것**
   - `<reasoning>` 블록 안에 일관된 reasoning trace 출력
   - 단순한 길이가 아니라 단계적 사고, 논리적 흐름, 스스로 오류를 점검, 최종 결론 도출과 같은 요소들이 중요함

```json
<reasoning> ...thinking trace... </reasoning>
<answer> final_answer </answer>
```

## 대회 자원

- TPU 세션 1회 = 9시간 제한
- 주간 20시간 제한
- 모델 크기: Gemma2 2B 또는 Gemma3 1B
- RL 방식: GRPO 기반
- 멀티모달, Tool use 불가
- 출력 토큰 < 1000

## 제출 구성

### 1. Kaggle Writeup
- 최대 1500단어
- 제목, 부제, 분석 내용 포함

### 2. Media Gallery
- 커버 이미지 필수
- 3분 이내 영상 (유튜브 업로드 필수)
  - 프로젝트 소개 및 과정 설명

### 3. Public Notebook
- 튜닝 코드가 들어있는 Kaggle notebook
  - checkpoint파일은 반드시 notebook 결과물로 만들어졌어야 함 (safetensors 형식은 허용 X)
  - 재현 가능해야 함
- Public이어야 하며 private이면 마감 후 자동 Public 처리됨

## 평가 기준

| 평가 항목 | 배점 | 상세 설명 |
| --- | --- | --- |
| **Notebook Quality** | **35점** | - 노트북이 명확하고 상세하게 작성되어야 함<br/>- 포함 필수 요소: Training data, Hyperparameters, Prompt, Training strategy/techniques<br/>- Gemma2 Starter Notebook 참고 가능<br/><br/>**조건:**<br/>- Kaggle TPU 제한(9시간/세션, 20시간/주)<br/>- 출력 토큰 < 1K 허용<br/>- 영어만 사용 (다국어 비중 없음)<br/>- Tool 사용은 필수가 아님<br/>- 멀티모달리티 불가 |
| **Model Quality (Single Kaggle Session)** | **45점** | - 튜닝된 모델은 반드시 **단일 9시간 TPU 세션에서 직접 생성**된 결과여야 함<br/>- Checkpoint는 Tunix + Gemma2 또는 Gemma3 코드로 로드 가능해야 함<br/>- 모델 출력 형식 준수: `<reasoning>...</reasoning>` `<answer>...</answer>`<br/><br/>**평가 방식:**<br/>- reasoning trace + 최종 answer 모두 평가<br/>- LLM-as-a-judge + Human judgment 혼합<br/>- 평가 도메인: 창작, 아이디어, 요약, 수학, 코딩, 기초과학 등 다양 (비검증 가능/불가능 문제 포함) |
| **Video Quality** | **20점** | - **3분 이하**, 명확하고 교육적 가치가 있어야 함<br/>- Tunix로 reasoning 모델을 훈련하는 방법을 잘 설명해야 함<br/>- 제작물의 완성도가 높고, 참가자의 실제 작업과 일치해야 함|
| **Model Quality (Multi-session, optional)** | **15점 (선택)** | - 중간 체크포인트를 저장하고 로드하여 여러 Kaggle TPU 세션에 걸쳐 모델을 미세 조정할 수 있으면 좋음<br/>- private data 사용 가능<br/><br/>**필수 조건:**<br/>- Notebook 끝에 제출 모델의 Kaggle model name/ID 명시<br/>- Gemma2/3 + Tunix로 로드 가능해야 하며 safetensors 불가<br/>- 미기재 시 0점 처리 |

## 참고 자료

### Tunix 관련 공식 리소스
- Tunix GitHub 저장소: https://github.com/google/tunix/
- Tunix 공식 문서 사이트: https://tunix.readthedocs.io/en/latest/index.html

### Kaggle Starter Notebooks
- Gemma2 2B GRPO 데모 노트북: https://www.kaggle.com/code/windmaple/grpo-demo-gemma2-2b
- Gemma3 1B GRPO 데모 노트북: https://www.kaggle.com/code/windmaple/grpo-demo-gemma3-1b

### 필수 프레임워크 문서
- JAX: https://jax.dev/
- Flax: https://flax.readthedocs.io/

### Reasoning 관련 핵심 연구 논문들
- DeepSeek-R1: https://arxiv.org/abs/2501.12948
- Rubrics as Rewards: https://arxiv.org/abs/2507.17746
- RLVR 확장 논문: https://arxiv.org/pdf/2506.18254
- Bridging Offline & Online RL: https://arxiv.org/pdf/2506.21495
