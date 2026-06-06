---
title: "AP2 Core Concepts — 역할 분리와 세 가지 Mandate"
date: 2026-06-06
draft: false
tags: [AP2, agent, payments, mandate, verifiable-credentials, architecture, protocol]
category: Agent
image: "/meshblog/og/posts/ap2-core-concepts.png"
related:
  - 17-ap2-protocol
  - 19-ap2-life-of-a-transaction
  - 13-a2a-protocol
---

# AP2 Core Concepts — 역할 분리와 세 가지 Mandate

[spec link](https://ap2-protocol.net/en/topics/core-concepts)

앞 글에서 AP2가 "에이전트를 믿지 말고 사용자의 서명을 믿어라"라는 원칙 위에 서 있다고 정리했다. 이번 글은 그 원칙이 실제 구조로 어떻게 구현되는지 본다. 두 축이다 — 행위자를 쪼개는 **역할 기반 아키텍처(role-based architecture)**, 그리고 신뢰를 운반하는 **세 가지 Mandate**.

## 여섯 개의 역할

AP2는 거래에 참여하는 행위자를 여섯 역할로 분리한다. 관심사의 분리(separation of concerns)가 곧 보안 설계다.

| 역할 | 담당 |
| --- | --- |
| **User** | 결제 작업을 에이전트에게 위임하는 사람 |
| **User Agent / Shopping Agent (SA)** | 사용자가 대화하는 AI 표면 (e.g. Gemini, ChatGPT). 요구를 이해하고 장바구니를 만들고 승인을 받아낸다 |
| **Credentials Provider (CP)** | 결제 자격증명을 안전하게 보관·관리하는 전문 주체 (e.g. 디지털 지갑) |
| **Merchant Endpoint (ME)** | 상인을 대신해 상품을 보여주고 장바구니를 협상하는 인터페이스 또는 에이전트 |
| **Merchant Payment Processor (MPP)** | 결제 네트워크로 보낼 최종 거래 승인 메시지를 구성하는 주체 |
| **Network & Issuer** | 결제 네트워크와 카드 발급 금융기관 |

핵심은 Shopping Agent가 **결제 카드 정보를 절대 만지지 않는다**는 점이다. 쇼핑과 발견을 담당하는 에이전트는 PCI 데이터와 PII에 접근할 수 없고, 민감 정보는 Credentials Provider와 기존 결제 인프라의 보안 영역에서만 다뤄진다. 식당에서 주문을 받는 종업원과 카드를 긁는 계산대가 분리된 구조와 같다 — 종업원(SA)은 메뉴 협상만 하고, 카드는 계산대(CP)만 본다.

## 신뢰의 앵커: Verifiable Credentials

역할이 나뉘었으니, 이제 역할 사이를 오가는 메시지가 신뢰를 운반해야 한다. 그 그릇이 **Verifiable Credential(VC)**이다. VC는 변조가 드러나고(tamper-evident), 이동 가능하며(portable), 암호학적으로 서명된 디지털 객체다. AP2 문서의 표현을 빌리면 "에이전트들이 주고받는 신뢰의 언어"다.

세 가지 VC가 각각 다른 질문에 답한다.

### 1. Cart Mandate — "이 장바구니, 내가 승인했다" (human-present)

사용자가 자리에서 직접 구매를 승인하는 시나리오의 기본 자격증명이다. **상인이 생성하고, 사용자가 (보통 기기를 통해) 암호학적으로 서명한다.** 사용자의 신원과 승인을 특정 거래에 결박(binding)하는 구조다.

Cart Mandate에 담기는 것:

- 지불인(payer)·수취인(payee)의 검증 가능한 신원
- 특정 결제 수단의 토큰화된 표현
- 최종 확정된 거래 내역 — 상품, 배송지, 금액, 통화
- 리스크 관련 신호를 담는 컨테이너

여기서 중요한 디테일은 "최종, 정확한(final, exact)"이다. 대략적인 의향이 아니라 품목과 가격이 확정된 장바구니에 서명하므로, 나중에 "내가 산다고 한 건 이게 아닌데"라는 분쟁의 여지가 사라진다.

### 2. Intent Mandate — "이 조건이면 사도 된다" (human-not-present)

"티켓이 풀리면 바로 사줘", "이 신발이 10만 원 아래로 내려가면 사줘" — 거래 시점에 사용자가 자리에 없는 시나리오를 위한 자격증명이다. **Shopping Agent가 생성하고 사용자가 서명하며**, 정의된 제약 안에서 에이전트가 행동할 권한을 부여한다.

Intent Mandate에 담기는 것:

- 지불인·수취인의 검증 가능한 신원
- 허용된 결제 수단의 목록 또는 카테고리
- 쇼핑 의도 — 상품 카테고리 등 조건 파라미터
- **에이전트가 자연어로 이해한 사용자의 프롬프트**
- 만료 시각 (Time-to-Live)

자연어 이해 내용이 mandate 안에 들어간다는 점이 흥미롭다. 에이전트가 의도를 잘못 해석했는지 사후에 검증할 수 있는 증거가 거래 기록 자체에 남는 셈이다.

### 3. Payment Mandate — "이 거래에 에이전트가 개입했다"

앞의 두 mandate가 사용자↔상인 사이의 신뢰라면, Payment Mandate는 **결제 네트워크와 발급사를 위한** 별도 VC다. 거래의 agentic한 성격을 네트워크에 알려 리스크 평가를 돕는다. 담기는 신호는 둘이다.

- AI 에이전트 개입 여부
- 거래 양식(modality) — Human Present인가, Human Not Present인가

기존 결제망은 에이전트 거래를 식별할 방법 자체가 없었다. Payment Mandate는 발급사가 "이건 에이전트 거래"라는 사실을 알고 자체 리스크 모델에 반영할 수 있게 하는 가시성 장치다.

## 구조가 말하는 것

세 mandate를 나란히 놓으면 설계 의도가 읽힌다.

```
Cart Mandate    →  "무엇을"   샀는지의 증명 (확정 거래)
Intent Mandate  →  "어디까지" 허용했는지의 증명 (위임 범위)
Payment Mandate →  "누가"     거래했는지의 신호 (에이전트 가시성)
```

- 사용자 승인이 필요한 지점마다 서명을 강제한다 → 추론이 아닌 증명
- 역할마다 볼 수 있는 데이터를 제한한다 → 프라이버시가 아키텍처에 내장
- 네트워크에 에이전트 신호를 흘린다 → 기존 리스크 시스템과의 호환

⇒ AP2의 신뢰 모델은 "에이전트가 올바르게 행동할 것"이라는 가정이 아니라, **올바르지 않게 행동해도 증거가 남는 구조** 위에 서 있다.

## In My opinion

LLM의 해석을 서명 가능한 증거로 고정해버리면 "에이전트가 뭘 이해했는가"가 분쟁 가능한 사실이 된다. 모호함을 없애는 게 아니라, 모호함에 책임 소재를 부여하는 접근이다.  
다만 자연어 조건("적당한 가격이면 사줘")의 해석 차이는 서명만으로 해소되지 않는다. 이러한 자연어 조건은 사람간의 거래 프로세스에서도 지양되는 방법이다. 결국 mandate의 조건 언어가 점점 형식화되고, 체계화되는 방향으로 발전할 것이다. 

## References

- [AP2 Protocol — Core Concepts](https://ap2-protocol.net/en/topics/core-concepts)
- [AP2 Protocol — Official Site](https://ap2-protocol.net/en/)
- [AP2 GitHub Repository](https://github.com/google-agentic-commerce/AP2)
