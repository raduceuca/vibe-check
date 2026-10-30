import { useState, useCallback, useRef, useEffect } from 'react'
import { copyText } from '../utils/clipboard.js'

export const useClipboard = (resetDelayMs = 2000) => {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Resolves true only when the text reached the clipboard; a failed copy never
  // flips the button to "copied".
  const copy = useCallback(async (text: string, id: string): Promise<boolean> => {
    if (!await copyText(text)) return false
    setCopiedId(id)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopiedId(null), resetDelayMs)
    return true
  }, [resetDelayMs])

  return { copiedId, copy }
}
