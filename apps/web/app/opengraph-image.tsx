import { ImageResponse } from 'next/og'

// Landing OG — white card, brand + two-line headline, no colour accents (site-spec §6).

export const runtime = 'nodejs'
export const alt = 'Your agent built it. You decide if it ships.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#111112'
const INK3 = '#5c5c60'

const Image = () =>
  new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          color: INK,
          padding: 72,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              width: 34,
              height: 34,
              borderRadius: 17,
              border: `2px solid ${INK}`,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.4 }}>VibeCheck</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 56,
            fontSize: 76,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: -1.6,
            maxWidth: 980,
          }}
        >
          <div>Your agent built it.</div>
          <div>You decide if it ships.</div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 28,
            fontWeight: 400,
            color: INK3,
            lineHeight: 1.35,
            maxWidth: 920,
          }}
        >
          A performance and SEO overlay that sends the issue you pick to your coding agent, and verifies the fix.
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            fontSize: 22,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: INK3,
          }}
        >
          vibecheck.wcgw.fun
        </div>
      </div>
    ),
    { ...size },
  )

export default Image
