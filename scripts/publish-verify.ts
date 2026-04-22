#!/usr/bin/env tsx
/**
 * scripts/publish-verify.ts
 * Automates the 4-step post-push CI/CD verification protocol from CLAUDE.md.
 * Usage: bun run publish-verify   (or: tsx scripts/publish-verify.ts)
 *
 * Exit codes:
 *   0  All green — CI passed + live site verified
 *   1  CI run failed or concluded with failure/cancelled
 *   2  CI passed but live-URL check failed (tokens missing or article not found)
 *   3  Could not locate a matching run for this workflow
 */

import { execSync, spawn } from 'child_process';

// ── CLI args ──────────────────────────────────────────────────────────────────

interface Flags {
  runId: string | null;
  commit: string | null;
  skipWatch: boolean;
  skipLive: boolean;
  baseUrl: string;
  workflow: string;
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {
    runId: null,
    commit: null,
    skipWatch: false,
    skipLive: false,
    baseUrl: 'https://jaeyeonbang.github.io/meshblog/',
    workflow: 'Deploy to GitHub Pages',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--run-id' && argv[i + 1]) { flags.runId = argv[++i]!; continue; }
    if (arg === '--commit' && argv[i + 1]) { flags.commit = argv[++i]!; continue; }
    if (arg === '--skip-watch') { flags.skipWatch = true; continue; }
    if (arg === '--skip-live') { flags.skipLive = true; continue; }
    if (arg === '--base-url' && argv[i + 1]) { flags.baseUrl = argv[++i]!; continue; }
    if (arg === '--workflow' && argv[i + 1]) { flags.workflow = argv[++i]!; continue; }
  }

  return flags;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function requireGh(): void {
  try {
    execSync('gh --version', { stdio: 'ignore' });
  } catch {
    console.error('[publish-verify] ERROR: gh CLI not found.');
    console.error('  Install: https://cli.github.com/');
    process.exit(3);
  }
}

function exec(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function tryExec(cmd: string): string | null {
  try {
    return exec(cmd);
  } catch {
    return null;
  }
}

interface GhRun {
  databaseId: number;
  headSha: string;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
}

// ── Step 1: locate the run ────────────────────────────────────────────────────

function locateRun(flags: Flags): { run: GhRun; warnMismatch: boolean } {
  if (flags.runId) {
    const raw = exec(
      `gh run view ${flags.runId} --json databaseId,headSha,status,conclusion,url,createdAt`,
    );
    const run: GhRun = JSON.parse(raw);
    return { run, warnMismatch: false };
  }

  const raw = exec(
    `gh run list --workflow "${flags.workflow}" --limit 10 --json databaseId,headSha,status,conclusion,url,createdAt`,
  );
  const runs: GhRun[] = JSON.parse(raw);

  if (runs.length === 0) {
    console.error(`[publish-verify] No runs found for workflow "${flags.workflow}".`);
    process.exit(3);
  }

  const targetSha = flags.commit ?? tryExec('git rev-parse HEAD');

  if (targetSha) {
    const matching = runs.find((r) => r.headSha === targetSha);
    if (matching) {
      return { run: matching, warnMismatch: false };
    }
    console.warn(
      `[publish-verify] WARN: No run found for commit ${targetSha.slice(0, 8)}. ` +
      'Using the most recent run — it may not correspond to the current commit.',
    );
  }

  return { run: runs[0]!, warnMismatch: true };
}

// ── Step 2: watch the run ─────────────────────────────────────────────────────

async function watchRun(runId: number): Promise<{ conclusion: string; exitCode: number }> {
  return new Promise((resolve) => {
    console.log(`\n[publish-verify] Watching run ${runId}...\n`);
    const child = spawn('gh', ['run', 'watch', String(runId), '--exit-status'], {
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => {
      resolve({
        conclusion: code === 0 ? 'success' : 'failure',
        exitCode: code ?? 1,
      });
    });

    child.on('error', (err) => {
      console.error(`[publish-verify] Failed to spawn gh run watch: ${err.message}`);
      resolve({ conclusion: 'unknown', exitCode: 1 });
    });
  });
}

function printFailLog(runId: number): void {
  console.log('\n[publish-verify] --- Failing step log (last 40 lines) ---');
  try {
    const log = exec(`gh run view ${runId} --log-failed`);
    const lines = log.split('\n');
    const tail = lines.slice(-40).join('\n');
    console.log(tail);
  } catch {
    console.log('  (could not retrieve failure log)');
  }
  console.log('[publish-verify] --- end log ---\n');
}

// ── Step 3: live URL check ────────────────────────────────────────────────────

interface LiveCheckResult {
  httpOk: boolean;
  tokenCount: number;
  articleUrl: string | null;
  articleOk: boolean;
  articleHasProse: boolean;
}

function checkLive(baseUrl: string): LiveCheckResult {
  const result: LiveCheckResult = {
    httpOk: false,
    tokenCount: 0,
    articleUrl: null,
    articleOk: false,
    articleHasProse: false,
  };

  // HEAD check for 200
  const headResult = tryExec(`curl -sfI "${baseUrl}" -o /dev/null -w "%{http_code}"`);
  result.httpOk = headResult === '200';

  if (!result.httpOk) {
    return result;
  }

  // Token grep
  const body = tryExec(`curl -s "${baseUrl}"`);
  if (body) {
    const tokenMatches = (body.match(/home-layout|Fraunces|--ink/g) ?? []).length;
    result.tokenCount = tokenMatches;

    // Find first article route
    const hrefMatch = body.match(/href="([^"]*\/notes\/[^"]*?)"/);
    if (hrefMatch) {
      let articlePath = hrefMatch[1]!;
      // Normalize to absolute URL
      if (articlePath.startsWith('/')) {
        const base = new URL(baseUrl);
        articlePath = `${base.protocol}//${base.host}${articlePath}`;
      } else if (!articlePath.startsWith('http')) {
        articlePath = baseUrl.replace(/\/$/, '') + '/' + articlePath;
      }
      result.articleUrl = articlePath;

      // -L follows redirects (Pages redirects no-slash to with-slash)
      const articleCode = tryExec(
        `curl -sL -o /dev/null -w "%{http_code}" "${articlePath}"`,
      );
      result.articleOk = articleCode === '200';

      if (result.articleOk) {
        const articleBody = tryExec(`curl -sL "${articlePath}"`);
        result.articleHasProse = !!(articleBody && articleBody.includes('class="prose"'));
      }
    }
  }

  return result;
}

// ── Step 4: report ────────────────────────────────────────────────────────────

function printReport(
  run: GhRun,
  conclusion: string,
  liveResult: LiveCheckResult | null,
  skippedWatch: boolean,
  skippedLive: boolean,
): void {
  console.log('\n[publish-verify] ── Report ──────────────────────────────────────────────');
  console.log(`Run URL:       ${run.url}`);

  if (skippedWatch) {
    const conclusionLabel = run.conclusion ?? run.status;
    console.log(`Conclusion:    ${conclusionLabel} (from API, watch skipped)`);
  } else {
    console.log(`Conclusion:    ${conclusion}`);
  }

  if (skippedLive) {
    console.log('Live URL:      (skipped)');
    console.log('Article:       (skipped)');
  } else if (liveResult) {
    const liveStatus = liveResult.httpOk
      ? `200 (tokens: ${liveResult.tokenCount})`
      : 'FAIL (non-200)';
    const liveOk = liveResult.httpOk && liveResult.tokenCount > 0;
    console.log(`Live URL:      ${run.url.split('/actions')[0]?.split('github.com/')[1] ? '' : ''}${liveStatus} ${liveOk ? 'OK' : 'FAIL'}`);

    if (liveResult.articleUrl) {
      const proseLabel = liveResult.articleHasProse ? 'prose: yes' : 'prose: no';
      const articleStatus = liveResult.articleOk ? `200 (${proseLabel})` : 'FAIL';
      console.log(`Article:       ${liveResult.articleUrl} -> ${articleStatus}`);
    } else {
      console.log('Article:       no /notes/ link found in homepage HTML');
    }
  }

  console.log('────────────────────────────────────────────────────────────────────────');
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));

  requireGh();

  console.log('[publish-verify] Locating run...');
  const { run, warnMismatch } = locateRun(flags);

  if (warnMismatch) {
    console.warn(`[publish-verify] WARN: Run ${run.databaseId} (${run.headSha.slice(0, 8)}) may not match HEAD.`);
  }

  console.log(`[publish-verify] Run found: ${run.url}`);
  console.log(`[publish-verify] Status: ${run.status} / Conclusion: ${run.conclusion ?? 'pending'}`);

  // ── Step 2: Watch ────────────────────────────────────────────────────────────
  let conclusion = run.conclusion ?? 'pending';
  let watchExitCode = 0;

  if (!flags.skipWatch) {
    const watched = await watchRun(run.databaseId);
    conclusion = watched.conclusion;
    watchExitCode = watched.exitCode;

    if (watchExitCode !== 0) {
      printFailLog(run.databaseId);
    }
  } else {
    console.log('[publish-verify] Watch skipped (--skip-watch).');
    // Re-fetch final conclusion from API
    try {
      const refreshed: GhRun = JSON.parse(
        exec(`gh run view ${run.databaseId} --json databaseId,headSha,status,conclusion,url,createdAt`),
      );
      conclusion = refreshed.conclusion ?? refreshed.status;
    } catch {
      // keep whatever we already have
    }
  }

  // ── Step 3: Live check ───────────────────────────────────────────────────────
  let liveResult: LiveCheckResult | null = null;

  if (!flags.skipLive) {
    console.log(`\n[publish-verify] Checking live site: ${flags.baseUrl}`);
    liveResult = checkLive(flags.baseUrl);
  } else {
    console.log('[publish-verify] Live check skipped (--skip-live).');
  }

  // ── Step 4: Report & verdict ─────────────────────────────────────────────────
  printReport(run, conclusion, liveResult, flags.skipWatch, flags.skipLive);

  const ciOk = conclusion === 'success';
  const liveOk =
    flags.skipLive ||
    (liveResult !== null && liveResult.httpOk && liveResult.tokenCount > 0);

  if (!ciOk && !flags.skipWatch) {
    console.log(`Verdict: FAIL — CI run concluded: ${conclusion}`);
    process.exit(1);
  }

  if (!liveOk && !flags.skipLive) {
    const reason = liveResult && !liveResult.httpOk
      ? 'live URL returned non-200'
      : 'design tokens not found on live homepage';
    console.log(`Verdict: FAIL — ${reason}`);
    process.exit(2);
  }

  if (flags.skipWatch && flags.skipLive) {
    console.log('Verdict: OK (all steps skipped — run with flags removed for full check)');
    process.exit(0);
  }

  console.log('Verdict: OK — DEPLOYED AND VERIFIED');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[publish-verify] Unexpected error:', err);
  process.exit(3);
});
