import type { Fault } from './types'
import { afterNextPaint } from './types'

const detached: { node: HTMLScriptElement; parent: Node; next: ChildNode | null }[] = []

export const hideJsonLdFault: Fault = {
  id: 'hide-jsonld',
  vibe: 'quotable',
  label: 'Hide the structured data',
  effect: "Removes this page's JSON-LD, then audits again.",
  panelShows: 'AI tools have to guess what your page is about',
  expects: [{ detector: 'aeo', check: 'structured-data-missing' }],
  recheckMs: 2000,
  available: () => null,
  run: (ctx) => {
    afterNextPaint(() => {
      detached.length = 0
      document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
        if (!(node instanceof HTMLScriptElement) || !node.parentNode) return
        detached.push({ node, parent: node.parentNode, next: node.nextSibling })
        node.remove()
      })
      void ctx.engine?.recheck?.('aeo')
    })
  },
  undo: (ctx) => {
    for (const entry of detached.splice(0).reverse()) {
      entry.parent.insertBefore(entry.node, entry.next)
    }
    void ctx.engine?.recheck?.('aeo')
  },
}
