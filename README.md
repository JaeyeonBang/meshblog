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

## Setup

```bash
git clone <repo> meshblog && cd meshblog
bun install
bun run setup              # copies .env.example → .env.local + creates .data/
# edit .env.local (see Required env vars below)
bun run build-index        # MD → SQLite (entities, embeddings, concepts)
bun run generate-qa        # 3-tier FAQ cards via Claude Code CLI subprocess
bun run export-graph       # Note/Concept graph × L1-L3 → public/graph/*.json
bun run dev                # Astro dev @ http://localhost:4321
```

## Required env vars

| Variable | Purpose | Where to get it |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | Embeddings (`text-embedding-3-small`) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

**Claude Code CLI** must be installed and authenticated on your local machine.
Verify with: `claude --version` (must succeed before running `bun run generate-qa`).

Note: `OPENROUTER_API_KEY` is **not** used. Q&A generation uses the local Claude Code CLI subprocess, not OpenRouter.

## Commands

| Command | Action |
| :--- | :--- |
| `bun install` | Install dependencies |
| `bun run setup` | First-time setup (.env.local + .data/) |
| `bun run build-index` | MD → SQLite: entities, embeddings, concepts |
| `bun run generate-qa` | 3-tier FAQ cards via Claude Code CLI (local only, commits JSON) |
| `bun run export-graph` | Note/Concept graph × L1–L3 → `public/graph/*.json` |
| `bun run test` | Run vitest suite |
| `bun run dev` | Astro dev server |
| `bun run build` | Static build to `./dist/` |
| `bun run preview` | Preview build |

## Architecture

```
content/{posts,notes}/*.md
        │
        ▼
scripts/build-index.ts      extract → embed → cluster
        │ (writes)
        ▼
.data/index.db              SQLite: notes, entities, note_embeddings, concepts, qa_cards, graph_levels
        │
        ├─ scripts/generate-qa.ts   ──► claude -p <prompt> (local Claude Code CLI subprocess)
        │                                └─ writes .data/qa/{tier}/{id}.json  (committed to repo)
        │
        └─ scripts/export-graph.ts  ──► public/graph/note-l{1,2,3}.json
                                         public/graph/concept-l{1,2,3}.json

CI (GitHub Actions):
  - Runs: astro build  (no LLM calls; reads committed .data/qa/*.json)
  - Does NOT run: generate-qa (requires local Claude Code auth)
```

**LLM roles:**
- Entity extraction + Q&A generation: **Claude Code CLI** (`claude -p`), local subprocess, zero API cost.
- Embeddings: **OpenAI** `text-embedding-3-small` (`OPENAI_API_KEY` required).
- No OpenRouter. No runtime LLM calls from the deployed site.

## Troubleshooting

### Missing `OPENAI_API_KEY`
```
Error: OPENAI_API_KEY is not set
Fix: add OPENAI_API_KEY=sk-... to .env.local
```

### `claude` binary not found
```
Error: claude: command not found
Fix: install Claude Code CLI → https://docs.anthropic.com/claude-code
     then: claude --version  (must succeed)
```

### OpenAI rate limit (429)
`build-index` retries with exponential backoff (3 retries, up to 10s). If it still fails, wait 60s and re-run. Already-indexed notes are skipped.

### SQLite busy / locked
Schema uses `PRAGMA journal_mode=WAL`. If you see `SQLITE_BUSY`, ensure no other process has `.data/index.db` open.

### Corrupt or unparseable frontmatter
`build-index` logs the failing file path and continues. Fix the YAML front matter in the offending note, then re-run.

### Empty graph (no nodes/links in exported JSON)
Ensure `content/notes/` contains at least one published note with `public: true` in frontmatter. Run `bun run build-index` before `export-graph`.
