import Link from 'next/link'
import type { CategoryMeta } from '@/lib/problems'
import { problemsInCategory } from '@/lib/problems'
import { ISSUE_ART } from '@/components/issueArt'
import { SeverityTag } from './SeverityTag'

// A category landing page (/fix/performance, /fix/seo, …): intro copy plus every
// problem in the pillar. One <h1>. Server Component.

export const CategoryView = ({ category }: { category: CategoryMeta }) => {
  const problems = problemsInCategory(category.key)
  return (
    <div className="vc-fix-hub">
      <nav className="vc-crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/fix">Fix guides</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{category.label}</li>
        </ol>
      </nav>

      <header className="vc-fix-hub-head">
        <div className="vc-fix-eyebrow">
          <span className="vc-mono">{category.tagline}</span>
          <span className="vc-dot" />
          <span className="vc-mono">{problems.length} problems</span>
        </div>
        <h1 className="vc-fix-h1">{category.label}</h1>
        <p className="vc-fix-lede">{category.intro}</p>
        <p className="vc-fix-p vc-fix-detnote">{category.detectorNote}</p>
      </header>

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
    </div>
  )
}
