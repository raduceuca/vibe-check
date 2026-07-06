import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import { baseOptions } from '@/lib/layout.shared'

const DocsRootLayout = ({ children }: { children: ReactNode }) => (
  <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
    {children}
  </DocsLayout>
)

export default DocsRootLayout
