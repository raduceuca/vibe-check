import {
  HUB_START_COMMAND,
  getAgentClientSetup,
  getWatchInstruction,
  type ProjectSummary,
} from './types.js'
import { createHubClient, type HubClient } from './hubClient.js'

const SNAPSHOT_FRESH_MS = 10_000

export type DoctorCheckId = 'runtime' | 'hub' | 'projects' | 'project' | 'snapshot' | 'watcher'
export type DoctorLevel = 'pass' | 'warn' | 'fail'

export interface DoctorCheck {
  readonly id: DoctorCheckId
  readonly level: DoctorLevel
  readonly message: string
}

export interface DoctorReport {
  readonly schemaVersion: 1
  readonly ok: boolean
  readonly hubUrl: string
  readonly generatedAt: number
  readonly selectedProjectId: string | null
  readonly checks: readonly DoctorCheck[]
  readonly projects: readonly ProjectSummary[]
  readonly nextSteps: readonly string[]
}

export interface DoctorOptions {
  readonly hubUrl: string
  readonly projectId?: string
  readonly nodeVersion?: string
  readonly now?: () => number
  readonly client?: HubClient
}

const report = (
  hubUrl: string,
  generatedAt: number,
  selectedProjectId: string | null,
  checks: readonly DoctorCheck[],
  projects: readonly ProjectSummary[],
  nextSteps: readonly string[],
  ok: boolean,
): DoctorReport => ({
  schemaVersion: 1,
  ok,
  hubUrl,
  generatedAt,
  selectedProjectId,
  checks,
  projects,
  nextSteps,
})

const setupSteps = (projectId: string): readonly string[] => {
  const codex = getAgentClientSetup('codex')
  const claude = getAgentClientSetup('claude-code')
  const cursor = getAgentClientSetup('cursor')
  return [
    `Configure Codex: ${codex.value}`,
    `Configure Claude Code: ${claude.value}`,
    `Configure Cursor: save the VibeCheck stdio server as ${cursor.destination.replace('Save as ', '')}.`,
    'Restart or open a new agent session after changing its MCP configuration.',
    getWatchInstruction(projectId),
  ]
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const runDoctor = async ({
  hubUrl,
  projectId,
  nodeVersion = process.versions.node,
  now = Date.now,
  client = createHubClient(hubUrl),
}: DoctorOptions): Promise<DoctorReport> => {
  const generatedAt = now()
  const checks: DoctorCheck[] = []
  const nextSteps: string[] = []
  const major = Number.parseInt(nodeVersion.split('.')[0] ?? '', 10)
  const runtimeOk = Number.isFinite(major) && major >= 20

  checks.push(runtimeOk
    ? { id: 'runtime', level: 'pass', message: `Node.js 20+ detected (${nodeVersion}).` }
    : { id: 'runtime', level: 'fail', message: `Node.js 20+ is required; detected ${nodeVersion}.` })
  if (!runtimeOk) nextSteps.push('Install Node.js 20 or newer, then rerun VibeCheck doctor.')

  try {
    const health = await client.health()
    checks.push({
      id: 'hub',
      level: 'pass',
      message: `VibeCheck hub ${health.version} is reachable.`,
    })
  } catch {
    checks.push({
      id: 'hub',
      level: 'fail',
      message: `Cannot reach the VibeCheck hub at ${hubUrl}.`,
    })
    nextSteps.push(`Start the hub: ${HUB_START_COMMAND}`)
    return report(hubUrl, generatedAt, projectId ?? null, checks, [], nextSteps, false)
  }

  let projects: readonly ProjectSummary[]
  try {
    projects = await client.listProjects()
  } catch (error) {
    checks.push({
      id: 'projects',
      level: 'fail',
      message: `Could not list browser projects: ${errorMessage(error)}`,
    })
    nextSteps.push('Restart the VibeCheck hub, then rerun doctor.')
    return report(hubUrl, generatedAt, projectId ?? null, checks, [], nextSteps, false)
  }

  if (projects.length === 0) {
    checks.push({
      id: 'projects',
      level: 'fail',
      message: 'No browser projects are publishing to this hub.',
    })
    nextSteps.push('Open or reload a development page that mounts VibeCheck with this hub URL.')
    return report(hubUrl, generatedAt, projectId ?? null, checks, projects, nextSteps, false)
  }

  checks.push({
    id: 'projects',
    level: 'pass',
    message: `${projects.length} active browser project${projects.length === 1 ? '' : 's'} found.`,
  })

  const selectedProjectId = projectId ?? (projects.length === 1 ? projects[0]?.projectId : null)
  if (!selectedProjectId) {
    checks.push({
      id: 'project',
      level: 'fail',
      message: 'More than one project is active; choose one with --project.',
    })
    nextSteps.push(`Run doctor again with --project <id>. Available: ${projects.map((item) => item.projectId).join(', ')}`)
    return report(hubUrl, generatedAt, null, checks, projects, nextSteps, false)
  }

  const selected = projects.find((item) => item.projectId === selectedProjectId)
  if (!selected) {
    checks.push({
      id: 'project',
      level: 'fail',
      message: `Project "${selectedProjectId}" is not publishing to this hub.`,
    })
    nextSteps.push(`Open or reload the page for "${selectedProjectId}", then rerun doctor.`)
    return report(hubUrl, generatedAt, selectedProjectId, checks, projects, nextSteps, false)
  }

  checks.push({
    id: 'project',
    level: 'pass',
    message: `Selected ${selectedProjectId} at ${selected.origin}.`,
  })

  let hasSnapshot = false
  try {
    hasSnapshot = await client.getSnapshot(selectedProjectId) !== null
  } catch (error) {
    checks.push({
      id: 'snapshot',
      level: 'fail',
      message: `Could not read the browser snapshot: ${errorMessage(error)}`,
    })
  }

  const snapshotAgeMs = Math.max(0, generatedAt - selected.lastSeenAt)
  const snapshotFresh = hasSnapshot && snapshotAgeMs <= SNAPSHOT_FRESH_MS
  if (!hasSnapshot && !checks.some((check) => check.id === 'snapshot')) {
    checks.push({ id: 'snapshot', level: 'fail', message: 'The selected project has no browser snapshot.' })
  } else if (hasSnapshot && snapshotFresh) {
    checks.push({
      id: 'snapshot',
      level: 'pass',
      message: `Browser snapshot is fresh (${(snapshotAgeMs / 1_000).toFixed(1)}s old).`,
    })
  } else if (hasSnapshot) {
    checks.push({
      id: 'snapshot',
      level: 'warn',
      message: `Browser snapshot is stale (${(snapshotAgeMs / 1_000).toFixed(1)}s old).`,
    })
  }
  if (!snapshotFresh) nextSteps.push(`Open or reload ${selected.origin} so the widget publishes a fresh snapshot.`)

  let watcherReady = false
  try {
    const projectStatus = await client.getProjectStatus(selectedProjectId)
    if (!projectStatus) {
      checks.push({ id: 'watcher', level: 'fail', message: `No status exists for ${selectedProjectId}.` })
      nextSteps.push('Reload the browser project, then rerun doctor.')
    } else if (projectStatus.state === 'watching' || projectStatus.state === 'busy') {
      watcherReady = true
      if (projectStatus.conflictAt !== null) {
        checks.push({
          id: 'watcher',
          level: 'warn',
          message: 'Agent watcher is connected; a second agent was rejected recently.',
        })
        nextSteps.push('Continue in the owning session, or call release_project there before switching agents.')
      } else {
        checks.push({
          id: 'watcher',
          level: 'pass',
          message: projectStatus.state === 'busy'
            ? 'Agent watcher is working.'
            : 'Agent watcher is connected.',
        })
      }
    } else if (projectStatus.state === 'stale') {
      checks.push({ id: 'watcher', level: 'warn', message: 'The agent watcher stopped responding.' })
      nextSteps.push('Restart or reconnect the owning agent session, then call watch_for_issue again.')
      nextSteps.push(getWatchInstruction(selectedProjectId))
    } else {
      checks.push({ id: 'watcher', level: 'warn', message: `No agent is watching ${selectedProjectId}.` })
      nextSteps.push(...setupSteps(selectedProjectId))
    }
  } catch (error) {
    checks.push({
      id: 'watcher',
      level: 'fail',
      message: `Could not read watcher state: ${errorMessage(error)}`,
    })
    nextSteps.push('Restart the VibeCheck hub, then rerun doctor.')
  }

  return report(
    hubUrl,
    generatedAt,
    selectedProjectId,
    checks,
    projects,
    nextSteps,
    runtimeOk && snapshotFresh && watcherReady,
  )
}

const CHECK_LABELS: Readonly<Record<DoctorCheckId, string>> = {
  runtime: 'Runtime',
  hub: 'Hub',
  projects: 'Projects',
  project: 'Project',
  snapshot: 'Snapshot',
  watcher: 'Watcher',
}

export const formatDoctorHuman = (doctorReport: DoctorReport): string => {
  const lines = [
    `VibeCheck doctor — ${doctorReport.hubUrl}`,
    ...doctorReport.checks.map((check) =>
      `${check.level.toUpperCase().padEnd(6)}${CHECK_LABELS[check.id]}: ${check.message}`),
  ]
  if (doctorReport.nextSteps.length > 0) {
    lines.push('', 'Next steps:', ...doctorReport.nextSteps.map((step, index) => `${index + 1}. ${step}`))
  }
  return `${lines.join('\n')}\n`
}

export const formatDoctorJson = (doctorReport: DoctorReport): string =>
  `${JSON.stringify(doctorReport, null, 2)}\n`
