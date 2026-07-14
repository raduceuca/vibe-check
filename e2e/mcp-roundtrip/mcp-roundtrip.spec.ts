import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  AGENT_CLIENTS,
  MCP_PACKAGE_SPEC,
  getAgentClientSetup,
  type AgentClientId,
} from '@wcgw/vibe-check-protocol'
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
  readonly issue?: {
    readonly id?: string
    readonly detector?: string
    readonly title?: string
    readonly evidence?: { readonly nodeCount?: number }
  }
  readonly suggestion?: string
}

let fixture: InstalledFixture
let hub: ManagedProcess
let appA: ManagedProcess
let appB: ManagedProcess
let hubUrl: string
let appAUrl: string
let appBUrl: string
let hubPort: number
let logs: string
let hubRestartCount = 0
const processes: ManagedProcess[] = []

const hubEnvironment = (): Readonly<Record<string, string>> => ({
  VIBE_CHECK_PORT: String(hubPort),
  VIBE_CHECK_REGISTRY_PATH: fixture.registryPath,
})

const restartHub = async (): Promise<void> => {
  await hub.stop()
  hubRestartCount += 1
  hub = await startProcess(
    `hub-restarted-${hubRestartCount}`,
    process.execPath,
    [fixture.hubBin, 'hub'],
    fixture.appA,
    hubEnvironment(),
    logs,
  )
  processes.push(hub)
  await waitForJson(`${hubUrl}/api/health`, (value) =>
    (value as { service?: string }).service === 'vibe-check-hub')
}

interface WorkflowIssueView {
  readonly pageUrl: string
  readonly phase: string
  readonly issue: { readonly detector: string }
}

const workflowIssues = async (projectId: string): Promise<readonly WorkflowIssueView[]> => {
  const response = await fetch(`${hubUrl}/api/projects/${encodeURIComponent(projectId)}/workflow`)
  if (!response.ok) return []
  const workflow = await response.json() as { readonly issues?: readonly WorkflowIssueView[] }
  return workflow.issues ?? []
}

const workflowPhase = async (projectId: string, pageUrl: string): Promise<string> =>
  (await workflowIssues(projectId)).find((item) =>
    item.pageUrl === pageUrl && item.issue.detector === 'dom-bloat')?.phase ?? 'missing'

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
    const packageIndex = transport.args.indexOf(MCP_PACKAGE_SPEC)
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
  const issue = page.getByRole('button', { name: /Too many elements|DOM Bloat/ }).first()
  await expect(issue).toBeVisible({ timeout: 20_000 })
  await issue.click()
}

const watch = (client: Client, projectId: string) => client.callTool({
  name: 'watch_for_issue',
  arguments: { project_id: projectId, timeout_seconds: 30 },
})

test.beforeAll(async () => {
  fixture = await installFixture()
  const [allocatedHubPort, appAPort, appBPort] = await Promise.all([freePort(), freePort(), freePort()])
  hubPort = allocatedHubPort
  hubUrl = `http://127.0.0.1:${hubPort}`
  appAUrl = `http://127.0.0.1:${appAPort}`
  appBUrl = `http://127.0.0.1:${appBPort}`
  logs = join(fixture.root, 'logs')

  await writeFile(fixture.registryPath, `${JSON.stringify({
    schemaVersion: 1,
    projects: {
      [appAUrl]: { root: fixture.appA },
      [appBUrl]: { root: fixture.appB },
    },
  }, null, 2)}\n`)

  hub = await startProcess('hub', process.execPath, [fixture.hubBin, 'hub'], fixture.appA, hubEnvironment(), logs)
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
    await expect(page.getByRole('tab', { name: /in progress \(1\)/i })).toBeVisible()
  } finally {
    await agent.close()
  }
})

test('restores widget state and placement after refresh', async ({ page }) => {
  await page.goto(appAUrl)
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByRole('tab', { name: 'Settings' }).click()
  await page.getByText('Use one position for both', { exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Use one position for both' })).not.toBeChecked()
  await page.getByRole('radiogroup', { name: 'Collapsed' })
    .getByRole('radio', { name: 'Top left' }).click()
  await page.getByRole('radiogroup', { name: 'Expanded' })
    .getByRole('radio', { name: 'Bottom right' }).click()
  await page.getByTestId('vibe-check-header').click()

  await page.reload()
  const collapsed = page.getByTestId('vibe-check-overlay')
  await expect(page.getByTestId('vibe-check-header')).toHaveAttribute('aria-expanded', 'false')
  await expect(collapsed).toHaveCSS('top', '12px')
  await expect(collapsed).toHaveCSS('left', '12px')

  await page.getByTestId('vibe-check-header').click()
  const expanded = page.getByTestId('vibe-check-overlay')
  await expect(expanded).toHaveCSS('bottom', '12px')
  await expect(expanded).toHaveCSS('right', '12px')
})

test('packed SEO suggestion dispatches its exact finding to the watching agent', async ({ page }) => {
  const agent = await connectClient('seo-agent')
  try {
    await page.goto(appAUrl)
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    const receivedPromise = watch(agent.client, appAUrl)
    await page.getByRole('tab', { name: /^SEO/ }).click()
    const finding = page.getByRole('button', { name: /Missing meta description/ })
    await expect(finding).toBeVisible({ timeout: 20_000 })
    await finding.click()

    const send = page.getByTestId(/vibe-check-send-/)
    await expect(send).toBeEnabled({ timeout: 10_000 })
    await send.click()

    const received = payload(await receivedPromise)
    expect(received.projectId).toBe(appAUrl)
    expect(received.issue?.detector).toBe('seo')
    expect(received.issue?.title).toBe('Missing meta description')
    expect(received.suggestion).toContain('meta name="description"')
    await expect(send).toHaveText('Sent')
  } finally {
    await agent.close()
  }
})

test('recording shell shows the receipt only after the real agent receives the issue', async ({ page }) => {
  const agent = await connectClient('recording-agent')
  try {
    await openAgentIssue(page, `${appAUrl}/recording-demo?recording=1`)
    await expect(page.getByTestId('vibe-check-demo-shell')).toBeVisible()
    await expect(page.getByTestId('vibe-check-demo-receipt')).toContainText('Waiting for issue')

    const receivedPromise = watch(agent.client, appAUrl)
    await expect(page.getByTestId('vibe-check-agent-status')).toContainText(
      /Agent connected|AI agent connected/,
      { timeout: 10_000 },
    )
    await page.getByTestId(/vibe-check-send-/).click()
    const received = payload(await receivedPromise)

    await page.evaluate((detail) => {
      window.dispatchEvent(new CustomEvent('vibe-check-demo-agent-received', { detail }))
    }, {
      projectId: received.projectId ?? '',
      detector: received.issue?.detector ?? '',
      nodeCount: received.issue?.evidence?.nodeCount ?? 0,
    })

    const receipt = page.getByTestId('vibe-check-demo-receipt')
    await expect(receipt).toContainText('Received by agent')
    await expect(receipt).toContainText('dom-bloat')
    await expect(receipt).toContainText(appAUrl)
  } finally {
    await agent.close()
  }
})

test('persists a verified fix and reopens its regression', async ({ page }) => {
  const workflowUrl = `${appAUrl}/workflow-demo`
  const agent = await connectClient('workflow-agent')
  try {
    await page.goto(workflowUrl)
    await page.evaluate(() => {
      sessionStorage.setItem(`vibe-check-demo-bloated:${window.location.pathname}`, 'true')
    })
    await openAgentIssue(page, workflowUrl)

    const receivedPromise = watch(agent.client, appAUrl)
    await expect(page.getByTestId('vibe-check-agent-status')).toContainText(
      /Agent connected|AI agent connected/,
      { timeout: 10_000 },
    )
    await page.getByTestId(/vibe-check-send-/).click()
    const received = payload(await receivedPromise)
    const issueId = received.issue?.id
    if (!issueId) throw new Error('Dispatched issue did not include an ID')
    await expect.poll(() => workflowPhase(appAUrl, workflowUrl), { timeout: 20_000 })
      .toBe('working')

    await page.getByRole('button', { name: 'Apply fix' }).click()
    await expect.poll(async () => {
      const result = jsonPayload(await agent.client.callTool({
        name: 'get_detected_issues',
        arguments: { project_id: appAUrl },
      })) as { readonly issues: readonly { readonly id: string }[] }
      return result.issues.some((issue) => issue.id === issueId)
    }, { timeout: 20_000 }).toBe(false)

    const resolution = payload(await agent.client.callTool({
      name: 'resolve_issue',
      arguments: { project_id: appAUrl, issue_id: issueId },
    })) as ToolPayload & { readonly verifying?: boolean }
    expect(resolution.verifying).toBe(true)
    await expect.poll(() => workflowPhase(appAUrl, workflowUrl), { timeout: 20_000 })
      .toBe('fixed')

    const fixedTab = page.getByRole('tab', { name: /fixed \([1-9]\d*\)/i })
    await expect(fixedTab).toBeVisible({ timeout: 10_000 })
    await fixedTab.click()
    await expect(page.getByRole('button', { name: /Too many elements|DOM Bloat/ })).toBeVisible()

    await restartHub()
    await page.reload()
    await expect.poll(() => workflowPhase(appAUrl, workflowUrl), { timeout: 20_000 })
      .toBe('fixed')

    await page.getByRole('button', { name: 'Reintroduce regression' }).click()
    await expect.poll(() => workflowPhase(appAUrl, workflowUrl), { timeout: 20_000 })
      .toBe('regressed')
    await expect.poll(async () =>
      (await workflowIssues(appBUrl)).some((item) => item.pageUrl === workflowUrl))
      .toBe(false)

    await page.getByRole('tab', { name: /Agent|Fix/ }).click()
    await expect(page.getByText(/regression/i).first()).toBeVisible({ timeout: 10_000 })
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
  const isolationAUrl = `${appAUrl}/isolation-demo`
  const isolationBUrl = `${appBUrl}/isolation-demo`
  try {
    await Promise.all([openAgentIssue(pageA, isolationAUrl), openAgentIssue(pageB, isolationBUrl)])
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
    await openAgentIssue(pageA, `${appAUrl}/handoff-demo`)
    const handedOff = watch(agentC.client, appAUrl)
    await expect(pageA.getByTestId('vibe-check-agent-status')).toContainText(/Agent connected|AI agent connected/, { timeout: 10_000 })
    await pageA.getByTestId(/vibe-check-send-/).click()
    expect(payload(await handedOff).projectId).toBe(appAUrl)
  } finally {
    await Promise.allSettled([agentA.close(), agentB.close(), agentC.close(), pageA.close(), pageB.close()])
  }
})
