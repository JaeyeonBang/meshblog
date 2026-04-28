# Graph zoom · edge visibility · home overflow — implementation plan

> Items: critique #3 (zoom +/- buttons on /graph), #4 (edge visibility), #13 (home graph zoom overflow).

## Current state

| File | Role |
| :--- | :--- |
| `src/components/GraphView.tsx` | Full-site graph at `/graph`. Wraps `useForceSimulation`. |
| `src/components/graph/useForceSimulation.ts` | d3-force + d3-zoom. zoom behavior attached to `<svg>`; transform applied to inner `<g class="graph-container">`. `scaleExtent` defaults `[0.1, 8]`. |
| `src/components/GraphView.module.css` | edge stroke: `--ink-3` (oklch 45%) @ 0.55 opacity, 1px. |
| `src/components/PostMeshGraph.tsx` | Home-page mini graph. Compact (280×280) + Expanded modal (720×720). `scaleExtent([0.5, 3])`. |
| `src/components/PostMeshGraph.module.css` | `.wrap { overflow: ❌ unset }` + `.svg { overflow: visible }` → wheel-zoom inside the inline graph escapes the card. |
| `src/pages/graph.astro` | Hosts `<GraphView client:only="react" />` inside `.graph-canvas` (relative + `overflow: hidden`). |

## Tasks

### #3 — +/- zoom buttons on /graph

**Goal**: discoverable zoom controls (mouse-wheel zoom is undiscoverable, especially on trackpad/mobile). Three buttons stacked vertically in the bottom-right of the canvas: `+` (zoom in), `−` (zoom out), `⊙` (reset/fit).

**Mechanism**: expose the d3-zoom behavior from `useForceSimulation` so the component can call `zoomBehavior.scaleBy(svg.transition().duration(180), 1.4)` and `transform(svg, zoomIdentity)`.

**Implementation**:
1. `useForceSimulation.ts` — accept an optional `zoomRef: { current: ZoomController | null }` parameter.
   - Define `type ZoomController = { zoomIn(): void; zoomOut(): void; reset(): void }`.
   - Inside the effect, after creating `zoomBehavior`, write the controller into `zoomRef.current`. Clean up in the return fn.
   - Use `svg.transition().duration(180).call(zoomBehavior.scaleBy, 1.4)` for in/out, `svg.transition().duration(220).call(zoomBehavior.transform, d3Zoom.zoomIdentity)` for reset.
2. `GraphView.tsx` — create the ref via `useRef<ZoomController | null>(null)`, pass to the hook, render a `.zoomControls` element with three buttons that call `zoomRef.current?.zoomIn()` etc.
3. `GraphView.module.css` — `.zoomControls` block in bottom-right. Stack column, hairline border, 1px gap separator between buttons. Mono font, 28×28px hit target. Hover-invert. Hide when `status !== 'ready'`.
4. **Keyboard**: each button reachable by Tab; respond to Enter/Space (native button behavior). Aria-labels: "Zoom in", "Zoom out", "Reset zoom".

**Edge cases**:
- Disable buttons at scale extent boundaries? **No** — d3-zoom silently clamps to `scaleExtent`. Simpler.
- Reset must restore both translate + scale → `zoomIdentity` does that.
- Mobile: same controls, larger hit target (36px) under `(max-width: 780px)`.

### #4 — Edge visibility

**Goal**: edges read as structure, not as background grain. Today they sit at `--ink-3` × 0.55 opacity = ~oklch(45%) × 0.55 ≈ ~80% lightness on white — barely visible.

**Implementation** (`GraphView.module.css`):
- Default `.svg :global(.links line)`: `stroke: var(--ink-2)`, `stroke-opacity: 0.7`, `stroke-width: 1.1px` (was `--ink-3` × 0.55 × 1px).
- `.svg :global(.links line[data-edge-type="mentions"])`: `stroke: var(--ink-3)`, `stroke-opacity: 0.6`, dasharray unchanged.
- Backlink directed mode arrow stays at `currentColor` (unchanged).
- Hover-active edge: bump `stroke-width: 1.8px` (was 1.6).
- `useForceSimulation.ts` line 220: edge `stroke-width` formula: `Math.max(1.1, 0.8 + Math.sqrt(d.weight) * 0.7)` (raises floor 1.0 → 1.1, slope 0.65 → 0.7).

**Mini graph** (`PostMeshGraph.module.css`):
- `.svg :global(.links line)`: `stroke: var(--ink-3)` (was --ink-4), `stroke-width: 0.8` (was 0.5), `opacity: 0.85` (was 0.7).
- `.svg :global(.links line[data-edge-type="inter"])`: `opacity: 0.6` (was 0.4) — keep texture distinction.

**Constraint check**: Editorial invariant #2 (hairlines = 1px). Default 1.1px is still hairline; backlinks-active 1.8px stays under the 3px emphasis-only threshold.

### #13 — Home page graph zoom overflow

**Root cause**: `PostMeshGraph.module.css`:
```css
.wrap { /* no overflow */ }
.svg  { overflow: visible; }   /* deliberate so edge boxes don't clip */
```
When user wheel-zooms inside the compact graph, the d3 transform scales the inner `<g>` and content bleeds out of the home-page card boundary.

**Fix**:
1. `.wrap { overflow: hidden; }` — clip the visible spill but only at the wrap boundary.
2. `.svg { overflow: visible; }` stays — it lets resting boxes near the SVG edge render normally inside `.wrap`.
3. Side-effect verify: in modal mode, `.modalInner > .svg` already has `width: 100%; height: 100%` and `.modalInner` has its own border + sizing — clipping does not apply because there's no zoom-out beyond the modal frame in expected use, and `.modalInner` doesn't need overflow:hidden (modal already at 720px). Skip.
4. **Optional but cheap**: lower compact `scaleExtent` from `[0.5, 3]` → `[0.7, 2]` so users can't zoom out enough to make the graph look broken in the small canvas. Conservative — keep `[0.5, 3]` for now; clipping alone is the fix.

## Tests

### TDD (existing harness: vitest)

- `tests/post-mesh-graph.test.tsx` (if present) — confirm `.wrap` has `overflow: hidden` via computed style. Otherwise add a CSS-import smoke test.
- `tests/graph-zoom-controls.test.tsx` — new. Mount `<GraphView />` mock, assert presence of three zoom buttons with aria-labels. Click `+` → ref controller called once. (No d3 stub needed; mock the hook.)

### Manual verification (per CLAUDE.md `Pre-commit checklist`)

1. `bun run build:fixture` — exits 0
2. `bunx astro check` — 0 errors
3. `npx vitest run` — all pass
4. `bun run preview`:
   - Visit `/meshblog/graph` → see +/− /⊙ stack bottom-right; click each → graph zooms/pans accordingly. Wheel zoom still works.
   - Visit `/meshblog/` → wheel-zoom mini graph → no node bleeds out of card.
   - Toggle each mode (notes, concepts, backlinks). Edges visibly darker than R6 baseline.
5. Run `blog-bw-polish` skill — empty output from all 6 grep checks.
6. Quick a11y check: tab into zoom buttons; outline visible; Enter triggers.

## Risks / non-goals

- Hairline invariant: `1.1px` rounds to `1px` in render but is technically slightly bolder. If lint trips, revert to `1px` and rely on darker stroke color alone.
- `--ink-2` for default edges may be too dark in dark-mode variant B/C; both variants reuse `--ink-2` token, so they auto-track. Visual spot-check after build-tokens swap.
- Zoom controller pattern intentionally avoids exporting d3-zoom internals to React; only the imperative methods leak.

## File touch list

| File | Edit |
| :--- | :--- |
| `src/components/graph/useForceSimulation.ts` | export ZoomController type, accept zoomRef, write controller, edge-width formula bump |
| `src/components/GraphView.tsx` | create zoomRef, render `.zoomControls` element |
| `src/components/GraphView.module.css` | `.zoomControls` block + edge stroke/opacity bump + active edge width |
| `src/components/PostMeshGraph.module.css` | `.wrap { overflow: hidden }` + edge color/opacity bump |
| `tests/graph-zoom-controls.test.tsx` | new |

## Review-driven adjustments (2026-04-29)

After plan-eng-review + plan-design-review:

- **Zoom controls**: top-right HORIZONTAL row (`+ − reset`), single 1px frame with internal dividers (matches `.btn-group` pattern). Mirrors `.backBtn` top-corner reservation. Avoids bottom-edge conflict with `.stats` + Legend. 26×26px hit target. **Reset label is the word "reset"** (mono, 4 letters), not `⊙` (renders inconsistently in JetBrains Mono).
- **Hook contract**: instead of mutating a caller-owned `zoomRef`, the hook accepts an optional `onZoomReady?: (ctrl: ZoomController | null) => void` callback. Called with the controller after setup, called with `null` on cleanup. GraphView stores it in state. Avoids stale-controller bug across mode/level effect re-runs.
- **`svg.interrupt()`** before each `svg.transition().call(zoomBehavior.scaleBy, ...)` to cancel in-flight gestures cleanly (iOS Safari touch race).
- **Buttons `disabled` when `status !== 'ready'`** — screen readers won't announce dead buttons.
- **`.modalInner { overflow: hidden }`** — symmetry with `.wrap` overflow fix; covers expanded-mode wheel-zoom.
- **Edge visibility**: keep `--ink-3` and `1px` (preserves invariant #2 literally), only bump `stroke-opacity` 0.55 → 0.75. Mini graph: `--ink-4` → `--ink-3` AND opacity 0.7 → 0.8 AND width 0.5 → 0.6. Reverts the 1.1px floor change. Edge-width formula in hook unchanged (`Math.max(1.0, …)`).
- **Active edge** width on hover stays `1.6px`.
- **Home overflow padding**: skip viewBox shrink — `.wrap { overflow: hidden }` alone is sufficient for the bug. Resting label clipping is a separate, pre-existing concern (not in #13 scope).
- **Verification**: extend Step 4 of pre-commit checklist with `grep -c 'aria-label="Zoom in"'` against `/meshblog/graph` HTML output.

## Out of scope

- Animated focus-on-node (clicking a node from the sidebar zooms to it). v2.
- Pinch-to-zoom on mobile beyond what d3-zoom already gives. The controls suffice as a discoverable alternative.
