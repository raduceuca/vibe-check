// Payload bounding (since 0.4). One implementation shared by the browser
// engine (which must keep every beacon body under the 64 KiB keepalive limit)
// and the hub (which truncates oversized input instead of rejecting the whole
// snapshot). Pure functions: inputs are never mutated, and an input that is
// already within limits is returned as the same object.

import type {
  DetectorName,
  LargeResource,
  LongFrameEntry,
  ProjectSnapshotEnvelope,
  Severity,
  SnapshotTruncation,
  VibeIssue,
  VibeSnapshot,
} from './index.js'

export interface PayloadLimits {
  readonly maxIssuesPerSnapshot: number
  readonly maxIssuesPerDetector: number
  readonly maxTitleChars: number
  readonly maxDescriptionChars: number
  /** Any string inside issue evidence. */
  readonly maxEvidenceStringChars: number
  readonly maxEvidenceArrayItems: number
  readonly maxEvidenceKeys: number
  /** Nesting levels of objects/arrays allowed inside evidence (the evidence record is level 1). */
  readonly maxEvidenceDepth: number
  /** snapshot.longFrames.entries keeps the newest N. */
  readonly maxLongFrameEntries: number
  readonly maxScriptsPerLongFrame: number
  /** snapshot.resources.largeResources keeps the first N. */
  readonly maxLargeResources: number
  /** Envelope origin and pageUrl. */
  readonly maxEnvelopeTextChars: number
}

/** What a 0.4 browser engine sends. */
export const PAYLOAD_LIMITS: PayloadLimits = {
  maxIssuesPerSnapshot: 100,
  maxIssuesPerDetector: 25,
  maxTitleChars: 160,
  maxDescriptionChars: 600,
  maxEvidenceStringChars: 1_000,
  maxEvidenceArrayItems: 20,
  maxEvidenceKeys: 24,
  maxEvidenceDepth: 3,
  maxLongFrameEntries: 20,
  maxScriptsPerLongFrame: 5,
  maxLargeResources: 20,
  maxEnvelopeTextChars: 2_000,
}

/** What the hub keeps from any producer (looser than PAYLOAD_LIMITS: defence in depth). */
export const HUB_INTAKE_LIMITS: PayloadLimits = {
  maxIssuesPerSnapshot: 200,
  maxIssuesPerDetector: 50,
  maxTitleChars: 300,
  maxDescriptionChars: 2_000,
  maxEvidenceStringChars: 2_000,
  maxEvidenceArrayItems: 50,
  maxEvidenceKeys: 50,
  maxEvidenceDepth: 4,
  maxLongFrameEntries: 50,
  maxScriptsPerLongFrame: 10,
  maxLargeResources: 50,
  maxEnvelopeTextChars: 2_000,
}

/** Browsers reject a `keepalive: true` fetch whose body exceeds this many bytes. */
export const KEEPALIVE_BODY_LIMIT_BYTES = 65_536
/** Serialized envelope size the browser engine aims for, well under the keepalive limit. */
export const SNAPSHOT_BODY_BUDGET_BYTES = 48_000
/** Bodies above this get HTTP 413 from the hub. */
export const HUB_MAX_BODY_BYTES = 1_048_576

const TRUNCATED_MARKER = '[truncated]'

/** Shortens `value` to at most `maxChars` UTF-16 units, ending in an ellipsis when cut. */
export const truncateText = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value
  if (maxChars <= 0) return ''
  if (maxChars === 1) return '…'
  let end = maxChars - 1
  // Do not split a surrogate pair.
  const lastCode = value.charCodeAt(end - 1)
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) end -= 1
  return `${value.slice(0, end)}…`
}

// ── Evidence ────────────────────────────────────────────────────────────────

interface BoundCount {
  readonly changed: number
}

const boundValue = (
  value: unknown,
  depth: number,
  limits: PayloadLimits,
): { readonly value: unknown; readonly count: BoundCount } => {
  if (typeof value === 'string') {
    return value.length <= limits.maxEvidenceStringChars
      ? { value, count: { changed: 0 } }
      : { value: truncateText(value, limits.maxEvidenceStringChars), count: { changed: 1 } }
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return { value, count: { changed: 0 } }
  }
  if (typeof value === 'bigint') return { value: value.toString(), count: { changed: 1 } }
  if (typeof value !== 'object') return { value: undefined, count: { changed: 1 } }
  if (depth >= limits.maxEvidenceDepth) return { value: TRUNCATED_MARKER, count: { changed: 1 } }

  if (Array.isArray(value)) {
    const items: readonly unknown[] = value
    const kept = items.length > limits.maxEvidenceArrayItems
      ? items.slice(0, limits.maxEvidenceArrayItems)
      : items
    let changed = kept.length === items.length ? 0 : 1
    const next = kept.map((item) => {
      const bounded = boundValue(item, depth + 1, limits)
      changed += bounded.count.changed
      return bounded.value === undefined ? null : bounded.value
    })
    return changed === 0 ? { value, count: { changed } } : { value: next, count: { changed } }
  }

  const bounded = boundRecord(value as Readonly<Record<string, unknown>>, depth + 1, limits)
  return bounded.count.changed === 0
    ? { value, count: bounded.count }
    : { value: bounded.record, count: bounded.count }
}

const boundRecord = (
  record: Readonly<Record<string, unknown>>,
  depth: number,
  limits: PayloadLimits,
): { readonly record: Record<string, unknown>; readonly count: BoundCount } => {
  const entries = Object.entries(record)
  const kept = entries.length > limits.maxEvidenceKeys ? entries.slice(0, limits.maxEvidenceKeys) : entries
  let changed = kept.length === entries.length ? 0 : 1
  const next: Record<string, unknown> = {}
  for (const [key, raw] of kept) {
    const bounded = boundValue(raw, depth, limits)
    changed += bounded.count.changed
    if (bounded.value !== undefined) next[key] = bounded.value
  }
  return { record: next, count: { changed } }
}

/**
 * Bounds an evidence record: long strings shortened, arrays trimmed, extra
 * keys dropped, nesting cut at `maxEvidenceDepth`, values JSON cannot carry
 * dropped. Returns the input itself when nothing needed changing.
 */
export const boundEvidence = (
  evidence: Readonly<Record<string, unknown>>,
  limits: PayloadLimits = PAYLOAD_LIMITS,
): Record<string, unknown> => {
  const bounded = boundRecord(evidence, 1, limits)
  return bounded.count.changed === 0 ? evidence as Record<string, unknown> : bounded.record
}

// ── Issues ──────────────────────────────────────────────────────────────────

const boundIssueCounted = (
  issue: VibeIssue,
  limits: PayloadLimits,
): { readonly issue: VibeIssue; readonly changed: number } => {
  const title = truncateText(issue.title, limits.maxTitleChars)
  const description = truncateText(issue.description, limits.maxDescriptionChars)
  const evidence = boundRecord(issue.evidence, 1, limits)
  const changed = (title === issue.title ? 0 : 1)
    + (description === issue.description ? 0 : 1)
    + evidence.count.changed
  if (changed === 0) return { issue, changed }
  return {
    issue: {
      ...issue,
      title,
      description,
      evidence: evidence.count.changed === 0 ? issue.evidence : evidence.record,
    },
    changed,
  }
}

/** Clamps one issue's title, description and evidence. Same object back when already within limits. */
export const boundIssue = (issue: VibeIssue, limits: PayloadLimits = PAYLOAD_LIMITS): VibeIssue =>
  boundIssueCounted(issue, limits).issue

const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  critical: 3,
  error: 2,
  warning: 1,
  info: 0,
}

const lastSeen = (issue: VibeIssue): number =>
  typeof issue.lastSeenAt === 'number' && Number.isFinite(issue.lastSeenAt)
    ? Math.max(issue.lastSeenAt, issue.timestamp)
    : issue.timestamp

/**
 * Sort comparator: higher severity first, then most recently seen, then most
 * recently raised. Bounding keeps issues from the front of this order.
 */
export const compareIssuePriority = (a: VibeIssue, b: VibeIssue): number =>
  (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
  || lastSeen(b) - lastSeen(a)
  || b.timestamp - a.timestamp

export interface BoundIssuesResult {
  /** Kept issues, in their original order, each clamped by boundIssue. */
  readonly issues: readonly VibeIssue[]
  readonly dropped: number
  /** Detectors that lost at least one issue (their absence is not evidence). */
  readonly droppedDetectors: readonly DetectorName[]
  readonly truncatedFields: number
}

/**
 * Applies the per-detector and per-snapshot issue caps (keeping the highest
 * priority issues) and clamps every kept issue.
 */
export const boundIssues = (
  issues: readonly VibeIssue[],
  limits: PayloadLimits = PAYLOAD_LIMITS,
): BoundIssuesResult => {
  const indexed = issues.map((issue, index) => ({ issue, index }))
  const byPriority = [...indexed].sort((a, b) => compareIssuePriority(a.issue, b.issue) || a.index - b.index)
  const perDetector = new Map<DetectorName, number>()
  const keep = new Set<number>()
  for (const { issue, index } of byPriority) {
    if (keep.size >= limits.maxIssuesPerSnapshot) break
    const count = perDetector.get(issue.detector) ?? 0
    if (count >= limits.maxIssuesPerDetector) continue
    perDetector.set(issue.detector, count + 1)
    keep.add(index)
  }
  const droppedDetectors = new Set<DetectorName>()
  let truncatedFields = 0
  const kept: VibeIssue[] = []
  for (const { issue, index } of indexed) {
    if (!keep.has(index)) {
      droppedDetectors.add(issue.detector)
      continue
    }
    const bounded = boundIssueCounted(issue, limits)
    truncatedFields += bounded.changed
    kept.push(bounded.issue)
  }
  return {
    issues: kept,
    dropped: issues.length - kept.length,
    droppedDetectors: [...droppedDetectors],
    truncatedFields,
  }
}

// ── Snapshot ────────────────────────────────────────────────────────────────

const mergeTruncation = (
  current: SnapshotTruncation | undefined,
  droppedIssues: number,
  detectors: readonly DetectorName[],
  truncatedFields: number,
): SnapshotTruncation => ({
  droppedIssues: (current?.droppedIssues ?? 0) + droppedIssues,
  detectors: [...new Set([...(current?.detectors ?? []), ...detectors])],
  truncatedFields: (current?.truncatedFields ?? 0) + truncatedFields,
})

const boundLongFrames = (
  entries: readonly LongFrameEntry[],
  maxEntries: number,
  limits: PayloadLimits,
): { readonly entries: readonly LongFrameEntry[]; readonly changed: number } => {
  let changed = entries.length > maxEntries ? 1 : 0
  const kept = entries.length > maxEntries ? entries.slice(entries.length - maxEntries) : entries
  const next = kept.map((entry) => {
    const scripts = entry.scripts.length > limits.maxScriptsPerLongFrame
      ? entry.scripts.slice(0, limits.maxScriptsPerLongFrame)
      : entry.scripts
    let entryChanged = scripts.length === entry.scripts.length ? 0 : 1
    const boundedScripts = scripts.map((script) => {
      const sourceURL = truncateText(script.sourceURL, limits.maxEvidenceStringChars)
      const sourceFunctionName = truncateText(script.sourceFunctionName, limits.maxEvidenceStringChars)
      if (sourceURL === script.sourceURL && sourceFunctionName === script.sourceFunctionName) return script
      entryChanged += 1
      return { ...script, sourceURL, sourceFunctionName }
    })
    changed += entryChanged
    return entryChanged === 0 ? entry : { ...entry, scripts: boundedScripts }
  })
  return { entries: changed === 0 ? entries : next, changed }
}

const boundLargeResources = (
  resources: readonly LargeResource[],
  limits: PayloadLimits,
): { readonly resources: readonly LargeResource[]; readonly changed: number } => {
  let changed = resources.length > limits.maxLargeResources ? 1 : 0
  const kept = resources.length > limits.maxLargeResources
    ? resources.slice(0, limits.maxLargeResources)
    : resources
  const next = kept.map((resource) => {
    const url = truncateText(resource.url, limits.maxEvidenceStringChars)
    if (url === resource.url) return resource
    changed += 1
    return { ...resource, url }
  })
  return { resources: changed === 0 ? resources : next, changed }
}

/**
 * Applies PayloadLimits to a whole snapshot: issue caps and clamps, long-frame
 * entries, large-resource list. Records what it dropped in `truncation`
 * (merged with any truncation the producer already reported). Returns the
 * input itself when nothing needed changing. Tolerates the stat blocks being
 * absent at runtime (hub intake before full validation).
 */
export const boundSnapshot = (
  snapshot: VibeSnapshot,
  limits: PayloadLimits = PAYLOAD_LIMITS,
): VibeSnapshot => {
  const issues = boundIssues(snapshot.issues, limits)
  const longFrameEntries: readonly LongFrameEntry[] | undefined = snapshot.longFrames?.entries
  const longFrames = longFrameEntries
    ? boundLongFrames(longFrameEntries, limits.maxLongFrameEntries, limits)
    : null
  const largeResourceList: readonly LargeResource[] | undefined = snapshot.resources?.largeResources
  const largeResources = largeResourceList ? boundLargeResources(largeResourceList, limits) : null
  const changedFields = issues.truncatedFields + (longFrames?.changed ?? 0) + (largeResources?.changed ?? 0)
  if (issues.dropped === 0 && changedFields === 0) return snapshot
  return {
    ...snapshot,
    issues: issues.issues,
    longFrames: longFrames && longFrames.changed > 0
      ? { ...snapshot.longFrames, entries: longFrames.entries }
      : snapshot.longFrames,
    resources: largeResources && largeResources.changed > 0
      ? { ...snapshot.resources, largeResources: largeResources.resources }
      : snapshot.resources,
    truncation: mergeTruncation(snapshot.truncation, issues.dropped, issues.droppedDetectors, changedFields),
  }
}

// ── Byte budget ─────────────────────────────────────────────────────────────

const utf8Length = (text: string): number => {
  let bytes = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        index += 1
      } else {
        bytes += 3
      }
    } else bytes += 3
  }
  return bytes
}

/** UTF-8 byte length of JSON.stringify(value); 0 for values JSON cannot represent. */
export const measureJsonBytes = (value: unknown): number => {
  const json: string | undefined = JSON.stringify(value)
  return json === undefined ? 0 : utf8Length(json)
}

const LAST_RESORT_LONG_FRAMES = 5
const MAX_FIT_ROUNDS = 6

/**
 * Returns an envelope whose JSON body fits in `maxBytes`: applies
 * boundSnapshot, shortens origin/pageUrl/title, then keeps only the newest
 * few long frames, then drops issues lowest-priority first. Every detector
 * that loses an issue is listed in `snapshot.truncation.detectors`. If even an
 * issue-free envelope is too large the smallest possible envelope is returned
 * and the caller must not use keepalive for it.
 */
export const fitEnvelopeToBytes = (
  envelope: ProjectSnapshotEnvelope,
  maxBytes: number = SNAPSHOT_BODY_BUDGET_BYTES,
  limits: PayloadLimits = PAYLOAD_LIMITS,
): ProjectSnapshotEnvelope => {
  const origin = truncateText(envelope.origin, limits.maxEnvelopeTextChars)
  const pageUrl = truncateText(envelope.pageUrl, limits.maxEnvelopeTextChars)
  const title = truncateText(envelope.title, limits.maxTitleChars)
  const snapshot = boundSnapshot(envelope.snapshot, limits)
  const bounded: ProjectSnapshotEnvelope = origin === envelope.origin
    && pageUrl === envelope.pageUrl
    && title === envelope.title
    && snapshot === envelope.snapshot
    ? envelope
    : { ...envelope, origin, pageUrl, title, snapshot }
  if (measureJsonBytes(bounded) <= maxBytes) return bounded

  const fewerFrames = boundLongFrames(bounded.snapshot.longFrames?.entries ?? [], LAST_RESORT_LONG_FRAMES, limits)
  let current: ProjectSnapshotEnvelope = fewerFrames.changed === 0 ? bounded : {
    ...bounded,
    snapshot: {
      ...bounded.snapshot,
      longFrames: { ...bounded.snapshot.longFrames, entries: fewerFrames.entries },
      truncation: mergeTruncation(bounded.snapshot.truncation, 0, [], fewerFrames.changed),
    },
  }

  for (let round = 0; round < MAX_FIT_ROUNDS; round += 1) {
    const total = measureJsonBytes(current)
    if (total <= maxBytes) return current
    const issues = current.snapshot.issues
    if (issues.length === 0) return current
    const lowestFirst = issues
      .map((issue, index) => ({ issue, index, bytes: measureJsonBytes(issue) + 1 }))
      .sort((a, b) => compareIssuePriority(b.issue, a.issue) || b.index - a.index)
    const drop = new Set<number>()
    let excess = total - maxBytes
    for (const candidate of lowestFirst) {
      if (excess <= 0) break
      drop.add(candidate.index)
      excess -= candidate.bytes
    }
    // Estimates can undershoot (truncation metadata adds bytes); on the last
    // round drop everything rather than return an over-budget body.
    const dropAll = round === MAX_FIT_ROUNDS - 1
    const kept = dropAll ? [] : issues.filter((_issue, index) => !drop.has(index))
    const lost = dropAll ? issues : issues.filter((_issue, index) => drop.has(index))
    current = {
      ...current,
      snapshot: {
        ...current.snapshot,
        issues: kept,
        truncation: mergeTruncation(
          current.snapshot.truncation,
          lost.length,
          lost.map((issue) => issue.detector),
          0,
        ),
      },
    }
  }
  return current
}
