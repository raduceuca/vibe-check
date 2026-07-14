import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'

export const formatImpactMarkdown = (impact: ProjectImpactSummary): string => [
  `## VibeCheck impact — ${impact.projectId}`,
  '',
  `VibeCheck caught ${impact.regressionsCaught} regressions and helped verify ${impact.verifiedFixes} fixes.`,
  '',
  `- ${impact.uniqueIssuesFixed} unique issues fixed`,
  `- ${impact.verificationFailures} verification failures caught`,
  ...impact.metrics.map((metric) =>
    `- ${metric.value} ${metric.label} — ${metric.scope}${
      metric.confidence === 'estimated' ? ' (estimated)' : ''
    }`),
].join('\n') + '\n'

export const formatImpactJson = (impact: ProjectImpactSummary): string =>
  `${JSON.stringify(impact, null, 2)}\n`
