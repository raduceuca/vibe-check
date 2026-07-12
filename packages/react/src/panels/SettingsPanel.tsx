import { memo, type CSSProperties } from 'react'
import type { SuggestionMode, BeaconStatus } from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'
import { Button } from './ui/Button.js'
import { sectionLabelStyle } from './ui/SectionHeader.js'
import type { VibeCheckPreferences } from '../store/preferences.js'
import { ToggleRow } from './ui/ToggleRow.js'
import { ModeToggle } from './ui/ModeToggle.js'
import { AgentConnectionStatus } from './AgentConnectionStatus.js'

interface SettingsPanelProps {
  readonly prefs: VibeCheckPreferences
  readonly onUpdate: (updates: Partial<VibeCheckPreferences>) => void
  readonly mode: SuggestionMode
  readonly onToggleMode: () => void
  readonly beaconUrl?: string
  readonly beaconStatus?: BeaconStatus | null
  readonly onClearAll: () => void
}

const sectionTitle: CSSProperties = {
  ...sectionLabelStyle,
  marginTop: 14,
  marginBottom: 8,
}

const firstSection: CSSProperties = {
  ...sectionLabelStyle,
  marginTop: 0,
  marginBottom: 8,
}

const infoRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  fontSize: 14,
}

export const SettingsPanel = memo(({ prefs, onUpdate, mode, onToggleMode, beaconUrl, beaconStatus, onClearAll }: SettingsPanelProps) => {
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={firstSection}>
        {mode === 'vibe' ? 'Settings' : 'Configuration'}
      </div>

      <div style={{ ...infoRowStyle, paddingBottom: 8 }}>
        <span style={{ color: T.textSecondary }}>
          {mode === 'vibe' ? 'Wording' : 'Mode'}
        </span>
        <ModeToggle mode={mode} onToggle={onToggleMode} />
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
      <ToggleRow
        label={mode === 'vibe' ? 'Light theme' : 'Light theme'}
        checked={prefs.theme === 'light'}
        onChange={(checked) => onUpdate({ theme: checked ? 'light' : 'dark' })}
      />
      <ToggleRow
        label={mode === 'vibe' ? 'Remember performance history' : 'Persist FPS history'}
        checked={prefs.keepHistory}
        onChange={(checked) => onUpdate({ keepHistory: checked })}
      />

      <div style={sectionTitle}>
        {mode === 'vibe' ? 'AI Connection' : 'MCP Status'}
      </div>
      <AgentConnectionStatus mode={mode} beaconUrl={beaconUrl} status={beaconStatus} />

      <div style={sectionTitle}>
        {mode === 'vibe' ? 'Data' : 'Storage'}
      </div>
      <Button variant="danger" fullWidth onClick={onClearAll}>
        {mode === 'vibe' ? 'clear all problems & start fresh' : 'clear all tracked issues'}
      </Button>

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
})
