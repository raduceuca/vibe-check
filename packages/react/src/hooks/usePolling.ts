import { useEffect } from 'react'

// Delay before the next poll, indexed by consecutive failures: 2 s while the
// hub answers, then 4 → 8 → 16 → 30 → 60 s (cap) while it does not.
export const POLL_DELAYS_MS: readonly number[] = [2_000, 4_000, 8_000, 16_000, 30_000, 60_000]

export const pollDelayMs = (failures: number): number =>
  POLL_DELAYS_MS[Math.min(Math.max(failures, 0), POLL_DELAYS_MS.length - 1)] ?? 60_000

const pageHidden = (): boolean =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden'

// Runs `load` now, then again after pollDelayMs(failures). `load` resolves true
// on success. Nothing runs while the tab is hidden; becoming visible again
// polls at once with the backoff reset. Pass a stable `load` (useCallback):
// a new function restarts the loop.
export const usePolling = (load: () => Promise<boolean>, enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let inFlight = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async (): Promise<void> => {
      timer = undefined
      if (cancelled || inFlight || pageHidden()) return
      inFlight = true
      const ok = await load().catch(() => false)
      inFlight = false
      if (cancelled) return
      failures = ok ? 0 : failures + 1
      timer = setTimeout(() => { void tick() }, pollDelayMs(failures))
    }

    const onVisibilityChange = (): void => {
      if (pageHidden() || inFlight) return
      if (timer !== undefined) clearTimeout(timer)
      failures = 0
      void tick()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void tick()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [load, enabled])
}
