import { describe, expect, it, vi } from 'vitest'
import { CliError, exitOnFatalError } from '../fatal.js'

const capture = () => {
  const writes: string[] = []
  const exit = vi.fn((_code: number): never => {
    throw new Error('process exited')
  })
  return { writes, exit, target: { stderr: { write: (value: string) => { writes.push(value) } }, exit } }
}

describe('exitOnFatalError', () => {
  it('writes the failure and exits immediately', () => {
    const { writes, exit, target } = capture()

    expect(() => exitOnFatalError(new Error('bridge failed'), target)).toThrow('process exited')
    expect(writes).toEqual(['[vibe-check] Fatal error: bridge failed\n'])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('prints an expected CLI error as plain text with its next step, not as a fatal error', () => {
    const { writes, exit, target } = capture()

    expect(() => exitOnFatalError(
      new CliError('Unknown setup agent: claude.', 'Run "vibe-check-mcp setup --help" to see its options.'),
      target,
    )).toThrow('process exited')
    expect(writes).toEqual([
      '[vibe-check] Unknown setup agent: claude.\nRun "vibe-check-mcp setup --help" to see its options.\n',
    ])
    expect(writes.join('')).not.toContain('Fatal error')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('omits the hint line when a CLI error has none', () => {
    const { writes, target } = capture()

    expect(() => exitOnFatalError(new CliError('Project ID cannot be empty'), target)).toThrow('process exited')
    expect(writes).toEqual(['[vibe-check] Project ID cannot be empty\n'])
  })
})
