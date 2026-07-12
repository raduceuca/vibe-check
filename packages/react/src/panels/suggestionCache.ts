import type { VibeIssue, SuggestionMode, Suggestion } from '@wcgw/vibe-check-core'
import { getSuggestion } from '@wcgw/vibe-check-core'

// Memoize getSuggestion by (issue.id, mode). The engine emits a fresh issues
// array every tick, so any panel that re-renders would otherwise re-interpolate
// every row's suggestion template. Issue ids are stable and embed any content
// that changes the suggestion (e.g. a DOM node count), so a cached entry can't
// go stale under a live change. Bounded so a long session can't grow it.
const cache = new Map<string, Suggestion>()
const MAX_ENTRIES = 400

export const getSuggestionCached = (issue: VibeIssue, mode: SuggestionMode): Suggestion => {
  const key = `${issue.id}:${mode}`
  const hit = cache.get(key)
  if (hit) return hit
  const result = getSuggestion(issue, mode)
  if (cache.size >= MAX_ENTRIES) cache.clear()
  cache.set(key, result)
  return result
}
