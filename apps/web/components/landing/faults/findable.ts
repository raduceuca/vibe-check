import type { Fault } from './types'
import { afterNextPaint } from './types'

let savedTitle: string | null = null
let savedMeta: HTMLMetaElement | null = null

export const placeholderTitleFault: Fault = {
  id: 'placeholder-title',
  vibe: 'findable',
  label: 'Give this tab a placeholder title',
  effect:
    'Renames this tab to "Vite + React" and removes the meta description, then audits again. Look at your browser tab.',
  panelShows: 'Your page still has a placeholder title',
  expects: [
    { detector: 'seo', check: 'title-default' },
    { detector: 'seo', check: 'meta-description-missing' },
  ],
  recheckMs: 2000,
  available: () => null,
  run: (ctx) => {
    afterNextPaint(() => {
      savedTitle = document.title
      const meta = document.querySelector('meta[name="description"]')
      if (meta instanceof HTMLMetaElement) {
        savedMeta = meta
        meta.remove()
      }
      document.title = 'Vite + React'
      void ctx.engine?.recheck?.('seo')
    })
  },
  undo: (ctx) => {
    if (savedTitle != null) document.title = savedTitle
    savedTitle = null
    if (savedMeta) {
      document.head.appendChild(savedMeta)
      savedMeta = null
    }
    void ctx.engine?.recheck?.('seo')
  },
}
