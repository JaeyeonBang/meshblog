---
title: "AP2 Protocol — 에이전트가 결제하는 시대의 신뢰 문제"
date: 2026-06-06
draft: false
tags: [AP2, agent, payments, protocol, A2A, commerce, trust, LLM]
category: Agent
image: "/meshblog/og/posts/ap2-protocol.png"
related:
  - 13-a2a-protocol
  - 18-ap2-core-concepts
  - 19-ap2-life-of-a-transaction
---

# AP2 Protocol — 에이전트가 결제하는 시대의 신뢰 문제

[spec link](https://ap2-protocol.net/en/topics/what-is-ap2)

A2A로 에이전트끼리 일을 주고받는 길이 열리자, 다음 질문이 곧바로 따라왔다. **에이전트가 대신 결제까지 해도 되는가?** 항공권 예약, 가격 협상, 정기 구매 — agentic commerce(에이전트 상거래)가 약속하는 그림은 화려하지만, 정작 오늘의 결제 시스템은 이 그림을 받아줄 준비가 되어 있지 않다.

이 글은 구글이 제안한 **AP2(Agent Payments Protocol)**가 어떤 문제를 풀려고 하는지, 그리고 어떤 원칙 위에 서 있는지 정리한다.

## 깨진 전제: "사람이 직접 buy를 누른다"

오늘의 결제 인프라는 한 가지 전제 위에 서 있다 — **신뢰할 수 있는 웹사이트에서 사람이 직접 "구매" 버튼을 누른다**. 자율 에이전트가 결제를 시작하는 순간 이 전제가 깨지고, 기존 시스템이 답할 수 없는 질문 세 개가 남는다.

- **Authorization(권한)**: 사용자가 이 특정 구매에 대해 에이전트에게 권한을 줬다는 사실을 어떻게 검증하는가?
- **Authenticity(진정성)**: 에이전트의 요청이 사용자의 진짜 의도를 반영한다고 — hallucination이나 오류 없이 — 상인이 어떻게 확신하는가?
- **Accountability(책임)**: 잘못된 거래가 발생하면 누가 책임지는가? 사용자, 에이전트 개발자, 상인, 카드 발급사?

세 질문에 답이 없으면 결과는 뻔하다. 상인은 에이전트 트래픽을 사기로 간주해 차단하고, 사용자는 금융 권한 위임을 망설이고, 생태계는 출발선에서 멈춘다. AP2 문서는 이 상황을 **crisis of trust(신뢰의 위기)**라고 부른다.

## 파편화라는 두 번째 위험

신뢰 위기를 각자 알아서 풀게 두면 어떻게 될까. 대형 플랫폼마다 자기만의 폐쇄형(proprietary, closed-loop) 결제 솔루션을 만들고, 생태계는 조각난다.

- 사용자는 플랫폼마다 다른 결제 경험에 혼란을 겪는다
- 상인 — 특히 소상공인 — 은 솔루션마다 따로 통합 비용을 치른다
- 결제 생태계 전체가 일관된 사기 방지(fraud mitigation)를 할 수 없게 된다

웹이 HTTP라는 공통 언어 위에서 폭발적으로 성장했듯, 에이전트 결제에도 공통 언어가 필요하다는 것이 AP2의 출발점이다. 어떤 호환 에이전트든 어떤 호환 상인과든 안전하게 거래할 수 있어야 한다.

## AP2의 위치: A2A의 확장

AP2는 독립된 새 프로토콜이 아니라 **A2A의 오픈 확장(open extension)**으로 설계되었다. MCP와도 함께 동작한다. 스택으로 보면 이렇다.

```
ADK (또는 임의 프레임워크)  →  에이전트를 만든다
MCP                        →  도구·API에 연결한다
A2A                        →  에이전트끼리 협업한다
AP2                        →  결제를 안전하게 처리한다
```

비유하자면 A2A가 에이전트들의 공용 회의실이라면, AP2는 그 회의실에 추가된 **공증 창구**다. 회의(작업 위임)는 자유롭게 하되, 돈이 오가는 순간만큼은 서명과 기록이 남는 별도 절차를 거친다.

## 다섯 가지 설계 원칙

AP2가 명시한 원칙은 다섯이다.

- **Openness and Interoperability**: 비독점 오픈 스펙. A2A·MCP의 확장으로서 누구나 구현할 수 있고, 상인 도달 범위와 사용자 선택권을 넓힌다.
- **User Control and Privacy**: 최종 권한은 항상 사용자에게 있다. 역할 기반 아키텍처로 결제 정보와 개인 정보를 분리 보호한다.
- **Verifiable Intent, Not Inferred Action**: 신뢰의 근거는 에이전트의 추론이 아니라 **사용자의 결정적(deterministic)이고 부인 불가능한(non-repudiable) 의도 증명**이다. hallucination 리스크를 정면으로 겨냥한 원칙이다.
- **Clear Transaction Accountability**: 모든 거래에 암호학적 감사 추적(audit trail)을 남겨 분쟁 해결의 근거를 만든다.
- **Global and Future-Proof**: 초기 버전은 카드 같은 "pull" 결제를 지원하고, 로드맵에는 실시간 계좌이체(UPI, PIX 같은 "push" 결제)와 디지털 화폐가 올라 있다.

## 신뢰를 운반하는 그릇: Verifiable Credentials

원칙을 구현하는 핵심 장치가 **Verifiable Credentials(VC, 검증 가능한 자격증명)**다. VC는 변조가 드러나고(tamper-evident) 암호학적으로 서명된 디지털 객체로, 에이전트들이 주고받는 거래의 빌딩 블록이다. 세 종류가 있다.

| VC | 시나리오 | 역할 |
| --- | --- | --- |
| **Intent Mandate** | human-not-present | 사용자가 자리에 없을 때 에이전트가 구매할 수 있는 조건을 담는다 |
| **Cart Mandate** | human-present | 특정 장바구니(품목·가격)에 대한 사용자의 최종 명시적 승인 |
| **Payment Mandate** | 공통 | 결제 네트워크·발급사에 AI 에이전트 개입 여부와 사용자 현존 여부를 알린다 |

각 mandate의 구조와 동작은 다음 글(Core Concepts)에서 따로 정리한다.

## 설계의 결을 읽는다

A2A가 "에이전트의 내부를 보지 않고도 협업하게 만든다"였다면, AP2의 한 문장은 이렇다 — **에이전트를 믿지 말고, 사용자의 서명을 믿어라**.

- 에이전트의 추론은 틀릴 수 있다 → 신뢰 앵커를 사용자 서명으로 옮긴다
- 책임 소재가 불분명하다 → 암호학적 증거 사슬로 분쟁의 근거를 만든다
- 결제 수단은 계속 바뀐다 → 프로토콜을 결제 수단에 비종속(payment-agnostic)으로 둔다

⇒ AP2는 에이전트에게 결제 능력을 "부여"하는 프로토콜이 아니라, 에이전트의 결제를 **인간 사회의 신뢰 체계에 접속시키는** 프로토콜이다.

## In My opinion

A2A가 에이전트 간 소통의 규격이라면, AP2는 그 위에 올라간 첫 번째 "고위험 도메인 확장"이라고 본다.  
흥미로운 건 신뢰의 방향이다. AP2는 에이전트를 더 똑똑하게 만들어 신뢰를 얻으려 하지 않고, 에이전트를 아예 신뢰 대상에서 빼버린다. 서명된 mandate만 믿겠다는 것이다. -> Agent 대신 사회적 시스템을 통해 신뢰를 보증하고자 한다.   
결제 다음은 무엇일까. 계약 체결, 의료 기록 접근, 법적 위임 — 사람의 부인 불가능한 의도 증명이 필요한 도메인마다 비슷한 확장이 나올 것이다. AP2는 그 패턴의 첫 사례로 기억될 가능성이 높다.

## References

- [AP2 Protocol — Official Site](https://ap2-protocol.net/en/)
- [AP2 Overview (What is AP2)](https://ap2-protocol.net/en/topics/what-is-ap2)
- [Google Cloud — Announcing AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [AP2 GitHub Repository](https://github.com/google-agentic-commerce/AP2)
