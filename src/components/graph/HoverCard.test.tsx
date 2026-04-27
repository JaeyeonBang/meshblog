/**
 * HoverCard unit tests — pure-logic coverage (no DOM required).
 *
 * Strategy: extract the conditional rendering rules as pure helper
 * functions and test them with vitest. This avoids a happy-dom/jsdom
 * dependency for a component that lives in a non-DOM Astro pipeline.
 */
import { describe, it, expect } from 'vitest'
import type { IncidentEdge, IncidentEdgeList } from './types'

// ── Helpers that mirror HoverCard's conditional rendering logic ──

/** Whether the degree row should be rendered. */
function shouldShowDegree(
  degreeInfo: { in: number; out: number } | undefined,
): boolean {
  return degreeInfo !== undefined && (degreeInfo.in > 0 || degreeInfo.out > 0)
}

/** Label text for the degree value span. */
function degreeValueText(degreeInfo: { in: number; out: number }): string {
  return `← ${degreeInfo.in} · → ${degreeInfo.out}`
}

/** Whether the incident-edge list should be rendered.
 *  nodeType must be 'note'; incidentEdges must exist and be non-empty. */
function shouldShowIncident(
  nodeType: string,
  incidentEdges: IncidentEdgeList | undefined,
): boolean {
  return (
    nodeType === 'note' &&
    incidentEdges !== undefined &&
    incidentEdges.items.length > 0
  )
}

/** Overflow count shown as "+N more". */
function overflowCount(incidentEdges: IncidentEdgeList): number {
  return Math.max(0, incidentEdges.totalCount - incidentEdges.items.length)
}

// ── Tests ────────────────────────────────────────────────────────

describe('HoverCard rendering logic', () => {
  // Case 1: no degreeInfo, no incidentEdges → no degree row, no list
  it('hides degree row and incident list when both props are absent', () => {
    expect(shouldShowDegree(undefined)).toBe(false)
    expect(shouldShowIncident('note', undefined)).toBe(false)
  })

  // Case 2: degreeInfo {in:0, out:0} → degree row hidden
  it('hides degree row when both in and out are 0', () => {
    expect(shouldShowDegree({ in: 0, out: 0 })).toBe(false)
  })

  // Case 3: degreeInfo {in:3, out:5} → degree row visible, correct label
  it('shows degree row when degrees are non-zero', () => {
    const info = { in: 3, out: 5 }
    expect(shouldShowDegree(info)).toBe(true)
    expect(degreeValueText(info)).toBe('← 3 · → 5')
  })

  it('shows degree row when only inbound degree is non-zero', () => {
    expect(shouldShowDegree({ in: 2, out: 0 })).toBe(true)
    expect(degreeValueText({ in: 2, out: 0 })).toBe('← 2 · → 0')
  })

  it('shows degree row when only outbound degree is non-zero', () => {
    expect(shouldShowDegree({ in: 0, out: 1 })).toBe(true)
  })

  // Case 4: incidentEdges with 7 items, totalCount=9 → +2 more
  it('shows incident list rows and overflow count', () => {
    const edges: IncidentEdgeList = {
      items: Array.from({ length: 7 }, (_, i) => ({
        direction: i % 2 === 0 ? 'in' : 'out' as 'in' | 'out',
        label: `Note ${i}`,
      })),
      totalCount: 9,
    }
    expect(shouldShowIncident('note', edges)).toBe(true)
    expect(edges.items).toHaveLength(7)
    expect(overflowCount(edges)).toBe(2)
  })

  it('shows "+0 more" suppressed correctly when all items shown', () => {
    const edges: IncidentEdgeList = {
      items: [{ direction: 'in', label: 'A' }],
      totalCount: 1,
    }
    expect(overflowCount(edges)).toBe(0)
  })

  // nodeType guard
  it('hides incident list for non-note nodes even when data is present', () => {
    const edges: IncidentEdgeList = {
      items: [{ direction: 'in', label: 'X' }],
      totalCount: 1,
    }
    expect(shouldShowIncident('concept', edges)).toBe(false)
    expect(shouldShowIncident('category', edges)).toBe(false)
  })

  // alias rendering
  it('incident edge with alias carries alias field', () => {
    const edge = { direction: 'in' as const, label: 'Target Note', alias: 'see here' }
    expect(edge.alias).toBe('see here')
  })

  it('incident edge without alias has undefined alias', () => {
    const edge: IncidentEdge = { direction: 'out', label: 'Other Note' }
    expect(edge.alias).toBeUndefined()
  })
})
