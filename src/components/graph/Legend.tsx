/**
 * Legend — persistent canvas overlay showing category color mapping.
 *
 * Editorial invariants honoured:
 *   #1 — no hex literals
 *   #2 — hairline 1px border
 *   #4 — mono eyebrow labels (10px, var(--f-mono), letter-spacing 0.2em, var(--ink-3))
 *   #5 — NO box-shadow
 *   #6 — radius ≤ 4px
 *
 * Placement: absolute bottom-right inside the canvas .root container.
 * Mobile (<780px): collapsible toggle, default closed.
 * Hidden entirely in concept mode (visible=false) since concept nodes are B&W.
 */

import { useState } from 'react'
import styles from './Legend.module.css'
import { paletteIndexFor } from './categoryPalette'

export interface LegendCategory {
  slug: string
  label: string
  count: number
}

export interface LegendProps {
  categories: LegendCategory[]
  visible: boolean
}

export function Legend({ categories, visible }: LegendProps) {
  const [expanded, setExpanded] = useState(false)

  if (!visible || categories.length === 0) return null

  return (
    <div className={styles.panel} aria-label="category legend">
      {/* Desktop: always-visible header */}
      <div className={styles.header}>
        <span className={styles.title}>Legend</span>
        {/* Mobile toggle button */}
        <button
          className={styles.toggle}
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-controls="legend-list"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      <ul
        id="legend-list"
        className={`${styles.list}${expanded ? ` ${styles.expanded}` : ''}`}
        role="list"
        aria-label="categories"
      >
        {categories.map(cat => (
          <li key={cat.slug} className={styles.item}>
            <span
              className={styles.dot}
              data-cat={cat.slug}
              data-cat-idx={paletteIndexFor(cat.slug) === -1 ? undefined : String(paletteIndexFor(cat.slug))}
              aria-hidden="true"
            />
            <span className={styles.itemLabel}>
              {cat.label}&thinsp;·&thinsp;{cat.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
