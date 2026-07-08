'use client'

import { useEffect } from 'react'

// The live VibeCheck widget is fixed bottom-right. When its panel is expanded it
// covers the right column of centered content, so the landing reserves a right
// gutter for it (see global.css) — which is ALSO the SSR/first-paint default,
// matching the widget's expanded-on-mount state (startCollapsed=false), so the
// column never reflows as the widget hydrates. We reflect the widget's live state
// onto :root[data-vc-widget] = "collapsed" | "expanded" so the layout can
// re-center once the USER collapses it to a pill.
//
// Critical for CLS: we do NOT write any state before the widget is in the DOM.
// The old code emitted "off" pre-mount, which dropped the gutter, then the widget
// re-added it on mount — two un-prompted horizontal reflows of <main> (measured
// CLS ≈ 0.32). Leaving the attribute unset holds the first-paint default; the
// only later change is a user-initiated collapse, which CLS excludes.
export const WidgetLayoutSync = () => {
  useEffect(() => {
    const root = document.documentElement

    // null → widget not mounted yet; leave the first-paint default untouched
    // (no gutter flip, so no layout shift as the widget hydrates in).
    const read = (): 'collapsed' | 'expanded' | null => {
      const overlay = document.querySelector('[data-testid="vibe-check-overlay"]')
      if (!overlay) return null
      // The collapsed pill renders [data-wcgw-pill]; the expanded panel does not.
      return overlay.querySelector('[data-wcgw-pill]') ? 'collapsed' : 'expanded'
    }

    const update = () => {
      const state = read()
      if (state === null) return
      if (root.dataset.vcWidget !== state) root.dataset.vcWidget = state
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'data-wcgw-pill', 'data-testid'],
    })

    return () => {
      observer.disconnect()
      delete root.dataset.vcWidget
    }
  }, [])

  return null
}
