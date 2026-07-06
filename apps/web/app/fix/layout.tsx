import type { ReactNode } from 'react'
import { CATEGORY_META, problemsInCategory } from '@/lib/problems'
import { FixSidebar, type SidebarSection } from '@/components/fix/FixSidebar'
import { SiteHeader } from '@/components/site/SiteHeader'

// The /fix shell: shared quiet header, the subtle category → problems sidebar,
// and the single <main> landmark for the section. The sidebar tree is built here
// (server) from the data and passed down as lightweight {slug,label} — the heavy
// problem content never reaches the client.

const tree: readonly SidebarSection[] = CATEGORY_META.map((c) => ({
  key: c.key,
  label: c.label,
  tagline: c.tagline,
  items: problemsInCategory(c.key).map((p) => ({ slug: p.slug, label: p.h1 })),
}))

const FixLayout = ({ children }: { children: ReactNode }) => (
  <div className="vc-landing vc-fix">
    <SiteHeader active="/fix" />
    <div className="vc-fix-shell">
      <aside className="vc-fix-aside">
        <FixSidebar tree={tree} />
      </aside>
      <main className="vc-fix-main">{children}</main>
    </div>
  </div>
)

export default FixLayout
