'use client'

import { PerfToggle } from '@wcgw/vibe-check'

export const VibeCheckDevtools = () => {
  if (!import.meta.env.DEV) return null

  return (
    <PerfToggle
      vibeCheckProps={{
        beaconUrl: 'http://127.0.0.1:4200',
        projectId: 'tidewell',
      }}
    />
  )
}
