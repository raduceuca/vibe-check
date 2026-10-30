import { MCP_PACKAGE_SPEC } from '@wcgw/vibe-check-core'

export const LANDING_COPY = {
  title: 'VibeCheck — your agent built it. You decide if it ships.',
  metaDescription:
    'A dev overlay that checks your AI-built frontend for jank, bloat, leaks and SEO/AEO gaps, sends the issue you pick to your coding agent, and verifies the fix.',
  hero: {
    kicker: 'For React apps built with Claude Code, Codex, or Cursor',
    headline: ['Your agent built it.', 'You decide if it ships.'] as const,
    lede:
      "VibeCheck is a performance and SEO overlay for AI-built frontends. It runs in the corner of your dev server, names what's wrong on the live page, and sends the one issue you pick to the coding agent working on it. A fix counts only when fresh browser readings say so.",
    primaryCta: 'Set it up in five minutes',
    secondaryCta: 'Break this page first',
    setupLabel: 'Set up with',
    noteWide:
      "That dark panel is VibeCheck, measuring this tab right now. It's the same package you'd install.",
    noteNarrow:
      'VibeCheck is running on this page. Tap the pill in the bottom corner to open it.',
    liveLineSsr: 'Running on this page now',
  },
  look: {
    title: 'This page, checked as you read it.',
    body:
      'Five readings from the same engine as the panel in the corner, measured in your browser while you read. Break anything below and watch its row change.',
    caption:
      'Same engine as the panel in the corner, running in this tab. No hub is configured on this site, so nothing it measures leaves your browser.',
    recheck: 'Run the audits again',
    showAll: 'Show all 28 checks',
  },
  loop: {
    title: 'Four steps. One of them is yours.',
    body:
      'Your agent is fast. It\'s also confident about things it never looked at. VibeCheck puts a check between "it compiles" and "it ships", and you\'re the one holding it.',
    steps: [
      {
        name: 'VibeCheck notices.',
        sentence:
          'It measures the running page from the corner of your dev server: frames, layout, memory, requests, the console, and how search and answer engines read it.',
        link: 'Break this page',
        href: '#notice',
        yours: false,
      },
      {
        name: 'You decide.',
        sentence:
          'Nothing goes to your agent until you press Send to agent on the issue you care about. Ignoring the rest is allowed.',
        link: 'How sending works',
        href: '#decide',
        yours: true,
      },
      {
        name: 'Your agent fixes.',
        sentence:
          'One agent session holds your project and receives exactly that issue, with the evidence attached.',
        link: 'See a real run',
        href: '#fix',
        yours: false,
      },
      {
        name: 'The browser confirms.',
        sentence:
          'The issue counts as fixed only after two fresh snapshots arrive without it. If it comes back later, it\'s marked regressed.',
        link: 'How verifying works',
        href: '#confirm',
        yours: false,
      },
    ] as const,
  },
  notice: {
    title: 'Now break it the way agents do.',
    body: [
      'Agents are generous. They render all two thousand rows, drop a photo straight off the camera into a thumbnail, fetch the same data from two components, and add a banner that loads late. The page still looks finished in a screenshot. It only feels wrong when you use it.',
      'Each button below does one of those things to this page, for real. Press one and watch the corner.',
    ] as const,
    footnote:
      'These controls change your copy of this page only. Search engines and other visitors get the real one.',
  },
  install: {
    title: 'Set it up in five minutes',
    setupCommand: (agent: 'claude-code' | 'codex' | 'cursor') =>
      `npx -y ${MCP_PACKAGE_SPEC} setup --agent ${agent}`,
  },
  footerLead: 'Keep building fast. Keep the final say.',
} as const
