// Verification evidence (since 0.4). The hub moves an issue to 'fixed' only
// when fresh browser snapshots prove its detector looked after the
// verification request and no longer reports it. This module is the single
// definition of "proves": pure, shared by the hub (decides) and the widget
// (explains what it is waiting for).

import { AUDIT_DETECTORS } from './enums.js'
import type {
  AuditDetectorName,
  DetectorKind,
  DetectorName,
  DetectorRunStatus,
  VerificationEvidence,
  VerificationInconclusiveReason,
  VibeIssue,
  VibeSnapshot,
} from './index.js'

export const DETECTOR_KINDS: Readonly<Record<DetectorName, DetectorKind>> = {
  'dom-bloat': 'continuous',
  'duplicate-requests': 'continuous',
  'console-spam': 'continuous',
  'memory-leak': 'continuous',
  'layout-thrashing': 'continuous',
  'unoptimized-images': 'continuous',
  'large-images': 'continuous',
  'long-task-attribution': 'continuous',
  'resource-bloat': 'continuous',
  'web-essentials': 'audit',
  'heavy-library': 'continuous',
  seo: 'audit',
  aeo: 'audit',
}

export const isAuditDetector = (detector: DetectorName): detector is AuditDetectorName =>
  (AUDIT_DETECTORS as readonly DetectorName[]).includes(detector)

/** Clean snapshots (per classifyVerificationSnapshot) needed before an issue is 'fixed'. */
export const VERIFICATION_CLEAN_SNAPSHOTS = 2

/**
 * Legacy (0.3) snapshots carry no detector run status. Their absence only
 * counts once this long has passed since the request, which covers the
 * slowest 0.3 detector windows (console-spam 10 s, memory-leak 30 s).
 */
export const LEGACY_VERIFICATION_DELAY_MS = 30_000

/** When the condition was last observed: `lastSeenAt` from 0.4 producers, else `timestamp`. */
export const issueLastSeenAt = (issue: VibeIssue): number =>
  typeof issue.lastSeenAt === 'number' && Number.isFinite(issue.lastSeenAt)
    ? Math.max(issue.lastSeenAt, issue.timestamp)
    : issue.timestamp

export const getDetectorRunStatus = (
  snapshot: VibeSnapshot,
  detector: DetectorName,
): DetectorRunStatus | null =>
  snapshot.detectors?.find((status) => status.detector === detector) ?? null

export interface VerificationSnapshotInput {
  /** A snapshot from the page the issue was tracked on. */
  readonly snapshot: VibeSnapshot
  /** The issue under verification (its detector and evidence.check are used). */
  readonly issue: VibeIssue
  /** The issue in `snapshot` with the same stable key, if any. */
  readonly present: VibeIssue | undefined
  /**
   * The verification request time, in the snapshot PRODUCER's clock. The hub
   * converts its own request time with the offset between its receive time
   * and `snapshot.timestamp` before calling this.
   */
  readonly requestedAt: number
}

const inconclusive = (reason: VerificationInconclusiveReason): VerificationEvidence =>
  ({ kind: 'inconclusive', reason })

/**
 * What one snapshot says about an issue under verification:
 *
 * - 'recurred': the condition was observed after the request (0.4: the
 *   matching issue's lastSeenAt is after it; legacy: the issue is present in a
 *   snapshot newer than the request, the 0.3 rule). The fix failed.
 * - 'clean': the detector is running, settled, evaluated after the request,
 *   did not lose issues to truncation, could evaluate this check, and does not
 *   report the issue. Legacy snapshots count as clean only after
 *   LEGACY_VERIFICATION_DELAY_MS, with 'estimated' confidence.
 * - 'inconclusive': neither; keep waiting and count nothing.
 */
export const classifyVerificationSnapshot = ({
  snapshot,
  issue,
  present,
  requestedAt,
}: VerificationSnapshotInput): VerificationEvidence => {
  if (snapshot.timestamp <= requestedAt) return inconclusive('snapshot-before-request')
  const legacy = snapshot.detectors === undefined

  if (present !== undefined) {
    if (legacy) return { kind: 'recurred', at: snapshot.timestamp }
    const seen = issueLastSeenAt(present)
    return seen > requestedAt ? { kind: 'recurred', at: seen } : inconclusive('stale-issue')
  }

  if (legacy) {
    return snapshot.timestamp >= requestedAt + LEGACY_VERIFICATION_DELAY_MS
      ? { kind: 'clean', confidence: 'estimated' }
      : inconclusive('legacy-too-soon')
  }
  if (snapshot.truncation?.detectors.includes(issue.detector) === true) return inconclusive('truncated')
  const status = getDetectorRunStatus(snapshot, issue.detector)
  if (status === null) return inconclusive('detector-not-running')
  if (status.settledAt === null) return inconclusive('detector-not-settled')
  if (status.evaluatedAt === null || status.evaluatedAt <= requestedAt) {
    return inconclusive('evaluation-before-request')
  }
  const check = issue.evidence['check']
  if (typeof check === 'string' && status.inconclusiveChecks?.includes(check) === true) {
    return inconclusive('check-not-evaluated')
  }
  return { kind: 'clean', confidence: 'measured' }
}
