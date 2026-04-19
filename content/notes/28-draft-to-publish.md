---
title: "Draft-to-Publish 워크플로"
tags: [workflow, publishing, obsidian, markdown]
date: 2026-04-19
---

TL;DR: `_drafts/` 폴더 + frontmatter `draft: true` 이중화. Obsidian에서 markdown 그대로 작성하고, git branch별 draft 격리. 편집/완성 후 `_drafts/` → `content/notes/`로 이동.

## 문제 정의

Note를 작성할 때:
1. 초안: 아직 완성 안 됨
2. 검토 중: 링크, 태그 확인
3. 발행: 웹사이트에 노출

현재 상태를 추적해야 함.

## 1. 폴더 기반 구분

```
vault/
├── _drafts/
│   ├── embedding-intro.md
│   ├── rag-patterns.md
│   └── graph-viz.md
├── content/notes/  (published)
│   ├── 01-typescript.md
│   ├── 02-sqlite.md
│   └── ...
```

Obsidian vault는 `_drafts/` 폴더만 보도록 설정. Published notes는 별도 폴더 (깃만 추적).

## 2. Frontmatter draft 플래그

```yaml
---
title: "Embedding Models for Note Search"
tags: [embeddings, search]
draft: true
date: 2026-04-19
---
```

**draft: true** = 아직 진행 중. Build/deploy 시 제외.

```typescript
// astro.config.mjs
export async function getCollection(collection) {
  const notes = await getCollection('notes')
  if (import.meta.env.PROD) {
    return notes.filter(n => !n.data.draft)
  }
  return notes
}
```

## 3. Git Branch별 Drafts

각 feature마다 branch 생성:

```bash
git checkout -b draft/embedding-search
# _drafts/embedding-search.md 작성
git add _drafts/embedding-search.md
git commit -m "draft: embedding search patterns"
```

Main branch에는 published notes만. Draft branch는 격리.

검토 후 merge:
```bash
git checkout main
git merge draft/embedding-search --no-ff
# _drafts/ → content/notes/NN-embedding-search.md 이동
git rm _drafts/embedding-search.md
git add content/notes/NN-embedding-search.md
git commit -m "publish: embedding search patterns"
```

## 4. Obsidian 워크플로

### 초안 작성

Obsidian vault settings:
- 폴더: `_drafts/` 만 노출
- 파일명: `topic-slug.md` (번호 없음)

```markdown
---
title: "The title"
tags: [tag1, tag2]
draft: true
---

TL;DR: One sentence summary.

## Section 1
...
```

Obsidian에서 markdown 그대로 작성. 다른 note로 링크: `[[embedding-models]]` (자동 링크).

### 검토

Branch에서 완성 후:

```bash
git checkout draft/embedding-search
# 작성 완료, PR 생성
gh pr create --draft --title "Draft: Embedding Search Patterns"
```

Code review (자기 자신이든 협업자든):
- 링크 검증
- 태그 정합성
- 한영 혼합 확인

### 발행

Merge 전 마지막 단계:

```bash
# _drafts/embedding-search.md
# → content/notes/24-embedding-search.md 로 이동

# frontmatter에서 draft: true 제거
# title, tags, date 확인
```

```yaml
---
title: "Embedding Models for Note Search"
tags: [embeddings, search, rag]
date: 2026-04-19
---
```

```bash
git mv _drafts/embedding-search.md content/notes/24-embedding-search.md
git add content/notes/24-embedding-search.md
git rm _drafts/embedding-search.md
git commit -m "publish: embedding models for note search"
git push origin main
```

## 5. 자동화 (선택)

Draft→Published 이동 자동화:

```bash
#!/bin/bash
# publish.sh
DRAFT_FILE=$1
NEXT_NUM=$(ls content/notes/*.md | sed 's/.*\([0-9]*\)-.*/\1/' | sort -n | tail -1)
NEXT_NUM=$((NEXT_NUM + 1))

# frontmatter 수정 (draft 제거)
sed -i '/^draft: /d' "$DRAFT_FILE"

# 이동
FILENAME=$(basename "$DRAFT_FILE")
SLUG="${FILENAME%.md}"
mv "$DRAFT_FILE" "content/notes/$NEXT_NUM-$SLUG.md"

git add "content/notes/$NEXT_NUM-$SLUG.md" "_drafts/"
git commit -m "publish: $SLUG"
```

사용:
```bash
./publish.sh _drafts/embedding-search.md
```

## 6. 상태 추적

Obsidian dataview로 draft 진행률:

```
TABLE draft, dateformat(date, "yyyy-MM-dd")
FROM "content/notes" OR "_drafts"
SORT draft DESC, date DESC
```

결과:
| title | draft | date |
|-------|-------|------|
| Embedding Search | true | 2026-04-19 |
| Published Note | false | 2026-04-10 |

이 테이블로 한눈에 진행률 확인.

## 폴더 구조 최종 확인

```
vault/
├── _drafts/                      # Obsidian에서만 보임
│   ├── embedding-search.md
│   └── graph-algorithms.md
├── content/notes/                # Published, git 추적
│   ├── 21-client-directives.md
│   ├── 22-fuse-threshold.md
│   └── ...
├── vault.yml                     # Obsidian 폴더 설정
└── .gitignore                    # _drafts/ 선택적 무시
```

`.gitignore`에서 `_drafts/`를 추가하면, publish 완료 후 자동으로 git에서 제외. 깔끔.
