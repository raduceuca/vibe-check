import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '../SettingsPanel.js'
import type { VibeCheckPreferences } from '../../store/preferences.js'

const prefs: VibeCheckPreferences = {
  mode: 'technical',
  annotationsVisible: true,
  clearOnSend: false,
  theme: 'dark',
  keepHistory: true,
}

describe('SettingsPanel', () => {
  it('shows MCP status before preference controls', () => {
    render(
      <SettingsPanel
        prefs={prefs}
        onUpdate={vi.fn()}
        mode="technical"
        onToggleMode={vi.fn()}
        beaconUrl="http://127.0.0.1:4200"
        beaconStatus={null}
        onClearAll={vi.fn()}
      />,
    )

    const status = screen.getByTestId('vibe-check-agent-status')
    const wording = screen.getByText('Mode')
    expect(status.compareDocumentPosition(wording) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })
})
