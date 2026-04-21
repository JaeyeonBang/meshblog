import { useEffect, useRef, useState } from 'react'
import type { GraphJson, Manifest, GraphNode } from './graph/types'
import { useForceSimulation } from './graph/useForceSimulation'
import { withBase } from '../lib/url'
import styles from './GraphView.module.css'

type Mode = 'note' | 'concept'
type Level = 1 | 2 | 3
type Status = 'loading' | 'ready' | 'error' | 'empty'

function getInitialMode(): Mode {
  if (typeof window === 'undefined') return 'note'
  const p = new URLSearchParams(window.location.search).get('mode')
  return p === 'concept' ? 'concept' : 'note'
}

function getInitialLevel(): Level {
  if (typeof window === 'undefined') return 1
  const p = Number(new URLSearchParams(window.location.search).get('level') ?? '1')
  return p === 2 || p === 3 ? (p as Level) : 1
}

export default function GraphView() {
  const [mode, setMode] = useState<Mode>(getInitialMode)
  const [level, setLevel] = useState<Level>(getInitialLevel)
  const [graph, setGraph] = useState<GraphJson | null>(null)
  const [manifest, setManifest] = useState<Manifest>({})
  const [status, setStatus] = useState<Status>('loading')
  const [retry, setRetry] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  // Fetch graph + manifest whenever mode/level/retry changes
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setGraph(null)

    Promise.all([
      fetch(withBase(`/graph/${mode}-l${level}.json`)).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<GraphJson>
      }),
      fetch(withBase('/notes-manifest.json'))
        .then(r => r.json() as Promise<Manifest>)
        .catch(() => ({} as Manifest)),
    ])
      .then(([g, m]) => {
        if (cancelled) return
        setGraph(g)
        setManifest(m)
        setStatus(g.nodes.length === 0 ? 'empty' : 'ready')
        // Hide/show the Astro empty-state overlay
        const emptyEl = document.getElementById('graphEmptyState')
        if (emptyEl) {
          emptyEl.setAttribute('aria-hidden', g.nodes.length === 0 ? 'false' : 'true')
        }
        // Ensure error-state overlay is hidden on success
        const errorEl = document.getElementById('graphErrorState')
        if (errorEl) {
          errorEl.hidden = true
          errorEl.setAttribute('aria-hidden', 'true')
        }
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        // Show Astro error-state overlay and hide empty-state
        const emptyEl = document.getElementById('graphEmptyState')
        if (emptyEl) emptyEl.setAttribute('aria-hidden', 'true')
        const errorEl = document.getElementById('graphErrorState')
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

  // Sync URL without triggering navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams({ mode, level: String(level) })
    history.replaceState(null, '', `?${q.toString()}`)
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
      if (node.type === 'note' && manifest[node.id]) {
        window.location.href = withBase(manifest[node.id].href)
      }
    },
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

      {/* Internal controls (hidden — GraphControls.astro is the visible toolbar) */}
      <div role="toolbar" aria-label="graph controls" className={styles.toolbar}>
        <div role="radiogroup" aria-label="View mode" className={styles.segmentGroup}>
          <span className={styles.segmentGroupLabel}>Mode</span>
          {(['note', 'concept'] as Mode[]).map(m => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              className={`${styles.segment}${mode === m ? ` ${styles.segmentActive}` : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'note' ? 'Notes' : 'Concepts'}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Depth level" className={styles.segmentGroup}>
          <span className={styles.segmentGroupLabel}>Level</span>
          {([1, 2, 3] as Level[]).map(l => (
            <button
              key={l}
              role="radio"
              aria-checked={level === l}
              className={`${styles.segment}${level === l ? ` ${styles.segmentActive}` : ''}`}
              onClick={() => setLevel(l)}
            >
              L{l}
            </button>
          ))}
        </div>
      </div>

      {/* 3-state loading / error / empty */}
      {status === 'loading' && (
        <p className={styles.status}>그래프를 불러오는 중…</p>
      )}

      {status === 'error' && (
        <div className={styles.status}>
          <p role="alert">그래프를 불러올 수 없습니다.</p>
          <button className={styles.retryBtn} onClick={() => setRetry(r => r + 1)}>
            다시 시도
          </button>
        </div>
      )}

      {status === 'empty' && (
        <p className={styles.status}>아직 표시할 노드가 없습니다.</p>
      )}

      {/* SVG — always rendered so svgRef is stable */}
      <svg
        ref={svgRef}
        className={styles.svg}
        style={{ display: status === 'ready' ? 'block' : 'none' }}
        aria-hidden="true"
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
