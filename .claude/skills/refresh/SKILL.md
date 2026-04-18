---
name: refresh
description: Obsidian vault의 MD 전부 스캔 → 엔티티/개념 추출 → SQLite 인덱싱 → 빌드타임 Q&A 및 Level별 그래프 JSON 생성
---

# /refresh

지식 베이스에 변경이 있을 때 실행. 인덱스 + 그래프 + Q&A 재생성.

## TODO (구현 예정)

파이프라인:
1. `scripts/build-index.ts` — MD 스캔, frontmatter 파싱, embeddings 생성, SQLite `.data/graph.db` 업데이트
   - volla `lib/rag/graph.ts`, `concepts.ts`, `entity-merge.ts`, `embed.ts` 이식 필요
   - 증분 빌드: 변경된 파일만 re-process (hash 기반)
2. `scripts/export-graph.ts` — SQLite → `public/graph/level1.json`, `level2.json`, `level3.json`
   - Louvain communities + PageRank으로 Level 결정 (volla `graph-topology.ts`)
3. `scripts/generate-qa.ts` — 글/노트/개념별 예상 Q 생성, RAG context로 A 생성
   - volla `lib/card/faq-generator.ts`, `showcase-questions.ts` 이식
   - 출력: `public/qa/global.json`, `post-<slug>.json`, `concept-<id>.json`

진행률 출력, 비용 추정, dry-run 옵션 필요.
