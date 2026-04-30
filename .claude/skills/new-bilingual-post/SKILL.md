---
name: new-bilingual-post
description: Scaffold a note in BOTH Korean and English (companion-file model).
             Use when starting a post the author wants published in both languages.
---

# /new-bilingual-post

Creates `content/notes/<slug>.md` (KOR primary, `has_en: true`) and
`content/notes/<slug>.en.md` (ENG companion). Both `draft: true`.

## What it does
1. Accepts KOR title (positional arg 1) and EN title (positional arg 2); prompts interactively if omitted.
2. Derives the slug from the KOR title.
3. Writes `<slug>.md` with `has_en: true`, KOR title, `draft: true`, empty tags/aliases, no level_pin.
4. Writes `<slug>.en.md` with EN title, `draft: true`. (No tags/aliases on companion — single source of truth on primary.)
5. Errors and exits if either file already exists — no silent overwrite.

## Wrap convention
Strings that are mono-cased, single-word, or already English codes (eyebrows, badges) do not need `<T>` wrapping.
Only bilingual prose strings (headings, paragraphs, labels) should use `<T ko="…" en="…">`.

## Run
```bash
bun run new-bilingual-post "한국어 제목" "English title"
```
