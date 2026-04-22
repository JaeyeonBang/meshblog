/**
 * mesh-data.ts — Build-time helpers for deriving MiniMesh node arrays
 * from real graph/backlinks data.
 *
 * All functions are called at Astro build time (server-side), so Node.js
 * APIs (fs, path) are safe to use here.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

export type MeshNode = {
  label: string
  kind?: 'default' | 'hub' | 'concept' | 'selected'
  href?: string
  // x/y are deliberately absent — MiniMesh will compute radial layout
}

type GraphNode = {
  id: string
  label: string
  type: string
  level?: number
  pagerank?: number
}

type GraphJson = {
  nodes: GraphNode[]
  links: Array<{ source: string; target: string; weight?: number }>
}

type BacklinkNode = { id: string; title: string }
type BacklinkEdge = { source: string; target: string; alias?: string }
type BacklinksJson = {
  nodes: BacklinkNode[]
  edges: BacklinkEdge[]
}

// ── Loader helpers ──────────────────────────────────────────────────────────

function loadJson<T>(relPath: string): T | null {
  const abs = resolve(process.cwd(), relPath)
  if (!existsSync(abs)) return null
  try {
    return JSON.parse(readFileSync(abs, 'utf-8')) as T
  } catch {
    return null
  }
}

function degreeOf(id: string, links: BacklinkEdge[]): number {
  return links.filter((l) => l.source === id || l.target === id).length
}

function graphDegreeOf(id: string, links: GraphJson['links']): number {
  return links.filter((l) => l.source === id || l.target === id).length
}

// ── Home page: top-6 concept nodes by degree ───────────────────────────────

/**
 * Returns up to 6 MeshNodes for the home page sidebar.
 * Priority: concept-l2.json → note-l2.json → static fallback.
 * Nodes have no x/y — MiniMesh auto-layout handles positioning.
 */
export function getHomeMeshNodes(withBase: (path: string) => string): MeshNode[] {
  // Try concepts first
  const conceptGraph = loadJson<GraphJson>('public/graph/concept-l2.json')
  if (conceptGraph && conceptGraph.nodes.length > 0) {
    const sorted = [...conceptGraph.nodes].sort(
      (a, b) =>
        graphDegreeOf(b.id, conceptGraph.links) - graphDegreeOf(a.id, conceptGraph.links)
    )
    return sorted.slice(0, 6).map((node, i) => ({
      label: node.label,
      kind: i === 0 ? ('hub' as const) : ('concept' as const),
      href: withBase('/graph?mode=concept'),
    }))
  }

  // Fallback: note-l2.json
  const noteGraph = loadJson<GraphJson>('public/graph/note-l2.json')
  if (noteGraph && noteGraph.nodes.length > 0) {
    const sorted = [...noteGraph.nodes].sort(
      (a, b) =>
        graphDegreeOf(b.id, noteGraph.links) - graphDegreeOf(a.id, noteGraph.links)
    )
    return sorted.slice(0, 6).map((node, i) => ({
      label: node.label,
      kind: (i === 0 ? 'hub' : 'note') as 'hub' | 'note',
      href: withBase(`/notes/${node.id}`),
    }))
  }

  // fallback when graph JSON is empty (e.g., new vault)
  return [
    { label: 'knowledge', kind: 'hub' as const, href: withBase('/graph') },
    { label: 'llm',       kind: 'hub' as const, href: withBase('/graph') },
    { label: 'rag',                              href: withBase('/graph?mode=concept') },
    { label: 'astro',                            href: withBase('/graph?mode=concept') },
    { label: 'sqlite',                           href: withBase('/graph?mode=concept') },
    { label: 'faq',                              href: withBase('/graph?mode=concept') },
  ]
}

// ── Per-note/post: subgraph from backlinks + outbound links ────────────────

type NeighborSource = {
  slug: string
  title: string
  sourceType: 'backlink' | 'outbound'
}

/**
 * Returns a MeshNode[] for a note or post reader page.
 *
 * - Center node (index 0): the current note/post itself (no href — it IS the page)
 * - Neighbors (indices 1–5): up to 5 inbound/outbound links from backlinks.json
 *
 * Returns an empty array if the note is a full orphan (no links in either direction).
 * Caller should render `{meshNodes.length > 1 && <MiniMesh nodes={meshNodes} />}`.
 */
export function getNoteMeshNodes(opts: {
  noteId: string
  noteTitle: string
  noteSlug: string
  withBase: (path: string) => string
}): MeshNode[] {
  const { noteId, noteTitle, noteSlug, withBase } = opts

  const backlinks = loadJson<BacklinksJson>('public/graph/backlinks.json')

  const neighbors: NeighborSource[] = []

  if (backlinks) {
    // Build a title lookup from the nodes array
    const titleMap = new Map(backlinks.nodes.map((n) => [n.id, n.title]))

    // Inbound: edges where target === noteId
    const inbound = backlinks.edges.filter((e) => e.target === noteId)
    for (const edge of inbound.slice(0, 5)) {
      neighbors.push({
        slug: edge.source,
        title: titleMap.get(edge.source) ?? edge.source,
        sourceType: 'backlink',
      })
    }

    // Outbound: edges where source === noteId (fill remaining slots up to 5 total)
    if (neighbors.length < 5) {
      const outbound = backlinks.edges.filter((e) => e.source === noteId)
      for (const edge of outbound) {
        if (neighbors.length >= 5) break
        // Avoid duplicating an already-added neighbor
        if (!neighbors.some((n) => n.slug === edge.target)) {
          neighbors.push({
            slug: edge.target,
            title: titleMap.get(edge.target) ?? edge.target,
            sourceType: 'outbound',
          })
        }
      }
    }
  }

  // Orphan guard: no links → hide MiniMesh entirely
  if (neighbors.length === 0) return []

  const centerNode: MeshNode = {
    label: noteTitle,
    kind: 'selected' as const,
    // no href — current page
  }

  const neighborNodes: MeshNode[] = neighbors.map((n) => ({
    label: n.title,
    kind: 'note' as const,
    href: withBase(`/notes/${n.slug}`),
  }))

  return [centerNode, ...neighborNodes]
}
