import { markdownPaths, resolveMarkdownForPath } from '@/lib/markdown'

// ── Markdown route ───────────────────────────────────────────────────────────
// Serves a clean markdown representation of every page. The middleware rewrites
// `<path>.md` URLs and `Accept: text/markdown` requests to `/md/<path>`; this
// handler resolves that path to real markdown. Every known path is prerendered
// at build (generateStaticParams), so the docs `fs` reads happen once, at build;
// `dynamicParams` stays on so the handler resolves any path on demand and unknown
// paths get a clean 404 from resolveMarkdownForPath rather than a param mismatch.

export const dynamic = 'force-static'
export const dynamicParams = true

export const generateStaticParams = (): { path: string[] }[] => markdownPaths()

interface Ctx {
  readonly params: Promise<{ path?: string[] }>
}

export const GET = async (_request: Request, { params }: Ctx): Promise<Response> => {
  const { path } = await params
  const markdown = resolveMarkdownForPath(path ?? [])
  if (markdown === null) {
    return new Response('Not found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return new Response(markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
