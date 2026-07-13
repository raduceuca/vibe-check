import { describe, expect, it, vi } from 'vitest'
import { exitOnFatalError } from '../fatal.js'

describe('exitOnFatalError', () => {
  it('writes the failure and exits immediately', () => {
    const writes: string[] = []
    const exit = vi.fn((_code: number): never => {
      throw new Error('process exited')
    })

    expect(() => exitOnFatalError(new Error('bridge failed'), {
      stderr: { write: (value) => { writes.push(value) } },
      exit,
    })).toThrow('process exited')
    expect(writes).toEqual(['[vibe-check] Fatal error: bridge failed\n'])
    expect(exit).toHaveBeenCalledWith(1)
  })
})
