# meshblog

정적 github.io에서 돌아가는 2nd Brain 블로그 템플릿.
Obsidian vault를 입력으로, 지식 그래프와 pre-generated Q&A가 박힌 정적 사이트를 출력한다.
런타임은 Claude Code (slash commands), 서버·DB·인증 없음.

## Status

Scaffold only. 기능 이식 및 CC skill 구현 예정.

## Design doc

`~/.gstack/projects/JaeyeonBang-volla/qkdwodus777-develop-design-20260416-meshblog-pivot.md`

## Origin

Harvested from [volla](https://github.com/JaeyeonBang/volla) (`archive/volla-saas-v3` 태그로 보존).
멀티테넌트 포트폴리오 SaaS에서 단일사용자 정적 KM 템플릿으로 피벗.

## Planned structure

```
content/posts/       *.md  (blog)
content/notes/       *.md  (wiki)
.data/graph.db       SQLite index (gitignored)
public/qa/*.json     build-time Q&A pairs
public/graph/*.json  Level 1~3 graph JSON
src/pages/           Astro routes
src/components/      React islands (MarkdownView, QAChips, GraphView)
src/lib/rag/         harvested from volla
src/lib/card/        harvested from volla
src/lib/prompts/     harvested from volla
scripts/             build-index, generate-qa, export-graph, publish
.claude/skills/      /init, /new-post, /refresh, /ask, /publish, /theme
.github/workflows/   deploy.yml (gh-pages)
```

## Dev

```bash
bun install
bun run setup              # copies .env.example → .env.local + mkdir .data
# edit .env.local — set OPENROUTER_API_KEY
bun run build-index        # MD → SQLite entity index
bun run test               # vitest: 6 tests (smoke + schema + idempotency)
bun run dev                # Astro dev @ http://localhost:4321
bun run build              # Astro static build → dist/
```

## Commands

| Command | Action |
| :--- | :--- |
| `bun install` | Install dependencies |
| `bun run setup` | First-time setup (.env.local + .data/) |
| `bun run build-index` | Harvest entities from content/**/*.md into `.data/index.db` |
| `bun run test` | Run vitest suite |
| `bun run dev` | Astro dev server |
| `bun run build` | Static build to `./dist/` |
| `bun run preview` | Preview build |
