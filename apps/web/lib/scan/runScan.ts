import { parseHTML } from 'linkedom'
import { fetchTarget } from './fetchTarget'
import { runSeoChecks, runAeoChecks } from './checks'
import { fixHrefForCheck } from './fixMap'
import type { ScanCategoryResult, ScanCheck, ScanResult } from './types'

// ── Scan orchestrator ────────────────────────────────────────────────────────
// fetchTarget (I/O) → linkedom parse → pure checks → attach fix links → score.
// The only server-side entry point the API route needs.

const withFixLinks = (checks: readonly ScanCheck[], category: 'seo' | 'aeo'): ScanCheck[] =>
  checks.map((check) => ({ ...check, fixHref: fixHrefForCheck(check.id, category) }))

const summarize = (checks: readonly ScanCheck[]): ScanCategoryResult => ({
  passed: checks.filter((c) => c.pass).length,
  total: checks.length,
  checks,
})

export const runScan = async (input: string): Promise<ScanResult> => {
  const target = await fetchTarget(input)
  const { document } = parseHTML(target.html)
  const finalUrl = new URL(target.finalUrl)

  const seo = withFixLinks(runSeoChecks(document, finalUrl, target), 'seo')
  const aeo = withFixLinks(runAeoChecks(document, target), 'aeo')

  return {
    url: target.finalUrl,
    fetchedAt: new Date().toISOString(),
    seo: summarize(seo),
    aeo: summarize(aeo),
  }
}
