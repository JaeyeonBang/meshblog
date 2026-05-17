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
