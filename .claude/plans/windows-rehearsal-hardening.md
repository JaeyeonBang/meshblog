# Plan: Windows rehearsal hardening

**Goal**: Fix the meshblog `/init` Windows bugs + rehearsal UX gaps uncovered by the qa-only audit, so the Windows 11 Home rehearsal actually runs end-to-end without false failures.

**Context**: v1 wrap-up; docs/windows-rehearsal.md + scripts/windows-rehearsal.ps1 shipped in #31/#32/#34. Pre-flight qa-only audit found 2 Critical + 2 High + 4 Medium + 3 Low findings plus 9 environmental risks (gh auth scope, CRLF, PS5 BOM, etc).

**Non-goals**:
- Full v2 `/init` rewrite. Touch only what Windows rehearsal needs.
- Obsidian plugin changes, vault migration tooling, etc.
- Private-fork support for the rehearsal (addable later via flag, not MVP).

## Scope lock

5 phases, strict ordering. P1 is mandatory prereq for rehearsal to work at all; P2-P5 improve UX + defense.

| Phase | Fixes | Files | ~LOC |
|---|---|---|---|
| **P0** | Refactor prereq for testability (commits 1/6 of P1 PR) | `scripts/init.ts` | ~40 |
| P1 | C1, C2, R4, R5, R6 + FM1 probe + A2 build-tokens + A3 PID (commits 2-6/6 of P1 PR) | `scripts/init.ts`, `scripts/windows-rehearsal.ps1` | ~110 |
| P2 | H1 (`-VaultPath` optional) + A1 banner/marker | `scripts/windows-rehearsal.ps1`, `docs/windows-rehearsal.md` | ~40 |
| P3 | H2 (report path), L3 (doc drift) | `scripts/windows-rehearsal.ps1`, `docs/windows-rehearsal.md` | ~20 |
| P4 | R1, R7, M4 + A4 backoff + A5 idempotency | `scripts/windows-rehearsal.ps1`, `scripts/publish-verify.ts` | ~50 |
| P5 | M1 (`-Private` flag), M3 (cleanup), FM3 (repo-name conflict) | `scripts/windows-rehearsal.ps1` | ~35 |

**P1 PR commit structure** (6 atomic commits on one branch/PR):
1. `refactor(init): extract getDevSpawnOptions, parseAstroBase, runInit seam` — P0
2. `fix(init): survive parent exit on Windows via detached spawn + HTTP probe` — P1.1 + FM1
3. `fix(init): print dynamic URL from astro.config.mjs base` — P1.2
4. `feat(init): wire build-tokens + build-backlinks + build-og into keyless pipeline` — A2 + P1.3 + P1.4
5. `feat(init): write .init-dev.pid for orphan process cleanup on Windows` — A3
6. `fix(rehearsal): write temp answers file as BOM-less UTF-8 (PS 5.1 compat)` — P1.5

Parking: M2 (regex fragility — AST parser deferred), R2 (Pages activation), R3 (CRLF frontmatter), R9 (deploy.yml sync). All low-probability or require deeper investigation. Flag in P1 docstring as known limitations.

---

## P0 — Refactor prereq (commit 1/6 of P1 PR)

Before touching any behavior, extract three pure-ish functions from `scripts/init.ts`'s `main()` so P1's unit tests become possible. Follow Beck: "Make the change easy, then make the easy change."

### P0.1 — Extract `getDevSpawnOptions(platform: NodeJS.Platform): SpawnOptions`

Returns `{ detached, stdio }` tuple. No side effects. T1 unit test asserts both branches.

### P0.2 — Extract `parseAstroBase(configContent: string): string | null`

Regex-based (`/base:\s*['"]\/([^'"]+)['"]/`). Returns slug without leading/trailing slash, or `null` if not found. T2 unit test covers 4 cases (standard, double-quote, missing, template literal).

### P0.3 — Extract `runInit(opts: { skipSpawn?: boolean, vaultPath?: string, repoName?: string }): Promise<void>`

Wraps current `main()` body. `skipSpawn: true` returns before `spawn(bun run dev)`. Required for T3 e2e test to run without leaving background processes.

**Acceptance**: Three new test files green.
- `test/unit/init-spawn.test.ts` — covers P0.1 / T1
- `test/unit/init-base-url.test.ts` — covers P0.2 / T2
- Existing `test/e2e/init-smoke.test.ts` gets a new suite using P0.3 / T3

**Risk**: Pure extraction with zero behavior change. Existing `main()` remains callable as `runInit({})`.

---

## P1 — Critical (blocks rehearsal, commits 2-6/6 of P1 PR)

### P1.1 — init.ts dev server survives parent exit on Windows + spawn probe (FM1 mitigation)

**Problem**: `spawn("bun run dev", { detached: false })` + `process.exit(0)` on Windows kills the child via job object. Additionally, `stdio: "ignore"` would swallow spawn errors silently, so the operator sees "Open: http://..." and hits connection refused.

**Change** (`scripts/init.ts` via `getDevSpawnOptions` from P0.1):
- On `process.platform === "win32"`: `{ detached: true, stdio: "ignore" }` then `dev.unref()`.
- On non-Windows: `{ detached: false, stdio: "inherit" }`.
- **After spawn, probe `http://localhost:4321/<base>/` with a 2-second timeout using `net.connect` (fast port check, no HTTP parsing needed)**:
  - Success → print "Open: <url>".
  - Timeout/refused → print to stderr: `"[init] dev server not responding on port 4321 after 2s — check manually. PID: <pid>"`. Do NOT exit non-zero (dev may still be booting; don't false-alarm).

**Risk**: `stdio: "ignore"` on Windows means dev logs disappear. Acceptable for init — operator uses browser, not terminal logs. Probe gives early warning signal the operator otherwise wouldn't get.

### P1.2 — init.ts dynamic base URL in "Open" message

**Problem**: `init.ts:357` hardcodes `http://localhost:4321/meshblog/`. Breaks when `astro.config.mjs` base is patched.

**Change**:
- Use `parseAstroBase()` from P0.2 against `astro.config.mjs` contents.
- Print URL with the extracted base.
- Fall back to `/meshblog/` if parse fails, AND print to stderr: `"[init] Could not parse astro.config.mjs base — falling back to /meshblog/"` so drift is not silent (A6).

### P1.3 — init.ts pipeline: add build-tokens, build-backlinks, build-og

**Problem**: `init.ts:328-345` runs `build-index → export-graph → astro build` but skips three steps that matter in production:
- `build-tokens`: design.md → src/styles/tokens.css. Without this, fork compiles against whatever tokens.css last committed — stale CSS on fork deploys. (A2)
- `build-backlinks`: writes `public/graph/backlinks.json`. Without this, /graph Backlinks mode shows empty.
- `build-og`: writes `public/og/*.png`. Without this, OG meta tags 404.

**Change**: New pipeline order matches `package.json`'s `refresh` (which is the source of truth for correct local builds):
```
build-tokens → build-index → build-backlinks → export-graph → build-og → astro build
```

Empty-vault (fixture) branch already uses `bun run build:fixture` which includes `build-backlinks`; verify but no change expected.

### P1.4 — .init-dev.pid for orphan cleanup (A3)

**Problem**: Windows `detached: true` + `unref()` creates a truly orphaned dev server. User has no way to find its PID after init exits.

**Change** (after spawn, before exit):
```ts
fs.writeFileSync(path.join(REPO_ROOT, ".init-dev.pid"), String(dev.pid))
console.log(`[init] dev PID: ${dev.pid} — to stop: Stop-Process -Id (Get-Content .init-dev.pid)`)
```

Add `.init-dev.pid` to `.gitignore` if missing.

### P1.5 — rehearsal.ps1 writes UTF8 without BOM (PS 5.1 compat)

**Problem**: PS 5.1 (Windows 11 Home default) `Set-Content -Encoding UTF8` adds BOM. When written as temp answers file and piped to bun init, readline's first line contains `﻿` + vault path → `Test-Path` fails → init crashes.

**Change**: Use the `New-Object` syntax that works on both PS 5.1 and PS 7+:
```powershell
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllText($tmpAnswers, $initInput, $utf8NoBom)
```

**Do NOT use `[System.Text.UTF8Encoding]::new($false)`** — that is PS 7+ only syntax (`::new()` constructor call). PS 5.1 crashes on it (CQ1 from eng review).

---

## P2 — High UX (makes rehearsal approachable)

### P2.1 — `-VaultPath` becomes optional

**Problem**: Requiring Obsidian vault pre-flight blocks rehearsals on machines without Obsidian. Confirmed UX blocker (user hit it this session).

**Change** (`scripts/windows-rehearsal.ps1`):
- Remove `[Parameter(Mandatory = $true)]` from `$VaultPath`.
- Add `$VaultMode` tracking var: `"user-provided"` vs `"bundled-fixture"`.
- After Step 1 (clean fork), if `$VaultPath` is empty:
  - Set `$VaultPath = Join-Path $WorkDir "test\e2e\fixture-vault"`.
  - Set `$VaultMode = "bundled-fixture"`.
  - Print in yellow: `"[vault] Using bundled fixture-vault (30 adversarial test notes). Pass -VaultPath to test your own Obsidian vault."`
- Update banner line to show which vault is in use.
- In the report markdown, add a dedicated line: `- Vault mode: $VaultMode` (A1 explicit marker). The final verdict line gets a suffix if mode is bundled: `"(v1 acceptance evidence SEMI-SYNTHETIC — rerun with -VaultPath on a real Obsidian vault to complete)"`.
- Update `docs/windows-rehearsal.md` TL;DR: `-VaultPath` is optional.

**Tradeoff**: Without user vault, criterion #2 tests "30 fixture notes render" not "user's notes render". Acceptable as smoke — the 30-note corpus has more edge cases (unicode, drafts, images) than most real vaults. The SEMI-SYNTHETIC marker makes it explicit what was actually tested so v1 closure is honest (A1 from eng review).

---

## P3 — Doc consistency

### P3.1 — rehearsal.ps1 report path moves into clone

**Problem**: Report goes to `$PWD\docs\rehearsals\`. Operators running from `$HOME` (iwr download) find reports in `$HOME\docs\rehearsals\`, not inside the fork. Committing the report as v1 evidence requires manual copy.

**Change**: Unconditionally use `$reportDir = Join-Path $WorkDir "docs\rehearsals"` (CQ2 from eng review — no branching on `$PWD` vs `$WorkDir`; mental model is simpler: "report always lives in the fork"). Report ends up in the clone where `git add docs/rehearsals/*.md` works directly.

Also extract `$script:RepoShort = ($RepoName -split '/')[-1]` once after `$RepoName` is resolved, replace the 4+ inline computations (CQ3 DRY).

### P3.2 — docs/windows-rehearsal.md manual walkthrough uses placeholder URLs

**Problem**: Manual steps say `http://localhost:4321/meshblog/` but the actual URL depends on the fork's name. Operators scrolling the doc during a rehearsal see the wrong URL.

**Change**: Replace all `/meshblog/` URL literals in Steps 2-6 with `/<your-fork-name>/` placeholder. Add a one-line note at the top of the manual section: "The script shows the actual URL; these are placeholder instructions if you skip the script."

---

## P4 — Defense (reduce false failures in the field)

### P4.1 — gh auth scope check

**Problem**: `gh auth login` default scope omits `workflow`. Step 8's `gh workflow run` returns 403.

**Change** (Step 0 prereqs):
- After `gh auth status`, run `gh auth status --show-token` + check output for `workflow` in scope list.
- If missing, throw with message: `"gh is authed but missing 'workflow' scope. Run: gh auth refresh -s workflow"`.

### P4.2 — publish-verify waits for run to appear (A4 backoff)

**Problem**: `gh run list` may be empty for ~5-30s after `gh repo create --push`. publish-verify exits 3 immediately on empty list. REST caching can also serve stale empty responses.

**Change** (`scripts/publish-verify.ts`):
- After auto-detect returns no match AND `--commit` was not specified, retry with **exponential backoff**: 5s, 10s, 20s, 30s (total ~65s max). Fewer calls than fixed 5s × 12, avoids hammering.
- Each retry log line: `[publish-verify] run not visible yet, retry ${n}/4 in ${delay}s`.
- Only kicks in during fresh-fork rehearsals (existing meshblog main always has runs).

### P4.3 — Step 8 polls for auto-PR with idempotency filter (A5)

**Problem**: `gh workflow run` dispatches; visual prompt asks operator "did PR appear?" without sleep. Additionally, re-running the rehearsal on the same fork (e.g., via `-CleanupAfter` not being used) leaves previous "Daily audit report" PRs that would match a naive search.

**Change**:
- Capture `$dispatchTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")` **before** `gh workflow run`.
- Poll `gh pr list --repo $RepoName --search "Daily audit report created:>$dispatchTime" --json number,url,createdAt` every 15s for up to 3 minutes.
- On first match → PASS with PR URL in output.
- On timeout → FAIL with message pointing at `https://github.com/$RepoName/actions` for manual triage.

---

## P5 — Nice-to-haves

### P5.1 — `-Private` flag

**Change**: Add `[switch]$Private` param. When set, `gh repo create --private` instead of `--public`. GH Pages requires paid plan for private repos — so warn: "Private forks with GH Pages require GitHub Pro or Enterprise."

### P5.2 — `-CleanupAfter` flag

**Change**: Add `[switch]$CleanupAfter` param. When set, after report is written:
- Kill the dev server (find PID via `Get-Process -Name bun`, `Stop-Process`).
- `Remove-Item -Recurse -Force $WorkDir`.
- Prompt (not skip) before `gh repo delete $RepoName --yes` — destructive, confirm with operator.

### P5.3 — Dedupe `if ($SkipPush)` blocks

**Change**: One block handles both Step 7 and Step 8 skip logic. Cosmetic.

---

## Acceptance criteria

1. Rehearsal runs end-to-end on a clean Windows 11 Home VM with only `-VaultPath` omitted, produces `0 FAIL / 0 SKIP` report.
2. `bun run publish-verify -- --base-url https://<user>.github.io/<fork>/` exits 0 within 2 minutes of `gh repo create --push`.
3. `/graph` page shows populated Backlinks mode (at least 1 node) after rehearsal.
4. Report file lives at `$WorkDir\docs\rehearsals\YYYY-MM-DD-windows.md`, committable without manual copy. When `-VaultPath` omitted, report clearly shows `Vault mode: bundled-fixture` + SEMI-SYNTHETIC verdict suffix.
5. No regressions: existing `npx vitest run` still ≥298 passing; `bunx astro check` no new errors.
6. With `-CleanupAfter`, no leftover state (dev server killed via `.init-dev.pid`, work dir removed, fork repo optionally deleted).
7. New unit tests green: `test/unit/init-spawn.test.ts` (T1), `test/unit/init-base-url.test.ts` (T2), updated `test/e2e/init-smoke.test.ts` (T3).

## Verification plan

- **Unit (T1)**: `test/unit/init-spawn.test.ts` — mocks `process.platform`, asserts `getDevSpawnOptions()` returns `{detached:true, stdio:'ignore'}` on win32 and `{detached:false, stdio:'inherit'}` on linux/darwin.
- **Unit (T2)**: `test/unit/init-base-url.test.ts` — asserts `parseAstroBase()` extracts slug from standard, double-quote, and missing cases; returns null for template literal / env-based.
- **E2E (T3)**: `test/e2e/init-smoke.test.ts` gets new suite calling `runInit({skipSpawn:true, vaultPath: FIXTURE_VAULT})` in a tmpdir. Assertions: content/notes populated, `public/graph/backlinks.json` exists, `public/og/*.png` exists, `.init-dev.pid` NOT created (skipSpawn path).
- **Integration (WSL)**: Manual smoke — run rehearsal.ps1's PowerShell logic via `pwsh` on WSL with mocked `gh`. Catches regex and syntax regressions but not Windows-specific spawn behavior. Manual Windows run is still the gold test.
- **Manual (Windows 11 Home)**: After P1 merged + P2-P3 merged, one rehearsal pass with `-SkipPush`. If green, second pass without `-SkipPush` to exercise P4.

## Rollout order

1. **P1 PR** — 6 atomic commits (P0 refactor + P1.1 spawn+probe + P1.2 dynamic URL + P1.3 pipeline + P1.4 PID + P1.5 BOM). Must ship + merge first; unblocks everyone's Windows `/init`. New tests T1, T2, T3 land in this PR (one commit per sub-fix should include its test where applicable).
2. **P2 PR** — `-VaultPath` optional + SEMI-SYNTHETIC marker. Independent of P1 (different file).
3. **P3 PR** — Report path + docs URL placeholders + DRY `$RepoShort`. Smallest, ships alongside P2.
4. **P4 PR** — Optional. `publish-verify` backoff + gh-auth-scope + auto-PR polling with idempotency.
5. **P5 PR** — Nice-to-haves. `-Private` + `-CleanupAfter` + repo-name conflict handling + dedupe `if ($SkipPush)`.

## Known parked items (not this plan)

- **M2**: astro.config base patch is regex-dependent. Real fix is a structured config edit in init.ts (P1.2 partly addresses by teaching init to read base dynamically, but still doesn't write the config). Follow-up.
- **R2**: GH Pages auto-activation. Requires account testing; deferred.
- **R3**: CRLF-in-frontmatter. Need adversarial test case first; deferred.
- **R9**: `MINIMAL_DEPLOY_YML` drift from upstream. Add a CI check that asserts they match. Follow-up.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 6 arch + 4 code + 3 test gaps + 1 critical failure mode (FM1) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**ENG REVIEW — KEY FINDINGS**:
- A1: `-VaultPath` default silently weakens v1 acceptance #2 evidence → add banner + report marker
- A2: pipeline missing `build-tokens` → fork builds with stale CSS
- A3: Windows orphan dev server has no PID tracking → add `.init-dev.pid`
- CQ1 **CRITICAL**: `[System.Text.UTF8Encoding]::new($false)` is PS 7+ syntax — crashes on PS 5.1 (Windows 11 Home default). Use `New-Object System.Text.UTF8Encoding -ArgumentList $false`.
- T1, T2, T3: no unit tests for spawn platform branch, base URL parsing, backlinks emission
- **FM1 CRITICAL GAP**: `stdio:'ignore'` + `unref()` → dev spawn failures are silent, user sees "Open: http://..." with connection refused. Need HTTP probe after spawn before printing URL.
- Refactor prereq: extract `getDevSpawnOptions()`, `parseAstroBase()`, `runInit({skipSpawn})` so T1/T2 become testable

**VERDICT**: LGTM WITH REQUIRED CHANGES — plan must add P0 (refactor), FM1 mitigation, PS 5.1 compat fix, and T1/T2 unit tests before P1 implementation. P2-P5 can proceed as-written.
