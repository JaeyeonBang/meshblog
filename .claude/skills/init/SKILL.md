---
name: init
description: meshblog 초기 setup — Obsidian vault 경로 연결, GitHub Pages 활성화, .env 템플릿 생성, 샘플 콘텐츠 추가
---

# /init

meshblog을 처음 clone한 후 실행. 비개발자도 따라올 수 있도록 질문 순서대로 안내.

## TODO (구현 예정)

1. **Vault 경로 결정**
   - AskUserQuestion: "기존 Obsidian vault가 있나요? 있으면 절대경로, 없으면 새로 만들기"
   - vault path를 `.env`의 `VAULT_PATH=`로 저장
   - `content/posts/`, `content/notes/`를 vault의 해당 폴더로 symlink (또는 vault 안으로 repo를 둘지 선택)

2. **LLM 키 설정**
   - AskUserQuestion: OpenAI / Anthropic / OpenRouter 중 선택
   - `.env`에 `LLM_PROVIDER=`, `OPENAI_API_KEY=` 등 저장
   - `.env.example`은 commit, `.env`는 gitignore

3. **GitHub Pages 활성화**
   - `gh api repos/:owner/:repo/pages -X POST -f build_type=workflow` 호출
   - 실패 시 Settings → Pages → "GitHub Actions" 수동 안내

4. **샘플 콘텐츠 심기**
   - `content/notes/welcome.md`, `content/posts/hello-meshblog.md` 생성
   - 첫 `/publish`로 파이프라인 검증 가능하게

5. **완료 체크**
   - `bun install` 실행
   - `bun run dev` 안내
   - 다음 단계: `/new-post` 또는 `/refresh` 또는 `/publish`
