<#
.SYNOPSIS
  meshblog Windows 11 fork-from-zero rehearsal (v1 acceptance criteria #1-#7).

.DESCRIPTION
  Semi-automated orchestrator for the manual checklist in docs/windows-rehearsal.md.
  Automates the mechanical steps (prereq check, clean fork, scripted /init, push,
  publish-verify, daily-audit trigger). Stops for visual confirmation at the
  browser-dependent steps (wikilink anchor, graph mode toggle, etc.) so the
  rehearsal still tests the human UX it was designed to test — completing the
  script without eyeballing the live page defeats the purpose.

  Writes a timestamped pass/fail report to docs/rehearsals/.

.PARAMETER VaultPath
  Absolute path to your Obsidian vault. Optional — if omitted, the rehearsal
  uses the bundled test/e2e/fixture-vault/ (30 adversarial notes with
  wikilinks, drafts, images, unicode) and marks the report SEMI-SYNTHETIC.
  Pass a real vault path to complete v1 acceptance evidence.

.PARAMETER RepoName
  GitHub repo name (owner/name) for the test fork. Will be created with
  gh repo create. Default: <user>/meshblog-rehearsal-YYYYMMDD.

.PARAMETER WorkDir
  Where to clone the fork. Default: $HOME\meshblog-rehearsal.

.PARAMETER SkipPush
  Skip criteria #6 (push + publish-verify) and #7 (daily audit). Use when you
  do not want to leave a dead fork repo on GitHub. Criteria #6 + #7 will be
  marked SKIPPED in the report.

.PARAMETER Private
  Create the fork repo as private instead of public. Requires GitHub Pro or
  Enterprise for GH Pages to work on a private repo — without it, Step 7's
  deploy will succeed on GitHub but the live URL stays 404 and publish-verify
  fails. Prints a warning before creating.

.EXAMPLE
  # Clone this script from main and run it in one line. No Obsidian needed
  # — uses the bundled fixture-vault.
  iwr https://raw.githubusercontent.com/JaeyeonBang/meshblog/main/scripts/windows-rehearsal.ps1 -OutFile rehearsal.ps1
  .\rehearsal.ps1

.EXAMPLE
  # Test against your real Obsidian vault for full v1 acceptance evidence.
  .\rehearsal.ps1 -VaultPath "C:\Users\me\Documents\ObsidianVault"

.EXAMPLE
  # Already cloned the repo and want to run from inside it
  .\scripts\windows-rehearsal.ps1 -VaultPath "C:\path\to\vault" -SkipPush
#>

[CmdletBinding()]
param(
  [string]$VaultPath = "",

  [string]$RepoName = "",

  [string]$WorkDir = (Join-Path $HOME "meshblog-rehearsal"),

  [switch]$SkipPush,

  [switch]$Private
)

$ErrorActionPreference = "Stop"
$script:Results = @()

function Step {
  param(
    [string]$Id,
    [string]$Title,
    [scriptblock]$Auto = {},
    [string]$VisualPrompt = ""
  )
  Write-Host ""
  Write-Host "═══ $Id — $Title ═══" -ForegroundColor Cyan
  $status = "PASS"
  $note = ""
  try {
    & $Auto
  } catch {
    $status = "FAIL"
    $note = $_.Exception.Message
    Write-Host "  FAIL: $note" -ForegroundColor Red
  }
  if ($status -eq "PASS" -and $VisualPrompt) {
    Write-Host ""
    Write-Host "  [ VISUAL CHECK ] $VisualPrompt" -ForegroundColor Yellow
    $answer = Read-Host "  Did you see the expected result? [y/N]"
    if ($answer -notmatch '^[yY]') {
      $status = "FAIL"
      $note = "visual check rejected by operator"
    }
  }
  $color = if ($status -eq "PASS") { "Green" } else { "Red" }
  Write-Host "  → $status" -ForegroundColor $color
  $script:Results += [pscustomobject]@{
    Id     = $Id
    Title  = $Title
    Status = $status
    Note   = $note
    Time   = (Get-Date).ToString("HH:mm:ss")
  }
}

function Require-Command {
  param([string]$Name, [string]$InstallHint)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name not found. Install: $InstallHint"
  }
}

# ── Vault resolution ─────────────────────────────────────────────────────────
# $VaultMode distinguishes what the rehearsal actually tested when we write
# the report. Bundled fixture = v1 acceptance #2 evidence is SEMI-SYNTHETIC;
# user-provided vault = full acceptance. Resolved after Step 1 because the
# fixture-vault only exists inside the cloned fork.
$script:VaultMode = if ($VaultPath) { "user-provided" } else { "bundled-fixture" }

# ── Banner ───────────────────────────────────────────────────────────────────
Write-Host "meshblog Windows fork-from-zero rehearsal" -ForegroundColor Magenta
if ($script:VaultMode -eq "bundled-fixture") {
  Write-Host "Vault:   (bundled fixture-vault — 30 adversarial test notes)" -ForegroundColor Yellow
  Write-Host "         Pass -VaultPath to test your real Obsidian vault instead." -ForegroundColor Yellow
} else {
  Write-Host "Vault:   $VaultPath (user-provided)"
}
Write-Host "WorkDir: $WorkDir"
Write-Host ""

# When a vault path is provided, verify it exists up front. Bundled-fixture
# resolution happens after Step 1 (the fixture lives inside the clone).
if ($script:VaultMode -eq "user-provided" -and -not (Test-Path $VaultPath)) {
  Write-Host "Vault path does not exist: $VaultPath" -ForegroundColor Red
  exit 1
}

# ── Step 0: prereqs ──────────────────────────────────────────────────────────
Step -Id "0" -Title "prereqs" -Auto {
  Require-Command git "https://git-scm.com/download/win"
  Require-Command node "https://nodejs.org/ (v22+)"
  Require-Command bun "irm bun.sh/install.ps1 | iex"
  Require-Command gh "winget install --id GitHub.cli"

  $ghStatus = gh auth status 2>&1
  if ($LASTEXITCODE -ne 0) { throw "gh not authenticated. Run: gh auth login" }

  # Default `gh auth login` OAuth scope omits `workflow`. Step 8 calls
  # `gh workflow run daily-audit.yml` which requires that scope, so check
  # here and fail fast with the refresh command instead of silently failing
  # 5 steps later with an opaque 403.
  if (-not $SkipPush) {
    $scopeText = $ghStatus -join "`n"
    if ($scopeText -notmatch '\bworkflow\b') {
      throw "gh is authed but missing 'workflow' scope (needed for Step 8 daily-audit dispatch). Run: gh auth refresh -s workflow"
    }
  }

  Write-Host "  all tools present; gh authed with required scopes."
}

if (-not $RepoName) {
  $ghUser = (gh api user --jq .login).Trim()
  $today = (Get-Date).ToString("yyyyMMdd")
  $RepoName = "$ghUser/meshblog-rehearsal-$today"
}
# Compute once; reused by Step 1 (astro.config patch), Step 2 visual prompt,
# Step 5 (draft leak curl), Step 6 visual prompt, Step 7 (publish-verify URL).
$script:RepoShort = ($RepoName -split '/')[-1]
Write-Host "Repo:    $RepoName"

# ── Step 1: clean fork ───────────────────────────────────────────────────────
# degit does NOT create a .git/ (that's its whole point vs git clone). We
# initialize an empty git history with a single commit so step 7's
# `gh repo create --source . --push` has something to push. Inline identity
# so we don't depend on the operator's global git config.
Step -Id "1" -Title "clean fork (criterion #1 — install)" -Auto {
  if (Test-Path $WorkDir) { Remove-Item -Recurse -Force $WorkDir }
  New-Item -ItemType Directory -Path $WorkDir | Out-Null
  Push-Location $WorkDir
  try {
    npx -y degit JaeyeonBang/meshblog . 2>&1 | Out-Null
    git init -b main 2>&1 | Out-Null
    git -c user.name="rehearsal" -c user.email="rehearsal@example.com" `
      -c commit.gpgsign=false add . 2>&1 | Out-Null
    git -c user.name="rehearsal" -c user.email="rehearsal@example.com" `
      -c commit.gpgsign=false commit -m "init from degit" --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "git init+commit failed after degit" }

    # Rehearsal-only: patch astro.config.mjs's base path so the fork (whose
    # repo name won't be 'meshblog') deploys to the correct Pages subpath.
    # meshblog init doesn't do this yet — tracked as a follow-up.
    $repoShort = $script:RepoShort
    $configPath = Join-Path $WorkDir "astro.config.mjs"
    if (Test-Path $configPath) {
      $c = Get-Content $configPath -Raw
      $patched = $c -replace "base:\s*['""]/meshblog['""]", "base: '/$repoShort'"
      if ($patched -ne $c) {
        Set-Content -Path $configPath -Value $patched -Encoding UTF8 -NoNewline
        Write-Host "  patched astro.config.mjs base to /$repoShort"
      }
    }

    bun install 2>&1 | Tee-Object -Variable installOut | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "bun install failed" }
    Write-Host "  cloned + git init + dependencies installed."
  } finally {
    Pop-Location
  }
}

# Resolve bundled-fixture path now that the clone exists. Defer from pre-Step-1
# because the fixture-vault is bundled inside the repo, not on the operator's
# filesystem until after degit runs.
if ($script:VaultMode -eq "bundled-fixture") {
  $VaultPath = Join-Path $WorkDir "test\e2e\fixture-vault"
  if (-not (Test-Path $VaultPath)) {
    Write-Host "Bundled fixture-vault not found at: $VaultPath" -ForegroundColor Red
    Write-Host "The fork may be corrupted or upstream drifted. Pass -VaultPath explicitly." -ForegroundColor Red
    exit 1
  }
  Write-Host "  Resolved bundled vault: $VaultPath" -ForegroundColor Yellow
}

# ── Step 2: /init with scripted input (criterion #1) ─────────────────────────
# The init script prompts for vault path then repo name. Pipe both answers
# via stdin. The `exit 0` on the dev spawn is unreachable because spawn is
# non-blocking; init exits after printing the URL.
Step -Id "2" -Title "/init two-prompt flow (criterion #1)" -Auto {
  Push-Location $WorkDir
  try {
    # Scripted stdin: vault path + repo name (short name, not owner/name)
    $repoShort = $script:RepoShort
    $initInput = "$VaultPath`n$repoShort`n"
    # Write to temp file and pipe — PowerShell's here-string + `cmd /c` is
    # fragile with unicode paths; a temp file is robust.
    #
    # PS 5.1 default (Windows 11 Home): `Set-Content -Encoding UTF8` writes a
    # BOM. When cmd redirects the file to bun init's stdin, readline reads
    # the BOM bytes as part of the first line: `"﻿C:\vault\path"`. That
    # path does not exist → init crashes. Write BOM-less UTF-8 via .NET
    # directly. `New-Object` syntax works on both PS 5.1 and PS 7+;
    # `[UTF8Encoding]::new($false)` is PS 7+ only and crashes on 5.1.
    $tmpAnswers = [System.IO.Path]::GetTempFileName()
    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($tmpAnswers, $initInput, $utf8NoBom)
    cmd /c "bun run init < `"$tmpAnswers`"" 2>&1 | Tee-Object -Variable initOut | Out-Null
    Remove-Item $tmpAnswers -Force
    if ($LASTEXITCODE -ne 0) { throw "bun run init exited $LASTEXITCODE" }
    if (-not ($initOut -match "Copied vault contents")) {
      throw "init did not print the expected 'Copied vault contents' line"
    }
    Write-Host "  init completed; content/notes/ materialized."
    Write-Host "  waiting 4s for the spawned dev server to become HTTP-responsive…"
    Start-Sleep -Seconds 4
  } finally {
    Pop-Location
  }
} -VisualPrompt "Open http://localhost:4321/${script:RepoShort}/ in your browser. Do your real vault notes render (not the fixture seed)?"

# ── Step 3: keyless real-vault render (criterion #2) ─────────────────────────
# Covered by the visual prompt on Step 2 (same URL). Assert via content sniff.
Step -Id "3" -Title "content/notes populated with real vault (criterion #2)" -Auto {
  $notesDir = Join-Path $WorkDir "content\notes"
  if (-not (Test-Path $notesDir)) { throw "content/notes/ does not exist" }
  $mdCount = (Get-ChildItem -Path $notesDir -Filter "*.md" -Recurse -File).Count
  if ($mdCount -lt 1) { throw "content/notes/ has 0 markdown files" }
  Write-Host "  content/notes/ has $mdCount markdown files."
}

# ── Step 4: wikilink anchor rendering (criterion #3) — visual only ───────────
Step -Id "4" -Title "wikilink → <a href> (criterion #3)" `
  -VisualPrompt "Open any note with [[link|alias]] syntax. F12 inspect. Is the alias text wrapped in an <a href='...'> — not plain text?"

# ── Step 5: draft exclusion (criterion #4) ───────────────────────────────────
Step -Id "5" -Title "draft:true absent from landing page (criterion #4)" -Auto {
  Push-Location $WorkDir
  try {
    # Find one draft slug from content/notes/ if any exist
    $drafts = Get-ChildItem -Path "content\notes" -Filter "*.md" -Recurse -File | ForEach-Object {
      $head = Get-Content $_.FullName -TotalCount 10 -ErrorAction SilentlyContinue
      if ($head -match "^draft:\s*true") { $_ }
    }
    if (-not $drafts) {
      Write-Host "  no draft:true notes in vault; skipping landing-page leak check."
      return
    }
    $draftSlug = $drafts[0].BaseName
    $repoShort = $script:RepoShort
    $landing = (curl.exe -s "http://localhost:4321/$repoShort/")
    if ($landing -match [regex]::Escape($draftSlug)) {
      throw "draft slug '$draftSlug' LEAKED to landing page"
    }
    Write-Host "  draft '$draftSlug' correctly excluded from landing."
    # Bonus: audit-drafts on the local build
    $auditOut = bun run audit-drafts 2>&1
    Write-Host "  audit-drafts output: $(($auditOut | Select-Object -Last 1))"
  } finally {
    Pop-Location
  }
}

# ── Step 6: backlinks mode toggle (criterion #5) — visual only ───────────────
Step -Id "6" -Title "/graph exposes Backlinks mode (criterion #5)" `
  -VisualPrompt "Open http://localhost:4321/${script:RepoShort}/graph/. Do you see three mode buttons: Notes, Concepts, Backlinks?"

# ── Step 7: push → live (criterion #6) ───────────────────────────────────────
if ($SkipPush) {
  $script:Results += [pscustomobject]@{
    Id = "7"; Title = "push → live 200 (criterion #6)";
    Status = "SKIP"; Note = "-SkipPush flag set"; Time = (Get-Date).ToString("HH:mm:ss")
  }
  Write-Host ""
  Write-Host "═══ 7 — push → live 200 (SKIPPED per -SkipPush) ═══" -ForegroundColor DarkYellow
} else {
  Step -Id "7" -Title "push → GH Pages → live 200 (criterion #6)" -Auto {
    Push-Location $WorkDir
    try {
      $visibility = if ($Private) { "--private" } else { "--public" }
      if ($Private) {
        Write-Host "  WARNING: -Private requires GitHub Pro/Enterprise for GH Pages to work." -ForegroundColor Yellow
      }
      gh repo create $RepoName $visibility --source . --push 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "gh repo create failed" }
      Write-Host "  repo created + pushed. Running publish-verify…"
      # publish-verify's default base URL points at the upstream meshblog;
      # override so the verifier actually checks the fork's Pages URL, not
      # our original site. Keeps this rehearsal honest.
      $forkUser = ($RepoName -split '/')[0]
      $repoShort = $script:RepoShort
      $forkUrl = "https://$forkUser.github.io/$repoShort/"
      bun run publish-verify -- --base-url $forkUrl 2>&1 | Tee-Object -Variable publishOut | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "publish-verify exited $LASTEXITCODE" }
      Write-Host "  live site verified at $forkUrl"
    } finally {
      Pop-Location
    }
  }
}

# ── Step 8: daily audit trigger (criterion #7) ───────────────────────────────
if ($SkipPush) {
  $script:Results += [pscustomobject]@{
    Id = "8"; Title = "daily audit manual trigger (criterion #7)";
    Status = "SKIP"; Note = "depends on step 7"; Time = (Get-Date).ToString("HH:mm:ss")
  }
  Write-Host "═══ 8 — daily audit (SKIPPED, depends on step 7) ═══" -ForegroundColor DarkYellow
} else {
  # Poll for the auto-PR instead of asking the operator to wait 2 minutes
  # and answer yes/no. Idempotency: capture $dispatchTime before the
  # workflow run and filter by `created:>$dispatchTime`, so a re-run against
  # a fork that already has stale "Daily audit report" PRs from a previous
  # rehearsal doesn't produce a false PASS.
  Step -Id "8" -Title "daily audit manual trigger (criterion #7)" -Auto {
    Push-Location $WorkDir
    try {
      $dispatchTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
      gh workflow run daily-audit.yml --repo $RepoName 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "workflow dispatch failed" }
      Write-Host "  workflow dispatched at $dispatchTime. Polling for auto-PR…"

      $query = "Daily audit report in:title created:>$dispatchTime"
      $deadline = (Get-Date).AddMinutes(3)
      $prUrl = $null
      while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 15
        $prs = gh pr list --repo $RepoName --search $query --json number,url,createdAt 2>$null
        if ($LASTEXITCODE -eq 0 -and $prs -and $prs -ne "[]") {
          $parsed = $prs | ConvertFrom-Json
          if ($parsed.Count -gt 0) {
            $prUrl = $parsed[0].url
            break
          }
        }
        $elapsed = [int]((Get-Date) - (Get-Date $dispatchTime)).TotalSeconds
        Write-Host "    still waiting (${elapsed}s elapsed)…"
      }

      if ($prUrl) {
        Write-Host "  auto-PR detected: $prUrl" -ForegroundColor Green
      } else {
        throw "no 'Daily audit report' PR appeared within 3 minutes. Check https://github.com/$RepoName/actions for the workflow run log."
      }
    } finally {
      Pop-Location
    }
  }
}

# ── Report ──────────────────────────────────────────────────────────────────
# Always write inside the clone. Operators running via `iwr ... -OutFile`
# from $HOME would otherwise find the report at $HOME\docs\rehearsals\ and
# have to copy it into the fork to commit it. Using $WorkDir everywhere
# keeps the mental model simple: "the report lives with the fork".
$date = (Get-Date).ToString("yyyy-MM-dd")
$reportDir = Join-Path $WorkDir "docs\rehearsals"
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir | Out-Null }
$reportPath = Join-Path $reportDir "$date-windows.md"

$passCount = ($script:Results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($script:Results | Where-Object { $_.Status -eq "FAIL" }).Count
$skipCount = ($script:Results | Where-Object { $_.Status -eq "SKIP" }).Count
$total = $script:Results.Count

$lines = @()
$lines += "# Windows rehearsal — $date"
$lines += ""
$lines += "- Operator:   $env:USERNAME"
$lines += "- OS:         $((Get-CimInstance Win32_OperatingSystem).Caption)"
$lines += "- Vault:      ``$VaultPath``"
$lines += "- Vault mode: $script:VaultMode"
$lines += "- Repo:       ``$RepoName``"
$lines += "- Summary:    $passCount PASS / $failCount FAIL / $skipCount SKIP ($total total)"
$lines += ""
$lines += "| # | Title | Status | Time | Note |"
$lines += "|---|---|---|---|---|"
foreach ($r in $script:Results) {
  $lines += "| $($r.Id) | $($r.Title) | $($r.Status) | $($r.Time) | $($r.Note) |"
}
$lines += ""

# Verdict line: distinguish a full acceptance run (user-provided vault) from
# a smoke run (bundled fixture). The SEMI-SYNTHETIC suffix is load-bearing —
# v1 closure requires at least one rerun with a real Obsidian vault.
$syntheticNote = if ($script:VaultMode -eq "bundled-fixture") {
  " (v1 acceptance evidence SEMI-SYNTHETIC — rerun with -VaultPath on a real Obsidian vault to complete)"
} else { "" }
if ($failCount -eq 0 -and $skipCount -eq 0) {
  $lines += "**v1 acceptance complete.** All 7 criteria verified on Windows 11 Home.$syntheticNote"
} elseif ($failCount -eq 0) {
  $lines += "Partial pass. $skipCount step(s) skipped — rerun without ``-SkipPush`` to cover #6 + #7.$syntheticNote"
} else {
  $lines += "**v1 acceptance BLOCKED.** $failCount step(s) failed. See CLAUDE.md Active Risks + docs/windows-rehearsal.md 'If something fails' for triage."
}

Set-Content -Path $reportPath -Value $lines -Encoding UTF8
Write-Host ""
Write-Host "Report written: $reportPath" -ForegroundColor Green

if ($failCount -gt 0) { exit 1 }
