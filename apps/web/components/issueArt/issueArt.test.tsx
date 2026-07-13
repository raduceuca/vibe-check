import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ISSUE_ART } from './index'

describe('process-aware issue art', () => {
  it.each(Object.entries(ISSUE_ART))(
    '%s keeps K structure and at least one process plate',
    (_, Art) => {
      const markup = renderToStaticMarkup(<Art />)

      expect(markup).toContain('currentColor')
      expect(markup).toContain('data-vc-process-plate=')
      expect(markup).toMatch(/--vc-proof-(c|m|y)/)
    },
  )
})
