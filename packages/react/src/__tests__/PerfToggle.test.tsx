import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VibeSnapshot, VibeCheckConfig } from '@wcgw/vibe-check-core'
import {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
} from '@wcgw/vibe-check-core'

const EMPTY_SNAPSHOT: VibeSnapshot = {
  timestamp: 0,
  frameRate: EMPTY_FRAME_RATE_STATS,
  longFrames: EMPTY_LONG_FRAME_STATS,
  webVitals: EMPTY_WEB_VITALS,
  memory: null,
  resources: EMPTY_RESOURCE_STATS,
  console: EMPTY_CONSOLE_STATS,
  issues: [],
  domNodeCount: 0,
}

const mockUseVibeCheck = vi.fn<
  [Partial<VibeCheckConfig> | undefined, boolean],
  { engine: null; snapshot: VibeSnapshot }
>()

vi.mock('../hooks/useVibeCheck.js', () => ({
  useVibeCheck: (...args: [Partial<VibeCheckConfig> | undefined, boolean]) =>
    mockUseVibeCheck(...args),
}))

const { PerfToggle } = await import('../PerfToggle.js')

describe('PerfToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUseVibeCheck.mockReturnValue({
      engine: null,
      snapshot: EMPTY_SNAPSHOT,
    })
  })

  it('renders the widget (collapsed pill) on first run', () => {
    render(<PerfToggle />)

    // First-run is visible so the tool is discoverable, not invisible.
    expect(screen.getByTestId('vibe-check-overlay')).toBeTruthy()
  })

  it('hides and shows on the default shortcut (alt+shift+v)', () => {
    render(<PerfToggle />)

    expect(screen.getByTestId('vibe-check-overlay')).toBeTruthy()

    fireEvent.keyDown(document, {
      key: 'v',
      altKey: true,
      shiftKey: true,
    })

    expect(screen.queryByTestId('vibe-check-overlay')).toBeNull()

    fireEvent.keyDown(document, {
      key: 'v',
      altKey: true,
      shiftKey: true,
    })

    expect(screen.getByTestId('vibe-check-overlay')).toBeTruthy()
  })

  it('toggles on custom shortcut prop', () => {
    render(<PerfToggle shortcut="alt+v" />)

    expect(screen.getByTestId('vibe-check-overlay')).toBeTruthy()

    fireEvent.keyDown(document, {
      key: 'v',
      altKey: true,
    })

    expect(screen.queryByTestId('vibe-check-overlay')).toBeNull()
  })

  it('does not toggle on non-matching shortcut', () => {
    render(<PerfToggle shortcut="alt+shift+v" />)

    // Wrong combo (no shift) leaves the widget in its current (visible) state.
    fireEvent.keyDown(document, {
      key: 'v',
      altKey: true,
      shiftKey: false,
    })

    expect(screen.getByTestId('vibe-check-overlay')).toBeTruthy()
  })

  it('passes vibeCheckProps through to VibeCheck', () => {
    render(
      <PerfToggle
        vibeCheckProps={{ position: 'top-left', panels: ['fps'] }}
      />
    )

    const overlay = screen.getByTestId('vibe-check-overlay')
    expect(overlay.style.top).toBe('12px')
    expect(overlay.style.left).toBe('12px')
  })
})
