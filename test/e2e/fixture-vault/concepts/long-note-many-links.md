---
title: Long Note with Many Wikilinks
tags: [concept, seed]
level_pin: 2
---

This is a long note designed to exercise the wikilink parser across many links scattered throughout a realistic body of text. It references [[plain-wikilink-target]], [[aliased-note]], [[spaced-target]], [[self-referential]], [[cross-dir-concept]], [[multi-link-paragraph]], [[table-with-wikilinks]], [[pure-text-note]], [[code-fence-only]], and [[level-pinned-concept]] — covering ten distinct resolved targets in a single note.

## Introduction to the meshblog pipeline

The meshblog pipeline is designed around a core tension: Obsidian is a local-first tool with a rich, idiosyncratic link format, while GitHub Pages is a static host with no server-side rendering. Bridging these two worlds requires transforming Obsidian's `[[wikilink]]` syntax into standard HTML anchors before the static site generator ever sees the Markdown.

The transformation happens in three layers. First, the preprocessing layer (`preprocess.ts`) applies `resolveWikilinks` using a resolver built from the notes currently in the database. Second, the build-index pipeline (`build-index.ts`) ingests all Markdown files into SQLite, so that wikilink targets are known before any page is rendered. Third, the backlinks stage (`build-backlinks.ts`) post-processes the raw content to populate the `wikilinks` table, which powers the graph view's Backlinks mode.

## Why wikilink resolution is hard

The naive approach — replace every `[[foo]]` with a hyperlink to `/notes/foo` — breaks in at least a dozen ways:

1. **Trailing spaces**: `[[ foo ]]` should resolve to `foo`, not ` foo ` (with space).
2. **Unicode targets**: `[[한글-노트]]` must survive encoding round-trips intact.
3. **Case collisions**: `[[foo-bar]]` and `[[Foo-Bar]]` should resolve to the same note on case-insensitive filesystems.
4. **Missing targets**: `[[does-not-exist]]` should produce a visually distinct stub, not a broken link.
5. **Image embeds**: `![[hero.png]]` must not be treated as a wikilink to a note named `hero.png`.
6. **Alias pipe syntax**: `[[target|display text]]` uses `|` as a separator, which conflicts with Markdown table cell syntax.
7. **Self-referential links**: A note linking to itself must not cause infinite loops.
8. **Cross-directory links**: Notes in `concepts/` must be able to link to notes in `journal/` and vice versa.
9. **Multi-link paragraphs**: Several adjacent wikilinks must each be resolved independently without the regex `lastIndex` state corrupting subsequent matches.
10. **Empty targets**: `[[]]` or `[[|alias]]` must degrade gracefully.

Each of these cases is covered by at least one note in `test/e2e/fixture-vault/`. The fixture corpus is the living documentation of the edge cases the pipeline handles.

## The backlinks graph

One of the most valuable features of an Obsidian-derived blog is the backlinks graph. When a reader lands on a note, they can see which other notes reference it. This turns a flat list of posts into an interconnected knowledge graph.

The implementation in `build-backlinks.ts` works in four steps:

1. Load all notes from the database.
2. Parse every note's content with the wikilink regex.
3. Resolve each raw target to a note ID using the slug map.
4. Write the resolved (or unresolved) wikilink rows to the `wikilinks` table.

The `wikilinks` table distinguishes resolved links (`target_id IS NOT NULL`) from unresolved ones (`target_id IS NULL`). The graph view only renders resolved edges, but the unresolved ones are stored for the audit skill to report.

## Draft and private note exclusion

The build pipeline excludes notes marked `draft: true` or `public: false` from the database. This is a safety guarantee: no matter how a note is written, it will not appear in the public site if either of those frontmatter fields is set.

The exclusion is implemented in `build-index.ts` before the note is inserted into the `notes` table. If a note was previously inserted (from an earlier build where `draft` was not set), it is actively deleted when the next build finds the field set.

## Performance considerations

For a vault of 1000+ notes, the pipeline runs in under 30 seconds on a modern laptop (no LLM calls, SQLite only). The bottleneck is usually the file I/O from `discoverMarkdown`, not the wikilink parsing or DB inserts.

The incremental rebuild path uses `content_hash` to skip unchanged notes. Only notes whose content hash has changed since the last build are re-processed through the entity extraction and wikilink parsing stages.

## Conclusion

A robust wikilink pipeline is the foundation of a reliable Obsidian-to-GitHub-Pages harness. Every edge case ignored during development becomes a silent failure in production — a broken link that authors don't notice because the site still builds. The fixture corpus in `test/e2e/fixture-vault/` exists to make these failures loud and early.
