import { ISSUE_ART } from '@/components/issueArt'

interface Specimen {
  // The real detector name from @wcgw/vibe-check-core. Resolves the ISSUE_ART
  // glyph, keys the persona copy, and is paired with the exact issue string the
  // detector logs.
  readonly detector: string
  // 2-char periodic-style catalogue code shown top-left of the plate.
  readonly symbol: string
  readonly personaName: string
  readonly tagline: string
  readonly story: string
  // 1–5; carried by the pip count, never a second hue.
  readonly menace: number
  // The exact issue string this detector emits into the Problems list + the agent.
  readonly emit: string
}

const MENACE_MAX = 5

// The Slop Bestiary — the 13 recurring frontend regressions AI coding agents ship
// without noticing, catalogued as specimens. The persona fields (symbol, name,
// tagline, story, menace) are voice-harmonised field-guide copy; `detector` is the
// real detector — it resolves the single-tone ISSUE_ART glyph and is paired with
// the `emit` string it actually logs. Laid out as one drawer, grouped by kind:
// DOM/runtime, then asset weight, then head/audits.
const SPECIMENS: readonly Specimen[] = [
  {
    detector: 'dom-bloat',
    symbol: 'Db',
    personaName: 'The Div Matryoshka',
    tagline: `Always room for one more wrapper.`,
    story: `The agent solves every layout with another div — a flex shell here, a "container" there, an outer wrapper "just for spacing" — and never unwraps a single one. The layers stack like nesting dolls until querySelectorAll('*') sails past 800, then 1,500, and every style recalc and layout pass has to drag the whole swollen tree behind it.`,
    menace: 3,
    emit: 'DOM has 10,000 nodes',
  },
  {
    detector: 'duplicate-requests',
    symbol: 'Df',
    personaName: 'Doppelfetch',
    tagline: `Once was never going to be enough.`,
    story: `Born from a StrictMode double-render into a codebase with no cache, it fires the identical GET on every re-render and keystroke — no dedupe, no memo. Four copies of the same request land before the first response does, and on a POST it cheerfully submits the order twice.`,
    menace: 3,
    emit: 'Duplicate GET request ×8',
  },
  {
    detector: 'console-spam',
    symbol: 'Lg',
    personaName: 'The Blurtworm',
    tagline: `console.log('here'). And here. And here.`,
    story: `The agent scaffolds a component, sprinkles console.log('here') to check the wiring, and swears it will clear them before shipping. It never does, so the logs ride to production — fifty-plus calls every ten seconds, narrating every render and fetch to a console no user will open, and leaking whatever you passed in to anyone who hits F12.`,
    menace: 2,
    emit: 'console.error spam detected',
  },
  {
    detector: 'memory-leak',
    symbol: 'Lk',
    personaName: 'Heapwraith',
    tagline: `I keep everything you forget to clean up.`,
    story: `The agent writes addEventListener with no removeEventListener, effects that return no cleanup, intervals nobody clears — so every remount stacks another ghost subscription on the last. The heap climbs in a staircase, five megabytes at a time with no GC dip, hoarding detached nodes and stale closures until the tab runs itself out of memory.`,
    menace: 4,
    emit: 'Heap grew 27% in 30s',
  },
  {
    detector: 'layout-thrashing',
    symbol: 'Lt',
    personaName: 'Reflowler, the Restless Surveyor',
    tagline: `Read one pixel? Enjoy the reflow.`,
    story: `It rides the tidy-looking loop the agent wrote: read offsetHeight, set a style, read the next element's offsetTop, set another — each read forcing a full re-measure of the layout the last write just dirtied, dozens of times a frame. Then it ships images with no width or height, so the page lurches as they load and the button jumps the instant your thumb commits.`,
    menace: 4,
    emit: 'Forced reflow detected',
  },
  {
    detector: 'unoptimized-images',
    symbol: 'Ox',
    personaName: 'The Bandwidth Ox',
    tagline: `Ships a billboard to fill a thumbnail.`,
    story: `It drops the full 4000-pixel export straight into a 400-pixel slot — no resize, no srcset, no width or height, because none of that was in the prompt. The browser downloads every last pixel, crushes them into the box, and shifts the layout on the way down. Flawless on the agent's fiber; a mugging on mobile data.`,
    menace: 3,
    emit: 'Image 4× larger than displayed',
  },
  {
    detector: 'large-images',
    symbol: 'Mb',
    personaName: 'Fatbyte, the Hero-Slot Whale',
    tagline: `Shipped it full-res. The network can cope.`,
    story: `The agent needed a hero, grabbed a four-megabyte stock JPEG, and dropped it in untouched — no WebP, no compression, no second thought. It looks perfect on the fiber connection and the Retina mock, then a real person on 4G downloads all four megabytes to watch one banner paint a row at a time.`,
    menace: 3,
    emit: 'Large image (2.4 MB)',
  },
  {
    detector: 'long-task-attribution',
    symbol: 'Lf',
    personaName: 'Loafgeist, the Main-Thread Squatter',
    tagline: `One thread. I'm loafing on it.`,
    story: `The agent crammed the whole parse-sort-and-render into the click handler — synchronous, never yielding — so the frame that owed you a response just sits there for 200ms. The click registered; it simply couldn't be bothered to paint. LoAF names the exact file and blocking time, which is how you learn the culprit is the bundle nobody split.`,
    menace: 4,
    emit: 'Long task blocked the thread 240ms',
  },
  {
    detector: 'resource-bloat',
    symbol: 'Rb',
    personaName: 'Megabyte the Gorger',
    tagline: `Why tree-shake when you can ship the forest?`,
    story: `One date needed formatting, so it shipped all of moment.js, the whole of lodash, and an icon set of four thousand glyphs to render three — the network tab never once opened. It weighs every JS and CSS payload as it crosses the wire and flags the ones that blow the page-weight budget. Invisible on office fiber; a five-second white screen on a commuter's phone.`,
    menace: 3,
    emit: 'Page weight over budget',
  },
  {
    detector: 'heavy-library',
    symbol: 'Kb',
    personaName: 'The Kilobyte Kraken',
    tagline: `All 67 locales aboard. You'll use one.`,
    story: `Trained on a decade of tutorials that imported the full lodash and reached for moment by reflex, the agent does the same: npm i moment to format one timestamp, all of Ant Design for a single button. It never announces itself — it just leaves fingerprints across the global scope (window._, window.moment, a chart.umd.js in the network tab) until the bundle analyzer reads like a crime scene.`,
    menace: 3,
    emit: 'Heavy library detected',
  },
  {
    detector: 'web-essentials',
    symbol: 'Hd',
    personaName: 'The Headless Scaffold',
    tagline: `The <body> shipped. Nobody opened the <head>.`,
    story: `The agent builds a flawless component tree and never once opens index.html, so the document head stays a hollow shell — no favicon, no viewport, no lang, no charset. The dev server's headers and your desktop width paper over it locally, then it ships: a blank tab icon, a phone rendering at 980px, and "café" turning into "cafÃ©." Four one-line fixes, none of them written, because boilerplate isn't a feature nobody prompts for.`,
    menace: 3,
    emit: 'Missing viewport meta tag',
  },
  {
    detector: 'seo',
    symbol: 'Se',
    personaName: 'The Clipboard Crawler',
    tagline: `Twenty boxes. You ticked four.`,
    story: `It waits for the SPA to finish rendering, then walks the <head> with a clipboard — title, meta description, canonical, og:image, robots — twenty checks, each a cold pass or fail. The agent shipped <title>Vite + React</title> untouched and never wrote an og:image, so every tab is anonymous and every shared link previews as a blank grey box. It also finds the stray noindex someone pasted from a tutorial, quietly telling Google the page was never born.`,
    menace: 3,
    emit: 'SEO 62 / 100',
  },
  {
    detector: 'aeo',
    symbol: 'Ae',
    personaName: 'The Ghostpage',
    tagline: `Renders for people. Reads as blank to the bots.`,
    story: `The agent ships a page that only exists after JavaScript runs — no text in the raw HTML, no JSON-LD, no llms.txt, and a robots.txt that waves GPTBot and ClaudeBot off at the door. Humans see a polished site; an answer engine fetches it, finds an empty shell it can't parse or cite, and leaves. So ChatGPT recommends your competitor and has never heard of you.`,
    menace: 2,
    emit: 'AEO 71 / 100',
  },
]

// Each specimen plate "fires" on hover AND keyboard focus (tabIndex + focus-
// within): the resting tagline register cross-fades to the field note — the
// naturalist story, then the real detector name paired with the exact issue
// string it emits (reusing the .vc-emit fault-red treatment). The menace pips
// pulse once. Non-destructive — a visual field-guide entry, NOT a real fault
// (that is what §02's "Break this page" buttons do). Reduced-motion callers get
// the field note statically (see the media query in global.css). The glyph is
// decorative (aria-hidden); the plate carries a descriptive aria-label.
export const DetectorsGrid = () => (
  <div className="vc-grid vc-bestiary" role="list">
    {SPECIMENS.map((s, i) => {
      const Art = ISSUE_ART[s.detector]
      const cat = `No. ${String(i + 1).padStart(2, '0')} / ${SPECIMENS.length}`
      return (
        <div
          className="vc-card vc-spec"
          key={s.detector}
          data-fire=""
          role="listitem"
          tabIndex={0}
          aria-label={`${s.personaName}. ${s.tagline} Detector ${s.detector}, menace ${s.menace} of ${MENACE_MAX}. Emits: ${s.emit}`}
        >
          <div className="vc-spec-rail">
            <span className="vc-spec-sym">{s.symbol}</span>
            <span
              className="vc-spec-menace"
              role="img"
              aria-label={`menace ${s.menace} of ${MENACE_MAX}`}
            >
              {Array.from({ length: MENACE_MAX }, (_, p) => (
                <span
                  key={p}
                  className="vc-spec-pip"
                  data-on={p < s.menace ? '' : undefined}
                  aria-hidden="true"
                />
              ))}
            </span>
          </div>

          {Art ? (
            <span className="vc-spec-art" aria-hidden="true">
              <Art />
            </span>
          ) : null}

          <div className="vc-spec-base">
            <div className="vc-spec-name">{s.personaName}</div>
            <p className="vc-spec-tagline">{s.tagline}</p>
            <div className="vc-spec-note">
              <div className="vc-spec-note-inner">
                <p className="vc-spec-story">{s.story}</p>
                <div className="vc-spec-emitrow">
                  <span className="vc-spec-detname">{s.detector}</span>
                  <span className="vc-emit">{s.emit}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="vc-spec-foot" aria-hidden="true">
            <span className="vc-spec-cat">{cat}</span>
            <span className="vc-spec-pin" />
          </div>
        </div>
      )
    })}
  </div>
)
