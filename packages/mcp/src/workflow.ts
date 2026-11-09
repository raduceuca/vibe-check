import {
  VERIFICATION_CLEAN_SNAPSHOTS,
  classifyVerificationSnapshot,
  getStableIssueKey,
  normalizePageUrl,
} from '@wcgw/vibe-check-protocol'
import type {
  ImpactConfidence,
  IssueVerificationStatus,
  IssueWorkflowEvent,
  ProjectSnapshotEnvelope,
  ProjectWorkflow,
  TrackedProjectIssue,
  VerificationInconclusiveReason,
  VibeIssue,
} from './types.js'

const MAX_WORKFLOW_ISSUES = 200
const MAX_EVENTS_PER_ISSUE = 50
const MAX_OCCURRENCE_IDS = 20

export const createProjectWorkflow = (projectId: string): ProjectWorkflow => ({
  schemaVersion: 1,
  projectId,
  revision: 0,
  impactResetAt: null,
  impactReceipts: [],
  issues: [],
})

const appendEvent = (
  tracked: TrackedProjectIssue,
  event: IssueWorkflowEvent,
): TrackedProjectIssue => ({
  ...tracked,
  events: [...tracked.events, event].slice(-MAX_EVENTS_PER_ISSUE),
})

const event = (
  type: IssueWorkflowEvent['type'],
  at: number,
  occurrence: number,
): IssueWorkflowEvent => ({ type, at, occurrence })

const latestEventAt = (
  tracked: TrackedProjectIssue,
  type: IssueWorkflowEvent['type'],
): number => {
  for (let index = tracked.events.length - 1; index >= 0; index -= 1) {
    const item = tracked.events[index]
    if (item?.type === type) return item.at
  }
  return 0
}

export const compactWorkflowIssues = (
  issues: readonly TrackedProjectIssue[],
): readonly TrackedProjectIssue[] => {
  if (issues.length <= MAX_WORKFLOW_ISSUES) return issues
  const protectedIssues = issues
    .filter((issue) => issue.phase !== 'detected')
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  const transient = issues
    .filter((issue) => issue.phase === 'detected')
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  return [...protectedIssues, ...transient].slice(0, MAX_WORKFLOW_ISSUES)
}

const revise = (
  workflow: ProjectWorkflow,
  issues: readonly TrackedProjectIssue[],
): ProjectWorkflow => ({
  ...workflow,
  revision: workflow.revision + 1,
  issues: compactWorkflowIssues(issues),
})

const newTrackedIssue = (
  workflow: ProjectWorkflow,
  pageUrl: string,
  issue: VibeIssue,
  now: number,
): TrackedProjectIssue => ({
  issueKey: getStableIssueKey(workflow.projectId, pageUrl, issue),
  pageUrl,
  issue,
  occurrenceIds: [issue.id],
  phase: 'detected',
  occurrenceCount: 1,
  regressionCount: 0,
  verificationMisses: 0,
  firstSeenAt: now,
  lastSeenAt: now,
  events: [event('detected', now, 1)],
})

// ── Verification evidence ───────────────────────────────────────────────────

/**
 * Hub-side progress of one pending verification (kept in memory, not
 * persisted): which clean snapshot was counted last, the weakest confidence
 * among the counted ones, and why the latest snapshot did not count.
 */
export interface VerificationTrace {
  /** Producer timestamp of the last snapshot counted as clean, so a snapshot is never counted twice. */
  readonly lastCleanAt: number | null
  readonly confidence: ImpactConfidence
  readonly waitingFor: VerificationInconclusiveReason | null
}

export type VerificationTraces = ReadonlyMap<string, VerificationTrace>

export interface WorkflowSnapshotResult {
  readonly workflow: ProjectWorkflow
  readonly traces: VerificationTraces
  /**
   * True when a phase, an event, an occurrence id or a tracked issue changed;
   * the revision moved and the workflow is worth persisting.
   */
  readonly changed: boolean
  /** True when only observation data (the latest issue copy, lastSeenAt) changed; the revision did not move. */
  readonly touched: boolean
}

type Change = 'none' | 'touch' | 'meaningful'

interface Step {
  readonly tracked: TrackedProjectIssue
  readonly change: Change
  /** undefined: leave the trace alone; null: drop it. */
  readonly trace?: VerificationTrace | null
}

const weaker = (a: ImpactConfidence, b: ImpactConfidence): ImpactConfidence =>
  a === 'estimated' || b === 'estimated' ? 'estimated' : 'measured'

const withOccurrence = (
  tracked: TrackedProjectIssue,
  issue: VibeIssue,
): readonly string[] => tracked.occurrenceIds.includes(issue.id)
  ? tracked.occurrenceIds
  : [...tracked.occurrenceIds, issue.id].slice(-MAX_OCCURRENCE_IDS)

const observePresent = (
  tracked: TrackedProjectIssue,
  issue: VibeIssue,
  now: number,
): Step => {
  const occurrenceIds = withOccurrence(tracked, issue)
  if (tracked.phase === 'fixed') {
    const occurrenceCount = tracked.occurrenceCount + 1
    return {
      tracked: appendEvent({
        ...tracked,
        issue,
        occurrenceIds,
        phase: 'regressed',
        occurrenceCount,
        regressionCount: tracked.regressionCount + 1,
        verificationMisses: 0,
        lastSeenAt: now,
      }, event('regressed', now, occurrenceCount)),
      change: 'meaningful',
    }
  }
  return {
    tracked: { ...tracked, issue, occurrenceIds, lastSeenAt: now },
    change: occurrenceIds === tracked.occurrenceIds ? 'touch' : 'meaningful',
  }
}

// One snapshot from the tracked page, for an issue in 'verifying'. The rule
// itself is classifyVerificationSnapshot (protocol); this applies its verdict.
const verifyStep = (
  tracked: TrackedProjectIssue,
  present: VibeIssue | undefined,
  envelope: ProjectSnapshotEnvelope,
  now: number,
  trace: VerificationTrace | undefined,
): Step => {
  const snapshot = envelope.snapshot
  // The request was stamped with the hub clock; compare in the producer's.
  const requestedAt = latestEventAt(tracked, 'verification-requested') - (now - snapshot.timestamp)
  const evidence = classifyVerificationSnapshot({ snapshot, issue: tracked.issue, present, requestedAt })

  if (evidence.kind === 'recurred') {
    const issue = present ?? tracked.issue
    return {
      tracked: appendEvent({
        ...tracked,
        issue,
        occurrenceIds: withOccurrence(tracked, issue),
        phase: 'working',
        verificationMisses: 0,
        lastSeenAt: present ? now : tracked.lastSeenAt,
      }, event('verification-failed', now, tracked.occurrenceCount)),
      change: 'meaningful',
      trace: null,
    }
  }

  if (evidence.kind === 'inconclusive') {
    const nextTrace: VerificationTrace = {
      lastCleanAt: trace?.lastCleanAt ?? null,
      confidence: trace?.confidence ?? 'measured',
      waitingFor: evidence.reason,
    }
    if (!present) return { tracked, change: 'none', trace: nextTrace }
    const observed = observePresent(tracked, present, now)
    return { ...observed, trace: nextTrace }
  }

  // Clean. Count each producer snapshot at most once.
  if (trace !== undefined && trace.lastCleanAt !== null && snapshot.timestamp <= trace.lastCleanAt) {
    return { tracked, change: 'none' }
  }
  const confidence = weaker(trace?.confidence ?? 'measured', evidence.confidence)
  const nextTrace: VerificationTrace = { lastCleanAt: snapshot.timestamp, confidence, waitingFor: null }
  const verificationMisses = tracked.verificationMisses + 1
  if (verificationMisses < VERIFICATION_CLEAN_SNAPSHOTS) {
    return { tracked: { ...tracked, verificationMisses }, change: 'meaningful', trace: nextTrace }
  }
  return {
    tracked: appendEvent({
      ...tracked,
      phase: 'fixed',
      verificationMisses,
    }, event('fixed', now, tracked.occurrenceCount)),
    change: 'meaningful',
    trace: nextTrace,
  }
}

/**
 * Applies one browser snapshot to the workflow: tracks new issues, notices
 * regressions, and advances verifications by browser evidence
 * (classifyVerificationSnapshot). Only phase/event/identity changes move the
 * revision; a still-present issue only refreshes its observation data.
 */
export const applyWorkflowSnapshot = (
  workflow: ProjectWorkflow,
  envelope: ProjectSnapshotEnvelope,
  now: number,
  traces: VerificationTraces = new Map(),
): WorkflowSnapshotResult => {
  if (workflow.projectId !== envelope.projectId) {
    return { workflow, traces, changed: false, touched: false }
  }
  const pageUrl = normalizePageUrl(envelope.pageUrl)
  const incoming = new Map(envelope.snapshot.issues.map((issue) => [
    getStableIssueKey(workflow.projectId, pageUrl, issue),
    issue,
  ]))
  const knownKeys = new Set(workflow.issues.map((tracked) => tracked.issueKey))
  let meaningful = false
  let touched = false
  let nextTraces: Map<string, VerificationTrace> | null = null
  const setTrace = (issueKey: string, trace: VerificationTrace | null | undefined): void => {
    if (trace === undefined) return
    nextTraces ??= new Map(traces)
    if (trace === null) nextTraces.delete(issueKey)
    else nextTraces.set(issueKey, trace)
  }

  const existing = workflow.issues.map((tracked) => {
    if (tracked.pageUrl !== pageUrl) return tracked
    const present = incoming.get(tracked.issueKey)
    const step: Step = tracked.phase === 'verifying'
      ? verifyStep(tracked, present, envelope, now, traces.get(tracked.issueKey))
      : present
        ? observePresent(tracked, present, now)
        : { tracked, change: 'none' }
    setTrace(tracked.issueKey, step.trace)
    if (step.change === 'meaningful') meaningful = true
    if (step.change === 'touch') touched = true
    return step.tracked
  })
  const additions = [...incoming.entries()]
    .filter(([issueKey]) => !knownKeys.has(issueKey))
    .map(([, issue]) => newTrackedIssue(workflow, pageUrl, issue, now))
  if (additions.length > 0) meaningful = true

  const resultTraces: VerificationTraces = nextTraces ?? traces
  if (meaningful) {
    return { workflow: revise(workflow, [...existing, ...additions]), traces: resultTraces, changed: true, touched }
  }
  if (touched) {
    return { workflow: { ...workflow, issues: existing }, traces: resultTraces, changed: false, touched }
  }
  return { workflow, traces: resultTraces, changed: false, touched: false }
}

/** Compatibility wrapper (0.3 API): the workflow after one snapshot. */
export const recordWorkflowSnapshot = (
  workflow: ProjectWorkflow,
  envelope: ProjectSnapshotEnvelope,
  now: number,
): ProjectWorkflow => applyWorkflowSnapshot(workflow, envelope, now).workflow

// ── Actions ─────────────────────────────────────────────────────────────────

const updateIssue = (
  workflow: ProjectWorkflow,
  predicate: (tracked: TrackedProjectIssue) => boolean,
  update: (tracked: TrackedProjectIssue) => TrackedProjectIssue,
): ProjectWorkflow => {
  let changed = false
  const issues = workflow.issues.map((tracked) => {
    if (!predicate(tracked)) return tracked
    const next = update(tracked)
    if (next !== tracked) changed = true
    return next
  })
  return changed ? revise(workflow, issues) : workflow
}

export const markWorkflowDispatched = (
  workflow: ProjectWorkflow,
  issueKey: string,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.issueKey === issueKey,
  (tracked) => tracked.phase === 'sent' ? tracked : appendEvent({
    ...tracked,
    phase: 'sent',
  }, event('sent', now, tracked.occurrenceCount)),
)

const toWorking = (now: number) => (tracked: TrackedProjectIssue): TrackedProjectIssue =>
  tracked.phase === 'working' ? tracked : appendEvent({
    ...tracked,
    phase: 'working',
  }, event('working', now, tracked.occurrenceCount))

/** 0.3 API: matches by occurrence id. The hub uses markWorkflowWorkingByKey. */
export const markWorkflowWorking = (
  workflow: ProjectWorkflow,
  issueId: string,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.occurrenceIds.includes(issueId),
  toWorking(now),
)

/**
 * The agent has the issue (delivery receipt or acknowledge). An issue already
 * under verification or verified keeps that phase: acknowledging never undoes
 * browser evidence.
 */
export const markWorkflowWorkingByKey = (
  workflow: ProjectWorkflow,
  issueKey: string,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.issueKey === issueKey && tracked.phase !== 'verifying' && tracked.phase !== 'fixed',
  toWorking(now),
)

const toVerifying = (now: number) => (tracked: TrackedProjectIssue): TrackedProjectIssue =>
  tracked.phase === 'verifying' || tracked.phase === 'fixed'
    ? tracked
    : appendEvent({
      ...tracked,
      phase: 'verifying',
      verificationMisses: 0,
    }, event('verification-requested', now, tracked.occurrenceCount))

/** 0.3 API: matches by occurrence id. The hub uses requestWorkflowVerificationByKey. */
export const requestWorkflowVerification = (
  workflow: ProjectWorkflow,
  issueId: string,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.occurrenceIds.includes(issueId),
  toVerifying(now),
)

export const requestWorkflowVerificationByKey = (
  workflow: ProjectWorkflow,
  issueKey: string,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.issueKey === issueKey,
  toVerifying(now),
)

/**
 * After loading persisted state: an issue still in 'sent' whose dispatch is
 * not in the restored queue was lost (0.3 hubs kept the queue in memory).
 * It goes back to 'detected' with a 'dispatch-dropped' event so the widget
 * offers Send again instead of claiming an agent has it.
 */
export const dropUndeliveredDispatches = (
  workflow: ProjectWorkflow,
  queuedIssueKeys: ReadonlySet<string>,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.phase === 'sent' && !queuedIssueKeys.has(tracked.issueKey),
  (tracked) => appendEvent({
    ...tracked,
    phase: 'detected',
  }, event('dispatch-dropped', now, tracked.occurrenceCount)),
)

/**
 * Merges a persisted workflow into one the hub built in memory before it knew
 * the project's root (registered while the hub ran). Live tracked issues win
 * per key; the persisted ledger (receipts, reset) is kept.
 */
export const mergeRestoredWorkflow = (
  live: ProjectWorkflow,
  restored: ProjectWorkflow,
): ProjectWorkflow => {
  if (live.projectId !== restored.projectId) return live
  const liveKeys = new Set(live.issues.map((tracked) => tracked.issueKey))
  const receipts = new Map(restored.impactReceipts.map((receipt) => [receipt.id, receipt]))
  for (const receipt of live.impactReceipts) receipts.set(receipt.id, receipt)
  return {
    ...live,
    revision: Math.max(live.revision, restored.revision) + 1,
    impactResetAt: live.impactResetAt ?? restored.impactResetAt,
    impactReceipts: [...receipts.values()].slice(-1_000),
    issues: compactWorkflowIssues([
      ...live.issues,
      ...restored.issues.filter((tracked) => !liveKeys.has(tracked.issueKey)),
    ]),
  }
}

// ── Verification status (read model for agents) ─────────────────────────────

const lastRequestIndex = (tracked: TrackedProjectIssue): number => {
  for (let index = tracked.events.length - 1; index >= 0; index -= 1) {
    if (tracked.events[index]?.type === 'verification-requested') return index
  }
  return -1
}

const decisionAfter = (
  tracked: TrackedProjectIssue,
  requestedAt: number,
): IssueWorkflowEvent | null => {
  const index = lastRequestIndex(tracked)
  if (index < 0) return null
  const decision = tracked.events.slice(index + 1)
    .find((item) => item.type === 'fixed' || item.type === 'verification-failed')
  return decision && decision.at >= requestedAt ? decision : null
}

/** What the browser evidence says about the latest verification request for one tracked issue. */
export const getTrackedVerificationStatus = (
  projectId: string,
  issueId: string,
  tracked: TrackedProjectIssue,
  trace: VerificationTrace | undefined,
): IssueVerificationStatus => {
  const requestIndex = lastRequestIndex(tracked)
  const requestedAt = requestIndex < 0 ? null : tracked.events[requestIndex]?.at ?? null
  const decision = requestedAt === null ? null : decisionAfter(tracked, requestedAt)
  const pending = tracked.phase === 'verifying'
  const outcome = requestedAt === null
    ? 'not-requested'
    : pending
      ? 'pending'
      : decision?.type === 'fixed'
        ? 'fixed'
        : decision?.type === 'verification-failed'
          ? 'still-present'
          : 'not-requested'
  return {
    projectId,
    issueId,
    issueKey: tracked.issueKey,
    phase: tracked.phase,
    outcome,
    requestedAt,
    decidedAt: pending ? null : decision?.at ?? null,
    cleanSnapshots: pending || outcome === 'fixed' ? tracked.verificationMisses : 0,
    requiredCleanSnapshots: VERIFICATION_CLEAN_SNAPSHOTS,
    waitingFor: pending ? (trace ? trace.waitingFor : 'no-snapshot-yet') : null,
  }
}
