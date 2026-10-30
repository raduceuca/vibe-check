import { z } from 'zod'
import {
  DETECTOR_NAMES,
  HUB_INTAKE_LIMITS,
  SEVERITIES,
  boundIssue,
  boundSnapshot,
  truncateText,
} from '@wcgw/vibe-check-protocol'
import type {
  DetectorName,
  DetectorRunStatus,
  DispatchIssueRequest,
  ProjectSnapshotEnvelope,
  Severity,
  VibeSnapshot,
} from './types.js'

// The /api/snapshot endpoint takes browser input, and an issue's text fields
// are later serialized verbatim into the AI agent's context via the MCP tools.
// So validation is structural (wrong shapes are rejected) and size is bounded
// by truncation, not rejection (since 0.4): a page that has piled up many
// issues or a long console line still reaches the hub, clamped to
// HUB_INTAKE_LIMITS, with `snapshot.truncation` saying which detectors lost
// issues so their absence is never taken as verification evidence. The
// detector/severity enums come from the shared protocol arrays, the same
// source the types derive from.

// Identifiers are matched exactly elsewhere (leases, stable keys, receipts),
// so an absurdly long one is a structural error rather than text to shorten.
const MAX_ID_CHARS = 2_000
const MAX_CLIENT_NAME_CHARS = 100

const idSchema = z.string().trim().min(1).max(MAX_ID_CHARS)
const detectorSchema = z.enum([...DETECTOR_NAMES] as [DetectorName, ...DetectorName[]])
const severitySchema = z.enum([...SEVERITIES] as [Severity, ...Severity[]])

/** A stat that never rejects a snapshot: null, NaN-from-JSON or missing becomes 0. */
const stat = z.number().catch(0)

/** An array whose malformed items are dropped instead of rejecting the snapshot. */
const arrayOf = <T extends z.ZodTypeAny>(item: T) => z.array(z.unknown()).catch([])
  .transform((items): z.output<T>[] => items.flatMap((value) => {
    const parsed = item.safeParse(value)
    return parsed.success ? [parsed.data as z.output<T>] : []
  }))

export const issueSchema = z.object({
  id: idSchema,
  detector: detectorSchema,
  severity: severitySchema,
  title: z.string(),
  description: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
  acknowledged: z.boolean(),
  resolved: z.boolean(),
  lastSeenAt: z.number().optional().catch(undefined),
  occurrences: z.number().optional().catch(undefined),
})

const scriptSchema = z.object({
  sourceURL: z.string(),
  sourceFunctionName: z.string(),
  duration: stat,
})

const longFrameEntrySchema = z.object({
  duration: stat,
  startTime: stat,
  blockingDuration: stat,
  scripts: arrayOf(scriptSchema),
})

const vitalSchema = z.object({
  value: z.number(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
}).nullable().catch(null)

const largeResourceSchema = z.object({
  url: z.string(),
  transferSizeKB: stat,
  type: z.string(),
})

const detectorRunStatusSchema = z.object({
  detector: detectorSchema,
  kind: z.enum(['continuous', 'audit']),
  observingSince: z.number(),
  settledAt: z.number().nullable(),
  evaluatedAt: z.number().nullable(),
  inconclusiveChecks: z.array(z.string()).optional(),
})

const knownDetectors = (values: readonly unknown[]): DetectorName[] =>
  values.filter((value): value is DetectorName =>
    typeof value === 'string' && (DETECTOR_NAMES as readonly string[]).includes(value))

// A truncation block the hub cannot read is treated as "every detector lost
// issues": nothing in that snapshot counts as verification evidence.
const unreadableTruncation = {
  droppedIssues: 0,
  detectors: [...DETECTOR_NAMES],
  truncatedFields: 0,
}

// Top-level keys the hub does not know are stripped (zod's default). The stat
// blocks the hub reads are typed; frameRate and resources stay required as in
// 0.3, the others fall back to empty values so a sparse producer cannot crash
// impact or bounding code later.
const snapshotSchema = z.object({
  timestamp: z.number(),
  domNodeCount: z.number(),
  frameRate: z.object({
    fps: stat,
    avgFrameTime: stat,
    maxFrameTime: stat,
    droppedFrames: stat,
    smoothness: stat,
  }),
  longFrames: z.object({
    count: stat,
    entries: arrayOf(longFrameEntrySchema),
    worstFrame: stat,
  }).catch({ count: 0, entries: [], worstFrame: 0 }),
  webVitals: z.object({
    lcp: vitalSchema,
    inp: vitalSchema,
    cls: vitalSchema,
  }).catch({ lcp: null, inp: null, cls: null }),
  memory: z.object({
    jsHeapSizeMB: stat,
    totalHeapSizeMB: stat,
    usedPct: stat,
  }).nullable().catch(null),
  resources: z.object({
    totalTransferKB: stat,
    jsTransferKB: stat,
    cssTransferKB: stat,
    imageTransferKB: stat,
    fontTransferKB: stat,
    resourceCount: stat,
    largeResources: arrayOf(largeResourceSchema),
  }),
  console: z.object({
    logCount: stat,
    warnCount: stat,
    errorCount: stat,
    totalCount: stat,
  }).catch({ logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 }),
  issues: z.array(issueSchema),
  engineStartedAt: z.number().optional().catch(undefined),
  // Malformed entries are dropped, so their detector reads as "not running"
  // (never evidence). A malformed list reads as empty for the same reason.
  detectors: arrayOf(detectorRunStatusSchema).optional().catch([]),
  truncation: z.object({
    droppedIssues: stat,
    detectors: z.array(z.unknown()).catch([...DETECTOR_NAMES]).transform(knownDetectors),
    truncatedFields: stat,
  }).optional().catch(unreadableTruncation),
})

export const projectSnapshotEnvelopeSchema = z.object({
  projectId: idSchema,
  instanceId: idSchema,
  origin: z.string(),
  pageUrl: z.string(),
  title: z.string(),
  snapshot: snapshotSchema,
})

export const dispatchIssueRequestSchema = z.object({
  projectId: idSchema,
  instanceId: idSchema,
  pageUrl: z.string(),
  issue: issueSchema,
})

export const leaseRequestSchema = z.object({
  sessionId: idSchema,
  clientName: z.string().optional().catch(undefined),
})
export const waitRequestSchema = z.object({
  sessionId: idSchema,
  timeoutSeconds: z.number().min(1).max(300),
})
export const deliveryReceiptRequestSchema = z.object({
  sessionId: idSchema,
  deliveryId: idSchema,
})
export const issueActionRequestSchema = z.object({ sessionId: idSchema })

// Optional 0.4 fields that were absent stay absent (a 0.3 snapshot keeps
// reading as legacy evidence).
const toSnapshot = (parsed: z.output<typeof snapshotSchema>): VibeSnapshot => {
  const { detectors, truncation, engineStartedAt, ...rest } = parsed
  const runStatus: readonly DetectorRunStatus[] | undefined = detectors
  return {
    ...rest,
    ...(engineStartedAt === undefined ? {} : { engineStartedAt }),
    ...(runStatus === undefined ? {} : { detectors: runStatus }),
    ...(truncation === undefined ? {} : { truncation }),
  }
}

/** Validates a snapshot and clamps it to HUB_INTAKE_LIMITS; null when it is structurally invalid. */
export const parseSnapshot = (data: unknown): VibeSnapshot | null => {
  const result = snapshotSchema.safeParse(data)
  return result.success ? boundSnapshot(toSnapshot(result.data), HUB_INTAKE_LIMITS) : null
}

export const parseProjectSnapshotEnvelope = (data: unknown): ProjectSnapshotEnvelope | null => {
  const result = projectSnapshotEnvelopeSchema.safeParse(data)
  if (!result.success) return null
  const envelope = result.data
  return {
    projectId: envelope.projectId,
    instanceId: envelope.instanceId,
    origin: truncateText(envelope.origin, HUB_INTAKE_LIMITS.maxEnvelopeTextChars),
    pageUrl: truncateText(envelope.pageUrl, HUB_INTAKE_LIMITS.maxEnvelopeTextChars),
    title: truncateText(envelope.title, HUB_INTAKE_LIMITS.maxTitleChars),
    snapshot: boundSnapshot(toSnapshot(envelope.snapshot), HUB_INTAKE_LIMITS),
  }
}

export const parseDispatchIssueRequest = (data: unknown): DispatchIssueRequest | null => {
  const result = dispatchIssueRequestSchema.safeParse(data)
  if (!result.success) return null
  return {
    ...result.data,
    pageUrl: truncateText(result.data.pageUrl, HUB_INTAKE_LIMITS.maxEnvelopeTextChars),
    issue: boundIssue(result.data.issue, HUB_INTAKE_LIMITS),
  }
}

export const parseLeaseRequest = (
  data: unknown,
): { readonly sessionId: string; readonly clientName?: string } | null => {
  const result = leaseRequestSchema.safeParse(data)
  if (!result.success) return null
  const clientName = result.data.clientName?.trim()
  return clientName
    ? { sessionId: result.data.sessionId, clientName: truncateText(clientName, MAX_CLIENT_NAME_CHARS) }
    : { sessionId: result.data.sessionId }
}

export const parseWaitRequest = (
  data: unknown,
): { readonly sessionId: string; readonly timeoutSeconds: number } | null => {
  const result = waitRequestSchema.safeParse(data)
  return result.success ? result.data : null
}

export const parseDeliveryReceiptRequest = (
  data: unknown,
): { readonly sessionId: string; readonly deliveryId: string } | null => {
  const result = deliveryReceiptRequestSchema.safeParse(data)
  return result.success ? result.data : null
}

export const parseIssueActionRequest = (data: unknown): { readonly sessionId: string } | null => {
  const result = issueActionRequestSchema.safeParse(data)
  return result.success ? result.data : null
}
