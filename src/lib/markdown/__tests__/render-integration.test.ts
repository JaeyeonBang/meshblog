import { describe, it, expect } from 'vitest'
import { renderMarkdownToHtml } from '../render'
import type { WikilinkResolver } from '../resolve-wikilinks'

// End-to-end check: markdown → preprocess (wikilink resolution) → remark → rehype → HTML.
// This is what the slug routes actually call.

const resolver: WikilinkResolver = (target) => {
  if (target.toLowerCase() === 'linked note') {
    return { slug: 'linked-note', title: 'Linked Note' }
  }
  return null
}

// Bumped per-test timeout to 15s: the first run pays a rehypeShiki cold-start
// (loads github-light + github-dark theme JSON + Oniguruma WASM), which can
// exceed vitest's 5s default in CI.
describe('renderMarkdownToHtml — wikilink pipeline integration', { timeout: 15_000 }, () => {
  it('resolved wikilink survives through remark+rehype as a real anchor with .wikilink class', async () => {
    const html = await renderMarkdownToHtml('See [[Linked Note|details]] here.', {
      resolver,
      hrefFor: (slug) => `/meshblog/notes/${slug}`,
    })
    expect(html).toContain('href="/meshblog/notes/linked-note"')
    expect(html).toContain('class="wikilink"')
    expect(html).toContain('>details</a>')
    expect(html).not.toContain('[[')
  })

  it('unresolved wikilink becomes a wikilink--missing span (no broken anchor)', async () => {
    const html = await renderMarkdownToHtml('Refers to [[Missing Page]].', { resolver })
    expect(html).toContain('Missing Page')
    expect(html).toContain('wikilink--missing')
    expect(html).not.toContain('[[')
    expect(html).not.toContain('<a href')
  })

  it('image embed is emitted as a real <img> tag after remark', async () => {
    const html = await renderMarkdownToHtml('![[diagram.png|a caption]]', { resolver })
    expect(html).toContain('<img')
    expect(html).toContain('src="diagram.png"')
    expect(html).toContain('alt="a caption"')
  })

  it('fallback path (no resolver) emits wikilink--missing spans instead of anchors', async () => {
    const html = await renderMarkdownToHtml('Before [[Anything]] after.')
    expect(html).toContain('Anything')
    expect(html).toContain('wikilink--missing')
    expect(html).not.toContain('<a href')
    expect(html).not.toContain('[[')
  })

  // Regression guard for the D3 content fix: every post used to open with
  // `[[paper link]](url)` — a wikilink shape that resolves to nothing, leaving a
  // broken wikilink--missing stub plus a literal `(url)` on line 1 of 12 prod
  // posts. The fix rewrites them to standard `[label](url)`. This asserts that
  // shape renders as a real external anchor with NO missing-state stub.
  it('standard external link [label](url) renders as an anchor, never a missing stub', async () => {
    const html = await renderMarkdownToHtml('[paper link](https://arxiv.org/abs/2106.09685)', {
      resolver,
    })
    expect(html).toContain('href="https://arxiv.org/abs/2106.09685"')
    expect(html).toContain('>paper link</a>')
    expect(html).not.toContain('wikilink--missing')
  })

  // D2: a wikilink whose target resolves to a POST must link to /posts/<slug>.
  it('post-kind wikilink target routes to /posts/<slug>', async () => {
    const postResolver: WikilinkResolver = (t) =>
      t.toLowerCase() === 'ppo' ? { slug: 'ppo', title: 'PPO', kind: 'post' } : null
    const html = await renderMarkdownToHtml('See [[PPO]].', {
      resolver: postResolver,
      hrefFor: (slug, kind) => (kind === 'post' ? `/posts/${slug}` : `/notes/${slug}`),
    })
    expect(html).toContain('href="/posts/ppo"')
    expect(html).not.toContain('/notes/ppo')
  })
})
