/**
 * @lyness/lyn-host-brand-wordmark — typesets a brand name into a single-colour
 * SVG wordmark sized for the Web shell's sidebar brand row.
 *
 * A wordmark is set in a font rather than drawn by an image model: a model
 * misspells letters and cannot be trusted with a name it has not seen, while a
 * font renders exactly the characters it is given. The output holds paths
 * only, with no text element and no font reference, so it renders the same
 * wherever it is served and carries nothing a brand-asset allowlist rejects.
 * @module @lyness/lyn-host-brand-wordmark
 */

import * as fontkit from 'fontkit'

/**
 * Height of every wordmark's coordinate box, in the units its width uses.
 *
 * The sidebar draws the brand name in a 24px row, so a wordmark rendered at its
 * intrinsic size fills that row.
 */
export const WORDMARK_HEIGHT = 24

/**
 * Widest wordmark the sidebar shows whole, as width over height.
 *
 * At the narrowest sidebar the brand row leaves 168px beside the mark for a
 * 24px-high name; the row clips anything wider at its right edge.
 */
export const WORDMARK_MAX_ASPECT = 7

/** Why a brand name and font could not produce a wordmark. */
export type WordmarkErrorCode =
  | 'CONTROL_CHARACTER'
  | 'UNREADABLE_FONT'
  | 'FONT_COLLECTION'
  | 'MISSING_GLYPH'
  | 'NO_VISIBLE_GLYPH'
  | 'TOO_WIDE'

/** A brand name and font that cannot produce a usable wordmark. */
export class WordmarkError extends Error {
  /** Stable reason, for callers that branch on the failure. */
  readonly code: WordmarkErrorCode

  constructor(code: WordmarkErrorCode, message: string) {
    super(`brand-wordmark: ${message}`)
    this.name = 'WordmarkError'
    this.code = code
  }
}

/** A typeset wordmark. */
export interface Wordmark {
  /** Standalone SVG document: one path filled with `currentColor`, no text and no external reference. */
  readonly svg: string
  /** Width of the coordinate box; its height is always {@link WORDMARK_HEIGHT}. */
  readonly width: number
  /** Width over height. */
  readonly aspect: number
}

/** Line breaks and control characters, which a one-line wordmark cannot carry. */
const NON_PRINTING = /[\p{Cc}\p{Zl}\p{Zp}]/u

/** A number in SVG path data, with its sign, fraction, and exponent. */
const PATH_NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu

/**
 * Write a coordinate with two decimals and no negative zero.
 * @param value - the coordinate.
 * @returns its decimal text.
 */
function coordinate(value: number): string {
  // Adding zero turns a rounded negative zero into zero.
  return String(Math.round(value * 100) / 100 + 0)
}

/**
 * Open one font from a file's bytes.
 * @param fontData - the font file.
 * @param label - how refusals name this font among the ones supplied.
 * @returns the font.
 * @throws {WordmarkError} when the bytes are not a font, or hold a collection of several.
 */
function openFont(fontData: Uint8Array, label: string): fontkit.Font {
  let opened: fontkit.Font | fontkit.FontCollection
  try {
    opened = fontkit.create(Buffer.from(fontData.buffer, fontData.byteOffset, fontData.byteLength))
  } catch (error) {
    throw new WordmarkError('UNREADABLE_FONT', `${label} could not be read: ${String(error)}`)
  }
  if (!('layout' in opened)) {
    throw new WordmarkError('FONT_COLLECTION', `${label} is a collection; supply a single font`)
  }
  return opened
}

/** Consecutive characters set in one font. */
interface Run {
  readonly font: fontkit.Font
  text: string
}

/** Whitespace, which stays in the run before it rather than switching fonts for one space. */
const WHITESPACE = /^\s+$/u

/**
 * Assign each character to the first font that draws it, and join neighbours
 * set in the same font into runs. A character is a grapheme cluster, so a
 * base letter and its combining marks are never split across fonts.
 * @param text - the brand name.
 * @param fonts - the fonts, in preference order.
 * @returns the runs, in reading order.
 * @throws {WordmarkError} when no font draws some character.
 */
function splitRuns(text: string, fonts: readonly fontkit.Font[]): Run[] {
  const runs: Run[] = []
  const missing = new Set<string>()
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    const draws = (font: fontkit.Font): boolean => {
      for (const character of segment) {
        if (!font.hasGlyphForCodePoint(Number(character.codePointAt(0)))) return false
      }
      return true
    }
    const last = runs.at(-1)
    if (last !== undefined && WHITESPACE.test(segment) && draws(last.font)) {
      last.text += segment
      continue
    }
    const font = fonts.find(draws)
    if (font === undefined) missing.add(segment)
    else if (last?.font === font) last.text += segment
    else runs.push({ font, text: segment })
  }
  if (missing.size > 0) {
    throw new WordmarkError('MISSING_GLYPH', `no font has a glyph for ${[...missing].map(character => JSON.stringify(character)).join(', ')}`)
  }
  return runs
}

/**
 * Typeset a brand name in a list of fonts.
 *
 * Each character is set in the first font that draws it, so a platform can
 * pair a Latin font with a CJK font and a name mixing both scripts still sets
 * whole. The coordinate box is the line box of the fonts the name actually
 * uses, from the highest ascent to the lowest descent and widened to any ink
 * that overflows it, scaled to {@link WORDMARK_HEIGHT}. Every name set in the
 * same fonts therefore shows its letters at the same size and height whether or
 * not it has ascenders or descenders. The width is the ink of the shaped runs,
 * with the kerning and substitutions each font specifies inside its run.
 * @param text - the brand name, on one line.
 * @param fonts - OpenType font files, TTF, OTF, WOFF, or WOFF2, in preference order.
 * @returns the wordmark.
 * @throws {WordmarkError} when the name holds a line break or control character,
 * a font file is unreadable or a collection, no font draws some character,
 * nothing in the name is visible, or the wordmark is wider than {@link WORDMARK_MAX_ASPECT}.
 */
export function typesetWordmark(text: string, fonts: readonly [Uint8Array, ...Uint8Array[]]): Wordmark {
  if (NON_PRINTING.test(text)) {
    throw new WordmarkError('CONTROL_CHARACTER', `${JSON.stringify(text)} holds a line break or control character`)
  }
  const opened = fonts.map((fontData, index) => openFont(fontData, fonts.length === 1 ? 'the font file' : `font ${String(index + 1)}`))
  const laid = splitRuns(text, opened).map(run => ({ font: run.font, glyphs: run.font.layout(run.text) }))

  // Geometry in ems, so fonts with different units per em share one scale.
  let pen = 0
  let minX = Infinity
  let maxX = -Infinity
  let top = -Infinity
  let bottom = Infinity
  const origins: number[] = []
  for (const { font, glyphs } of laid) {
    const em = font.unitsPerEm
    const box = glyphs.bbox
    origins.push(pen)
    // A run with no ink reports infinite bounds, which fail this comparison.
    if (box.maxX > box.minX) {
      minX = Math.min(minX, pen + box.minX / em)
      maxX = Math.max(maxX, pen + box.maxX / em)
      top = Math.max(top, box.maxY / em)
      bottom = Math.min(bottom, box.minY / em)
    }
    top = Math.max(top, font.ascent / em)
    bottom = Math.min(bottom, font.descent / em)
    pen += glyphs.advanceWidth / em
  }
  if (!(maxX > minX)) {
    throw new WordmarkError('NO_VISIBLE_GLYPH', `${JSON.stringify(text)} has no visible character`)
  }
  const scale = WORDMARK_HEIGHT / (top - bottom)
  const width = Number(coordinate((maxX - minX) * scale))
  const aspect = width / WORDMARK_HEIGHT
  if (aspect > WORDMARK_MAX_ASPECT) {
    throw new WordmarkError(
      'TOO_WIDE',
      `${JSON.stringify(text)} sets ${coordinate(aspect)}:1, wider than ${String(WORDMARK_MAX_ASPECT)}:1 the sidebar shows whole`,
    )
  }

  let data = ''
  for (const [runIndex, { font, glyphs }] of laid.entries()) {
    const em = font.unitsPerEm
    let advance = 0
    for (const [index, glyph] of glyphs.glyphs.entries()) {
      const position = glyphs.positions[index]
      /* v8 ignore next -- fontkit lays out one position per glyph; the guard exists for index checking. */
      if (position === undefined) {
        throw new Error('brand-wordmark: fontkit returned fewer positions than glyphs')
      }
      const x = Number(origins[runIndex]) + (advance + position.xOffset) / em
      data += glyph.path
        .scale(scale / em, -scale / em)
        .translate((x - minX) * scale, (top - position.yOffset / em) * scale)
        .toSVG()
      advance += position.xAdvance
    }
  }
  const d = data.replace(PATH_NUMBER, number => coordinate(Number(number)))
  const size = `width="${String(width)}" height="${String(WORDMARK_HEIGHT)}"`
  const box = `viewBox="0 0 ${String(width)} ${String(WORDMARK_HEIGHT)}"`
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" ${size} ${box} fill="currentColor"><path d="${d}"/></svg>`,
    width,
    aspect,
  }
}
