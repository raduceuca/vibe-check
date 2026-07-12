// Generates the detector / per-check reference block shared by core/README.md
// and skills/vibe-check/SKILL.md from the single sources of truth:
//   • the protocol's DETECTOR_NAMES (which detectors exist)
//   • each detector's own threshold constants (at what values they fire)
//   • the seo/aeo/web-essentials check lists (what each audit checks)
//
// Zero dependencies (node:fs only). Run with `pnpm gen:docs`. It rewrites the
// region between the BEGIN/END markers in both docs, so a drifted README is a
// one-command fix rather than a hand-edit. If a detector is added to the
// protocol but not described here, the script throws — turning doc drift into a
// hard failure.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const coreDir = join(here, '..')
const repoRoot = join(coreDir, '..', '..')
const detectorsDir = join(coreDir, 'src', 'detectors')

const read = (path) => readFileSync(path, 'utf8')
const fmt = (n) => n.toLocaleString('en-US')

// ── Read threshold constants straight from detector source ───────────────────

const num = (file, name) => {
  const src = read(join(detectorsDir, file))
  const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9_]+(?:\\.[0-9]+)?)`))
  if (!m) throw new Error(`constant ${name} not found in detectors/${file}`)
  return Number(m[1].replace(/_/g, ''))
}

const domWarn = num('domBloat.ts', 'WARN_NODE_THRESHOLD')
const domErr = num('domBloat.ts', 'ERROR_NODE_THRESHOLD')
const dupWinS = num('duplicateRequests.ts', 'DUPLICATE_WINDOW_MS') / 1000
const consoleThreshold = num('consoleSpam.ts', 'DEFAULT_THRESHOLD')
const consoleWinS = num('consoleSpam.ts', 'WINDOW_SECONDS')
const memWarn = num('memoryLeak.ts', 'WARN_GROWTH_PCT')
const memErr = num('memoryLeak.ts', 'ERROR_GROWTH_PCT')
const memWinS = num('memoryLeak.ts', 'WINDOW_MS') / 1000
const shifts = num('layoutThrashing.ts', 'CLUSTER_MIN_SHIFTS')
const clusterWinMs = num('layoutThrashing.ts', 'CLUSTER_WINDOW_MS')
const aspect = num('unoptimizedImages.ts', 'ASPECT_TOLERANCE')
const largeKB = num('largeImages.ts', 'SIZE_THRESHOLD_KB')
const loafFrames = num('longTaskAttribution.ts', 'LONG_FRAME_THRESHOLD')
const resProd = num('resourceBloat.ts', 'LARGE_RESOURCE_THRESHOLD_KB_PROD')
const resDev = num('resourceBloat.ts', 'LARGE_RESOURCE_THRESHOLD_KB_DEV')
const titleMax = num('seo.ts', 'TITLE_MAX')
const descMax = num('seo.ts', 'DESC_MAX')

// ── Derive lists from source ─────────────────────────────────────────────────

const protocolSrc = read(join(repoRoot, 'packages', 'protocol', 'src', 'index.ts'))
const namesBlock = protocolSrc.match(/DETECTOR_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/)
if (!namesBlock) throw new Error('DETECTOR_NAMES not found in protocol')
const detectorNames = [...namesBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

// `{ check|id: 'x', severity: 'y', title: 'Z' }` — the order every finding uses.
const findings = (file, keyName) => {
  const src = read(join(detectorsDir, file))
  const re = new RegExp(`${keyName}:\\s*'([^']+)',\\s*(?:severity:\\s*'[^']+',\\s*)?title:\\s*'([^']+)'`, 'g')
  const out = []
  const seen = new Set()
  for (const m of src.matchAll(re)) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    out.push({ id: m[1], title: m[2] })
  }
  return out
}

const seoChecks = findings('seo.ts', 'check')
const aeoChecks = findings('aeo.ts', 'check')
const webChecks = findings('webEssentials.ts', 'id')
const heavyCount = [...read(join(detectorsDir, 'heavyLibrary.ts')).matchAll(/packageName:\s*'/g)].length

// ── Detector table (validated against DETECTOR_NAMES) ────────────────────────

const rows = {
  'dom-bloat': { catches: 'Excessive DOM nodes and deep nesting', threshold: `≥ ${fmt(domWarn)} nodes (warning), ≥ ${fmt(domErr)} (error)` },
  'duplicate-requests': { catches: 'The same URL + method fetched repeatedly', threshold: `2+ identical requests within ${dupWinS}s` },
  'console-spam': { catches: 'High-volume console output', threshold: `> ${consoleThreshold} calls per ${consoleWinS}s window` },
  'memory-leak': { catches: 'Steadily growing JS heap without GC recovery', threshold: `> ${memWarn}% growth over ${memWinS}s (warning), > ${memErr}% (error)` },
  'layout-thrashing': { catches: 'Clusters of layout shifts without user input', threshold: `≥ ${shifts} shifts within ${clusterWinMs}ms` },
  'unoptimized-images': { catches: 'Missing dimensions/lazy/alt, oversized, or distorted images', threshold: `natural > 2× rendered; aspect mismatch > ${aspect}` },
  'large-images': { catches: 'Oversized image transfers', threshold: `≥ ${fmt(largeKB)}KB (warning), ≥ 1,024KB (error)` },
  'long-task-attribution': { catches: 'Scripts causing long animation frames (LoAF)', threshold: `≥ ${loafFrames} long frames attributed to one source` },
  'resource-bloat': { catches: 'Oversized JS/CSS/font/image resources', threshold: `≥ ${resProd}KB (prod) / ${fmt(resDev)}KB (dev)` },
  'web-essentials': { catches: 'Missing document essentials (favicon, viewport, lang, charset)', threshold: `${webChecks.length} document checks` },
  'heavy-library': { catches: 'Known heavy libraries and their pitfalls', threshold: `${heavyCount} library signatures` },
  'seo': { catches: 'Discoverability / search-visibility problems', threshold: `${seoChecks.length} checks (title ≤ ${titleMax}, description ≤ ${descMax} chars, …)` },
  'aeo': { catches: 'AI answer-engine / agent readiness', threshold: `${aeoChecks.length} checks` },
}

// Drift guard: every registered detector must be described, and vice versa.
for (const name of detectorNames) {
  if (!rows[name]) throw new Error(`detector "${name}" is in DETECTOR_NAMES but not described in gen-detector-reference.mjs`)
}
for (const name of Object.keys(rows)) {
  if (!detectorNames.includes(name)) throw new Error(`detector "${name}" is described but not in DETECTOR_NAMES (removed?)`)
}

const list = (checks) => checks.map((c) => `- \`${c.id}\` — ${c.title}`).join('\n')

const block = `<!-- Generated by scripts/gen-detector-reference.mjs — run \`pnpm gen:docs\`. Do not edit by hand. -->

All ${detectorNames.length} detectors are enabled by default; toggle any of them via \`config.detectors\`.

| Detector | What it catches | Threshold |
|----------|-----------------|-----------|
${detectorNames.map((n) => `| \`${n}\` | ${rows[n].catches} | ${rows[n].threshold} |`).join('\n')}

### Audit checks

The \`seo\`, \`aeo\`, and \`web-essentials\` detectors each emit one issue per failed check.

#### Search visibility (\`seo\`) — ${seoChecks.length} checks

${list(seoChecks)}

#### AI answer-engine readiness (\`aeo\`) — ${aeoChecks.length} checks

${list(aeoChecks)}

#### Document essentials (\`web-essentials\`) — ${webChecks.length} checks

${list(webChecks)}`

// ── Rewrite the marked region in each doc ────────────────────────────────────

const BEGIN = '<!-- BEGIN GENERATED DETECTOR REFERENCE -->'
const END = '<!-- END GENERATED DETECTOR REFERENCE -->'

const rewrite = (path) => {
  const text = read(path)
  const re = new RegExp(`${BEGIN}[\\s\\S]*?${END}`)
  if (!re.test(text)) throw new Error(`markers not found in ${path}`)
  writeFileSync(path, text.replace(re, `${BEGIN}\n${block}\n${END}`))
  console.log(`updated ${path}`)
}

rewrite(join(coreDir, 'README.md'))
rewrite(join(repoRoot, 'skills', 'vibe-check', 'SKILL.md'))
console.log(`\n${detectorNames.length} detectors, ${seoChecks.length} SEO + ${aeoChecks.length} AEO + ${webChecks.length} web-essentials checks documented.`)
