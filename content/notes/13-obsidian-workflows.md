---
title: "Obsidian Workflows for Developers"
tags: [obsidian, note-taking, productivity, second-brain]
date: 2026-01-13
---

Obsidian is a local-first Markdown editor with a powerful plugin ecosystem. It's particularly well-suited for developers who think in code and want their notes to be a long-term asset.

## Why Obsidian for Developers

- **Local files**: Your notes are plain Markdown files, owned by you
- **Git-friendly**: Easy to version control, backup, sync
- **Plugin ecosystem**: Community plugins for almost anything
- **Graph view**: Visualize connections between notes
- **Dataview**: Query your notes like a database

## Core Workflows

### Daily Notes

Create a new note each day to capture fleeting thoughts. Review and connect them weekly.

### Zettelkasten in Obsidian

1. Write an atomic note (one idea)
2. Link it to related notes with `[[wikilinks]]`
3. Add to a MOC (Map of Content) if relevant
4. Review graph periodically for unexpected connections

### Code Snippets as Notes

Store reusable code patterns as notes. Tag them with the language and use case. Obsidian's search will surface them when needed.

## Integration with meshblog

meshblog reads Markdown files from Obsidian vaults. The frontmatter (`---` block) provides metadata:
- `title`: Note display name
- `tags`: Topic categorization
- `date`: Creation date
- `public: false`: Exclude from published output

No changes needed to existing Obsidian vault structure — meshblog works with the files as-is.
