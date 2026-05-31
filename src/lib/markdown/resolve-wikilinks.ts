// Obsidian wikilink → Markdown/HTML resolver.
//
// Handles four shapes, matched in one pass by a single regex:
//   [[target]]            → <a href="/notes/slug" class="wikilink">title</a>
//   [[target|alias]]      → <a href="/notes/slug" class="wikilink">alias</a>
//   ![[src]]              → ![](src)                          (image embed)
//   ![[src|caption]]      → ![caption](src)                   (image embed with alt)
//
// When a target does not resolve, emits a <span class="wikilink wikilink--missing">.
// Styled visibly as a dashed-underline stub so authors can grep them on the live
// site — silent 404s on Pages deploys were the original pain.

// `kind` distinguishes posts from notes so hrefFor can route to /posts/<slug>
// vs /notes/<slug>. Optional for backward compat: an undefined kind routes to
// /notes/ (the historical default), so fixture/test resolvers that omit it keep
// their existing behaviour.
export type WikilinkTarget = { slug: string; title: string; kind?: 'post' | 'note' }
export type WikilinkResolver = (target: string) => WikilinkTarget | null

// `!` optional (image-embed prefix), target up to first `|` or `]`, optional
// `|alias` segment, then `]]`. Uses non-greedy matching on alias so that
// adjacent wikilinks on the same line don't collapse into one match.
const WIKILINK_RE = /(!?)\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g

const defaultHrefFor = (slug: string, kind?: 'post' | 'note') =>
  kind === 'post' ? `/posts/${slug}` : `/notes/${slug}`

// Tooltip for unresolved wikilinks: cursor:help in article.css now delivers on
// its promise. Bilingual to match the site's editorial voice.
const MISSING_TITLE = '대상 노트가 없습니다 · no matching note'

export function resolveWikilinks(
  md: string,
  resolve: WikilinkResolver,
  hrefFor: (slug: string, kind?: 'post' | 'note') => string = defaultHrefFor,
): string {
  return md.replace(WIKILINK_RE, (_match, bang: string, rawTarget: string, rawAlias?: string) => {
    const target = (rawTarget ?? '').trim()
    const alias = rawAlias?.trim() ?? ''

    if (bang === '!') {
      // Image embed: target is the src; alias (if any) is the alt/caption.
      return `![${alias}](${target})`
    }

    // Regular wikilink.
    if (!target) {
      // [[|alias]] or [[]] — no lookup possible; emit alias in missing-state span.
      if (!alias) return ''
      return `<span class="wikilink wikilink--missing" title="${MISSING_TITLE}">${alias}</span>`
    }

    const resolved = resolve(target)
    const display = alias || resolved?.title || target

    if (!resolved) {
      return `<span class="wikilink wikilink--missing" title="${MISSING_TITLE}">${display}</span>`
    }

    return `<a href="${hrefFor(resolved.slug, resolved.kind)}" class="wikilink">${display}</a>`
  })
}
