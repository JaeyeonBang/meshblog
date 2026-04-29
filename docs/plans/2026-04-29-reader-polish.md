# Reader Polish — Sticky · Width · Concept Toggle · Related Fallback

**Author:** Claude (auto-mode planning)
**Status:** ready for plan-eng-review + plan-design-review
**Date:** 2026-04-29
**Scope:** post reader page — `/posts/[slug]`. Notes reader follows the same
PostSidebar wiring; same fixes apply.

---

## Problem statements

### A · Sticky concept-graph appears awkwardly while scrolling
Live: <https://jaeyeonbang.github.io/meshblog/posts/12-transformer-self-attention/>

`PostSidebar.astro` applies `position: sticky; bottom: var(--space-4)` to the
concept-graph section. `[slug].astro` already pins `.toc` with
`position: sticky; top: 96px`. Two opposite sticky anchors inside the same
`align-self: start` aside makes the middle siblings (related-mesh / categories
/ tags) scroll past while the concept-graph "pops in" from the viewport bottom
once the aside's natural end reaches the viewport. The aside's design comment
([`[slug].astro:487-494`](../../src/pages/posts/[slug].astro)) says only the
TOC is intended to be sticky — concept-graph was added later and its
sticky-bottom contradicts that intent.

### B · Article body left-leans inside its column
Live: same URL.

```
.reader-layout — grid: 1fr 240px, gap 48px, max 1280px
└── .reader-article — 1fr column ≈ 920px
    ├── HeroFigure  → width 100% → ~920px ✅
    └── .prose      → max-width: var(--w-prose) = 60ch ≈ 580–600px
                      no margin-inline → flush-left ❌ ~320px right gap
```

Hero stretches column width; prose caps at 60ch and left-aligns. The mismatch
makes the page feel "decapitated on the right". The line length itself is on
the tight end of editorial best practice (60–75ch).

### C · Inline concept-graph in article header is too zoomed + has no zoom controls
Live: open the `concept 그래프 보기` toggle on
[/posts/12-transformer-self-attention/](https://jaeyeonbang.github.io/meshblog/posts/12-transformer-self-attention/).

`PostConceptGraph.tsx` uses two fixed modes:
- `COMPACT_MODE` (canvas: 280, fontSize: 10) — for the 240px sidebar slot
- `EXPANDED_MODE` (canvas: 720, fontSize: 12) — for the modal overlay

The header `<details class="concept-toggle">` mounts the **compact** instance
in a ~920px wide container. `viewBox="0 0 280 280"` + `width: 100%` scales
nodes ≈3.3× → labels look gigantic, edges become slabs. Also unlike
`/graph` (`GraphView.tsx`), `PostConceptGraph` ships **no zoom buttons** —
only mouse-wheel zoom works, which isn't discoverable on touch devices.

### D · Some posts render no related-graph and no related-grid
Live: <https://jaeyeonbang.github.io/meshblog/posts/11-rlpr/>

`getRelatedNotes(post.id, 4)` queries `note_entities` for entity overlap.
`getNoteMeshNodes(...)` queries wikilink edges first, falls back to entity
overlap. Both fail when a post has no shared entities **and** no
`[[wikilinks]]` — common for niche / one-off posts. Result: empty rail
(no `related-mesh-section`, no `related-grid`), no signpost forward.

---

## Solution

### Plan A — Drop sticky from concept-graph
Single-source-of-truth for sticky stays the TOC. Concept-graph reverts to
normal flow as the last item in the aside.

```diff
# src/components/ui/molecules/PostSidebar.astro
- .sticky-concept-section {
-   position: sticky;
-   bottom: var(--space-4);
-   background: var(--paper);
-   padding-top: var(--space-3);
-   margin-top: var(--space-8);
- }
+ .sticky-concept-section {
+   margin-top: var(--space-8);
+   padding-top: var(--space-3);
+   border-top: 1px solid var(--rule-soft);
+ }
```
Class name retained to avoid touching the markup contract. Renaming would be
churn — the class isn't referenced elsewhere.

### Plan B — Centre `.prose` and widen to 72ch

```diff
# src/styles/article.css
  .prose {
    max-width: var(--w-prose);
+   margin-inline: auto;
    ...
  }

# src/styles/tokens.css  (auto-generated — must edit design.md upstream)
- --w-prose: 60ch;
+ --w-prose: 72ch;

# design.md
- w-prose: "60ch"
+ w-prose: "72ch"
```

72ch sits in the middle of the 50–75ch readability band cited by
Bringhurst / Butterick. With `margin-inline: auto` plus the wider column, the
right-side gap shrinks from ~320px to ~120px and reads as deliberate breathing
room rather than truncation. Hero (920px) ▸ prose (~720px) ▸ aside (240px)
now form a stepped composition.

### Plan C — Make inline concept-graph work like `/graph`

Two parallel changes inside `src/components/PostConceptGraph.tsx`:

1. **Add a third mode `INLINE_MODE`** sized for the article column slot:
   ```ts
   const INLINE_MODE: Mode = {
     canvas: 720,        // matches expanded so SVG isn't upscaled
     fontSize: 12,
     baseRadius: 7,
     linkDistance: 90,
     chargeStrength: -260,
   }
   ```
   Pass it from `<details class="concept-toggle">` via a new `variant` prop
   on `PostConceptGraph` (`'sidebar' | 'inline' | 'modal'` — default
   `'sidebar'`). The header in `posts/[slug].astro` and `notes/[slug].astro`
   passes `variant="inline"`.

2. **Add zoom controls inside `GraphCanvas`**, mirroring `GraphView.tsx`:
   ```tsx
   <div className={styles.zoomControls} role="group" aria-label="Zoom controls">
     <button onClick={() => zoom.zoomIn()}>+</button>
     <button onClick={() => zoom.zoomOut()}>−</button>
     <button onClick={() => zoom.reset()}>1:1</button>
   </div>
   ```
   - Hold the `d3Zoom.zoomBehavior` instance in a ref so the buttons can call
     `zoomBehavior.scaleBy(svg.transition().duration(160), 1.4)` etc.
   - Reset uses `svg.call(zoomBehavior.transform, d3Zoom.zoomIdentity)`.
   - Buttons inherit `.zoomBtn` styling tokens already present in
     `GraphView.module.css` — copy or extract to a shared partial. Decision
     in §"Open questions" below.

### Plan D — Tag-fallback for empty related sets

`getRelatedNotes` returns `[]` when `note_entities` has no overlap. Add a
**tag-based tier** before bailing.

```diff
# src/lib/pages/related.ts (sketch)
+ // Tier 2: shared-tag fallback. When entity overlap is empty, return up to
+ // `limit` other notes that share at least one tag, ranked by shared-tag
+ // count then updated_at desc. Excludes draft/private rows by going through
+ // the same notes table the rest of the build trusts.
  export function getRelatedNotes(noteId: string, limit = 3): RelatedNote[] {
    ...entity-overlap query as today...
+   if (rows.length > 0) return rows
+   return getTagOverlapRelated(noteId, limit, db)
  }
```
- `getTagOverlapRelated` joins `notes` by JSON-array tag intersection. SQLite
  has no `json_each` shortcut on the build runner unless the JSON1 extension
  ships — it does on Bun's better-sqlite3 build, verified locally. Use
  `json_each(n.tags)` to pivot.
- Caller change in `mesh-data.ts`: also extend `getNoteMeshNodes`'
  Tier 2 → add a Tier 3 that pulls tag-overlap neighbors when entity overlap
  returns 0. Same SQL helper, exposed as `getTagOverlapNeighbors(noteId, max)`.

This guarantees a non-empty rail for any post that has tags, which is every
post in `content/posts/` (hard-coded in `new-post` skill scaffolding).

---

## Acceptance

1. `[slug].astro:12-rlpr-and-12-transformer` both render `related-mesh-section`
   AND `related-grid` post-D.
2. Scrolling `/posts/12-transformer-self-attention/` shows the TOC pinned at
   top:96, all other aside sections in flow, **no element popping in from the
   bottom** (Plan A).
3. `.prose` first-paragraph left edge is roughly equidistant from the page's
   left padding and the aside's left edge (Plan B). Visual diff: ~120px gap on
   each side of prose, vs. today's 0px-left-320px-right.
4. `concept 그래프 보기` toggle opens an inline canvas at the article column
   width with **node radii ≤ 12px** at default zoom, and three zoom buttons
   (+/−/1:1) in the top-right corner. Buttons fire d3 zoom transitions
   identical to the `/graph` page.
5. `bun run build:fixture` exits 0; `npx vitest run` does not regress (the
   pre-existing 6 fixture/wikilink failures stay at 6).
6. New TDD specs added to `test/qa-13-fixes.test.ts` (or a new file) cover:
   - PostSidebar `.sticky-concept-section` lacks `position: sticky` (Plan A).
   - `.prose` declares `margin-inline: auto` (Plan B).
   - `--w-prose` resolves to `72ch` in `tokens.css` (Plan B).
   - `PostConceptGraph` exports `INLINE_MODE` and zoom-control button markup
     (Plan C — source-level grep).
   - `getRelatedNotes` returns a non-empty array for `11-rlpr` against a real
     DB seeded by the local fixture build (Plan D — integration via the same
     pattern as `test/v1-acceptance.test.ts`).

---

## Out of scope (deliberately deferred)

- Rebuilding `PostConceptGraph` on top of `useForceSimulation` to share the
  existing zoom/legend wiring. Worth doing later, not on this branch.
- Adding the same tag-fallback to homepage `getHomeMeshNodes`. The home graph
  has its own data source (concept-l2.json) and a different empty state.
- Mobile aside re-ordering. Current `order: -1` at ≤980px keeps the sidebar
  above the article on tablet, which already breaks the scroll model — that
  is a separate UX call.

---

## Eng-review decisions (locked in)

1. **Plan C prop name**: `size: 'compact' | 'inline'` (drop `'modal'` — it's
   driven by `isExpanded` state from compact, not by prop).
2. **Plan C inline variant** hides the expand button (modal-on-modal is
   redundant); compact keeps it.
3. **Plan D shared helper**: `getTagOverlapNeighbors(noteId, limit, db)` lives
   in `related.ts`, imported by both `getRelatedNotes` (fallback path) and
   `getNoteMeshNodes` (Tier 3). DRY violation eliminated up front.
4. **Plan C zoom toolbar**: duplicate now, schedule extraction as TODO. Two
   call-sites are the cheapest case for duplication; extraction worth doing
   only when a third site appears.
5. **Plan B asymmetry**: hero 100% / prose 72ch-centred / RelatedGrid 100% is
   intentional stepped composition. Don't try to align everything.
6. **Failure mitigations** (from eng-review §4):
   - Tag-overlap SQL wraps in `try/catch` → console.warn → empty array (so a
     missing JSON1 extension degrades to current behaviour rather than 500ing
     the page).
   - Zoom buttons render `disabled` until the d3-force simulation has ticked
     once (mirrors `GraphView.tsx`'s `disabled={status !== 'ready'}` pattern).

## Design-review decisions (locked in)

7. **Inline concept-graph background**: wrap the inline `.concept-toggle-canvas`
   in `background: var(--paper-2)` — same pattern as `.prose pre` code blocks,
   establishes sub-region without breaking the editorial B&W contract.
8. **Zoom button tap targets**: 24×24 desktop, `min-width: 44px; min-height:
   44px` at `@media (max-width: 780px)` (mirror of TopBar `.btn-sm` mobile
   pattern at TopBar.astro:297-302). WCAG-compliant.
9. **Terminal empty related rail**: when entity overlap returns 0 AND
   tag-fallback returns 0, hide the entire related-mesh-section + RelatedGrid
   silently. No empty-state copy. Pager + footer-graph-link cover the "what
   to read next" need — adding a fourth signpost is noise.
10. **Concept section motion**: rely on the existing `src/styles/motion.css`
    `fade-up` already applied to `.article-header`. Don't add a new
    entry/exit animation for the dropped-sticky concept block.
11. **6 editorial invariants confirmed for new zoom controls**:
    no hex (use `var(--ink)`/`var(--paper)`/`var(--ink-3)`),
    hairline `1px solid var(--ink)`,
    hover-invert (paper↔ink),
    no shadow,
    radius ≤ 4px (`var(--r-xs)`).
12. **Hero/prose/related stepped composition**: intentional. Don't try to
    align hero (100%) with prose (72ch centred). Editorial asymmetry mirrors
    print magazine convention; the eye reads the stepped column as
    deliberate, not broken. (Already in plan as note 1.1; recorded here as
    locked.)

## Layout diagram (for implementer reference)

```
+----------------------------- 1280px --------------------------+
| Topbar                                                        |
+---------------------------------------------------------------+
|                                                               |
| reader-layout grid: 1fr 240px, gap 48px                       |
| +--------------------------------+ +-------------------+      |
| |  reader-article (~920px)       | | reader-aside 240  |      |
| |  +--------- HeroFigure 100% -+ | | +- related-mesh -+|      |
| |  |                           | | | +- categories  -+|      |
| |  +---------------------------+ | | +- tags        -+|      |
| |   article-header (h1, tags)    | | +- TOC sticky  -+|      |
| |   <details concept-toggle>     | |    top: 96px     |      |
| |     bg: paper-2                | | +- concept (flow)+|      |
| |     +/-/1:1 corner toolbar     | |    NO STICKY     |      |
| |   </details>                   | +-------------------+      |
| |                                |                            |
| |   +--- prose 72ch · centred ---+                            |
| |   |  margin-inline: auto       |                            |
| |   |  ~120px gap each side       |                            |
| |   +----------------------------+                            |
| |                                |                            |
| |   RelatedGrid (100%)           |                            |
| |   Pager (100%)                 |                            |
| +--------------------------------+                            |
+---------------------------------------------------------------+
| Footer                                                        |
+---------------------------------------------------------------+
```
