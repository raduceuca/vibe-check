import { useState, useEffect } from 'react'
import type { VibeCheckEngine, VibeIssue } from '@wcgw/vibe-check-core'
import { useVibeCheckEngine } from '../context.js'

const EMPTY_ISSUES: readonly VibeIssue[] = []

export const useDetectedIssues = (
  engine?: VibeCheckEngine | null
): readonly VibeIssue[] => {
  const contextEngine = useVibeCheckEngine()
  const resolvedEngine = engine ?? contextEngine
  const [issues, setIssues] = useState<readonly VibeIssue[]>(EMPTY_ISSUES)

  useEffect(() => {
    if (!resolvedEngine) {
      setIssues(EMPTY_ISSUES)
      return
    }

    const unsubscribe = resolvedEngine.onSnapshot((snapshot) => {
      setIssues(snapshot.issues)
    })

    // Read initial issues
    setIssues(resolvedEngine.getIssues())

    return unsubscribe
  }, [resolvedEngine])

  return issues
}
