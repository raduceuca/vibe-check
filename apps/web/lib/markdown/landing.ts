import { SITE_URL, GITHUB_URL } from '@/lib/site'
import { LANDING_COPY } from '@/lib/landingCopy'

// Generated from LANDING_COPY so /index.md stays in sync with the landing.
export const landingMarkdown = (): string => {
  const [h1a, h1b] = LANDING_COPY.hero.headline
  const loop = LANDING_COPY.loop.steps
    .map((step) => `### ${step.name}\n\n${step.sentence}`)
    .join('\n\n')

  return `# ${h1a} ${h1b}

> ${LANDING_COPY.hero.lede}

## ${LANDING_COPY.look.title}

${LANDING_COPY.look.body}

- Smooth: Nothing jumps, nothing freezes, every tap lands.
- Light: It loads what it uses, and nothing twice.
- Clean: A quiet console, and the basics in place.
- Findable: Search engines know what this page is.
- Quotable: When someone asks an AI, it can quote you.

## ${LANDING_COPY.loop.title}

${LANDING_COPY.loop.body}

${loop}

## ${LANDING_COPY.notice.title}

${LANDING_COPY.notice.body[0]}

${LANDING_COPY.notice.body[1]}

## ${LANDING_COPY.install.title}

    ${LANDING_COPY.install.setupCommand('claude-code')}

## Links

- Docs: ${SITE_URL}/docs.md
- Quickstart: ${SITE_URL}/docs/quickstart.md
- Fix guides: ${SITE_URL}/fix.md
- Full markdown map for LLMs: ${SITE_URL}/llms.txt
- Whole site as one markdown file: ${SITE_URL}/llms-full.txt
- Source: ${GITHUB_URL}

${LANDING_COPY.footerLead}
`
}
