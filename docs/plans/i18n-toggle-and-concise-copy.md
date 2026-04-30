# Plan · KOR/ENG toggle + concise copy pass

> Status: draft, awaiting approval. No code until user signs off.
> Date: 2026-05-01

---

## 1. Goal

Two intertwined product asks:

1. **Concise copy** — every UI surface trims its prose. Drop the OSS / "fork on GitHub" sales pitch. Read like a personal reading room, not a product page.
2. **KOR/ENG toggle** — a single button in the top bar swaps the entire site between Korean and English. Technical terms, URLs, slugs stay English in both modes. Persisted in `localStorage`. Default `ko` (site-primary), but auto-detect from `Accept-Language` first visit.
3. **`/new-bilingual-post` skill** — when authoring, generate both KOR and ENG versions of a note in one go.

**Non-goals (v2):**
- Per-route URL splitting (`/en/posts/foo`). Keep one URL, toggle client-side.
- Translating the existing 12 published notes — the toggle ships, back-translation happens later.
- AI-driven on-the-fly translation. The skill drafts both at write-time; site reads static files.

---

## 2. Concise copy — what changes

Surfaces audited (with current bloat → proposed):

| File | Current → Proposed |
| :--- | :--- |
| `src/pages/index.astro` hero | `두 번째 뇌를, 남들이 읽을 수 있게 내보내기.` + 2-line sub → keep H1, **drop "Think of it as an Obsidian vault…"** trailing English clause |
| `src/pages/index.astro` wedge | `open source · fork + deploy` block → **delete entirely**. No "Fork on GitHub" CTA on the home page |
| `src/pages/index.astro` mesh-caption | `· 자주 등장하는 개념들이 서로를 끌어당긴다` → `· 개념들이 서로를 끌어당긴다` |
| `src/pages/about.astro` | Long bilingual opener + 6 glossary entries + "Why it's built this way" promo paragraph + Colophon → **3 sections**: opener (2 lines), glossary (keep, trim each `<dd>` to ≤ 2 sentences), colophon (collapse to single line per row) |
| `src/pages/about.astro` "Why it's built this way" | **Delete.** Promo. Belongs in README. |
| `src/pages/404.astro` | `여기엔 아무 노트도 없어요.` + 2-sentence body → keep H1, body becomes one sentence |
| `src/pages/posts/index.astro` empty | `아직 올라온 글이 없습니다 · still drafting.` → `still drafting.` (the `· still drafting.` half is the EN twin; KOR mode shows `아직 글이 없습니다.`) |
| `src/components/ui/organisms/Footer.astro` | tagline `Obsidian vault로 키우고, 정적 사이트로 내보내는 2nd-brain 블로그.` → `2nd brain · public.` |
| `src/components/ui/organisms/TopBar.astro` | logo sub `est. 2026` → keep |

Acceptance: every page-level prose block ≤ 2 sentences. No GitHub or "fork" mentions outside the colophon's source line.

---

## 3. i18n toggle — architecture

### 3.1 Data model

Two language strings per UI surface. Three approaches considered:

| Approach | Verdict |
| :--- | :--- |
| Dual-route SSG (`/`, `/en/`) | **Reject.** Doubles build, breaks the "one URL one canonical" mental model, requires `getStaticPaths` rewrite in 4 dynamic routes. Overkill for ~30 strings. |
| Client-side toggle, both langs in DOM | **Adopt.** Inline both, hide one via CSS attribute selector. Tiny payload (< 2 kB extra HTML site-wide). FOUC handled with inline script (same pattern as theme toggle). |
| JS-fetched translation files | Reject. Requires hydration delay, breaks no-JS rendering. |

### 3.2 The `<T>` helper

```astro
---
// src/components/ui/atoms/T.astro
interface Props { ko: string; en: string; tag?: string }
const { ko, en, tag = 'span' } = Astro.props
const Tag = tag as any
---
<Tag lang="ko">{ko}</Tag><Tag lang="en">{en}</Tag>
```

Usage:

```astro
<T ko="홈으로" en="Home" />
<!-- emits: <span lang="ko">홈으로</span><span lang="en">Home</span> -->

<T tag="p" ko="아직 글이 없습니다." en="still drafting." />
```

Edge case: when KOR contains an English technical term that should not be in `<span lang="ko">` semantically — that's fine. `<span lang="ko">vault에 묻기</span>` is still semantically Korean (loanword), and screen readers handle it.

### 3.3 CSS visibility (in `Base.astro` global)

```css
/* default: show ko, hide en */
[lang="en"] { display: none; }
html[data-lang="en"] [lang="ko"] { display: none; }
html[data-lang="en"] [lang="en"] { display: revert; }
```

Caveats:
- `display: revert` resets to UA default, which is `inline` for `<span>` and `block` for `<p>/<div>`. Good.
- Block-level `<T tag="p">` emits two `<p>` siblings → no whitespace collapse issue.
- Inline `<T>` placed inside a `<p>` produces two `<span>` siblings; one is `display: none`, no ghost whitespace.

### 3.4 The toggle button

In `TopBar.astro`, new button between theme-toggle and help-btn:

```astro
<button class="btn btn-sm lang-toggle" id="lang-toggle"
        aria-label="Toggle Korean / English"
        aria-pressed="false" title="Toggle KOR / ENG">
  <span class="lang-label" lang="ko">KO</span>
  <span class="lang-label" lang="en">EN</span>
</button>
```

The label itself uses the same `lang` attribute pattern — when site is in KO mode, the button shows "KO" (current state); pressing it switches site to EN, button now shows "EN". Mirrors theme toggle's "show current state, click to flip" affordance.

### 3.5 FOUC-safe inline boot script (added to `Base.astro` `<head>`)

```html
<script is:inline>
  (function() {
    var stored = null;
    try { stored = localStorage.getItem('lang'); } catch(e) {}
    var lang = stored === 'ko' || stored === 'en'
      ? stored
      : (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang);
  })();
</script>
```

Already runs before stylesheet paint, identical pattern to theme.

### 3.6 Toggle JS (separate `<script>` in TopBar.astro, mirrors theme block)

```js
function initLangToggle() {
  const btn = document.getElementById('lang-toggle')
  if (!btn) return
  function getLang() {
    const stored = localStorage.getItem('lang')
    if (stored === 'ko' || stored === 'en') return stored
    return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en'
  }
  function apply(lang) {
    document.documentElement.setAttribute('data-lang', lang)
    document.documentElement.setAttribute('lang', lang)
    btn.setAttribute('aria-pressed', String(lang === 'en'))
  }
  apply(getLang())
  btn.addEventListener('click', () => {
    const next = getLang() === 'ko' ? 'en' : 'ko'
    localStorage.setItem('lang', next)
    apply(next)
  })
}
document.addEventListener('DOMContentLoaded', initLangToggle)
document.addEventListener('astro:page-load', initLangToggle)
```

### 3.7 What about post/note bodies?

v1 scope: **post bodies stay in their authored language**. Most current notes are mixed KO/EN already; no change.

For posts that are KOR-only, when the visitor toggles to ENG, the body remains Korean. We render a small notice **once** at the top of the article (above the lede), only visible in EN mode:

```astro
<p lang="en" class="lang-notice">This post is published in Korean. Toggle 한·영 in the top bar.</p>
```

This is the honest UX: "we have two views, but this specific essay was written in one language."

For posts written via the new bilingual skill, an `*.en.md` companion file exists. v2 wires the renderer to emit both bodies as `<div lang="ko">` / `<div lang="en">` siblings inside `.prose`. v1 ships without this; no regression for current posts.

---

## 4. The `/new-bilingual-post` skill

A new skill that scaffolds both KOR and ENG sources of a note in one shot. Companion-file model (clean for the v2 renderer):

```
content/notes/foo-bar.md          ← KOR, primary
content/notes/foo-bar.en.md       ← ENG companion
```

KOR file frontmatter gains `has_en: true`. ENG companion has minimal frontmatter (`title:` only).

### Script: `scripts/new-bilingual-post.ts`

Wraps `scripts/new-post.ts`'s slugify + buildTemplate, adds:
1. Prompt for `title_ko` and `title_en` (or accept `--ko` / `--en` flags).
2. Write `<slug>.md` with `has_en: true` and KOR title.
3. Write `<slug>.en.md` with ENG title and same `slug` field for cross-linking.
4. Both files start with `draft: true`.

### Skill file: `.claude/skills/new-bilingual-post/SKILL.md`

```md
---
name: new-bilingual-post
description: Scaffold a note in BOTH Korean and English (companion-file model).
              Use when starting a new post the author wants published in
              both languages from day one.
---
# /new-bilingual-post
Creates content/notes/<slug>.md (KOR primary, has_en: true) and
content/notes/<slug>.en.md (ENG companion). Both draft:true.
Run: bun run scripts/new-bilingual-post.ts "한국어 제목" "English title"
```

### Existing `/new-post`

Unchanged. The author picks: bilingual from-day-one (`/new-bilingual-post`) or single-language draft (`/new-post`).

---

## 5. File-by-file changeset (v1 PR)

| File | Change | LOC est. |
| :--- | :--- | :--- |
| `src/components/ui/atoms/T.astro` | **new** — i18n helper | +12 |
| `src/layouts/Base.astro` | inline lang-boot script + global lang CSS | +15 |
| `src/components/ui/organisms/TopBar.astro` | toggle button + JS init block | +35 |
| `src/pages/index.astro` | drop wedge, trim hero/mesh-caption, wrap with `<T>` | -25 / +10 |
| `src/pages/about.astro` | drop "Why" section, trim opener, glossary `<dd>` ≤ 2 sentences, wrap with `<T>` | -40 / +30 |
| `src/pages/404.astro` | trim body, wrap with `<T>` | -5 / +10 |
| `src/pages/posts/index.astro` | wrap header / empty / filter labels | +12 |
| `src/pages/notes/index.astro` | wrap header / empty | +8 |
| `src/components/ui/organisms/Footer.astro` | trim tagline, wrap `<T>` on column heads + tagline | +15 |
| `src/pages/posts/[slug].astro` | add `lang-notice` paragraph for EN-mode KOR-only posts | +3 |
| `src/pages/notes/[slug].astro` | same notice | +3 |
| `scripts/new-bilingual-post.ts` | **new** — bilingual scaffolder | +90 |
| `.claude/skills/new-bilingual-post/SKILL.md` | **new** | +15 |
| `src/content/config.ts` | add `has_en: z.boolean().optional()` to schema | +1 |
| `package.json` | `"new-bilingual-post": "tsx scripts/new-bilingual-post.ts"` | +1 |
| `scripts/__tests__/new-bilingual-post.test.ts` | **new** — slugify + dual-write test | +60 |

**Total:** ~280 LOC added, ~70 removed. ~13 files touched.

---

## 6. Test plan

1. **Unit** — `new-bilingual-post.test.ts`: given KO+EN titles, both files are written with correct frontmatter; existing slug → error and no overwrite.
2. **Type** — `bunx astro check` clean.
3. **Build** — `bun run build:fixture` exits 0; output HTML for `/`, `/about`, `/posts`, `/notes`, `/404` each contains `<span lang="ko">…</span><span lang="en">…</span>` pair for at least one known string (e.g. nav "posts" / "posts").
4. **Manual visual**:
   - `bun run preview` → `/meshblog/` defaults to KOR; click toggle → ENG visible, no layout shift, no FOUC, theme toggle still works.
   - Refresh — language persists.
   - Clear localStorage, set browser to `en-US` → site loads in ENG.
5. **A11y** — toggle button has `aria-pressed`, `aria-label`. `html[lang]` updates. Screen readers pronounce text in correct language.
6. **6 invariants** — `blog-bw-polish` skill output empty (no hex regressions, hairlines ok, etc.).

---

## 7. Risks & mitigations

| Risk | Mitigation |
| :--- | :--- |
| FOUC: ko visible, then snaps to en | Inline boot script in `<head>` before stylesheets, mirrors theme toggle (proven). |
| Both languages indexed by Google → SEO penalty | `<html lang>` updates on toggle; content has correct `lang` attrs on each block. Google handles `display:none` siblings — recognized pattern. Add `noindex` only if Search Console flags duplicate. |
| Existing notes with mixed KO/EN inline content (e.g. seed.sql samples) | Out of scope — note bodies don't go through `<T>`. Only chrome + page-level prose. |
| User toggles ENG, jumps to a KOR-only post body | The `lang-notice` line in EN mode tells them why. Honest UX. |
| Bilingual skill silently overwrites existing files | Same guard as `/new-post`: `existsSync` check, error and exit. Both `<slug>.md` and `<slug>.en.md` checked. |
| TopBar gets crowded on mobile (≤480px) | Hide lang toggle's "KO/EN" text label, show a globe SVG. CSS-only at the matching breakpoint. |
| `display: none` text still tab-focusable for `<a>` inside | Confirmed — `display:none` removes from accessibility tree. ✅ |

---

## 8. Out of scope (v2 backlog, do not creep)

- Renderer wiring for `*.en.md` companion files into dual `.prose` blocks. v1 ships scaffolding skill only.
- Back-translating the existing 12 notes.
- Per-language `/posts` and `/notes` index re-sorting (e.g. only show notes with `has_en: true` in EN mode).
- Search palette (`⌘K`) language-aware ranking.
- `hreflang` tags / dual-route URLs.
- AI on-the-fly translation.

---

# Plan-Eng Review

> Eng-manager hat: lock the architecture, surface the risks the plan author hand-waved, fix before code.

## A. Architectural soundness

**Good:**
- Adopting client-side toggle over dual-route SSG is the right call for ~30 strings on a personal blog. Kept the simpler thing simple.
- `<T>` helper as the single i18n primitive — one mental model, no per-page registry to drift out of sync.
- FOUC strategy is a copy-paste of the existing theme-toggle pattern. Already proven on this codebase, zero novel risk.
- Companion-file model (`*.en.md`) for v2 is right. Frontmatter `body_en:` would explode the file size and break Obsidian preview; sibling files keep each language editable in isolation.

**Issues / questions:**

### A1. The `[lang="en"] { display: none }` default rule is a global side-effect
Any third-party widget that uses the `lang` attribute (e.g. embedded YouTube, Mermaid, even `<html lang>`) will be affected by the **descendant** form `[lang="en"]`. The selector matches *any* element with `lang="en"`, including `<html lang="en">` itself (which is `display: block` UA default, rule wouldn't change visibility, but still a smell).

**Fix:** scope to data-attribute on a wrapper.

```css
/* default */
.t-en { display: none; }
html[data-lang="en"] .t-ko { display: none; }
html[data-lang="en"] .t-en { display: revert; }
```

`<T>` emits class `t-ko` / `t-en` AND `lang="ko"` / `lang="en"` (semantic + selector hook). Costs 7 chars per element, buys global-scope safety.

### A2. `display: revert` resolves to `inline` even when inside a flex container
For `<T tag="p" ko=… en=…>`, the two `<p>` are siblings in the parent. After `display: revert` on the visible one, layout is correct. But if the *parent* has `display: flex` and we inserted two siblings, both participate in flex layout when both visible — but only one is ever visible. ✅ no issue.

The actual edge: `<T>` inside a `display: grid` `auto-flow: row` container. Empty grid cells where the hidden language sits? No — `display: none` element does not consume a track. ✅ verified.

### A3. SSR-emitted markup is doubled — what's the bytes-on-wire impact?

Rough count: home page has ~12 `<T>` instances (nav 4, eyebrows 3, button 2, footer cols 4 headers + tagline). About has ~30. Average string length 18 chars × 2 langs × 30 strings × 5 pages = ~5.4 kB extra HTML across the site. **Acceptable.** Gzip will halve it.

### A4. The toggle as written re-runs `astro:page-load` listeners on every navigation but the FOUC script in `<head>` only runs once on full load
On internal navigation via Astro view transitions (if enabled), `<head>` is preserved but `data-lang` set there persists. ✅ no regression. The init function in TopBar handles re-attaching the click handler. ✅

But: **what if the user toggles language, then navigates to another page via a regular `<a>` link?** Full page load → boot script reads localStorage → applies. ✅
What if they navigate via Astro client-side router (currently disabled in this repo, view transitions not enabled per `astro.config.mjs` check)? Boot script in `<head>` doesn't re-fire, but `data-lang` is still on `<html>` from before. ✅

### A5. `T.astro` doesn't handle interpolation
What about `"All ${count} posts"`? Plan glosses over this. Solution:

```astro
<T ko={`전체 ${count}편`} en={`All ${count} posts`} />
```

Parent computes both strings, passes in. Simple. Document this in the skill description so authors don't try to put `{count}` slots inside the strings.

### A6. The `lang-notice` paragraph for KOR-only posts is per-page hardcoded
Plan says "add `lang-notice` paragraph for EN-mode KOR-only posts". But how do we *know* a post is KOR-only? Currently every post would qualify until the bilingual skill ships content. Two options:

(i) **Always show the notice in EN mode**, even for posts that are mixed-language or English-primary. Simple, slightly noisy.
(ii) **Detect**: frontmatter `has_en: true` → suppress notice; else show.

Adopt (ii). It's one extra schema line (already in plan §5) and one conditional in `[slug].astro`. Notice copy:

```
EN: This post is published in Korean. Toggle in the top bar at any time.
```

Don't apologize, don't promise translation. State the fact.

## B. Data flow

The toggle state lives in three places that must stay in sync:
1. `localStorage.lang`
2. `<html data-lang>`
3. `<html lang>`

Plan keeps them in sync via the boot script + click handler. ✅

But: **what if the user has the site open in two tabs**? Tab A toggles to EN, tab B is still KOR. Acceptable for v1 (matches theme behavior, which has the same property). If we want sync, add a `storage` event listener — easy upgrade, defer.

## C. Edge cases not in the plan

### C1. What about the `<title>` tag?

`<title>` can't contain children. The plan emits `<T>` everywhere, but the page `<title>` (set in `Base.astro` props) is a single string.

**Decision:** title stays in primary language (KOR-flavored "posts · meshblog"). For ENG users, the page title remains the same Korean-tinged compound. Acceptable because:
- Title is mostly slug-like ("about · meshblog", "404 · not found · meshblog")
- All current titles are already mixed KO/EN
- Search engines see the page title; SEO unaffected

If we *did* want bilingual `<title>`, every page would need `titleKo` / `titleEn` props on `<Base>`. Defer.

### C2. Meta description

Same logic as title. Single string, primary language. ✅ defer.

### C3. The CmdK search palette

Strings like "search the vault", "no results", placeholders. The plan doesn't mention CmdK.

**Action:** add `src/components/ui/organisms/CmdK.astro` to §5 changeset. ~6 strings to wrap. Add to LOC est: +6.

### C4. The HelpModal

Same — keyboard shortcut help text. Add to changeset. ~10 strings. +10 LOC.

### C5. The `GraphControls.astro` (graph page)

L1/L2/L3 buttons, depth labels, mode toggles. Plan §2 doesn't mention the graph page at all. **Either include it (consistent UX) or explicitly defer (graph chrome is technical, English-leaning anyway).**

**Decision:** include header/title strings on `/graph` page. The depth labels (L1/L2/L3, "concept" / "notes") are short English-readable codes — leave as-is. ~4 strings on the graph page heading. Add `src/pages/graph.astro` to §5: +6 LOC.

### C6. Categories page

`src/pages/categories/index.astro` and `[slug].astro` not in the changeset. Need wrap. ~5 strings each. +14 LOC total.

### C7. Korean-only structural words

Some labels (e.g. eyebrow `vault · public · 2026`) have no Korean form because they're mono-eyebrow style codes. Treat them as language-neutral, do not wrap. **Convention to document:** "If the string is mono-cased, single-word, or already an English code (eyebrows, badges), do not wrap with `<T>`."

Add this to the skill description so future contributors don't mechanically wrap everything.

## D. Test coverage gaps

Plan §6 covers good ground. Adds:

### D1. Snapshot test for boot script timing

Add a Playwright e2e (or simpler `@web/test-runner` test) that:
1. Loads `/` with no localStorage → asserts `<html data-lang>` is set BEFORE first paint (use `requestAnimationFrame` proxy).
2. Sets localStorage `lang=en`, reloads → asserts EN content is the visible one in the rendered DOM.

If we don't have an e2e harness, a `vitest` + JSDOM test that boots the inline script string and asserts it sets the attribute is sufficient.

### D2. Toggle persistence test

`vitest`: simulate click → assert `localStorage.getItem('lang')` flipped → assert `data-lang` attribute updated.

### D3. The `lang-notice` conditional

`vitest` + Astro container test or HTML grep: post with `has_en: true` → no notice. Post with `has_en` undefined → notice present.

## E. Performance

### E1. Inline boot script size

~150 bytes minified. Negligible. ✅

### E2. CSS rules

Three new global rules. ~120 bytes. ✅

### E3. HTML payload

§A3 measured ~5 kB site-wide. ✅

### E4. JS

Toggle init ~600 bytes. ✅ no concern.

## F. Verdict — what changes before code starts

1. **§3.3 CSS rule:** switch from `[lang="en"]` to `.t-en` / `.t-ko` class-based selectors. Keep `lang` attribute for semantics.
2. **§3.7 lang-notice:** make it conditional on `has_en === true` in frontmatter. Add to `src/content/config.ts` schema. Plan §5 already had the schema line — confirm it covers `has_en` AND not require it on every note.
3. **Add to §5 changeset:** `CmdK.astro`, `HelpModal.astro`, `src/pages/graph.astro`, `src/pages/categories/index.astro`, `src/pages/categories/[slug].astro`. New total LOC: ~330 added.
4. **Document the wrap convention** (§C7) in the new skill's description and at the top of `T.astro`.
5. **Test plan:** add D1–D3 above.
6. **Acknowledge §C1–C2:** title/description stay primary-language. Out of v1 scope. Document in plan §8.

After these tweaks, the plan is implementation-ready. Estimated work: 1 focused day.

---

## Decision gate

Approve as-is, approve with the F.1–F.6 amendments, or push back on scope?

---

# G amendments — post outside-voice review (2026-05-01)

Outside-voice fresh-context review caught two P1s and four P2s the prior eng review missed. Final plan absorbs these as G1–G6.

## G1. `<html lang>` stays content-driven; toggle uses `data-lang` only

**Problem (B2, P1):** `Base.astro:35-42` infers `<html lang>` from content character density (AF1). The original plan's boot script overwrote it with the user's toggle preference, which means a Korean post served to a visitor with `lang=en` toggled would render `<html lang="en">` over Korean DOM — breaks screen readers, Google language detection, and font substitution.

**Fix:** boot script and click handler set **only** `data-lang` on `<html>`. `lang` attribute stays whatever AF1 inferred at SSR time. CSS rules already use `data-lang`, no change there.

```js
// boot script — corrected
document.documentElement.setAttribute('data-lang', lang);
// do NOT setAttribute('lang', ...)
```

## G2. Auto-detect via `navigator.languages` array, not `.language`

**Problem (B6, P2):** Korean developers commonly run OS in English (`en-US` primary, `ko-KR` secondary). `navigator.language` returns only primary → most Korean visitors land on EN by default, opposite of intent.

**Fix:** check the entire `navigator.languages` array for any Korean entry.

```js
function detectLang() {
  const stored = localStorage.getItem('lang');
  if (stored === 'ko' || stored === 'en') return stored;
  const langs = navigator.languages || [navigator.language || 'en'];
  return langs.some(l => l.toLowerCase().startsWith('ko')) ? 'ko' : 'en';
}
```

## G3. SEO claim downgraded

**Problem (B5, P2):** §7 risks table called the dual-DOM `display:none` pattern "recognized" by Google. Current Google guidance treats *full alternate-language mirrors* hidden by CSS as low-value duplicate content. The recognized-pattern claim was for tabs/accordions, not page mirrors.

**Fix:** rewrite §7 SEO row as: "We accept duplicate-content risk for personal-blog scale. Site is not SEO-optimized; meshblog is a reading room, not a discovery surface. If Search Console flags duplicates, escalate to dual-route SSG (v2)."

## G4. `discover.ts` + `build-index.ts` learn about `*.en.md` companions (PR2 prerequisite)

**Problem (B1, P1):** the original plan shipped the `/new-bilingual-post` skill that creates `<slug>.md` + `<slug>.en.md` — but `src/lib/content/discover.ts` filters `.md` by extension only, and `scripts/build-index.ts:232` does `slug = basename(path, extname(path))`, yielding `foo-bar.en` as a distinct slug. Without ingestion changes, the very first bilingual post creates duplicate notes table rows, duplicate `/notes/foo-bar.en/` routes, duplicate CmdK entries, duplicate graph nodes, duplicate RSS items.

**Fix (PR2 selectors before the skill ships):**

1. `src/lib/content/discover.ts`: detect `.en.md` files, return them as `{ path, folder, isCompanion: true, primarySlug }` instead of as primary entries.
2. `scripts/build-index.ts`: when ingesting a primary `.md`, look for the matching `.en.md` companion in the same dir; if present, attach its body as `body_en` on the primary row (new column) and parse its frontmatter only for `title_en`. Set `has_en: true` on the primary. Companion file produces **zero** independent rows.
3. Add fixture pair `test/fixtures/bilingual/foo.md` + `foo.en.md` and a build-index test asserting:
   - exactly one row in `notes` for slug `foo`
   - `has_en === 1`, `body_en` contains the EN markdown
   - `notes-manifest.json` contains one entry, not two
4. Migration: any preexisting `.en.md` companion (none today) is fine; build is idempotent on next run.

## G5. CmdK index gets a `lang` field + runtime filter

**Problem (B3, P2):** `src/components/ui/organisms/CmdK.astro:19-34` ships a flat JSON of `{title, href, meta}`. With bilingual notes (post-G4), each note has both `title` and `title_en`. The plan didn't address indexing strategy.

**Fix:** include both titles per note with a `lang` tag on each entry; client-side filter by current `document.documentElement.dataset.lang` before scoring.

```ts
type CmdKItem = { title: string; href: string; meta: string; lang: 'ko' | 'en' }
// Build emits two items per bilingual note (lang:'ko' + lang:'en'),
// one item for monolingual notes (lang inferred from primary).
// Search filters by current data-lang at query time.
```

This keeps the index size at most 2× current and the search clean.

## G6. Schema lives in `build-index.ts` parsing, not Astro content collections

**Problem:** plan §5 cited `src/content/config.ts` for the `has_en` field. That file does not exist — this repo bypasses Astro content collections and parses frontmatter via `gray-matter` in `scripts/build-index.ts`.

**Fix:** drop the `src/content/config.ts` line from §5. Add `has_en` handling to `build-index.ts` frontmatter parser (already touched by G4). Schema migration: `ALTER TABLE notes ADD COLUMN has_en INTEGER DEFAULT 0; ALTER TABLE notes ADD COLUMN body_en TEXT;` — applied via the existing migration runner (check `src/lib/db/`).

---

## Final PR split (post G amendments)

**PR1 — `feat/concise-copy-and-i18n-toggle`** (sonnet agent, ~1 day)

Scope: concise copy pass + toggle infra. **No companion files, no ingestion changes, no new skill.**

- New: `src/components/ui/atoms/T.astro` (with `.t-ko`/`.t-en` classes per F1).
- `src/layouts/Base.astro`: inline boot script (G1: `data-lang` only) + global `.t-*` CSS.
- `src/components/ui/organisms/TopBar.astro`: lang toggle button + JS init (G2: `navigator.languages` array).
- Concise copy + `<T>` wrapping across: `index.astro`, `about.astro`, `404.astro`, `posts/index.astro`, `notes/index.astro`, `categories/index.astro`, `categories/[slug].astro`, `graph.astro`, `Footer.astro`, `CmdK.astro` UI labels, `HelpModal.astro`.
- `posts/[slug].astro` and `notes/[slug].astro`: add `<p class="t-en lang-notice">` shown only in EN mode (no `has_en` gating yet — every Korean post shows it; refined in PR2 once `has_en` exists).
- Tests: T.astro renders both classes + lang attrs; toggle persistence (vitest + JSDOM); boot script timing; `blog-bw-polish` clean.
- §7 SEO row rewritten per G3.

LOC: ~330 added, ~70 removed, ~14 files touched.

**PR2 — `feat/bilingual-posts`** (sonnet agent, ~0.5–1 day, after PR1 merge)

Scope: ingestion learns companions + skill ships.

- `src/lib/content/discover.ts`: companion detection (G4 step 1).
- `scripts/build-index.ts`: companion ingestion + `has_en` + `body_en` (G4 step 2 + G6).
- DB migration adding `has_en` + `body_en` columns.
- `src/components/ui/organisms/CmdK.astro` + builder script: `lang` field + runtime filter (G5).
- `posts/[slug].astro` + `notes/[slug].astro`: `lang-notice` becomes conditional on `has_en === false`.
- New: `scripts/new-bilingual-post.ts` + `.claude/skills/new-bilingual-post/SKILL.md`.
- New: `package.json` script `"new-bilingual-post"`.
- Fixture pair under `test/fixtures/bilingual/` + ingestion test (G4 step 3).
- Tests: `new-bilingual-post.test.ts` (slugify + dual-write), CmdK lang filter unit test.

LOC: ~250 added, ~10 removed, ~9 files touched.

**Sequencing:** PR1 ships first (immediate user value: concise copy live; toggle infra latent — EN strings already in DOM). PR2 follows after PR1 merge so its ingestion changes don't conflict with PR1's frontend wrap-rate. Each PR follows the project's mandatory post-push CI/CD verification (CLAUDE.md §post-push).
