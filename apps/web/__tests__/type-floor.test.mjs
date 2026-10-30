import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

/**
 * Starting 14 px floor guard (site-spec §10.2 / §5.3).
 *
 * Bans common sub-14 px literals in `app/global.css`. Lines tagged
 * `/* vc-allow-small: non-text *\/` are exempt (decorative / non-text).
 */

const ALLOW_SMALL = /\/\*\s*vc-allow-small:\s*non-text\s*\*\//
const BANNED_SIZE = /font-size\s*:\s*(?:1[0-3](?:\.\d+)?px|11\.5px)\b/i

const readGlobalCss = () =>
  readFile(new URL('../app/global.css', import.meta.url), 'utf8')

describe('type floor (14 px)', () => {
  it('bans font-size under 14px in global.css unless allow-tagged', async () => {
    const css = await readGlobalCss()
    const violations = css
      .split('\n')
      .map((line, index) => ({ line, n: index + 1 }))
      .filter(({ line }) => BANNED_SIZE.test(line) && !ALLOW_SMALL.test(line))

    assert.deepEqual(
      violations,
      [],
      violations.map(({ n, line }) => `L${n}: ${line.trim()}`).join('\n'),
    )
  })
})
