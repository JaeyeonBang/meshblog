#!/usr/bin/env tsx
/**
 * scripts/build-tokens.ts
 * Reads design.md frontmatter → emits src/styles/tokens.css
 * Run: bun run build-tokens
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const ROOT = path.resolve(import.meta.dirname, '..');
const DESIGN_MD = path.join(ROOT, 'design.md');
const OUT_CSS = path.join(ROOT, 'src', 'styles', 'tokens.css');

// ── helpers ──────────────────────────────────────────────────────────────────

function die(msg: string): never {
  console.error(`[build-tokens] ERROR: ${msg}`);
  process.exit(1);
}

function requireField(data: Record<string, unknown>, field: string): unknown {
  if (data[field] === undefined || data[field] === null) {
    die(`design.md frontmatter missing required field: "${field}"`);
  }
  return data[field];
}

// ── parse ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(DESIGN_MD)) {
  die(`design.md not found at ${DESIGN_MD}`);
}

const src = fs.readFileSync(DESIGN_MD, 'utf-8');
let parsed: matter.GrayMatterFile<string>;
try {
  parsed = matter(src);
} catch (e) {
  die(`Failed to parse design.md frontmatter: ${(e as Error).message}`);
}

const d = parsed.data as Record<string, unknown>;

// Validate required top-level sections
for (const section of ['colors', 'fonts', 'scale', 'motion', 'rules', 'shadows', 'layout']) {
  requireField(d, section);
}

const colors  = d.colors  as Record<string, string>;
const fonts   = d.fonts   as Record<string, string>;
const scale   = d.scale   as { radius: Record<string, number>; space: number[]; type: Record<string, number> };
const motion  = d.motion  as Record<string, string>;
const shadows = d.shadows as Record<string, string>;
const layout  = d.layout  as Record<string, string>;

// Validate sub-fields
if (!colors.ink)       die('colors.ink missing');
if (!colors.paper)     die('colors.paper missing');
if (!fonts.display)    die('fonts.display missing');
if (!scale.space?.length) die('scale.space missing or empty');
if (!scale.type)       die('scale.type missing');

// ── font stack helpers ────────────────────────────────────────────────────────

const F_DISP  = `'${fonts.display}', 'Pretendard', Georgia, serif`;
const F_SERIF = `'${fonts.serif ?? fonts.display}', 'Pretendard', Georgia, serif`;
const F_SANS  = `'${fonts.sans}', -apple-system, system-ui, sans-serif`;
const F_MONO  = `'${fonts.mono}', ui-monospace, Menlo, monospace`;

// ── space stops (11 named stops) ─────────────────────────────────────────────

const SPACE_NAMES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24];
const spaceTokens = scale.space
  .slice(0, SPACE_NAMES.length)
  .map((v, i) => `  --space-${SPACE_NAMES[i]}: ${v}px;`)
  .join('\n');

// ── type scale ────────────────────────────────────────────────────────────────

const t = scale.type;
const typeTokens = [
  `  --fs-xs:   ${t.xs}px;`,
  `  --fs-sm:   ${t.sm}px;`,
  `  --fs-base: ${t.base}px;`,
  `  --fs-md:   ${t.md}px;`,
  `  --fs-lg:   ${t.lg}px;`,
  `  --fs-xl:   ${t.xl}px;`,
  `  --fs-2xl:  ${t['2xl']}px;`,
  `  --fs-3xl:  ${t['3xl']}px;`,
  `  --fs-4xl:  ${t['4xl']}px;`,
  `  --fs-5xl:  ${t['5xl']}px;`,
  `  --fs-hero:     clamp(44px, 6vw, 82px);`,
  `  --fs-article:  clamp(38px, 5vw, 64px);`,
  `  --fs-notfound: 160px;`,
].join('\n');

// ── radius ────────────────────────────────────────────────────────────────────

const r = scale.radius;
const radiusTokens = [
  `  --r-xs:   ${r.xs}${r.xs === 0 ? '' : 'px'};`,
  `  --r-sm:   ${r.sm}px;`,
  `  --r-md:   ${r.md}px;`,
  `  --r-pill: ${r.pill}px;`,
].join('\n');

// ── dark-mode derived colors ──────────────────────────────────────────────────
// Strategy: swap ink ↔ paper; rescale ink-N/paper-N symmetrically; rule-soft → #2a2a2a

function darkInkShade(lightValue: string): string {
  // light ink shades (#000, #1a1a1a, #555, #888, #bbb) → light paper shades
  const map: Record<string, string> = {
    '#000':    '#fff',
    '#1a1a1a': '#e8e8e6',
    '#555':    '#aaa',
    '#888':    '#777',
    '#bbb':    '#444',
  };
  return map[lightValue.toLowerCase()] ?? lightValue;
}

function darkPaperShade(lightValue: string): string {
  // light paper shades (#fff, #f6f6f4) → dark ink shades
  const map: Record<string, string> = {
    '#fff':     '#000',
    '#f6f6f4':  '#1a1a1a',
  };
  return map[lightValue.toLowerCase()] ?? lightValue;
}

const darkInk      = darkPaperShade(colors.paper);          // paper → dark ink
const darkInk2     = darkPaperShade(colors['paper-2'] ?? '#f6f6f4');
const darkInk3     = darkInkShade(colors['ink-3'] ?? '#555');
const darkInk4     = darkInkShade(colors['ink-4'] ?? '#888');
const darkInk5     = darkInkShade(colors['ink-5'] ?? '#bbb');
const darkPaper    = darkInkShade(colors.ink);              // ink → dark paper
const darkPaper2   = darkInkShade(colors['ink-2'] ?? '#1a1a1a');

// ── assemble CSS ──────────────────────────────────────────────────────────────

const lightBlock = `\
:root {
  /* ── color (${d.name ?? 'variant'}) ──────────────────────────────────────── */
  --ink:       ${colors.ink};
  --ink-2:     ${colors['ink-2']};
  --ink-3:     ${colors['ink-3']};
  --ink-4:     ${colors['ink-4']};
  --ink-5:     ${colors['ink-5']};
  --paper:     ${colors.paper};
  --paper-2:   ${colors['paper-2']};
  --rule:      ${colors.rule ?? colors.ink};
  --rule-soft: ${colors['rule-soft']};
  --accent:    ${colors.accent};

  /* ── focus (a11y) ─────────────────────────────────────────────────────── */
  --focus-ring: ${colors['focus-ring'] ?? '#0066ff'};

  /* ── type families ────────────────────────────────────────────────────── */
  --f-disp:  ${F_DISP};
  --f-serif: ${F_SERIF};
  --f-sans:  ${F_SANS};
  --f-mono:  ${F_MONO};

  /* ── type scale ───────────────────────────────────────────────────────── */
${typeTokens}

  /* ── spacing (4-based, 11 stops) ─────────────────────────────────────── */
${spaceTokens}

  /* ── radii ────────────────────────────────────────────────────────────── */
${radiusTokens}

  /* ── motion ───────────────────────────────────────────────────────────── */
  --ease:     ${motion.ease};
  --dur-fast: ${motion['dur-fast']};
  --dur:      ${motion.dur};

  /* ── elevation (⌘K only) ──────────────────────────────────────────────── */
  --shadow-hard: ${shadows.hard};

  /* ── layout rails ─────────────────────────────────────────────────────── */
  --w-page:          ${layout['w-page']};
  --w-page-graph:    ${layout['w-page-graph']};
  --w-prose:         ${layout['w-prose']};
  --w-side:          ${layout['w-side']};
  --w-reader-side:   ${layout['w-reader-side']};
  --w-graph-side:    ${layout['w-graph-side']};
  --w-search-box:    ${layout['w-search-box']};
}`;

const darkBlock = `\
@media (prefers-color-scheme: dark) {
  :root {
    /* ── color (dark — ink↔paper inverted) ──────────────────────────────── */
    --ink:       ${darkInk};
    --ink-2:     ${darkInk2};
    --ink-3:     ${darkInk3};
    --ink-4:     ${darkInk4};
    --ink-5:     ${darkInk5};
    --paper:     ${darkPaper};
    --paper-2:   ${darkPaper2};
    --rule:      ${darkInk};
    --rule-soft: #2a2a2a;
    --accent:    var(--ink);
  }
}`;

const banner = `/* AUTOGENERATED by scripts/build-tokens.ts from design.md — do not edit directly */\n\n`;

const output = banner + lightBlock + '\n\n' + darkBlock + '\n';

// ── write ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(OUT_CSS), { recursive: true });
fs.writeFileSync(OUT_CSS, output, 'utf-8');

const lines = output.split('\n').length;
console.log(`[build-tokens] OK — wrote ${OUT_CSS} (${lines} lines)`);
