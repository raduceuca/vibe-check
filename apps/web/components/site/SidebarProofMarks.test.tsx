import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SidebarBoundary, SidebarRailTerminals } from './SidebarProofMarks'

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
