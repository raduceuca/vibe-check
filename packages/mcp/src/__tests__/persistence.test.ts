import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createProjectWorkflow } from '../workflow.js'
import { readPersistedWorkflow, writePersistedWorkflow } from '../persistence.js'
import type { ImpactReceipt, ProjectWorkflow } from '../types.js'

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vibe-check-state-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const workflowFor = (projectId: string, revision = 1): ProjectWorkflow => ({
  ...createProjectWorkflow(projectId),
  revision,
})

describe('workflow persistence', () => {
  it('round-trips versioned atomic state without leaving temporary files', async () => {
    const statePath = join(root, '.vibecheck/state.json')
    const receipt: ImpactReceipt = {
      id: 'receipt-1',
      issueKey: 'issue-key',
      occurrence: 1,
      detector: 'duplicate-requests',
      pageUrl: 'http://localhost/menu',
      baselineSnapshotAt: 1,
      verificationSnapshotAt: 2,
      kind: 'duplicate-requests-removed',
      before: 4,
      after: 0,
      delta: 4,
      unit: 'requests',
      confidence: 'measured',
    }
    const workflow = {
      ...workflowFor('storefront', 4),
      impactResetAt: 3,
      impactReceipts: [receipt],
    }
    await writePersistedWorkflow(statePath, workflow)

    await expect(readPersistedWorkflow(statePath, 'storefront')).resolves.toEqual(workflow)
    expect((await readdir(dirname(statePath))).filter((name) => name.endsWith('.tmp'))).toEqual([])
    expect(JSON.parse(await readFile(statePath, 'utf8'))).toMatchObject({ schemaVersion: 1 })
  })

  it('keeps concurrent project writes isolated in one repository root', async () => {
    const statePath = join(root, '.vibecheck/state.json')
    await Promise.all([
      writePersistedWorkflow(statePath, workflowFor('storefront', 2)),
      writePersistedWorkflow(statePath, workflowFor('admin', 7)),
    ])

    await expect(readPersistedWorkflow(statePath, 'storefront'))
      .resolves.toMatchObject({ projectId: 'storefront', revision: 2 })
    await expect(readPersistedWorkflow(statePath, 'admin'))
      .resolves.toMatchObject({ projectId: 'admin', revision: 7 })
  })

  it('backs up corrupt state, warns, and recovers with an empty workflow', async () => {
    const statePath = join(root, '.vibecheck/state.json')
    await writePersistedWorkflow(statePath, workflowFor('storefront'))
    await writeFile(statePath, '{broken')
    const warnings: string[] = []

    await expect(readPersistedWorkflow(
      statePath,
      'storefront',
      (message) => warnings.push(message),
    )).resolves.toEqual(createProjectWorkflow('storefront'))
    expect(warnings).toHaveLength(1)
    expect((await readdir(dirname(statePath))).some((name) => name.includes('.corrupt-'))).toBe(true)
  })
})
