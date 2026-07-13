import { parseCliConfig, type CliConfig } from './cli.js'
import { formatDoctorHuman, formatDoctorJson, runDoctor } from './doctor.js'
import {
  runSetup as runSetupCommand,
  type SetupOptions,
  type SetupResult,
} from './setup.js'

export interface CliIo {
  readonly stdout: (value: string) => void
  readonly stderr: (value: string) => void
}

type LongRunningCliConfig = Extract<CliConfig, { readonly role: 'hub' | 'connect' }>

export interface RunMainDependencies {
  readonly cwd?: string
  readonly version?: string
  readonly runSetup?: (options: SetupOptions) => Promise<SetupResult>
}

export type CliRunResult =
  | { readonly kind: 'exit'; readonly code: number }
  | { readonly kind: 'continue'; readonly config: LongRunningCliConfig }

export const runMain = async (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: CliIo,
  dependencies: RunMainDependencies = {},
): Promise<CliRunResult> => {
  const config = parseCliConfig(argv, env)
  if (config.role === 'setup') {
    const version = dependencies.version
    if (!version) throw new Error('Setup requires the running VibeCheck package version')
    const setup = dependencies.runSetup ?? runSetupCommand
    const result = await setup({
      cwd: dependencies.cwd ?? process.cwd(),
      agent: config.agent,
      projectId: config.projectId,
      version,
      dryRun: config.dryRun,
      force: config.force,
    })
    const heading = `VibeCheck setup — ${result.projectId}${config.dryRun ? ' (dry run)' : ''}`
    const lines = [
      heading,
      '',
      'Actions:',
      ...result.actions.map((action, index) => `${index + 1}. ${action}`),
      '',
      'Next steps:',
      ...result.nextSteps.map((step, index) => `${index + 1}. ${step}`),
    ]
    io.stdout(`${lines.join('\n')}\n`)
    return { kind: 'exit', code: 0 }
  }
  if (config.role !== 'doctor') return { kind: 'continue', config }

  const doctorReport = await runDoctor({
    hubUrl: config.hubUrl,
    projectId: config.projectId,
  })
  io.stdout(config.json ? formatDoctorJson(doctorReport) : formatDoctorHuman(doctorReport))
  return { kind: 'exit', code: doctorReport.ok ? 0 : 1 }
}
