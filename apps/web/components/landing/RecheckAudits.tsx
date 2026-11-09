'use client'

import { useCallback, useState } from 'react'
import { useLiveEngine } from '@/components/live/LiveEngineProvider'
import { LANDING_COPY } from '@/lib/landingCopy'

export const RecheckAudits = () => {
  const { engine } = useLiveEngine()
  const [busy, setBusy] = useState(false)

  const recheck = useCallback(() => {
    if (!engine?.recheck || busy) return
    setBusy(true)
    void Promise.all([engine.recheck('seo'), engine.recheck('aeo')]).finally(() => {
      setBusy(false)
    })
  }, [engine, busy])

  return (
    <button
      type="button"
      className="vc-btn vc-btn-outline"
      onClick={recheck}
      disabled={!engine || busy}
      style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }}
    >
      {busy ? 'Running…' : LANDING_COPY.look.recheck}
    </button>
  )
}
