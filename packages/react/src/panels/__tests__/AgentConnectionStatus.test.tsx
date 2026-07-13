import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  const writeText = vi.fn<(value: string) => Promise<void>>()

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

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
    expect(screen.getByText(/owning session/i)).toBeTruthy()
  })

  it('shows exact Codex setup and project watch instruction while waiting', async () => {
    render(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('no-agent')} />)

    expect(screen.getByText(/codex mcp add vibe-check -- npx -y @wcgw\/vibe-check-mcp connect/)).toBeTruthy()
    expect(screen.getByText(/project_id "project-a"/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /copy codex setup/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy watch instruction/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(writeText).toHaveBeenNthCalledWith(
      1,
      'codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp connect',
    )
    expect(writeText.mock.calls[1]?.[0]).toContain('project_id "project-a"')
  })

  it('switches to Claude Code and Cursor setup without losing the project', () => {
    render(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('no-agent')} />)

    fireEvent.click(screen.getByRole('button', { name: 'Claude Code' }))
    expect(screen.getByText(/claude mcp add --scope local vibe-check/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }))
    expect(screen.getByText(/"mcpServers"/)).toBeTruthy()
    expect(screen.getByText(/project_id "project-a"/)).toBeTruthy()
  })

  it('shows the exact hub command and URL when offline', () => {
    render(
      <AgentConnectionStatus
        mode="technical"
        beaconUrl="http://127.0.0.1:4210"
        status={{ ...status('no-agent'), lastOk: false, statusError: 'hub-offline' }}
      />,
    )

    expect(screen.getByText(/npx -y @wcgw\/vibe-check-mcp hub/)).toBeTruthy()
    expect(screen.getByText(/http:\/\/127\.0\.0\.1:4210/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy hub command/i })).toBeTruthy()
  })

  it('shows beaconUrl and projectId integration when unconfigured', () => {
    render(<AgentConnectionStatus mode="technical" />)

    expect(screen.getAllByText(/beaconUrl/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/projectId/).length).toBeGreaterThan(0)
  })

  it('collapses setup when connected and lets the user reopen it', () => {
    render(<AgentConnectionStatus mode="technical" beaconUrl="http://127.0.0.1:4200" status={status('watching')} />)

    expect(screen.queryByText(/codex mcp add vibe-check/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /setup details/i }))
    expect(screen.getByText(/codex mcp add vibe-check/)).toBeTruthy()
  })
})
