#!/usr/bin/env node
/**
 * Generate ~700 KB catalog-full.json for the resource-bloat demo fault.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'src', 'shop', 'data', 'catalog-full.json')

const GLAZES = [
  'Tide Blue', 'Harbor Fog', 'Kiln Ash', 'Sea Salt', 'Clay Pink',
  'Moss Green', 'Iron Speckle', 'Bone White', 'Storm Grey', 'Ember',
]
const SHAPES = ['mug', 'bowl', 'plate', 'vase', 'pourer', 'cup', 'jar', 'tray']
const NOTES = [
  'Thrown on the wheel and glazed by hand.',
  'Food-safe glaze, microwave fine, dishwasher if you must.',
  'Each piece varies a little — that is the point.',
  'Fired to cone 6 in the studio kiln.',
  'A small-batch run for the spring shelf.',
]

const products = []
let i = 0
// Keep adding until the serialized JSON is ~700 KB
while (true) {
  i += 1
  const glaze = GLAZES[i % GLAZES.length]
  const shape = SHAPES[i % SHAPES.length]
  products.push({
    id: `tw-${String(i).padStart(5, '0')}`,
    name: `${glaze} ${shape}`,
    glaze,
    shape,
    priceCents: 2800 + (i % 40) * 100,
    sku: `SKU-${glaze.slice(0, 3).toUpperCase()}-${shape.slice(0, 3).toUpperCase()}-${i}`,
    description: `${NOTES[i % NOTES.length]} ${glaze} on a ${shape}. Batch ${Math.floor(i / 10) + 1}.`,
    tags: [glaze, shape, 'ceramics', 'tidewell', `batch-${(i % 17) + 1}`],
    // Padding field so we hit ~700 KB without tens of thousands of rows
    _pad: `pad-${i}-` + 'x'.repeat(80 + (i % 40)),
  })
  if (i % 50 === 0) {
    const size = Buffer.byteLength(JSON.stringify({ generatedAt: 'tidewell', products }))
    if (size >= 700_000) break
  }
}

const catalog = {
  generatedAt: 'tidewell-demo',
  count: products.length,
  products,
}
const json = JSON.stringify(catalog)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, json)
console.log(`Wrote ${outPath} (${(Buffer.byteLength(json) / 1024).toFixed(0)} KB, ${products.length} products)`)
