interface FatalProcess {
  readonly stderr: {
    readonly write: (value: string) => unknown
  }
  readonly exit: (code: number) => never
}

export const exitOnFatalError = (
  error: unknown,
  target: FatalProcess = process,
): never => {
  const message = error instanceof Error ? error.message : String(error)
  target.stderr.write(`[vibe-check] Fatal error: ${message}\n`)
  return target.exit(1)
}
