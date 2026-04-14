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

// Mock the useVibeCheck hook
const mockUseVibeCheck = vi.fn<
  [Partial<VibeCheckConfig> | undefined, boolean],
  { engine: null; snapshot: VibeSnapshot }
>()

vi.mock('../hooks/useVibeCheck.js', () => ({
  useVibeCheck: (...args: [Partial<VibeCheckConfig> | undefined, boolean]) =>
    mockUseVibeCheck(...args),
}))

const { VibeCheck } = await import('../VibeCheck.js')

describe('VibeCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseVibeCheck.mockReturnValue({
      engine: null,
      snapshot: EMPTY_SNAPSHOT,
    })
  })

  it('renders nothing when enabled=false', () => {
    const { container } = render(<VibeCheck enabled={false} />)

    expect(container.innerHTML).toBe('')
  })

  it('renders overlay when enabled=true', () => {
    render(<VibeCheck enabled />)

    const overlay = screen.getByTestId('vibe-check-overlay')
    expect(overlay).toBeTruthy()
    expect(screen.getByText('vibe check')).toBeTruthy()
  })

  it('shows FPS panel by default', () => {
    const snapshotWithFps: VibeSnapshot = {
      ...EMPTY_SNAPSHOT,
      frameRate: {
        fps: 60,
        avgFrameTime: 16.67,
        maxFrameTime: 20,
        droppedFrames: 0,
        smoothness: 100,
      },
    }

    mockUseVibeCheck.mockReturnValue({
      engine: null,
      snapshot: snapshotWithFps,
    })

    render(<VibeCheck enabled />)

    // FPS hero value (inside ring gauge)
    expect(screen.getByText('60')).toBeTruthy()
  })

  it('toggles collapse/expand when header is clicked', () => {
    render(<VibeCheck enabled />)

    const body = screen.getByTestId('vibe-check-body')
    expect(body).toBeTruthy()

    const header = screen.getByTestId('vibe-check-header')
    fireEvent.click(header)

    // Collapsed — body gone, chip visible
    expect(screen.queryByTestId('vibe-check-body')).toBeNull()

    // Click the collapsed chip header to expand
    const chipHeader = screen.getByTestId('vibe-check-header')
    fireEvent.click(chipHeader)

    expect(screen.getByTestId('vibe-check-body')).toBeTruthy()
  })

  it('applies position prop styling', () => {
    const { rerender } = render(
      <VibeCheck enabled position="top-left" />
    )

    let overlay = screen.getByTestId('vibe-check-overlay')
    expect(overlay.style.top).toBe('12px')
    expect(overlay.style.left).toBe('12px')

    rerender(<VibeCheck enabled position="bottom-right" />)

    overlay = screen.getByTestId('vibe-check-overlay')
    expect(overlay.style.bottom).toBe('12px')
    expect(overlay.style.right).toBe('12px')
  })

  it('respects panels prop to control which panels render', () => {
    render(<VibeCheck enabled panels={['fps']} />)

    // FPS section header should be present (defaults to 'vibe' mode → "Smoothness")
    expect(screen.getByText('Smoothness')).toBeTruthy()

    // Section titles for other panels should not be present
    expect(screen.queryByText('Page Speed')).toBeNull()
    expect(screen.queryByText('Memory')).toBeNull()
  })

  it('shows issues panel with all-clear state', () => {
    render(<VibeCheck enabled panels={['issues']} />)

    expect(screen.getByText('All vibes are good')).toBeTruthy()
  })
})
