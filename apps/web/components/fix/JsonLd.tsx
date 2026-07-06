// Renders a JSON-LD block into the page. The data is built server-side from the
// problem (see lib/problems/jsonld.ts) and serialized once — this is the AEO
// signal answer engines read, dogfooding VibeCheck's own structured-data check.

export const JsonLd = ({ data }: { data: readonly unknown[] }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
)
