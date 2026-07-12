import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ALL_PROBLEMS,
  CATEGORY_META,
  frameworksFor,
  problemsInCategory,
} from '@/lib/problems'
import { SeverityTag } from '@/components/fix/SeverityTag'
import { ISSUE_ART } from '@/components/issueArt'
import { JsonLd } from '@/components/JsonLd'
import { buildFixHubJsonLd } from '@/lib/problems/jsonld'
import { absoluteUrl } from '@/lib/site'

const TITLE = 'Fix guides — every problem VibeCheck catches'
const DESCRIPTION =
  'Field guides for every performance, SEO, AI-readiness and web-essentials problem VibeCheck detects in AI-built frontends — with the exact fix and code.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/fix', types: { 'text/markdown': '/fix.md' } },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl('/fix'), type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

const variantCount = ALL_PROBLEMS.reduce((n, p) => n + frameworksFor(p).length, 0)

const FixHubPage = () => (
  <div className="vc-fix-hub">
    <JsonLd data={buildFixHubJsonLd()} />
    <header className="vc-fix-hub-head">
      <div className="vc-fix-eyebrow">
        <span className="vc-mono">Fix guides</span>
        <span className="vc-dot" />
        <span className="vc-mono">{ALL_PROBLEMS.length} problems</span>
        <span className="vc-dot" />
        <span className="vc-mono">{variantCount} framework variants</span>
      </div>
      <h1 className="vc-fix-h1">Every problem VibeCheck catches — and how to fix it</h1>
      <p className="vc-fix-lede">
        VibeCheck runs in the corner of your app and catches what an AI agent quietly broke:
        jank, leaks, DOM bloat, layout shift, and failing SEO / AI-readiness audits. Every issue
        it can emit has a page here — what it is, why it hurts, the literal string the detector
        reports, and the fix with code, per framework.
      </p>
    </header>

    {CATEGORY_META.map((c) => {
      const problems = problemsInCategory(c.key)
      return (
        <section className="vc-fix-section" key={c.key} aria-labelledby={`cat-${c.key}`}>
          <div className="vc-fix-cat-head">
            <h2 id={`cat-${c.key}`} className="vc-fix-h2">
              <Link href={`/fix/${c.key}`}>{c.label}</Link>
            </h2>
            <span className="vc-fix-cat-count vc-mono">{problems.length}</span>
          </div>
          <p className="vc-fix-p">{c.intro}</p>
          <ul className="vc-fix-cards">
            {problems.map((p) => {
              const Art = ISSUE_ART[p.detector]
              return (
                <li key={p.slug}>
                  <Link href={`/fix/${p.slug}`} className="vc-fix-card">
                    {Art ? (
                      <span className="vc-fix-card-art" aria-hidden="true">
                        <Art />
                      </span>
                    ) : null}
                    <span className="vc-fix-card-body">
                      <span className="vc-fix-card-top">
                        <span className="vc-fix-card-t">{p.h1}</span>
                        <SeverityTag severity={p.severity} />
                      </span>
                      <span className="vc-fix-card-d">{p.metaDescription}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )
    })}
  </div>
)

export default FixHubPage
