import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '../SettingsPanel.js'
import type { VibeCheckPreferences } from '../../store/preferences.js'
import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'

const prefs: VibeCheckPreferences = {
  mode: 'technical',
  annotationsVisible: true,
  clearOnSend: false,
  theme: 'dark',
  keepHistory: true,
  collapsed: false,
  positionsLinked: true,
  collapsedPosition: null,
  expandedPosition: null,
}

const renderSettings = (
  inputPrefs: VibeCheckPreferences = prefs,
  onUpdate = vi.fn(),
) => render(
  <SettingsPanel
    prefs={inputPrefs}
    onUpdate={onUpdate}
    mode="technical"
    onToggleMode={vi.fn()}
    beaconUrl="http://127.0.0.1:4200"
    beaconStatus={null}
    onClearAll={vi.fn()}
    defaultPosition="bottom-right"
  />,
)

describe('SettingsPanel', () => {
  it('shows MCP status before preference controls', () => {
    renderSettings()

    const status = screen.getByTestId('vibe-check-agent-status')
    const wording = screen.getByText('Mode')
    expect(status.compareDocumentPosition(wording) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('uses one visual position picker while positions are linked', () => {
    const onUpdate = vi.fn()
    renderSettings(prefs, onUpdate)

    expect(screen.getByRole('radiogroup', { name: 'Widget position' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Collapsed' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Top left' }))

    expect(onUpdate).toHaveBeenCalledWith({
      collapsedPosition: 'top-left',
      expandedPosition: 'top-left',
    })
  })

  it('shows independent collapsed and expanded pickers when unlinked', () => {
    const onUpdate = vi.fn()
    renderSettings({
      ...prefs,
      positionsLinked: false,
      collapsedPosition: 'top-left',
      expandedPosition: 'bottom-right',
    }, onUpdate)

    expect(screen.getByRole('radiogroup', { name: 'Collapsed' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Expanded' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radiogroup', { name: 'Expanded' })
      .querySelector<HTMLInputElement>('input[value="top-right"]')!)

    expect(onUpdate).toHaveBeenCalledWith({ expandedPosition: 'top-right' })
  })

  it('resets both saved position overrides', () => {
    const onUpdate = vi.fn()
    renderSettings({ ...prefs, collapsedPosition: 'top-left', expandedPosition: 'top-left' }, onUpdate)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to app default' }))

    expect(onUpdate).toHaveBeenCalledWith({
      collapsedPosition: null,
      expandedPosition: null,
    })
  })

  it('exports and separately confirms resetting persisted impact', () => {
    const impact: ProjectImpactSummary = {
      projectId: 'storefront', detected: 2, sent: 1, uniqueIssuesFixed: 1,
      verifiedFixes: 1, regressionsCaught: 0, verificationFailures: 0,
      medianFixTimeMs: 1_000, metrics: [],
    }
    const onCopyImpact = vi.fn()
    const onResetImpact = vi.fn()
    render(<SettingsPanel
      prefs={prefs} onUpdate={vi.fn()} mode="technical" onToggleMode={vi.fn()}
      beaconStatus={null} onClearAll={vi.fn()} defaultPosition="bottom-right"
      impact={impact} onCopyImpact={onCopyImpact} onResetImpact={onResetImpact}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Export impact as Markdown' }))
    expect(onCopyImpact).toHaveBeenCalledWith(expect.stringContaining('helped verify 1 fix'))
    fireEvent.click(screen.getByRole('button', { name: 'Reset impact stats' }))
    expect(onResetImpact).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset impact stats' }))
    expect(onResetImpact).toHaveBeenCalledOnce()
  })
})
