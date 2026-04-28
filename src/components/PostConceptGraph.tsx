/**
 * PostConceptGraph.tsx — per-post concept subgraph mini view.
 *
 * Visual contract: matches /graph?mode=concept&level=3 — circles coloured by
 * Louvain cluster index (cluster mod 12 → --cat-cN palette slot), labels
 * float beneath, hairline edges. Compact (sticky in sidebar) + expanded
 * (modal) modes mirror PostMeshGraph.
 *
 * Data shape arrives from getPostConceptGraph in src/lib/mesh-data.ts:
 *   nodes: { id, label, cluster, pagerank, weight }
 *   links: { source, target, weight }
 *
 * Editorial invariants honoured: #1 no hex, #2 hairline 1px, #3 hover-invert,
 *                                 #5 no shadow, #6 radius ≤ 4px.
 */

import { useEffect, useRef, useState } from 'react'
import * as d3Force from 'd3-force'
import * as d3Selection from 'd3-selection'
import * as d3Drag from 'd3-drag'
import * as d3Zoom from 'd3-zoom'
import styles from './PostMeshGraph.module.css'
import './PostConceptGraph.css'

export type ConceptNode = {
  id: string
  label: string
  cluster: number
  pagerank: number
  weight: number
}

export type ConceptLink = { source: string; target: string; weight: number }

type Props = {
  nodes: ConceptNode[]
  links: ConceptLink[]
}

type SimNode = d3Force.SimulationNodeDatum & ConceptNode
type SimLink = { source: SimNode; target: SimNode; weight: number }

type Mode = {
  canvas: number
  fontSize: number
  baseRadius: number
  linkDistance: number
  chargeStrength: number
}

const COMPACT_MODE: Mode = {
  canvas: 280,
  fontSize: 10,
  baseRadius: 6,
  linkDistance: 60,
  chargeStrength: -180,
}

const EXPANDED_MODE: Mode = {
  canvas: 720,
  fontSize: 12,
  baseRadius: 8,
  linkDistance: 110,
  chargeStrength: -380,
}

function radiusOf(n: ConceptNode, mode: Mode): number {
  // Mix pagerank + entity-overlap weight so ranked concepts pop.
  const pr = Math.sqrt(Math.max(0, n.pagerank) * 1000)
  const w = Math.sqrt(Math.max(1, n.weight))
  return Math.max(mode.baseRadius, mode.baseRadius + pr * 0.4 + w * 1.2)
}

function GraphCanvas({ nodes, links, mode }: { nodes: ConceptNode[]; links: ConceptLink[]; mode: Mode }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || nodes.length === 0) return

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }))
    const idToNode = new Map(simNodes.map((n) => [n.id, n]))
    const simLinks: SimLink[] = links
      .map((l) => {
        const s = idToNode.get(l.source)
        const t = idToNode.get(l.target)
        if (!s || !t) return null
        return { source: s, target: t, weight: l.weight }
      })
      .filter((l): l is SimLink => l !== null)

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
      .force('collide', d3Force.forceCollide<SimNode>((d) => radiusOf(d, mode) + 6))
      .stop()

    for (let i = 0; i < 200; i++) sim.tick()

    const svg = d3Selection.select(svgEl)
    svg.selectAll('*').remove()
    const root = svg.append('g').attr('class', 'graph-root')

    const linkSel = root
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke-width', (d) => Math.max(1, 0.7 + Math.sqrt(d.weight) * 0.6))
      .attr('x1', (d) => d.source.x ?? 0)
      .attr('y1', (d) => d.source.y ?? 0)
      .attr('x2', (d) => d.target.x ?? 0)
      .attr('y2', (d) => d.target.y ?? 0)

    const nodeSel = root
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => radiusOf(d, mode))
      .attr('cx', (d) => d.x ?? 0)
      .attr('cy', (d) => d.y ?? 0)
      .attr('data-cat-idx', (d) => String(d.cluster % 12))
      .attr('aria-label', (d) => d.label)
      .attr('tabindex', 0)
      .style('cursor', 'pointer')

    nodeSel.append('title').text((d) => d.label)

    const labelSel = root
      .append('g')
      .attr('class', 'labels')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(simNodes)
      .join('text')
      .attr('font-size', mode.fontSize)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => radiusOf(d, mode) + 12)
      .attr('x', (d) => d.x ?? 0)
      .attr('y', (d) => d.y ?? 0)
      .style('pointer-events', 'none')
      .text((d) => d.label)

    const dragBehavior = d3Drag
      .drag<SVGCircleElement, SimNode>()
      .on('start', (_e, d) => {
        d.fx = d.x ?? 0
        d.fy = d.y ?? 0
      })
      .on('drag', (e, d) => {
        d.fx = e.x
        d.fy = e.y
        d.x = e.x
        d.y = e.y
        d3Selection.select(e.sourceEvent.target as SVGCircleElement).attr('cx', e.x).attr('cy', e.y)
        linkSel
          .filter((l) => l.source === d || l.target === d)
          .attr('x1', (l) => l.source.x ?? 0)
          .attr('y1', (l) => l.source.y ?? 0)
          .attr('x2', (l) => l.target.x ?? 0)
          .attr('y2', (l) => l.target.y ?? 0)
        labelSel.filter((n) => n === d).attr('x', e.x).attr('y', e.y)
      })
      .on('end', (_e, d) => {
        d.fx = d.x ?? null
        d.fy = d.y ?? null
      })

    nodeSel.call(dragBehavior)

    const zoomBehavior = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .filter((event: Event) => {
        if (event.type === 'wheel') return true
        const target = event.target as Element | null
        return !target?.closest('circle')
      })
      .on('zoom', (event) => {
        root.attr('transform', event.transform.toString())
      })

    svg.call(zoomBehavior)

    return () => {
      sim.stop()
      svg.on('.zoom', null)
      svg.selectAll('*').remove()
    }
  }, [nodes, links, mode])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${mode.canvas} ${mode.canvas}`}
      preserveAspectRatio="xMidYMid meet"
      className={styles.svg}
      aria-label="post concept graph"
      role="img"
    />
  )
}

export default function PostConceptGraph({ nodes, links }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!isExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isExpanded])

  if (nodes.length === 0) return null

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
        <GraphCanvas key="compact" nodes={nodes} links={links} mode={COMPACT_MODE} />
      </div>

      {isExpanded && (
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label="concept graph 확대 보기"
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
            <GraphCanvas key="expanded" nodes={nodes} links={links} mode={EXPANDED_MODE} />
          </div>
        </div>
      )}
    </>
  )
}
