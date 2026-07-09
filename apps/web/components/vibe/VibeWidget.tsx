'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { VibeCheckProps } from '@wcgw/vibe-check'

// The real widget mounted live on the marketing page. It reads browser-only
// APIs (PerformanceObserver, performance.memory, console/fetch patches), so we
// load it client-side only — no SSR pass, no window guards needed downstream.
const VibeCheck = dynamic(
  () => import('@wcgw/vibe-check').then((mod) => mod.VibeCheck),
  { ssr: false },
)

// On wide screens the landing reserves a right gutter for the expanded panel;
// below that breakpoint (1100px, matching global.css) there is no gutter, so an
// expanded panel would cover the page. Mount COLLAPSED there — still live, just a
// pill until tapped. Resolve the breakpoint on the client before first render so
// the widget mounts once in the right state (no expand→collapse flash; the fixed
// pill never shifts layout, so this stays CLS-clean).
export const VibeWidget = (props: VibeCheckProps) => {
  const [resolved, setResolved] = useState(false)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    setNarrow(window.matchMedia('(max-width: 1099px)').matches)
    setResolved(true)
  }, [])

  if (!resolved) return null
  return <VibeCheck {...props} startCollapsed={narrow || props.startCollapsed} />
}
