// Light, best-effort per-IP write limiter. This lives in isolate memory, so it
// is per-colo and resets when the isolate recycles — it is NOT a hard guarantee.
// The real protection on the write path is the shared secret; this is just a
// cheap brake against a burst from a single client if that secret ever leaks.

interface Window {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20

const buckets = new Map<string, Window>()

export const allowWrite = (ip: string, now: number = Date.now()): boolean => {
  const existing = buckets.get(ip)

  if (!existing || now >= existing.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (existing.count >= MAX_PER_WINDOW) return false

  // Immutable update of the bucket value.
  buckets.set(ip, { count: existing.count + 1, resetAt: existing.resetAt })
  return true
}
