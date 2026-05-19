---
title: A2A Protocol  — 에이전트 간 협업의 핵심 개념
date: 2026-05-19T00:00:00.000Z
draft: false
tags:
  - A2A
  - agent
  - protocol
  - interoperability
  - multi-agent
  - MCP
  - JSON-RPC
  - LLM
category: Agent
image: /meshblog/og/posts/a2a-protocol.png
related:
  - 02-agent-ai-paper-list
  - 03-agentic-llms-survey-intro
  - 06-agentic-llms-survey-acting
  - 07-agentic-llms-survey-interacting
---

# A2A Protocol — 에이전트 간 협업의 핵심 개념

[[spec link]](https://a2a-protocol.org/latest/topics/key-concepts/)

LLM 기반 에이전트가 하나의 시스템에 머무르던 시기는 짧았다. 각자 다른 프레임워크와 도구로 만든 에이전트가 서로의 결과를 받아쓰고, 다시 다른 에이전트에게 일을 넘기는 구조가 빠르게 표준이 되었다. 문제는 이 협업이 늘 임시 통합(ad-hoc integration)으로 묶여 있었다는 점이다. 같은 회사 안에서도 두 에이전트가 만나면 매번 새로 깎아 만든 어댑터를 붙여야 했다.

이에 구글은 **A2A(Agent-to-Agent) Protocol**를 제시한다. 

**A2A(Agent-to-Agent) Protocol**은 Linux Foundation이 관리하는 오픈 스펙으로, 에이전트끼리 서로를 발견하고 작업을 위임하고 결과를 주고받는 방법을 표준화한다.  

이 글은 A2A의 핵심 개념 — actor, communication element, interaction mechanism — 을 정리하고, 왜 이 구조가 에이전트 생태계의 기반이 될 수 있는지 살펴본다.

## 세 actor: User, Client, Server

![](/assets/img/A2A/a2a-actors.png)

A2A의 상호작용은 항상 세 역할(role)로 환원된다.

- **User**: 요청을 시작하는 주체. 사람일 수도 있고 자동화된 서비스일 수도 있다.
- **A2A Client(Client Agent)**: User를 대신해 다른 에이전트에게 통신을 거는 애플리케이션 또는 또 다른 에이전트.
- **A2A Server(Remote Agent)**: A2A 프로토콜을 구현한 HTTP 엔드포인트를 노출하는 원격 에이전트. 요청을 받아 처리하고 결과나 상태를 돌려준다.

여기서 결정적인 설계는 **Remote Agent를 black box로 본다**는 것이다. Client는 Server의 내부 메모리, 사용하는 도구, 추론 체인 어느 것도 알 필요가 없다. 오직 외부 인터페이스(Agent Card)와 주고받는 메시지/아티팩트만 본다. 이 캡슐화 덕분에 LangGraph로 만든 에이전트와 CrewAI로 만든 에이전트가 같은 식탁에 앉을 수 있다.

## 통신 요소(Communication Element) 다섯 가지

| 요소 | 역할 |
| --- | --- |
| **Agent Card** | 에이전트의 정체성·능력·엔드포인트·인증 요구를 담은 JSON 메타데이터 |
| **Task** | 고유 ID와 lifecycle을 가진 stateful 작업 단위 |
| **Message** | Client ↔ Agent 사이의 단일 turn. role(`"user"` / `"agent"`)을 가진다 |
| **Part** | Message·Artifact 안의 콘텐츠 컨테이너. 텍스트·파일·구조화 데이터 중 하나 |
| **Artifact** | Task가 만들어낸 구체적 산출물 (문서, 이미지, 구조화 데이터 등) |

각 요소가 분리된 이유는 분명하다. **메시지는 흐름**이고, **아티팩트는 결과**다. 사람이 일할 때 회의의 발언과 최종 보고서를 구분하는 것과 같다.

### Agent Card: 디지털 명함

Agent Card는 에이전트의 **digital business card**다. Client가 처음 만나는 모든 정보가 여기에 모인다.

- identity (이름, 설명)
- service endpoint(URL)
- A2A capability (스트리밍 지원 여부, 푸시 알림 지원 여부 등)
- authentication 요구사항 (OAuth, API key 등)
- skill 목록 — 이 에이전트가 할 수 있는 일

Client는 Agent Card만 읽고 "이 에이전트가 내 요청을 처리할 수 있는가, 어떻게 호출해야 하는가, 인증은 어떻게 거는가"를 결정한다. 사람이 명함을 받고 회의 자리를 잡는 흐름과 동일하다.

### Part: modality independence의 단위

`Part`는 A2A를 **modality independent**하게 만드는 핵심 장치다. 하나의 Part는 다음 중 정확히 하나의 콘텐츠를 가진다.

- `text` — 평문 문자열
- `raw` — 바이트 배열 (파일 inline)
- `url` — 외부 파일 참조
- `data` — 구조화된 JSON 값

여기에 `mediaType`, `filename`, `metadata`를 더 붙일 수 있다. 같은 Message 안에 텍스트와 이미지와 JSON을 함께 실어 보낼 수 있다는 뜻이고, 새로운 modality가 등장해도 Part 스키마를 깨지 않고 확장할 수 있다.

### Task와 Message의 분기

Server는 요청을 받으면 두 가지 중 하나로 응답한다.

- 즉시 답할 수 있으면 → **Message**를 돌려준다
- 시간이 걸리는 작업이면 → **Task**를 생성해 ID를 돌려준다

이 분기는 단순하지만 중요하다. 모든 호출을 polling-friendly한 Task로 강제하면 단순 질의응답이 무거워지고, 모든 호출을 동기 Message로 강제하면 장시간 작업이 불가능해진다. A2A는 둘을 분리해 양쪽 패턴을 모두 자연스럽게 받는다.

## Interaction Mechanism: 세 가지 통신 패턴

A2A는 작업의 길이와 응답 즉시성에 따라 세 패턴을 지원한다.

```
짧은 작업 ─────────────── 긴 작업
   ↓                         ↓
Request/Response   →   SSE Streaming   →   Push Notification
(polling)              (실시간 점진)         (webhook callback)
```

- **Request/Response(Polling)**: Client가 요청을 보내고 Server가 응답한다. 긴 작업은 Client가 주기적으로 상태를 polling한다.
- **Server-Sent Events(SSE) Streaming**: Client가 스트림을 열고, Server가 진행 중인 결과와 상태를 점진적으로 흘려보낸다. 긴 생성 작업, 점진적 UI에 적합하다.
- **Push Notification**: 매우 긴 작업이나 Client가 연결을 유지하기 어려운 시나리오에서, Server가 Client가 등록한 webhook으로 비동기 알림을 쏜다.

세 패턴 모두 같은 Task 모델 위에서 동작한다. 다시 말해 **Task는 통신 패턴과 직교**한다. 같은 Task를 polling으로 추적하다가 streaming으로 전환할 수 있고, 끊겼다가 push로 마무리될 수 있다.

## 그 외의 토대

- **Context(`contextId`)**: 서버가 발급하는 식별자로, 여러 Task를 하나의 논리적 흐름으로 묶는다. 다중 turn 대화나 연속된 의뢰의 맥락 유지에 쓰인다.
- **Transport & Format**: 전송은 HTTP(S), 페이로드는 **JSON-RPC 2.0**. 이미 검증된 표준만 골라 새 발명품을 최소화했다.
- **Authentication & Authorization**: A2A 메시지 자체는 인증 정보를 포함하지 않는다. 요구사항은 Agent Card에 선언되고, 자격증명(OAuth token, API key)은 HTTP 헤더로 분리되어 전달된다. 프로토콜 계층과 보안 계층을 깨끗하게 나눈 설계다.
- **Agent Discovery**: Client가 Agent Card를 찾아 사용할 수 있는 Server를 식별하는 과정. 디렉토리, 레지스트리, 알려진 URL 등 다양한 방식이 허용된다.
- **Extensions**: 표준에 없는 기능은 Agent Card에 custom protocol extension으로 선언할 수 있다. 표준의 안정성과 실험의 자유를 동시에 잡는 장치다.

## 설계의 결을 읽는다

A2A의 모든 선택은 한 방향을 향한다 — **에이전트의 내부를 보지 않고도 협업하게 만든다**.

- Server를 black box로 둔다 → 구현 다양성 보장
- Agent Card로 사전 협상한다 → discovery와 negotiation 분리
- Task와 Message를 분리한다 → 동기·비동기 양쪽 자연스럽게 수용
- Part로 콘텐츠를 추상화한다 → modality 확장에 깨지지 않는다
- HTTP + JSON-RPC만 쓴다 → 도입 비용 최소화

⇒ 결과적으로 A2A는 "에이전트의 OS"보다는 "에이전트의 HTTP"에 가깝다. 무엇을 어떻게 추론할지 강제하지 않고, 서로를 만나고 일을 주고받는 최소 계약만 정의한다.

## In My opinion

A2A protocol을 통해 agent간의 소통이 규격화 되었다고 생각한다.  
여타 다른 protocol들도 이러한 흐름을 따라갈 것이다.  
그러나, 사람과 사람간의 소통 방식이 언어, 문법과 같은 프로토콜이 있다고 하더라도 여러 문제가 발생한다.  
심지어 규격화된 문서가 왔다 갔다 하더라도, 문화의 차이, 개인의 입장차이, 성격의 차이 등 무수히 많은 영향을 받으며 문제가 발생하곤 한다.
이러한 규격외의 차이가 A2A에 영향을 줄 수 있을까?  
이러한 점을 방지하기 위해서 인간 사회와 같은 문화, 관습, 예절들이 A2A protocol에서도 나타날 수 있을까?  

_(이미지: 원본 사이트 참조)_

## References

- [A2A Protocol — Core Concepts](https://a2a-protocol.org/latest/topics/key-concepts/)
