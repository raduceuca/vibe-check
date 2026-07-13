import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomNav } from '../BottomNav.js'

describe('BottomNav agent connection state', () => {
  it('makes the waiting agent state visible from every view', () => {
    render(
      <BottomNav
        activeView="monitor"
        onSelect={vi.fn()}
        mode="vibe"
        counts={{ agent: 2, seo: 0, aeo: 0 }}
        agentConnectionState="waiting"
      />,
    )

    expect(screen.getByRole('tab', { name: /Fix.*2 issues.*waiting for AI agent/i })).toBeTruthy()
    expect(screen.getByTestId('vibe-check-agent-connection-dot').getAttribute('data-state')).toBe('waiting')
  })

  it('exposes a connected state without an issue count', () => {
    render(
      <BottomNav
        activeView="settings"
        onSelect={vi.fn()}
        mode="technical"
        counts={{ agent: 0, seo: 0, aeo: 0 }}
        agentConnectionState="connected"
      />,
    )

    expect(screen.getByRole('tab', { name: /Agent.*agent connected/i })).toBeTruthy()
    expect(screen.getByTestId('vibe-check-agent-connection-dot').getAttribute('data-state')).toBe('connected')
  })
})
