#!/usr/bin/env node
/**
 * Generate local Tidewell image placeholders under demo/public/images/.
 * Hero is intentionally huge (~2.4 MB, zlib store) so large-images trips.
 * Product shots are 1600×1200 (compressed) so unoptimized-images sees oversized-for-display.
 */
import { deflateRawSync } from 'node:zlib'
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
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateRawSync(raw, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const GLAZES = [
  [42, 78, 112],
  [120, 96, 72],
  [180, 170, 150],
  [90, 110, 88],
  [160, 120, 100],
  [70, 90, 110],
  [140, 100, 80],
  [100, 100, 100],
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
// 1200×700 RGB store ≈ 2.4 MB transfer — enough for large-images (≥500 KB)
const hero = writePng(1200, 700, heroPaint, 0)
writeFileSync(join(outDir, 'hero-4000.jpg'), hero)
console.log(`hero-4000.jpg ${(hero.length / 1024 / 1024).toFixed(2)} MB`)

for (let i = 1; i <= 8; i++) {
  const [br, bg, bb] = GLAZES[i - 1]
  const paint = (x, y, w, h) => {
    const cx = x / w - 0.5
    const cy = y / h - 0.5
    const d = Math.sqrt(cx * cx + cy * cy)
    const shade = 1 - d * 0.55
    return [
      Math.max(0, Math.min(255, br * shade)),
      Math.max(0, Math.min(255, bg * shade)),
      Math.max(0, Math.min(255, bb * shade)),
    ]
  }
  const buf = writePng(1600, 1200, paint, 6)
  const name = `product-${i}.jpg`
  writeFileSync(join(outDir, name), buf)
  console.log(`${name} ${(buf.length / 1024).toFixed(0)} KB (${1600}×${1200})`)
}

console.log(`Wrote placeholders to ${outDir}`)
