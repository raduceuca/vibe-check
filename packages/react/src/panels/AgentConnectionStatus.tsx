import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  AGENT_CLIENTS,
  DEFAULT_HUB_URL,
  formatLeaseConflictMessage,
  formatSetupPack,
  getAgentClientSetup,
  getHubStartCommand,
  getWatchInstruction,
  isDispatchableAgentState,
  type AgentClientId,
  type BeaconStatus,
  type SuggestionMode,
} from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'
import { copyText } from '../utils/clipboard.js'

interface AgentConnectionStatusProps {
  readonly mode: SuggestionMode
  readonly beaconUrl?: string
  readonly status?: BeaconStatus | null
  /** When true, connected/busy renders a single status line (issues lead). */
  readonly compactWhenReady?: boolean
}

// What the widget can honestly say about the hub and the agent. Every state is
// derived from an answer the hub gave (or the lack of one); nothing is claimed
// before the first answer arrives ('checking').
export type AgentDisplayState =
  | 'unconfigured'
  | 'checking'
  | 'offline'
  | 'origin-blocked'
  | 'too-large'
  | 'rejected'
  | 'waiting'
  | 'claimed'
  | 'connected'
  | 'busy'
  | 'stale'

export const getAgentDisplayStateFor = (
  configured: boolean,
  status: BeaconStatus | null | undefined,
): AgentDisplayState => {
  if (!configured) return 'unconfigured'
  if (!status) return 'checking'
  if (status.lastError === 'origin-not-allowed') return 'origin-blocked'
  if (status.lastError === 'payload-too-large') return 'too-large'
  if (status.lastError === 'rejected') return 'rejected'
  if (status.lastOk === false || status.statusError === 'hub-offline' || status.lastError === 'hub-offline') {
    return 'offline'
  }
  if (status.lastOk === null && status.projectStatus === null) return 'checking'
  switch (status.projectStatus?.state) {
    case 'watching': return 'connected'
    case 'busy': return 'busy'
    case 'stale': return 'stale'
    case 'leased': return 'claimed'
    default: return 'waiting'
  }
}

export const getAgentDisplayState = (
  beaconUrl: string | undefined,
  status: BeaconStatus | null | undefined,
): AgentDisplayState => getAgentDisplayStateFor(Boolean(beaconUrl), status)

/** Send is enabled only when the hub answered and will accept (deliver or queue) the issue. */
export const canSendToAgent = (status: BeaconStatus | null | undefined): boolean =>
  status?.lastOk === true && isDispatchableAgentState(status.projectStatus?.state)

/**
 * Why an issue action (send, check this fix) is unavailable in this state, in
 * one plain sentence shown under the action row. null when nothing blocks it.
 */
export const actionBlockedReason = (state: AgentDisplayState): string | null => {
  switch (state) {
    case 'unconfigured': return 'Add beaconUrl and projectId to send issues to an agent.'
    case 'checking': return 'Checking the hub…'
    case 'offline': return 'Start the local hub first.'
    case 'origin-blocked': return 'The hub refused this page. Restart it with --allow-origin for this address.'
    case 'too-large':
    case 'rejected': return 'The hub is rejecting updates from this widget.'
    case 'waiting':
    case 'stale': return 'Ask one agent session to watch this project first.'
    default: return null
  }
}

export const AGENT_DISPLAY_COLORS: Readonly<Record<AgentDisplayState, string>> = {
  unconfigured: T.textMuted,
  checking: T.textMuted,
  offline: T.red,
  'origin-blocked': T.red,
  'too-large': T.red,
  rejected: T.red,
  waiting: T.yellow,
  claimed: T.yellow,
  connected: T.green,
  busy: T.green,
  stale: T.red,
}

export const AGENT_DISPLAY_DESCRIPTIONS: Readonly<Record<AgentDisplayState, string>> = {
  unconfigured: 'AI connection not configured',
  checking: 'checking the hub',
  offline: 'AI hub offline',
  'origin-blocked': 'hub refused this page',
  'too-large': 'hub refused a snapshot',
  rejected: 'hub rejected the widget',
  waiting: 'waiting for AI agent',
  claimed: 'agent claimed this project but is not waiting',
  connected: 'agent connected',
  busy: 'agent working',
  stale: 'agent disconnected',
}

const LABELS: Readonly<Record<AgentDisplayState, { readonly technical: string; readonly vibe: string }>> = {
  unconfigured: { technical: 'MCP not configured', vibe: 'AI connection not set up' },
  checking: { technical: 'Checking the hub…', vibe: 'Checking the AI connection…' },
  offline: { technical: 'MCP server offline', vibe: 'AI connection is offline' },
  'origin-blocked': { technical: 'Hub refused this page', vibe: 'AI connection refused this page' },
  'too-large': { technical: 'Hub refused a snapshot', vibe: 'AI connection refused an update' },
  rejected: { technical: 'Hub rejected the widget', vibe: 'AI connection rejected the widget' },
  waiting: { technical: 'Waiting for an agent', vibe: 'Waiting for your AI agent' },
  claimed: { technical: 'Agent claimed, not waiting', vibe: 'Your AI claimed this project' },
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
  fontSize: 14,
  lineHeight: 1.5,
  marginTop: 7,
  textWrap: 'pretty',
}

const headingStyle: CSSProperties = {
  color: T.textSecondary,
  fontSize: 14,
  fontWeight: 650,
}

const codeStyle: CSSProperties = {
  marginTop: 7,
  padding: '9px 10px',
  borderRadius: T.radiusSm,
  background: T.bg,
  color: T.textSecondary,
  fontFamily: T.fontMono,
  fontSize: 14,
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
  fontSize: 14,
  fontWeight: 600,
  transitionProperty: 'background-color, color, border-color, scale',
  transitionDuration: T.durationFast,
  transitionTimingFunction: T.ease,
}

const SR_ONLY: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

type CopyKey = 'hub' | 'setup' | 'watch' | 'pack'

// The visible text names the button (no aria-label override), so what a
// sighted user reads is what a screen reader or voice control hears.
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
    onClick={onClick}
    style={{
      ...actionStyle,
      color: copied ? T.green : T.textSecondary,
      borderColor: copied ? `color-mix(in srgb, ${T.green} 30%, transparent)` : T.borderSubtle,
    }}
  >
    {copied ? 'Copied' : label}
  </button>
)

const integrationSnippet = `<VibeCheck
  beaconUrl="${DEFAULT_HUB_URL}"
  projectId="my-project"
/>`

const ClientPicker = ({
  client,
  onSelect,
}: {
  readonly client: AgentClientId
  readonly onSelect: (id: AgentClientId) => void
}) => (
  <div role="group" aria-label="Choose your AI coding client" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, marginTop: 7 }}>
    {AGENT_CLIENTS.map((clientId) => {
      const setup = getAgentClientSetup(clientId)
      const selected = client === clientId
      return (
        <button
          key={clientId}
          type="button"
          aria-pressed={selected}
          onClick={() => { onSelect(clientId) }}
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
)

interface NextStep {
  readonly title: string
  readonly body?: string
  readonly code: string
  readonly copyKey: CopyKey
  readonly copyLabel: string
}

const pageOrigin = (): string =>
  typeof window !== 'undefined' && window.location.origin !== 'null' ? window.location.origin : 'http://localhost:3000'

export const AgentConnectionStatus = ({
  mode,
  beaconUrl,
  status,
  compactWhenReady = false,
}: AgentConnectionStatusProps) => {
  const state = getAgentDisplayState(beaconUrl, status)
  const ready = state === 'connected' || state === 'busy'
  const needsWatcher = state === 'waiting' || state === 'stale' || state === 'claimed'
  const hubUrl = (beaconUrl ?? DEFAULT_HUB_URL).replace(/\/+$/, '')
  const [client, setClient] = useState<AgentClientId>('codex')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copied, setCopied] = useState<CopyKey | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedSetup = getAgentClientSetup(client, { hubUrl })
  const projectId = status?.projectId ?? 'my-project'
  const watchInstruction = getWatchInstruction(projectId)
  const hubCommand = getHubStartCommand({ preferUp: false, hubUrl })
  const conflict = status?.projectStatus?.conflictAt != null

  useEffect(() => {
    if (ready) setDetailsOpen(false)
  }, [ready])

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  const handleCopy = async (value: string, key: CopyKey) => {
    if (!await copyText(value)) {
      setCopied(null)
      setCopyFailed(true)
      return
    }
    setCopyFailed(false)
    setCopied(key)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(null), 2_000)
  }

  // One sentence per state; the next step below never repeats it.
  const summary = (() => {
    switch (state) {
      case 'unconfigured': return 'Add beaconUrl and a stable projectId to the widget, then reload.'
      case 'checking': return `Waiting for the first answer from ${hubUrl}.`
      case 'offline': return `Cannot reach ${hubUrl}.`
      case 'origin-blocked': return `The hub at ${hubUrl} refused requests from ${pageOrigin()}.`
      case 'too-large': return 'The hub refused a snapshot from this page because it was too large. Update @wcgw/vibe-check and @wcgw/vibe-check-mcp together.'
      case 'rejected': return "The hub rejected this widget's snapshots. Update @wcgw/vibe-check and @wcgw/vibe-check-mcp together."
      case 'waiting': return 'The hub is ready. No agent session is watching this project yet.'
      case 'claimed': return "An agent claimed this project but isn't waiting right now. Send to agent queues the issue until it watches again."
      case 'stale': return 'The watcher stopped responding. Reconnect that agent session.'
      case 'busy': return 'One agent session owns this project and is working on an issue.'
      case 'connected': return 'One agent session owns this project and is ready to receive issues.'
    }
  })()

  const nextStep = ((): NextStep | null => {
    switch (state) {
      case 'unconfigured':
        return {
          title: mode === 'vibe' ? 'Add the hub URL' : 'Configure the widget',
          code: integrationSnippet,
          copyKey: 'setup',
          copyLabel: 'Copy snippet',
        }
      case 'offline':
        return {
          title: mode === 'vibe' ? 'Start the hub' : 'Start the local hub',
          body: 'Leave it running in a terminal.',
          code: hubCommand,
          copyKey: 'hub',
          copyLabel: 'Copy hub command',
        }
      case 'origin-blocked':
        return {
          title: 'Allow this page',
          body: 'Restart the hub with this address allowed.',
          code: `${hubCommand} --allow-origin ${pageOrigin()}`,
          copyKey: 'hub',
          copyLabel: 'Copy hub command',
        }
      case 'stale':
        return {
          title: mode === 'vibe' ? 'Reconnect your agent' : 'Reconnect the watcher',
          body: 'Paste this in a new agent session.',
          code: watchInstruction,
          copyKey: 'watch',
          copyLabel: 'Copy watch instruction',
        }
      case 'claimed':
        return {
          title: mode === 'vibe' ? 'Ask your agent to watch again' : 'Ask the agent to watch again',
          body: 'Paste this in the session that claimed the project.',
          code: watchInstruction,
          copyKey: 'watch',
          copyLabel: 'Copy watch instruction',
        }
      case 'waiting':
        return {
          title: mode === 'vibe' ? 'Ask your agent to watch' : 'Paste this in the agent',
          code: watchInstruction,
          copyKey: 'watch',
          copyLabel: 'Copy watch instruction',
        }
      default:
        return null
    }
  })()

  const conflictAlert = conflict && (
    <div role="alert" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.yellow, fontSize: 14, fontWeight: 650 }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: T.radiusPill, background: T.yellow, flexShrink: 0 }} />
        A second agent was rejected.
      </div>
      <div style={{ ...bodyStyle, color: T.textSecondary, marginTop: 4 }}>
        {formatLeaseConflictMessage(projectId, status?.projectStatus?.holder ?? null)}
      </div>
    </div>
  )

  const copyFeedback = (
    <>
      {copyFailed && (
        <div role="status" style={{ ...bodyStyle, color: T.red }}>
          Couldn&apos;t copy. Select the text above and copy it yourself.
        </div>
      )}
      <span role="status" aria-live="polite" style={SR_ONLY}>
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  )

  if (ready && compactWhenReady && !detailsOpen) {
    return (
      <div data-testid="vibe-check-agent-status" style={{ ...containerStyle, padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: T.radiusPill, background: AGENT_DISPLAY_COLORS[state], flexShrink: 0 }} />
            <span style={{ color: AGENT_DISPLAY_COLORS[state], fontSize: 14, fontWeight: 650 }}>
              {LABELS[state][mode]}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            aria-expanded={false}
            aria-controls="vibe-check-agent-setup-details"
            style={{ ...actionStyle, minHeight: 40, padding: '5px 8px', flexShrink: 0 }}
          >
            Setup
          </button>
        </div>
        {conflictAlert}
      </div>
    )
  }

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

      {conflictAlert}

      {nextStep && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}` }}>
          <div style={headingStyle}>Next</div>
          <div style={{ color: T.text, fontSize: 14, fontWeight: 650, marginTop: 4 }}>{nextStep.title}</div>
          {nextStep.body && <div style={bodyStyle}>{nextStep.body}</div>}
          <div style={codeStyle}>{nextStep.code}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <SetupCopyButton
              label={nextStep.copyLabel}
              copied={copied === nextStep.copyKey}
              onClick={() => { void handleCopy(nextStep.code, nextStep.copyKey) }}
            />
          </div>
          {needsWatcher && (
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-controls="vibe-check-agent-setup-details"
              style={{ ...actionStyle, width: '100%', marginTop: 8 }}
            >
              {detailsOpen ? 'Hide MCP setup' : 'Need to add the MCP server?'}
            </button>
          )}
        </div>
      )}

      {detailsOpen && (
        <div id="vibe-check-agent-setup-details" style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${T.borderSubtle}` }}>
          <div style={headingStyle}>Add VibeCheck to your agent</div>
          <ClientPicker client={client} onSelect={(id) => { setClient(id); setCopied(null) }} />
          <div style={{ ...bodyStyle, marginTop: 7 }}>{selectedSetup.destination}</div>
          <div style={codeStyle}>{selectedSetup.value}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <SetupCopyButton
              label={`Copy ${selectedSetup.label} setup`}
              copied={copied === 'setup'}
              onClick={() => { void handleCopy(selectedSetup.value, 'setup') }}
            />
            {!ready && (
              // The pack is built for the client picked just above, so what it
              // copies is never a different agent than the one on screen.
              <SetupCopyButton
                label={`Copy full setup pack for ${selectedSetup.label}`}
                copied={copied === 'pack'}
                onClick={() => {
                  void handleCopy(
                    formatSetupPack({
                      projectId,
                      agent: client,
                      preferUp: true,
                      hubUrl,
                      hubRunning: status?.lastOk === true,
                    }),
                    'pack',
                  )
                }}
              />
            )}
          </div>
          {ready && (
            <>
              <div style={{ ...headingStyle, marginTop: 10 }}>
                Watch instruction
              </div>
              <div style={codeStyle}>{watchInstruction}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <SetupCopyButton
                  label="Copy watch instruction"
                  copied={copied === 'watch'}
                  onClick={() => { void handleCopy(watchInstruction, 'watch') }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {copyFeedback}
    </div>
  )
}
