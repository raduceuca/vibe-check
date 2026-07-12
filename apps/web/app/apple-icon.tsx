import { ImageResponse } from 'next/og'

// Apple touch icon (180×180). iOS masks to a rounded rect and doesn't honour SVG
// or transparency, so we render the reticle mark onto an opaque light tile. The
// mark is composed from positioned divs (Satori's native layout) rather than an
// embedded SVG — next/og's rasteriser rejects SVG data-URIs. Mirrors app/icon.svg:
// four bold ink ticks around a fault-red centre dot. Fixed dark ink (a home-screen
// icon has no theme context).

export const runtime = 'nodejs'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const INK = '#111112'
const RED = '#c0362c'

const tick = (rest: Record<string, number>) => ({
  position: 'absolute' as const,
  backgroundColor: INK,
  borderRadius: 6,
  ...rest,
})

const AppleIcon = () =>
  new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: '#f6f6f5',
        }}
      >
        <div style={tick({ width: 12, height: 34, left: 84, top: 33 })} />
        <div style={tick({ width: 12, height: 34, left: 84, top: 113 })} />
        <div style={tick({ width: 34, height: 12, left: 33, top: 84 })} />
        <div style={tick({ width: 34, height: 12, left: 113, top: 84 })} />
        <div
          style={{
            position: 'absolute',
            width: 30,
            height: 30,
            left: 75,
            top: 75,
            borderRadius: 15,
            backgroundColor: RED,
          }}
        />
      </div>
    ),
    { ...size },
  )

export default AppleIcon
