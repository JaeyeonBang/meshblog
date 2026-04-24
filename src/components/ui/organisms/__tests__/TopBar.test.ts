import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  join(__dirname, '../TopBar.astro'),
  'utf8'
)

describe('TopBar.astro — help button discoverability', () => {
  it('the help button shows a kbd `?` label, not an opaque icon', () => {
    // Find the help button markup (the one that dispatches help:open)
    const helpBtnMatch = src.match(
      /<button[^>]*help-btn[^>]*>[\s\S]*?<\/button>/
    )
    expect(helpBtnMatch, 'help button not found').toBeTruthy()
    const helpBtn = helpBtnMatch![0]
    // Must contain a kbd element with "?" as its text content.
    expect(helpBtn).toMatch(/<span class="kbd">\?<\/span>/)
    // Must still dispatch the help:open event.
    expect(helpBtn).toMatch(/help:open/)
    // Must preserve the keyboard-hint aria-label.
    expect(helpBtn).toMatch(/aria-label="Help and keyboard shortcuts/)
  })

  it('the search button still shows its ⌘K kbd (regression guard)', () => {
    // Sanity: unrelated to our change, but we don't want to accidentally
    // break the existing search kbd indicator in the same file.
    const searchBtnMatch = src.match(
      /<button[^>]*cmdk:open[^>]*>[\s\S]*?<\/button>/
    )
    expect(searchBtnMatch, 'search button not found').toBeTruthy()
    expect(searchBtnMatch![0]).toMatch(/⌘K/)
  })
})
