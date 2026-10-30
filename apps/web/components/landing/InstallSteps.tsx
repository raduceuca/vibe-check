'use client'

import Link from 'next/link'
import { AgentPicker, useAgentPicker } from './AgentPicker'
import { CopyButton } from './CopyButton'
import { StepHead } from './StepHead'
import { LANDING_COPY } from '@/lib/landingCopy'

const CodeBlock = ({ text }: { readonly text: string }) => (
  <pre
    className="vc-mono"
    style={{
      margin: '12px 0 0',
      padding: 14,
      background: 'var(--vc-panel)',
      borderRadius: 8,
      fontSize: 14,
      lineHeight: 1.45,
      overflowX: 'auto',
      whiteSpace: 'pre',
    }}
  >
    {text}
  </pre>
)

export const InstallSteps = () => {
  const { agent } = useAgentPicker()
  const setup = LANDING_COPY.install.setupCommand(agent)
  const up = LANDING_COPY.install.upCommand(agent)
  const watch = LANDING_COPY.install.watchInstruction

  return (
    <section id="install" className="vc-section" aria-labelledby="install-heading">
      <StepHead
        id="install-heading"
        title={LANDING_COPY.install.title}
        lede={LANDING_COPY.install.body}
      />

      <div style={{ marginBottom: 18 }}>
        <AgentPicker name="vc-install-agent" />
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 28 }}>
        <li>
          <h3 style={{ margin: 0, fontFamily: 'var(--vc-serif)', fontWeight: 500, fontSize: 22 }}>
            {LANDING_COPY.install.steps[0].title}
          </h3>
          <CodeBlock text={setup} />
          <div style={{ marginTop: 10 }}>
            <CopyButton text={setup} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--vc-ink-2)', lineHeight: 1.45 }}>
            {LANDING_COPY.install.steps[0].note}
          </p>
        </li>

        <li>
          <h3 style={{ margin: 0, fontFamily: 'var(--vc-serif)', fontWeight: 500, fontSize: 22 }}>
            {LANDING_COPY.install.steps[1].title}
          </h3>
          <CodeBlock text={LANDING_COPY.install.mountSnippet} />
          <div style={{ marginTop: 10 }}>
            <CopyButton text={LANDING_COPY.install.mountSnippet} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--vc-ink-2)', lineHeight: 1.45 }}>
            {LANDING_COPY.install.steps[1].note}
          </p>
        </li>

        <li>
          <h3 style={{ margin: 0, fontFamily: 'var(--vc-serif)', fontWeight: 500, fontSize: 22 }}>
            {LANDING_COPY.install.steps[2].title}
          </h3>
          <CodeBlock text={up} />
          <div style={{ marginTop: 10 }}>
            <CopyButton text={up} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--vc-ink-2)', lineHeight: 1.45 }}>
            {LANDING_COPY.install.steps[2].note}
          </p>
        </li>

        <li>
          <h3 style={{ margin: 0, fontFamily: 'var(--vc-serif)', fontWeight: 500, fontSize: 22 }}>
            {LANDING_COPY.install.steps[3].title}
          </h3>
          <CodeBlock text={watch} />
          <div style={{ marginTop: 10 }}>
            <CopyButton
              text={watch}
              successMessage="Copied. Paste it into your agent."
            />
          </div>
        </li>
      </ol>

      <p style={{ marginTop: 22, fontSize: 14, color: 'var(--vc-ink-2)', lineHeight: 1.45 }}>
        {LANDING_COPY.install.overlayAside}
      </p>

      <p className="vc-p" style={{ marginTop: 18 }}>
        {LANDING_COPY.install.closing}
      </p>
      <CodeBlock text={LANDING_COPY.install.demoCommand} />
      <div style={{ marginTop: 10 }}>
        <CopyButton text={LANDING_COPY.install.demoCommand} />
      </div>

      <ul style={{ margin: '22px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {LANDING_COPY.install.links.map((link) => (
          <li key={link.href}>
            <Link className="vc-link" href={link.href} style={{ fontSize: 15 }}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
