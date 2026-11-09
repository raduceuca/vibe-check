export const GET = (): Response => {
  const body = `# Next.js App Router example

A VibeCheck integration example for the Next.js App Router.

- Home: https://example.com/
- Docs: https://vibecheck.wcgw.fun/docs/examples
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
