import { describe, expect, it } from 'vitest'
import { LEASE_EXPIRE_MS, agentClientLabel, formatLeaseConflictMessage, type LeaseHolder } from '../index.js'

const holder: LeaseHolder = {
  clientName: 'claude-code',
  acquiredAt: 1_000,
  heartbeatAt: 10_000,
  expiresAt: 10_000 + LEASE_EXPIRE_MS,
  state: 'watching',
}

describe('lease conflict copy (E2E-12, MCP-15)', () => {
  it('maps MCP client names to readable labels', () => {
    expect(agentClientLabel('claude-code')).toBe('Claude Code')
    expect(agentClientLabel('codex-mcp-client')).toBe('Codex')
    expect(agentClientLabel('cursor-vscode')).toBe('Cursor')
    expect(agentClientLabel('zed')).toBe('zed')
    expect(agentClientLabel('')).toBeNull()
    expect(agentClientLabel(null)).toBeNull()
  })

  it('explains who holds the project, how to hand it over, and that retrying will not help', () => {
    const message = formatLeaseConflictMessage('shop', holder, 13_400)
    expect(message).toContain('Another agent session is already watching project "shop" (Claude Code, last heartbeat 3s ago).')
    expect(message).toContain('call release_project there')
    expect(message).toContain(`${LEASE_EXPIRE_MS / 1_000} seconds after its last heartbeat`)
    expect(message).toContain('Retrying here will not take the project over.')
    expect(message).not.toMatch(/409|HTTP|request failed/i)
  })

  it('still explains ownership when the holder is unknown', () => {
    const message = formatLeaseConflictMessage('shop')
    expect(message).toContain('Another agent session is already watching project "shop".')
  })
})
