import { mkdtemp, mkdir, readFile, realpath, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ProjectRootConflictError,
  listRegisteredOrigins,
  readProjectRegistry,
  registerProjectRoot,
  resolveProjectRoot,
  unregisterProjectRoot,
} from '../projectRegistry.js'
import { CliError } from '../fatal.js'

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
    await expect(registerProjectRoot(path, 'storefront', join(root, 'a'))).resolves.toMatchObject({ status: 'created' })
    await expect(registerProjectRoot(path, 'storefront', join(root, 'a'))).resolves.toMatchObject({ status: 'unchanged' })

    await expect(resolveProjectRoot(path, 'storefront')).resolves.toBe(await realpath(join(root, 'a')))
    await expect(registerProjectRoot(path, 'storefront', join(root, 'b')))
      .rejects.toThrow('already registered')
  })

  it('names the conflicting root and the --force way out (MCP-10)', async () => {
    const path = join(root, 'projects.json')
    await registerProjectRoot(path, 'shop', join(root, 'a'))
    const error = await registerProjectRoot(path, 'shop', join(root, 'b')).catch((value: unknown) => value)

    expect(error).toBeInstanceOf(ProjectRootConflictError)
    expect((error as ProjectRootConflictError).existingRoot).toBe(await realpath(join(root, 'a')))
    expect((error as ProjectRootConflictError).hint).toContain('register --project shop --force')
  })

  it('moves a project ID with force, keeping its origins', async () => {
    const path = join(root, 'projects.json')
    await registerProjectRoot(path, 'shop', join(root, 'a'), { origins: ['http://shop.test:3000'] })

    const moved = await registerProjectRoot(path, 'shop', join(root, 'b'), { force: true })
    expect(moved).toMatchObject({
      status: 'moved',
      root: await realpath(join(root, 'b')),
      previousRoot: await realpath(join(root, 'a')),
      previousRootMissing: false,
      origins: ['http://shop.test:3000'],
    })
    await expect(resolveProjectRoot(path, 'shop')).resolves.toBe(await realpath(join(root, 'b')))
  })

  it('re-points a project ID whose registered folder no longer exists', async () => {
    const path = join(root, 'projects.json')
    await mkdir(join(root, 'moved-a'))
    const oldRoot = await realpath(join(root, 'moved-a'))
    await registerProjectRoot(path, 'mv', oldRoot)
    await rename(oldRoot, join(root, 'moved-b'))

    await expect(registerProjectRoot(path, 'mv', join(root, 'moved-b'))).resolves.toMatchObject({
      status: 'moved',
      previousRoot: oldRoot,
      previousRootMissing: true,
    })
    await expect(resolveProjectRoot(path, 'mv')).resolves.toBe(await realpath(join(root, 'moved-b')))
  })

  it('merges normalized origins into an existing entry and lists them for the hub', async () => {
    const path = join(root, 'projects.json')
    await registerProjectRoot(path, 'shop', join(root, 'a'), { origins: ['http://Shop.test:3000/'] })
    await expect(registerProjectRoot(path, 'shop', join(root, 'a'), { origins: ['http://shop.test:3000'] }))
      .resolves.toMatchObject({ status: 'unchanged' })
    await expect(registerProjectRoot(path, 'shop', join(root, 'a'), { origins: ['https://*.shop.dev', 'not an origin'] }))
      .resolves.toMatchObject({ status: 'updated', origins: ['http://shop.test:3000', 'https://*.shop.dev'] })
    await registerProjectRoot(path, 'admin', join(root, 'b'), { origins: ['http://admin.test'] })

    await expect(listRegisteredOrigins(path)).resolves.toEqual([
      'http://shop.test:3000',
      'https://*.shop.dev',
      'http://admin.test',
    ])
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

  it('treats Object.prototype names as ordinary project IDs', async () => {
    const path = join(root, 'projects.json')
    await expect(resolveProjectRoot(path, 'constructor')).resolves.toBeNull()
    await expect(resolveProjectRoot(path, 'toString')).resolves.toBeNull()

    await expect(registerProjectRoot(path, 'constructor', join(root, 'a'))).resolves.toMatchObject({ status: 'created' })
    await expect(registerProjectRoot(path, '__proto__', join(root, 'b'))).resolves.toMatchObject({ status: 'created' })

    await expect(resolveProjectRoot(path, 'constructor')).resolves.toBe(await realpath(join(root, 'a')))
    await expect(resolveProjectRoot(path, '__proto__')).resolves.toBe(await realpath(join(root, 'b')))
    const stored = JSON.parse(await readFile(path, 'utf8')) as { readonly projects: Readonly<Record<string, unknown>> }
    expect(Object.keys(stored.projects).sort()).toEqual(['__proto__', 'constructor'])
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
  })

  it('unregisters a project and reports when there was nothing to remove', async () => {
    const path = join(root, 'projects.json')
    await registerProjectRoot(path, 'shop', join(root, 'a'))
    await registerProjectRoot(path, 'admin', join(root, 'b'))

    await expect(unregisterProjectRoot(path, 'shop')).resolves.toBe(await realpath(join(root, 'a')))
    await expect(unregisterProjectRoot(path, 'shop')).resolves.toBeNull()
    await expect(resolveProjectRoot(path, 'admin')).resolves.toBe(await realpath(join(root, 'b')))
  })

  it('rejects a missing root with a plain message, and keeps working after a failed write', async () => {
    const path = join(root, 'projects.json')
    const error = await registerProjectRoot(path, 'shop', join(root, 'nope')).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(CliError)
    expect((error as CliError).message).toContain('does not exist')

    await expect(registerProjectRoot(path, 'shop', join(root, 'a'))).resolves.toMatchObject({ status: 'created' })
  })
})
