---
name: init
description: One-time meshblog fork setup — optionally link Obsidian vault, write .env template, verify Pages workflow, start localhost
---

# /init

One-time setup for a meshblog fork. Run this the first time you clone the repo onto a new machine. The Obsidian vault link is **optional** — fresh fork users who write posts directly via `/new-post` don't need a vault.

## What it does

1. Asks for your Obsidian vault absolute path **(press Enter to skip)**.
2. Asks for your GitHub repo name (`owner/name`) — or auto-detects from `git remote get-url origin`.
3. Branches on the vault answer:
   - **Vault provided** → replaces `content/notes/` with a real copy seeded from the vault, then runs `fs.watch` to mirror subsequent edits. Copying (not symlinking) is deliberate so `git add .` captures every note instead of a dangling target path.
   - **Skipped** → ensures `content/notes/` exists as an empty dir and logs `[init] No vault linked — notes/ left empty. Use /new-post to write posts directly.` No watcher is spawned.
3b. *(Vault path only)* Optionally mirrors `<vault>/Posts/` into `content/posts/`:
   - **`<vault>/Posts/` exists** → additively copies its contents into `content/posts/` and starts an `fs.watch` to pick up subsequent vault edits. Posts already in `content/posts/` that have no vault counterpart are **preserved** (mirror is additive, not destructive).
   - **`<vault>/Posts/` absent** → logs `[init] vault has no Posts/ subfolder — skipping posts mirror.` and continues. No watcher is spawned for posts.
4. Writes `.env.local` template (`OPENAI_API_KEY` commented — keyless mode is the default).
5. Verifies `.github/workflows/deploy.yml` exists; generates it from the baseline if not.
6. Builds the site:
   - **`content/notes/` has ≥1 `.md`** → real keyless pipeline (`build-index --skip-embed --skip-concepts` → `export-graph` → `astro build`). Your actual notes ship to the graph/backlinks layer.
   - **`content/notes/` is empty** → fixture fallback (`FIXTURE_ONLY=1 build-index` → `export-graph` → `astro build`). Only `test/fixtures/seed.sql` ships; posts you write via `/new-post` still render.
7. Spawns `bun run dev`. Opens `http://localhost:4321/meshblog/`.

## Flow — vault vs no-vault

| Step | With vault | No vault (skip) |
| :--- | :--- | :--- |
| 1. vault path | absolute path | press Enter |
| 3. notes/ | copy + `fs.watch` mirror | empty dir created |
| 3b. posts/ | `<vault>/Posts/` merged additively → `content/posts/` + `fs.watch` (skipped if no Posts/ subfolder) | skipped entirely |
| 6. build | real keyless pipeline | fixture fallback |
| Authoring | `/new-post` writes posts; vault `Posts/` auto-mirrors; vault notes feed graph/RAG | `/new-post` writes posts directly |

## Run

```bash
bun run init
```

## Notes

- Keyless users (no `OPENAI_API_KEY`) still get a working build. With a vault: real notes + degraded embeddings/Q&A. Without a vault: fixture seed + your real posts.
- **When a vault is provided**, `content/notes/` is always a real copy, not a symlink — so `git add .` → `git push` works without any manual materialization. Edits in the vault still propagate via `fs.watch`.
- `/new-post` works with or without a vault — posts land in `content/posts/` either way.
- `astro.config.mjs` is left alone. The `/meshblog/` base path is already wired.
- When `<vault>/Posts/` exists, posts written in Obsidian's `Posts/` subfolder auto-mirror to `content/posts/`. Posts authored directly in `content/posts/` are preserved (mirror is additive, not destructive) — but **vault is canonical** when both have the same filename: vault overwrites repo on next sync.

## Next

- `/new-post "My Post Title"` — scaffold a new `draft: true` post in `content/posts/`.
- `/refresh` — full pipeline rebuild + preview.
- `/audit` — check for draft leaks before pushing.
