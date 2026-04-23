export type GraphNode = {
  id: string
  label: string
  type: 'note' | 'concept'
  level: 1 | 2 | 3
  pagerank: number
  pinned: boolean
  /** Louvain community cluster id (0 = largest cluster). Absent when JSON
   *  was built before cluster-communities ran — nodes without it fall back
   *  to data-kind styling only. */
  cluster?: number
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
  { id: string; href: string; title: string; folder: 'posts' | 'notes'; excerpt?: string }
>
