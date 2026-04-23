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
}

export type GraphJson = {
  nodes: GraphNode[]
  links: GraphLink[]
}

export type Manifest = Record<
  string,
  { id: string; href: string; title: string; folder: 'posts' | 'notes' }
>
