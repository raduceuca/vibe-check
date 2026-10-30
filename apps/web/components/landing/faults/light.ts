import type { Fault } from './types'
import { afterNextPaint } from './types'

let leakTimer: number | null = null
let leakChunks: number[][] = []
let leakStartedAt = 0

const stopLeak = (): void => {
  if (leakTimer != null) {
    window.clearInterval(leakTimer)
    leakTimer = null
  }
  leakChunks = []
}

export const renderReviewsFault: Fault = {
  id: 'render-reviews',
  vibe: 'light',
  label: 'Render every review',
  effect: 'Puts 1,800 review rows into the list below.',
  panelShows: 'Too many elements on the page',
  expects: [{ detector: 'dom-bloat' }],
  recheckMs: 5500,
  available: () => null,
  run: (ctx) => {
    afterNextPaint(() => {
      if (!ctx.reviews) return
      ctx.reviews.replaceChildren()
      const frag = document.createDocumentFragment()
      for (let i = 1; i <= 1800; i += 1) {
        const row = document.createElement('p')
        row.textContent = `Review ${i}: The glaze is lovely.`
        row.style.margin = '0'
        frag.appendChild(row)
      }
      ctx.reviews.appendChild(frag)
    })
  },
  undo: (ctx) => {
    ctx.reviews?.replaceChildren()
  },
}

export const cameraPhotoFault: Fault = {
  id: 'camera-photo',
  vibe: 'light',
  label: 'Use the camera photo',
  effect: 'Loads a 4032 × 3024 photo into a 320 px box. Downloads about 2.4 MB.',
  panelShows: 'IMG_4032.jpg needs optimization',
  expects: [{ detector: 'large-images' }, { detector: 'unoptimized-images' }],
  recheckMs: 3000,
  available: () => {
    try {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      if (conn?.saveData) return 'Off because your browser asked to save data.'
    } catch {
      // ignore
    }
    return 'Photo asset ships with Tidewell media — not on this build yet.'
  },
  run: (ctx) => {
    afterNextPaint(() => {
      if (!ctx.photo) return
      ctx.photo.replaceChildren()
      const img = document.createElement('img')
      img.src = `/vibe-check/faults/IMG_4032.jpg?r=${Date.now()}`
      img.alt = 'A camera photo, far too large for its box'
      ctx.photo.appendChild(img)
    })
  },
  undo: (ctx) => {
    ctx.photo?.replaceChildren()
  },
}

export const fetchTwiceFault: Fault = {
  id: 'fetch-twice',
  vibe: 'light',
  label: 'Fetch it twice',
  effect: 'Requests the same tiny URL eight times in a burst.',
  panelShows: 'Same data fetched multiple times',
  expects: [{ detector: 'duplicate-requests' }],
  recheckMs: 2500,
  available: () => null,
  run: () => {
    afterNextPaint(() => {
      for (let i = 0; i < 8; i += 1) {
        void fetch('/vibe-check/duplicate-probe', { cache: 'no-store' }).catch(() => undefined)
      }
    })
  },
  undo: () => undefined,
}

export const leakMemoryFault: Fault = {
  id: 'leak-memory',
  vibe: 'light',
  label: 'Leak memory',
  effect:
    'Holds on to a growing array for 30 seconds, then stops growing. VibeCheck wants 30 seconds of evidence before it says anything.',
  panelShows: 'Memory keeps growing',
  expects: [{ detector: 'memory-leak' }],
  recheckMs: 32000,
  available: () => {
    const perf = performance as Performance & { memory?: unknown }
    return perf.memory
      ? null
      : "Needs Chrome or Edge. This browser doesn't share heap size."
  },
  run: (ctx) => {
    stopLeak()
    leakStartedAt = performance.now()
    afterNextPaint(() => {
      leakTimer = window.setInterval(() => {
        leakChunks.push(new Array<number>(60_000).fill(1))
        const elapsed = (performance.now() - leakStartedAt) / 1000
        const retainedMb = leakChunks.length * 60_000 * 8 / (1024 * 1024)
        ctx.setStatus(`Collecting evidence ${Math.min(30, Math.floor(elapsed))} / 30 s`)
        if (elapsed >= 30 || retainedMb >= 64) {
          stopLeak()
          ctx.setStatus('Leak held. Waiting for the detector.')
        }
      }, 250)
    })
  },
  undo: () => {
    stopLeak()
  },
}
