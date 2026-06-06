---
title: "A2A Protocol — Life of a Task, 작업 하나의 일생"
date: 2026-05-27
draft: false
tags: [A2A, agent, task, contextId, artifact, lifecycle, JSON-RPC, protocol]
category: Agent
image: "/meshblog/og/posts/a2a-life-of-a-task.png"
related:
  - a2a-protocol
  - a2a-agent-discovery
---

# A2A Protocol — Life of a Task, 작업 하나의 일생

[spec link](https://a2a-protocol.org/latest/topics/life-of-a-task/)

A2A에서 가장 자주 헷갈리는 지점은 **Message와 Task의 분기**다. 같은 메시지를 보냈는데 어떤 에이전트는 즉시 Message로 답하고, 어떤 에이전트는 Task ID를 발급한다. 같은 작업을 이어가는데 누구는 `contextId`만 쓰고, 누구는 `referenceTaskIds`를 같이 단다. 끝난 task에 follow-up을 보내면 그 task가 살아나는지 새 task가 생기는지도 늘 묻는다.

이 글은 A2A 작업 한 건의 **일생** — 메시지인가 작업인가, 어떻게 묶고, 언제 끝나고, 그 다음은 무엇인지 — 을 정리한다.

## Message인가 Task인가

A2A 에이전트가 클라이언트 메시지를 받으면 두 갈래로 답한다.

- **Stateless Message** — 즉답 가능하고, 그것으로 끝나는 self-contained 상호작용
- **Stateful Task** — 진행 상황을 알리고 입력을 더 받으며, 중단 상태(`input-required`, `auth-required`)나 종착 상태(`completed`, `canceled`, `rejected`, `failed`)에 이를 때까지 lifecycle을 통과하는 작업

분기는 단순하지만 중요하다. 모든 호출을 polling-friendly한 Task로 강제하면 단순 질의응답이 무거워지고, 모든 호출을 동기 Message로 강제하면 장시간 작업이 불가능해진다.

## contextId: 관련 상호작용을 묶는다

`contextId`는 여러 `Task`와 독립적인 `Message`들을 **하나의 논리적 흐름**으로 묶는 식별자다.

- 클라이언트가 처음 메시지를 보내면 에이전트가 새 `contextId`를 발급한다. Task가 생겼다면 `taskId`도 함께 발급된다
- 클라이언트는 같은 `contextId`를 이후 메시지에 실어 "이건 그 대화의 연속"임을 알린다
- 특정 task와 직접 이어가고 싶다면 `taskId`도 함께 단다

LLM 기반 에이전트는 내부적으로 이 `contextId`로 자기 대화 상태나 LLM 컨텍스트를 관리한다. 같은 contextId 안에서 여러 task가 한 목표를 향해 협업한다.

## 에이전트의 세 갈래 성격

Message와 Task의 사용 비율에 따라 에이전트는 세 가지 성격으로 나뉜다.

| 유형 | 응답 방식 | 특징 |
| --- | --- | --- |
| **Message-only Agents** | 항상 `Message` | 복잡한 상태 관리·장기 실행 없음. LLM 호출과 단순 도구를 감싸는 얇은 wrapper |
| **Task-generating Agents** | 항상 `Task` | 즉답조차 "completed task"로 모델링. Task vs Message 결정 회피 가능, 단순한 상호작용도 task 객체가 생성됨 |
| **Hybrid Agents** | 둘 다 | Message로 능력·범위 협상 → Task로 실제 실행 추적. 가장 일반적인 패턴 |

Hybrid 에이전트의 흐름은 이렇다.

```
Client ──Message──▶ Agent : "이런 일 가능해?"
Client ◀──Message── Agent : "가능. 다음 입력 주면 시작"
Client ──Message──▶ Agent : "여기 입력"
Client ◀──Task──── Agent : taskId 발급, lifecycle 시작
```

핵심 규칙 둘이 따라붙는다. **task가 한 번 생성되면, 그 contextId 안에서 그 task의 응답은 모두 Task 형태다.** 그리고 **task가 종착 상태에 닿으면 그 task에는 더 이상 메시지를 보내지 못한다.**

## Task Refinements: 결과를 다듬을 때

클라이언트는 종종 task 결과를 받아 보고 추가 요청을 보낸다. "이 그림 빨간색으로 바꿔줘" 같은 요청이다. A2A는 이를 **같은 `contextId`에서 새 상호작용을 시작**하는 방식으로 모델링한다.

원본 task를 가리키는 힌트는 메시지의 `referenceTaskIds`에 싣는다. 에이전트는 그 힌트를 보고 새 `Task`나 `Message`로 답한다.

## Task Immutability: 끝난 작업은 다시 시작되지 않는다

종착 상태(completed, canceled, rejected, failed)에 닿은 task는 **재시작하지 않는다.** 후속 정제 요청은 같은 contextId 안에서 **새 task**로 시작한다.

Task Immutability 원칙이 세 가지 이점을 준다.

- **Task Immutability** — 클라이언트가 task와 그 상태·산출물·메시지를 안정적으로 참조한다. 입력→출력의 깨끗한 매핑. orchestration과 traceability에 유리
- **Clear Unit of Work** — 새 요청·정제·후속 작업이 모두 별개 task가 된다. 회계가 단순해지고, 산출물마다 작업 단위 추적이 명확해진다
- **Easier Implementation** — 에이전트 개발자가 "새 task를 만들까, 기존 task를 다시 켤까"를 고민하지 않는다

⇒ task는 한 번 만들어지면 변하지 않는 **불변 단위**. 같은 contextId가 그 불변 단위를 묶어주는 컨테이너다.

## Parallel Follow-ups: 같은 컨텍스트, 병렬 task

`contextId`는 직렬 흐름만 묶지 않는다. 같은 컨텍스트 안에서 여러 task를 **병렬로** 띄운다.

```
Task 1: Helsinki행 항공권 예약
  ├─ Task 2: Task 1 기반 호텔 예약
  │    └─ Task 4: Task 2 호텔에 스파 추가
  └─ Task 3: Task 1 기반 스노모빌 액티비티 예약
```

각 task는 독립적으로 진행되고, 클라이언트는 의존 task가 끝나는 순간 다음 task를 띄운다. orchestration 레이어는 task의 종료 상태만 polling이나 streaming으로 추적하면 된다.

## Artifact Mutation: 누가 버전을 추적하는가

후속 task는 종종 이전 산출물에서 파생된 **새 artifact**를 만든다. 보트 이미지를 만들고 → 빨간색으로 바꿔달라고 하면, 새 task가 새 artifact를 내놓는다. 그러면 자연스러운 질문이 따라붙는다. "누가 v1 → v2 → v3 같은 version history를 관리하는가?"

A2A의 답은 단호하다. **클라이언트가 관리한다.** 이유는 셋이다.

- 어떤 결과가 "수용 가능한가"는 클라이언트가 정한다
- 클라이언트는 새 버전을 수락하거나 거부할 권한이 있다
- 그러므로 서빙 에이전트가 mutation lineage를 추적할 책임을 져서는 안 된다

스펙에서 빠진 항목이 아니라 **의도적으로 빠뜨린 항목**이다. 대신 두 가지 규약을 둔다.

- 서빙 에이전트는 정제된 새 artifact에 **같은 `artifact-name`**을 부여한다 (클라이언트의 lineage 추적을 돕는다)
- 클라이언트는 follow-up 요청에 자신이 보는 "최신" artifact를 명시적으로 참조한다. 참조가 없으면 에이전트는 `contextId`로 추론하거나 `input-required`로 명확화를 요청한다

## 예시 시나리오: 보트 그림 한 장의 여정

스펙이 제시하는 예시를 흐름으로 보면 위 규칙이 모두 한 자리에서 작동한다.

**1. 첫 요청** — 클라이언트가 "바다 위 범선을 그려달라"는 메시지를 보낸다.

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "SendMessage",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "text": "Generate an image of a sailboat on the ocean." }],
      "messageId": "msg-user-001"
    }
  }
}
```

**2. 에이전트 응답** — completed task로 답한다. `taskId`와 `contextId`가 발급되고, artifact가 첨부된다.

```json
{
  "result": {
    "task": {
      "id": "task-boat-gen-123",
      "contextId": "ctx-conversation-abc",
      "status": { "state": "TASK_STATE_COMPLETED" },
      "artifacts": [{
        "artifactId": "artifact-boat-v1-xyz",
        "name": "sailboat_image.png",
        "parts": [{ "filename": "sailboat_image.png", "mediaType": "image/png", "raw": "..." }]
      }]
    }
  }
}
```

**3. 정제 요청** — "빨간색으로 바꿔달라". 같은 `contextId` 안에서, 이전 `taskId`를 `referenceTaskIds`로 명시한다.

```json
{
  "params": {
    "message": {
      "role": "user",
      "messageId": "msg-user-002",
      "contextId": "ctx-conversation-abc",
      "referenceTaskIds": ["task-boat-gen-123"],
      "parts": [{ "text": "Please modify the sailboat to be red." }]
    }
  }
}
```

**4. 에이전트 응답** — **새 task**가 생긴다. 같은 contextId, 새 `taskId`, 새 `artifactId`, 그러나 **같은 `name`**.

```json
{
  "result": {
    "task": {
      "id": "task-boat-color-456",
      "contextId": "ctx-conversation-abc",
      "status": { "state": "TASK_STATE_COMPLETED" },
      "artifacts": [{
        "artifactId": "artifact-boat-v2-red-pqr",
        "name": "sailboat_image.png",
        "parts": [{ "filename": "sailboat_image.png", "mediaType": "image/png", "raw": "..." }]
      }]
    }
  }
}
```

흐름 전체에서 네 규칙이 한 번에 맞물린다.

- `contextId`로 두 task가 같은 흐름에 묶인다
- `referenceTaskIds`로 정제의 원본을 가리킨다
- 종착된 task-boat-gen-123은 살아나지 않고, 새 task-boat-color-456이 생긴다
- 같은 `name` "sailboat_image.png"로 클라이언트가 lineage를 추적한다

## 설계의 결을 읽는다

Life of a task의 모든 선택은 한 방향을 향한다. **task는 불변, context는 그릇.**

- Message와 Task 분리 → 동기·비동기 양쪽 패턴을 자연스럽게 받아낸다
- `contextId`로 묶기 → 직렬·병렬 follow-up이 같은 메커니즘으로 굴러간다
- Task immutability → 깨끗한 작업 단위, 명확한 traceability
- Artifact lineage를 클라이언트로 위임 → 서빙 에이전트의 책임을 줄인다

⇒ A2A는 "어떻게 작업을 진화시킬 것인가"를 강제하지 않는다. 작업을 묶는 그릇과 작업 단위의 불변성만 보장하고, 진화의 의미는 클라이언트에 맡긴다.

## In My opinion

Task immutability와 artifact lineage 위임은 처음 보면 클라이언트에 책임을 떠넘기는 결정처럼 보인다.  
다시 보면 **traceability와 자율성 사이의 trade-off**에서 traceability를 택한 설계다. task가 한 번 끝나면 그 상태로 박제되기에, 사후에 어떤 입력이 어떤 출력으로 이어졌는지를 의심 없이 재구성한다.  
agent 협업이 늘수록 이 박제가 사후 감사·디버깅·책임 소재 판단의 토대가 된다. "이 잘못된 결과는 어느 단계에서 나왔는가"를 묻는 순간이 곧 올 텐데, 그때 A2A의 답은 이미 준비되어 있다. 그 task를 그대로 다시 보면 된다.  
다만 클라이언트가 lineage를 책임지는 구조는 단일 클라이언트일 때는 깔끔하지만, **여러 클라이언트가 같은 contextId를 공유하는 협업 시나리오**에서는 "누구의 최신 버전이 진짜 최신인가" 같은 새 문제를 부른다. 스펙이 아직 비워둔 자리다.

_(이미지: 원본 사이트 참조)_

## References

- [A2A Protocol — Life of a Task](https://a2a-protocol.org/latest/topics/life-of-a-task/)
