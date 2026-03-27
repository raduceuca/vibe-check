export const hasPerformanceObserver = (): boolean => {
  if (typeof window === 'undefined') return false
  return typeof PerformanceObserver !== 'undefined'
}

export const hasEntryType = (type: string): boolean => {
  if (!hasPerformanceObserver()) return false
  try {
    const supported = PerformanceObserver.supportedEntryTypes
    return Array.isArray(supported) && supported.includes(type)
  } catch {
    return false
  }
}

export const hasPerformanceMemory = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    typeof performance !== 'undefined' &&
    'memory' in performance &&
    performance.memory != null
  )
}

export const hasLongAnimationFrame = (): boolean =>
  hasEntryType('long-animation-frame')

export const hasLayoutShift = (): boolean =>
  hasEntryType('layout-shift')

export const hasLargestContentfulPaint = (): boolean =>
  hasEntryType('largest-contentful-paint')

export const hasEventTiming = (): boolean =>
  hasEntryType('event')

export const hasMutationObserver = (): boolean => {
  if (typeof window === 'undefined') return false
  return typeof MutationObserver !== 'undefined'
}

export const hasResourceTiming = (): boolean =>
  hasEntryType('resource')
