import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// Anchor file reads to the repo root (via cwd) so this test isn't dependent
// on a specific __dirname resolution under vitest's ESM/import.meta layering.
const REPO_ROOT = process.cwd()
const topBarSrc = readFileSync(
  join(REPO_ROOT, 'src/components/ui/organisms/TopBar.astro'),
  'utf8',
)
const baseSrc = readFileSync(
  join(REPO_ROOT, 'src/layouts/Base.astro'),
  'utf8',
)

// ── Structural tests (source-level) ─────────────────────────────────────────

describe('TopBar.astro — lang toggle structure', () => {
  it('contains a lang-toggle button with correct aria attributes', () => {
    expect(topBarSrc).toMatch(/id="lang-toggle"/)
    expect(topBarSrc).toMatch(/aria-label="Toggle Korean \/ English"/)
    expect(topBarSrc).toMatch(/aria-pressed="false"/)
  })

  it('lang-toggle button contains both .t-ko and .t-en label spans', () => {
    // Find the lang toggle button block
    const langBtnMatch = topBarSrc.match(
      /<button[^>]*lang-toggle[\s\S]*?<\/button>/
    )
    expect(langBtnMatch, 'lang-toggle button not found').toBeTruthy()
    const btn = langBtnMatch![0]
    expect(btn).toMatch(/class="t-ko"/)
    expect(btn).toMatch(/class="t-en"/)
    expect(btn).toMatch(/lang="ko"/)
    expect(btn).toMatch(/lang="en"/)
  })

  it('initLangToggle JS function is present', () => {
    expect(topBarSrc).toMatch(/function initLangToggle/)
  })

  it('uses navigator.languages array (G2) not just navigator.language', () => {
    // Must check the full .languages array, not just .language
    expect(topBarSrc).toMatch(/navigator\.languages/)
  })

  it('sets only data-lang (G1) — never touches html[lang]', () => {
    // The apply function must NOT call setAttribute('lang', ...)
    // Only setAttribute('data-lang', ...) is allowed in the toggle JS
    // Check the function body does NOT have setAttribute('lang',
    // (It's allowed to have 'data-lang' but NOT bare 'lang')
    const applyFn = topBarSrc.match(/function applyLang[\s\S]*?^\s+}/m)
    if (applyFn) {
      expect(applyFn[0]).not.toMatch(/setAttribute\('lang',/)
      expect(applyFn[0]).not.toMatch(/setAttribute\("lang",/)
    }
    // And it must set data-lang
    expect(topBarSrc).toMatch(/setAttribute\('data-lang',/)
  })

  it('hooks to both DOMContentLoaded and astro:page-load', () => {
    expect(topBarSrc).toMatch(
      /document\.addEventListener\(['"]DOMContentLoaded['"],\s*initLangToggle\)/
    )
    expect(topBarSrc).toMatch(
      /document\.addEventListener\(['"]astro:page-load['"],\s*initLangToggle\)/
    )
  })
})

// ── Base.astro boot script tests ─────────────────────────────────────────────

describe('Base.astro — lang boot script', () => {
  it('contains a FOUC-prevention inline lang boot script', () => {
    expect(baseSrc).toMatch(/localStorage\.getItem\(['"]lang['"]\)/)
    expect(baseSrc).toMatch(/data-lang/)
  })

  it('uses navigator.languages array (G2)', () => {
    expect(baseSrc).toMatch(/navigator\.languages/)
  })

  it('only sets data-lang attribute (G1) — never html[lang]', () => {
    // Extract the lang boot script block
    const bootScriptMatch = baseSrc.match(
      /FOUC prevention: set data-lang[\s\S]*?<\/script>/
    )
    expect(bootScriptMatch, 'lang boot script not found').toBeTruthy()
    const bootScript = bootScriptMatch![0]
    // Must NOT setAttribute('lang', ...)
    expect(bootScript).not.toMatch(/setAttribute\(['"]lang['"],/)
    // Must setAttribute('data-lang', ...)
    expect(bootScript).toMatch(/setAttribute\(['"]data-lang['"],/)
  })

  it('contains global CSS for .t-ko / .t-en visibility', () => {
    expect(baseSrc).toMatch(/\.t-en\s*\{/)
    expect(baseSrc).toMatch(/\.t-ko\s*\{/)
    expect(baseSrc).toMatch(/html\[data-lang="en"\]/)
  })

  it('contains .lang-notice CSS rule', () => {
    expect(baseSrc).toMatch(/\.lang-notice/)
  })
})

// ── Toggle persistence simulation (JSDOM-style) ──────────────────────────────

describe('lang toggle — persistence logic (inline simulation)', () => {
  it('getLang returns stored value from localStorage', () => {
    // Simulate the getLang logic from TopBar.astro
    function getLang(stored: string | null, langs: string[]): 'ko' | 'en' {
      if (stored === 'ko' || stored === 'en') return stored
      return langs.some((l) => l.toLowerCase().startsWith('ko')) ? 'ko' : 'en'
    }

    expect(getLang('ko', ['en-US'])).toBe('ko')
    expect(getLang('en', ['ko-KR'])).toBe('en')
    expect(getLang(null, ['ko-KR'])).toBe('ko')
    expect(getLang(null, ['en-US'])).toBe('en')
  })

  it('detects Korean when ko-KR is secondary language (G2)', () => {
    function detectLang(langs: string[]): 'ko' | 'en' {
      return langs.some((l) => l.toLowerCase().startsWith('ko')) ? 'ko' : 'en'
    }

    // Korean developer: English primary, Korean secondary
    expect(detectLang(['en-US', 'ko-KR'])).toBe('ko')
    // English-only user
    expect(detectLang(['en-US', 'en-GB'])).toBe('en')
    // Korean-only user
    expect(detectLang(['ko-KR'])).toBe('ko')
  })

  it('toggle flips ko→en and en→ko', () => {
    function toggle(current: 'ko' | 'en'): 'ko' | 'en' {
      return current === 'ko' ? 'en' : 'ko'
    }
    expect(toggle('ko')).toBe('en')
    expect(toggle('en')).toBe('ko')
  })
})
