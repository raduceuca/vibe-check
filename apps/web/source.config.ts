import { defineDocs, defineConfig } from 'fumadocs-mdx/config'

// Docs content collection. Scans `content/docs` for MDX pages + `meta.json`
// ordering files; the frontmatter/meta schemas default to Fumadocs' built-ins.
export const docs = defineDocs({
  dir: 'content/docs',
})

export default defineConfig()
