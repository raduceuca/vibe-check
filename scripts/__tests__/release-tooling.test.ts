import { describe, expect, it } from 'vitest'

describe('release tooling test harness', () => {
  it('runs tooling tests in a Node environment', () => {
    expect(typeof process.versions.node).toBe('string')
  })
})
