import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  AGENT_CLIENTS,
  AGENT_CONNECTION_STATES,
  DEFAULT_HUB_URL,
  DETECTOR_NAMES,
  DISPATCH_RESULT_CODES,
  DISPATCHABLE_AGENT_STATES,
  HUB_START_COMMAND,
  UP_START_COMMAND,
  MCP_PACKAGE_NAME,
  MCP_PACKAGE_SPEC,
  MCP_PACKAGE_VERSION,
  formatSetupPack,
  SEVERITIES,
  getAgentClientSetup,
  getDoctorCommand,
  getHubStartCommand,
  getWatchInstruction,
  hubPortFromUrl,
  isDispatchableAgentState,
  normalizeHubUrl,
} from '../index.js'
import type {
  DetectorName,
  DispatchIssueResponse,
  IssueEvidenceMap,
  ProjectSnapshotEnvelope,
  ProjectStatus,
  Severity,
  VibeSnapshot,
} from '../index.js'

const mcpPackage = JSON.parse(
  readFileSync(new URL('../../../mcp/package.json', import.meta.url), 'utf8'),
) as { readonly name: string; readonly version: string }
const SPEC = `${mcpPackage.name}@${mcpPackage.version}`

const makeSnapshot = (): VibeSnapshot => ({
  timestamp: 1,
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: {
    totalTransferKB: 0,
    jsTransferKB: 0,
    cssTransferKB: 0,
    imageTransferKB: 0,
    fontTransferKB: 0,
    resourceCount: 0,
    largeResources: [],
  },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues: [],
  domNodeCount: 10,
})

describe('protocol enums', () => {
  it('DETECTOR_NAMES has no duplicates', () => {
    expect(new Set(DETECTOR_NAMES).size).toBe(DETECTOR_NAMES.length)
  })

  it('SEVERITIES has no duplicates', () => {
    expect(new Set(SEVERITIES).size).toBe(SEVERITIES.length)
  })

  it('DetectorName type is derived from DETECTOR_NAMES (compile-time single source)', () => {
    // If these arrays and the derived types ever diverge this file fails to
    // type-check, which is the whole point of deriving the type from the array.
    const names: readonly DetectorName[] = DETECTOR_NAMES
    const severities: readonly Severity[] = SEVERITIES
    expect(names.length).toBeGreaterThan(0)
    expect(severities).toContain('critical')
  })

  it('IssueEvidenceMap covers every detector', () => {
    // Type-level exhaustiveness: a Record keyed by DetectorName forces an entry
    // for each detector, and IssueEvidenceMap must supply each key.
    const present: Record<DetectorName, true> = DETECTOR_NAMES.reduce(
      (acc, name) => ({ ...acc, [name]: true }),
      {} as Record<DetectorName, true>,
    )
    const evidenceKeys: ReadonlyArray<keyof IssueEvidenceMap> = DETECTOR_NAMES
    expect(Object.keys(present).sort()).toEqual([...DETECTOR_NAMES].sort())
    expect(evidenceKeys.length).toBe(DETECTOR_NAMES.length)
  })

  it('defines the project routing and dispatch contract', () => {
    const envelope: ProjectSnapshotEnvelope = {
      projectId: 'http://localhost:5173',
      instanceId: 'browser-a',
      origin: 'http://localhost:5173',
      pageUrl: 'http://localhost:5173/',
      title: 'Fixture A',
      snapshot: makeSnapshot(),
    }
    const status: ProjectStatus = {
      projectId: envelope.projectId,
      state: 'watching',
      queueDepth: 0,
      leaseExpiresAt: 15_000,
      conflictAt: null,
    }
    const response: DispatchIssueResponse = {
      ok: true,
      code: 'dispatched',
      projectId: envelope.projectId,
      queueDepth: 0,
    }

    expect(status.state).toBe('watching')
    expect(response.code).toBe('dispatched')
    // New members are appended so existing indexes keep their meaning.
    expect(AGENT_CONNECTION_STATES).toEqual(['no-agent', 'watching', 'busy', 'stale', 'leased'])
    expect(DISPATCH_RESULT_CODES).toEqual([
      'dispatched',
      'unconfigured',
      'hub-offline',
      'agent-not-watching',
      'queue-full',
      'invalid-issue',
      'failed',
      'queued',
      'origin-not-allowed',
    ])
  })

  it('accepts dispatches only while a live lease exists', () => {
    expect(DISPATCHABLE_AGENT_STATES).toEqual(['watching', 'leased', 'busy'])
    expect(isDispatchableAgentState('watching')).toBe(true)
    expect(isDispatchableAgentState('leased')).toBe(true)
    expect(isDispatchableAgentState('busy')).toBe(true)
    expect(isDispatchableAgentState('stale')).toBe(false)
    expect(isDispatchableAgentState('no-agent')).toBe(false)
    expect(isDispatchableAgentState(null)).toBe(false)
    expect(isDispatchableAgentState(undefined)).toBe(false)
  })
})

describe('MCP package spec', () => {
  it('derives the pinned spec from packages/mcp/package.json, never a literal', () => {
    expect(MCP_PACKAGE_NAME).toBe(mcpPackage.name)
    expect(MCP_PACKAGE_VERSION).toBe(mcpPackage.version)
    expect(MCP_PACKAGE_SPEC).toBe(SPEC)
    expect(HUB_START_COMMAND).toBe(`npx -y ${SPEC} hub`)
    expect(UP_START_COMMAND).toBe(`npx -y ${SPEC} up`)
  })
})

describe('agent client setup', () => {
  it('defines exact setup values for every first-class agent client', () => {
    expect(AGENT_CLIENTS).toEqual(['codex', 'claude-code', 'cursor'])
    expect(getAgentClientSetup('codex')).toMatchObject({
      label: 'Codex',
      format: 'command',
      value: `codex mcp add vibe-check -- npx -y ${SPEC} connect`,
    })
    expect(getAgentClientSetup('claude-code').value).toBe(
      `claude mcp add --scope local vibe-check -- npx -y ${SPEC} connect`,
    )
    expect(getAgentClientSetup('cursor').destination).toBe(
      'Add inside mcpServers in .cursor/mcp.json; if the file is new, create mcpServers first',
    )
    expect(JSON.parse(getAgentClientSetup('cursor').value)).toEqual({
      'vibe-check': {
        command: 'npx',
        args: ['-y', SPEC, 'connect'],
      },
    })
    expect(getWatchInstruction('storefront')).toContain('project_id "storefront"')
  })

  it('treats the default hub URL (with or without a trailing slash) as no override', () => {
    expect(getAgentClientSetup('codex', { hubUrl: DEFAULT_HUB_URL })).toEqual(getAgentClientSetup('codex'))
    expect(getAgentClientSetup('codex', { hubUrl: `${DEFAULT_HUB_URL}/` })).toEqual(getAgentClientSetup('codex'))
    expect(normalizeHubUrl(undefined)).toBe(DEFAULT_HUB_URL)
    expect(normalizeHubUrl('  http://127.0.0.1:4317//  ')).toBe('http://127.0.0.1:4317')
    expect(hubPortFromUrl('http://127.0.0.1:4317')).toBe(4317)
    expect(hubPortFromUrl('http://localhost')).toBe(80)
    expect(hubPortFromUrl('not a url')).toBeNull()
  })

  it('carries a non-default hub into the agent config, because the agent spawns connect', () => {
    const hubUrl = 'http://127.0.0.1:4317'
    expect(getAgentClientSetup('codex', { hubUrl }).value).toBe(
      `codex mcp add vibe-check --env VIBE_CHECK_HUB_URL=${hubUrl} -- npx -y ${SPEC} connect`,
    )
    expect(getAgentClientSetup('claude-code', { hubUrl }).value).toBe(
      `claude mcp add --scope local vibe-check -e VIBE_CHECK_HUB_URL=${hubUrl} -- npx -y ${SPEC} connect`,
    )
    expect(JSON.parse(getAgentClientSetup('cursor', { hubUrl }).value)).toEqual({
      'vibe-check': {
        command: 'npx',
        args: ['-y', SPEC, 'connect'],
        env: { VIBE_CHECK_HUB_URL: hubUrl },
      },
    })
  })
})

describe('hub and doctor commands', () => {
  it('passes a non-default port to up and hub', () => {
    expect(getHubStartCommand()).toBe(`npx -y ${SPEC} up`)
    expect(getHubStartCommand({ projectId: 'shop', agent: 'cursor' }))
      .toBe(`npx -y ${SPEC} up --project shop --agent cursor`)
    expect(getHubStartCommand({ projectId: 'shop', agent: 'codex', hubUrl: 'http://127.0.0.1:4317' }))
      .toBe(`npx -y ${SPEC} up --project shop --agent codex --port 4317`)
    expect(getHubStartCommand({ preferUp: false })).toBe(HUB_START_COMMAND)
    expect(getHubStartCommand({ preferUp: false, hubUrl: 'http://127.0.0.1:4317' }))
      .toBe(`${HUB_START_COMMAND} --port 4317`)
  })

  it('points doctor at a non-default hub', () => {
    expect(getDoctorCommand('shop')).toBe(`npx -y ${SPEC} doctor --project shop`)
    expect(getDoctorCommand('shop', 'http://127.0.0.1:4317/'))
      .toBe(`npx -y ${SPEC} doctor --project shop --hub-url http://127.0.0.1:4317`)
  })
})

describe('setup pack', () => {
  it('formats the default pack with the guided up command', () => {
    const pack = formatSetupPack({ projectId: 'storefront', agent: 'codex' })
    expect(pack).toContain('## VibeCheck setup — storefront')
    expect(pack).toContain('### 1. Start the local hub')
    expect(pack).toContain(`npx -y ${SPEC} up --project storefront --agent codex`)
    expect(pack).toContain('codex mcp add vibe-check')
    expect(pack).toContain('project_id "storefront"')
    expect(pack).toContain(`Check the connection (read-only): npx -y ${SPEC} doctor --project storefront`)
  })

  it('does not tell the user to start a second hub when one is running', () => {
    const pack = formatSetupPack({ projectId: 'storefront', agent: 'claude-code', hubRunning: true })
    expect(pack).not.toContain('Start the local hub')
    expect(pack).not.toContain(' up --project')
    expect(pack).not.toContain(HUB_START_COMMAND)
    expect(pack).not.toContain(UP_START_COMMAND)
    expect(pack).toContain(`The hub is already running at ${DEFAULT_HUB_URL}. Leave it running.`)
    expect(pack).toContain('claude mcp add --scope local vibe-check')
  })

  it('carries a non-default hub into every command in the pack', () => {
    const hubUrl = 'http://127.0.0.1:4317'
    const pack = formatSetupPack({ projectId: 'shop', agent: 'cursor', hubUrl })
    expect(pack).toContain(`up --project shop --agent cursor --port 4317`)
    expect(pack).toContain('"VIBE_CHECK_HUB_URL": "http://127.0.0.1:4317"')
    expect(pack).toContain(`doctor --project shop --hub-url ${hubUrl}`)

    const running = formatSetupPack({ projectId: 'shop', agent: 'codex', hubUrl, hubRunning: true })
    expect(running).toContain(`The hub is already running at ${hubUrl}.`)
    expect(running).toContain(`--env VIBE_CHECK_HUB_URL=${hubUrl}`)
  })

  it('keeps the legacy bare-hub option', () => {
    const pack = formatSetupPack({ projectId: 'storefront', agent: 'codex', preferUp: false })
    expect(pack).toContain(`${HUB_START_COMMAND}\n`)
    expect(pack).not.toContain(' up --project')
  })
})
