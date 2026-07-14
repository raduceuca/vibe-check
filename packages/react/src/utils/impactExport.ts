import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'

const countLabel = (value: number, singular: string, plural = `${singular}s`): string =>
  `${value} ${value === 1 ? singular : plural}`

export const formatImpactMarkdown = (impact: ProjectImpactSummary): string => [
  `## VibeCheck impact — ${impact.projectId}`,
  '',
  `VibeCheck caught ${countLabel(impact.regressionsCaught, 'regression')} and helped verify ${countLabel(impact.verifiedFixes, 'fix', 'fixes')}.`,
  '',
  `- ${countLabel(impact.uniqueIssuesFixed, 'unique issue')} fixed`,
  `- ${countLabel(impact.verificationFailures, 'verification failure')} caught`,
  ...impact.metrics.map((metric) =>
    `- ${metric.value} ${metric.label} — ${metric.scope}${
      metric.confidence === 'estimated' ? ' (estimated)' : ''
    }`),
].join('\n') + '\n'

export const formatImpactJson = (impact: ProjectImpactSummary): string =>
  `${JSON.stringify(impact, null, 2)}\n`
