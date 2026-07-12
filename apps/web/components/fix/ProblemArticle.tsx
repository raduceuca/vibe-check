import Link from 'next/link'
import { SmileySad, Warning } from '@phosphor-icons/react/dist/ssr'
import type { Framework, Problem } from '@/lib/problems/types'
import { CATEGORY_LABELS, FRAMEWORK_LABELS } from '@/lib/problems/types'
import { frameworksFor, getCategoryMeta, resolveRelated } from '@/lib/problems'
import { ISSUE_ART } from '@/components/issueArt'
import { CodeBlockList } from './CodeBlockView'
import { SeverityTag } from './SeverityTag'
import { IconList } from './IconList'
import { CatchPanel } from './CatchPanel'
import { RichText } from './RichText'

// ── The canonical problem page template ──────────────────────────────────────
// Renders one problem from data: breadcrumb, a single <h1>, the pain, symptoms,
// "how VibeCheck catches it" (with the literal issue string in mono), root
// causes, the fix (framework-agnostic, or a framework variant surfaced), an FAQ,
// framework links, and related problems. Semantic HTML, ~65ch measure. Server
// Component — no client JS.

const Breadcrumb = ({ problem, framework }: { problem: Problem; framework?: Framework }) => (
  <nav className="vc-crumbs" aria-label="Breadcrumb">
    <ol>
      <li>
        <Link href="/fix">Fix guides</Link>
      </li>
      <li aria-hidden="true">/</li>
      <li>
        <Link href={`/fix/${problem.category}`}>{CATEGORY_LABELS[problem.category]}</Link>
      </li>
      <li aria-hidden="true">/</li>
      {framework ? (
        <>
          <li>
            <Link href={`/fix/${problem.slug}`}>{problem.h1}</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{FRAMEWORK_LABELS[framework]}</li>
        </>
      ) : (
        <li aria-current="page">{problem.h1}</li>
      )}
    </ol>
  </nav>
)

const FrameworkLinks = ({ problem, current }: { problem: Problem; current?: Framework }) => {
  const frameworks = frameworksFor(problem)
  if (frameworks.length === 0) return null
  return (
    <div className="vc-fw-picker" role="group" aria-label="Framework-specific fixes">
      <span className="vc-fw-picker-label">Framework fixes</span>
      <div className="vc-fw-picker-links">
        <Link
          href={`/fix/${problem.slug}`}
          className="vc-fw-chip"
          data-active={current === undefined ? 'true' : undefined}
        >
          General
        </Link>
        {frameworks.map((f) => (
          <Link
            key={f}
            href={`/fix/${problem.slug}/${f}`}
            className="vc-fw-chip"
            data-active={current === f ? 'true' : undefined}
          >
            {FRAMEWORK_LABELS[f]}
          </Link>
        ))}
      </div>
    </div>
  )
}

export const ProblemArticle = ({
  problem,
  framework,
}: {
  problem: Problem
  framework?: Framework
}) => {
  const category = getCategoryMeta(problem.category)
  const related = resolveRelated(problem)
  const frameworkFix = framework ? problem.frameworkFixes?.[framework] : undefined

  return (
    <article className="vc-fix-article">
      <Breadcrumb problem={problem} framework={framework} />

      <header className="vc-fix-header">
        <div className="vc-fix-eyebrow">
          <Link href={`/fix/${problem.category}`}>{category.label}</Link>
          <span className="vc-dot" />
          <span className="vc-mono">{problem.detector}</span>
          {problem.checkId ? (
            <>
              <span className="vc-dot" />
              <span className="vc-mono">{problem.checkId}</span>
            </>
          ) : null}
          <SeverityTag severity={problem.severity} />
        </div>
        <h1 className="vc-fix-h1">
          {framework ? (
            <>
              {problem.h1} <span className="vc-fix-h1-fw">in {FRAMEWORK_LABELS[framework]}</span>
            </>
          ) : (
            problem.h1
          )}
        </h1>
        <p className="vc-fix-lede">
          <RichText text={problem.pain} />
        </p>
      </header>

      <FrameworkLinks problem={problem} current={framework} />

      {/* ── Symptoms ─────────────────────────────────────────────────────── */}
      <section className="vc-fix-section" aria-labelledby="symptoms">
        <h2 id="symptoms" className="vc-fix-h2">
          Symptoms
        </h2>
        <IconList items={problem.symptoms} icon={SmileySad} tone="muted" />
      </section>

      {/* ── How VibeCheck catches it (the dogfood hook) ──────────────────── */}
      <section className="vc-fix-section" aria-labelledby="detect">
        <h2 id="detect" className="vc-fix-h2">
          How VibeCheck catches it
        </h2>
        <CatchPanel problem={problem} />
      </section>

      {/* ── Root causes ──────────────────────────────────────────────────── */}
      <section className="vc-fix-section" aria-labelledby="causes">
        <h2 id="causes" className="vc-fix-h2">
          Root causes
        </h2>
        <IconList items={problem.rootCauses} icon={Warning} tone="amber" />
      </section>

      {/* ── The fix ──────────────────────────────────────────────────────── */}
      <section className="vc-fix-section" aria-labelledby="fix">
        <h2 id="fix" className="vc-fix-h2">
          {framework ? `The fix for ${FRAMEWORK_LABELS[framework]}` : 'The fix'}
        </h2>

        {frameworkFix ? (
          <>
            <p className="vc-fix-p">
              <RichText text={frameworkFix.note} />
            </p>
            <CodeBlockList blocks={frameworkFix.code} />
            {frameworkFix.docsUrl ? (
              <p className="vc-fix-p">
                <a className="vc-link" href={frameworkFix.docsUrl} target="_blank" rel="noreferrer">
                  {FRAMEWORK_LABELS[framework as Framework]} docs →
                </a>
              </p>
            ) : null}
            {problem.fix.steps ? (
              <>
                <h3 className="vc-fix-h3">Steps</h3>
                <ol className="vc-fix-steps">
                  {problem.fix.steps.map((s, i) => (
                    <li key={i}>
                      <RichText text={s} />
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
            <p className="vc-fix-p">
              <Link className="vc-link" href={`/fix/${problem.slug}`}>
                See the general, framework-agnostic fix →
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="vc-fix-p">
              <RichText text={problem.fix.summary} />
            </p>
            {problem.fix.steps ? (
              <ol className="vc-fix-steps">
                {problem.fix.steps.map((s, i) => (
                  <li key={i}>
                    <RichText text={s} />
                  </li>
                ))}
              </ol>
            ) : null}
            <CodeBlockList blocks={problem.fix.code} />
          </>
        )}
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      {problem.faq.length > 0 ? (
        <section className="vc-fix-section" aria-labelledby="faq">
          <h2 id="faq" className="vc-fix-h2">
            FAQ
          </h2>
          <dl className="vc-faq">
            {problem.faq.map((f, i) => (
              <div className="vc-faq-item" key={i}>
                <dt>
                  <RichText text={f.q} />
                </dt>
                <dd>
                  <RichText text={f.a} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* ── Related ──────────────────────────────────────────────────────── */}
      {related.length > 0 ? (
        <section className="vc-fix-section" aria-labelledby="related">
          <h2 id="related" className="vc-fix-h2">
            Related problems
          </h2>
          <ul className="vc-fix-related">
            {related.map((r) => {
              const Art = ISSUE_ART[r.detector]
              return (
                <li key={r.slug}>
                  <Link href={`/fix/${r.slug}`}>
                    {Art ? (
                      <span className="vc-fix-related-art" aria-hidden="true">
                        <Art />
                      </span>
                    ) : null}
                    <span className="vc-fix-related-body">
                      <span className="vc-fix-related-t">{r.h1}</span>
                      <span className="vc-fix-related-d">{CATEGORY_LABELS[r.category]}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
