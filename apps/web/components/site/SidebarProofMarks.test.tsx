import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import { describe, expect, it, vi } from 'vitest'
import type { SidebarData } from '@/lib/nav'
import { DocsSidebarFooter } from '@/lib/layout.shared'
import { SidebarBoundary, SidebarRailTerminals } from './SidebarProofMarks'
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

describe('sidebar proof marks', () => {
  const globalStyles = readFileSync(
    new URL('../../app/global.css', import.meta.url),
    'utf8',
  )

  it('terminates the outer rail with neutral cut marks', () => {
    const markup = renderToStaticMarkup(<SidebarRailTerminals />)

    expect(markup.match(/data-vc-structural-rule="vertical"/g)).toHaveLength(2)
    expect(markup).not.toContain('data-vc-rule-color="true"')
  })

  it('marks meaningful sidebar group breaks with a compact proof nib', () => {
    const markup = renderToStaticMarkup(<SidebarBoundary />)

    expect(markup).toContain('data-vc-sidebar-boundary')
    expect(markup).toContain('data-vc-rule-color="true"')
  })

  it('places terminals and boundaries in both custom sidebar shells', () => {
    const markup = renderToStaticMarkup(<SiteSidebar data={sidebarData} />)
    const { document } = parseHTML(`<main>${markup}</main>`)
    const shells = document.querySelectorAll('.vc-side, .vc-side-drawer')

    expect(shells).toHaveLength(2)
    shells.forEach((shell) => {
      expect(shell.firstElementChild?.classList.contains('vc-side-rail-marks')).toBe(
        true,
      )
      expect(shell.querySelector('.vc-side-boundary-resources')).not.toBeNull()
      expect(shell.querySelector('.vc-side-boundary-footer')).not.toBeNull()
    })
  })

  it('orders the docs rail and proof boundaries around its footer groups', () => {
    const markup = renderToStaticMarkup(
      <div data-docs-footer="">{<DocsSidebarFooter />}</div>,
    )
    const { document } = parseHTML(markup)
    const footer = document.querySelector('[data-docs-footer]')

    expect(footer?.firstElementChild?.classList.contains('vc-side-rail-marks')).toBe(
      true,
    )
    expect(footer?.querySelectorAll('[data-vc-sidebar-boundary]')).toHaveLength(2)
    expect(
      footer?.querySelector('.vc-side-boundary-resources + .vc-side-grouplabel'),
    ).not.toBeNull()
    expect(
      footer?.querySelector('.vc-side-boundary-footer + .vc-side-footer'),
    ).not.toBeNull()
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

  it('mirrors terminals onto the Fumadocs mobile drawer left rail', () => {
    expect(
      /\.vc-side,\s*\.vc-side-drawer,\s*\.vc-docs #nd-sidebar,\s*\.vc-docs #nd-sidebar-mobile\s*{[^}]*isolation: isolate;/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\.vc-docs #nd-sidebar-mobile \.vc-side-rail-marks\s*{[^}]*inset: 0 auto 0 -1px;/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\.vc-docs #nd-sidebar-mobile \.vc-side-rail-mark\s*{[^}]*right: auto;[^}]*left: 0;/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\.vc-docs #nd-sidebar-mobile \.vc-side-rail-mark-top\s*{[^}]*transform: scaleX\(-1\);/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\.vc-docs #nd-sidebar-mobile \.vc-side-rail-mark-bottom\s*{[^}]*transform: scale\(-1, -1\);/.test(
        globalStyles,
      ),
    ).toBe(true)
  })

  it('gives only Fumadocs mobile sidebar triggers a 40px minimum hit area', () => {
    expect(
      globalStyles.includes(
        '.vc-docs #nd-subnav > button:has(> .lucide-panel-left),',
      ),
    ).toBe(true)
    expect(
      globalStyles.includes(
        '.vc-docs #nd-sidebar-mobile button:has(> .lucide-panel-left) {',
      ),
    ).toBe(true)
    expect(
      /\.vc-docs #nd-sidebar-mobile button:has\(> \.lucide-panel-left\)\s*{[^}]*min-width: 40px;[^}]*min-height: 40px;/.test(
        globalStyles,
      ),
    ).toBe(true)
  })

  it('normalizes proof boundaries to one physical sidebar inset', () => {
    expect(globalStyles.includes('--vc-side-boundary-inset: 23px;')).toBe(true)
    expect(globalStyles.includes('.vc-side-scroll .vc-side-boundary {')).toBe(
      true,
    )
    expect(
      globalStyles.includes('.vc-docs #nd-sidebar .vc-side-boundary,'),
    ).toBe(true)
    expect(
      globalStyles.includes(
        '.vc-docs #nd-sidebar-mobile .vc-side-boundary {',
      ),
    ).toBe(true)
    expect(
      /\.vc-side-scroll \.vc-side-boundary\s*{[^}]*--vc-side-boundary-local-inset:\s*calc\(var\(--vc-side-boundary-inset\) - 14px\);/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\.vc-docs #nd-sidebar \.vc-side-boundary,\s*\.vc-docs #nd-sidebar-mobile \.vc-side-boundary\s*{[^}]*--vc-side-boundary-local-inset:\s*calc\(var\(--vc-side-boundary-inset\) - 16px\);/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\.vc-side-boundary\s*{[^}]*margin-inline:\s*var\(--vc-side-boundary-local-inset\);[^}]*width:\s*calc\(\s*100%\s*-\s*var\(--vc-side-boundary-local-inset\)\s*-\s*var\(--vc-side-boundary-local-inset\)\s*\);/.test(
        globalStyles,
      ),
    ).toBe(true)
  })
})
