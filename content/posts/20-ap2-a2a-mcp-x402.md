---
title: "AP2 × A2A × MCP × x402 — 프로토콜 스택에서 결제의 자리"
date: 2026-06-06
draft: false
tags: [AP2, A2A, MCP, x402, agent, payments, protocol, web3]
category: Agent
image: "/meshblog/og/posts/ap2-a2a-mcp-x402.png"
related:
  - 17-ap2-protocol
  - 13-a2a-protocol
  - 18-ap2-core-concepts
---

# AP2 × A2A × MCP × x402 — 프로토콜 스택에서 결제의 자리

[spec link](https://ap2-protocol.net/en/topics/ap2-a2a-and-mcp)

에이전트 생태계의 프로토콜이 늘어나면서 "이건 뭐가 다른가"라는 질문도 함께 늘었다. MCP, A2A, AP2, 그리고 x402까지 — 이름만 보면 경쟁 관계 같지만 실제로는 서로 다른 층을 맡는 보완 관계다.

이 글은 AP2 공식 문서의 두 편 — *AP2, A2A, and MCP*와 *AP2 and x402* — 을 묶어, 각 프로토콜이 스택 어디에 서는지 정리한다.

## 한 줄 구분법

AP2 문서가 제시하는 구분은 간결하다.

```
MCP  →  에이전트가 데이터와 대화한다   (APIs, tools)
A2A  →  에이전트가 에이전트와 대화한다 (tasks, messages)
AP2  →  에이전트가 결제에 관해 대화한다 (mandates)
```

회사에 비유하면 MCP는 직원이 쓰는 사내 시스템 접속 권한이고, A2A는 부서 간 업무 협조 절차이며, AP2는 법인카드 결재 규정이다. 셋 다 "소통의 규격"이지만 다루는 대상이 다르다.

## AP2 + A2A: 결제를 위한 에이전트 간 통신

AP2는 A2A의 **선택적 확장(optional extension)**이다. Shopping Agent, 상인, Credentials Provider 같은 행위자 사이의 멀티 에이전트 결제 거래에서, A2A가 통신로를 깔고 AP2가 그 위에 결제 어휘를 얹는다.

- **A2A가 필요한 이유**: 에이전트가 둘 이상이 되는 순간, 에이전트 간 통신의 표준이 필요하다
- **AP2가 필요한 이유**: mandate 같은 결제 세부 정보의 통신을 표준화해야 한다

즉 A2A 없이 AP2만 쓸 수는 없고(통신로가 없다), A2A만으로 결제를 하면 신뢰 장치가 없다(서명된 mandate가 없다). 둘은 층이 다르다.

## AP2 + MCP: 외부 자원과의 연결

MCP는 AI 모델과 에이전트가 도구, API, 데이터 소스 같은 외부 자원에 연결하는 방법을 표준화한다. 결제 맥락에서는 개발자가 결제 제공자(provider)와 통합하는 도구를 MCP로 구현할 수 있다. AP2 팀은 AP2용 MCP 서버도 작업 중이라고 밝혔다.

정리하면 — A2A와 MCP가 에이전트의 **기초 통신·상호작용 층**을 제공하고, AP2는 그 위에 결제 특화 보안 확장을 더해 authorization·authenticity·accountability 문제를 푼다.

## AP2 + x402: 디지털 화폐라는 결제 수단

x402는 HTTP 402(Payment Required) 상태 코드에서 출발한, 암호화폐 기반 머신 결제 표준이다. AP2와 x402의 관계는 위의 층 구분과 또 다르다 — x402는 통신 층이 아니라 **결제 수단(payment method) 층**이다.

AP2의 핵심 원칙 중 하나가 **payment-method-agnostic(결제 수단 비종속)** 설계다.

- 초기 버전: 카드 같은 "pull" 결제 지원
- 로드맵: 실시간 계좌이체 같은 "push" 결제, 그리고 디지털 화폐

x402는 이 로드맵의 "디지털 화폐" 자리에 들어오는 결제 수단이고, AP2는 그 수단이 무엇이든 mandate 기반 신뢰 장치(Intent/Cart/Payment Mandate)를 동일하게 적용한다. 에이전트의 권한과 사용자 의도 검증이 중요한 도메인이라면 결제 레일이 카드든 온체인이든 같은 문제이기 때문이다.

구글은 [google-agentic-commerce/a2a-x402](https://github.com/google-agentic-commerce/a2a-x402) 저장소에서 A2A와 x402 표준을 결합한 구현을 공개했고, 시간이 지나며 AP2와 긴밀히 정렬해 디지털 화폐를 포함한 모든 결제 수단을 조합할 수 있게 만들겠다고 밝혔다. 파트너로는 Coinbase, CrossMint, EigenLayer, Ethereum Foundation, Mesh, Metamask, Mysten 등 결제·web3 생태계의 주요 플레이어가 참여한다.

## 스택 전체를 한눈에

```
┌─────────────────────────────────────┐
│  결제 수단:  카드 · 계좌이체 · x402   │  ← 무엇으로 내는가
├─────────────────────────────────────┤
│  AP2: mandate 기반 신뢰·책임 장치     │  ← 결제를 어떻게 믿는가
├─────────────────────────────────────┤
│  A2A: 에이전트 간 task·message       │  ← 에이전트끼리 어떻게 일하는가
├─────────────────────────────────────┤
│  MCP: 도구·API·데이터 연결           │  ← 외부 세계와 어떻게 닿는가
└─────────────────────────────────────┘
```

⇒ 네 프로토콜은 경쟁자가 아니라 한 스택의 서로 다른 층이다. AP2의 베팅은 분명하다 — 결제 수단은 계속 바뀌지만, **"사용자 의도의 검증 가능한 증명"이라는 층은 수단과 무관하게 살아남는다**.

## In My opinion

현재는 외부의 tool을 활용하여 결제를 할 수 있는 agent를 만드려면 4개의 층을 모두 알아야 한다.
이를 보다 단순화 하는 sdk를 만들 수 있다면 다양한 서비스에서 자신만의 agent를 만들 수 있는 기반이 될 것이다.
이러한 agent 기반의 시스템이, 어떻게 ai agent로 돈을 벌 것인가에 대한 방향을 제시한다고 생각한다. 

## References

- [AP2 Protocol — AP2, A2A, and MCP](https://ap2-protocol.net/en/topics/ap2-a2a-and-mcp)
- [AP2 Protocol — AP2 and x402](https://ap2-protocol.net/en/topics/ap2-and-x402)
- [a2a-x402 GitHub Repository](https://github.com/google-agentic-commerce/a2a-x402)
- [AP2 Protocol — Official Site](https://ap2-protocol.net/en/)
