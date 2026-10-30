import { getIssueIdentity, issueLastSeenAt } from '@wcgw/vibe-check-protocol'
import type { VibeIssue } from '../types.js'

// ── Keyed issue list ─────────────────────────────────────────────────────────
// Every built-in detector keeps its open issues here, so the 0.4 contract holds
// in one place:
//   • at most one open issue per getIssueIdentity() (no unbounded growth);
//   • while it stays open the issue keeps its id and first `timestamp`, and each
//     new observation refreshes `lastSeenAt` / `occurrences` on a NEW object
//     (issues are never mutated in place);
//   • a retracted issue that comes back is a new issue with a new id.

export interface ReportOptions {
  /** Count this report as another observation (`occurrences + 1`). Default true. */
  readonly occurrence?: boolean
}

export interface IssueBook {
  /** Open issues, oldest first. The same array is returned until something changes. */
  readonly list: () => readonly VibeIssue[]
  /** The open issue with this identity, if any. */
  readonly get: (identity: string) => VibeIssue | undefined
  /**
   * Raises `candidate` (fresh from createIssue), or updates the open issue with
   * the same identity: same id and timestamp, the candidate's severity, copy and
   * evidence, `lastSeenAt` = the later of the two, `occurrences` + 1.
   */
  readonly report: (candidate: VibeIssue, options?: ReportOptions) => VibeIssue
  /** Drops the issue with this identity; true when one was open. */
  readonly retract: (identity: string) => boolean
  /** Drops every issue the predicate selects; returns how many. */
  readonly retractWhere: (predicate: (issue: VibeIssue) => boolean) => number
  readonly size: () => number
  readonly clear: () => void
}

export const identityOf = (issue: VibeIssue): string => getIssueIdentity(issue)

export const createIssueBook = (): IssueBook => {
  const open = new Map<string, VibeIssue>()
  let snapshot: readonly VibeIssue[] = []

  const changed = (): void => {
    snapshot = [...open.values()]
  }

  const report = (candidate: VibeIssue, options: ReportOptions = {}): VibeIssue => {
    const key = identityOf(candidate)
    const previous = open.get(key)
    if (previous === undefined) {
      open.set(key, candidate)
      changed()
      return candidate
    }
    const countIt = options.occurrence !== false
    const next: VibeIssue = {
      ...candidate,
      id: previous.id,
      timestamp: previous.timestamp,
      acknowledged: previous.acknowledged,
      resolved: previous.resolved,
      lastSeenAt: Math.max(issueLastSeenAt(previous), issueLastSeenAt(candidate)),
      occurrences: (previous.occurrences ?? 1) + (countIt ? 1 : 0),
    }
    open.set(key, next)
    changed()
    return next
  }

  const retract = (identity: string): boolean => {
    if (!open.delete(identity)) return false
    changed()
    return true
  }

  const retractWhere = (predicate: (issue: VibeIssue) => boolean): number => {
    let removed = 0
    for (const [key, issue] of open) {
      if (predicate(issue)) {
        open.delete(key)
        removed += 1
      }
    }
    if (removed > 0) changed()
    return removed
  }

  return {
    list: () => snapshot,
    get: (identity) => open.get(identity),
    report,
    retract,
    retractWhere,
    size: () => open.size,
    clear: () => {
      if (open.size === 0) return
      open.clear()
      changed()
    },
  }
}
