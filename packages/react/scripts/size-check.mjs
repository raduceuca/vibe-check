// Bundle-size budget for the eagerly-loaded main chunk. The FPS chart (liveline,
// ~62KB) is a lazy `import()` so it is code-split out of dist/index.js — this
// guard fails if it (or anything comparable) gets pulled back into the eager
// bundle. Dependency-free: gzip the built ESM entry and compare to the budget.
import { gzipSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, '..', 'dist', 'index.js')

// 45KB gz. The main chunk is ~25KB gz today (react/react-dom external, liveline
// lazy); the headroom catches a real regression — e.g. liveline going eager
// again would add ~20KB gz and blow the budget.
const BUDGET_GZ = 45 * 1024

const kb = (n) => `${(n / 1024).toFixed(1)} KB`

if (!existsSync(bundle)) {
  console.error('dist/index.js not found — run `pnpm build` first.')
  process.exit(1)
}

const gz = gzipSync(readFileSync(bundle)).length
console.log(`main bundle (gzip): ${kb(gz)}  ·  budget: ${kb(BUDGET_GZ)}`)

if (gz > BUDGET_GZ) {
  console.error(`✗ over budget by ${kb(gz - BUDGET_GZ)} — keep liveline (and other heavy deps) lazy-loaded.`)
  process.exit(1)
}

console.log('✓ within budget')
