import { useEffect, useRef, useState } from 'react'
import type { GraphJson, Manifest, GraphNode, NodeKind } from './graph/types'
import { useForceSimulation } from './graph/useForceSimulation'
import { withBase } from '../lib/url'
import styles from './GraphView.module.css'

/** Shape of public/graph/backlinks.json (mirrors BacklinksJson from build-backlinks.ts) */
type BacklinksJson = {
  nodes: Array<{ id: string; title: string }>
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
function categoryToGraphJson(
  data: CategoryGraphJson,
  level: Level,
  categorySlug?: string,
): GraphJson {
  if (level === 1 || !categorySlug) {
    // L1: one node per category — pagerank drives circle radius
    const nodes: GraphNode[] = data.categories.map(c => ({
      id: c.id,
      label: c.label,
      type: 'category' as NodeKind,
      level: 1 as const,
      pagerank: (c.noteCount + c.postCount) / 100,
      pinned: false,
    }))
    return { nodes, links: [] }
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
          if (emptyEl) emptyEl.setAttribute('aria-hidden', 'false')
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
    onNodeClick: (node: GraphNode) => {
      // L1 category node clicked — drill into L2 and update sidebar
      if (node.type === 'category' && categoryData) {
        const cat = categoryData.categories.find(c => c.id === node.id)
        if (cat) {
          window.dispatchEvent(new CustomEvent('graph:setCategory', {
            detail: {
              slug: cat.id,
              label: cat.label,
              noteCount: cat.noteCount,
              postCount: cat.postCount,
            },
          }))
          setTaxonomy({ level: 2, categorySlug: cat.id })
          setLevel(2)
        }
        return
      }

      // Regular note/post/concept node
      const entry = manifest[node.id]
      const href = entry ? withBase(entry.href) : null
      window.dispatchEvent(new CustomEvent('graph:select', {
        detail: {
          id: node.id,
          label: node.label,
          type: node.type,
          href,
        },
      }))
    },
    directed: mode === 'backlinks',
  })

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

      {/* Stats */}
      {status === 'ready' && graph && (
        <p className={styles.stats}>
          {graph.nodes.length} nodes · {graph.links.length} links
        </p>
      )}
    </div>
  )
}
