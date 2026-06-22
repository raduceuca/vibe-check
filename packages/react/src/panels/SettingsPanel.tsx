import type { CSSProperties } from 'react'
import type { SuggestionMode, BeaconStatus } from '@wcgw/vibe-check-core'
import { T, sectionHeaderStyle } from '../tokens.js'
import type { VibeCheckPreferences } from '../store/preferences.js'
import { ToggleRow } from './ui/ToggleRow.js'

interface SettingsPanelProps {
  readonly prefs: VibeCheckPreferences
  readonly onUpdate: (updates: Partial<VibeCheckPreferences>) => void
  readonly mode: SuggestionMode
  readonly beaconUrl?: string
  readonly beaconStatus?: BeaconStatus | null
  readonly onClearAll: () => void
}

// Honest tri-state derived from real delivery, not just Boolean(beaconUrl):
// - 'inactive'   no beaconUrl configured
// - 'pending'    configured, but no delivery confirmed yet (or last failed)
// - 'active'     last snapshot reached the server
type ConnectionState = 'inactive' | 'pending' | 'active'

const deriveConnectionState = (
  beaconUrl: string | undefined,
  status: BeaconStatus | null | undefined,
): ConnectionState => {
  if (!beaconUrl) return 'inactive'
  if (status && status.lastOk === true) return 'active'
  return 'pending'
}

const sectionTitle: CSSProperties = {
  ...sectionHeaderStyle,
  marginTop: 14,
}

const firstSection: CSSProperties = {
  ...sectionHeaderStyle,
  marginTop: 0,
}

const DOT_COLOR: Record<ConnectionState, string> = {
  inactive: 'rgba(255,255,255,0.15)',
  pending: T.yellow,
  active: T.green,
}

const mcpDotStyle = (state: ConnectionState): CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: DOT_COLOR[state],
  boxShadow: state === 'active' ? `0 0 6px rgba(74,222,128,0.4)` : 'none',
  flexShrink: 0,
})

const infoRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  fontSize: 14,
}

export const SettingsPanel = ({ prefs, onUpdate, mode, beaconUrl, beaconStatus, onClearAll }: SettingsPanelProps) => {
  const connection = deriveConnectionState(beaconUrl, beaconStatus)
  const statusLabel: Record<ConnectionState, string> = {
    inactive: mode === 'vibe' ? 'not connected' : 'inactive',
    pending: mode === 'vibe' ? 'connecting…' : 'no data yet',
    active: mode === 'vibe' ? 'connected' : 'active',
  }
  const statusColor: Record<ConnectionState, string> = {
    inactive: T.textMuted,
    pending: T.yellow,
    active: T.green,
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={firstSection}>
        {mode === 'vibe' ? 'Settings' : 'Configuration'}
      </div>

      <ToggleRow
        label={mode === 'vibe' ? 'Show markers on page' : 'Annotation overlay'}
        checked={prefs.annotationsVisible}
        onChange={(checked) => onUpdate({ annotationsVisible: checked })}
      />
      <ToggleRow
        label={mode === 'vibe' ? 'Auto-clear when sent to AI' : 'Clear annotations on send'}
        checked={prefs.clearOnSend}
        onChange={(checked) => onUpdate({ clearOnSend: checked })}
      />

      <div style={sectionTitle}>
        {mode === 'vibe' ? 'AI Connection' : 'MCP Status'}
      </div>
      <div style={infoRowStyle}>
        <span style={{ color: T.textSecondary }}>
          {mode === 'vibe' ? 'Connected to AI tools' : 'MCP server'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={mcpDotStyle(connection)} />
          <span style={{
            fontSize: 14,
            color: statusColor[connection],
            fontWeight: 500,
          }}>
            {statusLabel[connection]}
          </span>
        </div>
      </div>
      {connection === 'inactive' && (
        <div style={{
          fontSize: 14,
          color: T.textTertiary,
          marginTop: 6,
          lineHeight: 1.5,
        }}>
          {mode === 'vibe'
            ? 'Copy prompts manually until MCP is set up. Your AI agent will get issues automatically once connected.'
            : 'Use clipboard prompts while MCP transport is unavailable. Configure beaconUrl to enable live sync.'}
        </div>
      )}
      {connection === 'pending' && (
        <div style={{
          fontSize: 14,
          color: T.textTertiary,
          marginTop: 6,
          lineHeight: 1.5,
        }}>
          {mode === 'vibe'
            ? 'Waiting to reach your AI tools. If this stays here, check that the vibe-check MCP server is running.'
            : `No snapshot delivered yet. Verify the MCP server is running and reachable at ${beaconUrl}.`}
        </div>
      )}

      <div style={sectionTitle}>
        {mode === 'vibe' ? 'Data' : 'Storage'}
      </div>
      <button
        onClick={onClearAll}
        style={{
          width: '100%',
          padding: '8px 0',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
          border: `1px solid rgba(239,68,68,0.12)`,
          background: 'rgba(239,68,68,0.04)',
          color: T.red,
          cursor: 'pointer',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'background 0.2s ease',
        }}
      >
        {mode === 'vibe' ? 'Clear all issues & start fresh' : 'Clear all tracked issues'}
      </button>

      <div style={sectionTitle}>About</div>
      <div style={{
        fontSize: 14,
        color: T.textTertiary,
        lineHeight: 1.55,
      }}>
        <div><span style={{ color: T.textSecondary, fontWeight: 500 }}>vibe check</span> — performance monitoring for the AI era</div>
        <div style={{ marginTop: 4 }}>
          {mode === 'vibe'
            ? 'Helps you find and fix performance issues with your AI coding tools. Made for vibe coders who care about quality.'
            : 'Browser performance monitoring with AI agent integration. Detects issues from AI-assisted development patterns.'}
        </div>
        <div style={{ marginTop: 6, color: T.textMuted }}>@wcgw/vibe-check</div>
      </div>
    </div>
  )
}
