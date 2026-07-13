import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { AGENT_CLIENTS, getAgentClientSetup, type AgentClientId } from '@wcgw/vibe-check-protocol'
import { expect, test, type Page } from '@playwright/test'
import { installFixture, type InstalledFixture } from './helpers/installFixture.js'
import { freePort, startProcess, waitForHttp, waitForJson, type ManagedProcess } from './helpers/processes.js'

interface RunningClient {
  readonly client: Client
  close(): Promise<void>
}

interface SetupTransport {
  readonly command: string
  readonly args: readonly string[]
}

interface ToolPayload {
  readonly projectId?: string
  readonly code?: string
  readonly issue?: { readonly detector?: string; readonly evidence?: { readonly nodeCount?: number } }
  readonly suggestion?: string
}

let fixture: InstalledFixture
let hub: ManagedProcess
let appA: ManagedProcess
let appB: ManagedProcess
let hubUrl: string
let appAUrl: string
let appBUrl: string
const processes: ManagedProcess[] = []

const jsonPayload = (result: Awaited<ReturnType<Client['callTool']>>): unknown => {
  const block = result.content[0]
  if (!block || block.type !== 'text') throw new Error('Expected MCP text result')
  return JSON.parse(block.text) as unknown
}

const payload = (result: Awaited<ReturnType<Client['callTool']>>): ToolPayload =>
  jsonPayload(result) as ToolPayload

const getSetupTransport = (client: AgentClientId): SetupTransport => {
  const setup = getAgentClientSetup(client)
  if (setup.format === 'command') {
    const bridge = setup.value.split(' -- ')[1]
    if (!bridge) throw new Error(`${setup.label} setup does not contain a stdio bridge`)
    const [command, ...args] = bridge.trim().split(/\s+/)
    if (!command) throw new Error(`${setup.label} setup has no bridge command`)
    return { command, args }
  }

  const entries = JSON.parse(setup.value) as Readonly<Record<string, {
    readonly command?: unknown
    readonly args?: unknown
  }>>
  const bridge = entries['vibe-check']
  if (!bridge || typeof bridge.command !== 'string' || !Array.isArray(bridge.args) ||
    !bridge.args.every((arg) => typeof arg === 'string')) {
    throw new Error(`${setup.label} setup does not contain a valid vibe-check stdio bridge`)
  }
  return { command: bridge.command, args: bridge.args as readonly string[] }
}

const connectClient = async (name: string, setupClient?: AgentClientId): Promise<RunningClient> => {
  let mode = 'connect'
  if (setupClient) {
    const transport = getSetupTransport(setupClient)
    const packageIndex = transport.args.indexOf('@wcgw/vibe-check-mcp')
    mode = transport.args[packageIndex + 1] ?? ''
    if (transport.command !== 'npx' || packageIndex < 0 || mode !== 'connect') {
      throw new Error(`${setupClient} setup does not describe the VibeCheck npx connect bridge`)
    }
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fixture.hubBin, mode],
    env: { PATH: process.env.PATH ?? '', VIBE_CHECK_HUB_URL: hubUrl },
    stderr: 'pipe',
  })
  const client = new Client({ name, version: '1.0.0' })
  await client.connect(transport)
  return { client, close: () => client.close() }
}

const openAgentIssue = async (page: Page, url: string): Promise<void> => {
  await page.goto(url)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('tab', { name: /Agent|Fix/ }).click()
  const issue = page.getByRole('button', { name: /Too many elements|DOM Bloat/ })
  await expect(issue).toBeVisible({ timeout: 20_000 })
  await issue.click()
}

const watch = (client: Client, projectId: string) => client.callTool({
  name: 'watch_for_issue',
  arguments: { project_id: projectId, timeout_seconds: 30 },
})

test.beforeAll(async () => {
  fixture = await installFixture()
  const [hubPort, appAPort, appBPort] = await Promise.all([freePort(), freePort(), freePort()])
  hubUrl = `http://127.0.0.1:${hubPort}`
  appAUrl = `http://127.0.0.1:${appAPort}`
  appBUrl = `http://127.0.0.1:${appBPort}`
  const logs = join(fixture.root, 'logs')

  hub = await startProcess('hub', process.execPath, [fixture.hubBin, 'hub'], fixture.appA, { VIBE_CHECK_PORT: String(hubPort) }, logs)
  processes.push(hub)
  await waitForJson(`${hubUrl}/api/health`, (value) => (value as { service?: string }).service === 'vibe-check-hub')

  const viteA = join(fixture.appA, 'node_modules/vite/bin/vite.js')
  const viteB = join(fixture.appB, 'node_modules/vite/bin/vite.js')
  appA = await startProcess('app-a', process.execPath, [viteA, '--host', '127.0.0.1', '--port', String(appAPort)], fixture.appA, { VITE_HUB_URL: hubUrl }, logs)
  appB = await startProcess('app-b', process.execPath, [viteB, '--host', '127.0.0.1', '--port', String(appBPort)], fixture.appB, { VITE_HUB_URL: hubUrl }, logs)
  processes.push(appA, appB)
  await Promise.all([waitForHttp(appAUrl), waitForHttp(appBUrl)])
})

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  for (const process of processes) {
    await testInfo.attach(process.logPath.split('/').at(-1) ?? 'process.log', {
      body: await readFile(process.logPath),
      contentType: 'text/plain',
    })
  }
})

test.afterAll(async () => {
  await Promise.all(processes.reverse().map((process) => process.stop()))
  await fixture?.cleanup()
})

test('packed widget dispatches a real DOM issue to its watching agent', async ({ page }) => {
  const agent = await connectClient('single-agent')
  try {
    await openAgentIssue(page, appAUrl)
    const connection = page.getByTestId('vibe-check-agent-status')
    await expect(connection).toContainText('Waiting for')
    await expect(connection).toContainText(appAUrl)
    await expect(connection).toContainText(/codex mcp add vibe-check/)
    await expect(connection).toContainText(`project_id "${appAUrl}"`)
    await expect(page.getByRole('button', { name: /copy codex setup/i })).toBeVisible()
    const receivedPromise = watch(agent.client, appAUrl)
    await expect(page.getByTestId('vibe-check-agent-status')).toContainText(/Agent connected|AI agent connected/, { timeout: 10_000 })
    await page.getByTestId(/vibe-check-send-/).click()

    const received = payload(await receivedPromise)
    expect(received.projectId).toBe(appAUrl)
    expect(received.issue?.detector).toBe('dom-bloat')
    expect(received.issue?.evidence?.nodeCount).toBeGreaterThanOrEqual(1_500)
    expect(received.suggestion).toContain('DOM Bloat')
    await expect(page.getByRole('tab', { name: /sent \(1\)/i })).toBeVisible()
  } finally {
    await agent.close()
  }
})

test('every documented client setup reaches list_projects through the packed bridge', async () => {
  for (const clientId of AGENT_CLIENTS) {
    const agent = await connectClient(`compatibility-${clientId}`, clientId)
    try {
      const projects = jsonPayload(await agent.client.callTool({ name: 'list_projects', arguments: {} }))
      expect(Array.isArray(projects)).toBe(true)
    } finally {
      await agent.close()
    }
  }
})

test('isolates two projects, rejects a second watcher, and permits handoff', async ({ browser }) => {
  const pageA = await browser.newPage()
  const pageB = await browser.newPage()
  const agentA = await connectClient('agent-a')
  const agentB = await connectClient('agent-b')
  const agentC = await connectClient('agent-c')
  try {
    await Promise.all([openAgentIssue(pageA, appAUrl), openAgentIssue(pageB, appBUrl)])
    const receiveA = watch(agentA.client, appAUrl)
    const receiveB = watch(agentB.client, appBUrl)
    await Promise.all([
      expect(pageA.getByTestId('vibe-check-agent-status')).toContainText(/Agent connected|AI agent connected/, { timeout: 10_000 }),
      expect(pageB.getByTestId('vibe-check-agent-status')).toContainText(/Agent connected|AI agent connected/, { timeout: 10_000 }),
    ])

    const conflict = payload(await watch(agentC.client, appAUrl))
    expect(conflict.code).toBe('lease-conflict')
    await expect(pageA.getByText(/second agent was rejected/i)).toBeVisible({ timeout: 10_000 })
    await expect(pageB.getByText(/second agent was rejected/i)).toHaveCount(0)

    await Promise.all([pageA.getByTestId(/vibe-check-send-/).click(), pageB.getByTestId(/vibe-check-send-/).click()])
    const [issueA, issueB] = await Promise.all([receiveA, receiveB]).then((results) => results.map(payload))
    expect(issueA.projectId).toBe(appAUrl)
    expect(issueB.projectId).toBe(appBUrl)

    await agentA.close()
    await pageA.evaluate(() => localStorage.clear())
    await pageA.reload()
    await pageA.getByRole('tab', { name: /Agent|Fix/ }).click()
    await pageA.getByRole('button', { name: /Too many elements|DOM Bloat/ }).click()
    const handedOff = watch(agentC.client, appAUrl)
    await expect(pageA.getByTestId('vibe-check-agent-status')).toContainText(/Agent connected|AI agent connected/, { timeout: 10_000 })
    await pageA.getByTestId(/vibe-check-send-/).click()
    expect(payload(await handedOff).projectId).toBe(appAUrl)
  } finally {
    await Promise.allSettled([agentA.close(), agentB.close(), agentC.close(), pageA.close(), pageB.close()])
  }
})
