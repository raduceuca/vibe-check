import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  readProjectRegistry,
  registerProjectRoot,
  resolveProjectRoot,
} from '../projectRegistry.js'

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vibe-check-registry-'))
  await Promise.all([mkdir(join(root, 'a')), mkdir(join(root, 'b'))])
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('project registry', () => {
  it('registers canonical project roots idempotently and rejects collisions', async () => {
    const path = join(root, 'registry/projects.json')
    await registerProjectRoot(path, 'storefront', join(root, 'a'))
    await registerProjectRoot(path, 'storefront', join(root, 'a'))

    await expect(resolveProjectRoot(path, 'storefront')).resolves.toBe(await realpath(join(root, 'a')))
    await expect(registerProjectRoot(path, 'storefront', join(root, 'b')))
      .rejects.toThrow('already registered')
  })

  it('keeps projects isolated and returns null for unknown projects', async () => {
    const path = join(root, 'projects.json')
    await registerProjectRoot(path, 'storefront', join(root, 'a'))
    await registerProjectRoot(path, 'admin', join(root, 'b'))
    const [storefrontRoot, adminRoot] = await Promise.all([
      realpath(join(root, 'a')),
      realpath(join(root, 'b')),
    ])

    await expect(readProjectRegistry(path)).resolves.toEqual({
      schemaVersion: 1,
      projects: {
        storefront: { root: storefrontRoot },
        admin: { root: adminRoot },
      },
    })
    await expect(resolveProjectRoot(path, 'missing')).resolves.toBeNull()
  })
})
