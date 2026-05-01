---
name: "Editorial B&W"
variant: a
colors:
  ink:        "oklch(0% 0 0)"
  ink-2:      "oklch(22% 0 0)"
  ink-3:      "oklch(45% 0 0)"
  ink-4:      "oklch(63% 0 0)"
  ink-5:      "oklch(79% 0 0)"
  paper:      "oklch(100% 0 0)"
  paper-2:    "oklch(97% 0.003 85)"
  rule:       "oklch(0% 0 0)"
  rule-soft:  "oklch(88% 0.004 85)"
  accent:     "var(--ink)"
  focus-ring: "oklch(45% 0.18 265)"
darkColors:
  ink:       "oklch(100% 0 0)"
  ink-2:     "oklch(93% 0.003 85)"
  ink-3:     "oklch(74% 0 0)"
  ink-4:     "oklch(57% 0 0)"
  ink-5:     "oklch(39% 0 0)"
  paper:     "oklch(0% 0 0)"
  paper-2:   "oklch(22% 0 0)"
  rule-soft: "oklch(29% 0 0)"
categorical:
  cat-engineering: "oklch(64% 0.14 250)"
  cat-ai:          "oklch(66% 0.15 195)"
  cat-writing:     "oklch(68% 0.12 60)"
  cat-fallback:    "oklch(55% 0.00 0)"
  cat-c0:          "oklch(64% 0.13 0)"
  cat-c1:          "oklch(64% 0.13 30)"
  cat-c2:          "oklch(64% 0.13 60)"
  cat-c3:          "oklch(64% 0.13 90)"
  cat-c4:          "oklch(64% 0.13 120)"
  cat-c5:          "oklch(64% 0.13 150)"
  cat-c6:          "oklch(64% 0.13 180)"
  cat-c7:          "oklch(64% 0.13 210)"
  cat-c8:          "oklch(64% 0.13 240)"
  cat-c9:          "oklch(64% 0.13 270)"
  cat-c10:         "oklch(64% 0.13 300)"
  cat-c11:         "oklch(64% 0.13 330)"
darkCategorical:
  cat-engineering: "oklch(72% 0.13 250)"
  cat-ai:          "oklch(74% 0.13 195)"
  cat-writing:     "oklch(76% 0.11 60)"
  cat-fallback:    "oklch(65% 0.00 0)"
  cat-c0:          "oklch(72% 0.13 0)"
  cat-c1:          "oklch(72% 0.13 30)"
  cat-c2:          "oklch(72% 0.13 60)"
  cat-c3:          "oklch(72% 0.13 90)"
  cat-c4:          "oklch(72% 0.13 120)"
  cat-c5:          "oklch(72% 0.13 150)"
  cat-c6:          "oklch(72% 0.13 180)"
  cat-c7:          "oklch(72% 0.13 210)"
  cat-c8:          "oklch(72% 0.13 240)"
  cat-c9:          "oklch(72% 0.13 270)"
  cat-c10:         "oklch(72% 0.13 300)"
  cat-c11:         "oklch(72% 0.13 330)"
fonts:
  display:    "Source Serif 4"
  serif:      "Source Serif 4"
  sans:       "Pretendard"
  mono:       "JetBrains Mono"
scale:
  radius:
    xs:   0
    sm:   2
    md:   4
    pill: 999
  space: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96]
  type:
    xxs:  10
    xs:   12
    sm:   14
    base: 17
    md:   18
    lg:   20
    xl:   22
    2xl:  25
    3xl:  31
    4xl:  38
    5xl:  54
motion:
  ease:     "cubic-bezier(.22,1,.36,1)"
  dur-fast: "140ms"
  dur:      "240ms"
rules:
  hairline: 1
  emphasis: 3
  hover:    invert
shadows:
  hard: "12px 12px 0 var(--ink)"
layout:
  w-page:          "1280px"
  w-page-graph:    "1400px"
  w-prose:         "72ch"
  w-side:          "320px"
  w-reader-side:   "240px"
  w-graph-side:    "300px"
  w-search-box:    "760px"
  # Posts index: thumb (160) + gap (28) + 60ch ≈ 770. Asymmetric on 1280 page.
  w-post-list:     "770px"
  # Right-rail section order. The detail page leads with Related (the graph
  # grounds the reader in their current article); the index page leads with
  # Categories (the dominant wayfinding tool when browsing without a target).
  # When a section is rendered, it MUST follow the order below for its page.
  # Single source of truth.
  aside-order-detail: ["related-graph", "categories", "tags", "contents", "backlinks", "concepts"]
  aside-order-index:  ["categories", "tags", "related-graph"]
tracking:
  eyebrow: "0.2em"
  badge:   "0.14em"
  nav:     "0.1em"
  caption: "0.04em"   # mono captions, kbd, secondary labels in molecules
  wide:    "0.08em"   # graph stage labels, mode toggles
---

# Editorial B&W

## Brand Personality

Three words: *quiet · editorial · considered*.

This is a reading room, not a dashboard. The reader arrives from a link or a search, sits down for a single piece of writing, and follows a thread — related notes, concept clusters, Q&A chips — without feeling funnelled. The job is to slow them down by half a beat.

Voice: a long-form essay in a small print magazine. Confident enough to use one serif typeface and hold the page with it. Careful enough to set its own margins.

## Six Design Principles

1. **Hairlines only.** Every dividing line is 1px. Emphasis borders are 3px tops — pull-quotes, section openers — never full-bordered cards. The page breathes through whitespace and rule, not enclosure.

2. **Hover-invert.** All interactive surfaces invert on hover: background becomes `--ink`, text becomes `--paper`. No colour-shift, no underline-only, no opacity. The inversion is the signal — it reads equally well in light and dark mode.

3. **Source Serif 4 holds the page.** Headlines, drop caps, lede paragraphs, and pull-quotes are set in Source Serif 4 (optical size axis, opsz 8–60). Don't reach for a display typeface for impact — use size, weight variation, and the opsz axis. Never gradient-fill text. Never track out all-caps headings longer than two words.

4. **Mono eyebrows.** Labels, categories, counts, and meta text use JetBrains Mono with `letter-spacing: 0.2em` and `text-transform: uppercase`. They are signals, not prose. Size: 11px (`--fs-xs`). This creates a clear register separation without a second sans-serif.

5. **Rules, not boxes.** Separate content with hairlines (1px), whitespace, or a single top-border — never with full-bordered cards stacked on each other. No left-stripe accent borders. No drop shadows except `--shadow-hard` on the ⌘K overlay.

6. **Asymmetry over centering.** The homepage and article layouts lean left or sit in a narrow column offset from centre. Centred layouts are reserved for moments that genuinely want ceremony — the 404 numerals, perhaps the footer mark. On mobile, the first layout is a pocket-size zine: generous `line-height: 1.7`, comfortable 60ch column, no horizontal chrome.
