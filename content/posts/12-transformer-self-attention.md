---
title: "트랜스포머(Transformer) 완벽 이해 — Self-Attention, Multi-Head, Positional Encoding"
date: 2025-10-05
tags: [transformer, self-attention, multi-head, positional-encoding, encoder-decoder, masked-attention, machine-learning]
---

## 핵심 요약 — 한 문장으로 정리
**트랜스포머(Transformer)**는 문맥을 계산적으로 캡처하는 **어텐션(Attention)**을 중심으로 한 시퀀스-투-시퀀스 구조로, 입력의 모든 토큰 쌍 간 상호작용을 계산하는 **Self-Attention**과 이를 병렬화한 **Multi-Head Attention**, 위치 정보를 더해주는 **Positional Encoding**, 그리고 각 블록 사이의 **Position-wise Feed-Forward Network(FFN)**와 **Residual + Layer Normalization**으로 구성됩니다. [출처: https://calmmimiforest.tistory.com/110][출처: https://wikidocs.net/31379]

## 1. 왜 트랜스포머인가? — 핵심 아이디어
- RNN/순환 구조 없이도 토큰 간의 장기 의존성을 직접 모델링할 수 있습니다.  
- 입력 시퀀스의 모든 위치를 서로 비교해 중요한 위치에 가중치를 주는 방식으로 문맥을 구성합니다. [출처: https://ydy8989.github.io/2021-01-10-transformer/]

## 2. 핵심 구성요소 개요
1. **Scaled Dot-Product Attention (Self-Attention)**  
2. **Multi-Head Attention** (여러 개의 self-attention을 병렬로 수행)  
3. **Positional Encoding** (순서 정보 추가)  
4. **Position-wise Feed-Forward Network (FFN)**  
5. **Residual Connection + Layer Normalization**  
6. **Encoder-Decoder 구조와 Cross-Attention / Masked Attention**  
(각 항목은 아래에서 상세 설명) [출처: https://calmmimiforest.tistory.com/110][출처: https://moon-walker.medium.com/transformer-%EB%B6%84%EC%84%9D-2-transformer%EC%9D%98-encoder-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0-1edecc2ad5d4]

## 3. Self-Attention (Scaled Dot-Product Attention)
- 입력으로 **Query(Q), Key(K), Value(V)** 행렬을 사용합니다. Q·K^T 연산으로 토큰 간 유사도(어텐션 스코어)를 계산하고, softmax로 정규화한 뒤 V와 곱해 가중합을 구합니다.  
- 수식(간단히): Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) V  
- 분모의 sqrt(d_k)는 내적의 스케일을 조절해 큰 값으로 인한 softmax 포화 현상을 막습니다. [출처: https://calmmimiforest.tistory.com/110][출처: https://blog.naver.com/winddori2002/222008003445]

## 4. Multi-Head Attention
- 하나의 Attention만으로는 포착하기 어려운 여러 종류의 관계를 동시에 학습하기 위해 **여러 개의 헤드(head)**를 병렬로 둡니다. 각 헤드는 서로 다른 선형 변환을 통해 Q,K,V를 만들어 독립적으로 어텐션을 수행합니다.  
- 병렬 헤드들은 서로 다른 위치들 혹은 관점에 주목함으로써 다양한 의존성을 포착할 수 있습니다. [출처: https://www.blossominkyung.com/deeplearning/transformer-mha][출처: https://moon-walker.medium.com/transformer-%EB%B6%84%EC%84%9D-2-transformer%EC%9D%98-encoder-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0-1edecc2ad5d4]

## 5. Positional Encoding (위치 정보)
- 어텐션은 토큰들의 상대·절대 위치 정보를 본래 알지 못하므로, **임베딩에 위치 정보를 더해줍니다**. 논문에서 제안된 방법 중 하나는 **sin/cos 기반의 주기 함수**를 사용하는 방식입니다.  
- 삼각함수를 사용하는 이유: 연속적으로 미분 가능한 형태이고, 덧셈 정리를 통해 토큰 간의 상대적 위치 정보를 표현하는 데 유리합니다. [출처: https://working-helen.tistory.com/97]

## 6. Encoder와 Decoder 구조
- 트랜스포머는 **Encoder(인코더)**와 **Decoder(디코더)**로 구성된 시퀀스-투-시퀀스 구조입니다. Encoder는 여러 층(layer)로 쌓여 있으며 각 층은 Multi-Head Self-Attention → Position-wise FFN 구조를 가집니다. 인코더의 입력 차원과 출력 차원은 동일하게 유지됩니다. [출처: https://white-joy.tistory.com/12][출처: https://moon-walker.medium.com/transformer-%EB%B6%84%EC%84%9D-2-transformer%EC%9D%98-encoder-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0-1edecc2ad5d4]

- Decoder는 자체의 **Masked Multi-Head Self-Attention**(미래 토큰 차단) → **Encoder-Decoder Cross-Attention**(인코더 출력에 대한 어텐션) → **FFN** 순으로 동작합니다. Masked Self-Attention은 디코딩 시점에서 **미래 정보가 유입되는 것을 방지**하기 위해 사용됩니다. [출처: https://calmmimiforest.tistory.com/110][출처: https://glanceyes.com/entry/Transformer%EC%9D%98-Multi-Head-Attention%EA%B3%BC-Transformer%EC%97%90%EC%84%9C-%EC%93%B0%EC%9D%B8-%EB%8B%A4%EC%96%91%ED%95%9C-%EA%B8%B0%EB%B2%95]

## 7. Position-wise Feed-Forward Network (FFN)
- 각 위치별(토큰별)로 동일한 두 개의 선형 변환과 활성화 함수(예: ReLU)를 적용하는 구조입니다. 어텐션으로 얻은 위치별 표현을 더 풍부하게 변환합니다.  
- 내부적으로는 완전 연결(Linear) 레이어들이 분포를 다른 공간으로 매핑해 표현력을 높입니다. [출처: https://nicedeveloper.tistory.com/entry/Transformer2-Multi-Head-Attention-Scaled-Dot-Product-Attention-Masking-Position-wise-Feed-Forward-Network-Query-Key-Value]

## 8. Residual Connection + Layer Normalization
- 각 서브레이어(예: attention, FFN) 후에 **잔차 연결(residual)**을 두고 **Layer Normalization**을 더해 안정적인 학습과 더 깊은 네트워크 구성이 가능하게 합니다. [출처: https://calmmimiforest.tistory.com/110]

## 9. 직관적 이해: 무엇을 배우는가?
- Self-Attention은 동일 문장 내 토큰들 간의 **유사도(연관성)**를 학습해, 각 단어의 표현을 문맥에 맞게 조정합니다. 학습된 어텐션 맵을 보면 보통 **자기 자신과 매핑되는 값이 크고, 유사한 단어들이 높은 가중치**를 갖는 경향이 관찰됩니다. [출처: https://www.blossominkyung.com/deeplearning/transformer-mha]

## 10. 간단한 구현 포인트(원리 중심)
- Q, K, V는 입력 임베딩에 대해 서로 다른 **선형 변환**을 적용하여 얻습니다. q = W_q x, k = W_k x, v = W_v x 형태입니다. 여러 헤드는 각기 다른 W_q/W_k/W_v를 갖습니다. [출처: https://calmmimiforest.tistory.com/110]  
- 인코더의 입력과 출력 차원을 같게 두는 것은 블록 간 잔차 연결을 자연스럽게 적용하기 위함입니다. [출처: https://moon-walker.medium.com/transformer-%EB%B6%84%EC%84%9D-2-transformer%EC%9D%98-encoder-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0-1edecc2ad5d4]

## 11. 마무리 요약
- 트랜스포머는 어텐션을 통해 시퀀스 전체의 상호작용을 직접 모델링하는 구조이며, **Self-Attention**, **Multi-Head**, **Positional Encoding**, **Masked Attention**, **Cross-Attention**, **FFN**, **Residual+LayerNorm**의 조합으로 강력한 표현력을 얻습니다. [출처: https://ydy8989.github.io/2021-01-10-transformer/][출처: https://calmmimiforest.tistory.com/110]

## 참고 자료(본문에서 인용한 출처)
- https://calmmimiforest.tistory.com/110 [출처: calmmimiforest.tistory.com/110]  
- https://www.blossominkyung.com/deeplearning/transformer-mha [출처: blossominkyung.com/deeplearning/transformer-mha]  
- https://blog.naver.com/winddori2002/222008003445 [출처: blog.naver.com/winddori2002/222008003445]  
- https://nicedeveloper.tistory.com/entry/Transformer2-Multi-Head-Attention-Scaled-Dot-Product-Attention-Masking-Position-wise-Feed-Forward-Network-Query-Key-Value [출처: nicedeveloper.tistory.com]  
- https://white-joy.tistory.com/12 [출처: white-joy.tistory.com/12]  
- https://glanceyes.com/entry/Transformer%EC%9D%98-Multi-Head-Attention%EA%B3%BC-Transformer%EC%97%90%EC%84%9C-%EC%93%B0%EC%9D%B8-%EB%8B%A4%EC%96%91%ED%95%9C-%EA%B8%B0%EB%B2%95 [출처: glanceyes.com]  
- https://working-helen.tistory.com/97 [출처: working-helen.tistory.com/97]  
- https://moon-walker.medium.com/transformer-%EB%B6%84%EC%84%9D-2-transformer%EC%9D%98-encoder-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0-1edecc2ad5d4 [출처: moon-walker.medium.com]  
- https://ydy8989.github.io/2021-01-10-transformer/ [출처: ydy8989.github.io/2021-01-10-transformer/]

추가로 원하시면:
- 수식이 포함된 상세 유도(예: softmax 전/후 스케일링 효과)나  
- 파이토치(PyTorch)로 간단한 Attention/Multi-Head 구현 예시를 이어서 작성해 드리겠습니다.
