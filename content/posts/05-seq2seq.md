---
title: "Seq2Seq — Encoder-Decoder 구조와 시퀀스 변환의 시작"
date: 2025-11-21
tags: [seq2seq, rnn, encoder-decoder, attention, machine-learning, deep-learning]
image: "/meshblog/og/posts/05-seq2seq.svg"
---

# Seq2Seq — Encoder-Decoder 구조와 시퀀스 변환의 시작

딥러닝이 NLP에 본격적으로 침투하기 시작한 2014년, 연구자들은 공통된 벽에 부딪혀 있었다. DNN은 강력하지만 입출력의 크기가 고정되어야 한다는 제약이 있었다. 번역, 요약, 대화처럼 입력과 출력의 길이가 제각각인 작업에는 맞지 않았다.

Sutskever et al. (2014, "Sequence to Sequence Learning with Neural Networks")과 Cho et al. (2014, "Learning Phrase Representations using RNN Encoder–Decoder")은 거의 동시에 같은 해법을 내놨다. 가변 길이 입력을 하나의 고정 크기 벡터로 압축하고, 그 벡터에서 가변 길이 출력을 펼쳐내는 **Encoder-Decoder** 구조다. 이 논문 하나가 기계번역의 BLEU 점수를 당시 최고 수준 SMT 시스템에 근접하게 끌어올렸고, 이후 Attention과 Transformer로 이어지는 계보의 출발점이 됐다.

이 글은 Seq2Seq 논문(Sutskever et al. 2014, arXiv:1409.3215)의 핵심 구조를 정리하고, 등장 배경과 이후 발전 방향을 함께 살펴본다.

## 모델 구조

### Standard RNN의 한계

기존 RNN에서 입력 $(x_1, \dots, x_T)$가 주어지면 출력 $(y_1, \dots, y_T)$는 다음 반복 연산으로 산출된다.

$$
h_t = \text{sigm}(W^{hx} x_t + W^{hh} h_{t-1})
$$
$$
y_t = W^{yh} h_t
$$

문제는 입력 길이 $T$와 출력 길이가 같아야 한다는 점이다. 영어 문장을 한국어로 번역할 때 두 언어의 토큰 수가 일치하는 경우는 거의 없다. 입출력의 길이가 다른 작업에 표준 RNN을 그대로 쓸 수 없다.

### Encoder-Decoder 분리의 의의

Seq2Seq의 핵심 아이디어는 두 개의 독립된 LSTM을 두는 것이다.

- **Encoder**: 입력 시퀀스 전체를 읽고 하나의 고정 길이 벡터 $v$로 압축한다.
- **Decoder**: 벡터 $v$를 초기 은닉 상태로 받아 출력 시퀀스를 생성한다.

이 분리 덕분에 입력과 출력의 길이가 독립적으로 결정된다. 번역은 물론, 요약이나 대화처럼 입출력 길이가 전혀 다른 작업에도 같은 구조를 그대로 쓸 수 있다.

### Context Vector: 역할과 한계

인코더의 마지막 은닉 상태 $h_T$가 곧 context vector $v$다.

$$
c = h_T
$$

$v$는 입력 시퀀스 전체의 의미를 압축한 표현이다. 디코더는 이 벡터를 초기 은닉 상태로 받아 출력을 생성한다.

$$
p(y_1, \dots, y_{T'} | x_1, \dots, x_T) = \prod_{t=1}^{T'} p(y_t | v, y_1, \dots, y_{t-1})
$$

각 시점의 확률은 어휘 전체에 대한 Softmax로 계산되며, 문장의 끝은 `<EOS>` 토큰으로 표시된다.

단, 이 구조에는 분명한 한계가 있다. 입력 시퀀스가 길어질수록 모든 정보를 하나의 고정 크기 벡터에 욱여넣어야 하기 때문에 정보 압축 손실이 발생한다. 이 문제는 뒤에서 다시 다룬다.

### 디코딩 전략: Greedy vs Beam Search

디코더는 각 시점마다 가장 그럴듯한 다음 토큰을 골라야 한다.

**Greedy search**는 각 단계에서 확률이 가장 높은 토큰 하나를 즉시 선택한다. 빠르지만 국소 최적에 빠지기 쉽다. 앞 단계에서 잘못 선택한 토큰이 이후 전체 시퀀스를 망가뜨려도 되돌아갈 방법이 없다.

**Beam search**는 후보 시퀀스를 $k$개(beam width) 유지하면서 전체 경로의 누적 로그 확률이 높은 것을 추적한다. Sutskever et al.은 beam width 2만으로도 greedy에 비해 BLEU가 유의미하게 오른다는 것을 확인했다. 현재도 번역 모델의 표준 디코딩 전략으로 쓰인다.

### 추가 구현 세부 사항

논문이 보고한 몇 가지 구현 트릭이 성능에 큰 영향을 줬다.

- **깊은 레이어**: 4개 레이어의 LSTM을 사용하면 단층보다 유의미하게 성능이 향상됐다.
- **입력 역순**: 입력 시퀀스를 뒤집어서(c, b, a 순으로) 넣었을 때 성능이 올랐다. 짧은 거리 의존성이 많아지고, 인코더가 디코더의 초반 토큰에 집중할 수 있기 때문으로 해석된다.
- **LSTM의 장거리 의존성**: LSTM은 표준 RNN에 비해 시퀀스 길이에 의한 기울기 소실 문제에 덜 취약하다. 긴 문장에서 특히 중요한 특성이다.

## 한계와 발전

### 정보 병목: Context Vector의 압력

Seq2Seq의 구조적 병목은 context vector $v$ 하나에 있다. 입력이 짧은 문장이면 문제가 없다. 그러나 문장이 길어질수록 인코더가 담아야 할 정보의 양은 늘어나지만 $v$의 크기는 고정되어 있다.

실제로 Sutskever et al.도 긴 문장에서 성능 저하가 있음을 인정했다. 이 병목이 다음 돌파구인 Attention의 동기가 됐다.

### Attention 메커니즘의 등장 (Bahdanau et al. 2014)

Bahdanau et al. (2014, "Neural Machine Translation by Jointly Learning to Align and Translate")은 고정 크기 context vector 대신 **디코딩 각 단계마다 입력의 어느 부분에 집중할지를 동적으로 결정**하는 방식을 제안했다.

핵심 아이디어는 단순하다. 디코더가 $t$번째 토큰을 생성할 때, 인코더의 모든 은닉 상태 $h_1, \dots, h_T$를 다시 들여다보고 현재 상황과 얼마나 관련 있는지 가중치(attention score)를 계산한다. 그 가중 합이 context로 쓰인다.

이 변화 하나로 긴 문장에서의 번역 품질이 크게 올랐다. 입력 문장에서 특정 단어를 디코딩할 때 해당 단어와 관련된 입력 부분에 집중할 수 있게 됐기 때문이다. 이후 Attention은 별도 컴포넌트가 아니라 모델 전체를 지배하는 원리로 발전한다.

### Transformer로 이어지는 흐름

Vaswani et al. (2017, "Attention Is All You Need")는 RNN 구조 자체를 버리고 **Attention만으로** Encoder-Decoder를 구성했다. Self-Attention이 병렬 연산을 가능하게 했고, 학습 속도와 성능이 함께 올랐다.

흐름을 정리하면 이렇다.

```
Standard RNN (가변 길이 불가)
  ↓
Seq2Seq + LSTM (가변 길이 해결, 고정 context 병목)
  ↓
Seq2Seq + Attention (동적 context, 긴 문장 해결)
  ↓
Transformer (RNN 제거, Self-Attention 전면화)
  ↓
BERT, GPT, T5, ... (사전학습 언어 모델)
```

각 단계는 앞 단계의 병목을 정확하게 짚어서 해결했다. Seq2Seq은 그 계보의 첫 번째 칸이다.

## 결론

Seq2Seq이 남긴 유산은 구체적이다. Encoder-Decoder 분리라는 설계 패턴이 현재까지 유효하다. T5, BART, mT5 같은 현대 모델도 여전히 인코더로 입력을 표현하고 디코더로 출력을 생성하는 구조를 쓴다. GPT처럼 디코더만 쓰는 모델도 결국 "압축된 표현에서 시퀀스를 펼쳐낸다"는 원리를 공유한다.

2014년 논문 한 편이 고정 크기 벡터와 두 개의 LSTM으로 이 구조를 처음 명확하게 제시했다. 이후 10년의 발전은 그 위에 쌓인 것이다.
