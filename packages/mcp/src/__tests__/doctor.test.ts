import { describe, expect, it } from 'vitest'
import {
  HUB_START_COMMAND,
  MCP_PACKAGE_SPEC,
  formatLeaseConflictMessage,
  type LeaseHolder,
} from '@wcgw/vibe-check-protocol'
import {
  formatDoctorHuman,
  formatDoctorJson,
  runDoctor,
} from '../doctor.js'
import { HubClientError, type HubClient } from '../hubClient.js'
import type { ProjectStatus, ProjectSummary, VibeSnapshot } from '../types.js'

const NOW = 20_000
const HUB_URL = 'http://127.0.0.1:4200'

const snapshot: VibeSnapshot = {
  timestamp: 19_000,
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 0, jsTransferKB: 0, cssTransferKB: 0, imageTransferKB: 0, fontTransferKB: 0, resourceCount: 0, largeResources: [] },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues: [],
  domNodeCount: 10,
}

const project = (projectId = 'project-a', lastSeenAt = 19_000): ProjectSummary => ({
  projectId,
  origin: `http://${projectId}.test`,
  title: projectId,
  instanceCount: 1,
  lastSeenAt,
  agentState: 'no-agent',
})

const status = (
  state: ProjectStatus['state'] = 'no-agent',
  conflictAt: number | null = null,
  holder: LeaseHolder | null = null,
): ProjectStatus => ({
  projectId: 'project-a',
  state,
  queueDepth: 0,
  leaseExpiresAt: state === 'no-agent' ? null : 25_000,
  conflictAt,
  holder,
})

const makeClient = (overrides: Partial<HubClient> = {}): HubClient => ({
  health: async () => ({ status: 'ok', service: 'vibe-check-hub', version: '0.3.0' }),
  listProjects: async () => [project()],
  getSnapshot: async () => snapshot,
  getProjectStatus: async () => status(),
  getDetectedIssues: async () => [],
  getIssue: async () => null,
  waitForSnapshot: async () => null,
  acquireLease: async (projectId) => ({ ok: true, projectId, expiresAt: 25_000 }),
  heartbeatLease: async (projectId) => ({ ok: true, projectId, expiresAt: 25_000 }),
  releaseLease: async () => undefined,
  waitForIssue: async () => null,
  acknowledgeIssue: async () => undefined,
  resolveIssue: async () => undefined,
  ...overrides,
})

const diagnose = (client: HubClient, projectId?: string, hubUrl = HUB_URL) => runDoctor({
  hubUrl,
  projectId,
  client,
  nodeVersion: '20.19.0',
  now: () => NOW,
})

describe('runDoctor', () => {
  it('fails with a start-hub step when health is offline', async () => {
    const report = await diagnose(makeClient({
      health: async () => { throw new HubClientError(0, 'hub-offline', null) },
    }))

    expect(report.ok).toBe(false)
    expect(report.checks).toContainEqual({
      id: 'hub',
      level: 'fail',
      message: `Cannot reach the VibeCheck hub at ${HUB_URL}.`,
    })
    expect(report.nextSteps).toContain(`Start the hub: ${HUB_START_COMMAND}`)
  })

  it('names the non-default port in the start-hub step (E2E-06)', async () => {
    const report = await diagnose(makeClient({
      health: async () => { throw new HubClientError(0, 'hub-offline', null) },
    }), 'project-a', 'http://127.0.0.1:4317')

    expect(report.checks).toContainEqual({
      id: 'hub',
      level: 'fail',
      message: 'Cannot reach the VibeCheck hub at http://127.0.0.1:4317.',
    })
    expect(report.nextSteps).toContain(`Start the hub: ${HUB_START_COMMAND} --port 4317`)
  })

  it('points at the widget beaconUrl and the origin allowlist when no project publishes', async () => {
    const report = await diagnose(makeClient({ listProjects: async () => [] }))

    expect(report.ok).toBe(false)
    expect(report.nextSteps.join('\n')).toContain(`beaconUrl ${HUB_URL}`)
    expect(report.nextSteps.join('\n')).toContain('--allow-origin')
  })

  it('fails closed when several projects exist and none was selected', async () => {
    const report = await diagnose(makeClient({
      listProjects: async () => [project('project-a'), project('project-b')],
    }))

    expect(report.ok).toBe(false)
    expect(report.selectedProjectId).toBeNull()
    expect(report.checks).toContainEqual({
      id: 'project',
      level: 'fail',
      message: 'More than one project is active; choose one with --project.',
    })
    expect(report.nextSteps.join(' ')).toContain('project-a, project-b')
  })

  it('fails when the requested project does not exist', async () => {
    const report = await diagnose(makeClient(), 'missing')

    expect(report.ok).toBe(false)
    expect(report.selectedProjectId).toBe('missing')
    expect(report.checks).toContainEqual({
      id: 'project',
      level: 'fail',
      message: 'Project "missing" is not publishing to this hub.',
    })
  })

  it('warns when the selected browser snapshot is older than ten seconds', async () => {
    const report = await diagnose(makeClient({
      listProjects: async () => [project('project-a', 5_000)],
      getProjectStatus: async () => status('watching'),
    }), 'project-a')

    expect(report.ok).toBe(false)
    expect(report.checks).toContainEqual({
      id: 'snapshot',
      level: 'warn',
      message: 'Browser snapshot is stale (15.0s old).',
    })
  })

  it('warns with exact client and watch steps when no agent watches', async () => {
    const report = await diagnose(makeClient(), 'project-a')

    expect(report.ok).toBe(false)
    expect(report.checks).toContainEqual({
      id: 'watcher',
      level: 'warn',
      message: 'No agent is watching project-a.',
    })
    expect(report.nextSteps.join('\n')).toContain('codex mcp add vibe-check')
    expect(report.nextSteps.join('\n')).toContain('claude mcp add --scope local')
    expect(report.nextSteps.join('\n')).toContain('.cursor/mcp.json')
    expect(report.nextSteps.join('\n')).toContain('"vibe-check"')
    expect(report.nextSteps.join('\n')).toContain(MCP_PACKAGE_SPEC)
    expect(report.nextSteps.join('\n')).toContain('project_id "project-a"')
    expect(report.nextSteps.join('\n')).not.toContain('VIBE_CHECK_HUB_URL')
  })

  it('carries a non-default hub into every agent setup step (E2E-06)', async () => {
    const hubUrl = 'http://127.0.0.1:4317'
    const report = await diagnose(makeClient(), 'project-a', hubUrl)
    const steps = report.nextSteps.join('\n')

    expect(steps).toContain(`codex mcp add vibe-check --env VIBE_CHECK_HUB_URL=${hubUrl} --`)
    expect(steps).toContain(`claude mcp add --scope local vibe-check -e VIBE_CHECK_HUB_URL=${hubUrl} --`)
    expect(steps).toContain(`"VIBE_CHECK_HUB_URL": "${hubUrl}"`)
  })

  it('warns when an agent session claimed the project but is not waiting (leased)', async () => {
    const report = await diagnose(makeClient({
      getProjectStatus: async () => status('leased'),
    }), 'project-a')

    expect(report.ok).toBe(false)
    expect(report.checks).toContainEqual({
      id: 'watcher',
      level: 'warn',
      message: 'An agent session claimed project-a but is not waiting. Ask it to call watch_for_issue again.',
    })
    expect(report.checks.some((check) => check.message.includes('No agent is watching'))).toBe(false)
    expect(report.nextSteps.join('\n')).toContain('watch_for_issue with project_id "project-a"')
  })

  it.each([
    ['watching', 'Agent watcher is connected.'],
    ['busy', 'Agent watcher is working.'],
  ] as const)('passes a fresh project with a %s owner', async (stateValue, message) => {
    const report = await diagnose(makeClient({
      getProjectStatus: async () => status(stateValue),
    }), 'project-a')

    expect(report.ok).toBe(true)
    expect(report.selectedProjectId).toBe('project-a')
    expect(report.checks).toContainEqual({ id: 'watcher', level: 'pass', message })
    expect(report.nextSteps).toEqual([])
  })

  it('reports a stale watcher with reconnect guidance', async () => {
    const report = await diagnose(makeClient({
      getProjectStatus: async () => status('stale'),
    }), 'project-a')

    expect(report.ok).toBe(false)
    expect(report.checks).toContainEqual({
      id: 'watcher',
      level: 'warn',
      message: 'The agent watcher stopped responding.',
    })
    expect(report.nextSteps.join('\n')).toContain('Restart or reconnect the owning agent session')
    expect(report.nextSteps.join('\n')).toContain('watch_for_issue')
  })

  it('never calls mutating hub methods', async () => {
    const mutation = async (): Promise<never> => {
      throw new Error('doctor attempted to mutate hub state')
    }
    const report = await diagnose(makeClient({
      getProjectStatus: async () => status('watching'),
      acquireLease: mutation,
      heartbeatLease: mutation,
      releaseLease: mutation,
      waitForIssue: mutation,
      acknowledgeIssue: mutation,
      resolveIssue: mutation,
    }), 'project-a')

    expect(report.ok).toBe(true)
  })

  it('reports a recent rejected second watcher without replacing the owner', async () => {
    const holder: LeaseHolder = {
      clientName: 'claude-code',
      acquiredAt: 10_000,
      heartbeatAt: 17_000,
      expiresAt: 32_000,
      state: 'watching',
    }
    const report = await diagnose(makeClient({
      getProjectStatus: async () => status('watching', 19_500, holder),
    }), 'project-a')

    expect(report.ok).toBe(true)
    expect(report.checks).toContainEqual({
      id: 'watcher',
      level: 'warn',
      message: 'Agent watcher is connected; a second agent was rejected recently.',
    })
    expect(report.nextSteps).toEqual([formatLeaseConflictMessage('project-a', holder, NOW)])
    expect(report.nextSteps[0]).toContain('(Claude Code, last heartbeat 3s ago)')
  })

  it('formats deterministic human and JSON output', async () => {
    const report = await diagnose(makeClient(), 'project-a')
    const human = formatDoctorHuman(report)
    const json = formatDoctorJson(report)

    expect(human).toContain(`VibeCheck doctor — ${HUB_URL}`)
    expect(human).toContain('PASS  Runtime:')
    expect(human).toContain('WARN  Watcher: No agent is watching project-a.')
    expect(human).toContain('Next steps:\n1.')
    expect(json.endsWith('\n')).toBe(true)
    expect(JSON.parse(json)).toMatchObject({
      schemaVersion: 1,
      ok: false,
      selectedProjectId: 'project-a',
    })
  })
})
