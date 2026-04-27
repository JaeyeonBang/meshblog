/**
 * mesh-data.ts — Build-time helpers for deriving MiniMesh node arrays
 * from real graph/backlinks data.
 *
 * All functions are called at Astro build time (server-side), so Node.js
 * APIs (fs, path) are safe to use here.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { openReadonlyDb } from './pages/db'
import { plainExcerpt } from './markdown/plain-excerpt'
import { estimateReadingMinutes } from './reading-time'

// ── Types ───────────────────────────────────────────────────────────────────

export type MeshNode = {
  label: string
  kind?: 'default' | 'hub' | 'concept' | 'selected' | 'note' | 'stub'
  href?: string
  // x/y are deliberately absent — MiniMesh will compute radial layout
  // NEW optional fields — populated for neighbors only, not center node
  /** ≤160 chars plain text, no HTML. Absent on center node. */
  excerpt?: string
  /** Count of inbound wikilink edges to this neighbor across the whole graph. Absent on center node. */
  backlinks?: number
  /** How this neighbor relates to the current article. Absent on center node. */
  relationship?: 'backlink' | 'outbound' | 'entity'
  /** Estimated reading time in integer minutes. Absent on center node. */
  readingMinutes?: number
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

function graphDegreeOf(id: string, links: GraphJson['links']): number {
  return links.filter((l) => l.source === id || l.target === id).length
}

/**
 * Build a Map<nodeId, inboundEdgeCount> from all edges in backlinks.json.
 * Used to populate `backlinks` on neighbor nodes in O(E) — no per-node lookup.
 */
function buildInboundCountMap(edges: BacklinkEdge[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const edge of edges) {
    map.set(edge.target, (map.get(edge.target) ?? 0) + 1)
  }
  return map
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
  sourceType: 'backlink' | 'outbound' | 'entity'
}

/** Max neighbors returned (center node excluded). */
const MAX_NEIGHBORS = 5

/**
 * Returns a MeshNode[] for a note or post reader page.
 *
 * Two-tier strategy:
 *
 * 1. PRIMARY: wikilink-based neighborhood from `public/graph/backlinks.json`.
 *    If ≥1 neighbor found, use that (preserves behavior for users with real wikilinks).
 *
 * 2. FALLBACK: if the primary path returns 0 neighbors, query SQLite for notes
 *    that share at least one entity_id with this note. Returns up to MAX_NEIGHBORS
 *    ordered by shared-entity count descending, then by note id for determinism.
 *    This delivers on meshblog's "automatic entity extraction creates links without
 *    user effort" claim.
 *
 * - Center node (index 0): the current note/post itself (no href — it IS the page).
 *   Center node does NOT carry excerpt/backlinks/relationship/readingMinutes.
 * - Neighbors (indices 1–MAX_NEIGHBORS): inbound/outbound or entity-related notes.
 *   Neighbors carry the full popover metadata:
 *   - `excerpt`: ≤160 chars plain text, from the neighbor's DB content
 *   - `backlinks`: count of inbound wikilink edges to that neighbor (global, from backlinks.json)
 *   - `relationship`: 'backlink' | 'outbound' | 'entity'
 *   - `readingMinutes`: estimated integer minutes via estimateReadingMinutes()
 *   - `kind`: 'stub' when content is empty/whitespace, otherwise 'note'
 *
 * Returns just [centerNode] (length=1) when neither source has neighbors — the
 * caller's `meshNodes.length > 1` guard hides MiniMesh gracefully.
 * Returns [] (length=0) only when the note itself cannot be identified (safety net).
 *
 * Caller: `{meshNodes.length > 1 && <MiniMesh nodes={meshNodes} />}`.
 */
export function getNoteMeshNodes(opts: {
  noteId: string
  noteTitle: string
  withBase: (path: string) => string
}): MeshNode[] {
  const { noteId, noteTitle, withBase } = opts

  // ── Tier 1: wikilink-based neighborhood ──────────────────────────────────
  const wikineighbors = getWikilinkNeighbors(noteId)

  if (wikineighbors.length > 0) {
    // Primary path has neighbors — enrich them with popover metadata from DB.
    const centerNode: MeshNode = { label: noteTitle, kind: 'selected' as const }
    const neighborNodes = enrichNeighborsFromDb(wikineighbors, withBase)
    return [centerNode, ...neighborNodes]
  }

  // ── Tier 2: entity-overlap fallback ──────────────────────────────────────
  const centerNode: MeshNode = { label: noteTitle, kind: 'selected' as const }
  const entityNeighbors = getEntityNeighbors(noteId, withBase)
  return [centerNode, ...entityNeighbors]
}

// ── Internal: wikilink path ─────────────────────────────────────────────────

function getWikilinkNeighbors(noteId: string): NeighborSource[] {
  const backlinks = loadJson<BacklinksJson>('public/graph/backlinks.json')
  const neighbors: NeighborSource[] = []

  if (!backlinks) return neighbors

  const titleMap = new Map(backlinks.nodes.map((n) => [n.id, n.title]))

  // Inbound: edges where target === noteId
  const inbound = backlinks.edges.filter((e) => e.target === noteId)
  for (const edge of inbound.slice(0, MAX_NEIGHBORS)) {
    neighbors.push({
      slug: edge.source,
      title: titleMap.get(edge.source) ?? edge.source,
      sourceType: 'backlink',
    })
  }

  // Outbound: edges where source === noteId (fill remaining slots)
  if (neighbors.length < MAX_NEIGHBORS) {
    const outbound = backlinks.edges.filter((e) => e.source === noteId)
    for (const edge of outbound) {
      if (neighbors.length >= MAX_NEIGHBORS) break
      if (!neighbors.some((n) => n.slug === edge.target)) {
        neighbors.push({
          slug: edge.target,
          title: titleMap.get(edge.target) ?? edge.target,
          sourceType: 'outbound',
        })
      }
    }
  }

  return neighbors
}

// ── Internal: enrich wikilink neighbors with popover metadata ───────────────

type NoteContentRow = { id: string; content: string }

/**
 * Given a list of NeighborSource entries from the wikilink path, fetch their
 * content from SQLite in a single `WHERE id IN (…)` query (no N+1), then
 * attach excerpt, readingMinutes, backlinks count, relationship, and stub kind.
 *
 * Returns the enriched MeshNode[] in the same order as `neighbors`.
 */
function enrichNeighborsFromDb(
  neighbors: NeighborSource[],
  withBase: (p: string) => string,
): MeshNode[] {
  // Load backlinks.json once to build the global inbound-count map.
  const backlinksData = loadJson<BacklinksJson>('public/graph/backlinks.json')
  const inboundMap = backlinksData
    ? buildInboundCountMap(backlinksData.edges)
    : new Map<string, number>()

  // Attempt to fetch neighbor content from DB in a single query.
  const contentMap = new Map<string, string>()
  const db = openReadonlyDb()
  if (db) {
    try {
      const slugs = neighbors.map((n) => n.slug)
      // SQLite placeholders: one ? per slug
      const placeholders = slugs.map(() => '?').join(', ')
      const rows = db
        .prepare<string[]>(`SELECT id, content FROM notes WHERE slug IN (${placeholders})`)
        .all(...slugs) as NoteContentRow[]
      for (const row of rows) {
        contentMap.set(row.id, row.content)
      }
    } finally {
      db.close()
    }
  }

  return neighbors.map((n) => {
    // Slug is used as the node id in backlinks.json (matches notes.slug / notes.id).
    // Distinguish "row not found in DB" (don't downgrade to stub — DB may be null
    // in tests or fixture-mode) from "row found with empty content" (true stub).
    const hasRow = contentMap.has(n.slug)
    const content = contentMap.get(n.slug) ?? ''
    const excerpt = plainExcerpt(content, 160)
    const isStub = hasRow && excerpt === ''
    const readingMinutes = content.trim().length > 0
      ? estimateReadingMinutes(content)
      : undefined
    const backlinkCount = inboundMap.get(n.slug)

    return {
      label: n.title,
      kind: isStub ? ('stub' as const) : ('note' as const),
      href: withBase(`/notes/${n.slug}`),
      excerpt: isStub || excerpt === '' ? undefined : excerpt,
      backlinks: backlinkCount,
      relationship: n.sourceType,
      readingMinutes,
    }
  })
}

// ── Internal: entity-overlap path ──────────────────────────────────────────

type EntityNeighborRow = {
  id: string
  slug: string
  title: string
  shared: number
  content: string
}

/**
 * Query SQLite for notes that share entities with `noteId`.
 * Uses a prepared statement for performance across 39 SSG calls.
 * Results are deterministic: ordered by (shared DESC, id ASC).
 *
 * Each neighbor node is enriched with popover metadata:
 * - `excerpt`: ≤160 chars plain text from the note's content column
 * - `backlinks`: inbound wikilink edge count from backlinks.json
 * - `relationship`: always 'entity' for this path
 * - `readingMinutes`: estimated integer minutes
 * - `kind`: 'stub' when content is empty, otherwise 'note'
 */
function getEntityNeighbors(noteId: string, withBase: (p: string) => string): MeshNode[] {
  const db = openReadonlyDb()
  if (!db) return []

  // Load backlinks.json for the global inbound-count map.
  const backlinksData = loadJson<BacklinksJson>('public/graph/backlinks.json')
  const inboundMap = backlinksData
    ? buildInboundCountMap(backlinksData.edges)
    : new Map<string, number>()

  try {
    const rows = db
      .prepare<[string, number]>(
        `SELECT n.id, n.slug, n.title, n.content,
                COUNT(ne2.entity_id) AS shared
         FROM note_entities ne1
         JOIN note_entities ne2 ON ne2.entity_id = ne1.entity_id
                               AND ne2.note_id   != ne1.note_id
         JOIN notes n           ON n.id           = ne2.note_id
         WHERE ne1.note_id = ?
         GROUP BY n.id
         ORDER BY shared DESC, n.id ASC
         LIMIT ?`
      )
      .all(noteId, MAX_NEIGHBORS) as EntityNeighborRow[]

    return rows.map((row) => {
      const excerpt = plainExcerpt(row.content, 160)
      const isStub = excerpt === ''
      const readingMinutes = row.content.trim().length > 0
        ? estimateReadingMinutes(row.content)
        : undefined
      const backlinkCount = inboundMap.get(row.slug)

      return {
        label: row.title,
        kind: isStub ? ('stub' as const) : ('note' as const),
        href: withBase(`/notes/${row.slug}`),
        excerpt: isStub ? undefined : excerpt,
        backlinks: backlinkCount,
        relationship: 'entity' as const,
        readingMinutes,
      }
    })
  } finally {
    db.close()
  }
}
