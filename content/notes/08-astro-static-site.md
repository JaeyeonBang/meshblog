---
title: "Astro: The Best Framework for Content-Heavy Sites"
tags: [astro, static-site, web-performance, javascript]
date: 2026-01-08
---

Astro is a modern static site generator with a unique "islands" architecture. It ships zero JavaScript by default.

## Key Concepts

**Content Collections**: Astro's typed system for managing Markdown, MDX, and JSON content. Define a schema with Zod and get TypeScript types automatically.

**Islands Architecture**: Only the interactive parts of your page load JavaScript. Static content ships as pure HTML.

**View Transitions**: Smooth page transitions without a SPA framework.

## Why Astro for meshblog

meshblog is primarily a knowledge display tool. The content (notes, entities, graph JSON) is all pre-generated at build time. Astro is perfect because:

1. **Zero runtime overhead** — pre-generated HTML, no client-side fetch
2. **Fast builds** — Vite-powered, incremental rebuilds
3. **Flexibility** — can add React islands later for interactive graph

## File Structure

```
src/
  pages/          — Route-based pages
  layouts/        — Shared page wrappers
  components/     — Astro/React components
content/
  posts/          — Blog posts (MD/MDX)
  notes/          — Knowledge base notes
public/
  graph/          — Pre-generated JSON
```

## Integration with SQLite

At build time, Astro pages can query the SQLite database to render content. In production, the database is baked into the static output — no runtime queries needed.
