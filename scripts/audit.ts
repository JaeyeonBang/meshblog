#!/usr/bin/env tsx
/**
 * scripts/audit.ts
 * Deterministic editorial invariant gate for meshblog.
 * Runs 6 grep-based checks against src/. Exits non-zero on FAIL.
 * Usage: bun run audit   (or: tsx scripts/audit.ts)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

// On Windows, `new URL(...).pathname` returns `/C:/foo` — joining that with
// `'src'` produces `C:\C:\foo\src`. fileURLToPath strips the leading slash
// and normalises separators, matching the pattern already used elsewhere
// in the codebase (e.g. src/pages/notes/[slug].astro).
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

// ── helpers ──────────────────────────────────────────────────────────────────

function glob(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  function walk(d: string): void {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (exts.some((e) => entry.endsWith(e))) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(
  files: string[],
  re: RegExp,
  exclude?: (path: string, match: string) => boolean,
): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((raw, idx) => {
      const m = raw.match(re);
      if (!m) return;
      if (exclude && exclude(file, m[0])) return;
      hits.push({ file: relative(ROOT, file), line: idx + 1, text: raw.trim() });
    });
  }
  return hits;
}

type Status = 'PASS' | 'FAIL' | 'WARN';

interface CheckResult {
  label: string;
  status: Status;
  hits: Hit[];
  note?: string;
}

function printResult(idx: number, r: CheckResult): void {
  const badge =
    r.status === 'PASS'
      ? 'PASS'
      : r.status === 'FAIL'
        ? 'FAIL'
        : `WARN (${r.hits.length} hit${r.hits.length !== 1 ? 's' : ''} — verify)`;

  const arrow = r.status === 'PASS' ? '→ PASS' : `→ ${badge}`;
  console.log(`[${idx}] ${r.label.padEnd(44)} ${arrow}`);

  for (const h of r.hits) {
    console.log(`    ${h.file}:${h.line}  ${h.text}`);
  }
  if (r.note) {
    console.log(`    note: ${r.note}`);
  }
}

// ── checks ───────────────────────────────────────────────────────────────────

/** Check 1: hex literals outside tokens.css and fonts.css */
function checkHexLiterals(): CheckResult {
  const exts = ['.astro', '.ts', '.tsx', '.css', '.module.css'];
  const files = glob(SRC, exts).filter(
    (f) =>
      !f.endsWith('tokens.css') &&
      !f.endsWith('fonts.css'),
  );

  // Matches #RGB / #RGBA / #RRGGBB / #RRGGBBAA
  // Excludes: url(#...) SVG refs, #! shebangs, and CSS id-selectors (#foo {)
  const HEX_RE = /#([0-9a-fA-F]{3,8})\b/;

  const hits = scan(files, HEX_RE, (_path, match) => {
    // Keep only if the match looks like a color literal (3/4/6/8 hex digits)
    // Exclude if preceded by url( — handled by checking the full line
    return false; // we filter in the line-level exclude below
  });

  // Re-run with line-level filtering
  const filtered: Hit[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((raw, idx) => {
      // Skip lines where the hash is part of url(#...) SVG refs
      // Skip CSS selector-only lines like "#foo {" or "#foo,"
      // Skip shebangs
      const stripped = raw.replace(/url\(#[^)]*\)/g, '');
      const m = stripped.match(/#[0-9a-fA-F]{3,8}\b/);
      if (!m) return;
      // Confirm the matched portion length is 3, 4, 6, or 8 hex digits
      const hex = m[0].slice(1);
      if (![3, 4, 6, 8].includes(hex.length)) return;
      // Skip pure CSS id selectors: line is just "  #foo {" with no property-like content
      if (/^\s*#[0-9a-fA-F]{3,8}\b\s*[{,]/.test(raw)) return;
      // Skip comment-only lines containing markdown anchors
      if (/^\s*\/\/.*#[0-9a-fA-F]/.test(raw)) return;
      filtered.push({ file: relative(ROOT, file), line: idx + 1, text: raw.trim() });
    });
  }

  const status: Status = filtered.length > 0 ? 'FAIL' : 'PASS';
  return { label: 'hex literals outside tokens/fonts', status, hits: filtered };
}

/** Check 2: raw eyebrow tracking (0.2em) outside tokens — should use var(--track-eyebrow).
 *  Only 0.2em is flagged because that value has a dedicated token; other tracking values
 *  (display negatives, mid-range positives) are intentionally varied. */
function checkLetterSpacing(): CheckResult {
  const exts = ['.astro', '.tsx', '.css', '.module.css'];
  const files = glob(SRC, exts).filter(
    (f) => !f.endsWith('tokens.css'),
  );

  const RE = /letter-spacing:\s*0?\.2em\b/;
  const hits = scan(files, RE);
  const status: Status = hits.length > 0 ? 'FAIL' : 'PASS';
  return {
    label: 'raw eyebrow tracking 0.2em',
    status,
    hits,
    note: hits.length > 0 ? 'replace with var(--track-eyebrow)' : undefined,
  };
}

/** Check 3: cursor:pointer (WARN, human-verify required) */
function checkCursorPointer(): CheckResult {
  const exts = ['.astro', '.tsx'];
  const files = glob(SRC, exts);

  const RE = /cursor:\s*pointer/;
  const hits = scan(files, RE);
  const status: Status = hits.length > 0 ? 'WARN' : 'PASS';
  return {
    label: 'cursor:pointer',
    status,
    hits,
    note: hits.length > 0
      ? 'verify each selector applies only to <a>, <button>, role=button, or onclick elements'
      : undefined,
  };
}

/** Check 4: 3px borders outside allowlist */
function checkThreePxBorders(): CheckResult {
  const exts = ['.astro', '.tsx', '.css', '.module.css'];
  const files = glob(SRC, exts);

  // Allowlist: relative paths from repo root.
  // These are the documented locations where `border-top: 3px` is the intended emphasis:
  //   - PullQuote.astro / article.css: pull-quote top rule
  //   - PageQa.astro: "ask this page" top rule
  //   - QaCard.astro / QAChips.module.css: expanded QA-answer top-tab (A3 flip)
  const ALLOWLIST = [
    'src/components/ui/molecules/PullQuote.astro',
    'src/components/ui/molecules/PageQa.astro',
    'src/components/ui/molecules/QaCard.astro',
    'src/components/QAChips.module.css',
    'src/styles/article.css',
  ];

  const RE = /border(-top)?:\s*3(px|\s+solid)|border-width:\s*3px/;

  const hits: Hit[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (ALLOWLIST.includes(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((raw, idx) => {
      if (RE.test(raw)) {
        hits.push({ file: rel, line: idx + 1, text: raw.trim() });
      }
    });
  }

  const status: Status = hits.length > 0 ? 'FAIL' : 'PASS';
  return { label: '3px borders outside allowlist', status, hits };
}

/** Check 5: :hover without transition (WARN — file-level heuristic) */
function checkHoverWithoutTransition(): CheckResult {
  const exts = ['.astro', '.tsx', '.css', '.module.css'];
  const files = glob(SRC, exts);

  const hits: Hit[] = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!/:hover/.test(content)) continue;
    if (/transition:/.test(content)) continue; // has transition somewhere in the file
    // File has :hover but no transition anywhere — flag with first :hover line
    const lines = content.split('\n');
    const idx = lines.findIndex((l) => /:hover/.test(l));
    if (idx >= 0) {
      hits.push({
        file: relative(ROOT, file),
        line: idx + 1,
        text: lines[idx].trim(),
      });
    }
  }

  const status: Status = hits.length > 0 ? 'WARN' : 'PASS';
  return {
    label: ':hover without transition',
    status,
    hits,
    note: hits.length > 0 ? 'file has :hover but no transition: declaration found anywhere in file' : undefined,
  };
}

/** Check 6: raw px font-sizes (WARN — migrate to var(--fs-*)) */
function checkRawPxFontSize(): CheckResult {
  const exts = ['.astro', '.tsx', '.css', '.module.css'];
  const files = glob(SRC, exts).filter(
    (f) =>
      !f.endsWith('tokens.css') &&
      !f.endsWith('fonts.css'),
  );

  const RE = /font-size:\s*[0-9]+(\.[0-9]+)?px\b/;
  const hits = scan(files, RE);
  const status: Status = hits.length > 0 ? 'WARN' : 'PASS';
  return {
    label: 'raw px font-size',
    status,
    hits,
    note: hits.length > 0 ? 'migrate to var(--fs-*) tokens' : undefined,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('[audit] running editorial invariant checks...\n');

  const checks: CheckResult[] = [
    checkHexLiterals(),
    checkLetterSpacing(),
    checkCursorPointer(),
    checkThreePxBorders(),
    checkHoverWithoutTransition(),
    checkRawPxFontSize(),
  ];

  for (let i = 0; i < checks.length; i++) {
    printResult(i + 1, checks[i]!);
  }

  const failures = checks.filter((c) => c.status === 'FAIL').length;
  const warnings = checks.filter((c) => c.status === 'WARN').length;

  console.log('');
  if (failures === 0 && warnings === 0) {
    console.log('Summary: all checks passed.');
  } else {
    const parts: string[] = [];
    if (failures > 0) parts.push(`${failures} failure${failures !== 1 ? 's' : ''}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings !== 1 ? 's' : ''}`);
    console.log(`Summary: ${parts.join(', ')}.`);
  }

  if (failures > 0) {
    console.log('Exit 1.');
    process.exit(1);
  }
}

main();
