import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgentConnectionStatus } from '../AgentConnectionStatus.js'
import type { BeaconStatus } from '@wcgw/vibe-check-core'

const status = (state: 'no-agent' | 'watching' | 'busy' | 'stale', conflictAt: number | null = null): BeaconStatus => ({
  configured: true,
  projectId: 'project-a',
  instanceId: 'browser-a',
  lastAttemptAt: 1,
  lastOk: true,
  projectStatus: { projectId: 'project-a', state, queueDepth: 0, leaseExpiresAt: 15_000, conflictAt },
  statusError: null,
})

describe('AgentConnectionStatus', () => {
  it('shows setup, offline, waiting, connected, busy, and stale states truthfully', () => {
    const { rerender } = render(<AgentConnectionStatus mode="technical" />)
    expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('MCP not configured')

    rerender(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={{ ...status('no-agent'), lastOk: false, statusError: 'hub-offline' }} />)
    expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('MCP server offline')

    rerender(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('no-agent')} />)
    expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('Waiting for an agent')

    rerender(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('watching')} />)
    expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('Agent connected')

    rerender(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('busy')} />)
    expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('Agent working')

    rerender(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('stale')} />)
    expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('Agent disconnected')
  })

  it('keeps the owner connected while warning about a rejected second agent', () => {
    render(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('watching', Date.now())} />)
    expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('Agent connected')
    expect(screen.getByText(/second agent was rejected/i)).toBeTruthy()
  })
})
