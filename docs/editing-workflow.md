# Editing workflow

meshblog is built for **Obsidian power users**. You edit your posts in Obsidian —
not a bespoke web editor — because Obsidian already gives you wikilinks,
backlinks, the graph view, and frontmatter Properties, which is exactly the
mental model the site renders.

## The dual-pane loop

```
┌─────────────────────────┐        ┌──────────────────────────────────┐
│ Obsidian (authoring)    │        │ Browser (live render)            │
│ content/  as a vault    │  edit  │ http://localhost:4321/meshblog/  │
│ • wikilinks [[Post]]    │ ─────▶ │ • real CSS + components          │
│ • backlinks / graph     │  save  │ • auto-reload on save            │
│ • frontmatter Properties│        │                                  │
└─────────────────────────┘        └──────────────────────────────────┘
                    │
                    ▼  when ready
              /publish  →  build-og → audit → astro check → fixture build → push → CI
```

## Start it

```bash
bun run edit --with-dev
```

This opens `content/posts` in Obsidian **and** starts the live preview at
`http://localhost:4321/meshblog/`. Edit in Obsidian, watch the browser update.

Other forms:

```bash
bun run edit            # just open Obsidian on content/posts
bun run edit --folder   # open the content/posts folder in your file manager (first run)
```

You can also trigger it from Claude Code with `/edit`.

## Installing Obsidian

`bun run edit` needs the Obsidian desktop app. Install it once:

| OS | Command / link |
| :--- | :--- |
| Windows | `winget install Obsidian.Obsidian` — or [obsidian.md/download](https://obsidian.md/download) |
| macOS | `brew install --cask obsidian` — or the download link |
| Linux | [obsidian.md/download](https://obsidian.md/download) (AppImage / Flatpak / Snap) |

`bun run edit` finds the app automatically, including non-standard install
locations (e.g. `D:\Program Files\Obsidian` on Windows) — it reads the install
path from the registry, not just the default `%LOCALAPPDATA%` folder. If
Obsidian isn't installed, the command prints the download link and the vault
folder path instead of failing silently.

## First run on a fresh clone

On a brand-new clone, the `content/posts` vault is not yet registered in
Obsidian's vault list, so the bare `obsidian://open?path=` URI is refused
("Vault not found"). Either let Obsidian register it (open it once via
**"Open folder as vault"**), or run:

```bash
bun run edit --folder
```

which opens the folder in your file manager — then in Obsidian choose **"Open
folder as vault"** and point it at `content/posts`. After that, `bun run edit`
opens it directly.

If Obsidian isn't installed, `bun run edit` prints the download link and the
folder path so nothing fails silently.

## Link conventions

| You want | Write | Renders as |
| :--- | :--- | :--- |
| Link to another post | `[[Post Title]]` | `<a href="/posts/<slug>">` |
| Link to a note | `[[Note Title]]` | `<a href="/notes/<slug>">` |
| External link (paper, spec, repo) | `[paper link](https://…)` | normal external anchor |

**Do not** use `[[ ]]` for external URLs. The wikilink resolver looks for a
matching post/note; an external URL never matches, so `[[paper link]](url)`
renders as a broken dashed "missing link" stub followed by a bare `(url)`.
Standard Markdown `[label](url)` is the correct shape for anything off-site.

## Shared vault settings

`content/posts/.obsidian/` is committed with shared settings so every fork gets
the same setup:

- `app.json` — wikilinks on (`useMarkdownLinks: false`), shortest link format.
- `core-plugins.json` — graph, backlink, page-preview, properties, outline,
  tag-pane enabled.
- `types.json` — frontmatter Property types (date, tags, draft checkbox, …).

Per-machine layout (`workspace*.json`, caches, your personal plugins/snippets)
is gitignored, so opening the vault on your machine never produces noisy diffs.

## Publishing

When a post is ready, run `/publish` (or the `publish` skill). It builds OG
images, runs the editorial audit + `astro check`, does a keyless fixture build,
commits, pushes to `main`, and watches the GitHub Pages deploy.

## Platform notes

- **WSL → Windows**: path conversion is automatic (`/mnt/d/...` → `D:\...`),
  launch goes through `cmd.exe` / `explorer.exe`. This is the smoke-tested path.
- **macOS / native Linux**: uses `open` / `xdg-open`. Functional but not yet
  smoke-tested end to end.
