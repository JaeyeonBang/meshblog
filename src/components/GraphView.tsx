import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { GraphJson, Manifest, GraphNode, NodeKind } from './graph/types'
import { useForceSimulation } from './graph/useForceSimulation'
import type { HoverState } from './graph/useForceSimulation'
import { HoverCard } from './graph/HoverCard'
import { Legend } from './graph/Legend'
import type { LegendCategory } from './graph/Legend'
import { normalizeLabel, slugToLabel } from './graph/labelFormat'
import { withBase } from '../lib/url'
import styles from './GraphView.module.css'

/** Shape of public/graph/backlinks.json (mirrors BacklinksJson from build-backlinks.ts) */
type BacklinksJson = {
  nodes: Array<{ id: string; title: string; categorySlug?: string }>
  edges: Array<{ source: string; target: string; alias?: string }>
}

/** Shape of public/graph/categories.json (from export-category-graph.ts) */
type CategoryNode = {
  id: string
  label: string
  noteCount: number
  postCount: number
}

type CategoryGraphJson = {
  categories: CategoryNode[]
  postsByCategory: Record<string, Array<{ id: string; label: string; categorySlug: string }>>
  notesByCategory: Record<string, Array<{ id: string; label: string; categorySlug: string }>>
}

type Mode = 'note' | 'concept' | 'backlinks'
type Level = 1 | 2 | 3
type Status = 'loading' | 'ready' | 'error' | 'empty'

/** Taxonomy path for notes-mode drill-down */
type TaxonomyPath = {
  level: Level
  categorySlug?: string
}

/**
 * Mobile / touch tap tracking.
 * First tap: show popover (via onHover), don't navigate.
 * Second tap on the same node within 600ms: navigate.
 */
type TapState = { nodeId: string; ts: number } | null

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
      type: 'note' as NodeKind,
      level: 3 as const,
      pagerank: 0,
      pinned: false,
      ...(n.categorySlug ? { categorySlug: n.categorySlug } : {}),
    })),
    links: bl.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: 1,
    })),
  }
}

/**
 * Convert CategoryGraphJson into a GraphJson for the given taxonomy level.
 * - level=1: one node per category (type='category')
 * - level=2: posts in the selected category (type='note')
 * - level=3: notes in the selected category (type='note')
 * Falls back to L1 when categorySlug is missing for L2/L3.
 */
// Inline import-binding for normalizeLabel happens at top of file.
// Used by L1 below to render acronym-preserving labels (e.g. "RL" not "Rl").

function categoryToGraphJson(
  data: CategoryGraphJson,
  level: Level,
  categorySlug?: string,
): GraphJson {
  if (level === 1 || !categorySlug) {
    // L1: one node per category — pagerank drives circle radius
    // Sort descending by total count so spine flows largest→smallest
    const sorted = [...data.categories].sort(
      (a, b) => (b.noteCount + b.postCount) - (a.noteCount + a.postCount),
    )
    const nodes: GraphNode[] = sorted.map(c => {
      const total = c.noteCount + c.postCount
      const baseLabel = normalizeLabel(c.id, c.label)
      return {
        id: c.id,
        // Suffix the count so the landing view reads as "AGENT · 5", not bare "AGENT".
        label: total > 0 ? `${baseLabel} · ${total}` : baseLabel,
        type: 'category' as NodeKind,
        level: 1 as const,
        pagerank: total / 100,
        pinned: false,
      }
    })
    // Spine: chain categories so L1 shows a visible mesh skeleton.
    // weight = average of the two endpoint sizes / 5 (keeps line thin but real).
    const links = sorted.slice(0, -1).map((c, i) => {
      const next = sorted[i + 1]
      const avgSize = ((c.noteCount + c.postCount) + (next.noteCount + next.postCount)) / 2
      return { source: c.id, target: next.id, weight: Math.max(1, avgSize / 5) }
    })
    return { nodes, links }
  }

  if (level === 2) {
    const posts = data.postsByCategory[categorySlug] ?? []
    const nodes: GraphNode[] = posts.map(p => ({
      id: p.id,
      label: p.label,
      type: 'note' as NodeKind,
      level: 2 as const,
      pagerank: 0,
      pinned: false,
      categorySlug: p.categorySlug,
    }))
    return { nodes, links: [] }
  }

  // level === 3
  const notes = data.notesByCategory[categorySlug] ?? []
  const nodes: GraphNode[] = notes.map(n => ({
    id: n.id,
    label: n.label,
    type: 'note' as NodeKind,
    level: 3 as const,
    pagerank: 0,
    pinned: false,
    categorySlug: n.categorySlug,
  }))
  return { nodes, links: [] }
}

function getInitialLevel(): Level {
  if (typeof window === 'undefined') return 1
  const p = Number(new URLSearchParams(window.location.search).get('level') ?? '1')
  return p === 2 || p === 3 ? (p as Level) : 1
}

export default function GraphView() {
  const [mode, setMode] = useState<Mode>(getInitialMode)
  const [level, setLevel] = useState<Level>(getInitialLevel)
  const [taxonomy, setTaxonomy] = useState<TaxonomyPath>({ level: getInitialLevel() })
  const [graph, setGraph] = useState<GraphJson | null>(null)
  const [categoryData, setCategoryData] = useState<CategoryGraphJson | null>(null)
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
      if (n === 1 || n === 2 || n === 3) {
        const next = n as Level
        setLevel(next)
        setTaxonomy(prev => {
          // If clicking L2/L3 with no category selected, auto-select biggest category
          if ((next === 2 || next === 3) && !prev.categorySlug && categoryData) {
            const biggest = categoryData.categories[0]
            return { level: next, categorySlug: biggest?.id }
          }
          return { ...prev, level: next }
        })
      }
    }
    window.addEventListener('graph:setMode', onSetMode)
    window.addEventListener('graph:setLevel', onSetLevel)
    return () => {
      window.removeEventListener('graph:setMode', onSetMode)
      window.removeEventListener('graph:setLevel', onSetLevel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryData])

  // Fetch graph + manifest whenever mode/taxonomy/retry changes
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setGraph(null)

    const canvasEl = document.getElementById('graphCanvas')
    if (canvasEl) canvasEl.setAttribute('aria-busy', 'true')

    const loadingEl = document.getElementById('graphLoadingState')
    const emptyEl = document.getElementById('graphEmptyState')
    const errorEl = document.getElementById('graphErrorState')
    if (loadingEl) loadingEl.setAttribute('aria-hidden', 'false')
    if (emptyEl) emptyEl.setAttribute('aria-hidden', 'true')
    if (errorEl) {
      errorEl.hidden = true
      errorEl.setAttribute('aria-hidden', 'true')
    }

    let graphFetch: Promise<GraphJson>

    if (mode === 'backlinks') {
      const graphUrl = withBase('/graph/backlinks.json')
      graphFetch = fetch(graphUrl).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json().then((bl: BacklinksJson) => backlinksToGraphJson(bl))
      })
    } else if (mode === 'concept') {
      const graphUrl = withBase(`/graph/concept-l${level}.json`)
      graphFetch = fetch(graphUrl).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<GraphJson>
      })
    } else {
      // notes mode — try categories.json first, fall back to note-l{level}.json
      graphFetch = fetch(withBase('/graph/categories.json'))
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json() as Promise<CategoryGraphJson>
        })
        .then(data => {
          if (cancelled) return { nodes: [], links: [] } as GraphJson
          setCategoryData(data)
          return categoryToGraphJson(data, taxonomy.level, taxonomy.categorySlug)
        })
        .catch(() => {
          // Graceful fallback to old hop-distance files
          return fetch(withBase(`/graph/note-l${level}.json`)).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json() as Promise<GraphJson>
          })
        })
    }

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

        if (canvasEl) canvasEl.removeAttribute('aria-busy')
        if (loadingEl) loadingEl.setAttribute('aria-hidden', 'true')

        if (nextStatus === 'empty') {
          if (emptyEl) {
            emptyEl.setAttribute('aria-hidden', 'false')
            // Mode-specific empty copy. Backlinks gets a discoverable hint
            // because it's the most likely mode to be empty for fork users
            // who haven't yet added [[wikilinks]] between notes.
            const eyebrow = document.getElementById('graphEmptyEyebrow')
            const body = document.getElementById('graphEmptyBody')
            if (eyebrow && body) {
              if (mode === 'backlinks') {
                eyebrow.textContent = 'no backlinks yet'
                body.textContent = 'Add [[wikilinks]] between your notes to populate this view.'
              } else if (mode === 'concept') {
                eyebrow.textContent = 'no concepts yet'
                body.textContent = 'Run the full build with OPENAI_API_KEY to extract concepts.'
              } else {
                eyebrow.textContent = 'no nodes'
                body.textContent = 'Add notes to see the graph.'
              }
            }
          }
        } else {
          if (emptyEl) emptyEl.setAttribute('aria-hidden', 'true')
        }
        if (errorEl) {
          errorEl.hidden = true
          errorEl.setAttribute('aria-hidden', 'true')
        }

        window.dispatchEvent(new CustomEvent('graph:state', {
          detail: { mode, level: taxonomy.level, nodes: g.nodes, linksCount: g.links.length }
        }))
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')

        if (canvasEl) canvasEl.removeAttribute('aria-busy')
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
  }, [mode, taxonomy, retry])

  // When taxonomy changes and categoryData already loaded: recompute client-side (no refetch)
  useEffect(() => {
    if (mode !== 'note' || !categoryData) return
    const g = categoryToGraphJson(categoryData, taxonomy.level, taxonomy.categorySlug)
    setGraph(g)
    const nextStatus: Status = g.nodes.length === 0 ? 'empty' : 'ready'
    setStatus(nextStatus)

    const canvasEl = document.getElementById('graphCanvas')
    const emptyEl = document.getElementById('graphEmptyState')
    const loadingEl = document.getElementById('graphLoadingState')
    if (canvasEl) canvasEl.removeAttribute('aria-busy')
    if (loadingEl) loadingEl.setAttribute('aria-hidden', 'true')
    if (emptyEl) emptyEl.setAttribute('aria-hidden', nextStatus === 'empty' ? 'false' : 'true')

    window.dispatchEvent(new CustomEvent('graph:state', {
      detail: { mode, level: taxonomy.level, nodes: g.nodes, linksCount: g.links.length }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonomy])

  // Sync URL params
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams({ mode, level: String(taxonomy.level) })
    history.replaceState(null, '', `?${q.toString()}`)
    window.dispatchEvent(new CustomEvent('graph:state', {
      detail: { mode, level: taxonomy.level, nodes: graph?.nodes ?? [], linksCount: graph?.links.length ?? 0 }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, taxonomy.level])

  // Wire Astro overlay retry button to React retry mechanism
  useEffect(() => {
    const handler = () => {
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
    colorByCategory: mode !== 'concept',
    // Concept-mode: nodes have no categorySlug, but they DO have a cluster index
    // from Louvain community detection. Map cluster → palette so concept view
    // reads as graphify-style coloured communities instead of monolithic black.
    colorByCluster: mode === 'concept',
    onNodeClick: (node: GraphNode) => {
      // L1 category node clicked in notes-mode — drill into L2 (preserve taxonomy drill-down)
      if (node.type === 'category' && categoryData) {
        const cat = categoryData.categories.find(c => c.id === node.id)
        if (cat) {
          window.dispatchEvent(new CustomEvent('graph:setCategory', {
            detail: {
              slug: cat.id,
              label: normalizeLabel(cat.id, cat.label),
              noteCount: cat.noteCount,
              postCount: cat.postCount,
            },
          }))
          setTaxonomy({ level: 2, categorySlug: cat.id })
          setLevel(2)
        }
        return
      }

      // Regular note/post/concept node — dispatch graph:select for sidebar, then navigate
      const entry = manifest[node.id]
      const href = entry ? withBase(entry.href) : null

      // Always dispatch so sidebar updates instantly before navigation
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
          tapRef.current = null
          if (href) window.location.href = href
        } else {
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
    // Explicit defaults to make the regression-safe nature visible:
    simParams: { linkDistance: 60, chargeStrength: -120, collideRadius: 10, scaleExtent: [0.1, 8] },
    staggerEnabled: true,
  })

  // Derive popover props from hover state + manifest
  const hoveredEntry = hoverState ? manifest[hoverState.node.id] : null
  const hoverExcerpt = hoveredEntry?.excerpt ?? null
  const hoverHref = hoveredEntry ? withBase(hoveredEntry.href) : null

  // Derive legend categories from currently visible graph nodes (notes mode only)
  const legendCategories = useMemo<LegendCategory[]>(() => {
    if (!graph || mode === 'concept') return []
    const counts = new Map<string, number>()
    for (const node of graph.nodes) {
      if (node.type !== 'note') continue
      const slug = node.categorySlug ?? 'fallback'
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    // Use categoryData label when present (normalized for acronym preservation);
    // otherwise format the slug directly.
    const labelOf = (slug: string): string => {
      if (categoryData) {
        const cat = categoryData.categories.find(c => c.id === slug)
        if (cat) return normalizeLabel(slug, cat.label)
      }
      return slugToLabel(slug)
    }
    return [...counts.entries()].map(([slug, count]) => ({
      slug,
      label: labelOf(slug),
      count,
    }))
  }, [graph, mode, categoryData])

  // For concept nodes: count cross-edges (type='mentions') to give a reference count fallback
  const hoverRefCount = (() => {
    if (!hoverState || hoverState.node.type !== 'concept' || !graph) return null
    const nid = hoverState.node.id
    return graph.links.filter(l => {
      const src = typeof l.source === 'string' ? l.source : l.source.id
      const dst = typeof l.target === 'string' ? l.target : l.target.id
      return l.type === 'mentions' && (src === nid || dst === nid)
    }).length || null
  })()

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

      {/* Back button for L2/L3 drill-down (notes mode only) */}
      {mode === 'note' && taxonomy.level > 1 && (
        <button
          className={styles.backBtn}
          onClick={() => {
            const prev = (taxonomy.level - 1) as Level
            setTaxonomy({ level: prev, categorySlug: taxonomy.categorySlug })
            setLevel(prev)
          }}
          aria-label={`Back to L${taxonomy.level - 1}`}
        >
          ← L{taxonomy.level - 1}
          {taxonomy.level === 2 ? ' · 카테고리' : ' · 포스트'}
        </button>
      )}

      {/* SVG — always rendered so svgRef is stable. */}
      <svg
        ref={svgRef}
        className={`${styles.svg}${mode === 'backlinks' ? ` ${styles.svgDirected}` : ''}`}
        style={{ display: status === 'ready' ? 'block' : 'none' }}
        aria-hidden="true"
      />

      {/* Hover popover — floats above SVG via position:fixed */}
      <HoverCard
        node={hoverState?.node ?? null}
        x={hoverState?.x ?? 0}
        y={hoverState?.y ?? 0}
        excerpt={hoverExcerpt}
        href={hoverHref}
        refCount={hoverRefCount}
      />

      {/* Category color legend — hidden in concept mode */}
      <Legend
        categories={legendCategories}
        visible={mode !== 'concept' && status === 'ready'}
      />

      {/* Stats */}
      {status === 'ready' && graph && (
        <p className={styles.stats}>
          {graph.nodes.length} nodes · {graph.links.length} links
        </p>
      )}
    </div>
  )
}
