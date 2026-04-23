/**
 * cluster-palette.ts — Re-export of the canonical cluster → (tone, strokeStyle) mapping.
 *
 * Single source of truth lives in scripts/cluster-communities.ts.
 * This file re-exports it for use in the React component (GraphView.tsx and
 * its module CSS) without pulling in any Node.js-only imports.
 */

export type { StrokeStyle, ClusterEntry } from "../../scripts/cluster-communities.ts"
export { CLUSTER_PALETTE } from "../../scripts/cluster-communities.ts"
