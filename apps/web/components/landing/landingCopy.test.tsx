import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuditThisPage } from '@/components/landing/AuditThisPage'
import { BreakThisPage } from '@/components/landing/BreakThisPage'
import { LANDING_COPY } from '@/lib/landingCopy'

describe('live press check copy', () => {
  it('keeps the metadata literal and within search limits', () => {
    expect(LANDING_COPY.metaDescription.length).toBeLessThanOrEqual(160)
    expect(LANDING_COPY.metaDescription).toContain('performance and discoverability defects')
  })

  it('carries the press world through all six plates', () => {
    expect(LANDING_COPY.hero.headline).toEqual([
      'Your agent shipped it.',
      'VibeCheck pulled the proof.',
    ])
    expect(Object.values(LANDING_COPY.sections).map((section) => section.title)).toEqual([
      'What slips through the first pass',
      'Pull a bad proof',
      'Every pass, measured',
      'The Slop Bestiary',
      'From proof mark to fix',
      'Install the press check',
    ])
    expect(LANDING_COPY.footerLead).toBe('Pull a proof before you call it done.')
  })

  it('uses proof language in the live controls', () => {
    expect(renderToStaticMarkup(<BreakThisPage />)).toContain('Clear the proof')
    expect(renderToStaticMarkup(<AuditThisPage />)).toContain('Run the SEO / AEO press check')
  })
})
