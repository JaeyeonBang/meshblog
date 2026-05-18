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

## Style guide

When asked to also draft body content (not just scaffold the frontmatter), **read `content/writing_guide.md` first** and follow it. Same rules as `/new-post`:

- 모드 A (논문 요약형, `~합니다`) 또는 모드 B (서사형 에세이, `~다`) 중 하나를 골라 일관되게.
- 영문 기술 용어 보존 + 첫 등장 시 한글 부연.
- KO 본문은 가이드의 모드 규칙을 따르고, EN 본문은 KO 구조를 그대로 미러링하되 자연스러운 영어로 옮긴다.
- 본문 안 `[출처: URL]` 금지. 출처는 상단 `[[paper link]]` 또는 하단 `## References`.

이 스킬이 단순히 frontmatter만 만드는 호출이면 가이드를 읽지 않아도 된다. 본문까지 작성하라는 요청일 때만 가이드를 참조한다.
