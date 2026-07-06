import type { Problem } from './types'

// ── AEO agent-discovery problems ─────────────────────────────────────────────
// Signals that control whether AI crawlers and agents can find, read, and act on
// the site: llms.txt, markdown negotiation, robots access, MCP discovery.
// Source: packages/core/src/detectors/aeo.ts.

export const aeoAgentProblems: readonly Problem[] = [
  {
    slug: 'missing-llms-txt',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'llms-txt-missing',
    severity: 'info',
    title: 'Fix a missing llms.txt file',
    metaDescription:
      'llms.txt hands AI assistants a clean markdown summary of your site so they read it accurately. Add one at /llms.txt to guide LLMs to your best pages.',
    h1: 'Missing llms.txt',
    pain: 'llms.txt is the emerging convention for handing LLMs a clean, curated markdown map of your site — what it is, and links to the pages you most want read — instead of leaving them to scrape rendered HTML full of navigation and markup. As assistants increasingly answer questions using your content, an llms.txt is a cheap way to steer them to the right, accurate source.',
    symptoms: [
      'Assistants summarise your site from noisy scraped HTML',
      'No single machine-readable index of your key pages for LLMs',
      'A GET to /llms.txt returns 404',
      'You have no control over which pages LLMs prioritise',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'No llms.txt',
      threshold: '/llms.txt is not served as a 2xx text/plain or markdown response',
    },
    rootCauses: [
      'The file simply hasn’t been created yet',
      'It exists but isn’t served with a text/plain or markdown content type',
      'It’s not deployed to the site root',
    ],
    fix: {
      summary:
        'Publish a markdown file at /llms.txt: an H1 with the site name, a short blockquote summary, then sections of links (title + one-line description) to the pages you want LLMs to read. Serve it as text/plain or text/markdown from the root.',
      steps: [
        'Write /llms.txt: an H1 title, a one-line summary, then curated link sections',
        'Link your most important, canonical pages with a short description each',
        'Serve it from the site root with a text/plain or markdown content type',
      ],
      code: [
        {
          lang: 'html',
          caption: 'llms.txt (markdown)',
          code: `# Acme Docs

> Acme is a widget platform. This file points LLMs to the canonical docs.

## Guides
- [Quickstart](https://acme.com/docs/quickstart): Get running in 5 minutes.
- [API reference](https://acme.com/docs/api): Every endpoint and type.`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Serve it from a Route Handler at app/llms.txt/route.ts, or generate it from your content and write it to public/ at build. A route handler lets you build the link list from your real pages.',
        code: [
          {
            lang: 'ts',
            caption: 'app/llms.txt/route.ts',
            code: `export function GET() {
  const body = \`# Acme Docs\\n\\n> Summary.\\n\\n## Guides\\n- [Quickstart](https://acme.com/docs/quickstart)\\n\`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}`,
          },
        ],
      },
      svelte: {
        note: 'Expose it via a SvelteKit endpoint that returns text/plain, or drop a static file in static/.',
        code: [
          {
            lang: 'ts',
            caption: 'src/routes/llms.txt/+server.ts',
            code: `export function GET() {
  return new Response('# Acme Docs\\n\\n> Summary.\\n', { headers: { 'Content-Type': 'text/plain' } })
}`,
          },
        ],
      },
      vanilla: {
        note: 'Place a static llms.txt at the web root and ensure your server sends a text/plain content type for it.',
        code: [
          {
            lang: 'html',
            code: `# served from https://acme.com/llms.txt with Content-Type: text/plain`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Is llms.txt an official standard?',
        a: 'It’s an emerging convention, not a formal standard, but it’s increasingly recognised. It costs almost nothing to add and gives you a curated surface for LLMs, which is why it’s worth doing.',
      },
      {
        q: 'What’s the difference between llms.txt and robots.txt?',
        a: 'robots.txt controls what crawlers may access; llms.txt is a positive, curated markdown summary that points LLMs to your best content. They’re complementary.',
      },
      {
        q: 'What should I put in it?',
        a: 'A title, a one-line description of the site, and grouped links to your most important canonical pages, each with a short description. Keep it concise and current.',
      },
    ],
    related: ['missing-markdown-negotiation', 'missing-structured-data', 'ai-crawlers-blocked', 'missing-mcp-discovery'],
  },

  {
    slug: 'missing-markdown-negotiation',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'markdown-negotiation-missing',
    severity: 'info',
    title: 'Fix missing markdown content negotiation',
    metaDescription:
      'Serving a markdown version to agents that ask for it lets them read your content without parsing the DOM. Add Accept: text/markdown negotiation.',
    h1: 'No markdown content negotiation',
    pain: 'When an agent requests your page with Accept: text/markdown and gets HTML back, it has to parse the full DOM — navigation, scripts, styling — to recover the content. Offering a markdown representation of the same URL hands agents clean, structured text directly. It’s an advanced, optional signal, but a strong one for agent-first sites and docs.',
    symptoms: [
      'Requesting the page with Accept: text/markdown returns HTML',
      'Agents parse noisy DOM instead of clean content',
      'No lightweight text representation for programmatic consumers',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'No markdown content negotiation',
      threshold: 'A request with Accept: text/markdown still returns an HTML content type',
    },
    rootCauses: [
      'The server ignores the Accept header and always returns HTML',
      'No markdown source or renderer exposed for content routes',
    ],
    fix: {
      summary:
        'Honour the Accept header: when a request prefers text/markdown, respond with a markdown representation of the same content and a text/markdown content type. For content built from markdown already, this is often just serving the source. Add a Vary: Accept header so caches keep the two representations separate.',
      steps: [
        'Detect Accept: text/markdown on your content routes',
        'Return the markdown representation with a text/markdown content type',
        'Send Vary: Accept so caches don’t mix HTML and markdown responses',
      ],
      code: [
        {
          lang: 'js',
          caption: 'Negotiate on the Accept header',
          code: `if (req.headers.accept?.includes('text/markdown')) {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Vary', 'Accept')
  return res.end(page.markdownSource)
}`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Branch on the Accept header inside a Route Handler (or Middleware) and return the markdown source with the right content type and Vary header.',
        code: [
          {
            lang: 'ts',
            caption: 'app/blog/[slug]/route.ts (or middleware)',
            code: `export async function GET(req: Request, { params }) {
  const post = await getPost((await params).slug)
  if (req.headers.get('accept')?.includes('text/markdown')) {
    return new Response(post.markdown, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' },
    })
  }
  return new Response(renderHtml(post), { headers: { 'Content-Type': 'text/html' } })
}`,
          },
        ],
      },
      vanilla: {
        note: 'In any server, check the Accept header on content routes and serve the markdown source when it’s preferred.',
        code: [
          {
            lang: 'js',
            code: `app.get('/docs/:slug', (req, res) => {
  const wantsMd = (req.get('Accept') || '').includes('text/markdown')
  res.vary('Accept')
  res.type(wantsMd ? 'text/markdown' : 'text/html').send(wantsMd ? doc.md : doc.html)
})`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Is markdown negotiation required?',
        a: 'No — it’s an optional, advanced AEO signal, most valuable for docs and agent-facing sites. VibeCheck reports it as info, not an error. Skip it if your content isn’t markdown-backed.',
      },
      {
        q: 'Why send Vary: Accept?',
        a: 'So shared caches and CDNs store the HTML and markdown responses separately per Accept header, instead of serving one to a client that asked for the other.',
      },
      {
        q: 'How is this different from llms.txt?',
        a: 'llms.txt is one static index of your key content for LLMs; markdown negotiation serves a clean markdown version of any URL on request. They complement each other — llms.txt points agents at the content, negotiation delivers it without the DOM noise.',
      },
    ],
    related: ['missing-llms-txt', 'content-requires-javascript', 'missing-structured-data', 'missing-mcp-discovery'],
  },

  {
    slug: 'ai-crawlers-blocked',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'ai-crawlers-blocked',
    severity: 'warning',
    title: 'Fix robots.txt blocking AI crawlers',
    metaDescription:
      'If robots.txt disallows GPTBot, ClaudeBot or PerplexityBot, assistants can’t read or cite you. Allow the AI crawlers you want to appear in answers.',
    h1: 'robots.txt blocks AI crawlers',
    pain: 'If your robots.txt disallows AI crawlers — GPTBot, ClaudeBot, PerplexityBot, Google-Extended and friends — then assistants can’t read your content and won’t cite you in their answers. This is often accidental: a blanket Disallow, or a default that shipped with a template, quietly cuts you out of the fastest-growing discovery channel. (If the block is deliberate, that’s a valid choice — just make sure it is.)',
    symptoms: [
      'robots.txt has a Disallow: / for * or for AI bot user-agents',
      'Your content never appears in AI assistant answers',
      'Assistants say they can’t access the page',
      'VibeCheck lists the specific bots your robots.txt blocks',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'robots.txt blocks AI crawlers',
      threshold: 'robots.txt has Disallow: / for * or a known AI bot (GPTBot, ClaudeBot, PerplexityBot, …)',
    },
    rootCauses: [
      'A blanket Disallow: / left over from staging',
      'A template default that blocks AI user-agents',
      'Blocking AI bots specifically without intending to',
    ],
    fix: {
      summary:
        'Decide deliberately. If you want to be read and cited by assistants, ensure robots.txt allows the AI crawlers (or at least doesn’t Disallow: / for them). Scope any Disallow to genuinely private paths rather than blocking the whole site or all AI agents. If you intend to block them, keep it — just confirm it’s intentional.',
      steps: [
        'Open robots.txt and find any Disallow: / affecting * or AI bots',
        'Allow the AI crawlers you want to appear in answers',
        'Scope remaining Disallow rules to private paths only',
      ],
      code: [
        {
          lang: 'html',
          caption: 'robots.txt — allow AI crawlers, block only private paths',
          code: `User-agent: *
Allow: /
Disallow: /admin/

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: https://acme.com/sitemap.xml`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Generate robots.txt from app/robots.ts with MetadataRoute.Robots so the allow/disallow rules live in code and stay reviewable.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots',
        code: [
          {
            lang: 'ts',
            caption: 'app/robots.ts',
            code: `import type { MetadataRoute } from 'next'
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/admin/' }],
    sitemap: 'https://acme.com/sitemap.xml',
  }
}`,
          },
        ],
      },
      vanilla: {
        note: 'Edit the static robots.txt at your web root. Remove any Disallow: / that isn’t intentional and scope rules to private paths.',
        code: [
          {
            lang: 'html',
            code: `User-agent: *
Allow: /
Disallow: /admin/`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Which user-agents are the AI crawlers?',
        a: 'The common ones include GPTBot and OAI-SearchBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot (Perplexity), Google-Extended (Google’s AI training), and CCBot (Common Crawl). VibeCheck names the specific ones your robots.txt blocks.',
      },
      {
        q: 'Should I allow AI crawlers?',
        a: 'It’s a business decision. If you want visibility and citations in AI answers, allow them. If you want to keep content out of AI training/answers, block them deliberately. The point is to choose, not to block by accident.',
      },
      {
        q: 'Does blocking Google-Extended affect normal Google Search?',
        a: 'No. Google-Extended controls AI/Gemini training and AI features; it’s separate from Googlebot’s normal indexing. You can allow Googlebot and still block Google-Extended if you prefer.',
      },
    ],
    related: ['missing-robots-txt', 'missing-sitemap', 'missing-llms-txt', 'missing-mcp-discovery'],
  },

  {
    slug: 'missing-mcp-discovery',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'mcp-discovery-missing',
    severity: 'info',
    title: 'Fix missing MCP agent discovery',
    metaDescription:
      'Sites that want agents to take actions can advertise an MCP server so assistants discover their tools. Add a /.well-known/mcp.json for agent discovery.',
    h1: 'No agent interface (MCP) advertised',
    pain: 'Most AEO is about being read; this one is about being acted on. If your site exposes actions an agent could take — booking, search, checkout, an API — advertising a Model Context Protocol (MCP) interface lets assistants discover and use those tools instead of scraping. It’s optional and only relevant for app/API sites, but for those it’s how you become agent-usable rather than merely agent-readable.',
    symptoms: [
      'A GET to /.well-known/mcp.json returns 404',
      'Agents can read your content but can’t invoke your actions',
      'No machine-discoverable description of your tools/endpoints',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'No agent interface (MCP) advertised',
      threshold: '/.well-known/mcp.json is not served as a 2xx JSON response',
    },
    rootCauses: [
      'No MCP server exists for the site’s actions yet',
      'An MCP server exists but isn’t advertised at a discoverable well-known path',
    ],
    fix: {
      summary:
        'If (and only if) your site offers actions worth exposing to agents, build an MCP server describing those tools and advertise it with a discovery document at /.well-known/mcp.json served as application/json. For a pure content site this is safely skipped — it’s reported as info.',
      steps: [
        'Decide whether agents should take actions on your site (skip if it’s content-only)',
        'Build an MCP server exposing those actions as tools',
        'Advertise it at /.well-known/mcp.json with an application/json content type',
      ],
      code: [
        {
          lang: 'json',
          caption: '/.well-known/mcp.json (discovery document)',
          code: `{
  "name": "acme",
  "description": "Search and book Acme widgets.",
  "server": { "url": "https://acme.com/mcp" }
}`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Serve the discovery document from a Route Handler at app/.well-known/mcp.json/route.ts, returning application/json.',
        code: [
          {
            lang: 'ts',
            caption: 'app/.well-known/mcp.json/route.ts',
            code: `export function GET() {
  return Response.json({ name: 'acme', server: { url: 'https://acme.com/mcp' } })
}`,
          },
        ],
      },
      vanilla: {
        note: 'Host a static /.well-known/mcp.json and ensure it’s served with an application/json content type.',
        code: [
          {
            lang: 'json',
            code: `{ "name": "acme", "server": { "url": "https://acme.com/mcp" } }`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Do content sites need this?',
        a: 'No. MCP discovery only matters if you want agents to take actions (search, book, buy, call an API). A blog or docs site can safely ignore it — that’s why VibeCheck reports it as info, not a warning.',
      },
      {
        q: 'What is MCP?',
        a: 'The Model Context Protocol is an open standard for exposing tools and data to AI agents in a structured way. Advertising an MCP server lets assistants discover and use your actions rather than reverse-engineering your UI.',
      },
      {
        q: 'How is an MCP server different from a REST API?',
        a: 'A REST API is a set of endpoints a developer wires up by hand; an MCP server describes those same actions as self-documenting tools an agent can discover and call without a bespoke integration. If you already have an API, an MCP server is usually a thin wrapper that makes it agent-usable.',
      },
    ],
    related: ['missing-llms-txt', 'ai-crawlers-blocked', 'missing-markdown-negotiation', 'missing-structured-data'],
  },
]
