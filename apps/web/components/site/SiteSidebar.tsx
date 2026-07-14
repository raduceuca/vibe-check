'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem, SidebarData } from '@/lib/nav'
import { GithubMark, ExtArrow } from './navIcons'
import {
  NavigationWordmark,
  ProofVersion,
} from '@/components/brand/NavigationBrand'
import { SidebarBoundary, SidebarRailTerminals } from './SidebarProofMarks'

// ── The persistent left nav ───────────────────────────────────────────────────
// A narrow, hairline-ruled sidebar shared across the landing, /scan and /fix. Its
// look is the "Quiet Instrument" translation of Agentation's sidebar: muted
// labels, a monochrome active state with a short fault-red tick, a proof-edition
// version notation, thin vertical guide lines down expanded sub-lists. The docs
// (Fumadocs) sidebar is styled to match this exactly, so the whole site reads as
// one nav. Client-only for active-route awareness (usePathname) + the mobile
// drawer; the fix tree is handed in pre-built from the server (no problem content
// in the client bundle).

// A leaf row (primary destination, doc group, fix category, problem, resource).
const SideRow = ({
  item,
  level,
  active,
}: {
  item: NavItem
  level: 0 | 1 | 2
  active: boolean
}) => {
  const className = `vc-side-row vc-side-row-l${level}`
  if (item.external) {
    return (
      <a
        href={item.href}
        className={className}
        target="_blank"
        rel="noreferrer"
        data-active={active ? 'true' : undefined}
      >
        <span className="vc-side-tick" aria-hidden="true" />
        <span className="vc-side-label">{item.label}</span>
        <ExtArrow />
      </a>
    )
  }
  return (
    <Link
      href={item.href}
      className={className}
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <span className="vc-side-tick" aria-hidden="true" />
      <span className="vc-side-label">{item.label}</span>
    </Link>
  )
}

const startsWith = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`)

// The nav body, shared verbatim between the sticky desktop aside and the mobile
// drawer so the two can never drift.
const SidebarBody = ({ data }: { data: SidebarData }) => {
  const pathname = usePathname()

  const inFix = startsWith(pathname, '/fix')
  const inDocs = startsWith(pathname, '/docs')

  // On a /fix/<x> route, <x> is either a category key or a problem slug; find the
  // owning category so it expands to reveal its problems with the current active.
  const fixSlug = inFix && pathname !== '/fix' ? pathname.slice(5).split('/')[0] : null
  const activeCategory = data.fix.find(
    (c) =>
      c.key === fixSlug || c.problems.some((p) => p.href === `/fix/${fixSlug}`),
  )

  return (
    <nav className="vc-side-nav" aria-label="Site">
      <ul className="vc-side-list">
        {data.primary.map((item) => (
          <li key={item.href}>
            <SideRow item={item} level={0} active={pathname === item.href} />
          </li>
        ))}

        {/* Fix guides — always expanded to its four categories; the active
            category further expands to its problems. */}
        <li className="vc-side-section" data-open={inFix ? 'true' : undefined}>
          <SideRow
            item={{ label: 'Fix guides', href: '/fix' }}
            level={0}
            active={pathname === '/fix'}
          />
          <ul className="vc-side-sub">
            {data.fix.map((cat) => {
              const catActive = pathname === cat.href
              const expanded = activeCategory?.key === cat.key
              return (
                <li key={cat.key}>
                  <SideRow
                    item={{ label: cat.label, href: cat.href }}
                    level={1}
                    active={catActive}
                  />
                  {expanded && cat.problems.length > 0 && (
                    <ul className="vc-side-sub vc-side-sub-deep">
                      {cat.problems.map((p) => (
                        <li key={p.href}>
                          <SideRow
                            item={p}
                            level={2}
                            active={startsWith(pathname, p.href)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </li>

        {/* Docs — always expanded to its six groups. On docs pages the Fumadocs
            sidebar (styled to match) renders the full page tree instead. */}
        <li className="vc-side-section" data-open={inDocs ? 'true' : undefined}>
          <SideRow
            item={{ label: 'Docs', href: '/docs' }}
            level={0}
            active={pathname === '/docs'}
          />
          <ul className="vc-side-sub">
            {data.docs.map((group) => (
              <li key={group.href}>
                <SideRow
                  item={group}
                  level={1}
                  active={
                    group.href === '/docs'
                      ? pathname === '/docs'
                      : startsWith(pathname, group.href)
                  }
                />
              </li>
            ))}
          </ul>
        </li>
      </ul>

      <SidebarBoundary className="vc-side-boundary-resources" />
      <div className="vc-side-grouplabel">Resources</div>
      <ul className="vc-side-list">
        {data.resources.map((item) => (
          <li key={item.href}>
            <SideRow item={item} level={0} active={false} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

const SidebarFooter = ({ data }: { data: SidebarData }) => (
  <>
    <SidebarBoundary className="vc-side-boundary-footer" />
    <div className="vc-side-footer">
      <ProofVersion version={data.version} />
      <span className="vc-side-foot-sep" aria-hidden="true">
        ·
      </span>
      <a
        href={data.github}
        className="vc-side-foot-gh"
        target="_blank"
        rel="noreferrer"
        aria-label="VibeCheck on GitHub"
      >
        <GithubMark />
      </a>
    </div>
  </>
)

export const SiteSidebar = ({ data }: { data: SidebarData }) => {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const drawerId = useId()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Escape closes the drawer; lock body scroll while it's open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      {/* Desktop: sticky rail */}
      <aside className="vc-side">
        <SidebarRailTerminals />
        <div className="vc-side-top">
          <NavigationWordmark />
          <ProofVersion version={data.version} />
        </div>
        <div className="vc-side-scroll">
          <SidebarBody data={data} />
        </div>
        <SidebarFooter data={data} />
      </aside>

      {/* Mobile: slim top bar with a hamburger */}
      <div className="vc-side-bar">
        <NavigationWordmark />
        <ProofVersion version={data.version} />
        <button
          type="button"
          className="vc-side-burger"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {/* Mobile: drawer overlay */}
      {open && (
        <button
          type="button"
          className="vc-side-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id={drawerId}
        className="vc-side-drawer"
        data-open={open ? 'true' : undefined}
        aria-hidden={open ? undefined : true}
      >
        <SidebarRailTerminals />
        <div className="vc-side-top">
          <NavigationWordmark />
          <ProofVersion version={data.version} />
          <button
            type="button"
            className="vc-side-close"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="vc-side-scroll">
          <SidebarBody data={data} />
        </div>
        <SidebarFooter data={data} />
      </aside>
    </>
  )
}
