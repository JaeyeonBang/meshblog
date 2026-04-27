---
name: l3-visibility
description: Choose how L3 leaf notes are exposed — full / keyword-only / hidden.
---

# /l3-visibility

Controls how PageRank-assigned L3 (leaf) notes are published. L3 notes are roughly the bottom 50% by backlink count — rough drafts, fragments, half-thoughts. Three modes cover the meaningful design space without requiring per-note `draft: true` flags.

## Modes

| Mode | Graph node visible? | Article page accessible? | Mental model |
|------|--------------------|--------------------------|----|
| `full` (default) | yes | yes | Current behavior — back-compat |
| `keyword-only` | yes (label/title only) | no — renders a "비공개" placeholder | You can see *that* the note exists, not its contents |
| `hidden` | no | no | Tier-level privacy — leaves vanish entirely |

## CLI UX contract

Running `/l3-visibility` produces exactly this stdout shape:

```
$ claude /l3-visibility
현재 모드: full
L3 노트: 12개 (전체 25개 중 48%)
└ 예시: ai-chunking-tradeoffs, 02-toy-experiment, 11-deno-vs-bun ...

이 노트들을 어떻게 노출할까요?
  [f] full           — 그래프 + 본문 모두 공개 (현재)
  [k] keyword-only   — 그래프 노드는 보이지만, 클릭 시 "비공개" 안내 페이지
  [h] hidden         — 그래프에서도 빠지고 본문도 404

선택 (f/k/h, c=취소): _
```

After a selection is made:

```
→ keyword-only 적용. `bun run refresh` 실행하세요.
```

On `c` (cancel): exits 0 without writing `meshblog.config.json`.

## Empty state

When no L3 nodes are detected (PageRank hasn't run yet):

```
L3 노트 0개. PageRank 결과가 비어있거나 export-graph가 아직 실행되지 않았습니다.
먼저 `bun run refresh` 를 실행해 주세요.
```

Exits 0 without prompting for a mode selection.

## Error state

When `graph_levels` table is absent (fresh clone, `export-graph` never run):

```
graph_levels 테이블이 없습니다. `bun run refresh` 또는 `bun run scripts/export-graph.ts` 를 먼저 실행하세요.
```

Exits 0 without writing config.

## Run

```bash
bun run l3-visibility
```

Which executes:

```bash
bun run scripts/l3-visibility.ts
```

## Effect

The chosen mode is written to `meshblog.config.json` at the repo root:

```json
{ "l3Visibility": "keyword-only" }
```

`src/lib/config.ts` reads this file at build time. Run `bun run refresh` after changing the mode to rebuild the site with the new filter applied.

## Back-compat

Default is `full` — if `meshblog.config.json` is missing or malformed, the build behaves identically to the current behavior. No L3 notes are hidden.

## Notes

- Only notes are filtered. Concepts (`concept-l3.json`) are out of scope.
- `keyword-only` mode: L3 nodes remain in the graph and `backlinks.json` — visitors can see the title, but clicking the node shows a "비공개" placeholder (`PrivatePlaceholder.astro`). The placeholder emits `<meta name="robots" content="noindex">`.
- `hidden` mode: L3 slugs are excluded from `getStaticPaths` — the route returns 404. They are also stripped from `backlinks.json` and the graph JSON.
- Restore `meshblog.config.json` to `"full"` before committing if you want the default fork experience preserved.
