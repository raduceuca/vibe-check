#!/usr/bin/env node
/**
 * Generate Tidewell image placeholders under demo/public/images/.
 *
 * - hero-4000.png — intentionally huge (~2.4 MB) so large-images trips.
 * - hero-800.png / hero-1600.png — smaller stand-ins for the reference fix srcset.
 * - product-N.png — 1600×1200 glaze fields for unoptimized-images.
 * - product-N-sm.png — ~560×420 for fixed srcset.
 * - mug-N.svg — simple ceramic mug shapes (colour from glaze, not photography).
 *
 * PNG IDAT must use zlib-wrapped deflate (`deflateSync`). Raw deflate
 * (`deflateRawSync`) produces files browsers refuse to decode.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'images')

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const u32 = (n) => {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0, 0)
  return b
}

const chunk = (type, data) => {
  const typeBuf = Buffer.from(type, 'ascii')
  return Buffer.concat([u32(data.length), typeBuf, data, u32(crc32(Buffer.concat([typeBuf, data])))])
}

const writePng = (width, height, paint, level) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const rowSize = 1 + width * 3
  const raw = Buffer.alloc(rowSize * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize
    raw[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y, width, height)
      const i = rowStart + 1 + x * 3
      raw[i] = r & 0xff
      raw[i + 1] = g & 0xff
      raw[i + 2] = b & 0xff
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const GLAZES = [
  { name: 'Tide Blue', rgb: [42, 78, 112] },
  { name: 'Harbor Fog', rgb: [120, 96, 72] },
  { name: 'Kiln Ash', rgb: [180, 170, 150] },
  { name: 'Sea Salt', rgb: [90, 110, 88] },
  { name: 'Moss Green', rgb: [160, 120, 100] },
  { name: 'Ember', rgb: [70, 90, 110] },
  { name: 'Bone White', rgb: [140, 100, 80] },
  { name: 'Iron Speckle', rgb: [100, 100, 100] },
]

mkdirSync(outDir, { recursive: true })

const heroPaint = (x, y, w, h) => {
  const n = ((x * 13 + y * 29) ^ (x * y)) & 0xff
  const band = y / h
  return [
    Math.min(255, 210 - band * 40 + (n & 15)),
    Math.min(255, 205 - band * 30 + ((n >> 2) & 15)),
    Math.min(255, 198 - band * 20 + ((n >> 4) & 15)),
  ]
}

// ~2.4 MB store-level PNG — large-images (≥500 KB) on first view
const heroHuge = writePng(1200, 700, heroPaint, 0)
writeFileSync(join(outDir, 'hero-4000.png'), heroHuge)
console.log(`hero-4000.png ${(heroHuge.length / 1024 / 1024).toFixed(2)} MB`)

const hero1600 = writePng(1600, 900, heroPaint, 6)
writeFileSync(join(outDir, 'hero-1600.png'), hero1600)
console.log(`hero-1600.png ${(hero1600.length / 1024).toFixed(0)} KB`)

const hero800 = writePng(800, 450, heroPaint, 6)
writeFileSync(join(outDir, 'hero-800.png'), hero800)
console.log(`hero-800.png ${(hero800.length / 1024).toFixed(0)} KB`)

for (let i = 1; i <= 8; i++) {
  const { rgb, name } = GLAZES[i - 1]
  const [br, bg, bb] = rgb
  const paint = (x, y, w, h) => {
    const cx = x / w - 0.5
    const cy = y / h - 0.5
    const d = Math.sqrt(cx * cx + cy * cy)
    const shade = 1 - d * 0.55
    const inMug = d < 0.28 && cy > -0.05
    const rim = Math.abs(d - 0.28) < 0.02 && cy > -0.08
    const boost = rim ? 1.15 : inMug ? 0.92 : 1
    return [
      Math.max(0, Math.min(255, Math.round(br * shade * boost))),
      Math.max(0, Math.min(255, Math.round(bg * shade * boost))),
      Math.max(0, Math.min(255, Math.round(bb * shade * boost))),
    ]
  }
  const full = writePng(1600, 1200, paint, 6)
  writeFileSync(join(outDir, `product-${i}.png`), full)
  const sm = writePng(560, 420, paint, 6)
  writeFileSync(join(outDir, `product-${i}-sm.png`), sm)

  const [r, g, b] = rgb
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="420" viewBox="0 0 560 420" role="img" aria-label="${name} mug">
  <rect width="560" height="420" fill="#f6f6f4"/>
  <ellipse cx="260" cy="320" rx="110" ry="18" fill="#00000012"/>
  <path d="M170 120 h160 a20 20 0 0 1 20 20 v140 c0 40-40 70-100 70 s-100-30-100-70 V140 a20 20 0 0 1 20-20 z" fill="rgb(${r},${g},${b})"/>
  <ellipse cx="250" cy="120" rx="80" ry="22" fill="rgb(${Math.min(255, r + 30)},${Math.min(255, g + 30)},${Math.min(255, b + 30)})"/>
  <ellipse cx="250" cy="120" rx="58" ry="14" fill="rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})"/>
  <path d="M350 160 h36 a36 36 0 0 1 0 100 h-36" fill="none" stroke="rgb(${r},${g},${b})" stroke-width="22" stroke-linecap="round"/>
</svg>
`
  writeFileSync(join(outDir, `mug-${i}.svg`), svg)
  console.log(`product-${i}.png ${(full.length / 1024).toFixed(0)} KB + sm + mug-${i}.svg`)
}

console.log(`Wrote procedural placeholders to ${outDir}`)

// Prefer real Stilla photos when Pillow is available (looks like a shop, not noise).
try {
  const { spawnSync } = await import('node:child_process')
  const photo = spawnSync('python3', [join(__dirname, 'gen-photo-assets.py')], { stdio: 'inherit' })
  if (photo.status === 0) {
    console.log('Replaced placeholders with Stilla photo stand-ins (gen-photo-assets.py)')
  } else {
    console.warn('gen-photo-assets.py skipped/failed — keeping procedural PNGs')
  }
} catch (err) {
  console.warn('gen-photo-assets.py unavailable — keeping procedural PNGs')
}
