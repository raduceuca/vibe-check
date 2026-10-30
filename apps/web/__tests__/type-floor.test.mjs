import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

// site-spec §10.2 / §5.3: readable copy is at least 14 px. This catches the
// common sub-14 px declarations that used to live in the landing CSS.

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/global.css'),
  'utf8',
)

describe('type floor', () => {
  it('keeps readable font-size declarations at 14px or above in global.css', () => {
    const banned = [...css.matchAll(/font-size:\s*((?:1[0-3](?:\.\d+)?)|(?:[0-9](?:\.\d+)?))px/g)]
      .map((match) => match[0])
      // Allow non-text chrome that is not readable copy (1px rules are not font-size).
      .filter((decl) => !decl.includes('font-size: 0px'))

    assert.deepEqual(
      banned,
      [],
      `sub-14px font-size still present:\n${banned.slice(0, 20).join('\n')}`,
    )
  })
})
