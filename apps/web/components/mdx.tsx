import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'

// Merge Fumadocs' default MDX components (headings, code blocks, callouts,
// cards, steps, tabs) with any per-page overrides.
export const getMDXComponents = (components?: MDXComponents): MDXComponents => ({
  ...defaultMdxComponents,
  ...components,
})
