import type { DetectorName, Severity, VibeIssue } from '../types.js'

let issueCounter = 0

export const createIssue = (
  detector: DetectorName,
  severity: Severity,
  title: string,
  description: string,
  evidence: Record<string, unknown>,
): VibeIssue => ({
  id: `${detector}-${++issueCounter}-${Date.now()}`,
  detector,
  severity,
  title,
  description,
  evidence,
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
})

/** Reset counter — only for testing */
export const resetIssueCounter = (): void => {
  issueCounter = 0
}
