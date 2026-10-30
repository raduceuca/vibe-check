import type { Fault } from './types'
import { afterNextPaint } from './types'

const consoleTimers: number[] = []

export const floodConsoleFault: Fault = {
  id: 'flood-console',
  vibe: 'clean',
  label: 'Flood the console',
  effect: 'Logs 30 errors over seven seconds.',
  panelShows: 'Too many console messages',
  expects: [{ detector: 'console-spam' }],
  recheckMs: 10500,
  available: () => null,
  run: () => {
    for (const id of consoleTimers.splice(0)) window.clearTimeout(id)
    afterNextPaint(() => {
      for (let i = 1; i <= 30; i += 1) {
        const id = window.setTimeout(() => {
          console.error(`VibeCheck demo: deliberate error ${i} of 30`)
        }, i * 240)
        consoleTimers.push(id)
      }
    })
  },
  undo: () => {
    for (const id of consoleTimers.splice(0)) window.clearTimeout(id)
  },
}
