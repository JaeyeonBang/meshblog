/**
 * Legend — persistent canvas overlay showing category color mapping.
 *
 * Hover a swatch → matching SVG nodes get class .node--cat-active, others .node--cat-dim.
 * Implemented via a simple document.querySelectorAll dance scoped to the
 * sibling .nodes group inside the same SVG canvas. Pure DOM, no React/D3 wiring
 * needed in useForceSimulation.
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

import { useCallback, useState } from 'react'
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

/** Apply cross-highlight to SVG nodes matching the given slug. null = clear. */
function highlightCategory(slug: string | null): void {
  if (typeof document === 'undefined') return
  const circles = document.querySelectorAll<SVGCircleElement>('.nodes circle')
  if (slug === null) {
    circles.forEach(c => {
      c.classList.remove('node--cat-active', 'node--cat-dim')
    })
    return
  }
  circles.forEach(c => {
    const cat = c.getAttribute('data-cat')
    const isMatch = cat === slug
    c.classList.toggle('node--cat-active', isMatch)
    c.classList.toggle('node--cat-dim', !isMatch)
  })
}

export function Legend({ categories, visible }: LegendProps) {
  const [expanded, setExpanded] = useState(false)

  const onItemEnter = useCallback((slug: string) => () => highlightCategory(slug), [])
  const onItemLeave = useCallback(() => highlightCategory(null), [])

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
          <li
            key={cat.slug}
            className={styles.item}
            onMouseEnter={onItemEnter(cat.slug)}
            onMouseLeave={onItemLeave}
            onFocus={onItemEnter(cat.slug)}
            onBlur={onItemLeave}
            tabIndex={0}
          >
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
