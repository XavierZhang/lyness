/**
 * The built-in fonts as a wordmark caller uses them: every script the platform
 * promises typesets into a brand SVG, and Latin letters stay in Inter.
 */

import { describe, expect, it } from 'vitest'
import { isBrandSvg } from '@deepseek-ai/dsh-host-brand-icon'
import { typesetWordmark } from '@deepseek-ai/dsh-host-brand-wordmark'
import { BRAND_FONTS, loadBrandFonts } from '../src/index.ts'

const fonts = loadBrandFonts()

describe('built-in brand fonts', () => {
  it('loads every font in fallback order', () => {
    expect(fonts).toHaveLength(BRAND_FONTS.length)
    expect(BRAND_FONTS.map(font => font.name)).toEqual(['Inter SemiBold', 'Noto Sans CJK SC Medium'])
    for (const bytes of fonts) expect(bytes.byteLength).toBeGreaterThan(0)
  })

  it.each([
    ['English', 'HARNESS'],
    ['Vietnamese', 'Việt Nam'],
    ['Greek', 'Λύνεσς'],
    ['Cyrillic', 'Лайнесс'],
    ['Simplified Chinese', '领驭'],
    ['Traditional Chinese', '領馭'],
    ['Japanese', 'リネス'],
    ['Korean', '라이네스'],
    ['mixed', '领驭 DeepSeek Harness'],
  ])('typesets a %s name into a brand SVG', (_script, name) => {
    expect(isBrandSvg(typesetWordmark(name, fonts).svg)).toBe(true)
  })

  it('keeps Latin letters in Inter although Noto Sans CJK also draws them', () => {
    const [inter] = fonts
    expect(typesetWordmark('HARNESS', fonts).svg).toBe(typesetWordmark('HARNESS', [inter]).svg)
  })
})
