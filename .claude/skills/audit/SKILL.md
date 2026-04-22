---
name: audit
description: Run the deterministic editorial invariant gate against src/ — catches hex literals, raw letter-spacing, 3px border regressions, and more before they ship.
version: 1.0.0
user-invocable: true
---

# audit

Runs `scripts/audit.ts` — six grep-based checks that enforce the design-system editorial invariants defined in `CLAUDE.md`. No build step, no API key required.

## Invoke

```bash
bun run audit
```

## Checks performed

| # | Rule | Severity |
|---|------|----------|
| 1 | No hex color literals outside `tokens.css` / `fonts.css` | FAIL |
| 2 | No raw `letter-spacing: 0.Xem` (use `var(--track-*)`) | FAIL |
| 3 | `cursor: pointer` present — verify selector is an interactive element | WARN |
| 4 | `border*: 3px` outside allowlist (`PullQuote`, `PageQa`, `QaCard`) | FAIL |
| 5 | `:hover` in file with no `transition:` declaration | WARN |
| 6 | Raw `font-size: Npx` — migrate to `var(--fs-*)` | WARN |

FAIL causes exit code 1. WARN is informational only.

## Skill execution steps

When the user runs `/audit`:

1. Execute `bun run audit` and capture stdout + exit code.
2. Parse the output for FAIL / WARN sections.
3. Report back with a human-readable summary:
   - If exit code 0: "All invariant checks passed. N warning(s) noted."
   - If exit code 1: list every FAIL with the offending file:line and the correct fix.

## Fix guidance

### [1] Hex literal — replace with a design token

```diff
- color: #1a1a1a;
+ color: var(--ink);
```

If no token matches, add one to `design.md` frontmatter and re-run `bun run build-tokens`.

### [2] Raw letter-spacing — replace with track token

```diff
- letter-spacing: 0.2em;
+ letter-spacing: var(--track-eyebrow);
```

Available tokens (check `src/styles/tokens.css`): `--track-eyebrow`, `--track-badge`, `--track-nav`.

### [4] 3px border outside allowlist

Only `PullQuote.astro`, `PageQa.astro`, and `QaCard.astro` may use `border(-top)?: 3px`. Move emphasis styling there or drop the border to 1px.

### [6] Raw px font-size — migrate to fs token

```diff
- font-size: 10px;
+ font-size: var(--fs-xs);
```

See `src/styles/tokens.css` for the full `--fs-*` scale.

## When to run

- Before every commit touching `src/` (add to pre-commit hook or call manually)
- Inside CI alongside `bunx astro check`
- When reviewing a PR that modifies design-system files
