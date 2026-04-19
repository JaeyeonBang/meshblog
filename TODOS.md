# TODOS — Deferred Items

## Task 0.5 — FIXTURE_ONLY=1 mode

Add `FIXTURE_ONLY=1` environment flag that runs the full site with canned/fixture notes and qa_cards, requiring zero API keys. Enables zero-cost preview for new users.

- Fixture notes: subset of `content/notes/` synthetic fixtures
- Fixture qa_cards: pre-committed JSON under `.data/qa/`
- Build should detect `FIXTURE_ONLY=1` and skip `build-index` / `generate-qa` / `export-graph`

## Task 8 — Deferred UX items (resolve during Task 8 implementation)

- **T2**: Related notes vs backlinks distinction — clarify UX separation
- **T3**: Graph node encoding — color/size encoding for node types and weight
- **T4**: Site tagline — finalize and add to layout
- **T5**: Long answer overflow — truncation + expand UI for long QA card answers

## Post-Phase 3 — Multi-author safety

Add `rehype-sanitize` if meshblog is ever adapted for multi-author content. Currently `rehype-raw` is enabled and all `content/` is treated as trusted (single-author only).
