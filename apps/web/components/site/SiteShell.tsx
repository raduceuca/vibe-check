import type { ReactNode } from 'react'
import { SiteSidebar } from './SiteSidebar'
import { buildSidebarData } from '@/lib/nav'

// ── The app shell for the marketing + fix surfaces ────────────────────────────
// A persistent left SiteSidebar plus the content column to its right. Used on the
// landing, /scan and the /fix section (docs use Fumadocs' own DocsLayout, styled
// to match). `landing` opts into the widget-gutter reconciliation (see
// global.css): the live corner widget is fixed bottom-right, so on wide screens
// the content reserves a right gutter while the widget is expanded.
export const SiteShell = ({
  children,
  landing = false,
}: {
  children: ReactNode
  landing?: boolean
}) => {
  const data = buildSidebarData()
  return (
    <div className={`vc-landing vc-app${landing ? ' vc-app-landing' : ''}`}>
      <SiteSidebar data={data} />
      <div className="vc-app-main">{children}</div>
    </div>
  )
}
