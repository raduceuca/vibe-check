import { describe, it, expect } from 'vitest'
import { SEV_HEX } from '../severity.js'
import { ANIMATIONS_CSS } from '../../../theme.js'

// The Liveline <canvas> cannot resolve CSS variables, so severity.ts keeps a
// literal-hex mirror (SEV_HEX) of theme.ts's --wcgw-sev-* tokens. This guard
// fails if the two ever drift again (the original bug: light warning was
// #b45309 in SEV_HEX but #a16207 in the token).

describe('SEV_HEX ↔ theme token sync', () => {
  // Pull the per-theme --wcgw-sev-* values straight out of the injected CSS.
  const parseSevBlock = (theme: 'dark' | 'light'): Record<string, string> => {
    // Isolate just this theme's rule body (up to its closing brace) so the other
    // theme's --wcgw-sev-* values can't leak into the match.
    const after = ANIMATIONS_CSS.split(`[data-wcgw-theme="${theme}"]`)[1] ?? ''
    const block = after.split('}')[0] ?? ''
    const out: Record<string, string> = {}
    const re = /--wcgw-sev-(\w+):\s*(#[0-9a-fA-F]{3,8})/g
    let m: RegExpExecArray | null
    while ((m = re.exec(block)) !== null) out[m[1]!] = m[2]!.toLowerCase()
    return out
  }

  for (const theme of ['dark', 'light'] as const) {
    it(`${theme}: every SEV_HEX value matches its --wcgw-sev-* token`, () => {
      const tokens = parseSevBlock(theme)
      for (const [key, hex] of Object.entries(SEV_HEX[theme])) {
        expect(tokens[key], `--wcgw-sev-${key} (${theme})`).toBe(hex.toLowerCase())
      }
    })
  }
})
