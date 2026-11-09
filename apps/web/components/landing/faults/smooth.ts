import type { Fault, FaultContext } from './types'
import { afterNextPaint } from './types'

const bannerTimers: number[] = []

const clearBanners = (ctx: FaultContext): void => {
  for (const id of bannerTimers.splice(0)) window.clearTimeout(id)
  if (ctx.bannerSlot) ctx.bannerSlot.replaceChildren()
}

export const layoutJumpFault: Fault = {
  id: 'layout-jump',
  vibe: 'smooth',
  label: 'Make the layout jump',
  effect: 'Three late banners push this section down, with no space reserved.',
  panelShows: 'Page layout keeps recalculating',
  expects: [{ detector: 'layout-thrashing' }],
  recheckMs: 1500,
  available: () => null,
  run: (ctx) => {
    clearBanners(ctx)
    afterNextPaint(() => {
      ;[700, 850, 1000].forEach((delay, index) => {
        const id = window.setTimeout(() => {
          if (!ctx.bannerSlot) return
          const banner = document.createElement('div')
          banner.textContent = `Late banner ${index + 1} of 3`
          banner.style.cssText =
            'height:56px;display:flex;align-items:center;padding:0 14px;background:var(--vc-panel-2,#ededef);color:var(--vc-ink);font-size:14px;font-weight:500;'
          ctx.bannerSlot.appendChild(banner)
        }, delay)
        bannerTimers.push(id)
      })
    })
  },
  undo: clearBanners,
}

const hasLoAF = (): boolean => {
  try {
    return PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame') === true
  } catch {
    return false
  }
}

let freezeScript: HTMLScriptElement | null = null

export const freezeMainFault: Fault = {
  id: 'freeze-main',
  vibe: 'smooth',
  label: 'Freeze the main thread',
  effect: 'Runs five 120 ms tasks from a separate script.',
  panelShows: 'Something is freezing the page',
  expects: [{ detector: 'long-task-attribution' }],
  recheckMs: 2500,
  available: () => (hasLoAF() ? null : 'Needs Chrome or Edge.'),
  run: (ctx) => {
    afterNextPaint(() => {
      freezeScript?.remove()
      const script = document.createElement('script')
      script.src = `/vibe-check/fault-block.js?r=${Date.now()}`
      document.body.appendChild(script)
      freezeScript = script
      ctx.setStatus('Main-thread freeze script loaded.')
    })
  },
  undo: () => {
    freezeScript?.remove()
    freezeScript = null
  },
}
