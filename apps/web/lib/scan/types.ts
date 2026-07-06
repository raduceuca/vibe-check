import type { Severity } from '@wcgw/vibe-check-core'

// ── Scan result shape ────────────────────────────────────────────────────────
// The wire contract returned by POST /api/scan and consumed by the /scan page.
// Deliberately self-contained (no linkedom / core detector types leak here) so
// the client component can import it without pulling server-only code.

export type { Severity }

// One audited criterion. `id` is the detector check id (mirrors
// packages/core/src/detectors/{seo,aeo}.ts), so it reconciles with VibeCheck's
// own audit. `label` is the positive statement (passes read naturally); `detail`
// carries the detector's evidence string on a miss; `fixHref` links a miss to
// its /fix guide.
export interface ScanCheck {
  readonly id: string
  readonly label: string
  readonly pass: boolean
  readonly severity: Severity
  readonly detail?: string
  readonly fixHref?: string
}

export interface ScanCategoryResult {
  readonly passed: number
  readonly total: number
  readonly checks: readonly ScanCheck[]
}

export interface ScanResult {
  // The final URL actually fetched (after redirects), not the raw input.
  readonly url: string
  readonly fetchedAt: string
  readonly seo: ScanCategoryResult
  readonly aeo: ScanCategoryResult
}
