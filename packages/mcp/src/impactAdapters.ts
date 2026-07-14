import { normalizePageUrl } from '@wcgw/vibe-check-protocol'
import { impactReceiptId } from './impact.js'
import type {
  ImpactConfidence,
  ImpactMetricKind,
  ImpactReceipt,
  ImpactUnit,
  ProjectSnapshotEnvelope,
  TrackedProjectIssue,
  VibeSnapshot,
} from './types.js'

export interface ImpactBaseline {
  readonly pageUrl: string
  readonly snapshot: VibeSnapshot
}

export interface ImpactComparison {
  readonly tracked: TrackedProjectIssue
  readonly baseline: ImpactBaseline
  readonly verification: ProjectSnapshotEnvelope
  readonly verifyingIssueKeys: readonly string[]
}

const blockingDuration = (snapshot: VibeSnapshot): number =>
  snapshot.longFrames.entries.reduce((total, entry) => total + entry.blockingDuration, 0)

const createReceipt = (input: {
  readonly issueKey: string
  readonly tracked: TrackedProjectIssue
  readonly baselineSnapshotAt: number
  readonly verificationSnapshotAt: number
  readonly kind: ImpactMetricKind
  readonly before: number
  readonly after: number
  readonly unit: ImpactUnit
  readonly confidence?: ImpactConfidence
}): ImpactReceipt => ({
  id: impactReceiptId(
    input.issueKey,
    input.tracked.occurrenceCount,
    input.verificationSnapshotAt,
    input.kind,
  ),
  issueKey: input.issueKey,
  occurrence: input.tracked.occurrenceCount,
  detector: input.tracked.issue.detector,
  pageUrl: input.tracked.pageUrl,
  baselineSnapshotAt: input.baselineSnapshotAt,
  verificationSnapshotAt: input.verificationSnapshotAt,
  kind: input.kind,
  before: input.before,
  after: input.after,
  delta: input.before - input.after,
  unit: input.unit,
  confidence: input.confidence ?? 'measured',
})

export const createImpactReceipts = ({
  tracked,
  baseline,
  verification,
  verifyingIssueKeys,
}: ImpactComparison): readonly ImpactReceipt[] => {
  if (normalizePageUrl(tracked.pageUrl) !== normalizePageUrl(baseline.pageUrl)
    || normalizePageUrl(baseline.pageUrl) !== normalizePageUrl(verification.pageUrl)
    || verification.snapshot.timestamp <= baseline.snapshot.timestamp) return []

  const receipts: ImpactReceipt[] = []
  const add = (
    issueKey: string,
    kind: ImpactMetricKind,
    before: number,
    after: number,
    unit: ImpactUnit,
  ): void => {
    if (!Number.isFinite(before) || !Number.isFinite(after) || before <= after) return
    receipts.push(createReceipt({
      issueKey,
      tracked,
      baselineSnapshotAt: baseline.snapshot.timestamp,
      verificationSnapshotAt: verification.snapshot.timestamp,
      kind,
      before,
      after,
      unit,
    }))
  }

  if (tracked.issue.detector === 'duplicate-requests') {
    const count = Number(tracked.issue.evidence['count'] ?? 0)
    add(tracked.issueKey, 'duplicate-requests-removed', Math.max(0, count - 1), 0, 'requests')
  }

  if (tracked.issue.detector === 'console-spam') {
    const callCount = Number(tracked.issue.evidence['callCount'] ?? 0)
    if (baseline.snapshot.console.totalCount === callCount) {
      add(
        tracked.issueKey,
        'console-calls-reduced',
        callCount,
        verification.snapshot.console.totalCount,
        'calls',
      )
    }
  }

  const sortedKeys = [...new Set(verifyingIssueKeys)].sort()
  const batchKey = `batch:${sortedKeys.join(',')}`
  if (sortedKeys[0] === tracked.issueKey) {
    add(batchKey, 'dom-nodes-reduced', baseline.snapshot.domNodeCount, verification.snapshot.domNodeCount, 'nodes')
    add(
      batchKey,
      'transfer-kb-reduced',
      baseline.snapshot.resources.totalTransferKB,
      verification.snapshot.resources.totalTransferKB,
      'KB',
    )
    add(
      batchKey,
      'blocking-ms-reduced',
      blockingDuration(baseline.snapshot),
      blockingDuration(verification.snapshot),
      'ms',
    )
  }

  return receipts
}
