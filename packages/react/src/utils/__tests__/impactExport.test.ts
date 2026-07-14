import { describe, expect, it } from 'vitest'
import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'
import { formatImpactJson, formatImpactMarkdown } from '../impactExport.js'

const impact: ProjectImpactSummary = {
  projectId: 'storefront',
  detected: 2,
  sent: 2,
  uniqueIssuesFixed: 1,
  verifiedFixes: 1,
  regressionsCaught: 0,
  verificationFailures: 0,
  medianFixTimeMs: 1_000,
  metrics: [],
}

describe('impact exports', () => {
  it('creates privacy-safe Markdown and exact JSON', () => {
    const markdown = formatImpactMarkdown(impact)
    expect(markdown).toContain('helped verify 1 fix')
    expect(markdown).not.toMatch(/session|filesystem|\/Users\//i)
    expect(JSON.parse(formatImpactJson(impact))).toEqual(impact)
  })
})
