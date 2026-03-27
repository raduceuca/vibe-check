import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VibeSnapshot } from '@wcgw/vibe-check-core'
import {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
} from '@wcgw/vibe-check-core'

// Track mock instances
const mockStart = vi.fn()
const mockStop = vi.fn()
const mockOnSnapshot = vi.fn<[(snapshot: VibeSnapshot) => void], () => void>()
const mockIsRunning = vi.fn(() => false)
const mockGetSnapshot = vi.fn<[], VibeSnapshot>()
const mockGetIssues = vi.fn(() => [])
const mockClearIssues = vi.fn()

vi.mock('@wcgw/vibe-check-core', async () => {
  const actual = await vi.importActual<typeof import('@wcgw/vibe-check-core')>(
    '@wcgw/vibe-check-core'
  )

  class MockVibeCheckEngine {
    start = mockStart
    stop = mockStop
    onSnapshot = mockOnSnapshot
    isRunning = mockIsRunning
    getSnapshot = mockGetSnapshot
    getIssues = mockGetIssues
    clearIssues = mockClearIssues
  }

  return {
    ...actual,
    VibeCheckEngine: MockVibeCheckEngine,
  }
})

const { useVibeCheck } = await import('../../hooks/useVibeCheck.js')

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

describe('useVibeCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSnapshot.mockReturnValue(vi.fn())
  })

  it('creates engine when enabled', () => {
    renderHook(() => useVibeCheck(undefined, true))

    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
  })

  it('does not create engine when disabled', () => {
    const { result } = renderHook(() => useVibeCheck(undefined, false))

    expect(mockStart).not.toHaveBeenCalled()
    expect(result.current.engine).toBeNull()
    expect(result.current.snapshot).toEqual(EMPTY_SNAPSHOT)
  })

  it('stops engine on unmount', () => {
    const unsubscribeFn = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribeFn)

    const { unmount } = renderHook(() => useVibeCheck(undefined, true))

    unmount()

    expect(mockStop).toHaveBeenCalledTimes(1)
    expect(unsubscribeFn).toHaveBeenCalledTimes(1)
  })

  it('returns snapshot data when engine emits', () => {
    let snapshotCallback: ((snapshot: VibeSnapshot) => void) | null = null
    mockOnSnapshot.mockImplementation((cb) => {
      snapshotCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useVibeCheck(undefined, true))

    const testSnapshot: VibeSnapshot = {
      timestamp: 1000,
      frameRate: {
        fps: 60,
        avgFrameTime: 16.67,
        maxFrameTime: 20,
        droppedFrames: 1,
        smoothness: 98,
      },
      longFrames: EMPTY_LONG_FRAME_STATS,
      webVitals: EMPTY_WEB_VITALS,
      memory: null,
      resources: EMPTY_RESOURCE_STATS,
      issues: [],
      domNodeCount: 150,
    }

    act(() => {
      snapshotCallback?.(testSnapshot)
    })

    expect(result.current.snapshot).toEqual(testSnapshot)
  })

  it('defaults to enabled when no enabled argument is passed', () => {
    renderHook(() => useVibeCheck())

    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('restarts engine when config changes', () => {
    const unsubscribeFn = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribeFn)

    const { rerender } = renderHook(
      ({ config }: { config: { beaconUrl?: string } | undefined }) =>
        useVibeCheck(config, true),
      { initialProps: { config: undefined } }
    )

    expect(mockStart).toHaveBeenCalledTimes(1)

    rerender({ config: { beaconUrl: 'https://example.com/beacon' } })

    // Old engine should be stopped, new one started
    expect(mockStop).toHaveBeenCalledTimes(1)
    expect(mockStart).toHaveBeenCalledTimes(2)
  })
})
