'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ExtArrow } from '@/components/site/navIcons'
import { GITHUB_URL } from '@/lib/site'

const DRAWER_ITEMS = [
  { label: 'Fix guides', href: '/fix' },
  { label: 'Docs', href: '/docs' },
  { label: 'Scan a URL', href: '/scan' },
  { label: 'Examples', href: '/docs/examples' },
  { label: 'GitHub', href: GITHUB_URL, external: true },
  { label: 'Changelog', href: `${GITHUB_URL}/releases`, external: true },
] as const

export const SiteMenu = () => {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    const first = panelRef.current?.querySelector<HTMLElement>('a, button')
    first?.focus()
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="vc-topbar-menu-btn"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      {open && (
        <div
          className="vc-drawer-backdrop"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <div
        ref={panelRef}
        id={menuId}
        className={`vc-drawer${open ? ' is-open' : ''}`}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <ul className="vc-drawer-list">
          {DRAWER_ITEMS.map((item) => (
            <li key={item.href}>
              {'external' in item && item.external ? (
                <a
                  className="vc-drawer-link"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                >
                  {item.label}
                  <ExtArrow />
                </a>
              ) : (
                <Link className="vc-drawer-link" href={item.href} onClick={close}>
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
