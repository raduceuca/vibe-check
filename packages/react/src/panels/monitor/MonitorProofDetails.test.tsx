import { render, screen } from '@testing-library/react'
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

describe('monitor sections', () => {
  it('shows issues without print-mark chrome', () => {
    render(
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

    expect(screen.getByText('problems')).toBeTruthy()
    expect(screen.queryByText('proof marks')).toBeNull()
    expect(screen.queryByText('READ / SAMPLE')).toBeNull()
    expect(screen.queryByText(/CHK /)).toBeNull()
    expect(document.querySelectorAll('[data-wcgw-calibration-ruler]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-testid="vibe-check-divider"]')).toHaveLength(3)
  })
})
