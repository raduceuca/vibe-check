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

  it('uses five-pixel standard and four-pixel compact proof weights', () => {
    const standard = render(<ProofControlStrip />).container.firstElementChild as HTMLElement
    const compact = render(<ProofControlStrip compact />).container.firstElementChild as HTMLElement

    expect(standard.dataset.wcgwProofWeight).toBe('standard')
    expect(standard.style.height).toBe('5px')
    expect(compact.dataset.wcgwProofWeight).toBe('compact')
    expect(compact.style.height).toBe('4px')
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

  it('uses larger top and pill registration targets', () => {
    const top = render(<TopProofRegister />).container
    const pill = render(<PillProofRegister />).container

    expect(top.querySelector('[data-wcgw-registration-target]')?.getAttribute('width')).toBe('14')
    expect(pill.querySelector('[data-wcgw-registration-target]')?.getAttribute('width')).toBe('8')
  })
})
