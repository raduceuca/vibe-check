import { renderLlmsFull } from '@/lib/markdown'

// /llms-full.txt — the whole site (landing + every docs page + every fix guide)
// concatenated into one markdown document, so an LLM can ingest all of it in a
// single fetch. Served as text/plain, prerendered at build.

export const dynamic = 'force-static'

export const GET = (): Response =>
  new Response(renderLlmsFull(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
