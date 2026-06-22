import type { Detector, VibeIssue, Severity } from '../types.js'
import { createIssue } from './createIssue.js'

// ── AEO / agent-readiness audit ─────────────────────────────────────────────
// "Answer Engine Optimization" — can AI agents and answer engines (ChatGPT,
// Perplexity, Claude, Google AI Overviews) discover, read, and act on this
// site? Distinct from SEO (which is about classic search ranking). Covers the
// browser-detectable signals: content accessibility, AI-bot access control, and
// agent protocol discovery. (DNS-AID and agentic-commerce protocols need
// DNS/server access and aren't checkable from the page.)

// Known AI / answer-engine crawler user-agents.
const AI_BOTS = [
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web',
  'anthropic-ai', 'perplexitybot', 'google-extended', 'ccbot', 'bytespider',
  'cohere-ai', 'meta-externalagent', 'applebot-extended',
]

// Parse robots.txt and return the AI bots that are disallowed from the root.
// Consecutive User-agent lines share the following rule block.
export const blockedAiBots = (robots: string): string[] => {
  const lines = robots.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  const blocked = new Set<string>()
  let agents: string[] = []
  let collectingAgents = false

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':')
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()

    if (key === 'user-agent') {
      if (!collectingAgents) agents = []
      agents.push(value.toLowerCase())
      collectingAgents = true
    } else if (key === 'disallow') {
      collectingAgents = false
      if (value === '/') {
        for (const a of agents) {
          if (a === '*' || AI_BOTS.includes(a)) blocked.add(a === '*' ? 'all crawlers (*)' : a)
        }
      }
    } else {
      collectingAgents = false
    }
  }
  return [...blocked]
}

interface AeoFinding {
  readonly check: string
  readonly severity: Severity
  readonly title: string
  readonly description: string
  readonly detail?: string
}

const okText = async (path: string, init?: RequestInit): Promise<{ ok: boolean; type: string; body: string }> => {
  try {
    if (typeof fetch === 'undefined') return { ok: false, type: '', body: '' }
    const res = await fetch(path, init)
    const type = res.headers.get('content-type') ?? ''
    const body = res.ok ? await res.text() : ''
    return { ok: res.ok, type, body }
  } catch {
    return { ok: false, type: '', body: '' }
  }
}

const rawBodyTextLength = (html: string): number => {
  try {
    if (typeof DOMParser === 'undefined') return html.length
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().length
  } catch {
    return html.length
  }
}

export const createAeoDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let hasRun = false
  let cancelled = false
  let timerId: ReturnType<typeof setTimeout> | null = null
  let loadHandler: (() => void) | null = null

  const emit = (f: AeoFinding): void => {
    if (cancelled) return
    issues = [
      ...issues,
      createIssue('aeo', f.severity, f.title, f.description, f.detail !== undefined ? { check: f.check, detail: f.detail } : { check: f.check }),
    ]
  }

  const runChecks = (): void => {
    if (typeof document === 'undefined') return
    if (hasRun) return
    hasRun = true

    // ── Synchronous: structured data ─────────────────────────────────────
    if (document.querySelector('script[type="application/ld+json"]') === null) {
      emit({ check: 'structured-data-missing', severity: 'warning', title: 'No structured data (JSON-LD)', description: 'No <script type="application/ld+json">. Answer engines extract entities, facts, and answers from schema.org JSON-LD — without it they have to guess from prose.' })
    }

    // ── Async probes ─────────────────────────────────────────────────────
    void (async () => {
      // llms.txt — the emerging AI-readability standard (curated markdown summary).
      const llms = await okText('/llms.txt')
      if (!llms.ok || (!llms.type.includes('text/plain') && !llms.type.includes('markdown'))) {
        emit({ check: 'llms-txt-missing', severity: 'info', title: 'No llms.txt', description: 'No /llms.txt. It is the emerging convention for handing LLMs a clean, curated summary of your site so they read it accurately instead of scraping rendered HTML.' })
      }

      // Content available without JS — answer-engine crawlers often don't run JS.
      if (typeof location !== 'undefined') {
        const page = await okText(location.href)
        if (page.ok) {
          const rawLen = rawBodyTextLength(page.body)
          if (rawLen < 200) {
            emit({ check: 'content-requires-js', severity: 'warning', title: 'Content only renders with JavaScript', description: `The HTML the server sends contains almost no text (${rawLen} chars) — the page is built client-side. Crawlers and agents that don't execute JavaScript see an empty page. Consider SSR/SSG or a prerendered fallback.`, detail: `${rawLen} chars in raw HTML` })
          }
        }

        // Markdown content negotiation — does the server offer a markdown view?
        const md = await okText(location.href, { headers: { Accept: 'text/markdown' } })
        if (md.ok && !md.type.includes('markdown')) {
          emit({ check: 'markdown-negotiation-missing', severity: 'info', title: 'No markdown content negotiation', description: 'Requesting the page with Accept: text/markdown returns HTML. Serving a markdown representation lets agents read your content without parsing the DOM.' })
        }
      }

      // AI bot access control.
      const robots = await okText('/robots.txt')
      if (robots.ok) {
        const blocked = blockedAiBots(robots.body)
        if (blocked.length > 0) {
          emit({ check: 'ai-crawlers-blocked', severity: 'warning', title: 'robots.txt blocks AI crawlers', description: `robots.txt disallows ${blocked.join(', ')}. If you want to appear in AI answers and be cited by assistants, allow these agents (or scope the Disallow to private paths).`, detail: blocked.join(', ') })
        }
      }

      // MCP / agent protocol discovery.
      const mcp = await okText('/.well-known/mcp.json')
      if (!mcp.ok || !mcp.type.includes('json')) {
        emit({ check: 'mcp-discovery-missing', severity: 'info', title: 'No agent interface (MCP) advertised', description: 'No /.well-known/mcp.json. Sites that want agents to take actions (not just read) can expose an MCP server card so assistants discover available tools. Optional, and only relevant for app/API sites.' })
      }
    })()
  }

  return {
    name: 'aeo',

    start(): void {
      if (typeof document === 'undefined') return
      cancelled = false
      if (document.readyState === 'complete') {
        timerId = setTimeout(runChecks, 600)
      } else {
        loadHandler = () => { timerId = setTimeout(runChecks, 600) }
        window.addEventListener('load', loadHandler, { once: true })
      }
    },

    stop(): void {
      cancelled = true
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      if (loadHandler !== null) {
        window.removeEventListener('load', loadHandler)
        loadHandler = null
      }
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      hasRun = false
    },
  }
}
