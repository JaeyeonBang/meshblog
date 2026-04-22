---
name: init
description: One-time meshblog fork setup — link Obsidian vault, write .env template, verify Pages workflow, start localhost
---

# /init

One-time setup for a meshblog fork. Run this the first time you clone the repo onto a new machine.

## What it does

1. Asks for your Obsidian vault absolute path.
2. Asks for your GitHub repo name (`owner/name`) — or auto-detects from `git remote get-url origin`.
3. Replaces any existing `content/notes/` (fresh-degit placeholder or stale symlink) with a real directory seeded from the vault, then runs `fs.watch` to mirror subsequent edits. Copying — not symlinking — is deliberate so `git add .` captures every note instead of a dangling target path.
4. Writes `.env.local` template (`OPENAI_API_KEY` commented — keyless mode is the default).
5. Verifies `.github/workflows/deploy.yml` exists; generates it from the baseline if not.
6. Builds the site:
   - **Vault has ≥1 `.md`** → real keyless pipeline (`build-index --skip-embed --skip-concepts` → `export-graph` → `astro build`). Your actual notes ship.
   - **Vault is empty** → fixture fallback (`FIXTURE_ONLY=1 build-index` → `export-graph` → `astro build`). Only `test/fixtures/seed.sql` ships.
7. Spawns `bun run dev`. Opens `http://localhost:4321/meshblog/`.

## Run

```bash
bun run init
```

## Notes

- Keyless users (no `OPENAI_API_KEY`) still get the fixture build and their real vault content — embeddings and Q&A degrade gracefully.
- `content/notes/` is always a real copy, not a symlink — so `git add .` → `git push` works without any manual materialization. Edits in the vault still propagate via `fs.watch`.
- `astro.config.mjs` is left alone. The `/meshblog/` base path is already wired.

## Next

- `/new-post "My Note"` — scaffold a new `draft: true` note.
- `/refresh` — full pipeline rebuild + preview.
- `/audit` — check for draft leaks before pushing.
