import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import { preprocessMarkdown, type PreprocessOptions } from './preprocess'

export async function renderMarkdownToHtml(
  markdown: string,
  opts: PreprocessOptions = {},
): Promise<string> {
  const processed = preprocessMarkdown(markdown, opts)
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    // Dual-theme syntax highlight: shiki injects `--shiki-light` /
    // `--shiki-dark` CSS variables on every span. CSS picks one based on
    // [data-theme="dark"] / prefers-color-scheme. Notion-style coloured tokens.
    .use(rehypeShiki, {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(processed)
  return String(file)
}
