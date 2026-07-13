const DEFAULT_PORT = 4200
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_HUB_URL = 'http://127.0.0.1:4200'

export type CliConfig =
  | { readonly role: 'hub'; readonly host: string; readonly port: number }
  | { readonly role: 'connect'; readonly hubUrl: string }
  | {
      readonly role: 'doctor'
      readonly hubUrl: string
      readonly projectId: string | undefined
      readonly json: boolean
    }

const parsePort = (value: string | undefined): number => {
  const port = Number.parseInt(value ?? String(DEFAULT_PORT), 10)
  return Number.isNaN(port) || port < 1 || port > 65_535 ? DEFAULT_PORT : port
}

export const parseCliConfig = (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): CliConfig => {
  const role = argv[0]
  if (role === 'hub') {
    return {
      role,
      host: env['VIBE_CHECK_HOST'] ?? DEFAULT_HOST,
      port: parsePort(env['VIBE_CHECK_PORT']),
    }
  }
  if (role === 'connect') {
    return {
      role,
      hubUrl: env['VIBE_CHECK_HUB_URL'] ?? DEFAULT_HUB_URL,
    }
  }
  if (role === 'doctor') {
    let projectId: string | undefined
    let json = false
    const seen = new Set<string>()
    for (let index = 1; index < argv.length; index += 1) {
      const option = argv[index]
      if (option === '--json') {
        if (seen.has(option)) throw new Error('Duplicate doctor option: --json')
        seen.add(option)
        json = true
        continue
      }
      if (option === '--project') {
        if (seen.has(option)) throw new Error('Duplicate doctor option: --project')
        seen.add(option)
        const value = argv[index + 1]
        if (!value || value.startsWith('--')) throw new Error('Doctor --project requires a project ID')
        projectId = value
        index += 1
        continue
      }
      throw new Error(`Unknown doctor option: ${option ?? ''}`)
    }
    return {
      role,
      hubUrl: env['VIBE_CHECK_HUB_URL'] ?? DEFAULT_HUB_URL,
      projectId,
      json,
    }
  }
  throw new Error('Usage: vibe-check-mcp hub | vibe-check-mcp connect | vibe-check-mcp doctor [--project <id>] [--json]')
}
