import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PillProofRegister, ProofControlStrip, TopProofRegister } from './ProofMarks.js'

describe('proof-control marks', () => {
  it('renders a varied density strip instead of four equal dashes', () => {
    const { container } = render(<ProofControlStrip />)
    const patches = container.querySelectorAll('[data-wcgw-proof-patch]')

    expect(patches).toHaveLength(8)
    expect(new Set(Array.from(patches, (node) => node.getAttribute('data-width'))).size).toBeGreaterThan(2)
  })

  it('composes the expanded register as a top-edge proof control', () => {
    render(<TopProofRegister faulted />)

    const register = screen.getByTestId('wcgw-top-proof-register')
    expect(register.getAttribute('aria-hidden')).toBe('true')
    expect(register.getAttribute('data-faulted')).toBe('true')
    expect(register.textContent).toContain('LIVE PROOF')
    expect(register.querySelector('[data-wcgw-registration-target]')).toBeTruthy()
  })

  it('keeps the pill register separate from metric content', () => {
    render(<PillProofRegister />)

    expect(screen.getByTestId('wcgw-pill-proof-register').getAttribute('aria-hidden')).toBe('true')
  })
})
