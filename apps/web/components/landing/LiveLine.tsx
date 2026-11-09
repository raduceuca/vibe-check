'use client'

import { useLiveSnapshot } from '@/components/live/useLiveSnapshot'
import { LANDING_COPY } from '@/lib/landingCopy'

export const LiveLine = () => {
  const snapshot = useLiveSnapshot()
  const fps = snapshot ? Math.round(snapshot.frameRate.fps) : null
  const problems = snapshot ? snapshot.issues.length : null

  return (
    <p
      className="vc-live-line"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 18,
        fontSize: 15,
        color: 'var(--vc-ink-2)',
      }}
    >
      <span
        aria-hidden
        className="vc-live-ring"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: '1.5px solid var(--vc-ink)',
          flex: 'none',
          animation: 'vc-breathe 2s ease-in-out infinite',
        }}
      />
      <span>
        {LANDING_COPY.hero.liveLineSsr}
        {fps != null && problems != null ? (
          <>
            {' · '}
            <span className="vc-mono" style={{ display: 'inline-block', minWidth: '5ch' }}>
              {fps}
            </span>
            {' fps · '}
            <span className="vc-mono" style={{ display: 'inline-block', minWidth: '2ch' }}>
              {problems}
            </span>
            {problems === 1 ? ' problem' : ' problems'}
          </>
        ) : null}
      </span>
    </p>
  )
}
