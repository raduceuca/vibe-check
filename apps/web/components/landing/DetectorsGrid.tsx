interface DetectorRow {
  readonly name: string
  readonly what: string
  readonly emit: string
}

// The instrument's dial faces — the 13 detectors + audits, each with a one-line
// description and a representative issue string it emits. Grounded in the real
// detector set exported from @wcgw/vibe-check-core.
const DETECTORS: readonly DetectorRow[] = [
  { name: 'dom-bloat', what: 'Counts document nodes; trips past 800 / 1,500.', emit: 'DOM has 10,000 nodes' },
  { name: 'duplicate-requests', what: 'Patches fetch; flags identical calls in a window.', emit: 'Duplicate GET request ×8' },
  { name: 'console-spam', what: 'Counts console.* over a rolling 10s window.', emit: 'console.error spam detected' },
  { name: 'memory-leak', what: 'Samples the heap; flags sustained growth.', emit: 'Heap grew 27% in 30s' },
  { name: 'layout-thrashing', what: 'Watches forced reflows from read/write interleaving.', emit: 'Forced reflow detected' },
  { name: 'long-task-attribution', what: 'Attributes long frames to the script behind them.', emit: 'Long task blocked the thread 240ms' },
  { name: 'unoptimized-images', what: 'Flags images served far larger than rendered.', emit: 'Image 4× larger than displayed' },
  { name: 'large-images', what: 'Flags heavy individual image payloads.', emit: 'Large image (2.4 MB)' },
  { name: 'resource-bloat', what: 'Totals transferred bytes against a budget.', emit: 'Page weight over budget' },
  { name: 'heavy-library', what: 'Fingerprints known-heavy libraries on the page.', emit: 'Heavy library detected' },
  { name: 'web-essentials', what: 'Checks favicon, viewport, lang, charset, title.', emit: 'Missing viewport meta tag' },
  { name: 'seo', what: 'Scores search visibility as a pass/fail checklist.', emit: 'SEO 62 / 100' },
  { name: 'aeo', what: 'Scores answer-engine readiness for AI assistants.', emit: 'AEO 71 / 100' },
]

export const DetectorsGrid = () => (
  <div className="vc-grid vc-grid-3">
    {DETECTORS.map((d) => (
      <div className="vc-card" key={d.name}>
        <div className="vc-k">
          <span className="vc-kd" />
          {d.name}
        </div>
        <div className="vc-v">{d.what}</div>
        <div className="vc-emit">{d.emit}</div>
      </div>
    ))}
  </div>
)
