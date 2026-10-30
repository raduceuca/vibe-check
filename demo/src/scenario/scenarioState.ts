export const VIBES = ['smooth', 'light', 'clean', 'findable', 'quotable'] as const
export type Vibe = (typeof VIBES)[number]

export const COOKIE_NAME = 'tidewell_fixed'
export const RELOAD_VIBES: ReadonlySet<Vibe> = new Set([
  'smooth', // long-task configurator script
  'light', // heavy-library + resource-bloat entry
  'clean', // web-essentials head
  'findable', // SEO head
  'quotable', // AEO head / robots / llms
])

export const VIBE_LABELS: Readonly<Record<Vibe, string>> = {
  smooth: 'Smooth',
  light: 'Light',
  clean: 'Clean',
  findable: 'Findable',
  quotable: 'Quotable',
}

export const VIBE_FAULTS: Readonly<Record<Vibe, readonly string[]>> = {
  smooth: ['layout-thrashing (LateBanners)', 'long-task-attribution (GlazePicker)', 'FPS (StockTicker)'],
  light: [
    'dom-bloat (Reviews)',
    'duplicate-requests (cart)',
    'memory-leak (RecentlyViewed)',
    'large-images / unoptimized-images',
    'heavy-library (moment stub)',
    'resource-bloat (catalog)',
  ],
  clean: ['console-spam (CartPoller)', 'web-essentials (head)'],
  findable: ['seo (title / meta / headings)'],
  quotable: ['aeo (JSON-LD / robots / llms)'],
}

export const parseFixedList = (raw: string | null | undefined): ReadonlySet<Vibe> => {
  if (!raw || raw.trim() === '') return new Set()
  const next = new Set<Vibe>()
  for (const part of raw.split(',')) {
    const v = part.trim().toLowerCase()
    if ((VIBES as readonly string[]).includes(v)) next.add(v as Vibe)
  }
  return next
}

export const serializeFixed = (fixed: ReadonlySet<Vibe>): string =>
  VIBES.filter((v) => fixed.has(v)).join(',')

export const readCookieFixed = (): ReadonlySet<Vibe> => {
  if (typeof document === 'undefined') return new Set()
  const match = document.cookie.match(/(?:^|;\s*)tidewell_fixed=([^;]*)/)
  return parseFixedList(match?.[1] ? decodeURIComponent(match[1]) : '')
}

export const writeCookieFixed = (fixed: ReadonlySet<Vibe>): void => {
  if (typeof document === 'undefined') return
  const value = serializeFixed(fixed)
  if (value === '') {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`
  } else {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`
  }
}

/** Resolve fixed vibes from URL (?scenario= / ?fixed=) with cookie fallback. */
export const resolveFixedFromLocation = (search: string): ReadonlySet<Vibe> => {
  const params = new URLSearchParams(search)
  const scenario = params.get('scenario')
  if (scenario === 'broken') return new Set()
  if (scenario === 'fixed') return new Set(VIBES)
  if (params.has('fixed')) return parseFixedList(params.get('fixed'))
  return readCookieFixed()
}

export const syncUrlAndCookie = (fixed: ReadonlySet<Vibe>): void => {
  writeCookieFixed(fixed)
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('scenario')
  const value = serializeFixed(fixed)
  if (value === '') url.searchParams.delete('fixed')
  else url.searchParams.set('fixed', value)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export const isVibeFixed = (fixed: ReadonlySet<Vibe>, vibe: Vibe): boolean => fixed.has(vibe)

type Listener = (fixed: ReadonlySet<Vibe>) => void

let currentFixed: ReadonlySet<Vibe> =
  typeof window !== 'undefined' ? resolveFixedFromLocation(window.location.search) : new Set()
const listeners = new Set<Listener>()

export const getScenarioFixed = (): ReadonlySet<Vibe> => currentFixed

export const setScenarioFixed = (fixed: ReadonlySet<Vibe>): void => {
  currentFixed = fixed
  syncUrlAndCookie(fixed)
  for (const listener of listeners) listener(fixed)
}

export const subscribeScenarioFixed = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
