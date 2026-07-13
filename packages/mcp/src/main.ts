import { parseCliConfig, type CliConfig } from './cli.js'
import { formatDoctorHuman, formatDoctorJson, runDoctor } from './doctor.js'

export interface CliIo {
  readonly stdout: (value: string) => void
  readonly stderr: (value: string) => void
}

type LongRunningCliConfig = Extract<CliConfig, { readonly role: 'hub' | 'connect' }>

export type CliRunResult =
  | { readonly kind: 'exit'; readonly code: number }
  | { readonly kind: 'continue'; readonly config: LongRunningCliConfig }

export const runMain = async (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: CliIo,
): Promise<CliRunResult> => {
  const config = parseCliConfig(argv, env)
  if (config.role !== 'doctor') return { kind: 'continue', config }

  const doctorReport = await runDoctor({
    hubUrl: config.hubUrl,
    projectId: config.projectId,
  })
  io.stdout(config.json ? formatDoctorJson(doctorReport) : formatDoctorHuman(doctorReport))
  return { kind: 'exit', code: doctorReport.ok ? 0 : 1 }
}
