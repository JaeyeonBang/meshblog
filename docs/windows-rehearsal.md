# Windows 11 fork-from-zero rehearsal

Last item on the v1 punch-list from `CLAUDE.md`. WSL-based CI covers the 80% that isn't OS-sensitive (see the automated coverage matrix below); this checklist locks in the 20% that only Windows can tell us about.

Run once on a **clean Windows 11 Home** (not Pro — the permission model differs) with a real Obsidian vault. Not a WSL shell — real PowerShell + Git Bash. If all steps pass, v1 is done.

## Prerequisites

Install in this order on the target Windows machine:

1. Git for Windows (includes Git Bash)
2. Node 22+ (`nvm-windows` is fine)
3. Bun 1.x (`irm bun.sh/install.ps1 | iex`)
4. GitHub CLI (`winget install --id GitHub.cli`) and `gh auth login`
5. Obsidian with at least one vault that has:
   - Notes with `[[wikilinks]]` and `[[target|alias]]` syntax
   - An embedded image `![[something.png]]`
   - At least one note with `draft: true` frontmatter (to exercise D3)

## Steps

### 1. Clean fork (criterion #1)

```powershell
cd $HOME
Remove-Item -Recurse -Force my-blog-test -ErrorAction SilentlyContinue
mkdir my-blog-test
cd my-blog-test
npx degit JaeyeonBang/meshblog .
bun install
```

Expect: no install errors. If `better-sqlite3` fails to build, install Windows Build Tools (`npm i -g windows-build-tools`) and retry.

### 2. `/init` flow (criterion #1)

```powershell
bun run init
```

Must ask **exactly two** questions:
1. Obsidian vault absolute path — enter your vault path, e.g. `C:\Users\<you>\Documents\ObsidianVault`
2. GitHub repo name — accept the autodetect or enter `<your-user>/my-blog-test`

Then it should:
- Print `[init] Copied vault contents into <path>\content\notes`
- Print `[init] Watching <vault> …`
- Build (keyless path — real notes, not fixture)
- Open `http://localhost:4321/meshblog/` automatically (or say "Open this URL")

**Capture**: screenshot of the page showing your actual vault notes.

### 3. Real vault keyless (criterion #2)

Browser at `http://localhost:4321/meshblog/`. Confirm:
- Your note titles are listed — not the fixture seed (look for "A Thread of Notes", which is a fixture-only title; it should NOT appear if your vault has notes).
- Open one note — Q&A chips may say "no entities" (keyless degradation), but the note body must render.

### 4. Wikilink rendering (criterion #3)

Open any note that has `[[target|alias]]`. Inspect HTML (F12):
- The alias text must be inside `<a href="/meshblog/notes/target">alias</a>`, not plain text.

### 5. Draft safety net (criterion #4)

In PowerShell:
```powershell
# Find a draft:true note's slug from your vault
Get-Content content\notes\<your-draft-slug>.md | Select-String "draft:"
# Should show `draft: true`

curl.exe -s http://localhost:4321/meshblog/ | Select-String "<your-draft-slug>"
# Should be empty — the draft must NOT appear on the landing page
```

Bonus: run `bun run audit-drafts` — should report 0 leaks on the local build (the real `/audit` skill check is for post-push on `main`, not local).

### 6. Backlinks mode (criterion #5)

Browser: `http://localhost:4321/meshblog/graph/`. Look for three mode buttons: **Notes**, **Concepts**, **Backlinks**. Click Backlinks — node count should be > 0 if your vault has wikilinks.

### 7. Push → deploy → live (criterion #6)

```powershell
gh repo create my-blog-test --public --source . --push
# Wait a moment for the push to settle

bun run publish-verify
```

Expect:
- Run URL printed
- `gh run watch` streams the deploy log
- Live URL returns 200
- Final `Verdict: OK — DEPLOYED AND VERIFIED`

If exit code ≠ 0, record the error output verbatim — that's a real Windows-only signal.

### 8. Daily audit workflow (criterion #7)

On GitHub.com, go to Actions → "daily audit" → Run workflow (manual trigger). After it completes, confirm:
- A pull request titled "Daily audit report — YYYY-MM-DD" exists on the repo.
- The PR body includes a Markdown artifact link.

## Windows-specific things to watch for

| Thing | Why it might break |
|---|---|
| CRLF line endings | Git's `core.autocrlf=true` default can inject `\r` into markdown → frontmatter parse bug |
| `\` vs `/` in console output | Node auto-normalizes, but logs in `init.ts` may show mixed separators — informational only |
| NTFS permissions on `content/notes/` | Non-admin users can't create symlinks — already mitigated by `linkVault` using `fs.cpSync`, but verify the copy succeeded |
| PowerShell readline buffering | Prompt flow should work (commit `fb86e48` switched to `node:readline` async iterator specifically for this) — verify both prompts fire in sequence |
| Unicode in paths | If your vault path has Korean/emoji chars, note copy should still work |

## If something fails

- **Prompt doesn't advance after first answer**: readline regression. Check `createAskFn` in `scripts/init.ts` (search the file for the symbol — line numbers drift).
- **`content/notes/` is empty after init**: `linkVault` copy failed silently. Look for a `[init] Copied vault contents` log line.
- **Live site shows fixture content, not your notes**: CI deployed in fixture-fallback mode. Your repo might be private; check the `build-index` step logs.
- **`publish-verify` exits 3**: `gh` not authed — `gh auth login`.

File findings as an issue on `JaeyeonBang/meshblog` with the "windows-rehearsal" label.

## What this validates

Criteria #1–#7 from `CLAUDE.md` v1 acceptance. After a green run, mark v1 complete.

## Automated coverage that makes this short

See `CLAUDE.md` → this doc is only the Windows-specific residue. Everything below is already locked in by CI on every push:

| # | Covered by |
|---|---|
| #3 wikilink | `test/e2e/fixture-vault.test.ts` — 9 edge cases |
| #4 draft exclusion | `test/e2e/fixture-vault.test.ts` + `test/v1-acceptance.test.ts` |
| #5 backlinks mode | `test/v1-acceptance.test.ts` |
| #1 copy semantics | `test/e2e/init-smoke.test.ts` — real-dir, not symlink + unicode + nested |
| #6 push → live | `bun run publish-verify` (runnable anywhere, not OS-specific) |
| #7 daily audit | `gh run list --workflow "daily audit"` |

Only OS-specific things that CI can't simulate remain on this page.
