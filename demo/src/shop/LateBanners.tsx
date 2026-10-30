// VIBECHECK-FAULT: layout-thrashing
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ink, mute, paper, soft } from './styles'

const bar: CSSProperties = {
  background: soft,
  color: mute,
  textAlign: 'center',
  fontSize: 14,
  padding: '10px 16px',
  borderBottom: '1px solid #ebebeb',
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
  if (!show) return null
  return <>{children}</>
}

/** Promo bar — mounts at 1200 ms with no reserved space. */
export const PromoBar = () => (
  <Delayed delayMs={1200}>
    <div style={bar} role="status">
      Free kiln shipping on orders over $80 · Spring glaze drop
    </div>
  </Delayed>
)

/** Shipping notice — mounts at 1350 ms. */
export const ShippingNotice = () => (
  <Delayed delayMs={1350}>
    <div
      style={{
        ...bar,
        background: paper,
        color: ink,
        borderBottom: '1px solid #ebebeb',
      }}
    >
      Orders placed today leave the studio by Friday.
    </div>
  </Delayed>
)

/** Newsletter invite strip — mounts at 1500 ms. */
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
