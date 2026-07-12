import type { ReactNode } from 'react'
import { SiteShell } from '@/components/site/SiteShell'

// The /fix shell. Primary navigation is the shared SiteSidebar (its "Fix guides"
// section expands to the four categories and, on a category / problem page, the
// active category expands to its problems) — so the section no longer carries its
// own sidebar. This layout just provides the single <main> landmark + content
// gutter to the right of the rail.
const FixLayout = ({ children }: { children: ReactNode }) => (
  <SiteShell>
    <main className="vc-fix-main">{children}</main>
  </SiteShell>
)

export default FixLayout
