---
name: edit
description: Open content/posts as an Obsidian vault for convenient editing (wikilinks, backlinks, graph, properties). Use when the user says "편집", "obsidian 열어", "open editor", or "/edit".
---

# /edit

Open the repo's `content/posts` folder as an Obsidian vault so the author edits
posts with wikilinks, backlinks, the graph view, and frontmatter Properties — the
same mental model meshblog renders. **There is no bespoke editor**: Obsidian
already does this better than anything we'd build, and the project targets
Obsidian power users.

## What it does

Runs `bun run edit` (`scripts/open-editor.ts`), which launches Obsidian on
`content/posts` with a 4-tier fallback:

1. **Direct exe + URI** — finds `Obsidian.exe` via the Windows registry (covers
   non-standard install dirs like `D:\Program Files\Obsidian`) and launches it
   with the vault URI. Registers + opens the vault on first run.
2. **`obsidian://open` URI** — if the exe path is unknown but Obsidian is
   installed and the vault is already registered.
3. **File manager** — opens the `content/posts` folder so you can drag it in via
   "Open folder as vault".
4. **Install prompt** — if Obsidian isn't detected, prints the download URL.

Each step logs what it did, so a silent failure never happens. Launch is a
detached spawn, so Obsidian survives `bun run edit` exiting.

## Run

```bash
bun run edit              # launch Obsidian on content/posts
bun run edit --folder     # skip detection, just open the folder (first run)
bun run edit --with-dev   # also start the live preview at localhost:4321/meshblog/
```

## Dual-pane workflow

Edit in Obsidian, preview live, ship with `/publish`:

1. `bun run edit --with-dev` — Obsidian (authoring) + `http://localhost:4321/meshblog/` (real render).
2. Write/edit posts in `content/posts/`. Wikilinks `[[Some Post]]` resolve to
   `/posts/<slug>`; external links use standard `[label](url)` (NOT `[[ ]]`).
3. When ready, run `/publish` to build OG images, audit, and deploy.

## First-run note (fresh fork)

On a fresh clone the `content/posts` vault is not yet in Obsidian's vault list,
so the bare `obsidian://` URI is refused ("Vault not found"). Tier 1 (direct exe)
registers it automatically; if that doesn't catch, run `bun run edit --folder`
once and use Obsidian's "Open folder as vault" on the opened folder. After that,
`bun run edit` opens it directly.

## Notes

- The committed `content/posts/.obsidian/` holds shared vault settings (wikilinks
  on, core plugins: graph/backlink/properties). Personal layout
  (`workspace*.json`, `appearance.json`, `graph.json`, `cache`) is gitignored.
- WSL → Windows path conversion is automatic (`/mnt/d/...` → `D:\...`).
- macOS / native Linux use `open` / `xdg-open`; only WSL is smoke-tested.
