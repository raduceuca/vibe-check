'use client'

import dynamic from 'next/dynamic'
import type { VibeCheckProps } from '@wcgw/vibe-check'

// The real widget mounted live on the marketing page. It reads browser-only
// APIs (PerformanceObserver, performance.memory, console/fetch patches), so we
// load it client-side only — no SSR pass, no window guards needed downstream.
const VibeCheck = dynamic(
  () => import('@wcgw/vibe-check').then((mod) => mod.VibeCheck),
  { ssr: false },
)

export const VibeWidget = (props: VibeCheckProps) => <VibeCheck {...props} />
