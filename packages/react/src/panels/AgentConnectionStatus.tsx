import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  AGENT_CLIENTS,
  HUB_START_COMMAND,
  getAgentClientSetup,
  getWatchInstruction,
  type AgentClientId,
  type BeaconStatus,
  type SuggestionMode,
} from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'

interface AgentConnectionStatusProps {
  readonly mode: SuggestionMode
  readonly beaconUrl?: string
  readonly status?: BeaconStatus | null
}

export type AgentDisplayState = 'unconfigured' | 'offline' | 'waiting' | 'connected' | 'busy' | 'stale'

export const getAgentDisplayState = (
  beaconUrl: string | undefined,
  status: BeaconStatus | null | undefined,
): AgentDisplayState => {
  if (!beaconUrl) return 'unconfigured'
  if (!status || status.lastOk === false || status.statusError === 'hub-offline') return 'offline'
  if (status.projectStatus?.state === 'watching') return 'connected'
  if (status.projectStatus?.state === 'busy') return 'busy'
  if (status.projectStatus?.state === 'stale') return 'stale'
  return 'waiting'
}

export const AGENT_DISPLAY_COLORS: Readonly<Record<AgentDisplayState, string>> = {
  unconfigured: T.textMuted,
  offline: T.red,
  waiting: T.yellow,
  connected: T.green,
  busy: T.blue,
  stale: T.red,
}

export const AGENT_DISPLAY_DESCRIPTIONS: Readonly<Record<AgentDisplayState, string>> = {
  unconfigured: 'AI connection not configured',
  offline: 'AI hub offline',
  waiting: 'waiting for AI agent',
  connected: 'agent connected',
  busy: 'agent working',
  stale: 'agent disconnected',
}

const LABELS: Readonly<Record<AgentDisplayState, { readonly technical: string; readonly vibe: string }>> = {
  unconfigured: { technical: 'MCP not configured', vibe: 'AI connection not set up' },
  offline: { technical: 'MCP server offline', vibe: 'AI connection is offline' },
  waiting: { technical: 'Waiting for an agent', vibe: 'Waiting for your AI agent' },
  connected: { technical: 'Agent connected', vibe: 'AI agent connected' },
  busy: { technical: 'Agent working', vibe: 'AI agent is working' },
  stale: { technical: 'Agent disconnected', vibe: 'AI agent disconnected' },
}

const containerStyle: CSSProperties = {
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: T.radiusMd,
  background: T.bgSubtle,
  padding: 12,
  marginBottom: 10,
}

const bodyStyle: CSSProperties = {
  color: T.textTertiary,
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 7,
  textWrap: 'pretty',
}

const codeStyle: CSSProperties = {
  marginTop: 7,
  padding: '9px 10px',
  borderRadius: T.radiusSm,
  background: T.bg,
  color: T.textSecondary,
  fontFamily: T.fontMono,
  fontSize: 12,
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  overflowX: 'auto',
  overflowWrap: 'anywhere',
  userSelect: 'text',
}

const actionStyle: CSSProperties = {
  minHeight: 40,
  padding: '6px 10px',
  borderRadius: T.radiusSm,
  border: `1px solid ${T.borderSubtle}`,
  background: T.bg,
  color: T.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  transitionProperty: 'background-color, color, border-color, scale',
  transitionDuration: T.durationFast,
  transitionTimingFunction: T.ease,
}

const SetupCopyButton = ({
  label,
  copied,
  onClick,
}: {
  readonly label: string
  readonly copied: boolean
  readonly onClick: () => void
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    style={{
      ...actionStyle,
      color: copied ? T.green : T.textSecondary,
      borderColor: copied ? `color-mix(in srgb, ${T.green} 30%, transparent)` : T.borderSubtle,
    }}
  >
    {copied ? 'Copied' : 'Copy'}
  </button>
)

const copyWithFallback = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

const integrationSnippet = `<VibeCheck
  beaconUrl="http://127.0.0.1:4200"
  projectId="my-project"
/>`

export const AgentConnectionStatus = ({ mode, beaconUrl, status }: AgentConnectionStatusProps) => {
  const state = getAgentDisplayState(beaconUrl, status)
  const ready = state === 'connected' || state === 'busy'
  const [client, setClient] = useState<AgentClientId>('codex')
  const [detailsOpen, setDetailsOpen] = useState(!ready)
  const [copied, setCopied] = useState<'hub' | 'setup' | 'watch' | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedSetup = getAgentClientSetup(client)
  const projectId = status?.projectId ?? 'my-project'
  const watchInstruction = getWatchInstruction(projectId)
  const conflict = status?.projectStatus?.conflictAt != null

  useEffect(() => {
    setDetailsOpen(!ready)
  }, [ready])

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  const handleCopy = async (value: string, key: 'hub' | 'setup' | 'watch') => {
    if (!await copyWithFallback(value)) return
    setCopied(key)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(null), 2_000)
  }

  const summary = (() => {
    if (state === 'unconfigured') return 'Add both beaconUrl and a stable projectId to the widget.'
    if (state === 'offline') return `Cannot reach ${beaconUrl}. Start the local hub and leave it running.`
    if (state === 'waiting') return `The hub is ready. Connect one agent session to ${projectId}.`
    if (state === 'stale') return `The watcher for ${projectId} stopped responding. Reconnect that agent session.`
    if (state === 'busy') return `${projectId} is owned by one agent session and is processing an issue.`
    return `${projectId} is owned by one agent session and ready to receive issues.`
  })()

  return (
    <div data-testid="vibe-check-agent-status" style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: T.radiusPill, background: AGENT_DISPLAY_COLORS[state], flexShrink: 0 }} />
          <span style={{ color: AGENT_DISPLAY_COLORS[state], fontSize: 14, fontWeight: 650, textWrap: 'balance' }}>
            {LABELS[state][mode]}
          </span>
        </div>
        {ready && (
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls="vibe-check-agent-setup-details"
            style={{ ...actionStyle, minHeight: 40, padding: '5px 8px', flexShrink: 0 }}
          >
            {detailsOpen ? 'Hide setup' : 'Setup details'}
          </button>
        )}
      </div>

      <div style={bodyStyle}>{summary}</div>

      {status?.projectId && (
        <div style={{ ...bodyStyle, marginTop: 5 }}>
          Project <span style={{ color: T.textSecondary, fontFamily: T.fontMono, userSelect: 'text' }}>{status.projectId}</span>
        </div>
      )}

      {conflict && (
        <div role="alert" style={{ color: T.yellow, fontSize: 13, lineHeight: 1.5, marginTop: 8, textWrap: 'pretty' }}>
          A second agent was rejected. Continue in the owning session, or call release_project there before switching agents.
        </div>
      )}

      {detailsOpen && (
        <div id="vibe-check-agent-setup-details" style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}` }}>
          {state === 'unconfigured' && (
            <div style={{ marginBottom: 11 }}>
              <div style={{ color: T.textSecondary, fontSize: 12, fontWeight: 650 }}>1. Configure the widget</div>
              <div style={codeStyle}>{integrationSnippet}</div>
            </div>
          )}

          {(state === 'unconfigured' || state === 'offline') && (
            <div style={{ marginBottom: 11 }}>
              <div style={{ color: T.textSecondary, fontSize: 12, fontWeight: 650 }}>
                {state === 'unconfigured' ? '2.' : '1.'} Start the local hub
              </div>
              <div style={codeStyle}>{HUB_START_COMMAND}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <SetupCopyButton
                  label="Copy hub command"
                  copied={copied === 'hub'}
                  onClick={() => { void handleCopy(HUB_START_COMMAND, 'hub') }}
                />
              </div>
            </div>
          )}

          <div style={{ color: T.textSecondary, fontSize: 12, fontWeight: 650 }}>
            {state === 'unconfigured' ? '3.' : state === 'offline' ? '2.' : '1.'} Add VibeCheck to your agent
          </div>
          <div role="group" aria-label="Choose your AI coding client" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginTop: 7 }}>
            {AGENT_CLIENTS.map((clientId) => {
              const setup = getAgentClientSetup(clientId)
              const selected = client === clientId
              return (
                <button
                  key={clientId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { setClient(clientId); setCopied(null) }}
                  style={{
                    ...actionStyle,
                    padding: '5px 4px',
                    color: selected ? T.text : T.textTertiary,
                    background: selected ? T.bgHover : T.bg,
                    borderColor: selected ? T.border : T.borderSubtle,
                  }}
                >
                  {setup.label}
                </button>
              )
            })}
          </div>
          <div style={{ ...bodyStyle, marginTop: 7 }}>{selectedSetup.destination}</div>
          <div style={codeStyle}>{selectedSetup.value}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <SetupCopyButton
              label={`Copy ${selectedSetup.label} setup`}
              copied={copied === 'setup'}
              onClick={() => { void handleCopy(selectedSetup.value, 'setup') }}
            />
          </div>

          <div style={{ color: T.textSecondary, fontSize: 12, fontWeight: 650, marginTop: 10 }}>
            {state === 'unconfigured' ? '4.' : state === 'offline' ? '3.' : '2.'} Restart or open a new agent session
          </div>
          <div style={{ ...bodyStyle, marginTop: 4 }}>MCP configuration is loaded when the agent session starts.</div>

          <div style={{ color: T.textSecondary, fontSize: 12, fontWeight: 650, marginTop: 10 }}>
            {state === 'unconfigured' ? '5.' : state === 'offline' ? '4.' : '3.'} Ask it to watch this project
          </div>
          <div style={codeStyle}>{watchInstruction}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <SetupCopyButton
              label="Copy watch instruction"
              copied={copied === 'watch'}
              onClick={() => { void handleCopy(watchInstruction, 'watch') }}
            />
          </div>

          <div style={{ ...bodyStyle, marginTop: 9, color: T.textSecondary }}>
            Wait for this card to turn green, then click <strong>Send to agent</strong> on an issue.
          </div>
        </div>
      )}

      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}
