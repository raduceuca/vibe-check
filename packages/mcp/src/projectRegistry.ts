import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

export interface ProjectRegistryEntry {
  readonly root: string
}

export interface ProjectRegistry {
  readonly schemaVersion: 1
  readonly projects: Readonly<Record<string, ProjectRegistryEntry>>
}

export const defaultProjectRegistryPath = (): string =>
  join(homedir(), '.vibecheck/projects.json')

const emptyRegistry = (): ProjectRegistry => ({ schemaVersion: 1, projects: {} })

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'

const parseRegistry = (raw: string, path: string): ProjectRegistry => {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value)
    || value.schemaVersion !== 1 || !('projects' in value)
    || typeof value.projects !== 'object' || value.projects === null || Array.isArray(value.projects)) {
    throw new Error(`VibeCheck project registry at ${path} has an unsupported format`)
  }
  const projects: Record<string, ProjectRegistryEntry> = {}
  for (const [projectId, entry] of Object.entries(value.projects)) {
    if (typeof entry !== 'object' || entry === null || !('root' in entry)
      || typeof entry.root !== 'string' || entry.root.length === 0) {
      throw new Error(`VibeCheck project registry at ${path} has an invalid entry for "${projectId}"`)
    }
    projects[projectId] = { root: entry.root }
  }
  return { schemaVersion: 1, projects }
}

export const readProjectRegistry = async (path: string): Promise<ProjectRegistry> => {
  try {
    return parseRegistry(await readFile(path, 'utf8'), path)
  } catch (error) {
    if (isMissing(error)) return emptyRegistry()
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not read VibeCheck project registry: ${message}`)
  }
}

const writeProjectRegistry = async (
  path: string,
  registry: ProjectRegistry,
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  )
  await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`)
  await rename(temporary, path)
}

const registryWrites = new Map<string, Promise<void>>()

export const registerProjectRoot = async (
  registryPath: string,
  projectId: string,
  inputRoot: string,
): Promise<void> => {
  if (projectId.trim().length === 0) throw new Error('Project ID cannot be empty')
  const previous = registryWrites.get(registryPath) ?? Promise.resolve()
  const operation = previous.then(async () => {
    const root = await realpath(inputRoot)
    const registry = await readProjectRegistry(registryPath)
    const existing = registry.projects[projectId]
    if (existing && existing.root !== root) {
      throw new Error(`Project "${projectId}" is already registered at ${existing.root}`)
    }
    if (existing) return
    await writeProjectRegistry(registryPath, {
      schemaVersion: 1,
      projects: { ...registry.projects, [projectId]: { root } },
    })
  })
  registryWrites.set(registryPath, operation)
  try {
    await operation
  } finally {
    if (registryWrites.get(registryPath) === operation) registryWrites.delete(registryPath)
  }
}

export const resolveProjectRoot = async (
  registryPath: string,
  projectId: string,
): Promise<string | null> => (await readProjectRegistry(registryPath)).projects[projectId]?.root ?? null
