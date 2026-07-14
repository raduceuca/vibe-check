import { describe, expect, it } from 'vitest'
import { ANIMATIONS_CSS } from '../theme.js'

describe('widget theme', () => {
  it('keeps the collapsed pill surface opaque while hovered', () => {
    const hoverRule = ANIMATIONS_CSS.match(/\[data-wcgw-pill\]:hover\s*\{([^}]*)\}/)?.[1]

    expect(hoverRule).toContain('var(--wcgw-bg)')
  })
})
