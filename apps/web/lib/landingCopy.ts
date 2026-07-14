export const LANDING_COPY = {
  title: 'VibeCheck — the live press check for AI-built frontends',
  metaDescription:
    'A live press check for AI-built frontends. Catch performance and discoverability defects, then hand the marked-up evidence back to your coding agent.',
  hero: {
    eyebrow: ['VibeCheck', 'live press check', 'AI-built frontend'],
    headline: ['Your agent shipped it.', 'VibeCheck pulled the proof.'],
    lede:
      'A live press check for the AI-built frontend. VibeCheck reads every pass for jank, leaks, DOM bloat, layout shift, and discoverability defects—then hands the marked-up evidence back to your coding agent before those mistakes harden into production.',
    liveNote: 'The proof in the bottom-right is live—it is reading this page now.',
  },
  sections: {
    problem: {
      title: 'What slips through the first pass',
      sub: 'before the ink dries',
      body: [
        'The first pass can look clean and still be wrong. An AI agent ships a frontend that holds together in the happy path, then leaks memory across routes, bloats the DOM to 10k nodes, fires the same request eight times, janks on scroll, shifts as assets load, and quietly disappears from search and answer engines. The screen looked finished. Nobody pulled a proof.',
        'VibeCheck is the press check your coding agent was missing. It watches each run like a printer reads a proof sheet: measuring the page, marking the defects, and returning exact evidence through MCP so the agent can correct the next pass.',
      ],
    },
    demo: {
      title: 'Pull a bad proof',
      sub: 'make the defects visible',
      body: 'These are not mockups. Each control deliberately throws part of this page out of register: memory, DOM size, layout, requests, or the console. The live proof in the corner marks the fault within seconds. Clear the proof when you are done and the page returns to register.',
    },
    measurements: {
      title: 'Every pass, measured',
      sub: 'live control strip',
      body: 'A press operator does not judge a run by sight alone; the control strip tells the truth. VibeCheck does the same for the browser, continuously reading frame health, main-thread stalls, JS-heap memory, and Core Web Vitals from this page. These are live measurements, not a mockup.',
      closing: 'Those are the control readings. On top of them, VibeCheck identifies thirteen recurring defects by name and marks the exact evidence your agent needs for the correction.',
    },
    bestiary: {
      title: 'The Slop Bestiary',
      sub: 'thirteen recurring misprints',
      body: 'A specimen drawer of the defects AI agents keep putting back into circulation. Each card names the culprit, records how it slips into the run, and shows the exact proof mark VibeCheck emits when it catches one.',
      auditBody: 'Two specimens—seo and aeo—run as pass/fail press checks. Pull a proof of the page you are reading and see what search crawlers and answer engines actually receive, misses included.',
    },
    loop: {
      title: 'From proof mark to fix',
      sub: 'the correction loop',
      body: 'A useful proof does more than say something is wrong. The widget captures the reading, sends it to the local MCP server, and gives your coding agent the marked evidence it needs to propose the correction.',
      transition: 'Here is an illustrative correction loop as your agent sees it: a defect is marked, the evidence travels over MCP, a diff is proposed, and the next pass returns to register. The public demo stays local-only. Put it through the press:',
    },
    install: {
      title: 'Install the press check',
      sub: 'two blocks',
      closing: 'Nine project-scoped MCP tools, an llms.txt, and a Claude skill ship with the press check. The widget marks the defects; your agent gets the evidence.',
    },
  },
  demo: {
    reset: 'Clear the proof',
    calm: 'Proof is clean. Introduce a fault above; the live press check will mark it within seconds.',
  },
  gauges: {
    header: 'Live proof · this page, right now',
    note: 'read from the same collectors the widget ships',
  },
  audit: {
    heading: 'Pull a discoverability proof',
    button: 'Run the SEO / AEO press check',
    scanLink: 'Run a press check on any URL →',
  },
  install: {
    firstHeading: 'Mount the live proof',
    secondHeading: 'Connect the correction loop',
    quickstart: 'Set up the press check in five minutes →',
  },
  footerLead: 'Pull a proof before you call it done.',
} as const
