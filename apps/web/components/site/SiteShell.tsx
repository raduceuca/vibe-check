import type { ReactNode } from 'react'
import { SiteSidebar } from './SiteSidebar'
import { SiteTopBar } from './SiteTopBar'
import { SiteFooter } from './SiteFooter'
import { buildSidebarData } from '@/lib/nav'

// Marketing shell: top bar on `/` and `/scan`; sidebar tree on `/fix/**`.
export const SiteShell = ({
  children,
  landing = false,
  variant,
  install = 'home',
  footer = false,
}: {
  children: ReactNode
  landing?: boolean
  /** Prefer explicit variant; `landing` still implies topbar for back-compat. */
  variant?: 'topbar' | 'sidebar'
  install?: 'home' | 'scan'
  footer?: boolean
}) => {
  const shell = variant ?? (landing ? 'topbar' : 'sidebar')

  if (shell === 'topbar') {
    return (
      <div className={`vc-landing vc-app vc-app-topbar${landing ? ' vc-app-landing' : ''}`}>
        <SiteTopBar install={install} />
        <div className="vc-app-main">{children}</div>
        {footer ? <SiteFooter /> : null}
      </div>
    )
  }

  const data = buildSidebarData()
  return (
    <div className={`vc-landing vc-app${landing ? ' vc-app-landing' : ''}`}>
      <SiteSidebar data={data} />
      <div className="vc-app-main">{children}</div>
    </div>
  )
}
