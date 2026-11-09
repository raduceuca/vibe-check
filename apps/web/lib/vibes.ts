import type { AuditRun, VibeIssue, VibeSnapshot } from '@wcgw/vibe-check-core'
import {
  AEO_CRITERIA_COUNT,
  SEO_CRITERIA_COUNT,
} from '@wcgw/vibe-check-core'

export type VibeId = 'smooth' | 'light' | 'clean' | 'findable' | 'quotable'

export type VibeRowState =
  | 'measuring'
  | 'passing'
  | 'caught'
  | 'rechecking'
  | 'passing-again'
  | 'incomplete'

export interface VibeDefinition {
  readonly id: VibeId
  readonly name: string
  readonly claim: string
  readonly detectors: readonly string[]
}

export const VIBES: readonly VibeDefinition[] = [
  {
    id: 'smooth',
    name: 'Smooth',
    claim: 'Nothing jumps, nothing freezes, every tap lands.',
    detectors: ['layout-thrashing', 'long-task-attribution'],
  },
  {
    id: 'light',
    name: 'Light',
    claim: 'It loads what it uses, and nothing twice.',
    detectors: [
      'dom-bloat',
      'duplicate-requests',
      'memory-leak',
      'unoptimized-images',
      'large-images',
      'resource-bloat',
      'heavy-library',
    ],
  },
  {
    id: 'clean',
    name: 'Clean',
    claim: 'A quiet console, and the basics in place.',
    detectors: ['console-spam', 'web-essentials'],
  },
  {
    id: 'findable',
    name: 'Findable',
    claim: 'Search engines know what this page is.',
    detectors: ['seo'],
  },
  {
    id: 'quotable',
    name: 'Quotable',
    claim: 'When someone asks an AI, it can quote you.',
    detectors: ['aeo'],
  },
] as const

export interface GradeInput {
  readonly snapshot: VibeSnapshot | null
  readonly seoRun: AuditRun | null
  readonly aeoRun: AuditRun | null
  /** True when a Smooth bench fault ran this visit (CLS fail is then allowed). */
  readonly smoothBenchActive?: boolean
}

export interface GradedVibe {
  readonly id: VibeId
  readonly state: VibeRowState
  readonly issues: readonly VibeIssue[]
  readonly reading: string
}

const issuesFor = (
  snapshot: VibeSnapshot | null,
  detectors: readonly string[],
): readonly VibeIssue[] => {
  if (!snapshot) return []
  const set = new Set(detectors)
  return snapshot.issues.filter((issue) => set.has(issue.detector))
}

const formatInp = (inp: number | null | undefined): string => {
  if (inp == null || Number.isNaN(inp)) return 'INP: tap anything'
  return `INP ${Math.round(inp)} ms`
}

const auditReading = (
  run: AuditRun | null,
  total: number,
  label: string,
): { readonly reading: string; readonly state: VibeRowState; readonly issues: readonly VibeIssue[] } => {
  if (!run || run.status === 'running') {
    return { reading: `… of ${total} ${label} checks`, state: 'measuring', issues: [] }
  }
  if (run.status === 'incomplete') {
    return {
      reading: `${total - run.failedChecks.length} of ${total} ${label} checks`,
      state: 'incomplete',
      issues: [],
    }
  }
  const passed = total - run.failedChecks.length
  return {
    reading: `${passed} of ${total} ${label} checks`,
    state: run.failedChecks.length > 0 ? 'caught' : 'passing',
    issues: [],
  }
}

export const gradeVibes = ({
  snapshot,
  seoRun,
  aeoRun,
  smoothBenchActive = false,
}: GradeInput): readonly GradedVibe[] => {
  if (!snapshot) {
    return VIBES.map((vibe) => ({
      id: vibe.id,
      state: 'measuring' as const,
      issues: [],
      reading: 'Measuring…',
    }))
  }

  const smoothIssues = issuesFor(snapshot, VIBES[0].detectors)
  const inpPoor = snapshot.webVitals.inp?.rating === 'poor'
  const clsBad =
    snapshot.webVitals.cls != null &&
    snapshot.webVitals.cls.rating !== 'good' &&
    !smoothBenchActive
  const smoothFail = smoothIssues.length > 0 || inpPoor || clsBad

  const lightIssues = issuesFor(snapshot, VIBES[1].detectors)
  const cleanIssues = issuesFor(snapshot, VIBES[2].detectors)

  const heapMb = snapshot.memory?.jsHeapSizeMB
  const heapLabel = heapMb == null
    ? 'heap: Chrome and Edge only'
    : `${heapMb.toFixed(1)} MB heap`

  const duplicateCount = lightIssues.filter((issue) => issue.detector === 'duplicate-requests').length
  const essentialsFailed = cleanIssues.filter((issue) => issue.detector === 'web-essentials').length
  const consoleErrors = snapshot.console.errorCount

  const seo = auditReading(seoRun, SEO_CRITERIA_COUNT, 'SEO')
  const aeo = auditReading(aeoRun, AEO_CRITERIA_COUNT, 'AEO')

  return [
    {
      id: 'smooth',
      state: smoothFail ? 'caught' : 'passing',
      issues: smoothIssues,
      reading: [
        `${Math.round(snapshot.frameRate.fps)} fps`,
        `${snapshot.longFrames.count} long frames`,
        `CLS ${(snapshot.webVitals.cls?.value ?? 0).toFixed(2)}`,
        formatInp(snapshot.webVitals.inp?.value),
      ].join(' · '),
    },
    {
      id: 'light',
      state: lightIssues.length > 0 ? 'caught' : 'passing',
      issues: lightIssues,
      reading: [
        `${snapshot.domNodeCount} elements`,
        `${duplicateCount} repeated requests`,
        heapLabel,
      ].join(' · '),
    },
    {
      id: 'clean',
      state: cleanIssues.length > 0 ? 'caught' : 'passing',
      issues: cleanIssues,
      reading: [
        `${consoleErrors} console errors`,
        `essentials ${Math.max(0, 4 - essentialsFailed)} of 4`,
      ].join(' · '),
    },
    {
      id: 'findable',
      state: seo.state,
      issues: seo.issues,
      reading: seo.reading,
    },
    {
      id: 'quotable',
      state: aeo.state,
      issues: aeo.issues,
      reading: aeo.reading,
    },
  ]
}

export const overallVerdict = (
  graded: readonly GradedVibe[],
): 'checking' | 'pass' | 'fail' | 'incomplete' => {
  if (graded.some((row) => row.state === 'measuring')) return 'checking'
  if (graded.some((row) => row.state === 'incomplete')) return 'incomplete'
  if (graded.some((row) => row.state === 'caught' || row.state === 'rechecking')) return 'fail'
  return 'pass'
}
