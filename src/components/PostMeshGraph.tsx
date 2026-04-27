/**
 * PostMeshGraph.tsx — interactive force-directed mini graph for the reader aside.
 *
 * Renders a compact D3-force graph (280×280 SVG) showing the current note/post
 * as a centre node connected by spokes to its neighbours, with optional
 * inter-neighbour edges where wikilink relationships exist.
 *
 * Consumed by post and note Astro page layouts as a React island:
 *   <PostMeshGraph client:load nodes={meshNodes} links={meshLinks} />
 *
 * Props:
 *   nodes — MeshNode[], index 0 = centre (current page), 1..N = neighbours.
 *           Centre node has no href; neighbours carry href, excerpt, readingMinutes.
 *   links — inter-neighbour edges keyed by slug (from getNoteMeshLinks).
 *           The component synthesises centre→neighbour spokes internally.
 *
 * ID derivation (important — explains the source/target match):
 *   Each MeshNode's href looks like "/meshblog/notes/<slug>".
 *   We extract the last path segment as the synthetic graph node id.
 *   Centre node has no href → id = '__center__'.
 *   The links prop already uses slugs as source/target (from backlinks.json),
 *   so they match the derived ids for neighbours.
 *   Spokes use source='__center__', target=derived-slug.
 *
 * Visual differentiation:
 *   Centre  → type='concept'  → data-kind="concept" → CSS: fill var(--ink)
 *   Neighbours → type='note'  → data-kind="note"    → CSS: fill var(--paper), stroke var(--ink-3)
 *   Hover-invert on neighbours (invariant #3).
 *
 * Editorial invariants: #1 no hex, #2 hairline border, #3 hover-invert,
 *                       #5 no shadow.  All enforced in PostMeshGraph.module.css.
 */

import { useRef, useState } from 'react'
import type { MeshNode } from '../lib/mesh-data'
import type { GraphJson, GraphNode } from './graph/types'
import { useForceSimulation } from './graph/useForceSimulation'
import type { HoverState } from './graph/useForceSimulation'
import styles from './PostMeshGraph.module.css'

// ── Types ───────────────────────────────────────────────────────────────────

type Props = {
  /** MeshNode[]: index 0 = centre (current post/note), 1..N = neighbours */
  nodes: MeshNode[]
  /** Inter-neighbour edges keyed by slug (source/target). Spokes are implicit. */
  links: Array<{ source: string; target: string }>
}

// ── ID derivation helper ────────────────────────────────────────────────────

/**
 * Derive a stable graph node id from a MeshNode.
 * Neighbours have href="/meshblog/notes/<slug>" → extract the last segment.
 * Centre node has no href → use '__center__'.
 */
function deriveId(node: MeshNode, isCentre: boolean): string {
  if (isCentre) return '__center__'
  if (node.href) {
    const parts = node.href.split('/')
    const last = parts[parts.length - 1]
    if (last) return last
  }
  // Fallback to label (deduplication-safe at this scale, ≤9 nodes)
  return node.label
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PostMeshGraph({ nodes, links }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverState, setHoverState] = useState<HoverState>(null)

  // ── Build GraphJson from props ──────────────────────────────────────────

  // Derive an id for each node once so we can reference them consistently.
  const nodeIds = nodes.map((n, i) => deriveId(n, i === 0))

  const graphJson: GraphJson = {
    nodes: nodes.map((n, i) => {
      const id = nodeIds[i]
      const isCentre = i === 0

      return {
        id,
        label: n.label,
        // Centre → 'concept' (r=7 from hook, data-kind="concept" → CSS fills ink).
        // Neighbours → 'note' (r=5, data-kind="note" → CSS outline only, hover-invert).
        type: isCentre ? 'concept' : 'note',
        level: 1,
        // pagerank=0 → nodeRadius() returns base value (5 for note, 7 for concept).
        pagerank: 0,
        pinned: false,
        // Pass through optional hover metadata so the popover can use them.
        // GraphNode doesn't have these fields, but the hook forwards the full
        // node object to onHover so we can cast and read them in the popover.
        ...(n.excerpt !== undefined ? { excerpt: n.excerpt } : {}),
        ...(n.readingMinutes !== undefined ? { readingMinutes: n.readingMinutes } : {}),
        ...(n.href !== undefined ? { href: n.href } : {}),
      } satisfies GraphNode & { excerpt?: string; readingMinutes?: number; href?: string }
    }),
    links: [
      // Synthesise centre→neighbour spokes (the parent doesn't pass these).
      ...nodeIds.slice(1).map(nid => ({
        source: '__center__',
        target: nid,
        weight: 1,
        // No data-edge-type on spokes — CSS defaults to opacity 0.7.
        type: 'spoke' as const,
      })),
      // Inter-neighbour edges from the backlinks dataset — already slug-keyed.
      ...links.map(l => ({
        source: l.source,
        target: l.target,
        weight: 1,
        // data-edge-type="inter" → CSS sets opacity 0.4 (more subtle than spokes).
        type: 'inter' as const,
      })),
    ],
  }

  // ── Hook integration ─────────────────────────────────────────────────────

  useForceSimulation(svgRef, graphJson, {
    onNodeClick: (node: GraphNode) => {
      // Navigate to the neighbour's page when its circle is clicked.
      // Centre node (id='__center__') has no href → skip.
      // Find the original MeshNode index by matching the derived id.
      const idx = nodeIds.findIndex(id => id === node.id)
      if (idx > 0) {
        const href = (node as GraphNode & { href?: string }).href
        if (href) {
          window.location.href = href
        }
      }
    },
    onHover: setHoverState,
    directed: false,
    colorByCategory: false,
    // Tuned for a small ≤9-node graph: tighter link distance, weaker charge.
    simParams: {
      linkDistance: 50,
      chargeStrength: -90,
      collideRadius: 12,
      scaleExtent: [0.5, 2.5],
    },
    // Small graph — skip stagger; CSS handles the single 150ms fade-in.
    staggerEnabled: false,
  })

  // ── Render ───────────────────────────────────────────────────────────────

  // Resolve hover metadata from the extended node fields.
  // The hook passes the full GraphNode object, which we extended with extra fields above.
  const hoverNode = hoverState?.node as (GraphNode & { readingMinutes?: number }) | undefined

  return (
    <div className={styles.wrap}>
      {/* 280×280 force-directed graph */}
      <svg
        ref={svgRef}
        viewBox="0 0 280 280"
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
        aria-label="Related notes graph"
        role="img"
      />

      {/* Single-line hover label — replaces hook's hidden SVG text labels.
          position: fixed anchors to clientX/clientY from the hook's mouseenter handler. */}
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
          {hoverNode?.readingMinutes != null && (
            <span className={styles.labelMeta}> · {hoverNode.readingMinutes} min</span>
          )}
        </div>
      )}
    </div>
  )
}
