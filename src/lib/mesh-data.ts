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
import { getTagOverlapNeighbors } from './pages/related'
import { plainExcerpt } from './markdown/plain-excerpt'
import { estimateReadingMinutes } from './reading-time'

// ── Manifest-based href resolution ───────────────────────────────────────────
// notes-manifest.json is built by scripts/build-manifest.ts and tags each row
// with `folder: 'posts' | 'notes'` based on the source `folder_path`. We
// consult it here so a post-typed neighbor links to /posts/<slug>/ instead of
// the hardcoded /notes/<slug> that 404s on the live site.
type ManifestEntry = { id: string; href: string; title: string; folder: 'posts' | 'notes' }
let _manifestCache: Record<string, ManifestEntry> | null | undefined
function loadManifest(): Record<string, ManifestEntry> | null {
  if (_manifestCache !== undefined) return _manifestCache
  _manifestCache = loadJson<Record<string, ManifestEntry>>('public/notes-manifest.json')
  return _manifestCache
}

/** Reset the module-level manifest cache. Exposed for test isolation only. */
export function _resetManifestCache(): void {
  _manifestCache = undefined
}

/**
 * Resolve a neighbor slug to its canonical href via the manifest.
 * Falls back to /notes/<slug> when the manifest is missing or doesn't list
 * the slug — matches legacy behavior so existing tests and fixture-mode keep working.
 */
function resolveNeighborHref(slug: string, withBase: (p: string) => string): string {
  const manifest = loadManifest()
  if (manifest) {
    const entry = manifest[slug]
    if (entry?.href) return withBase(entry.href)
  }
  return withBase(`/notes/${slug}`)
}

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
  relationship?: 'backlink' | 'outbound' | 'entity' | 'tag'
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

let _backlinksCache: BacklinksJson | null | undefined
function loadBacklinks(): BacklinksJson | null {
  if (_backlinksCache !== undefined) return _backlinksCache
  _backlinksCache = loadJson<BacklinksJson>('public/graph/backlinks.json')
  return _backlinksCache
}

/** Reset the module-level backlinks cache. Exposed for test isolation only. */
export function _resetBacklinksCache(): void {
  _backlinksCache = undefined
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
  sourceType: 'backlink' | 'outbound' | 'entity' | 'tag'
}

/** Max neighbors returned (center node excluded). */
const MAX_NEIGHBORS = 8

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
  if (entityNeighbors.length > 0) {
    return [centerNode, ...entityNeighbors]
  }

  // ── Tier 3: tag-overlap fallback ─────────────────────────────────────────
  const tagRows = getTagOverlapNeighbors(noteId, MAX_NEIGHBORS)
  if (tagRows.length > 0) {
    const tagSources: NeighborSource[] = tagRows.map((r) => ({
      slug: r.slug,
      title: r.title,
      sourceType: 'tag' as const,
    }))
    const tagNeighbors = enrichNeighborsFromDb(tagSources, withBase)
    return [centerNode, ...tagNeighbors]
  }

  return [centerNode]
}

// ── Internal: wikilink path ─────────────────────────────────────────────────

function getWikilinkNeighbors(noteId: string): NeighborSource[] {
  const backlinks = loadBacklinks()
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
  const backlinksData = loadBacklinks()
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
      href: resolveNeighborHref(n.slug, withBase),
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
  const backlinksData = loadBacklinks()
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
        href: resolveNeighborHref(row.slug, withBase),
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

// ── Per-post concept subgraph (Task 7) ──────────────────────────────────────

export type ConceptGraphNode = {
  id: string
  label: string
  /** Louvain cluster index from concept-l3.json (mod 12 → palette slot) */
  cluster: number
  /** PageRank-ish score from concept-l3.json; falls back to 0 */
  pagerank: number
  /** Number of source-note entities also attached to this concept */
  weight: number
}

export type ConceptGraphLink = { source: string; target: string; weight: number }

export type PostConceptGraph = {
  nodes: ConceptGraphNode[]
  links: ConceptGraphLink[]
}

type ConceptL3Json = {
  nodes: Array<{
    id: string
    label: string
    type?: string
    cluster?: number
    pagerank?: number
  }>
  links: Array<{ source: string; target: string; weight?: number; type?: string }>
}

let _conceptL3Cache: ConceptL3Json | null | undefined
function loadConceptL3(): ConceptL3Json | null {
  if (_conceptL3Cache !== undefined) return _conceptL3Cache
  _conceptL3Cache = loadJson<ConceptL3Json>('public/graph/concept-l3.json')
  return _conceptL3Cache
}

/** Reset internal concept-l3 cache. Test helper only. */
export function _resetConceptGraphCache(): void {
  _conceptL3Cache = undefined
}

/**
 * Build a per-post concept subgraph mirroring `/graph?mode=concept&level=3`.
 *
 * Strategy (post-PR #87):
 *   1. Seed concepts — every concept that shares ≥1 entity with `noteId`.
 *   2. 1-hop expansion — pull in adjacent concepts from the global concept
 *      graph (concept-l3.json), so single-concept posts (e.g. one about
 *      "PPO" only) still render as "PPO + RLHF + GPT-4" with edges, instead
 *      of one orphan node.
 *   3. Cap total nodes at MAX_CONCEPT_NODES, prioritising seeds.
 *
 * This makes the per-post "concept 그래프" useful even when Louvain assigns
 * all the post's entities to a single community.
 */
const MAX_CONCEPT_NODES = 14

export function getPostConceptGraph(noteId: string): PostConceptGraph {
  const db = openReadonlyDb()
  if (!db) return { nodes: [], links: [] }

  type ConceptRow = { id: string; name: string; weight: number }
  let seedRows: ConceptRow[] = []
  try {
    seedRows = db
      .prepare<[string, number]>(
        `SELECT c.id, c.name, COUNT(DISTINCT ce.entity_id) AS weight
         FROM concepts c
         JOIN concept_entities ce ON ce.concept_id = c.id
         JOIN note_entities ne    ON ne.entity_id   = ce.entity_id
         WHERE ne.note_id = ?
         GROUP BY c.id
         ORDER BY weight DESC, c.name ASC
         LIMIT ?`
      )
      .all(noteId, MAX_CONCEPT_NODES) as ConceptRow[]
  } finally {
    db.close()
  }

  if (seedRows.length === 0) return { nodes: [], links: [] }

  const conceptL3 = loadConceptL3()
  const globalById = new Map<string, ConceptL3Json['nodes'][number]>()
  if (conceptL3) {
    for (const n of conceptL3.nodes) globalById.set(n.id, n)
  }

  // 1-hop neighbour expansion. For every seed concept, find adjacent concepts
  // in the global graph (non-mentions edges). Ranked by edge weight so the
  // strongest semantic neighbours win when we hit MAX_CONCEPT_NODES.
  const seedIds = new Set(seedRows.map((r) => r.id))
  const neighbourScore = new Map<string, number>()
  if (conceptL3) {
    for (const e of conceptL3.links) {
      if (e.type === 'mentions' || e.source === e.target) continue
      const w = e.weight ?? 1
      // a→b: if a is seed and b is non-seed, b becomes a candidate neighbour
      const consider = (candidate: string, anchor: string) => {
        if (!seedIds.has(anchor) || seedIds.has(candidate)) return
        if (!globalById.has(candidate)) return // must exist as a concept node
        const g = globalById.get(candidate)
        if (g?.type && g.type !== 'concept') return // skip note nodes
        neighbourScore.set(candidate, (neighbourScore.get(candidate) ?? 0) + w)
      }
      consider(e.target, e.source)
      consider(e.source, e.target)
    }
  }

  const budget = Math.max(0, MAX_CONCEPT_NODES - seedRows.length)
  const neighbourIds = [...neighbourScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, budget)
    .map(([id]) => id)

  const idSet = new Set([...seedIds, ...neighbourIds])

  const nodes: ConceptGraphNode[] = []
  for (const r of seedRows) {
    const g = globalById.get(r.id)
    nodes.push({
      id: r.id,
      label: g?.label ?? r.name,
      cluster: g?.cluster ?? 0,
      pagerank: g?.pagerank ?? 0,
      weight: r.weight,
    })
  }
  for (const id of neighbourIds) {
    const g = globalById.get(id)
    if (!g) continue
    nodes.push({
      id,
      label: g.label,
      cluster: g.cluster ?? 0,
      pagerank: g.pagerank ?? 0,
      weight: 0, // neighbour, no direct entity overlap with this post
    })
  }

  const links: ConceptGraphLink[] = []
  const seenEdge = new Set<string>()
  if (conceptL3) {
    for (const e of conceptL3.links) {
      if (e.source === e.target) continue
      if (!idSet.has(e.source) || !idSet.has(e.target)) continue
      if (e.type === 'mentions') continue
      const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`
      if (seenEdge.has(key)) continue
      seenEdge.add(key)
      links.push({ source: e.source, target: e.target, weight: e.weight ?? 1 })
    }
  }

  return { nodes, links }
}

/**
 * Returns inter-neighbor edges for the post-page mini graph.
 *
 * Given the IDs that getNoteMeshNodes selected as neighbors, this filters
 * backlinks.json for edges where BOTH endpoints are in the neighbor set.
 * The center node is intentionally excluded — spokes from center to each
 * neighbor are implicit in the meshNodes array; the caller draws those
 * separately. This function returns ONLY the inter-neighbor connections
 * that give the graph its web-like structure.
 *
 * Behavior is independent of how the neighbors were selected (wikilink
 * tier vs entity-overlap tier). When backlinks.json has wikilinks between
 * entity-selected neighbors, those edges still appear — the data is the
 * same, only the selection path differs.
 *
 * Returns [] when backlinks.json is missing or empty.
 */
export function getNoteMeshLinks(neighborIds: string[]): Array<{ source: string; target: string }> {
  const backlinks = loadBacklinks()
  if (!backlinks || neighborIds.length === 0) return []
  const set = new Set(neighborIds)
  const out: Array<{ source: string; target: string }> = []
  for (const edge of backlinks.edges) {
    if (set.has(edge.source) && set.has(edge.target)) {
      out.push({ source: edge.source, target: edge.target })
    }
  }
  return out
}
