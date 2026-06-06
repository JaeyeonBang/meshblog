---
title: "AP2 — Life of a Transaction, 거래 한 건의 일생"
date: 2026-06-06
draft: false
tags: [AP2, agent, payments, transaction, human-present, mandate, flow]
category: Agent
image: "/meshblog/og/posts/ap2-life-of-a-transaction.png"
related:
  - 17-ap2-protocol
  - 18-ap2-core-concepts
  - 16-a2a-life-of-a-task
---

# AP2 — Life of a Transaction, 거래 한 건의 일생

[spec link](https://ap2-protocol.net/en/topics/life-of-a-transaction)

역할과 mandate를 정의했으니, 이제 실제 거래가 처음부터 끝까지 어떻게 흘러가는지 볼 차례다. AP2는 사용자 시나리오를 두 가지 양식(modality)으로 나눈다 — 사용자가 마지막 승인 버튼을 누를 수 있는 **Human Present**, 그리고 에이전트가 사용자 부재 중에 결제를 마쳐야 하는 **Human Not Present**.

이 글은 두 흐름을 단계별로 따라가며, 각 단계에서 어떤 mandate가 만들어지고 어디로 전달되는지 정리한다.

## Human Present: 10단계의 여정

사용자가 에이전트에게 일을 맡기되, 최종 결제 승인은 직접 하는 시나리오다.

```
Setup → Discovery & Negotiation → Merchant Validates Cart
  → Provide Payment Methods → Show Cart → Sign & Pay
  → Payment Execution → Send to Issuer → Challenge(필요시) → Authorization
```

1. **Setup**: 사용자가 Shopping Agent와 Credentials Provider(e.g. 디지털 지갑)를 연결해 둔다.
2. **Discovery & Negotiation**: 사용자가 쇼핑 작업을 지시하면, 에이전트가 하나 이상의 상인과 교섭해 요구를 만족하는 장바구니를 조립한다.
3. **Merchant Validates Cart**: 사용자가 구매할 품목을 승인하면, **상인이 최종 장바구니에 서명**한다. 이 서명은 "이 내용대로 이행하겠다"는 상인의 약속이다.
4. **Provide Payment Methods**: Shopping Agent가 Credentials Provider에 적용 가능한 결제 수단을 요청한다.
5. **Show Cart**: 에이전트가 상인이 서명한 최종 장바구니와 선택된 결제 수단을 **신뢰된 인터페이스(trusted interface)**로 사용자에게 보여준다.
6. **Sign & Pay**: 사용자의 승인이 암호학적으로 서명된 **Cart Mandate**를 생성한다. 이 mandate는 증거로 상인에게 전달되고, 별도의 **Payment Mandate**가 결제 네트워크용으로 준비된다.
7. **Payment Execution**: 결제 정보가 Credentials Provider와 상인에게 전달되어 거래를 완료한다.
8. **Send to Issuer**: 상인(또는 그 프로세서)이 거래를 결제 네트워크와 발급사로 라우팅하며, **Payment Mandate를 첨부**해 거래의 agentic한 성격을 알린다.
9. **Challenge (필요시)**: 발급사·상인 등 어떤 참여자든 3D Secure 같은 추가 인증을 요구할 수 있다. 사용자는 신뢰된 표면에서 challenge를 완료한다.
10. **Authorization**: 발급사가 결제를 승인하고, 확인이 사용자와 상인에게 전달되어 주문이 이행된다.

흐름에서 눈여겨볼 지점은 둘이다. 첫째, **서명이 양방향**이다 — 3단계에서 상인이 먼저 장바구니에 서명하고, 6단계에서 사용자가 서명한다. 서로의 약속이 모두 암호학적 증거로 남는다. 둘째, challenge 단계가 프로토콜 안에 정식으로 들어 있다. 기존 결제망의 리스크 장치(3DS 등)를 우회하지 않고 그대로 수용한다.

## Human Not Present: 의도를 미리 서명한다

"이 신발이 100달러 아래로 떨어지면 사줘" — 거래 시점에 사용자가 없는 시나리오다. Human Present 흐름과의 차이는 세 가지다.

1. **Intent 캡처**: 최종 장바구니 대신, **에이전트가 이해한 사용자의 의도**를 사용자가 승인한다. 세션 내 인증(e.g. 생체 인증)이 서명된 **Intent Mandate**를 만든다.
2. **Intent Mandate 사용**: 사용자의 목표를 자연어로 담은 이 mandate가 상인에게 전달되고, 상인은 요청을 이행할 수 있는지 스스로 판단한다.
3. **상인의 사용자 소환권**: Intent Mandate만으로 이행 가능성이 불확실하면, **상인이 사용자의 세션 복귀를 요구할 수 있다**. 사용자가 최종 옵션 중 하나를 고르거나(→ Cart Mandate 생성), 추가 정보를 제공한다(→ Intent Mandate 갱신).

세 번째 장치가 핵심이다. 자율 실행을 허용하되, 불확실성이 임계치를 넘으면 언제든 human-in-the-loop으로 되돌아가는 탈출구를 상인에게 쥐여준다. 에이전트의 자율성과 상인의 확신 사이 균형을 프로토콜 수준에서 잡은 설계다.

## 두 흐름이 공유하는 뼈대

양식이 달라도 불변 조건은 같다.

- **서명 없이 돈이 움직이지 않는다** — Cart Mandate든 Intent Mandate든, 사용자의 암호학적 서명이 모든 결제의 전제다
- **Payment Mandate는 항상 따라간다** — 네트워크와 발급사는 거래의 agentic 여부를 언제나 알 수 있다
- **신뢰된 표면에서만 승인한다** — 장바구니 확인, challenge 응답 모두 에이전트가 아닌 trusted interface에서 일어난다

⇒ AP2의 거래 흐름은 기존 결제 여정을 갈아엎지 않는다. 사람이 하던 "확인하고 서명하는" 순간들을 mandate라는 이동 가능한 증거로 바꿔치기했을 뿐, 결제망의 뼈대(네트워크 라우팅, challenge, 발급사 승인)는 그대로 둔다. 호환성이 곧 채택 전략이다.

## In My opinion

A2A의 Life of a Task와 비교될 수 있다. Task의 일생이 상태 머신(submitted → working → completed)이라면, Transaction의 일생은 **증거의 연쇄**다. 단계마다 "누가 무엇에 서명했는가"가 누적된다.  
Human Not Present의 "상인이 사용자를 소환할 수 있다"는 장치는 현실적인 타협으로 보인다. 결제 품목에 따라, 방식에 따라, 전체 구매 여정 중 대부분을 agent에게 맡긴다고 하더라도 이슈가 발생할 수 있는 부분은 사람의 개입이 도움이 될 수 있다. 
결국 에이전트 결제의 성숙도는 "사용자 소환 빈도가 얼마나 줄어드는가", "그리고 소환되었을 때 얼마나 많은 일을 효과적으로 처리할 수 있을가"와 관련될 것이다. Intent Mandate의 조건 표현력이 좋아질수록, 그리고 상인/사용자의 신뢰가 높아질수록 소환은 줄어들 텐데, 그 진화 과정은 단순히 기술적인 성숙 뿐만 아니라, 사회적인 적응이 주요할 것이다. 

## References

- [AP2 Protocol — Life of a Transaction](https://ap2-protocol.net/en/topics/life-of-a-transaction)
- [AP2 Protocol — Official Site](https://ap2-protocol.net/en/)
- [AP2 GitHub Repository](https://github.com/google-agentic-commerce/AP2)
