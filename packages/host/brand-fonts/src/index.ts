/**
 * @lyness/lyn-host-brand-fonts — the fonts the platform typesets wordmarks in
 * when a brand supplies none of its own.
 *
 * The fonts are distributed unmodified under the SIL Open Font License 1.1,
 * which permits bundling them with software; each file's license travels
 * beside it in `fonts/`, and `third-party-assets.json` records its source and
 * checksum for the third-party notices. Together they draw Latin, Greek,
 * Cyrillic, and Vietnamese text in Inter, and Chinese, Japanese kana and kanji,
 * and Korean Hangul in Noto Sans CJK.
 * @module @lyness/lyn-host-brand-fonts
 */

import { readFileSync } from 'node:fs'

/** One built-in font. */
export interface BrandFont {
  /** Family and style, as the font names itself. */
  readonly name: string
  /** Location of the font file inside this package. */
  readonly url: URL
  /** Scripts the platform relies on this font to draw. */
  readonly scripts: readonly string[]
}

/**
 * The built-in fonts in fallback order: a character is set in the first font
 * that draws it. Inter comes first so Latin letters keep Inter's shapes even
 * though Noto Sans CJK also draws them.
 */
export const BRAND_FONTS: readonly [BrandFont, ...BrandFont[]] = [
  {
    name: 'Inter SemiBold',
    url: new URL('../fonts/Inter-SemiBold.ttf', import.meta.url),
    scripts: ['Latin', 'Greek', 'Cyrillic'],
  },
  {
    name: 'Noto Sans CJK SC Medium',
    url: new URL('../fonts/NotoSansCJKsc-Medium.otf', import.meta.url),
    scripts: ['Han', 'Hiragana', 'Katakana', 'Hangul'],
  },
]

/**
 * Read every built-in font, in fallback order, ready for `typesetWordmark`.
 * @returns the font files' bytes.
 */
export function loadBrandFonts(): readonly [Uint8Array, ...Uint8Array[]] {
  const [first, ...rest] = BRAND_FONTS
  const read = (font: BrandFont): Uint8Array => new Uint8Array(readFileSync(font.url))
  return [read(first), ...rest.map(read)]
}
