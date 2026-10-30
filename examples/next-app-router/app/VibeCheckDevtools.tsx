'use client'

import { PerfToggle } from '@wcgw/vibe-check'

export const VibeCheckDevtools = () => {
  if (process.env.NODE_ENV === 'production') return null

  return (
    <PerfToggle
      vibeCheckProps={{
        beaconUrl: 'http://127.0.0.1:4200',
        projectId: 'next-example',
      }}
    />
  )
}
