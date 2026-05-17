---
name: new-bilingual-post
description: Scaffold a post in BOTH Korean and English (companion-file model) in content/posts/ by default. Use --as=note for legacy content/notes/ behaviour.
---

# /new-bilingual-post

Creates `content/posts/<slug>.md` (KOR primary, `has_en: true`) and
`content/posts/<slug>.en.md` (ENG companion). Both `draft: true`.

## What it does
1. Accepts KOR title (positional arg 1) and EN title (positional arg 2); prompts interactively if omitted.
2. Derives the slug from the KOR title.
3. Writes `<slug>.md` (KOR primary) with `has_en: true`, `draft: true`, `date` (today), empty `tags`, empty `category`, and an `image` placeholder at `/meshblog/og/posts/{slug}.png`.
4. Writes `<slug>.en.md` (ENG companion) with EN title, `draft: true`. (Minimal — no date/image duplication.)
5. Errors and exits if either file already exists — no silent overwrite.

## OG image note
The `image` path is a placeholder. Run `bun run build-og` separately to generate the actual PNG.

## Wrap convention
Strings that are mono-cased, single-word, or already English codes (eyebrows, badges) do not need `<T>` wrapping.
Only bilingual prose strings (headings, paragraphs, labels) should use `<T ko="..." en="...">`.

## Run
```bash
bun run new-bilingual-post "한국어 제목" "English title"           # -> content/posts/ (default)
bun run new-bilingual-post "한국어 제목" "English title" --as=note # -> content/notes/ (legacy)
```
