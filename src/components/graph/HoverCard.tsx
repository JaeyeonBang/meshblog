/**
 * HoverCard — popover shown when a graph node is hovered or keyboard-focused.
 *
 * Editorial invariants honoured:
 *   #1 — no hex literals (all colours via tokens)
 *   #2 — hairline border (1px solid var(--ink))
 *   #4 — mono eyebrow for kind badge
 *   #5 — NO shadow (shadow-hard is .cmdk-only)
 *   #6 — radius ≤ 4px
 *
 * Mobile / touch: single tap → popover shown; second tap on same node → navigate.
 * Hover (pointer device): mouseenter → popover; mouseleave (200ms debounce) → hide.
 */
import { useEffect, useRef } from 'react'
import type { GraphNode } from './types'
import styles from './HoverCard.module.css'

export type HoverCardProps = {
  /** Currently hovered node, or null when pointer is off the graph */
  node: GraphNode | null
  /** Viewport-relative X position of the pointer/focus rect */
  x: number
  /** Viewport-relative Y position */
  y: number
  /** Excerpt text sourced from notes-manifest.json at runtime */
  excerpt: string | null
  /** Navigable href for "open →" link (null for concept/backlink nodes) */
  href: string | null
}

export function HoverCard({ node, x, y, excerpt, href }: HoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Reposition card to avoid viewport overflow
  useEffect(() => {
    const card = cardRef.current
    if (!card || !node) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const rect = card.getBoundingClientRect()

    // Offset from cursor: 12px right, 8px below
    let left = x + 12
    let top = y + 8

    // Clamp to stay inside viewport
    if (left + rect.width > vw - 8) left = x - rect.width - 12
    if (top + rect.height > vh - 8) top = y - rect.height - 8

    card.style.left = `${left}px`
    card.style.top = `${top}px`
  }, [node, x, y])

  if (!node) return null

  const kindLabel = node.type === 'concept' ? 'Concept' : 'Note'

  return (
    <div ref={cardRef} className={styles.card} role="tooltip" aria-live="polite">
      <span className={styles.eyebrow}>{kindLabel}</span>
      <p className={styles.title}>{node.label}</p>
      {excerpt && <p className={styles.excerpt}>{excerpt}</p>}
      {href && (
        <a href={href} className={styles.openLink} tabIndex={-1} aria-hidden="true">
          open →
        </a>
      )}
    </div>
  )
}
