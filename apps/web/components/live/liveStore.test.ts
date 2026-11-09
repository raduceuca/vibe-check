import { describe, expect, it } from 'vitest'
import type { VibeSnapshot } from '@wcgw/vibe-check-core'
import { createLiveStore } from './liveStore'

// Each getSnapshot() call builds a new object, like the real engine does.
const fakeEngine = () => {
  const listeners = new Set<(snapshot: VibeSnapshot) => void>()
  let calls = 0
  return {
    getSnapshot: () => ({ timestamp: ++calls }) as unknown as VibeSnapshot,
    onSnapshot: (listener: (snapshot: VibeSnapshot) => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    emit: (snapshot: VibeSnapshot) => { for (const listener of listeners) listener(snapshot) },
  }
}

describe('createLiveStore', () => {
  it('returns the same snapshot until the engine emits a new one', () => {
    const engine = fakeEngine()
    const store = createLiveStore(engine)
    expect(store.getSnapshot()).toBe(store.getSnapshot())

    const received: VibeSnapshot[] = []
    const unsubscribe = store.subscribe((snapshot) => { received.push(snapshot) })
    const next = { timestamp: 99 } as unknown as VibeSnapshot
    engine.emit(next)

    expect(received).toEqual([next])
    expect(store.getSnapshot()).toBe(next)
    expect(store.getSnapshot()).toBe(store.getSnapshot())
    unsubscribe()
  })

  it('reads null without an engine', () => {
    const store = createLiveStore(null)
    expect(store.getSnapshot()).toBeNull()
    expect(() => store.subscribe(() => undefined)()).not.toThrow()
  })
})
