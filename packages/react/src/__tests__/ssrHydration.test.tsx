import { act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VibeCheckConfig, VibeSnapshot } from '@wcgw/vibe-check-core'
import {
  EMPTY_CONSOLE_STATS,
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_RESOURCE_STATS,
  EMPTY_WEB_VITALS,
} from '@wcgw/vibe-check-core'

// W1 / P5: a server render has no localStorage, so the widget's first client
// render must not depend on stored preferences, persisted issues, or canvas
// support. Otherwise every reload after the first session fails hydration.

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

vi.mock('../hooks/useVibeCheck.js', () => ({
  useVibeCheck: (_config: Partial<VibeCheckConfig> | undefined, _enabled: boolean) => ({
    engine: null,
    snapshot: EMPTY_SNAPSHOT,
  }),
}))

const { PerfToggle } = await import('../PerfToggle.js')
const { __resetIssueStore } = await import('../hooks/useIssueStore.js')

const persistedIssue = {
  issue: {
    id: 'dom-1',
    detector: 'dom-bloat',
    severity: 'warning',
    title: 'Large DOM',
    description: 'Too many nodes',
    evidence: { nodeCount: 1_800 },
    timestamp: 1,
    acknowledged: false,
    resolved: false,
  },
  status: 'new',
  firstSeen: 1,
  lastSeen: 1,
  sentAt: null,
  resolvedAt: null,
}

const hydrateAfterServerRender = async (seedStorage: () => void): Promise<{ errors: string[]; root: Root }> => {
  localStorage.clear()
  __resetIssueStore()
  const element = <PerfToggle vibeCheckProps={{ projectId: 'ssr-demo' }} />
  const html = renderToString(element)

  // What the browser has after one earlier session.
  seedStorage()
  __resetIssueStore()

  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)

  const errors: string[] = []
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '))
  })
  let root: Root | null = null
  await act(async () => {
    root = hydrateRoot(host, element, {
      onRecoverableError: (error) => { errors.push(`recoverable: ${String(error)}`) },
    })
  })
  consoleError.mockRestore()
  if (!root) throw new Error('hydrateRoot did not return a root')
  return { errors, root }
}

describe('server rendering', () => {
  let root: Root | null = null

  beforeEach(() => {
    root = null
  })

  afterEach(() => {
    act(() => { root?.unmount() })
    document.body.innerHTML = ''
    localStorage.clear()
  })

  it('renders no widget markup on the server', () => {
    const html = renderToString(<PerfToggle vibeCheckProps={{ projectId: 'ssr-demo' }} />)
    expect(html).toBe('')
  })

  it('hydrates without a mismatch when the user expanded the widget and chose the light theme', async () => {
    const result = await hydrateAfterServerRender(() => {
      localStorage.setItem('vibe-check:preferences:ssr-demo', JSON.stringify({ collapsed: false, theme: 'light' }))
    })
    root = result.root

    expect(result.errors.filter((line) => /hydrat|did not match|recoverable/i.test(line))).toEqual([])
    const overlay = document.querySelector('[data-testid="vibe-check-overlay"]')
    expect(overlay?.getAttribute('role')).toBe('complementary')
    expect(overlay?.getAttribute('data-wcgw-theme')).toBe('light')
  })

  it('hydrates without a mismatch when an issue was persisted by an earlier session', async () => {
    const result = await hydrateAfterServerRender(() => {
      localStorage.setItem('vibe-check:issues:ssr-demo', JSON.stringify({ issues: [persistedIssue], clearedIds: [] }))
    })
    root = result.root

    expect(result.errors.filter((line) => /hydrat|did not match|recoverable/i.test(line))).toEqual([])
    // The portal mounts after hydration; an empty live snapshot then prunes
    // stale `new` issues until detectors observe the page again.
    expect(document.querySelector('[data-testid="vibe-check-overlay"]')).toBeTruthy()
  })
})

