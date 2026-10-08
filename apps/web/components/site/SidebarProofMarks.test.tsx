import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import { describe, expect, it, vi } from 'vitest'
import type { SidebarData } from '@/lib/nav'
import { baseOptions, DocsSidebarFooter } from '@/lib/layout.shared'
import { SiteSidebar } from './SiteSidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

const sidebarData: SidebarData = {
  version: '0.2.0',
  primary: [{ label: 'Home', href: '/' }],
  fix: [
    {
      key: 'rendering',
      label: 'Rendering',
      href: '/fix/rendering',
      problems: [],
    },
  ],
  docs: [{ label: 'Getting Started', href: '/docs' }],
  resources: [
    {
      label: 'GitHub',
      href: 'https://github.com/wcgw/vibe-check',
      external: true,
    },
  ],
  github: 'https://github.com/wcgw/vibe-check',
}

describe('sidebar chrome', () => {
  const globalStyles = readFileSync(
    new URL('../../app/global.css', import.meta.url),
    'utf8',
  )

  it('does not paint print marks on the custom sidebar shells', () => {
    const markup = renderToStaticMarkup(<SiteSidebar data={sidebarData} />)
    const { document } = parseHTML(`<main>${markup}</main>`)

    expect(document.querySelectorAll('.vc-side, .vc-side-drawer')).toHaveLength(2)
    expect(document.querySelector('.vc-side-rail-marks')).toBeNull()
    expect(document.querySelector('[data-vc-sidebar-boundary]')).toBeNull()
    expect(document.querySelector('[data-vc-sidebar-mobile-boundary]')).toBeNull()
  })

  it('keeps docs footer content without rail terminals', () => {
    const markup = renderToStaticMarkup(
      <div data-docs-footer="">{<DocsSidebarFooter />}</div>,
    )

    expect(markup).toContain('Resources')
    expect(markup).not.toContain('vc-side-rail-marks')
    expect(markup).not.toContain('data-vc-sidebar-boundary')
  })

  it('does not attach a mobile proof mark to the docs nav title', () => {
    const markup = renderToStaticMarkup(<>{baseOptions().nav?.title}</>)

    expect(markup).not.toContain('data-vc-sidebar-mobile-boundary')
    expect(markup).not.toContain('vc-docs-mobile-boundary-bar')
  })

  it('keeps mobile navigation controls at a 40px hit area', () => {
    expect(
      /\.vc-side-burger\s*{[^}]*width: 40px;[^}]*height: 40px;/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\.vc-side-close\s*{[^}]*width: 40px;[^}]*height: 40px;/.test(
        globalStyles,
      ),
    ).toBe(true)
  })
})
