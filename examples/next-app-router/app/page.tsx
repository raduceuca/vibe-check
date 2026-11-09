const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Next.js App Router example for VibeCheck',
  description:
    'A Next.js App Router page that passes four vibes and leaves one intentional Quotable miss: mcp-discovery-missing.',
  url: 'https://example.com/',
  author: { '@type': 'Person', name: 'VibeCheck examples' },
  dateModified: '2026-10-30',
}

export const HomePage = () => (
  <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 80px', lineHeight: 1.55 }}>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <h1 style={{ fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
      Next.js App Router, checked
    </h1>
    <p style={{ margin: '0 0 16px', fontSize: 16, color: '#333' }}>
      This example is what passing looks like on a real App Router site. Four vibes
      pass. Quotable keeps one info-level miss — <code>mcp-discovery-missing</code> —
      because this site does not invent an MCP server.
    </p>
    <p style={{ margin: 0, fontSize: 15, color: '#444' }}>
      Open the widget with Alt+Shift+V. The pill should read <strong>1 problem</strong>.
    </p>
  </main>
)

export default HomePage
