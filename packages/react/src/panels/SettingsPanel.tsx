import type { CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { T, sectionHeaderStyle } from '../tokens.js'
import type { VibeCheckPreferences } from '../store/preferences.js'
import { ToggleRow } from './ui/ToggleRow.js'

interface SettingsPanelProps {
  readonly prefs: VibeCheckPreferences
  readonly onUpdate: (updates: Partial<VibeCheckPreferences>) => void
  readonly mode: SuggestionMode
  readonly beaconUrl?: string
  readonly onClearAll: () => void
}

const sectionTitle: CSSProperties = {
  ...sectionHeaderStyle,
  marginTop: 14,
}

const firstSection: CSSProperties = {
  ...sectionHeaderStyle,
  marginTop: 0,
}

const mcpDotStyle = (connected: boolean): CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: connected ? T.green : 'rgba(255,255,255,0.15)',
  boxShadow: connected ? `0 0 6px rgba(74,222,128,0.4)` : 'none',
  flexShrink: 0,
})

const infoRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  fontSize: 14,
}

export const SettingsPanel = ({ prefs, onUpdate, mode, beaconUrl, onClearAll }: SettingsPanelProps) => {
  const mcpConnected = Boolean(beaconUrl)

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
          <span style={mcpDotStyle(mcpConnected)} />
          <span style={{
            fontSize: 14,
            color: mcpConnected ? T.green : T.textMuted,
            fontWeight: 500,
          }}>
            {mcpConnected
              ? (mode === 'vibe' ? 'connected' : 'active')
              : (mode === 'vibe' ? 'not connected' : 'inactive')
            }
          </span>
        </div>
      </div>
      {!mcpConnected && (
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
