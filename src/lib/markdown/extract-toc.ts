/**
 * Extract article TOC entries from rendered HTML.
 *
 * Scope: H2 and H3 only — H1 is the article title (rendered separately in
 * .article-header), and H4+ are sub-sub-sections that would crowd the sidebar.
 * Headings without an `id` attribute are skipped defensively (they can't be
 * linked to). Inline markup (<code>, <em>, etc.) inside heading text is
 * flattened to its text content.
 */
export type TocEntry = { label: string; level: 2 | 3; id: string }

export function extractToc(html: string): TocEntry[] {
  const entries: TocEntry[] = []
  const re = /<(h[23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const level = m[1].toLowerCase() === 'h2' ? 2 : 3
    const id = m[2]
    // Strip inner tags to get plain-text label
    const label = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!label) continue
    entries.push({ label, level: level as 2 | 3, id })
  }
  return entries
}
