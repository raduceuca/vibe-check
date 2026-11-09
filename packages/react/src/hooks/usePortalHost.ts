import { useEffect, useLayoutEffect, useState } from 'react'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// The element the widget portals into: one `display: contents` container per
// mounted widget, appended to document.body after mount.
//
// - position: fixed stays relative to the viewport even when a host ancestor
//   has transform, filter or will-change (common in page-transition wrappers).
// - The server render and the hydration pass both see `null` and render
//   nothing, so stored preferences, persisted issues and canvas support can
//   never make the first client render differ from the server HTML.
// - The container carries data-wcgw, so everything the widget renders sits
//   under a [data-wcgw] element and is left out of the page's DOM-size count.
export const usePortalHost = (enabled: boolean): HTMLElement | null => {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined' || !document.body) return
    const element = document.createElement('div')
    element.setAttribute('data-wcgw', '')
    element.setAttribute('data-wcgw-portal', '')
    element.style.display = 'contents'
    document.body.appendChild(element)
    setHost(element)
    return () => {
      element.remove()
      setHost(null)
    }
  }, [enabled])

  return host
}
