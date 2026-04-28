# Graph QA follow-ups — implementation plan

> Source: `.gstack/qa-reports/qa-report-meshblog-2026-04-29.md` (PR #74 post-deploy QA)
> Branch: `fix/graph-qa-followups` (from `main` after PR #74 merge `bf872a3`)
> Worktree: `.claude/worktrees/graph-qa-fixes`

## Scope

| ID  | Sev | What | File(s) |
| :-- | :-- | :--- | :------ |
| F-1 | CRITICAL | Korean tofu in `var(--f-mono)` surfaces — add Pretendard fallback to mono stack | `design.md` (fonts.mono fallback) + regenerate `tokens.css` |
| F-2 | MEDIUM   | `/graph` first-paint shows spinner + 1 node simultaneously | `src/components/GraphView.tsx` (loading-state hide on category-data branch) |
| F-3 | MEDIUM   | Sidebar `<GraphLegend />` hardcoded `NOTE 0 / CONCEPT 0` despite live counts | `src/pages/graph.astro` (graph:state handler updates count spans) |
| F-4 | LOW      | Zoom button trio asymmetric (`+`/`−` 26px vs `RESET` ~52px) | `src/components/GraphView.module.css` (`.zoomBtn`) |

**Out of scope** (separate follow-ups): #003 long-label viewBox overflow, #007 4-corner UI mobile collision.

## Approach per item

### F-1 Korean tofu fix

**Root cause** (verified at `src/styles/tokens.css:23`):
```css
--f-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
```
JetBrains Mono has zero CJK glyphs and the fallback chain is also Latin-only, so Korean characters fall through to a system mono with no Hangul → tofu.

`--f-disp`, `--f-serif` already include `'Pretendard'` as fallback — that's why Korean works in display headlines and serif body but breaks in mono.

**Fix**: Insert `'Pretendard'` (already loaded for sans) into the mono fallback chain *before* `ui-monospace`. Pretendard is a proportional sans-serif so the result will not be true monospace for Korean chars — but tofu is far worse. The Pretendard glyph metrics for CJK are designed to harmonize with Latin monospace at the same em-size.

Update `scripts/build-tokens.ts:74`:
```ts
const F_MONO = `'${fonts.mono}', 'Pretendard', ui-monospace, Menlo, monospace`;
```

(Or, if `fonts['korean-mono']` is added to `design.md`, prefer that — but Pretendard inline is sufficient.)

Then run `bun run build-tokens` to regenerate `src/styles/tokens.css`. Verify `--f-mono` line includes Pretendard.

**Acceptance**:
- After regen, `tokens.css` line 23 contains `'Pretendard'`
- Visit `/graph?mode=note&level=2` (drill-down with Korean back-button "← L2 · 포스트") — Korean characters render as glyphs, not tofu
- Level button labels `L1 · 카테고리 overview` render correctly

**Risks**: Pretendard appears Korean characters slightly wider than Latin monospace — column alignment in tabular monospace contexts (none currently exist in this codebase) would shift. We have no monospace tables. Safe.

---

### F-2 Stuck loading-state

**Root cause** (`src/components/GraphView.tsx:380-391`):

The taxonomy-change branch at line 374 (`useEffect` triggered by `[taxonomy]`) is the second `useEffect` that recomputes graph from cached `categoryData` without refetch. It hides `loadingEl` only at line 385 IF `loadingEl` resolves. But during initial render race:
- First effect fires (`mode/taxonomy/retry` deps) → `setStatus('loading')` → loading shown
- Promise resolves, sets graph + status='ready' + hides loading at line 318
- BUT the L3 default category=AI auto-selection happens via `setTaxonomy({level: 2 or 3, categorySlug: ...})` from another effect → triggers second `useEffect` (line 374) which DOES NOT show loading first, just recomputes
- Net result: usually fine, but on slow networks the spinner overlay on top of the canvas can persist when the L3 view shows only 1 node from a sparse category.

Actually the more likely bug is that **L3 inside the AI category really does have just 1 node** (based on fixture). The spinner is residual because:
- The first effect (line 251) sets `loadingEl[aria-hidden=false]` 
- After Promise resolves, sets `aria-hidden=true` (line 318)
- BUT the empty-state DIV has `pointer-events: none` and `display: flex` (always laid out) — when status=='empty' for L1 category mode, both can be visible? No, `aria-hidden="true"` triggers `display: none` via the empty-state CSS rule (`.empty-state[aria-hidden="true"] { display: none }`).

**Real bug suspect**: When the SVG renders on top of the loading-state element with the CSS rule `.loading-state[aria-hidden="true"] { display: none }` working, the visible spinner is actually the Astro-defined inline overlay. Need to inspect computed styles on a slow render. Investigation step before code change.

**Fix plan** (after investigation confirms):
1. Add explicit `loadingEl[aria-hidden="true"]` and `display:none` set in the second `useEffect` (line 374) — currently it only sets `removeAttribute('aria-busy')` and `setAttribute('aria-hidden', 'true')`. Verify CSS rule `.loading-state[aria-hidden="true"] { display: none }` is actually present.
2. If absent, add it to `graph.astro` `<style>` block.

**Acceptance**:
- Visit `/graph` on a fresh tab → spinner disappears once graph renders, never co-renders with nodes
- L3 sparse-category view (1 node) shows the node + "1 nodes · 0 edges" but no spinner overlay

**Risks**: Hiding loading too eagerly can flash a blank canvas. Mitigation: only hide when status flips from 'loading' to 'ready' or 'empty'.

---

### F-3 Sidebar legend live counts

**Root cause** (`src/pages/graph.astro:86`):
```astro
<GraphLegend noteCount={0} conceptCount={0} />
```
The Astro component renders SSR-time props. The `graph:state` event handler (line 115) updates `#graphMeta`, `#gcStats`, mode/level toggles — but does NOT touch the legend counts.

The in-canvas `<Legend />` React component (`src/components/graph/Legend.tsx`) is separate and DOES update from live data via `legendCategories` derived in GraphView. So we have two legends with different sources.

**Fix** (`graph.astro`):
1. Add IDs to the count spans inside `GraphLegend.astro`:
   - `<span class="legend-count" id="legendNoteCount">{noteCount}</span>`
   - `<span class="legend-count" id="legendConceptCount">{conceptCount}</span>`
2. In `graph.astro` `graph:state` handler (after the `gcStats` update at line 130), compute counts from `detail.nodes`:
   ```ts
   const nodes = detail.nodes as Array<{ type: string }>
   const noteN = nodes.filter(n => n.type === 'note').length
   const conceptN = nodes.filter(n => n.type === 'concept').length
   const lnEl = document.getElementById('legendNoteCount')
   const lcEl = document.getElementById('legendConceptCount')
   if (lnEl) lnEl.textContent = String(noteN)
   if (lcEl) lcEl.textContent = String(conceptN)
   ```

**Acceptance**:
- `/graph?mode=concept&level=3` sidebar legend shows `NOTE n` and `CONCEPT m` matching canvas counts
- Switching modes updates counts live

**Risks**: Type assertion on `detail.nodes` — already typed as `unknown[]` in current handler. The existing code does `(detail.nodes ?? []).length` without typing — same level of trust. Acceptable.

---

### F-4 Zoom button visual symmetry

**Current** (`GraphView.module.css:437-455`):
```css
.zoomBtn { min-width: 26px; height: 26px; padding: 0 8px; ... }
```
`+` and `−` render at 26×26. `reset` (5 chars × ~7px tracked mono) renders at ~52×26.

**Two acceptable fixes**:

**Option A — Replace text "reset" with an icon glyph** (`↺` U+21BA, anticlockwise arrow). Keeps all three buttons square. Risk: rendering inconsistency in JetBrains Mono (similar concern to original `⊙` rejection).

**Option B — Equalize widths by setting `min-width: 52px` on all** so the trio reads as a balanced row. Adds 26px each on `+`/`−` but visually clean.

**Recommendation: Option B** — simpler, no glyph-rendering risk, mono eyebrow tracking still works at 52px. Update CSS:

```css
.zoomBtn {
  min-width: 44px;   /* was 26px — accommodates "RESET" + tracking */
  height: 28px;
  padding: 0 8px;
  ...
}
```

Or keep current `min-width: 26px` but force `.zoomBtn:last-child { min-width: 52px }` for asymmetric-by-design. (Less aesthetic.)

Will go with uniform 44px width.

**Acceptance**:
- Visual symmetry: three equal-width buttons in the trio
- Touch target ≥40px on mobile (44px ≥ WCAG minimum)
- Mobile media query (≤780px) adjusts to 48×36 for finger reach

**Risks**: 44px is just past comfortable touch but not ergonomic. Mobile bumps to 48 separately. Fine.

---

## File touch list

| File | Edits |
| :--- | :--- |
| `design.md` | (no change — Pretendard already in fallback chain at design level) |
| `scripts/build-tokens.ts` | Line 74 — add `'Pretendard',` to F_MONO stack |
| `src/styles/tokens.css` | (regenerated by build-tokens, do NOT hand-edit) |
| `src/components/ui/molecules/GraphLegend.astro` | Add `id="legendNoteCount"` / `id="legendConceptCount"` to the two `<span class="legend-count">` |
| `src/pages/graph.astro` | Inside the `graph:state` handler, compute and update the two count spans |
| `src/components/GraphView.tsx` | Audit lines 380-391: ensure `loadingEl[aria-hidden=true]` set unconditionally on graph rerender from cached categoryData |
| `src/components/GraphView.module.css` | `.zoomBtn { min-width: 44px }` — single-line change |

## Tests

- `bunx astro check` — 0 new errors
- `bun run build:fixture` — exits 0
- `npx vitest run` — pre-existing tests still pass; no new tests required (cosmetic + content fixes)
- Manual on local preview:
  - `/graph` → no overlapping spinner + node
  - `/graph?mode=concept&level=3` → sidebar legend `NOTE 0 · CONCEPT 20` (or matching real counts)
  - `/graph?mode=note&level=2` → drill-down → back-button shows `← L2 · 포스트` as Korean glyphs not tofu
  - Zoom buttons visually equal width

## Out of scope (next PR)

- F-3 viewBox label overflow — needs design call (truncate? push-back force? padding?)
- F-7 mobile 4-corner UI — needs ≤780px audit + design call
- ZoomController cast cleanup (`@types/d3-transition` install) — not blocking

---

## Plan-eng-review adjustments (2026-04-29)

After plan-eng-review, scope updated:

- **F-2 DROPPED** — verified at `src/pages/graph.astro:429` that `.loading-state[aria-hidden="true"] { display: none }` rule already exists. The "stuck spinner" QA observation was actually a sparse 1-node L3 view (AI category genuinely has 1 fixture note); the lone circle visually resembles a spinner. Not a real bug. Will note as cannot-repro.

- **F-4 REVISED** — keep `min-width: 26px` square; replace `reset` text label with **`1:1`** (3-char ASCII, zero glyph-rendering risk vs unicode `↺`/`⊙`). Trio reads as `+ / − / 1:1` — semantically clear "zoom to 100%", uniform mono character density. CSS unchanged except button content.

- **F-3 ADJUSTED** — show `—` (em dash) instead of `0` for the initial SSR/pre-state render. Avoids `0 → n` flicker on first `graph:state`. Update `GraphLegend.astro` defaults `noteCount = '—' as any` OR keep prop type as `number | string` and pass `'—'` from `graph.astro`.

- **F-1 ADJUSTED** — preemptively add `line-height: 1` to mono-eyebrow surfaces that mix Korean+Latin (`.zoomBtn`, `.backBtn`, `.seg` for level buttons, `.block-meta`, `.level-caption`, `.disclosure`) to absorb potential Pretendard CJK ascender shift. This is defensive — verify post-deploy whether visible jitter exists; if not, the rule is harmless.

Final scope: F-1 (Korean tofu + line-height) + F-3 (live legend with `—` fallback) + F-4 (`1:1` icon).
