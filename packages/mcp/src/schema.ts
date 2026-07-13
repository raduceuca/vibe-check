import { z } from 'zod'
import { DETECTOR_NAMES, SEVERITIES } from '@wcgw/vibe-check-protocol'
import type {
  DetectorName,
  DispatchIssueRequest,
  ProjectSnapshotEnvelope,
  Severity,
  VibeSnapshot,
} from './types.js'

// The /api/snapshot endpoint is unauthenticated, and an issue's text fields are
// later serialized verbatim into the AI agent's context via the MCP tools. So
// validation is deep and bounded, and its detector/severity enums come from the
// shared protocol arrays — the same source the types derive from — so a new
// detector can't be accepted by the validator while missing from the types (or
// vice-versa).
const MAX_ISSUES = 500
const MAX_STRING_LEN = 2000

const boundedString = z.string().max(MAX_STRING_LEN)
const idSchema = z.string().trim().min(1).max(MAX_STRING_LEN)

export const issueSchema = z.object({
  id: idSchema,
  detector: z.enum([...DETECTOR_NAMES] as [DetectorName, ...DetectorName[]]),
  severity: z.enum([...SEVERITIES] as [Severity, ...Severity[]]),
  title: boundedString,
  description: boundedString,
  evidence: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
  acknowledged: z.boolean(),
  resolved: z.boolean(),
})

// The non-issue stat blocks are read-only telemetry rendered to the agent; we
// require the fields the server actually relies on and accept the rest loosely
// (but the 1MB body cap and the issue bounds keep the payload bounded).
const snapshotSchema = z
  .object({
    timestamp: z.number(),
    domNodeCount: z.number(),
    frameRate: z.object({}).passthrough(),
    resources: z.object({}).passthrough(),
    issues: z.array(issueSchema).max(MAX_ISSUES),
  })
  .passthrough()

export const projectSnapshotEnvelopeSchema = z.object({
  projectId: idSchema,
  instanceId: idSchema,
  origin: boundedString,
  pageUrl: boundedString,
  title: boundedString,
  snapshot: snapshotSchema,
})

export const dispatchIssueRequestSchema = z.object({
  projectId: idSchema,
  instanceId: idSchema,
  pageUrl: boundedString,
  issue: issueSchema,
})

export const leaseRequestSchema = z.object({ sessionId: idSchema })
export const waitRequestSchema = z.object({
  sessionId: idSchema,
  timeoutSeconds: z.number().min(1).max(300),
})

// Returns the validated snapshot, or null if the payload is malformed/oversized.
export const parseSnapshot = (data: unknown): VibeSnapshot | null => {
  const result = snapshotSchema.safeParse(data)
  return result.success ? (data as VibeSnapshot) : null
}

export const parseProjectSnapshotEnvelope = (data: unknown): ProjectSnapshotEnvelope | null => {
  const result = projectSnapshotEnvelopeSchema.safeParse(data)
  return result.success ? (result.data as unknown as ProjectSnapshotEnvelope) : null
}

export const parseDispatchIssueRequest = (data: unknown): DispatchIssueRequest | null => {
  const result = dispatchIssueRequestSchema.safeParse(data)
  return result.success ? (result.data as DispatchIssueRequest) : null
}

export const parseLeaseRequest = (data: unknown): { readonly sessionId: string } | null => {
  const result = leaseRequestSchema.safeParse(data)
  return result.success ? result.data : null
}

export const parseWaitRequest = (
  data: unknown,
): { readonly sessionId: string; readonly timeoutSeconds: number } | null => {
  const result = waitRequestSchema.safeParse(data)
  return result.success ? result.data : null
}
