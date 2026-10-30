import { boundIssue } from '@wcgw/vibe-check-protocol'
import type { DetectorName, Severity, VibeIssue, EvidenceFor } from '../types.js'

let issueCounter = 0

// Generic over the detector so each call site's `evidence` is checked against the
// shared EvidenceFor<D> shape from the protocol. Combined with the typed
// suggestion templates (which read the same shapes), a detector emitting a key
// that a suggestion doesn't expect — or vice-versa — is a compile error, not the
// silent "renders unknown to the agent" drift that shipped before.
//
// Every issue leaves here already clamped to the protocol's PAYLOAD_LIMITS
// (title, description, evidence strings/arrays), so one long URL can never make
// the hub reject a whole snapshot. `observedAt` is when the condition actually
// happened (a resource's load time, a layout shift's start time); it defaults to
// now and becomes both `timestamp` and `lastSeenAt`.
export const createIssue = <D extends DetectorName>(
  detector: D,
  severity: Severity,
  title: string,
  description: string,
  evidence: EvidenceFor<D>,
  observedAt: number = Date.now(),
): VibeIssue => boundIssue({
  id: `${detector}-${++issueCounter}-${Date.now()}`,
  detector,
  severity,
  title,
  description,
  evidence: evidence as unknown as Record<string, unknown>,
  timestamp: observedAt,
  acknowledged: false,
  resolved: false,
  lastSeenAt: observedAt,
  occurrences: 1,
})

/** Reset counter — only for testing */
export const resetIssueCounter = (): void => {
  issueCounter = 0
}
