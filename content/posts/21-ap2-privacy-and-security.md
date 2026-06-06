---
title: "AP2 — Privacy and Security, 새로운 리스크 지형"
date: 2026-06-06
draft: false
tags: [AP2, agent, payments, privacy, security, risk, PCI, protocol]
category: Agent
image: "/meshblog/og/posts/ap2-privacy-and-security.png"
related:
  - 17-ap2-protocol
  - 18-ap2-core-concepts
  - 15-a2a-enterprise-ready
---

# AP2 — Privacy and Security, 새로운 리스크 지형

[spec link](https://ap2-protocol.net/en/topics/privacy-and-security)

결제 프로토콜의 성패는 기능이 아니라 보안에서 갈린다. AP2는 프라이버시와 보안을 사후 패치가 아닌 **기초 기둥(foundational pillar)**으로 선언하고, AI 네이티브 세계에 맞게 거래 흐름 자체를 다시 설계했다.

이 글은 AP2의 보안 설계 두 축 — 아키텍처에 내장된 프라이버시, 그리고 에이전트 결제가 만들어내는 새 리스크 지형 — 을 정리한다.

## 원칙 1: 사용자 통제와 Privacy by Design

최종 권한은 항상 사용자에게 있다. 프로토콜은 에이전트의 금융 활동에 대해 사용자에게 세밀한 통제권과 투명한 가시성을 주도록 설계되었고, 보호 대상에는 결제 정보만이 아니라 **대화 프롬프트(conversational prompts)**도 포함된다.

프롬프트가 보호 대상이라는 점이 AI 네이티브 설계의 표식이다. "이 신발 100달러 아래면 사줘"라는 발화에는 취향, 예산, 생활 패턴이 묻어 있다 — 기존 결제 시스템에는 존재하지 않던 민감 데이터 범주다.

## 원칙 2: 역할 분리가 곧 방화벽

핵심 보안 장치는 행위자 간 관심사 분리다.

```
Shopping Agent      →  쇼핑·발견 담당.  PCI 데이터 / PII 접근 불가
Credentials Provider →  결제 자격증명 전담 보관
기존 결제 인프라      →  보안 요소(secure element)에서 민감 데이터 처리
```

쇼핑과 발견을 맡는 에이전트는 결제카드 산업(PCI) 데이터와 개인식별정보(PII)에 접근할 수 없다. 민감 데이터는 Credentials Provider 같은 전문 주체와 기존 결제 인프라의 보안 영역에서만 다뤄진다. 호텔 프런트가 투숙객의 방 열쇠는 주지만 금고 비밀번호는 모르는 것과 같은 구조다 — 침해가 발생해도 노출 범위가 역할 경계에서 끊긴다.

## 새로운 리스크 지형

사람이 직접 누르던 결제를 에이전트에게 위임하면, 기존 리스크 모델이 가정하지 않던 변수가 생긴다. AP2 문서는 네 가지를 꼽는다.

- **User Asynchronicity(사용자 비동시성)**: 사용자가 결제 여정 전체에 함께 있지 않다. 실시간 승인을 대신할 견고하고 검증 가능한 mandate가 필요해진다.
- **Delegated Trust(위임된 신뢰)**: 이제 행위자들은 "사용자"가 아니라 "사용자를 대신하는 에이전트"를 믿어야 한다. 에이전트의 신원과 권한 검증이 결정적 문제가 된다.
- **Indirect Trust Establishment(간접 신뢰 수립)**: Credentials Provider는 상인과 직접 관계가 없을 수 있다. Shopping Agent가 그 신뢰 간극을 안전하게 이어줘야 한다.
- **Agent Identity(에이전트 신원)**: Shopping Agent의 신원 자체가 사기·리스크 분석의 새 신호가 된다. 새로운 검증 방법이 필요하다.

## 기존 시스템과의 접속: 갈아엎지 않는다

주목할 점은 AP2가 기존 리스크 인프라를 대체하려 하지 않는다는 것이다. 프로토콜은 참여자 간에 **리스크 신호를 공유하는 공통 언어**를 제공하고, 상인·네트워크·발급사가 이미 운영하는 리스크 시스템에 `PaymentMandate` 같은 agentic 흐름의 새 데이터 포인트를 **증강(augment)**하는 방식을 택한다.

- 기존 시스템: 그대로 동작 (backward compatibility)
- AP2가 더하는 것: 에이전트 개입 여부, human-present 여부 같은 새 신호

수십 년간 쌓인 결제망의 사기 탐지 모델을 버리는 대신, 그 모델의 입력 피처를 늘려주는 접근이다.

## 설계의 결을 읽는다

- 프롬프트까지 보호 대상에 넣는다 → AI 네이티브 프라이버시 정의
- 역할 경계가 데이터 접근 경계다 → 침해의 폭발 반경(blast radius) 제한
- 리스크 신호의 공통 언어를 깐다 → 생태계 전체의 전체론적(holistic) 거래 평가
- 기존 리스크 시스템을 증강한다 → 도입 장벽 최소화

⇒ AP2의 보안 철학은 한 문장으로 요약된다. **새 리스크는 새 증거로 막고, 옛 인프라는 그대로 살린다.**

## In My opinion

네 가지 리스크 중 Agent Identity가 가장 어려운 문제로 보인다. mandate는 "사용자가 무엇을 승인했는가"를 증명하지만, "이 에이전트가 어떤 에이전트인가"는 별개의 신원 인프라가 필요하다. A2A의 Agent Card가 명함이라면, 결제 세계에서는 명함이 아니라 신원보증이 필요하다.  
에이전트 평판 시스템, 에이전트용 신용점수 같은 것이 등장할 수밖에 없을 텐데 — 그 순간 "어떤 에이전트를 쓰느냐"가 거래 승인율에 영향을 주는 세계가 된다. 사람의 신용등급처럼, 에이전트의 신뢰등급이 새로운 비대칭을 만들지도 모른다.

## References

- [AP2 Protocol — Privacy and Security](https://ap2-protocol.net/en/topics/privacy-and-security)
- [AP2 Protocol — Official Site](https://ap2-protocol.net/en/)
- [AP2 GitHub Repository](https://github.com/google-agentic-commerce/AP2)
