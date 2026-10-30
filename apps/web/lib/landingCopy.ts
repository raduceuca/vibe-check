import { MCP_PACKAGE_SPEC, getWatchInstruction } from '@wcgw/vibe-check-core'

export type LandingAgent = 'claude-code' | 'codex' | 'cursor'

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
          "The issue counts as fixed only after two fresh snapshots arrive without it. If it comes back later, it's marked regressed.",
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
  confirm: {
    title: "It's fixed when the page says it is.",
    body:
      "After resolve_issue, VibeCheck keeps measuring. When two fresh snapshots arrive without the problem, it's marked fixed. If the problem is still there, it goes back to the agent as unfinished. If it comes back after that, it's marked regressed, so you hear about it before anyone else does.",
    phaseLine1: 'detected → sent → working → verifying → fixed',
    phaseLine2: 'fixed → regressed',
    caption:
      "In the panel's plain-words mode these read To fix, Sent to AI, AI is working, Checking the fix, Fixed and Came back.",
    reminder:
      "You've seen a small version of this already. Put something back on this page and its row waits for two clean readings before it says passing again.",
    backLink: 'Back to the readings',
    ledgerTitle: 'Every verified fix is written down',
    ledgerBody:
      "Fixes, failed checks and regressions are kept in your project's .vibecheck/state.json. Read them with the stats command, or ask your agent to call get_project_impact.",
    statsCommand: `npx -y ${MCP_PACKAGE_SPEC} stats --project my-app --markdown`,
  },
  yourCall: {
    title: 'Your call.',
    body: "Here's what VibeCheck measured on this page while you read. It won't make the call for you.",
    copySummary: 'Copy this summary',
    runOwn: 'Run it on your own app',
  },
  install: {
    title: 'Run it on your own app.',
    body:
      'You need a React 18+ app, Node 20 or later, and Claude Code, Codex, or Cursor. It takes about five minutes.',
    setupCommand: (agent: LandingAgent) =>
      `npx -y ${MCP_PACKAGE_SPEC} setup --agent ${agent}`,
    upCommand: (agent: LandingAgent) =>
      `npx -y ${MCP_PACKAGE_SPEC} up --project my-app --agent ${agent}`,
    watchInstruction: getWatchInstruction('my-app'),
    mountSnippet: `import { VibeCheckDevtools } from './VibeCheckDevtools'

export const Root = () => (
  <>
    <App />
    <VibeCheckDevtools />
  </>
)`,
    steps: [
      {
        title: 'Run setup in your project',
        note:
          'Installs the widget, writes VibeCheckDevtools.tsx (in src/ when you have one), and registers the MCP bridge with your agent. Add --dry-run to see every step first.',
      },
      {
        title: 'Mount it once, near your app root',
        note: 'It renders nothing in production builds.',
      },
      {
        title: 'Start the hub and leave it running',
        note:
          'One hub on 127.0.0.1:4200 serves every project on your machine. Setup prints this exact command with your project id.',
      },
      {
        title: 'Tell your agent to watch',
        note: null,
      },
    ] as const,
    overlayAside:
      'Only want the overlay? Run npm i -D @wcgw/vibe-check, mount <PerfToggle />, and press Alt+Shift+V to show or hide it. No hub needed.',
    closing:
      'Then break something on purpose and press Send to agent. Want to see it on a broken app first? The repo includes Tidewell, a shop that fails every vibe on purpose:',
    demoCommand: 'pnpm install && pnpm --filter demo dev',
    links: [
      { label: 'Read the quickstart', href: '/docs/quickstart' },
      { label: 'See all ten MCP tools', href: '/docs/reference/mcp-tools' },
      { label: "Fix a connection that won't go green", href: '/docs/troubleshooting' },
      {
        label: 'Copy a working setup: Next.js App Router or Vite + React',
        href: '/docs/examples',
      },
    ] as const,
  },
  faq: {
    title: 'Straight answers.',
    items: [
      {
        q: 'Does anything leave my machine?',
        a: "No. The widget sends snapshots to a hub on your own machine at 127.0.0.1:4200, and the hub talks only to the agent session you connected. There's no account and no hosted service.",
      },
      {
        q: 'Does it ship to production?',
        a: 'No. The component setup writes renders nothing when NODE_ENV is production.',
      },
      {
        q: 'Which agents does it work with?',
        a: 'Claude Code, Codex and Cursor, over MCP. One agent session holds one project at a time, so an issue never lands in the wrong chat.',
      },
      {
        q: 'Is this Lighthouse?',
        a: 'No. Lighthouse scores a page once, in a lab. VibeCheck watches the page while you build, names the defect, hands the one you pick to your agent, and checks the fix on fresh readings.',
      },
      {
        q: 'Which frameworks?',
        a: "The overlay is for React 18 and later. The engine underneath has zero dependencies and runs on any page. Vue and Svelte overlays don't exist yet.",
      },
      {
        q: 'What does "fixed" mean?',
        a: "Your agent can ask for verification. It can't declare victory. An issue is fixed when two newer snapshots stop showing it. If it comes back, it's marked regressed.",
      },
    ] as const,
  },
  footerLead: 'Keep building fast. Keep the final say.',
} as const
