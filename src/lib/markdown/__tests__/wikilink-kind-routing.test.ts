import { describe, it, expect } from 'vitest'
import { resolveWikilinks, type WikilinkResolver } from '../resolve-wikilinks'
import { buildNoteResolver } from '../wikilink-resolver'

// D2 (prompt_plan §5 Lane 1.3/1.4): wikilink targets that resolve to a POST must
// link to /posts/<slug>; notes keep /notes/<slug>. `kind` is threaded from the
// DB folder_path through buildNoteResolver → WikilinkTarget → hrefFor.
//
// Adversarial cases flagged in CLAUDE.md active risk #1 (the wikilink 80/20
// trap): post target, note target, slug collision, alias, missing, trailing
// space, unicode.

describe('resolveWikilinks — kind-aware hrefFor routing', () => {
  const resolver: WikilinkResolver = (target) => {
    const key = target.trim().toLowerCase()
    if (key === 'ppo') return { slug: 'ppo', title: 'PPO', kind: 'post' }
    if (key === 'reward model') return { slug: 'reward-model', title: 'Reward Model', kind: 'note' }
    return null
  }

  it('post target → /posts/<slug>', () => {
    expect(resolveWikilinks('[[PPO]]', resolver)).toBe(
      '<a href="/posts/ppo" class="wikilink">PPO</a>',
    )
  })

  it('note target → /notes/<slug>', () => {
    expect(resolveWikilinks('[[Reward Model]]', resolver)).toBe(
      '<a href="/notes/reward-model" class="wikilink">Reward Model</a>',
    )
  })

  it('post target with alias keeps post href, shows alias text', () => {
    expect(resolveWikilinks('[[PPO|the algorithm]]', resolver)).toBe(
      '<a href="/posts/ppo" class="wikilink">the algorithm</a>',
    )
  })

  it('trailing space around a post target still routes to /posts/', () => {
    expect(resolveWikilinks('[[ PPO ]]', resolver)).toBe(
      '<a href="/posts/ppo" class="wikilink">PPO</a>',
    )
  })

  it('missing target → missing-state span (no kind, no href)', () => {
    expect(resolveWikilinks('[[Nonexistent]]', resolver)).toBe(
      '<span class="wikilink wikilink--missing" title="대상 노트가 없습니다 · no matching note">Nonexistent</span>',
    )
  })

  it('a custom kind-aware hrefFor receives the resolved kind', () => {
    const html = resolveWikilinks('[[PPO]]', resolver, (slug, kind) =>
      kind === 'post' ? `/x/posts/${slug}` : `/x/notes/${slug}`,
    )
    expect(html).toBe('<a href="/x/posts/ppo" class="wikilink">PPO</a>')
  })
})

describe('buildNoteResolver — propagates kind', () => {
  it('resolves a post by title → /posts/ via default hrefFor', () => {
    const { resolve } = buildNoteResolver([
      { slug: 'ppo', title: 'PPO', kind: 'post' },
      { slug: 'reward-model', title: 'Reward Model', kind: 'note' },
    ])
    expect(resolveWikilinks('[[PPO]] and [[Reward Model]]', resolve)).toBe(
      '<a href="/posts/ppo" class="wikilink">PPO</a> and ' +
        '<a href="/notes/reward-model" class="wikilink">Reward Model</a>',
    )
  })

  it('title collision post vs note: last writer wins title key; unique slugs route by own kind', () => {
    const { resolve } = buildNoteResolver([
      { slug: 'overview-post', title: 'Overview', kind: 'post' },
      { slug: 'overview-note', title: 'Overview', kind: 'note' },
    ])
    expect(resolveWikilinks('[[Overview]]', resolve)).toBe(
      '<a href="/notes/overview-note" class="wikilink">Overview</a>',
    )
    expect(resolveWikilinks('[[overview-post]]', resolve)).toBe(
      '<a href="/posts/overview-post" class="wikilink">Overview</a>',
    )
  })

  it('unicode post title resolves and routes to /posts/', () => {
    const { resolve } = buildNoteResolver([
      { slug: 'transformer-self-attention', title: '셀프 어텐션', kind: 'post' },
    ])
    expect(resolveWikilinks('[[셀프 어텐션]]', resolve)).toBe(
      '<a href="/posts/transformer-self-attention" class="wikilink">셀프 어텐션</a>',
    )
  })

  it('a linkable without kind falls back to /notes/ (backward compat)', () => {
    const { resolve } = buildNoteResolver([{ slug: 'legacy', title: 'Legacy' }])
    expect(resolveWikilinks('[[Legacy]]', resolve)).toBe(
      '<a href="/notes/legacy" class="wikilink">Legacy</a>',
    )
  })
})
