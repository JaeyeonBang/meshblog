import { writeFileSync, mkdirSync } from 'node:fs'
import { openReadonlyDb } from '../src/lib/pages/db'

type ManifestEntry = {
  id: string
  href: string
  title: string
  folder: 'posts' | 'notes'
  excerpt: string
}

/** Extract a plain-text excerpt (first 100 chars, strip markdown fencing) */
function makeExcerpt(content: string): string {
  // Strip frontmatter fences and leading whitespace
  const stripped = content
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/[#*`[\]>_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.slice(0, 100)
}

function main() {
  const db = openReadonlyDb()
  if (!db) {
    console.error('[manifest] no DB at .data/index.db')
    process.exit(1)
  }

  try {
    const rows = db.prepare(`SELECT id, slug, title, content, folder_path FROM notes`).all() as {
      id: string
      slug: string
      title: string
      content: string
      folder_path: string
    }[]

    const manifest: Record<string, ManifestEntry> = {}
    for (const r of rows) {
      const folder: 'posts' | 'notes' = r.folder_path?.includes('posts') ? 'posts' : 'notes'
      manifest[r.id] = {
        id: r.id,
        href: `/${folder}/${encodeURIComponent(r.slug)}/`,
        title: r.title,
        folder,
        excerpt: makeExcerpt(r.content ?? ''),
      }
    }

    mkdirSync('public', { recursive: true })
    writeFileSync('public/notes-manifest.json', JSON.stringify(manifest, null, 2))
    console.log(`[manifest] wrote ${Object.keys(manifest).length} entries`)
  } finally {
    db.close()
  }
}

main()
