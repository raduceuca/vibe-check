'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface CopyButtonProps {
  readonly text: string
  readonly label?: string
  readonly className?: string
  /** Override the success toast (default: Copied). */
  readonly successMessage?: string
  /** Override the failure toast. */
  readonly failureMessage?: string
}

export const CopyButton = ({
  text,
  label = 'Copy',
  className,
  successMessage = 'Copied',
  failureMessage = "Couldn't copy. Select the command instead.",
}: CopyButtonProps) => {
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
  }, [])

  const copy = useCallback(() => {
    const write = navigator.clipboard?.writeText(text)
    Promise.resolve(write)
      .then(() => {
        setStatus('ok')
        if (timerRef.current != null) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setStatus('idle'), 2000)
      })
      .catch(() => {
        setStatus('err')
        if (timerRef.current != null) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setStatus('idle'), 2000)
      })
  }, [text])

  const statusText =
    status === 'ok' ? successMessage : status === 'err' ? failureMessage : null

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        className="vc-btn vc-btn-outline"
        onClick={copy}
        aria-label={`Copy "${text}" to clipboard`}
        style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }}
      >
        {label}
      </button>
      {statusText ? (
        <span role="status" style={{ fontSize: 14, color: 'var(--vc-ink-2)' }}>
          {statusText}
        </span>
      ) : null}
    </span>
  )
}
