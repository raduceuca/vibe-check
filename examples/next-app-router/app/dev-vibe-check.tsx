'use client'

import dynamic from 'next/dynamic'

export const DevVibeCheck = dynamic(
  () => import('./VibeCheckDevtools').then((m) => m.VibeCheckDevtools),
  { ssr: false },
)
