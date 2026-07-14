import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'
import { ImpactCard } from '../ImpactCard.js'

const impact: ProjectImpactSummary = {
  projectId: 'storefront',
  detected: 16,
  sent: 14,
  uniqueIssuesFixed: 10,
  verifiedFixes: 12,
  regressionsCaught: 3,
  verificationFailures: 1,
  medianFixTimeMs: 4_000,
  metrics: [{
    kind: 'duplicate-requests-removed',
    value: 4,
    unit: 'requests',
    confidence: 'measured',
    label: 'duplicate requests removed',
    scope: 'per observed page load',
  }],
}

describe('ImpactCard', () => {
  it('shows earned outcomes and honest share copy', () => {
    const onCopy = vi.fn()
    render(<ImpactCard impact={impact} compact={false} onCopy={onCopy} />)
    expect(screen.getByText('12 verified fixes')).toBeTruthy()
    expect(screen.getByText('3 regressions caught')).toBeTruthy()
    expect(screen.getByText(/4 duplicate requests removed/)).toBeTruthy()
    expect(screen.queryByText(/transfer/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /copy impact summary/i }))
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('helped verify 12 fixes'))
  })

  it('keeps the compact card focused on exact outcomes', () => {
    render(<ImpactCard impact={impact} compact onCopy={vi.fn()} />)
    expect(screen.getByText('12 verified fixes')).toBeTruthy()
    expect(screen.getByText('3 regressions caught')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /copy impact summary/i })).toBeNull()
  })
})
