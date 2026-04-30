import { useEffect } from 'react'
import type { RefObject } from 'react'
import * as d3Force from 'd3-force'
import * as d3Selection from 'd3-selection'
import * as d3Zoom from 'd3-zoom'
import * as d3Drag from 'd3-drag'
// d3-transition has no module export; importing for side-effects augments
// d3-selection's Selection type with .interrupt() and .transition().
import 'd3-transition'
import type { GraphNode, GraphLink, GraphJson, IncidentEdge, IncidentEdgeList } from './types'
import { paletteIndexFor } from './categoryPalette'

export type ZoomController = { zoomIn: () => void; zoomOut: () => void; reset: () => void }

type SimNode = GraphNode & d3Force.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode; weight: number; type?: string; alias?: string }

/** Base radius per node kind */
function nodeRadius(node: SimNode): number {
  if (node.type === 'category') {
    // L1 category hubs: floor 14px, scale by sqrt(pagerank) for visual heft on landing.
    return Math.max(14, Math.sqrt(node.pagerank * 1000) * 1.4)
  }
  const base = node.type === 'concept' ? 7 : 5
  return Math.max(base, Math.sqrt(node.pagerank * 1000))
}

/** Radius scaled by inbound-degree (backlinks/directed mode only) */
function backlinkRadius(inDegree: number): number {
  const base = 5
  return base + Math.min(Math.sqrt(inDegree) * 3, 14)
}

// Node colour is painted entirely via CSS tokens in GraphView.module.css.

/** Cap animation delay so stagger doesn't exceed 600ms */
const MAX_STAGGER_MS = 600
const STAGGER_STEP_MS = 40

/** Max characters shown in resting node labels before ellipsis. Hover popover
 *  (HoverCard) shows the full label, so this only affects the in-canvas text.
 *  CJK chars roughly 2x Latin width — count weighted accordingly. */
const LABEL_MAX_LATIN = 28
const LABEL_MAX_CJK = 14
const LABEL_MAX_LATIN_MOBILE = 18

/** Detect mobile viewport (≤780px). Re-evaluated each render via simulation
 *  rebuild on resize is out of scope; this captures the snapshot at mount. */
function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 780px)').matches
}

/** Returns true when the codepoint falls inside the CJK ranges that render
 *  ~1em wide (vs ~0.55em for Latin in Pretendard). Mirrors the same ranges
 *  used in PostMeshGraph emWidthOfChar(). */
function isCjkChar(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return (
    (code >= 0x3000 && code <= 0x9fff) ||  // CJK symbols + Unified Ideographs
    (code >= 0xac00 && code <= 0xd7af) ||  // Hangul syllables
    (code >= 0xff00 && code <= 0xffef)     // Half-/full-width forms
  )
}

/** Truncate a label so it fits inside the canvas. Preserves emphasis-marker
 *  prefixes (e.g. "← L2 · ") by walking from the end. CJK chars count 2x.
 *  Tighter cap on mobile viewports (≤780px) so labels don't escape the
 *  narrow canvas. */
function truncateLabel(s: string, mobile: boolean = false): string {
  const cap = mobile ? LABEL_MAX_LATIN_MOBILE : LABEL_MAX_LATIN
  let weight = 0
  let i = 0
  for (; i < s.length; i++) {
    const ch = s[i] ?? ''
    weight += isCjkChar(ch) ? 2 : 1
    // Mixed-content cap: scale to whichever bound binds first.
    if (weight > cap) break
  }
  if (i >= s.length) return s
  // Trim trailing whitespace + dangling punctuation before the ellipsis.
  let cut = s.slice(0, i).trimEnd()
  while (cut.length > 0 && /[·:\-—,]$/.test(cut)) {
    cut = cut.slice(0, -1).trimEnd()
  }
  return cut + '…'
}
void LABEL_MAX_CJK

export type HoverState = {
  node: GraphNode
  x: number
  y: number
  degree?: { in: number; out: number }
  incident?: IncidentEdgeList
} | null

export function useForceSimulation(
  svgRef: RefObject<SVGSVGElement | null>,
  graph: GraphJson | null,
  opts: {
    onNodeClick?: (n: GraphNode) => void
    directed?: boolean
    onHover?: (state: HoverState) => void
    /** When true, note nodes with categorySlug get data-cat for CSS coloring.
     *  False (default) in concept mode so all nodes stay B&W. */
    colorByCategory?: boolean
    /** When true, every node with a `cluster` field gets data-cat-idx set from
     *  cluster mod 12. Used in concept mode for graphify-style community colors
     *  on otherwise-uniform concept nodes. Independent of colorByCategory. */
    colorByCluster?: boolean
    /** Override d3-force tuning for smaller-scale consumers (e.g. mini graph). */
    simParams?: {
      linkDistance?: number      // default 60
      chargeStrength?: number    // default -120
      collideRadius?: number     // default 10
      scaleExtent?: [number, number]  // default [0.1, 8]
      /** Explicit canvas width to avoid clientWidth=0 race during client:visible
       *  hydration. When provided, simulation places nodes within this width
       *  instead of falling back to 800. Should match the SVG viewBox. */
      canvasWidth?: number
      /** Explicit canvas height. Pairs with canvasWidth. Defaults to clientHeight || 600. */
      canvasHeight?: number
    }
    /** When false, skip the entrance stagger animation (set delay to 0ms). Default true. */
    staggerEnabled?: boolean
    /** Called with a ZoomController after setup, called with null on cleanup. */
    onZoomReady?: (ctrl: ZoomController | null) => void
  },
): void {
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || !graph || graph.nodes.length === 0) return

    const width = opts.simParams?.canvasWidth ?? (svgEl.clientWidth || 800)
    const height = opts.simParams?.canvasHeight ?? (svgEl.clientHeight || 600)
    const isMobile = isMobileViewport()

    // Clone nodes/links so d3 mutation doesn't bleed into React state
    const nodes: SimNode[] = graph.nodes.map(n => ({ ...n }))
    const linkMap = new Map(nodes.map(n => [n.id, n]))
    const links: SimLink[] = graph.links
      .map((l): SimLink | null => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id
        const targetId = typeof l.target === 'string' ? l.target : l.target.id
        const s = linkMap.get(sourceId)
        const t = linkMap.get(targetId)
        if (!s || !t) return null
        return { source: s, target: t, weight: l.weight, type: l.type, alias: l.alias }
      })
      .filter((l): l is SimLink => l !== null)

    // Always build degree maps — used for backlink radius in directed mode and
    // for the HoverState degree/incident payload in all modes.
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()
    for (const l of links) {
      outDegree.set(l.source.id, (outDegree.get(l.source.id) ?? 0) + 1)
      inDegree.set(l.target.id, (inDegree.get(l.target.id) ?? 0) + 1)
    }

    /** Returns the incident edges for a given node, sorted inbound-first then alpha.
     *  Capped at 5 items; totalCount reflects the full count. */
    function incidentEdgesFor(nodeId: string): IncidentEdgeList {
      const all: IncidentEdge[] = []
      for (const l of links) {
        if (l.target.id === nodeId) {
          all.push({ direction: 'in', label: l.source.label, alias: l.alias })
        } else if (l.source.id === nodeId) {
          all.push({ direction: 'out', label: l.target.label, alias: l.alias })
        }
      }
      // Sort: inbound first, then alphabetical by label
      all.sort((a, b) => {
        if (a.direction !== b.direction) return a.direction === 'in' ? -1 : 1
        return a.label.localeCompare(b.label)
      })
      return { items: all.slice(0, 5), totalCount: all.length }
    }
    const radiusOf = (d: SimNode) =>
      opts.directed ? backlinkRadius(inDegree.get(d.id) ?? 0) : nodeRadius(d)
    const kindOf = (d: SimNode): string => {
      if (!opts.directed) return d.type
      const inD = inDegree.get(d.id) ?? 0
      return inD === 0 ? 'backlink-leaf' : 'note'
    }
    const labelOf = (d: SimNode): string => {
      if (!opts.directed) return d.label
      const inD = inDegree.get(d.id) ?? 0
      const outD = outDegree.get(d.id) ?? 0
      return `${d.label}  ·  ← ${inD}  ·  → ${outD}`
    }

    // Sparse L1: when most nodes are categories and there are few of them, the
    // standard force-directed layout collapses them onto a thin chain. Pre-seed
    // a circular arrangement around the centroid so the landing view reads as
    // a constellation, not a horizon line. Only triggered for sparse category-mode.
    const isSparseCategoryView =
      nodes.length > 0 &&
      nodes.length <= 6 &&
      nodes.every(n => n.type === 'category')
    if (isSparseCategoryView) {
      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) * 0.28
      nodes.forEach((n, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2 // start at 12 o'clock
        n.x = cx + Math.cos(angle) * radius
        n.y = cy + Math.sin(angle) * radius
      })
    }

    // --- Simulation ---
    const linkDistance = isSparseCategoryView
      ? Math.min(width, height) * 0.32
      : (opts.simParams?.linkDistance ?? 60)
    const chargeStrength = isSparseCategoryView
      ? -800
      : (opts.simParams?.chargeStrength ?? -120)
    const collideRadius = isSparseCategoryView
      ? 32
      : (opts.simParams?.collideRadius ?? 10)

    const simulation = d3Force
      .forceSimulation<SimNode>(nodes)
      .alphaDecay(0.02)
      .force(
        'link',
        d3Force
          .forceLink<SimNode, SimLink>(links)
          .id(d => d.id)
          .distance(linkDistance),
      )
      .force('charge', d3Force.forceManyBody<SimNode>().strength(chargeStrength))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      // Per-node collide reserves space for each label (~14px below circle)
      // so neighbours don't crash labels into each other or into adjacent
      // circles. `collideRadius` (10 default, 32 sparse-category) acts as a
      // floor so the sparse-view tuning still wins when nodes are tiny.
      .force(
        'collide',
        // +22 = label height (13px) + dy offset (14) - radius overlap allowance.
        // Larger labels need more vertical breathing room or they crash again.
        d3Force.forceCollide<SimNode>(d => Math.max(collideRadius, radiusOf(d) + 22)),
      )
      .stop()

    // Deterministic layout: run 60 ticks synchronously (Patch C3)
    for (let i = 0; i < 60; i++) {
      simulation.tick()
    }
    simulation.stop()

    // --- DOM setup ---
    const svg = d3Selection.select(svgEl)
    svg.selectAll('*').remove()

    // Arrowhead marker for directed (backlinks) mode
    if (opts.directed) {
      const defs = svg.append('defs')
      const marker = defs
        .append('marker')
        .attr('id', 'arrowhead')
        .attr('markerWidth', 8)
        .attr('markerHeight', 6)
        .attr('refX', 8)
        .attr('refY', 3)
        .attr('orient', 'auto')
      marker
        .append('polygon')
        .attr('points', '0 0, 8 3, 0 6')
        .attr('fill', 'currentColor')
        .attr('opacity', 0.85)
    }

    const g = svg.append('g').attr('class', 'graph-container')

    // Links
    const linkSel = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      // Edge thickness: 1.0px floor + sqrt(weight) so weight=1 → ~1.0, weight=4 → ~2.0,
      // weight=9 → ~2.6. Wider spread than the previous formula so hub edges read.
      .attr('stroke-width', d => Math.max(1.0, 0.7 + Math.sqrt(d.weight) * 0.65))
      .attr('x1', d => d.source.x ?? 0)
      .attr('y1', d => d.source.y ?? 0)
      .attr('x2', d => d.target.x ?? 0)
      .attr('y2', d => d.target.y ?? 0)
      .attr('marker-end', opts.directed ? 'url(#arrowhead)' : null)
      // data-edge-type: set for cross-type edges so CSS can style them distinctly
      .attr('data-edge-type', d => d.type ?? null)

    // Nodes — with data-kind, <title>, and stagger delay
    const nodeSel = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(nodes)
      .join(enter => {
        const c = enter.append('circle')
        // Accessible tooltip via <title>
        c.append('title').text(d => labelOf(d))
        return c
      })
      .attr('r', d => radiusOf(d))
      .attr('data-kind', d => kindOf(d))
      // data-cluster: set from Louvain output when present; absent = no attr (backward compat)
      .attr('data-cluster', d => d.cluster != null ? String(d.cluster % 10) : null)
      // data-cat: set only when colorByCategory is enabled AND node is a note with categorySlug.
      // Disabled in concept mode so all nodes in that view stay B&W.
      .attr('data-cat', d => opts.colorByCategory && d.type === 'note' && d.categorySlug ? d.categorySlug : null)
      // data-cat-idx: palette bucket index (0–11). Two paths:
      //   • notes mode (colorByCategory): hash categorySlug → 0..11
      //   • concept mode (colorByCluster): cluster index mod 12 → 0..11
      // Either way the same CSS rules in GraphView.module.css render the colour.
      .attr('data-cat-idx', d => {
        if (opts.colorByCategory && d.type === 'note' && d.categorySlug) {
          const idx = paletteIndexFor(d.categorySlug)
          return idx === -1 ? null : String(idx)
        }
        if (opts.colorByCluster && d.cluster != null) {
          return String(d.cluster % 12)
        }
        return null
      })
      .attr('cx', d => d.x ?? 0)
      .attr('cy', d => d.y ?? 0)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => labelOf(d))
      .style('cursor', 'pointer')
      // Stagger entrance animation; cap at MAX_STAGGER_MS.
      // When staggerEnabled is explicitly false, skip the stagger (set to 0ms).
      .style('animation-delay', (_d, i) => {
        if (opts.staggerEnabled === false) return '0ms'
        const delay = Math.min(i * STAGGER_STEP_MS, MAX_STAGGER_MS)
        return `${delay}ms`
      })

    // Labels — rendered; visibility toggled via CSS class on hover.
    //
    // font-size set via inline .style() (NOT .attr()) so the zoom counter-
    // scale below can override it. CSS rule `.labels text { font-size: 10px }`
    // wins against the SVG attribute but loses to inline style. Without this,
    // zooming visually scales label text along with the camera (the bug from
    // PR #89).
    const labelSel = g
      .append('g')
      .attr('class', 'labels')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(nodes)
      .join('text')
      .style('font-size', '13px')
      .attr('text-anchor', 'middle')
      .attr('dy', d => radiusOf(d) + 14)
      .attr('x', d => d.x ?? 0)
      .attr('y', d => d.y ?? 0)
      .style('pointer-events', 'none')
      // In-canvas label: truncated to avoid viewBox overflow on long titles.
      // Full label remains in <title> + hover popover for discoverability.
      // Mobile viewport gets a tighter cap (LABEL_MAX_LATIN_MOBILE).
      .text(d => truncateLabel(labelOf(d), isMobile))

    // Map node index → label text element for dim/focus
    const labelNodes = labelSel.nodes()

    /** Apply dim-siblings + focused-label when a node is active */
    function applyFocus(activeIdx: number): void {
      labelSel.each(function (_d, i) {
        const isFocused = i === activeIdx
        d3Selection.select(this)
          .classed('label--focused', isFocused)
          .classed('label--dim', !isFocused)
      })
    }

    /** Restore full opacity on all labels */
    function clearFocus(): void {
      labelSel
        .classed('label--focused', false)
        .classed('label--dim', false)
    }

    /** Highlight edges incident on hovered node; dim the rest */
    function applyEdgeFocus(nodeId: string): void {
      linkSel.each(function (d) {
        const src = typeof d.source === 'object' ? (d.source as SimNode).id : d.source
        const tgt = typeof d.target === 'object' ? (d.target as SimNode).id : d.target
        const isIncident = src === nodeId || tgt === nodeId
        d3Selection.select(this)
          .classed('edge--active', isIncident)
          .classed('edge--dim', !isIncident)
      })
    }

    /** Restore all edges to default style */
    function clearEdgeFocus(): void {
      linkSel
        .classed('edge--active', false)
        .classed('edge--dim', false)
    }

    nodeSel
      .on('mouseenter', (event: MouseEvent, d: SimNode) => {
        const idx = nodeSel.nodes().indexOf(event.currentTarget as SVGCircleElement)
        if (idx !== -1) applyFocus(idx)
        applyEdgeFocus(d.id)
        const inD = inDegree.get(d.id) ?? 0
        const outD = outDegree.get(d.id) ?? 0
        opts.onHover?.({
          node: d,
          x: event.clientX,
          y: event.clientY,
          degree: { in: inD, out: outD },
          incident: incidentEdgesFor(d.id),
        })
      })
      .on('mousemove', (event: MouseEvent, d: SimNode) => {
        // Pass position update only — degree/incident unchanged during move
        opts.onHover?.({ node: d, x: event.clientX, y: event.clientY })
      })
      .on('mouseleave', () => {
        clearFocus()
        clearEdgeFocus()
        opts.onHover?.(null)
      })
      .on('focus', (event: FocusEvent, d: SimNode) => {
        const idx = nodeSel.nodes().indexOf(event.currentTarget as SVGCircleElement)
        if (idx !== -1) applyFocus(idx)
        applyEdgeFocus(d.id)
        // Position popover near the circle's bounding box for keyboard users
        const rect = (event.currentTarget as SVGCircleElement).getBoundingClientRect()
        const inD = inDegree.get(d.id) ?? 0
        const outD = outDegree.get(d.id) ?? 0
        opts.onHover?.({
          node: d,
          x: rect.right,
          y: rect.top,
          degree: { in: inD, out: outD },
          incident: incidentEdgesFor(d.id),
        })
      })
      .on('blur', () => {
        clearFocus()
        clearEdgeFocus()
        opts.onHover?.(null)
      })

    // Silence unused variable warning for labelNodes (kept for potential future use)
    void labelNodes

    // --- Zoom ---
    // Counter-scale nodes, labels, and edge strokes by 1/k so zooming changes
    // the *distance* between nodes (positions scale with k) but the visual
    // size of each circle and label stays constant. Without this counter-
    // scale the user just sees a uniform scale-up that gives no information.
    const BASE_LABEL_FONT_PX = 13
    const BASE_LABEL_OFFSET_PX = 14
    const zoomBehavior = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(opts.simParams?.scaleExtent ?? [0.1, 8])
      .on('zoom', (event: d3Zoom.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const k = event.transform.k
        g.attr('transform', event.transform.toString())
        nodeSel.attr('r', d => radiusOf(d) / k)
        linkSel.attr('stroke-width', d => Math.max(1.0, 0.7 + Math.sqrt(d.weight) * 0.65) / k)
        // font-size via inline .style() so it beats the CSS rule on .labels text
        labelSel
          .style('font-size', `${BASE_LABEL_FONT_PX / k}px`)
          .attr('dy', d => (radiusOf(d) + BASE_LABEL_OFFSET_PX) / k)
      })

    svg.call(zoomBehavior)

    // Build and expose ZoomController via callback.
    // d3-transition's side-effect import (top of file) augments Selection
    // with .interrupt() and .transition(), so no casts needed here.
    const zoomController: ZoomController = {
      zoomIn:  () => { svg.interrupt(); zoomBehavior.scaleBy(svg.transition().duration(180), 1.4) },
      zoomOut: () => { svg.interrupt(); zoomBehavior.scaleBy(svg.transition().duration(180), 1 / 1.4) },
      reset:   () => { svg.interrupt(); zoomBehavior.transform(svg.transition().duration(220), d3Zoom.zoomIdentity) },
    }
    opts.onZoomReady?.(zoomController)

    // --- Drag ---
    let dragged = false

    const dragBehavior = d3Drag
      .drag<SVGCircleElement, SimNode>()
      .on('start', (event: d3Drag.D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        dragged = false
        simulation.alphaTarget(0.3).restart()
        d.fx = d.x ?? 0
        d.fy = d.y ?? 0
      })
      .on('drag', (event: d3Drag.D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        dragged = true
        d.fx = event.x
        d.fy = event.y
        // Update position immediately since simulation is restarted
        d3Selection
          .select<SVGCircleElement, SimNode>(event.sourceEvent.target as SVGCircleElement)
          .attr('cx', event.x)
          .attr('cy', event.y)
        // Also advance simulation a tick to update dependent links
        simulation.tick()
        linkSel
          .attr('x1', ld => (ld.source as SimNode).x ?? 0)
          .attr('y1', ld => (ld.source as SimNode).y ?? 0)
          .attr('x2', ld => (ld.target as SimNode).x ?? 0)
          .attr('y2', ld => (ld.target as SimNode).y ?? 0)
        nodeSel.attr('cx', nd => nd.x ?? 0).attr('cy', nd => nd.y ?? 0)
        labelSel.attr('x', nd => nd.x ?? 0).attr('y', nd => nd.y ?? 0)
      })
      .on('end', (_event: d3Drag.D3DragEvent<SVGCircleElement, SimNode, SimNode>, d) => {
        simulation.alphaTarget(0)
        simulation.stop()
        d.fx = null
        d.fy = null
      })

    nodeSel.call(dragBehavior)

    // --- Click (distinct from drag) ---
    nodeSel.on('click', (_event: MouseEvent, d: SimNode) => {
      if (!dragged) {
        opts.onNodeClick?.(d)
      }
    })

    // Cleanup
    return () => {
      opts.onZoomReady?.(null)
      simulation.stop()
      svg.on('.zoom', null)
      svg.selectAll('*').remove()
    }
  // opts is an object — intentionally not included to avoid re-runs on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef, graph])
}
