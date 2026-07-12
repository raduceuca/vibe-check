import type { DetectorName, Severity, VibeIssue, EvidenceFor } from '../types.js'

let issueCounter = 0

// Generic over the detector so each call site's `evidence` is checked against the
// shared EvidenceFor<D> shape from the protocol. Combined with the typed
// suggestion templates (which read the same shapes), a detector emitting a key
// that a suggestion doesn't expect — or vice-versa — is a compile error, not the
// silent "renders unknown to the agent" drift that shipped before.
export const createIssue = <D extends DetectorName>(
  detector: D,
  severity: Severity,
  title: string,
  description: string,
  evidence: EvidenceFor<D>,
): VibeIssue => ({
  id: `${detector}-${++issueCounter}-${Date.now()}`,
  detector,
  severity,
  title,
  description,
  evidence: evidence as unknown as Record<string, unknown>,
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
})

/** Reset counter — only for testing */
export const resetIssueCounter = (): void => {
  issueCounter = 0
}
