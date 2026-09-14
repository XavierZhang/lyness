/**
 * Coverage over what a caller receives: the SVG and geometry a real font
 * produces, and each refusal a name or a font file can cause.
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { typesetWordmark, WORDMARK_HEIGHT, WORDMARK_MAX_ASPECT, WordmarkError } from '../src/index.ts'

const require = createRequire(import.meta.url)
const inter = new Uint8Array(readFileSync(require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff2')))

/**
 * Run a call expected to refuse, and report what it refused with.
 * @param run - the call.
 * @returns the refusal code, the foreign error, or undefined when nothing was thrown.
 */
function refusal(run: () => unknown): unknown {
  try {
    run()
  } catch (error) {
    return error instanceof WordmarkError ? error.code : error
  }
  return undefined
}

/**
 * The path data of a wordmark.
 * @param svg - the wordmark document.
 * @returns the `d` attribute.
 */
function pathData(svg: string): string {
  return /\sd="([^"]+)"/u.exec(svg)?.[1] ?? ''
}

describe('typesetWordmark', () => {
  it('sets a name as one currentColor path in a box as high as the brand row', () => {
    const mark = typesetWordmark('lyness', inter)

    expect(mark.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" ')).toBe(true)
    expect(mark.svg.match(/<[a-z]+/gu)).toEqual(['<svg', '<path'])
    expect(mark.svg).toMatch(/<path d="[^"]+"\/><\/svg>$/u)
    expect(mark.svg).toContain('height="24"')
    expect(mark.svg).toContain('fill="currentColor"')
    expect(mark.svg).toContain(`width="${String(mark.width)}"`)
    expect(mark.svg).toContain(`viewBox="0 0 ${String(mark.width)} ${String(WORDMARK_HEIGHT)}"`)
    expect(mark.aspect).toBeCloseTo(mark.width / WORDMARK_HEIGHT, 10)
    expect(mark.aspect).toBeGreaterThan(1)
    expect(mark.aspect).toBeLessThan(WORDMARK_MAX_ASPECT)
  })

  it('writes coordinates with at most two decimals and no negative zero', () => {
    const data = pathData(typesetWordmark('lyness', inter).svg)
    expect(data).not.toBe('')
    expect(data).not.toMatch(/\d\.\d{3}/u)
    expect(data).not.toMatch(/-0(?![.\d])/u)
  })

  it('draws a letter at the same size and place whether or not the name has a descender', () => {
    const alone = pathData(typesetWordmark('n', inter).svg)
    expect(pathData(typesetWordmark('ny', inter).svg).startsWith(alone)).toBe(true)
  })

  it('produces the same document for the same name and font, however the bytes are held', () => {
    const padded = new Uint8Array(inter.length + 16)
    padded.set(inter, 8)
    expect(typesetWordmark('lyness', padded.subarray(8, 8 + inter.length)).svg)
      .toBe(typesetWordmark('lyness', inter).svg)
  })

  it('refuses a name with a line break or control character', () => {
    expect(refusal(() => typesetWordmark('ly\nness', inter))).toBe('CONTROL_CHARACTER')
    expect(refusal(() => typesetWordmark('ly\tness', inter))).toBe('CONTROL_CHARACTER')
  })

  it('refuses bytes that are not a font, and a font collection', () => {
    expect(refusal(() => typesetWordmark('lyness', new TextEncoder().encode('not a font')))).toBe('UNREADABLE_FONT')

    const collection = new Uint8Array(12)
    collection.set(new TextEncoder().encode('ttcf'))
    new DataView(collection.buffer).setUint32(4, 0x00010000)
    expect(refusal(() => typesetWordmark('lyness', collection))).toBe('FONT_COLLECTION')
  })

  it('refuses a name the font has no glyph for, naming the characters', () => {
    expect(refusal(() => typesetWordmark('领驭', inter))).toBe('MISSING_GLYPH')
    expect(() => typesetWordmark('lyness 领驭', inter)).toThrow(/"领", "驭"/u)
  })

  it('refuses a name with nothing visible in it', () => {
    for (const name of ['', ' ', '​']) {
      expect(refusal(() => typesetWordmark(name, inter))).toBe('NO_VISIBLE_GLYPH')
    }
  })

  it('refuses a wordmark wider than the sidebar shows whole', () => {
    const name = 'lyness '.repeat(4).trim()
    expect(refusal(() => typesetWordmark(name, inter))).toBe('TOO_WIDE')
    expect(() => typesetWordmark(name, inter)).toThrow(/wider than 7:1/u)
  })
})
