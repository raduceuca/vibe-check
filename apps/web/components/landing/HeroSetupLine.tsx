'use client'

import { LANDING_COPY } from '@/lib/landingCopy'
import { AgentPicker, useAgentPicker } from './AgentPicker'
import { CopyButton } from './CopyButton'

export const HeroSetupLine = () => {
  const { agent } = useAgentPicker()
  const command = LANDING_COPY.install.setupCommand(agent)

  return (
    <div
      className="vc-hero-setup"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        marginTop: 22,
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--vc-ink-3)' }}>
        {LANDING_COPY.hero.setupLabel}
      </span>
      <AgentPicker />
      <code
        className="vc-mono"
        style={{
          fontSize: 14,
          padding: '8px 12px',
          background: 'var(--vc-panel)',
          borderRadius: 8,
          color: 'var(--vc-ink)',
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        {command}
      </code>
      <CopyButton text={command} />
    </div>
  )
}
