import { createServer } from 'node:net'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

export interface ManagedProcess {
  readonly child: ChildProcess
  readonly logPath: string
  stop(): Promise<void>
}

export const freePort = (): Promise<number> => new Promise((resolve, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') return reject(new Error('No TCP port allocated'))
    const port = address.port
    server.close((error) => error ? reject(error) : resolve(port))
  })
})

export const startProcess = async (
  name: string,
  command: string,
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>>,
  logDir: string,
): Promise<ManagedProcess> => {
  await mkdir(logDir, { recursive: true })
  const logPath = join(logDir, `${name}.log`)
  await writeFile(logPath, '')
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const append = async (chunk: Buffer) => writeFile(logPath, chunk, { flag: 'a' })
  child.stdout?.on('data', (chunk: Buffer) => { void append(chunk) })
  child.stderr?.on('data', (chunk: Buffer) => { void append(chunk) })

  return {
    child,
    logPath,
    stop: () => new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve()
      const kill = setTimeout(() => child.kill('SIGKILL'), 5_000)
      child.once('exit', () => { clearTimeout(kill); resolve() })
      child.kill('SIGTERM')
    }),
  }
}

export const waitForJson = async (url: string, check: (value: unknown) => boolean): Promise<void> => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      const value: unknown = await response.json()
      if (response.ok && check(value)) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

export const waitForHttp = async (url: string): Promise<void> => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}`)
}
