const DEFAULT_PORT = 4200
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_HUB_URL = 'http://127.0.0.1:4200'

export type CliConfig =
  | { readonly role: 'hub'; readonly host: string; readonly port: number }
  | { readonly role: 'connect'; readonly hubUrl: string }

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
  throw new Error('Usage: vibe-check-mcp hub | vibe-check-mcp connect')
}
