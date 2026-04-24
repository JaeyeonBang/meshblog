import { describe, it, expect } from 'vitest'
import { extractToc } from '../extract-toc'

describe('extractToc', () => {
  it('returns [] for HTML with no headings', () => {
    expect(extractToc('<p>Just a paragraph.</p>')).toEqual([])
  })

  it('extracts H2s with id attributes', () => {
    const html = '<h2 id="intro">Intro</h2><p>x</p><h2 id="body">Body</h2>'
    expect(extractToc(html)).toEqual([
      { label: 'Intro', level: 2, id: 'intro' },
      { label: 'Body', level: 2, id: 'body' },
    ])
  })

  it('extracts H3s at level 3', () => {
    const html = '<h2 id="a">A</h2><h3 id="b">B</h3>'
    expect(extractToc(html)).toEqual([
      { label: 'A', level: 2, id: 'a' },
      { label: 'B', level: 3, id: 'b' },
    ])
  })

  it('strips inline tags from heading text', () => {
    const html = '<h2 id="foo">Title with <code>inline</code> markup</h2>'
    expect(extractToc(html)).toEqual([
      { label: 'Title with inline markup', level: 2, id: 'foo' },
    ])
  })

  it('preserves document order across H2/H3 mix', () => {
    const html = '<h2 id="x">X</h2><h3 id="x1">X1</h3><h2 id="y">Y</h2>'
    const out = extractToc(html)
    expect(out.map(i => i.id)).toEqual(['x', 'x1', 'y'])
  })

  it('handles Korean heading text and slugified IDs', () => {
    const html = '<h2 id="실제로-부닥친-문제들">실제로 부닥친 문제들</h2>'
    expect(extractToc(html)).toEqual([
      { label: '실제로 부닥친 문제들', level: 2, id: '실제로-부닥친-문제들' },
    ])
  })

  it('skips H1, H4-H6 (scope is article TOC, not full heading outline)', () => {
    const html = '<h1 id="top">Top</h1><h2 id="a">A</h2><h4 id="z">Z</h4>'
    expect(extractToc(html)).toEqual([
      { label: 'A', level: 2, id: 'a' },
    ])
  })

  it('skips headings without an id attribute (defensive)', () => {
    const html = '<h2>no id</h2><h2 id="has">has</h2>'
    expect(extractToc(html)).toEqual([
      { label: 'has', level: 2, id: 'has' },
    ])
  })
})
