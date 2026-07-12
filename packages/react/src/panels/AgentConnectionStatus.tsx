import type { CSSProperties } from 'react'
import type { BeaconStatus, SuggestionMode } from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'

interface AgentConnectionStatusProps {
  readonly mode: SuggestionMode
  readonly beaconUrl?: string
  readonly status?: BeaconStatus | null
}

type DisplayState = 'unconfigured' | 'offline' | 'waiting' | 'connected' | 'busy' | 'stale'

const getDisplayState = (
  beaconUrl: string | undefined,
  status: BeaconStatus | null | undefined,
): DisplayState => {
  if (!beaconUrl) return 'unconfigured'
  if (!status || status.lastOk === false || status.statusError === 'hub-offline') return 'offline'
  if (status.projectStatus?.state === 'watching') return 'connected'
  if (status.projectStatus?.state === 'busy') return 'busy'
  if (status.projectStatus?.state === 'stale') return 'stale'
  return 'waiting'
}

const LABELS: Record<DisplayState, { readonly technical: string; readonly vibe: string }> = {
  unconfigured: { technical: 'MCP not configured', vibe: 'AI connection not set up' },
  offline: { technical: 'MCP server offline', vibe: 'AI connection is offline' },
  waiting: { technical: 'Waiting for an agent', vibe: 'Waiting for your AI agent' },
  connected: { technical: 'Agent connected', vibe: 'AI agent connected' },
  busy: { technical: 'Agent working', vibe: 'AI agent is working' },
  stale: { technical: 'Agent disconnected', vibe: 'AI agent disconnected' },
}

const COLOR: Record<DisplayState, string> = {
  unconfigured: T.textMuted,
  offline: T.red,
  waiting: T.yellow,
  connected: T.green,
  busy: T.blue,
  stale: T.red,
}

const containerStyle: CSSProperties = {
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: T.radiusMd,
  background: T.bgSubtle,
  padding: '10px 12px',
  marginBottom: 10,
}

export const AgentConnectionStatus = ({ mode, beaconUrl, status }: AgentConnectionStatusProps) => {
  const state = getDisplayState(beaconUrl, status)
  const label = LABELS[state][mode]
  const conflict = status?.projectStatus?.conflictAt != null

  return (
    <div data-testid="vibe-check-agent-status" style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: T.radiusPill, background: COLOR[state], flexShrink: 0 }} />
        <span style={{ color: COLOR[state], fontSize: 14, fontWeight: 600 }}>{label}</span>
      </div>
      {state === 'unconfigured' && (
        <div style={{ color: T.textTertiary, fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>
          {mode === 'vibe'
            ? 'Start the local VibeCheck hub and add its address to this widget.'
            : 'Start `vibe-check-mcp hub`, then pass its URL as beaconUrl.'}
        </div>
      )}
      {state === 'offline' && (
        <div style={{ color: T.textTertiary, fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>
          {mode === 'vibe'
            ? 'Check that the local VibeCheck hub is running.'
            : `Cannot reach ${beaconUrl}. Start or restart the VibeCheck hub.`}
        </div>
      )}
      {state === 'waiting' && (
        <div style={{ color: T.textTertiary, fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>
          {mode === 'vibe'
            ? 'Open one agent session and tell it to watch this project.'
            : `Run the MCP watch_for_issue tool for project ${status?.projectId ?? 'shown by list_projects'}.`}
        </div>
      )}
      {state === 'stale' && (
        <div style={{ color: T.textTertiary, fontSize: 13, lineHeight: 1.45, marginTop: 6 }}>
          The watcher stopped responding. Reconnect the agent session before sending.
        </div>
      )}
      {conflict && (
        <div role="alert" style={{ color: T.yellow, fontSize: 13, lineHeight: 1.45, marginTop: 7 }}>
          A second agent was rejected. Only the current watcher can receive issues for this project.
        </div>
      )}
    </div>
  )
}
