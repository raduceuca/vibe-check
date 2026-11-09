// Lease-conflict copy (since 0.4), shared by the bridge's tool results, doctor
// and the widget so every surface explains ownership the same honest way.

import type { LeaseHolder } from './index.js'
import { LEASE_EXPIRE_MS } from './timing.js'

const MAX_CLIENT_NAME_CHARS = 60

/**
 * A readable name for the MCP client that holds a lease, from the name its
 * bridge reported at initialize ("claude-code" → "Claude Code"). null when unknown.
 */
export const agentClientLabel = (clientName: string | null | undefined): string | null => {
  const name = (clientName ?? '').trim()
  if (name.length === 0) return null
  const lower = name.toLowerCase()
  if (lower.includes('claude')) return 'Claude Code'
  if (lower.includes('codex')) return 'Codex'
  if (lower.includes('cursor')) return 'Cursor'
  return name.length > MAX_CLIENT_NAME_CHARS ? `${name.slice(0, MAX_CLIENT_NAME_CHARS - 1)}…` : name
}

/**
 * Plain-language lease-conflict explanation: who holds the project, how to
 * hand it over, and that retrying will not take it over.
 */
export const formatLeaseConflictMessage = (
  projectId: string,
  holder?: LeaseHolder | null,
  now: number = Date.now(),
): string => {
  const label = agentClientLabel(holder?.clientName)
  const seconds = holder ? Math.max(0, Math.round((now - holder.heartbeatAt) / 1_000)) : null
  const details = [
    label,
    seconds === null ? null : `last heartbeat ${seconds}s ago`,
  ].filter((part): part is string => part !== null)
  const who = details.length > 0 ? ` (${details.join(', ')})` : ''
  return [
    `Another agent session is already watching project "${projectId}"${who}.`,
    'Only one agent session can watch a project at a time.',
    'Continue in that session, or call release_project there to hand the project over.',
    `If that session has closed, its claim lapses ${Math.round(LEASE_EXPIRE_MS / 1_000)} seconds after its last heartbeat.`,
    'Retrying here will not take the project over.',
  ].join(' ')
}
