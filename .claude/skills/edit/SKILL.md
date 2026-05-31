---
name: edit
description: Open content/ as an Obsidian vault for convenient editing (wikilinks, backlinks, graph, properties). Use when the user says "편집", "obsidian 열어", "open editor", or "/edit".
---

# /edit

Open the repo's `content/` folder as an Obsidian vault so the author edits posts
with wikilinks, backlinks, the graph view, and frontmatter Properties — the same
mental model meshblog renders. **There is no bespoke editor**: Obsidian already
does this better than anything we'd build, and the project targets Obsidian power
users.

## What it does

Runs `bun run edit` (`scripts/open-editor.ts`), which launches Obsidian on
`content/` with a 3-tier fallback:

1. **`obsidian://open` URI** — opens the vault if Obsidian is installed and the
   vault is registered.
2. **File manager** — if the URI no-ops (fresh fork: vault not registered yet),
   opens the `content/` folder so you can drag it in via "Open folder as vault".
3. **Install prompt** — if Obsidian isn't detected, prints the download URL.

Each step logs what it did, so a silent failure never happens.

## Run

```bash
bun run edit              # launch Obsidian on content/
bun run edit --folder     # skip the URI, just open the folder (use on first run)
bun run edit --with-dev   # also start the live preview at localhost:4321/meshblog/
```

## Dual-pane workflow

Edit in Obsidian, preview live, ship with `/publish`:

1. `bun run edit --with-dev` — Obsidian (authoring) + `http://localhost:4321/meshblog/` (real render).
2. Write/edit posts in `content/posts/`. Wikilinks `[[Some Post]]` resolve to
   `/posts/<slug>`; external links use standard `[label](url)` (NOT `[[ ]]`).
3. When ready, run `/publish` to build OG images, audit, and deploy.

## First-run note (fresh fork)

On a fresh clone the `content/` vault is not yet in Obsidian's vault list, so the
`obsidian://` URI may do nothing. Run `bun run edit --folder` once and use
Obsidian's "Open folder as vault" on the opened folder. After that, `bun run edit`
opens it directly.

## Notes

- The committed `content/.obsidian/` holds shared vault settings (wikilinks on,
  core plugins: graph/backlink/properties). Personal layout
  (`workspace*.json`, `cache`) is gitignored.
- WSL → Windows path conversion is automatic (`/mnt/d/...` → `D:\...`).
- macOS / native Linux use `open` / `xdg-open`; only WSL is smoke-tested.
