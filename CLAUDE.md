# CLAUDE.md

Instructions for Claude Code when working in this repo.

This repo is a **GitHub Pages–deployed personal blog harness** (https://jaeyeonbang.github.io/meshblog). Every push to `main` triggers a CI build + deploy. Treat `main` as production.

## v1 build plan (office-hours audit · 2026-04-20)

**Positioning**: meshblog is an **AI-native daily-repair harness** for Obsidian power users — a fork-and-use open-source template. Every competitor (Obsidian Publish, Quartz, Mataroa) sits on the "1-shot migration" axis; meshblog's wedge is Claude Code skills that repair the vault every day and tell the author what was fixed. Do not drift into "cheaper Obsidian Publish" framing.

**Scope lock** — 4.5 weeks, 6 deliverables. Full rationale in `~/.gstack/projects/JaeyeonBang-meshblog/qkdwodus777-worktree-office-hours-audit-design-2026-04-20-215953.md`.

| # | Deliverable | Effort | Key files |
| :--- | :--- | :--- | :--- |
| D1 | `init` skill: vault-path prompt → symlink `content/notes/` + `.env` + GH Pages workflow → opens localhost | 5d | `.claude/skills/init/`, `scripts/init.ts` |
| D2 | Wikilink full-compat: `[[target\|alias]]` → `<a href>`, preserves `![[img.png]]`, slug fallback | 4d | replace `src/lib/markdown/strip-wikilinks.ts` with `resolve-wikilinks.ts` |
| D3 | Draft safety net: `draft: true` excluded from build + `/audit` skill flags leaks on `main` | 1d | `scripts/build-index.ts`, `src/content/config.ts`, `.claude/skills/audit/` |
| D4 | Backlink graph layer: incremental hash-keyed cache → `backlinks.json` → 3rd mode in `GraphView.tsx` | 7d | `scripts/build-backlinks.ts`, `src/components/GraphView.tsx` |
| D5 | `new-post` + `refresh` skills: frontmatter template + orchestrator (`build-tokens → build-index → backlinks → preview`) | 3d | `.claude/skills/new-post/`, `.claude/skills/refresh/` |
| D6 | Daily-repair GH Action: cron → headless audit → auto-PR with Markdown report artifact | 2d | `.github/workflows/daily-audit.yml`, `scripts/audit-report.ts` |

**Order**: D2 + D3 (week 1) → D4 (week 2–3) → D1 (week 3–4) → D5 (week 4) → D6 + fork-from-zero rehearsal (week 4.5). Do **not** start D1 before D2+D3 are green — an init skill that ingests broken wikilinks is worse than no init skill.

**Acceptance — 7 must-pass criteria for a fork user on a fresh machine with their own vault:**

1. `npx degit JaeyeonBang/meshblog my-blog && cd my-blog && claude /init` asks exactly (a) vault absolute path, (b) GitHub repo name for Pages — then opens `http://localhost:4321/meshblog/`.
2. Localhost renders **their real notes** (not `test/fixtures/seed.sql`) without `OPENAI_API_KEY`. Fixture is fallback only when vault is empty/unreadable; keyless users with a real vault get their content + wikilink-backed links + backlinks, entity/embedding features degrade gracefully.
3. `[[Some Concept|see here]]` renders `<a href="/meshblog/notes/some-concept">see here</a>` — never plain text.
4. `draft: true` notes are absent from build output; `claude /audit` flags any already pushed to `main`.
5. `/graph` exposes a **Backlinks** mode toggle alongside Notes/Concepts; clicking a node reveals inbound references.
6. `git push origin main` → GH Pages deploy → live 200 + their notes visible (post-push CI verification below still applies).
7. The daily GH Action runs at least once and opens an auto-PR with an audit report artifact, even on empty-diff days.

**Deliberately deferred to v2** — flagged so they do not silently re-enter scope:
- `design.md` composer (conversational new-mode creation). v1 workaround: `design.variants/` + `theme-variant` skill for hand-authored modes.
- `/wiki` route + real LLM synthesis (`synthesizeWikiArticle` Phase 4 in `src/lib/rag/wiki.ts`).
- Auto-repair PR (D6 v2 writes fix-up branches; D6 v1 only reports).
- Obsidian Properties + minimal Dataview.

**Active risks with mitigations**:
1. Wikilink resolution 80/20 trap — write `tests/fixtures/wikilinks.md` with 12 adversarial cases (trailing space, unicode, alias collision, missing target) red-first, before any D2 implementation.
2. Windows symlink permissions on WSL → Windows vault paths. Detect + fall back to copy + `fs.watch`; rehearse on clean Windows 11 home in week 4.5.
3. `draft:true` already on prod — `/audit` emits ready-to-paste `git revert` + follow-up commit template. No silent auto-revert.
4. Test-fixture drift — add `tests/e2e/fixture-vault/` with 30+ real-shaped notes (wikilinks, aliases, images, drafts) to CI.
5. Scope creep ("just also /wiki while I'm here") — v2 means v2.

**Current gaps at session start (commit `44f37ce`)**:
- `.claude/skills/{init,new-post,refresh}/SKILL.md` are spec-only (well-written TODO outlines, no wired scripts).
- `src/lib/markdown/strip-wikilinks.ts` destroys wikilinks by converting them to plain text — replace in D2.
- `src/lib/rag/wiki.ts` `synthesizeWikiArticle` is a Phase 4 placeholder; no `/wiki` route mounts it — deferred to v2.
- `/graph` (Req 3) is fully shipped and is the template for how D4's backlink layer should feel.

## Core commands

```bash
bun install
bun run build:fixture     # zero-key preview build (5 fixture notes)
bun run build-tokens      # design.md → src/styles/tokens.css
bun run dev               # dev server
bun run preview           # serve dist/ (port auto-increments if busy)
bunx astro check          # type + Astro error check
npx vitest run            # full test suite (149 tests)
```

`bun run build-all` runs the full pipeline (needs `OPENAI_API_KEY`). `build:fixture` has no key requirement.

## Design system contract

- **`design.md` is the single source of truth** for all visual tokens (colors, fonts, scale, motion, radius, shadows).
- `scripts/build-tokens.ts` reads `design.md` frontmatter → emits `src/styles/tokens.css`.
- **Never hand-edit `src/styles/tokens.css`** — it is autogenerated and will be overwritten on the next `build-tokens` run.
- **No hex literals** outside `src/styles/tokens.css` + `src/styles/fonts.css`. Downstream files must reference tokens via `var(--ink)`, `var(--paper)`, etc.
- Three preset variants live in `design.variants/{a,b,c}.md`. Swap by copying one to `design.md` and re-running `build-tokens`.

Full contract: `design-ref/SPEC.md`. Handoff prototype: `design-ref/handoff/project/blog-bw.html`.

## 6 editorial invariants

Before committing UI changes, every file under `src/` must satisfy:

1. No hex literals outside `tokens.css` + `fonts.css`.
2. Hairlines only — `border: 1px solid` default; `3px` reserved for emphasis (pull-quote top, page-qa top, footer top).
3. Hover-invert — interactive surfaces flip `background/color` on `:hover` (paper ↔ ink), not subtle opacity.
4. Mono eyebrows — uppercase labels use `var(--f-mono)` + `letter-spacing: 0.2em` + 10–11px + `var(--ink-3)`.
5. One shadow only — `var(--shadow-hard)` on `.cmdk` exclusively.
6. Radius ≤ 4px except `--r-pill` for `.kbd` legacy.

Run the `blog-bw-polish` skill to lint these before committing.

## Base path gotcha

The site is served under `/meshblog/` on GitHub Pages (`astro.config.mjs` → `base: '/meshblog'`).

**Every internal link must go through `withBase()` from `src/lib/url.ts`:**

```astro
import { withBase } from '../lib/url';
<a href={withBase('/posts')}>posts</a>   <!-- good -->
<a href="/posts">posts</a>                <!-- BROKEN on Pages -->
```

This includes `href` on `<a>`, navigation arrays, CmdK result lists, Footer, TopBar. External URLs (`https://`), anchors (`#main`), and asset paths already prefixed by Astro (`/_astro/…`) do not need wrapping.

## Skills (`.claude/skills/`)

| Skill | Use when |
| :--- | :--- |
| `design-md-sync` | User asks to change a color / font / spacing / any visual token |
| `theme-variant` | User wants to preview or adopt variant A / B / C |
| `component-extract` | Given a new HTML prototype section to turn into a scoped Astro component |
| `blog-bw-polish` | Before any commit touching UI code; or reviewing a new component |

## Components

Atomic Design under `src/components/ui/`:

- `atoms/` — Badge, Button, Input, Kbd, KindBadge, Logo, Tag, TierBadge
- `molecules/` — Breadcrumbs, CodeBlock, HeroFigure, MiniMesh, NoteRow, PageQa, Pager, PostCard, PullQuote, QaCard, RelatedGrid, SectionBreak, TOC
- `organisms/` — CmdK, Footer, GraphControls, PageNav, TopBar

React islands are preserved at `src/components/{QAChips.tsx,GraphView.tsx}`; only their CSS modules were re-skinned. Do not rewrite them as Astro.

## Fixture vs full pipeline

| Mode | Command | API keys | Content |
| :--- | :--- | :--- | :--- |
| Fixture | `bun run build:fixture` | None | 5 seed notes from `test/fixtures/seed.sql` |
| Full | `bun run build-all` | `OPENAI_API_KEY` required | Real `content/notes/` + embeddings + Q&A |

CI falls back to fixture mode if `OPENAI_API_KEY` is absent — the site still builds and deploys.

## Pre-commit checklist

Before marking UI work done:

1. `bun run build-tokens` — if `design.md` changed
2. `bunx astro check` — 0 errors
3. `bun run build:fixture` — exits 0
4. `npx vitest run` — all pass (currently 149 tests)
5. `bun run preview` + curl each page (`/meshblog/`, `/meshblog/notes/<slug>`, `/meshblog/graph`, `/meshblog/404`) and verify expected classes + tokens render
6. Run `blog-bw-polish` skill — expect empty output from all 6 grep checks

## Post-push CI/CD verification (MANDATORY)

**This repo IS the deploy. A push without verification is not done.**

After every `git push origin main`, you MUST:

### Step 1 — Locate the triggered run

```bash
gh run list --limit 3
```

Grab the top `Deploy to GitHub Pages` run ID and its URL:

```bash
gh run view <RUN_ID> --json url,status,conclusion,headSha
```

Report the URL to the user immediately, e.g. `https://github.com/JaeyeonBang/meshblog/actions/runs/<RUN_ID>`.

### Step 2 — Watch until completion

```bash
gh run watch <RUN_ID> --exit-status
```

`--exit-status` makes the command exit non-zero if the run fails, so you cannot silently miss a red build.

### Step 3 — Verify the live site

```bash
curl -sfI https://jaeyeonbang.github.io/meshblog/          # 200 OK
curl -s  https://jaeyeonbang.github.io/meshblog/ | \
  grep -c 'home-layout\|Fraunces\|--ink'                   # must be > 0
```

Spot-check at least one article route (`/meshblog/notes/<slug>/`) returns 200 and contains `class="prose"`.

### Step 4 — Report back

Always return to the user:

1. **Run URL** — e.g. `https://github.com/JaeyeonBang/meshblog/actions/runs/24665465770`
2. **Conclusion** — `success` / `failure` / `cancelled`
3. **Live URL check** — `https://jaeyeonbang.github.io/meshblog/` HTTP status + whether the redesign tokens are present
4. **If failed** — the failing step + last 20 lines of its log:
   ```bash
   gh run view <RUN_ID> --log-failed | tail -40
   ```

### Never

- Never declare "pushed and deployed" without showing the green run + a live-URL 200.
- Never skip the watch step because "it'll probably pass" — the CI runs a real Astro build with different env than local; regressions (missing secrets, node version, fresh clone install) surface only here.
- Never force-push to `main`. If CI fails, fix forward with a new commit.

## Repo facts

- Owner: `JaeyeonBang`
- Repo: `JaeyeonBang/meshblog`
- Deploy target: https://jaeyeonbang.github.io/meshblog/
- Workflow: `.github/workflows/deploy.yml` (triggered on push to `main`)
- Runner: Node 22 + Bun 1.x
- Required secret: `OPENAI_API_KEY` (falls back to fixture mode if missing)
