/** Reference fix: reserved min-heights so late banners do not shift layout. */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ink, mute, paper, soft } from '../styles'

const SLOT: CSSProperties = {
  minHeight: 42,
  overflow: 'hidden',
}

const bar: CSSProperties = {
  background: soft,
  color: mute,
  textAlign: 'center',
  fontSize: 14,
  padding: '10px 16px',
  borderBottom: '1px solid #ebebeb',
  minHeight: 42,
  boxSizing: 'border-box',
}

const Delayed = ({
  delayMs,
  children,
}: {
  readonly delayMs: number
  readonly children: ReactNode
}) => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs)
    return () => window.clearTimeout(id)
  }, [delayMs])
  return <div style={SLOT}>{show ? children : null}</div>
}

export const PromoBar = () => (
  <Delayed delayMs={1200}>
    <div style={bar} role="status">
      Free kiln shipping on orders over $80 · Spring glaze drop
    </div>
  </Delayed>
)

export const ShippingNotice = () => (
  <Delayed delayMs={1350}>
    <div style={{ ...bar, background: paper, color: ink }}>
      Orders placed today leave the studio by Friday.
    </div>
  </Delayed>
)

export const NewsletterInvite = () => (
  <Delayed delayMs={1500}>
    <div style={{ ...bar, background: ink, color: paper }}>
      Get the kiln schedule — join the list below.
    </div>
  </Delayed>
)

export const LateBanners = () => (
  <>
    <PromoBar />
    <ShippingNotice />
    <NewsletterInvite />
  </>
)
