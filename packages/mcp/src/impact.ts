import type {
  ImpactMetric,
  ImpactMetricKind,
  ImpactReceipt,
  ProjectImpactSummary,
  ProjectWorkflow,
} from './types.js'

const METRIC_COPY: Readonly<Record<ImpactMetricKind, {
  readonly label: string
  readonly scope: string
}>> = {
  'duplicate-requests-removed': {
    label: 'duplicate requests removed',
    scope: 'per observed page load',
  },
  'console-calls-reduced': {
    label: 'console calls reduced',
    scope: 'per observed capture window',
  },
  'dom-nodes-reduced': {
    label: 'DOM nodes reduced',
    scope: 'on the verified page',
  },
  'transfer-kb-reduced': {
    label: 'transfer KB reduced',
    scope: 'per observed page load',
  },
  'blocking-ms-reduced': {
    label: 'blocking time reduced',
    scope: 'per observed capture window',
  },
}

export const impactReceiptId = (
  issueKey: string,
  occurrence: number,
  verificationSnapshotAt: number,
  kind: ImpactMetricKind,
): string => [issueKey, occurrence, verificationSnapshotAt, kind]
  .map((part) => encodeURIComponent(String(part)))
  .join('|')

export const appendImpactReceipts = (
  current: readonly ImpactReceipt[],
  incoming: readonly ImpactReceipt[],
): readonly ImpactReceipt[] => {
  const byId = new Map(current.map((receipt) => [receipt.id, receipt]))
  for (const receipt of incoming) byId.set(receipt.id, receipt)
  return [...byId.values()]
}

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? null
  const left = sorted[middle - 1]
  const right = sorted[middle]
  return left === undefined || right === undefined ? null : (left + right) / 2
}

export const deriveProjectImpact = (
  workflow: ProjectWorkflow,
  receipts: readonly ImpactReceipt[],
): ProjectImpactSummary => {
  const afterReset = (at: number): boolean =>
    workflow.impactResetAt === null || at > workflow.impactResetAt
  const events = workflow.issues.flatMap((tracked) =>
    tracked.events.filter((item) => afterReset(item.at)))
  const fixedKeys = new Set(workflow.issues
    .filter((tracked) => tracked.events.some((item) => item.type === 'fixed' && afterReset(item.at)))
    .map((tracked) => tracked.issueKey))
  const fixTimes = workflow.issues.flatMap((tracked) => tracked.events
    .filter((item) => item.type === 'fixed' && afterReset(item.at))
    .flatMap((fixed) => {
      const sent = tracked.events
        .filter((item) => item.type === 'sent'
          && item.occurrence === fixed.occurrence
          && item.at < fixed.at
          && afterReset(item.at))
        .at(-1)
      return sent && fixed.at > sent.at ? [fixed.at - sent.at] : []
    }))
  const visibleReceipts = receipts.filter((receipt) => afterReset(receipt.verificationSnapshotAt))
  const grouped = new Map<string, ImpactMetric>()
  for (const receipt of visibleReceipts) {
    const key = `${receipt.kind}:${receipt.unit}:${receipt.confidence}`
    const existing = grouped.get(key)
    const copy = METRIC_COPY[receipt.kind]
    grouped.set(key, {
      kind: receipt.kind,
      value: (existing?.value ?? 0) + receipt.delta,
      unit: receipt.unit,
      confidence: receipt.confidence,
      label: copy.label,
      scope: copy.scope,
    })
  }

  return {
    projectId: workflow.projectId,
    detected: events.filter((item) => item.type === 'detected').length,
    sent: events.filter((item) => item.type === 'sent').length,
    uniqueIssuesFixed: fixedKeys.size,
    verifiedFixes: events.filter((item) => item.type === 'fixed').length,
    regressionsCaught: events.filter((item) => item.type === 'regressed').length,
    verificationFailures: events.filter((item) => item.type === 'verification-failed').length,
    medianFixTimeMs: median(fixTimes),
    metrics: [...grouped.values()],
  }
}
