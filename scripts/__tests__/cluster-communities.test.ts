/**
 * Unit tests for cluster-communities.ts — Louvain community detection.
 *
 * Cases:
 *   A — two disjoint components → 2 clusters (ids 0 and 1)
 *   B — fully connected graph → single cluster (id 0)
 *   C — cluster 0 is always the largest (size-desc ordering)
 *   D — zero-edge graph (all isolated nodes) → each node gets its own cluster
 *       OR a single cluster of all nodes (Louvain is deterministic at 0 edges;
 *       in practice graphology-communities-louvain assigns each isolated node
 *       its own community).
 */
import { describe, it, expect } from "vitest"
import { detectClusters } from "../cluster-communities.ts"
import type { } from "../cluster-communities.ts"

// Helper to build a GraphJson-like object
function makeGraph(
  nodeIds: string[],
  edges: Array<[string, string]>,
) {
  return {
    nodes: nodeIds.map(id => ({
      id,
      label: id,
      type: "note" as const,
      level: 3 as const,
      pagerank: 0,
      pinned: false,
    })),
    links: edges.map(([source, target]) => ({ source, target, weight: 1 })),
  }
}

// ── Case A: two disjoint components ───────────────────────────────────────────

describe("Case A — two disjoint components", () => {
  it("assigns exactly 2 cluster ids (0 and 1)", () => {
    // Component 1: a–b–c (triangle)
    // Component 2: d–e
    const graph = makeGraph(
      ["a", "b", "c", "d", "e"],
      [["a", "b"], ["b", "c"], ["a", "c"], ["d", "e"]],
    )

    const result = detectClusters(graph)
    const clusterIds = new Set(result.map(n => n.cluster))

    expect(clusterIds.size).toBe(2)
    expect(clusterIds.has(0)).toBe(true)
    expect(clusterIds.has(1)).toBe(true)
  })

  it("all input nodes are present in output", () => {
    const graph = makeGraph(
      ["a", "b", "c", "d", "e"],
      [["a", "b"], ["b", "c"], ["a", "c"], ["d", "e"]],
    )
    const result = detectClusters(graph)
    expect(result).toHaveLength(5)
  })
})

// ── Case B: fully connected graph ─────────────────────────────────────────────

describe("Case B — fully connected graph", () => {
  it("produces a single cluster (id 0)", () => {
    // K4: all pairs connected
    const graph = makeGraph(
      ["a", "b", "c", "d"],
      [["a", "b"], ["a", "c"], ["a", "d"], ["b", "c"], ["b", "d"], ["c", "d"]],
    )

    const result = detectClusters(graph)
    const clusterIds = new Set(result.map(n => n.cluster))

    expect(clusterIds.size).toBe(1)
    expect(clusterIds.has(0)).toBe(true)
  })
})

// ── Case C: cluster 0 is always the largest ───────────────────────────────────

describe("Case C — cluster 0 is the largest community", () => {
  it("cluster 0 has at least as many nodes as any other cluster", () => {
    // Two densely-connected cliques of different sizes:
    //   Big clique (K5): a,b,c,d,e — all pairs connected
    //   Small clique (K2): f,g — connected to each other only
    // Louvain should detect exactly 2 communities; normalisation must assign
    // cluster 0 to the larger one (K5).
    const graph = makeGraph(
      ["a", "b", "c", "d", "e", "f", "g"],
      [
        // K5 big clique
        ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"],
        ["b", "c"], ["b", "d"], ["b", "e"],
        ["c", "d"], ["c", "e"],
        ["d", "e"],
        // K2 small clique
        ["f", "g"],
      ],
    )

    const result = detectClusters(graph)

    // Count nodes per cluster
    const clusterSizes = new Map<number, number>()
    for (const node of result) {
      const c = node.cluster ?? 0
      clusterSizes.set(c, (clusterSizes.get(c) ?? 0) + 1)
    }

    const cluster0Size = clusterSizes.get(0) ?? 0
    // cluster 0 must be the largest (or tied for largest)
    for (const [clusterId, size] of clusterSizes) {
      if (clusterId !== 0) {
        expect(cluster0Size).toBeGreaterThanOrEqual(size)
      }
    }
  })
})

// ── Case D: zero-edge graph ────────────────────────────────────────────────────

describe("Case D — zero-edge graph (all nodes isolated)", () => {
  /**
   * Convention: when there are no edges, graphology-communities-louvain
   * assigns each isolated node its own singleton community. After normalisation
   * (size-desc sort, 0 = largest), all communities have size 1 — so we expect
   * N distinct cluster ids (one per node), with id 0 assigned to the first
   * node in sorted order.
   *
   * If the library merges them all, expect clusterCount to be 1 instead.
   * This test documents the actual observed behaviour.
   */
  it("assigns a cluster id to every node (no undefined clusters)", () => {
    const graph = makeGraph(["x", "y", "z"], [])
    const result = detectClusters(graph)

    for (const node of result) {
      expect(node.cluster).toBeTypeOf("number")
      expect(node.cluster).toBeGreaterThanOrEqual(0)
    }
  })

  it("returns the same number of nodes as input", () => {
    const graph = makeGraph(["x", "y", "z"], [])
    const result = detectClusters(graph)
    expect(result).toHaveLength(3)
  })

  it("cluster 0 exists (at least one node gets id 0)", () => {
    const graph = makeGraph(["x", "y", "z"], [])
    const result = detectClusters(graph)
    const clusterIds = new Set(result.map(n => n.cluster))
    expect(clusterIds.has(0)).toBe(true)
  })
})

// ── Edge case: empty graph ─────────────────────────────────────────────────────

describe("Empty graph (0 nodes)", () => {
  it("returns an empty array unchanged", () => {
    const graph = { nodes: [], links: [] }
    const result = detectClusters(graph)
    expect(result).toEqual([])
  })
})

// ── Backward compat: cluster field added to existing node shape ───────────────

describe("Backward compat — cluster field added to nodes", () => {
  it("preserves existing node fields and adds cluster", () => {
    const graph = makeGraph(["p", "q"], [["p", "q"]])
    const result = detectClusters(graph)

    for (const node of result) {
      expect(node.id).toBeTypeOf("string")
      expect(node.label).toBeTypeOf("string")
      expect(node.cluster).toBeTypeOf("number")
    }
  })
})
