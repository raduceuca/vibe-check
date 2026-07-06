'use client'

import { useEffect } from 'react'

// The live VibeCheck widget is fixed bottom-right. When its panel is expanded it
// covers the right column of centered content, so the landing shifts content left
// and reserves a gutter (see global.css). This reflects the widget's live state
// onto :root[data-vc-widget] = "expanded" | "collapsed" | "off" so the layout can
// react — left while expanded, re-centered once collapsed to a pill or absent.
export const WidgetLayoutSync = () => {
  useEffect(() => {
    const root = document.documentElement

    const read = (): 'off' | 'collapsed' | 'expanded' => {
      const overlay = document.querySelector('[data-testid="vibe-check-overlay"]')
      if (!overlay) return 'off'
      // The collapsed pill renders [data-wcgw-pill]; the expanded panel does not.
      return overlay.querySelector('[data-wcgw-pill]') ? 'collapsed' : 'expanded'
    }

    const update = () => {
      const state = read()
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
