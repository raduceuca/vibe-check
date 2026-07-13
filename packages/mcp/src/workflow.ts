import { getStableIssueKey, normalizePageUrl } from '@wcgw/vibe-check-protocol'
import type {
  IssueWorkflowEvent,
  ProjectSnapshotEnvelope,
  ProjectWorkflow,
  TrackedProjectIssue,
  VibeIssue,
} from './types.js'

const MAX_WORKFLOW_ISSUES = 200
const MAX_EVENTS_PER_ISSUE = 50

export const createProjectWorkflow = (projectId: string): ProjectWorkflow => ({
  schemaVersion: 1,
  projectId,
  revision: 0,
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
  phase: 'detected',
  occurrenceCount: 1,
  regressionCount: 0,
  verificationMisses: 0,
  firstSeenAt: now,
  lastSeenAt: now,
  events: [event('detected', now, 1)],
})

const recordPresentIssue = (
  tracked: TrackedProjectIssue,
  issue: VibeIssue,
  now: number,
): TrackedProjectIssue => {
  if (tracked.phase === 'fixed') {
    const occurrenceCount = tracked.occurrenceCount + 1
    return appendEvent({
      ...tracked,
      issue,
      phase: 'regressed',
      occurrenceCount,
      regressionCount: tracked.regressionCount + 1,
      verificationMisses: 0,
      lastSeenAt: now,
    }, event('regressed', now, occurrenceCount))
  }
  if (tracked.phase === 'verifying') {
    return appendEvent({
      ...tracked,
      issue,
      phase: 'working',
      verificationMisses: 0,
      lastSeenAt: now,
    }, event('verification-failed', now, tracked.occurrenceCount))
  }
  return { ...tracked, issue, lastSeenAt: now }
}

const recordAbsentIssue = (
  tracked: TrackedProjectIssue,
  now: number,
): TrackedProjectIssue => {
  if (tracked.phase !== 'verifying') return tracked
  const verificationMisses = tracked.verificationMisses + 1
  if (verificationMisses < 2) return { ...tracked, verificationMisses }
  return appendEvent({
    ...tracked,
    phase: 'fixed',
    verificationMisses,
  }, event('fixed', now, tracked.occurrenceCount))
}

export const recordWorkflowSnapshot = (
  workflow: ProjectWorkflow,
  envelope: ProjectSnapshotEnvelope,
  now: number,
): ProjectWorkflow => {
  if (workflow.projectId !== envelope.projectId) return workflow
  const pageUrl = normalizePageUrl(envelope.pageUrl)
  const incoming = new Map(envelope.snapshot.issues.map((issue) => [
    getStableIssueKey(workflow.projectId, pageUrl, issue),
    issue,
  ]))
  const knownKeys = new Set(workflow.issues.map((tracked) => tracked.issueKey))
  let changed = false

  const existing = workflow.issues.map((tracked) => {
    if (tracked.pageUrl !== pageUrl) return tracked
    const present = incoming.get(tracked.issueKey)
    const next = present
      ? recordPresentIssue(tracked, present, now)
      : recordAbsentIssue(tracked, now)
    if (next !== tracked) changed = true
    return next
  })
  const additions = [...incoming.entries()]
    .filter(([issueKey]) => !knownKeys.has(issueKey))
    .map(([, issue]) => newTrackedIssue(workflow, pageUrl, issue, now))
  if (additions.length > 0) changed = true

  return changed ? revise(workflow, [...existing, ...additions]) : workflow
}

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

export const markWorkflowWorking = (
  workflow: ProjectWorkflow,
  issueId: string,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.issue.id === issueId,
  (tracked) => tracked.phase === 'working' ? tracked : appendEvent({
    ...tracked,
    phase: 'working',
  }, event('working', now, tracked.occurrenceCount)),
)

export const requestWorkflowVerification = (
  workflow: ProjectWorkflow,
  issueId: string,
  now: number,
): ProjectWorkflow => updateIssue(
  workflow,
  (tracked) => tracked.issue.id === issueId,
  (tracked) => tracked.phase === 'verifying' || tracked.phase === 'fixed'
    ? tracked
    : appendEvent({
      ...tracked,
      phase: 'verifying',
      verificationMisses: 0,
    }, event('verification-requested', now, tracked.occurrenceCount)),
)
