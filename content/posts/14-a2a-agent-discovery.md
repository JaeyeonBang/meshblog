---
title: "A2A Protocol — Agent Discovery, 에이전트는 어떻게 서로를 찾는가"
date: 2026-05-27
draft: false
tags: [A2A, agent, discovery, AgentCard, well-known, registry, protocol, LLM]
category: Agent
image: "/meshblog/og/posts/a2a-agent-discovery.png"
related:
  - 13-a2a-protocol
  - 07-agentic-llms-survey-interacting
---

# A2A Protocol — Agent Discovery, 에이전트는 어떻게 서로를 찾는가

[spec link](https://a2a-protocol.org/latest/topics/agent-discovery/)

에이전트가 다른 에이전트에게 일을 위임하려면 먼저 **상대를 찾아야** 한다. 사람이 명함을 받고 회의 자리를 잡듯, 클라이언트 에이전트는 원격 에이전트의 정체와 능력을 어딘가에서 읽어 와야 한다. A2A는 이 "어딘가"를 한 가지로 강제하지 않는다. 환경과 보안 요구에 따라 세 가지 전략을 허용하고, 그 중심에 단 "Agent Card" 가 있다.

이 글은 A2A의 agent discovery 전략 세 가지와, 노출된 Agent Card를 보호·캐시하는 방법을 정리한다.

## Agent Card의 역할

Agent Card는 A2A Server의 **digital business card**다. 클라이언트가 처음 만나는 모든 정보가 여기에 모이고, 모든 후속 호출은 이 카드에서 출발한다.

| 필드 | 내용 |
| --- | --- |
| **identity** | `name`, `description`, `provider` |
| **service endpoint** | A2A 서비스의 `url` |
| **A2A capabilities** | `streaming`, `pushNotifications` 등 지원 기능 |
| **authentication** | 요구 인증 스킴 (`Bearer`, `OAuth2` 등) |
| **skills** | `AgentSkill` 객체 목록 — `id`, `name`, `description`, `inputModes`, `outputModes`, `examples` |

클라이언트는 이 카드 한 장으로 "이 에이전트가 내 요청에 적합한가, 어떤 형식으로 호출해야 하는가, 인증은 어떻게 거는가" 세 질문에 모두 답한다.

## 세 가지 discovery 전략

A2A는 발견 메커니즘을 **단일 표준으로 못 박지 않는다**. 대신 배포 환경의 결에 맞춰 셋 중 하나를 고르도록 한다.

### 1. Well-Known URI

도메인 내부에서 공개적으로 발견되는 에이전트에 적합한 방식. RFC 8615의 `well-known` 패턴을 그대로 빌려온다.

표준 경로는 하나다.

```
https://{agent-server-domain}/.well-known/agent-card.json
```

흐름도 단순하다.

1. 클라이언트가 잠재적 A2A Server의 도메인을 안다 (e.g. `smart-thermostat.example.com`)
2. `https://smart-thermostat.example.com/.well-known/agent-card.json`으로 HTTP GET
3. 존재하면 JSON으로 Agent Card를 돌려준다

구현 비용이 거의 0이고, 표준을 따르며, 자동 발견이 자연스럽다. 다만 카드에 민감 정보가 들어 있다면 이 엔드포인트도 인증으로 보호해야 한다.

### 2. Curated Registries (Catalog-Based Discovery)

엔터프라이즈 환경이나 공개 마켓플레이스에 적합한 방식. 중앙 레지스트리가 여러 Agent Card를 모아두고, 클라이언트는 skill·tag·provider 같은 기준으로 검색한다.

```
A2A Server  ──publish──▶  Registry  ◀──query──  Client
                            │
                            └─ 매칭되는 AgentCard 또는 reference 반환
```

4개의 장점이 있다.

- 중앙 집중 governance와 관리
- 능력 기반(skill 기반) 검색
- access control과 trust framework 결합 용이
- 사적 마켓플레이스와 공개 마켓플레이스 모두 적용

단점도 분명하다.  
레지스트리 서비스 자체를 운영해야 하고, 현재 A2A 스펙은 **레지스트리 API 표준을 규정하지 않는다**.  
레지스트리 구현체 사이의 호환성은 아직 시장에 맡겨져 있다.

### 3. Direct Configuration / Private Discovery

긴밀히 결합된 시스템, 사적 에이전트, 개발 환경에서 쓰는 방식. 클라이언트에 Agent Card 자체나 URL을 **하드코딩**한다.

- 동적 발견 시나리오에 부적합
- 카드가 바뀌면 클라이언트 재배포 필요
- 사설 API 기반 발견 역시 표준화되어 있지 않음

⇒ 빠르게 시작할 수 있는 대신, 운영 단계로 가면 비용이 누적되는 패턴이다.

## Agent Card 보호

Agent Card는 종종 **민감 정보**를 담는다.

- 내부망 또는 제한된 에이전트의 URL
- 민감한 skill 설명

카드를 노출하는 엔드포인트는 그 자체로 보호 대상이다. A2A 스펙이 권장하는 방어선은 세 겹이다.

- **mutual TLS(mTLS)** — 클라이언트와 서버가 서로의 인증서를 검증
- **network restrictions** — IP 범위 화이트리스트 등
- **HTTP Authentication** — OAuth 2.0 등 표준 스킴

레지스트리 기반 경로는 한 단계 방어선이 추가된다.  
**selective disclosure** — 같은 카드라도 호출하는 클라이언트의 정체와 권한에 맞춰 다른 카드를 돌려준다. 
모든 외부 클라이언트가 같은 능력 목록을 보지 않는다.

⇒ 원칙은 분명하다. **민감 데이터가 실린 카드는 인증·인가로 반드시 묶고, static secret을 카드에 박지 말고 out-of-band dynamic credential을 쓴다.**

## Caching: 카드는 자주 바뀌지 않는다

Agent Card는 능력을 기술하는 문서라 변동이 적다. skill이 추가되거나 인증 요구가 바뀔 때만 갱신된다. 표준 HTTP 캐싱이 그대로 잘 들어맞는다.

**서버 측**

- 응답에 `Cache-Control: max-age=...`를 실어 캐시 가능 기간을 알린다
- 카드의 `version` 필드 또는 콘텐츠 해시로 `ETag`를 발행한다
- 두 헤더가 있으면 클라이언트와 중간 캐시가 불필요한 재요청을 줄인다

**클라이언트 측**

- 표준 HTTP 캐싱 의미론을 존중한다
- 캐시 만료 시 통째로 다시 받지 말고 **조건부 요청**을 쏜다. `If-None-Match`로 저장한 `ETag`를 보내거나 `If-Modified-Since`로 시간 비교
- 서버가 캐시 헤더를 안 줬다면 합리적인 기본 캐시 기간을 적용한다

Extended Agent Card는 여기에 **session-scoped 캐싱** 규칙을 더한다. (스펙 8.6절 참조)

## 설계의 결을 읽는다

A2A가 agent discovery를 다루는 방식은 한 줄로 요약된다. **한 가지 메커니즘을 강제하지 않는다.**

- 공개 도메인 → Well-Known URI
- 엔터프라이즈 → Registry
- 사설/개발 → Direct Configuration

대신 모두가 같은 자산(Agent Card)을 같은 형식으로 노출한다. 발견 방법은 자유롭지만 결과물은 똑같다. 이 분리가 A2A를 **인프라 중립적**으로 만든다.

⇒ "어떻게 찾을 것인가"는 환경의 문제이지 프로토콜의 문제가 아니다. A2A는 그 결정을 위임하고, 카드 자체의 일관성만 보장한다.

## In My opinion

처음 앱스토어 / 플레이스토어가 나오며, 앱 시장은 독점하였다. 
이후 각 통신사, 플랫폼별로 유사 앱 설치 플랫폼을 제시하였지만 시장을 가져올 수는 없었다.
Agent Discovery를 효율적으로 진행할 수 있는 표준화된 시장이 있어야, agents 상품과 관련된 시장이 열릴 것이며,
이를 선점한 기업이 큰 시장을 차지할 것이다. 

웹 초기의 DNS, robots.txt, sitemap.xml, `.well-known/`은 모두 비슷한 진화를 거쳤다. 특정 정보를 표준 위치에 두자는 약속에서 시작해, 검색·캐싱·인증 레이어가 점차 위에 쌓였다.  
A2A의 Agent Card도 같은 길을 걸을 수 있다. 처음에는 `.well-known/agent-card.json` 한 장에서 출발하지만, 시간이 지나면 레지스트리 표준 API, 평판 시스템, 능력 검색 엔진이 그 위에 자리 잡는다.  
다만 사람의 명함과 달리 에이전트의 명함은 **자동으로 신뢰**된다. 카드를 받는 즉시 호출이 시작되므로, "이 카드는 진짜인가"를 검증할 사회적 비용을 누가 어떻게 부담하느냐가 다음 라운드의 진짜 쟁점이 될 것 같다.
이 카드에 대한 사회적 평가, 혹은 플랫폼의 평가가 현재 필수적으로 언급되는 이유 중 하나일 수 있다. 

_(이미지: 원본 사이트 참조)_

## References

- [A2A Protocol — Agent Discovery](https://a2a-protocol.org/latest/topics/agent-discovery/)
- [RFC 8615 — Well-Known URIs](https://www.rfc-editor.org/rfc/rfc8615)
