/**
 * Convert a free-form title to a URL-safe kebab-case slug.
 * 1. Normalise unicode (NFC).
 * 2. Strip emoji and non-BMP characters.
 * 3. Lowercase.
 * 4. Replace non-alphanumeric runs with a single hyphen.
 * 5. Trim leading/trailing hyphens.
 *
 * Extracted from scripts/new-post.ts so importers don't accidentally
 * trigger that module's `isMainModule` side-effect under Bun.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFC")
    // Remove emoji / surrogate pairs (characters outside BMP)
    .replace(/[\u{1F000}-\u{10FFFF}]/gu, "")
    .toLowerCase()
    // Replace any sequence of non-alphanumeric, non-ASCII chars with '-'
    .replace(/[^a-z0-9À-ɏ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "untitled"
}
