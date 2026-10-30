import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { normalizeOriginPattern } from '@wcgw/vibe-check-protocol'
import { CliError } from './fatal.js'

export interface ProjectRegistryEntry {
  readonly root: string
  /**
   * Since 0.4. Extra browser origins (normalized allowlist patterns) the hub
   * accepts for this project, from `register --origin` / `setup --origin`.
   */
  readonly origins?: readonly string[]
}

export interface ProjectRegistry {
  readonly schemaVersion: 1
  /** Built without a prototype: look entries up with Object.hasOwn. */
  readonly projects: Readonly<Record<string, ProjectRegistryEntry>>
}

export interface RegisterProjectOptions {
  /** Move the project ID to this root even when it is registered at another existing folder. */
  readonly force?: boolean
  /** Origins to add to the entry (merged with the ones already registered). */
  readonly origins?: readonly string[]
}

export type RegisterProjectStatus = 'created' | 'unchanged' | 'updated' | 'moved'

export interface RegisterProjectResult {
  readonly status: RegisterProjectStatus
  readonly projectId: string
  readonly root: string
  /** The root the project was registered at before a move; null otherwise. */
  readonly previousRoot: string | null
  /** True when a move happened because the previous root no longer exists. */
  readonly previousRootMissing: boolean
  readonly origins: readonly string[]
}

/** The project ID is registered at another folder that still exists. */
export class ProjectRootConflictError extends CliError {
  readonly projectId: string
  readonly existingRoot: string

  constructor(projectId: string, existingRoot: string, hint: string | null = null) {
    super(
      `Project "${projectId}" is already registered at ${existingRoot}`,
      hint ?? `To move it here, run "vibe-check-mcp register --project ${projectId} --force". To keep both, use a different --project.`,
    )
    this.name = 'ProjectRootConflictError'
    this.projectId = projectId
    this.existingRoot = existingRoot
  }
}

export const defaultProjectRegistryPath = (): string =>
  join(homedir(), '.vibecheck/projects.json')

const emptyProjects = (): Record<string, ProjectRegistryEntry> =>
  Object.create(null) as Record<string, ProjectRegistryEntry>

const emptyRegistry = (): ProjectRegistry => ({ schemaVersion: 1, projects: emptyProjects() })

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const normalizeOrigins = (values: readonly unknown[]): readonly string[] => [...new Set(
  values
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeOriginPattern)
    .filter((value): value is string => value !== null),
)]

const entryWith = (root: string, origins: readonly string[]): ProjectRegistryEntry =>
  origins.length > 0 ? { root, origins } : { root }

const parseRegistry = (raw: string, path: string): ProjectRegistry => {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value)
    || value.schemaVersion !== 1 || !('projects' in value)
    || typeof value.projects !== 'object' || value.projects === null || Array.isArray(value.projects)) {
    throw new Error(`VibeCheck project registry at ${path} has an unsupported format`)
  }
  const projects = emptyProjects()
  for (const [projectId, entry] of Object.entries(value.projects)) {
    if (typeof entry !== 'object' || entry === null || !('root' in entry)
      || typeof entry.root !== 'string' || entry.root.length === 0) {
      throw new Error(`VibeCheck project registry at ${path} has an invalid entry for "${projectId}"`)
    }
    const origins = 'origins' in entry && Array.isArray(entry.origins)
      ? normalizeOrigins(entry.origins)
      : []
    projects[projectId] = entryWith(entry.root, origins)
  }
  return { schemaVersion: 1, projects }
}

const lookup = (registry: ProjectRegistry, projectId: string): ProjectRegistryEntry | null =>
  Object.hasOwn(registry.projects, projectId) ? registry.projects[projectId] ?? null : null

const withEntry = (
  registry: ProjectRegistry,
  projectId: string,
  entry: ProjectRegistryEntry | null,
): ProjectRegistry => {
  const projects = emptyProjects()
  for (const [id, existing] of Object.entries(registry.projects)) {
    if (id !== projectId) projects[id] = existing
  }
  if (entry !== null) projects[projectId] = entry
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

const registryWrites = new Map<string, Promise<unknown>>()

/** Serializes read-modify-write cycles on one registry file within this process. */
const serialized = async <T>(registryPath: string, run: () => Promise<T>): Promise<T> => {
  const previous = registryWrites.get(registryPath) ?? Promise.resolve()
  const operation = previous.catch(() => undefined).then(run)
  registryWrites.set(registryPath, operation)
  try {
    return await operation
  } finally {
    if (registryWrites.get(registryPath) === operation) registryWrites.delete(registryPath)
  }
}

const canonicalRoot = async (inputRoot: string): Promise<string> => {
  try {
    return await realpath(inputRoot)
  } catch (error) {
    if (isMissing(error)) throw new CliError(`Project root ${inputRoot} does not exist.`, 'Pass --root <path> to the folder that holds your app.')
    throw error
  }
}

/**
 * Records `projectId → root`. Idempotent for the same root (new origins are
 * merged in). A different root is accepted when the old root no longer exists
 * or `force` is set; otherwise it throws ProjectRootConflictError.
 */
export const registerProjectRoot = async (
  registryPath: string,
  projectId: string,
  inputRoot: string,
  options: RegisterProjectOptions = {},
): Promise<RegisterProjectResult> => {
  if (projectId.trim().length === 0) throw new CliError('Project ID cannot be empty')
  const requestedOrigins = normalizeOrigins(options.origins ?? [])
  return serialized(registryPath, async () => {
    const root = await canonicalRoot(inputRoot)
    const registry = await readProjectRegistry(registryPath)
    const existing = lookup(registry, projectId)
    const origins = normalizeOrigins([...(existing?.origins ?? []), ...requestedOrigins])
    const result = (
      status: RegisterProjectStatus,
      previousRoot: string | null = null,
      previousRootMissing = false,
    ): RegisterProjectResult => ({ status, projectId, root, previousRoot, previousRootMissing, origins })

    if (existing && existing.root === root) {
      if (origins.length === (existing.origins ?? []).length) return result('unchanged')
      await writeProjectRegistry(registryPath, withEntry(registry, projectId, entryWith(root, origins)))
      return result('updated')
    }
    if (existing) {
      const previousRootMissing = !await pathExists(existing.root)
      if (!previousRootMissing && options.force !== true) {
        throw new ProjectRootConflictError(projectId, existing.root)
      }
      await writeProjectRegistry(registryPath, withEntry(registry, projectId, entryWith(root, origins)))
      return result('moved', existing.root, previousRootMissing)
    }
    await writeProjectRegistry(registryPath, withEntry(registry, projectId, entryWith(root, origins)))
    return result('created')
  })
}

/** Removes a project ID. Returns the root it was registered at, or null when it was not registered. */
export const unregisterProjectRoot = async (
  registryPath: string,
  projectId: string,
): Promise<string | null> => serialized(registryPath, async () => {
  const registry = await readProjectRegistry(registryPath)
  const existing = lookup(registry, projectId)
  if (!existing) return null
  await writeProjectRegistry(registryPath, withEntry(registry, projectId, null))
  return existing.root
})

export const resolveProjectRoot = async (
  registryPath: string,
  projectId: string,
): Promise<string | null> => lookup(await readProjectRegistry(registryPath), projectId)?.root ?? null

/** Every origin pattern registered for any project (for the hub's origin allowlist). */
export const listRegisteredOrigins = async (registryPath: string): Promise<readonly string[]> => {
  const registry = await readProjectRegistry(registryPath)
  return normalizeOrigins(Object.values(registry.projects).flatMap((entry) => entry.origins ?? []))
}
