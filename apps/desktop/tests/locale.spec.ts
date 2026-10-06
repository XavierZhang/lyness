import { describe, expect, it } from 'vitest'
import { en, formatDesktopMessage, resolveDesktopLocale, resolveDesktopStartupLocale, zh } from '../src/locale.ts'

describe('desktop locale dictionaries', () => {
  it('ships the same key set in English and Chinese', () => {
    expect(Object.keys(zh)).toEqual(Object.keys(en))
    expect(Object.keys(resolveDesktopLocale('zh-Hans-CN').messages)).toEqual(Object.keys(zh))
    expect(resolveDesktopLocale('en-US').messages).toEqual(resolveDesktopLocale('fr-FR').messages)
    expect(resolveDesktopLocale('zh-Hans-CN').messages).not.toEqual(resolveDesktopLocale('en-US').messages)
  })

  it('fills the product names the build carries, and only those', () => {
    const built = resolveDesktopLocale('en').messages
    expect(en.startupAddressInUse).toContain('{brandAbbr}')
    expect(built.startupAddressInUse).toContain('Another LYN instance')
    expect(built.startupFailed).toBe('lyness is unavailable')

    const acme = resolveDesktopLocale('en', { brandName: 'Acme Agent', brandAbbr: 'ACME', brandNameZh: '艾可' }).messages
    expect(acme.startupFailed).toBe('Acme Agent is unavailable')
    expect(acme.startupAddressInUse).toContain('Another ACME instance')
    // A per-call value is still the caller's to fill.
    expect(acme.updateDownloadedTitle).toBe('Acme Agent v{version} downloaded')
  })

  it('formats named values without consuming unknown placeholders', () => {
    expect(formatDesktopMessage('{name}@{version} {missing}', { name: 'plugin', version: '1.2.3' }))
      .toBe('plugin@1.2.3 {missing}')
  })

  it('prefers an explicit supported choice, then the first supported system language', () => {
    expect(resolveDesktopStartupLocale('zh', ['en-US']).id).toBe('zh-CN')
    expect(resolveDesktopStartupLocale('EN', ['zh-CN']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, ['ja-JP', 'zh-Hant', 'en-US']).id).toBe('zh-CN')
    expect(resolveDesktopStartupLocale(null, ['en-US', 'zh-CN']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, ['ja-JP']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, []).id).toBe('en')
    expect(resolveDesktopStartupLocale('ja', ['zh-CN']).id).toBe('zh-CN')
  })

})
