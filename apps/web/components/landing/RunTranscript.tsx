import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RECORDING_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../lib/recording')

const resolveTranscriptPath = (): string | null => {
  const candidates = [
    join(RECORDING_DIR, 'roundtrip-transcript.json'),
    join(process.cwd(), 'lib/recording/roundtrip-transcript.json'),
    join(process.cwd(), 'apps/web/lib/recording/roundtrip-transcript.json'),
  ]
  return candidates.find((path) => existsSync(path)) ?? null
}

interface TranscriptEvent {
  readonly kind: 'call' | 'result' | 'panel'
  readonly text: string
}

/** Server component — only renders when the e2e recorder has written the JSON. */
export const RunTranscript = () => {
  const transcriptPath = resolveTranscriptPath()
  if (!transcriptPath) {
    return (
      <div style={{ marginTop: 22 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--vc-serif)',
            fontWeight: 500,
            fontSize: 22,
          }}
        >
          Transcript of the run above
        </h3>
        <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--vc-ink-3)' }}>
          Transcript JSON is written by the e2e recorder. It is not inventable by hand.
        </p>
      </div>
    )
  }

  const events = JSON.parse(readFileSync(transcriptPath, 'utf8')) as readonly TranscriptEvent[]
  const body = events
    .map((event) => {
      if (event.kind === 'call') return `agent ▸ ${event.text}`
      if (event.kind === 'result') return `→ ${event.text}`
      return `panel  ${event.text}`
    })
    .join('\n')

  return (
    <div style={{ marginTop: 22 }}>
      <h3
        style={{
          margin: 0,
          fontFamily: 'var(--vc-serif)',
          fontWeight: 500,
          fontSize: 22,
        }}
      >
        Transcript of the run above
      </h3>
      <pre
        className="vc-mono"
        style={{
          margin: '12px 0 0',
          padding: 14,
          background: 'var(--vc-panel)',
          borderRadius: 8,
          fontSize: 14,
          lineHeight: '22px',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto',
        }}
      >
        {body}
      </pre>
    </div>
  )
}
