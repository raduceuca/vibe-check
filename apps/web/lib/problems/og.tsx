import { ImageResponse } from 'next/og'
import type { Severity } from './types'

// ── Branded OG image renderer — "Quiet Instrument" ───────────────────────────
// One shared 1200×630 card used by every dynamic OG route: the site default, the
// per-problem /fix/<slug> image, and the framework variants. Pure-neutral panel,
// hairline rules, a small severity accent chip, the VibeCheck wordmark. Renders
// with next/og's bundled default font — no Google-font fetch, dependency-free.

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

// Fixed light-neutral palette mirroring the site's --vc-* tokens. OG cards render
// standalone (no theme context), so the values are inlined rather than themed.
const C = {
  bg: '#ffffff',
  ink: '#111112',
  ink3: 'rgba(17, 17, 18, 0.52)',
  ink4: 'rgba(17, 17, 18, 0.40)',
  line: 'rgba(17, 17, 18, 0.12)',
  sig: '#c0362c',
} as const

// Severity → accent. error/critical read as the caught-fault red, warning as
// amber, info as a muted neutral (low-priority, not a fault).
const ACCENT: Record<Severity, string> = {
  info: '#5b5b5e',
  warning: '#a16207',
  error: '#c0362c',
  critical: '#c0362c',
}

const clamp = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`

// Scale the headline down as it gets longer so it always fits the safe area.
const titleSize = (len: number): number => {
  if (len <= 22) return 78
  if (len <= 34) return 66
  if (len <= 46) return 56
  return 48
}

export interface OgCardProps {
  readonly kicker: string
  readonly title: string
  readonly severity?: Severity
  readonly footer?: string
  readonly tag?: string
}

const OgCard = ({ kicker, title, severity, footer = 'vibecheck.wcgw.fun', tag }: OgCardProps) => {
  const headline = clamp(title, 72)
  const accent = severity ? ACCENT[severity] : undefined
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: C.bg,
        color: C.ink,
        padding: '72px 80px',
      }}
    >
      {/* Header: wordmark + severity chip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 28,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, backgroundColor: C.sig, marginRight: 14 }} />
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.4 }}>VibeCheck</div>
        </div>
        {severity && accent ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: `1.5px solid ${accent}`,
              borderRadius: 999,
              padding: '8px 16px',
            }}
          >
            <div style={{ display: 'flex', width: 9, height: 9, borderRadius: 5, backgroundColor: accent, marginRight: 9 }} />
            <div style={{ fontSize: 18, letterSpacing: 2, color: accent, fontWeight: 600 }}>
              {severity.toUpperCase()}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      {/* Body: category kicker + headline */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
        <div style={{ fontSize: 22, letterSpacing: 5, color: C.ink3, fontWeight: 500, marginBottom: 22 }}>
          {kicker.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: titleSize(headline.length),
            fontWeight: 600,
            letterSpacing: -1.5,
            lineHeight: 1.05,
            color: C.ink,
            maxWidth: 1010,
          }}
        >
          {headline}
        </div>
      </div>

      {/* Footer: domain + section tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 26,
          borderTop: `1px solid ${C.line}`,
        }}
      >
        <div style={{ fontSize: 22, color: C.ink4, letterSpacing: 0.3 }}>{footer}</div>
        {tag ? (
          <div style={{ fontSize: 17, letterSpacing: 3, color: C.ink4, fontWeight: 500 }}>{tag.toUpperCase()}</div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>
    </div>
  )
}

export const renderOgImage = (props: OgCardProps): ImageResponse =>
  new ImageResponse(<OgCard {...props} />, { ...OG_SIZE })
