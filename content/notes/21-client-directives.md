---
title: "Astro client:* Directives"
tags: [astro, client-side, directives, hydration]
date: 2026-04-19
---

TL;DR: Use `client:load` for interactive UI, `client:idle` for slow initialization, `client:visible` for below-the-fold, `client:media` for conditional display, `client:only` for browser-only code.

## The Problem

By default, Astro components don't run JavaScript. When you need interactivity, you mark components with `client:*` directives. Each directive controls *when* the component hydrates (JavaScript ships and runs).

## client:load

Hydrate immediately on page load.

```astro
<Button client:load />
```

Use when: Navigation buttons, forms, any above-the-fold interaction. The component needs JavaScript right away.

Mental model: "Start running immediately."

## client:idle

Hydrate after the browser is idle (via `requestIdleCallback`).

```astro
<SlowAnalytics client:idle />
```

Use when: Analytics trackers, non-critical features, features used after initial page load. Delays JavaScript execution until the browser finishes layout.

Mental model: "Run as soon as you're not busy."

## client:visible

Hydrate only when the component enters the viewport (via `IntersectionObserver`).

```astro
<LazyGallery client:visible />
```

Use when: Below-the-fold sections, image galleries, carousels. Saves bandwidth if the user never scrolls to it.

Mental model: "Only run when the user scrolls here."

## client:media

Hydrate only if a CSS media query matches.

```astro
<MobileNav client:media="(max-width: 768px)" />
```

Use when: Mobile-only navigation, responsive components. If the query never matches, the component never hydrates.

Mental model: "Only run if this screen size applies."

## client:only

Hydrate immediately, skip server-side rendering entirely. No static HTML.

```astro
<ThemePicker client:only="react" />
```

Use when: Browser-only APIs (window, localStorage), client-only libraries. Breaks static HTML generation but sometimes necessary.

Mental model: "This *only* works in the browser."

## Comparison

| Directive | When | Good For |
|-----------|------|----------|
| `client:load` | Immediately | Forms, buttons, critical UI |
| `client:idle` | Browser idle | Analytics, non-critical features |
| `client:visible` | In viewport | Lazy sections, galleries |
| `client:media` | Media query match | Responsive, device-specific |
| `client:only` | Immediately, no HTML | Browser-only APIs |

## Strategy for meshblog

Use `client:load` for search form and note navigation. Use `client:visible` for graph visualization (below the fold). Skip hydration entirely for static content.
