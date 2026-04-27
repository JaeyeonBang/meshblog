/** Node types supported by the graph canvas.
 *  - 'note'     — individual note/post
 *  - 'concept'  — extracted concept cluster
 *  - 'category' — taxonomy L1 hub (one node per category)
 */
export type NodeKind = 'note' | 'concept' | 'category'

export type GraphNode = {
  id: string
  label: string
  type: NodeKind
  level: 1 | 2 | 3
  pagerank: number
  pinned: boolean
  /** Louvain community cluster id (0 = largest cluster). Absent when JSON
   *  was built before cluster-communities ran — nodes without it fall back
   *  to data-kind styling only. */
  cluster?: number
  /** Category slug for per-category color fill (e.g. 'engineering', 'ai',
   *  'writing', 'design', 'personal'). Present on note-type nodes only;
   *  absent on concept/category nodes (those stay B&W). Nodes with an
   *  unrecognised slug fall back to --cat-fallback. */
  categorySlug?: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export type GraphLink = {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
  /** Edge type — 'mentions' for concept→note cross-edges; absent for same-type edges */
  type?: string
}

export type GraphJson = {
  nodes: GraphNode[]
  links: GraphLink[]
}

export type Manifest = Record<
  string,
  { id: string; href: string; title: string; folder: 'posts' | 'notes'; excerpt?: string }
>
