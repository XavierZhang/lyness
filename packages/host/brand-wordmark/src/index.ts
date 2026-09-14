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
 * @returns the font.
 * @throws {WordmarkError} when the bytes are not a font, or hold a collection of several.
 */
function openFont(fontData: Uint8Array): fontkit.Font {
  let opened: fontkit.Font | fontkit.FontCollection
  try {
    opened = fontkit.create(Buffer.from(fontData.buffer, fontData.byteOffset, fontData.byteLength))
  } catch (error) {
    throw new WordmarkError('UNREADABLE_FONT', `the font file could not be read: ${String(error)}`)
  }
  if (!('layout' in opened)) {
    throw new WordmarkError('FONT_COLLECTION', 'the font file is a collection; supply a single font')
  }
  return opened
}

/**
 * Typeset a brand name in a font.
 *
 * The coordinate box is the font's line box, from ascent to descent and
 * widened to any ink that overflows it, scaled to {@link WORDMARK_HEIGHT}.
 * Every name set in one font therefore shows its letters at the same size and
 * height whether or not it has ascenders or descenders. The width is the ink
 * of the shaped run, with the kerning and substitutions the font specifies.
 * @param text - the brand name, on one line.
 * @param fontData - one OpenType font file: TTF, OTF, WOFF, or WOFF2.
 * @returns the wordmark.
 * @throws {WordmarkError} when the name holds a line break or control character,
 * the font file is unreadable or a collection, a character has no glyph, nothing
 * in the name is visible, or the wordmark is wider than {@link WORDMARK_MAX_ASPECT}.
 */
export function typesetWordmark(text: string, fontData: Uint8Array): Wordmark {
  if (NON_PRINTING.test(text)) {
    throw new WordmarkError('CONTROL_CHARACTER', `${JSON.stringify(text)} holds a line break or control character`)
  }
  const font = openFont(fontData)
  const missing = [...new Set(text)].filter(character => !font.hasGlyphForCodePoint(Number(character.codePointAt(0))))
  if (missing.length > 0) {
    throw new WordmarkError(
      'MISSING_GLYPH',
      `the font has no glyph for ${missing.map(character => JSON.stringify(character)).join(', ')}`,
    )
  }

  const run = font.layout(text)
  const { minX, minY, maxX, maxY } = run.bbox
  // A run with no ink reports infinite bounds, which fail this comparison.
  if (!(maxX > minX)) {
    throw new WordmarkError('NO_VISIBLE_GLYPH', `${JSON.stringify(text)} has no visible character`)
  }
  const top = Math.max(font.ascent, maxY)
  const scale = WORDMARK_HEIGHT / (top - Math.min(font.descent, minY))
  const width = Number(coordinate((maxX - minX) * scale))
  const aspect = width / WORDMARK_HEIGHT
  if (aspect > WORDMARK_MAX_ASPECT) {
    throw new WordmarkError(
      'TOO_WIDE',
      `${JSON.stringify(text)} sets ${coordinate(aspect)}:1, wider than ${String(WORDMARK_MAX_ASPECT)}:1 the sidebar shows whole`,
    )
  }

  let pen = 0
  let data = ''
  for (const [index, glyph] of run.glyphs.entries()) {
    const position = run.positions[index]
    /* v8 ignore next -- fontkit lays out one position per glyph; the guard exists for index checking. */
    if (position === undefined) {
      throw new Error('brand-wordmark: fontkit returned fewer positions than glyphs')
    }
    data += glyph.path
      .scale(scale, -scale)
      .translate((pen + position.xOffset - minX) * scale, (top - position.yOffset) * scale)
      .toSVG()
    pen += position.xAdvance
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
