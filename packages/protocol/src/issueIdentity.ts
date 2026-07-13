import type { VibeIssue } from './index.js'

const evidenceString = (issue: VibeIssue, key: string): string => {
  const value = issue.evidence[key]
  return typeof value === 'string' ? value : ''
}

const detectorIdentity = (issue: VibeIssue): string => {
  if (issue.detector === 'seo' || issue.detector === 'aeo' || issue.detector === 'web-essentials') {
    return evidenceString(issue, 'check')
  }
  if (issue.detector === 'duplicate-requests') {
    return `${evidenceString(issue, 'method').toUpperCase()}:${evidenceString(issue, 'url')}`
  }
  if (issue.detector === 'unoptimized-images' || issue.detector === 'large-images') {
    return evidenceString(issue, 'src')
  }
  if (issue.detector === 'resource-bloat') return evidenceString(issue, 'url')
  if (issue.detector === 'long-task-attribution') return evidenceString(issue, 'sourceURL')
  if (issue.detector === 'heavy-library') return evidenceString(issue, 'packageName')
  if (issue.detector === 'console-spam') return evidenceString(issue, 'method')
  return issue.detector
}

export const normalizePageUrl = (input: string): string => {
  try {
    const url = new URL(input)
    return `${url.origin}${url.pathname}`
  } catch {
    return input.split(/[?#]/, 1)[0] ?? input
  }
}

export const getStableIssueKey = (
  projectId: string,
  pageUrl: string,
  issue: VibeIssue,
): string => [
  projectId,
  normalizePageUrl(pageUrl),
  issue.detector,
  detectorIdentity(issue),
].map(encodeURIComponent).join('|')
