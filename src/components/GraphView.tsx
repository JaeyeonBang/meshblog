import { useEffect, useRef, useState, useCallback } from 'react'
import type { GraphJson, Manifest, GraphNode } from './graph/types'
import { useForceSimulation } from './graph/useForceSimulation'
import type { HoverState } from './graph/useForceSimulation'
import { HoverCard } from './graph/HoverCard'
import { withBase } from '../lib/url'
import styles from './GraphView.module.css'

/** Shape of public/graph/backlinks.json (mirrors BacklinksJson from build-backlinks.ts) */
type BacklinksJson = {
  nodes: Array<{ id: string; title: string }>
  edges: Array<{ source: string; target: string; alias?: string }>
}

type Mode = 'note' | 'concept' | 'backlinks'
type Level = 1 | 2 | 3
type Status = 'loading' | 'ready' | 'error' | 'empty'

function getInitialMode(): Mode {
  if (typeof window === 'undefined') return 'note'
  const p = new URLSearchParams(window.location.search).get('mode')
  if (p === 'concept') return 'concept'
  if (p === 'backlinks') return 'backlinks'
  return 'note'
}

/** Convert BacklinksJson into the GraphJson shape used by useForceSimulation */
function backlinksToGraphJson(bl: BacklinksJson): GraphJson {
  return {
    nodes: bl.nodes.map(n => ({
      id: n.id,
      label: n.title,
      type: 'note' as const,
      level: 3 as const,
      pagerank: 0,
      pinned: false,
    })),
    links: bl.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: 1,
    })),
  }
}

function getInitialLevel(): Level {
  if (typeof window === 'undefined') return 1
  const p = Number(new URLSearchParams(window.location.search).get('level') ?? '1')
  return p === 2 || p === 3 ? (p as Level) : 1
}

/**
 * Mobile / touch tap tracking.
 * First tap: show popover (via onHover), don't navigate.
 * Second tap on the same node within 600ms: navigate.
 */
type TapState = { nodeId: string; ts: number } | null

export default function GraphView() {
  const [mode, setMode] = useState<Mode>(getInitialMode)
  const [level, setLevel] = useState<Level>(getInitialLevel)
  const [graph, setGraph] = useState<GraphJson | null>(null)
  const [manifest, setManifest] = useState<Manifest>({})
  const [status, setStatus] = useState<Status>('loading')
  const [retry, setRetry] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  // Hover popover state
  const [hoverState, setHoverState] = useState<HoverState>(null)
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mobile double-tap state
  const tapRef = useRef<TapState>(null)

  /** Debounced hover handler: 200ms delay on clear prevents flicker */
  const handleHover = useCallback((state: HoverState) => {
    if (hoverLeaveTimer.current) {
      clearTimeout(hoverLeaveTimer.current)
      hoverLeaveTimer.current = null
    }
    if (state) {
      setHoverState(state)
    } else {
      hoverLeaveTimer.current = setTimeout(() => {
        setHoverState(null)
      }, 200)
    }
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
    }
  }, [])

  // Listen for toolbar CustomEvents from GraphControls.astro
  useEffect(() => {
    const onSetMode = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (detail === 'note' || detail === 'concept' || detail === 'backlinks') setMode(detail as Mode)
    }
    const onSetLevel = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail
      const n = Number(detail)
      if (n === 1 || n === 2 || n === 3) setLevel(n as Level)
    }
    window.addEventListener('graph:setMode', onSetMode)
    window.addEventListener('graph:setLevel', onSetLevel)
    return () => {
      window.removeEventListener('graph:setMode', onSetMode)
      window.removeEventListener('graph:setLevel', onSetLevel)
    }
  }, [])

  // Fetch graph + manifest whenever mode/level/retry changes
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setGraph(null)

    // Update aria-busy on canvas while loading
    const canvasEl = document.getElementById('graphCanvas')
    if (canvasEl) canvasEl.setAttribute('aria-busy', 'true')

    // Show loading overlay, hide others
    const loadingEl = document.getElementById('graphLoadingState')
    const emptyEl = document.getElementById('graphEmptyState')
    const errorEl = document.getElementById('graphErrorState')
    if (loadingEl) loadingEl.setAttribute('aria-hidden', 'false')
    if (emptyEl) emptyEl.setAttribute('aria-hidden', 'true')
    if (errorEl) {
      errorEl.hidden = true
      errorEl.setAttribute('aria-hidden', 'true')
    }

    const graphUrl =
      mode === 'backlinks'
        ? withBase('/graph/backlinks.json')
        : withBase(`/graph/${mode}-l${level}.json`)

    const graphFetch =
      mode === 'backlinks'
        ? fetch(graphUrl).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json().then((bl: BacklinksJson) => backlinksToGraphJson(bl))
          })
        : fetch(graphUrl).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json() as Promise<GraphJson>
          })

    Promise.all([
      graphFetch,
      fetch(withBase('/notes-manifest.json'))
        .then(r => r.json() as Promise<Manifest>)
        .catch(() => ({} as Manifest)),
    ])
      .then(([g, m]) => {
        if (cancelled) return
        setGraph(g)
        setManifest(m)
        const nextStatus: Status = g.nodes.length === 0 ? 'empty' : 'ready'
        setStatus(nextStatus)

        // Remove aria-busy on canvas
        if (canvasEl) canvasEl.removeAttribute('aria-busy')

        // Hide loading overlay
        if (loadingEl) loadingEl.setAttribute('aria-hidden', 'true')

        if (nextStatus === 'empty') {
          if (emptyEl) emptyEl.setAttribute('aria-hidden', 'false')
        } else {
          if (emptyEl) emptyEl.setAttribute('aria-hidden', 'true')
        }
        // Ensure error-state overlay is hidden on success
        if (errorEl) {
          errorEl.hidden = true
          errorEl.setAttribute('aria-hidden', 'true')
        }

        // Dispatch graph:state for toolbar sync
        window.dispatchEvent(new CustomEvent('graph:state', {
          detail: { mode, level, nodes: g.nodes, linksCount: g.links.length }
        }))
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')

        // Remove aria-busy on canvas
        if (canvasEl) canvasEl.removeAttribute('aria-busy')

        // Hide loading + empty overlays, show error
        if (loadingEl) loadingEl.setAttribute('aria-hidden', 'true')
        if (emptyEl) emptyEl.setAttribute('aria-hidden', 'true')
        if (errorEl) {
          errorEl.hidden = false
          errorEl.setAttribute('aria-hidden', 'false')
        }
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, level, retry])

  // Sync URL without triggering navigation + dispatch graph:state on mode/level change
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams({ mode, level: String(level) })
    history.replaceState(null, '', `?${q.toString()}`)
    // Dispatch state even if graph not yet loaded (nodes: [] fallback)
    window.dispatchEvent(new CustomEvent('graph:state', {
      detail: { mode, level, nodes: graph?.nodes ?? [], linksCount: graph?.links.length ?? 0 }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, level])

  // Wire Astro overlay retry button to React retry mechanism
  useEffect(() => {
    const handler = () => {
      // Hide error overlay before re-fetching
      const errorEl = document.getElementById('graphErrorState')
      if (errorEl) {
        errorEl.hidden = true
        errorEl.setAttribute('aria-hidden', 'true')
      }
      setRetry(r => r + 1)
    }
    window.addEventListener('graph:retry', handler)
    return () => window.removeEventListener('graph:retry', handler)
  }, [])

  useForceSimulation(svgRef, graph, {
    onNodeClick: (node: GraphNode) => {
      const entry = manifest[node.id]
      const href = entry ? withBase(entry.href) : null

      // Always dispatch graph:select so the sidebar updates instantly
      window.dispatchEvent(new CustomEvent('graph:select', {
        detail: {
          id: node.id,
          label: node.label,
          type: node.type,
          href,
        },
      }))

      // Mobile double-tap: first tap → select/popover; second tap on same node → navigate
      const isTouchDevice = window.matchMedia('(hover: none)').matches
      if (isTouchDevice) {
        const prev = tapRef.current
        const now = Date.now()
        if (prev && prev.nodeId === node.id && now - prev.ts < 600) {
          // Second tap → navigate
          tapRef.current = null
          if (href) window.location.href = href
        } else {
          // First tap → record for double-tap detection
          tapRef.current = { nodeId: node.id, ts: now }
        }
        return
      }

      // Pointer device: navigate directly
      if (href) {
        window.location.href = href
      }
    },
    directed: mode === 'backlinks',
    onHover: handleHover,
  })

  // Derive popover props from hover state + manifest
  const hoveredEntry = hoverState ? manifest[hoverState.node.id] : null
  const hoverExcerpt = hoveredEntry?.excerpt ?? null
  const hoverHref = hoveredEntry ? withBase(hoveredEntry.href) : null

  return (
    <div
      className={styles.root}
      role="region"
      aria-label="knowledge graph"
      aria-describedby="graphNodesList"
    >
      {/* Screen-reader node list */}
      <ul id="graphNodesList" className="sr-only" aria-label="graph nodes list">
        {graph?.nodes.map(n => {
          const m = manifest[n.id]
          return (
            <li key={n.id}>
              {m ? <a href={withBase(m.href)}>{n.label}</a> : <span>{n.label}</span>}
            </li>
          )
        })}
      </ul>

      {/* SVG — always rendered so svgRef is stable.
           Arrowhead <defs> for backlinks mode are injected by useForceSimulation. */}
      <svg
        ref={svgRef}
        className={`${styles.svg}${mode === 'backlinks' ? ` ${styles.svgDirected}` : ''}`}
        style={{ display: status === 'ready' ? 'block' : 'none' }}
        aria-hidden="true"
      />

      {/* Hover popover — rendered via React portal to float above SVG */}
      <HoverCard
        node={hoverState?.node ?? null}
        x={hoverState?.x ?? 0}
        y={hoverState?.y ?? 0}
        excerpt={hoverExcerpt}
        href={hoverHref}
      />

      {/* Stats: absolute-positioned inside .root */}
      {status === 'ready' && graph && (
        <p className={styles.stats}>
          {graph.nodes.length} nodes · {graph.links.length} links
        </p>
      )}
    </div>
  )
}
