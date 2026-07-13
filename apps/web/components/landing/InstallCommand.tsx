'use client'

import { useCallback, useState } from 'react'
import { CropTicks, ProofLabel } from '@/components/brand/ProofMarks'

interface InstallCommandProps {
  readonly command: string
}

// The install one-liner rendered as the hero object (not a glossy button),
// with a real copy-to-clipboard control.
export const InstallCommand = ({ command }: InstallCommandProps) => {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    const write = navigator.clipboard?.writeText(command)
    Promise.resolve(write)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        // Clipboard can be unavailable (insecure context / denied permission);
        // the command stays selectable as plain text, so fail quietly.
      })
  }, [command])

  return (
    <div className="vc-cmd" data-vc-proof-surface="install">
      <CropTicks className="vc-cmd-crop" />
      <ProofLabel className="vc-cmd-proof-label">K 100</ProofLabel>
      <span className="vc-cmd-text">
        <span className="vc-prompt">$</span>
        <span>{command}</span>
      </span>
      <button
        type="button"
        className="vc-copy"
        data-copied={copied}
        onClick={copy}
        aria-label={`Copy "${command}" to clipboard`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
