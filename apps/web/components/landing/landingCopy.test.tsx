import { describe, expect, it } from 'vitest'
import { LANDING_COPY } from '@/lib/landingCopy'

describe('landing copy', () => {
  it('keeps the metadata literal and within search limits', () => {
    expect(LANDING_COPY.title.length).toBeLessThanOrEqual(60)
    expect(LANDING_COPY.metaDescription.length).toBeLessThanOrEqual(160)
    expect(LANDING_COPY.metaDescription).toContain('coding agent')
  })

  it('carries the hero and section titles from the site spec', () => {
    expect(LANDING_COPY.hero.headline).toEqual([
      'Your agent built it.',
      'You decide if it ships.',
    ])
    expect(LANDING_COPY.look.title).toBe('This page, checked as you read it.')
    expect(LANDING_COPY.loop.title).toBe('Four steps. One of them is yours.')
    expect(LANDING_COPY.notice.title).toBe('Now break it the way agents do.')
    expect(LANDING_COPY.install.title).toBe('Run it on your own app.')
    expect(LANDING_COPY.confirm.title).toBe("It's fixed when the page says it is.")
    expect(LANDING_COPY.yourCall.title).toBe('Your call.')
    expect(LANDING_COPY.faq.title).toBe('Straight answers.')
    expect(LANDING_COPY.faq.items).toHaveLength(6)
    expect(LANDING_COPY.footerLead).toBe('Keep building fast. Keep the final say.')
  })

  it('builds setup commands from MCP_PACKAGE_SPEC', () => {
    const command = LANDING_COPY.install.setupCommand('cursor')
    expect(command).toMatch(/^npx -y @wcgw\/vibe-check-mcp@/)
    expect(command).toContain('setup --agent cursor')
    expect(command).not.toContain('@latest')
  })
})
