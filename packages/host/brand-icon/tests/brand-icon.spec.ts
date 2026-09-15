/**
 * Coverage over what a caller receives: the icon and favicon traced from PNGs
 * built in the test, each refusal a file can cause, and the brand SVG check.
 */

import { crc32, deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { IconError, isBrandSvg, vectorizeIcon } from '../src/index.ts'

type Pixel = readonly [number, number, number, number]

const BLACK: Pixel = [0, 0, 0, 255]
const WHITE: Pixel = [255, 255, 255, 255]
const CLEAR: Pixel = [0, 0, 0, 0]

/**
 * Frame one PNG chunk.
 * @param type - the four-letter chunk type.
 * @param data - the chunk payload.
 * @returns the chunk with its length and checksum.
 */
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

/**
 * The PNG signature and an IHDR chunk declaring an RGBA image.
 * @param width - declared width.
 * @param height - declared height.
 * @returns the opening bytes of a PNG.
 */
function header(width: number, height: number): Buffer {
  const fields = Buffer.alloc(13)
  fields.writeUInt32BE(width, 0)
  fields.writeUInt32BE(height, 4)
  fields[8] = 8
  fields[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', fields)])
}

/**
 * Encode an RGBA PNG.
 * @param width - image width.
 * @param height - image height.
 * @param pixel - colour of each pixel.
 * @returns the PNG bytes.
 */
function png(width: number, height: number, pixel: (x: number, y: number) => Pixel): Uint8Array {
  const row = width * 4 + 1
  const raw = Buffer.alloc(row * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      raw.set(pixel(x, y), y * row + 1 + x * 4)
    }
  }
  return new Uint8Array(Buffer.concat([header(width, height), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}

/**
 * A 1024px card: transparent rounded corners, white inside, the mark in black.
 * @param mark - whether a pixel belongs to the mark.
 * @returns the PNG bytes.
 */
function card(mark: (x: number, y: number) => boolean): Uint8Array {
  return png(1024, 1024, (x, y) => {
    const cx = Math.max(120 - x, x - 903, 0)
    const cy = Math.max(120 - y, y - 903, 0)
    if (cx * cx + cy * cy > 120 * 120) return CLEAR
    return mark(x, y) ? BLACK : WHITE
  })
}

/** An L-shaped mark whose ink is 600 wide and 500 high. */
const L_MARK = card((x, y) => (x >= 300 && x < 420 && y >= 250 && y < 750) || (x >= 300 && x < 900 && y >= 650 && y < 750))

/**
 * Run a call expected to refuse, and report what it refused with.
 * @param run - the call.
 * @returns the refusal code, the foreign error, or undefined when nothing was thrown.
 */
function refusal(run: () => unknown): unknown {
  try {
    run()
  } catch (error) {
    return error instanceof IconError ? error.code : error
  }
  return undefined
}

/**
 * The x and y coordinates of every path in a document.
 * @param svg - the document.
 * @returns the coordinates by axis.
 */
function coordinates(svg: string): { xs: number[]; ys: number[] } {
  const xs: number[] = []
  const ys: number[] = []
  for (const match of svg.matchAll(/ d="([^"]+)"/gu)) {
    const numbers = (match[1] ?? '').split(/[A-Z ]+/u).filter(token => token !== '').map(Number)
    numbers.forEach((value, index) => (index % 2 === 0 ? xs : ys).push(value))
  }
  return { xs, ys }
}

describe('vectorizeIcon', () => {
  it('traces a PNG into a tight currentColor icon and a square favicon', () => {
    const result = vectorizeIcon(L_MARK)

    expect([result.width, result.height]).toEqual([600, 500])
    expect(result.aspect).toBeCloseTo(1.2, 10)
    expect(result.paths).toBeGreaterThan(0)
    expect(result.icon).toContain('width="600" height="500" viewBox="0 0 600 500" fill="currentColor">')
    expect(result.favicon).toContain('width="625" height="625" viewBox="0 0 625 625" fill="#000">')
    expect(result.favicon).toContain('<style>@media (prefers-color-scheme: dark) { path { fill: #fff; } }</style>')
    expect(isBrandSvg(result.icon)).toBe(true)
    expect(isBrandSvg(result.favicon)).toBe(true)
  })

  it('places the traced shape against the edges of the icon and centres it in the favicon', () => {
    const result = vectorizeIcon(L_MARK)
    const icon = coordinates(result.icon)
    expect(Math.min(...icon.xs)).toBeCloseTo(0, 0)
    expect(Math.max(...icon.xs)).toBeCloseTo(600, 0)
    expect(Math.min(...icon.ys)).toBeCloseTo(0, 0)
    expect(Math.max(...icon.ys)).toBeCloseTo(500, 0)

    const favicon = coordinates(result.favicon)
    expect(Math.min(...favicon.xs)).toBeCloseTo(12.5, 0)
    expect(Math.min(...favicon.ys)).toBeCloseTo(62.5, 0)
  })

  it('produces the same documents for the same PNG', () => {
    expect(vectorizeIcon(L_MARK)).toEqual(vectorizeIcon(L_MARK))
  })

  it('refuses a file that is not a PNG, before decoding anything', () => {
    expect(refusal(() => vectorizeIcon(new TextEncoder().encode('GIF89a not a png at all')))).toBe('NOT_PNG')
    expect(refusal(() => vectorizeIcon(new Uint8Array(header(1024, 1024).subarray(0, 20))))).toBe('NOT_PNG')
  })

  it('refuses a PNG whose declared size is out of range, without decoding it', () => {
    expect(refusal(() => vectorizeIcon(new Uint8Array(header(1024, 512))))).toBe('TOO_SMALL')
    expect(refusal(() => vectorizeIcon(new Uint8Array(header(5000, 1024))))).toBe('TOO_LARGE')
  })

  it('refuses a PNG whose pixels cannot be decoded', () => {
    const corrupt = Buffer.concat([header(1024, 1024), Buffer.from('not image data')])
    expect(refusal(() => vectorizeIcon(new Uint8Array(corrupt)))).toBe('UNREADABLE_PNG')
  })

  it('refuses an image with no mark, or a mark too small to trace', () => {
    expect(refusal(() => vectorizeIcon(card(() => false)))).toBe('NO_INK')
    expect(refusal(() => vectorizeIcon(card((x, y) => x === 512 && y === 512)))).toBe('NO_INK')
  })

  it('refuses a light mark on a dark background', () => {
    const inverted = png(1024, 1024, (x, y) => (x >= 300 && x < 900 && y >= 300 && y < 800 ? WHITE : BLACK))
    expect(refusal(() => vectorizeIcon(inverted))).toBe('DARK_BACKGROUND')
  })

  it('refuses a mark taller than it is wide, or wider than 1.4:1', () => {
    expect(refusal(() => vectorizeIcon(card((x, y) => x >= 400 && x < 600 && y >= 200 && y < 800)))).toBe('TOO_TALL')
    expect(refusal(() => vectorizeIcon(card((x, y) => x >= 150 && x < 950 && y >= 350 && y < 650)))).toBe('TOO_WIDE')
    expect(() => vectorizeIcon(card((x, y) => x >= 150 && x < 950 && y >= 350 && y < 650))).toThrow(/2\.67:1, wider than 1\.4:1/u)
  })

  it('refuses a mark that traces to too many shapes', () => {
    const dots = card((x, y) => {
      const dx = (x % 80) - 40
      const dy = (y % 80) - 40
      return x > 160 && x < 880 && y > 160 && y < 880 && dx * dx + dy * dy < 100
    })
    expect(refusal(() => vectorizeIcon(dots))).toBe('TOO_COMPLEX')
  })
})

describe('isBrandSvg', () => {
  const wordmark = '<svg xmlns="http://www.w3.org/2000/svg" width="60.53" height="24" viewBox="0 0 60.53 24" fill="currentColor">'
    + '<path d="M1.5 2 L3 4 Q5 6 7 8 C9 10 11 12 -1 0 Z"/></svg>'

  it('accepts the wordmark form as well as the traced documents', () => {
    expect(isBrandSvg(wordmark)).toBe(true)
  })

  it('rejects any element, attribute, or declaration outside the written form', () => {
    const variants = [
      wordmark.replace('</svg>', '<script>alert(1)</script></svg>'),
      wordmark.replace('<path d=', '<image href="https://example.com/x.png"/><path d='),
      wordmark.replace('Z"/>', 'Z" fill="red"/>'),
      wordmark.replace('viewBox="0 0 60.53 24"', 'viewBox="0 0 61 24"'),
      `<?xml version="1.0"?>${wordmark}`,
      wordmark.replace('Z"/>', 'Z A1 1 0 0 0 2 2"/>'),
      wordmark.replace('fill="currentColor">', 'fill="currentColor"><style>path { fill: url(https://example.com) }</style>'),
    ]
    for (const variant of variants) {
      expect(isBrandSvg(variant)).toBe(false)
    }
  })
})
