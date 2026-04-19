---
title: "CSS Custom Properties vs Tailwind"
tags: [css, tailwind, design-tokens, web]
date: 2026-04-19
---

TL;DR: Hand-rolled CSS variables beat Tailwind for small projects (< 50 components, < 10 pages). Use variables for design tokens, no build-step overhead. Tailwind wins for large teams, sprawling apps, and rapid prototyping.

## The Tradeoff

### CSS Variables (Hand-Rolled)

```css
:root {
  --color-primary: #1f2937;
  --color-secondary: #9ca3af;
  --font-sans: "Inter", sans-serif;
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --radius-sm: 0.25rem;
}

.btn {
  background: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
}
```

**Pros:**
- Zero build step (write CSS, refresh)
- Tiny CSS file (~2kb)
- Dark mode: just add another CSS file with `:root[data-theme=dark]`
- Full IDE support (no JSX syntax shenanigans)
- Familiar to CSS developers

**Cons:**
- Class names are manual (no generator)
- Responsive breakpoints are verbose (`@media (max-width: 768px)`)
- No purging (all tokens ship, even unused)
- Scaling: 100+ tokens = directory organization needed

### Tailwind

```html
<button class="bg-gray-900 px-4 py-2 rounded text-white">Click</button>
```

**Pros:**
- Instant prototyping (class library, no CSS writing)
- Responsive variants built-in (`md:bg-blue-500`)
- Tree-shaking: unused classes removed from bundle
- Large ecosystem (plugins, components)
- Team consistency (limited class names)

**Cons:**
- Build step required (`npm run build`)
- HTML becomes unreadable (class soup)
- Customization needs config file edit + rebuild
- Learning curve (1000+ classes to know)
- CSS bundle for large projects (60-100kb gzipped before purging)

## Decision Matrix

| Factor | CSS Variables | Tailwind |
|--------|---|---|
| Project size | < 50 components | > 100 components |
| Pages | < 10 | > 20 |
| Build step | No | Required |
| Dark mode | Easy | Built-in |
| Design tokens | Explicit | Implicit |
| Responsive | Manual media queries | `md:` prefix |
| Team size | Solo/small | Large |
| Speed (initial) | Fast | Slower (build) |
| Maintenance | Low | Moderate |
| CSS readability | High | Low |

## Meshblog Case Study

Meshblog is **small** (5 pages, 10 components, solo author). Decision: **CSS Variables**.

```
pages/
├── index.astro
├── notes/[id].astro
├── graph.astro
└── search.astro

components/
├── NoteCard.astro
├── SearchBox.astro
├── Graph.astro
└── Nav.astro

styles/
├── global.css    (variables)
├── components.css
└── dark.css
```

Design tokens file:

```css
/* styles/tokens.css */
:root {
  --color-bg: #fff;
  --color-text: #1f2937;
  --color-accent: #3b82f6;
  --font-serif: "Pretendard", serif;
  --space-unit: 0.5rem;
  --transition: 150ms ease;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f172a;
    --color-text: #f3f4f6;
    --color-accent: #60a5fa;
  }
}
```

Component CSS:

```css
.note-card {
  background: var(--color-bg);
  color: var(--color-text);
  padding: calc(var(--space-unit) * 2);
  border-radius: 0.5rem;
  transition: background var(--transition);
}

.note-card:hover {
  background: var(--color-accent);
  color: var(--color-bg);
}
```

Result: Zero build overhead, responsive breakpoints written explicitly, dark mode works instantly, CSS is readable.

## When to Switch

If meshblog grows to 50+ pages or 30+ components, revisit Tailwind. At that point, the cost of manual responsive breakpoints exceeds the build-step cost.

For now: CSS variables is the right fit.
