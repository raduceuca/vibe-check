import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { chromium, type Browser, type BrowserContext } from '@playwright/test'
import { cleanupRecording } from './helpers/cleanup.js'
import { installFixture, type InstalledFixture } from './helpers/installFixture.js'
import { freePort, startProcess, waitForHttp, waitForJson, type ManagedProcess } from './helpers/processes.js'

const execFileAsync = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const outputDir = join(repoRoot, 'apps/web/public/demo')
const gifPath = join(outputDir, 'vibe-check-agent-roundtrip.gif')
const posterPath = join(outputDir, 'vibe-check-agent-roundtrip-poster.png')

interface ReceivedPayload {
  readonly projectId?: string
  readonly issue?: {
    readonly detector?: string
    readonly evidence?: { readonly nodeCount?: number }
  }
}

const readPayload = (result: Awaited<ReturnType<Client['callTool']>>): ReceivedPayload => {
  if (!Array.isArray(result.content)) throw new Error('Expected MCP content array')
  const block: unknown = result.content[0]
  if (typeof block !== 'object' || block === null) throw new Error('Expected MCP text result')
  const value = block as { readonly type?: unknown; readonly text?: unknown }
  if (value.type !== 'text' || typeof value.text !== 'string') {
    throw new Error('Expected MCP text result')
  }
  return JSON.parse(value.text) as ReceivedPayload
}

const formatSize = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`

const run = async (): Promise<void> => {
  let fixture: InstalledFixture | undefined
  let browser: Browser | undefined
  let context: BrowserContext | undefined
  let client: Client | undefined
  const processes: ManagedProcess[] = []
  const recordingRoot = await mkdtemp(join(tmpdir(), 'vibe-check-recording-'))

  try {
    process.stdout.write('Packing and installing the real workspace packages…\n')
    fixture = await installFixture()
    const [hubPort, appPort] = await Promise.all([freePort(), freePort()])
    const hubUrl = `http://127.0.0.1:${hubPort}`
    const appUrl = `http://127.0.0.1:${appPort}`
    const logs = join(recordingRoot, 'logs')

    const hub = await startProcess(
      'hub',
      process.execPath,
      [fixture.hubBin, 'hub'],
      fixture.appA,
      { VIBE_CHECK_PORT: String(hubPort) },
      logs,
    )
    processes.push(hub)
    await waitForJson(`${hubUrl}/api/health`, (value) =>
      (value as { readonly service?: string }).service === 'vibe-check-hub')

    const vite = join(fixture.appA, 'node_modules/vite/bin/vite.js')
    const app = await startProcess(
      'app',
      process.execPath,
      [vite, '--host', '127.0.0.1', '--port', String(appPort)],
      fixture.appA,
      { VITE_HUB_URL: hubUrl },
      logs,
    )
    processes.push(app)
    await waitForHttp(appUrl)

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fixture.hubBin, 'connect'],
      env: { PATH: process.env.PATH ?? '', VIBE_CHECK_HUB_URL: hubUrl },
      stderr: 'pipe',
    })
    client = new Client({ name: 'vibe-check-demo-recorder', version: '1.0.0' })
    await client.connect(transport)

    browser = await chromium.launch()
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      colorScheme: 'dark',
      recordVideo: { dir: join(recordingRoot, 'video'), size: { width: 1280, height: 720 } },
    })
    const page = await context.newPage()
    const video = page.video()
    await page.goto(`${appUrl}?recording=1`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByTestId('vibe-check-demo-shell').waitFor({ state: 'visible' })
    await page.waitForTimeout(1_100)

    await page.getByRole('tab', { name: /Agent|Fix/ }).click()
    const issue = page.getByRole('button', { name: /Too many elements|DOM Bloat/ })
    await issue.waitFor({ state: 'visible', timeout: 20_000 })
    await issue.click()
    await page.waitForTimeout(1_100)

    const receivedPromise = client.callTool({
      name: 'watch_for_issue',
      arguments: { project_id: appUrl, timeout_seconds: 30 },
    })
    await page.getByTestId('vibe-check-agent-status').getByText(
      /Agent connected|AI agent connected/,
    ).waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(1_300)

    await page.getByTestId(/vibe-check-send-/).click()
    const received = readPayload(await receivedPromise)
    if (received.projectId !== appUrl || received.issue?.detector !== 'dom-bloat') {
      throw new Error(`Unexpected MCP receipt: ${JSON.stringify(received)}`)
    }
    await page.waitForTimeout(700)
    await page.evaluate((detail) => {
      window.dispatchEvent(new CustomEvent('vibe-check-demo-agent-received', { detail }))
    }, {
      projectId: received.projectId,
      detector: received.issue.detector,
      nodeCount: received.issue.evidence?.nodeCount ?? 0,
    })
    await page.getByTestId('vibe-check-demo-receipt').getByText('Received by agent').waitFor()
    await page.waitForTimeout(2_600)

    await page.close()
    await context.close()
    context = undefined
    const videoPath = await video?.path()
    if (!videoPath) throw new Error('Playwright did not produce a recording')

    await mkdir(outputDir, { recursive: true })
    process.stdout.write('Rendering optimized GIF and poster…\n')
    await execFileAsync('ffmpeg', [
      '-y', '-i', videoPath,
      '-vf', 'fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
      '-loop', '0', gifPath,
    ])
    await execFileAsync('ffmpeg', [
      '-y', '-sseof', '-0.2', '-i', videoPath,
      '-frames:v', '1', '-vf', 'scale=1280:-1:flags=lanczos', posterPath,
    ])

    const [gif, poster] = await Promise.all([stat(gifPath), stat(posterPath)])
    process.stdout.write(`Recorded ${gifPath} (${formatSize(gif.size)})\n`)
    process.stdout.write(`Captured ${posterPath} (${formatSize(poster.size)})\n`)
  } finally {
    await cleanupRecording({ context, client, browser, processes, fixture, recordingRoot })
  }
}

await run()
