import { describe, expect, it } from 'vitest'
import { CLI_COMMANDS, formatUsage, parseCliConfig } from '../cli.js'
import { CliError } from '../fatal.js'

const thrown = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  throw new Error('expected a throw')
}

describe('parseCliConfig', () => {
  it('parses the hub role with defaults, env, and an explicit --port', () => {
    expect(parseCliConfig(['hub'], { VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json' })).toEqual({
      role: 'hub',
      host: '127.0.0.1',
      port: 4200,
      registryPath: '/tmp/projects.json',
      allowedOrigins: [],
      allowedHosts: [],
    })
    expect(parseCliConfig(['hub'], { VIBE_CHECK_PORT: '4312', VIBE_CHECK_HOST: '::1' })).toMatchObject({
      role: 'hub',
      host: '::1',
      port: 4312,
      registryPath: expect.any(String),
    })
    // E2E-06: `hub --port` used to be ignored silently.
    expect(parseCliConfig(['hub', '--port', '4317'], { VIBE_CHECK_PORT: '4319' })).toMatchObject({ port: 4317 })
  })

  it('rejects invalid ports from --port or VIBE_CHECK_PORT instead of falling back to 4200', () => {
    expect(() => parseCliConfig(['hub'], { VIBE_CHECK_PORT: '99999' }))
      .toThrow('VIBE_CHECK_PORT must be a port number from 1 to 65535 (got "99999")')
    expect(() => parseCliConfig(['up', '--port', 'abc'], { VIBE_CHECK_PORT: '4319' }))
      .toThrow('--port must be a port number from 1 to 65535 (got "abc")')
    expect(() => parseCliConfig(['hub', '--port', '0'], {})).toThrow('--port must be a port number')
    expect(() => parseCliConfig(['setup', '--agent', 'codex', '--port', '70000'], {})).toThrow('--port must be a port number')
    expect(parseCliConfig(['hub'], { VIBE_CHECK_PORT: '' })).toMatchObject({ port: 4200 })
    expect(thrown(() => parseCliConfig(['hub', '--port', 'x'], {}))).toBeInstanceOf(CliError)
  })

  it('collects allowed origins from --allow-origin and VIBE_CHECK_ALLOWED_ORIGINS', () => {
    expect(parseCliConfig([
      'up',
      '--project', 'shop',
      '--allow-origin', 'http://MyApp.test:3000/',
      '--allow-origin', 'https://*.dev.example',
      '--allow-host', 'myapp.test:4200',
    ], { VIBE_CHECK_ALLOWED_ORIGINS: 'http://lan.example:5173, http://myapp.test:3000' })).toMatchObject({
      allowedOrigins: ['http://lan.example:5173', 'http://myapp.test:3000', 'https://*.dev.example'],
      allowedHosts: ['myapp.test:4200'],
    })
    expect(() => parseCliConfig(['hub', '--allow-origin', 'myapp.test'], {}))
      .toThrow('--allow-origin needs an origin such as http://myapp.test:3000')
    expect(() => parseCliConfig(['hub'], { VIBE_CHECK_ALLOWED_ORIGINS: 'ftp://nope.example' }))
      .toThrow('VIBE_CHECK_ALLOWED_ORIGINS needs an origin')
    expect(() => parseCliConfig(['hub', '--allow-host', 'http://myapp.test'], {}))
      .toThrow('--allow-host needs a host name')
    expect(() => parseCliConfig(['hub', '--allow-origin'], {})).toThrow('Hub --allow-origin requires an origin')
  })

  it('parses the stdio bridge role and validates VIBE_CHECK_HUB_URL', () => {
    expect(parseCliConfig(['connect'], {})).toEqual({
      role: 'connect',
      hubUrl: 'http://127.0.0.1:4200',
    })
    expect(parseCliConfig(['connect'], { VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4317/' })).toEqual({
      role: 'connect',
      hubUrl: 'http://127.0.0.1:4317',
    })
    expect(() => parseCliConfig(['connect'], { VIBE_CHECK_HUB_URL: 'not a url' }))
      .toThrow('VIBE_CHECK_HUB_URL must be an http:// URL')
  })

  it('parses doctor defaults, explicit project JSON output, and --hub-url', () => {
    expect(parseCliConfig(['doctor'], {})).toEqual({
      role: 'doctor',
      hubUrl: 'http://127.0.0.1:4200',
      projectId: undefined,
      json: false,
    })
    expect(parseCliConfig(['doctor', '--project', 'storefront', '--json'], {
      VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4210',
    })).toEqual({
      role: 'doctor',
      hubUrl: 'http://127.0.0.1:4210',
      projectId: 'storefront',
      json: true,
    })
    // The doctor command the setup pack prints for a non-default hub (getDoctorCommand).
    expect(parseCliConfig(['doctor', '--project', 'storefront', '--hub-url', 'http://127.0.0.1:4317'], {
      VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4210',
    })).toMatchObject({ hubUrl: 'http://127.0.0.1:4317' })
    expect(() => parseCliConfig(['doctor', '--hub-url', 'ftp://x'], {})).toThrow('--hub-url must be an http:// URL')
  })

  it('parses setup with an agent and optional project, port, and origin controls', () => {
    expect(parseCliConfig(['setup', '--agent', 'codex'], {})).toEqual({
      role: 'setup',
      agent: 'codex',
      projectId: undefined,
      dryRun: false,
      force: false,
      hubUrl: 'http://127.0.0.1:4200',
      origins: [],
    })
    expect(parseCliConfig([
      'setup',
      '--agent',
      'cursor',
      '--project',
      'storefront',
      '--dry-run',
      '--force',
      '--port',
      '4317',
      '--origin',
      'http://myapp.test:3000',
    ], {})).toEqual({
      role: 'setup',
      agent: 'cursor',
      projectId: 'storefront',
      dryRun: true,
      force: true,
      hubUrl: 'http://127.0.0.1:4317',
      origins: ['http://myapp.test:3000'],
    })
  })

  it('parses explicit project registration, re-pointing, origins, and unregister', () => {
    expect(parseCliConfig(['register', '--project', 'storefront'], {
      VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json',
    })).toEqual({
      role: 'register',
      projectId: 'storefront',
      root: '.',
      registryPath: '/tmp/projects.json',
      force: false,
      origins: [],
    })
    expect(parseCliConfig([
      'register', '--project', 'admin', '--root', '/workspace/admin', '--force', '--origin', 'http://admin.test:5173',
    ], {})).toMatchObject({
      role: 'register',
      projectId: 'admin',
      root: '/workspace/admin',
      force: true,
      origins: ['http://admin.test:5173'],
    })
    expect(() => parseCliConfig(['register', '--root', '/tmp'], {})).toThrow(
      'Register --project is required',
    )
    expect(parseCliConfig(['unregister', '--project', 'storefront'], {
      VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json',
    })).toEqual({ role: 'unregister', projectId: 'storefront', registryPath: '/tmp/projects.json' })
    expect(() => parseCliConfig(['unregister'], {})).toThrow('Unregister --project is required')
  })

  it('parses project impact stats formats and --hub-url', () => {
    expect(parseCliConfig(['stats', '--project', 'storefront'], {})).toEqual({
      role: 'stats',
      hubUrl: 'http://127.0.0.1:4200',
      projectId: 'storefront',
      format: 'human',
    })
    expect(parseCliConfig(['stats', '--project', 'storefront', '--markdown'], {
      VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4210',
    })).toMatchObject({ format: 'markdown', hubUrl: 'http://127.0.0.1:4210' })
    expect(parseCliConfig(['stats', '--project', 'storefront', '--hub-url', 'http://127.0.0.1:4317'], {}))
      .toMatchObject({ hubUrl: 'http://127.0.0.1:4317' })
    expect(() => parseCliConfig(['stats', '--json'], {})).toThrow('Stats --project is required')
    expect(() => parseCliConfig([
      'stats', '--project', 'storefront', '--json', '--markdown',
    ], {})).toThrow('one output format')
  })

  it('rejects invalid, missing, unknown, and duplicate setup options', () => {
    expect(() => parseCliConfig(['setup'], {})).toThrow('Setup --agent is required')
    expect(() => parseCliConfig(['setup', '--agent'], {})).toThrow('requires an agent')
    expect(() => parseCliConfig(['setup', '--agent', 'windsurf'], {})).toThrow('Unknown setup agent')
    expect(() => parseCliConfig(['setup', '--agent', 'codex', '--project'], {})).toThrow('requires a project ID')
    expect(() => parseCliConfig(['setup', '--agent', 'codex', '--dry-run', '--dry-run'], {})).toThrow('Duplicate setup option')
    expect(() => parseCliConfig(['setup', '--agent', 'codex', '--unknown'], {})).toThrow('Unknown setup option')
  })

  it('lists the valid agents when the agent is unknown', () => {
    expect(() => parseCliConfig(['setup', '--agent', 'claude'], {}))
      .toThrow('Unknown setup agent: claude. Use one of: codex, claude-code, cursor. Did you mean claude-code?')
    const error = thrown(() => parseCliConfig(['up', '--agent', 'windsurf'], {}))
    expect(error).toBeInstanceOf(CliError)
    expect((error as CliError).hint).toBe('Run "vibe-check-mcp up --help" to see its options.')
  })

  it('rejects unknown, incomplete, and duplicate doctor options', () => {
    expect(() => parseCliConfig(['doctor', '--unknown'], {})).toThrow('Unknown doctor option')
    expect(() => parseCliConfig(['doctor', '--project'], {})).toThrow('requires a project ID')
    expect(() => parseCliConfig(['doctor', '--json', '--json'], {})).toThrow('Duplicate doctor option')
    expect(() => parseCliConfig(['doctor', '--project', 'a', '--project', 'b'], {})).toThrow('Duplicate doctor option')
  })

  it('treats no arguments as a usage request and rejects an unknown command plainly', () => {
    expect(parseCliConfig([], {})).toEqual({ role: 'help', topic: null, requested: false })
    const error = thrown(() => parseCliConfig(['serve'], {}))
    expect(error).toBeInstanceOf(CliError)
    expect((error as CliError).message).toBe('Unknown command: serve')
    expect((error as CliError).hint).toContain('vibe-check-mcp --help')
  })

  it('answers --help, -h, help, and per-command help before validating options (P11)', () => {
    for (const flag of ['--help', '-h', 'help']) {
      expect(parseCliConfig([flag], {})).toEqual({ role: 'help', topic: null, requested: true })
    }
    expect(parseCliConfig(['help', 'setup'], {})).toEqual({ role: 'help', topic: 'setup', requested: true })
    expect(parseCliConfig(['setup', '--help'], {})).toEqual({ role: 'help', topic: 'setup', requested: true })
    expect(parseCliConfig(['up', '--port', 'nope', '-h'], {})).toEqual({ role: 'help', topic: 'up', requested: true })
    expect(parseCliConfig(['connect', '--help'], {})).toEqual({ role: 'help', topic: 'connect', requested: true })
  })

  it('answers --version, -v, and version', () => {
    for (const flag of ['--version', '-v', 'version']) {
      expect(parseCliConfig([flag], {})).toEqual({ role: 'version' })
    }
  })

  it('parses up with optional project, agent, and port', () => {
    expect(parseCliConfig(['up'], { VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json' })).toEqual({
      role: 'up',
      host: '127.0.0.1',
      port: 4200,
      registryPath: '/tmp/projects.json',
      allowedOrigins: [],
      allowedHosts: [],
      projectId: undefined,
      agent: undefined,
    })
    expect(parseCliConfig([
      'up', '--project', 'storefront', '--agent', 'cursor', '--port', '4312',
    ], { VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json' })).toEqual({
      role: 'up',
      host: '127.0.0.1',
      port: 4312,
      registryPath: '/tmp/projects.json',
      allowedOrigins: [],
      allowedHosts: [],
      projectId: 'storefront',
      agent: 'cursor',
    })
    expect(() => parseCliConfig(['up', '--agent', 'windsurf'], {})).toThrow('Unknown up agent')
    expect(() => parseCliConfig(['up', '--project'], {})).toThrow('requires a project ID')
  })
})

describe('formatUsage', () => {
  it('prints one command per line, with every command and the environment', () => {
    const usage = formatUsage()
    expect(usage.startsWith('Usage: vibe-check-mcp <command> [options]\n')).toBe(true)
    for (const command of CLI_COMMANDS) {
      expect(usage).toMatch(new RegExp(`^  ${command} +\\S`, 'm'))
    }
    expect(usage).toContain('VIBE_CHECK_HUB_URL')
    expect(usage).toContain('VIBE_CHECK_ALLOWED_ORIGINS')
    expect(usage.split('\n').every((line) => line.length <= 200)).toBe(true)
  })

  it('prints a command\'s own usage and options', () => {
    const up = formatUsage('up')
    expect(up).toContain('Usage: vibe-check-mcp up [--project <id>]')
    expect(up).toContain('--allow-origin <origin>')
    expect(up).toContain('--port <n>')
    expect(formatUsage('doctor')).toContain('--hub-url <url>')
    expect(formatUsage('register')).toContain('--force')
    expect(formatUsage('connect')).not.toContain('Options:')
  })
})
