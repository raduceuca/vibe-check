import type { VibeEngine, VibeSnapshot } from '@wcgw/vibe-check-core'

export interface LiveStore {
  readonly subscribe: (listener: (snapshot: VibeSnapshot) => void) => () => void
  readonly getSnapshot: () => VibeSnapshot | null
}

// useSyncExternalStore needs the same object back until the store changes.
// engine.getSnapshot() builds a new one per call, so hand out the last
// emitted snapshot instead; calling it directly loops React forever.
export const createLiveStore = (
  engine: Pick<VibeEngine, 'getSnapshot' | 'onSnapshot'> | null,
): LiveStore => {
  if (!engine) return { subscribe: () => () => undefined, getSnapshot: () => null }

  let latest: VibeSnapshot = engine.getSnapshot()
  return {
    subscribe: (listener) => engine.onSnapshot((snapshot) => {
      latest = snapshot
      listener(snapshot)
    }),
    getSnapshot: () => latest,
  }
}
