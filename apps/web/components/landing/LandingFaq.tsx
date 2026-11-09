import { LANDING_COPY } from '@/lib/landingCopy'
import { StepHead } from './StepHead'

export const LandingFaq = () => {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LANDING_COPY.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }

  return (
    <section id="faq" className="vc-section" aria-labelledby="faq-heading">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <StepHead id="faq-heading" title={LANDING_COPY.faq.title} />
      <div style={{ display: 'grid', gap: 0 }}>
        {LANDING_COPY.faq.items.map((item) => (
          <details
            key={item.q}
            style={{
              padding: '16px 0',
              borderBottom: '1px solid var(--vc-line-2, var(--vc-line))',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontFamily: 'var(--vc-serif)',
                fontWeight: 500,
                fontSize: 20,
                lineHeight: 1.3,
              }}
            >
              {item.q}
            </summary>
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 16,
                lineHeight: 1.5,
                color: 'var(--vc-ink-2)',
              }}
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
