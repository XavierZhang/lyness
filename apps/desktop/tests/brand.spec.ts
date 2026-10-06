/**
 * The product names a packaged build carries into the shell's own copy, and the
 * window arguments that take them to a renderer resolving its own dictionary.
 */
import { describe, expect, it } from 'vitest'
import { BUILT_IN_BRAND } from '../src/brand-names.ts'
import { desktopBrandArguments, readDesktopBrandArguments, resolveDesktopBrand } from '../src/brand.ts'

describe('desktop brand names', () => {
  it('stands the built-in names for a launch that packaged none', () => {
    expect(resolveDesktopBrand(undefined)).toEqual(BUILT_IN_BRAND)
    expect(resolveDesktopBrand(null)).toEqual(BUILT_IN_BRAND)
    expect(resolveDesktopBrand({ lynDesktopAppId: 'com.example.app' })).toEqual(BUILT_IN_BRAND)
  })

  it('keeps each name the manifest carries', () => {
    expect(resolveDesktopBrand({ lynBrandName: 'Acme Agent', lynBrandAbbr: 'ACME', lynBrandNameZh: '艾可' }))
      .toEqual({ brandName: 'Acme Agent', brandAbbr: 'ACME', brandNameZh: '艾可' })
  })

  it.each([
    ['only a product name', { lynBrandName: 'Acme Agent' }, 'Acme Agent'],
    ['only an abbreviation', { lynBrandAbbr: 'ACME' }, 'ACME'],
    ['only a Chinese name', { lynBrandNameZh: '艾可' }, '艾可'],
  ])('carries the names it left out from the one it packaged, packaging %s', (_case, manifest, expected) => {
    expect(resolveDesktopBrand(manifest))
      .toEqual({ brandName: expected, brandAbbr: expected, brandNameZh: expected })
  })

  it.each([
    ['a brace, which would reopen substitution', 'Acme {brandName}'],
    ['a line break', 'Acme\nAgent'],
    ['an empty string', ''],
    ['prose rather than a name', 'A'.repeat(65)],
    ['a number', 7],
  ])('refuses %s and keeps the built-in names', (_case, value) => {
    expect(resolveDesktopBrand({ lynBrandName: value })).toEqual(BUILT_IN_BRAND)
  })

  it('replaces an unusable name with the packaged name, not the built-in one', () => {
    expect(resolveDesktopBrand({ lynBrandName: 'Acme Agent', lynBrandAbbr: 'A{B}' }))
      .toEqual({ brandName: 'Acme Agent', brandAbbr: 'Acme Agent', brandNameZh: 'Acme Agent' })
  })

  it('carries the names to a renderer and back', () => {
    const brand = { brandName: 'Acme Agent', brandAbbr: 'ACME', brandNameZh: '艾可' }
    const argv = desktopBrandArguments(brand)
    expect(argv).toEqual(['--lyn-brand-name=Acme Agent', '--lyn-brand-abbr=ACME', '--lyn-brand-name-zh=艾可'])
    expect(readDesktopBrandArguments(['/electron', '--lyn-welcome-locale=zh-CN', ...argv])).toEqual(brand)
  })

  it('reads the built-in names when a window carried none or carried an unusable one', () => {
    expect(readDesktopBrandArguments([])).toEqual(BUILT_IN_BRAND)
    expect(readDesktopBrandArguments(['--lyn-brand-name=Acme{', '--lyn-brand-abbr=ACME']))
      .toEqual({ ...BUILT_IN_BRAND, brandAbbr: 'ACME' })
  })
})
