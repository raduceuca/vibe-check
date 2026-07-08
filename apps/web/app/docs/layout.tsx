import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import { baseOptions, DocsSidebarFooter } from '@/lib/layout.shared'

// Docs keep Fumadocs' own DocsLayout (it renders the page tree with native group
// expansion, active states and the mobile drawer). The .vc-docs wrapper exposes
// the --vc-* tokens and scopes the sidebar re-skin (global.css) so the docs
// sidebar reads identically to the marketing SiteSidebar. The Resources group +
// version footer are injected via the sidebar's `footer` slot.
const DocsRootLayout = ({ children }: { children: ReactNode }) => (
  <div className="vc-docs">
    <DocsLayout
      tree={source.getPageTree()}
      sidebar={{ footer: <DocsSidebarFooter /> }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  </div>
)

export default DocsRootLayout
