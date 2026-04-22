---
name: publish
description: Post-push CI/CD verification — watch the Pages deploy, curl the live URL, surface failing-step logs. Does NOT trigger the push itself.
version: 1.0.0
user-invocable: true
---

# publish

Automates the 4-step post-push verification protocol in `CLAUDE.md`. Run this **after** every `git push origin main` — this repo is the deploy, so a push without verification is not done.

## What it does

1. Finds the CI run for `HEAD` (matches `headSha`; falls back to newest `Deploy to GitHub Pages` run if none matches).
2. Prints the run URL.
3. Streams `gh run watch <id> --exit-status` until completion.
4. `curl -sfI` the live base URL (must be 200) and greps for design tokens (`home-layout`, `Fraunces`, `--ink`).
5. Spot-checks the first article route it finds on the landing page.
6. On failure, prints `gh run view --log-failed | tail -40`.

No push, no deploy trigger, no write to the site. Read-only verification.

## Invoke

```bash
bun run publish-verify
```

Slash form: `/publish`.

## Flags

| Flag | Default | Purpose |
|---|---|---|
| `--run-id <id>` | auto-detect | Override run selection (e.g. for retroactive checks) |
| `--commit <sha>` | current `HEAD` | Match run by commit SHA instead of newest |
| `--skip-watch` | false | Skip `gh run watch` (post-hoc verification) |
| `--skip-live` | false | Skip live URL check (CI-only debug) |
| `--base-url <url>` | `https://jaeyeonbang.github.io/meshblog/` | Override for forks |
| `--workflow <name>` | `Deploy to GitHub Pages` | Override workflow name |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Deployed + live site verified |
| 1 | CI run failed or concluded with `failure` / `cancelled` |
| 2 | CI passed but live URL check failed (tokens missing, 4xx/5xx, article not found) |
| 3 | Could not locate a matching run (or `gh` not installed) |

## Skill execution steps

When the user runs `/publish`:

1. Execute `bun run publish-verify` and stream stdout.
2. On exit 0: one-line "OK — deployed and verified" with run URL.
3. On exit 1: report the failing step + log tail. Suggest fix-forward (never force-push `main`).
4. On exit 2: report which live check failed (status code or token count) — typical cause is a stale dist/ or missing token class.
5. On exit 3: check `gh auth status` and the workflow name in `.github/workflows/deploy.yml`.

## Failure modes

### CI red (exit 1)

Workflow failed. `publish-verify` automatically dumps `gh run view <id> --log-failed | tail -40`. Read it; do NOT `--no-verify` around it or force-push to mask the problem. Fix forward with a new commit.

### Tokens missing on live (exit 2)

The page loaded 200 but the design tokens are absent — usually means a stale CDN edge, the wrong branch was pushed, or a build regression that silently dropped class names. Re-run `--skip-watch` after 30s to rule out Pages edge lag. If persistent, check `dist/index.html` locally after `bun run build:fixture` and compare.

### `gh` missing or unauthed (exit 3)

Install `gh` (`https://cli.github.com/`) and `gh auth login`. The script only needs read access to runs.

## When to run

- Immediately after every `git push origin main`. Never before.
- After fixing a red CI, to confirm the replacement run is green.
- As part of a release checklist, before announcing a ship.

## What it deliberately does NOT do

- Never pushes. The user's `git push` is the trigger; this verifies the result.
- Never force-pushes. Never rewrites history. Never mutates the site.
- Never edits the deploy workflow. If the workflow name changes, pass `--workflow` explicitly.
