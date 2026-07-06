'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── The subtle /fix sidebar ──────────────────────────────────────────────────
// Category → problems, matching the docs sidebar's restraint. A Client Component
// only for the active-link highlight (usePathname); it receives a lightweight
// tree of {slug,label} from the server, so none of the heavy problem content is
// bundled into client JS.

export interface SidebarSection {
  readonly key: string
  readonly label: string
  readonly tagline: string
  readonly items: readonly { readonly slug: string; readonly label: string }[]
}

export const FixSidebar = ({ tree }: { tree: readonly SidebarSection[] }) => {
  const pathname = usePathname()
  return (
    <nav className="vc-fix-sidebar" aria-label="Fix guides">
      <Link
        href="/fix"
        className="vc-fix-side-home"
        aria-current={pathname === '/fix' ? 'page' : undefined}
      >
        All problems
      </Link>
      {tree.map((section) => {
        const catHref = `/fix/${section.key}`
        return (
          <div className="vc-fix-side-group" key={section.key}>
            <Link
              href={catHref}
              className="vc-fix-side-cat"
              aria-current={pathname === catHref ? 'page' : undefined}
            >
              {section.label}
            </Link>
            <ul className="vc-fix-side-list">
              {section.items.map((item) => {
                const href = `/fix/${item.slug}`
                const active = pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <li key={item.slug}>
                    <Link
                      href={href}
                      className="vc-fix-side-link"
                      data-active={active ? 'true' : undefined}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
