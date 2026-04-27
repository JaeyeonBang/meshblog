/**
 * PostMeshGraph.tsx — interactive force-directed mini graph for the reader aside.
 *
 * Renders a compact D3-force graph (default 280px) showing the current note/post
 * as a centre node connected by spokes to its neighbours, with optional
 * inter-neighbour edges where wikilink relationships exist.
 *
 * Two modes:
 *   - inline (default) — fits inside the right reader-aside.
 *   - expanded — full-screen modal overlay (~720px graph) for closer inspection.
 *
 * Consumed by post and note Astro page layouts as a React island:
 *   <PostMeshGraph client:visible nodes={meshNodes} links={meshLinks} />
 *
 * Props:
 *   nodes — MeshNode[], index 0 = centre (current page), 1..N = neighbours.
 *   links — inter-neighbour edges keyed by slug (from getNoteMeshLinks).
 *           The component synthesises centre→neighbour spokes internally.
 *
 * ID derivation:
 *   Each MeshNode's href looks like "/meshblog/notes/<slug>".
 *   We extract the last path segment as the synthetic graph node id.
 *   Centre node has no href → id = '__center__'.
 *
 * Editorial invariants: #1 no hex, #2 hairline border, #3 hover-invert,
 *                       #5 no shadow.  All enforced in PostMeshGraph.module.css.
 */

import { useEffect, useRef, useState } from 'react'
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

const COMPACT_SIZE = 280
const EXPANDED_SIZE = 720

// ── ID derivation helper ────────────────────────────────────────────────────

function deriveId(node: MeshNode, isCentre: boolean): string {
  if (isCentre) return '__center__'
  if (node.href) {
    const parts = node.href.split('/')
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return node.label
}

// ── Inner canvas (re-mounts when canvasSize changes via parent's key prop) ──

function GraphCanvas({
  graphJson,
  nodeIds,
  nodes,
  canvasSize,
  isExpanded,
}: {
  graphJson: GraphJson
  nodeIds: string[]
  nodes: MeshNode[]
  canvasSize: number
  isExpanded: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverState, setHoverState] = useState<HoverState>(null)

  useForceSimulation(svgRef, graphJson, {
    onNodeClick: (node: GraphNode) => {
      const idx = nodeIds.findIndex(id => id === node.id)
      if (idx > 0) {
        const href = (node as GraphNode & { href?: string }).href
        if (href) window.location.href = href
      }
    },
    onHover: setHoverState,
    directed: false,
    colorByCategory: false,
    simParams: {
      // Scale forces with canvas size so layout reads well at both 280px and 720px.
      linkDistance: isExpanded ? 110 : 50,
      chargeStrength: isExpanded ? -260 : -90,
      collideRadius: isExpanded ? 22 : 12,
      scaleExtent: [0.5, 3],
      // Explicit canvas dims defeat clientWidth=0 race during client:visible hydration.
      canvasWidth: canvasSize,
      canvasHeight: canvasSize,
    },
    staggerEnabled: false,
  })

  // Suppress unused 'nodes' warning — kept on the signature for future extension.
  void nodes

  const hoverNode = hoverState?.node as (GraphNode & { readingMinutes?: number }) | undefined

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${canvasSize} ${canvasSize}`}
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
          {hoverNode?.readingMinutes != null && (
            <span className={styles.labelMeta}> · {hoverNode.readingMinutes} min</span>
          )}
        </div>
      )}
    </>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PostMeshGraph({ nodes, links }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Build GraphJson once per props change.
  const nodeIds = nodes.map((n, i) => deriveId(n, i === 0))

  const graphJson: GraphJson = {
    nodes: nodes.map((n, i) => {
      const isCentre = i === 0
      return {
        id: nodeIds[i] as string,
        label: n.label,
        type: isCentre ? 'concept' : 'note',
        level: 1,
        pagerank: 0,
        pinned: false,
        ...(n.excerpt !== undefined ? { excerpt: n.excerpt } : {}),
        ...(n.readingMinutes !== undefined ? { readingMinutes: n.readingMinutes } : {}),
        ...(n.href !== undefined ? { href: n.href } : {}),
      } satisfies GraphNode & { excerpt?: string; readingMinutes?: number; href?: string }
    }),
    links: [
      ...nodeIds.slice(1).map(nid => ({
        source: '__center__',
        target: nid,
        weight: 1,
        type: 'spoke' as const,
      })),
      ...links.map(l => ({
        source: l.source,
        target: l.target,
        weight: 1,
        type: 'inter' as const,
      })),
    ],
  }

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
          graphJson={graphJson}
          nodeIds={nodeIds}
          nodes={nodes}
          canvasSize={COMPACT_SIZE}
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
            // Click on backdrop (not graph) closes.
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
              graphJson={graphJson}
              nodeIds={nodeIds}
              nodes={nodes}
              canvasSize={EXPANDED_SIZE}
              isExpanded={true}
            />
          </div>
        </div>
      )}
    </>
  )
}
