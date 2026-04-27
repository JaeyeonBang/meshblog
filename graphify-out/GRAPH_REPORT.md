# Graph Report - /mnt/d/projects/meshblog  (2026-04-28)

## Corpus Check
- 128 files · ~172,071 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 699 nodes · 896 edges · 87 communities detected
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 198 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]

## God Nodes (most connected - your core abstractions)
1. `queryMany()` - 31 edges
2. `execute()` - 21 edges
3. `openReadonlyDb()` - 18 edges
4. `blog-bw.html: Black & White Editorial Prototype` - 14 edges
5. `runBuildIndex()` - 12 edges
6. `main()` - 12 edges
7. `runInit()` - 12 edges
8. `exec()` - 12 edges
9. `createDb()` - 11 edges
10. `queryOne()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Design feature: JSON theme injection replaces all CSS tokens` --semantically_similar_to--> `Decision: Hand-rolled CSS variables (no Tailwind 4) — small surface, faster, no beta risk`  [INFERRED] [semantically similar]
  design-ref/handoff/project/design-system.html → docs/plans/2026-04-19-meshblog-phase5.md
- `insertQaCard()` --calls--> `execute()`  [INFERRED]
  scripts/generate-qa.ts → src/lib/db/index.ts
- `LLM-generated Q&A` --conceptually_related_to--> `QAChips as first-class UI element decision`  [INFERRED]
  content/posts/24-llm-generated-qa.md → design-ref/handoff/chats/chat1.md
- `Interaction: Hover-invert pattern (bg/color flip)` --semantically_similar_to--> `Six design principles: hairlines, hover-invert, Fraunces, mono eyebrows, rules not boxes, asymmetry (Variant A)`  [INFERRED] [semantically similar]
  design-ref/handoff/project/blog-bw.html → design.variants/a.md
- `Layout rule: Hairlines only (1px borders)` --semantically_similar_to--> `Six design principles: hairlines, hover-invert, Fraunces, mono eyebrows, rules not boxes, asymmetry (Variant A)`  [INFERRED] [semantically similar]
  design-ref/handoff/project/blog-bw.html → design.variants/a.md

## Hyperedges (group relationships)
- **meshblog core build pipeline: gray-matter + OpenAI embeddings + Graphology form full content pipeline** — 16_gray_matter_frontmatter_gray_matter, 07_openai_embeddings_text_embedding_3_small, 06_graphology_graph_algorithms_graphology, 20_phase2_architecture_build_pipeline, readme_sqlite_index_db [EXTRACTED 0.95]
- **Knowledge graph intelligence stack: entity extraction + Louvain clustering + PageRank ranking form structured retrieval layer** — 09_knowledge_graphs_automatic_entity_extraction, 06_graphology_graph_algorithms_louvain, 06_graphology_graph_algorithms_pagerank, 12_rag_retrieval_augmented_generation_rag [INFERRED 0.88]
- **Design token pipeline: design.md → build-tokens.ts → tokens.css → Astro components implement editorial invariants** — claude_md_design_md, claude_md_build_tokens_script, claude_md_tokens_css, claude_md_editorial_invariants [EXTRACTED 0.97]
- **RAG pipeline: chunking + embedding + Q&A generation** — 30_chunking_chunking_for_embeddings, 24_llm_qa_llm_generated_qa, 24_llm_qa_context_selection [EXTRACTED 0.92]
- **Knowledge graph analysis: PageRank + Louvain + graph visualization** — 23_pagerank_pagerank_for_notes, 25_louvain_communities_louvain, 27_force_directed_force_directed_graph [INFERRED 0.82]
- **SQLite data layer: WAL mode + content hashing + schema** — 25_sqlite_sqlite_for_personal_site, 23_wal_mode_wal_mode, 24_content_hashing_content_hashing [EXTRACTED 0.95]
- **Four design variants (A/B/C/D) share the same 6 principles, token schema, and are interchangeable via design.md swap** — variant_a_editorial_bw, variant_b_paper_ink_warm, variant_c_newspaper_dense, variant_d_warm_editorial [EXTRACTED 1.00]
- **Phase 1–3 plans collectively implement the meshblog PRD build pipeline (index → enrich → visitor UX)** — phase1_plan_goal, phase2_plan_goal, phase3_plan_goal, prd_meshblog_vision [INFERRED 0.90]
- **MarkdownView, QAChips, GraphView form the three React islands with deliberate hydration strategy** — docs_architecture_island_markdownview, docs_architecture_island_qachips, docs_architecture_island_graphview [EXTRACTED 1.00]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (43): defaultEmbedNote(), sanitizeContent(), findCachedAnswer(), buildConceptsFromCommunities(), clusterEntities(), conceptSearch(), detectContradictions(), cosine() (+35 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (55): Layout: Base.astro (SEO, OG, Twitter cards, skip link, lang detection AF1), Architecture: 3-stage build pipeline (Index → Enrich → Astro build), React island: GraphView (client:only=react — d3 DOM manipulation, skip SSR), React island: MarkdownView (client:load — LCP content), React island: QAChips (client:visible — Fuse.js search deferred), Architecture constraint: no SQLite access at runtime — pure static files deployed, Stage 1: build-index.ts (MD → SQLite via embeddings + entity extraction), Stage 2: Enrich (generate-qa, export-graph, build-manifest, build-og, build-rss) (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (50): hydration mismatch risk, Next.js App Router, React Server Components (RSC), concept dependencies as graph edges, knowledge graph visualization, LLM Q&A generation overview, why meshblog was built, simple stack design rationale (Astro + SQLite) (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (48): Entity co-occurrence graph (undirected), Graph importance levels L1/L2/L3 (PageRank-derived), Graphology (JavaScript graph library), Louvain community detection algorithm, PageRank algorithm, BLOB embedding storage (Float32Array in SQLite), Chunking strategy for embeddings, Cosine similarity (+40 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (28): getBacklinksForNote(), main(), makeExcerpt(), buildSvg(), main(), svgToPng(), truncate(), writePng() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (27): auditDrafts(), discoverAll(), seedNote(), buildReportText(), isoNow(), queryBrokenWikilinks(), queryNotesCount(), queryWikilinksCount() (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (25): seedDb(), seedFixture(), extractToc(), insertEntity(), insertNote(), insertNoteEntity(), makeDb(), applyMigrations() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (34): 6-page layout: /, /posts/[slug], /notes/[slug], /graph, search ⌘K, 404, Typography: Fraunces (display serif, opsz 9-144), Typography: JetBrains Mono (mono eyebrows), Typography: Pretendard (sans-serif UI), Layout rule: Hairlines only (1px borders), Interaction: Hover-invert pattern (bg/color flip), blog-bw.html: Black & White Editorial Prototype, Component: page-nav route switcher (fixed, mono font) (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (32): Fuse.js Threshold Tuning, minMatchCharLength setting, precision-recall tradeoff in fuzzy search, recall@k evaluation, Fuse.js threshold parameter, bilingual Korean-English notes challenges, English URL slugs for bilingual blog rationale, Hangul Fuse.js search failure (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (21): Brand personality: quiet · editorial · considered (Variant A), Variant A: Editorial B&W, Layout: w-prose=60ch (comfortable reading column), Rationale: Site is a reading room, not a dashboard — slow the reader by half a beat, Token: ink=#000 (pure black, no warm undertone), Token: paper=#fff (pure white), Token: accent=oklch(0.400 0.090 265) — deep desaturated indigo (active links, focus only), Brand personality: lamp-lit · warm · unhurried (Variant B) (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (18): Drizzle (TypeScript-first ORM), Prisma (schema-first ORM), TypeScript Generics, Repository<T> generic interface pattern, TypeScript Utility Types (Partial, Required, Pick, Omit, Record), Rationale: SQLite chosen for meshblog (build-time writes, single-dev, no server), PostgreSQL (multi-user server database), SQLite (single-file embedded database) (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (11): checkClaudeAvailable(), retryWithBackoff(), buildFaqPrompt(), sanitizeForPrompt(), contentHash(), formatEta(), generateFaqs(), insertQaCard() (+3 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (17): scripts/build-tokens.ts, CI/CD deploy.yml workflow, design.md (source of truth for visual tokens), Design System, 6 Editorial Invariants (UI contract), Fixture mode (build:fixture), meshblog Project, blog-bw-polish skill (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.23
Nodes (14): countVaultMarkdown(), createAskFn(), detectGitRemote(), getDevSpawnOptions(), linkVault(), main(), parseAstroBase(), probePort() (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.3
Nodes (11): checkCursorPointer(), checkHexLiterals(), checkHoverWithoutTransition(), checkLetterSpacing(), checkRawPxFontSize(), checkThreePxBorders(), glob(), main() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.26
Nodes (10): buildInboundCountMap(), enrichNeighborsFromDb(), getEntityNeighbors(), getHomeMeshNodes(), getNoteMeshLinks(), getNoteMeshNodes(), getWikilinkNeighbors(), loadBacklinks() (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (5): stubExtract(), buildEntityExtractionPrompt(), extractEntities(), normalizeName(), callOpenRouter()

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (11): draft-to-publish workflow, _drafts folder structure, frontmatter draft:true flag, git branch per draft, Obsidian draft writing workflow, deferred features list, scope cutting for solo shipping, share-threshold prioritization rule (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (2): getInitialLevel(), getInitialMode()

### Community 19 - "Community 19"
Cohesion: 0.31
Nodes (3): emWidth(), emWidthOfChar(), wrapLabel()

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (1): computeSkills()

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (3): preprocessMarkdown(), renderMarkdownToHtml(), resolveWikilinks()

### Community 22 - "Community 22"
Cohesion: 0.53
Nodes (4): buildTemplate(), main(), promptTitle(), slugify()

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (6): graphify edge tagging: EXTRACTED / INFERRED (confidence_score) / AMBIGUOUS, graphify MCP server: query_graph, get_node, get_neighbors, shortest_path tools, graphify outputs: graph.html, GRAPH_REPORT.md, graph.json, cache/, Rationale: Always-graph-first mode — GRAPH_REPORT.md read before Glob/Grep via PreToolUse hook, graphify repo: github.com/safishamsi/graphify (PyPI: graphifyy), graphify: AI coding assistant knowledge graph skill

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (2): detectClusters(), processGraphFile()

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (2): run(), runAxe()

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (5): React Hooks introduction, useCallback hook, useEffect hook, useMemo hook, useState hook

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (1): handleQuestionClick()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (2): normalizeType(), parseSchema()

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (2): run(), setup()

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (2): GitHub Pages base path /meshblog/, withBase() URL utility (src/lib/url.ts)

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (2): Conclusion-first writing structure, Error message structure (what/why/fix)

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (1): Design variant B: Paper & Ink Warm

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (1): Design variant C: Newspaper Dense

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (1): Graph node color/size encoding (T3)

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (1): Chain-of-thought prompting

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (1): Prompt injection hardening (delimiters around user content)

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (1): client:idle directive (hydrate after browser idle)

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (1): Tailwind CSS

## Knowledge Gaps
- **157 isolated node(s):** `src/styles/tokens.css (autogenerated)`, `withBase() URL utility (src/lib/url.ts)`, `GitHub Pages base path /meshblog/`, `blog-bw-polish skill`, `CI/CD deploy.yml workflow` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 34`** (2 nodes): `loadWorkflow()`, `daily-audit-workflow.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `runCmd()`, `graph-json-manifest.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `runCmd()`, `og-rss.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `cleanDb()`, `page-data.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `collectTsFiles()`, `porting-rules-lint.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `injectLedeClass()`, `lede.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `estimateReadingMinutes()`, `reading-time.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `word-count.ts`, `getReadingStats()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `formatCategoryName()`, `display-name.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `plain-excerpt.ts`, `plainExcerpt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `strip-title.ts`, `stripLeadingH1()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `wikilink-resolver.ts`, `buildNoteResolver()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `render-integration.test.ts`, `resolver()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `resolve-wikilinks.test.ts`, `resolver()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `cleanDb()`, `categories.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `noopExtract()`, `fixture-vault.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `noteUrl()`, `backlinks-sidebar.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `GitHub Pages base path /meshblog/`, `withBase() URL utility (src/lib/url.ts)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `Conclusion-first writing structure`, `Error message structure (what/why/fix)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `astro.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `cluster-palette.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `HoverCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `Legend.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `TopBar.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `display-name.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `extract-toc.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `plain-excerpt.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `strip-title.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `wikilink-resolver.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `bundle-size.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `lede.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `reading-time.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `v1-acceptance.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `word-count.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `init-smoke.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `init-ask.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `init-base-url.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `init-pipeline.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `init-spawn.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `help-modal.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `backlinks-graph.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `_seed.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `Design variant B: Paper & Ink Warm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `Design variant C: Newspaper Dense`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `Graph node color/size encoding (T3)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `Chain-of-thought prompting`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `Prompt injection hardening (delimiters around user content)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `client:idle directive (hydrate after browser idle)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `Tailwind CSS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `queryMany()` connect `Community 0` to `Community 11`, `Community 20`, `Community 5`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `execute()` connect `Community 5` to `Community 0`, `Community 16`, `Community 11`, `Community 6`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `exec()` connect `Community 6` to `Community 11`, `Community 5`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `queryMany()` (e.g. with `auditDrafts()` and `queryBrokenWikilinks()`) actually correct?**
  _`queryMany()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `execute()` (e.g. with `defaultEmbedNote()` and `runBuildIndex()`) actually correct?**
  _`execute()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `openReadonlyDb()` (e.g. with `main()` and `enrichNeighborsFromDb()`) actually correct?**
  _`openReadonlyDb()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `blog-bw.html: Black & White Editorial Prototype` (e.g. with `Wireframe Direction B: Reader-first` and `Variant A: Editorial B&W`) actually correct?**
  _`blog-bw.html: Black & White Editorial Prototype` has 3 INFERRED edges - model-reasoned connections that need verification._