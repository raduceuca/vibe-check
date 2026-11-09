'use client'

import { useEffect, useRef, useState } from 'react'
import chapters from '@/lib/recording/roundtrip-chapters.json'

interface Chapter {
  readonly id: string
  readonly label: string
  readonly t: number
}

const CHAPTERS = chapters as readonly Chapter[]

const MEDIA = {
  mp4: '/demo/run.mp4',
  webm: '/demo/run.webm',
  poster: '/demo/run-poster.webp',
} as const

const canAutoplay = (): boolean => {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(max-width: 767px)').matches) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return false
  } catch {
    // ignore
  }
  return true
}

export const RunRecording = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasMedia, setHasMedia] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(MEDIA.poster, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) setHasMedia(res.ok)
      })
      .catch(() => {
        if (!cancelled) setHasMedia(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasMedia) return

    const onPlay = () => { setPlaying(true); setEnded(false) }
    const onPause = () => setPlaying(false)
    const onEnded = () => { setPlaying(false); setEnded(true) }
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!canAutoplay()) return
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          void video.play().catch(() => undefined)
        } else {
          video.pause()
        }
      },
      { threshold: [0, 0.5, 1] },
    )
    io.observe(video)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      io.disconnect()
    }
  }, [hasMedia])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => undefined)
    else video.pause()
  }

  const replay = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    void video.play().catch(() => undefined)
  }

  const seek = (t: number) => {
    const video = videoRef.current
    if (!video || t <= 0) return
    video.currentTime = t
    void video.play().catch(() => undefined)
  }

  return (
    <div className="vc-recording">
      {hasMedia ? (
        <video
          ref={videoRef}
          muted
          playsInline
          preload="none"
          width={1280}
          height={720}
          poster={MEDIA.poster}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            background: 'var(--vc-panel)',
            borderRadius: 12,
          }}
        >
          <source src={MEDIA.webm} type="video/webm" />
          <source src={MEDIA.mp4} type="video/mp4" />
        </video>
      ) : (
        <div
          style={{
            aspectRatio: '16 / 9',
            borderRadius: 12,
            border: '1px solid var(--vc-line)',
            background: 'var(--vc-panel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            color: 'var(--vc-ink-3)',
            fontSize: 15,
            lineHeight: 1.5,
          }}
        >
          Recording lands here after the e2e capture writes{' '}
          <span className="vc-mono">run.mp4</span> /{' '}
          <span className="vc-mono">run.webm</span>.
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          className="vc-btn vc-btn-outline"
          disabled={!hasMedia}
          onClick={ended ? replay : toggle}
          style={{ width: 'auto', minHeight: 40, padding: '0 14px', fontSize: 14 }}
        >
          {!hasMedia ? 'Play recording' : ended ? 'Replay' : playing ? 'Pause' : 'Play recording'}
        </button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CHAPTERS.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              className="vc-btn vc-btn-outline"
              disabled={!hasMedia || chapter.t <= 0}
              onClick={() => seek(chapter.t)}
              style={{ width: 'auto', minHeight: 36, padding: '0 10px', fontSize: 13 }}
            >
              {chapter.label}
            </button>
          ))}
        </div>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--vc-ink-3)', lineHeight: 1.45 }}>
        Recorded from the end-to-end test that runs before every release: the real widget and hub,
        installed from the packed npm packages, and a test client calling the same MCP tools Claude
        Code, Codex and Cursor call. The edit in the middle is a one-line toggle standing in for
        your agent&apos;s change. The send and the verification are real.
      </p>
    </div>
  )
}
