#!/usr/bin/env node
// Renders the app icons as PNGs with no image dependencies: a radial "orb" on
// the app's dark ground, encoded straight into a PNG via zlib.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function icon(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const mix = (a, b, t) => Math.round(a + (b - a) * Math.max(0, Math.min(1, t)))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter byte: none
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2) / (size / 2)
      const dy = (y - size * 0.46) / (size / 2)
      const d = Math.sqrt(dx * dx + dy * dy)
      // Background: the app's night-blue ground, lifted slightly at the top.
      let r = mix(20, 7, y / size)
      let g = mix(34, 11, y / size)
      let b = mix(68, 22, y / size)
      // Orb: violet core fading into blue, ending well inside the safe area.
      const orb = Math.max(0, 1 - d / 0.62)
      const glow = Math.pow(orb, 1.8)
      r = mix(r, 155, glow)
      g = mix(g, 140, glow * 0.95)
      b = mix(b, 255, glow)
      const ring = Math.exp(-Math.pow((d - 0.42) / 0.035, 2))
      r = mix(r, 238, ring * 0.55)
      g = mix(g, 242, ring * 0.55)
      b = mix(b, 255, ring * 0.55)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), icon(size))
  console.log(`public/icon-${size}.png`)
}
