import { useEffect } from 'react'
import type { RefObject } from 'react'
import * as d3Force from 'd3-force'
import * as d3Selection from 'd3-selection'
import * as d3Zoom from 'd3-zoom'
import * as d3Drag from 'd3-drag'
import type { GraphNode, GraphLink, GraphJson } from './types'
import { paletteIndexFor } from './categoryPalette'

type SimNode = GraphNode & d3Force.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode; weight: number; type?: string }

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

export type HoverState = {
  node: GraphNode
  x: number
  y: number
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
  },
): void {
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || !graph || graph.nodes.length === 0) return

    const width = opts.simParams?.canvasWidth ?? (svgEl.clientWidth || 800)
    const height = opts.simParams?.canvasHeight ?? (svgEl.clientHeight || 600)

    // Clone nodes/links so d3 mutation doesn't bleed into React state
    const nodes: SimNode[] = graph.nodes.map(n => ({ ...n }))
    const linkMap = new Map(nodes.map(n => [n.id, n]))
    const links: SimLink[] = graph.links
      .map(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id
        const targetId = typeof l.target === 'string' ? l.target : l.target.id
        const s = linkMap.get(sourceId)
        const t = linkMap.get(targetId)
        if (!s || !t) return null
        return { source: s, target: t, weight: l.weight, type: l.type }
      })
      .filter((l): l is SimLink => l !== null)

    // In directed (backlinks) mode every node looks identical otherwise —
    // flatten pagerank → 0, same level, same type. Compute degree maps so
    // hubs get bigger circles and leaf nodes read as muted stubs.
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()
    if (opts.directed) {
      for (const l of links) {
        outDegree.set(l.source.id, (outDegree.get(l.source.id) ?? 0) + 1)
        inDegree.set(l.target.id, (inDegree.get(l.target.id) ?? 0) + 1)
      }
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
      .force('collide', d3Force.forceCollide<SimNode>(collideRadius))
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
      // data-cat-idx: palette bucket index (0–11) for dynamic slug coloring via hash.
      // Set alongside data-cat so CSS can match either the semantic name or the palette slot.
      .attr('data-cat-idx', d => {
        if (!opts.colorByCategory || d.type !== 'note' || !d.categorySlug) return null
        const idx = paletteIndexFor(d.categorySlug)
        return idx === -1 ? null : String(idx)
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

    // Labels — rendered; visibility toggled via CSS class on hover
    const labelSel = g
      .append('g')
      .attr('class', 'labels')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(nodes)
      .join('text')
      .attr('font-size', 10)
      .attr('text-anchor', 'middle')
      .attr('dy', d => radiusOf(d) + 12)
      .attr('x', d => d.x ?? 0)
      .attr('y', d => d.y ?? 0)
      .style('pointer-events', 'none')
      .text(d => labelOf(d))

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
        opts.onHover?.({ node: d, x: event.clientX, y: event.clientY })
      })
      .on('mousemove', (event: MouseEvent, d: SimNode) => {
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
        opts.onHover?.({ node: d, x: rect.right, y: rect.top })
      })
      .on('blur', () => {
        clearFocus()
        clearEdgeFocus()
        opts.onHover?.(null)
      })

    // Silence unused variable warning for labelNodes (kept for potential future use)
    void labelNodes

    // --- Zoom ---
    const zoomBehavior = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent(opts.simParams?.scaleExtent ?? [0.1, 8])
      .on('zoom', (event: d3Zoom.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoomBehavior)

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
      simulation.stop()
      svg.on('.zoom', null)
      svg.selectAll('*').remove()
    }
  // opts is an object — intentionally not included to avoid re-runs on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgRef, graph])
}
