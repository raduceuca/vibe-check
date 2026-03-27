import { useState, useEffect, useCallback } from 'react'
import { VibeCheck, type VibeCheckProps } from './VibeCheck.js'

export interface PerfToggleProps {
  readonly shortcut?: string
  readonly vibeCheckProps?: Omit<VibeCheckProps, 'enabled'>
}

const parseShortcut = (shortcut: string): { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string } => {
  const parts = shortcut.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key,
  }
}

const matchesShortcut = (
  event: KeyboardEvent,
  parsed: { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string }
): boolean =>
  event.ctrlKey === parsed.ctrl &&
  event.shiftKey === parsed.shift &&
  event.altKey === parsed.alt &&
  event.metaKey === parsed.meta &&
  event.key.toLowerCase() === parsed.key

export const PerfToggle = ({
  shortcut = 'ctrl+shift+p',
  vibeCheckProps,
}: PerfToggleProps) => {
  const [visible, setVisible] = useState(false)

  const parsed = parseShortcut(shortcut)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (matchesShortcut(event, parsed)) {
        event.preventDefault()
        setVisible((prev) => !prev)
      }
    },
    [parsed.ctrl, parsed.shift, parsed.alt, parsed.meta, parsed.key]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  if (!visible) return null

  return <VibeCheck {...vibeCheckProps} enabled />
}
