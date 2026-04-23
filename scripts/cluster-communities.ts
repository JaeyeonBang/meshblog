/**
 * cluster-communities.ts — Louvain community detection for graph JSON files.
 *
 * Reads note-l3.json (and optionally concept-l3.json) from public/graph/,
 * runs graphology-communities-louvain, normalises cluster IDs by size
 * (cluster 0 = largest community), and writes the `cluster` field back onto
 * each node in-place.
 *
 * Edge-case conventions:
 *   - 0-edge graph: every node is its own community (Louvain single-node
 *     components). If all nodes are singleton, each gets its own cluster id.
 *     The node with id that sorts first lexicographically is cluster 0 (the
 *     "largest" is size-1; among ties we break on insertion order from the
 *     sorted-by-size-desc pass).
 *   - Empty graph (0 nodes): written back unchanged.
 *
 * @module
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import Graph from "graphology"
import louvain from "graphology-communities-louvain"

// ── Cluster palette ────────────────────────────────────────────────────────────
//
// Canonical mapping from cluster index to (tone, strokeStyle).
// Exported here for reference; the React-side version lives in
// src/components/graph/cluster-palette.ts (re-exports this constant via a
// plain TypeScript file — no Node.js imports).

export type StrokeStyle = "solid" | "dashed" | "dotted"

export type ClusterEntry = {
  tone: string        // a CSS variable name, e.g. "--ink"
  strokeStyle: StrokeStyle
}

/**
 * Maps cluster index (mod 10) to a (tone, strokeStyle) pair.
 *
 * First 5 entries cover the full grayscale range (ink → ink-5).
 * Entries 5–9 repeat the same tones with a "dotted" stroke so clusters
 * beyond 5 remain distinguishable without introducing chromatic colour.
 * Clusters ≥ 10 degrade to visual similarity (mod 10 wraps back).
 */
export const CLUSTER_PALETTE: readonly ClusterEntry[] = [
  { tone: "--ink",   strokeStyle: "solid"  },  // 0
  { tone: "--ink-2", strokeStyle: "solid"  },  // 1
  { tone: "--ink-3", strokeStyle: "dashed" },  // 2
  { tone: "--ink-4", strokeStyle: "solid"  },  // 3
  { tone: "--ink-5", strokeStyle: "dashed" },  // 4
  { tone: "--ink",   strokeStyle: "dotted" },  // 5
  { tone: "--ink-2", strokeStyle: "dotted" },  // 6
  { tone: "--ink-3", strokeStyle: "dotted" },  // 7
  { tone: "--ink-4", strokeStyle: "dotted" },  // 8
  { tone: "--ink-5", strokeStyle: "dotted" },  // 9
]

// ── JSON shape ─────────────────────────────────────────────────────────────────

type GraphNode = {
  id: string
  label?: string
  type?: string
  level?: number
  pagerank?: number
  pinned?: boolean
  cluster?: number
  [key: string]: unknown
}

type GraphJson = {
  nodes: GraphNode[]
  links: Array<{ source: string; target: string; weight?: number }>
}

// ── Core logic (exported for tests) ───────────────────────────────────────────

/**
 * Parses a { nodes, links } GraphJson into a graphology Graph,
 * runs Louvain, normalises cluster IDs by community size (0 = largest),
 * and returns a new nodes array with `cluster` set on each node.
 *
 * @param json - Input graph JSON
 * @returns New nodes array with cluster ids assigned
 */
export function detectClusters(json: GraphJson): GraphNode[] {
  if (json.nodes.length === 0) return json.nodes

  const g = new Graph({ type: "undirected", allowSelfLoops: false })

  for (const node of json.nodes) {
    g.addNode(node.id)
  }

  for (const link of json.links) {
    // Guard against duplicate or self-loop edges in source data
    if (link.source !== link.target && g.hasNode(link.source) && g.hasNode(link.target)) {
      if (!g.hasEdge(link.source, link.target)) {
        g.addEdge(link.source, link.target, { weight: link.weight ?? 1 })
      }
    }
  }

  // Run Louvain. Returns a map of nodeId → communityId (arbitrary integers).
  const rawCommunities = louvain(g)

  // Group nodes by raw community id to compute sizes
  const communityMembers = new Map<number, string[]>()
  for (const [nodeId, communityId] of Object.entries(rawCommunities)) {
    const bucket = communityMembers.get(communityId as number) ?? []
    bucket.push(nodeId)
    communityMembers.set(communityId as number, bucket)
  }

  // Sort communities by size descending (largest → cluster 0)
  const sortedCommunities = [...communityMembers.entries()].sort(
    ([, aMembers], [, bMembers]) => bMembers.length - aMembers.length,
  )

  // Build a mapping from raw community id → normalised cluster index
  const rawToNormalised = new Map<number, number>()
  sortedCommunities.forEach(([rawId], index) => {
    rawToNormalised.set(rawId, index)
  })

  // Assign normalised cluster id back to each node
  return json.nodes.map(node => ({
    ...node,
    cluster: rawToNormalised.get(rawCommunities[node.id] as number) ?? 0,
  }))
}

// ── File processing ────────────────────────────────────────────────────────────

/**
 * Reads a graph JSON file, runs cluster detection, and writes back in-place.
 * Logs cluster distribution summary.
 *
 * @param filePath - Absolute or relative path to graph JSON
 */
export function processGraphFile(filePath: string): void {
  if (!existsSync(filePath)) {
    console.warn(`[cluster-communities] skipping (not found): ${filePath}`)
    return
  }

  const raw = readFileSync(filePath, "utf-8")
  const json: GraphJson = JSON.parse(raw)

  if (json.nodes.length === 0) {
    console.log(`[cluster-communities] ${filePath}: empty — no clusters to assign`)
    return
  }

  const nodesWithClusters = detectClusters(json)

  const out: GraphJson = { ...json, nodes: nodesWithClusters }
  writeFileSync(filePath, JSON.stringify(out, null, 2))

  // Log distribution
  const dist = new Map<number, number>()
  for (const node of nodesWithClusters) {
    const c = node.cluster ?? 0
    dist.set(c, (dist.get(c) ?? 0) + 1)
  }
  const distStr = [...dist.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, count]) => `cluster ${id}: ${count} node${count !== 1 ? "s" : ""}`)
    .join(", ")

  console.log(`[cluster-communities] ${filePath}: ${json.nodes.length} nodes → ${dist.size} clusters (${distStr})`)
}

// ── CLI entry ──────────────────────────────────────────────────────────────────

const GRAPH_DIR = "public/graph"

const TARGETS = [
  join(GRAPH_DIR, "note-l3.json"),
  join(GRAPH_DIR, "note-l2.json"),
  join(GRAPH_DIR, "note-l1.json"),
  join(GRAPH_DIR, "concept-l3.json"),
  join(GRAPH_DIR, "concept-l2.json"),
  join(GRAPH_DIR, "concept-l1.json"),
]

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("cluster-communities.ts")

if (isMainModule) {
  for (const target of TARGETS) {
    processGraphFile(target)
  }
  console.log("[cluster-communities] done")
}
