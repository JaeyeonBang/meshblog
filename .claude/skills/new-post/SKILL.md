---
name: new-post
description: Scaffold a new post in content/posts/ with standard frontmatter (draft:true by default). Use --as=note to write to content/notes/ instead (legacy).
---

# /new-post

Scaffold a new post in `content/posts/` with the standard frontmatter. Safe to run anytime — new posts are `draft: true` by default so they won't leak to production until you explicitly flip the flag.

## What it does
1. Asks for the post title.
2. Slugifies it to `content/posts/{slug}.md` (default).
3. Writes the frontmatter template:
   - `draft: true`, `date` (today), empty `tags`, empty `category`, `image` placeholder.
   - The `image` field references `/meshblog/og/posts/{slug}.png` — run `bun run build-og` separately to generate the actual file.

## Run
```bash
bun run scripts/new-post.ts "My Post Title"           # -> content/posts/<slug>.md (default)
bun run scripts/new-post.ts "My Post Title" --as=note # -> content/notes/<slug>.md (legacy)
```

## Style guide

When asked to also draft body content (not just scaffold the frontmatter), **read `content/writing_guide.md` first** and follow it. Key points:

- Pick **모드 A (논문 요약형)** or **모드 B (서사형 에세이)** before writing — don't mix.
- 종결어미는 한 글 안에서 일관되게 (모드 A → `~합니다`, 모드 B → `~다`). `In My opinion` 섹션은 예외.
- 영문 기술 용어는 보존 + 첫 등장 시 한글 부연 `(...)`.
- 모드 A는 `# Introduction → # Method → # Results → # In My opinion` 흐름이 기본.
- 본문 안에 `[출처: URL]` 인라인 인용을 끼워넣지 않는다. 출처는 글 상단 `[[paper link]]` 또는 하단 `## References`.
- 이미지가 있다면 글 마지막에 `_(이미지: 원본 사이트 참조)_` 한 줄.

이 스킬이 단순히 frontmatter만 만드는 호출이면 가이드를 읽지 않아도 된다. 본문까지 작성하라는 요청일 때만 가이드를 참조한다.
