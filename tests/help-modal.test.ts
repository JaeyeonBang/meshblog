import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  join(__dirname, '../src/components/ui/organisms/HelpModal.astro'),
  'utf8'
)

describe('HelpModal.astro', () => {
  it('defines the aria-modal dialog', () => {
    expect(src).toMatch(/role="dialog"/)
    expect(src).toMatch(/aria-modal="true"/)
    expect(src).toMatch(/id="help-backdrop"/)
    expect(src).toMatch(/id="help-panel"/)
    expect(src).toMatch(/id="help-close"/)
  })

  it('contains all three section eyebrows (KO · EN)', () => {
    expect(src).toMatch(/단축키 · shortcuts/)
    expect(src).toMatch(/meshblog 기초 · basics/)
    expect(src).toMatch(/이 템플릿 · fork this/)
  })

  it('lists the five core shortcuts', () => {
    expect(src).toContain('⌘K')
    expect(src).toMatch(/<span class="kbd">\?<\/span>/)
    expect(src).toMatch(/↑↓/)
    expect(src).toMatch(/↵/)
    expect(src).toMatch(/>esc</)
  })

  it('links to the meshblog GitHub template', () => {
    expect(src).toContain('https://github.com/JaeyeonBang/meshblog')
    expect(src).toMatch(/target="_blank"/)
    expect(src).toMatch(/rel="noopener"/)
  })

  it('wires the `?` keybinding and `help:open` event', () => {
    expect(src).toMatch(/help:open/)
    // `?` key OR shift+/ branch
    expect(src).toMatch(/e\.key === '\?'/)
    expect(src).toMatch(/e\.shiftKey && e\.key === '\/'/)
  })

  it('suppresses `?` when target is an editable field', () => {
    expect(src).toMatch(/isContentEditable/)
    expect(src).toMatch(/INPUT|TEXTAREA|SELECT/)
  })

  it('uses tokens only — no hex literals', () => {
    // Match any #rrggbb or #rgb hex after a colon, bg:, border:, color:, etc.
    // Allow none at all in the file.
    const hexMatches = src.match(/#[0-9a-fA-F]{3,8}\b/g) || []
    expect(hexMatches, `Found hex literals: ${hexMatches.join(', ')}`).toEqual([])
  })

  it('uses shadow-hard exactly once', () => {
    const shadowUses = (src.match(/var\(--shadow-hard\)/g) || []).length
    expect(shadowUses).toBe(1)
  })

  it('contains the "what is meshblog" intro section', () => {
    expect(src).toMatch(/help-section--intro/)
    expect(src).toMatch(/Obsidian 볼트를 정적 사이트로/)
    expect(src).toMatch(/help-intro-en/)
    expect(src).toMatch(/Claude Code skills audit it daily/)
  })

  it('fork section has 3 numbered steps, not a single paragraph', () => {
    expect(src).toMatch(/<ol class="help-steps">/)
    const stepMatches = (src.match(/<li>\s*<span class="help-step-num">/g) || []).length
    expect(stepMatches).toBe(3)
    // Specific step anchors
    expect(src).toMatch(/gh repo fork JaeyeonBang\/meshblog/)
    expect(src).toMatch(/claude \/init/)
    expect(src).toMatch(/git push origin main/)
  })

  it('preserves the Fork on GitHub external link', () => {
    // After expanding to steps, the canonical CTA link must still be present.
    expect(src).toMatch(/href="https:\/\/github\.com\/JaeyeonBang\/meshblog"/)
    expect(src).toMatch(/target="_blank"/)
  })
})
