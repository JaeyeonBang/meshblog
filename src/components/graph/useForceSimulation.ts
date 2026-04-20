import { useEffect } from 'react'
import type { RefObject } from 'react'
import * as d3Force from 'd3-force'
import * as d3Selection from 'd3-selection'
import * as d3Zoom from 'd3-zoom'
import * as d3Drag from 'd3-drag'
import type { GraphNode, GraphLink, GraphJson } from './types'

type SimNode = GraphNode & d3Force.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode; weight: number }

function nodeRadius(pagerank: number): number {
  return Math.max(4, Math.sqrt(pagerank * 1000))
}

// Node colour is painted entirely via CSS tokens in GraphView.module.css
// (.svg .nodes circle { fill: var(--meshblog-graph-node) })
// so no JS colour function is needed.

export function useForceSimulation(
  svgRef: RefObject<SVGSVGElement | null>,
  graph: GraphJson | null,
  opts: { onNodeClick?: (n: GraphNode) => void },
): void {
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || !graph || graph.nodes.length === 0) return

    const width = svgEl.clientWidth || 800
    const height = svgEl.clientHeight || 600

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
        return { source: s, target: t, weight: l.weight }
      })
      .filter((l): l is SimLink => l !== null)

    // --- Simulation ---
    const simulation = d3Force
      .forceSimulation<SimNode>(nodes)
      .alphaDecay(0.02)
      .force(
        'link',
        d3Force
          .forceLink<SimNode, SimLink>(links)
          .id(d => d.id)
          .distance(60),
      )
      .force('charge', d3Force.forceManyBody<SimNode>().strength(-120))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collide', d3Force.forceCollide<SimNode>(10))
      .stop()

    // Deterministic layout: run 60 ticks synchronously (Patch C3)
    for (let i = 0; i < 60; i++) {
      simulation.tick()
    }
    simulation.stop()

    // --- DOM setup ---
    const svg = d3Selection.select(svgEl)
    svg.selectAll('*').remove()

    const g = svg.append('g').attr('class', 'graph-container')

    // Links
    const linkSel = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.max(0.5, d.weight))
      .attr('x1', d => d.source.x ?? 0)
      .attr('y1', d => d.source.y ?? 0)
      .attr('x2', d => d.target.x ?? 0)
      .attr('y2', d => d.target.y ?? 0)

    // Nodes
    const nodeSel = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => nodeRadius(d.pagerank))
      // fill + stroke painted by CSS tokens via GraphView.module.css
      .attr('cx', d => d.x ?? 0)
      .attr('cy', d => d.y ?? 0)
      .attr('tabindex', 0)
      .attr('aria-label', d => d.label)
      .style('cursor', 'pointer')

    // Labels
    const labelSel = g
      .append('g')
      .attr('class', 'labels')
      .selectAll<SVGTextElement, SimNode>('text')
      .data(nodes)
      .join('text')
      .attr('font-size', 10)
      // fill painted by CSS tokens via GraphView.module.css
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeRadius(d.pagerank) + 12)
      .attr('x', d => d.x ?? 0)
      .attr('y', d => d.y ?? 0)
      .style('pointer-events', 'none')
      .text(d => d.label)

    // --- Zoom ---
    const zoomBehavior = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
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
