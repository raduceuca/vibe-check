import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EMPTY_FRAME_RATE_STATS } from '@wcgw/vibe-check-core'
import type { FrameRateStats } from '@wcgw/vibe-check-core'

// Track mock instances
const mockStart = vi.fn()
const mockStop = vi.fn()
const mockOnUpdate = vi.fn<[(stats: FrameRateStats) => void], () => void>()

vi.mock('@wcgw/vibe-check-core', async () => {
  const actual = await vi.importActual<typeof import('@wcgw/vibe-check-core')>(
    '@wcgw/vibe-check-core'
  )

  class MockFrameRateCollector {
    start = mockStart
    stop = mockStop
    onUpdate = mockOnUpdate
    getStats = vi.fn(() => actual.EMPTY_FRAME_RATE_STATS)
  }

  return {
    ...actual,
    FrameRateCollector: MockFrameRateCollector,
  }
})

// Must import after mock
const { useFrameRate } = await import('../../hooks/useFrameRate.js')

describe('useFrameRate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdate.mockReturnValue(vi.fn())
  })

  it('returns EMPTY_FRAME_RATE_STATS when disabled', () => {
    const { result } = renderHook(() => useFrameRate(false))

    expect(result.current).toEqual(EMPTY_FRAME_RATE_STATS)
    expect(mockStart).not.toHaveBeenCalled()
  })

  it('returns EMPTY_FRAME_RATE_STATS by default (disabled by default)', () => {
    const { result } = renderHook(() => useFrameRate())

    expect(result.current).toEqual(EMPTY_FRAME_RATE_STATS)
    expect(mockStart).not.toHaveBeenCalled()
  })

  it('starts collector when enabled', () => {
    renderHook(() => useFrameRate(true))

    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(mockOnUpdate).toHaveBeenCalledTimes(1)
  })

  it('stops collector on unmount', () => {
    const unsubscribeFn = vi.fn()
    mockOnUpdate.mockReturnValue(unsubscribeFn)

    const { unmount } = renderHook(() => useFrameRate(true))

    unmount()

    expect(mockStop).toHaveBeenCalledTimes(1)
    expect(unsubscribeFn).toHaveBeenCalledTimes(1)
  })

  it('updates stats via onUpdate callback', () => {
    let updateCallback: ((stats: FrameRateStats) => void) | null = null
    mockOnUpdate.mockImplementation((cb) => {
      updateCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useFrameRate(true))

    const updatedStats: FrameRateStats = {
      fps: 60,
      avgFrameTime: 16.67,
      maxFrameTime: 18.5,
      droppedFrames: 2,
      smoothness: 96.7,
    }

    act(() => {
      updateCallback?.(updatedStats)
    })

    expect(result.current).toEqual(updatedStats)
  })

  it('resets stats when transitioning from enabled to disabled', () => {
    let updateCallback: ((stats: FrameRateStats) => void) | null = null
    mockOnUpdate.mockImplementation((cb) => {
      updateCallback = cb
      return vi.fn()
    })

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useFrameRate(enabled),
      { initialProps: { enabled: true } }
    )

    const updatedStats: FrameRateStats = {
      fps: 60,
      avgFrameTime: 16.67,
      maxFrameTime: 18.5,
      droppedFrames: 2,
      smoothness: 96.7,
    }

    act(() => {
      updateCallback?.(updatedStats)
    })

    expect(result.current).toEqual(updatedStats)

    rerender({ enabled: false })

    expect(result.current).toEqual(EMPTY_FRAME_RATE_STATS)
  })
})
