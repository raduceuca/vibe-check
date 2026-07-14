import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VibeSnapshot } from '@wcgw/vibe-check-core'
import {
  EMPTY_CONSOLE_STATS,
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_RESOURCE_STATS,
  EMPTY_WEB_VITALS,
} from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../../store/issueStore.js'
import { BottomNav } from '../nav/BottomNav.js'
import { MonitorView } from './MonitorView.js'

const SNAPSHOT: VibeSnapshot = {
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

const TRACKED: TrackedIssue = {
  issue: {
    id: 'dom-1',
    detector: 'dom-bloat',
    severity: 'warning',
    title: 'Large DOM detected',
    description: 'Too many nodes.',
    evidence: {},
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

describe('monitor proof details', () => {
  it('adds live-sample, calibration, audit, and issue registration details', () => {
    const { container } = render(
      <MonitorView
        snapshot={SNAPSHOT}
        mode="vibe"
        tracked={[TRACKED]}
        panels={new Set(['fps', 'vitals', 'memory', 'console', 'issues'])}
        theme="dark"
        history={{ live: [], long: [] }}
        onOpenView={vi.fn()}
      />,
    )

    expect(container.querySelector('[data-wcgw-read-sample]')?.textContent).toBe('READ / SAMPLE')
    expect(container.querySelectorAll('[data-wcgw-calibration-ruler]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-wcgw-audit-plate]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-wcgw-issue-register]')).toHaveLength(1)
    expect(container.querySelector('[data-wcgw-proof-marks-heading]')?.textContent).toBe('proof marks')
    expect(container.querySelectorAll('[data-wcgw-proof-divider="major"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-wcgw-proof-divider="minor"]')).toHaveLength(1)
  })

  it('labels the active navigation view as a proof plate', () => {
    const { container } = render(
      <BottomNav
        activeView="monitor"
        onSelect={vi.fn()}
        mode="vibe"
        counts={{ agent: 0, seo: 0, aeo: 0 }}
      />,
    )

    expect(container.querySelector('[data-wcgw-nav-proof]')?.textContent).toBe('PL 01/06')
  })
})
