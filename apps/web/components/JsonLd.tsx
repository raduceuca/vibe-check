// Renders a JSON-LD graph into the page as a single <script
// type="application/ld+json">. The data is built server-side and serialized
// once — this is the AEO signal answer engines read, dogfooding VibeCheck's own
// structured-data check. Shared by the /fix, /docs, and category/hub pages.

export const JsonLd = ({ data }: { data: readonly unknown[] }) => (
  <script
    type="application/ld+json"
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
)
