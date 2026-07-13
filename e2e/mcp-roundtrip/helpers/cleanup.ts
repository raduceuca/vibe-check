import { rm } from 'node:fs/promises'

interface Closeable {
  close(): Promise<unknown>
}

interface Stoppable {
  stop(): Promise<unknown>
}

interface FixtureCleanup {
  cleanup(): Promise<unknown>
}

export interface RecordingCleanupOptions {
  readonly context?: Closeable
  readonly client?: Closeable
  readonly browser?: Closeable
  readonly processes: readonly Stoppable[]
  readonly fixture?: FixtureCleanup
  readonly recordingRoot: string
  readonly removeRecording?: (path: string) => Promise<unknown>
}

export const cleanupRecording = async ({
  context,
  client,
  browser,
  processes,
  fixture,
  recordingRoot,
  removeRecording = (path) => rm(path, { recursive: true, force: true }),
}: RecordingCleanupOptions): Promise<void> => {
  await Promise.allSettled([
    context?.close() ?? Promise.resolve(),
    client?.close() ?? Promise.resolve(),
  ])
  await Promise.allSettled([
    browser?.close() ?? Promise.resolve(),
    ...[...processes].reverse().map((process) => process.stop()),
  ])
  await Promise.allSettled([
    fixture?.cleanup() ?? Promise.resolve(),
    removeRecording(recordingRoot),
  ])
}
