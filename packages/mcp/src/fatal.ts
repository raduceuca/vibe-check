interface FatalProcess {
  readonly stderr: {
    readonly write: (value: string) => unknown
  }
  readonly exit: (code: number) => never
}

/**
 * An expected, user-facing CLI failure (bad option, missing file, hub not
 * reachable). Printed as plain text with an optional next step, never as a
 * "Fatal error" or a stack trace.
 */
export class CliError extends Error {
  readonly hint: string | null

  constructor(message: string, hint: string | null = null) {
    super(message)
    this.name = 'CliError'
    this.hint = hint
  }
}

export const exitOnFatalError = (
  error: unknown,
  target: FatalProcess = process,
): never => {
  if (error instanceof CliError) {
    target.stderr.write(`[vibe-check] ${error.message}\n${error.hint ? `${error.hint}\n` : ''}`)
    return target.exit(1)
  }
  const message = error instanceof Error ? error.message : String(error)
  target.stderr.write(`[vibe-check] Fatal error: ${message}\n`)
  return target.exit(1)
}
