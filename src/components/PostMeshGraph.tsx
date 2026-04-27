/**
 * PostMeshGraph.tsx — interactive force-directed mini graph for the reader aside.
 *
 * Renders a compact d3-force graph showing the current note/post as a centre
 * node connected by spokes to its neighbours, with optional inter-neighbour
 * edges where wikilink relationships exist.
 *
 * Visuals: each node is a TEXT BOX (truncated title in a hairline-bordered rect),
 * not a circle. Center box is filled (paper-on-ink); neighbour boxes are
 * outlined and flip to ink-on-paper on hover.
 *
 * Two modes:
 *   - inline (default) — fits inside the right reader-aside (280×280).
 *   - expanded — fullscreen modal overlay (~720×720) for closer inspection.
 *
 * Consumed by post and note Astro page layouts as a React island:
 *   <PostMeshGraph client:visible nodes={meshNodes} links={meshLinks} />
 *
 * ID derivation:
 *   Each MeshNode's href looks like "/meshblog/notes/<slug>".
 *   We extract the last path segment as the synthetic graph node id.
 *   Centre node has no href → id = '__center__'.
 *
 * Editorial invariants honoured: #1 no hex, #2 hairline border, #3 hover-invert,
 *                                 #5 no shadow, #6 radius ≤ 4px.
 */

import { useEffect, useRef, useState } from 'react'
import * as d3Force from 'd3-force'
import * as d3Selection from 'd3-selection'
import * as d3Zoom from 'd3-zoom'
import * as d3Drag from 'd3-drag'
import type { MeshNode } from '../lib/mesh-data'
import styles from './PostMeshGraph.module.css'

// ── Types ───────────────────────────────────────────────────────────────────

type Props = {
  nodes: MeshNode[]
  links: Array<{ source: string; target: string }>
}

type SimNode = d3Force.SimulationNodeDatum & {
  id: string
  label: string
  isCenter: boolean
  href?: string
  readingMinutes?: number
}

type SimLink = {
  source: SimNode
  target: SimNode
  type: 'spoke' | 'inter'
}

type HoverState = {
  node: SimNode
  x: number
  y: number
} | null

// ── Constants ───────────────────────────────────────────────────────────────

const COMPACT_SIZE = 280
const EXPANDED_SIZE = 720

type SizeMode = {
  canvas: number
  fontSize: number          // px
  charPx: number            // approx mono char width at fontSize
  maxChars: number          // truncate label to this many chars
  padX: number              // rect horizontal padding around text
  padY: number              // rect vertical padding around text
  linkDistance: number
  chargeStrength: number
}

const COMPACT_MODE: SizeMode = {
  canvas: COMPACT_SIZE,
  fontSize: 10,
  charPx: 5.6,
  maxChars: 11,
  padX: 6,
  padY: 4,
  linkDistance: 70,
  chargeStrength: -260,
}

const EXPANDED_MODE: SizeMode = {
  canvas: EXPANDED_SIZE,
  fontSize: 13,
  charPx: 7.2,
  maxChars: 22,
  padX: 10,
  padY: 6,
  linkDistance: 160,
  chargeStrength: -800,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function deriveId(node: MeshNode, isCentre: boolean): string {
  if (isCentre) return '__center__'
  if (node.href) {
    const parts = node.href.split('/')
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return node.label
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, Math.max(1, max - 1)).trimEnd() + '…'
}

function estimateBoxWidth(label: string, mode: SizeMode): number {
  const text = truncate(label, mode.maxChars)
  return text.length * mode.charPx + mode.padX * 2
}

function boxHeight(mode: SizeMode): number {
  return mode.fontSize + mode.padY * 2
}

// ── Inner canvas (re-mounts when canvasSize changes via parent's key prop) ──

function GraphCanvas({
  meshNodes,
  links,
  mode,
  isExpanded,
}: {
  meshNodes: MeshNode[]
  links: Array<{ source: string; target: string }>
  mode: SizeMode
  isExpanded: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverState, setHoverState] = useState<HoverState>(null)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    // ── Build simulation data ─────────────────────────────────────────────
    const nodeIds = meshNodes.map((n, i) => deriveId(n, i === 0))
    const simNodes: SimNode[] = meshNodes.map((n, i) => ({
      id: nodeIds[i] as string,
      label: n.label,
      isCenter: i === 0,
      href: n.href,
      readingMinutes: n.readingMinutes,
    }))
    const idToNode = new Map(simNodes.map(n => [n.id, n]))

    const simLinks: SimLink[] = []
    // Spokes: center → each neighbour
    const center = simNodes[0]
    if (center) {
      for (let i = 1; i < simNodes.length; i++) {
        const target = simNodes[i]
        if (target) simLinks.push({ source: center, target, type: 'spoke' })
      }
    }
    // Inter-neighbour edges from props (already slug-keyed)
    for (const l of links) {
      const s = idToNode.get(l.source)
      const t = idToNode.get(l.target)
      if (s && t) simLinks.push({ source: s, target: t, type: 'inter' })
    }

    // Per-node box dimensions
    const dims = new Map<string, { w: number; h: number }>()
    for (const n of simNodes) {
      dims.set(n.id, {
        w: estimateBoxWidth(n.label, mode),
        h: boxHeight(mode),
      })
    }

    // Approximate collide radius from box dimensions
    const collideOf = (n: SimNode): number => {
      const d = dims.get(n.id)
      if (!d) return 20
      // Treat box as a circle whose radius is the half-diagonal, slightly relaxed.
      return Math.sqrt(d.w * d.w + d.h * d.h) / 2 + 4
    }

    // ── Run force simulation deterministically ────────────────────────────
    const sim = d3Force
      .forceSimulation<SimNode>(simNodes)
      .alphaDecay(0.04)
      .force(
        'link',
        d3Force
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d: SimNode) => d.id)
          .distance(mode.linkDistance),
      )
      .force('charge', d3Force.forceManyBody<SimNode>().strength(mode.chargeStrength))
      .force('center', d3Force.forceCenter(mode.canvas / 2, mode.canvas / 2))
      .force('collide', d3Force.forceCollide<SimNode>(collideOf))
      .stop()

    for (let i = 0; i < 200; i++) sim.tick()

    // ── DOM setup ─────────────────────────────────────────────────────────
    const svg = d3Selection.select(svgEl)
    svg.selectAll('*').remove()
    const root = svg.append('g').attr('class', 'graph-root')

    // Links
    const linkSel = root
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('data-edge-type', d => d.type)
      .attr('x1', d => d.source.x ?? 0)
      .attr('y1', d => d.source.y ?? 0)
      .attr('x2', d => d.target.x ?? 0)
      .attr('y2', d => d.target.y ?? 0)

    // Node groups (each = <g><rect/><text/></g>)
    const nodeSel = root
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g.node')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .attr('data-kind', d => (d.isCenter ? 'center' : 'neighbor'))
      .attr('tabindex', d => (d.isCenter ? -1 : 0))
      .attr('role', 'button')
      .attr('aria-label', d => d.label)
      .style('cursor', d => (d.isCenter ? 'default' : 'pointer'))
      .attr('transform', d => `translate(${d.x ?? 0}, ${d.y ?? 0})`)

    // Rect background — sized from precomputed box dims
    nodeSel
      .append('rect')
      .attr('x', d => -(dims.get(d.id)?.w ?? 0) / 2)
      .attr('y', d => -(dims.get(d.id)?.h ?? 0) / 2)
      .attr('width', d => dims.get(d.id)?.w ?? 0)
      .attr('height', d => dims.get(d.id)?.h ?? 0)
      .attr('rx', 2)
      .attr('ry', 2)

    // Text label — truncated to fit the box
    nodeSel
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', mode.fontSize)
      .text(d => truncate(d.label, mode.maxChars))

    // Accessibility tooltip
    nodeSel.append('title').text(d => d.label)

    // ── Interactions ──────────────────────────────────────────────────────
    let dragged = false

    const dragBehavior = d3Drag
      .drag<SVGGElement, SimNode>()
      .on('start', (_event, d) => {
        dragged = false
        d.fx = d.x ?? 0
        d.fy = d.y ?? 0
      })
      .on('drag', (event, d) => {
        dragged = true
        d.fx = event.x
        d.fy = event.y
        // Update position immediately
        d3Selection
          .select<SVGGElement, SimNode>(event.sourceEvent.target.closest('g.node') as SVGGElement)
          .attr('transform', `translate(${event.x}, ${event.y})`)
        // Update connected links
        linkSel
          .filter((l: SimLink) => l.source === d || l.target === d)
          .attr('x1', (l: SimLink) => l.source.x ?? 0)
          .attr('y1', (l: SimLink) => l.source.y ?? 0)
          .attr('x2', (l: SimLink) => l.target.x ?? 0)
          .attr('y2', (l: SimLink) => l.target.y ?? 0)
      })
      .on('end', (_event, d) => {
        // Keep pinned at drop location (don't release fx/fy, matches Obsidian)
        d.fx = d.x ?? null
        d.fy = d.y ?? null
      })

    nodeSel.call(dragBehavior)

    // Click → navigate (skip if drag occurred)
    nodeSel.on('click', (_event, d) => {
      if (dragged) return
      if (d.href) window.location.href = d.href
    })

    // Hover/focus → label state for fixed-position popover
    nodeSel
      .on('mouseenter', (event: MouseEvent, d) => {
        setHoverState({ node: d, x: event.clientX, y: event.clientY })
      })
      .on('mousemove', (event: MouseEvent, d) => {
        setHoverState({ node: d, x: event.clientX, y: event.clientY })
      })
      .on('mouseleave', () => setHoverState(null))
      .on('focus', (event: FocusEvent, d) => {
        const rect = (event.currentTarget as SVGGElement).getBoundingClientRect()
        setHoverState({ node: d, x: rect.right, y: rect.top })
      })
      .on('blur', () => setHoverState(null))
      .on('keydown', (event: KeyboardEvent, d) => {
        if ((event.key === 'Enter' || event.key === ' ') && d.href) {
          event.preventDefault()
          window.location.href = d.href
        }
      })

    // Zoom on the SVG
    const zoomBehavior = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .filter((event: Event) => {
        // Only allow zoom on wheel + non-node area pan (not on node drag)
        if (event.type === 'wheel') return true
        const target = event.target as Element | null
        return !target?.closest('g.node')
      })
      .on('zoom', (event: d3Zoom.D3ZoomEvent<SVGSVGElement, unknown>) => {
        root.attr('transform', event.transform.toString())
      })

    svg.call(zoomBehavior)

    return () => {
      sim.stop()
      svg.on('.zoom', null)
      svg.selectAll('*').remove()
    }
  }, [meshNodes, links, mode, isExpanded])

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${mode.canvas} ${mode.canvas}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
        aria-label="Related notes graph"
        role="img"
      />
      {hoverState && (
        <div
          className={styles.label}
          style={{
            left: `${hoverState.x + 12}px`,
            top: `${hoverState.y + 8}px`,
          }}
          role="tooltip"
        >
          {hoverState.node.label}
          {hoverState.node.readingMinutes != null && (
            <span className={styles.labelMeta}> · {hoverState.node.readingMinutes} min</span>
          )}
        </div>
      )}
    </>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PostMeshGraph({ nodes, links }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Esc to close + body scroll lock while expanded.
  useEffect(() => {
    if (!isExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [isExpanded])

  return (
    <>
      <div className={styles.wrap}>
        <button
          type="button"
          className={styles.expandBtn}
          onClick={() => setIsExpanded(true)}
          aria-label="크게 보기"
          title="크게 보기"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M1 4V1h3M11 4V1H8M1 8v3h3M11 8v3H8" />
          </svg>
        </button>
        <GraphCanvas
          key="compact"
          meshNodes={nodes}
          links={links}
          mode={COMPACT_MODE}
          isExpanded={false}
        />
      </div>

      {isExpanded && (
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label="관련 그래프 확대 보기"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsExpanded(false)
          }}
        >
          <div className={styles.modalInner}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setIsExpanded(false)}
              aria-label="닫기"
              title="닫기 (Esc)"
            >
              ×
            </button>
            <GraphCanvas
              key="expanded"
              meshNodes={nodes}
              links={links}
              mode={EXPANDED_MODE}
              isExpanded={true}
            />
          </div>
        </div>
      )}
    </>
  )
}
