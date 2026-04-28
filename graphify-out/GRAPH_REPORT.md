# Graph Report - .  (2026-04-28)

## Corpus Check
- 140 files · ~149,829 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 737 nodes · 916 edges · 101 communities detected
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 225 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]

## God Nodes (most connected - your core abstractions)
1. `queryMany()` - 31 edges
2. `execute()` - 24 edges
3. `openReadonlyDb()` - 20 edges
4. `createDb()` - 14 edges
5. `blog-bw.html: Black & White Editorial Prototype` - 14 edges
6. `exec()` - 13 edges
7. `runBuildIndex()` - 12 edges
8. `main()` - 12 edges
9. `runInit()` - 12 edges
10. `run()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Design feature: JSON theme injection replaces all CSS tokens` --semantically_similar_to--> `Decision: Hand-rolled CSS variables (no Tailwind 4) — small surface, faster, no beta risk`  [INFERRED] [semantically similar]
  design-ref/handoff/project/design-system.html → docs/plans/2026-04-19-meshblog-phase5.md
- `insertQaCard()` --calls--> `execute()`  [INFERRED]
  scripts\generate-qa.ts → src\lib\db\index.ts
- `exec()` --calls--> `makeDb()`  [INFERRED]
  scripts\publish-verify.ts → src\lib\__tests__\mesh-data.test.ts
- `computeSkills()` --calls--> `queryMany()`  [INFERRED]
  src\lib\card\skill-scorer.ts → src\lib\db\index.ts
- `Interaction: Hover-invert pattern (bg/color flip)` --semantically_similar_to--> `Six design principles: hairlines, hover-invert, Fraunces, mono eyebrows, rules not boxes, asymmetry (Variant A)`  [INFERRED] [semantically similar]
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
Cohesion: 0.05
Nodes (49): defaultEmbedNote(), deriveCategoryFromTags(), runBuildIndex(), sanitizeContent(), sha256(), slugToName(), findCachedAnswer(), buildConceptsFromCommunities() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (59): Rationale: SQLite chosen for meshblog (build-time writes, single-dev, no server), PostgreSQL (multi-user server database), SQLite (single-file embedded database), Entity co-occurrence graph (undirected), Graph importance levels L1/L2/L3 (PageRank-derived), Graphology (JavaScript graph library), Louvain community detection algorithm, PageRank algorithm (+51 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (38): getBacklinksForNote(), buildSlugMap(), makeWikilinkRe(), runBuildBacklinks(), main(), makeExcerpt(), buildSvg(), main() (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (55): Layout: Base.astro (SEO, OG, Twitter cards, skip link, lang detection AF1), Architecture: 3-stage build pipeline (Index → Enrich → Astro build), React island: GraphView (client:only=react — d3 DOM manipulation, skip SSR), React island: MarkdownView (client:load — LCP content), React island: QAChips (client:visible — Fuse.js search deferred), Architecture constraint: no SQLite access at runtime — pure static files deployed, Stage 1: build-index.ts (MD → SQLite via embeddings + entity extraction), Stage 2: Enrich (generate-qa, export-graph, build-manifest, build-og, build-rss) (+47 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (53): hydration mismatch risk, Next.js App Router, React Server Components (RSC), concept dependencies as graph edges, knowledge graph visualization, LLM Q&A generation overview, why meshblog was built, simple stack design rationale (Astro + SQLite) (+45 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (30): auditDrafts(), discoverAll(), seedNote(), seedNoteWithLevel(), buildReportText(), isoNow(), queryBrokenWikilinks(), queryNotesCount() (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (34): 6-page layout: /, /posts/[slug], /notes/[slug], /graph, search ⌘K, 404, Typography: Fraunces (display serif, opsz 9-144), Typography: JetBrains Mono (mono eyebrows), Typography: Pretendard (sans-serif UI), Layout rule: Hairlines only (1px borders), Interaction: Hover-invert pattern (bg/color flip), blog-bw.html: Black & White Editorial Prototype, Component: page-nav route switcher (fixed, mono font) (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (29): Fuse.js Threshold Tuning, minMatchCharLength setting, precision-recall tradeoff in fuzzy search, recall@k evaluation, Fuse.js threshold parameter, bilingual Korean-English notes challenges, English URL slugs for bilingual blog rationale, Hangul Fuse.js search failure (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (18): makeDbWithGraphLevels(), extractToc(), checkLive(), exec(), locateRun(), main(), parseArgs(), printFailLog() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (21): Brand personality: quiet · editorial · considered (Variant A), Variant A: Editorial B&W, Layout: w-prose=60ch (comfortable reading column), Rationale: Site is a reading room, not a dashboard — slow the reader by half a beat, Token: ink=#000 (pure black, no warm undertone), Token: paper=#fff (pure white), Token: accent=oklch(0.400 0.090 265) — deep desaturated indigo (active links, focus only), Brand personality: lamp-lit · warm · unhurried (Variant B) (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (17): scripts/build-tokens.ts, CI/CD deploy.yml workflow, design.md (source of truth for visual tokens), Design System, 6 Editorial Invariants (UI contract), Fixture mode (build:fixture), meshblog Project, blog-bw-polish skill (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.3
Nodes (11): checkCursorPointer(), checkHexLiterals(), checkHoverWithoutTransition(), checkLetterSpacing(), checkRawPxFontSize(), checkThreePxBorders(), glob(), main() (+3 more)

### Community 12 - "Community 12"
Cohesion: 0.26
Nodes (14): countVaultMarkdown(), createAskFn(), detectGitRemote(), getDevSpawnOptions(), linkVault(), main(), parseAstroBase(), probePort() (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.2
Nodes (11): checkClaudeAvailable(), retryWithBackoff(), buildFaqPrompt(), sanitizeForPrompt(), contentHash(), formatEta(), generateFaqs(), insertQaCard() (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.26
Nodes (10): buildInboundCountMap(), enrichNeighborsFromDb(), getEntityNeighbors(), getHomeMeshNodes(), getNoteMeshLinks(), getNoteMeshNodes(), getWikilinkNeighbors(), loadBacklinks() (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (11): draft-to-publish workflow, _drafts folder structure, frontmatter draft:true flag, git branch per draft, Obsidian draft writing workflow, deferred features list, scope cutting for solo shipping, share-threshold prioritization rule (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.27
Nodes (3): getInitialLevel(), getInitialMode(), getInitialState()

### Community 17 - "Community 17"
Cohesion: 0.2
Nodes (5): stubExtract(), buildEntityExtractionPrompt(), extractEntities(), normalizeName(), callOpenRouter()

### Community 18 - "Community 18"
Cohesion: 0.31
Nodes (3): emWidth(), emWidthOfChar(), wrapLabel()

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (1): computeSkills()

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (3): preprocessMarkdown(), renderMarkdownToHtml(), resolveWikilinks()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (7): Drizzle (TypeScript-first ORM), Prisma (schema-first ORM), TypeScript Generics, Repository<T> generic interface pattern, TypeScript Utility Types (Partial, Required, Pick, Omit, Record), Immutability principle (create new objects, never mutate), Local-scope mutation exception (accumulator pattern)

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (6): graphify edge tagging: EXTRACTED / INFERRED (confidence_score) / AMBIGUOUS, graphify MCP server: query_graph, get_node, get_neighbors, shortest_path tools, graphify outputs: graph.html, GRAPH_REPORT.md, graph.json, cache/, Rationale: Always-graph-first mode — GRAPH_REPORT.md read before Glob/Grep via PreToolUse hook, graphify repo: github.com/safishamsi/graphify (PyPI: graphifyy), graphify: AI coding assistant knowledge graph skill

### Community 23 - "Community 23"
Cohesion: 0.7
Nodes (4): buildTemplate(), main(), promptTitle(), slugify()

### Community 24 - "Community 24"
Cohesion: 0.4
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (2): run(), runAxe()

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (5): React Hooks introduction, useCallback hook, useEffect hook, useMemo hook, useState hook

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.83
Nodes (3): djb2(), paletteCssVarFor(), paletteIndexFor()

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (1): handleQuestionClick()

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (2): detectClusters(), processGraphFile()

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (2): normalizeType(), parseSchema()

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (2): normalizeLabel(), slugToLabel()

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (2): run(), setup()

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
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

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
Nodes (2): GitHub Pages base path /meshblog/, withBase() URL utility (src/lib/url.ts)

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (2): Conclusion-first writing structure, Error message structure (what/why/fix)

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
Nodes (0): 

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (1): Design variant B: Paper & Ink Warm

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (1): Design variant C: Newspaper Dense

### Community 96 - "Community 96"
Cohesion: 1.0
Nodes (1): Graph node color/size encoding (T3)

### Community 97 - "Community 97"
Cohesion: 1.0
Nodes (1): Chain-of-thought prompting

### Community 98 - "Community 98"
Cohesion: 1.0
Nodes (1): Prompt injection hardening (delimiters around user content)

### Community 99 - "Community 99"
Cohesion: 1.0
Nodes (1): client:idle directive (hydrate after browser idle)

### Community 100 - "Community 100"
Cohesion: 1.0
Nodes (1): Tailwind CSS

## Knowledge Gaps
- **157 isolated node(s):** `src/styles/tokens.css (autogenerated)`, `withBase() URL utility (src/lib/url.ts)`, `GitHub Pages base path /meshblog/`, `blog-bw-polish skill`, `CI/CD deploy.yml workflow` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 37`** (2 nodes): `makeChild()`, `claude-code.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `makeGraph()`, `cluster-communities.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `loadWorkflow()`, `daily-audit-workflow.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `runCmd()`, `fixture-mode.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `runCmd()`, `graph-json-manifest.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `runCmd()`, `og-rss.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `cleanDb()`, `page-data.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `collectTsFiles()`, `porting-rules-lint.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `highlightCategory()`, `Legend.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `injectLedeClass()`, `lede.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `estimateReadingMinutes()`, `reading-time.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `word-count.ts`, `getReadingStats()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `formatCategoryName()`, `display-name.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `plainExcerpt()`, `plain-excerpt.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `strip-title.ts`, `stripLeadingH1()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `wikilink-resolver.ts`, `buildNoteResolver()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `resolver()`, `render-integration.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `resolver()`, `resolve-wikilinks.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `cleanDb()`, `categories.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `noopExtract()`, `fixture-vault.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `noteUrl()`, `backlinks-sidebar.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `GitHub Pages base path /meshblog/`, `withBase() URL utility (src/lib/url.ts)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `Conclusion-first writing structure`, `Error message structure (what/why/fix)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `cosine.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `embed-blob.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `init.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `new-post.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `categoryPalette.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `cluster-palette.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `HoverCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `TopBar.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `display-name.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `extract-toc.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `plain-excerpt.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `strip-title.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `wikilink-resolver.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `graph.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `config.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `filter-l3.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `bundle-size.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `lede.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `post-overhaul.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `reading-time.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `v1-acceptance.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `word-count.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `init-smoke.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `init-ask.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `init-base-url.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `init-pipeline.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `init-spawn.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `help-modal.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `backlinks-graph.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `_seed.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `Design variant B: Paper & Ink Warm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `Design variant C: Newspaper Dense`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `Graph node color/size encoding (T3)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `Chain-of-thought prompting`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `Prompt injection hardening (delimiters around user content)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `client:idle directive (hydrate after browser idle)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (1 nodes): `Tailwind CSS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `queryMany()` connect `Community 0` to `Community 19`, `Community 2`, `Community 13`, `Community 5`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `openReadonlyDb()` connect `Community 2` to `Community 14`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `runBuildBacklinks()` connect `Community 2` to `Community 0`, `Community 8`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `queryMany()` (e.g. with `auditDrafts()` and `queryBrokenWikilinks()`) actually correct?**
  _`queryMany()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `execute()` (e.g. with `defaultEmbedNote()` and `runBuildIndex()`) actually correct?**
  _`execute()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `openReadonlyDb()` (e.g. with `main()` and `enrichNeighborsFromDb()`) actually correct?**
  _`openReadonlyDb()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `createDb()` (e.g. with `auditDrafts()` and `queryBrokenWikilinks()`) actually correct?**
  _`createDb()` has 13 INFERRED edges - model-reasoned connections that need verification._