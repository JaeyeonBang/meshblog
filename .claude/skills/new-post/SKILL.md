---
name: new-post
description: Obsidian vault에 새 블로그 포스트 MD 파일 생성 (frontmatter 포함)
---

# /new-post

새 글을 시작할 때 사용. frontmatter 기본값 채워서 vault에 생성.

## TODO (구현 예정)

1. AskUserQuestion: 제목, 카테고리, public 여부
2. slug 생성 (kebab-case), 날짜 prefix
3. `content/posts/YYYY-MM-DD-<slug>.md` 생성
4. frontmatter 템플릿:
   ```yaml
   ---
   title: "<제목>"
   date: YYYY-MM-DD
   public: true
   tags: []
   excerpt: ""
   ---
   ```
5. 파일 경로 안내 + Obsidian에서 편집 시작 권유
