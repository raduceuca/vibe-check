import { ISSUE_ART } from '@/components/issueArt'

type Sev = 'error' | 'warning'

interface DetectorRow {
  readonly name: string
  readonly what: string
  readonly emit: string
  // Drives the fire accent hue: red (error) for hard breakage, amber (warning)
  // for the softer, advisory signals. Purely the colour of the demo pulse.
  readonly sev: Sev
}

// The instrument's dial faces — the 13 detectors + audits, each with a one-line
// description and a representative issue string it emits. Grounded in the real
// detector set exported from @wcgw/vibe-check-core.
const DETECTORS: readonly DetectorRow[] = [
  { name: 'dom-bloat', what: 'Counts document nodes; trips past 800 / 1,500.', emit: 'DOM has 10,000 nodes', sev: 'error' },
  { name: 'duplicate-requests', what: 'Patches fetch; flags identical calls in a window.', emit: 'Duplicate GET request ×8', sev: 'warning' },
  { name: 'console-spam', what: 'Counts console.* over a rolling 10s window.', emit: 'console.error spam detected', sev: 'error' },
  { name: 'memory-leak', what: 'Samples the heap; flags sustained growth.', emit: 'Heap grew 27% in 30s', sev: 'error' },
  { name: 'layout-thrashing', what: 'Watches forced reflows from read/write interleaving.', emit: 'Forced reflow detected', sev: 'error' },
  { name: 'long-task-attribution', what: 'Attributes long frames to the script behind them.', emit: 'Long task blocked the thread 240ms', sev: 'warning' },
  { name: 'unoptimized-images', what: 'Flags images served far larger than rendered.', emit: 'Image 4× larger than displayed', sev: 'warning' },
  { name: 'large-images', what: 'Flags heavy individual image payloads.', emit: 'Large image (2.4 MB)', sev: 'warning' },
  { name: 'resource-bloat', what: 'Totals transferred bytes against a budget.', emit: 'Page weight over budget', sev: 'warning' },
  { name: 'heavy-library', what: 'Fingerprints known-heavy libraries on the page.', emit: 'Heavy library detected', sev: 'warning' },
  { name: 'web-essentials', what: 'Checks favicon, viewport, lang, charset, title.', emit: 'Missing viewport meta tag', sev: 'warning' },
  { name: 'seo', what: 'Scores search visibility as a pass/fail checklist.', emit: 'SEO 62 / 100', sev: 'warning' },
  { name: 'aeo', what: 'Scores answer-engine readiness for AI assistants.', emit: 'AEO 71 / 100', sev: 'warning' },
]

// Each card "fires" on hover AND keyboard focus (tabIndex + focus-within): the
// issue string emits (fade/slide in) and the dot pulses its severity. Non-
// destructive — this is a visual demo of the detector noticing, NOT a real fault
// (that is what §02's "Break this page" buttons do). Reduced-motion callers get
// the issue string statically (see the media query in global.css).
export const DetectorsGrid = () => (
  <div className="vc-grid vc-grid-3" role="list">
    {DETECTORS.map((d) => {
      const Art = ISSUE_ART[d.name]
      return (
        <div
          className="vc-card"
          key={d.name}
          data-fire=""
          data-sev={d.sev}
          role="listitem"
          tabIndex={0}
          aria-label={`${d.name} detector. ${d.what} Emits: ${d.emit}`}
        >
          <div className="vc-card-head">
            {Art ? (
              <span className="vc-art" aria-hidden="true">
                <Art />
              </span>
            ) : null}
            <div className="vc-k">
              <span className="vc-kd" />
              {d.name}
            </div>
          </div>
          <div className="vc-v">{d.what}</div>
          <div className="vc-emit">{d.emit}</div>
        </div>
      )
    })}
  </div>
)
