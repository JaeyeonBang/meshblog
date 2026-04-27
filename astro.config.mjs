// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

export default defineConfig({
  site: 'https://jaeyeonbang.github.io',
  base: '/meshblog',
  trailingSlash: 'ignore',
  integrations: [react()],
  output: 'static',
  build: { format: 'directory' },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: false,
    },
  },
  vite: {
    ssr: { noExternal: [] },
    optimizeDeps: { exclude: ['better-sqlite3'] },
  },
})
