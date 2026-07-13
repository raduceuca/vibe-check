import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProofRail } from './ProofRail.js'

describe('ProofRail', () => {
  it('stays registered while healthy and marks the active issue state', () => {
    const { rerender } = render(<ProofRail faulted={false} />)

    const healthyRail = screen.getByTestId('wcgw-proof-rail')
    expect(healthyRail.getAttribute('aria-hidden')).toBe('true')
    expect(healthyRail.hasAttribute('data-faulted')).toBe(false)
    expect(healthyRail.querySelectorAll('[data-wcgw-proof-segment]')).toHaveLength(4)

    rerender(<ProofRail faulted />)

    expect(screen.getByTestId('wcgw-proof-rail').getAttribute('data-faulted')).toBe('true')
  })
})
