import { OG_SIZE, OG_CONTENT_TYPE, renderOgImage } from '@/lib/problems/og'

// Default site OG image — used for the landing page and any route that doesn't
// ship its own. Quiet Instrument card with the product line, no severity chip.

export const runtime = 'nodejs'
export const alt = 'VibeCheck — a quiet performance instrument for the AI-built frontend'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const Image = () =>
  renderOgImage({
    kicker: 'For the AI-built frontend',
    title: 'Your agent shipped it. This caught what it broke.',
    footer: 'vibecheck.wcgw.fun',
    tag: 'Perf · SEO · AEO',
  })

export default Image
